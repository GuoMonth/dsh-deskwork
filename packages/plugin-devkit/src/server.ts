import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { developmentCapabilities, documents, readDocument, searchDocuments } from './catalog.ts';

export function createDocumentationServer(): McpServer {
  const server = new McpServer({
    name: 'deskwork-plugin-devkit',
    version: developmentCapabilities.version,
  });
  for (const document of documents) {
    const uri = `deskwork-docs://guide/${document.id}`;
    server.registerResource(
      document.id,
      uri,
      { title: document.title, mimeType: 'text/plain' },
      async () => ({
        contents: [{ uri, mimeType: 'text/plain', text: await readDocument(document.id) }],
      }),
    );
  }
  server.registerTool(
    'deskwork_development_info',
    {
      description:
        'Discover this offline development kit, document IDs and implemented capabilities.',
      inputSchema: z.object({}).strict(),
    },
    () => ({
      content: [{ type: 'text', text: JSON.stringify({ ...developmentCapabilities, documents }) }],
    }),
  );
  server.registerTool(
    'deskwork_read_document',
    {
      description:
        'Read one bundled guide by ID from deskwork_development_info. Does not read arbitrary files.',
      inputSchema: z.object({ id: z.string().min(1).max(80) }).strict(),
    },
    async ({ id }) => {
      try {
        return { content: [{ type: 'text' as const, text: await readDocument(id) }] };
      } catch (error: unknown) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: error instanceof Error ? error.message : 'Document unavailable',
            },
          ],
        };
      }
    },
  );
  server.registerTool(
    'deskwork_search_documents',
    {
      description:
        'Search bundled guides for a literal phrase; returns bounded excerpts and document IDs.',
      inputSchema: z.object({ query: z.string().trim().min(1).max(120) }).strict(),
    },
    async ({ query }) => ({
      content: [{ type: 'text', text: JSON.stringify(await searchDocuments(query)) }],
    }),
  );
  return server;
}
