import type { ServerResponse } from 'node:http';

/** Deterministic fixture for the official DSH provider's native Messages streaming API. */
export function respondMessages(
  response: ServerResponse,
  result: { id: string; text: string } | { id: string; tool: { name: string; input: unknown } },
): void {
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  const event = (type: string, data: object): void => {
    response.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
  };
  event('message_start', {
    message: {
      id: result.id,
      type: 'message',
      role: 'assistant',
      model: 'deepseek-v4-flash',
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: { input_tokens: 20, output_tokens: 0 },
    },
  });
  if ('tool' in result) {
    event('content_block_start', {
      index: 0,
      content_block: { type: 'tool_use', id: result.id, name: result.tool.name, input: {} },
    });
    event('content_block_delta', {
      index: 0,
      delta: { type: 'input_json_delta', partial_json: JSON.stringify(result.tool.input) },
    });
  } else {
    event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: result.text } });
  }
  event('content_block_stop', { index: 0 });
  event('message_delta', {
    delta: { stop_reason: 'tool' in result ? 'tool_use' : 'end_turn', stop_sequence: null },
    usage: { output_tokens: 10 },
  });
  event('message_stop', {});
  response.end();
}
