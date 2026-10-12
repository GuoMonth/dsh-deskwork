# Deskwork Plugin SDK

[English](README.en.md)

任务绑定的浏览器观察和动作接口，供标准 DSH 插件调用。需要 Deskwork 提供运行环境；开发版本不承诺兼容性。

类型和 Schema 随包提供。标准插件声明 `deskworkBrowser` 依赖，并通过 `ctx.deskworkBrowser.connect(包名, exec.signal)` 获得客户端；类型从 `@guomonth/deskwork-plugin-sdk/dsh` 导入。`ctx.deskworkBrowser.context()` 提供当前网站的 `id`、`name` 和 `url`，业务配置和存储由插件自行管理。

内置原生工具的 `act()` 会通过 DSH approval 等待用户决定，在原函数栈中继续；允许一次后，宿主重新观察、校验 revision、记录写入意图并执行。拒绝、停止或确认失效使调用失败，不能自动重试写入。每次动作后重新观察，提交后核对结果。外部开发 MCP 和直接构造的 `PluginBrowserClient` 保留 `waiting-for-human-confirmation` 返回；调用方结束当前流程，用户确认后重新观察，不重放提交。

搭配 `@guomonth/deskwork-plugin-devkit` 的随包指南和模板开发。SDK 不启动浏览器，不管理用户身份，不限制受信任插件自身的本地或网络访问。
