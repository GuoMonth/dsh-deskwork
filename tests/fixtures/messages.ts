import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';

export const messagesRequestSchema = z
  .object({
    system: z.unknown().optional(),
    messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.unknown() })),
    tools: z.array(
      z.object({ name: z.string(), input_schema: z.object({ type: z.literal('object') }).loose() }),
    ),
  })
  .loose();

export async function readMessagesRequest(
  request: IncomingMessage,
): Promise<z.infer<typeof messagesRequestSchema>> {
  assert.equal(request.method, 'POST');
  assert.equal(request.url, '/v1/messages');
  assert.equal(typeof request.headers['x-api-key'], 'string');
  let body = '';
  for await (const chunk of request) body += String(chunk);
  return messagesRequestSchema.parse(JSON.parse(body));
}

export function hasToolResult(content: unknown): boolean {
  return (
    z
      .array(z.object({ type: z.string() }).loose())
      .safeParse(content)
      .data?.some((block) => block.type === 'tool_result') ?? false
  );
}

export function writeMessagesResponse(
  response: ServerResponse,
  reply: string | { name: string; input: unknown },
  id: string,
): void {
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const event = (type: string, data: unknown): void => {
    response.write(
      `event: ${type}\ndata: ${JSON.stringify({ type, ...z.record(z.string(), z.unknown()).parse(data) })}\n\n`,
    );
  };
  event('message_start', {
    message: {
      id,
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'deepseek-v4-flash',
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 50, output_tokens: 0 },
    },
  });
  event('content_block_start', {
    index: 0,
    content_block:
      typeof reply === 'string'
        ? { type: 'text', text: '' }
        : { type: 'tool_use', id: `call-${id}`, name: reply.name, input: {} },
  });
  event('content_block_delta', {
    index: 0,
    delta:
      typeof reply === 'string'
        ? { type: 'text_delta', text: reply }
        : { type: 'input_json_delta', partial_json: JSON.stringify(reply.input) },
  });
  event('content_block_stop', { index: 0 });
  event('message_delta', {
    delta: {
      stop_reason: typeof reply === 'string' ? 'end_turn' : 'tool_use',
      stop_sequence: null,
    },
    usage: { output_tokens: 20 },
  });
  event('message_stop', {});
  response.end();
}

export function messagesText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(messagesText).join('\n');
  const block = z
    .object({ text: z.string().optional(), content: z.unknown().optional() })
    .safeParse(content);
  return block.success ? (block.data.text ?? messagesText(block.data.content)) : '';
}
