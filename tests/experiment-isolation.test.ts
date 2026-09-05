import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  electronIsolationArguments,
  parseExperimentIsolation,
} from '../experiments/electron-session-control/experiment-isolation.ts';

await test('explicit host isolation disables only the nested Chromium sandbox for the experiment', () => {
  assert.equal(parseExperimentIsolation('host'), 'host');
  assert.deepEqual(electronIsolationArguments('host'), ['--no-sandbox']);
});

await test('bare integration runs retain Chromium isolation and reject misspelled modes', () => {
  assert.equal(parseExperimentIsolation(undefined), 'chromium');
  assert.deepEqual(electronIsolationArguments('chromium'), []);
  assert.throws(() => parseExperimentIsolation('hots'), /isolation/i);
});
