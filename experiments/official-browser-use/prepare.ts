import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';

const directory = resolve('.artifacts/official-dsh');
await mkdir(directory, { recursive: true });
await writeFile(
  join(directory, 'package.json'),
  JSON.stringify(
    {
      name: 'deskwork-official-dsh-research',
      private: true,
      type: 'module',
      dependencies: Object.fromEntries(
        [
          '@deepseek-ai/dsh',
          '@deepseek-ai/dsh-browser-use',
          '@deepseek-ai/dsh-experimental-browser-use-playwright-mcp',
        ].map((name) => [name, '0.2.0-rc.2']),
      ),
    },
    null,
    2,
  ) + '\n',
);
const result = await promisify(execFile)(
  'npm',
  ['install', '--prefix', directory, '--no-audit', '--no-fund'],
  { timeout: 120000, maxBuffer: 2 * 1024 * 1024 },
);
await writeFile(resolve('.artifacts/official-install.log'), result.stdout + result.stderr);
console.log('Official DSH and browser provider prepared in .artifacts/official-dsh.');
