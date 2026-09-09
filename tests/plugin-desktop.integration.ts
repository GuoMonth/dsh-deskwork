import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { _electron as electron, expect } from '@playwright/test';
import { z } from 'zod';

await test(
  'desktop plugin installation, two page structures, independent targets and lifecycle',
  { timeout: 90000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deskwork-plugin-desktop-'));
    const site = createServer((request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(
        request.url === '/select'
          ? '<title>Native select</title><select aria-label="类别"><option>货款</option><option>其他收入</option></select>'
          : '<title>Custom menu</title><button onclick="document.querySelector(\'section\').hidden=false">类别</button><section hidden>货款 其他收入</section>',
      );
    });
    let replies = 0;
    const model = createServer((request, response) => {
      const handle = async (): Promise<void> => {
        let body = '';
        request.setEncoding('utf8');
        for await (const chunk of request) {
          if (typeof chunk === 'string') body += chunk;
        }
        const parsed = z
          .object({
            messages: z.array(z.object({ role: z.string() }).loose()),
            tools: z.array(z.object({ function: z.object({ name: z.string() }) })),
          })
          .parse(JSON.parse(body));
        assert.ok(parsed.tools.some((tool) => tool.function.name === 'fixture_query'));
        const finished = parsed.messages.some((message) => message.role === 'tool');
        const delta = finished
          ? { role: 'assistant', content: '查询完成，已读取类别。' }
          : {
              role: 'assistant',
              tool_calls: [
                {
                  index: 0,
                  id: `query-${String(++replies)}`,
                  type: 'function',
                  function: { name: 'fixture_query', arguments: '{}' },
                },
              ],
            };
        if (finished) assert.ok(body.includes('货款'));
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(
          `data: ${JSON.stringify({ id: 'query', choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`,
        );
        response.end(
          `data: ${JSON.stringify({ id: 'query', choices: [{ index: 0, delta: {}, finish_reason: finished ? 'stop' : 'tool_calls' }] })}\n\ndata: [DONE]\n\n`,
        );
      };
      void handle().catch((error: unknown) => {
        response.writeHead(500).end(String(error));
      });
    });
    for (const server of [site, model])
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', resolve);
      });
    const siteAddress = site.address();
    const modelAddress = model.address();
    assert.ok(
      siteAddress &&
        typeof siteAddress !== 'string' &&
        modelAddress &&
        typeof modelAddress !== 'string',
    );
    const base = `http://127.0.0.1:${String(siteAddress.port)}`;
    const executablePath = process.env['DESKWORK_TEST_EXECUTABLE'];
    const app = await electron.launch({
      ...(executablePath ? { executablePath } : {}),
      args: [
        ...(executablePath ? [] : [resolve('.')]),
        `--profile-directory=${directory}`,
        `--test-model-url=http://127.0.0.1:${String(modelAddress.port)}`,
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      ],
    });
    try {
      await expect
        .poll(() => app.windows().some((page) => page.url().startsWith('file:')))
        .toBe(true);
      const shell = app.windows().find((page) => page.url().startsWith('file:'));
      assert.ok(shell);
      await shell.getByRole('button', { name: '插件', exact: true }).click();
      await shell.getByRole('button', { name: '发现', exact: true }).click();
      await shell.getByLabel('插件安装来源').fill(`file:${resolve('tests/fixtures/query-plugin')}`);
      await expect(shell.getByRole('button', { name: '安装插件', exact: true })).toBeDisabled();
      await shell.getByRole('button', { name: '开发', exact: true }).click();
      await expect(shell.getByLabel('插件安装来源')).toBeHidden();
      await shell.getByRole('button', { name: '发现', exact: true }).click();
      await expect(shell.getByLabel('插件安装来源')).toHaveValue(
        `file:${resolve('tests/fixtures/query-plugin')}`,
      );
      await shell.getByRole('checkbox').check();
      await shell.getByRole('button', { name: '安装插件', exact: true }).click();
      await expect(shell.getByText('deskwork-query-fixture', { exact: true })).toBeVisible({
        timeout: 25000,
      });
      await mkdir('.artifacts/desktop', { recursive: true });
      await shell.getByRole('dialog').screenshot({ path: '.artifacts/desktop/m2-plugins.png' });
      await shell.getByRole('button', { name: '关闭对话框' }).click();
      for (const path of ['/select', '/custom']) {
        await shell.evaluate(
          async ({ url, name }) => {
            if (!window.deskwork) throw new Error('Missing desktop bridge');
            await window.deskwork.command({ type: 'add-site', url, name });
          },
          { url: base + path, name: path },
        );
        await expect
          .poll(() => app.windows().some((page) => page.url() === base + path))
          .toBe(true);
        await shell.getByRole('textbox', { name: '告诉 DSH 你的目标' }).fill('查询类别');
        await shell.getByRole('button', { name: '发送任务' }).click();
        await expect(shell.getByText('本轮已完成', { exact: true })).toBeVisible({
          timeout: 25000,
        });
        assert.equal(await shell.getByRole('button', { name: '确认并执行' }).count(), 0);
      }
      const snapshot = await shell.evaluate(() => {
        if (!window.deskwork) throw new Error('Missing desktop bridge');
        return window.deskwork.snapshot();
      });
      assert.equal(snapshot.contexts.length, 2);
      assert.ok(
        snapshot.contexts.every(
          (context) => context.task.status === 'succeeded' && !context.task.requiresVerification,
        ),
      );
      assert.deepEqual(
        snapshot.contexts.map((context) => context.task.metrics.toolCalls),
        [1, 3],
      );
      await shell.getByRole('button', { name: '插件', exact: true }).click();
      await shell.getByRole('button', { name: '取消挂载', exact: true }).click();
      await expect(shell.getByText(/1.0.0 · 已禁用/)).toBeVisible();
      await shell.getByRole('button', { name: '卸载', exact: true }).click();
      await expect(shell.getByText('还没有安装插件。网站可以照常使用。')).toBeVisible();
    } finally {
      await app.close();
      for (const server of [site, model]) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
          server.close(() => {
            resolve();
          });
        });
      }
      await rm(directory, { recursive: true, force: true });
    }
  },
);
