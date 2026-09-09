import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { developmentConnectionSchema } from '../packages/plugin-sdk/src/index.ts';
import type { DevelopmentRequest } from '../packages/plugin-sdk/src/index.ts';
import type { BrowserAdapter, PageObservation } from '../src/core/contracts.ts';
import { TaskController } from '../src/core/task-controller.ts';
import { DevelopmentSession } from '../src/host/development-session.ts';

await test('development connection binds one target, pauses writes, rejects stale confirmation and revokes queued actions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deskwork-development-'));
  const filename = join(directory, 'connection.json');
  let writes = 0;
  let gate: Promise<void> | undefined;
  let entered: (() => void) | undefined;
  const page: PageObservation = {
    pageId: 'page',
    revision: 'r1',
    url: 'https://example.test/',
    title: 'Fixture',
    text: '未保存',
    elements: [
      {
        ref: 'save',
        tag: 'button',
        role: 'button',
        name: '保存',
        value: '',
        type: 'button',
        href: '',
        disabled: false,
      },
    ],
  };
  const browser: BrowserAdapter = {
    observe: async (target, pageId) => {
      assert.equal(target.tabId, 'site-a');
      if (pageId && pageId !== page.pageId) throw new Error('Page outside task');
      entered?.();
      await gate;
      return structuredClone(page);
    },
    readback: () => Promise.resolve(structuredClone(page)),
    needsConfirmation: () => true,
    execute: (_target, _proposal, valid) => {
      assert.ok(valid());
      writes++;
      page.text = '保存完成';
      return Promise.resolve();
    },
    pages: () => [],
    selectPage: () => {},
    screenshot: () => Promise.resolve(''),
  };
  const controller = new TaskController(browser, () => Promise.resolve());
  await controller.start({ tabId: 'site-a', sessionId: 'identity-a' }, 'Development');
  const session = new DevelopmentSession(controller, browser, filename, () => {});
  try {
    await session.open();
    assert.equal((await stat(filename)).mode & 0o777, 0o600);
    const connection = developmentConnectionSchema.parse(
      JSON.parse(await readFile(filename, 'utf8')),
    );
    const call = (request: DevelopmentRequest): Promise<Response> =>
      fetch(connection.endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${connection.token}` },
        body: JSON.stringify(request),
      });
    assert.equal(
      (await call({ name: 'observe', arguments: { pageId: 'other-entry' } })).status,
      400,
    );
    const proposal = {
      pageId: page.pageId,
      revision: page.revision,
      action: { kind: 'click' as const, ref: 'save' },
      summary: '保存',
      risk: 'consequential' as const,
      expectedText: '保存完成',
    };
    await call({ name: 'act', arguments: { proposal, effect: 'write' } });
    assert.equal(writes, 0);
    const obsolete = controller.state.confirmation?.id;
    assert.ok(obsolete);
    page.revision = 'r2';
    await assert.rejects(controller.confirm(obsolete), /已变化/);
    assert.equal(writes, 0);
    await controller.resume();
    await call({
      name: 'act',
      arguments: { proposal: { ...proposal, revision: page.revision }, effect: 'write' },
    });
    const confirmation = controller.state.confirmation?.id;
    assert.ok(confirmation);
    await controller.confirm(confirmation);
    assert.equal(writes, 1);
    await call({
      name: 'act',
      arguments: { proposal: { ...proposal, revision: page.revision }, effect: 'write' },
    });
    assert.equal(writes, 1, 'pending verification cannot replay submission');
    await call({ name: 'verify', arguments: {} });
    assert.equal(controller.state.requiresVerification, false);

    let release = (): void => {};
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const observing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const blocked = call({ name: 'observe', arguments: {} });
    await observing;
    const queued = call({
      name: 'act',
      arguments: { proposal: { ...proposal, revision: page.revision }, effect: 'write' },
    });
    const stopped = await call({ name: 'stop', arguments: {} });
    assert.equal(stopped.status, 200);
    release();
    assert.equal((await blocked).status, 400);
    assert.notEqual((await queued).status, 200);
    assert.equal(writes, 1);
    assert.equal(session.active, false);
    await assert.rejects(readFile(filename));
    assert.equal((await call({ name: 'status', arguments: {} })).status, 403);
  } finally {
    await session.close();
    await rm(directory, { recursive: true, force: true });
  }
});
