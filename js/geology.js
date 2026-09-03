/**
 * Geology Module: Termostato geoquímico carbono-silicato de Walker y
 * evolución de supercontinentes (Ciclos de Wilson: Pangea, Actual, Pangea Ultima).
 */
class GeologyEngine {
    constructor(simulation) {
        this.simulation = simulation;

        this.params = {
            thermostatActive: true,      // Retroalimentación estabilizadora de silicatos
            orogenyLevel: 1.0,           // Formación de montañas (expone silicatos frescos)
            continentalEpoch: 'modern',  // 'pangea', 'modern', 'pangea_ultima'
            weatheringRateMtYear: 450,   // Millones de toneladas CO2 secuestradas/año
            degassingRateMtYear: 450     // Millones de toneladas CO2 emitidas por volcanes/año
        };
    }

    setThermostat(active) {
        this.params.thermostatActive = active;
    }

    setOrogeny(level) {
        this.params.orogenyLevel = Math.max(0.1, Math.min(3.0, level));
    }

    setContinentalEpoch(epoch) {
        this.params.continentalEpoch = epoch;
    }

    update(dt) {
        const cur = this.simulation.current;

        // 1. Tasa de Desgasificación Volcánica (Emisión de CO2 profunda)
        this.params.degassingRateMtYear = 450 * cur.volcanism;

        // 2. Tasa de Meteorización Química de Silicatos (Walker Feedback)
        // W = W0 * (CO2/280)^0.3 * exp((T - 15) / 13.7) * orogenia
        if (this.params.thermostatActive) {
            const co2Factor = Math.pow(Math.max(0.1, cur.co2 / 280), 0.3);
            const tempFactor = Math.exp((cur.meanTemp - 15.0) / 13.7);
            this.params.weatheringRateMtYear = 450 * co2Factor * tempFactor * this.params.orogenyLevel;

            // Ajuste gradual del CO2 atmosférico hacia el equilibrio natural
            const co2Imbalance = (this.params.degassingRateMtYear - this.params.weatheringRateMtYear) * 0.05;
            this.simulation.target.co2 = Math.max(80, Math.min(30000, this.simulation.target.co2 + co2Imbalance * dt));
        } else {
            // Sin termostato (ej. Marte o Venus), el CO2 volcánico se acumula sin sumidero
            this.params.weatheringRateMtYear = 0;
            this.simulation.target.co2 = Math.min(35000, this.simulation.target.co2 + (this.params.degassingRateMtYear * 0.08 * dt));
        }
    }
}

window.GeologyEngine = GeologyEngine;
