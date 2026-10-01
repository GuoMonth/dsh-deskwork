import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { cp, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { z } from 'zod';
import { sealRuntime, verifyRuntime } from '../src/runtime/desktop-runtime.ts';
import { runtimeFileExclusion } from './runtime-file-policy.ts';

const run = promisify(execFile);
const manifest = z
  .object({
    name: z.string(),
    version: z.string(),
    type: z.string(),
    main: z.string(),
    description: z.string(),
    author: z.string(),
    license: z.string(),
    dependencies: z.record(z.string(), z.string()),
    devDependencies: z.record(z.string(), z.string()),
  })
  .parse(JSON.parse(await readFile('package.json', 'utf8')));
const lock = await readFile('package-lock.json');
const root = resolve('.artifacts/desktop-runtime');
const application = resolve('.artifacts/desktop-app');
const staging = await mkdtemp(join(tmpdir(), 'deskwork-production-'));
try {
  await copyFile('package.json', join(staging, 'package.json'));
  await copyFile('package-lock.json', join(staging, 'package-lock.json'));
  await run('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund', '--prefer-offline'], {
    cwd: staging,
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024,
  });
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });
  await cp(join(staging, 'node_modules'), join(root, 'node_modules'), {
    recursive: true,
    dereference: true,
    filter: (source) => !runtimeFileExclusion(source.slice(staging.length + 1), process),
  });
  await cp('dist/runtime', join(root, 'dist/runtime'), { recursive: true, dereference: true });
  await copyFile('packaging/DSH-LICENSE', join(root, 'DSH-LICENSE'));
  const executable = z.string().parse(createRequire(import.meta.url)('electron'));
  const { stdout } = await run(executable, ['-p', 'JSON.stringify(process.versions)'], {
    env: { ELECTRON_RUN_AS_NODE: '1' },
  });
  const versions = z
    .object({ electron: z.string(), node: z.string(), modules: z.string() })
    .parse(JSON.parse(stdout));
  const packages: Record<string, string> = {};
  for (const name of Object.keys(manifest.dependencies)) {
    packages[name] = z
      .object({ version: z.string() })
      .parse(
        JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')),
      ).version;
  }
  const dshVersion = z.string().parse(packages['@deepseek-ai/dsh']);
  for (const [name, version] of Object.entries(packages)) {
    if (name.startsWith('@deepseek-ai/dsh') && version !== dshVersion)
      throw new Error(`DSH 版本未对齐：${name}`);
  }
  await sealRuntime(root, {
    schemaVersion: 1,
    appVersion: manifest.version,
    dshVersion,
    electronVersion: versions.electron,
    nodeVersion: versions.node,
    nodeAbi: versions.modules,
    pnpmVersion: z.string().parse(packages['pnpm']),
    lockSha256: createHash('sha256').update(lock).digest('hex'),
    platform: z.enum(['darwin', 'linux', 'win32']).parse(process.platform),
    arch: z.enum(['arm64', 'x64']).parse(process.arch),
    packages,
  });
  const descriptor = await verifyRuntime(root);
  await rm(application, { recursive: true, force: true });
  await mkdir(application, { recursive: true });
  await cp('dist/host', join(application, 'dist/host'), { recursive: true });
  await cp('dist/ui', join(application, 'dist/ui'), { recursive: true });
  await writeFile(
    join(application, 'package.json'),
    JSON.stringify({ ...manifest, dependencies: {}, devDependencies: undefined }, null, 2),
  );
  console.log(
    `Prepared ${descriptor.dshVersion} runtime (${String(descriptor.files.length)} files), Electron ${descriptor.electronVersion}/Node ${descriptor.nodeVersion}, ${descriptor.platform}/${descriptor.arch}.`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}
