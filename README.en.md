# DSH Deskwork

**Sign in to your business systems. Let AI help get the work done.**

An AI desktop workspace for ERP and business operations, powered by DeepSeek Harness.

[简体中文](./README.md) · [Design (中文)](./docs/design/workspace.md) · [Roadmap (中文)](./docs/roadmap.md) · [Contributing](./CONTRIBUTING.md) · [MIT License](./LICENSE)

DSH Deskwork aims to package **DeepSeek Harness (DSH) into a desktop workspace** for people working with existing ERP and business applications. Its workbench takes inspiration from VS Code and Cursor, with business pages alongside an AI assistant and a dedicated Agent conversation mode.

> **Status: configurable MVP implemented; preview acceptance in progress.** Add URLs to an empty workspace to get fixed entries, independent conversations, and persistent browser identities. Real DSH and Electron pass a two-site confirmation/readback flow with a controlled model. Live DeepSeek, authenticated website tasks, and user Mac acceptance remain pending. Senguo is only an optional test example. See the [M1 specification](./docs/specs/m1-configurable-workspace.md), [verification evidence](./docs/experiments/2026-09-06-configurable-mvp.md), and [preview guide](./docs/preview.md).

Use `npm run dev` for the explicitly synthetic design preview, or `npm start` for the desktop app.

## Two modes, shared context

### Copilot mode

Work with your business application on the left and DSH chat on the right. Open a tab, sign in yourself, and ask the assistant to work within the selected authenticated session.

- Read, navigate, fill in, and operate business pages through browser tools.
- Watch progress, pause execution, and take over the page.
- Review consequential actions such as submission, deletion, or approval before execution.

### Agent mode

M1 expands the conversation while retaining the same browser session and task, with an action to show the page again. Two additional execution paths are planned for later milestones:

| Path                        | How it works                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Authenticated business APIs | Use a controlled execution layer to reuse the selected session and invoke validated business endpoints. |
| User-configured MCP         | Connect MCP services with user-configured credentials and tool access.                                  |

Both modes share connections, session selection, and task context. When authentication expires, the user can reopen the business page, sign in, and resume the task.

## Execution model

DSH orchestrates tasks through three tool paths: **browser operations, validated business APIs, and configured MCP tools**. Session credentials stay under host control; they are not passed to the model or arbitrary MCP servers as ordinary text. API access requires system-specific authentication and business validation rather than assuming every logged-in page has a directly reusable API.

## Initial use cases

Planned examples include querying and exporting pending purchase orders, preparing a purchase order for user review, reconciling orders against receiving records, and querying inventory through MCP.

M1 targets configurable entries and a generic browser operation loop. Two structurally different test sites must use the same tools, with configuration changes only. Senguo is an optional real-site example; adding another ERP must not require a connector or field mapping.

## Principles

- Configure one URL per fixed entry; preserve the website's original business pages.
- Keep system and account selection explicit; operate within the user's existing permissions.
- Preserve task context when switching between Copilot and Agent.
- Treat page and tool content as data, without allowing it to expand execution authority.
- Record meaningful steps and outcomes, including failures and requests for human input.
- Turn verified browser/API workflows into reusable business tools over time.

## Development status

AI owns implementation, tests, experiments, and maintenance. Humans provide specifications, consequential decisions, and review. Agents load only relevant context through [AGENTS.md](./AGENTS.md).

M1 uses Electron, DSH and a host-owned CDP adapter; Browser Harness remains an isolated integration candidate. See [the contributor guide](./CONTRIBUTING.md) for experiment setup and [the documentation index](./docs/README.md) for principles, standards, decisions, hypotheses, and evidence. M1 targets macOS arm64. See [ADR-0005](./docs/decisions/0005-configurable-workspace-scope.md) for the corrected scope and [ADR-0004](./docs/decisions/0004-m1-desktop-integration.md) for retained runtime and distribution choices. See the [design](./docs/design/workspace.md) and [roadmap](./docs/roadmap.md) for planned decisions and acceptance criteria.

## License

This repository's code and documentation are licensed under the [MIT License](./LICENSE). DSH, desktop runtimes, and other future third-party dependencies retain their own licenses.
