# Deskwork Plugin SDK

[简体中文](README.md)

Task-bound browser observation and actions for standard DSH plugins, supplied by Deskwork. This development release describes one exact interface version without a compatibility promise.

Types and schemas ship in the package. Declare `deskworkBrowser` in `inject`, then call `ctx.deskworkBrowser.connect(packageName, exec.signal)`. Import DSH types from `@guomonth/deskwork-plugin-sdk/dsh`. `ctx.deskworkBrowser.context()` returns the current website's `id`, `name` and `url`; the plugin owns its business configuration and storage.

Native tools wait for DSH approval inside `act()`. After approval, the host observes again, checks the revision, records the write intent and executes. Rejection, stop or expired approval fails the call; do not retry writes automatically. Observe after actions and verify submissions. External MCP and directly constructed `PluginBrowserClient` return `waiting-for-human-confirmation`; end the flow, then observe after the user confirms rather than replaying it.

Use the `@guomonth/deskwork-plugin-devkit` guides and template. SDK does not start a browser, manage user identity or restrict a trusted plugin's own file/network access.
