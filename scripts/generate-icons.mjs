// Génère les icônes PNG de l'app à partir de la géométrie de public/icon.svg.
// Node pur (zlib intégré, aucune dépendance) : rastérise l'haltère (rectangles
// arrondis) avec anti-aliasing par sur-échantillonnage, puis encode un PNG.
//
// Sortie (public/) :
//   - apple-touch-icon.png (180) : carré plein, iOS applique son propre masque
//   - icon-192.png / icon-512.png : manifest (purpose any + maskable)
//
// Usage : node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// Couleurs
const BG = [0x25, 0x63, 0xeb]; // #2563eb
const FG = [0xff, 0xff, 0xff]; // #ffffff

// Formes de l'haltère en repère 512 (identiques au SVG) : [x, y, w, h, r]
const SHAPES = [
  [150, 238, 212, 36, 18],
  [120, 196, 38, 120, 17],
  [92, 222, 30, 68, 14],
  [354, 196, 38, 120, 17],
  [390, 222, 30, 68, 14],
];

// Couverture d'un point par un rectangle arrondi (SDF) : <= 0 => à l'intérieur.
function insideRoundRect(px, py, [x, y, w, h, r]) {
  const cx = x + w / 2, cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  const dx = Math.max(qx, 0), dy = Math.max(qy, 0);
  const outside = Math.hypot(dx, dy) + Math.min(Math.max(qx, qy), 0) - r;
  return outside <= 0;
}

const SS = 4; // sur-échantillonnage anti-aliasing (4x4 = 16 échantillons)

function renderRGBA(size) {
  const scale = size / 512;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Couverture de l'haltère (fraction d'échantillons blancs)
      let hits = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = (x + (sx + 0.5) / SS) / scale;
          const py = (y + (sy + 0.5) / SS) / scale;
          if (SHAPES.some(s => insideRoundRect(px, py, s))) { hits++; }
        }
      }
      const t = hits / (SS * SS);
      const o = (y * size + x) * 4;
      buf[o] = Math.round(BG[0] * (1 - t) + FG[0] * t);
      buf[o + 1] = Math.round(BG[1] * (1 - t) + FG[1] * t);
      buf[o + 2] = Math.round(BG[2] * (1 - t) + FG[2] * t);
      buf[o + 3] = 255; // carré plein (pas de coins transparents : iOS/maskable)
    }
  }
  return buf;
}

// ─── Encodage PNG minimal (IHDR + IDAT + IEND) ───────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // couleur RGBA
  // Scanlines filtrées (filtre 0) : 1 octet de filtre + ligne
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
];

for (const [name, size] of targets) {
  const png = encodePNG(size, renderRGBA(size));
  writeFileSync(join(OUT, name), png);
  console.log(`✓ ${name} (${size}×${size}, ${(png.length / 1024).toFixed(1)} Ko)`);
}
