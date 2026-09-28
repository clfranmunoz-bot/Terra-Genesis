/**
 * Módulo de astrofísica: estrella huésped, órbita (Milankovitch), anclaje por marea,
 * efecto de la Luna sobre la oblicuidad y magnetosfera. Las fórmulas viven en js/fisica.js.
 */
class AstrophysicsEngine {
    constructor(simulation) {
        this.simulation = simulation;

        this.params = {
            obliquityDeg: 23.44,      // ε actual (IERS)
            eccentricity: 0.0167,     // e actual (Laskar 2004)
            perihelionDeg: 282.9,     // ϖ geocéntrica actual (perihelio ~3 de enero)
            hasMoon: true,
            starType: 'sun_g2v',
            distanceFactor: 1.0,      // d / d_equivalente; d_equivalente = √(L★/L☉) UA
            isTidallyLocked: false,   // calculado, no fijado a mano
            magneticField: 1.0,       // B / B⊕ (B⊕ = 31 µT en el ecuador)
            solarActivity: 1.0,       // presión dinámica del viento relativa a la media
            orbitalPeriodDays: 365.25,
            dayOfYear: 172
        };

        this.chaoticTiltMa = 0;       // reloj de la deriva caótica, en Ma de modelo
        this.auroraIntensity = 1.0;
        this.recalcular();
    }

    get estrella() { return Fisica.ESTRELLAS[this.params.starType]; }
    get distanciaUA() { return this.params.distanceFactor * Fisica.distanciaEquivalente(this.estrella.L); }

    // Deriva todo lo que depende de estrella + distancia: insolación, anclaje, magnetosfera y zona habitable.
    recalcular() {
        const est = this.estrella, d = this.distanciaUA;
        this.insolacionRel = Fisica.insolacion(est.L, d);                  // S/S⊕
        this.params.isTidallyLocked = Fisica.estaAnclado(est, d);
        this.tiempoAnclajeAnios = Fisica.tiempoAnclajeMarea_anios(est.M, d);
        this.zonaHabitable = Fisica.zonaHabitable(est);
        this.mareaRel = Fisica.mareaRelativa(this.params.hasMoon, est.M, d);
        this.radioMagnetopausa = Fisica.radioMagnetopausa(
            this.params.magneticField, Fisica.presionVientoEstelar_Pa(d, this.params.solarActivity));
        this.latitudAuroral = Fisica.latitudAuroral_grados(this.radioMagnetopausa);
    }

    setObliquity(degrees) { this.params.obliquityDeg = Math.max(0, Math.min(90, degrees)); }
    setEccentricity(e) { this.params.eccentricity = Math.max(0, Math.min(0.07, e)); }
    setPerihelion(deg) { this.params.perihelionDeg = ((deg % 360) + 360) % 360; }
    setMoon(hasMoon) { this.params.hasMoon = hasMoon; this.recalcular(); }
    setDistanceFactor(f) { this.params.distanceFactor = f; this.recalcular(); }
    setMagneticField(strength) { this.params.magneticField = Math.max(0, Math.min(3, strength)); this.recalcular(); }

    setStarType(type) {
        if (!Fisica.ESTRELLAS[type]) return;
        this.params.starType = type;
        this.recalcular();
        // Color del cielo derivado del espectro de la estrella (Rayleigh ∝ λ⁻⁴)
        this.simulation.skyColor = Fisica.colorCielo(this.estrella.Teff);
        if (this.simulation.target.hasLife) this.simulation.target.atmosphereColor = [...this.simulation.skyColor];
    }

    // Insolación media diaria en W/m² para la latitud y el día actuales (Berger 1978)
    getSeasonalInsolation(latDeg) {
        const r = Math.PI / 180, p = this.params;
        // simplificación: longitud solar ≈ movimiento medio desde el equinoccio de marzo (día 80)
        const lambda = ((p.dayOfYear - 80) / p.orbitalPeriodDays) * 2 * Math.PI;
        return Fisica.insolacionDiaria(Fisica.C.S0 * this.insolacionRel, latDeg * r, lambda,
            this.oblicuidadEfectiva() * r, p.eccentricity, p.perihelionDeg * r);
    }

    // El anclaje por marea erosiona la oblicuidad hasta ~0° (Heller, Leconte & Barnes 2011, A&A 528).
    oblicuidadEfectiva() { return this.params.isTidallyLocked ? 0 : this.params.obliquityDeg; }

    update(dt) {
        // Escala visual acelerada: 1 s = 15 días de órbita (el año real dura 365,25 días).
        if (!this.params.isTidallyLocked) {
            this.params.dayOfYear = (this.params.dayOfYear + dt * 15) % this.params.orbitalPeriodDays;
        }

        // Sin Luna: deriva caótica 0°–85° (Laskar et al. 1993) que en la realidad tarda millones de años.
        // Escala visual acelerada: 1 s = 1 Ma.
        // simplificación: la deriva se representa con senos superpuestos, no con integración secular.
        if (!this.params.hasMoon) {
            this.chaoticTiltMa += dt;
            const t = this.chaoticTiltMa;
            const ruido = Math.sin(t * 0.7) * Math.cos(t * 0.3) * 0.7 + Math.sin(t * 1.9) * 0.3;
            const { min, max } = Fisica.OBLICUIDAD_CAOS;
            this.params.obliquityDeg = (min + max) / 2 + ruido * (max - min) / 2;
        }

        // Aurora: proporcional al campo (partículas atrapadas) y modulada por la actividad solar
        this.auroraIntensity = Math.min(1.5, this.params.magneticField) *
            this.params.solarActivity * (0.7 + 0.3 * Math.sin(Date.now() * 0.003));
    }
}

window.AstrophysicsEngine = AstrophysicsEngine;
