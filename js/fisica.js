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

// Forzamiento radiativo de CO₂, CH₄ y N₂O: expresiones de Meinshausen et al. 2020 (GMD 13, tabla 3), ajustadas al modelo
// línea a línea de Oslo y adoptadas por el IPCC AR6 (WG1, tabla 7.SM.1). C en ppm, M y N en ppb. [W/m²]
//   CO₂: RF = (α′ + c₁√N)·ln(C/C₀),  α′ = d₁ + a₁(C−C₀)² + b₁(C−C₀) entre C₀ y C_αmax = C₀ − b₁/2a₁ ≈ 1808 ppm; constante fuera de ese rango
//   N₂O: RF = (a₂√C + b₂√N + c₂√M + d₂)(√N − √N₀)
//   CH₄: RF = (a₃√M + b₃√N + d₃)(√M − √M₀)       (incluye la absorción de onda corta del CH₄; Etminan et al. 2016)
// Forzamiento efectivo (ERF) = RF × ajustes troposféricos del AR6 (sección 7.3.2; Smith et al. 2018): CO₂ +5 %, CH₄ −14 %, N₂O +7 %.
// Por encima de C_αmax la fórmula vuelve a ser logarítmica y subestima el forzamiento: Byrne & Goldblatt 2014 (GRL 41) obtienen
//   38,1 W/m² a 50.000 ppm. Se añade k·ln²(C/C_αmax), con k ajustado a ese único valor.
// ponytail: corrección de un solo punto; con los coeficientes de Byrne & Goldblatt se podría seguir la curva completa.
// Las concentraciones son fracciones molares a 1 bar; con otra presión se usa la columna equivalente (C·P).
const MEINSHAUSEN = { a1: -2.4785e-7, b1: 7.5906e-4, c1: -2.1492e-3, d1: 5.2488, C0: 277.15,
                      a2: -3.4197e-4, b2: 2.5455e-4, c2: -2.4357e-4, d2: 0.12173, N0: 273.87,
                      a3: -8.9603e-5, b3: -1.2462e-4, d3: 0.045194, M0: 731.41, K_ALTO: 0.727 };
