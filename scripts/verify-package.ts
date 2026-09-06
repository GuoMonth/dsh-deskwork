import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const bundle =
  process.platform === 'darwin'
    ? resolve('.artifacts/releases/mac-arm64/DSH Deskwork.app/Contents')
    : resolve('.artifacts/releases/linux-unpacked');
const executable =
  process.platform === 'darwin' ? join(bundle, 'MacOS/DSH Deskwork') : join(bundle, 'dsh-deskwork');
const resources = join(
  bundle,
  process.platform === 'darwin' ? 'Resources' : 'resources',
  'app.asar.unpacked',
);
await access(executable);
await access(join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'));
const child = spawn(
  process.execPath,
  ['--test', 'tests/runtime.integration.ts', 'tests/desktop.integration.ts'],
  {
    env: {
      ...process.env,
      DESKWORK_TEST_EXECUTABLE: executable,
      DESKWORK_TEST_RESOURCES: resources,
    },
    stdio: 'inherit',
  },
);
child.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});
child.on('close', (code) => {
  process.exitCode = code ?? 1;
});
