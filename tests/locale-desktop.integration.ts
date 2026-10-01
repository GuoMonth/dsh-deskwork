import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { _electron as electron, expect } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import { readMessagesRequest, writeMessagesResponse } from './fixtures/messages.ts';

await test(
  'desktop defaults to English, switches UI and model language, and restores Chinese after restart',
  { timeout: 90000 },
  async () => {
    const root = await mkdtemp(join(tmpdir(), 'deskwork-language-desktop-'));
    let expectedLocale: 'en' | 'zh' = 'en';
    let modelCalls = 0;
    const website = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end('<title>原名 / Original title</title><h1>Original website content 原文</h1>');
    });
    const model = createServer((request, response) => {
      const handle = async (): Promise<void> => {
        const input = await readMessagesRequest(request);
        const system = JSON.stringify(input.system);
        assert.ok(
          system.includes(
            expectedLocale === 'en'
              ? 'You are the DSH Deskwork website assistant'
              : '你是 DSH Deskwork 网站助手',
          ),
        );
        modelCalls++;
        writeMessagesResponse(
          response,
          expectedLocale === 'en' ? 'English fixture answer' : '中文夹具回复',
          `locale-${String(modelCalls)}`,
        );
      };
      void handle().catch((error: unknown) => {
        response.writeHead(500).end(String(error));
      });
    });
    for (const server of [website, model])
      await new Promise<void>((ready) => {
        server.listen(0, '127.0.0.1', ready);
      });
    const address = website.address(),
      modelAddress = model.address();
    assert.ok(
      address && typeof address !== 'string' && modelAddress && typeof modelAddress !== 'string',
    );
    const executablePath = process.env['DESKWORK_TEST_EXECUTABLE'];
    const launch = (): Promise<ElectronApplication> =>
      electron.launch({
        ...(executablePath ? { executablePath } : {}),
        cwd: process.env['DESKWORK_TEST_WORKING_DIRECTORY'] ?? resolve('.'),
        args: [
          ...(executablePath ? [] : [resolve('.')]),
          `--profile-directory=${root}`,
          `--test-model-url=http://127.0.0.1:${String(modelAddress.port)}`,
          ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
        ],
      });
    let app = await launch();
    try {
      const shell = await app.firstWindow();
      await expect(shell.getByRole('button', { name: 'Add website', exact: true })).toBeVisible();
      assert.equal(await shell.locator('html').getAttribute('lang'), 'en');
      await shell.evaluate(
        async (url) => {
          await window.deskwork?.command({ type: 'add-site', url, name: '原名' });
        },
        `http://127.0.0.1:${String(address.port)}`,
      );
      await shell.getByLabel('Tell DSH your goal').fill('Describe this page');
      await shell.getByRole('button', { name: 'Send task' }).click();
      await expect(shell.getByText('English fixture answer', { exact: true })).toBeVisible({
        timeout: 25000,
      });
      await expect(shell.getByRole('button', { name: 'Send task' })).toBeDisabled();
      await expect
        .poll(async () => (await shell.evaluate(() => window.deskwork?.snapshot()))?.runningSiteId)
        .toBeNull();
      await shell.getByRole('button', { name: 'Model settings', exact: true }).click();
      await shell.getByLabel('Language').selectOption('zh');
      expectedLocale = 'zh';
      await expect(shell.getByLabel('语言')).toHaveValue('zh');
      assert.equal(await shell.locator('html').getAttribute('lang'), 'zh-CN');
      await shell.getByRole('button', { name: '关闭对话框' }).click();
      await shell.getByRole('button', { name: '插件', exact: true }).click();
      await expect(shell.getByRole('button', { name: '发现', exact: true })).toBeVisible();
      await shell.getByRole('button', { name: '开发', exact: true }).click();
      await expect(shell.getByRole('heading', { name: '插件开发', exact: true })).toBeVisible();
      await mkdir('.artifacts/desktop', { recursive: true });
      await shell.screenshot({ path: '.artifacts/desktop/language-zh.png' });
      await shell.getByRole('button', { name: '关闭对话框' }).click();
      await shell.getByLabel('告诉 DSH 你的目标').fill('Describe this page again');
      await shell.getByRole('button', { name: '发送任务' }).click();
      await expect(shell.getByText('中文夹具回复', { exact: true })).toBeVisible({
        timeout: 25000,
      });
      await expect
        .poll(async () => (await shell.evaluate(() => window.deskwork?.snapshot()))?.runningSiteId)
        .toBeNull();
      await app.close();
      app = await launch();
      await expect
        .poll(() => app.windows().some((page) => page.url().startsWith('file:')))
        .toBe(true);
      const restored = app.windows().find((page) => page.url().startsWith('file:'));
      assert.ok(restored);
      await expect(restored.getByRole('button', { name: '模型设置', exact: true })).toBeVisible();
      assert.equal(await restored.locator('html').getAttribute('lang'), 'zh-CN');
      await expect(restored.getByText('English fixture answer', { exact: true })).toBeVisible();
      await expect(restored.getByRole('tab', { name: '原名', exact: true })).toBeVisible();
      await restored.getByRole('button', { name: '模型设置', exact: true }).click();
      await restored.getByLabel('语言').selectOption('en');
      await expect(restored.getByLabel('Language')).toHaveValue('en');
      await restored.getByRole('button', { name: 'Close dialog' }).click();
      await restored.screenshot({ path: '.artifacts/desktop/language-en.png' });
      assert.equal(await restored.locator('html').getAttribute('lang'), 'en');
      assert.equal(modelCalls, 2);
    } finally {
      await app.close();
      for (const server of [website, model]) {
        server.closeAllConnections();
        await new Promise<void>((closed) => {
          server.close(() => {
            closed();
          });
        });
      }
      await rm(root, { recursive: true, force: true });
    }
  },
);
