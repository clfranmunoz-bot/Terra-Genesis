/**
 * Geology Module: Termostato geoquímico carbono-silicato de Walker y
 * evolución de supercontinentes (Ciclos de Wilson: Pangea, Actual, Pangea Ultima).
 *
 * Ciclo del carbono de largo plazo (Walker, Hays & Kasting 1981; Berner GEOCARB III 2001):
 *   dC/dt = Desgasificación volcánica − Meteorización de silicatos
 *   CaSiO₃ + 2CO₂ + H₂O → Ca²⁺ + 2HCO₃⁻ + SiO₂   (continentes)
 *   Ca²⁺ + 2HCO₃⁻ → CaCO₃ + CO₂ + H₂O           (océano: precipitación de carbonatos)
 * Balance neto: 1 CO₂ secuestrado por cada CaSiO₃ meteorizado.
 */
class GeologyEngine {
    constructor(simulation) {
        this.simulation = simulation;

        this.params = {
            thermostatActive: true,      // Retroalimentación estabilizadora de silicatos
            orogenyLevel: 1.0,           // Formación de montañas (expone silicatos frescos)
            continentalEpoch: 'modern',  // 'pangea', 'modern', 'pangea_ultima'
            weatheringRateMtYear: 300,   // Mt de CO₂ secuestradas/año por meteorización de silicatos
            degassingRateMtYear: 300     // Mt de CO₂ emitidas/año por volcanes y dorsales (≈ 0.26–0.36 Gt reales)
        };

        this.constants = {
            D0: 300,                // Desgasificación actual [Mt CO₂/año]
            T_REF: 13.8,            // Temperatura preindustrial de equilibrio del modelo energético [°C]
            CO2_REF: 280,           // CO₂ preindustrial [ppm]
            MT_PER_PPM: 7810,       // 1 ppm de CO₂ atmosférico = 7.81 Gt CO₂
            OCEAN_BUFFER: 5.0,      // El océano absorbe ~80 % del carbono a escala >10 ka (tampón carbonatado)
            YEARS_PER_SECOND: 5000  // Compresión temporal geológica: 1 s real = 5 000 años
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

    /**
     * Tasa de meteorización de silicatos (GEOCARB III, Berner 2001).
     * - Temperatura: f(T) = e^{0.09ΔT} · (1 + 0.038ΔT)^0.65  (cinética de Arrhenius + escorrentía)
     * - CO₂ con plantas vasculares: f = (2R / (1+R))^0.4  (saturación por Michaelis-Menten)
     * - CO₂ abiótico: f = R^0.5
     * - Biota: las raíces y los ácidos orgánicos multiplican la meteorización ×4 (Schwartzman & Volk 1989)
     * - Hielo: los glaciares cubren la roca y congelan la escorrentía → W ≈ 0 en bola de nieve
     */
    computeWeathering(cur) {
        const c = this.constants;
        const dT = cur.meanTemp - c.T_REF;
        const R = Math.max(0.01, cur.co2 / c.CO2_REF);

        const fT = Math.exp(0.09 * dT) * Math.pow(Math.max(0.01, 1 + 0.038 * dT), 0.65);
        const fCO2 = cur.hasLife ? Math.pow((2 * R) / (1 + R), 0.4) : Math.pow(R, 0.5);
        const fBio = cur.hasLife ? 1.0 : 0.25;
        const fIce = Math.max(0, 1 - cur.iceCoverage) / 0.9; // Normalizado al 10 % de hielo actual
        const epochFactor = this.params.continentalEpoch === 'modern' ? 1.0 : 0.7; // Supercontinente: interior árido

        return c.D0 * fT * fCO2 * fBio * fIce * epochFactor * this.params.orogenyLevel;
    }

    update(dt) {
        const cur = this.simulation.current;
        const target = this.simulation.target;
        const c = this.constants;

        // 1. Desgasificación volcánica (manto → atmósfera)
        this.params.degassingRateMtYear = c.D0 * cur.volcanism;

        // 2. Meteorización de silicatos (atmósfera → carbonatos marinos)
        this.params.weatheringRateMtYear = this.params.thermostatActive ? this.computeWeathering(cur) : 0;

        // Con civilización, el CO₂ lo fijan las emisiones humanas (~37 000 Mt/año, 100× el vulcanismo):
        // el termostato actúa en escalas de 10⁵ años y no puede competir en tiempo histórico.
        if (cur.hasCivilization) return;

        // 3. Balance de masa: Mt/año → ppm, repartido con el océano
        const netMtYear = this.params.degassingRateMtYear - this.params.weatheringRateMtYear;
        const dPpm = (netMtYear * c.YEARS_PER_SECOND * dt) / (c.MT_PER_PPM * c.OCEAN_BUFFER);
        // Límite por paso para estabilidad numérica (el sistema es rígido a altas temperaturas)
        const maxStep = target.co2 * 0.05;
        target.co2 = Math.max(10, Math.min(100000, target.co2 + Math.max(-maxStep, Math.min(maxStep, dPpm))));
    }
}

window.GeologyEngine = GeologyEngine;
