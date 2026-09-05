# DSH Deskwork — contributor and AI coding contract

Read [docs/README.md](docs/README.md) first, then the relevant standard, decision, and hypothesis. These rules apply to humans and coding agents throughout this repository.

- Document principles, intent, tradeoffs, decisions, and experimental evidence. Let semantic code and behavioral tests describe implementation. Do not translate completed code into redundant prose.
- Before changing behavior, state an observable acceptance criterion and write a meaningful failing test. Implement the smallest passing change, then refactor. Documentation-only changes need link/format checks, not artificial unit tests.
- Treat Electron + DSH + Browser Harness as a candidate composition. An upstream claim is a hypothesis until exercised locally. Keep experiments in `experiments/`; do not turn experimental structure into product architecture implicitly.
- Use strict TypeScript for first-party executable code. External values start as `unknown`, are validated at the boundary, and become domain types. Explicit `any` is an exceptional local interoperability escape hatch; follow [the exception policy](docs/standards/typescript.md).
- Choose semantic names for variables, types, files, tests, and directories. Prefer domain vocabulary and explicit state transitions; avoid miscellaneous `utils`, `common`, `manager`, or `data` buckets without a specific domain meaning.
- Use the repository formatter, typed lint, compiler, and lockfile. Do not disable checks across a file or weaken global rules to make a change pass.
- Preserve unrelated work. Make coherent commits on a task branch; PRs record the problem, outcome, evidence, and limits. Existing user authorization governs external actions; this document adds no separate approval gate.
- Run `npm run check` for changes; run the relevant local experiment for changed integration behavior. Report failed or unavailable checks honestly. Heavy experiments run locally first; CI uses the same commands.
- Never claim DSH integration, Browser Harness compatibility, ERP coverage, or self-improvement from an Electron-only or synthetic test. Link evidence to the exact hypothesis it supports.
- Do not add speculative abstractions, a monorepo, frontend framework, storage engine, or generic plugin system before a tested need exists.

See [engineering](docs/standards/engineering.md), [TypeScript](docs/standards/typescript.md), and [verification](docs/standards/verification.md).
