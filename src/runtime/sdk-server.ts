// SDK transport wiring adapted from DeepSeek 1f81c047 (MIT); see packaging/DSH-LICENSE.
import type { Context, FiberState } from '@deepseek-ai/cordis';
import '@deepseek-ai/dsh-llm';
import '@deepseek-ai/cordis-plugin-loader';
import { HarnessSdkJsonRpcServer } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import { JsonRpcLineTransport } from '@deepseek-ai/dsh-sdk-protocol';
export { Config } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import type { JsonRpcConfig } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import type {} from '@deepseek-ai/dsh-session-persistence';
import { z } from 'zod';

export const name = 'deskwork-sdk-server';
export const inject = ['agents', 'llm', 'loader', 'sessionPersistence', 'workingDirectory'];

// Cordis publishes FiberState as a const enum with no JavaScript export.
const fiberStates: Record<'pending' | 'loading' | 'active' | 'failed', FiberState> = {
  pending: 0,
  loading: 1,
  active: 2,
  failed: 3,
};

export function apply(ctx: Context, config: JsonRpcConfig): void {
  const transport = new JsonRpcLineTransport(process.stdin, process.stdout);
  const server = new HarnessSdkJsonRpcServer(ctx, transport, config);
  transport.onRequest(async (method, params) => {
    if (method === 'deskwork/plugins/status') {
      await ctx.loader.await();
      const { names } = z
        .object({ names: z.array(z.string()) })
        .strict()
        .parse(params);
      return Promise.all(
        names.map(async (name) => {
          const entries = [...ctx.loader.entries()].filter(
            (entry) => entry.options.name === name || entry.options.name.startsWith(name + '/'),
          );
          return {
            name,
            entries: entries.length
              ? await Promise.all(
                  entries.map(async (entry) => {
                    let detail: string | undefined;
                    try {
                      await entry.fiber?.await();
                    } catch (error) {
                      detail = error instanceof Error ? error.message : 'Plugin startup failed';
                    }
                    const state = entry.disabled
                      ? 'disabled'
                      : entry.fiber?.state === fiberStates.active
                        ? 'loaded'
                        : entry.fiber?.state === fiberStates.failed
                          ? 'failed'
                          : entry.fiber?.state === fiberStates.pending ||
                              entry.fiber?.state === fiberStates.loading
                            ? 'pending'
                            : 'unavailable';
                    return { id: entry.id, status: state, ...(detail ? { detail } : {}) };
                  }),
                )
              : [{ id: name, status: 'unavailable', detail: 'No matching Loader entry was found' }],
          };
        }),
      );
    }
    if (method === 'initialize') {
      await ctx.loader.await();
      // The upstream SDK creates a default adapter when the configured one failed.
      if (!ctx.llm.listProviders().some((provider) => provider.id === 'deepseek-official')) {
        throw new Error(
          'The selected DeepSeek provider is disabled. Check the model URL and plugin configuration; the runtime will not switch to a default route.',
        );
      }
    }
    const result = await server.handleRequest(method, params);
    if (method === 'shutdown')
      setImmediate(() => {
        void transport
          .flush()
          .then(async (): Promise<void> => {
            await ctx.sessionPersistence.flush();
            await ctx.root.fiber.dispose();
          })
          .then((): never => process.exit(0));
      });
    return result;
  });
  ctx.effect(() => {
    transport.start();
    return async (): Promise<void> => {
      await server.shutdown();
      await ctx.sessionPersistence.flush();
      transport.close();
    };
  }, 'jsonrpc.serve');
}
