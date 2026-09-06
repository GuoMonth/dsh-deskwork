import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
export interface FixtureWebsite {
  origin: string;
  writes: () => number;
  value: () => string;
  reset: () => void;
  rejectWrites: () => void;
  close: () => Promise<void>;
}
export async function startWebsite(variant: 'directory' | 'settings'): Promise<FixtureWebsite> {
  let value = 'Original';
  let writes = 0;
  let rejectWrites = false;
  const sessions = new Set<string>();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const authenticated = [...sessions].some((session) =>
      request.headers.cookie?.includes(`identity=${session}`),
    );
    if (url.pathname === '/login') {
      const session = randomUUID();
      sessions.add(session);
      response
        .writeHead(302, {
          'set-cookie': `identity=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
          location: '/',
        })
        .end();
      return;
    }
    if (url.pathname === '/popup') {
      response
        .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        .end(
          '<title>临时页面</title><p>此页面归属原入口</p><button onclick="window.close()">关闭页面</button>',
        );
      return;
    }
    if (url.pathname === '/save' && request.method === 'POST') {
      if (!authenticated) {
        response.writeHead(401).end();
        return;
      }
      let body = '';
      request.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      request.on('end', () => {
        const next = new URLSearchParams(body).get('value');
        if (rejectWrites) {
          response.writeHead(503).end('save failed');
          return;
        }
        if (next !== null) {
          value = next;
          writes++;
        }
        response.writeHead(200).end('ok');
      });
      return;
    }
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    });
    const title = variant === 'directory' ? 'Directory fixture' : 'Settings fixture';
    const safeValue = value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('"', '&quot;');
    const form =
      variant === 'directory'
        ? `<section><h2>Contact note</h2><label>Note<input name="value" value="${safeValue}"></label><button type="submit">Save note</button></section>`
        : `<table><tr><th><label for="description">Description</label></th><td><textarea id="description" name="value">${safeValue}</textarea></td></tr></table><footer><button type="submit">Publish settings</button></footer>`;
    response.end(
      `<!doctype html><meta charset="utf-8"><title>${title}</title><style>body{font:16px system-ui;padding:48px;color:#243044;background:${variant === 'directory' ? '#fff' : '#f1f4f8'}}input,textarea,button{font:inherit;padding:12px;margin:12px}label{display:block}section,table{padding:24px;border:1px solid #ccc}aside{margin-top:32px}</style><h1>${title}</h1>${authenticated ? `<p>已登录测试账号</p><form>${form}</form><aside>Stored value: <strong>${safeValue}</strong></aside><a href="/popup" target="_blank" rel="opener">打开临时页面</a><script>document.querySelector('form').onsubmit=async event=>{event.preventDefault();const form=event.currentTarget;const response=await fetch('/save',{method:'POST',body:new URLSearchParams(new FormData(form))});if(response.ok)location.reload();};</script>` : '<p>请自行登录此测试网站</p><a href="/login">登录演示账号</a>'}`,
    );
  });
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture port');
  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    writes: () => writes,
    value: () => value,
    rejectWrites: (): void => {
      rejectWrites = true;
    },
    reset: (): void => {
      value = 'Original';
    },
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
