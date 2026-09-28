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

// ============================================================
// FASE 3 — CLIMA Y ATMÓSFERA
// ============================================================

// Concentraciones preindustriales (1750), IPCC AR6 WG1 cap. 2: CO₂ 278 ppm, CH₄ 722 ppb, N₂O 270 ppb.
const PREINDUSTRIAL = { co2: 278, ch4: 0.722, n2o: 0.270 };

// Forzamiento radiativo de gases de efecto invernadero (Myhre et al. 1998, GRL 25; IPCC TAR tabla 6.2) [W/m²]
//   CO₂:  ΔF = 5,35 · ln(C/C₀)                                    C en ppm
//   CH₄:  ΔF = 0,036 · (√M − √M₀) − [f(M,N₀) − f(M₀,N₀)]           M, N en ppb
//   N₂O:  ΔF = 0,12  · (√N − √N₀) − [f(M₀,N) − f(M₀,N₀)]
//   f(M,N) = 0,47 · ln[1 + 2,01×10⁻⁵ (MN)^0,75 + 5,31×10⁻¹⁵ M (MN)^1,52]   (solapamiento de bandas CH₄–N₂O)
// simplificación: por encima de ~2000 ppm de CO₂ la fórmula logarítmica subestima el forzamiento (Byrne & Goldblatt 2014).
function solape(M, N) { return 0.47 * Math.log(1 + 2.01e-5 * Math.pow(M * N, 0.75) + 5.31e-15 * M * Math.pow(M * N, 1.52)); }
function forzamientoCO2(co2_ppm) { return 5.35 * Math.log(Math.max(1, co2_ppm) / PREINDUSTRIAL.co2); }
function forzamientoCH4(ch4_ppm, n2o_ppm = PREINDUSTRIAL.n2o) {
    const M = ch4_ppm * 1000, M0 = PREINDUSTRIAL.ch4 * 1000, N0 = n2o_ppm * 1000;
    return 0.036 * (Math.sqrt(M) - Math.sqrt(M0)) - (solape(M, N0) - solape(M0, N0));
}
function forzamientoN2O(n2o_ppm, ch4_ppm = PREINDUSTRIAL.ch4) {
    const N = n2o_ppm * 1000, N0 = PREINDUSTRIAL.n2o * 1000, M0 = ch4_ppm * 1000;
    return 0.12 * (Math.sqrt(N) - Math.sqrt(N0)) - (solape(M0, N) - solape(M0, N0));
}

// Aerosoles de sulfato estratosférico a partir de la carga de SO₂ (Mt):
//   τ = 0,0075·M  (Pinatubo 1991: ~20 Mt SO₂ → τ₅₅₀ ≈ 0,15; Sato et al. 1993)
//   por encima de 20 Mt las partículas coagulan y τ crece como M^(2/3) (Pinto, Turco & Toon 1989)
//   ΔF ≈ −25·τ W/m² para τ pequeño (Hansen et al. 2005, JGR 110), saturando en la radiación solar absorbida:
//   ΔF = −ASR · (1 − e^(−25τ/ASR)),  ASR ≈ 240 W/m²
function profundidadOpticaSulfato(so2_Mt) {
    const m = Math.max(0, so2_Mt);
    return m <= 20 ? 0.0075 * m : 0.15 * Math.pow(m / 20, 2 / 3);
}
function forzamientoAerosol(tau) { const ASR = 240; return -ASR * (1 - Math.exp(-25 * tau / ASR)); }

// Nubes: efecto radiativo neto actual ≈ −20 W/m² con una cobertura de ~67 % (CERES EBAF; Loeb et al. 2018).
// simplificación: forzamiento lineal respecto a la cobertura del control visual (0,75 = hoy), −27 W/m² por unidad de fracción.
function forzamientoNubes(fraccion) { return -27 * (fraccion - 0.75); }

// Presión de vapor de saturación (Clausius-Clapeyron, aproximación de Magnus; Alduchov & Eskridge 1996):
//   e_s = 6,1094 · exp(17,625·T / (T + 243,04))  [hPa, T en °C]  → ~7 %/K cerca de 15 °C.
function presionVaporSaturacion_hPa(T) { return 6.1094 * Math.exp(17.625 * T / (T + 243.04)); }
// Punto de ebullición del agua a presión P (Clausius-Clapeyron integrada, L = 40,65 kJ/mol): [°C]
function puntoEbullicion_C(P_bar) {
    return 1 / (1 / 373.15 - 8.314 * Math.log(Math.max(1e-4, P_bar) / 1.01325) / 40650) - 273.15;
}

