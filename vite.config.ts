import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { randomBytes } from 'node:crypto';
export default defineConfig(({ command }) => {
  const nonce = randomBytes(18).toString('base64');
  return {
    plugins: [
      react(),
      {
        name: 'development-script-nonce',
        apply: 'serve',
        transformIndexHtml(html): string {
          return html.replace("script-src 'self'", `script-src 'self' 'nonce-${nonce}'`);
        },
      },
    ],
    ...(command === 'serve' ? { html: { cspNonce: nonce } } : {}),
    root: 'src/ui',
    base: './',
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      // Formatters can briefly truncate CSS; do not cache an empty intermediate write.
      watch: { awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 20 } },
    },
    build: { outDir: '../../dist/ui', emptyOutDir: true },
  };
});
