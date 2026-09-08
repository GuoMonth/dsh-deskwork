import { build } from 'esbuild';
await build({
  entryPoints: ['plugins/senguo-query/src/index.ts'],
  outfile: 'plugins/senguo-query/lib/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
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