// Espesor óptico de Rayleigh (Bodhaine et al. 1999, J. Atmos. Ocean. Tech. 16) [adimensional, λ en µm]
//   τ_R(λ) ≈ 0,00864 · λ^−(3,916 + 0,074λ + 0,050/λ) · P/1,01325 bar;  τ(550 nm) ≈ 0,097
// El CO₂ dispersa ~2,5 veces más que el N₂ (Sneep & Ubachs 2005).
function espesorRayleigh(lambda_um, P_bar, co2_ppm = 420) {
    const composicion = 1 + 1.5 * co2_ppm * 1e-6;
    return 0.00864 * Math.pow(lambda_um, -(3.916 + 0.074 * lambda_um + 0.050 / lambda_um)) * (P_bar / 1.01325) * composicion;
}

// Temperatura de equilibrio radiativo: T_eq = [S(1−A) / 4σ]^¼  [K]. Tierra: S=1361, A=0,30 → 255 K.
function temperaturaEquilibrio(S_Wm2, albedo) { return Math.pow(S_Wm2 * (1 - albedo) / (4 * C.SIGMA), 0.25); }

// ---- Modelo de balance energético latitudinal (Budyko 1969; Sellers 1969; North, Cahalan & Coakley 1981, Rev. Geophys. 19)
//   C ∂T/∂t = Q(x)(1 − α(T,x)) − (A + B·T) + F + ∂/∂x[ D (1−x²) ∂T/∂x ],   x = sen(latitud)
// B = 1,40 W m⁻² K⁻¹: Planck (3,22) − vapor de agua + gradiente vertical (1,30) − nubes (0,42) = 1,50 (IPCC AR6 WG1 tabla 7.10),
//   menos 0,10 por la nieve continental que el modelo no resuelve (el AR6 da 0,35 para todo el albedo superficial).
//   El vapor de agua crece ~7 %/K (Clausius-Clapeyron) y su absorción es ∝ ln(q), por eso su retroalimentación es ~constante en W/m²/K.
// α: hielo (T < −10 °C, criterio de Budyko) = 0,62; sin hielo, 0,26 + 0,10·x² (ángulo cenital y nubes subpolares).
// C = 2,1×10⁸ J m⁻² K⁻¹ (capa de mezcla oceánica de ~70 m × 70 % de océano; Hartmann 2016).
// A se calibra para que la Tierra actual dé 15 °C (ver tests/validacion.js).
// simplificación: sin estaciones (insolación media anual), sin océano profundo, sin tierra/mar ni dinámica;
//   las nubes y el vapor de agua van como retroalimentaciones globales. La histéresis de bola de nieve sí emerge del modelo.
const EBM = { N: 18, A: 218.85, B: 1.40, D: 0.55, CALOR: 2.1e8, T_HIELO: -10, ALB_HIELO: 0.62 };
const EBM_X = Array.from({ length: EBM.N }, (_, i) => -1 + (i + 0.5) * 2 / EBM.N);

function albedoBanda(T, x) {
    const libre = 0.26 + 0.10 * x * x;
    const hielo = 0.5 * (1 - Math.tanh((T - EBM.T_HIELO) / 2)); // transición suave de ±2 K para estabilidad numérica
    return libre + (EBM.ALB_HIELO - libre) * hielo;
}
function insolacionBandas(S_Wm2, oblicuidadDeg, e, varpiDeg) {
    const r = Math.PI / 180;
    return EBM_X.map((x) => insolacionAnual(S_Wm2, Math.asin(x), oblicuidadDeg * r, e, varpiDeg * r, 48));
}
function perfilInicial(Tmedia) { return EBM_X.map((x) => Tmedia - 45 * (x * x - 1 / 3)); }

