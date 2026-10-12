import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const recordSchema = z.record(z.string(), z.object({ en: z.string(), zh: z.string() }).strict());
const pairs = ['README', 'docs/releases/README'];
const additionalPairs = [
  'docs/README',
  'docs/preview',
  'docs/roadmap',
  'packages/plugin-sdk/README',
  'packages/plugin-devkit/README',
  'packages/plugin-devkit/docs/workflow',
  'packages/plugin-devkit/docs/contract',
];
const files = [
  ...pairs.map((stem) => ({ stem, en: `${stem}.md`, zh: `${stem}.zh.md` })),
  ...additionalPairs.map((stem) => ({ stem, en: `${stem}.en.md`, zh: `${stem}.md` })),
];
const code = (text: string): string[] =>
  [...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((match) => match[1]?.trim() ?? '');
const versions = (text: string): string[] =>
  [...new Set(text.match(/\b\d+\.\d+\.\d+(?:-[a-z]+\.\d+)?\b/g) ?? [])].sort();
const current: Record<string, { en: string; zh: string }> = {};
for (const file of files) {
  const { stem } = file;
  const en = await readFile(file.en, 'utf8');
  const zh = await readFile(file.zh, 'utf8');
  if (
    !en.includes(`](${path.basename(file.zh)})`) &&
    !en.includes(`](./${path.basename(file.zh)})`)
  )
    throw new Error(`Missing language link: ${file.en}`);
  if (
    !zh.includes(`](${path.basename(file.en)})`) &&
    !zh.includes(`](./${path.basename(file.en)})`)
  )
    throw new Error(`Missing language links: ${stem}`);
  if (en.match(/^## /gm)?.length !== zh.match(/^## /gm)?.length)
    throw new Error(`Translation section mismatch: ${stem}`);
  if (JSON.stringify(code(en)) !== JSON.stringify(code(zh)))
    throw new Error(`Translation commands differ: ${stem}`);
  if (JSON.stringify(versions(en)) !== JSON.stringify(versions(zh)))
    throw new Error(`Translation versions differ: ${stem}`);
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
