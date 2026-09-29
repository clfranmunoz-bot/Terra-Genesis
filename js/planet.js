/**
 * Planet Module: visor 3D de la Tierra (Three.js r128).
 * - Superficie, nubes y atmósfera con shaders propios, iluminados en espacio lineal (sRGB decodificado a mano) y con tone mapping ACES.
 * - El hielo, la nieve y la vista térmica salen de las temperaturas por banda del modelo de clima (Fisica.pasoEBM).
 * - La dirección del Sol sigue la declinación del día (estaciones) y la luz tiene el color de cuerpo negro de la estrella.
 * - La atmósfera es dispersión simple de Rayleigh y Mie integrada a lo largo del rayo, con el espesor óptico físico.
 * - Eje inclinado fijo en el espacio: la Tierra, las nubes, las auroras y el campo magnético giran dentro de él.
 */
const RADIO_KM = 6371;
const TOPO_MAX_M = 6400;   // earth_topology.png: gris lineal 0–255 = 0–6400 m (calibrado con el Tíbet, el Altiplano, Denver y Groenlandia: ~25 m por nivel)

// Funciones GLSL comunes
const GLSL_COMUN = `
    vec3 srgbALineal(vec3 c) { return pow(c, vec3(2.2)); }
    // Masa de aire relativa (Kasten & Young 1989, Appl. Opt. 28): vale 1 en el cenit y ~38 en el horizonte
    float masaAire(float cosZ) {
        float z = degrees(acos(clamp(cosZ, 0.0, 1.0)));
        return 1.0 / (max(cosZ, 0.0) + 0.50572 * pow(96.07995 - z, -1.6364));
    }
`;

class PlanetViewer {
    constructor(containerId, simulation) {
        this.container = document.getElementById(containerId);
        this.simulation = simulation;

        this.width = this.container.clientWidth || window.innerWidth;
        this.height = this.container.clientHeight || window.innerHeight;

        this.planetRadius = 6.5;
        this.cloudRotationOffset = 0.0;
        this.earthRotation = 0.0;

        this.isRotationPaused = false;
        this.rotationSpeed = 1.0;
        this.showClouds = true;
        this.showAtmosphere = true;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.initScene();
        this.loadTextures();
        this.createSkybox();
        this.createStar();
        this.createEarth();
        this.createClouds();
        this.createAtmosphere();
        this.createAuroras();
        this.createMagneticFieldLines();
        this.createProbeVisuals();
        this.initMeteorEffects();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    initScene() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 1000);
        this.camera.position.set(0, 3, 20);
        // En pantallas verticales el campo de visión horizontal es menor: alejar la cámara para que el globo quepa a lo ancho
        const aspecto = this.width / this.height;
        if (aspecto < 1) this.camera.position.multiplyScalar(Math.min(2.4, 1 / aspecto));

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 8.5;
        this.controls.maxDistance = 55;

        // Dirección del Sol (unitaria, en el espacio del mundo). Se recalcula cada cuadro con la declinación del día.
        this.sunDir = new THREE.Vector3(60, 20, 45).normalize();
        this.sunColor = new THREE.Vector3(1, 1, 1);
        this.intensidadSol = 1.0;

