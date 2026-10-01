import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { commandSchema } from '../src/core/contracts.ts';
import { localizeMessage, translate } from '../src/core/locale.ts';
import { StateStore } from '../src/host/state-store.ts';

await test('fresh and existing workspaces default to English; language survives a new store instance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deskwork-locale-'));
  try {
    const store = new StateStore(root);
    assert.equal((await store.loadWorkspace()).locale, 'en');
    const sites = [{ id: 'one', name: '原名', url: 'https://example.test/', sessionId: 'account' }];
    await writeFile(
      join(root, 'workspace.json'),
      JSON.stringify({ version: 2, name: '原名', sites }),
    );
    const workspace = await store.loadWorkspace();
    assert.equal(workspace.locale, 'en');
    await store.saveWorkspace({ ...workspace, locale: 'zh' });
    const restored = await new StateStore(root).loadWorkspace();
    assert.equal(restored.locale, 'zh');
    assert.equal(restored.name, '原名');
    assert.deepEqual(restored.sites, sites);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('language commands reject unknown locales and extra configuration fields', () => {
  assert.deepEqual(commandSchema.parse({ type: 'language', locale: 'zh' }), {
    type: 'language',
    locale: 'zh',
  });
  for (const value of [
    { type: 'language', locale: 'fr' },
    { type: 'language', locale: 'en', apiKey: 'unexpected' },
  ])
    assert.throws(() => commandSchema.parse(value));
});

await test('host messages localize interpolated values without modifying opaque content', () => {
  assert.equal(localizeMessage('zh', 'Installing @example/package'), '正在安装 @example/package');
  assert.equal(localizeMessage('zh', 'Close 原名'), '关闭 原名');
  assert.equal(translate('zh', 'Installed · {count}', { count: 2 }), '已安装 · 2');
  assert.equal(localizeMessage('en', '原始网站字段和模型回复'), '原始网站字段和模型回复');
  assert.equal(localizeMessage('en', 'Task paused'), 'Task paused');
});
