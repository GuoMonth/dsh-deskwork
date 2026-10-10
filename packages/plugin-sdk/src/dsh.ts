import { Service } from '@deepseek-ai/cordis';
import type { Context } from '@deepseek-ai/cordis';
import { PluginBrowserClient } from './browser-client.ts';
import { BrowserUseProviderName } from '@deepseek-ai/dsh-browser-use/brand';
import type {} from '@deepseek-ai/dsh-browser-use';
import { z } from 'zod';
import { websiteUrl } from './contracts.ts';

export const websiteContextSchema = z
  .object({ id: z.string().min(1), name: z.string().min(1), url: websiteUrl })
  .strict();
export type WebsiteContext = z.infer<typeof websiteContextSchema>;

declare module '@deepseek-ai/cordis' {
  interface Context {
    deskworkBrowser: DeskworkBrowserService;
  }
}

export class DeskworkBrowserService extends Service {
  static inject = ['browserUse'];
  constructor(ctx: Context) {
    super(ctx, 'deskworkBrowser');
    // Keep the task-owned Electron browser as the single native provider.
    ctx.browserUse.register(BrowserUseProviderName('deskwork'));
  }
  connect(packageName: string, signal: AbortSignal): PluginBrowserClient {
    return new PluginBrowserClient(packageName, signal);
  }
  context(): WebsiteContext {
    return websiteContextSchema.parse(JSON.parse(process.env['DESKWORK_SITE_CONTEXT'] ?? 'null'));
  }
}
export default DeskworkBrowserService;