function rfCO2(C, N) {
    const m = MEINSHAUSEN, Cmax = m.C0 - m.b1 / (2 * m.a1);
    const Cc = Math.max(1, C);
    const alfa = Cc < m.C0 ? m.d1 : Cc < Cmax ? m.d1 + m.a1 * (Cc - m.C0) ** 2 + m.b1 * (Cc - m.C0) : m.d1 - m.b1 * m.b1 / (4 * m.a1);
    const extra = Cc > Cmax ? m.K_ALTO * Math.log(Cc / Cmax) ** 2 : 0;
    return (alfa + m.c1 * Math.sqrt(N)) * Math.log(Cc / m.C0) + extra;
}
function rfN2O(C, M, N) { const m = MEINSHAUSEN; return (m.a2 * Math.sqrt(C) + m.b2 * Math.sqrt(N) + m.c2 * Math.sqrt(M) + m.d2) * (Math.sqrt(N) - Math.sqrt(m.N0)); }
function rfCH4(M, N) { const m = MEINSHAUSEN; return (m.a3 * Math.sqrt(M) + m.b3 * Math.sqrt(N) + m.d3) * (Math.sqrt(M) - Math.sqrt(m.M0)); }
const P0 = PREINDUSTRIAL;
function forzamientoCO2(co2_ppm, n2o_ppm = P0.n2o) {
    const N = n2o_ppm * 1000;
    return 1.05 * (rfCO2(co2_ppm, N) - rfCO2(P0.co2, N));
}
function forzamientoCH4(ch4_ppm, n2o_ppm = P0.n2o) {
    const N = n2o_ppm * 1000;
    return 0.86 * (rfCH4(Math.max(0, ch4_ppm) * 1000, N) - rfCH4(P0.ch4 * 1000, N));
}
function forzamientoN2O(n2o_ppm, ch4_ppm = P0.ch4, co2_ppm = P0.co2) {
    const M = ch4_ppm * 1000, C = co2_ppm;
    return 1.07 * (rfN2O(C, M, Math.max(0, n2o_ppm) * 1000) - rfN2O(C, M, P0.n2o * 1000));
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

// ---- Modelo de balance energético latitudinal ESTACIONAL con columnas de tierra y de océano
//   (Budyko 1969; Sellers 1969; North & Coakley 1979, J. Atmos. Sci. 36; North, Cahalan & Coakley 1981, Rev. Geophys. 19)
//   Por banda de latitud (x = sen φ), dos columnas con su propia temperatura:
//     C_L ∂T_L/∂t = Q(x,t)(1 − α_L) − (A + B·T_L) + F + ∇·(D∇T̄) − ν(1 − f)(T_L − T_O)
//     C_O ∂T_O/∂t = Q(x,t)(1 − α_O) − (A + B·T_O) + F + ∇·(D∇T̄) + ν·f·(T_L − T_O) − γ(T_O − T_d)
//   T̄ = f·T_L + (1−f)·T_O es la media de la banda (f = fracción de tierra); ∇·(D∇T̄) = ∂/∂x[D(1−x²)∂T̄/∂x] es el transporte atmosférico.
//   El intercambio ν entre las columnas conserva la energía de la banda.
// B = 1,40 W m⁻² K⁻¹: Planck (3,22) − vapor de agua + gradiente vertical (1,30) − nubes (0,42) = 1,50 (IPCC AR6 WG1 tabla 7.10),
//   menos 0,10 por el resto de las retroalimentaciones que el modelo no resuelve.
// C_O = 2,9×10⁸ J m⁻² K⁻¹: capa de mezcla de 70 m (Hartmann 2016). C_L = 1,0×10⁷: columna de aire (~10⁴ kg/m² × 1004 J/kg/K) más el suelo activo.
// ν = 6 W m⁻² K⁻¹: intercambio de aire entre tierra y mar de la misma banda (calibrado con la amplitud estacional zonal observada: ~25–30 K a 60 °N).
// α: hielo o nieve cuando la columna baja de −10 °C (criterio de Budyko, transición suave de ±2 K): 0,62. Sin hielo, 0,26 + 0,10·x²
//   (ángulo cenital y nubes subpolares). Es el albedo planetario (con nubes), no el de la superficie.
// Océano profundo (modelo de dos capas; Held et al. 2010, J. Climate 23; Geoffroy et al. 2013), por unidad de área oceánica:
//   C_d dT_d/dt = γ (T_O − T_d),  C_d = 4,6×10⁹ J m⁻² K⁻¹, γ = 1,0 W m⁻² K⁻¹ (los 3,2×10⁹ y 0,7 del modelo global repartidos en el 70 % de océano).
//   Si la superficie queda más fría que el fondo la columna es inestable y se mezcla por convección: γ = 10
//   (calibrado para reproducir el enfriamiento de Chicxulub; Brugger et al. 2017). No altera el equilibrio, solo la respuesta transitoria.
// D = 0,55 W m⁻² K⁻¹ para la Tierra; escala con la presión y con el cuadrado del período de rotación (Williams & Kasting 1997, Icarus 129):
//   una atmósfera más densa transporta más calor y una rotación rápida lo frena (el efecto Coriolis confina los remolinos).
// Fracción de tierra por banda: de la máscara de agua actual (textures/earth_specular.jpg), ponderada por el área.
// Calendario: 73 intervalos de 5 días desde el equinoccio de marzo; la longitud solar sale de la ecuación de Kepler.
// A se calibra para que la Tierra actual dé 15 °C (ver tests/validacion.js).
// simplificación: sin circulación oceánica ni océano profundo en el equilibrio; las nubes y el vapor de agua son retroalimentaciones globales.
//   La fracción de tierra es la actual también en otras épocas. La histéresis de bola de nieve y las estaciones emergen del modelo.
const EBM = { N: 18, NS: 73, A: 219.91, B: 1.40, D: 0.55, C_OCEANO: 2.94e8, C_TIERRA: 1.0e7, NU: 6.0,
              C_PROFUNDO: 4.6e9, GAMMA: 1.0, GAMMA_CONV: 10, T_HIELO_MAR: -10, T_NIEVE: -10, ALB_HIELO: 0.62 };
const EBM_X = Array.from({ length: EBM.N }, (_, i) => -1 + (i + 0.5) * 2 / EBM.N);
const FRACCION_TIERRA = [0.438, 0.006, 0.028, 0.066, 0.195, 0.240, 0.228, 0.211, 0.236,
                         0.215, 0.236, 0.273, 0.351, 0.418, 0.429, 0.518, 0.578, 0.460];
const DIAS_ANIO = 365.25;

const fraccionHielo = (T, Tumbral) => 0.5 * (1 - Math.tanh((T - Tumbral) / 2));
function albedoColumna(T, x, esTierra) {
    const libre = 0.26 + 0.10 * x * x;
    return libre + (EBM.ALB_HIELO - libre) * fraccionHielo(T, esTierra ? EBM.T_NIEVE : EBM.T_HIELO_MAR);
}

// Longitud solar verdadera λ a los `dias` del equinoccio de marzo (ecuación de Kepler; ϖ en rad, desde el equinoccio).
function longitudSolar(dias, e, varpiRad) {
    const nu0 = -varpiRad;                                           // anomalía verdadera en el equinoccio (λ = 0)
    const E0 = 2 * Math.atan(Math.sqrt((1 - e) / (1 + e)) * Math.tan(nu0 / 2));
    const M = E0 - e * Math.sin(E0) + 2 * Math.PI * dias / DIAS_ANIO;
    let E = M;
    for (let k = 0; k < 6; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    return nu + varpiRad;
}
// Tabla de insolación media diaria [intervalo][banda] a lo largo del año (Berger 1978).
function insolacionEstacional(S_Wm2, oblicuidadDeg, e, varpiDeg) {
    const r = Math.PI / 180;
    return Array.from({ length: EBM.NS }, (_, k) => {
        const lam = longitudSolar((k + 0.5) * DIAS_ANIO / EBM.NS, e, varpiDeg * r);
        return EBM_X.map((x) => insolacionDiaria(S_Wm2, Math.asin(x), lam, oblicuidadDeg * r, e, varpiDeg * r));
    });
}
function perfilInicial(Tmedia) { return EBM_X.map((x) => Tmedia - 45 * (x * x - 1 / 3)); }

// Estado del modelo: temperaturas de las columnas, océano profundo opcional, día del año y climatología del último año
// (clim[intervalo] = {L, O} con las temperaturas al cerrar cada intervalo de 5 días).
function crearEstadoEBM(Tinicial = 15, conProfundo = false) {
    const p = perfilInicial(Tinicial);
    return { TL: [...p], TO: [...p], Td: conProfundo ? [...p] : null, dia: 0,
             clim: Array.from({ length: EBM.NS }, () => ({ L: [...p], O: [...p] })) };
}

// Avanza `anios` años. Q: tabla de insolacionEstacional; F: forzamiento total (W/m²);
// factorD: multiplicador del transporte (presión, rotación). Paso de 1 día, subdividido si el transporte es muy intenso.
function pasoEBM(s, Q, F, anios, factorD = 1) {
    const N = EBM.N, dx = 2 / N, D = EBM.D * factorD;
    const sub = Math.max(1, Math.ceil(D * 86400 / (EBM.C_TIERRA * dx * dx) / 0.4)); // estabilidad del esquema explícito
    const dt = 86400 / sub, dtDias = 1 / sub, diasSlot = DIAS_ANIO / EBM.NS;
    const pasos = Math.max(1, Math.round(anios * DIAS_ANIO * sub));
    const Tm = new Array(N), flujo = new Array(N + 1).fill(0);
    const { TL, TO, Td } = s;
    for (let p = 0; p < pasos; p++) {
        const slot = Math.floor(s.dia / diasSlot) % EBM.NS, Qs = Q[slot];
        for (let i = 0; i < N; i++) Tm[i] = FRACCION_TIERRA[i] * TL[i] + (1 - FRACCION_TIERRA[i]) * TO[i];
        for (let i = 1; i < N; i++) {
            const xb = -1 + i * dx;
            flujo[i] = D * (1 - xb * xb) * (Tm[i] - Tm[i - 1]) / dx;
        }
        for (let i = 0; i < N; i++) {
            const f = FRACCION_TIERRA[i], x = EBM_X[i];
            const comun = F - EBM.A + (flujo[i + 1] - flujo[i]) / dx;
            const cambio = EBM.NU * (TL[i] - TO[i]);
            let haciaFondo = 0;
            if (Td) {
                haciaFondo = (TO[i] < Td[i] ? EBM.GAMMA_CONV : EBM.GAMMA) * (TO[i] - Td[i]);
                Td[i] += dt * haciaFondo / EBM.C_PROFUNDO;
            }
            const netoL = Qs[i] * (1 - albedoColumna(TL[i], x, true)) - EBM.B * TL[i] + comun - (1 - f) * cambio;
            const netoO = Qs[i] * (1 - albedoColumna(TO[i], x, false)) - EBM.B * TO[i] + comun + f * cambio - haciaFondo;
            TL[i] += dt * netoL / EBM.C_TIERRA;
            TO[i] += dt * netoO / EBM.C_OCEANO;
        }
        s.dia += dtDias;
        if (s.dia >= DIAS_ANIO) s.dia -= DIAS_ANIO;
        if (Math.floor(s.dia / diasSlot) % EBM.NS !== slot) { s.clim[slot].L = [...TL]; s.clim[slot].O = [...TO]; }
    }
    return s;
}

// Medias anuales sobre la climatología del último año
function diagnosticoEBM(s, Q) {
    const N = EBM.N, NS = EBM.NS;
    let t = 0, q = 0, qa = 0, hielo = 0, tEc = 0, tPolo = 0, tTierra = 0, tOceano = 0;
    const banda = new Array(N).fill(0), maxB = new Array(N).fill(-1e9), minB = new Array(N).fill(1e9);
    for (let k = 0; k < NS; k++) {
        const { L, O } = s.clim[k];
        for (let i = 0; i < N; i++) {
            const f = FRACCION_TIERRA[i], x = EBM_X[i];
            const Tb = f * L[i] + (1 - f) * O[i];
            const a = f * albedoColumna(L[i], x, true) + (1 - f) * albedoColumna(O[i], x, false);
            t += Tb; q += Q[k][i]; qa += Q[k][i] * a; banda[i] += Tb / NS;
            hielo += f * fraccionHielo(L[i], EBM.T_NIEVE) + (1 - f) * fraccionHielo(O[i], EBM.T_HIELO_MAR);
            maxB[i] = Math.max(maxB[i], Tb); minB[i] = Math.min(minB[i], Tb);
            tTierra += f * L[i]; tOceano += (1 - f) * O[i];
        }
    }
    const n = N * NS;
    tEc = (banda[N / 2 - 1] + banda[N / 2]) / 2; tPolo = (banda[0] + banda[N - 1]) / 2;
    return { Tmedia: t / n, albedo: qa / q, hielo: hielo / n, Qmedia: q / n, Tecuador: tEc, Tpolo: tPolo,
             Tbanda: banda, amplitud: maxB.map((m, i) => m - minB[i]) };
}

// Transporte de calor relativo a la Tierra: D ∝ P · (P_rot / 24 h)⁻² (Williams & Kasting 1997).
function factorTransporte(P_bar = 1.013, rotacion_h = 24) { return (P_bar / 1.013) * Math.pow(24 / rotacion_h, 2); }

// ---- Planeta anclado por marea: dos cajas, día y noche (cada una la mitad del área).
//   C dT_d/dt = (S/2)(1 − α_d) − (A + B·T_d) + F − k(T_d − T_n)
//   C dT_n/dt =              − (A + B·T_n) + F + k(T_d − T_n)
// El hemisferio diurno recibe de media S/2. k = 3 W m⁻² K⁻¹·(P/1 bar) da un contraste día–noche de ~60 K con 1 bar,
// como los modelos de circulación general para planetas anclados de tipo terrestre (Yang, Cowan & Abbot 2013, ApJL 771; Leconte et al. 2013).
// La media global coincide con la de un planeta que rota con el mismo albedo; la diferencia es dónde se forma el hielo.
// simplificación: sin la cubierta de nubes subestelar que eleva el albedo del lado diurno (Yang et al. 2013).
const ANCLADO = { K: 3.0, C: 2.1e8 };
const albedoAnclado = (T) => 0.30 + (EBM.ALB_HIELO - 0.30) * fraccionHielo(T, EBM.T_HIELO_MAR);
function pasoAnclado(s, S_Wm2, F, anios, P_bar = 1.013) {
    const dt = 5 * 86400, pasos = Math.max(1, Math.round(anios * C.ANIO / dt)), k = ANCLADO.K * P_bar / 1.013;
    for (let p = 0; p < pasos; p++) {
        const inter = k * (s.Tdia - s.Tnoche);
        const netoDia = S_Wm2 / 2 * (1 - albedoAnclado(s.Tdia)) - (EBM.A + EBM.B * s.Tdia) + F - inter;
        const netoNoche = -(EBM.A + EBM.B * s.Tnoche) + F + inter;
        s.Tdia += dt * netoDia / ANCLADO.C;
        s.Tnoche += dt * netoNoche / ANCLADO.C;
    }
    return s;
}

// Forzamiento total respecto al preindustrial (W/m²). P_bar escala la columna de los gases (por defecto, 1 atm).
function forzamientoTotal(g) {
    const col = (g.P_bar || 1.013) / 1.013, co2 = g.co2 * col, ch4 = g.ch4 * col, n2o = g.n2o * col;
    return forzamientoCO2(co2, n2o) + forzamientoCH4(ch4, n2o) + forzamientoN2O(n2o, ch4, co2) +
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
// Temperatura local de un planeta anclado según el coseno del ángulo al punto subestelar: noche uniforme y, de día,
// T_n + 1,5·(T_d − T_n)·√cos ψ, cuya media en el hemisferio es T_d. simplificación: perfil de forma fija.
function temperaturaAnclado({ Tdia, Tnoche }, cosPsi) {
    return cosPsi > 0 ? Tnoche + 1.5 * (Tdia - Tnoche) * Math.sqrt(cosPsi) : Tnoche;
}

// Equilibrio completo (para pruebas y para el Estudio de escenarios)
function climaEquilibrio(g, orbita, Tinicial = 15, anios = 150, factorD = 1) {
    const Q = insolacionEstacional(C.S0 * orbita.S_rel, orbita.oblicuidad, orbita.e, orbita.varpi);
    const s = pasoEBM(crearEstadoEBM(Tinicial), Q, forzamientoTotal(g), anios, factorD); // sin océano profundo: solo interesa el equilibrio
    return diagnosticoEBM(s, Q);
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

// ============================================================
// FASE 5 — IMPACTOS (Collins, Melosh & Marcus 2005, Meteoritics & Planet. Sci. 40: "Earth Impact Effects Program")
// ============================================================
const DENSIDADES_IMPACTOR = { iron: 7800, rock: 3000, ice: 1000 }; // kg/m³ (Collins 2005, tabla 1)
const ATM = { rho0: 1.0, H: 8000, CD: 2, FP: 7 };                  // Collins 2005 ec. 3, 8 y 18

// Chicxulub: cráter final ≈ 180 km (Hildebrand et al. 1991; Morgan et al. 1997). Con las ecuaciones de Collins 2005,
// 10 km a 20 km/s y 45° da ~120 km; 180 km requieren ~14 km y ~60°, dentro de las estimaciones del impactor (10–15 km).
const CHICXULUB = { L_m: 14000, v_kms: 20, rho: 3000, theta: 60 }; // ángulo empinado (Collins et al. 2020, Nat. Commun. 11)

function impacto({ L_m, v_kms, rho_i = 3000, theta_deg = 45, rho_t = 2500, agua_m = 0 }) {
    const { rho0, H, CD, FP } = ATM;
    const g = C.G_TIERRA, sinT = Math.sin(theta_deg * Math.PI / 180), v0 = v_kms * 1000;

    // Energía cinética: E = ½ m v²  [J], m = (π/6) ρ L³
    const masa = Math.PI / 6 * rho_i * L_m ** 3;
    const E = 0.5 * masa * v0 * v0;

    // Entrada atmosférica. Resistencia del cuerpo: Y = 10^(2,107 + 0,0624 √ρ) Pa (ec. 10).
    // Factor de fragmentación I_f = 4,07 C_D H Y / (ρ L v² sin θ) (ec. 12); si I_f ≥ 1 llega intacto.
    const Y = Math.pow(10, 2.107 + 0.0624 * Math.sqrt(rho_i));
    const If = 4.07 * CD * H * Y / (rho_i * L_m * v0 * v0 * sinT);
    let vSuelo, zRotura = null, zExplosion = null, rafaga = false;
    if (If >= 1) {
        // Frenado de un cuerpo intacto (ec. 8): v = v₀ exp(−3 ρ₀ C_D H / (4 ρ L sin θ))
        vSuelo = v0 * Math.exp(-3 * rho0 * CD * H / (4 * rho_i * L_m * sinT));
    } else {
        // Altitud de rotura (ec. 11): z* = −H [ln(Y/ρ₀v₀²) + 1,308 − 0,314 I_f − 1,303 √(1 − I_f)]
        zRotura = -H * (Math.log(Y / (rho0 * v0 * v0)) + 1.308 - 0.314 * If - 1.303 * Math.sqrt(1 - If));
        const rhoZ = rho0 * Math.exp(-zRotura / H);
        const vZ = v0 * Math.exp(-3 * rhoZ * CD * H / (4 * rho_i * L_m * sinT));
        // Modelo de "tortita": longitud de dispersión l = L sin θ √(ρ/(C_D ρ(z*))) (ec. 13); explosión aérea cuando L = f_p·L₀ (ec. 18)
        const l = L_m * sinT * Math.sqrt(rho_i / (CD * rhoZ));
        zExplosion = zRotura - 2 * H * Math.log(1 + (l / (2 * H)) * Math.sqrt(FP * FP - 1));
        if (zExplosion > 0) {
            rafaga = true;
            vSuelo = 0;
        } else {
            // Velocidad en el suelo del enjambre que se expande (ec. 19–20, integración numérica en 200 pasos)
            let integral = 0;
            const n = 200, dz = zRotura / n;
            for (let i = 0; i < n; i++) {
                const z = (i + 0.5) * dz;
                const Lz2 = L_m * L_m * (1 + Math.pow(2 * H / l, 2) * Math.pow(Math.exp((zRotura - z) / (2 * H)) - 1, 2));
                integral += Math.exp((zRotura - z) / H) * Lz2 * dz;
            }
            vSuelo = vZ * Math.exp(-0.75 * CD * rhoZ * integral / (rho_i * L_m ** 3 * sinT));
        }
    }

    // Impacto en el océano: la capa de agua frena al cuerpo con la misma ecuación de arrastre que la atmósfera (ec. 8),
    // integrada a densidad constante: v_fondo = v · exp(−3 ρ_w C_D d / (4 ρ_i L sin θ)), ρ_w = 1000 kg/m³, d = profundidad.
    // simplificación: sin fragmentación dentro del agua ni tsunami; el cráter se calcula en el fondo con v_fondo.
    let vAgua = null;
    if (agua_m > 0 && !rafaga) {
        vAgua = vSuelo;
        vSuelo *= Math.exp(-3 * 1000 * CD * agua_m / (4 * rho_i * L_m * sinT));
    }

    // Cráter transitorio (ec. 21): D_tc = 1,161 (ρ_i/ρ_t)^⅓ L^0,78 v^0,44 g^−0,22 sin^⅓θ   [m, SI]
    // Cráter final (ec. 22 y 27): simple D = 1,25 D_tc; complejo D = 1,17 D_tc^1,13 / D_c^0,13, con D_c = 3,2 km en la Tierra.
    // Profundidad del cráter complejo (ec. 28): d = 0,294 D^0,301 [km].
    let Dtc = 0, Dfinal = 0, profundidad = 0;
    if (!rafaga) {
        Dtc = 1.161 * Math.pow(rho_i / rho_t, 1 / 3) * Math.pow(L_m, 0.78) * Math.pow(vSuelo, 0.44) * Math.pow(g, -0.22) * Math.pow(sinT, 1 / 3);
        const Dc = 3200;
        Dfinal = 1.25 * Dtc < Dc ? 1.25 * Dtc : 1.17 * Math.pow(Dtc, 1.13) / Math.pow(Dc, 0.13);
        profundidad = 1.25 * Dtc < Dc ? Dfinal / 5 / 1000 : 0.294 * Math.pow(Dfinal / 1000, 0.301);
    }

    // Magnitud sísmica equivalente (ec. 40, eficiencia sísmica 10⁻⁴): M = 0,67 log₁₀E − 5,87
    const magnitud = rafaga ? null : 0.67 * Math.log10(0.5 * masa * vSuelo * vSuelo) - 5.87;

    // Invierno de impacto: polvo, hollín y sulfatos. Chicxulub → oscuridad de meses y enfriamiento de ~26 K
    // durante ~3–16 años (Brugger, Feulner & Petri 2017, GRL 44; Toon et al. 1997, Rev. Geophys. 35).
    // simplificación: τ = 20 · (E/E_Chicxulub)^(2/3), con umbral de efectos globales en ~10⁵–10⁶ Mt (Toon 1997).
    const E_chix = 0.5 * (Math.PI / 6 * CHICXULUB.rho * CHICXULUB.L_m ** 3) * (CHICXULUB.v_kms * 1000) ** 2;
    const tau = rafaga ? 0 : 20 * Math.pow(E / E_chix, 2 / 3);

    return {
        masa_kg: masa, energia_J: E, energia_Mt: E / C.MT_TNT, If, zRotura_km: zRotura && zRotura / 1000,
        zExplosion_km: zExplosion && zExplosion / 1000, rafagaAerea: rafaga, vSuelo_kms: vSuelo / 1000,
        crater_transitorio_km: Dtc / 1000, crater_km: Dfinal / 1000, profundidad_km: profundidad, magnitud, tau,
        vSuperficieAgua_kms: vAgua && vAgua / 1000, agua_m
    };
}
// El aerosol del impacto decae con τ ≈ 1,5 años (sedimentación del polvo fino y del sulfato; Brugger 2017).
const TAU_DECAIMIENTO_IMPACTO_ANIOS = 1.5;

// ============================================================
// FASE 6 — OCÉANOS Y BIOSFERA
// ============================================================

// Color del océano (explicación física; los colores RGB del shader son aproximaciones visuales):
//  - El agua pura absorbe el rojo por sobretonos vibracionales del enlace O–H: a = 0,65 m⁻¹ a 700 nm frente a 0,0044 m⁻¹ a 420 nm
//    (Pope & Fry 1997, Appl. Opt. 36). Lo que vuelve a la superficie tras dispersarse es azul.
//  - El fitoplancton absorbe azul y rojo con la clorofila a, y el agua vira a verde con > ~1 mg/m³ (Morel & Maritorena 2001, JGR 106).
//  - Aguas someras turquesa: el fondo de arena carbonatada refleja la luz que el agua todavía no absorbió.
//  - Arqueano: océano anóxico rico en Fe²⁺; el Fe(III) coloidal formado por fotooxidación lo teñiría de verde
//    (hipótesis de Matsuo et al. 2025, Nat. Ecol. Evol.). No era rojo: el óxido rojo precipitaba como formaciones de hierro bandeado.

// Pigmento fotosintético esperado según la estrella (Kiang et al. 2007a,b, Astrobiology 7):
// las plantas se adaptan al pico de flujo de FOTONES en superficie. Sol → absorben azul y rojo y reflejan verde;
// enanas M (pico en el infrarrojo cercano) → pigmentos que absorben todo el visible y el IR cercano: aspecto oscuro o negro.
// simplificación: tres clases según la temperatura efectiva.
function pigmentoPorEstrella(Teff) {
    if (Teff < 3900) return 'black';
    if (Teff > 6500) return 'gold';   // estrellas F: predicción de reflexión amarillo-anaranjada (Kiang 2007b)
    return 'green';
}

// Oxígeno atmosférico (% en volumen a 1 bar)
const OXIGENO = {
    GRAN_OXIDACION_GA: 2.4,     // Lyons, Reinhard & Planavsky 2014 (Nature 506)
    INCENDIO_MIN: 15,           // por debajo no se sostiene la combustión de biomasa (Belcher & McElwain 2008, Science 321)
    INCENDIO_MAX: 30,           // por encima arde incluso la vegetación húmeda (Watson, Lovelock & Margulis 1978; Lenton 2013)
    ANIMALES_GRANDES: 10        // ~0,1 bar de O₂ para metabolismo aerobio de animales grandes (Catling et al. 2005, Astrobiology 5)
};

// Índice de habitabilidad para vida compleja (0–100) = 100 × producto de factores en [0,1].
// Cada factor tiene su fuente. simplificación: pesos multiplicativos e interpolación lineal entre umbrales;
// los microorganismos toleran rangos mucho más amplios (−20 a 122 °C; Clarke 2014, Takai et al. 2008).
// El O₂ entra como % en volumen; la respiración y la capa de ozono dependen de la presión parcial (pO₂ = %·P/1 atm),
// los incendios de la fracción (Belcher & McElwain 2008).
function indiceHabitabilidad({ T, P_bar, o2, B_rel, estrella, estadoInvernadero }) {
    const rampa = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)));
    const Tebull = puntoEbullicion_C(P_bar), pO2 = o2 * P_bar / 1.013;
    const f = {
        // Agua líquida en superficie: entre el punto de congelación del agua de mar (−1,9 °C) y la ebullición a esa presión (Clausius-Clapeyron)
        agua: estadoInvernadero === 'desbocado' || T >= Tebull || P_bar < 0.0061 ? 0 : rampa(T, -30, -1.9),
        // Temperatura para vida compleja: óptimo 0–30 °C; estrés térmico a partir de ~35 °C de bulbo húmedo
        // (Sherwood & Huber 2010, PNAS 107) y límite de eucariotas ~50 °C (Clarke 2014)
        temperatura: Math.min(rampa(T, -20, 0), 1 - rampa(T, 30, 50)),
        // Escudo de ozono: O₂ ≥ ~10 % del actual (≈ 2 %) ya da una columna de O₃ protectora (Segura et al. 2003, Astrobiology 3)
        uv: rampa(pO2, 0, 2.1),
        // Respiración de animales grandes (Catling 2005) e incendios generalizados por encima de ~30 % (Watson 1978)
        oxigeno: rampa(pO2, 0, OXIGENO.ANIMALES_GRANDES) * (o2 > OXIGENO.INCENDIO_MAX ? 0.5 : 1),
        // Presión: por debajo del límite de Armstrong (0,0627 bar) los fluidos corporales hierven a 37 °C;
        // por encima de ~5 bar hay narcosis por N₂ (Bennett & Rostain 2003)
        presion: Math.min(rampa(P_bar, 0.0627, 0.5), 1 - rampa(P_bar, 5, 50)),
        // Campo magnético: reduce el escape iónico y la radiación en superficie; su papel neto se discute
        // (Gunell et al. 2018, A&A 614), por eso pesa poco
        magnetosfera: 0.8 + 0.2 * Math.min(1, B_rel),
        // Estrella: tiempo para la abiogénesis (≥ 0,5 Ga)
        estrella: estrellaPermiteVida(estrella) ? 1 : 0
    };
    const indice = 100 * Object.values(f).reduce((a, b) => a * b, 1);
    return { indice, factores: f };
}

// Índice UV al mediodía con cielo despejado (Madronich 2007, Photochem. Photobiol. 83): UVI ≈ 12,5 · μ₀^2,42 · (Ω/300 DU)^−1,23,
// μ₀ = cos(φ − δ) es el coseno del ángulo cenital a mediodía. Ω: columna de ozono, 300 DU hoy; con O₂ < 10 % del actual (pO₂ < 2,1 %)
// el escudo se debilita (Segura et al. 2003). Nubes: × (1 − 0,5·cobertura).
// simplificación: la fórmula se ajustó para 200–500 DU; por debajo se acota el aumento a ×10.
function indiceUV(latDeg, declinacionDeg, pO2, nubes = 0) {
    const mu = Math.cos((latDeg - declinacionDeg) * Math.PI / 180);
    if (mu <= 0) return 0;
    const ozono = Math.max(0.01, Math.min(1, pO2 / 2.1));
    return 12.5 * Math.pow(mu, 2.42) * Math.min(10, Math.pow(ozono, -1.23)) * (1 - 0.5 * nubes);
}

// Espectro de transmisión en tránsito: altura efectiva z(λ) de la atmósfera (Lecavelier des Etangs et al. 2008, A&A 481):
//   z = H · ln(τ_s / τ_eq),  τ_eq ≈ 0,56,  H = R·T/(μ·g)   [km]
// τ_s es el espesor óptico oblicuo en la superficie. Rayleigh: τ_s = τ_vertical · √(2πR_p/H).
// Rasgos moleculares calibrados con la Tierra (Kaltenegger & Traub 2009, ApJ 698, tabla 2: altura del rasgo sobre el continuo)
// y escalados con la columna de cada gas: al multiplicar la abundancia por k el rasgo sube H·ln k.
// El continuo es el Rayleigh o, si es mayor, el suelo opaco: por debajo de ~6 km la Tierra es opaca en todas las longitudes de onda (nubes y refracción; Kaltenegger & Traub 2009).
// simplificación: perfiles gaussianos y H única; el O₃ sigue el escudo de ozono y el H₂O la presión de vapor (Clausius-Clapeyron).
const RASGOS_TRANSITO = [
    { mol: 'o3', um: 0.6, ancho: 0.15, dz: 10 }, { mol: 'h2o', um: 1.9, ancho: 0.2, dz: 5 },
    { mol: 'co2', um: 2.8, ancho: 0.1, dz: 20 }, { mol: 'h2o', um: 3.3, ancho: 0.25, dz: 20 },
    { mol: 'ch4', um: 7.7, ancho: 0.7, dz: 7 },  { mol: 'o3', um: 9.8, ancho: 0.7, dz: 30 },
    { mol: 'co2', um: 15.2, ancho: 3.0, dz: 25 }
];
const Z_OPACO_KM = 6;
function espectroTransito({ T_C, P_bar, co2, o2, ch4 }) {
    const x_o2 = o2 / 100, x_co2 = co2 * 1e-6;
    const mu = 32 * x_o2 + 44 * x_co2 + 28.01 * Math.max(0, 1 - x_o2 - x_co2);        // g/mol
    const H = 8.314 * (T_C + 273.15) / (mu * 1e-3 * C.G_TIERRA) / 1000;               // km
    const H_E = 8.314 * 288.15 / (28.97e-3 * C.G_TIERRA) / 1000;
    const col = P_bar / 1.013, pO2 = o2 * col;
    const relativo = {
        o3: Math.max(1e-6, Math.min(1, pO2 / 2.1)),
        h2o: Math.max(1e-6, presionVaporSaturacion_hPa(Math.min(100, T_C)) / presionVaporSaturacion_hPa(15)),
        co2: Math.max(1e-6, co2 / 420 * col),
        ch4: Math.max(1e-6, ch4 / 1.9 * col)
    };
    const geom = Math.sqrt(2 * Math.PI * C.R_TIERRA / 1000 / H), geomE = Math.sqrt(2 * Math.PI * C.R_TIERRA / 1000 / H_E);
    // Calibración con la Tierra: en el centro de cada rasgo, z = z_continuo + dz  →  τ_rasgo = τ_continuo·(e^(dz/H) − 1)
    const tauRasgo = RASGOS_TRANSITO.map((r) => {
        const tauC = 0.56 * Math.exp(Z_OPACO_KM / H_E) + espesorRayleigh(r.um, 1.013, 420) * geomE;
        return tauC * (Math.exp(r.dz / H_E) - 1);
    });
    const puntos = [];
    for (let k = 0; k <= 240; k++) {
        const um = 0.4 * Math.pow(15 / 0.4, k / 240);
        let tau = espesorRayleigh(um, P_bar, co2) * geom + 0.56 * Math.exp(Z_OPACO_KM / H); // Rayleigh + suelo opaco (nubes)
        const porMol = {};
        for (const [j, r] of RASGOS_TRANSITO.entries()) {
            const sigma = r.ancho / 2.355;
            const t = tauRasgo[j] * relativo[r.mol] * Math.exp(-0.5 * ((um - r.um) / sigma) ** 2);
            tau += t; porMol[r.mol] = (porMol[r.mol] || 0) + t;
        }
        puntos.push({ um, z_km: H * Math.log(tau / 0.56), porMol });
    }
    return { puntos, H_km: H, mu };
}

// Nivel del mar por el hielo: responde con retardo. Levermann et al. 2013 (PNAS 110): el compromiso de 2,3 m/K se alcanza en ~2000 años.
// simplificación: relajación de primer orden con τ = 2000 años hacia nivelMarPorHielo_m(T).
const TAU_HIELO_ANIOS = 2000;
function pasoNivelHielo(actual_m, T, anios) {
    return actual_m + (nivelMarPorHielo_m(T) - actual_m) * (1 - Math.exp(-anios / TAU_HIELO_ANIOS));
}

// Color de la luz de una estrella de cuerpo negro en RGB lineal (sRGB), con los ojos adaptados al Sol (el Sol se ve blanco).
// Funciones de igualación de color CIE 1931 aproximadas con gaussianas por tramos (Wyman, Sloan & Shirley 2013, JCGT 2).
function colorCuerpoNegro(Teff) {
    const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
    const xyz = (T) => {
        let X = 0, Y = 0, Z = 0;
        for (let nm = 380; nm <= 780; nm += 5) {
            const l = nm * 1e-9, B = 1 / (Math.pow(l, 5) * (Math.exp(1.4388e-2 / (l * T)) - 1));
            X += B * (1.056 * g(nm, 599.8, 37.9, 31.0) + 0.362 * g(nm, 442.0, 16.0, 26.7) - 0.065 * g(nm, 501.1, 20.4, 26.2));
            Y += B * (0.821 * g(nm, 568.8, 46.9, 40.5) + 0.286 * g(nm, 530.9, 16.3, 31.1));
            Z += B * (1.217 * g(nm, 437.0, 11.8, 36.0) + 0.681 * g(nm, 459.0, 26.0, 13.8));
        }
        return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
    };
    const c = xyz(Teff), sol = xyz(5772);
    const rgb = c.map((v, i) => Math.max(0, v / sol[i]));
    const m = Math.max(...rgb);
    return rgb.map((v) => v / m);
}
// Radio estelar por Stefan-Boltzmann: R/R☉ = √(L/L☉) · (5772 K / Teff)²; diámetro angular visto desde d: 2R/d [rad].
function diametroAngular_rad(estrella, d_UA) {
    const R_UA = 0.00465047 * Math.sqrt(estrella.L) * (5772 / estrella.Teff) ** 2;
    return 2 * R_UA / d_UA;
}

const Fisica = {
    C, ESTRELLAS, KOPPARAPU, MEINSHAUSEN, OBLICUIDAD_CAOS, EDAD_MINIMA_VIDA_GA, PREINDUSTRIAL, EBM, T_DESBOCADO_C,
    OXIGENO, pigmentoPorEstrella, indiceHabitabilidad,
    DENSIDADES_IMPACTOR, CHICXULUB, TAU_DECAIMIENTO_IMPACTO_ANIOS, impacto,
    CARBONO, HIELO_TOTAL_M, EUSTASIA_MAX_M, PROVINCIAS_IGNEAS,
    meteorizacion_GtAnio, desgasificacion_GtAnio, pasoCarbono, nivelMarPorHielo_m, nivelMarFisicamentePosible, luminosidadSolar,
    insolacion, distanciaEquivalente, picoWien_um, picoFotones_um, sEff, zonaHabitable,
    insolacionDiaria, insolacionAnual, tiempoAnclajeMarea_anios, estaAnclado, mareaRelativa,
    presionVientoEstelar_Pa, radioMagnetopausa, latitudAuroral_grados, estrellaPermiteVida, colorCielo,
    forzamientoCO2, forzamientoCH4, forzamientoN2O, profundidadOpticaSulfato, forzamientoAerosol, forzamientoNubes,
    forzamientoTotal, presionVaporSaturacion_hPa, puntoEbullicion_C, espesorRayleigh, temperaturaEquilibrio,
    indiceUV, RASGOS_TRANSITO, espectroTransito, TAU_HIELO_ANIOS, pasoNivelHielo, colorCuerpoNegro, diametroAngular_rad,
    insolacionEstacional, longitudSolar, perfilInicial, crearEstadoEBM, pasoEBM, diagnosticoEBM, estadoInvernadero, climaEquilibrio,
    FRACCION_TIERRA, fraccionHielo, factorTransporte, ANCLADO, pasoAnclado, albedoAnclado, temperaturaAnclado, DIAS_ANIO
};

if (typeof module !== 'undefined' && module.exports) module.exports = Fisica;
raiz.Fisica = Fisica;
})(typeof window !== 'undefined' ? window : globalThis);
