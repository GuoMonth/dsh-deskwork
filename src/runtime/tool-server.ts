import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { toolRequestSchema } from './tool-contract.ts';
import type { ToolRequest } from './tool-contract.ts';

export interface ToolServer {
  endpoint: string;
  readonly token: string;
  revoke: () => void;
  close: () => Promise<void>;
}

export function startToolServer(
  call: (request: ToolRequest) => Promise<unknown>,
): Promise<ToolServer> {
  return startValidatedToolServer((raw) => toolRequestSchema.parse(raw), call);
}

export async function startValidatedToolServer<T>(
  parse: (raw: unknown) => T,
  call: (request: T) => Promise<unknown>,
  interrupt: (request: T) => boolean = () => false,
): Promise<ToolServer> {
  let token = randomBytes(32).toString('hex');
  let queue = Promise.resolve();
  const server: Server = createServer((request, response) => {
    const handle = async (): Promise<void> => {
      const authorization = Buffer.from(request.headers.authorization ?? '');
      const requestToken = token;
      const expected = Buffer.from(`Bearer ${token}`);
      if (
        request.method !== 'POST' ||
        request.url !== '/tools' ||
        request.headers.origin ||
        authorization.length !== expected.length ||
        !timingSafeEqual(authorization, expected)
      ) {
        response.writeHead(403).end();
        return;
      }
      let body = '';
      request.setEncoding('utf8');
      for await (const chunk of request) {
        if (typeof chunk !== 'string') throw new Error('Invalid request body');
        body += chunk;
        if (body.length > 16000) {
          response.writeHead(413).end();
          return;
        }
      }
      const input = parse(JSON.parse(body));
      const execute = async (): Promise<unknown> => {
        if (requestToken !== token || response.destroyed) throw new Error('工具调用已撤销');
        return call(input);
      };
      const operation = interrupt(input) ? execute() : queue.then(execute);
      queue = operation.then(
        () => undefined,
        () => undefined,
      );
      const result = await operation;
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result));
    };
    void handle().catch((error: unknown) => {
      response
        .writeHead(400, { 'content-type': 'application/json' })
        .end(JSON.stringify({ error: error instanceof Error ? error.message : '工具执行失败' }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Cannot bind local tool bridge');
  return {
    endpoint: `http://127.0.0.1:${String(address.port)}/tools`,
    get token(): string {
      return token;
    },
    revoke: (): void => {
      token = randomBytes(32).toString('hex');
    },
    close: async (): Promise<void> => {
      token = randomBytes(32).toString('hex');
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
