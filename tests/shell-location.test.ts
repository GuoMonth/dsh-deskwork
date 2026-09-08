import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shellLocation } from '../src/host/shell-location.ts';

await test('development shell is loopback-only and cannot override the packaged shell', () => {
  assert.equal(shellLocation('/app', false), 'file:///app/dist/ui/index.html');
  assert.equal(shellLocation('/app', false, 'http://127.0.0.1:5173'), 'http://127.0.0.1:5173/');
  assert.throws(() => shellLocation('/app', true, 'http://127.0.0.1:5173'));
  for (const url of [
    'https://example.com/',
    'http://localhost:5173/',
    'http://127.0.0.1:5173/other',
    'http://user:password@127.0.0.1/',
    'http://127.0.0.1/?page=remote',
    'http://127.0.0.1/#remote',
  ])
    assert.throws(() => shellLocation('/app', false, url));
});
