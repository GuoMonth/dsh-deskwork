import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  developmentConnectionSchema,
  developmentRequestSchema,
} from '../../plugin-sdk/src/index.ts';
import type { DevelopmentConnection, DevelopmentRequest } from '../../plugin-sdk/src/index.ts';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export async function connectDevelopmentTools(server: McpServer, filename: string): Promise<void> {
  const raw: unknown = JSON.parse(await readFile(filename, 'utf8'));
  const connection = developmentConnectionSchema.parse(raw);
  for (const definition of developmentRequestSchema.options) {
    const name = definition.shape.name.value;
    server.registerTool(
      `deskwork_browser_${name.replaceAll('-', '_')}`,
      {
        description:
          name === 'act'
            ? 'Propose a development browser action against fresh observation. Declare verified read, write or unknown effect. Confirmation is only accepted in Deskwork UI. Return a pause immediately; never replay a submitted action.'
            : `Development browser ${name}; fixed to the website selected in Deskwork. Read status after UI confirmation or resumption before further actions.`,
        inputSchema: definition.shape.arguments,
      },
      async (arguments_: unknown) => {
        try {
          const request = developmentRequestSchema.parse({ name, arguments: arguments_ });
          const result = await callDevelopment(connection, request);
          if (request.name === 'capture') {
            const capture = z.object({ image: z.string() }).safeParse(result);
            if (capture.success)
              return {
                content: [
                  { type: 'image' as const, data: capture.data.image, mimeType: 'image/jpeg' },
                ],
              };
          }
          return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
        } catch (error: unknown) {
          return {
            isError: true,
            content: [
              {
                type: 'text' as const,
                text: error instanceof Error ? error.message : 'Development connection failed',
              },
            ],
          };
        }
      },
    );
  }
}

async function callDevelopment(
  connection: DevelopmentConnection,
  request: DevelopmentRequest,
): Promise<unknown> {
  const response = await fetch(connection.endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${connection.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(45000),
  });
  if (response.status === 403)
    throw new Error('开发连接已撤销，请在 Deskwork 重新开启并重新连接 MCP');
  const raw: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.string() }).safeParse(raw);
    throw new Error(
      error.success ? error.data.error : '开发连接已撤销；查看 Deskwork 状态，不重试写入。',
    );
  }
  return raw;
}
