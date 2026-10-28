import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PluginMarket } from '../src/host/plugin-market.ts';

await test('market search accepts the current public catalog size', async () => {
  const original = globalThis.fetch;
  const padding = 'x'.repeat(9_000_000);
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ plugins: [], padding }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
  try {
    assert.deepEqual(await new PluginMarket().search(''), []);
  } finally {
    globalThis.fetch = original;
  }
});
