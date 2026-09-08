import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TaskController } from '../src/core/task-controller.ts';
import type { BrowserAdapter, PageObservation } from '../src/core/contracts.ts';

function environment(): {
  controller: TaskController;
  page: PageObservation;
  executions: () => number;
} {
  const page: PageObservation = {
    pageId: 'page',
    revision: 'r1',
    url: 'https://fixture.test/',
    title: '查询',
    text: '列表',
    elements: [
      {
        ref: 'e0',
        tag: 'button',
        role: 'button',
        name: '查询',
        value: '',
        type: 'button',
        href: '',
        disabled: false,
      },
    ],
  };
  let executions = 0;
  const browser: BrowserAdapter = {
    observe: () => Promise.resolve(structuredClone(page)),
    readback: () => Promise.resolve(structuredClone(page)),
    needsConfirmation: () => true,
    execute: (_target, _proposal, valid) => {
      assert.ok(valid());
      executions++;
      return Promise.resolve();
    },
    pages: () => [],
    selectPage: () => {},
    screenshot: () => Promise.resolve(''),
  };
  const controller = new TaskController(browser, () => Promise.resolve());
  return { controller, page, executions: () => executions };
}
await test('trusted read flow executes directly; ordinary model declarations do not bypass confirmation', async () => {
  const env = environment();
  await env.controller.start({ tabId: 'site', sessionId: 'session' }, '查询');
  const proposal = {
    pageId: 'page',
    revision: 'r1',
    action: { kind: 'click' as const, ref: 'e0' },
    summary: '查询列表',
    risk: 'ordinary' as const,
  };
  assert.equal((await env.controller.propose(proposal, 'read')).status, 'executed-observe-again');
  assert.equal(env.executions(), 1);
  await env.controller.finish('已查询');
  assert.equal(env.controller.state.status, 'succeeded');
  assert.equal(env.controller.state.requiresVerification, false);
  await env.controller.start({ tabId: 'site', sessionId: 'session' }, '未知按钮');
  assert.equal((await env.controller.propose(proposal)).status, 'waiting-for-human-confirmation');
  assert.equal(env.executions(), 1);
});
await test('host catches visible writes and unknown effects; stop invalidates subsequent plugin steps', async () => {
  for (const effect of ['read', 'unknown', 'write'] as const) {
    const env = environment();
    env.page.elements[0] = {
      ref: 'e0',
      tag: 'button',
      role: 'button',
      name: '保存',
      type: 'button',
      value: '',
      href: '',
      disabled: false,
    };
    await env.controller.start({ tabId: 'site', sessionId: 'session' }, '更新');
    const proposal = {
      pageId: 'page',
      revision: 'r1',
      action: { kind: 'click' as const, ref: 'e0' },
      summary: '操作',
      risk: 'ordinary' as const,
    };
    assert.equal(
      (await env.controller.propose(proposal, effect)).status,
      'waiting-for-human-confirmation',
    );
    assert.equal(env.executions(), 0);
    await env.controller.stop();
    await assert.rejects(env.controller.propose(proposal, 'read'));
  }
});
