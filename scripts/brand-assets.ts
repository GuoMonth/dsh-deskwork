import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

export const brandSizes = [16, 32, 64, 128, 256, 512, 1024] as const;
const brandRoot = fileURLToPath(new URL('../packaging/brand/', import.meta.url));

type RenderOptions = { readonly monochrome?: boolean };

function monochromeSvg(svg: string): string {
  return svg.replaceAll(/#[0-9a-f]{6}/gi, '#000000');
}

export async function renderBrandPng(
  svg: string,
  size: number,
  options: RenderOptions = {},
): Promise<Buffer> {
  const source = options.monochrome ? monochromeSvg(svg) : svg;
  return sharp(Buffer.from(source)).resize(size, size).png().toBuffer();
}

export async function buildBrandAssets(svg: string): Promise<ReadonlyMap<string, Buffer>> {
  const assets = new Map<string, Buffer>();
  for (const size of brandSizes)
    assets.set(`mark-${String(size)}.png`, await renderBrandPng(svg, size));
  const app = assets.get('mark-512.png');
  if (!app) throw new Error('Missing generated 512px brand mark');
  assets.set('app.png', app);
  assets.set('tray.png', await renderBrandPng(svg, 32));
  assets.set('trayTemplate.png', await renderBrandPng(svg, 22, { monochrome: true }));
  assets.set('trayTemplate@2x.png', await renderBrandPng(svg, 44, { monochrome: true }));
  const icnsLength = 16 + app.length;
  const icns = Buffer.alloc(icnsLength);
  icns.write('icns', 0, 'ascii');
  icns.writeUInt32BE(icnsLength, 4);
  icns.write('ic09', 8, 'ascii');
  icns.writeUInt32BE(app.length + 8, 12);
  app.copy(icns, 16);
  assets.set('app.icns', icns);
  return assets;
}

export async function generateBrandAssets(root = brandRoot): Promise<void> {
  const svg = await readFile(join(root, 'mark.svg'), 'utf8');
  const assets = await buildBrandAssets(svg);
  await mkdir(root, { recursive: true });
  await Promise.all([...assets].map(([name, contents]) => writeFile(join(root, name), contents)));
  console.log(
    `Generated ${String(assets.size)} brand assets from ${String(svg.length)} SVG bytes.`,
  );
}

export function repositoryBrandRoot(): string {
  return resolve(brandRoot);
}
