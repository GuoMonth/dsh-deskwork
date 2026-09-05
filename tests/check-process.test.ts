import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runCheck } from '../scripts/check-process.ts';

await test('preserves a failed tool exit and both diagnostic streams', async () => {
  const result = await runCheck({
    name: 'failing-tool',
    arguments: ['-e', "console.log('context'); console.error('reason'); process.exitCode = 7"],
  });
  assert.equal(result.passed, false);
  assert.equal(result.name, 'failing-tool');
  assert.match(result.output, /context/);
  assert.match(result.output, /reason/);
});

await test('passes arguments literally without shell expansion and keeps successful diagnostics available', async () => {
  const literal = '$(do-not-run); spaced argument';
  const result = await runCheck({
    name: 'literal-tool',
    arguments: ['-e', 'console.log(process.argv[1])', literal],
  });
  assert.equal(result.passed, true);
  assert.equal(result.output.trim(), literal);
  assert.ok(result.milliseconds > 0);
});
