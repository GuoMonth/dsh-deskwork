import { createServer } from 'node:http';
import { once } from 'node:events';

export interface ErpFixture {
  readonly origin: string;
  close(): Promise<void>;
}

export async function startErpFixture(): Promise<ErpFixture> {
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/api/session') {
      const isAuthenticated =
        request.headers.cookie
          ?.split(';')
          .some((cookie) => cookie.trim() === 'fixture-session=account-a') ?? false;
      response.writeHead(isAuthenticated ? 200 : 401, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ isAuthenticated }));
    } else if (request.url === '/login' && request.method === 'POST') {
      // Synthetic authentication only: exercise a browser form and HttpOnly cookie, not real credentials.
      response.writeHead(303, {
        'Set-Cookie': 'fixture-session=account-a; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600',
        Location: '/procurement',
      });
      response.end();
    } else {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html>
<html lang="en"><meta charset="utf-8"><title>Deskwork ERP fixture</title>
<body style="font: 18px system-ui; padding: 32px; background: #f6f8fa; color: #182230">
<h1>ERP session experiment</h1><p>Synthetic data · isolated browser profile</p>
<form id="login" action="/login" method="post"><button type="submit">Sign in as fixture account</button></form>
<p>Page actions: <output id="count">0</output></p>
<button id="increment" onclick="document.getElementById('count').textContent = String(Number(document.getElementById('count').textContent) + 1)">Record page action</button>
</body></html>`);
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string')
    throw new Error('Fixture did not bind a TCP port');
  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    async close(): Promise<void> {
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
