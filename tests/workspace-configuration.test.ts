import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWorkspaceConfiguration } from '../experiments/electron-session-control/workspace-configuration.ts';

const procurementTab = {
  id: 'procurement',
  url: 'https://erp.example.test/purchases',
  sessionPartition: 'persist:account-a',
} as const;

await test('preserves configured tab order and allows an explicitly shared account partition', () => {
  const tabs = [procurementTab, { ...procurementTab, id: 'inventory' }];
  assert.deepEqual(parseWorkspaceConfiguration({ tabs }), tabs);
});

await test('rejects duplicate tab identities instead of targeting an ambiguous page', () => {
  assert.throws(
    () => parseWorkspaceConfiguration({ tabs: [procurementTab, procurementTab] }),
    /duplicate tab id/i,
  );
});

await test('rejects executable and local-file URLs at the configuration boundary', () => {
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'not-a-url']) {
    assert.throws(
      () => parseWorkspaceConfiguration({ tabs: [{ ...procurementTab, url }] }),
      /HTTP or HTTPS/i,
    );
  }
});

await test('requires a named persistent partition rather than silently using a default session', () => {
  for (const sessionPartition of ['', 'account-a', 'persist:']) {
    assert.throws(
      () => parseWorkspaceConfiguration({ tabs: [{ ...procurementTab, sessionPartition }] }),
      /persistent partition/i,
    );
  }
});

await test('rejects malformed configuration and missing tab fields', () => {
  for (const input of [null, [], {}, { tabs: [] }, { tabs: [null] }, { tabs: [{ id: 'x' }] }]) {
    assert.throws(() => parseWorkspaceConfiguration(input), /configuration|tab/i);
  }
});
