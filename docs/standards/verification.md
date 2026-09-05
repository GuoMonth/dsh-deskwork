# AI verification contract

Primary audience: coding agents. Verify the relevant uncertainty with the smallest credible experiment; local compute is the default.

## Behavior and evidence

- Define a falsifiable acceptance criterion before implementation. Changed behavior gets a failing test; exploratory integrations may begin with executable assertions. Preserve useful regressions, not every scratch attempt.
- Keep a brief red → green result for a meaningful behavior change. Do not require a separate report for every edit, or count missing dependencies as a behavior failure.
- Test real boundaries with real processes when the claim depends on them. Synthetic ERP results apply to the fixture only. Include a meaningful negative control for critical boundaries.
- Record hypothesis, environment/mode, source identity, command, observations, conclusion, and limits. Upstream documentation is a lead, not proof. Preserve important failures, not repetitive logs in prose.

## Experiment isolation

The supplied development account is already an isolated environment, as confirmed by the project owner. In this environment, AI may run local fixture experiments with Chromium sandbox disabled and reuse the outer boundary. Do not spend time provisioning a second sandbox or ask again for this already authorized setup.

`npm run experiment:electron-session` selects **host** isolation for that environment. It launches the real Electron fixture with `--no-sandbox`; session partitions, context isolation, disabled Node integration, temporary profiles, deadlines, and cleanup remain part of the experiment. The report records the selected mode and actual launch switch.

`npm run experiment:electron-session:chromium` selects Chromium sandbox when that boundary itself is under test or the host requires it. Do not silently fall back between modes. A host-isolated result supports the session/CDP behavior tested there; it cannot prove Chromium sandbox, desktop distribution, or production-security compatibility. Product defaults remain a separate architecture decision.

Use synthetic data and controlled fixtures for these fast experiments. Treat unknown external content, real credentials, deployment targets, and system-level changes according to the actual task and its authorization; do not infer their requirements from a fixture test.

## Feedback cost

- During an edit, run affected tests/type checks; after a documentation-only diff run `check:docs`; after code/config changes run `check`. Reuse the result until relevant inputs change.
- `check` runs independent tools together, with incremental TypeScript and content-based formatting cache. Typed lint and tests execute every time. `check:fresh` runs the same suite without local caches and is the CI entrypoint.
- Heavy experiments run locally on relevant changes, not on every formatting edit. Disposable GitHub-hosted runners may run the explicit host-isolated fixture workflow; no privileged sandbox setup is needed there.
- Full local diagnostics live in `.artifacts/`. Commit concise sanitized evidence only when it changes a conclusion. An unavailable or failing check stays visible; no silent success.

## Learning claims

Measure initial exploration, skill reuse, and behavior after a page change separately. Track correct outcomes, elapsed time, model calls/tokens, and human intervention. Replaying a handwritten script proves reuse only; autonomous learning additionally needs generated candidates, validation, activation, invalidation, and rollback evidence.
