import { readFileSync } from 'node:fs';
import type {} from '@deepseek-ai/dsh-skill';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-tools';
import { PluginBrowserClient } from '../../../packages/plugin-sdk/src/index.ts';
export const inject = ['tools', 'skills'];
export function apply(ctx: Context): void {
  ctx.effect(() =>
    ctx.skills.register({
      name: 'fixture-query',
      description: 'Read generated category choices from the synthetic fixture page.',
      source: 'bundled',
      content: readFileSync(
        new URL('../skills/fixture-query/SKILL.md', import.meta.url),
        'utf8',
      ).replace(/^---\n[\s\S]*?\n---\n/, ''),
    }),
  );
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
        const filter = page.elements.find((element) => element.name === 'Category');
        if (!filter) throw new Error('Page changed: missing category filter');
        if (filter.options) return JSON.stringify(filter.options);
        const action = await client.act(
          page,
          { kind: 'click', ref: filter.ref },
          'read',
          'Open category options',
        );
        if (action.status !== 'executed-observe-again') return JSON.stringify(action);
        page = await client.observe();
        return page.text;
      },
    }),
  );
}
