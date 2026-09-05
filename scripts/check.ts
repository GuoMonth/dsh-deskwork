import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { runCheck } from './check-process.ts';
import type { CheckTask } from './check-process.ts';

const checkArguments = new Set(process.argv.slice(2));
for (const argument of checkArguments) {
  if (!['--docs', '--fresh'].includes(argument))
    throw new Error(`Unknown check option: ${argument}`);
}
const docsOnly = checkArguments.has('--docs');
const fresh = checkArguments.has('--fresh');
await mkdir('.artifacts/cache', { recursive: true });
const formattingTargets = docsOnly
  ? [
      'AGENTS.md',
      'README.md',
      'README.en.md',
      'CONTRIBUTING.md',
      'docs',
      '.github/pull_request_template.md',
    ]
  : ['.'];
const checks: CheckTask[] = [
  {
    name: 'format',
    arguments: [
      'node_modules/prettier/bin/prettier.cjs',
      '--check',
      ...formattingTargets,
      ...(fresh
        ? []
        : [
            '--cache',
            '--cache-strategy',
            'content',
            '--cache-location',
            '.artifacts/cache/prettier',
          ]),
    ],
  },
  { name: 'docs', arguments: ['scripts/check-doc-links.ts'] },
];
if (!docsOnly) {
  checks.push(
    {
      name: 'types',
      arguments: [
        'node_modules/typescript/bin/tsc',
        '--noEmit',
        ...(fresh
          ? []
          : ['--incremental', '--tsBuildInfoFile', '.artifacts/cache/typecheck.tsbuildinfo']),
      ],
    },
    // Typed lint must observe cross-file type changes; do not cache by individual file content.
    { name: 'lint', arguments: ['node_modules/eslint/bin/eslint.js', '.', '--max-warnings', '0'] },
    {
      name: 'tests',
      arguments: [
        '--test',
        ...(await readdir('tests'))
          .filter((file) => file.endsWith('.test.ts'))
          .sort()
          .map((file) => `tests/${file}`),
      ],
    },
  );
}
const startedAt = performance.now();
const results = await Promise.all(checks.map(runCheck));
const milliseconds = Math.round(performance.now() - startedAt);
await writeFile(
  '.artifacts/check-latest.json',
  JSON.stringify(
    {
      scope: docsOnly ? 'docs' : 'all',
      fresh,
      milliseconds,
      results,
    },
    null,
    2,
  ) + '\n',
);
for (const result of results) {
  console.log(
    `[${result.passed ? 'pass' : 'FAIL'}] ${result.name} ${String(result.milliseconds)} ms`,
  );
  if (!result.passed) console.error(result.output);
}
console.log(`${String(milliseconds)} ms total; full tool output: .artifacts/check-latest.json`);
if (results.some((result) => !result.passed)) process.exitCode = 1;
