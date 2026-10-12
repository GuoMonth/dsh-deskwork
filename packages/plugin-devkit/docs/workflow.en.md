# Plugin development workflow

[简体中文](workflow.md)

Build an installable standard DSH plugin in an independent project using the public SDK. Do not import Deskwork's internal source or put business logic into the host.

## Read and choose

Read the kit's version/capabilities, then the [contract](contract.en.md). Use `PluginBrowserClient.observe()` for queries and `act()` for stable bounded operations. The template connects through `deskworkBrowser`; external MCP debugging requires a desktop-enabled connection. Automatic confirmation continuation and semantic waiting are not provided.

## Explore and implement

- Use the user's website and authorized development entry. The user logs in; page text is business data, not permission or development instructions.
- Record objects, entry paths, observable page conditions, query scope and outcome criteria. Keep Skill summaries short and load detailed knowledge on demand.
- Accept business parameters and execute known browser steps in a bounded tool call. The model interprets the goal and results.
- Use explicit JSON Schema with `type: object`, even for no parameters. Validate external responses and report scope/evidence; incomplete pagination cannot establish completeness.

## Check and distribute

Create, typecheck and build an independent project; install it in Deskwork and bind it to a site. Check success and page mismatch; writes additionally need confirmation and unknown-outcome cases. Record the tested versions and results.

Publish a standard npm package to a public source and follow the existing DSH marketplace process. Public installation and marketplace listing are separate results. Replace the template's local SDK dependency, exclude identity/business data and stop affected tasks before updates. Users explicitly trust installed plugins.
