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

await test('system preference follows startup languages and explicit language survives restart', async () => {
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

await test('language commands accept system or explicit locales and reject unknown values', () => {
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
  assert.equal(languagePreferenceSchema.parse('system'), 'system');
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

await test('locale-only v2 values migrate known choices and unknown values safely', async () => {
  for (const [legacyLocale, expectedPreference, expectedLocale] of [
    ['zh', 'zh', 'zh'],
    ['en', 'en', 'en'],
    ['fr', 'system', 'zh'],
  ] as const) {
    const root = await mkdtemp(join(tmpdir(), 'deskwork-locale-legacy-'));
    try {
      const sites = [
        { id: 'one', name: '原名', url: 'https://example.test/', sessionId: 'account' },
      ];
      await writeFile(
        join(root, 'workspace.json'),
        JSON.stringify({ version: 2, locale: legacyLocale, name: '原名', sites }),
      );
      const store = new StateStore(root, ['zh-CN']);
      const workspace = await store.loadWorkspace();
      assert.equal(workspace.languagePreference, expectedPreference);
      assert.equal(workspace.locale, expectedLocale);
      assert.deepEqual(workspace.sites, sites);
      const persisted = JSON.parse(await readFile(join(root, 'workspace.json'), 'utf8')) as {
        languagePreference?: unknown;
        locale?: unknown;
      };
      assert.equal(persisted.languagePreference, expectedPreference);
      assert.equal(persisted.locale, expectedLocale);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

await test('legacy config without locale migrates to system and re-resolves after restart', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deskwork-locale-system-migration-'));
  try {
    const sites = [{ id: 'one', name: '原名', url: 'https://example.test/', sessionId: 'account' }];
    await writeFile(
      join(root, 'workspace.json'),
      JSON.stringify({ version: 2, name: '原名', sites }),
    );
    const first = await new StateStore(root, ['zh-CN']).loadWorkspace();
    assert.equal(first.languagePreference, 'system');
    assert.equal(first.locale, 'zh');
    const restarted = await new StateStore(root, ['en-US']).loadWorkspace();
    assert.equal(restarted.languagePreference, 'system');
    assert.equal(restarted.locale, 'en');
    assert.deepEqual(restarted.sites, sites);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('unknown persisted preference is replaced with a supported system preference', async () => {
  const root = await mkdtemp(join(tmpdir(), 'deskwork-locale-unknown-preference-'));
  try {
    await writeFile(
      join(root, 'workspace.json'),
      JSON.stringify({
        version: 2,
        languagePreference: 'fr',
        locale: 'en',
        name: '原名',
        sites: [],
      }),
    );
    const workspace = await new StateStore(root, ['zh-CN']).loadWorkspace();
    assert.equal(workspace.languagePreference, 'system');
    assert.equal(workspace.locale, 'zh');
    const persisted = JSON.parse(await readFile(join(root, 'workspace.json'), 'utf8')) as {
      languagePreference?: unknown;
      locale?: unknown;
    };
    assert.equal(persisted.languagePreference, 'system');
    assert.equal(persisted.locale, 'zh');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

await test('host messages localize interpolated values without modifying opaque content', () => {
  assert.equal(localizeMessage('zh', 'Installing @example/package'), '正在安装 @example/package');
  assert.equal(localizeMessage('zh', 'Close 原名'), '关闭 原名');
  assert.equal(translate('zh', 'Installed · {count}', { count: 2 }), '已安装 · 2');
  assert.equal(localizeMessage('en', '原始网站字段和模型回复'), '原始网站字段和模型回复');
  assert.equal(localizeMessage('en', 'Task paused'), 'Task paused');
});
