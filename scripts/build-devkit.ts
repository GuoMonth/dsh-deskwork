import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, rm, cp } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('packages/plugin-sdk/lib', { recursive: true, force: true });
execFileSync(
  process.execPath,
  ['node_modules/typescript/bin/tsc', '-p', 'packages/plugin-sdk/tsconfig.build.json'],
  { stdio: 'inherit' },
);
await rm('packages/plugin-devkit/lib', { recursive: true, force: true });
await mkdir('packages/plugin-devkit/docs', { recursive: true });
await copyFile(
  'packages/plugin-sdk/src/contracts.ts',
  'packages/plugin-devkit/docs/sdk-contracts.txt',
);
await build({
  entryPoints: ['packages/plugin-devkit/src/cli.ts', 'packages/plugin-devkit/src/plugin.ts'],
  outdir: 'packages/plugin-devkit/lib',
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node24',
});
await mkdir('dist/runtime/devkit', { recursive: true });
for (const entry of ['lib', 'docs', 'skills', 'templates', 'README.md', 'package.json']) {
  await cp(`packages/plugin-devkit/${entry}`, `dist/runtime/devkit/${entry}`, {
    recursive: true,
    force: true,
  });
}
console.log('Public SDK and offline plugin development kit built.');
