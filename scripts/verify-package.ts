import { z } from 'zod';
import { verifyRuntime } from '../src/runtime/desktop-runtime.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { app: { type: 'string' } } });
if (values.app && process.platform !== 'darwin') {
  throw new Error('--app is only supported for macOS app bundles');
}

const verification = await mkdtemp(join(tmpdir(), 'deskwork-installed-'));
try {
  const emptyPath = join(verification, 'bin');
  await mkdir(emptyPath);
  const sourceBundle =
    process.platform === 'darwin'
      ? resolve(values.app ?? '.artifacts/releases/mac-arm64/DSH Deskwork.app', 'Contents')
      : resolve('.artifacts/releases/linux-unpacked');
  const bundle = process.platform === 'darwin' ? sourceBundle : join(verification, 'application');
  if (process.platform !== 'darwin') await cp(sourceBundle, bundle, { recursive: true });
  const executable =
    process.platform === 'darwin'
      ? join(bundle, 'MacOS/DSH Deskwork')
      : join(bundle, 'dsh-deskwork');
  const resources = join(
    bundle,
    process.platform === 'darwin' ? 'Resources' : 'resources',
    'runtime',
  );
  await access(executable);
  const descriptor = await verifyRuntime(resources);
  console.log(
    `Verified packaged DSH ${descriptor.dshVersion}, Node ${descriptor.nodeVersion}, ${String(descriptor.files.length)} runtime files.`,
  );
  await access(join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'));
  const smoke = await promisify(execFile)(
    executable,
    ['-e', "require('koffi'); console.log(JSON.stringify(process.versions))"],
    { cwd: resources, env: { ELECTRON_RUN_AS_NODE: '1', PATH: emptyPath } },
  );
  const versions = z
    .object({ node: z.string(), modules: z.string(), electron: z.string() })
    .parse(JSON.parse(smoke.stdout));
  if (
    versions.node !== descriptor.nodeVersion ||
    versions.modules !== descriptor.nodeAbi ||
    versions.electron !== descriptor.electronVersion
  )
    throw new Error('随包可执行文件与运行时清单不匹配');

  const child = spawn(
    process.execPath,
    [
      '--test',
      'tests/runtime.integration.ts',
      'tests/desktop.integration.ts',
      'tests/plugin-runtime.integration.ts',
      'tests/plugin-desktop.integration.ts',
      'tests/development-desktop.integration.ts',
    ],
    {
      env: {
        ...process.env,
        PATH: emptyPath,
        NODE_PATH: '',
        NODE_OPTIONS: '',
        DESKWORK_TEST_WORKING_DIRECTORY: verification,
        DESKWORK_TEST_EXECUTABLE: executable,
        DESKWORK_TEST_RESOURCES: resources,
      },
      stdio: 'inherit',
    },
  );
  const code = await new Promise<number>((resolve, reject: (error: Error) => void) => {
    child.once('error', reject);
    child.on('close', (code) => {
      resolve(code ?? 1);
    });
  });
  if (code === 0) await verifyRuntime(resources);
  process.exitCode = code;
} finally {
  await rm(verification, { recursive: true, force: true });
}
