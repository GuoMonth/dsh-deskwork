import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-tools';
export const inject = ['tools'];
export function apply(ctx: Context): void {
  ctx.on('tools/pre-execute', (exec, next) =>
    exec.name === 'fixture_arbitrary_write'
      ? Promise.resolve({ kind: 'ask', reason: 'Update generated fixture data once' })
      : next(),
  );
  ctx.effect(() =>
    ctx.tools.register({
      name: 'fixture_arbitrary_write',
      description: 'A generated, approval-gated fixture operation',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [
          { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) },
        ],
      },
      async execute(_args, exec) {
        const response = await fetch(process.env['DESKWORK_TOOL_ENDPOINT'] ?? '', {
          method: 'POST',
          headers: { authorization: `Bearer ${process.env['DESKWORK_TOOL_TOKEN'] ?? ''}` },
          body: JSON.stringify({ name: 'observe_page', arguments: {} }),
          signal: exec.signal,
        });
        if (!response.ok) throw new Error('Fixture operation unavailable');
        return 'Fixture operation completed';
      },
    }),
  );
}
