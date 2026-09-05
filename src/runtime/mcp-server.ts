import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { businessTools, toolRequestSchema } from './tool-contract.ts';

const endpoint = process.env['DESKWORK_TOOL_ENDPOINT'];
const token = process.env['DESKWORK_TOOL_TOKEN'];
if (!endpoint || !token || new URL(endpoint).hostname !== '127.0.0.1')
  throw new Error('Missing local Deskwork tool connection');
const server = new McpServer({ name: 'deskwork-business', version: '0.1.0' });
for (const tool of businessTools) {
  const inputSchema =
    tool.name === 'observe_page'
      ? z.object({}).strict()
      : tool.name === 'read_record'
        ? z.object({ objectId: z.string() }).strict()
        : z.object({ objectId: z.string(), nextValue: z.string() }).strict();
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema },
    async (arguments_) => {
      const input = toolRequestSchema.parse({ name: tool.name, arguments: arguments_ });
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(20000),
      });
      const text = await response.text();
      return { content: [{ type: 'text' as const, text }], isError: !response.ok };
    },
  );
}
await server.connect(new StdioServerTransport());
