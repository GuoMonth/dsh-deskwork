import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';

const root = resolve('.');
const brandRoot = join(root, 'packaging/brand');

test('brand derivatives are generated from the canonical SVG', async () => {
  const svg = await readFile(join(brandRoot, 'mark.svg'), 'utf8');
  assert.match(svg, /<svg[\s\S]*viewBox="0 0 256 256"/);
  for (const [name, size] of [
    ['mark-16.png', 16],
    ['mark-32.png', 32],
    ['mark-64.png', 64],
    ['mark-128.png', 128],
    ['mark-256.png', 256],
    ['mark-512.png', 512],
    ['mark-1024.png', 1024],
    ['app.png', 512],
    ['trayTemplate.png', 22],
    ['trayTemplate@2x.png', 44],
  ] as const) {
    const image = sharp(await readFile(join(brandRoot, name)));
    const metadata = await image.metadata();
    assert.equal(metadata.width, size, name);
    assert.equal(metadata.height, size, name);
    assert.equal(metadata.hasAlpha, true, name);
  }
  const template = await sharp(await readFile(join(brandRoot, 'trayTemplate.png')))
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < template.data.length; offset += template.info.channels) {
    assert.equal(template.data[offset], template.data[offset + 1], 'template is monochrome');
    assert.equal(template.data[offset], template.data[offset + 2], 'template is monochrome');
  }
});

test('ICNS contains the generated application PNG payload', async () => {
  const icns = await readFile(join(brandRoot, 'app.icns'));
  assert.equal(icns.subarray(0, 4).toString('ascii'), 'icns');
  assert.equal(icns.readUInt32BE(4), icns.length);
  assert.equal(icns.subarray(8, 12).toString('ascii'), 'ic09');
  assert.equal(icns.subarray(16, 24).toString('hex'), '89504e470d0a1a0a');
});

test('UI consumes the canonical SVG instead of a second mark definition', async () => {
  const source = await readFile(join(root, 'src/ui/brand/mark.tsx'), 'utf8');
  assert.match(source, /packaging\/brand\/mark\.svg\?raw/);
});

test('desktop packaging and prepared app include the brand directory', async () => {
  const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
    build?: { mac?: { icon?: string }; linux?: { icon?: string }; files?: string[] };
  };
  assert.equal(packageJson.build?.mac?.icon, 'packaging/brand/app.icns');
  assert.equal(packageJson.build?.linux?.icon, 'packaging/brand/app.png');
  assert.ok(packageJson.build?.files?.includes('dist/**'));
  const prepare = await readFile(join(root, 'scripts/prepare-desktop-runtime.ts'), 'utf8');
  assert.match(prepare, /dist\/brand/);
});
