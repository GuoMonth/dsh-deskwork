import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect } from '@playwright/test';
import { z } from 'zod';
import { startWebsite } from '../tests/fixtures/websites.ts';

await test(
  'Browser Harness observes the Electron page and also exposes the privileged shell target',
  { timeout: 40000 },
  async () => {
    const directory = await mkdtemp(join(tmpdir(), 'deskwork-bh-'));
    const fixture = await startWebsite('directory');
    await writeFile(
      join(directory, 'workspace.json'),
      JSON.stringify({
        version: 2,
        name: 'Harness experiment',
        sites: [{ id: 'fixture', sessionId: 'fixture', name: 'Fixture', url: fixture.origin }],
      }),
    );
    const python = resolve('.artifacts/browser-harness-env/bin/python');
    const application = await electron.launch({
      args: [
        resolve('.'),
        `--profile-directory=${directory}`,
        '--remote-debugging-port=19338',
        '--no-sandbox',
      ],
    });
    let daemon: ReturnType<typeof spawn> | undefined;
    const env = {
      ...process.env,
      BH_HOME: join(directory, 'harness'),
      BU_NAME: 'default',
      BU_CDP_URL: 'http://127.0.0.1:19338',
      BH_TAB_MARKER: '0',
    };
    const run = async (source: string): Promise<string> =>
      (await promisify(execFile)(python, ['-c', source], { env, timeout: 10000 })).stdout;
    try {
      await application.firstWindow();
      await expect.poll(() => application.windows().length).toBe(2);
      daemon = spawn(python, ['-m', 'browser_harness.daemon'], { env, stdio: 'ignore' });
      await expect
        .poll(async () => {
          try {
            return (
              await run('from browser_harness import _ipc; print(_ipc.ping("default", timeout=1))')
            ).trim();
          } catch {
            return 'False';
          }
        })
        .toBe('True');
      const raw = await run(
        'from browser_harness import helpers as h; import json; print(json.dumps(h.list_tabs()))',
      );
      const tabs = z
        .array(z.object({ targetId: z.string(), url: z.string() }).loose())
        .parse(JSON.parse(raw));
      const erp = tabs.find((tab) => tab.url.startsWith(fixture.origin));
      assert.ok(erp);
      const shellExposed = tabs.some(
        (tab) => tab.url.startsWith('file:') && tab.url.includes('/dist/ui/'),
      );
      assert.equal(shellExposed, true);
      const title = await run(
        `from browser_harness import helpers as h; h.switch_tab(${JSON.stringify(erp.targetId)}); print(h.js("document.title"))`,
      );
      assert.ok(title.includes('Directory fixture'));
      await mkdir('.artifacts/browser-harness', { recursive: true });
      await writeFile(
        '.artifacts/browser-harness/result.json',
        JSON.stringify(
          {
            version: '0.1.13',
            electron: '44.2.0',
            isolation: 'host',
            erpDiscovered: true,
            targetReadSucceeded: true,
            shellTargetExposed: shellExposed,
            productDecision:
              'Use host-owned Electron CDP references; do not expose the unfiltered Harness toolset to the model.',
          },
          null,
          2,
        ),
      );
    } finally {
      if (daemon) {
        daemon.kill('SIGTERM');
        await new Promise<void>((resolve) => {
          if (daemon?.exitCode !== null) resolve();
          else
            daemon.once('close', () => {
              resolve();
            });
        });
      }
      await application.close();
      await fixture.close();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
