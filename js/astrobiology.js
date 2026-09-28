/**
 * Astrobiology Module: Pigmentos fotosintéticos alternativos (Tierra Púrpura, Plantas Negras),
 * espectroscopio de biosignaturas exoplanetario (JWST) y simulación de redes tróficas en cascada.
 */
class AstrobiologyEngine {
    constructor(simulation) {
        this.simulation = simulation;

        this.params = {
            pigmentType: 'green', // 'green' (Clorofila), 'purple' (Retinal Arqueano), 'black' (Enana Roja)
            trophicProducers: 100.0,
            trophicHerbivores: 100.0,
            trophicCarnivores: 100.0,
            biosignatureScore: 98
        };

        // Color de la vegetación según el pigmento (Kiang et al. 2007). El pigmento tiñe la tierra, NO el océano.
        this.pigmentColors = {
            green:  { veg: [34, 139, 34],  label: 'Clorofila a/b: absorbe azul y rojo, refleja verde (Sol)' },
            purple: { veg: [138, 43, 226], label: 'Retinal (bacteriorrodopsina): absorbe verde; hipótesis "Tierra púrpura" (DasSarma & Schwieterman 2018)' },
            black:  { veg: [25, 28, 36],   label: 'Absorción de todo el visible e IR cercano (enanas M; Kiang 2007b)' },
            gold:   { veg: [200, 160, 40], label: 'Reflexión amarillo-anaranjada (estrellas F; Kiang 2007b)' },
            blue:   { veg: [40, 90, 190],  label: 'Ficocianina: absorbe naranja-rojo (cianobacterias)' }
        };
    }

    setPigment(type) {
        if (!this.pigmentColors[type]) return;
        this.params.pigmentType = type;
        if (this.simulation.current.hasLife) this.simulation.target.vegetationColor = [...this.pigmentColors[type].veg];
    }

    /**
     * Genera datos espectroscópicos para el telescopio espacial JWST
     */
    generateAtmosphericSpectrum() {
        const cur = this.simulation.current;
        const wavelengthPoints = [];

        // Generar espectro de transmisión de 0.4 a 15 micrómetros
        for (let wl = 0.4; wl <= 15.0; wl += 0.15) {
            let transmission = 0.95; // Transmisión base

            // Dispersión de Rayleigh: τ_R ∝ λ⁻⁴·P (Bodhaine 1999); ×5 por la trayectoria oblicua del tránsito
            // simplificación: factor geométrico fijo en lugar de integrar la geometría del limbo.
            transmission *= Math.exp(-5 * Fisica.espesorRayleigh(wl, cur.surfacePressure, cur.co2));

            // Banda de absorción de Ozono O3 (0.6 um y 9.6 um)
            if (cur.o2 > 5.0) {
                if (Math.abs(wl - 0.6) < 0.08) transmission -= (cur.o2 / 21.0) * 0.18;
                if (Math.abs(wl - 9.6) < 0.4) transmission -= (cur.o2 / 21.0) * 0.65;
            }

            // "Red edge" de la vegetación a 0,7 µm: es un rasgo de REFLEXIÓN de la superficie (Seager et al. 2005, Astrobiology 5),
            // no de transmisión; se superpone aquí de forma ilustrativa.
            if (cur.hasLife && Math.abs(wl - 0.7) < 0.05) {
                transmission += (this.params.pigmentType === 'green' ? 0.25 : 0.12);
            }

            // Bandas de Vapor de Agua H2O (0.94, 1.13, 1.4, 1.9, 6.3 um)
            const waterPeaks = [0.94, 1.13, 1.4, 1.9, 6.3];
            for (const wp of waterPeaks) {
                if (Math.abs(wl - wp) < 0.15) {
                    transmission -= 0.45;
                }
            }

            // Bandas de Dióxido de Carbono CO2 (2.0, 2.7, 4.3, 15.0 um)
            const co2Peaks = [2.0, 2.7, 4.3, 14.8];
            for (const cp of co2Peaks) {
                if (Math.abs(wl - cp) < 0.25) {
                    transmission -= Math.min(0.85, (cur.co2 / 400.0) * 0.5);
                }
            }

            // Bandas de Metano CH4 (1.66, 2.3, 3.3, 7.7 um)
            if (cur.ch4 > 0.5) {
                const ch4Peaks = [1.66, 2.3, 3.3, 7.7];
                for (const mp of ch4Peaks) {
                    if (Math.abs(wl - mp) < 0.2) {
                        transmission -= Math.min(0.7, (cur.ch4 / 2.0) * 0.35);
                    }
                }
            }

            wavelengthPoints.push({
                wavelength: Math.round(wl * 100) / 100,
                flux: Math.max(0.05, Math.min(1.2, transmission))
            });
        }

        // Puntuación de biosignatura (desequilibrio redox O2 + CH4)
        let bioScore = 0;
        if (cur.hasLife) {
            if (cur.o2 > 10) bioScore += 40;
            if (cur.ch4 > 1.0) bioScore += 30; // Coexistencia de gas oxidante y reductor
            if (cur.meanTemp > 0 && cur.meanTemp < 45) bioScore += 30;
        }

        this.params.biosignatureScore = bioScore;
        return { spectrum: wavelengthPoints, score: bioScore };
    }

    update(dt) {
        const cur = this.simulation.current;

        // Simulación de red trófica dinámica
        if (!cur.hasLife) {
            this.params.trophicProducers = 0;
            this.params.trophicHerbivores = 0;
            this.params.trophicCarnivores = 0;
            return;
        }

        // Productores dependen de luz solar y habitabilidad
        const sunlight = cur.solarLuminosity * (1.0 - (cur.cloudDensity * 0.45));
        const producerTarget = Math.max(0, cur.habitability * sunlight);
        this.params.trophicProducers += (producerTarget - this.params.trophicProducers) * dt * 0.8;

        // Herbívoros siguen a los productores con retraso
        // Biomasa relativa por nivel (0–100, escala de la barra). Solo ~10 % de la energía pasa de un nivel al siguiente
        // (Lindeman 1942; Pauly & Christensen 1995); aquí se muestra la tendencia relativa, no la proporción absoluta.
        const herbivoreTarget = Math.max(0, this.params.trophicProducers * 0.85);
        this.params.trophicHerbivores += (herbivoreTarget - this.params.trophicHerbivores) * dt * 0.5;

        // Carnívoros siguen a los herbívoros
        const carnivoreTarget = Math.max(0, this.params.trophicHerbivores * 0.75);
        this.params.trophicCarnivores += (carnivoreTarget - this.params.trophicCarnivores) * dt * 0.3;
    }
}

window.AstrobiologyEngine = AstrobiologyEngine;
