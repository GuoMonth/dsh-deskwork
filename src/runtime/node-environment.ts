// Adapted from DeepSeek 639ed015 node-environment.ts (MIT), packaging/DSH-LICENSE.
import { delimiter } from 'node:path';

export function nodeEnvironment(environment: NodeJS.ProcessEnv, bin?: string): NodeJS.ProcessEnv {
  return {
    ...environment,
    ELECTRON_RUN_AS_NODE: '1',
    ...(bin === undefined ? {} : { PATH: `${bin}${delimiter}${environment['PATH'] ?? ''}` }),
  };
}
