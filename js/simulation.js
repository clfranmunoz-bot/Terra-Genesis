/**
 * Simulation Module: Motor matemático, físico y geológico de la Tierra Alternativa
 * Integra cálculo balístico de impactos (megatones, cráter y deformación cortical),
 * modelo de erosión por pérdida de vegetación y ciclo termodinámico.
 */
class EarthSimulation {
    constructor() {
        this.current = {
            co2: 420,
            o2: 21.0,
            ch4: 1.9,
            n2o: 0.335,          // ppm (NOAA GML 2024)
            so2: 0.05,           // Mt de SO₂ en la estratosfera (carga de fondo)
            solarLuminosity: 1.0,
            volcanism: 1.0,
            hasLife: true,
            hasCivilization: true,
            
            // Variables climáticas y geológicas
            meanTemp: 15.0,
            seaLevelOffset: 0,
            habitability: 98.5,
            surfacePressure: 1.0,
            iceCoverage: 0.10,
            erosionFactor: 0.04, // 0.0 = suelos protegidos, 1.0 = desierto de roca desnuda y cañones
            
            // Shaders fotorrealistas
            atmosphereColor: [0.15, 0.55, 1.0],
            atmosphereOpacity: 0.85,
            oceanColor: [0.03, 0.18, 0.45],
            oceanShallowColor: [0.08, 0.45, 0.65],
            cloudDensity: 0.75,
            cloudColor: [1.0, 1.0, 1.0],
            nightLights: 1.0,
            abioticFactor: 0.0,
            dinosaurFactor: 0.0,
            volcanicGlow: 0.0,
            pangeaFactor: 0.0,
            geologicalMa: 0.0
        };

        this.target = JSON.parse(JSON.stringify(this.current));
        this.manualSeaLevel = false;
        this.skyColor = [0.15, 0.55, 1.0]; // lo cambia AstrophysicsEngine según la estrella
        
        // Historial de cráteres de impacto persistentes en la corteza terrestre
        this.craters = []; // { center: THREE.Vector3, radius: float, depth: float, crustUplift: float }

        // Evento temporal del meteorito en curso
        this.meteorEvent = {
            active: false,
            timer: 0,
            duration: 16.0,
            tau: 0,          // espesor óptico del aerosol de impacto
            sizeKm: 15,
            speedKms: 25,
            energyMegatons: 1.4e8,
            craterKm: 180
        };

        this.currentScenarioId = 'real';
        this.T = Fisica.perfilInicial(15);   // °C por banda de latitud (modelo EBM)
        this.Td = Fisica.perfilInicial(15);  // °C del océano profundo por banda
        this.clima = { estado: 'normal', albedo: 0.30, forzamiento: 0, Teq: 255, S_Wm2: 1361 };
    }

    // Integra el clima `anios` años de modelo. La insolación por banda sale de la órbita actual (Milankovitch).
    actualizarClima(anios) {
        const astro = window.astrophysicsEngine;
        const S_rel = this.current.solarLuminosity * (astro ? astro.insolacionRel : 1);
        const p = astro ? astro.params : { eccentricity: 0.0167, perihelionDeg: 282.9 };
        const obl = astro ? astro.oblicuidadEfectiva() : 23.44;
        const clave = [S_rel.toFixed(4), obl.toFixed(2), p.eccentricity, p.perihelionDeg].join();
        if (clave !== this._claveQ) { this._claveQ = clave; this._Q = Fisica.insolacionBandas(Fisica.C.S0 * S_rel, obl, p.eccentricity, p.perihelionDeg); }

        const c = this.current;
        const F = Fisica.forzamientoTotal({ co2: c.co2, ch4: c.ch4, n2o: c.n2o, so2: c.so2, nubes: c.cloudDensity,
                                            tauImpacto: this.meteorEvent.active ? this.meteorEvent.tau : 0 });
        const Teff = astro ? astro.estrella.Teff : 5772;
        const estado = Fisica.estadoInvernadero(S_rel, Teff);

        if (estado === 'desbocado') {
            // Fuera del dominio del modelo lineal: océanos evaporados (Goldblatt et al. 2013)
            c.meanTemp += (Fisica.T_DESBOCADO_C - c.meanTemp) * Math.min(1, anios * 0.05);
            this.T.fill(c.meanTemp);
            c.iceCoverage = 0;
        } else {
            if (this.clima.estado === 'desbocado') { this.T = Fisica.perfilInicial(60); this.Td = Fisica.perfilInicial(60); }
            Fisica.pasoEBM(this.T, this._Q, F, anios, this.Td);
            const d = Fisica.diagnosticoEBM(this.T, this._Q);
            c.meanTemp = d.Tmedia;
            c.iceCoverage = d.hielo;
            this.clima.albedo = d.albedo;
            this.clima.Tecuador = d.Tecuador;
            this.clima.Tpolo = d.Tpolo;
        }
        this.clima.estado = estado;
        this.clima.forzamiento = F;
        this.clima.S_Wm2 = Fisica.C.S0 * S_rel;
        this.clima.Teq = Fisica.temperaturaEquilibrio(this.clima.S_Wm2, this.clima.albedo);
    }

