import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { startErpFixture } from './erp-fixture.ts';

async function runElectron(
  phase: 'seed' | 'restore',
  profileDirectory: string,
  configurationPath: string,
  reportPath: string,
): Promise<unknown> {
  const platformExecutable =
    process.platform === 'win32'
      ? 'electron.exe'
      : process.platform === 'darwin'
        ? 'Electron.app/Contents/MacOS/Electron'
        : 'electron';
  const executable = path.resolve('node_modules/electron/dist', platformExecutable);
  const args = [
    path.resolve('.artifacts/build/experiments/electron-session-control/electron-probe.js'),
    phase,
    profileDirectory,
    configurationPath,
    reportPath,
  ];
  const needsVirtualDisplay = process.platform === 'linux' && !process.env['DISPLAY'];
  const child = spawn(
    needsVirtualDisplay ? 'xvfb-run' : executable,
    needsVirtualDisplay ? ['--auto-servernum', executable, ...args] : args,
    { stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' },
  );
  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    output += chunk;
  });
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    output += chunk;
  });
  const timeout = setTimeout(() => {
    output += '\nElectron process group exceeded the 30 second limit';
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGKILL');
    else child.kill('SIGKILL');
  }, 30_000);
  try {
    const exitArguments: readonly unknown[] = await once(child, 'close');
    assert.equal(exitArguments[0], 0, `Electron ${phase} failed:\n${output}`);
  } finally {
    clearTimeout(timeout);
  }
  const report: unknown = JSON.parse(await readFile(reportPath, 'utf8'));
  return report;
}

await test(
  'real Electron preserves login across processes and isolates CDP targets and accounts',
  { timeout: 75_000 },
  async () => {
    const outputDirectory = path.resolve('.artifacts/electron-session-control');
    await mkdir(outputDirectory, { recursive: true });
    const evidencePath = path.join(outputDirectory, 'latest.json');
    const environment = {
      hypothesis: 'H-001',
      executedAt: new Date().toISOString(),
      platform: process.platform,
      architecture: process.arch,
      kernel: os.release(),
      nodeVersion: process.version,
    };
    await writeFile(
      evidencePath,
      JSON.stringify({ ...environment, result: 'running' }, null, 2) + '\n',
    );
    const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'deskwork-h001-'));
    const fixture = await startErpFixture();
    try {
      const configurationPath = path.join(temporaryDirectory, 'workspace.json');
      await writeFile(
        configurationPath,
        JSON.stringify({
          tabs: [
            {
              id: 'procurement',
              url: `${fixture.origin}/procurement`,
              sessionPartition: 'persist:account-a',
            },
            {
              id: 'inventory',
              url: `${fixture.origin}/inventory`,
              sessionPartition: 'persist:account-a',
            },
            {
              id: 'isolated-account',
              url: `${fixture.origin}/isolated`,
              sessionPartition: 'persist:account-b',
            },
          ],
        }),
      );
      const profileDirectory = path.join(temporaryDirectory, 'profile');
      const reports: unknown[] = [];
      for (const phase of ['seed', 'restore'] as const) {
        const report = await runElectron(
          phase,
          profileDirectory,
          configurationPath,
          path.join(temporaryDirectory, `${phase}.json`),
        );
        assert.ok(typeof report === 'object' && report !== null && 'observations' in report);
        assert.deepEqual(report.observations, {
          configuredTabIds: ['procurement', 'inventory', 'isolated-account'],
          distinctPageTargets: 3,
          initialSessionStatuses: phase === 'seed' ? [401, 401, 401] : [200, 200, 401],
          authenticatedSessionStatuses: [200, 200, 401],
          clickCounts: [1, 0, 0],
          nodeExposure: ['undefined/undefined', 'undefined/undefined', 'undefined/undefined'],
        });
        reports.push(report);
      }
      await writeFile(
        evidencePath,
        JSON.stringify(
          {
            ...environment,
            result: 'supported-within-fixture-scope',
            reports,
          },
          null,
          2,
        ) + '\n',
      );
    } catch (error: unknown) {
      await writeFile(
        evidencePath,
        JSON.stringify(
          {
            ...environment,
            result: 'failed',
            reason: error instanceof Error ? error.message : String(error),
          },
          null,
          2,
        ) + '\n',
      );
      throw error;
    } finally {
      await fixture.close();
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  },
);
