import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { z } from 'zod';
import { PluginManager } from '../src/host/plugin-manager.ts';
import { DshRuntime } from '../src/runtime/dsh-runtime.ts';
import { startToolServer } from '../src/runtime/tool-server.ts';

for (const scenario of [
  {
    label: 'installed browser service plugin',
    skill: 'senguo-query',
    tool: 'senguo_query_categories',
    arguments: '{}',
    evidence: '货款',
    install: true,
  },
  {
    label: 'bundled development guide without installed plugins',
    skill: 'develop-deskwork-plugin',
    tool: 'deskwork_developer_docs',
    arguments: '{"id":"contract"}',
    evidence: '动作与确认',
    install: false,
  },
])
  await test(scenario.label, { timeout: 45000 }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deskwork-native-plugin-'));
    const calls: string[] = [];
    let modelCalls = 0;
    let complete: (() => void) | undefined;
    const done = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const bridge = await startToolServer((request) => {
      calls.push(request.name);
      if (request.name === 'plugin_action') {
        assert.equal(request.arguments.effect, 'read');
        return Promise.resolve({ status: 'executed-observe-again' });
      }
      return Promise.resolve({
        pageId: 'page-a',
        revision: String(calls.length),
        url: 'https://pf.senguo.cc/manage/#/main/home/tab/takenote',
        title: '流水',
        text: calls.length > 1 ? '所有类别\n货款\n其他收入\n确认(0/2)' : '流水 收支类别',
        elements: [
          {
            ref: 'e0',
            tag: 'button',
            role: 'button',
            name: '收支类别',
            value: '',
            type: 'button',
            href: '',
            disabled: false,
          },
        ],
      });
    });
    const model = createServer((request, response) => {
      const handle = async (): Promise<void> => {
        let body = '';
        request.setEncoding('utf8');
        for await (const chunk of request) {
          if (typeof chunk === 'string') body += chunk;
        }
        const parsed = z
          .object({
            tools: z.array(
              z.object({
                function: z.object({
                  name: z.string(),
                  parameters: z.object({ type: z.literal('object') }).loose(),
                }),
              }),
            ),
          })
          .parse(JSON.parse(body));
        assert.ok(parsed.tools.some((tool) => tool.function.name === scenario.tool));
        assert.ok(parsed.tools.some((tool) => tool.function.name === 'skill'));
        modelCalls++;
        const name = modelCalls === 1 ? 'skill' : scenario.tool;
        const delta =
          modelCalls < 3
            ? {
                role: 'assistant',
                tool_calls: [
                  {
                    index: 0,
                    id: `plugin-${String(modelCalls)}`,
                    type: 'function',
                    function: {
                      name,
                      arguments:
                        modelCalls === 1
                          ? JSON.stringify({ name: scenario.skill })
                          : scenario.arguments,
                    },
                  },
                ],
              }
            : { role: 'assistant', content: '已读取类别选项。' };
        if (modelCalls === 3) {
          assert.ok(body.includes(scenario.evidence));
          complete?.();
        }
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(
          `data: ${JSON.stringify({ id: 'plugin-model', choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`,
        );
        response.end(
          `data: ${JSON.stringify({ id: 'plugin-model', choices: [{ index: 0, delta: {}, finish_reason: modelCalls < 3 ? 'tool_calls' : 'stop' }] })}\n\ndata: [DONE]\n\n`,
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
    const resources = resolve(process.env['DESKWORK_TEST_RESOURCES'] ?? '.');
    const installedElectron: unknown = createRequire(import.meta.url)('electron');
    const executable =
      process.env['DESKWORK_TEST_EXECUTABLE'] ?? z.string().parse(installedElectron);
    const manager = new PluginManager({
      directory: join(directory, 'plugins'),
      executable,
      cliPath: join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
      pnpmPath: join(resources, 'node_modules/pnpm/bin/pnpm.cjs'),
    });
    let runtime: DshRuntime | undefined;
    try {
      await manager.load();
      if (scenario.install) await manager.install(`file:${resolve('plugins/senguo-query')}`);
      const dataDirectory = join(directory, 'runtime');
      const plugins = await manager.prepareRuntime(dataDirectory, 'site-a');
      runtime = new DshRuntime({
        executable,
        cliPath: join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
        mcpPath: join(resources, 'dist/runtime/mcp-server.mjs'),
        dataDirectory,
        plugins,
        apiKey: 'fixture-key',
        model: 'deepseek-v4-flash',
        baseURL: `http://127.0.0.1:${String(address.port)}`,
        toolEndpoint: bridge.endpoint,
        toolToken: bridge.token,
        onNotification: (): void => {},
      });
      await runtime.prompt('plugin-test', '请加载森果查询技能并读取收支类别');
      await Promise.race([
        done,
        new Promise((_, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('模型未完成插件调用'));
          }, 20000);
          timer.unref();
        }),
      ]);
      assert.deepEqual(
        calls,
        scenario.install ? ['observe_page', 'plugin_action', 'observe_page'] : [],
      );
      assert.equal(modelCalls, 3);
    } finally {
      await runtime?.close();
      await bridge.close();
      model.closeAllConnections();
      await new Promise<void>((resolve) => {
        model.close(() => {
          resolve();
        });
      });
      await rm(directory, { recursive: true, force: true });
    }
  });
