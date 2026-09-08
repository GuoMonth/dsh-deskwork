# DSH Deskwork — AI execution contract

AI owns code, tests, experiments, documentation maintenance, commits, and PR updates. Humans set product direction, decide consequential tradeoffs, and review outcomes. Complete routine work autonomously within existing authorization; do not turn tool choices, local experiments, or small type exceptions into approval requests.

## Load only the context this task needs

| Task                               | Read                                                                                                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code or tooling                    | [Engineering](docs/standards/engineering.md); [types](docs/standards/typescript.md) when crossing a type boundary                                                                       |
| Experiment or integration          | Relevant entry in [hypotheses](docs/hypotheses/README.md), then [verification](docs/standards/verification.md)                                                                          |
| Product or architecture            | [Principles](docs/principles/product.md), relevant [design](docs/design/workspace.md) or [decision](docs/decisions/README.md)                                                           |
| M1 desktop or UI                   | [M1 specification](docs/specs/m1-configurable-workspace.md), [visual principles](docs/design/visual-system.md), [scope correction](docs/decisions/0005-configurable-workspace-scope.md) |
| Documentation only                 | Relevant document and [navigation](docs/README.md); no full repository read                                                                                                             |
| Performance or resource bottleneck | [Performance escalation](docs/decisions/0003-performance-escalation.md), then the relevant measured evidence                                                                            |

## Execute

- M2 follows standard DSH plugins and existing marketplace installation. The user accepted trusted local executable extensions and removed the ZIP asset route on 2026-09-08. Read [M2 specification](docs/specs/m2-dsh-plugins.md) and [ADR-0006](docs/decisions/0006-trusted-dsh-plugins.md) before extension work. Host browser confirmation does not confine arbitrary plugin network/file access; do not reinstate data-only packages or claim a plugin sandbox. The user explicitly requests no compatibility promises: implement against one selected market/runtime version, test actual functionality, and do not build compatibility matrices, certification, or speculative adapters. Deliver M2 in three large implementation steps; probes are part of delivery, not separate approval gates.

- M1 is a configurable website workbench. Test ERP brands, objects, and selectors must not become shell navigation or required generic task fields. Read the current specification before reusing the earlier fixture-specific implementation. The user approved the configurable MVP implementation plan on 2026-09-06. Per-entry conversations, one globally active task, and critical-action confirmation are the accepted defaults. Do not treat old fixture evidence as acceptance of the new M1.

- Search narrowly with `rg`; batch independent reads/checks and reuse prior results. Do not repeatedly dump whole files or poll unchanged work.
- Establish observable acceptance criteria before implementation. Use failing behavioral tests for changed contracts; use executable assertions for exploratory experiments, then retain useful regressions.
- Keep strict types, semantic names, explicit states, and one formatter. External data starts as `unknown`; local `any` exceptions require a precise reason and boundary validation, not routine paperwork.
- Document intent, decisions, and evidence. Code and tests express implementation. Most documents are working context for AI; keep human review focused on specifications, architecture tradeoffs, and outcomes.
- Electron + DSH + Browser Harness remains a candidate. Keep probes in `experiments/`; do not promote a probe into architecture without evidence.
- Use `npm run check:docs` for documentation-only changes, relevant tests during coding, and `npm run check` once at the code-change boundary. Use `npm run check:fresh` when changing checks/caches or investigating stale results. No unchanged reruns without a reason.
- This task's supplied development account is already isolated. Use the host-isolated experiment command here without repeated confirmation or nested sandbox setup. Record the mode. Product/security claims need their relevant environment, not this shortcut.
- Reuse installed dependencies and runtimes; run `npm ci` only for fresh setup or lockfile changes. Prefer verified stable tooling over speculative upgrades. Keep output concise and full diagnostics addressable.
- Preserve unrelated work, update the current task branch/PR, and report results and limits honestly. Ask humans only for missing intent, consequential unresolved decisions, or actions outside existing authorization.
