import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-tools';
import { PluginBrowserClient } from '../../../src/runtime/plugin-browser-client.ts';
export const inject = ['tools'];
export function apply(ctx: Context): void {
  ctx.effect(() =>
    ctx.tools.register({
      name: 'fixture_query',
      description: 'Read fixture filter choices',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [
          { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) },
        ],
      },
      async execute(_args, exec) {
        const client = new PluginBrowserClient('deskwork-query-fixture', exec.signal);
        let page = await client.observe();
        const filter = page.elements.find((element) => element.name === '类别');
        if (!filter) throw new Error('Page changed: missing category filter');
        if (filter.options) return JSON.stringify(filter.options);
        await client.act(page, { kind: 'click', ref: filter.ref }, 'read', '展开类别筛选');
        page = await client.observe();
        return page.text;
      },
    }),
  );
}
