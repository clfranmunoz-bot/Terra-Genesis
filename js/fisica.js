/**
 * Física pura de Terra-Genesis: funciones sin DOM ni Three.js, para que
 * el navegador y las pruebas de Node (tests/validacion.js) usen el mismo código.
 * Unidades SI salvo que se indique lo contrario.
 */
(function (raiz) {
'use strict';

// ============================================================
// CONSTANTES
// ============================================================
const C = {
    SIGMA: 5.670374419e-8,   // W m⁻² K⁻⁴ — Stefan-Boltzmann (CODATA 2018)
    G: 6.674e-11,            // m³ kg⁻¹ s⁻² — gravitación (CODATA 2018)
    MU0: 1.25663706e-6,      // H/m — permeabilidad del vacío
    S0: 1361,                // W/m² — constante solar a 1 UA (Kopp & Lean 2011)
    UA: 1.495978707e11,      // m
    M_SOL: 1.989e30,         // kg
    M_TIERRA: 5.972e24,      // kg
    R_TIERRA: 6.371e6,       // m
    G_TIERRA: 9.81,          // m/s²
    B_TIERRA: 3.1e-5,        // T — campo dipolar ecuatorial en superficie (IGRF-13, Alken 2021)
    ANIO: 3.156e7,           // s
    MT_TNT: 4.184e15         // J por megatón de TNT
};

// ============================================================
// FASE 2 — ASTROFÍSICA Y ÓRBITA
// ============================================================

// Estrellas huésped. L en L☉, Teff en K, M en M☉, edad en Ga.
// Fuentes: Sol — Prša et al. 2016 (IAU B3); K5V — Pecaut & Mamajek 2013 (tabla de secuencia principal);
// Próxima Centauri (M5.5V) — Boyajian et al. 2012, Ribas 2017, edad 4,85 Ga (Thévenin 2002);
// Rigel (B8 Ia) — Przybilla et al. 2006/2010: L ≈ 1,2×10⁵ L☉, Teff ≈ 12.100 K, M ≈ 21 M☉, edad ≈ 8 Ma.
const ESTRELLAS = {
    sun_g2v:        { nombre: 'Sol (G2V)',                 L: 1.0,     Teff: 5772,  M: 1.0,   edadGa: 4.57 },
    orange_dwarf_k: { nombre: 'Enana naranja K5V',         L: 0.16,    Teff: 4440,  M: 0.70,  edadGa: 4.5 },
    red_dwarf_m:    { nombre: 'Próxima Centauri (M5.5V)',  L: 0.00155, Teff: 3042,  M: 0.122, edadGa: 4.85 },
    blue_giant:     { nombre: 'Rigel (supergigante B8 Ia)', L: 1.2e5,  Teff: 12100, M: 21.0,  edadGa: 0.008 }
};

// Insolación en el tope de la atmósfera: S = L / (4π d²).
// Expresada relativa a la Tierra: S/S⊕ = (L/L☉) / (d/UA)²  [adimensional]; ×1361 → W/m².
function insolacion(L_sol, d_UA) { return L_sol / (d_UA * d_UA); }

// Distancia a la que el planeta recibe la misma insolación que la Tierra: d = √(L/L☉) UA.
function distanciaEquivalente(L_sol) { return Math.sqrt(L_sol); }

// Pico de Wien (energía): λ_max = 2,898×10⁻³ m·K / T  → µm.
// Pico en flujo de fotones: λ_p = 3,670×10⁻³ m·K / T (Kiang et al. 2007a, relevante para fotosíntesis).
function picoWien_um(Teff) { return 2898 / Teff; }
function picoFotones_um(Teff) { return 3670 / Teff; }

// Zona habitable: S_eff = S☉ + a·T* + b·T*² + c·T*³ + d·T*⁴, con T* = Teff − 5780 K; d = √(L/S_eff) UA.
// Coeficientes: Kopparapu et al. 2014 (ApJL 787, L29), planeta de 1 M⊕; "invernadero húmedo" de Kopparapu et al. 2013 (ApJ 765, 131).
// Válido para 2600 K ≤ Teff ≤ 7200 K; fuera de ese rango se evalúa en el borde (simplificación: Rigel queda fuera del modelo).
const KOPPARAPU = {
    venusReciente:      [1.776,  2.136e-4, 2.533e-8, -1.332e-11, -3.097e-15],
    desbocado:          [1.107,  1.332e-4, 1.580e-8, -8.308e-12, -1.931e-15],
    humedo:             [1.0146, 8.1884e-5, 1.9394e-9, -4.3618e-12, -6.8260e-16],
    maximoInvernadero:  [0.356,  6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16],
    marteTemprano:      [0.320,  5.547e-5, 1.526e-9, -2.874e-12, -5.011e-16]
};
function sEff(limite, Teff) {
    const [s, a, b, c, d] = KOPPARAPU[limite];
    const t = Math.max(2600, Math.min(7200, Teff)) - 5780;
    return s + a * t + b * t * t + c * t ** 3 + d * t ** 4;
}
function zonaHabitable(estrella) {
    const d = (lim) => Math.sqrt(estrella.L / sEff(lim, estrella.Teff));
    return {
        interiorConservador: d('desbocado'), exteriorConservador: d('maximoInvernadero'),
        interiorOptimista: d('venusReciente'), exteriorOptimista: d('marteTemprano'),
        humedo: d('humedo')
    };
}

// Insolación media diaria en la latitud φ (Berger 1978, J. Atmos. Sci. 35):
//   Q̄ = (S₀/π)·(1 + e·cos(λ−ϖ))² / (1−e²)² · [h₀ sinφ sinδ + cosφ cosδ sin h₀]   [W/m²]
//   sin δ = sin ε · sin λ   (declinación; λ = longitud solar verdadera desde el equinoccio de marzo)
//   cos h₀ = −tanφ tanδ    (ángulo horario de puesta de sol, acotado para noche/día polar)
// ϖ = longitud del perihelio medida desde el equinoccio (geocéntrica); hoy ≈ 282,9° (perihelio ~3 de enero).
function insolacionDiaria(S0, latRad, lambdaRad, oblicuidadRad, e, varpiRad) {
    const sinDelta = Math.sin(oblicuidadRad) * Math.sin(lambdaRad);
    const delta = Math.asin(sinDelta);
    const x = -Math.tan(latRad) * Math.tan(delta);
    const h0 = x >= 1 ? 0 : x <= -1 ? Math.PI : Math.acos(x);
    const factorDist = Math.pow(1 + e * Math.cos(lambdaRad - varpiRad), 2) / Math.pow(1 - e * e, 2);
    return (S0 / Math.PI) * factorDist *
        (h0 * Math.sin(latRad) * sinDelta + Math.cos(latRad) * Math.cos(delta) * Math.sin(h0));
}

// Media anual por latitud: integra en el tiempo, no en la longitud solar (dt ∝ r² dλ, 2.ª ley de Kepler).
function insolacionAnual(S0, latRad, oblicuidadRad, e, varpiRad, pasos = 72) {
    let suma = 0, pesos = 0;
    for (let i = 0; i < pasos; i++) {
        const lam = (i + 0.5) / pasos * 2 * Math.PI;
        const w = Math.pow(1 + e * Math.cos(lam - varpiRad), -2); // ∝ r²
        suma += insolacionDiaria(S0, latRad, lam, oblicuidadRad, e, varpiRad) * w;
        pesos += w;
    }
    return suma / pesos;
}

// Tiempo de anclaje por marea (Gladman et al. 1996, Icarus 122; Peale 1977):
//   t_lock = ω a⁶ I Q / (3 G M★² k₂ R⁵)   [s]
// ω: rotación inicial (rad/s), a: semieje (m), I = 0,33 M_p R² (Tierra), Q = 100, k₂ = 0,3.
// simplificación: Q y k₂ constantes y rotación inicial de 24 h; la incertidumbre real es de ~1–2 órdenes de magnitud.
function tiempoAnclajeMarea_anios(M_sol, d_UA, periodoRotacion_h = 24) {
    const omega = 2 * Math.PI / (periodoRotacion_h * 3600);
    const a = d_UA * C.UA;
    const I = 0.33 * C.M_TIERRA * C.R_TIERRA ** 2;
    const Q = 100, k2 = 0.3;
    const t = omega * a ** 6 * I * Q / (3 * C.G * (M_sol * C.M_SOL) ** 2 * k2 * C.R_TIERRA ** 5);
    return t / C.ANIO;
}
function estaAnclado(estrella, d_UA) {
    return tiempoAnclajeMarea_anios(estrella.M, d_UA) < estrella.edadGa * 1e9;
}

// Marea relativa: la aceleración de marea escala como M/d³ (Newton). Luna/Sol hoy ≈ 2,2.
// Devuelve la amplitud total relativa a la Tierra actual (Luna + Sol = 1).
function mareaRelativa(conLuna, M_sol, d_UA) {
    const marea = (M, d) => M / (d * d * d);
    const solHoy = marea(C.M_SOL, C.UA), lunaHoy = marea(7.342e22, 3.844e8);
    const sol = marea(M_sol * C.M_SOL, d_UA * C.UA);
    return ((conLuna ? lunaHoy : 0) + sol) / (lunaHoy + solHoy);
}

// Oblicuidad: con Luna varía 22,1°–24,5° en 41 ka (Laskar et al. 1993, Nature 361);
// sin Luna la zona caótica abarca 0°–85° en escalas de 10⁶–10⁷ años (Laskar, Joutel & Robutel 1993),
// aunque Lissauer et al. 2012 (Icarus 217) hallan variaciones de solo ±10°–20° en 500 Ma.
const OBLICUIDAD_CAOS = { min: 0, max: 85, escalaAnios: 5e6 };

// Magnetopausa por equilibrio de presión (Chapman & Ferraro 1931):
//   B²(r)/2μ₀ con compresión ×2  =  ρv²   →   r_mp/R = (2 B₀² / (μ₀ ρ v²))^(1/6)
// Viento solar a 1 UA: n = 5 cm⁻³, v = 400 km/s → ρv² ≈ 1,3 nPa (OMNI, King & Papitashvili 2005). Resultado ≈ 10 R⊕ (Shue et al. 1998: ~10–11).
// simplificación: la presión del viento escala con 1/d² y con la actividad; se ignora que las enanas M tienen vientos más densos (Vidotto 2013).
function presionVientoEstelar_Pa(d_UA, actividad = 1) {
    const rho = 5e6 * 1.6726e-27, v = 4e5;
    return rho * v * v * actividad / (d_UA * d_UA);
}
function radioMagnetopausa(B_rel, pDin_Pa) {
    if (B_rel <= 0) return 1;
    const B0 = C.B_TIERRA * B_rel;
    return Math.max(1, Math.pow(2 * B0 * B0 / (C.MU0 * pDin_Pa), 1 / 6));
}
// Óvalo auroral: la línea de campo dipolar que llega a r_mp toca el suelo en la latitud
// invariante Λ con cos²Λ = 1/L (L ≈ r_mp/R).  Tierra: Λ ≈ 71° (óvalo observado 65°–75°; Feldstein 1963).
// simplificación: dipolo centrado y alineado con el eje de rotación.
function latitudAuroral_grados(rMp) {
    return Math.acos(Math.sqrt(1 / Math.max(1, rMp))) * 180 / Math.PI;
}

// Vida en la secuencia principal: t ≈ 10 Ga · (M/M☉)^−2,5 (Kippenhahn & Weigert 1990). Rigel ya la abandonó.
// La abiogénesis tardó ≥ 0,3–0,8 Ga en la Tierra (primeras evidencias ~3,7–4,1 Ga; Bell et al. 2015, Dodd et al. 2017).
const EDAD_MINIMA_VIDA_GA = 0.5;
function estrellaPermiteVida(estrella) { return estrella.edadGa >= EDAD_MINIMA_VIDA_GA; }

// Color del cielo por dispersión de Rayleigh (∝ λ⁻⁴) de la luz de una estrella de cuerpo negro:
// I(λ) ∝ B_λ(Teff) · λ⁻⁴, evaluado en R = 610, G = 550, B = 465 nm y normalizado. (Bohren & Clementi 2006)
// simplificación: cuerpo negro puro y dispersión simple; sin absorción ni dispersión de Mie.
function colorCielo(Teff) {
    const planck = (lam) => 1 / (Math.pow(lam, 5) * (Math.exp(1.4388e-2 / (lam * Teff)) - 1));
    const rgb = [610e-9, 550e-9, 465e-9].map((l) => planck(l) * Math.pow(l, -4));
    const max = Math.max(...rgb);
    return rgb.map((v) => v / max);
}

const Fisica = {
    C, ESTRELLAS, KOPPARAPU, OBLICUIDAD_CAOS, EDAD_MINIMA_VIDA_GA,
    insolacion, distanciaEquivalente, picoWien_um, picoFotones_um, sEff, zonaHabitable,
    insolacionDiaria, insolacionAnual, tiempoAnclajeMarea_anios, estaAnclado, mareaRelativa,
    presionVientoEstelar_Pa, radioMagnetopausa, latitudAuroral_grados, estrellaPermiteVida, colorCielo
};

if (typeof module !== 'undefined' && module.exports) module.exports = Fisica;
raiz.Fisica = Fisica;
})(typeof window !== 'undefined' ? window : globalThis);