    applyScenario(scenarioKey) {
        const scenario = window.SCENARIOS[scenarioKey];
        if (!scenario) return;

        this.currentScenarioId = scenarioKey;
        this.manualSeaLevel = false;
        const p = scenario.params;
        const v = scenario.visual;

        this.target.co2 = p.co2;
        this.target.o2 = p.o2;
        this.target.ch4 = p.ch4;
        this.target.so2 = p.so2;
        this.target.solarLuminosity = p.solarLuminosity;
        this.target.volcanism = p.volcanism;
        this.target.hasLife = p.hasLife;
        this.target.hasCivilization = p.hasCivilization;
        this.target.seaLevelOffset = p.seaLevelOffset;
        this.target.n2o = p.n2o !== undefined ? p.n2o : 0.335;
        // La temperatura del escenario solo fija la condición inicial: el equilibrio lo calcula el modelo.
        // Importa por la histéresis: un arranque frío puede quedar atrapado en la bola de nieve (Budyko-Sellers).
        this.T = Fisica.perfilInicial(p.meanTempTarget !== undefined ? p.meanTempTarget : 15);
        this.Td = [...this.T];

        this.target.atmosphereColor = [...v.atmosphereColor];
        this.target.atmosphereOpacity = v.atmosphereOpacity;
        this.target.oceanColor = [...v.oceanColor];
        this.target.oceanShallowColor = [...v.oceanShallowColor];
        this.target.cloudDensity = v.cloudDensity;
        this.target.cloudColor = [...v.cloudColor];
        this.target.nightLights = (v.hasCityLights && p.hasCivilization) ? 1.0 : 0.0;
        this.target.abioticFactor = v.abioticFactor;
        this.target.dinosaurFactor = v.dinosaurFactor;
        this.target.volcanicGlow = v.volcanicGlow;
        this.target.erosionFactor = v.erosionFactor || (p.hasLife ? 0.04 : 0.92);
        this.target.pangeaFactor = v.pangeaFactor || 0.0;
        
        if (scenarioKey === 'pangea') {
            this.target.geologicalMa = -250;
        } else if (scenarioKey === 'dinosaurs') {
            this.target.geologicalMa = -66;
        } else if (scenarioKey === 'far_future') {
            this.target.geologicalMa = 250; // configuración continental más lejana disponible (+250 Ma); a +1000 Ma es desconocida
        } else {
            this.target.geologicalMa = 0;
        }
    }

    setParam(paramName, value) {
        this.target[paramName] = value;
        this.currentScenarioId = 'custom';

        if (paramName === 'seaLevelOffset') {
            this.manualSeaLevel = true;
        }

        if (paramName === 'hasLife') {
            this.target.abioticFactor = value ? 0.0 : 1.0;
            this.target.erosionFactor = value ? 0.04 : 0.95; // Erosión se dispara sin raíces
            if (!value) {
                this.target.oceanColor = [0.12, 0.35, 0.22];
                this.target.atmosphereColor = [0.95, 0.55, 0.15];
                this.target.nightLights = 0.0;
            } else {
                this.target.oceanColor = [0.03, 0.18, 0.45];
                this.target.atmosphereColor = [...this.skyColor];
            }
        }

        if (paramName === 'hasCivilization') {
            this.target.nightLights = value ? 1.0 : 0.0;
        }

        if (paramName === 'volcanism') {
            this.target.volcanicGlow = Math.min(2.0, (value - 1.0) * 0.1);
        }
    }

