/**
 * Planet Module: Motor 3D Fotorrealista de la Tierra
 * Integra:
 * 1. Shaders multiespectrales (Óptico, Térmico FLIR, NDVI de Biomasa y Magnetosfera).
 * 2. Auroras boreales y australes 3D ondulantes con física de emisión de oxígeno/nitrógeno.
 * 3. Inclinación axial (oblicuidad orbital) y modo anclaje por marea (Tidal Locking).
 * 4. Pigmentos fotosintéticos alternativos (Tierra Púrpura y Plantas Negras).
 * 5. Raycasting de precisión para la Sonda Orbital de Superficie.
 */
class PlanetViewer {
    constructor(containerId, simulation) {
        this.container = document.getElementById(containerId);
        this.simulation = simulation;

        this.width = this.container.clientWidth || window.innerWidth;
        this.height = this.container.clientHeight || window.innerHeight;

        this.planetRadius = 6.5;
        this.cloudRotationOffset = 0.0;
        this.earthRotation = 0.0;

        // Control de rotación
        this.isRotationPaused = false;
        this.rotationSpeed = 1.0;

        // Visibilidad de capas
        this.showClouds = true;
        this.showAtmosphere = true;

        // Raycaster para selección de impactos y sonda de superficie
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.initScene();
        this.loadTextures();
        this.createSkybox();
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

        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 8.5;
        this.controls.maxDistance = 55;
        this.controls.autoRotate = false;

        // Posición del Sol en el espacio
        this.sunPosition = new THREE.Vector3(60, 20, 45);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
        this.sunLight.position.copy(this.sunPosition);
        this.scene.add(this.sunLight);

        this.ambientLight = new THREE.AmbientLight(0x101a2e, 0.35);
        this.scene.add(this.ambientLight);
    }

    loadTextures() {
        const loader = new THREE.TextureLoader();
        const load = (path) => {
            const tex = loader.load(path);
            tex.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
            return tex;
        };

        this.texDay = load('textures/earth_day.jpg');
        this.texNight = load('textures/earth_night.jpg');
        this.texClouds = load('textures/earth_clouds.png');
        this.texClouds.generateMipmaps = true;
        this.texClouds.minFilter = THREE.LinearMipmapLinearFilter;
        this.texClouds.magFilter = THREE.LinearFilter;
        this.texClouds.wrapS = THREE.RepeatWrapping;
        this.texClouds.wrapT = THREE.ClampToEdgeWrapping;
        this.texNormal = load('textures/earth_normal.jpg');
        this.texSpecular = load('textures/earth_specular.jpg');
        this.texTopology = load('textures/earth_topology.png');
        this.texPangea = load('textures/earth_pangea.jpg');
        this.texPaleo240 = load('textures/paleo_240ma_2048.jpg');
        this.texPaleo150 = load('textures/paleo_150ma_2048.jpg');
        this.texPaleo065 = load('textures/paleo_065ma_2048.jpg');
        this.texSky = load('textures/night_sky.png');
    }

    createSkybox() {
        const skyGeo = new THREE.SphereGeometry(250, 48, 48);
        const skyMat = new THREE.MeshBasicMaterial({
            map: this.texSky,
            side: THREE.BackSide
        });
        this.skyboxMesh = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(this.skyboxMesh);
    }

