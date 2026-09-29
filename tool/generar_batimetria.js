// Genera textures/earth_bathymetry.png (2048×1024) a partir de la batimetría GEBCO publicada por la NASA.
// Uso:
//   curl -o gebco.png https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73963/gebco_08_rev_bath_21600x10800.png
//   sips -z 5400 10800 gebco.png --out gebco_10800.png && sips -s format bmp gebco_10800.png --out gebco.bmp
//   node tool/generar_batimetria.js gebco.bmp
// Fuente: GEBCO (British Oceanographic Data Centre), imagen de Jesse Allen, NASA Earth Observatory.
// Escala de la fuente, lineal (calibrada con profundidades conocidas): gris 255 = 0 m, gris 0 = −8000 m o más.
// Salida: gris = 255·√(profundidad/8000). La raíz da más resolución a lo somero (plataformas continentales);
// el shader la invierte con profundidad = 8000·v². Cada píxel de salida promedia ~27 de entrada, lo que recupera
// precisión por debajo de los ~31 m de un nivel de gris de la fuente.
const fs = require('fs'), zlib = require('zlib'), path = require('path');

function leerBMP(ruta) {
    const b = fs.readFileSync(ruta);
    const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
    const h = Math.abs(hRaw), bpc = bpp / 8, fila = Math.ceil(w * bpc / 4) * 4;
    const gris = (x, y) => b[off + (hRaw > 0 ? h - 1 - y : y) * fila + x * bpc];
    return { w, h, gris };
}

const src = leerBMP(process.argv[2] || 'gebco.bmp');
const W = 2048, H = 1024, sx = src.w / W, sy = src.h / H;
const crudo = Buffer.alloc((W + 1) * H);
for (let y = 0; y < H; y++) {
    crudo[y * (W + 1)] = 0;
    const y0 = Math.floor(y * sy), y1 = Math.floor((y + 1) * sy);
    for (let x = 0; x < W; x++) {
        const x0 = Math.floor(x * sx), x1 = Math.floor((x + 1) * sx);
        let suma = 0, n = 0;
        for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { suma += src.gris(xx, yy); n++; }
        const profundidad = 8000 * (1 - suma / n / 255);            // m, promedio del bloque
        crudo[y * (W + 1) + 1 + x] = Math.round(255 * Math.sqrt(Math.max(0, profundidad) / 8000));
    }
}

const crcTabla = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const trozo = (tipo, datos) => {
    const t = Buffer.from(tipo), len = Buffer.alloc(4), c = Buffer.alloc(4);
    len.writeUInt32BE(datos.length); c.writeUInt32BE(crc(Buffer.concat([t, datos])));
    return Buffer.concat([len, t, datos, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 0;
fs.writeFileSync(path.join(__dirname, '..', 'textures', 'earth_bathymetry.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })), trozo('IEND', Buffer.alloc(0))
]));
console.log('textures/earth_bathymetry.png generada (2048×1024)');