    /**
     * Registra un impacto en coordenadas 3D de la corteza y desencadena cataclismo
     */
    triggerCustomImpact(hitPoint3D, diameterKm, speedKms, composition) {
        // Ángulo de 45°: el más probable (Shoemaker 1962)
        const physics = Fisica.impacto({ L_m: diameterKm * 1000, v_kms: speedKms, rho_i: Fisica.DENSIDADES_IMPACTOR[composition] || 3000 });
        this.ultimoImpacto = physics;
        if (physics.rafagaAerea) return physics; // se desintegra en el aire: sin cráter ni invierno global

        this.meteorEvent.active = true;
        this.meteorEvent.tau = Math.max(this.meteorEvent.active ? this.meteorEvent.tau || 0 : 0, physics.tau);
        this.meteorEvent.sizeKm = diameterKm;
        this.meteorEvent.speedKms = speedKms;
        this.meteorEvent.energyMegatons = physics.energia_Mt;
        this.meteorEvent.craterKm = physics.crater_km;

        // Los grandes impactos excavan cuencas multianillo (Melosh 1989), no levantan mesetas: siempre hundimiento.
        const crustUplift = -0.3;
        
        const craterNormPos = hitPoint3D.clone().normalize();
        this.craters.push({
            center: craterNormPos,
            radius: Math.min(0.35, (physics.crater_km / 12742) * 2.5), // radio angular en la esfera (exagerado ×2,5 para verse)
            depth: Math.min(0.2, physics.profundidad_km / 10),
            crustUplift: crustUplift
        });

        // Limitar a los últimos 6 impactos para estabilidad de shaders
        if (this.craters.length > 6) {
            this.craters.shift();
        }

        // Alteración visual inmediata (el efecto climático va por meteorEvent.tau)
        if (physics.tau < 0.05) return physics;
        this.target.cloudDensity = Math.min(1.0, this.target.cloudDensity + 0.35);
        this.target.cloudColor = [0.22, 0.16, 0.14];
        this.target.atmosphereColor = [0.85, 0.35, 0.12];
        this.target.erosionFactor = Math.min(1.0, this.target.erosionFactor + 0.35);
        return physics;
    }

    update(dt) {
        const lerpFactor = Math.min(1.0, dt * 2.8);

        this.current.co2 += (this.target.co2 - this.current.co2) * lerpFactor;
        this.current.o2 += (this.target.o2 - this.current.o2) * lerpFactor;
        this.current.ch4 += (this.target.ch4 - this.current.ch4) * lerpFactor;
        this.current.so2 += (this.target.so2 - this.current.so2) * lerpFactor;
        this.current.n2o += (this.target.n2o - this.current.n2o) * lerpFactor;
        this.current.solarLuminosity += (this.target.solarLuminosity - this.current.solarLuminosity) * lerpFactor;
        this.current.volcanism += (this.target.volcanism - this.current.volcanism) * lerpFactor;
        this.current.hasLife = this.target.hasLife;
        this.current.hasCivilization = this.target.hasCivilization;
        this.current.erosionFactor += (this.target.erosionFactor - this.current.erosionFactor) * lerpFactor;
        this.current.pangeaFactor += ((this.target.pangeaFactor || 0.0) - this.current.pangeaFactor) * lerpFactor;
        this.current.geologicalMa += ((this.target.geologicalMa !== undefined ? this.target.geologicalMa : 0.0) - this.current.geologicalMa) * lerpFactor;

        // Disipación del invierno de impacto: e-folding de 1,5 años de clima (Brugger 2017)
        if (this.meteorEvent.active) {
            this.meteorEvent.tau *= Math.exp(-dt * EarthSimulation.AÑOS_CLIMA_POR_SEGUNDO / Fisica.TAU_DECAIMIENTO_IMPACTO_ANIOS);
            if (this.meteorEvent.tau < 0.01) { this.meteorEvent.active = false; this.meteorEvent.tau = 0; }
        }

        // ==========================================
        // 1. CLIMA: modelo de balance energético latitudinal (ver Fisica.pasoEBM)
        // Escala visual acelerada: 1 s de pantalla = AÑOS_CLIMA_POR_SEGUNDO años de clima.
        // ==========================================
        this.actualizarClima(dt * EarthSimulation.AÑOS_CLIMA_POR_SEGUNDO);

        // ==========================================
        // 2. NIVEL DEL MAR Y CASQUETES
        // ==========================================
        // Nivel del mar = eustasia tectónica (target.seaLevelOffset, del escenario o del control) + hielo continental (Fisica.nivelMarPorHielo_m).
        // Los océanos evaporados del invernadero desbocado quedan fuera de esta escala.
        const targetSeaOffset = this.target.seaLevelOffset + Fisica.nivelMarPorHielo_m(this.current.meanTemp);
        this.nivelMarHipotetico = !Fisica.nivelMarFisicamentePosible(this.target.seaLevelOffset);
        this.current.seaLevelOffset += (targetSeaOffset - this.current.seaLevelOffset) * lerpFactor;

        // ==========================================
        // 3. HABITABILIDAD GLOBAL
        // ==========================================
        let habitability = 100.0;
        if (!this.current.hasLife) {
            habitability = 0.0;
        } else {
            if (this.current.meanTemp < 5) habitability -= Math.min(80, (5 - this.current.meanTemp) * 2.0);
            if (this.current.meanTemp > 25) habitability -= Math.min(80, (this.current.meanTemp - 25) * 3.5);
            if (this.current.o2 < 12.0) habitability -= (12.0 - this.current.o2) * 5.0;
            if (this.current.so2 > 5.0) habitability -= Math.min(60, (this.current.so2 - 5.0) * 0.8);
        }
        this.current.habitability = Math.max(0, Math.min(100, habitability));

        // Presión superficial total (bar ≈ atm): la fija el control; O₂ y CO₂ son fracciones molares de esa presión.
        this.current.surfacePressure += (this.target.surfacePressure - this.current.surfacePressure) * lerpFactor;

        // ==========================================
        // 4. INTERPOLACIÓN VISUAL
        // ==========================================
        for (let i = 0; i < 3; i++) {
            this.current.atmosphereColor[i] += (this.target.atmosphereColor[i] - this.current.atmosphereColor[i]) * lerpFactor;
            this.current.oceanColor[i] += (this.target.oceanColor[i] - this.current.oceanColor[i]) * lerpFactor;
            this.current.oceanShallowColor[i] += (this.target.oceanShallowColor[i] - this.current.oceanShallowColor[i]) * lerpFactor;
            this.current.cloudColor[i] += (this.target.cloudColor[i] - this.current.cloudColor[i]) * lerpFactor;
        }

        this.current.cloudDensity += (this.target.cloudDensity - this.current.cloudDensity) * lerpFactor;
        this.current.atmosphereOpacity += (this.target.atmosphereOpacity - this.current.atmosphereOpacity) * lerpFactor;
        this.current.nightLights += (this.target.nightLights - this.current.nightLights) * lerpFactor;
        this.current.abioticFactor += (this.target.abioticFactor - this.current.abioticFactor) * lerpFactor;
        this.current.dinosaurFactor += (this.target.dinosaurFactor - this.current.dinosaurFactor) * lerpFactor;
        this.current.volcanicGlow += (this.target.volcanicGlow - this.current.volcanicGlow) * lerpFactor;
    }

