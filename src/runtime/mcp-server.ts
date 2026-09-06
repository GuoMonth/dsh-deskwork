import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { browserToolDefinitions, toolRequestSchema } from './tool-contract.ts';

const endpoint = process.env['DESKWORK_TOOL_ENDPOINT'];
const token = process.env['DESKWORK_TOOL_TOKEN'];
if (!endpoint || !token || new URL(endpoint).hostname !== '127.0.0.1')
  throw new Error('Missing local Deskwork tool connection');
const server = new McpServer({ name: 'deskwork-browser', version: '0.1.0' });
for (const tool of browserToolDefinitions) {
  server.registerTool(
    tool.name,
    { description: tool.description, inputSchema: tool.schema },
    async (arguments_: unknown) => {
      const input = toolRequestSchema.parse({ name: tool.name, arguments: arguments_ });
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(20000),
      });
      const text = await response.text();
      if (input.name === 'capture_page' && response.ok) {
        const capture = z.object({ image: z.string() }).parse(JSON.parse(text));
        return {
          content: [{ type: 'image' as const, data: capture.image, mimeType: 'image/jpeg' }],
        };
      }
      return { content: [{ type: 'text' as const, text }], isError: !response.ok };
    },
  );
}
await server.connect(new StdioServerTransport());
