import { createServer } from 'node:http';
import {
  readMessagesRequest,
  writeMessagesResponse,
  hasToolResult,
  messagesText,
} from './messages.ts';
import { observationSchema } from '../../src/core/contracts.ts';
import type { PageObservation } from '../../src/core/contracts.ts';
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
export async function startModel(): Promise<{
  url: string;
  calls: () => number;
  close: () => Promise<void>;
}> {
  let calls = 0;
  const server = createServer((request, response) => {
    const handle = async (): Promise<void> => {
      const parsed = await readMessagesRequest(request);
      calls++;
      const last = parsed.messages.at(-1);
      const observation = hasToolResult(last?.content) ? findObservation(last?.content) : undefined;
      let name = 'observe_page';
      let arguments_: unknown = {};
      let text = '';
      const lastText = JSON.stringify(last?.content);
      if (hasToolResult(last?.content) && lastText.includes('waiting-for-human-confirmation'))
        text = '操作已准备，请在工作台确认。';
      else if (hasToolResult(last?.content) && /verified[^a-z]+true/.test(lastText))
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
              message.role === 'user' && messagesText(message.content).includes('"kind":"click"'),
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
      } else if (hasToolResult(last?.content)) text = '页面操作遇阻，请接手核对。';
      writeMessagesResponse(
        response,
        text || { name: `mcp__deskwork__${name}`, input: arguments_ },
        `response-${String(calls)}`,
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
