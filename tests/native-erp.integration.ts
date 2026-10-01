import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { PluginManager } from '../src/host/plugin-manager.ts';
import { DshRuntime } from '../src/runtime/dsh-runtime.ts';
import type { RuntimeOptions } from '../src/runtime/dsh-runtime.ts';
import { startToolServer } from '../src/runtime/tool-server.ts';
import { writeMessagesResponse } from './fixtures/messages.ts';

const requestSchema = z.object({
  tools: z.array(z.object({ name: z.string() })),
  messages: z.array(z.object({ role: z.string(), content: z.array(z.unknown()) })),
});
const scopeSchema = z.object({ site: z.string(), account: z.string() }).loose();
function toolValue(content: unknown[]): unknown {
  const result = content
    .map((block) =>
      z.object({ type: z.literal('tool_result'), content: z.unknown() }).safeParse(block),
    )
    .find((value) => value.success);
  assert.ok(result?.success);
  const texts = z
    .array(z.object({ type: z.literal('text'), text: z.string() }))
    .parse(result.data.content);
  const text = texts.map((block) => block.text).join('\n');
  const json = text.split('\n').find((line) => line.startsWith('[') || line.startsWith('{'));
  return json ? (JSON.parse(json) as unknown) : text;
}

await test(
  'packed ERP reuses Deskwork native services and shares experience with a clean second-user installation across restarts',
  { timeout: 60000 },
  async () => {
    const artifact = process.env['DESKWORK_ERP_TARBALL'];
    assert.ok(artifact, 'Set DESKWORK_ERP_TARBALL to the absolute candidate npm TGZ.');
    const resources = resolve(process.env['DESKWORK_TEST_RESOURCES'] ?? '.');
    const executable = process.env['DESKWORK_TEST_EXECUTABLE'] ?? process.execPath;
    const root = await mkdtemp(join(tmpdir(), 'deskwork-erp-native-'));
    let approvals = 0,
      requests = 0,
      observationCalls = 0;
    let scope: z.infer<typeof scopeSchema> | undefined;
    let recipientScope: z.infer<typeof scopeSchema> | undefined;
    let observationId = '',
      importFile = '';
    const notifications: unknown[] = [];
    let finish: (() => void) | undefined;
    let fail: ((error: unknown) => void) | undefined;
    let done = new Promise<void>((resolveDone, reject) => {
      finish = resolveDone;
      fail = reject;
    });
    const bridge = await startToolServer((request) => {
      if (request.name === 'native_approval') {
        assert.equal(request.arguments.toolName, 'erp_experience_import');
        assert.ok(request.arguments.reason.includes(importFile));
        approvals++;
        return Promise.resolve({ outcome: approvals === 1 ? 'rejected' : 'allowed-once' });
      }
      assert.equal(request.name, 'observe_page');
      observationCalls++;
      return Promise.resolve({
        pageId: 'erp-page',
        revision: '1',
        url: 'https://erp.example.test/app/',
        title: 'Purchasing',
        text: 'Purchasing',
        elements: [],
      });
    });
    const model = createServer((request, response) => {
      const handle = async (): Promise<void> => {
        let body = '';
        request.setEncoding('utf8');
        for await (const chunk of request) if (typeof chunk === 'string') body += chunk;
        const parsed = requestSchema.parse(JSON.parse(body));
        assert.ok(parsed.tools.some((tool) => tool.name === 'erp_native_status'));
        assert.ok(
          !parsed.tools.some(
            (tool) =>
              tool.name.startsWith('mcp__playwright-mcp__') || tool.name === 'erp_browser_action',
          ),
        );
        const stage = requests++;
        const previous = ![0, 9, 12, 17].includes(stage)
          ? toolValue(parsed.messages.at(-1)?.content ?? [])
          : undefined;
        let name: string;
        let input: unknown = {};
        if (stage === 0) name = 'erp_native_status';
        else if (stage === 1) {
          const status = z
            .object({ browserProvider: z.literal('deskwork'), scope: scopeSchema })
            .parse(previous);
          scope = status.scope;
          name = 'mcp__deskwork__observe_page';
        } else if (stage === 2) name = 'erp_native_observation_save';
        else if (stage === 3) {
          observationId = z.object({ id: z.string(), text: z.string() }).parse(previous).id;
          name = 'erp_knowledge_record';
          input = {
            scope,
            records: [
              {
                id: 'menu',
                kind: 'menu',
                name: 'Purchasing',
                aliases: ['采购'],
                description: 'Review the purchasing menu.',
                expectedVersion: 0,
                stage: 'observed',
                flags: [],
                lifecycle: 'active',
                evidence: [{ observationId, quote: 'Purchasing' }],
                dependencies: [],
              },
            ],
          };
        } else if (stage === 4) {
          name = 'erp_experience_export';
          input = { scope };
        } else if (stage === 5) {
          importFile = z
            .object({ importFile: z.string(), records: z.literal(1) })
            .parse(previous).importFile;
          name = 'erp_experience_import';
          input = { path: importFile, scope };
        } else if (stage === 6) {
          assert.ok(
            JSON.stringify(previous).includes('denied') ||
              JSON.stringify(previous).includes('rejected'),
            JSON.stringify(previous),
          );
          name = 'erp_experience_import';
          input = { path: importFile, scope };
        } else if (stage === 7) {
          assert.equal(
            z.object({ state: z.literal('needs-review') }).parse(previous).state,
            'needs-review',
          );
          assert.ok(
            body.includes('erp-experience-'),
            'imported experience is in the native Skill catalog',
          );
          name = 'erp_knowledge_search';
          input = { scope, query: 'Purchasing', after: '', limit: 50 };
        } else if (stage === 9) name = 'erp_native_status';
        else if (stage === 10) {
          assert.deepEqual(z.object({ scope: scopeSchema }).parse(previous).scope, scope);
          assert.ok(body.includes('erp-experience-'), 'native Skill survives runtime restart');
          name = 'erp_knowledge_search';
          input = { scope, query: 'Purchasing', after: '', limit: 50 };
        } else if (stage === 12) {
          assert.ok(!body.includes('erp-experience-'), 'a clean recipient has no sender Skill');
          name = 'erp_native_status';
        } else if (stage === 13) {
          recipientScope = z
            .object({ browserProvider: z.literal('deskwork'), scope: scopeSchema })
            .parse(previous).scope;
          assert.notDeepEqual(recipientScope, scope);
          assert.equal(recipientScope.account, 'second-user-site');
          assert.notEqual(recipientScope.account, scope?.account);
          name = 'erp_knowledge_search';
          input = { scope: recipientScope, query: '', after: '', limit: 50 };
        } else if (stage === 14) {
          assert.equal(z.object({ items: z.array(z.unknown()) }).parse(previous).items.length, 0);
          name = 'erp_experience_import';
          input = { scope: recipientScope, path: importFile };
        } else if (stage === 15) {
          const imported = z
            .object({ state: z.literal('needs-review'), scope: scopeSchema })
            .parse(previous);
          assert.deepEqual(imported.scope, recipientScope);
          assert.ok(body.includes('erp-experience-'), 'recipient discovers the imported Skill');
          name = 'erp_knowledge_search';
          input = { scope: recipientScope, query: 'Purchasing', after: '', limit: 50 };
        } else if (stage === 17) name = 'erp_native_status';
        else if (stage === 18) {
          assert.deepEqual(z.object({ scope: scopeSchema }).parse(previous).scope, recipientScope);
          assert.ok(body.includes('erp-experience-'), 'recipient Skill survives runtime restart');
          name = 'erp_knowledge_search';
          input = { scope: recipientScope, query: 'Purchasing', after: '', limit: 50 };
        } else {
          const knowledge = z
            .object({
              items: z.array(
                z.object({
                  record: z.object({
                    id: z.string(),
                    flags: z.array(z.string()),
                    scope: scopeSchema,
                    evidence: z.array(z.unknown()),
                  }),
                  verifications: z.array(z.unknown()),
                }),
              ),
            })
            .parse(previous);
          assert.equal(knowledge.items.length, stage >= 12 ? 1 : 2);
          assert.ok(
            knowledge.items.some(
              (item) =>
                item.record.id.startsWith('shared-') && item.record.flags.includes('needs-review'),
            ),
          );
          if (stage >= 12) {
            for (const item of knowledge.items) {
              assert.deepEqual(item.record.scope, recipientScope);
              assert.deepEqual(item.record.evidence, []);
              assert.deepEqual(item.verifications, []);
            }
          }
          writeMessagesResponse(response, '已导出、确认导入并核对本地经验。', 'complete');
          finish?.();
          return;
        }
        writeMessagesResponse(response, { name, input }, `call-${String(stage)}`);
      };
      void handle().catch((error: unknown) => {
        fail?.(error);
        response.writeHead(400).end(String(error));
      });
    });
    await new Promise<void>((ready) => {
      model.listen(0, '127.0.0.1', ready);
    });
    const address = model.address();
    assert.ok(address && typeof address !== 'string');
    const manager = new PluginManager({
      directory: join(root, 'plugins'),
      executable,
      cliPath: join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
      pnpmPath: join(resources, 'node_modules/pnpm/bin/pnpm.cjs'),
    });
    const recipientManager = new PluginManager({
      directory: join(root, 'plugins-second-user'),
      executable,
      cliPath: join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
      pnpmPath: join(resources, 'node_modules/pnpm/bin/pnpm.cjs'),
    });
    let runtime: DshRuntime | undefined;
    try {
      await manager.load();
      await manager.install(resolve(artifact));
      const dataDirectory = join(root, 'runtime');
      const plugins = await manager.prepareRuntime(dataDirectory, 'receiver-site');
      const options: RuntimeOptions = {
        executable,
        cliPath: join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
        mcpPath: join(resources, 'dist/runtime/mcp-server.mjs'),
        dataDirectory,
        plugins,
        site: { id: 'receiver-site', name: 'Fixture ERP', url: 'https://erp.example.test/app/' },
        apiKey: 'fixture-key',
        model: 'deepseek-v4-flash',
        baseURL: `http://127.0.0.1:${String(address.port)}`,
        toolEndpoint: bridge.endpoint,
        toolToken: bridge.token,
        onNotification: (method, params): void => {
          notifications.push({ method, params });
        },
      };
      runtime = new DshRuntime(options);
      await runtime.prompt('native-erp', '观察采购菜单，积累经验，导出后经我确认导入。');
      await Promise.race([
        done,
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => {
            reject(
              new Error(
                `Native ERP did not finish (${String(requests)} requests): ${JSON.stringify(notifications.slice(-3))}`,
              ),
            );
          }, 25000);
          timer.unref();
        }),
      ]);
      assert.equal(approvals, 2);
      assert.equal(observationCalls, 1);
      assert.equal(requests, 9);
      const exported = await readFile(importFile, 'utf8');
      assert.ok(!exported.includes('receiver-site') && !exported.includes(observationId));
      assert.ok(JSON.stringify(notifications).includes('approval/decided'));
      await runtime.close();
      done = new Promise<void>((resolveDone, reject) => {
        finish = resolveDone;
        fail = reject;
      });
      runtime = new DshRuntime(options);
      await runtime.prompt('fresh-session-after-restart', '重新打开后，从已保存经验核对采购菜单。');
      await Promise.race([
        done,
        new Promise<never>((_, reject) => {
          const timer = setTimeout(() => {
            reject(new Error('Restarted ERP did not load shared knowledge'));
          }, 10000);
          timer.unref();
        }),
      ]);
      assert.equal(requests, 12);
      assert.equal(approvals, 2);
      assert.equal(observationCalls, 1);
      await runtime.close();
      await recipientManager.load();
      await recipientManager.install(resolve(artifact));
      const recipientDirectory = join(root, 'runtime-second-user');
      const recipientOptions: RuntimeOptions = {
        ...options,
        dataDirectory: recipientDirectory,
        plugins: await recipientManager.prepareRuntime(recipientDirectory, 'second-user-site'),
        site: {
          id: 'second-user-site',
          name: 'Recipient ERP',
          url: 'https://erp.example.test/app/',
        },
      };
      for (const session of ['second-user-clean-install', 'second-user-after-restart']) {
        done = new Promise<void>((resolveDone, reject) => {
          finish = resolveDone;
          fail = reject;
        });
        runtime = new DshRuntime(recipientOptions);
        await runtime.prompt(session, '在自己的 ERP 中核对分享的采购经验。');
        await Promise.race([
          done,
          new Promise<never>((_, reject) => {
            const timer = setTimeout(() => {
              reject(new Error('Clean recipient did not import or restore shared knowledge'));
            }, 10000);
            timer.unref();
          }),
        ]);
        await runtime.close();
      }
      assert.equal(requests, 20);
      assert.equal(approvals, 3);
      assert.equal(
        observationCalls,
        1,
        'recipient reuses knowledge without inheriting live evidence',
      );
    } finally {
      await runtime?.close();
      await manager.close();
      await recipientManager.close();
      await bridge.close();
      model.closeAllConnections();
      await new Promise<void>((closed) => {
        model.close(() => {
          closed();
        });
      });
      await rm(root, { recursive: true, force: true });
    }
  },
);
