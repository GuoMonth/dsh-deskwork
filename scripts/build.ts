import { build as bundle } from 'esbuild';
import { build as buildUi } from 'vite';
import './generate-tokens.ts';
await Promise.all([
  bundle({
    entryPoints: ['src/host/main.ts'],
    outfile: 'dist/host/main.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    target: 'node24',
    sourcemap: true,
  }),
  bundle({
    entryPoints: ['src/host/preload.ts'],
    outfile: 'dist/host/preload.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    target: 'node24',
  }),
  bundle({
    entryPoints: ['src/runtime/mcp-server.ts'],
    outfile: 'dist/runtime/mcp-server.mjs',
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    target: 'node24',
  }),
  buildUi(),
]);
console.log('Desktop, preload, tool bridge and UI built.');
