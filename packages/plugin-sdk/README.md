# Deskwork Plugin SDK

任务绑定的浏览器观察和动作接口，供标准 DSH 插件调用。需要 Deskwork 提供运行环境；开发版本不承诺兼容性。

类型和 Schema 随包提供。标准插件声明 `deskworkBrowser` 依赖，并通过 `ctx.deskworkBrowser.connect(包名, exec.signal)` 获得客户端；类型从 `@guomonth/deskwork-plugin-sdk/dsh` 导入。底层 `PluginBrowserClient` 接收包名和 DSH 工具执行信号；每次动作后重新观察。写入或未知影响可能暂停等待确认，检查 `act()` 返回的状态；等待确认时返回该结果并结束当前工具，后续重新观察，不重放提交。SDK 不提供自动写入恢复。

搭配 `@guomonth/deskwork-plugin-devkit` 的随包指南和模板开发。SDK 不启动浏览器，不管理用户身份，不限制受信任插件自身的本地或网络访问。