// Avanza el modelo `anios` años con pasos explícitos de 5 días. Q: insolación por banda; F: forzamiento total.
function pasoEBM(T, Q, F, anios) {
    const dx = 2 / EBM.N, dt = 5 * 86400;
    const pasos = Math.max(1, Math.round(anios * C.ANIO / dt));
    const flujo = new Array(EBM.N + 1).fill(0);
    for (let p = 0; p < pasos; p++) {
        for (let i = 1; i < EBM.N; i++) {
            const xb = -1 + i * dx;
            flujo[i] = EBM.D * (1 - xb * xb) * (T[i] - T[i - 1]) / dx;
        }
        for (let i = 0; i < EBM.N; i++) {
            const neto = Q[i] * (1 - albedoBanda(T[i], EBM_X[i])) - (EBM.A + EBM.B * T[i]) + F + (flujo[i + 1] - flujo[i]) / dx;
            T[i] += dt * neto / EBM.CALOR;
        }
    }
    return T;
}
function diagnosticoEBM(T, Q) {
    let t = 0, q = 0, qa = 0, hielo = 0;
    for (let i = 0; i < EBM.N; i++) {
        const a = albedoBanda(T[i], EBM_X[i]);
        t += T[i]; q += Q[i]; qa += Q[i] * a;
        hielo += 0.5 * (1 - Math.tanh((T[i] - EBM.T_HIELO) / 2));
    }
    return { Tmedia: t / EBM.N, albedo: qa / q, hielo: hielo / EBM.N, Qmedia: q / EBM.N,
             Tecuador: (T[EBM.N / 2 - 1] + T[EBM.N / 2]) / 2, Tpolo: (T[0] + T[EBM.N - 1]) / 2 };
}

// Forzamiento total respecto al preindustrial (W/m²)
function forzamientoTotal(g) {
    return forzamientoCO2(g.co2) + forzamientoCH4(g.ch4, g.n2o) + forzamientoN2O(g.n2o, g.ch4) +
        forzamientoAerosol(profundidadOpticaSulfato(g.so2) + (g.tauImpacto || 0)) + forzamientoNubes(g.nubes);
}

// Estado del invernadero según la insolación (Kopparapu 2013/2014; Leconte et al. 2013 con GCM: desbocado ~1,1 S⊕)
function estadoInvernadero(S_rel, Teff) {
    if (S_rel >= sEff('desbocado', Teff)) return 'desbocado';
    if (S_rel >= sEff('humedo', Teff)) return 'humedo';
    return 'normal';
}
// Tras un invernadero desbocado los océanos pasan a la atmósfera y la superficie supera ~1400 K (Goldblatt et al. 2013, Nat. Geosci. 6).
const T_DESBOCADO_C = 1127;

// Equilibrio completo (para pruebas y para el Estudio de escenarios)
function climaEquilibrio(g, orbita, Tinicial = 15, anios = 300) {
    const Q = insolacionBandas(C.S0 * orbita.S_rel, orbita.oblicuidad, orbita.e, orbita.varpi);
    const T = pasoEBM(perfilInicial(Tinicial), Q, forzamientoTotal(g), anios);
    return diagnosticoEBM(T, Q);
}

// ============================================================
// FASE 4 — GEOLOGÍA Y GEOQUÍMICA
// ============================================================

// Termostato carbono-silicato (Walker, Hays & Kasting 1981, JGR 86; Berner 2004, "The Phanerozoic Carbon Cycle"):
//   W = W₀ · (C/C₀)^β · exp((T − T₀)/Tₑ) · f_orogenia        β = 0,3; Tₑ = 13,7 K   [Gt CO₂/año]
//   V = V₀ · f_volcanismo;   V₀ = W₀ = 0,26 Gt CO₂/año (desgasificación volcánica actual; Gerlach 2011, Eos 92)
//   d ln C / dt = (V − W) / R_ef
// R_ef = 6×10⁴ Gt CO₂ reproduce la relajación e-folding de ~400 ka (Archer 2005, JGR 110; Colbourn et al. 2015)
//   = W₀ · [β + (ECS/ln2)/Tₑ] · 4×10⁵ a; es del orden del carbono inorgánico océano-atmósfera tamponado por la química de carbonatos.
// Referencia (equilibrio preindustrial): C₀ = 280 ppm, T₀ = 14 °C.
// simplificación: sin meteorización de carbonatos ni enterramiento de carbono orgánico ni retroalimentación de la vegetación (GEOCARB sí los incluye).
const CARBONO = { V0: 0.26, BETA: 0.3, TE: 13.7, C0: 280, T0: 14, R_EF: 6.0e4, TAU_ANIOS: 4e5 };
function meteorizacion_GtAnio(co2, T, orogenia = 1) {
    return CARBONO.V0 * Math.pow(Math.max(1, co2) / CARBONO.C0, CARBONO.BETA) * Math.exp((T - CARBONO.T0) / CARBONO.TE) * orogenia;
}
function desgasificacion_GtAnio(volcanismo = 1) { return CARBONO.V0 * volcanismo; }
function pasoCarbono(co2, T, volcanismo, orogenia, anios) {
    const neto = desgasificacion_GtAnio(volcanismo) - meteorizacion_GtAnio(co2, T, orogenia);
    // ponytail: Euler explícito; estable mientras anios ≪ 4×10⁵ (se usan ≤ 5×10⁴ por paso)
    return co2 * Math.exp(neto * anios / CARBONO.R_EF);
}

