# DSH Deskwork — AI execution contract

AI owns code, tests, experiments, documentation maintenance, commits, and PR updates. Humans set product direction, decide consequential tradeoffs, and review outcomes. Complete routine work autonomously within existing authorization; do not turn tool choices, local experiments, or small type exceptions into approval requests.

## Load only the context this task needs

| Task                      | Read                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Code or tooling           | [Engineering](docs/standards/engineering.md); [types](docs/standards/typescript.md) when crossing a type boundary             |
| Experiment or integration | Relevant entry in [hypotheses](docs/hypotheses/README.md), then [verification](docs/standards/verification.md)                |
| Product or architecture   | [Principles](docs/principles/product.md), relevant [design](docs/design/workspace.md) or [decision](docs/decisions/README.md) |
| Documentation only        | Relevant document and [navigation](docs/README.md); no full repository read                                                   |

## Execute

- Search narrowly with `rg`; batch independent reads/checks and reuse prior results. Do not repeatedly dump whole files or poll unchanged work.
- Establish observable acceptance criteria before implementation. Use failing behavioral tests for changed contracts; use executable assertions for exploratory experiments, then retain useful regressions.
- Keep strict types, semantic names, explicit states, and one formatter. External data starts as `unknown`; local `any` exceptions require a precise reason and boundary validation, not routine paperwork.
- Document intent, decisions, and evidence. Code and tests express implementation. Most documents are working context for AI; keep human review focused on specifications, architecture tradeoffs, and outcomes.
- Electron + DSH + Browser Harness remains a candidate. Keep probes in `experiments/`; do not promote a probe into architecture without evidence.
- Use `npm run check:docs` for documentation-only changes, relevant tests during coding, and `npm run check` once at the code-change boundary. Use `npm run check:fresh` when changing checks/caches or investigating stale results. No unchanged reruns without a reason.
- This task's supplied development account is already isolated. Use the host-isolated experiment command here without repeated confirmation or nested sandbox setup. Record the mode. Product/security claims need their relevant environment, not this shortcut.
- Reuse installed dependencies and runtimes; run `npm ci` only for fresh setup or lockfile changes. Prefer verified stable tooling over speculative upgrades. Keep output concise and full diagnostics addressable.
- Preserve unrelated work, update the current task branch/PR, and report results and limits honestly. Ask humans only for missing intent, consequential unresolved decisions, or actions outside existing authorization.
