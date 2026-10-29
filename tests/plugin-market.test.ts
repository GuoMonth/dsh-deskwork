import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PluginMarket, marketCatalogMaxBytes } from '../src/host/plugin-market.ts';

await test('market search accepts the current public catalog size', async () => {
  const original = globalThis.fetch;
  const padding = 'x'.repeat(9_000_000);
  globalThis.fetch = (): Promise<Response> =>
    Promise.resolve(
      new Response(JSON.stringify({ plugins: [], padding }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  try {
    assert.deepEqual(await new PluginMarket().search(''), []);
  } finally {
    globalThis.fetch = original;
  }
});

await test('market search filters projected entries and caps results', async () => {
  const original = globalThis.fetch;
  const plugins = Array.from({ length: 70 }, (_, index) => ({
    name: `demo-${String(index)}`,
    owner: 'author',
    url: `https://github.com/author/demo-${String(index)}`,
    description: { zh: `计算器 ${String(index)}`, en: `calculator ${String(index)}` },
  }));
  globalThis.fetch = (): Promise<Response> =>
    Promise.resolve(
      new Response(JSON.stringify({ plugins }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  try {
    const results = await new PluginMarket().search('计算器');
    assert.equal(results.length, 60);
    assert.ok(results.every((entry) => entry.description.includes('计算器')));
  } finally {
    globalThis.fetch = original;
  }
});

await test('market search rejects an oversized catalog before reading it', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (): Promise<Response> =>
    Promise.resolve(
      new Response('', {
        status: 200,
        headers: { 'content-length': String(marketCatalogMaxBytes + 1) },
      }),
    );
  try {
    await assert.rejects(new PluginMarket().search(''), /Marketplace directory too large/);
  } finally {
    globalThis.fetch = original;
  }
});
