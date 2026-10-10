import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DshRuntime } from '../src/runtime/dsh-runtime.ts';
import { startToolServer } from '../src/runtime/tool-server.ts';
import { readMessagesRequest, writeMessagesResponse } from './fixtures/messages.ts';
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolveValue: (value: T) => void = () => {
    throw new Error('Deferred promise was not initialized');
  };
  const promise = new Promise<T>((resolve) => {
    resolveValue = resolve;
  });
  return {
    promise,
    resolve: (value): void => {
      resolveValue(value);
    },
  };
}

for (const outcome of [
  'allowed-once',
  'rejected',
  'cancelled',
  'unavailable',
  'late-answer',
] as const) {
  await test(
    `arbitrary plugin approval: ${outcome}, native audit and at-most-once execution`,
    { timeout: 20000 },
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'deskwork-approval-'));
      const resources = resolve(process.env['DESKWORK_TEST_RESOURCES'] ?? '.');
      const profile = join(directory, 'profiles/sdk-minimal');
      await mkdir(profile, { recursive: true });
      await writeFile(
        join(profile, 'package.json'),
        JSON.stringify({
          name: 'approval-fixture',
          private: true,
          dsh: { profile: { bundles: ['@deepseek-ai/dsh-sdk-minimal'] } },
        }),
      );
      await writeFile(
        join(profile, 'cordis.patch.yml'),
        JSON.stringify([
          {
            insert: [
              {
                id: 'arbitrary-approval-fixture',
                name: resolve('.artifacts/native-approval/plugin.mjs'),
              },
            ],
          },
        ]),
      );
      let executions = 0;
      const decision = deferred<{ outcome: string }>();
      const asked = deferred<undefined>();
      const idle = deferred<undefined>();
      const audit: unknown[] = [];
      const bridge = await startToolServer((request) => {
        if (request.name === 'native_approval') {
          assert.equal(request.arguments.toolName, 'fixture_arbitrary_write');
          asked.resolve(undefined);
          return outcome === 'late-answer' ? decision.promise : Promise.resolve({ outcome });
        }
        executions++;
        return Promise.resolve({ ok: true });
      });
      let calls = 0;
      const model = createServer((request, response) => {
        void readMessagesRequest(request).then(() => {
          calls++;
          writeMessagesResponse(
            response,
            calls === 1 ? { name: 'fixture_arbitrary_write', input: {} } : 'Fixture turn finished',
            `approval-${String(calls)}`,
          );
        });
      });
      await new Promise<void>((done) => model.listen(0, '127.0.0.1', done));
      const address = model.address();
      assert.ok(address && typeof address !== 'string');
      const runtime = new DshRuntime({
        executable: process.env['DESKWORK_TEST_EXECUTABLE'] ?? process.execPath,
        cliPath: join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
        mcpPath: join(resources, 'dist/runtime/mcp-server.mjs'),
        dataDirectory: directory,
        apiKey: 'fixture-key',
        model: 'deepseek-v4-flash',
        baseURL: `http://127.0.0.1:${String(address.port)}`,
        toolEndpoint: bridge.endpoint,
        toolToken: bridge.token,
        onNotification: (method, params): void => {
          if (method === 'session.event') audit.push(params);
          if (method === 'session.status' && JSON.stringify(params).includes('idle'))
            idle.resolve(undefined);
        },
      });
      try {
        await runtime.prompt('approval-conversation', 'Run the fixture operation');
        await asked.promise;
        if (outcome === 'late-answer') {
          await runtime.close();
          decision.resolve({ outcome: 'allowed-once' });
        } else await idle.promise;
        assert.equal(executions, outcome === 'allowed-once' ? 1 : 0);
        const events = audit.map((raw) => JSON.stringify(raw));
        assert.equal(events.filter((raw) => raw.includes('approval/asked')).length, 1);
        assert.equal(events.filter((raw) => raw.includes('approval/decided')).length, 1);
        assert.ok(
          events.some(
            (raw) =>
              raw.includes('approval/decided') &&
              raw.includes(outcome === 'late-answer' ? 'cancelled' : outcome),
          ),
        );
      } finally {
        decision.resolve({ outcome: 'cancelled' });
        await runtime.close();
        await bridge.close();
        model.closeAllConnections();
        await new Promise<void>((done) =>
          model.close(() => {
            done();
          }),
        );
        await rm(directory, { recursive: true, force: true });
      }
    },
  );
}
