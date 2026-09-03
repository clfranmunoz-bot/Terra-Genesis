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
            so2: 0.05,
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
        
        // Historial de cráteres de impacto persistentes en la corteza terrestre
        this.craters = []; // { center: THREE.Vector3, radius: float, depth: float, crustUplift: float }

        // Evento temporal del meteorito en curso
        this.meteorEvent = {
            active: false,
            timer: 0,
            duration: 16.0,
            sootDust: 0,
            sizeKm: 15,
            speedKms: 25,
            energyMegatons: 1.4e8,
            craterKm: 180
        };

        this.currentScenarioId = 'real';
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
            this.target.geologicalMa = 250;
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
                this.target.atmosphereColor = [0.15, 0.55, 1.0];
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
     * Calcula la balística y consecuencias físicas de un impacto personalizado
     */
    calculateImpactPhysics(diameterKm, speedKms, composition = 'rock') {
        // Densidad (kg/m3)
        const densities = { iron: 7800, rock: 3000, ice: 920 };
        const rho = densities[composition] || 3000;

        // Masa = (4/3) * PI * r^3 * rho
        const radiusM = (diameterKm * 1000) / 2;
        const volumeM3 = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
        const massKg = volumeM3 * rho;

        // Energía cinética = 0.5 * m * v^2 en Joules (1 Megatón TNT = 4.184 x 10^15 Joules)
        const velocityMs = speedKms * 1000;
        const energyJoules = 0.5 * massKg * Math.pow(velocityMs, 2);
        const megatons = energyJoules / 4.184e15;

        // Diámetro estimado del cráter (fórmula empírica de Schmidt-Holsapple)
        const craterDiameterKm = 1.161 * Math.pow(rho / 2600, 0.33) * Math.pow(diameterKm, 0.78) * Math.pow(speedKms, 0.44);

        return {
            massKg,
            megatons,
            craterDiameterKm: Math.round(craterDiameterKm * 10) / 10,
            dustEjectionPpm: Math.min(5000, megatons * 0.0005)
        };
    }

    /**
     * Registra un impacto en coordenadas 3D de la corteza y desencadena cataclismo
     */
    triggerCustomImpact(hitPoint3D, diameterKm, speedKms, composition) {
        const physics = this.calculateImpactPhysics(diameterKm, speedKms, composition);

        this.meteorEvent.active = true;
        this.meteorEvent.timer = 0;
        this.meteorEvent.sootDust = Math.min(2.5, physics.megatons / 1e7);
        this.meteorEvent.sizeKm = diameterKm;
        this.meteorEvent.speedKms = speedKms;
        this.meteorEvent.energyMegatons = physics.megatons;
        this.meteorEvent.craterKm = physics.craterDiameterKm;

        // Registrar deformación cortical en la corteza
        // Un asteroide >35 km produce deformación orogénica (levantamiento de meseta basáltica)
        const crustUplift = diameterKm > 35 ? (diameterKm / 150.0) : -0.3; // Negativo = hundimiento / cuenca marina
        
        const craterNormPos = hitPoint3D.clone().normalize();
        this.craters.push({
            center: craterNormPos,
            radius: Math.min(0.35, (physics.craterDiameterKm / 12742) * 2.5), // Radio angular en la esfera
            depth: Math.min(0.2, diameterKm / 100.0),
            crustUplift: crustUplift
        });

        // Limitar a los últimos 6 impactos para estabilidad de shaders
        if (this.craters.length > 6) {
            this.craters.shift();
        }

        // Alteración ambiental inmediata
        this.target.so2 = Math.min(300, this.target.so2 + physics.dustEjectionPpm * 0.3);
        this.target.cloudDensity = Math.min(1.0, this.target.cloudDensity + 0.35);
        this.target.cloudColor = [0.22, 0.16, 0.14];
        this.target.atmosphereColor = [0.85, 0.35, 0.12];
        this.target.erosionFactor = Math.min(1.0, this.target.erosionFactor + 0.35);
    }

    update(dt) {
        const lerpFactor = Math.min(1.0, dt * 2.8);

        this.current.co2 += (this.target.co2 - this.current.co2) * lerpFactor;
        this.current.o2 += (this.target.o2 - this.current.o2) * lerpFactor;
        this.current.ch4 += (this.target.ch4 - this.current.ch4) * lerpFactor;
        this.current.so2 += (this.target.so2 - this.current.so2) * lerpFactor;
        this.current.solarLuminosity += (this.target.solarLuminosity - this.current.solarLuminosity) * lerpFactor;
        this.current.volcanism += (this.target.volcanism - this.current.volcanism) * lerpFactor;
        this.current.hasLife = this.target.hasLife;
        this.current.hasCivilization = this.target.hasCivilization;
        this.current.erosionFactor += (this.target.erosionFactor - this.current.erosionFactor) * lerpFactor;
        this.current.pangeaFactor += ((this.target.pangeaFactor || 0.0) - this.current.pangeaFactor) * lerpFactor;
        this.current.geologicalMa += ((this.target.geologicalMa !== undefined ? this.target.geologicalMa : 0.0) - this.current.geologicalMa) * lerpFactor;

        // Disipación del invierno de impacto
        if (this.meteorEvent.active) {
            this.meteorEvent.timer += dt;
            if (this.meteorEvent.timer > this.meteorEvent.duration) {
                this.meteorEvent.sootDust *= Math.max(0, 1 - dt * 0.15);
                if (this.meteorEvent.sootDust < 0.03) {
                    this.meteorEvent.active = false;
                    this.meteorEvent.sootDust = 0;
                }
            }
        }

        // ==========================================
        // 1. CLIMA Y BALANCE TÉRMICO
        // ==========================================
        const co2Ratio = Math.max(0.1, this.current.co2 / 280);
        const deltaF_CO2 = 5.35 * Math.log(co2Ratio);
        const deltaF_CH4 = 0.036 * (Math.sqrt(Math.max(0, this.current.ch4)) - Math.sqrt(1.7));
        const volcanicAerosols = (this.current.so2 * 0.04) + (this.meteorEvent.sootDust * 8.0);
        const coolingFactor = Math.min(28.0, volcanicAerosols * 2.4);
        const solarForcing = (this.current.solarLuminosity - 1.0) * 38.0;
        
        let calculatedTemp = 14.5 + (deltaF_CO2 * 0.75) + (deltaF_CH4 * 0.4) + solarForcing - coolingFactor;

        if (!this.current.hasLife) {
            calculatedTemp += 3.5;
        }

        // Glaciación desbocada
        if (calculatedTemp < -5) {
            const iceAlbedo = Math.min(22, Math.abs(calculatedTemp + 5) * 0.65);
            calculatedTemp -= iceAlbedo;
        }

        this.current.meanTemp += (calculatedTemp - this.current.meanTemp) * lerpFactor;

        // ==========================================
        // 2. NIVEL DEL MAR Y CASQUETES
        // ==========================================
        let targetSeaOffset = this.target.seaLevelOffset;
        if (!this.manualSeaLevel && this.target.seaLevelOffset === 0) {
            if (this.current.meanTemp > 15.0) {
                targetSeaOffset = Math.min(75, (this.current.meanTemp - 15.0) * 5.5);
            } else {
                targetSeaOffset = Math.max(-130, (this.current.meanTemp - 15.0) * 4.5);
            }
        }
        this.current.seaLevelOffset += (targetSeaOffset - this.current.seaLevelOffset) * lerpFactor;

        // Cobertura de hielo polar
        let targetIce = 0.10;
        if (this.current.meanTemp <= -25) {
            targetIce = 0.98;
        } else if (this.current.meanTemp <= 0) {
            targetIce = 0.45 + Math.abs(this.current.meanTemp) * 0.02;
        } else if (this.current.meanTemp < 18) {
            targetIce = Math.max(0.01, 0.16 - (this.current.meanTemp - 10) * 0.015);
        } else {
            targetIce = 0.0;
        }
        this.current.iceCoverage += (targetIce - this.current.iceCoverage) * lerpFactor;

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
            if (this.meteorEvent.active) habitability -= this.meteorEvent.sootDust * 65;
        }
        this.current.habitability = Math.max(0, Math.min(100, habitability));

        // Presión superficial
        const basePressure = 0.78 + (this.current.o2 / 100) + (this.current.co2 / 10000) * 0.6;
        this.current.surfacePressure = Math.round(basePressure * 100) / 100;

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
        if (this.meteorEvent.active && this.meteorEvent.sootDust > 0.4) {
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

window.EarthSimulation = EarthSimulation;
