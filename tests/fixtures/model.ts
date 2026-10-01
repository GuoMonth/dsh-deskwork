import { createServer } from 'node:http';
import { respondMessages } from './messages.ts';
import { z } from 'zod';
import { observationSchema } from '../../src/core/contracts.ts';
import type { PageObservation } from '../../src/core/contracts.ts';
const requestSchema = z
  .object({
    messages: z.array(z.object({ role: z.string(), content: z.unknown().optional() }).loose()),
  })
  .loose();
function findObservation(value: unknown, depth = 0): PageObservation | undefined {
  if (depth > 8) return undefined;
  const observation = observationSchema.safeParse(value);
  if (observation.success) return observation.data;
  if (typeof value === 'string') {
    try {
      return findObservation(JSON.parse(value), depth + 1);
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findObservation(item, depth + 1);
      if (found) return found;
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = findObservation(item, depth + 1);
      if (found) return found;
    }
  }
  return undefined;
}
function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((block: unknown) =>
      z.object({ type: z.literal('text'), text: z.string() }).safeParse(block),
    )
    .flatMap((block) => (block.success ? [block.data.text] : []))
    .join('\n');
}
export async function startModel(): Promise<{
  url: string;
  calls: () => number;
  close: () => Promise<void>;
}> {
  let calls = 0;
  const server = createServer((request, response) => {
    const handle = async (): Promise<void> => {
      let body = '';
      request.setEncoding('utf8');
      for await (const chunk of request) if (typeof chunk === 'string') body += chunk;
      const parsed = requestSchema.parse(JSON.parse(body));
      calls++;
      const last = parsed.messages.at(-1);
      const isToolResult =
        last?.role === 'user' &&
        Array.isArray(last.content) &&
        last.content.some(
          (block: unknown) => z.object({ type: z.literal('tool_result') }).safeParse(block).success,
        );
      const observation = isToolResult ? findObservation(last.content) : undefined;
      let name = 'observe_page';
      let arguments_: unknown = {};
      let text = '';
      const lastText = JSON.stringify(last?.content);
      if (isToolResult && lastText.includes('waiting-for-human-confirmation'))
        text = '操作已准备，请在工作台确认。';
      else if (isToolResult && /verified[^a-z]+true/.test(lastText))
        text = '已刷新页面，回读结果符合预期。';
      else if (observation) {
        const desired = 'Deskwork verified change';
        const field = observation.elements.find(
          (element) => ['input', 'textarea'].includes(element.tag) && element.type !== 'password',
        );
        const save = observation.elements.find(
          (element) => element.tag === 'button' && /save|publish/i.test(element.name),
        );
        if (
          observation.text.includes(`Stored value: ${desired}`) ||
          parsed.messages.some(
            (message) =>
              message.role === 'user' && messageText(message.content).includes('"kind":"click"'),
          )
        )
          name = 'verify_result';
        else if (field && save) {
          name = 'act_on_page';
          arguments_ = {
            pageId: observation.pageId,
            revision: observation.revision,
            risk: 'consequential',
            summary: field.value !== desired ? '填写已指定的内容' : '提交当前内容，并刷新核对结果',
            ...(field.value === desired ? { expectedText: `Stored value: ${desired}` } : {}),
            action:
              field.value !== desired
                ? { kind: 'fill', ref: field.ref, value: desired }
                : { kind: 'click', ref: save.ref },
          };
        } else {
          name = 'request_takeover';
          arguments_ = { reason: '请先在原网站登录，再继续。' };
        }
      } else if (isToolResult) text = '页面操作遇阻，请接手核对。';
      respondMessages(
        response,
        text
          ? { id: `response-${String(calls)}`, text }
          : {
              id: `call_${String(calls)}`,
              tool: { name: `mcp__deskwork__${name}`, input: arguments_ },
            },
      );
    };
    void handle().catch((error: unknown) => {
      response.writeHead(500).end(String(error));
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No model port');
  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    calls: () => calls,
    close: async (): Promise<void> => {
      server.closeAllConnections();
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    },
  };
}
