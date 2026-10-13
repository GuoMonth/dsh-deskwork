import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

const brandDirectory = fileURLToPath(new URL('../packaging/brand/', import.meta.url));
const brandMark = 'mark.svg';

/** Raster sizes rendered from the canonical mark; the ICNS table is assembled from these. */
export const brandSizes = [16, 32, 64, 128, 256, 512, 1024] as const;

/**
 * Representation table of the generated ICNS, matching the iconset `iconutil` derives from the
 * generated sizes. Each entry carries the PNG payload for its pixel size.
 */
export const icnsRepresentations = [
  ['icp4', 16],
  ['icp5', 32],
  ['ic11', 32],
  ['ic12', 64],
  ['ic07', 128],
  ['ic08', 256],
  ['ic13', 256],
  ['ic14', 512],
  ['ic09', 512],
  ['ic10', 1024],
] as const;

type RenderOptions = { readonly template?: boolean };

/**
 * macOS tray templates carry the mark silhouette only: the canvas rectangle is dropped and every
 * remaining fill flattens to black, so the system tints the shape for light and dark menu bars.
 */
function templateSvg(svg: string): string {
  const silhouette = svg.replace(/<rect\b[^>]*\/>\s*/i, '');
  if (silhouette === svg) throw new Error(`${brandMark} must keep its background rect`);
  return silhouette.replaceAll(/#[0-9a-f]{3}(?:[0-9a-f]{3})?\b/gi, '#000000');
}

export async function renderBrandPng(
  svg: string,
  size: number,
  options: RenderOptions = {},
): Promise<Buffer> {
  const source = options.template ? templateSvg(svg) : svg;
  return sharp(Buffer.from(source)).resize(size, size).png().toBuffer();
}

function icnsBuffer(rasters: ReadonlyMap<number, Buffer>): Buffer {
  const entries = icnsRepresentations.map(([type, size]) => {
    const payload = raster(rasters, size);
    const header = Buffer.alloc(8);
    header.write(type, 0, 'ascii');
    header.writeUInt32BE(payload.length + header.length, 4);
    return Buffer.concat([header, payload]);
  });
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(8 + entries.reduce((total, entry) => total + entry.length, 0), 4);
  return Buffer.concat([header, ...entries]);
}

function raster(rasters: ReadonlyMap<number, Buffer>, size: number): Buffer {
  const image = rasters.get(size);
  if (!image) throw new Error(`Missing generated ${String(size)}px brand mark`);
  return image;
}

export async function buildBrandAssets(svg: string): Promise<ReadonlyMap<string, Buffer>> {
  const rasters = new Map<number, Buffer>();
  for (const size of brandSizes) rasters.set(size, await renderBrandPng(svg, size));
  const assets = new Map<string, Buffer>();
  for (const [size, image] of rasters) assets.set(`mark-${String(size)}.png`, image);
  assets.set('app.png', raster(rasters, 512));
  assets.set('app.icns', icnsBuffer(rasters));
  assets.set('tray.png', raster(rasters, 32));
  assets.set('trayTemplate.png', await renderBrandPng(svg, 22, { template: true }));
  assets.set('trayTemplate@2x.png', await renderBrandPng(svg, 44, { template: true }));
  return assets;
}

/**
 * Render every derivative of the canonical mark into `destination`, replacing previous contents so
 * removed assets cannot survive a regeneration.
 */
export async function stageBrandAssets(destination = 'dist/brand'): Promise<readonly string[]> {
  const svg = await readFile(join(brandDirectory, brandMark), 'utf8');
  const assets = await buildBrandAssets(svg);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await Promise.all(
    [...assets].map(([name, contents]) => writeFile(join(destination, name), contents)),
  );
  return [...assets.keys()].sort();
}
