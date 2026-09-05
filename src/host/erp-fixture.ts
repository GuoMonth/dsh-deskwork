import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function startErpFixture(
  directory: string,
  port = 0,
): Promise<{ origin: string; close: () => Promise<void> }> {
  await mkdir(directory, { recursive: true });
  const dataPath = join(directory, 'fixture-record.txt');
  let value: string;
  try {
    value = await readFile(dataPath, 'utf8');
  } catch {
    value = '优选果，常温存放';
  }
  const escape = (text: string): string =>
    text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
  const server = createServer((request, response) => {
    const handle = async (): Promise<void> => {
      const loggedIn = request.headers.cookie?.includes('deskwork_fixture=logged-in');
      if (request.url === '/login' && request.method === 'POST') {
        response
          .writeHead(303, {
            'set-cookie':
              'deskwork_fixture=logged-in; HttpOnly; SameSite=Strict; Max-Age=604800; Path=/',
            location: '/products',
          })
          .end();
        return;
      }
      if (request.url === '/logout') {
        response
          .writeHead(303, {
            'set-cookie': 'deskwork_fixture=; Max-Age=0; Path=/',
            location: '/products',
          })
          .end();
        return;
      }
      if (request.url === '/save' && request.method === 'POST') {
        if (!loggedIn) {
          response.writeHead(401).end();
          return;
        }
        let body = '';
        request.setEncoding('utf8');
        for await (const chunk of request) {
          if (typeof chunk === 'string') body += chunk;
          if (body.length > 5000) {
            response.writeHead(413).end();
            return;
          }
        }
        value = new URLSearchParams(body).get('value') ?? '';
        await writeFile(dataPath, value);
        response.writeHead(303, { location: '/products' }).end();
        return;
      }
      const content = loggedIn
        ? `<div class="top"><strong>商品资料</strong><a href="/logout">退出测试店铺</a></div><p class="hint">本地 ERP 夹具 · 合成业务数据</p><div class="card"><div class="identity">店铺 <span id="shop-id">test-shop</span> · <span id="page-revision">fixture-v1</span></div><h1 id="product-name">山东红富士苹果</h1><p>商品编号 <span id="object-id">SG-1001</span></p><form action="/save" method="post"><label for="record-value">商品备注</label><textarea id="record-value" name="value">${escape(value)}</textarea><button id="save">保存资料</button></form><p class="hint">此字段可修改并恢复。刷新页面显示实际保存值。</p></div>`
        : '<div class="login"><span class="mark">森</span><h1>登录本地测试店铺</h1><p>合成 ERP 夹具，用于验证真实浏览器会话。</p><form action="/login" method="post"><button id="login">进入测试店铺</button></form><small>无需输入真实账号或密码</small></div>';
      response
        .writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        .end(
          `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>商品资料 · ERP 夹具</title><style>body{margin:0;background:#f6f7f9;color:#343c45;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:32px}button{background:#ef8a30;color:white;border:0;border-radius:5px;padding:10px 24px;cursor:pointer;font:inherit}.top{display:flex;justify-content:space-between;align-items:center}.top strong{font-size:20px}a{font-size:12px;color:#777}.hint{color:#929aa3;font-size:12px;line-height:1.8}.card{background:white;border:1px solid #e5e7eb;border-radius:8px;padding:26px;margin-top:30px}.identity{font-size:11px;color:#89939d}h1{font-size:22px;margin:20px 0 10px}.card p{font-size:12px;color:#7f8993}label{display:block;margin:28px 0 12px;font-size:13px}textarea{display:block;width:100%;box-sizing:border-box;min-height:90px;border:1px solid #dde1e6;border-radius:5px;padding:12px;margin-bottom:18px;font:inherit;resize:vertical}.login{text-align:center;margin:14vh auto;max-width:420px;padding:40px 20px;background:white;border:1px solid #e5e7eb;border-radius:10px}.login p{font-size:12px;color:#89939d;margin-bottom:28px}.login small{display:block;margin-top:20px;color:#aaa}.mark{display:inline-grid;place-items:center;width:44px;height:44px;background:#f39440;color:white;border-radius:10px;font-size:24px}</style></head><body>${content}</body></html>`,
        );
    };
    void handle().catch(() => {
      response.writeHead(500).end('Fixture failed');
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Cannot start ERP fixture');
  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
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
