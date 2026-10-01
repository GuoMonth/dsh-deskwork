// Relocatable runtime inventory adapted from DeepSeek 639ed015 (MIT), packaging/DSH-LICENSE.
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { z } from 'zod';

export const runtimeDescriptorFile = 'desktop-runtime.json';
const fileSchema = z.object({
  path: z
    .string()
    .refine(
      (path) =>
        path !== '' &&
        !path.includes('\\') &&
        !path.includes(':') &&
        !path.split('/').some((part) => ['', '.', '..'].includes(part)),
    ),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  executable: z.boolean(),
});
const descriptorSchema = z
  .object({
    schemaVersion: z.literal(1),
    appVersion: z.string(),
    dshVersion: z.string(),
    electronVersion: z.string(),
    nodeVersion: z.string(),
    nodeAbi: z.string(),
    pnpmVersion: z.string(),
    lockSha256: z.string(),
    platform: z.enum(['darwin', 'linux', 'win32']),
    arch: z.enum(['arm64', 'x64']),
    packages: z.record(z.string(), z.string()),
    files: z.array(fileSchema),
  })
  .strict();
export type RuntimeDescriptor = z.infer<typeof descriptorSchema>;

async function inventory(root: string): Promise<RuntimeDescriptor['files']> {
  const files: RuntimeDescriptor['files'] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const name = relative(root, path).split(sep).join('/');
      if (name === runtimeDescriptorFile) continue;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        const body = await readFile(path);
        files.push({
          path: name,
          bytes: body.byteLength,
          sha256: createHash('sha256').update(body).digest('hex'),
          executable: process.platform !== 'win32' && ((await lstat(path)).mode & 0o111) !== 0,
        });
      } else throw new Error(`运行时包含未物化的链接：${name}`);
    }
  };
  await visit(root);
  return files.sort((left, right) => left.path.localeCompare(right.path, 'en'));
}

export async function sealRuntime(
  root: string,
  metadata: Omit<RuntimeDescriptor, 'files'>,
): Promise<void> {
  const descriptor = descriptorSchema.parse({ ...metadata, files: await inventory(root) });
  await writeFile(join(root, runtimeDescriptorFile), JSON.stringify(descriptor, null, 2) + '\n');
}

export async function readRuntimeDescriptor(
  root: string,
  target: { platform: string; arch: string } = process,
): Promise<RuntimeDescriptor> {
  const descriptor = descriptorSchema.parse(
    JSON.parse(await readFile(join(root, runtimeDescriptorFile), 'utf8')),
  );
  if (descriptor.platform !== target.platform || descriptor.arch !== target.arch)
    throw new Error('随包运行时的平台或架构不匹配');
  if (
    descriptor.packages['@deepseek-ai/dsh'] !== descriptor.dshVersion ||
    descriptor.packages['pnpm'] !== descriptor.pnpmVersion
  )
    throw new Error('随包核心版本与运行时清单不匹配');
  const paths = descriptor.files.map((file) => file.path);
  if (new Set(paths).size !== paths.length) throw new Error('运行时清单包含重复路径');
  for (const required of [
    'node_modules/@deepseek-ai/dsh/lib/bin.js',
    'node_modules/pnpm/bin/pnpm.cjs',
    'dist/runtime/sdk-server.mjs',
    'dist/runtime/mcp-server.mjs',
    'dist/runtime/browser-service.mjs',
    'dist/runtime/devkit/lib/plugin.js',
  ]) {
    if (!paths.includes(required)) throw new Error(`随包运行时缺少 ${required}`);
  }
  return descriptor;
}

export async function verifyRuntime(
  root: string,
  target: { platform: string; arch: string } = process,
): Promise<RuntimeDescriptor> {
  const descriptor = await readRuntimeDescriptor(root, target);
  const actual = await inventory(root);
  if (JSON.stringify(actual) !== JSON.stringify(descriptor.files))
    throw new Error('随包运行时文件、内容或执行权限与清单不匹配');
  for (const [name, version] of Object.entries(descriptor.packages)) {
    const manifest = z
      .object({ name: z.string(), version: z.string() })
      .parse(JSON.parse(await readFile(join(root, 'node_modules', name, 'package.json'), 'utf8')));
    if (manifest.name !== name || manifest.version !== version)
      throw new Error(`随包依赖版本不匹配：${name}`);
  }
  return descriptor;
}
