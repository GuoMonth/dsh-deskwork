import { z } from 'zod';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { DshRuntime } from '../src/runtime/dsh-runtime.ts';
import { PluginManager } from '../src/host/plugin-manager.ts';
import { PluginMarket } from '../src/host/plugin-market.ts';
import { startToolServer } from '../src/runtime/tool-server.ts';
import {
  readMessagesRequest,
  writeMessagesResponse,
  messagesText,
} from '../tests/fixtures/messages.ts';

const source =
  'https://codeload.github.com/omdsh-dev/dsh-tool-calculator/tar.gz/b2007a13f06bcf75bf07b9d277ee8d434a316490';
const entries = await new PluginMarket().search('dsh-tool-calculator');
assert.ok(
  entries.some((entry) => entry.source === 'https://github.com/omdsh-dev/dsh-tool-calculator'),
);
const directory = await mkdtemp(join(tmpdir(), 'deskwork-market-runtime-'));
const resources = resolve(
  process.env['DESKWORK_TEST_RESOURCES'] ?? '.artifacts/releases/linux-unpacked/resources/runtime',
);
const executable = resolve(
  process.env['DESKWORK_TEST_EXECUTABLE'] ?? '.artifacts/releases/linux-unpacked/dsh-deskwork',
);
const manager = new PluginManager({
  directory: join(directory, 'plugins'),
  executable,
  cliPath: join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
  pnpmPath: join(resources, 'node_modules/pnpm/bin/pnpm.cjs'),
});
const bridge = await startToolServer(() =>
  Promise.reject(new Error('market math probe has no browser task')),
);
let requests = 0;
let idle: (() => void) | undefined;
const completed = new Promise<void>((resolve) => {
  idle = resolve;
});
const model = createServer((request, response) => {
  const handle = async (): Promise<void> => {
    const parsed = await readMessagesRequest(request);
    assert.ok(parsed.tools.some((tool) => tool.name === 'calculator'));
    requests++;
    if (requests === 2) assert.equal(messagesText(parsed.messages.at(-1)?.content), '96');
    writeMessagesResponse(
      response,
      requests === 1
        ? { name: 'calculator', input: { expression: '15 + 27 * sqrt(9)' } }
        : '96 verified',
      `market-${String(requests)}`,
    );
  };
  void handle().catch((error: unknown) => {
    response.writeHead(500).end(String(error));
  });
});
let runtime: DshRuntime | undefined;
try {
  await manager.load();
  await manager.install(source);
  await new Promise<void>((resolve) => {
    model.listen(0, '127.0.0.1', resolve);
  });
  const address = model.address();
  assert.ok(address && typeof address !== 'string');
  const home = join(directory, 'runtime');
  const plugins = await manager.prepareRuntime(home, 'market-site');
  runtime = new DshRuntime({
    executable,
    cliPath: join(resources, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
    mcpPath: join(resources, 'dist/runtime/mcp-server.mjs'),
    dataDirectory: home,
    plugins,
    apiKey: 'fixture-key',
    model: 'deepseek-v4-flash',
    baseURL: `http://127.0.0.1:${String(address.port)}`,
    toolEndpoint: bridge.endpoint,
    toolToken: bridge.token,
    onNotification: (method, params): void => {
      if (
        method === 'session.status' &&
        z.object({ status: z.string() }).parse(params).status === 'idle' &&
        requests === 2
      )
        idle?.();
    },
  });
  await runtime.prompt('market-test', 'Calculate 15 + 27 * sqrt(9)');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      completed,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('Market tool did not complete'));
        }, 15000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  assert.equal(requests, 2);
  await mkdir('.artifacts/market-runtime', { recursive: true });
  await writeFile(
    '.artifacts/market-runtime/result.json',
    JSON.stringify(
      {
        source,
        catalog: 'https://awesome-dsh-plugin.com/plugins.json',
        installed: manager.state().installed.map(({ name, version }) => ({ name, version })),
        dsh: '0.2.0-rc.2',
        platform: process.platform,
        arch: process.arch,
        tool: 'calculator',
        result: 96,
        requests,
      },
      null,
      2,
    ),
  );
  console.log('Live market calculator installed and invoked: 96, 2 model calls.');
} finally {
  await runtime?.close();
  await manager.close();
  await bridge.close();
  model.closeAllConnections();
  await new Promise<void>((resolve) => {
    model.close(() => {
      resolve();
    });
  });
  await rm(directory, { recursive: true, force: true });
}