// Nivel del mar por el hielo continental (m, respecto a hoy):
//   Fusión total: +65,7 m (Antártida 58,3 + Groenlandia 7,4; Fretwell et al. 2013; Morlighem et al. 2017; IPCC AR6 cap. 9).
//   Último Máximo Glacial: −125 m (Clark et al. 2009) con −6 K de temperatura global (Tierney et al. 2020).
// simplificación: relación de equilibrio lineal por tramos; la respuesta real tarda milenios (Levermann et al. 2013: 2,3 m/K en 2000 años).
//   La desglaciación completa se sitúa en +8 K (Antártida pierde el hielo con ~2–4×CO₂; DeConto & Pollard 2003).
//   Por debajo del UMG (bola de nieve) no hay una estimación robusta y se acota a −130 m.
const HIELO_TOTAL_M = 65.7;
function nivelMarPorHielo_m(T) {
    if (T >= 15) return HIELO_TOTAL_M * Math.min(1, (T - 15) / 8);
    return Math.max(-130, (T - 15) * (125 / 6));
}
// Eustasia tectónica (volumen de las dorsales y de las cuencas): ±250 m en el Fanerozoico (Haq et al. 1987; Müller et al. 2008, Science 319).
const EUSTASIA_MAX_M = 250;
function nivelMarFisicamentePosible(offsetTectonico_m) { return Math.abs(offsetTectonico_m) <= EUSTASIA_MAX_M; }

// Grandes provincias ígneas (valores de referencia)
const PROVINCIAS_IGNEAS = {
    // Burgess & Bowring 2015 (Sci. Adv. 1); Svensen et al. 2009 (EPSL 277); Black et al. 2012 (Geology 40)
    siberianas: { edadMa: 252, volumen_km3: 4e6, duracionMa: 1, co2_Gt: [3e4, 1e5], azufre_Gt: [6300, 7800] },
    // Schoene et al. 2019 (Science 363); Sprain et al. 2019
    deccan:     { edadMa: 66,  volumen_km3: 1.3e6, duracionMa: 0.7, co2_Gt: [1e4, 4e4], azufre_Gt: [3000, 6000] }
};

// Luminosidad solar en el tiempo (Gough 1981, Solar Physics 74): L(t)/L☉ = 1 / [1 + 0,4 (1 − t/t☉)], t☉ = 4,57 Ga.
function luminosidadSolar(Ma) { const t = 4.57 + Ma / 1000; return 1 / (1 + 0.4 * (1 - t / 4.57)); }

const Fisica = {
    C, ESTRELLAS, KOPPARAPU, OBLICUIDAD_CAOS, EDAD_MINIMA_VIDA_GA, PREINDUSTRIAL, EBM, T_DESBOCADO_C,
    CARBONO, HIELO_TOTAL_M, EUSTASIA_MAX_M, PROVINCIAS_IGNEAS,
    meteorizacion_GtAnio, desgasificacion_GtAnio, pasoCarbono, nivelMarPorHielo_m, nivelMarFisicamentePosible, luminosidadSolar,
    insolacion, distanciaEquivalente, picoWien_um, picoFotones_um, sEff, zonaHabitable,
    insolacionDiaria, insolacionAnual, tiempoAnclajeMarea_anios, estaAnclado, mareaRelativa,
    presionVientoEstelar_Pa, radioMagnetopausa, latitudAuroral_grados, estrellaPermiteVida, colorCielo,
    forzamientoCO2, forzamientoCH4, forzamientoN2O, profundidadOpticaSulfato, forzamientoAerosol, forzamientoNubes,
    forzamientoTotal, presionVaporSaturacion_hPa, puntoEbullicion_C, espesorRayleigh, temperaturaEquilibrio,
    insolacionBandas, perfilInicial, pasoEBM, diagnosticoEBM, estadoInvernadero, climaEquilibrio
};

if (typeof module !== 'undefined' && module.exports) module.exports = Fisica;
raiz.Fisica = Fisica;
})(typeof window !== 'undefined' ? window : globalThis);
