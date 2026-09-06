import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

await test('real Electron browser action and identity boundaries', { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deskwork-browser-boundary-'));
  const executable: unknown = createRequire(import.meta.url)('electron');
  if (typeof executable !== 'string') throw new Error('Missing Electron executable');
  try {
    const entry = join(directory, 'browser-boundary.cjs');
    await build({
      entryPoints: ['tests/fixtures/browser-boundary-host.ts'],
      outfile: entry,
      bundle: true,
      platform: 'node',
      format: 'cjs',
      external: ['electron'],
      target: 'node24',
    });
    await promisify(execFile)(
      executable,
      [
        entry,
        `--user-data-dir=${join(directory, 'profile')}`,
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      ],
      { timeout: 25000 },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
