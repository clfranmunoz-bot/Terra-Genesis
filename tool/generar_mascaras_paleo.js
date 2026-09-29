// Genera textures/paleo_agua.png: máscaras de agua de los tres paleomapas en una sola textura RGB (R = 65 Ma, G = 150 Ma, B = 240 Ma).
// Antes el shader deducía el agua por el color de cada píxel en cada cuadro; ahora se calcula una vez con la misma regla.
// Uso (macOS):
//   for m in 065 150 240; do sips -s format bmp textures/paleo_${m}ma_2048.jpg --out /tmp/paleo_$m.bmp; done
//   node tool/generar_mascaras_paleo.js /tmp/paleo_065.bmp /tmp/paleo_150.bmp /tmp/paleo_240.bmp
const fs = require('fs'), zlib = require('zlib'), path = require('path');

function leerBMP(ruta) {
    const b = fs.readFileSync(ruta);
    const off = b.readUInt32LE(10), w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
    const h = Math.abs(hRaw), bpc = bpp / 8, fila = Math.ceil(w * bpc / 4) * 4;
    const px = (x, y) => { const yy = hRaw > 0 ? h - 1 - y : y; const i = off + yy * fila + x * bpc; return [b[i + 2] / 255, b[i + 1] / 255, b[i] / 255]; };
    return { w, h, px };
}
// Regla original del shader: agua = azul dominante, o azul claro con poco verde
const esAgua = ([r, g, b]) => b > r + 0.06 || (b > 0.42 && b > g * 0.9);

const mapas = process.argv.slice(2, 5).map(leerBMP);
const { w: W, h: H } = mapas[0];
const bin = mapas.map((m) => { const a = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = esAgua(m.px(x, y)) ? 255 : 0; return a; });

// Media 3×3 para costas suaves (la longitud da la vuelta)
const crudo = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
    crudo[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) {
        let s = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -1; dx <= 1; dx++) { s += bin[c][yy * W + (x + dx + W) % W]; n++; } }
        crudo[y * (W * 3 + 1) + 1 + x * 3 + c] = Math.round(s / n);
    }
}

const crcTabla = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTabla[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const trozo = (tipo, datos) => {
    const t = Buffer.from(tipo), len = Buffer.alloc(4), c = Buffer.alloc(4);
    len.writeUInt32BE(datos.length); c.writeUInt32BE(crc(Buffer.concat([t, datos])));
    return Buffer.concat([len, t, datos, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
fs.writeFileSync(path.join(__dirname, '..', 'textures', 'paleo_agua.png'), Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr), trozo('IDAT', zlib.deflateSync(crudo, { level: 9 })), trozo('IEND', Buffer.alloc(0))
]));
console.log('textures/paleo_agua.png generada', W + '×' + H, 'fracción de agua:', bin.map((a) => (a.reduce((s, v) => s + (v > 0), 0) / a.length).toFixed(2)).join(' / '));
