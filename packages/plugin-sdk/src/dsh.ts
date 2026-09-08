import { Service } from '@deepseek-ai/cordis';
import type { Context } from '@deepseek-ai/cordis';
import { PluginBrowserClient } from './browser-client.ts';

declare module '@deepseek-ai/cordis' {
  interface Context {
    deskworkBrowser: DeskworkBrowserService;
  }
}

export class DeskworkBrowserService extends Service {
  constructor(ctx: Context) {
    super(ctx, 'deskworkBrowser');
  }
  connect(packageName: string, signal: AbortSignal): PluginBrowserClient {
    return new PluginBrowserClient(packageName, signal);
  }
}
export default DeskworkBrowserService;
