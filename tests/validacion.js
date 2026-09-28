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
prueba('Forzamiento 2×CO₂', F.forzamientoCO2(2 * F.PREINDUSTRIAL.co2), 3.6, 3.8, 'W/m²');
prueba('Forzamiento CH₄ actual (AR6: 0,54)', F.forzamientoCH4(1.9, 0.335), 0.45, 0.6, 'W/m²');
prueba('Forzamiento N₂O actual (AR6: 0,21)', F.forzamientoN2O(0.335, 1.9), 0.17, 0.25, 'W/m²');
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
verdad('+1.200 m no es físicamente posible (máx. ±250 m)', !F.nivelMarFisicamentePosible(1200));
prueba('Luminosidad solar hace 700 Ma (bola de nieve)', F.luminosidadSolar(-700), 0.93, 0.95);
prueba('Luminosidad solar en +1 Ga', F.luminosidadSolar(1000), 1.08, 1.12);

console.log(`\n${fallos === 0 ? 'TODAS LAS PRUEBAS PASARON' : fallos + ' PRUEBA(S) FALLARON'}\n`);
process.exit(fallos ? 1 : 0);
