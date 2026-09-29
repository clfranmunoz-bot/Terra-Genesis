// Pruebas de validación: la Tierra actual debe reproducir valores reales.
// Uso: node tests/validacion.js   (sin dependencias)
const F = require('../js/fisica.js');
const r = Math.PI / 180;
let fallos = 0;

function prueba(nombre, valor, min, max, unidad = '') {
    const ok = valor >= min && valor <= max;
    if (!ok) fallos++;
    console.log(`${ok ? '✅' : '❌'} ${nombre}: ${typeof valor === 'number' ? +valor.toPrecision(4) : valor} ${unidad}  [esperado ${min}–${max}]`);
}
const verdad = (nombre, cond) => prueba(nombre, cond ? 1 : 0, 1, 1, cond ? '(sí)' : '(no)');

console.log('\n— Fase 2: astrofísica y órbita —');
const sol = F.ESTRELLAS.sun_g2v;
prueba('Insolación a 1 UA', F.C.S0 * F.insolacion(sol.L, 1), 1360, 1362, 'W/m²');
let g = 0, w = 0;
for (let i = 0; i < 90; i++) {
    const lat = (-89 + 2 * i) * r;
    g += F.insolacionAnual(F.C.S0, lat, 23.44 * r, 0.0167, 282.9 * r) * Math.cos(lat);
    w += Math.cos(lat);
}
prueba('Insolación media global (S/4)', g / w, 338, 342, 'W/m²');
prueba('Insolación ecuador, equinoccio (S/π)', F.insolacionDiaria(F.C.S0, 0, 0, 23.44 * r, 0, 0), 430, 436, 'W/m²');
prueba('Insolación polo norte, solsticio de junio', F.insolacionDiaria(F.C.S0, 90 * r, Math.PI / 2, 23.44 * r, 0.0167, 282.9 * r), 515, 530, 'W/m²');
const zh = F.zonaHabitable(sol);
prueba('Zona habitable interior (Sol)', zh.interiorConservador, 0.93, 0.99, 'UA');
prueba('Zona habitable exterior (Sol)', zh.exteriorConservador, 1.65, 1.72, 'UA');
verdad('La Tierra no está anclada por marea', !F.estaAnclado(sol, 1));
verdad('Planeta en la ZH de Próxima está anclado', F.estaAnclado(F.ESTRELLAS.red_dwarf_m, 0.0485));
prueba('Magnetopausa terrestre (Chapman-Ferraro)', F.radioMagnetopausa(1, F.presionVientoEstelar_Pa(1)), 8, 12, 'R⊕');
prueba('Latitud del óvalo auroral', F.latitudAuroral_grados(F.radioMagnetopausa(1, F.presionVientoEstelar_Pa(1))), 65, 75, '°');
prueba('Mareas sin Luna (fracción de las actuales)', F.mareaRelativa(false, 1, 1), 0.28, 0.35);
prueba('Pico de Wien del Sol', F.picoWien_um(sol.Teff), 0.49, 0.51, 'µm');
verdad('Rigel no permite vida', !F.estrellaPermiteVida(F.ESTRELLAS.blue_giant));
const cielo = F.colorCielo(sol.Teff);
verdad('Cielo terrestre azul (B > G > R)', cielo[2] > cielo[1] && cielo[1] > cielo[0]);

