import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import {
  brandSizes,
  buildBrandAssets,
  icnsRepresentations,
  stageBrandAssets,
} from '../scripts/brand-assets.ts';
import { brandMark } from '../src/ui/brand/mark-content.ts';

const root = resolve('.');
const brandDirectory = join(root, 'packaging/brand');
const svg = await readFile(join(brandDirectory, 'mark.svg'), 'utf8');

function asset(assets: ReadonlyMap<string, Buffer>, name: string): Buffer {
  const contents = assets.get(name);
  assert.ok(contents, `missing generated ${name}`);
  return contents;
}

function pixel(data: Buffer, offset: number): readonly [number, number, number, number] {
  return [
    data[offset] ?? -1,
    data[offset + 1] ?? -1,
    data[offset + 2] ?? -1,
    data[offset + 3] ?? -1,
  ];
}

await test('every brand derivative renders from the canonical SVG at its declared size', async () => {
  const assets = await buildBrandAssets(svg);
  assert.deepEqual(
    [...assets.keys()].sort(),
    [
      ...brandSizes.map((size) => `mark-${String(size)}.png`),
      'app.icns',
      'app.png',
      'tray.png',
      'trayTemplate.png',
      'trayTemplate@2x.png',
    ].sort(),
  );
  for (const size of brandSizes) {
    const name = `mark-${String(size)}.png`;
    const metadata = await sharp(asset(assets, name)).metadata();
    assert.equal(metadata.width, size, name);
    assert.equal(metadata.height, size, name);
    assert.equal(metadata.hasAlpha, true, name);
  }
  assert.ok(asset(assets, 'app.png').equals(asset(assets, 'mark-512.png')));
  assert.ok(asset(assets, 'tray.png').equals(asset(assets, 'mark-32.png')));
});

await test('tray templates carry the mark silhouette instead of the canvas mark', async () => {
  const assets = await buildBrandAssets(svg);
  for (const [name, size] of [
    ['trayTemplate.png', 22],
    ['trayTemplate@2x.png', 44],
  ] as const) {
    const image = sharp(asset(assets, name));
    const metadata = await image.metadata();
    assert.equal(metadata.width, size, name);
    assert.equal(metadata.height, size, name);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    let coverage = 0;
    for (let offset = 0; offset < data.length; offset += info.channels) {
      const [red, green, blue, alpha] = pixel(data, offset);
      assert.equal(red, 0, `${name} flattens every fill to black`);
      assert.equal(green, 0, `${name} flattens every fill to black`);
      assert.equal(blue, 0, `${name} flattens every fill to black`);
      if (alpha > 0) coverage++;
    }
    // The canvas rectangle must be gone, so the menu bar shows a glyph and not a filled square.
    assert.ok(coverage / (size * size) < 0.6, `${name} drops the canvas rectangle`);
    assert.ok(coverage / (size * size) > 0.1, `${name} still draws the mark`);
    assert.equal(pixel(data, 0)[3], 0, `${name} keeps a transparent background`);
  }
});

await test('the ICNS carries the iconset table of the generated mark rasters', async () => {
  const assets = await buildBrandAssets(svg);
  const icns = asset(assets, 'app.icns');
  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns');
  assert.equal(icns.readUInt32BE(4), icns.length);
  const table: string[] = [];
  let offset = 8;
  while (offset < icns.length) {
    const type = icns.subarray(offset, offset + 4).toString('ascii');
    const length = icns.readUInt32BE(offset + 4);
    const payload = icns.subarray(offset + 8, offset + length);
    const [, size] = icnsRepresentations[table.length] ?? [];
    assert.ok(size, `unexpected ICNS entry ${type}`);
    assert.equal(payload.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', type);
    assert.equal(payload.readUInt32BE(16), size, type);
    assert.equal(payload.readUInt32BE(20), size, type);
    assert.ok(payload.equals(asset(assets, `mark-${String(size)}.png`)), type);
    table.push(type);
    offset += length;
  }
  assert.deepEqual(
    table,
    icnsRepresentations.map(([type]) => type),
  );
});

await test('staging writes the generated set and clears previous contents', async () => {
  const assets = await buildBrandAssets(svg);
  const directory = await mkdtemp(join(tmpdir(), 'deskwork-brand-'));
  try {
    await writeFile(join(directory, 'mark-32.png'), 'stale');
    await writeFile(join(directory, 'retired.png'), 'stale');
    assert.deepEqual(await stageBrandAssets(directory), [...assets.keys()].sort());
    for (const name of ['app.icns', 'trayTemplate.png']) {
      assert.ok((await readFile(join(directory, name))).equals(asset(assets, name)), name);
    }
    await assert.rejects(readFile(join(directory, 'retired.png')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

await test('the shell mark inlines the canonical SVG instead of a second drawing', async () => {
  const mark = brandMark(svg);
  assert.equal(mark.viewBox, '0 0 256 256');
  assert.doesNotMatch(mark.content, /<\/?svg\b/);
  const geometry = /<path[^>]*\bd="([^"]+)"/.exec(svg)?.[1];
  assert.ok(geometry, 'the canonical SVG draws the mark with a path');
  assert.ok(mark.content.includes(geometry));
  const component = await readFile(join(root, 'src/ui/brand/mark.tsx'), 'utf8');
  assert.match(component, /packaging\/brand\/mark\.svg\?raw/);
  assert.doesNotMatch(component, /\bd="/);
});

await test('development, build, packaging and tray staging read the canonical directory', async () => {
  assert.deepEqual(await readdir(brandDirectory), ['mark.svg']);
  for (const script of ['build.ts', 'dev-desktop.ts', 'generate-brand-assets.ts']) {
    const source = await readFile(join(root, 'scripts', script), 'utf8');
    assert.match(source, /stageBrandAssets\(/, script);
  }
  const runtime = await readFile(join(root, 'scripts/prepare-desktop-runtime.ts'), 'utf8');
  assert.match(runtime, /stageBrandAssets\(join\(application, 'dist\/brand'\)\)/);
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
    build?: { mac?: { icon?: string }; linux?: { icon?: string }; files?: string[] };
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  // The packaged shell resolves `dist/brand` from `app.getAppPath()`, so both icons ship in the app.
  const build = packageJson.build;
  assert.ok(build, 'package.json declares electron-builder settings');
  assert.equal(build.mac?.icon, 'dist/brand/app.icns');
  assert.equal(build.linux?.icon, 'dist/brand/app.png');
  assert.ok(build.files?.includes('dist/**'));
  // Rendering stays a development tool: sharp must not join the runtime dependency manifest.
  assert.equal(packageJson.devDependencies?.['sharp'], '0.35.5');
  assert.equal(packageJson.dependencies?.['sharp'], undefined);
});
