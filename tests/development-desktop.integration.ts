import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { test } from 'node:test';
import { _electron as electron, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { observationSchema } from '../packages/plugin-sdk/src/index.ts';

await test(
  'external MCP drives a selected Electron website, with UI confirmation and no model key',
  { timeout: 60000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deskwork-developer-desktop-'));
    let saves = 0;
    const website = createServer((request, response) => {
      if (request.url === '/save' && request.method === 'POST') {
        saves++;
        response.end('保存完成');
        return;
      }
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(
        `<!doctype html><title>${request.url === '/other' ? 'Other' : 'Development'}</title><button onclick="document.querySelector('p').textContent='查询完成'">查询</button><button onclick="fetch('/save',{method:'POST'}).then(r=>r.text()).then(t=>document.querySelector('p').textContent=t)">保存</button><p>${saves ? '保存完成' : '暂无结果'}</p>`,
      );
    });
    await new Promise<void>((resolve) => website.listen(0, '127.0.0.1', resolve));
    const address = website.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${String(address.port)}`;
    const executablePath = process.env['DESKWORK_TEST_EXECUTABLE'];
    const app = await electron.launch({
      ...(executablePath ? { executablePath } : {}),
      args: [
        ...(executablePath ? [] : [resolve('.')]),
        `--profile-directory=${directory}`,
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      ],
    });
    const client = new Client({ name: 'external-developer', version: '1.0.0' });
    try {
      await expect
        .poll(() => app.windows().some((page) => page.url().startsWith('file:')))
        .toBe(true);
      const shell = app.windows().find((page) => page.url().startsWith('file:'));
      assert.ok(shell);
      const siteId = await shell.evaluate(async (url) => {
        const bridge = window.deskwork;
        if (!bridge) throw new Error('No bridge');
        await bridge.command({ type: 'add-site', name: '开发网站', url });
        const first = (await bridge.snapshot()).activeSiteId;
        await bridge.command({ type: 'add-site', name: '另一个网站', url: url + '/other' });
        await bridge.command({ type: 'select-site', siteId: first });
        return first;
      }, base);
      await expect.poll(() => app.windows().some((page) => page.url().startsWith(base))).toBe(true);
      await shell.getByRole('button', { name: '插件', exact: true }).click();
      await shell.getByRole('button', { name: '开发', exact: true }).click();
      await shell.getByLabel('开发网站', { exact: true }).selectOption(siteId);
      await shell.getByRole('button', { name: '允许外部 AI 开发此网站' }).click();
      const config = z
        .object({
          mcpServers: z.object({
            'deskwork-development': z.object({
              command: z.string(),
              args: z.array(z.string()),
              env: z.record(z.string(), z.string()),
            }),
          }),
        })
        .parse(JSON.parse(await shell.getByLabel('开发 MCP 配置').inputValue()));
      await client.connect(new StdioClientTransport(config.mcpServers['deskwork-development']));
      assert.equal((await client.listResources()).resources.length, 5);
      await mkdir('.artifacts/desktop', { recursive: true });
      await shell.getByRole('dialog').screenshot({ path: '.artifacts/desktop/m3-development.png' });
      await shell.getByRole('button', { name: '关闭对话框' }).click();
      const call = async (name: string, args: Record<string, unknown> = {}): Promise<unknown> => {
        const result = await client.callTool({ name: `deskwork_browser_${name}`, arguments: args });
        assert.notEqual(result.isError, true, JSON.stringify(result));
        const text = z
          .array(z.object({ type: z.literal('text'), text: z.string() }))
          .parse(result.content)[0];
        assert.ok(text);
        const raw: unknown = JSON.parse(text.text);
        return raw;
      };
      await shell.getByRole('tab', { name: /另一个网站/ }).click();
      const observation = observationSchema.parse(await call('observe'));
      assert.equal(observation.title, 'Development');
      const query = observation.elements.find((entry) => entry.name === '查询');
      assert.ok(query);
      await call('act', {
        effect: 'read',
        proposal: {
          pageId: observation.pageId,
          revision: observation.revision,
          action: { kind: 'click', ref: query.ref },
          risk: 'ordinary',
          summary: '查询列表',
        },
      });
      await shell.getByRole('tab', { name: /开发网站/ }).click();
      const current = observationSchema.parse(await call('observe'));
      assert.match(current.text, /查询完成/);
      const save = current.elements.find((entry) => entry.name === '保存');
      assert.ok(save);
      const proposal = {
        pageId: current.pageId,
        revision: current.revision,
        action: { kind: 'click', ref: save.ref },
        risk: 'consequential',
        summary: '保存测试结果',
        expectedText: '保存完成',
      };
      const pending = z
        .object({ status: z.literal('waiting-for-human-confirmation') })
        .parse(await call('act', { effect: 'write', proposal }));
      assert.ok(pending);
      assert.equal(saves, 0);
      await shell.getByRole('button', { name: '确认并执行' }).click();
      await expect.poll(() => saves).toBe(1);
      const status = z
        .object({ requiresVerification: z.boolean(), status: z.string() })
        .parse(await call('status'));
      assert.equal(status.requiresVerification, true);
      await call('act', { effect: 'write', proposal });
      assert.equal(saves, 1);
      const result = z.object({ verified: z.boolean() }).parse(await call('verify'));
      assert.equal(result.verified, true);
      await call('stop');
      const revoked = await client.callTool({ name: 'deskwork_browser_observe', arguments: {} });
      assert.equal(revoked.isError, true);
      assert.equal(saves, 1);
    } finally {
      await client.close();
      await app.close();
      website.closeAllConnections();
      await new Promise<void>((resolve) =>
        website.close(() => {
          resolve();
        }),
      );
      await rm(directory, { recursive: true, force: true });
    }
  },
);
