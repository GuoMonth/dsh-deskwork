import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startToolServer } from '../src/runtime/tool-server.ts';

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
