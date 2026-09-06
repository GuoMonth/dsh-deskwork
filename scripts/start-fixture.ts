import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import electron from 'electron';
import { startWebsite } from '../tests/fixtures/websites.ts';
const directory = await mkdtemp(join(tmpdir(), 'deskwork-example-'));
const first = await startWebsite('directory');
const second = await startWebsite('settings');
await writeFile(
  join(directory, 'workspace.json'),
  JSON.stringify({
    version: 2,
    name: '本地验证',
    sites: [first, second].map((website, index) => ({
      id: `example-${String(index)}`,
      sessionId: `example-${String(index)}`,
      name: index === 0 ? 'Directory fixture' : 'Settings fixture',
      url: website.origin,
    })),
  }),
);
// Synthetic sites only; model settings are entered by the developer in the desktop UI.
const executable: unknown = electron;
if (typeof executable !== 'string') throw new Error('Electron executable unavailable');
const child = spawn(
  executable,
  ['.', `--profile-directory=${directory}`, ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
try {
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => {
      process.exitCode = code ?? 1;
      resolve();
    });
  });
} finally {
  await first.close();
  await second.close();
  await rm(directory, { recursive: true, force: true });
}
