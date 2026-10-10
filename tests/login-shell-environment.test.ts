import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parseLoginShellOutput,
  mergeLoginShellEnvironment,
  readDesktopLoginShellEnvironment,
} from '../src/runtime/login-shell-environment.ts';

await test('login shell noise is excluded and launcher identity cannot be overwritten', () => {
  const parsed = parseLoginShellOutput(
    'welcome\0_DSH_SHELL_ENV_DELIMITER_\0PATH=/shell/bin\0HTTPS_PROXY=http://proxy.example.test\0DSH_HOME=/wrong\0DESKWORK_TOOL_TOKEN=wrong\0ELECTRON_RUN_AS_NODE=0\0PWD=/wrong\0_DSH_SHELL_ENV_DELIMITER_\0goodbye',
  );
  assert.ok(parsed);
  const base = {
    DSH_HOME: '/owned',
    DESKWORK_TOOL_TOKEN: 'owned',
    ELECTRON_RUN_AS_NODE: '1',
    PWD: '/owned',
  };
  const merged = mergeLoginShellEnvironment(base, parsed);
  assert.equal(merged['PATH'], '/shell/bin');
  assert.equal(merged['HTTPS_PROXY'], 'http://proxy.example.test');
  for (const [key, value] of Object.entries(base)) assert.equal(merged[key], value);
  assert.equal(parseLoginShellOutput('undelimited'), undefined);
});
await test('failed shell candidates return a bounded fallback without losing inherited environment', async () => {
  const base = { PATH: '/owned/bin' };
  const result = await readDesktopLoginShellEnvironment(
    base,
    { timeoutMs: 50 },
    { platform: 'linux', shells: ['/missing-deskwork-fixture-shell'] },
  );
  assert.deepEqual(result.environment, base);
  assert.equal(result.failures.length, 1);
  const aborted = await readDesktopLoginShellEnvironment(
    base,
    { timeoutMs: 50 },
    { platform: 'linux', shells: ['/bin/sh'], signal: AbortSignal.abort() },
  );
  assert.equal(aborted.failures[0]?.reason, 'aborted');
});
