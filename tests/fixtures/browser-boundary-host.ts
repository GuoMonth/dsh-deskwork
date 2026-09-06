import assert from 'node:assert/strict';
import { app, BrowserWindow } from 'electron';
import { ElectronBrowser, evaluate } from '../../src/browser/electron-browser.ts';
import { Pages } from '../../src/host/pages.ts';
import { TaskController } from '../../src/core/task-controller.ts';
import type { ActionProposal } from '../../src/core/contracts.ts';
import { startWebsite } from './websites.ts';

async function verify(): Promise<void> {
  await app.whenReady();
  const website = await startWebsite('directory');
  const window = new BrowserWindow({ show: false });
  const takeovers: string[] = [];
  const pages = new Pages(
    window,
    () => {},
    (siteId) => takeovers.push(siteId),
  );
  const target = { tabId: 'first', sessionId: 'first-session' };
  const other = { tabId: 'second', sessionId: 'second-session' };
  try {
    for (const entry of [target, other])
      pages.add({
        id: entry.tabId,
        sessionId: entry.sessionId,
        name: entry.tabId,
        url: website.origin,
      });
    const handle = pages.resolve(target);
    await handle.contents.loadURL(website.origin + '/login');
    const foreignPage = pages.resolve(other).page.id;
    assert.throws(() => pages.resolve(target, foreignPage), /不属于/);
    assert.throws(() => {
      pages.select(target, foreignPage);
    }, /不属于/);
    assert.throws(() => pages.resolve({ ...target, sessionId: other.sessionId }), /不属于/);
    const browser = new ElectronBrowser(
      (entry, id) => pages.resolve(entry, id),
      (entry) => pages.list(entry),
      (entry, id) => {
        pages.select(entry, id);
      },
    );
    await assert.rejects(browser.observe(target, foreignPage), /不属于/);
    await evaluate(handle.contents, "document.querySelector('input').focus(); true");
    const observation = await browser.observe(target);
    const proposal: ActionProposal = {
      pageId: observation.pageId,
      revision: observation.revision,
      action: { kind: 'key', key: 'Enter' },
      summary: 'Submit using the focused field',
      risk: 'ordinary',
    };
    const controller = new TaskController(browser, async () => {});
    await controller.start(target, 'Focus-bound confirmation');
    await controller.propose(proposal);
    const confirmation = controller.state.confirmation;
    assert.ok(confirmation);
    // Scripted focus changes do not produce a native mouse/key takeover event.
    await evaluate(handle.contents, "document.querySelector('button').focus(); true");
    await assert.rejects(controller.confirm(confirmation.id), /页面或输入已变化/);
    assert.equal(website.writes(), 0);

    const current = await browser.observe(target);
    const sendCommand = handle.contents.debugger.sendCommand.bind(handle.contents.debugger);
    handle.contents.debugger.sendCommand = async (method, parameters): Promise<unknown> => {
      const input: unknown = parameters;
      if (
        method === 'Runtime.evaluate' &&
        typeof input === 'object' &&
        input !== null &&
        Reflect.get(input, 'expression') === 'true'
      )
        throw new Error('Injected lost keyboard response');
      const result: unknown = await sendCommand(method, parameters);
      return result;
    };
    try {
      await assert.rejects(
        browser.execute(
          target,
          {
            ...proposal,
            revision: current.revision,
            action: { kind: 'key', key: 'Escape' },
          },
          () => true,
        ),
        /Injected lost keyboard response/,
      );
      assert.equal(handle.automating, false, 'manual takeover remains enabled after an error');
    } finally {
      handle.contents.debugger.sendCommand = sendCommand;
    }

    // Cookie invalidation must revoke identity-bound confirmations even without navigation.
    const beforeExpiry = takeovers.length;
    await handle.contents.session.cookies.remove(website.origin, 'identity');
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.ok(takeovers.slice(beforeExpiry).includes(target.tabId));
    assert.ok(!takeovers.slice(beforeExpiry).includes(other.tabId));
    console.log(
      'Browser boundary checks passed: ownership, focus, keyboard failure, identity expiry',
    );
  } finally {
    await pages.close();
    window.destroy();
    await website.close();
  }
}
void verify().then(
  () => {
    app.exit(0);
  },
  (error: unknown) => {
    console.error(error);
    app.exit(1);
  },
);
