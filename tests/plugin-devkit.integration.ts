import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

const run = promisify(execFile);

await test(
  'packed development kit works outside the repository without desktop or credentials',
  { timeout: 180000 },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'deskwork-devkit-'));
    const client = new Client({ name: 'external-plugin-author', version: '1.0.0' });
    try {
      const archives = path.join(directory, 'archives');
      await mkdir(archives);
      const pack = async (source: string): Promise<string> => {
        const { stdout } = await run('npm', [
          'pack',
          path.resolve(source),
          '--json',
          '--pack-destination',
          archives,
        ]);
        const result = z
          .array(z.object({ filename: z.string() }))
          .min(1)
          .parse(JSON.parse(stdout));
        const entry = result[0];
        assert.ok(entry);
        return path.join(archives, entry.filename);
      };
      const sdk = await pack('packages/plugin-sdk');
      const kit = await pack('packages/plugin-devkit');
      await writeFile(path.join(directory, 'package.json'), JSON.stringify({ private: true }));
      await run(
        'npm',
        ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline', kit],
        { cwd: directory, timeout: 90000 },
      );
      const cli = path.join(directory, 'node_modules/@guomonth/deskwork-plugin-devkit/lib/cli.js');
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [cli, 'mcp'],
        cwd: directory,
        env: {},
        stderr: 'pipe',
      });
      await client.connect(transport);
      const resources = await client.listResources();
      assert.equal(resources.resources.length, 5);
      for (const resource of resources.resources) {
        const result = await client.readResource({ uri: resource.uri });
        assert.ok(result.contents.length);
      }
      const information = await client.callTool({
        name: 'deskwork_development_info',
        arguments: {},
      });
      assert.match(JSON.stringify(information), /explicit-desktop-connection/);
      const search = await client.callTool({
        name: 'deskwork_search_documents',
        arguments: { query: '停止' },
      });
      assert.match(JSON.stringify(search), /contract/);
      const denied = await client.callTool({
        name: 'deskwork_read_document',
        arguments: { id: '../../package.json' },
      });
      assert.equal(denied.isError, true);
      const guide = await client.callTool({
        name: 'deskwork_read_document',
        arguments: { id: 'workflow' },
      });
      assert.equal(guide.isError, undefined);
      await client.close();

      const project = path.join(directory, 'example-query');
      await run(process.execPath, [cli, 'create', project, '--sdk', sdk], { cwd: directory });
      await assert.rejects(
        run(process.execPath, [cli, 'create', project, '--sdk', sdk], { cwd: directory }),
        /EEXIST/,
      );
      assert.match(await readFile(path.join(project, 'index.ts'), 'utf8'), /example-query/);
      await run(
        'npm',
        ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--prefer-offline'],
        { cwd: project, timeout: 90000 },
      );
      await run('npm', ['run', 'check'], { cwd: project });
      await run('npm', ['run', 'build'], { cwd: project });
      const compiled = await readFile(path.join(project, 'lib/index.js'), 'utf8');
      assert.match(compiled, /ctx\.deskworkBrowser\.connect/);
      assert.doesNotMatch(compiled, /src\/runtime|src\/core/);
      await pack(project);
    } finally {
      await client.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
