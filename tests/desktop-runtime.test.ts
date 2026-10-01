import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  sealRuntime,
  readRuntimeDescriptor,
  verifyRuntime,
} from '../src/runtime/desktop-runtime.ts';
import { runtimeFileExclusion } from '../scripts/runtime-file-policy.ts';

await test('runtime descriptor rejects a wrong target and missing or changed native bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deskwork-inventory-'));
  const files = [
    'node_modules/@deepseek-ai/dsh/lib/bin.js',
    'node_modules/pnpm/bin/pnpm.cjs',
    'dist/runtime/sdk-server.mjs',
    'dist/runtime/mcp-server.mjs',
    'dist/runtime/browser-service.mjs',
    'dist/runtime/devkit/lib/plugin.js',
    'node_modules/native/binding.node',
  ];
  try {
    for (const path of files) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), 'fixture');
    }
    for (const name of ['@deepseek-ai/dsh', 'pnpm'])
      await writeFile(
        join(root, 'node_modules', name, 'package.json'),
        JSON.stringify({ name, version: name === 'pnpm' ? '11.20.0' : '0.2.0-rc.2' }),
      );
    await sealRuntime(root, {
      schemaVersion: 1,
      appVersion: '0.2.0-alpha.2',
      dshVersion: '0.2.0-rc.2',
      electronVersion: '44.0.0',
      nodeVersion: '24.18.1',
      nodeAbi: '149',
      pnpmVersion: '11.20.0',
      lockSha256: 'fixture',
      platform: 'darwin',
      arch: 'arm64',
      packages: { '@deepseek-ai/dsh': '0.2.0-rc.2', pnpm: '11.20.0' },
    });
    const target = { platform: 'darwin', arch: 'arm64' };
    await verifyRuntime(root, target);
    await assert.rejects(
      readRuntimeDescriptor(root, { platform: 'darwin', arch: 'x64' }),
      /architecture does not match/i,
    );
    await writeFile(join(root, 'node_modules/native/binding.node'), 'modified bytes');
    await assert.rejects(verifyRuntime(root, target), /files, contents or executable permissions/i);
    await writeFile(join(root, 'node_modules/native/binding.node'), 'fixture');
    await rm(join(root, 'node_modules/native/binding.node'));
    await assert.rejects(verifyRuntime(root, target), /files, contents or executable permissions/i);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('runtime materialization retains target natives and unknown assets', () => {
  const target = { platform: 'darwin', arch: 'arm64' };
  assert.equal(
    runtimeFileExclusion('node_modules/node-pty/prebuilds/darwin-arm64/pty.node', target),
    false,
  );
  assert.equal(
    runtimeFileExclusion('node_modules/node-pty/prebuilds/linux-x64/pty.node', target),
    true,
  );
  assert.equal(
    runtimeFileExclusion(
      'node_modules/@koromix/koffi-darwin-arm64/darwin_arm64/koffi.node',
      target,
    ),
    false,
  );
  assert.equal(
    runtimeFileExclusion('node_modules/@koromix/koffi-darwin-x64/darwin_x64/koffi.node', target),
    true,
  );
  assert.equal(runtimeFileExclusion('node_modules/extension/assets/unknown.bin', target), false);
});
