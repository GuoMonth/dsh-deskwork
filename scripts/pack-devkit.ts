import './build-devkit.ts';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const destination = resolve('.artifacts/devkit');
await mkdir(destination, { recursive: true });
for (const directory of ['plugin-sdk', 'plugin-devkit']) {
  execFileSync('npm', ['pack', `./packages/${directory}`, '--pack-destination', destination], {
    stdio: 'inherit',
  });
}
