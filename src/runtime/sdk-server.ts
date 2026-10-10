// SDK transport wiring adapted from DeepSeek 639ed015 (MIT); see packaging/DSH-LICENSE.
import type { Context, FiberState } from '@deepseek-ai/cordis';
import '@deepseek-ai/dsh-llm';
import '@deepseek-ai/cordis-plugin-loader';
import { HarnessSdkJsonRpcServer } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import { JsonRpcLineTransport } from '@deepseek-ai/dsh-sdk-protocol';
export { Config } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import type { JsonRpcConfig } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import type { AgentHandle, AgentOptions } from '@deepseek-ai/dsh-agent';
import type {} from '@deepseek-ai/dsh-session-persistence';
import { SessionId } from '@deepseek-ai/dsh-session';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { z } from 'zod';

export const name = 'deskwork-sdk-server';
export const inject = ['agents', 'llm', 'loader', 'sessionPersistence'];

// Cordis 4.0.4 publishes FiberState as a const enum with no JavaScript export.
const fiberStates: Record<'pending' | 'loading' | 'active' | 'failed', FiberState> = {
  pending: 0,
  loading: 1,
  active: 2,
  failed: 3,
};

export function apply(ctx: Context, config: JsonRpcConfig): void {
  const transport = new JsonRpcLineTransport(process.stdin, process.stdout);
  const server = new HarnessSdkJsonRpcServer(ctx, transport, config);
  const sessions = new Map<string, Promise<AgentHandle>>();
  let route: AgentOptions | undefined;
  let cwd = process.cwd();
  let shuttingDown = false;
  let shutdownTask: Promise<void> | undefined;
  const assertAcceptingPrompts = (): void => {
    if (shuttingDown) throw new Error('Deskwork session runtime is shutting down');
  };
  const disposeSessions = (): Promise<void> =>
    (shutdownTask ??= (async (): Promise<void> => {
      shuttingDown = true;
      const handles = await Promise.allSettled(sessions.values());
      await Promise.all(
        handles.flatMap((handle) =>
          handle.status === 'fulfilled' ? [handle.value.dispose()] : [],
        ),
      );
      await ctx.sessionPersistence.flush();
    })());
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
    if (method === 'deskwork/session/prompt') {
      if (!route) throw new Error('Deskwork session runtime is unavailable');
      assertAcceptingPrompts();
      const prompt = z
        .object({ sessionId: z.string().min(1), text: z.string().min(1), mustResume: z.boolean() })
        .strict()
        .parse(params);
      let creation = sessions.get(prompt.sessionId);
      if (!creation) {
        const sessionId = SessionId(prompt.sessionId);
        const agentOptions = route;
        creation = (async (): Promise<AgentHandle> => {
          const stored = await ctx.sessionPersistence.stat(sessionId);
          if (stored) return ctx.agents.resume({ resumeSessionId: sessionId, agentOptions });
          if (prompt.mustResume)
            throw new Error(
              'The native conversation log is missing. Keep the saved conversation and start a new task; it cannot be reconstructed from chat text.',
            );
          return ctx.agents.create({ sessionId, meta: { cwd }, agentOptions });
        })();
        sessions.set(prompt.sessionId, creation);
        void creation.catch(() => sessions.delete(prompt.sessionId));
      }
      const handle = await creation;
      assertAcceptingPrompts();
      const message = createUserMessage({
        content: [{ type: 'text', text: prompt.text }],
        source: { kind: 'user' },
      });
      handle.agent.followup(message);
      return { messageId: message.id };
    }
    if (method === 'shutdown') await disposeSessions();
    const result = await server.handleRequest(method, params);
    if (method === 'initialize') {
      const initialized = z
        .object({
          cwd: z.string(),
          provider: z.string(),
          model: z.string(),
          maxTokens: z.number().optional(),
        })
        .parse(params);
      cwd = initialized.cwd;
      route = {
        provider: initialized.provider,
        model: initialized.model,
        ...(initialized.maxTokens === undefined ? {} : { maxTokens: initialized.maxTokens }),
      };
    }
    if (method === 'shutdown')
      setImmediate(() => {
        void transport
          .flush()
          .then(async (): Promise<void> => {
            await ctx.root.fiber.dispose();
          })
          .then((): never => process.exit(0));
      });
    return result;
  });
  ctx.effect(() => {
    transport.start();
    return async (): Promise<void> => {
      await disposeSessions();
      await server.shutdown();
      transport.close();
    };
  }, 'jsonrpc.serve');
}
