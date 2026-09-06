import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TaskController } from '../src/core/task-controller.ts';
import type { BrowserAdapter, PageObservation, TaskState } from '../src/core/contracts.ts';
const target = { tabId: 'one', sessionId: 'session-one' };
const initial: PageObservation = {
  pageId: 'page-one',
  revision: 'r1',
  url: 'https://example.test/',
  title: 'Example',
  text: 'Original',
  elements: [],
};
function setup(): {
  controller: TaskController;
  browser: BrowserAdapter;
  writes: () => number;
  saved: () => TaskState | undefined;
  change: () => void;
  lose: () => void;
  showResult: (text: string) => void;
} {
  let observation = structuredClone(initial);
  let writes = 0;
  let loseResponse = false;
  let saved: TaskState | undefined;
  const browser: BrowserAdapter = {
    observe: () => Promise.resolve(structuredClone(observation)),
    needsConfirmation: () => true,
    readback: () => Promise.resolve(structuredClone(observation)),
    execute: (_target, _proposal, valid) => {
      assert.equal(saved?.pendingAction !== null, true, 'intent persisted before dispatch');
      assert.ok(valid());
      writes++;
      if (loseResponse) return Promise.reject(new Error('response lost'));
      return Promise.resolve();
    },
    pages: () => [],
    selectPage: () => undefined,
    screenshot: () => Promise.resolve(''),
  };
  const controller = new TaskController(browser, (state) => {
    saved = structuredClone(state);
    return Promise.resolve();
  });
  return {
    controller,
    browser,
    writes: (): number => writes,
    saved: (): TaskState | undefined => saved,
    change: (): void => {
      observation = { ...observation, revision: 'r2' };
    },
    showResult: (text: string): void => {
      observation = { ...observation, text };
    },
    lose: (): void => {
      loseResponse = true;
    },
  };
}
async function propose(controller: TaskController): Promise<string> {
  await controller.start(target, 'Update page');
  await controller.propose({
    pageId: 'page-one',
    revision: 'r1',
    action: { kind: 'click', ref: 'element-one' },
    summary: 'Submit updated form',
    expectedText: 'Stored: changed',
    risk: 'consequential',
  });
  const id = controller.state.confirmation?.id;
  assert.ok(id);
  return id;
}
await test('generic action requires confirmation; writes persist intent and cannot be declared verified by model text', async () => {
  const env = setup();
  const id = await propose(env.controller);
  assert.equal(env.writes(), 0);
  await env.controller.confirm(id);
  assert.equal(env.writes(), 1);
  await env.controller.finish('Saved successfully');
  assert.equal(env.controller.state.status, 'verifying');
  assert.equal(env.controller.state.requiresVerification, true);
});
await test('page changes invalidate confirmation before dispatch', async () => {
  const env = setup();
  const id = await propose(env.controller);
  env.change();
  await assert.rejects(env.controller.confirm(id), /变化|失效/);
  assert.equal(env.writes(), 0);
  assert.equal(env.controller.state.confirmation, null);
});
await test('stop revokes confirmations and prevents later actions', async () => {
  const env = setup();
  const id = await propose(env.controller);
  await env.controller.stop();
  await assert.rejects(env.controller.confirm(id));
  assert.equal(env.writes(), 0);
});
await test('response loss and restart retain uncertain outcome without replay', async () => {
  const env = setup();
  const id = await propose(env.controller);
  env.lose();
  await env.controller.confirm(id);
  assert.equal(env.controller.state.status, 'verifying');
  const saved = env.saved();
  assert.ok(saved);
  const restored = new TaskController(env.browser, () => Promise.resolve(), saved);
  await restored.resume();
  assert.equal(env.writes(), 1);
  assert.equal(restored.state.status, 'verifying');
});

await test('only a new expected result after independent readback can verify a write', async () => {
  const env = setup();
  const id = await propose(env.controller);
  await env.controller.confirm(id);
  assert.equal((await env.controller.verify()).verified, false);
  env.showResult('Stored: changed');
  assert.equal((await env.controller.verify()).verified, true);
  await env.controller.finish('Done');
  assert.equal(env.controller.state.status, 'succeeded');
});
await test('local input changes cannot substitute for refreshed server evidence', async () => {
  const env = setup();
  const id = await propose(env.controller);
  await env.controller.confirm(id);
  env.controller.state.result = {
    ...initial,
    elements: [
      {
        ref: 'e0',
        tag: 'input',
        role: '',
        name: 'Value',
        value: 'Stored: changed',
        type: 'text',
        href: '',
        disabled: false,
      },
    ],
  };
  assert.equal((await env.controller.verify()).verified, false);
  await env.controller.finish('The model claimed success');
  assert.equal(env.controller.state.status, 'verifying');
  assert.equal(env.writes(), 1);
});
