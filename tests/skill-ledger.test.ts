import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SkillLedger } from '../src/core/skill-ledger.ts';

await test('verified skills survive serialization and invalidate on account, field or page changes', () => {
  const target = { tabId: 'erp', sessionId: 'senguo', profileId: 'fixture' };
  const record = {
    shopId: 'shop',
    objectId: 'product',
    name: '苹果',
    field: '备注',
    value: '',
    pageRevision: 'v1',
  };
  const ledger = new SkillLedger();
  assert.equal(ledger.canReuse(target, record), false);
  const restored = new SkillLedger(
    JSON.parse(
      JSON.stringify(
        ledger.verified(target, record, { elapsedMs: 10, toolCalls: 3, modelCalls: 1 }),
      ),
    ),
  );
  const taskMetrics = {
    elapsedMs: 10,
    toolCalls: 3,
    modelCalls: 1,
    startedAt: 123,
    skillReused: false,
  };
  assert.doesNotThrow(() => new SkillLedger(ledger.verified(target, record, taskMetrics)));
  assert.equal(restored.canReuse(target, record), true);
  assert.equal(restored.canReuse(target, { ...record, pageRevision: 'v2' }), false);
  assert.equal(restored.canReuse(target, { ...record, shopId: 'different' }), false);
  assert.equal(restored.canReuse({ ...target, sessionId: 'other' }, record), false);
  assert.equal(restored.canReuse(target, { ...record, field: '价格' }), false);
});
