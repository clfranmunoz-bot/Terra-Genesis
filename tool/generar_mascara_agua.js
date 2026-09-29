// Genera textures/earth_water_8k.png (máscara de agua 8K) a partir de la Blue Marble 2002 de la NASA.
// Uso:
//   curl -O https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_8192.tif
//   sips -s format bmp land_shallow_topo_8192.tif --out nasa.bmp
//   node tool/generar_mascara_agua.js nasa.bmp
// Sin dependencias: lector BMP y codificador PNG mínimos.
const fs = require('fs'), zlib = require('zlib'), path = require('path');

function leerBMP(ruta) {
    const b = fs.readFileSync(ruta);
    const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
    const h = Math.abs(hRaw), bpc = bpp / 8, fila = Math.ceil(w * bpc / 4) * 4;
    const px = (x, y) => { const yy = hRaw > 0 ? h - 1 - y : y; const i = off + yy * fila + x * bpc; return [b[i + 2], b[i + 1], b[i]]; };
    return { w, h, px };
}

const img = leerBMP(process.argv[2] || 'nasa.bmp');
const W = img.w, H = img.h;

// Azul (océano, lagos) o turquesa (agua somera: verde y azul muy por encima del rojo; la vegetación tiene poco azul)
const esAgua = ([r, g, b]) => r < 110 && ((b > r + 20 && b > g + 12) || (b > r + 40 && g > r + 30 && b > 90));

// PNG en escala de grises de 8 bits: cada fila empieza con el byte de filtro 0
const crudo = Buffer.alloc((W + 1) * H);
let agua = 0;
for (let y = 0; y < H; y++) {
    crudo[y * (W + 1)] = 0;
    // |lat| > 60°: solo el color exacto del océano (el hielo en sombra es azulado); más cerca del ecuador, cualquier azul
    const polar = Math.abs(90 - (y + 0.5) * 180 / H) > 60;
    for (let x = 0; x < W; x++) {
        const p = img.px(x, y);
        const oceano = Math.abs(p[0] - 10) <= 6 && Math.abs(p[1] - 10) <= 6 && Math.abs(p[2] - 51) <= 10;
        const v = (polar ? oceano : esAgua(p)) ? 255 : 0;
        if (v) agua++;
        crudo[y * (W + 1) + 1 + x] = v;
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
fs.writeFileSync(path.join(__dirname, '..', 'textures', 'earth_water_8k.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })), trozo('IEND', Buffer.alloc(0))
]));
console.log('fracción de agua (en píxeles equirectangulares):', (agua / (W * H)).toFixed(3));