    getDominantCladeInfo() {
        if (!this.current.hasLife) {
            return {
                badge: 'ESTÉRIL (SIN VIDA ORGÁNICA)',
                desc: 'La abiogénesis nunca prosperó. Continentes desolados y mares verdes ricos en hierro soluble.'
            };
        }
        if (this.meteorEvent.active && this.meteorEvent.tau > 1) {
            return {
                badge: 'EXTINCIÓN POR IMPACTO CATACLÍSMICO',
                desc: 'Invierno de impacto global en curso. Colapso del fitoplancton y cadenas tróficas.'
            };
        }
        if (this.current.meanTemp <= -20) {
            return {
                badge: 'EXTREMÓFILOS CRIOGÉNICOS',
                desc: 'Supervivencia confinada bajo kilómetros de banquisa de hielo marino.'
            };
        }
        if (this.current.seaLevelOffset > 500) {
            return {
                badge: 'FAUNA PELÁGICA OCEÁNICA',
                desc: 'Mundo casi 100% acuático con evolución explosiva de gigantes marinos.'
            };
        }
        if (this.current.so2 > 30 || this.current.volcanism > 10) {
            return {
                badge: 'BACTERIAS PÚRPURAS & HONGOS',
                desc: 'Ecosistemas anóxicos euxínicos sustentados por azufre y lluvia ácida.'
            };
        }
        if (this.current.o2 >= 26 && !this.current.hasCivilization) {
            return {
                badge: 'DINOSAURIA & MEGAFAUNA',
                desc: 'Megasaurios colosales y bosques gigantescos dominan todos los continentes.'
            };
        }
        if (this.current.hasCivilization && this.current.habitability > 60) {
            return {
                badge: 'HOMO SAPIENS (CIVILIZACIÓN)',
                desc: 'Especie tecnológica con red eléctrica global e infraestructuras espaciales.'
            };
        }
        if (this.current.habitability < 30) {
            return {
                badge: 'FAUNA RELICTA DEPRESIONADA',
                desc: 'Poblaciones menguantes refugiadas en nichos microclimáticos.'
            };
        }
        return {
            badge: 'MAMÍFEROS Y AVES SILVESTRES',
            desc: 'Biosfera diversificada post-dinosaurios pero sin civilización tecnológica.'
        };
    }
}

EarthSimulation.AÑOS_CLIMA_POR_SEGUNDO = 5; // escala visual acelerada: 1 s = 5 años de clima

window.EarthSimulation = EarthSimulation;
