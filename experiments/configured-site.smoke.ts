import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { _electron as electron, expect } from '@playwright/test';
const directory = await mkdtemp(join(tmpdir(), 'deskwork-site-smoke-'));
const url = 'https://center.senguo.cc/#/main/shopList';
const application = await electron.launch({
  args: [
    resolve('.'),
    `--profile-directory=${directory}`,
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
  ],
});
try {
  await expect
    .poll(() => application.windows().some((page) => page.url().startsWith('file:')))
    .toBe(true);
  const shell = application.windows().find((page) => page.url().startsWith('file:'));
  assert.ok(shell);
  await shell.evaluate(async (url) => {
    if (!window.deskwork) throw new Error('No bridge');
    await window.deskwork.command({ type: 'add-site', url, name: '森果 · 配置测试' });
  }, url);
  await expect
    .poll(
      () => application.windows().some((page) => page.url().startsWith('https://center.senguo.cc')),
      { timeout: 30000 },
    )
    .toBe(true);
  const page = application
    .windows()
    .find((page) => page.url().startsWith('https://center.senguo.cc'));
  assert.ok(page);
  await page.waitForLoadState('domcontentloaded');
  await expect
    .poll(async () => (await page.locator('body').innerText()).length, { timeout: 20000 })
    .toBeGreaterThan(20);
  await expect
    .poll(async () =>
      application.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]?.contentView.children.some(
          (view) => view.getVisible() && view.getBounds().width > 100,
        ),
      ),
    )
    .toBe(true);
  await shell.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
  const viewState = await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.contentView.children.map((view) => ({
      visible: view.getVisible(),
      bounds: view.getBounds(),
    })),
  );
  const text = await page.locator('body').innerText();
  const evidence = {
    platform: process.platform,
    architecture: process.arch,
    url: page.url(),
    title: await page.title(),
    configuredOnly: true,
    hostBridgeExposed: await page.evaluate(() => typeof Reflect.get(window, 'deskwork')),
    viewState,
    visibleText: text.slice(0, 1500),
    scope: 'public page load only; no login, model or writes',
  };
  assert.equal(evidence.hostBridgeExposed, 'undefined');
  await mkdir('.artifacts/configured-site', { recursive: true });
  await writeFile('.artifacts/configured-site/evidence.json', JSON.stringify(evidence, null, 2));
  await page.screenshot({ path: '.artifacts/configured-site/senguo-page.png' });
  const screenshot = await application.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows().find((entry) =>
      entry.webContents.getURL().startsWith('file:'),
    );
    if (!window) throw new Error('No shell');
    return (await window.capturePage()).toPNG().toString('base64');
  });
  await writeFile(
    '.artifacts/configured-site/senguo-workspace.png',
    Buffer.from(screenshot, 'base64'),
  );
  if (process.platform === 'linux') {
    const screenCapture = await application.evaluate(async ({ desktopCapturer }) => {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1440, height: 1080 },
      });
      const source = sources[0];
      if (!source) throw new Error('No screen capture source');
      return source.thumbnail.toPNG().toString('base64');
    });
    await writeFile(
      '.artifacts/configured-site/senguo-screen.png',
      Buffer.from(screenCapture, 'base64'),
    );
  }
  console.log(JSON.stringify(evidence));
} finally {
  await application.close();
  await rm(directory, { recursive: true, force: true });
}