    createEarth() {
        const earthGeo = new THREE.SphereGeometry(this.planetRadius, 96, 96);

        const earthVertexShader = `
            varying vec2 vUv;
            varying vec3 vNormalWorld;
            varying vec3 vWorldPosition;
            varying vec3 vSunDir;
            uniform vec3 uSunPosition;

            void main() {
                vUv = uv;
                vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                vSunDir = normalize(uSunPosition - worldPos.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const earthFragmentShader = `
            varying vec2 vUv;
            varying vec3 vNormalWorld;
            varying vec3 vWorldPosition;
            varying vec3 vSunDir;

            uniform sampler2D uDayMap;
            uniform sampler2D uNightMap;
            uniform sampler2D uCloudsMap;
            uniform sampler2D uSpecularMap;
            uniform sampler2D uNormalMap;
            uniform sampler2D uTopologyMap;
            uniform sampler2D uPangeaMap;
            uniform sampler2D uPaleo240Map;
            uniform sampler2D uPaleo150Map;
            uniform sampler2D uPaleo065Map;

            uniform vec3 uOceanColor;
            uniform vec3 uOceanShallowColor;
            uniform float uAbioticFactor;
            uniform float uDinosaurFactor;
            uniform float uIceCoverage;
            uniform float uNightLights;
            uniform float uVolcanism;
            uniform float uErosionFactor;
            uniform float uSeaLevelOffset;
            uniform float uPangeaFactor;
            uniform float uGeologicalMa; // Millones de años (-250 a +250)
            uniform float uMeanTemp;
            uniform float uViewMode; // 0=optico, 1=termico FLIR, 2=ndvi biomasa, 3=magnetico
            uniform float uGlobalLight; // 0=normal dia/noche, 1=iluminacion 360 uniforme
            uniform vec2 uCloudsOffset;
            uniform vec3 uAtmosphereColor;
            uniform float uShowClouds;
            uniform float uShowAtmosphere;

            // Pigmento alternativo (Verde, Púrpura, Negro)
            uniform vec3 uPigmentColor;

            // Cráteres persistentes en la corteza
            uniform vec3 uCraterCenters[4];
            uniform float uCraterRadii[4];
            uniform float uCraterDepths[4];
            uniform float uCraterUplifts[4];
            uniform int uCraterCount;

            void main() {
                vec4 dayTex = texture2D(uDayMap, vUv);
                vec4 specTex = texture2D(uSpecularMap, vUv);
                vec4 topoTex = texture2D(uTopologyMap, vUv);
                float isWater = specTex.r;
                float topoElev = topoTex.r;
                vec3 surfaceColor = dayTex.rgb;

                // ========================================================
                // RECONSTRUCCIÓN PALEOGEOGRÁFICA CIENTÍFICA (PALEOMAP PROJECT)
                // ========================================================
                if (uGeologicalMa < -1.0) {
                    vec4 p065 = texture2D(uPaleo065Map, vUv);
                    vec4 p150 = texture2D(uPaleo150Map, vUv);
                    vec4 p240 = texture2D(uPaleo240Map, vUv);

                    vec3 paleoColor = dayTex.rgb;
                    float paleoWater = specTex.r;

                    if (uGeologicalMa >= -66.0) {
                        // Cenozoico a Cretácico Superior (-66 Ma)
                        float f = (-uGeologicalMa) / 66.0;
                        paleoColor = mix(dayTex.rgb, p065.rgb, f);
                        float w65 = (p065.b > p065.r + 0.06 || (p065.b > 0.42 && p065.b > p065.g * 0.9)) ? 1.0 : 0.0;
                        paleoWater = mix(specTex.r, w65, f);
                    } else if (uGeologicalMa >= -150.0) {
                        // Cretácico (-66 Ma) a Jurásico (-150 Ma)
                        float f = (-uGeologicalMa - 66.0) / (150.0 - 66.0);
                        paleoColor = mix(p065.rgb, p150.rgb, f);
                        float w65 = (p065.b > p065.r + 0.06 || (p065.b > 0.42 && p065.b > p065.g * 0.9)) ? 1.0 : 0.0;
                        float w150 = (p150.b > p150.r + 0.06 || (p150.b > 0.42 && p150.b > p150.g * 0.9)) ? 1.0 : 0.0;
                        paleoWater = mix(w65, w150, f);
                    } else {
                        // Jurásico (-150 Ma) a Pangea Pérmico/Triásico (-250 Ma)
                        float f = clamp((-uGeologicalMa - 150.0) / (250.0 - 150.0), 0.0, 1.0);
                        paleoColor = mix(p150.rgb, p240.rgb, f);
                        float w150 = (p150.b > p150.r + 0.06 || (p150.b > 0.42 && p150.b > p150.g * 0.9)) ? 1.0 : 0.0;
                        float w240 = (p240.b > p240.r + 0.06 || (p240.b > 0.42 && p240.b > p240.g * 0.9)) ? 1.0 : 0.0;
                        paleoWater = mix(w150, w240, f);
                    }

                    surfaceColor = paleoColor;
                    isWater = paleoWater;
                } else if (uGeologicalMa > 1.0) {
                    // Futuro: Pangea Ultima (+250 Ma)
                    float f = clamp(uGeologicalMa / 250.0, 0.0, 1.0);
                    vec4 p240 = texture2D(uPaleo240Map, vUv);
                    float w240 = (p240.b > p240.r + 0.06 || (p240.b > 0.42 && p240.b > p240.g * 0.9)) ? 1.0 : 0.0;
                    surfaceColor = mix(dayTex.rgb, p240.rgb, f * 0.92);
                    isWater = mix(specTex.r, w240, f * 0.92);
                } else if (uPangeaFactor > 0.01) {
                    vec4 p240 = texture2D(uPaleo240Map, vUv);
                    float w240 = (p240.b > p240.r + 0.06 || (p240.b > 0.42 && p240.b > p240.g * 0.9)) ? 1.0 : 0.0;
                    surfaceColor = mix(surfaceColor, p240.rgb, uPangeaFactor);
                    isWater = mix(isWater, w240, uPangeaFactor);
                }

                // Inundación Continental por Nivel del Mar (solo activa en la época moderna; las paleomapas ya tienen sus costas fósiles)
                if (uGeologicalMa > -2.0) {
                    if (uSeaLevelOffset > 0.0) {
                        float floodThreshold = clamp(uSeaLevelOffset / 2300.0, 0.0, 0.90);
                        if (isWater < 0.35 && topoElev < floodThreshold) {
                            isWater = 1.0;
                        }
                    } else if (uSeaLevelOffset < 0.0) {
                        float shelfDepth = (1.0 - specTex.g);
                        float dryThreshold = clamp(abs(uSeaLevelOffset) / 320.0, 0.0, 0.85);
                        if (isWater > 0.35 && shelfDepth < dryThreshold) {
                            isWater = 0.0;
                        }
                    }
                }

                vec3 normal = normalize(vNormalWorld);
                vec3 sunDir = normalize(vSunDir);
                vec3 viewDir = normalize(cameraPosition - vWorldPosition);

                // Terminador Día / Noche e Iluminación Global
                float nDotL = dot(normal, sunDir);
                float standardDay = smoothstep(-0.06, 0.14, nDotL);
                float dayFactor = mix(standardDay, 1.0, uGlobalLight);
                float nightFactor = mix(1.0 - standardDay, 0.0, uGlobalLight);

                // Cráteres de Impacto
                for (int i = 0; i < 4; i++) {
                    if (i >= uCraterCount) break;
                    float d = distance(normal, uCraterCenters[i]);
                    float r = uCraterRadii[i];

                    if (d < r) {
                        float normD = d / r;
                        if (uCraterUplifts[i] > 0.0) {
                            isWater = 0.0;
                            surfaceColor = mix(surfaceColor, vec3(0.20, 0.16, 0.14), 0.85);
                        } else {
                            if (normD < 0.82) isWater = 1.0;
                        }
                        surfaceColor = mix(surfaceColor, vec3(0.10, 0.07, 0.05), (1.0 - normD) * 0.9);
                        if (normD > 0.82 && normD < 0.98) {
                            surfaceColor = mix(surfaceColor, vec3(0.55, 0.42, 0.32), 0.7);
                        }
                    }
                }

                // Océanos y Tierras Inundadas
                if (isWater > 0.35) {
                    float depth = clamp(1.0 - specTex.g, 0.0, 1.0);
                    if (specTex.r < 0.35) {
                        float floodDepth = clamp((uSeaLevelOffset / 2300.0 - topoElev) * 5.0, 0.0, 1.0);
                        depth = mix(0.12, 0.70, floodDepth);
                    }
                    vec3 customWater = mix(uOceanShallowColor, uOceanColor, depth);
                    if (uGeologicalMa > -5.0 && uPangeaFactor < 0.05) {
                        surfaceColor = mix(surfaceColor, customWater, 0.88);
                    }
                } else {
                    // Masas Continentales
                    if (uAbioticFactor > 0.01) {
                        vec3 barrenBasalt = vec3(0.52, 0.36, 0.26) * (surfaceColor.r * 1.5 + 0.35);
                        surfaceColor = mix(surfaceColor, barrenBasalt, uAbioticFactor);
                    } else if (uDinosaurFactor > 0.01 && uGeologicalMa > -5.0) {
                        vec3 lushFlora = vec3(surfaceColor.r * 0.65, surfaceColor.g * 1.35, surfaceColor.b * 0.65);
                        surfaceColor = mix(surfaceColor, lushFlora, uDinosaurFactor * 0.55);
                    } else if (uGeologicalMa > -5.0) {
                        // Modulación de pigmento fotosintético en la Tierra moderna
                        float greenAmount = max(0.0, dayTex.g - max(dayTex.r, dayTex.b) * 0.85);
                        if (greenAmount > 0.05) {
                            surfaceColor = mix(surfaceColor, uPigmentColor * (dayTex.g * 1.4 + 0.1), 0.75);
                        }
                    }

                    // Modelo de Erosión (SOLO en época moderna; en paleocartografía Scotese ya incluye la litología real sin contaminar)
                    if (uGeologicalMa > -2.0 && uErosionFactor > 0.05) {
                        float relief = texture2D(uNormalMap, vUv).r;
                        vec3 erodedBedrock = vec3(0.68, 0.52, 0.38) * (relief * 1.3 + 0.35);
                        surfaceColor = mix(surfaceColor, erodedBedrock, uErosionFactor * 0.85);
                    }
                }

                // 6. Casquetes Polares y Glaciación
                float latFraction = abs(vUv.y - 0.5) * 2.0;
                float iceLimit = clamp(1.0 - (uIceCoverage * 1.05), 0.0, 1.0);
                if (latFraction > iceLimit) {
                    float iceTrans = smoothstep(iceLimit, iceLimit + 0.06, latFraction);
                    surfaceColor = mix(surfaceColor, vec3(0.92, 0.96, 1.0), iceTrans);
                }

                // 7. Sombra de Nubes Suave y Fotográfica
                if (uShowClouds > 0.5) {
                    vec2 cloudCoord = vUv + uCloudsOffset;
                    float rawCloud = texture2D(uCloudsMap, cloudCoord).a;
                    float cloudShadow = smoothstep(0.10, 0.65, rawCloud) * 0.40 * dayFactor;
                    surfaceColor *= (1.0 - cloudShadow);
                }

                // 8. Especularidad Marina
                vec3 halfDir = normalize(sunDir + viewDir);
                float specPower = pow(max(0.0, dot(normal, halfDir)), 48.0);
                float isIce = step(iceLimit, latFraction);
                float specIntensity = specPower * isWater * dayFactor * (1.0 - isIce * 0.7);
                vec3 oceanGlint = vec3(1.0, 0.95, 0.85) * specIntensity * 2.2;

                // 9. Iluminación diurna difusa
                float diffuse = mix(max(0.0, nDotL), 1.0, uGlobalLight);
                vec3 litDay = surfaceColor * (diffuse * 1.15 + 0.06) + oceanGlint;

                // 10. Luces de Civilización Nocturnas (exclusivas del Presente, uGeologicalMa > -2.0)
                vec3 litNight = vec3(0.0);
                if (uGeologicalMa > -2.0) {
                    vec4 nightTex = texture2D(uNightMap, vUv);
                    vec3 cityGlow = nightTex.rgb * uNightLights * 1.8 * (1.0 - isWater);

                    if (uVolcanism > 1.2) {
                        float relief = texture2D(uNormalMap, vUv).r;
                        float magmaFissure = smoothstep(0.68, 0.90, relief) * (1.0 - isWater);
                        cityGlow += vec3(1.0, 0.25, 0.03) * magmaFissure * min(2.5, uVolcanism * 0.18);
                    }

                    litNight = cityGlow * nightFactor;
                }

                // 11. Resplandor atmosférico
                vec3 atmoHaze = vec3(0.0);
                if (uShowAtmosphere > 0.5) {
                    float limb = 1.0 - max(0.0, dot(normal, viewDir));
                    atmoHaze = uAtmosphereColor * (pow(limb, 3.2) * dayFactor * 0.42);
                }

                vec3 finalColor = (litDay * dayFactor) + litNight + atmoHaze;

                // ========================================================
                // MODOS DE ESCÁNER SATELITAL CIENTÍFICO
                // ========================================================
                if (uViewMode > 0.5 && uViewMode < 1.5) {
                    // MODO 1: TÉRMICO INFRARROJO FLIR (Falso color térmico)
                    float localTempEst = uMeanTemp - pow(latFraction, 2.0) * 44.0 + (dayFactor * 14.0 - 7.0);
                    float tNorm = clamp((localTempEst + 50.0) / 100.0, 0.0, 1.0);
                    
                    vec3 thermalColor;
                    if (tNorm < 0.25) {
                        thermalColor = mix(vec3(0.02, 0.02, 0.20), vec3(0.0, 0.6, 0.9), tNorm * 4.0);
                    } else if (tNorm < 0.50) {
                        thermalColor = mix(vec3(0.0, 0.6, 0.9), vec3(0.1, 0.9, 0.2), (tNorm - 0.25) * 4.0);
                    } else if (tNorm < 0.75) {
                        thermalColor = mix(vec3(0.1, 0.9, 0.2), vec3(1.0, 0.8, 0.0), (tNorm - 0.50) * 4.0);
                    } else {
                        thermalColor = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 1.0, 1.0), (tNorm - 0.75) * 4.0);
                    }
                    finalColor = thermalColor;
                } else if (uViewMode > 1.5 && uViewMode < 2.5) {
                    // MODO 2: NDVI BIOMASA VEGETAL (Índice de Vegetación)
                    if (isWater > 0.35) {
                        finalColor = vec3(0.05, 0.08, 0.12);
                    } else if (uAbioticFactor > 0.5) {
                        finalColor = vec3(0.20, 0.20, 0.20);
                    } else {
                        float biomass = clamp((dayTex.g - dayTex.r) * 2.5, 0.0, 1.0);
                        finalColor = mix(vec3(0.22, 0.22, 0.22), vec3(0.0, 1.0, 0.35), biomass);
                    }
                } else if (uViewMode > 2.5) {
                    // MODO 3: MAGNETOSFERA (Escudo dipolar suave y elegante)
                    float poleProximity = abs(normal.y);
                    float dipoleField = sin(poleProximity * 3.14159);
                    vec3 shieldCyan = vec3(0.0, 0.85, 1.0);
                    vec3 auroraViolet = vec3(0.7, 0.2, 1.0);
                    vec3 magPlasma = mix(shieldCyan, auroraViolet, poleProximity);
                    finalColor = mix(finalColor * 0.5, magPlasma, dipoleField * 0.55 + 0.15);
                }