console.log('\n— Fase 3: clima y atmósfera —');
const orbita = { S_rel: 1, oblicuidad: 23.44, e: 0.0167, varpi: 282.9 };
const hoy = { co2: 420, ch4: 1.9, n2o: 0.335, so2: 0.05, nubes: 0.75 };
const clima = F.climaEquilibrio(hoy, orbita);
prueba('Temperatura media global actual', clima.Tmedia, 14, 16, '°C');
prueba('Albedo planetario', clima.albedo, 0.28, 0.32);
prueba('T_eq = [S(1−A)/4σ]^¼', F.temperaturaEquilibrio(1361, 0.30), 253, 257, 'K');
prueba('Efecto invernadero (T − T_eq)', clima.Tmedia + 273.15 - F.temperaturaEquilibrio(1361, clima.albedo), 30, 36, 'K');
prueba('Temperatura ecuatorial media anual', clima.Tecuador, 24, 32, '°C');
prueba('Temperatura polar media anual', clima.Tpolo, -30, -10, '°C');
prueba('Cobertura de hielo', clima.hielo, 0.05, 0.15);
prueba('Forzamiento efectivo 2×CO₂ (AR6: 3,93 ± 0,47)', F.forzamientoCO2(2 * F.PREINDUSTRIAL.co2), 3.8, 4.1, 'W/m²');
prueba('CO₂ a 50.000 ppm (Byrne & Goldblatt 2014: 38,1 W/m² × 1,05)', F.forzamientoCO2(50000), 39, 41, 'W/m²');
verdad('El forzamiento del CO₂ crece más rápido que ln(C) por encima de 2000 ppm', F.forzamientoCO2(20000) - F.forzamientoCO2(10000) > F.forzamientoCO2(2000) - F.forzamientoCO2(1000));
prueba('Forzamiento CH₄ actual (AR6: 0,54)', F.forzamientoCH4(1.9, 0.335), 0.45, 0.6, 'W/m²');
prueba('Forzamiento N₂O actual (AR6: 0,21)', F.forzamientoN2O(0.335, 1.9, 420), 0.17, 0.25, 'W/m²');
prueba('Forzamiento Pinatubo (20 Mt SO₂)', F.forzamientoAerosol(F.profundidadOpticaSulfato(20)), -4.5, -2.5, 'W/m²');
const t280 = F.climaEquilibrio({ ...hoy, co2: 280 }, orbita).Tmedia;
const t560 = F.climaEquilibrio({ ...hoy, co2: 560 }, orbita).Tmedia;
prueba('Sensibilidad climática de equilibrio (2×CO₂)', t560 - t280, 2.5, 4.0, '°C');
prueba('Presión de vapor a 15 °C (Clausius-Clapeyron)', F.presionVaporSaturacion_hPa(15), 16.8, 17.3, 'hPa');
prueba('Aumento de vapor por K a 15 °C', F.presionVaporSaturacion_hPa(16) / F.presionVaporSaturacion_hPa(15) - 1, 0.06, 0.075);
prueba('Ebullición a 1 atm', F.puntoEbullicion_C(1.01325), 99.5, 100.5, '°C');
prueba('Espesor Rayleigh a 550 nm', F.espesorRayleigh(0.55, 1.01325), 0.09, 0.105);
const caliente = F.climaEquilibrio({ ...hoy, co2: 280 }, orbita, 15).Tmedia;
const fria = F.climaEquilibrio({ ...hoy, co2: 280 }, orbita, -45).Tmedia;
prueba('Amplitud estacional a 60–70 °N (zona continental)', clima.amplitud[15], 20, 45, 'K');
prueba('Amplitud estacional a 60 °S (zona oceánica)', clima.amplitud[2], 3, 12, 'K');
prueba('Amplitud estacional en el ecuador', clima.amplitud[9], 0, 5, 'K');
{   // La nieve continental avanza en invierno: más hielo en el hemisferio norte en enero que en julio
    const Q = F.insolacionEstacional(1361, 23.44, 0.0167, 282.9);
    const s = F.pasoEBM(F.crearEstadoEBM(15), Q, F.forzamientoTotal(hoy), 60);
    const hieloNorte = (k) => [13, 14, 15, 16, 17].reduce((a, i) => a + F.fraccionHielo(s.clim[k].L[i], F.EBM.T_NIEVE), 0);
    verdad('Nieve en el hemisferio norte: enero > julio', hieloNorte(60) > hieloNorte(24) + 0.5);
}
prueba('Perihelio: longitud solar el 3 de enero (día 288 desde el equinoccio)', F.longitudSolar(288, 0.0167, 282.9 * r) / r % 360, 280, 286, '°');
verdad('Más presión o rotación más lenta → más transporte de calor', F.factorTransporte(2.026, 24) === 2 && F.factorTransporte(1.013, 48) === 0.25);
{
    const orb = { ...orbita }, a = F.climaEquilibrio(hoy, orb, 15, 150, 0.5), b = F.climaEquilibrio(hoy, orb, 15, 150, 2);
    verdad('Con más transporte el contraste ecuador–polo disminuye', (b.Tecuador - b.Tpolo) < (a.Tecuador - a.Tpolo) - 5);
}
{   // Planeta anclado por marea con la insolación terrestre
    const s = F.pasoAnclado({ Tdia: 15, Tnoche: 15 }, 1361, F.forzamientoTotal(hoy), 200);
    prueba('Anclado: contraste día–noche (GCM: ~40–80 K)', s.Tdia - s.Tnoche, 40, 80, 'K');
    const s3 = F.pasoAnclado({ Tdia: 15, Tnoche: 15 }, 1361, F.forzamientoTotal(hoy), 200, 3.04);
    verdad('Anclado: 3 bar reduce el contraste día–noche', s3.Tdia - s3.Tnoche < (s.Tdia - s.Tnoche) / 2);
}
verdad('Histéresis Budyko-Sellers: mismos parámetros, arranque cálido templado y frío congelado', caliente > 5 && fria < -30);
verdad('Tierra actual: invernadero normal', F.estadoInvernadero(1, 5772) === 'normal');
verdad('1,12 S⊕ → invernadero desbocado (umbral ≈ 1,1 S⊕)', F.estadoInvernadero(1.12, 5772) === 'desbocado');

