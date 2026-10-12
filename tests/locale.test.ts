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

await test('legacy locale-only choices stay manual across an opposite system language', async () => {
  for (const [legacyLocale, systemLanguages] of [
    ['zh', ['en-US']],
    ['en', ['zh-CN']],
  ] as const) {
    const root = await mkdtemp(join(tmpdir(), 'deskwork-locale-legacy-choice-'));
    try {
      const sites = [
        { id: 'one', name: '原名', url: 'https://example.test/', sessionId: 'account' },
      ];
      const contexts = [
        {
          siteId: 'one',
          task: {
            id: '',
            status: 'idle' as const,
            target: null,
            title: '',
            detail: 'Ready to start your work',
            confirmation: null,
            pendingAction: null,
            result: null,
            requiresVerification: false,
            steps: [],
            metrics: {
              modelCalls: 0,
              toolCalls: 0,
              startedAt: 0,
              elapsedMs: 0,
              inputTokens: 0,
              outputTokens: 0,
            },
          },
          messages: [{ id: 'message', role: 'user' as const, text: '保留这段对话' }],
        },
      ];
      await writeFile(
        join(root, 'workspace.json'),
        JSON.stringify({ version: 2, locale: legacyLocale, name: '原名', sites }),
      );
      await writeFile(join(root, 'task.json'), JSON.stringify({ version: 2, contexts }));
      const store = new StateStore(root, systemLanguages);
      const workspace = await store.loadWorkspace();
      assert.equal(workspace.languagePreference, legacyLocale);
      assert.equal(workspace.locale, legacyLocale);
      assert.deepEqual(workspace.sites, sites);
      assert.deepEqual(await store.load(), contexts);
      const persisted = JSON.parse(await readFile(join(root, 'workspace.json'), 'utf8')) as {
        languagePreference?: unknown;
        locale?: unknown;
      };
      assert.equal(persisted.languagePreference, legacyLocale);
      assert.equal(persisted.locale, legacyLocale);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

await test('legacy config without locale remains system and re-resolves on restart', async () => {
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
    await new StateStore(root, ['zh-CN']).saveWorkspace(first);
    const restarted = await new StateStore(root, ['en-US']).loadWorkspace();
    assert.equal(restarted.languagePreference, 'system');
    assert.equal(restarted.locale, 'en');
    assert.deepEqual(restarted.sites, sites);
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

await test('host messages localize interpolated values without modifying opaque content', () => {
  assert.equal(localizeMessage('zh', 'Installing @example/package'), '正在安装 @example/package');
  assert.equal(localizeMessage('zh', 'Close 原名'), '关闭 原名');
  assert.equal(translate('zh', 'Installed · {count}', { count: 2 }), '已安装 · 2');
  assert.equal(localizeMessage('en', '原始网站字段和模型回复'), '原始网站字段和模型回复');
  assert.equal(localizeMessage('en', 'Task paused'), 'Task paused');
});
