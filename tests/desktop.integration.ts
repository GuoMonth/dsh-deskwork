import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { _electron as electron, expect } from '@playwright/test';

await test(
  'desktop fixture: manual login, confirmation, save, server readback and Agent context',
  { timeout: 60000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deskwork-desktop-'));
    const executablePath = process.env['DESKWORK_TEST_EXECUTABLE'];
    const launchOptions = {
      ...(executablePath ? { executablePath } : {}),
      args: [
        ...(executablePath ? [] : [resolve('.')]),
        '--fixture',
        '--fixture-agent',
        `--profile-directory=${directory}`,
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      ],
    };
    let application = await electron.launch(launchOptions);
    try {
      await expect.poll(() => application.windows().length).toBe(2);
      await expect
        .poll(() => application.windows().some((entry) => entry.url().startsWith('file:')))
        .toBe(true);
      const shell = application.windows().find((entry) => entry.url().startsWith('file:'));
      assert.ok(shell);
      assert.equal(
        await shell.evaluate(async () => {
          if (!window.deskwork) throw new Error('No desktop bridge');
          return (await window.deskwork.snapshot()).preview;
        }),
        false,
      );
      await expect(shell.getByRole('heading', { name: '今天，有什么需要处理？' })).toBeVisible();
      const page = application.windows().find((entry) => entry.url().includes('/products'));
      assert.ok(page);
      await page.locator('#login').click();
      await expect(page.locator('#record-value')).toHaveValue('优选果，常温存放');
      await shell
        .getByRole('textbox', { name: '告诉 DSH 你的业务目标' })
        .fill('修改 SG-1001 的备注');
      await shell.getByRole('button', { name: '发送任务' }).click();
      await expect(shell.getByRole('button', { name: '确认并保存' })).toBeVisible();
      await expect(page.locator('#record-value')).toHaveValue('优选果，常温存放');
      await shell.getByRole('button', { name: 'Agent', exact: true }).click();
      await expect(shell.getByRole('button', { name: '查看页面', exact: true })).toBeVisible();
      await expect(shell.getByRole('button', { name: '确认并保存' })).toBeVisible();
      await shell.getByRole('button', { name: '确认并保存' }).click();
      await expect(shell.getByText('已完成并核对', { exact: true })).toBeVisible();
      assert.equal(
        await readFile(join(directory, 'fixture-record.txt'), 'utf8'),
        '优选果，到货后优先检查品质',
      );
      await shell.getByRole('button', { name: '查看页面', exact: true }).click();
      await expect(page.locator('#record-value')).toHaveValue('优选果，到货后优先检查品质');
      assert.equal(await page.evaluate(() => typeof Reflect.get(window, 'deskwork')), 'undefined');
      await mkdir('.artifacts/desktop', { recursive: true });
      await shell.screenshot({ path: '.artifacts/desktop/verified-shell.png' });
      const capture = await application.evaluate(async ({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        if (!window) throw new Error('No window');
        return (await window.capturePage()).toPNG().toString('base64');
      });
      await writeFile('.artifacts/desktop/verified-workspace.png', Buffer.from(capture, 'base64'));
      await application.close();
      application = await electron.launch(launchOptions);
      await expect.poll(() => application.windows().length).toBe(2);
      await expect
        .poll(() => application.windows().some((entry) => entry.url().startsWith('file:')))
        .toBe(true);
      const restoredShell = application.windows().find((entry) => entry.url().startsWith('file:'));
      const restoredPage = application.windows().find((entry) => entry.url().includes('/products'));
      assert.ok(restoredShell && restoredPage);
      await expect(restoredPage.locator('#record-value')).toHaveValue('优选果，到货后优先检查品质');
      await expect(restoredShell.getByText('已完成并核对', { exact: true })).toBeVisible();
      await restoredShell
        .getByRole('textbox', { name: '告诉 DSH 你的业务目标' })
        .fill('再查看商品 SG-1001');
      await restoredShell.getByRole('button', { name: '发送任务' }).click();
      await expect(restoredShell.getByText('本轮已完成', { exact: true })).toBeVisible();
      const reused = await restoredShell.evaluate(async () => {
        if (!window.deskwork) throw new Error('No bridge');
        return (await window.deskwork.snapshot()).task.metrics.skillReused;
      });
      assert.equal(reused, true);
      await restoredPage.locator('#record-value').fill('优选果，常温存放');
      await restoredPage.locator('#save').click();
      await expect(restoredPage.locator('#record-value')).toHaveValue('优选果，常温存放');
    } finally {
      await application.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
