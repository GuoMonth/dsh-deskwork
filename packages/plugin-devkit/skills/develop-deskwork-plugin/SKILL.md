---
name: develop-deskwork-plugin
description: Create, debug, or package standard DSH plugins that use the Deskwork browser SDK. Use for plugin development, not ordinary ERP queries.
---

# Develop a Deskwork plugin

Read [the development workflow](../../docs/workflow.md), then [the host contract](../../docs/contract.md). With MCP, use `deskwork_development_info` followed by `deskwork_read_document`; with DSH, use `deskwork_developer_docs` with `id: workflow` or `id: contract`. These routes read the same bundled files.

- Create an independent project using the kit's template. Import the public SDK; never copy host source files. Read the shipped types before using an API.
- Use business parameters and explicit result evidence. Keep known browser steps inside bounded tools; load detailed page knowledge only when needed.
- Verify page prerequisites and propagate the execution signal. Stop on ambiguous targets or unknown effects. A paused confirmation is not a successful action and must not trigger a retry loop.
- Check the generated package outside the Deskwork repository. Distinguish compilation, fixture behavior, real website behavior and marketplace availability in the result.
- Use the existing DSH package and marketplace route. Publishing is a separate external action that follows the user's authorization. Never ship credentials or business records.

For local setup and MCP configuration, read [the kit entrypoint](../../README.md). For browser debugging, ask the user to select a website and enable the development connection in Deskwork; use its generated MCP configuration. Confirm writes in the desktop UI. After confirmation, read status and reobserve before continuing. Automatic resumption of plugin function stacks is not provided.
