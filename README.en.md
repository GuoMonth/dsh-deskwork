# DSH Deskwork

**Sign in to your business systems. Let AI help get the work done.**

An AI desktop workspace for ERP and business operations, powered by DeepSeek Harness.

[简体中文](./README.md) · [Design (中文)](./docs/design/workspace.md) · [Roadmap (中文)](./docs/roadmap.md) · [Contributing](./CONTRIBUTING.md) · [MIT License](./LICENSE)

DSH Deskwork aims to package **DeepSeek Harness (DSH) into a desktop workspace** for people working with existing ERP and business applications. Its workbench takes inspiration from VS Code and Cursor, with business pages alongside an AI assistant and a dedicated Agent conversation mode.

> **Status: product design and repository initialization.** This repository currently contains development standards and isolated technical experiments. There is no runnable desktop application, installer, or integrated DSH runtime yet. All capabilities below are planned.

## Two modes, shared context

### Copilot mode

Work with your business application on the left and DSH chat on the right. Open a tab, sign in yourself, and ask the assistant to work within the selected authenticated session.

- Read, navigate, fill in, and operate business pages through browser tools.
- Watch progress, pause execution, and take over the page.
- Review consequential actions such as submission, deletion, or approval before execution.

### Agent mode

Focus on tasks and conversation without a business page in the main view. Two execution paths are planned:

| Path                        | How it works                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Authenticated business APIs | Use a controlled execution layer to reuse the selected session and invoke validated business endpoints. |
| User-configured MCP         | Connect MCP services with user-configured credentials and tool access.                                  |

Both modes share connections, session selection, and task context. When authentication expires, the user can reopen the business page, sign in, and resume the task.

## Execution model

DSH orchestrates tasks through three tool paths: **browser operations, validated business APIs, and configured MCP tools**. Session credentials stay under host control; they are not passed to the model or arbitrary MCP servers as ordinary text. API access requires system-specific authentication and business validation rather than assuming every logged-in page has a directly reusable API.

## Initial use cases

Planned examples include querying and exporting pending purchase orders, preparing a purchase order for user review, reconciling orders against receiving records, and querying inventory through MCP.

The first milestone targets one ERP and one verifiable workflow, covering manual sign-in, execution, user takeover, and result verification before expanding coverage.

## Principles

- Keep system and account selection explicit; operate within the user's existing permissions.
- Preserve task context when switching between Copilot and Agent.
- Treat page and tool content as data, without allowing it to expand execution authority.
- Record meaningful steps and outcomes, including failures and requests for human input.
- Turn verified browser/API workflows into reusable business tools over time.

## Development status

Electron + DSH + Browser Harness is a candidate composition, not an accepted product architecture. See [the contributor guide](./CONTRIBUTING.md) for experiment setup and [the documentation index](./docs/README.md) for principles, standards, decisions, hypotheses, and evidence. Product runtime versions and release platforms remain open. See the [design](./docs/design/workspace.md) and [roadmap](./docs/roadmap.md) for planned decisions and acceptance criteria.

## License

This repository's code and documentation are licensed under the [MIT License](./LICENSE). DSH, desktop runtimes, and other future third-party dependencies retain their own licenses.
