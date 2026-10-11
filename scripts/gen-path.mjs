// Genera il tracciato vettoriale di "FLAMES" (Path2D) dal font display.
// Uso: node scripts/gen-path.mjs > src/flames-path.js
import opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
const buf = readFileSync('node_modules/@fontsource/big-shoulders-display/files/big-shoulders-display-latin-900-normal.woff');
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const size = 1000;
const p = font.getPath('FLAMES', 0, 0, size, { letterSpacing: 0.01 });
const bb = p.getBoundingBox();
const d = p.commands.map(c => {
  const f = n => (Math.round(n * 10) / 10).toString();
  const X = x => f(x - bb.x1), Y = y => f(y - bb.y1);
  switch (c.type) {
    case 'M': return `M${X(c.x)} ${Y(c.y)}`;
    case 'L': return `L${X(c.x)} ${Y(c.y)}`;
    case 'Q': return `Q${X(c.x1)} ${Y(c.y1)} ${X(c.x)} ${Y(c.y)}`;
    case 'C': return `C${X(c.x1)} ${Y(c.y1)} ${X(c.x2)} ${Y(c.y2)} ${X(c.x)} ${Y(c.y)}`;
    case 'Z': return 'Z';
  }
}).join('');
// posizione della "A" per lo zoom attraverso la lettera
const glyphs = font.stringToGlyphs('FLAMES');
let x = 0; const adv = [];
for (const g of glyphs) { adv.push(x); x += g.advanceWidth * size / font.unitsPerEm + 0.01 * size; }
console.log(`// Generato da scripts/gen-path.mjs — non modificare a mano.
export const FLAMES_D = '${d}';
export const FLAMES_W = ${Math.round(bb.x2 - bb.x1)};
export const FLAMES_H = ${Math.round(bb.y2 - bb.y1)};
export const LETTER_X = ${JSON.stringify(adv.map(a => Math.round(a - bb.x1)))};`);
