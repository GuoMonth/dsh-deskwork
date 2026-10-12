# Deskwork Plugin Devkit

[简体中文](README.md)

A local kit for AI plugin authors. Files, the native DSH Skill and MCP stdio read the same bundled guides. This development release includes a browser connection explicitly enabled by the user; it makes no compatibility promise.

## Start here

1. Read [workflow](docs/workflow.en.md) and [contract](docs/contract.en.md). Built SDK types and schemas are available as the MCP `sdk` document.
2. Download the SDK and Devkit TGZ assets from [Deskwork Releases](https://github.com/GuoMonth/dsh-deskwork/releases). Repository developers can use `npm run pack:devkit`; output is in `.artifacts/devkit`. These package names are not published to npm.
3. Install the Devkit tarball. Run `deskwork-devkit create ./my-query-plugin --sdk /absolute/path/sdk.tgz`, then `npm install`, `npm run check` and `npm run build` in the new project.
4. Install `file:/absolute/path/my-query-plugin` in Deskwork and bind it to a website. The template observes without modifying the page.

## MCP for an external AI

Replace these paths with your installed Node and CLI:

```json
{
  "mcpServers": {
    "deskwork-development": {
      "command": "/absolute/path/to/node",
      "args": ["/absolute/path/to/plugin-devkit/lib/cli.js", "mcp"]
    }
  }
}
```

Requires Node 24, without Electron, a website or model credentials. Call `deskwork_development_info`, then read/search documents by ID. The bundled catalog serves Chinese guides; English counterparts are linked from each file. The client owns the stdio process; closing it ends the connection. Guides can also be read directly from files.

## Native DSH entry

Deskwork includes this module and registers `develop-deskwork-plugin` plus document tools. The [Skill](skills/develop-deskwork-plugin/SKILL.md) routes development requests to the same guides; business tasks see only its short description. Do not install the module again. Before publication, check types and behavior and exclude cookies, model keys and business records.

## Connect a website

In Plugins → Develop plugin, select a website, allow the external AI connection and copy the generated MCP config. It uses the app's executor and tools; no system Node or separate browser is needed. The config refers to a local credential file and contains no website cookie.

Call `deskwork_browser_status` and `deskwork_browser_observe`, then `deskwork_browser_act` with fresh references. Declare verified queries as `read`, writes as `write`, uncertain effects as `unknown`. Only the desktop can confirm writes.

On `waiting-for-human-confirmation`, end the flow. After confirmation, read status and `pendingAction`, observe the result and call `deskwork_browser_verify` for pending writes. Do not replay submissions. Failed verification needs human inspection; takeover/page invalidation requires the user to resume from the desktop.

The connection binds one website and occupies the automated-task slot. Closing MCP permits reconnection with the same config; desktop disconnect, `deskwork_browser_stop` or app exit revokes access. A new connection needs a new MCP process to read new credentials. Restart restores neither the connection nor old approvals.
