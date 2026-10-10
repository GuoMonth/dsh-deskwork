import { AsyncLocalStorage } from 'node:async_hooks';
import type { Context } from '@deepseek-ai/cordis';
import type { ToolDispatchExecution } from '@deepseek-ai/dsh-tools';
import type {} from '@deepseek-ai/dsh-user-approval';
import { z } from 'zod';
import { DeskworkBrowserService } from '../../packages/plugin-sdk/src/dsh.ts';
import { PluginBrowserClient, actionResultSchema } from '../../packages/plugin-sdk/src/index.ts';
import type { BrowserActionResult } from '../../packages/plugin-sdk/src/index.ts';

/** Native tool stacks wait for an audited decision; external development clients retain their explicit pause. */
export default class NativeDeskworkBrowserService extends DeskworkBrowserService {
  static override inject = ['browserUse', 'tools', 'approval'];
  private readonly execution = new AsyncLocalStorage<ToolDispatchExecution>();
  constructor(ctx: Context) {
    super(ctx);
    ctx.on('tools/execute', async (exec, next) =>
      this.execution.run(exec, async () => {
        const result = await next();
        if (exec.name !== 'mcp__deskwork__act_on_page' || result.isError) return result;
        const text = result.content
          .filter((block) => block.type === 'text')
          .map((block) => block.text)
          .join('\n');
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          return result;
        }
        const parsed = actionResultSchema.safeParse(raw);
        if (!parsed.success || parsed.data.status !== 'waiting-for-human-confirmation')
          return result;
        const value = await this.confirmAction(ctx, exec, parsed.data.confirmationId);
        const content = [{ type: 'text' as const, text: JSON.stringify(value) }];
        return { ...result, value: { content }, content };
      }),
    );
  }
  override connect(packageName: string, signal: AbortSignal): PluginBrowserClient {
    const exec = this.execution.getStore();
    if (!exec) throw new Error('Native browser connections require an active tool execution');
    return new PluginBrowserClient(packageName, signal, (id) =>
      this.confirmAction(this.ctx, exec, id),
    );
  }
  private async confirmAction(
    ctx: Context,
    exec: ToolDispatchExecution,
    id: string,
  ): Promise<BrowserActionResult> {
    if (!exec.agent) throw new Error('Browser approval requires its owning agent');
    const endpoint = z.url().parse(process.env['DESKWORK_TOOL_ENDPOINT']);
    const token = z.string().min(1).parse(process.env['DESKWORK_TOOL_TOKEN']);
    const call = async (name: string, args: object): Promise<unknown> => {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ name, arguments: args }),
        signal: exec.signal,
      });
      const raw: unknown = await response.json();
      if (!response.ok) throw new Error(z.object({ error: z.string() }).parse(raw).error);
      return raw;
    };
    const dispose = ctx.on('approval/request', async (request, next) => {
      if (
        request.toolName !== 'deskwork_browser_action' ||
        request.callId !== exec.callId ||
        request.agent.id !== exec.agent?.id
      )
        return next();
      return z
        .object({ outcome: z.enum(['allowed-once', 'rejected', 'cancelled', 'unavailable']) })
        .parse(
          await call('native_approval', {
            toolName: request.toolName,
            reason: 'Confirm the pending website action',
            agentId: String(request.agent.id),
            callId: String(exec.callId),
            confirmationId: id,
          }),
        ).outcome;
    });
    try {
      const outcome = await ctx.approval.request({
        agent: exec.agent,
        toolName: 'deskwork_browser_action',
        callId: exec.callId,
        reason: 'Confirm the pending website action',
        signal: exec.signal,
      });
      if (outcome !== 'allowed-once') throw new Error(`Website action approval: ${outcome}`);
      exec.signal.throwIfAborted();
      return actionResultSchema.parse(
        await call('execute_confirmed_action', { confirmationId: id }),
      );
    } finally {
      dispose();
    }
  }
}
