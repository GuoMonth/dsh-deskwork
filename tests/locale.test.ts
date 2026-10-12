import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { commandSchema } from '../src/core/contracts.ts';
import {
  languagePreferenceSchema,
  localizeMessage,
  resolveLocale,
  translate,
} from '../src/core/locale.ts';
import { StateStore } from '../src/host/state-store.ts';
import { createPreviewBridge } from '../src/ui/preview-bridge.ts';

await test('system preference resolves at startup and explicit language survives a restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deskwork-locale-'));
  try {
    const store = new StateStore(root, ['zh-CN', 'en-US']);
    const fresh = await store.loadWorkspace();
    assert.equal(fresh.languagePreference, 'system');
    assert.equal(fresh.locale, 'zh');
    const sites = [{ id: 'one', name: '原名', url: 'https://example.test/', sessionId: 'account' }];
    await writeFile(
      join(root, 'workspace.json'),
      JSON.stringify({ version: 2, name: '原名', sites }),
    );
    const workspace = await new StateStore(root, ['en-US']).loadWorkspace();
    assert.equal(workspace.languagePreference, 'system');
    assert.equal(workspace.locale, 'en');
    await store.saveWorkspace({ ...workspace, languagePreference: 'zh', locale: 'zh' });
    const restored = await new StateStore(root, ['en-US']).loadWorkspace();
    assert.equal(restored.languagePreference, 'zh');
    assert.equal(restored.locale, 'zh');
    assert.equal(restored.name, '原名');
    assert.deepEqual(restored.sites, sites);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('a legacy effective locale without a preference migrates to system', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deskwork-locale-migration-'));
  try {
    const sites = [{ id: 'one', name: '原名', url: 'https://example.test/', sessionId: 'account' }];
    await writeFile(
      join(root, 'workspace.json'),
      JSON.stringify({ version: 2, locale: 'zh', name: '原名', sites }),
    );
    const workspace = await new StateStore(root, ['en-US']).loadWorkspace();
    assert.equal(workspace.languagePreference, 'system');
    assert.equal(workspace.locale, 'en');
    assert.deepEqual(workspace.sites, sites);
    const persisted = JSON.parse(await readFile(join(root, 'workspace.json'), 'utf8')) as {
      languagePreference?: unknown;
      locale?: unknown;
    };
    assert.equal(persisted.languagePreference, 'system');
    assert.equal(persisted.locale, 'en');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('language commands reject unknown locales and extra configuration fields', () => {
  assert.deepEqual(commandSchema.parse({ type: 'language', preference: 'zh' }), {
    type: 'language',
    preference: 'zh',
  });
  for (const value of [
    { type: 'language', preference: 'fr' },
    { type: 'language', locale: 'en' },
    { type: 'language', preference: 'en', apiKey: 'unexpected' },
  ])
    assert.throws(() => commandSchema.parse(value));
  assert.deepEqual(languagePreferenceSchema.parse('system'), 'system');
});

await test('system resolver follows supported preferred-language order and falls back to English', () => {
  assert.equal(resolveLocale('system', ['fr-FR', 'zh-CN', 'en-US']), 'zh');
  assert.equal(resolveLocale('system', ['zh-Hans', 'en-US']), 'zh');
  assert.equal(resolveLocale('system', ['zh-TW']), 'zh');
  assert.equal(resolveLocale('system', ['en-GB', 'zh-CN']), 'en');
  assert.equal(resolveLocale('system', ['fr-FR', 'de-DE']), 'en');
  assert.equal(resolveLocale('system', []), 'en');
  assert.equal(resolveLocale('zh', ['en-US']), 'zh');
  assert.equal(resolveLocale('en', ['zh-CN']), 'en');
});

await test('preview keeps system preference separate from manual locale overrides', async () => {
  const bridge = createPreviewBridge(['zh-CN', 'en-US']);
  let snapshot = await bridge.snapshot();
  assert.equal(snapshot.workspace.languagePreference, 'system');
  assert.equal(snapshot.workspace.locale, 'zh');
  await bridge.command({ type: 'language', preference: 'en' });
  snapshot = await bridge.snapshot();
  assert.equal(snapshot.workspace.languagePreference, 'en');
  assert.equal(snapshot.workspace.locale, 'en');
  await bridge.command({ type: 'language', preference: 'system' });
  snapshot = await bridge.snapshot();
  assert.equal(snapshot.workspace.languagePreference, 'system');
  assert.equal(snapshot.workspace.locale, 'zh');
});

await test('host messages localize interpolated values without modifying opaque content', () => {
  assert.equal(localizeMessage('zh', 'Installing @example/package'), '正在安装 @example/package');
  assert.equal(localizeMessage('zh', 'Close 原名'), '关闭 原名');
  assert.equal(translate('zh', 'Installed · {count}', { count: 2 }), '已安装 · 2');
  assert.equal(localizeMessage('en', '原始网站字段和模型回复'), '原始网站字段和模型回复');
  assert.equal(localizeMessage('en', 'Task paused'), 'Task paused');
});
