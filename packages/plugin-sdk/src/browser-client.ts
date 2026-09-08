import { z } from 'zod';
import { observationSchema, proposalSchema } from './contracts.ts';
import type { BrowserAction, PageObservation } from './contracts.ts';
const mountedPluginSchema = z.object({
  name: z.string(),
  mountName: z.string().min(1),
  enabled: z.boolean(),
});

export class PluginBrowserClient {
  private steps = 0;
  private readonly signal: AbortSignal;
  private readonly mountName: string;
  private readonly endpoint: string;
  private readonly token: string;
  constructor(packageName: string, signal: AbortSignal) {
    const plugins = z
      .array(mountedPluginSchema)
      .parse(JSON.parse(process.env['DESKWORK_PLUGINS'] ?? '[]'));
    const plugin = plugins.find((entry) => entry.name === packageName && entry.enabled);
    if (!plugin) throw new Error('插件未挂载到当前任务');
    this.mountName = plugin.mountName;
    this.signal = AbortSignal.any([signal, AbortSignal.timeout(45000)]);
    this.endpoint = z.url().parse(process.env['DESKWORK_TOOL_ENDPOINT']);
    this.token = z.string().min(1).parse(process.env['DESKWORK_TOOL_TOKEN']);
  }
  private async call(name: string, args: unknown): Promise<unknown> {
    this.signal.throwIfAborted();
    if (++this.steps > 30) throw new Error('查询步骤过多，请重新观察或拆分任务');
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name, arguments: args }),
      signal: this.signal,
    });
    const raw: unknown = await response.json();
    if (!response.ok) throw new Error(z.object({ error: z.string() }).parse(raw).error);
    return raw;
  }
  async observe(): Promise<PageObservation> {
    return observationSchema.parse(await this.call('observe_page', {}));
  }
  async act(
    observation: PageObservation,
    action: BrowserAction,
    effect: 'read' | 'write' | 'unknown',
    summary: string,
  ): Promise<void> {
    const proposal = proposalSchema.parse({
      pageId: observation.pageId,
      revision: observation.revision,
      action,
      summary,
      risk: effect === 'write' ? 'consequential' : 'ordinary',
    });
    const result = z
      .object({ status: z.string() })
      .parse(await this.call('plugin_action', { mountName: this.mountName, effect, proposal }));
    if (result.status !== 'executed-observe-again')
      throw new Error('等待用户确认；不要重复动作，确认后重新观察继续。');
  }
}