console.log('\n— Fase 4: geología y geoquímica —');
prueba('Meteorización = desgasificación en el equilibrio preindustrial', F.meteorizacion_GtAnio(280, 14) / F.desgasificacion_GtAnio(1), 0.99, 1.01);
// Termostato: duplicar la desgasificación → nuevo equilibrio con W = V, clima acoplado
function termostato(volc, co2 = 280, Ma = 5) {
    let T = 14;
    for (let i = 0; i < Ma * 20; i++) {
        co2 = F.pasoCarbono(co2, T, volc, 1, 5e4);
        T = F.climaEquilibrio({ co2, ch4: 0.722, n2o: 0.27, so2: 0, nubes: 0.75 }, orbita, T, 40).Tmedia;
    }
    return { co2, T };
}
const eq2 = termostato(2);
prueba('Termostato con 2× volcanismo: meteorización / desgasificación', F.meteorizacion_GtAnio(eq2.co2, eq2.T) / F.desgasificacion_GtAnio(2), 0.97, 1.03);
prueba('Termostato con 2× volcanismo: calentamiento acotado', eq2.T - 14, 2, 10, 'K');
{   // e-folding tras un pulso de CO₂
    let co2 = 1000, T = 14, t = 0;
    const objetivo = 280 * Math.exp(Math.log(1000 / 280) / Math.E);
    while (co2 > objetivo && t < 5e6) { co2 = F.pasoCarbono(co2, T, 1, 1, 1e4); T = 14 + 2.72 * Math.log2(co2 / 280); t += 1e4; }
    prueba('Tiempo de relajación del termostato (e-folding)', t / 1e3, 200, 800, 'ka');
}
prueba('Subida del mar por fusión total del hielo', F.nivelMarPorHielo_m(40), 64, 67, 'm');
prueba('Nivel del mar en el Último Máximo Glacial (−6 K)', F.nivelMarPorHielo_m(9), -130, -120, 'm');
prueba('Retardo del hielo: fracción del cambio alcanzada en 2000 años', F.pasoNivelHielo(0, 40, 2000) / F.nivelMarPorHielo_m(40), 0.6, 0.66);
verdad('+1.200 m no es físicamente posible (máx. ±250 m)', !F.nivelMarFisicamentePosible(1200));
prueba('Luminosidad solar hace 700 Ma (bola de nieve)', F.luminosidadSolar(-700), 0.93, 0.95);
prueba('Luminosidad solar en +1 Ga', F.luminosidadSolar(1000), 1.08, 1.12);

console.log('\n— Fase 5: impactos (Collins et al. 2005) —');
const chix = F.impacto({ L_m: 14000, v_kms: 20, rho_i: 3000, theta_deg: 60 });
prueba('Chicxulub: cráter final', chix.crater_km, 150, 210, 'km');
prueba('Chicxulub: energía', chix.energia_Mt, 5e7, 5e8, 'Mt');
prueba('10 km, 20 km/s, 45° (fórmula de Collins)', F.impacto({ L_m: 10000, v_kms: 20, rho_i: 3000 }).crater_km, 100, 140, 'km');
const barringer = F.impacto({ L_m: 40, v_kms: 12.8, rho_i: 7800 });
prueba('Cráter Barringer (hierro de ~40 m): 1,2 km', barringer.crater_km, 0.9, 1.5, 'km');
const tunguska = F.impacto({ L_m: 50, v_kms: 12.8, rho_i: 1500 });
verdad('Tunguska (~50 m, roca porosa) explota en el aire', tunguska.rafagaAerea);
prueba('Tunguska: altitud de explosión (obs. 5–10 km)', tunguska.zExplosion_km, 4, 15, 'km');
verdad('Cheliábinsk (~20 m) explota en el aire (obs. ~30 km)', F.impacto({ L_m: 20, v_kms: 19, rho_i: 3300, theta_deg: 18 }).rafagaAerea);
{   // Invierno de impacto de Chicxulub con el océano de dos capas
    const Q = F.insolacionEstacional(1361, 23.44, 0.0167, 282.9);
    const s = F.pasoEBM(F.crearEstadoEBM(15, true), Q, F.forzamientoTotal(hoy), 50);
    const T0 = F.diagnosticoEBM(s, Q).Tmedia;
    let tau = chix.tau, Tmin = 99;
    for (let y = 0; y < 60; y += 0.1) {
        F.pasoEBM(s, Q, F.forzamientoTotal({ ...hoy, tauImpacto: tau }), 0.1);
        tau *= Math.exp(-0.1 / F.TAU_DECAIMIENTO_IMPACTO_ANIOS);
        const Tahora = s.TL.reduce((a, t, i) => a + F.FRACCION_TIERRA[i] * t + (1 - F.FRACCION_TIERRA[i]) * s.TO[i], 0) / F.EBM.N;
        Tmin = Math.min(Tmin, Tahora);
    }
    prueba('Invierno de impacto Chicxulub: enfriamiento máximo (Brugger 2017: ~26 K)', T0 - Tmin, 18, 35, 'K');
    prueba('Recuperación a los 60 años', F.diagnosticoEBM(s, Q).Tmedia, 12, 16, '°C');
}
{
    const tierra = F.impacto({ L_m: 1000, v_kms: 20, rho_i: 3000 }), mar = F.impacto({ L_m: 1000, v_kms: 20, rho_i: 3000, agua_m: 4000 });
    verdad('Impacto en el océano (4 km de agua): el cráter del fondo es menor que en tierra', mar.crater_km < tierra.crater_km / 2);
    verdad('Un océano somero (50 m) casi no frena a un cuerpo de 10 km', F.impacto({ L_m: 10000, v_kms: 20, agua_m: 50 }).vSuelo_kms > 19.5);
}

