import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-skill';
import type {} from '@deepseek-ai/dsh-tools';
import { z } from 'zod';
import { documents, readDocument, searchDocuments } from './catalog.ts';

export const name = 'deskwork-plugin-development';
export const inject = ['skills', 'tools'];

export async function apply(ctx: Context): Promise<void> {
  const skill = await readDocument('skill');
  ctx.effect(() =>
    ctx.skills.register({
      name: 'develop-deskwork-plugin',
      description:
        'Create, validate and package a DSH Deskwork website plugin using the public SDK. Load when developing plugins.',
      source: 'bundled',
      content: skill.replace(/^---\n[\s\S]*?\n---\n/, ''),
    }),
  );
  ctx.effect(() =>
    ctx.tools.register({
      name: 'deskwork_developer_docs',
      description: `Read development guides by ID (${documents.map((entry) => entry.id).join(', ')}), or search with query.`,
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' }, query: { type: 'string' } },
        additionalProperties: false,
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [
          { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) },
        ],
      },
      async execute(args) {
        const input = z
          .object({
            id: z.string().min(1).max(80).optional(),
            query: z.string().trim().min(1).max(120).optional(),
          })
          .strict()
          .parse(args);
        if (input.id) return readDocument(input.id);
        if (input.query) return JSON.stringify(await searchDocuments(input.query));
        return JSON.stringify(documents);
      },
    }),
  );
}
