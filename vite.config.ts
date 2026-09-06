import { defineConfig } from 'vite';
export default defineConfig({
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
});
