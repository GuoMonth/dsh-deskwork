import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { _electron as electron, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { startWebsite } from './fixtures/websites.ts';
import { startModel } from './fixtures/model.ts';
await test(
  'config-only websites: real DSH + Electron, confirmations, readback, isolated conversations and restart',
  { timeout: 180000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deskwork-desktop-'));
    const first = await startWebsite('directory');
    const second = await startWebsite('settings');
    const model = await startModel();
    const executablePath = process.env['DESKWORK_TEST_EXECUTABLE'];
    const launchOptions = {
      ...(executablePath ? { executablePath } : {}),
      args: [
        ...(executablePath ? [] : [resolve('.')]),
        `--profile-directory=${directory}`,
        `--test-model-url=${model.url}`,
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      ],
    };
    let application = await electron.launch(launchOptions);
    async function shellPage(): Promise<Page> {
      await expect
        .poll(() => application.windows().some((entry) => entry.url().startsWith('file:')))
        .toBe(true);
      const shell = application.windows().find((entry) => entry.url().startsWith('file:'));
      assert.ok(shell);
      return shell;
    }
    try {
      let shell = await shellPage();
      await expect(shell.getByRole('heading', { name: '你的工作，一个入口。' })).toBeVisible();
      async function add(url: string, name: string): Promise<void> {
        await shell.getByRole('button', { name: '添加固定网站', exact: true }).click();
        await shell.getByLabel('网站网址', { exact: true }).fill(url);
        await shell.getByLabel('名称', { exact: false }).fill(name);
        await shell
          .getByRole('dialog')
          .getByRole('button', { name: '添加网站', exact: true })
          .click();
        await expect(shell.getByRole('dialog')).toHaveCount(0);
      }
      await add(first.origin, 'Directory');
      await add(second.origin, 'Settings');
      await add(first.origin, 'Isolated account');
      await expect(shell.getByRole('tab')).toHaveCount(3);
      await expect
        .poll(
          () =>
            application.windows().filter((entry) => entry.url().startsWith(first.origin)).length,
        )
        .toBe(2);
      const fixturePages = application
        .windows()
        .filter((entry) => entry.url().startsWith(first.origin));
      assert.equal(fixturePages.length, 2);
      const firstPage = fixturePages[0];
      const isolatedPage = fixturePages[1];
      assert.ok(firstPage && isolatedPage);
      // Manual page login uses the exact application-owned webContents, never an external profile.
      await shell.getByRole('tab', { name: 'Directory', exact: false }).click();
      await firstPage.getByText('登录演示账号').click();
      await expect(firstPage.getByText('已登录测试账号')).toBeVisible();
      await expect(isolatedPage.getByText('登录演示账号')).toBeVisible();
      await shell.getByRole('tab', { name: 'Isolated account', exact: false }).click();
      await shell.getByRole('button', { name: '网站设置', exact: true }).click();
      await shell.getByRole('button', { name: '移除此入口（保留网站数据）' }).click();
      await expect(shell.getByRole('tab')).toHaveCount(2);
      await shell.getByRole('tab', { name: 'Directory', exact: false }).click();
      await firstPage.getByText('打开临时页面').click();
      await expect
        .poll(() => application.windows().some((entry) => entry.url().endsWith('/popup')))
        .toBe(true);
      const popup = application.windows().find((entry) => entry.url().endsWith('/popup'));
      assert.ok(popup);
      assert.equal(await popup.evaluate(() => Boolean(window.opener)), true);
      await popup.getByRole('button', { name: '关闭页面' }).click();
      await expect(shell.getByRole('tab')).toHaveCount(2);
      const secondPage = application
        .windows()
        .find((entry) => entry.url().startsWith(second.origin));
      assert.ok(secondPage);
      for (const [name, website, page] of [
        ['Directory', first, firstPage],
        ['Settings', second, secondPage],
      ] as const) {
        await shell.getByRole('tab', { name, exact: false }).click();
        if (name === 'Settings') {
          await expect(shell.getByText('操作已准备，请在工作台确认。')).toHaveCount(0);
          await page.getByText('登录演示账号').click();
        }
        await shell
          .getByRole('textbox', { name: '告诉 DSH 你的目标' })
          .fill(`Update ${name} to Deskwork verified change`);
        await shell.getByRole('button', { name: '发送任务' }).click();
        await expect(shell.getByRole('button', { name: '确认并执行' })).toBeVisible({
          timeout: 30000,
        });
        assert.equal(website.writes(), 0);
        await shell.getByRole('button', { name: 'Agent', exact: true }).click();
        await expect(shell.getByRole('button', { name: '查看页面', exact: true })).toBeVisible();
        await expect
          .poll(async () =>
            application.evaluate(
              ({ BrowserWindow }) =>
                BrowserWindow.getAllWindows()[0]?.contentView.children.filter((view) =>
                  view.getVisible(),
                ).length,
            ),
          )
          .toBe(0);
        await shell.getByRole('button', { name: '确认并执行' }).click();
        await expect(
          shell
            .locator('.change-preview')
            .getByText('提交当前内容，并刷新核对结果', { exact: true }),
        ).toBeVisible({ timeout: 30000 });
        assert.equal(website.writes(), 0);
        await shell.getByRole('button', { name: '确认并执行' }).click();
        await expect(shell.getByText('本轮已完成', { exact: true })).toBeVisible({
          timeout: 30000,
        });
        assert.equal(website.value(), 'Deskwork verified change');
        assert.equal(website.writes(), 1);
        await shell.getByRole('button', { name: '查看页面', exact: true }).click();
        await expect
          .poll(async () =>
            application.evaluate(
              ({ BrowserWindow }) =>
                BrowserWindow.getAllWindows()[0]?.contentView.children.filter(
                  (view) => view.getVisible() && view.getBounds().width > 100,
                ).length,
            ),
          )
          .toBe(1);
        assert.equal(
          await page.evaluate(() => typeof Reflect.get(window, 'deskwork')),
          'undefined',
        );
      }
      assert.ok(model.calls() >= 12, 'published runtime made actual model/tool turns');
      const before = await shell.evaluate(async () => window.deskwork?.snapshot());
      assert.ok(before);
      assert.equal(
        before.contexts.filter((context) =>
          context.messages.some((message) => message.role === 'user'),
        ).length,
        2,
      );
      await mkdir('.artifacts/desktop', { recursive: true });
      const capture = await application.evaluate(async ({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows().find((entry) =>
          entry.webContents.getURL().startsWith('file:'),
        );
        if (!window) throw new Error('No shell');
        return (await window.capturePage()).toPNG().toString('base64');
      });
      await writeFile('.artifacts/desktop/workspace-shell.png', Buffer.from(capture, 'base64'));
      await secondPage.screenshot({ path: '.artifacts/desktop/website-page.png' });
      await application.close();
      application = await electron.launch(launchOptions);
      shell = await shellPage();
      await expect(shell.getByRole('tab')).toHaveCount(2);
      const restored = await shell.evaluate(async () => window.deskwork?.snapshot());
      assert.ok(restored);
      assert.deepEqual(restored.contexts, before.contexts);
      const restoredPage = application
        .windows()
        .find((entry) => entry.url().startsWith(first.origin));
      assert.ok(restoredPage);
      await expect(restoredPage.getByText('已登录测试账号')).toBeVisible();
      // A failed server save with a changed input must remain unverified, without a repeated write.
      second.rejectWrites();
      second.reset();
      await shell.getByRole('tab', { name: 'Settings', exact: false }).click();
      await shell.getByRole('button', { name: '刷新网站' }).click();
      await shell
        .getByRole('textbox', { name: '告诉 DSH 你的目标' })
        .fill('Update Settings to Deskwork verified change');
      await shell.getByRole('button', { name: '发送任务' }).click();
      await expect(shell.getByRole('button', { name: '确认并执行' })).toBeVisible({
        timeout: 30000,
      });
      await shell.getByRole('button', { name: '确认并执行' }).click();
      await expect(
        shell.locator('.change-preview').getByText('提交当前内容，并刷新核对结果', { exact: true }),
      ).toBeVisible({ timeout: 30000 });
      await shell.getByRole('button', { name: '确认并执行' }).click();
      await expect(shell.getByText('结果待核对', { exact: true })).toBeVisible({ timeout: 30000 });
      assert.equal(second.writes(), 1);
      assert.equal(second.value(), 'Original');
      await shell.getByRole('button', { name: '确认未生效，结束核对' }).click();
      // Switching tabs cannot retarget the pending task; manual input revokes its confirmation.
      await shell
        .getByRole('textbox', { name: '告诉 DSH 你的目标' })
        .fill('Update Settings to Deskwork verified change');
      await shell.getByRole('button', { name: '发送任务' }).click();
      await expect(shell.getByRole('button', { name: '确认并执行' })).toBeVisible({
        timeout: 30000,
      });
      await shell.getByRole('tab', { name: 'Directory', exact: false }).click();
      await expect(shell.getByRole('textbox', { name: '告诉 DSH 你的目标' })).toBeDisabled();
      await shell.getByRole('tab', { name: 'Settings', exact: false }).click();
      const liveSecond = application
        .windows()
        .find((entry) => entry.url().startsWith(second.origin));
      assert.ok(liveSecond);
      await liveSecond.locator('textarea').focus();
      await application.evaluate(({ webContents }, origin) => {
        const contents = webContents
          .getAllWebContents()
          .find((entry) => entry.getURL().startsWith(origin));
        if (!contents) throw new Error('No website');
        contents.sendInputEvent({ type: 'keyDown', keyCode: 'A' });
        contents.sendInputEvent({ type: 'keyUp', keyCode: 'A' });
      }, second.origin);
      await expect(shell.getByText('已暂停 · 可以接手', { exact: true })).toBeVisible();
      await expect(shell.getByRole('button', { name: '确认并执行' })).toHaveCount(0);
      assert.equal(second.writes(), 1);
      first.reset();
      second.reset();
      await writeFile(
        '.artifacts/desktop/evidence.json',
        JSON.stringify(
          {
            model: 'controlled SSE through real DSH',
            websites: 2,
            configOnly: true,
            modelCalls: model.calls(),
            platform: process.platform,
            architecture: process.arch,
            restoredContexts: restored.contexts.length,
          },
          null,
          2,
        ),
      );
    } finally {
      await application.close();
      await model.close();
      await first.close();
      await second.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
