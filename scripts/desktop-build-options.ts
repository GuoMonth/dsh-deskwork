import type { BuildOptions } from 'esbuild';

export const desktopBuildOptions: BuildOptions[] = [
  {
    entryPoints: ['src/runtime/browser-service.ts'],
    outfile: 'dist/runtime/browser-service.mjs',
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    target: 'node24',
  },
  {
    entryPoints: ['src/host/main.ts'],
    outfile: 'dist/host/main.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    target: 'node24',
    sourcemap: true,
  },
  {
    entryPoints: ['src/host/preload.ts'],
    outfile: 'dist/host/preload.cjs',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
    target: 'node24',
  },
  {
    entryPoints: ['src/runtime/mcp-server.ts'],
    outfile: 'dist/runtime/mcp-server.mjs',
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    target: 'node24',
  },
];
