import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, mkdir, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { _electron as electron, expect } from '@playwright/test';
import { readMessagesRequest, writeMessagesResponse, hasToolResult } from './fixtures/messages.ts';
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
          ? '<title>Native select</title><select aria-label="Category"><option>Option A</option><option>Option B</option></select>'
          : '<title>Custom menu</title><button onclick="document.querySelector(\'section\').hidden=false">Category</button><section hidden>Option A Option B</section>',
      );
    });
    let replies = 0;
    const model = createServer((request, response) => {
      const handle = async (): Promise<void> => {
        const parsed = await readMessagesRequest(request);
        const body = JSON.stringify(parsed);
        assert.ok(parsed.tools.some((tool) => tool.name === 'fixture_query'));
        const finished = parsed.messages.some((message) => hasToolResult(message.content));
        if (finished) assert.ok(body.includes('Option A'));
        writeMessagesResponse(
          response,
          finished ? '查询完成，已读取Category。' : { name: 'fixture_query', input: {} },
          `query-${String(++replies)}`,
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
      cwd: process.env['DESKWORK_TEST_WORKING_DIRECTORY'] ?? resolve('.'),
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
      await shell.getByRole('button', { name: 'Plugins', exact: true }).click();
      await shell.getByRole('button', { name: 'Discover', exact: true }).click();
      await shell
        .getByLabel('Plugin installation source')
        .fill(`file:${resolve('tests/fixtures/query-plugin')}`);
      await expect(
        shell.getByRole('button', { name: 'Install plugin', exact: true }),
      ).toBeDisabled();
      await shell.getByRole('button', { name: 'Develop', exact: true }).click();
      await expect(shell.getByLabel('Plugin installation source')).toBeHidden();
      await shell.getByRole('button', { name: 'Discover', exact: true }).click();
      await expect(shell.getByLabel('Plugin installation source')).toHaveValue(
        `file:${resolve('tests/fixtures/query-plugin')}`,
      );
      await shell.getByRole('checkbox').check();
      await shell.getByRole('button', { name: 'Install plugin', exact: true }).click();
      await expect(shell.getByText('deskwork-query-fixture', { exact: true })).toBeVisible({
        timeout: 25000,
      });
      const installations = join(directory, 'plugins/installations');
      const installationId = (await readdir(installations))[0];
      assert.ok(installationId);
      const installation = z
        .object({ executable: z.string(), node: z.string(), electron: z.literal('44.0.0') })
        .parse(
          JSON.parse(
            await readFile(
              join(
                installations,
                installationId,
                'profiles/sdk-minimal/node_modules/deskwork-query-fixture/installation-runtime.json',
              ),
              'utf8',
            ),
          ),
        );
      assert.equal(installation.executable, await app.evaluate(({ app }) => app.getPath('exe')));
      assert.match(installation.node, /^24\./);
      await mkdir('.artifacts/desktop', { recursive: true });
      await shell.getByRole('dialog').screenshot({ path: '.artifacts/desktop/m2-plugins.png' });
      await shell.getByRole('button', { name: 'Close dialog' }).click();
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
        await shell.getByRole('textbox', { name: 'Tell DSH your goal' }).fill('查询Category');
        await shell.getByRole('button', { name: 'Send task' }).click();
        await expect(shell.getByText('Turn completed', { exact: true })).toBeVisible({
          timeout: 25000,
        });
        assert.equal(await shell.getByRole('button', { name: 'Confirm and execute' }).count(), 0);
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
      await shell.getByRole('button', { name: 'Plugins', exact: true }).click();
      await shell.getByRole('button', { name: 'Unmount', exact: true }).click();
      await expect(shell.getByText(/1.0.0 · Disabled/)).toBeVisible();
      await shell.getByRole('button', { name: 'Uninstall', exact: true }).click();
      await expect(
        shell.getByText('No plugins installed. Your websites are ready to use.'),
      ).toBeVisible();
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
