export interface CheckTask {
  readonly name: string;
  readonly arguments: readonly string[];
  readonly environment?: NodeJS.ProcessEnv;
}

export interface CheckResult {
  readonly name: string;
  readonly passed: boolean;
  readonly output: string;
  readonly milliseconds: number;
}

export function runCheck(task: CheckTask): Promise<CheckResult> {
  const startedAt = performance.now();
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [...task.arguments],
      {
        encoding: 'utf8',
        env: { ...process.env, ...task.environment },
        timeout: 120_000,
        maxBuffer: 2 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({
          name: task.name,
          passed: error === null,
          output: stdout + stderr || error?.message || '',
          milliseconds: Math.round(performance.now() - startedAt),
        });
      },
    );
  });
}
import { execFile } from 'node:child_process';
