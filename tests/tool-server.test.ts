import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startToolServer } from '../src/runtime/tool-server.ts';
import { setTimeout } from 'node:timers/promises';

await test('tool credentials are revoked between runtimes; browser-origin and unknown tools are rejected', async () => {
  const calls: string[] = [];
  const server = await startToolServer((request) => {
    calls.push(request.name);
    return Promise.resolve({ ok: true });
  });
  const invoke = (token: string, name = 'observe_page', origin?: string): Promise<Response> =>
    fetch(server.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, ...(origin ? { origin } : {}) },
      body: JSON.stringify({ name, arguments: {} }),
    });
  try {
    const oldToken = server.token;
    assert.equal((await invoke(oldToken)).status, 200);
    server.revoke();
    assert.equal((await invoke(oldToken)).status, 403);
    assert.equal(
      (await invoke(server.token, 'observe_page', 'https://center.senguo.cc')).status,
      403,
    );
    assert.equal((await invoke(server.token, 'arbitrary_javascript')).status, 400);
    assert.deepEqual(calls, ['observe_page']);
  } finally {
    await server.close();
  }
});

await test('parallel model calls execute serially within the browser session', async () => {
  let active = 0;
  let peak = 0;
  const server = await startToolServer(async () => {
    active++;
    peak = Math.max(peak, active);
    await setTimeout(15);
    active--;
    return { ok: true };
  });
  try {
    const invoke = (): Promise<Response> =>
      fetch(server.endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${server.token}` },
        body: JSON.stringify({ name: 'observe_page', arguments: {} }),
      });
    const responses = await Promise.all([invoke(), invoke(), invoke()]);
    assert.deepEqual(
      responses.map((response) => response.status),
      [200, 200, 200],
    );
    assert.equal(peak, 1);
  } finally {
    await server.close();
  }
});
