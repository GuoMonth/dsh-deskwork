import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const root = new URL('../', import.meta.url).pathname;
const out = join(root, 'packaging/brand');
const svg = await readFile(join(out, 'mark.svg'), 'utf8');
const sizes = [16, 32, 64, 128, 256, 512, 1024] as const;
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array): Uint8Array {
  const t = new TextEncoder().encode(type); const all = new Uint8Array(t.length + data.length); all.set(t); all.set(data, t.length);
  const b = new Uint8Array(12 + data.length); const v = new DataView(b.buffer); v.setUint32(0, data.length); b.set(t, 4); b.set(data, 8); v.setUint32(8 + data.length, crc32(all)); return b;
}
function png(size: number, monochrome = false): Uint8Array {
  const rows = new Uint8Array(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { rows[y * (size * 4 + 1)] = 0; for (let x = 0; x < size; x++) { const i = y * (size * 4 + 1) + 1 + x * 4; const edge = Math.min(x, y, size - 1 - x, size - 1 - y); const inside = edge >= size * 0.08; const dark = monochrome ? 0 : 32; const nx = x / size * 256, ny = y / size * 256; const dOuter = nx >= 54 && nx < 174 && ny >= 44 && ny < 212 && (nx < 101 || ((nx - 101) ** 2 + (ny - 128) ** 2 <= 84 ** 2)); const dInner = nx > 101 && nx < 148 && ny > 82 && ny < 174 && ((nx - 101) ** 2 + (ny - 128) ** 2 > 46 ** 2); const dot = (nx - 174) ** 2 + (ny - 61) ** 2 <= 13 ** 2; const white = dOuter && !dInner; rows[i] = inside ? (white ? 255 : dark) : 0; rows[i + 1] = inside ? (white ? 255 : dark + 5) : 0; rows[i + 2] = inside ? (white ? 255 : dark + 11) : 0; rows[i + 3] = inside ? 255 : 0; if (inside && dot) { rows[i] = monochrome ? 255 : 74; rows[i + 1] = monochrome ? 255 : 199; rows[i + 2] = monochrome ? 255 : 194; } } }
  const head = new Uint8Array(13); const view = new DataView(head.buffer); view.setUint32(0, size); view.setUint32(4, size); head[8] = 8; head[9] = 6;
  const result = new Uint8Array(8 + chunk('IHDR', head).length + chunk('IDAT', deflateSync(rows)).length + chunk('IEND', new Uint8Array()).length); result.set([137,80,78,71,13,10,26,10]); let p = 8; for (const c of [chunk('IHDR', head), chunk('IDAT', deflateSync(rows)), chunk('IEND', new Uint8Array())]) { result.set(c, p); p += c.length; } return result;
}
await mkdir(out, { recursive: true });
await writeFile(join(out, 'mark.svg'), svg);
for (const size of sizes) await writeFile(join(out, `mark-${size}.png`), png(size));
await writeFile(join(out, 'app.png'), png(512));
await writeFile(join(out, 'tray.png'), png(32, true));
await writeFile(join(out, 'trayTemplate.png'), png(22, true));
await writeFile(join(out, 'trayTemplate@2x.png'), png(44, true));
const iconPng = png(512); const icns = new Uint8Array(16 + iconPng.length); new TextEncoder().encode('icns').forEach((v, i) => icns[i] = v); new DataView(icns.buffer).setUint32(4, icns.length); new TextEncoder().encode('ic09').forEach((v, i) => icns[8 + i] = v); new DataView(icns.buffer).setUint32(12, icns.length - 8); icns.set(iconPng, 16); await writeFile(join(out, 'app.icns'), icns);
console.log(`Generated ${sizes.length + 5} brand assets from ${svg.length} SVG bytes.`);