        // Eje de rotación inclinado: todo lo que gira con el planeta cuelga de este grupo
        this.ejeGroup = new THREE.Group();
        this.scene.add(this.ejeGroup);
    }

    loadTextures() {
        const loader = new THREE.TextureLoader();
        const load = (path) => {
            const tex = loader.load(path);
            tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
            return tex;
        };

        // Texturas 8K (Blue Marble 2002, NASA, dominio público) solo en escritorio con GPU que admita 8192 px:
        // una textura 8K ocupa ~170 MB de memoria gráfica con mipmaps y puede cerrar la app en móviles y tabletas.
        const usar8K = this.renderer.capabilities.maxTextureSize >= 8192 && !window.matchMedia('(max-width: 1024px)').matches;
        this.texDay = load(usar8K ? 'textures/earth_day_8k.jpg' : 'textures/earth_day.jpg');
        this.texNight = load('textures/earth_night.jpg');
        this.texClouds = load('textures/earth_clouds.png');
        this.texClouds.wrapS = THREE.RepeatWrapping;
        this.texClouds.wrapT = THREE.ClampToEdgeWrapping;
        this.texNormal = load('textures/earth_normal.jpg');
        // Máscara de agua (blanco = agua). La de 8K se generó por color desde la Blue Marble (ver textures/LEEME.md)
        this.texSpecular = load(usar8K ? 'textures/earth_water_8k.png' : 'textures/earth_specular.jpg');
        this.texTopology = load('textures/earth_topology.png');
        this.texBathymetry = load('textures/earth_bathymetry.png'); // GEBCO vía NASA (ver textures/LEEME.md)
        this.texPaleo240 = load('textures/paleo_240ma_2048.jpg');
        this.texPaleo150 = load('textures/paleo_150ma_2048.jpg');
        this.texPaleo065 = load('textures/paleo_065ma_2048.jpg');
        this.texPaleoAgua = load('textures/paleo_agua.png');         // R = 65 Ma, G = 150 Ma, B = 240 Ma (tool/generar_mascaras_paleo.js)
        this.texSky = load('textures/night_sky.png');
        this.texSky.encoding = THREE.sRGBEncoding;                   // lo decodifica el material estándar del fondo
    }

    createSkybox() {
        const skyGeo = new THREE.SphereGeometry(250, 48, 48);
        const skyMat = new THREE.MeshBasicMaterial({ map: this.texSky, side: THREE.BackSide, color: 0x9a9a9a });
        this.skyboxMesh = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.skyboxMesh);
    }

    // Disco de la estrella con su tamaño angular real (2R/d) y su color de cuerpo negro, más un halo
    createStar() {
        // Textura radial: disco nítido (paradas hasta el borde) o halo de caída suave
        const textura = (paradas) => {
            const lienzo = document.createElement('canvas');
            lienzo.width = lienzo.height = 128;
            const ctx = lienzo.getContext('2d');
            const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            paradas.forEach(([t, a]) => grad.addColorStop(t, `rgba(255,255,255,${a})`));
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
            return new THREE.CanvasTexture(lienzo);
        };
        const material = (tex) => new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
        this.starCore = new THREE.Sprite(material(textura([[0, 1], [0.45, 1], [0.5, 0]])));
        this.starGlow = new THREE.Sprite(material(textura([[0, 0.5], [0.1, 0.22], [0.3, 0.06], [0.6, 0.015], [1, 0]])));
        this.scene.add(this.starCore, this.starGlow);
    }

    createEarth() {
        const earthGeo = new THREE.SphereGeometry(this.planetRadius, 128, 128);

        const earthVertexShader = `
            varying vec2 vUv;
            varying vec3 vNormalWorld;
            varying vec3 vObjNormal;
            varying vec3 vWorldPosition;

            void main() {
                vUv = uv;
                vObjNormal = normal;
                vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const earthFragmentShader = `
            varying vec2 vUv;
            varying vec3 vNormalWorld;
            varying vec3 vObjNormal;
            varying vec3 vWorldPosition;

            uniform sampler2D uDayMap;
            uniform sampler2D uNightMap;
            uniform sampler2D uCloudsMap;
            uniform sampler2D uSpecularMap;
            uniform sampler2D uNormalMap;
            uniform sampler2D uTopologyMap;   // elevación: 0–6400 m lineal
            uniform sampler2D uBathymetryMap; // GEBCO: v = √(profundidad/8000 m)
            uniform sampler2D uPaleo240Map;
            uniform sampler2D uPaleo150Map;
            uniform sampler2D uPaleo065Map;
            uniform sampler2D uPaleoAgua;

            uniform vec3 uSunDir;
            uniform vec3 uSunColor;           // lineal
            uniform float uSunI;
            uniform vec3 uTau;                // espesor óptico vertical por canal (Rayleigh + aerosoles)
            uniform vec3 uEje;                // eje de rotación en el mundo

            uniform vec3 uOceanColor;
            uniform vec3 uOceanShallowColor;
            uniform float uAbioticFactor;
            uniform float uDinosaurFactor;
            uniform float uNightLights;
            uniform float uVolcanism;
            uniform float uErosionFactor;
            uniform float uSeaLevelOffset;
            uniform float uGeologicalMa;      // Millones de años (-250 a +250)
            uniform float uViewMode;          // 0=óptico, 1=térmico, 2=NDVI, 3=magnético
            uniform float uGlobalLight;       // 1 = iluminación uniforme sin noche
            uniform vec2 uCloudsOffset;
            uniform float uShowClouds;
            uniform vec3 uPigmentColor;

            // Temperaturas del modelo de clima (°C a nivel del mar) para el día que se muestra
            uniform float uBandL[18];
            uniform float uBandO[18];
            uniform float uAnclado;
            uniform float uTdia;
            uniform float uTnoche;

            // Cráteres en coordenadas del planeta
            uniform vec3 uCraterCenters[4];
            uniform float uCraterRadii[4];
            uniform int uCraterCount;

            ${GLSL_COMUN}

            float bandaT(float x, bool tierra) {
                float f = clamp((x + 1.0) * 9.0 - 0.5, 0.0, 17.0);
                float i0 = floor(f), i1 = min(i0 + 1.0, 17.0);
                float a = 0.0, b = 0.0;
                for (int i = 0; i < 18; i++) {
                    float v = tierra ? uBandL[i] : uBandO[i];
                    if (float(i) == i0) a = v;
                    if (float(i) == i1) b = v;
                }
                return mix(a, b, f - i0);
            }
            float temperaturaAnclado(float cosPsi) {
                return cosPsi > 0.0 ? uTnoche + 1.5 * (uTdia - uTnoche) * sqrt(cosPsi) : uTnoche;
            }

            void main() {
                vec4 dayTex = texture2D(uDayMap, vUv);
                float isWater = texture2D(uSpecularMap, vUv).r;
                float mascaraActual = isWater;
                float topoElev = texture2D(uTopologyMap, vUv).r;
                float bat = texture2D(uBathymetryMap, vUv).r;
                float profundidadM = 8000.0 * bat * bat;
                vec3 surfaceColor = dayTex.rgb;
                bool presente = uGeologicalMa > -1.0;

                // ---- Paleogeografía (texturas a 240, 150 y 65 Ma interpoladas; las costas vienen precalculadas en uPaleoAgua)
                if (!presente) {
                    vec3 agua = texture2D(uPaleoAgua, vUv).rgb;
                    vec3 p065 = texture2D(uPaleo065Map, vUv).rgb, p150 = texture2D(uPaleo150Map, vUv).rgb, p240 = texture2D(uPaleo240Map, vUv).rgb;
                    float ma = -uGeologicalMa;
                    if (ma <= 66.0) {
                        float f = ma / 66.0;
                        surfaceColor = mix(dayTex.rgb, p065, f); isWater = mix(isWater, agua.r, f);
                    } else if (ma <= 150.0) {
                        float f = (ma - 66.0) / 84.0;
                        surfaceColor = mix(p065, p150, f); isWater = mix(agua.r, agua.g, f);
                    } else {
                        float f = clamp((ma - 150.0) / 100.0, 0.0, 1.0);
                        surfaceColor = mix(p150, p240, f); isWater = mix(agua.g, agua.b, f);
                    }
                } else {
                    // ---- Nivel del mar con elevaciones reales: sube sobre la topografía, baja sobre la batimetría GEBCO
                    if (uSeaLevelOffset > 0.0) {
                        float umbral = uSeaLevelOffset / ${TOPO_MAX_M.toFixed(1)};
                        isWater = max(isWater, 1.0 - smoothstep(umbral - 0.0008, umbral + 0.0008, topoElev));
                    } else if (uSeaLevelOffset < 0.0) {
                        isWater = min(isWater, smoothstep(-uSeaLevelOffset - 4.0, -uSeaLevelOffset + 4.0, profundidadM));
                    }
                }

                vec3 normal = normalize(vNormalWorld);
                vec3 sunDir = normalize(uSunDir);
                vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                float nDotL = dot(normal, sunDir);
                float standardDay = smoothstep(-0.06, 0.10, nDotL);
                float dayFactor = mix(standardDay, 1.0, uGlobalLight);
                float nightFactor = (1.0 - standardDay) * (1.0 - uGlobalLight);

                // ---- Cráteres de impacto (cuencas inundadas con borde levantado)
                for (int i = 0; i < 4; i++) {
                    if (i >= uCraterCount) break;
                    float d = distance(normalize(vObjNormal), uCraterCenters[i]);
                    float r = uCraterRadii[i];
                    if (d < r) {
                        float normD = d / r;
                        if (normD < 0.82) isWater = 1.0;
                        surfaceColor = mix(surfaceColor, vec3(0.10, 0.07, 0.05), (1.0 - normD) * 0.9);
                        if (normD > 0.82 && normD < 0.98) surfaceColor = mix(surfaceColor, vec3(0.55, 0.42, 0.32), 0.7);
                    }
                }

                float waterMask = smoothstep(0.25, 0.45, isWater);

                // ---- Temperatura local desde el modelo de clima: columna de tierra u océano, −6,5 °C/km en tierra (atmósfera estándar)
                float x = normalize(vObjNormal).y;
                float elevM = presente ? ${TOPO_MAX_M.toFixed(1)} * topoElev * (1.0 - waterMask) : 0.0;
                float Tmar, Ttierra;
                if (uAnclado > 0.5) {
                    Tmar = Ttierra = temperaturaAnclado(nDotL);
                } else {
                    Tmar = bandaT(x, false);
                    Ttierra = bandaT(x, true);
                }
                Ttierra -= 6.5e-3 * elevM;
                float Tlocal = mix(Ttierra, Tmar, waterMask);

                // ---- Agua: color según la profundidad real (claras en las plataformas, azul profundo en alta mar)
                vec3 waterColor = surfaceColor;
                {
                    float depth = clamp(sqrt(profundidadM / 4000.0), 0.0, 1.0);
                    if (mascaraActual < 0.35) {
                        // Tierra inundada: profundidad = nivel del mar − elevación
                        depth = clamp(sqrt(max(0.0, uSeaLevelOffset - ${TOPO_MAX_M.toFixed(1)} * topoElev) / 4000.0), 0.12, 1.0);
                    }
                    if (uGeologicalMa > -5.0) waterColor = mix(surfaceColor, mix(uOceanShallowColor, uOceanColor, depth), 0.88);
                }
                // ---- Continentes
                if (uAbioticFactor > 0.01) {
                    vec3 barrenBasalt = vec3(0.52, 0.36, 0.26) * (surfaceColor.r * 1.5 + 0.35);
                    surfaceColor = mix(surfaceColor, barrenBasalt, uAbioticFactor);
                } else if (uDinosaurFactor > 0.01 && presente) {
                    vec3 lushFlora = vec3(surfaceColor.r * 0.65, surfaceColor.g * 1.35, surfaceColor.b * 0.65);
                    surfaceColor = mix(surfaceColor, lushFlora, uDinosaurFactor * 0.55);
                } else if (presente) {
                    // Pigmento fotosintético: solo tiñe la vegetación
                    float greenAmount = max(0.0, dayTex.g - max(dayTex.r, dayTex.b) * 0.85);
                    if (greenAmount > 0.05) surfaceColor = mix(surfaceColor, uPigmentColor * (dayTex.g * 1.4 + 0.1), 0.75);
                }
                if (presente && uErosionFactor > 0.05) {
                    float relief = texture2D(uNormalMap, vUv).r;
                    surfaceColor = mix(surfaceColor, vec3(0.68, 0.52, 0.38) * (relief * 1.3 + 0.35), uErosionFactor * 0.85);
                }
                // Plataforma continental expuesta al bajar el mar: sedimento
                float lechoExpuesto = smoothstep(0.25, 0.45, mascaraActual) * (1.0 - waterMask) * (presente ? 1.0 : 0.0);
                surfaceColor = mix(surfaceColor, vec3(0.58, 0.52, 0.40), lechoExpuesto);
                surfaceColor = mix(surfaceColor, waterColor, waterMask);

                // ---- Hielo marino y nieve donde la columna baja de −10 °C (el mismo criterio del modelo, ±2 K)
                float ruido = (texture2D(uCloudsMap, vUv * vec2(3.0, 2.0)).a - 0.5) * 5.0;
                float hieloMar = (1.0 - smoothstep(-12.0, -8.0, Tmar + ruido)) * waterMask;
                float nieve = (1.0 - smoothstep(-12.0, -8.0, Ttierra + ruido * 0.5)) * (1.0 - waterMask);
                surfaceColor = mix(surfaceColor, vec3(0.90, 0.94, 0.98), hieloMar * 0.95);
                surfaceColor = mix(surfaceColor, vec3(0.93, 0.95, 0.98), nieve * 0.85);
                float oceanoLibre = waterMask * (1.0 - hieloMar);

                // ---- Iluminación en espacio lineal
                vec3 albedo = srgbALineal(surfaceColor);

                // Relieve: normal perturbada con el gradiente de la topografía (×15 de exageración vertical)
                vec3 nRelieve = normal;
                if (presente) {
                    vec3 este = cross(uEje, normal);
                    if (length(este) > 1e-3) {
                        este = normalize(este);
                        vec3 norte = cross(normal, este);
                        float du = 1.0 / 2048.0, dv = 1.0 / 1024.0;
                        float cosLat = max(0.05, sqrt(max(0.0, 1.0 - x * x)));
                        float dhx = (texture2D(uTopologyMap, vUv + vec2(du, 0.0)).r - texture2D(uTopologyMap, vUv - vec2(du, 0.0)).r)
                                    * ${TOPO_MAX_M.toFixed(1)} / (2.0 * du * 6.2832 * ${RADIO_KM * 1000}.0 * cosLat);
                        float dhy = (texture2D(uTopologyMap, vUv + vec2(0.0, dv)).r - texture2D(uTopologyMap, vUv - vec2(0.0, dv)).r)
                                    * ${TOPO_MAX_M.toFixed(1)} / (2.0 * dv * 3.1416 * ${RADIO_KM * 1000}.0);
                        nRelieve = normalize(normal - 15.0 * (dhx * este + dhy * norte) * (1.0 - waterMask));
                    }
                }

                // Luz del Sol en la superficie: color de la estrella × transmitancia exp(−τ·m) (enrojece cerca del terminador)
                float m = mix(masaAire(nDotL), 1.0, uGlobalLight);
                vec3 luzSol = uSunColor * uSunI * exp(-uTau * m);
                if (uShowClouds > 0.5) {
                    float nube = texture2D(uCloudsMap, vUv + uCloudsOffset).a;
                    luzSol *= 1.0 - 0.5 * smoothstep(0.10, 0.65, nube);
                }
                float difusa = mix(max(0.0, dot(nRelieve, sunDir)), 1.0, uGlobalLight);
                vec3 cieloAmbiente = uSunColor * uSunI * vec3(0.10, 0.17, 0.32) * 0.05 * dayFactor;
                vec3 litDay = albedo * (luzSol * difusa + cieloAmbiente) / 3.1416;

                // Océano: reflejo solar con Fresnel de Schlick (F₀ = 0,02 del agua) y reflejo del cielo en ángulos rasantes.
                // Rugosidad de Cox & Munk (1954) con viento de ~7 m/s: σ² ≈ 0,04 → exponente de Blinn 2/σ² − 2 = 48
                vec3 h = normalize(sunDir + viewDir);
                float fresnelSol = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(h, viewDir)), 5.0);
                float lobulo = (48.0 + 8.0) / (8.0 * 3.1416) * pow(max(0.0, dot(normal, h)), 48.0);
                litDay += luzSol * fresnelSol * lobulo * max(0.0, nDotL) * oceanoLibre * (1.0 - uGlobalLight);
                float fresnelVista = 0.02 + 0.98 * pow(1.0 - max(0.0, dot(normal, viewDir)), 5.0);
                litDay += cieloAmbiente * 4.0 * fresnelVista * oceanoLibre;

                // Luces nocturnas (solo en el presente) y fisuras volcánicas
                vec3 litNight = vec3(0.0);
                if (presente) {
                    // La textura nocturna trae los continentes en azul tenue (R < 15/255) y las ciudades en gris (R ≈ G ≈ B ≈ 100/255):
                    // el canal rojo separa las luces, que toman el color del sodio y los LED; el resto queda casi negro
                    vec3 noche = texture2D(uNightMap, vUv).rgb;
                    float luces = smoothstep(0.08, 0.40, noche.r);
                    vec3 cityGlow = (vec3(1.0, 0.70, 0.40) * luces * 1.5 * uNightLights + srgbALineal(noche) * 0.08) * (1.0 - waterMask);
                    if (uVolcanism > 1.2) {
                        float relief = texture2D(uNormalMap, vUv).r;
                        cityGlow += vec3(1.0, 0.12, 0.01) * smoothstep(0.68, 0.90, relief) * (1.0 - waterMask) * min(2.5, uVolcanism * 0.18);
                    }
                    litNight = cityGlow * nightFactor;
                }

                vec3 finalColor = litDay * dayFactor + litNight;

                // ---- Modos del escáner
                if (uViewMode > 0.5 && uViewMode < 1.5) {
                    // Térmico: temperatura del modelo + ciclo diurno (~±5 K sobre tierra, <1 K sobre el océano; Dai, Trenberth & Karl 1999)
                    float diurno = clamp(nDotL * 1.5, -1.0, 1.0) * mix(5.0, 0.5, waterMask) * (1.0 - uAnclado);
                    float tNorm = clamp((Tlocal + diurno + 50.0) / 100.0, 0.0, 1.0);
                    vec3 thermalColor;
                    if (tNorm < 0.25) thermalColor = mix(vec3(0.02, 0.02, 0.20), vec3(0.0, 0.6, 0.9), tNorm * 4.0);
                    else if (tNorm < 0.50) thermalColor = mix(vec3(0.0, 0.6, 0.9), vec3(0.1, 0.9, 0.2), (tNorm - 0.25) * 4.0);
                    else if (tNorm < 0.75) thermalColor = mix(vec3(0.1, 0.9, 0.2), vec3(1.0, 0.8, 0.0), (tNorm - 0.50) * 4.0);
                    else thermalColor = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 1.0, 1.0), (tNorm - 0.75) * 4.0);
                    finalColor = srgbALineal(thermalColor) * 0.8;
                } else if (uViewMode > 1.5 && uViewMode < 2.5) {
                    float biomass = clamp((dayTex.g - dayTex.r) * 2.5, 0.0, 1.0) * (1.0 - nieve);
                    vec3 ndviTierra = uAbioticFactor > 0.5 ? vec3(0.20) : mix(vec3(0.22), vec3(0.0, 1.0, 0.35), biomass);
                    finalColor = srgbALineal(mix(ndviTierra, vec3(0.05, 0.08, 0.12), waterMask)) * 0.8;
                } else if (uViewMode > 2.5) {
                    float poleProximity = abs(dot(normal, uEje));
                    float dipoleField = sin(poleProximity * 3.14159);
                    vec3 magPlasma = mix(vec3(0.0, 0.85, 1.0), vec3(0.7, 0.2, 1.0), poleProximity);
                    finalColor = mix(finalColor * 0.5, srgbALineal(magPlasma) * 0.8, dipoleField * 0.55 + 0.15);
                }

                gl_FragColor = vec4(finalColor, 1.0);
                #include <tonemapping_fragment>
                #include <encodings_fragment>
            }
        `;

        const cur = this.simulation.current;
        this.earthUniforms = {
            uDayMap: { value: this.texDay },
            uNightMap: { value: this.texNight },
            uCloudsMap: { value: this.texClouds },
            uSpecularMap: { value: this.texSpecular },
            uNormalMap: { value: this.texNormal },
            uTopologyMap: { value: this.texTopology },
            uBathymetryMap: { value: this.texBathymetry },
            uPaleo240Map: { value: this.texPaleo240 },
            uPaleo150Map: { value: this.texPaleo150 },
            uPaleo065Map: { value: this.texPaleo065 },
            uPaleoAgua: { value: this.texPaleoAgua },
            uSunDir: { value: this.sunDir },
            uSunColor: { value: this.sunColor },
            uSunI: { value: 1.0 },
            uTau: { value: new THREE.Vector3(0.06, 0.1, 0.2) },
            uEje: { value: new THREE.Vector3(0, 1, 0) },
            uGeologicalMa: { value: 0.0 },
            uGlobalLight: { value: 0.0 },
            uOceanColor: { value: new THREE.Vector3(...cur.oceanColor) },
            uOceanShallowColor: { value: new THREE.Vector3(...cur.oceanShallowColor) },
            uAbioticFactor: { value: cur.abioticFactor },
            uDinosaurFactor: { value: cur.dinosaurFactor },
            uNightLights: { value: cur.nightLights },
            uVolcanism: { value: cur.volcanism },
            uErosionFactor: { value: cur.erosionFactor },
            uSeaLevelOffset: { value: cur.seaLevelOffset },
            uViewMode: { value: 0.0 },
            uPigmentColor: { value: new THREE.Vector3(0.13, 0.55, 0.13) }, // Verde clorofila
            uCloudsOffset: { value: new THREE.Vector2(0, 0) },
            uShowClouds: { value: 1.0 },
            uBandL: { value: new Array(18).fill(15) },
            uBandO: { value: new Array(18).fill(15) },
            uAnclado: { value: 0 },
            uTdia: { value: 15 },
            uTnoche: { value: 15 },
            uCraterCenters: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
            uCraterRadii: { value: [0, 0, 0, 0] },
            uCraterCount: { value: 0 }
        };

        this.earthMat = new THREE.ShaderMaterial({ vertexShader: earthVertexShader, fragmentShader: earthFragmentShader, uniforms: this.earthUniforms });
        this.earthMesh = new THREE.Mesh(earthGeo, this.earthMat);
        this.ejeGroup.add(this.earthMesh);
    }

    createClouds() {
        const cloudGeo = new THREE.SphereGeometry(this.planetRadius * 1.006, 128, 128);

        const cloudVertexShader = `
            varying vec2 vUv;
            varying vec3 vNormalWorld;
            void main() {
                vUv = uv;
                vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
            }
        `;

        const cloudFragmentShader = `
            varying vec2 vUv;
            varying vec3 vNormalWorld;
            uniform sampler2D uCloudsMap;
            uniform vec3 uCloudColor;
            uniform float uDensity;
            uniform vec2 uOffset;
            uniform vec3 uSunDir;
            uniform vec3 uSunColor;
            uniform float uSunI;
            uniform vec3 uTau;
            uniform float uGlobalLight;
            ${GLSL_COMUN}

            void main() {
                vec4 cloudSample = texture2D(uCloudsMap, vUv + uOffset);
                float alpha = smoothstep(0.08, 0.70, cloudSample.a) * uDensity;
                float nDotL = dot(normalize(vNormalWorld), normalize(uSunDir));
                float dia = mix(smoothstep(-0.12, 0.12, nDotL), 1.0, uGlobalLight);
                // Las nubes están por encima de la mitad de la atmósfera: la luz que les llega atraviesa ~la mitad del espesor óptico
                vec3 luz = uSunColor * uSunI * exp(-uTau * 0.5 * mix(masaAire(nDotL), 1.0, uGlobalLight));
                float difusa = mix(0.35 + 0.65 * max(0.0, nDotL), 1.0, uGlobalLight);  // las nubes dispersan hacia delante: no son lambertianas
                vec3 color = srgbALineal(uCloudColor * cloudSample.rgb) * 0.8 * luz * difusa * dia / 3.1416;
                gl_FragColor = vec4(color, alpha * (0.15 + 0.85 * dia));
                #include <tonemapping_fragment>
                #include <encodings_fragment>
            }
        `;

        const cur = this.simulation.current;
        this.cloudUniforms = {
            uCloudsMap: { value: this.texClouds },
            uCloudColor: { value: new THREE.Vector3(...cur.cloudColor) },
            uDensity: { value: cur.cloudDensity },
            uOffset: { value: new THREE.Vector2(0, 0) },
            uSunDir: { value: this.sunDir },
            uSunColor: { value: this.sunColor },
            uSunI: this.earthUniforms.uSunI,
            uTau: this.earthUniforms.uTau,
            uGlobalLight: this.earthUniforms.uGlobalLight
        };

        this.cloudMat = new THREE.ShaderMaterial({
            vertexShader: cloudVertexShader, fragmentShader: cloudFragmentShader, uniforms: this.cloudUniforms,
            transparent: true, depthWrite: false
        });
        this.cloudMesh = new THREE.Mesh(cloudGeo, this.cloudMat);
        this.cloudMesh.renderOrder = 1;
        this.ejeGroup.add(this.cloudMesh);
    }

    /**
     * Atmósfera: dispersión simple integrada a lo largo del rayo de visión (12 muestras) con la luz atenuada hasta cada punto (4 muestras).
     *   Rayleigh: β(λ) del espesor óptico físico (Fisica.espesorRayleigh: ∝ λ⁻⁴ y presión), fase (3/16π)(1 + cos²θ).
     *   Aerosoles (Mie): τ = fondo + sulfato + impacto, fase de Henyey-Greenstein con g = 0,76.
     * Integración con conservación de energía por tramo (Hillaire 2015): S·(1 − e^(−σ·ds))/σ.
     * Se dibuja sobre el planeta y las nubes: color = dispersión + fondo × transmitancia.
     * ponytail: escalas de altura exageradas ×5 (8 km → 40 km) para que el limbo se vea a esta escala; los espesores ópticos son los reales.
     */
    createAtmosphere() {
        const R = this.planetRadius, esc = 5 * R / RADIO_KM;
        this.HR = 8 * esc;          // escala de altura de Rayleigh (unidades de escena)
        this.HM = 3 * esc;          // aerosoles estratosféricos y troposféricos
        const Ra = R + 6 * this.HR;
        const atmoGeo = new THREE.SphereGeometry(Ra, 64, 64);

        const atmoVertexShader = `
            varying vec3 vWorldPosition;
            void main() {
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const atmoFragmentShader = `
            varying vec3 vWorldPosition;
            uniform vec3 uSunDir;
            uniform vec3 uSunColor;
            uniform float uSunI;
            uniform vec3 uBetaR;      // coeficientes de Rayleigh en superficie (1/unidad)
            uniform float uBetaM;     // aerosoles
            uniform vec3 uHazeTint;
            uniform float uR, uRa, uHR, uHM;

            vec2 esfera(vec3 o, vec3 d, float r) {
                float b = dot(o, d), c = dot(o, o) - r * r, disc = b * b - c;
                if (disc < 0.0) return vec2(1e9, -1e9);
                float s = sqrt(disc);
                return vec2(-b - s, -b + s);
            }

            void main() {
                vec3 o = cameraPosition;
                vec3 d = normalize(vWorldPosition - cameraPosition);
                vec2 ta = esfera(o, d, uRa);
                float t0 = max(0.0, ta.x), t1 = ta.y;
                vec2 tp = esfera(o, d, uR);
                if (tp.x > 0.0) t1 = min(t1, tp.x);
                if (t1 <= t0) discard;

                vec3 s = normalize(uSunDir);
                float mu = dot(d, s);
                float fR = 3.0 / (16.0 * 3.1416) * (1.0 + mu * mu);
                float g = 0.76;
                float fM = (1.0 - g * g) / (4.0 * 3.1416 * pow(1.0 + g * g - 2.0 * g * mu, 1.5));

                const int N = 12;
                float ds = (t1 - t0) / float(N);
                vec3 T = vec3(1.0), luz = vec3(0.0);
                for (int i = 0; i < N; i++) {
                    vec3 p = o + d * (t0 + (float(i) + 0.5) * ds);
                    float h = length(p) - uR;
                    float rhoR = exp(-h / uHR), rhoM = exp(-h / uHM);
                    vec3 sigR = uBetaR * rhoR;
                    float sigM = uBetaM * rhoM;
                    vec3 sigT = sigR + sigM * 1.1;   // los aerosoles absorben ~10 %

                    // Luz que llega a p: sombra del planeta y atenuación hasta el tope de la atmósfera
                    vec3 Tl = vec3(0.0);
                    if (esfera(p, s, uR).x < 0.0 || esfera(p, s, uR).y < 0.0) {
                        float tl = esfera(p, s, uRa).y, dl = tl / 4.0;
                        vec3 od = vec3(0.0);
                        for (int j = 0; j < 4; j++) {
                            float hl = length(p + s * (float(j) + 0.5) * dl) - uR;
                            od += (uBetaR * exp(-hl / uHR) + uBetaM * 1.1 * exp(-hl / uHM)) * dl;
                        }
                        Tl = exp(-od);
                    }
                    vec3 S = Tl * (sigR * fR + sigM * fM * uHazeTint);
                    vec3 tramo = exp(-sigT * ds);
                    luz += T * S * (1.0 - tramo) / max(sigT, vec3(1e-6));
                    T *= tramo;
                }
                vec3 color = luz * uSunColor * uSunI;
                // Fondo × transmitancia (media de los canales: el mezclado de Three.js admite un solo alfa)
                gl_FragColor = vec4(color, dot(T, vec3(0.3333)));
                #include <tonemapping_fragment>
                #include <encodings_fragment>
            }
        `;

        this.atmoUniforms = {
            uSunDir: { value: this.sunDir },
            uSunColor: { value: this.sunColor },
            uSunI: this.earthUniforms.uSunI,
            uBetaR: { value: new THREE.Vector3() },
            uBetaM: { value: 0 },
            uHazeTint: { value: new THREE.Vector3(1, 1, 1) },
            uR: { value: R }, uRa: { value: Ra }, uHR: { value: this.HR }, uHM: { value: this.HM }
        };

        this.atmoMat = new THREE.ShaderMaterial({
            vertexShader: atmoVertexShader, fragmentShader: atmoFragmentShader, uniforms: this.atmoUniforms,
            side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false,
            blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.SrcAlphaFactor
        });
        this.atmoMesh = new THREE.Mesh(atmoGeo, this.atmoMat);
        this.atmoMesh.renderOrder = 2;
        this.scene.add(this.atmoMesh);
    }

    /**
     * Auroras: cortinas en el óvalo auroral (latitud invariante calculada), de 100 a 300 km de altura (exageradas ×2).
     * Color por altura: violeta N₂⁺ 427,8 nm en la base, verde O 557,7 nm a ~100–150 km y rojo O 630 nm arriba.
     */
    createAuroras() {
        this.auroraUniforms = { uTime: { value: 0.0 }, uIntensity: { value: 1.0 } };
        this.auroraMat = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec2 vUv;
                void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `,
            fragmentShader: `
                varying vec2 vUv;
                uniform float uIntensity;
                uniform float uTime;
                void main() {
                    float a = vUv.x * 6.2832;
                    float cortina = 0.5 + 0.5 * sin(a * 7.0 + uTime * 0.6 + 2.0 * sin(a * 3.0 - uTime * 0.4));
                    float rayos = 0.8 + 0.2 * sin(a * 180.0 + sin(a * 23.0 + uTime) * 4.0);
                    float h = vUv.y;
                    vec3 col = vec3(0.35, 0.2, 1.0) * (1.0 - smoothstep(0.0, 0.12, h))
                             + vec3(0.1, 1.0, 0.35) * smoothstep(0.02, 0.12, h) * (1.0 - smoothstep(0.25, 0.55, h))
                             + vec3(1.0, 0.1, 0.15) * 0.2 * smoothstep(0.3, 0.55, h) * (1.0 - smoothstep(0.7, 1.0, h));
                    float alpha = cortina * rayos * uIntensity * (1.0 - smoothstep(0.75, 1.0, h));
                    gl_FragColor = vec4(col * alpha * 0.6, 1.0);
                }
            `,
            uniforms: this.auroraUniforms,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide, transparent: true, depthWrite: false
        });
        this.auroraNorthMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.auroraMat);
        this.auroraSouthMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.auroraMat);
        this.auroraSouthMesh.rotation.x = Math.PI;   // la misma cortina reflejada en el hemisferio sur
        this.auroraNorthMesh.renderOrder = this.auroraSouthMesh.renderOrder = 3;
        this.ejeGroup.add(this.auroraNorthMesh, this.auroraSouthMesh);
        this.latAuroraDibujada = null;
    }

    // Tronco de cono entre 100 y 300 km sobre la latitud φ (radial: la cortina sigue la vertical local)
    geometriaAurora(latDeg) {
        const R = this.planetRadius, esc = 2 * R / RADIO_KM, lat = latDeg * Math.PI / 180;
        const r0 = R + 100 * esc, r1 = R + 300 * esc;
        const geo = new THREE.CylinderGeometry(r1 * Math.cos(lat), r0 * Math.cos(lat), (r1 - r0) * Math.sin(lat), 160, 1, true);
        geo.translate(0, (r0 + r1) / 2 * Math.sin(lat), 0);
        return geo;
    }

    /**
     * Líneas de campo dipolar r = L·sen²θ en tres capas; se escalan con el radio de la magnetopausa calculado.
     */
    createMagneticFieldLines() {
        this.magneticFieldGroup = new THREE.Group();
        this.magneticFieldGroup.visible = false;
        const R = this.planetRadius;
        [1.6, 2.2, 2.8].forEach((L, capa) => {
            const mat = new THREE.LineBasicMaterial({
                color: [0x00f0ff, 0x38bdf8, 0xb464ff][capa], transparent: true, opacity: [0.7, 0.45, 0.3][capa], blending: THREE.AdditiveBlending
            });
            for (let i = 0; i < 14; i++) {
                const phi = (i / 14) * Math.PI * 2, points = [];
                for (let j = 0; j <= 36; j++) {
                    const theta = (j / 36) * Math.PI;
                    const r = L * R * Math.pow(Math.sin(theta), 2.0);
                    if (r < R * 0.98) continue;
                    points.push(new THREE.Vector3(r * Math.sin(theta) * Math.cos(phi), r * Math.cos(theta), r * Math.sin(theta) * Math.sin(phi)));
                }
                if (points.length > 2) this.magneticFieldGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat));
            }
        });
        this.ejeGroup.add(this.magneticFieldGroup);
    }

    setMagneticFieldVisible(visible) { this.verCampo = visible; }

    createProbeVisuals() {
        const beamGeo = new THREE.CylinderGeometry(0.08, 0.25, 10, 16);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending });
        this.probeBeamMesh = new THREE.Mesh(beamGeo, beamMat);
        this.scene.add(this.probeBeamMesh);
        this.probeAnim = { active: false, timer: 0 };
    }

    launchProbeVisual(pointWorld) {
        this.probeAnim.active = true;
        this.probeAnim.timer = 0;
        const norm = pointWorld.clone().normalize();
        this.probeBeamMesh.position.copy(pointWorld.clone().add(norm.multiplyScalar(5)));
        this.probeBeamMesh.lookAt(pointWorld);
        this.probeBeamMesh.rotateX(Math.PI / 2);
        this.probeBeamMesh.material.opacity = 0.85;
    }

    initMeteorEffects() {
        this.meteorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.45, 20, 20), new THREE.MeshBasicMaterial({ color: 0xff3700 }));
        this.meteorMesh.visible = false;
        this.scene.add(this.meteorMesh);

        this.shockwaveMat = new THREE.MeshBasicMaterial({ color: 0xff4500, side: THREE.DoubleSide, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending });
        this.shockwaveMesh = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.6, 48), this.shockwaveMat);
        this.shockwaveMesh.visible = false;
        this.scene.add(this.shockwaveMesh);

        this.meteorAnimation = { active: false, phase: 'incoming', progress: 0, startPos: new THREE.Vector3(), impactPos: new THREE.Vector3(), scaleFactor: 1.0 };
    }

    // Lectura en la CPU de las texturas de datos (máscara de agua, topografía, batimetría, paleocostas) a 2048×1024
    leerTextura(tex, uv) {
        if (!tex.image || !tex.image.width) return null;
        if (!tex._lienzo) {
            const c = document.createElement('canvas');
            c.width = 2048; c.height = 1024;
            const ctx = c.getContext('2d');
            ctx.drawImage(tex.image, 0, 0, 2048, 1024);
            tex._lienzo = ctx.getImageData(0, 0, 2048, 1024).data;
        }
        const x = Math.min(2047, Math.floor(uv.x * 2048)), y = Math.min(1023, Math.floor((1 - uv.y) * 1024));
        const i = (y * 2048 + x) * 4, d = tex._lienzo;
        return [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
    }

    // Qué hay en la superficie en ese punto, con la misma lógica que el shader: agua o tierra y elevación sobre el nivel del mar actual (m)
    muestrearSuperficie(uv) {
        const cur = this.simulation.current, mar = cur.seaLevelOffset;
        if (cur.geologicalMa < -1) {
            const a = this.leerTextura(this.texPaleoAgua, uv), ma = -cur.geologicalMa;
            if (!a) return null;
            const w = ma <= 66 ? a[0] : ma <= 150 ? a[0] + (a[1] - a[0]) * (ma - 66) / 84 : a[1] + (a[2] - a[1]) * Math.min(1, (ma - 150) / 100);
            return { agua: w > 0.35, elevacion_m: null };
        }
        const m = this.leerTextura(this.texSpecular, uv), t = this.leerTextura(this.texTopology, uv), b = this.leerTextura(this.texBathymetry, uv);
        if (!m || !t || !b) return null;
        const aguaHoy = m[0] > 0.35, elevHoy = aguaHoy ? -8000 * b[0] * b[0] : TOPO_MAX_M * t[0];
        const agua = mar >= 0 ? (aguaHoy || elevHoy < mar) : (aguaHoy && -elevHoy > -mar);
        return { agua, elevacion_m: Math.round(elevHoy - mar) };
    }

    getCoordinatesAtMouse(clientX, clientY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hit = this.raycaster.intersectObject(this.earthMesh)[0];
        if (!hit) return null;
        // Latitud y longitud desde la UV de la textura equirectangular (u = 0,5 es el meridiano de Greenwich)
        return {
            hitPointWorld: hit.point,
            hitPointLocal: this.earthMesh.worldToLocal(hit.point.clone()).normalize(),
            normalWorld: hit.point.clone().normalize(),
            lat: Math.round((hit.uv.y - 0.5) * 1800) / 10,
            lon: Math.round((hit.uv.x - 0.5) * 3600) / 10,
            uv: hit.uv
        };
    }

    launchMeteorToCoordinates(coords, diameterKm = 15, speedKms = 25, composition = 'rock', anguloDeg = 45) {
        const anim = this.meteorAnimation;
        anim.active = true;
        anim.phase = 'incoming';
        anim.progress = 0;
        anim.scaleFactor = Math.max(0.5, Math.min(3.5, diameterKm / 15.0));

        const normal = coords.hitPointWorld.clone().normalize();
        anim.impactPos.copy(coords.hitPointWorld);
        anim.startPos.copy(coords.hitPointWorld).add(normal.multiplyScalar(24)).add(new THREE.Vector3(12, 10, 8));

        this.meteorMesh.visible = true;
        this.meteorMesh.position.copy(anim.startPos);
        this.meteorMesh.scale.setScalar(anim.scaleFactor);

        const sup = this.muestrearSuperficie(coords.uv);
        const agua_m = sup && sup.agua && sup.elevacion_m !== null ? Math.max(0, -sup.elevacion_m) : 0;
        return this.simulation.triggerCustomImpact(coords.hitPointLocal, diameterKm, speedKms, composition, anguloDeg, agua_m);
    }

    updateMeteor(dt) {
        if (!this.meteorAnimation.active) return;
        const anim = this.meteorAnimation;
        anim.progress += dt * 1.5;

        if (anim.phase === 'incoming') {
            const t = Math.min(1.0, anim.progress);
            this.meteorMesh.position.lerpVectors(anim.startPos, anim.impactPos, t);
            this.meteorMesh.scale.setScalar((1.0 + Math.sin(anim.progress * 25) * 0.3) * anim.scaleFactor);
            if (t >= 1.0) {
                anim.phase = 'shockwave';
                anim.progress = 0;
                this.meteorMesh.visible = false;
                this.shockwaveMesh.visible = true;
                this.shockwaveMesh.position.copy(anim.impactPos).multiplyScalar(1.01);
                this.shockwaveMesh.lookAt(new THREE.Vector3(0, 0, 0));
                const shake = Math.min(3.0, 1.2 * anim.scaleFactor);
                this.camera.position.x += (Math.random() - 0.5) * shake;
                this.camera.position.y += (Math.random() - 0.5) * shake;
            }
        } else if (anim.phase === 'shockwave') {
            const t = anim.progress;
            this.shockwaveMesh.scale.setScalar((1.0 + t * 15.0) * anim.scaleFactor);
            this.shockwaveMat.opacity = Math.max(0, 1.0 - t * 0.7);
            if (t > 1.4) {
                anim.active = false;
                this.shockwaveMesh.visible = false;
            }
        }
    }

    syncCratersUniforms() {
        const list = this.simulation.craters.slice(-4);   // los cuatro más recientes
        const u = this.earthUniforms;
        u.uCraterCount.value = list.length;
        list.forEach((c, i) => { u.uCraterCenters.value[i].copy(c.center); u.uCraterRadii.value[i] = c.radius; });
    }

    setAtmosphereVisible(visible) {
        this.showAtmosphere = visible;
        this.atmoMesh.visible = visible;
    }

    setCloudsVisible(visible) {
        this.showClouds = visible;
        this.cloudMesh.visible = visible;
        this.earthUniforms.uShowClouds.value = visible ? 1.0 : 0.0;
    }

    setGlobalLight(enabled) {
        this.isGlobalLight = enabled;
        this.earthUniforms.uGlobalLight.value = enabled ? 1.0 : 0.0;
    }

    setAurorasVisible(visible) { this.showAuroras = visible; }

    // Eje inclinado fijo en el espacio y Sol con la declinación del día: δ = asen(sen ε · sen λ) (estaciones)
    actualizarSol(astro) {
        const tilt = astro.oblicuidadEfectiva() * Math.PI / 180;
        this.ejeGroup.rotation.z = tilt;
        const eje = new THREE.Vector3(-Math.sin(tilt), Math.cos(tilt), 0);
        this.earthUniforms.uEje.value.copy(eje);

        const geo = astro.geometriaSolar();
        const base = new THREE.Vector3(60, 20, 45).normalize();
        const ecuatorial = base.sub(eje.clone().multiplyScalar(base.dot(eje))).normalize();
        this.sunDir.copy(ecuatorial.multiplyScalar(Math.cos(geo.declinacion)).add(eje.multiplyScalar(Math.sin(geo.declinacion)))).normalize();

        // Color de cuerpo negro e intensidad: la cámara se adapta a la estrella, pero se nota la variación anual de distancia (r̄/r)²
        this.sunColor.set(...astro.colorLuz);
        this.earthUniforms.uSunI.value = 5.0 * geo.factorDistancia;

        // Disco estelar con su tamaño angular real (mínimo de unos píxeles para que se vea)
        const dist = 200, tam = Math.max(0.5, dist * astro.diametroAngular);   // el fondo de estrellas está a 250
        this.starCore.position.copy(this.sunDir).multiplyScalar(dist);
        this.starGlow.position.copy(this.starCore.position);
        this.starCore.scale.setScalar(tam * 2);
        this.starGlow.scale.setScalar(Math.min(tam * 14, 60));
        this.starCore.material.color.setRGB(...astro.colorLuz);
        this.starGlow.material.color.setRGB(...astro.colorLuz);
    }

    update(dt) {
        const cur = this.simulation.current, astro = window.astrophysicsEngine;

        // 1. Sol, eje y rotación diaria
        this.actualizarSol(astro);
        if (astro.params.isTidallyLocked) {
            this.earthMesh.rotation.y = this.cloudMesh.rotation.y = 1.25;   // una cara siempre hacia la estrella
        } else if (!this.isRotationPaused) {
            const rotStep = dt * 0.035 * this.rotationSpeed;
            this.earthRotation += rotStep;
            this.cloudRotationOffset += rotStep * 0.04;                    // las nubes derivan respecto a la superficie
            this.earthMesh.rotation.y = this.cloudMesh.rotation.y = this.earthRotation;
        }
        this.magneticFieldGroup.visible = !!this.verCampo && astro.params.magneticField > 0;
        if (this.magneticFieldGroup.visible) {
            this.magneticFieldGroup.rotation.y += dt * 0.04;
            // Las capas escalan con la magnetopausa (~10 R⊕ en la Tierra)
            this.magneticFieldGroup.scale.setScalar(Math.min(2.5, Math.max(0.2, astro.radioMagnetopausa / 10)));
        }

        // 2. Superficie
        const u = this.earthUniforms;
        u.uCloudsOffset.value.set(this.cloudRotationOffset, 0);
        u.uOceanColor.value.set(...cur.oceanColor);
        u.uOceanShallowColor.value.set(...cur.oceanShallowColor);
        u.uAbioticFactor.value = cur.abioticFactor;
        u.uDinosaurFactor.value = cur.dinosaurFactor;
        u.uNightLights.value = cur.nightLights;
        u.uVolcanism.value = cur.volcanism;
        u.uErosionFactor.value = cur.erosionFactor;
        u.uSeaLevelOffset.value = cur.seaLevelOffset;
        u.uGeologicalMa.value = cur.geologicalMa || 0.0;
        if (cur.vegetationColor) u.uPigmentColor.value.set(cur.vegetationColor[0] / 255, cur.vegetationColor[1] / 255, cur.vegetationColor[2] / 255);

        // Temperaturas del modelo para el día del año que se muestra
        const sim = this.simulation;
        u.uAnclado.value = sim.clima.anclado ? 1 : 0;
        if (sim.clima.anclado) {
            u.uTdia.value = sim.anclado.Tdia;
            u.uTnoche.value = sim.anclado.Tnoche;
        } else {
            const b = sim.bandasHoy();
            u.uBandL.value = b.L;
            u.uBandO.value = b.O;
        }

        // Espesor óptico vertical (Rayleigh a 610/550/465 nm con la presión y el CO₂ + aerosoles)
        const tauR = [0.61, 0.55, 0.465].map((l) => Fisica.espesorRayleigh(l, cur.surfacePressure, cur.co2));
        const tauM = 0.1 * cur.atmosphereOpacity + Fisica.profundidadOpticaSulfato(cur.so2) + (sim.meteorEvent.active ? sim.meteorEvent.tau : 0);
        u.uTau.value.set(tauR[0] + tauM, tauR[1] + tauM, tauR[2] + tauM);
        this.syncCratersUniforms();

        // En los modos del escáner (térmico, NDVI, magnético) las nubes y la bruma taparían el dato
        const escaner = u.uViewMode.value > 0.5;
        this.cloudMesh.visible = this.showClouds && !escaner;
        this.atmoMesh.visible = this.showAtmosphere && !escaner;
        u.uShowClouds.value = this.cloudMesh.visible ? 1 : 0;

        // 3. Nubes
        this.cloudUniforms.uCloudColor.value.set(...cur.cloudColor);
        this.cloudUniforms.uDensity.value = cur.cloudDensity;
        this.cloudUniforms.uOffset.value.set(this.cloudRotationOffset, 0);

        // 4. Atmósfera: β = τ/H. El tinte de los aerosoles sale del color de atmósfera del escenario (bruma volcánica, hollín)
        const a = this.atmoUniforms;
        a.uBetaR.value.set(tauR[0] / this.HR, tauR[1] / this.HR, tauR[2] / this.HR);
        a.uBetaM.value = tauM / this.HM;
        const c = cur.atmosphereColor, mx = Math.max(...c, 1e-3);
        a.uHazeTint.value.set(c[0] / mx, c[1] / mx, c[2] / mx);

        // 5. Auroras en el óvalo auroral (dipolo + Chapman-Ferraro, ver fisica.js)
        this.auroraUniforms.uTime.value += dt;
        this.auroraUniforms.uIntensity.value = astro.auroraIntensity;
        const verAuroras = astro.auroraIntensity > 0.05 && this.showAtmosphere && this.showAuroras !== false;
        this.auroraNorthMesh.visible = this.auroraSouthMesh.visible = verAuroras;
        const lat = Math.round(astro.latitudAuroral * 2) / 2;
        if (verAuroras && lat !== this.latAuroraDibujada) {
            const geo = this.geometriaAurora(lat);
            this.auroraNorthMesh.geometry.dispose();
            this.auroraNorthMesh.geometry = this.auroraSouthMesh.geometry = geo;
            this.latAuroraDibujada = lat;
        }

        // 6. Sonda y meteoros
        if (this.probeAnim.active) {
            this.probeAnim.timer += dt;
            this.probeBeamMesh.material.opacity = Math.max(0, 0.85 - this.probeAnim.timer * 0.6);
            if (this.probeAnim.timer > 1.4) {
                this.probeAnim.active = false;
                this.probeBeamMesh.material.opacity = 0;
            }
        }
        this.updateMeteor(dt);

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onWindowResize() {
        this.width = this.container.clientWidth || window.innerWidth;
        this.height = this.container.clientHeight || window.innerHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);
    }
}

window.PlanetViewer = PlanetViewer;
