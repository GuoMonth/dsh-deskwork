import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { z } from 'zod';
import type { RuntimeOptions } from '../src/runtime/dsh-runtime.ts';
import { DshRuntime } from '../src/runtime/dsh-runtime.ts';
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
      return Promise.resolve({ page: '测试商品 SG-1001，备注为原值' });
    });
    let requests = 0;
    let restoredContext = false;
    let receivedDeskworkPersona = false;
    const model = createServer((request, response) => {
      const handle = async (): Promise<void> => {
        let body = '';
        request.setEncoding('utf8');
        for await (const chunk of request) {
          if (typeof chunk === 'string') body += chunk;
        }
        const parsed = z
          .object({ tools: z.array(z.object({ function: z.object({ name: z.string() }) })) })
          .parse(JSON.parse(body));
        assert.deepEqual(
          parsed.tools.map((tool) => tool.function.name).sort(),
          [
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
        const messages = z
          .object({ messages: z.array(z.object({ role: z.string(), content: z.unknown() })) })
          .parse(JSON.parse(body)).messages;
        receivedDeskworkPersona ||= messages.some(
          (message) =>
            message.role === 'system' &&
            typeof message.content === 'string' &&
            message.content.includes('你是 DSH Deskwork 网站助手'),
        );
        if (requests === 3)
          restoredContext =
            body.includes('读取页面，说明结果') && body.includes('已读取测试商品，尚未修改。');
        const delta =
          requests === 1
            ? {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'mcp__deskwork__observe_page', arguments: '{}' },
                  },
                ],
              }
            : { role: 'assistant', content: '已读取测试商品，尚未修改。' };
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(
          `data: ${JSON.stringify({ id: 'response-1', object: 'chat.completion.chunk', model: 'deepseek-v4-flash', choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`,
        );
        response.end(
          `data: ${JSON.stringify({ id: 'response-1', choices: [{ index: 0, delta: {}, finish_reason: requests === 1 ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } })}\n\ndata: [DONE]\n\n`,
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
      assert.deepEqual(calls, ['observe_page']);
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
