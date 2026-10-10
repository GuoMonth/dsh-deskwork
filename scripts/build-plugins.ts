import { build } from 'esbuild';
await build({
  entryPoints: ['tests/fixtures/native-approval.ts'],
  outfile: '.artifacts/native-approval/plugin.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  target: 'node24',
});
await build({
  entryPoints: ['tests/fixtures/query-plugin/index.ts'],
  outfile: 'tests/fixtures/query-plugin/lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});

await build({
  entryPoints: ['tests/fixtures/query-plugin/install-check.ts'],
  outfile: 'tests/fixtures/query-plugin/lib/install-check.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
