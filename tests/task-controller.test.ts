import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TaskController } from '../src/core/task-controller.ts';
import type { BusinessRecord, RecordBrowser } from '../src/core/contracts.ts';

const record: BusinessRecord = {
  shopId: 'test-shop',
  objectId: 'fruit-1',
  name: '测试苹果',
  field: '备注',
  value: '原值',
  pageRevision: 'v1',
};

function fixture(): {
  controller: TaskController;
  writes: string[];
  persisted: string[];
  changeIdentity: () => void;
  loseResponse: () => void;
} {
  let current = { ...record };
  let responseLost = false;
  const writes: string[] = [];
  const persisted: string[] = [];
  const browser: RecordBrowser = {
    read: () => Promise.resolve(current),
    write: (_target, expected, value) => {
      assert.equal(current.value, expected.value);
      writes.push(value);
      current = { ...current, value };
      if (responseLost) return Promise.reject(new Error('Response lost'));
      return Promise.resolve();
    },
  };
  const controller = new TaskController(browser, (state) => {
    persisted.push(state.status);
    return Promise.resolve();
  });
  return {
    controller,
    writes,
    persisted,
    changeIdentity: (): void => {
      current = { ...current, shopId: 'other-shop' };
    },
    loseResponse: (): void => {
      responseLost = true;
    },
  };
}

await test('confirmation binds a change; durable write intent precedes save and result is read back', async () => {
  const { controller, writes, persisted } = fixture();
  await controller.start({ tabId: 'erp', sessionId: 'senguo', profileId: 'fixture' }, '修改备注');
  await controller.propose('fruit-1', '新值');
  assert.deepEqual(writes, []);
  const confirmation = controller.state.confirmation;
  assert.ok(confirmation);
  await controller.confirm(confirmation.id);
  assert.deepEqual(writes, ['新值']);
  assert.equal(controller.state.status, 'succeeded');
  assert.ok(persisted.includes('verifying'));
  await assert.rejects(controller.confirm(confirmation.id));
});

await test('identity changes invalidate confirmation without writing', async () => {
  const { controller, writes, changeIdentity } = fixture();
  await controller.start({ tabId: 'erp', sessionId: 'senguo', profileId: 'fixture' }, '修改备注');
  await controller.propose('fruit-1', '新值');
  const confirmation = controller.state.confirmation;
  assert.ok(confirmation);
  changeIdentity();
  await controller.confirm(confirmation.id);
  assert.deepEqual(writes, []);
  assert.equal(controller.state.status, 'paused');
});

await test('lost save response is resolved by reading, never by repeating the write', async () => {
  const { controller, writes, loseResponse } = fixture();
  await controller.start({ tabId: 'erp', sessionId: 'senguo', profileId: 'fixture' }, '修改备注');
  await controller.propose('fruit-1', '新值');
  const confirmation = controller.state.confirmation;
  assert.ok(confirmation);
  loseResponse();
  await controller.confirm(confirmation.id);
  assert.equal(controller.state.status, 'succeeded');
  assert.equal(writes.length, 1);
});

await test('stop revokes pending confirmation and does not silently move the task', async () => {
  const { controller, writes } = fixture();
  const target = { tabId: 'erp', sessionId: 'senguo', profileId: 'fixture' };
  await controller.start(target, '修改备注');
  await assert.rejects(controller.start({ ...target, tabId: 'other' }, 'another task'));
  await controller.propose('fruit-1', '新值');
  const confirmation = controller.state.confirmation;
  assert.ok(confirmation);
  await controller.stop();
  await assert.rejects(controller.confirm(confirmation.id));
  assert.equal(controller.state.target?.tabId, 'erp');
  assert.deepEqual(writes, []);
});

await test('an updated form with a failed save is never accepted as server verification', async () => {
  let draft = record.value;
  const controller = new TaskController(
    {
      read: (_target, _objectId, source): Promise<BusinessRecord> =>
        Promise.resolve({ ...record, value: source === 'server' ? record.value : draft }),
      write: (_target, _record, value): Promise<void> => {
        draft = value;
        return Promise.reject(new Error('Save rejected'));
      },
    },
    () => Promise.resolve(),
  );
  await controller.start({ tabId: 'erp', sessionId: 'senguo', profileId: 'fixture' }, '修改');
  await controller.propose('fruit-1', '未保存的新值');
  assert.ok(controller.state.confirmation);
  await controller.confirm(controller.state.confirmation.id);
  assert.equal(controller.state.status, 'verifying');
  assert.equal(controller.state.writeVerified, false);
  assert.equal(controller.state.result?.value, record.value);
});

await test('restored write intent is verified without dispatching another save', async () => {
  const { controller } = fixture();
  await controller.start({ tabId: 'erp', sessionId: 'senguo', profileId: 'fixture' }, '修改');
  await controller.propose('fruit-1', '已保存');
  const restored = new TaskController(
    {
      read: (): Promise<BusinessRecord> => Promise.resolve({ ...record, value: '已保存' }),
      write: (): Promise<void> => {
        assert.fail('Recovery must never save');
      },
    },
    () => Promise.resolve(),
    { ...structuredClone(controller.state), status: 'verifying' },
  );
  await restored.resume();
  assert.equal(restored.state.writeVerified, true);
});
