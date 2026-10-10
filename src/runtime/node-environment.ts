// Adapted from DeepSeek 639ed015 node-environment.ts (MIT), packaging/DSH-LICENSE.
import { delimiter } from 'node:path';
import {
  readDesktopLoginShellEnvironment,
  resolveDesktopLoginShellConfig,
} from './login-shell-environment.ts';

let desktopEnvironmentPromise: Promise<NodeJS.ProcessEnv> | undefined;
export function desktopEnvironment(): Promise<NodeJS.ProcessEnv> {
  desktopEnvironmentPromise ??= readDesktopLoginShellEnvironment(
    process.env,
    resolveDesktopLoginShellConfig(process.env),
  ).then((result) => {
    if (result.failures.length)
      console.warn(
        'Login shell environment: some candidates failed; using the available environment.',
      );
    return result.environment;
  });
  return desktopEnvironmentPromise;
}

export function nodeEnvironment(environment: NodeJS.ProcessEnv, bin?: string): NodeJS.ProcessEnv {
  return {
    ...environment,
    ELECTRON_RUN_AS_NODE: '1',
    ...(bin === undefined ? {} : { PATH: `${bin}${delimiter}${environment['PATH'] ?? ''}` }),
  };
}
