import { context } from 'esbuild';
import { createServer } from 'vite';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { desktopBuildOptions } from './desktop-build-options.ts';
import './generate-tokens.ts';

const executable: unknown = createRequire(import.meta.url)('electron');
if (typeof executable !== 'string') throw new Error('请先运行 npm run experiment:prepare');
const server = await createServer();
await server.listen();
const address = server.resolvedUrls?.local[0];
if (!address) throw new Error('开发服务器没有本机地址');
const url: string = address;
let child: ChildProcess | undefined;
let ready = false;
let closing = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let restart = Promise.resolve();

async function stopChild(): Promise<void> {
  const previous = child;
  child = undefined;
  if (!previous || previous.exitCode !== null || previous.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const deadline = setTimeout(() => previous.kill('SIGKILL'), 3000);
    previous.once('exit', () => {
      clearTimeout(deadline);
      resolve();
    });
    previous.kill('SIGTERM');
  });
}
async function startChild(): Promise<void> {
  await stopChild();
  if (closing || typeof executable !== 'string') return;
  const args = process.argv.slice(2);
  child = spawn(
    executable,
    [
      resolve('.'),
      `--dev-server-url=${url}`,
      ...(!args.some((arg) => arg.startsWith('--profile-directory='))
        ? [`--profile-directory=${resolve('.artifacts/development-profile')}`]
        : []),
      ...args,
    ],
    { stdio: 'inherit', env: process.env },
  );
  child.on('error', (error) => {
    console.error(error);
  });
}
function scheduleRestart(): void {
  if (!ready || closing) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    restart = restart.then(startChild).catch((error: unknown) => {
      console.error(error);
    });
  }, 150);
}
const builds = desktopBuildOptions.map((options) => {
  let complete: () => void = () => {};
  let fail: (error: Error) => void = () => {};
  const promise = new Promise<void>((resolve, reject) => {
    complete = resolve;
    fail = reject;
  });
  return { options, initial: { promise, resolve: complete, reject: fail } };
});
const contexts = await Promise.all(
  builds.map(({ options, initial }) =>
    context({
      ...options,
      plugins: [
        {
          name: 'restart-desktop',
          setup(build): void {
            build.onEnd((result) => {
              if (result.errors.length) initial.reject(new Error('桌面初次构建失败'));
              else {
                initial.resolve();
                scheduleRestart();
              }
            });
          },
        },
      ],
    }),
  ),
);
await Promise.all(contexts.map((builder) => builder.watch()));
await Promise.all(builds.map(({ initial }) => initial.promise));
ready = true;
await startChild();
console.log(
  `Desktop development ready: ${url} (React/CSS hot reload; host changes restart Electron)`,
);

async function close(): Promise<void> {
  if (closing) return;
  closing = true;
  clearTimeout(timer);
  await restart;
  await stopChild();
  await Promise.all([...contexts.map((builder) => builder.dispose()), server.close()]);
}
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void close().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
