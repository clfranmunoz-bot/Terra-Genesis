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
     * Espectro de tránsito (altura efectiva en km) de la atmósfera actual: ver Fisica.espectroTransito.
     * El "red edge" de la vegetación es un rasgo de luz reflejada (Seager et al. 2005) y no aparece en tránsito.
     */
    generateAtmosphericSpectrum() {
        const cur = this.simulation.current;
        const { puntos, H_km } = Fisica.espectroTransito({ T_C: Math.min(100, cur.meanTemp), P_bar: cur.surfacePressure, co2: cur.co2, o2: cur.o2, ch4: cur.ch4 });

        // Puntuación de biosignatura (desequilibrio redox O2 + CH4)
        let bioScore = 0;
        if (cur.hasLife) {
            if (cur.o2 > 10) bioScore += 40;
            if (cur.ch4 > 1.0) bioScore += 30; // Coexistencia de gas oxidante y reductor
            if (cur.meanTemp > 0 && cur.meanTemp < 45) bioScore += 30;
        }

        this.params.biosignatureScore = bioScore;
        return { spectrum: puntos, score: bioScore, H_km };
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
