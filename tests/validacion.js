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

console.log(`\n${fallos === 0 ? 'TODAS LAS PRUEBAS PASARON' : fallos + ' PRUEBA(S) FALLARON'}\n`);
process.exit(fallos ? 1 : 0);