console.log('\n— Fase 6: océanos y biosfera —');
const hab = (o) => F.indiceHabitabilidad({ T: 15, P_bar: 1.013, o2: 20.95, B_rel: 1, estrella: sol, estadoInvernadero: 'normal', ...o }).indice;
prueba('Habitabilidad de la Tierra actual', hab({}), 95, 100);
prueba('Habitabilidad en bola de nieve (−50 °C)', hab({ T: -50 }), 0, 5);
prueba('Habitabilidad sin O₂ (Arqueano)', hab({ o2: 0 }), 0, 5);
prueba('Habitabilidad en torno a Rigel', hab({ estrella: F.ESTRELLAS.blue_giant }), 0, 0);
prueba('Habitabilidad con invernadero desbocado', hab({ estadoInvernadero: 'desbocado' }), 0, 0);
prueba('Habitabilidad con O₂ = 35 % (incendios)', hab({ o2: 35 }), 40, 60);
prueba('Habitabilidad a 0,05 bar (bajo el límite de Armstrong)', hab({ P_bar: 0.05 }), 0, 0);
prueba('Habitabilidad a 0,3 bar con 21 % de O₂ (pO₂ = 6 %, como a 9 km de altura)', hab({ P_bar: 0.3 }), 0, 70);
prueba('Índice UV en el ecuador, equinoccio (OMS: ~12)', F.indiceUV(0, 0, 20.95), 11, 13.5);
verdad('Sin capa de ozono el índice UV se multiplica', F.indiceUV(0, 0, 0.1) > 5 * F.indiceUV(0, 0, 20.95));
{
    const e = F.espectroTransito({ T_C: 15, P_bar: 1.013, co2: 420, o2: 20.95, ch4: 1.9 });
    const z = (um) => e.puntos.reduce((a, b) => (Math.abs(b.um - um) < Math.abs(a.um - um) ? b : a)).z_km;
    prueba('Escala de altura de la atmósfera terrestre', e.H_km, 8, 9, 'km');
    prueba('Tránsito: rasgo del O₃ a 9,8 µm (Kaltenegger & Traub 2009: ~30 km sobre el continuo)', z(9.8) - 6, 27, 33, 'km');
    prueba('Tránsito: Rayleigh a 0,4 µm (~30–50 km)', z(0.4), 25, 50, 'km');
    const sinO2 = F.espectroTransito({ T_C: 15, P_bar: 1.013, co2: 420, o2: 0, ch4: 1.9 });
    verdad('Sin O₂ desaparece el rasgo del O₃', sinO2.puntos.reduce((a, b) => (Math.abs(b.um - 9.8) < Math.abs(a.um - 9.8) ? b : a)).z_km < 8);
}
verdad('Luz del Sol blanca y de una enana M anaranjada', F.colorCuerpoNegro(5772).every((v) => v > 0.99) && F.colorCuerpoNegro(3042)[2] < 0.4);
prueba('Diámetro angular del Sol desde 1 UA', F.diametroAngular_rad(sol, 1) * 180 / Math.PI, 0.52, 0.54, '°');
verdad('Pigmento para el Sol: verde', F.pigmentoPorEstrella(5772) === 'green');
verdad('Pigmento para una enana M: negro (Kiang 2007)', F.pigmentoPorEstrella(3042) === 'black');
prueba('Pico de fotones de una enana M5.5', F.picoFotones_um(3042), 1.1, 1.3, 'µm');

console.log(`\n${fallos === 0 ? 'TODAS LAS PRUEBAS PASARON' : fallos + ' PRUEBA(S) FALLARON'}\n`);
process.exit(fallos ? 1 : 0);
