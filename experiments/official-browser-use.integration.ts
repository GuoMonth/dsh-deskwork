import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { _electron as electron, expect } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { startWebsite } from '../tests/fixtures/websites.ts';
import { SdkProbe } from './official-browser-use/sdk-probe.ts';

const mcpResultSchema = z.object({
  isError: z.boolean().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() }).loose()),
});

function resultText(value: unknown): string {
  const result = mcpResultSchema.parse(value);
  const text = result.content.map((content) => content.text ?? '').join('\n');
  assert.notEqual(result.isError, true, text);
  return text;
}

function authenticatedTab(text: string): number {
  const match = text.match(/^- (\d+):[^\n]*entry=authenticated/m);
  assert.ok(match, text);
  return z.coerce.number().int().nonnegative().parse(match[1]);
}

function contentText(value: unknown): string {
  if (typeof value === 'string') return value;
  const blocks = z
    .array(
      z
        .object({ type: z.string(), text: z.string().optional(), content: z.unknown().optional() })
        .loose(),
    )
    .safeParse(value);
  if (!blocks.success) return '';
  return blocks.data
    .map((block) => (block.type === 'text' ? (block.text ?? '') : contentText(block.content)))
    .join('\n');
}

await test(
  'official Playwright provider attaches to Deskwork and reveals the integration gaps',
  { timeout: 150000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deskwork-official-browser-'));
    const website = await startWebsite('directory');
    const secondWebsite = await startWebsite('settings');
    const official = resolve('.artifacts/official-dsh');
    const cli = join(official, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
    const providerCli = join(official, 'node_modules/@playwright/mcp/cli.js');
    const launchOptions = {
      args: [
        resolve('.'),
        `--profile-directory=${directory}`,
        '--remote-debugging-port=0',
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      ],
    };
    await writeFile(
      join(directory, 'workspace.json'),
      JSON.stringify({
        version: 2,
        name: 'Official browser experiment',
        sites: [
          {
            id: 'first',
            sessionId: 'first',
            name: 'Authenticated',
            url: website.origin + '/?entry=authenticated',
          },
          {
            id: 'isolated',
            sessionId: 'isolated',
            name: 'Isolated',
            url: website.origin + '/?entry=isolated',
          },
          { id: 'second', sessionId: 'second', name: 'Second website', url: secondWebsite.origin },
        ],
      }),
    );
    let application = await electron.launch(launchOptions);
    const mcp = new Client({ name: 'deskwork-official-research', version: '1.0.0' });
    let probe: SdkProbe | undefined;
    let modelRequests = 0;
    let providerSnapshotAuthenticated = false;
    let officialCatalog: string[] = [];
    const modelResults: unknown[] = [];
    let selectedTab = 0;
    const model = createServer((request, response) => {
      const handle = async (): Promise<void> => {
        let raw = '';
        for await (const chunk of request) raw += String(chunk);
        const parsed = z
          .object({
            tools: z.array(z.object({ name: z.string() })),
            messages: z.array(z.object({ role: z.string(), content: z.unknown() }).loose()),
          })
          .parse(JSON.parse(raw));
        officialCatalog = parsed.tools.map((tool) => tool.name);
        const last = parsed.messages.at(-1)?.content;
        modelResults.push(last);
        const lastText = contentText(last);
        modelRequests++;
        if (modelRequests === 2) selectedTab = authenticatedTab(lastText);
        if (modelRequests === 4)
          providerSnapshotAuthenticated = lastText.includes('已登录测试账号');
        const action =
          modelRequests === 1
            ? { name: 'browser_tabs', arguments: { action: 'list' } }
            : modelRequests === 2
              ? { name: 'browser_tabs', arguments: { action: 'select', index: selectedTab } }
              : modelRequests === 3
                ? { name: 'browser_snapshot', arguments: {} }
                : undefined;
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        const event = (type: string, value: unknown): void => {
          response.write(`event: ${type}\ndata: ${JSON.stringify(value)}\n\n`);
        };
        event('message_start', {
          type: 'message_start',
          message: {
            id: `research-${String(modelRequests)}`,
            type: 'message',
            role: 'assistant',
            content: [],
            model: 'deepseek-v4-flash',
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 20, output_tokens: 0 },
          },
        });
        event('content_block_start', {
          type: 'content_block_start',
          index: 0,
          content_block: action
            ? {
                type: 'tool_use',
                id: `call_${String(modelRequests)}`,
                name: `mcp__playwright-mcp__${action.name}`,
                input: {},
              }
            : { type: 'text', text: '' },
        });
        event('content_block_delta', {
          type: 'content_block_delta',
          index: 0,
          delta: action
            ? { type: 'input_json_delta', partial_json: JSON.stringify(action.arguments) }
            : { type: 'text_delta', text: 'Official provider read the logged-in fixture.' },
        });
        event('content_block_stop', { type: 'content_block_stop', index: 0 });
        event('message_delta', {
          type: 'message_delta',
          delta: { stop_reason: action ? 'tool_use' : 'end_turn', stop_sequence: null },
          usage: { output_tokens: 10 },
        });
        event('message_stop', { type: 'message_stop' });
        response.end();
      };
      void handle().catch((error: unknown) => response.writeHead(500).end(String(error)));
    });
    try {
      await expect.poll(() => application.windows().length).toBe(4);
      const first = application
        .windows()
        .find((page) => page.url().includes('entry=authenticated'));
      const isolated = application.windows().find((page) => page.url().includes('entry=isolated'));
      const shell = application.windows().find((page) => page.url().startsWith('file:'));
      assert.ok(first && isolated && shell);
      await shell.getByRole('tab', { name: 'Authenticated', exact: false }).click();
      await first.getByText('登录演示账号').click();
      await expect(first.getByText('已登录测试账号')).toBeVisible();
      await expect(isolated.getByText('登录演示账号')).toBeVisible();
      await first.goto(website.origin + '/?entry=authenticated');
      const [port] = (await readFile(join(directory, 'DevToolsActivePort'), 'utf8')).split('\n');
      const endpoint = `http://127.0.0.1:${String(z.coerce.number().int().positive().parse(port))}`;
      await mcp.connect(
        new StdioClientTransport({
          command: process.execPath,
          args: [providerCli, '--browser', 'chromium', '--cdp-endpoint', endpoint],
          cwd: directory,
        }),
      );
      const tabs = resultText(
        await mcp.callTool({ name: 'browser_tabs', arguments: { action: 'list' } }),
      );
      assert.ok(tabs.includes('file:'), tabs);
      assert.ok(tabs.includes('entry=isolated'), tabs);
      assert.ok(tabs.includes(secondWebsite.origin), tabs);
      resultText(
        await mcp.callTool({
          name: 'browser_tabs',
          arguments: { action: 'select', index: authenticatedTab(tabs) },
        }),
      );
      const snapshot = resultText(await mcp.callTool({ name: 'browser_snapshot', arguments: {} }));
      assert.ok(snapshot.includes('已登录测试账号'), snapshot);
      await first.evaluate((origin) => {
        const frame = document.createElement('iframe');
        frame.title = 'Cross-origin fixture';
        frame.src = origin;
        document.body.append(frame);
      }, secondWebsite.origin);
      await expect(
        first.frameLocator('iframe').getByRole('heading', { name: 'Settings fixture' }),
      ).toBeVisible();
      const frameSnapshot = resultText(
        await mcp.callTool({ name: 'browser_snapshot', arguments: {} }),
      );
      const crossOriginFrameObserved = /iframe[\s\S]*heading "Settings fixture"/.test(
        frameSnapshot,
      );
      await first.evaluate(() => {
        document.querySelector('iframe')?.remove();
      });
      const catalog = await mcp.listTools();
      assert.ok(catalog.tools.some((tool) => tool.name === 'browser_evaluate'));
      resultText(
        await mcp.callTool({
          name: 'browser_fill_form',
          arguments: {
            fields: [
              {
                target: 'input[name="value"]',
                name: 'Note',
                type: 'textbox',
                value: 'Official MCP direct write',
              },
            ],
          },
        }),
      );
      resultText(
        await mcp.callTool({
          name: 'browser_click',
          arguments: { target: 'button[type="submit"]' },
        }),
      );
      await expect.poll(website.writes).toBe(1);
      assert.equal(website.value(), 'Official MCP direct write');
      await expect(shell.getByRole('button', { name: '确认并执行' })).toHaveCount(0);
      await expect(isolated.getByText('登录演示账号')).toBeVisible();
      await mcp.close();
      assert.equal(
        application.windows().length,
        4,
        'Attached-server cleanup must keep Deskwork alive',
      );
      await first.goto(website.origin + '/?entry=authenticated');

      await new Promise<void>((resolve) => {
        model.listen(0, '127.0.0.1', resolve);
      });
      const address = model.address();
      assert.ok(address && typeof address !== 'string');
      const home = join(directory, 'official-sdk');
      await mkdir(home);
      const patch = join(home, 'probe.patch.json');
      await writeFile(
        patch,
        JSON.stringify([
          ...[
            'persistent-bash',
            'persistent-pwsh',
            'str-replace-editor',
            'terminal-bash',
            'terminal-pwsh',
            'pty',
          ].map((id) => ({ id, disabled: true })),
          {
            id: 'llm-deepseek',
            config: {
              apiKeyEnv: 'DEEPSEEK_API_KEY',
              baseURL: `http://127.0.0.1:${String(address.port)}`,
              thinking: 'disabled',
            },
          },
          {
            insert: [
              { name: join(official, 'node_modules/@deepseek-ai/dsh-browser-use/lib/index.js') },
              {
                name: join(
                  official,
                  'node_modules/@deepseek-ai/dsh-experimental-browser-use-playwright-mcp/lib/index.js',
                ),
                config: { mode: 'attach', endpoint },
              },
            ],
          },
        ]),
      );
      const electronExecutable = await application.evaluate(({ app }) => app.getPath('exe'));
      probe = new SdkProbe(electronExecutable, cli, patch, home);
      const initialized = await probe.request('initialize', {
        cwd: home,
        provider: 'deepseek-official',
        model: 'deepseek-v4-flash',
      });
      const protocolVersion = z
        .object({ serverInfo: z.object({ version: z.string() }) })
        .parse(initialized).serverInfo.version;
      const runtimeVersion = z
        .object({ version: z.literal('0.2.0-rc.2') })
        .parse(
          JSON.parse(
            await readFile(join(official, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'),
          ),
        ).version;
      await probe.prompt('Read the configured authenticated website using the browser provider.');
      assert.equal(
        providerSnapshotAuthenticated,
        true,
        JSON.stringify({
          modelRequests,
          officialCatalog,
          modelResults,
          events: probe.events,
          stderr: probe.diagnosticText(),
        }),
      );
      assert.equal(modelRequests, 4);
      assert.ok(officialCatalog.includes('mcp__playwright-mcp__browser_evaluate'));
      assert.equal(
        probe.diagnosticText().includes('did not activate'),
        false,
        probe.diagnosticText(),
      );
      await probe.close();
      probe = undefined;
      await application.close();
      application = await electron.launch(launchOptions);
      await expect.poll(() => application.windows().length).toBe(4);
      const restored = application
        .windows()
        .find((page) => page.url().includes('entry=authenticated'));
      const restoredIsolated = application
        .windows()
        .find((page) => page.url().includes('entry=isolated'));
      assert.ok(restored && restoredIsolated);
      await expect(restored.getByText('已登录测试账号')).toBeVisible();
      await expect(restoredIsolated.getByText('登录演示账号')).toBeVisible();
      await mkdir('.artifacts/official-browser-use', { recursive: true });
      await writeFile(
        '.artifacts/official-browser-use/result.json',
        JSON.stringify(
          {
            dsh: runtimeVersion,
            sdkProtocolVersion: protocolVersion,
            provider: '0.2.0-rc.2',
            playwrightMcp: '0.0.80',
            electron: '44.0.0',
            isolation: 'host',
            chromiumSwitch: '--no-sandbox',
            sameLoggedInWebContents: true,
            modelCallsThroughOfficialProvider: modelRequests,
            sdkExecutable: 'Electron RunAsNode',
            modelProtocol: 'Messages',
            crossOriginFrameObserved,
            rawCatalogExposesShellAndOtherEntries: true,
            rawWriteWithoutHostConfirmation: true,
            hostPartitionsRemainIsolated: true,
            attachedCleanupKeepsApplication: true,
            hostIdentitySurvivesRestart: true,
            toolCatalog: officialCatalog,
            tabs,
          },
          null,
          2,
        ),
      );
    } finally {
      await probe?.close();
      await mcp.close();
      await application.close();
      model.closeAllConnections();
      if (model.listening)
        await new Promise<void>((resolve) => {
          model.close(() => {
            resolve();
          });
        });
      await website.close();
      await secondWebsite.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
