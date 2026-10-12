# Plugin execution contract

[简体中文](contract.md)

This extends DSH's native package/lifecycle with SDK types and schemas, not a new plugin format. Versions identify the tested interface without a compatibility promise.

## Target and observation

The host owns login identity, mount name, task and browser connection. Declare `deskworkBrowser` in `inject` and call `ctx.deskworkBrowser.connect(packageName, exec.signal)`. The SDK resolves current task context; do not guess another entry or reuse external references. Check URL and visible structure, not the domain alone.

References and revision belong to one observation. Observe after actions; stop on missing/ambiguous targets or expired login. Do not persist element references for later use.

`ctx.deskworkBrowser.context()` returns `id`, `name`, `url`. All native plugins receive the same `DESKWORK_SITE_CONTEXT` JSON and `DESKWORK_DATA_DIRECTORY`; plugins own configuration, paths and explicit overrides.

## Actions and approval

`read` means the author verified query semantics. Declare writes as `write`, uncertainty as `unknown`; the host decides whether to execute or pause. Filling and selection may autosave.

Native tools connected through `deskworkBrowser.connect()` wait for DSH approval inside `act()`. After approval, the host observes again, checks revision, records intent and executes. Continue observing on `executed-observe-again`. Rejection, stop, page change and expired approval fail the call; do not retry writes. Audit uses `approval/asked` and `approval/decided`.

External MCP and directly constructed clients return `waiting-for-human-confirmation` with a confirmation ID. End the flow, then observe after the desktop user confirms. MCP can read status/pending actions but cannot confirm for the user or replay the tool.

Host-mediated writes use confirmation, stop and result verification. Trusted third-party code can still access files and networks independently.

## Results, limits and stop

Return observed facts, data scope and evidence. Changed inputs or a model answer do not prove a save. Keep unclear writes pending verification; do not hide uncertainty through retries.

Pass DSH's `exec.signal` into the SDK. A client allows at most 30 host calls, each HTTP call up to 45 seconds; native approval waiting does not use that HTTP budget. Cancellation spans waiting/execution. Split work at limits, bound query retries and never retry writes automatically.
