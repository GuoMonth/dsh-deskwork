import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';

const recordSchema = z.record(z.string(), z.object({ en: z.string(), zh: z.string() }).strict());
const pairs = ['README', 'docs/releases/README'];
const current: Record<string, { en: string; zh: string }> = {};
for (const stem of pairs) {
  const en = await readFile(`${stem}.md`, 'utf8');
  const zh = await readFile(`${stem}.zh.md`, 'utf8');
  if (!en.includes('./README.zh.md') || !zh.includes('./README.md'))
    throw new Error(`Missing language links: ${stem}`);
  if (en.match(/^## /gm)?.length !== zh.match(/^## /gm)?.length)
    throw new Error(`Translation section mismatch: ${stem}`);
  const hash = (text: string): string => createHash('sha256').update(text).digest('hex');
  current[stem] = { en: hash(en), zh: hash(zh) };
}
const file = 'docs/translations.json';
if (process.argv.includes('--write')) {
  await writeFile(file, JSON.stringify(current, null, 2) + '\n');
} else {
  const saved = recordSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  if (JSON.stringify(saved) !== JSON.stringify(current))
    throw new Error(
      'Public documentation translations changed. Update both languages and record the reviewed pair with --write.',
    );
}
console.log('Public English/Chinese documentation pairs are synchronized.');