                gl_FragColor = vec4(finalColor, 1.0);
            }
        `;

        this.earthUniforms = {
            uDayMap: { value: this.texDay },
            uNightMap: { value: this.texNight },
            uCloudsMap: { value: this.texClouds },
            uSpecularMap: { value: this.texSpecular },
            uNormalMap: { value: this.texNormal },
            uTopologyMap: { value: this.texTopology },
            uPangeaMap: { value: this.texPangea },
            uPaleo240Map: { value: this.texPaleo240 },
            uPaleo150Map: { value: this.texPaleo150 },
            uPaleo065Map: { value: this.texPaleo065 },
            uPangeaFactor: { value: 0.0 },
            uGeologicalMa: { value: 0.0 },
            uGlobalLight: { value: 0.0 },
            uSunPosition: { value: this.sunPosition },
            uOceanColor: { value: new THREE.Vector3(...this.simulation.current.oceanColor) },
            uOceanShallowColor: { value: new THREE.Vector3(...this.simulation.current.oceanShallowColor) },
            uAbioticFactor: { value: this.simulation.current.abioticFactor },
            uDinosaurFactor: { value: this.simulation.current.dinosaurFactor },
            uIceCoverage: { value: this.simulation.current.iceCoverage },
            uNightLights: { value: this.simulation.current.nightLights },
            uVolcanism: { value: this.simulation.current.volcanism },
            uErosionFactor: { value: this.simulation.current.erosionFactor },
            uSeaLevelOffset: { value: this.simulation.current.seaLevelOffset },
            uMeanTemp: { value: this.simulation.current.meanTemp },
            uViewMode: { value: 0.0 },
            uPigmentColor: { value: new THREE.Vector3(0.13, 0.55, 0.13) }, // Verde clorofila
            uCloudsOffset: { value: new THREE.Vector2(0, 0) },
            uAtmosphereColor: { value: new THREE.Vector3(...this.simulation.current.atmosphereColor) },
            uShowClouds: { value: 1.0 },
            uShowAtmosphere: { value: 1.0 },
            uCraterCenters: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
            uCraterRadii: { value: [0, 0, 0, 0] },
            uCraterDepths: { value: [0, 0, 0, 0] },
            uCraterUplifts: { value: [0, 0, 0, 0] },
            uCraterCount: { value: 0 }
        };

        this.earthMat = new THREE.ShaderMaterial({
            vertexShader: earthVertexShader,
            fragmentShader: earthFragmentShader,
            uniforms: this.earthUniforms
        });

        this.earthMesh = new THREE.Mesh(earthGeo, this.earthMat);
        this.scene.add(this.earthMesh);
    }

    createClouds() {
        const cloudGeo = new THREE.SphereGeometry(this.planetRadius * 1.012, 128, 128);

        const cloudVertexShader = `
            varying vec2 vUv;
            varying vec3 vNormalWorld;
            varying vec3 vSunDir;
            uniform vec3 uSunPosition;

            void main() {
                vUv = uv;
                vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vSunDir = normalize(uSunPosition - worldPos.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const cloudFragmentShader = `
            varying vec2 vUv;
            varying vec3 vNormalWorld;
            varying vec3 vSunDir;

            uniform sampler2D uCloudsMap;
            uniform vec3 uCloudColor;
            uniform float uDensity;
            uniform vec2 uOffset;

            void main() {
                vec4 cloudSample = texture2D(uCloudsMap, vUv + uOffset);
                
                // Muestreo del canal alfa real (transparencia de nubes de la NASA)
                float rawDensity = cloudSample.a;
                float alpha = smoothstep(0.08, 0.70, rawDensity) * uDensity;

                vec3 normal = normalize(vNormalWorld);
                vec3 sunDir = normalize(vSunDir);
                float nDotL = dot(normal, sunDir);
                float dayFactor = smoothstep(-0.15, 0.15, nDotL);

                // Iluminación realista de nubes: base sombreada y cima iluminada por el sol
                vec3 ambientCloud = vec3(0.12, 0.16, 0.25);
                vec3 sunlitCloud = vec3(1.0, 1.0, 1.0);
                vec3 cloudLighting = mix(ambientCloud, sunlitCloud, dayFactor);

                // Dispersión sutil dorada en los bordes al atardecer
                float sunsetRim = smoothstep(-0.10, 0.08, nDotL) * (1.0 - smoothstep(0.08, 0.22, nDotL));
                cloudLighting += vec3(1.0, 0.55, 0.25) * sunsetRim * 0.45;

                vec3 finalCloud = uCloudColor * cloudSample.rgb * cloudLighting;
                gl_FragColor = vec4(finalCloud, alpha);
            }
        `;

        this.cloudUniforms = {
            uCloudsMap: { value: this.texClouds },
            uSunPosition: { value: this.sunPosition },
            uCloudColor: { value: new THREE.Vector3(...this.simulation.current.cloudColor) },
            uDensity: { value: this.simulation.current.cloudDensity },
            uOffset: { value: new THREE.Vector2(0, 0) }
        };

        this.cloudMat = new THREE.ShaderMaterial({
            vertexShader: cloudVertexShader,
            fragmentShader: cloudFragmentShader,
            uniforms: this.cloudUniforms,
            transparent: true,
            depthWrite: false
        });

        this.cloudMesh = new THREE.Mesh(cloudGeo, this.cloudMat);
        this.scene.add(this.cloudMesh);
    }

    createAtmosphere() {
        const atmoGeo = new THREE.SphereGeometry(this.planetRadius * 1.12, 64, 64);

        const atmoVertexShader = `
            varying vec3 vNormalWorld;
            varying vec3 vWorldPosition;
            varying vec3 vSunDir;
            uniform vec3 uSunPosition;

            void main() {
                vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPos.xyz;
                vSunDir = normalize(uSunPosition - worldPos.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPos;
            }
        `;

        const atmoFragmentShader = `
            varying vec3 vNormalWorld;
            varying vec3 vWorldPosition;
            varying vec3 vSunDir;

            uniform vec3 uColor;
            uniform float uOpacity;

            void main() {
                vec3 normal = normalize(vNormalWorld);
                vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                vec3 sunDir = normalize(vSunDir);

                // Fresnel de limbo atmosférico exterior
                float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 3.2);

                // Incidencia solar en la atmósfera
                float sunDot = dot(normal, sunDir);

                // 1. Dispersión Rayleigh diurna (azul cielo intenso)
                vec3 rayleighColor = uColor * 1.35;

                // 2. Dispersión crepuscular en el terminador (atardecer / amanecer simultáneo en el limbo)
                // Aumenta el camino óptico de la luz produciendo tonos ámbar y rojo profundo
                vec3 sunsetRing = vec3(1.0, 0.44, 0.10) * 1.8;
                float twilightFactor = smoothstep(-0.25, 0.08, sunDot) * smoothstep(0.40, 0.05, sunDot);

                // 3. Dispersión frontal de Mie (halo solar brillante en el horizonte)
                float miePhase = pow(max(0.0, dot(viewDir, -sunDir)), 8.0) * 0.7;
                vec3 mieGlow = vec3(1.0, 0.95, 0.85) * miePhase;

                // Combinación fotométrica
                vec3 atmoColor = mix(rayleighColor, sunsetRing, twilightFactor * 0.85) + mieGlow;

                // Atenuación nocturna suave en el hemisferio nocturno
                float sunFacing = smoothstep(-0.45, 0.65, sunDot);
                float intensity = fresnel * (sunFacing * 0.90 + 0.10) * uOpacity;

                gl_FragColor = vec4(atmoColor, intensity);
            }
        `;

        this.atmoUniforms = {
            uSunPosition: { value: this.sunPosition },
            uColor: { value: new THREE.Vector3(...this.simulation.current.atmosphereColor) },
            uOpacity: { value: this.simulation.current.atmosphereOpacity }
        };

        this.atmoMat = new THREE.ShaderMaterial({
            vertexShader: atmoVertexShader,
            fragmentShader: atmoFragmentShader,
            uniforms: this.atmoUniforms,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });

        this.atmoMesh = new THREE.Mesh(atmoGeo, this.atmoMat);
        this.scene.add(this.atmoMesh);
    }

    /**
     * Crea los anillos de auroras boreales y australes 3D en los polos geomagnéticos
     */
    createAuroras() {
        const auroraGeo = new THREE.TorusGeometry(2.3, 0.35, 16, 64);

        const auroraShader = {
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                uniform float uTime;
                void main() {
                    vUv = uv;
                    vPosition = position;
                    // Ondulación de cortinas aurorales
                    vec3 pos = position;
                    pos.z += sin(pos.x * 4.0 + uTime * 2.0) * 0.15;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                uniform float uIntensity;
                uniform float uTime;
                void main() {
                    // Gradiente verde esmeralda (oxígeno 557nm) a violeta (nitrógeno)
                    float wave = sin(vUv.x * 20.0 + uTime * 3.0) * 0.5 + 0.5;
                    vec3 greenColor = vec3(0.0, 1.0, 0.45);
                    vec3 purpleColor = vec3(0.65, 0.2, 1.0);
                    vec3 col = mix(greenColor, purpleColor, wave);

                    float alpha = sin(vUv.y * 3.1415) * 0.55 * uIntensity;
                    gl_FragColor = vec4(col, alpha);
                }
            `
        };

        this.auroraUniforms = {
            uTime: { value: 0.0 },
            uIntensity: { value: 1.0 }
        };

        this.auroraMat = new THREE.ShaderMaterial({
            vertexShader: auroraShader.vertexShader,
            fragmentShader: auroraShader.fragmentShader,
            uniforms: this.auroraUniforms,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false
        });

        // Aurora Norte
        this.auroraNorthMesh = new THREE.Mesh(auroraGeo, this.auroraMat);
        this.auroraNorthMesh.position.set(0, this.planetRadius * 0.94, 0);
        this.auroraNorthMesh.rotation.x = Math.PI / 2;
        this.scene.add(this.auroraNorthMesh);

        // Aurora Sur
        this.auroraSouthMesh = new THREE.Mesh(auroraGeo, this.auroraMat);
        this.auroraSouthMesh.position.set(0, -this.planetRadius * 0.94, 0);
        this.auroraSouthMesh.rotation.x = Math.PI / 2;
        this.scene.add(this.auroraSouthMesh);
    }

    /**
     * Crea la geometría tridimensional de líneas de dipolo magnético y cinturones de radiación
     */
    createMagneticFieldLines() {
        this.magneticFieldGroup = new THREE.Group();
        this.magneticFieldGroup.visible = false;

        const loopCount = 14;
        const R = this.planetRadius;
        const shellDistances = [R * 1.6, R * 2.2, R * 2.8];

        shellDistances.forEach((maxR, shellIdx) => {
            const mat = new THREE.LineBasicMaterial({
                color: shellIdx === 0 ? 0x00f0ff : (shellIdx === 1 ? 0x38bdf8 : 0xb464ff),
                transparent: true,
                opacity: shellIdx === 0 ? 0.70 : (shellIdx === 1 ? 0.45 : 0.30),
                blending: THREE.AdditiveBlending
            });

            for (let i = 0; i < loopCount; i++) {
                const phi = (i / loopCount) * Math.PI * 2;
                const points = [];
                const segments = 36;

                // Ecuación dipolar clásica: r = L * sin^2(theta)
                for (let j = 0; j <= segments; j++) {
                    const theta = (j / segments) * Math.PI;
                    if (theta < 0.22 || theta > Math.PI - 0.22) continue;
                    const r = maxR * Math.pow(Math.sin(theta), 2.0);
                    if (r < R * 0.98) continue;

                    const x = r * Math.sin(theta) * Math.cos(phi);
                    const z = r * Math.sin(theta) * Math.sin(phi);
                    const y = r * Math.cos(theta);
                    points.push(new THREE.Vector3(x, y, z));
                }

                if (points.length > 2) {
                    const geom = new THREE.BufferGeometry().setFromPoints(points);
                    const line = new THREE.Line(geom, mat);
                    this.magneticFieldGroup.add(line);
                }
            }
        });

        this.scene.add(this.magneticFieldGroup);
    }

    setMagneticFieldVisible(visible) {
        if (this.magneticFieldGroup) {
            this.magneticFieldGroup.visible = visible;
        }
    }

    createProbeVisuals() {
        // Marcador visual de rayo de sonda de escaneo
        const beamGeo = new THREE.CylinderGeometry(0.08, 0.25, 10, 16);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending
        });
        this.probeBeamMesh = new THREE.Mesh(beamGeo, beamMat);
        this.scene.add(this.probeBeamMesh);

        this.probeAnim = { active: false, timer: 0 };
    }

    launchProbeVisual(pointWorld) {
        this.probeAnim.active = true;
        this.probeAnim.timer = 0;
        
        const norm = pointWorld.clone().normalize();
        const start = pointWorld.clone().add(norm.multiplyScalar(5));
        this.probeBeamMesh.position.copy(start);
        this.probeBeamMesh.lookAt(pointWorld);
        this.probeBeamMesh.rotateX(Math.PI / 2);
        this.probeBeamMesh.material.opacity = 0.85;
    }

    initMeteorEffects() {
        const meteorGeo = new THREE.SphereGeometry(0.45, 20, 20);
        const meteorMat = new THREE.MeshBasicMaterial({ color: 0xff3700 });
        this.meteorMesh = new THREE.Mesh(meteorGeo, meteorMat);
        this.meteorMesh.visible = false;
        this.scene.add(this.meteorMesh);

        const ringGeo = new THREE.RingGeometry(0.1, 0.6, 48);
        this.shockwaveMat = new THREE.MeshBasicMaterial({
            color: 0xff4500,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.0,
            blending: THREE.AdditiveBlending
        });
        this.shockwaveMesh = new THREE.Mesh(ringGeo, this.shockwaveMat);
        this.shockwaveMesh.visible = false;
        this.scene.add(this.shockwaveMesh);

        this.meteorAnimation = {
            active: false,
            phase: 'incoming',
            progress: 0,
            startPos: new THREE.Vector3(28, 22, 35),
            impactPos: new THREE.Vector3(0, 1.5, this.planetRadius),
            scaleFactor: 1.0
        };
    }

    getCoordinatesAtMouse(clientX, clientY) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.earthMesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            const localPoint = hit.point.clone().applyMatrix4(this.earthMesh.matrixWorld.clone().invert()).normalize();
            
            const lat = Math.asin(localPoint.y) * (180 / Math.PI);
            const lon = Math.atan2(localPoint.x, localPoint.z) * (180 / Math.PI);

            return {
                hitPointWorld: hit.point,
                hitPointLocal: localPoint,
                lat: Math.round(lat * 10) / 10,
                lon: Math.round(lon * 10) / 10,
                uv: hit.uv
            };
        }
        return null;
    }

    launchMeteorToCoordinates(hitPointWorld, diameterKm = 15, speedKms = 25, composition = 'rock') {
        const anim = this.meteorAnimation;
        anim.active = true;
        anim.phase = 'incoming';
        anim.progress = 0;
        anim.scaleFactor = Math.max(0.5, Math.min(3.5, diameterKm / 15.0));

        const normal = hitPointWorld.clone().normalize();
        anim.impactPos.copy(hitPointWorld);
        anim.startPos.copy(hitPointWorld).add(normal.clone().multiplyScalar(24)).add(new THREE.Vector3(12, 10, 8));

        this.meteorMesh.visible = true;
        this.meteorMesh.position.copy(anim.startPos);
        this.meteorMesh.scale.set(anim.scaleFactor, anim.scaleFactor, anim.scaleFactor);

        this.simulation.triggerCustomImpact(hitPointWorld, diameterKm, speedKms, composition);
    }

    updateMeteor(dt) {
        if (!this.meteorAnimation.active) return;

        const anim = this.meteorAnimation;
        anim.progress += dt * 1.5;

        if (anim.phase === 'incoming') {
            const t = Math.min(1.0, anim.progress);
            this.meteorMesh.position.lerpVectors(anim.startPos, anim.impactPos, t);
            
            const pulse = (1.0 + Math.sin(anim.progress * 25) * 0.3) * anim.scaleFactor;
            this.meteorMesh.scale.set(pulse, pulse, pulse);

            if (t >= 1.0) {
                anim.phase = 'shockwave';
                anim.progress = 0;
                this.meteorMesh.visible = false;
                this.shockwaveMesh.visible = true;
                this.shockwaveMesh.position.copy(anim.impactPos).multiplyScalar(1.01);
                this.shockwaveMesh.lookAt(new THREE.Vector3(0, 0, 0));
                
                const shakeIntensity = Math.min(3.0, 1.2 * anim.scaleFactor);
                this.camera.position.x += (Math.random() - 0.5) * shakeIntensity;
                this.camera.position.y += (Math.random() - 0.5) * shakeIntensity;
            }
        } else if (anim.phase === 'shockwave') {
            const t = anim.progress;
            const ringScale = (1.0 + t * 15.0) * anim.scaleFactor;
            this.shockwaveMesh.scale.set(ringScale, ringScale, ringScale);
            this.shockwaveMat.opacity = Math.max(0, 1.0 - t * 0.7);

            if (t > 1.4) {
                anim.active = false;
                this.shockwaveMesh.visible = false;
            }
        }
    }

    syncCratersUniforms() {
        const list = this.simulation.craters;
        const count = Math.min(4, list.length);
        this.earthUniforms.uCraterCount.value = count;

        for (let i = 0; i < count; i++) {
            const craterWorld = list[i].center.clone().applyEuler(this.earthMesh.rotation).normalize();
            this.earthUniforms.uCraterCenters.value[i].copy(craterWorld);
            this.earthUniforms.uCraterRadii.value[i] = list[i].radius;
            this.earthUniforms.uCraterDepths.value[i] = list[i].depth;
            this.earthUniforms.uCraterUplifts.value[i] = list[i].crustUplift;
        }
    }

    setAtmosphereVisible(visible) {
        this.showAtmosphere = visible;
        if (this.atmoMesh) this.atmoMesh.visible = visible;
        if (this.earthUniforms) this.earthUniforms.uShowAtmosphere.value = visible ? 1.0 : 0.0;
    }

    setCloudsVisible(visible) {
        this.showClouds = visible;
        if (this.cloudMesh) this.cloudMesh.visible = visible;
        if (this.earthUniforms) this.earthUniforms.uShowClouds.value = visible ? 1.0 : 0.0;
    }

    setGlobalLight(enabled) {
        this.isGlobalLight = enabled;
        if (this.earthUniforms) {
            this.earthUniforms.uGlobalLight.value = enabled ? 1.0 : 0.0;
        }
    }

    setAurorasVisible(visible) {
        this.showAuroras = visible;
        if (this.auroraNorthMesh) this.auroraNorthMesh.visible = visible;
        if (this.auroraSouthMesh) this.auroraSouthMesh.visible = visible;
    }

    update(dt) {
        const cur = this.simulation.current;

        // 1. Inclinación Axial (Oblicuidad de Milankovitch)
        if (window.astrophysicsEngine) {
            const tiltRad = (window.astrophysicsEngine.params.obliquityDeg * Math.PI) / 180;
            this.earthMesh.rotation.z = tiltRad;
            if (this.cloudMesh) this.cloudMesh.rotation.z = tiltRad;

            // Anclaje por Marea (Tidal Locking): el planeta queda fijado frente al Sol
            if (window.astrophysicsEngine.params.isTidallyLocked) {
                this.earthMesh.rotation.y = 1.25; // Orientado de frente a la luz solar
                if (this.cloudMesh) this.cloudMesh.rotation.y = 1.25;
            } else if (!this.isRotationPaused) {
                const rotStep = dt * 0.035 * this.rotationSpeed;
                this.earthRotation += rotStep;
                this.cloudRotationOffset += rotStep * 0.25;

                if (this.earthMesh) this.earthMesh.rotation.y = this.earthRotation;
                if (this.cloudMesh) this.cloudMesh.rotation.y = this.earthRotation + this.cloudRotationOffset * 1.5;
            }
        } else if (!this.isRotationPaused) {
            const rotStep = dt * 0.035 * this.rotationSpeed;
            this.earthRotation += rotStep;
            this.cloudRotationOffset += rotStep * 0.25;

            if (this.earthMesh) this.earthMesh.rotation.y = this.earthRotation;
            if (this.cloudMesh) this.cloudMesh.rotation.y = this.earthRotation + this.cloudRotationOffset * 1.5;
        }

        // Rotación dinámica de las líneas de campo geomagnético
        if (this.magneticFieldGroup && this.magneticFieldGroup.visible) {
            this.magneticFieldGroup.rotation.y += dt * 0.04;
            if (this.earthMesh) {
                this.magneticFieldGroup.rotation.z = this.earthMesh.rotation.z;
            }
        }

        // 2. Shaders de Superficie
        if (this.earthUniforms) {
            this.earthUniforms.uCloudsOffset.value.set(this.cloudRotationOffset, 0);
            this.earthUniforms.uOceanColor.value.set(...cur.oceanColor);
            this.earthUniforms.uOceanShallowColor.value.set(...cur.oceanShallowColor);
            this.earthUniforms.uAbioticFactor.value = cur.abioticFactor;
            this.earthUniforms.uDinosaurFactor.value = cur.dinosaurFactor;
            this.earthUniforms.uIceCoverage.value = cur.iceCoverage;
            this.earthUniforms.uNightLights.value = cur.nightLights;
            this.earthUniforms.uVolcanism.value = cur.volcanism;
            this.earthUniforms.uErosionFactor.value = cur.erosionFactor;
            this.earthUniforms.uSeaLevelOffset.value = cur.seaLevelOffset;
            this.earthUniforms.uPangeaFactor.value = cur.pangeaFactor || 0.0;
            this.earthUniforms.uGeologicalMa.value = cur.geologicalMa !== undefined ? cur.geologicalMa : 0.0;
            this.earthUniforms.uMeanTemp.value = cur.meanTemp;
            this.earthUniforms.uAtmosphereColor.value.set(...cur.atmosphereColor);

            if (cur.vegetationColor) {
                this.earthUniforms.uPigmentColor.value.set(
                    cur.vegetationColor[0] / 255.0,
                    cur.vegetationColor[1] / 255.0,
                    cur.vegetationColor[2] / 255.0
                );
            }

            this.syncCratersUniforms();
        }

        // 3. Shaders de Nubes
        if (this.cloudUniforms && this.showClouds) {
            this.cloudUniforms.uCloudColor.value.set(...cur.cloudColor);
            this.cloudUniforms.uDensity.value = cur.cloudDensity;
            this.cloudUniforms.uOffset.value.set(this.cloudRotationOffset, 0);
        }

        // 4. Shaders de Atmósfera
        if (this.atmoUniforms && this.showAtmosphere) {
            this.atmoUniforms.uColor.value.set(...cur.atmosphereColor);
            this.atmoUniforms.uOpacity.value = cur.atmosphereOpacity;
        }

        // 5. Animación de Auroras Boreales 3D
        if (this.auroraUniforms) {
            this.auroraUniforms.uTime.value += dt;
            const magIntensity = window.astrophysicsEngine ? window.astrophysicsEngine.auroraIntensity : 1.0;
            this.auroraUniforms.uIntensity.value = magIntensity;
            
            const showAuroras = magIntensity > 0.05 && this.showAtmosphere && (this.showAuroras !== false);
            this.auroraNorthMesh.visible = showAuroras;
            this.auroraSouthMesh.visible = showAuroras;
        }

        // 6. Animación de Haz de Sonda
        if (this.probeAnim.active) {
            this.probeAnim.timer += dt;
            this.probeBeamMesh.material.opacity = Math.max(0, 0.85 - this.probeAnim.timer * 0.6);
            if (this.probeAnim.timer > 1.4) {
                this.probeAnim.active = false;
                this.probeBeamMesh.material.opacity = 0;
            }
        }

        // 7. Animación de Meteoros
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
