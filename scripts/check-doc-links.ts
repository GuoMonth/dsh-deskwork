import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

async function checkDirectory(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', '.artifacts', 'node_modules'].includes(entry.name)) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await checkDirectory(filename);
    } else if (entry.name.endsWith('.md')) {
      const markdown = await readFile(filename, 'utf8');
      for (const match of markdown.matchAll(/\]\(([^\s)]+)\)/g)) {
        const target = match[1];
        if (!target || /^(?:[a-z]+:|#)/i.test(target)) continue;
        const relativePath = decodeURIComponent(target.split('#')[0] ?? '');
        if (!existsSync(path.resolve(path.dirname(filename), relativePath))) {
          throw new Error(`Broken local documentation link: ${filename} -> ${target}`);
        }
      }
    }
  }
}

await checkDirectory(process.cwd());
console.log('Local Markdown file links passed (external URLs and anchors are not checked).');
