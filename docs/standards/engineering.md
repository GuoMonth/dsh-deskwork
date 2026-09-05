# AI engineering workflow

Primary audience: coding agents. Humans review decisions and outcomes; AI performs the complete implementation loop.

## Work loop

1. Load only relevant code, contracts, and prior evidence. Define the observable target.
2. Implement from a failing behavior check. For exploration, start with a falsifiable assertion and capture useful regressions once a path works. No ceremonial stub or new test suite for every edit.
3. Fix failures autonomously. Run the smallest relevant feedback loop while editing; batch independent checks, keep dependent mutations sequential.
4. At completion, run checks appropriate to the diff once, update only changed principles/decisions/evidence, and maintain the current PR.

AI chooses ordinary implementation details and reversible experiment setup. Humans decide product intent, major architecture tradeoffs that evidence cannot resolve, and necessary review/approval. Do not require an Issue, ADR, human-authored code, or confirmation for each small change.

## Semantic consistency

- English identifiers; `kebab-case` paths, `camelCase` values/functions, `PascalCase` types. Use domain names, verbs, units, and explicit states.
- ESM, named exports, `import type`; configuration entrypoints can default-export. Keep modules near use sites; extract real reuse, not speculative architecture.
- Strict types and runtime boundary validation: [type contract](typescript.md). Prettier and ESLint configs own syntax/style rules.
- Explain reasons or external constraints in comments, not the visible implementation. No parallel prose description of finished code.
- Errors carry useful action/context; do not silently treat errors as successful defaults.

## Optimize the agent feedback loop

- Reuse installed dependencies, prepared runtimes, and valid prior observations. Avoid fresh installation or browser restart on every tool call when reuse is supported and does not contaminate the experiment.
- Prefer batched reads and independent process parallelism; do not parallelize mutations to shared state.
- Successful checks print short status/timing summaries; keep full output in an addressable artifact. Failures must retain diagnostics and a nonzero exit.
- Run focused tests during editing. Documentation-only work uses `npm run check:docs`; code/config changes finish with `npm run check`; CI uses `npm run check:fresh` to bypass local caches.
- Cache only with understood invalidation. Do not cache typed-lint results by individual file when types can change elsewhere. Do not weaken checks to claim a speedup.
- Keep Node 24 / npm / the compatible TypeScript-linter pair pinned. Do not replace the runtime, compiler, package manager, or test framework for an unmeasured gain. Benchmark representative work before adding daemons or custom infrastructure.
- For a measured CPU/memory/resource hotspot, AI may prototype a small Rust module directly. Choose Wasm, Node-API, or a persistent sidecar by the boundary and end-to-end evidence; retain strong TS contracts. See [performance escalation](../decisions/0003-performance-escalation.md). Do not install a second JS runtime merely for preference.

Setup and command entrypoints: [CONTRIBUTING](../../CONTRIBUTING.md). Tradeoffs: [ADR-0002](../decisions/0002-ai-owned-development.md).
