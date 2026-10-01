import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { z } from 'zod';
import type { RuntimeOptions } from '../src/runtime/dsh-runtime.ts';
import { DshRuntime } from '../src/runtime/dsh-runtime.ts';
import { readMessagesRequest, writeMessagesResponse } from './fixtures/messages.ts';
import { startToolServer } from '../src/runtime/tool-server.ts';

await test(
  'published DSH runtime discovers Deskwork MCP tools, performs a tool turn and closes',
  { timeout: 45000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deskwork-runtime-'));
    const calls: string[] = [];
    const notifications: { method: string; params: unknown }[] = [];
    const bridge = await startToolServer((request) => {
      calls.push(request.name);
      return Promise.resolve({ page: '测试商品 EX-1001，备注为原值' });
    });
    let requests = 0;
    let restoredContext = false;
    let receivedDeskworkPersona = false;
    const model = createServer((request, response) => {
      const handle = async (): Promise<void> => {
        const parsed = await readMessagesRequest(request);
        const body = JSON.stringify(parsed);
        assert.deepEqual(
          parsed.tools.map((tool) => tool.name).sort(),
          [
            'skill',
            'deskwork_developer_docs',
            'list_mcp_resources',
            'list_mcp_resource_templates',
            'read_mcp_resource',
            'mcp__deskwork__observe_page',
            'mcp__deskwork__list_pages',
            'mcp__deskwork__select_page',
            'mcp__deskwork__act_on_page',
            'mcp__deskwork__capture_page',
            'mcp__deskwork__verify_result',
            'mcp__deskwork__request_takeover',
          ].sort(),
        );
        requests++;
        receivedDeskworkPersona ||= JSON.stringify(parsed.system).includes(
          'You are the DSH Deskwork website assistant',
        );
        if (requests === 3)
          restoredContext =
            body.includes('读取页面，说明结果') && body.includes('已读取测试商品，尚未修改。');
        writeMessagesResponse(
          response,
          requests === 1
            ? { name: 'mcp__deskwork__observe_page', input: {} }
            : '已读取测试商品，尚未修改。',
          `runtime-${String(requests)}`,
        );
      };
      void handle().catch((error: unknown) => {
        response.writeHead(500).end(String(error));
      });
    });
    await new Promise<void>((resolve) => {
      model.listen(0, '127.0.0.1', resolve);
    });
    const address = model.address();
    assert.ok(address && typeof address !== 'string');
    let complete: (() => void) | undefined;
    let completed = new Promise<void>((resolve) => {
      complete = resolve;
    });
    let sawRunning = false;
    const options: RuntimeOptions = {
      executable: process.env['DESKWORK_TEST_EXECUTABLE'] ?? process.execPath,
      cliPath: resolve(
        process.env['DESKWORK_TEST_RESOURCES'] ?? '.',
        'node_modules/@deepseek-ai/dsh/lib/bin.js',
      ),
      mcpPath: resolve(
        process.env['DESKWORK_TEST_RESOURCES'] ?? '.',
        'dist/runtime/mcp-server.mjs',
      ),
      dataDirectory: directory,
      apiKey: 'fixture-key-not-a-secret',
      model: 'deepseek-v4-flash',
      baseURL: `http://127.0.0.1:${String(address.port)}`,
      toolEndpoint: bridge.endpoint,
      toolToken: bridge.token,
      onNotification: (method, params): void => {
        notifications.push({ method, params });
        if (method === 'session.status') {
          const status = z.object({ status: z.string() }).parse(params);
          if (status.status === 'running') sawRunning = true;
          if (sawRunning && status.status === 'idle') complete?.();
        }
      },
    };
    let runtime = new DshRuntime(options);
    try {
      await runtime.start();
      await runtime.prompt('deskwork-test', '读取页面，说明结果');
      await Promise.race([
        completed,
        new Promise<never>((_resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Runtime did not become idle'));
          }, 20000);
          timer.unref();
        }),
      ]);
      assert.deepEqual(calls, ['observe_page'], JSON.stringify(notifications));
      assert.equal(requests, 2);
      assert.equal(
        receivedDeskworkPersona,
        true,
        'Deskwork instructions must reach the actual model system message',
      );
      await runtime.close();
      sawRunning = false;
      completed = new Promise<void>((resolve) => {
        complete = resolve;
      });
      runtime = new DshRuntime({
        ...options,
        recoveryContext: [
          { role: 'user', text: '读取页面，说明结果' },
          { role: 'assistant', text: '已读取测试商品，尚未修改。' },
        ],
      });
      await runtime.prompt('deskwork-test', '恢复后继续说明');
      await Promise.race([
        completed,
        new Promise<never>((_resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Restored runtime did not become idle'));
          }, 10000);
          timer.unref();
        }),
      ]);
      assert.equal(
        restoredContext,
        true,
        'Host-provided recovery context must reach the restarted runtime',
      );
      assert.ok(JSON.stringify(notifications).includes('已读取测试商品'));
      await mkdir('.artifacts/runtime', { recursive: true });
      await writeFile('.artifacts/runtime/events.json', JSON.stringify(notifications, null, 2));
    } finally {
      await runtime.close();
      await bridge.close();
      model.closeAllConnections();
      await new Promise<void>((resolve) => {
        model.close(() => {
          resolve();
        });
      });
      await rm(directory, { recursive: true, force: true });
    }
  },
);

await test(
  'disabled selected model provider fails startup instead of SDK default fallback',
  { timeout: 15000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deskwork-provider-error-'));
    const profile = join(directory, 'profiles/sdk-minimal');
    await mkdir(profile, { recursive: true });
    await writeFile(
      join(profile, 'package.json'),
      JSON.stringify({
        name: 'provider-negative-control',
        private: true,
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-sdk-minimal'] } },
      }),
    );
    await writeFile(join(profile, 'cordis.patch.yml'), '- id: llm-deepseek\n  disabled: true\n');
    const resources = resolve(process.env['DESKWORK_TEST_RESOURCES'] ?? '.');
    const runtime = new DshRuntime({
      executable: process.env['DESKWORK_TEST_EXECUTABLE'] ?? process.execPath,
      cliPath: join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
      mcpPath: join(resources, 'dist/runtime/mcp-server.mjs'),
      dataDirectory: directory,
      apiKey: 'fixture-key',
      model: 'deepseek-v4-flash',
      toolEndpoint: 'http://127.0.0.1:1',
      toolToken: 'fixture-token',
      onNotification: (): void => {},
    });
    try {
      await assert.rejects(runtime.start(), /selected DeepSeek.*disabled/i);
    } finally {
      await runtime.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);

await test('invalid Messages address is rejected without starting a process or revealing credentials', async () => {
  const runtime = new DshRuntime({
    executable: '/missing-executable',
    cliPath: '/missing-cli',
    mcpPath: '/missing-mcp',
    dataDirectory: '/missing-data',
    apiKey: 'secret',
    model: 'deepseek-v4-flash',
    baseURL: 'https://user:secret@example.test/v1/chat/completions?token=secret',
    toolEndpoint: '',
    toolToken: 'secret',
    onNotification: (): void => {},
  });
  await assert.rejects(
    runtime.start(),
    (error) =>
      error instanceof Error &&
      error.message.includes('Messages API root URL') &&
      !error.message.includes('secret'),
  );
  await runtime.close();
});
