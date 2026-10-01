// SDK transport wiring adapted from DeepSeek 639ed015 (MIT); see packaging/DSH-LICENSE.
import type { Context } from '@deepseek-ai/cordis';
import '@deepseek-ai/dsh-llm';
import '@deepseek-ai/cordis-plugin-loader';
import { HarnessSdkJsonRpcServer } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import { JsonRpcLineTransport } from '@deepseek-ai/dsh-sdk-protocol';
export { Config } from '@deepseek-ai/dsh-sdk-jsonrpc-server';
import type { JsonRpcConfig } from '@deepseek-ai/dsh-sdk-jsonrpc-server';

export const name = 'deskwork-sdk-server';
export const inject = ['agents', 'llm', 'loader'];

export function apply(ctx: Context, config: JsonRpcConfig): void {
  const transport = new JsonRpcLineTransport(process.stdin, process.stdout);
  const server = new HarnessSdkJsonRpcServer(ctx, transport, config);
  transport.onRequest(async (method, params) => {
    if (method === 'initialize') {
      await ctx.loader.await();
      // The upstream SDK creates a default adapter when the configured one failed.
      if (!ctx.llm.listProviders().some((provider) => provider.id === 'deepseek-official')) {
        throw new Error(
          '选定的 DeepSeek 模型提供方未启用，请检查模型地址与插件配置；不会切换到默认路由。',
        );
      }
    }
    const result = await server.handleRequest(method, params);
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
      await server.shutdown();
      transport.close();
    };
  }, 'jsonrpc.serve');
}
