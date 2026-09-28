/**
 * Módulo de geología: ciclo geológico del carbono (termostato carbono-silicato de Walker 1981).
 * Las ecuaciones y constantes están en js/fisica.js (pasoCarbono).
 */
class GeologyEngine {
    constructor(simulation) {
        this.simulation = simulation;
        this.params = {
            thermostatActive: false,     // si está activo, el CO₂ evoluciona en tiempo geológico acelerado
            orogenyLevel: 1.0,           // exposición de silicatos frescos por formación de montañas (relativa a hoy)
            weatheringRateMtYear: 260,   // Mt CO₂/año secuestradas por meteorización de silicatos
            degassingRateMtYear: 260     // Mt CO₂/año emitidas por volcanes (Gerlach 2011)
        };
        this.maTranscurridos = 0;
    }

    setThermostat(active) { this.params.thermostatActive = active; this.maTranscurridos = 0; }
    setOrogeny(level) { this.params.orogenyLevel = Math.max(0.1, Math.min(3.0, level)); }

    update(dt) {
        const cur = this.simulation.current;
        this.params.degassingRateMtYear = Fisica.desgasificacion_GtAnio(cur.volcanism) * 1000;
        this.params.weatheringRateMtYear = Fisica.meteorizacion_GtAnio(cur.co2, cur.meanTemp, this.params.orogenyLevel) * 1000;

        // El termostato actúa en ~400 ka: con el reloj del clima (1 s = 1 año) no se vería nunca.
        // Escala visual acelerada: 1 s = GeologyEngine.ANIOS_POR_SEGUNDO años de tiempo geológico.
        if (this.params.thermostatActive && this.simulation.clima.estado !== 'desbocado') {
            const anios = dt * GeologyEngine.ANIOS_POR_SEGUNDO;
            // El clima (τ ≈ 5 años) está en cuasi-equilibrio frente al carbono (τ ≈ 400 ka): se integran años extra para eliminar el desfase visual.
            this.simulation.actualizarClima(dt * 300);
            this.maTranscurridos += anios / 1e6;
            const t = this.simulation.target;
            t.co2 = cur.co2 = Math.min(3e5, Fisica.pasoCarbono(t.co2, cur.meanTemp, cur.volcanism, this.params.orogenyLevel, anios));
        }
    }
}
GeologyEngine.ANIOS_POR_SEGUNDO = 5e4;

window.GeologyEngine = GeologyEngine;
