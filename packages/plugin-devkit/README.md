# Deskwork Plugin Devkit

面向 AI 插件作者的本地开发套件：同一份指南通过文件、原生 DSH Skill 和 MCP stdio 读取。开发版；提供用户明确开启的外部浏览器开发连接，不承诺版本兼容性。

## 从这里开始

1. 阅读 [开发流程](docs/workflow.md) 和 [执行契约](docs/contract.md)。SDK 类型与 Schema 从源码生成随包文件，构建后通过 MCP 的 `sdk` 文档读取。
2. 获取本轮 SDK 与 Devkit 的标准 npm `.tgz` 包。仓库开发者运行 `npm run pack:devkit`，输出在 `.artifacts/devkit`。当前尚未发布 npm 包，不依赖未发布的包名安装。
3. 安装 Devkit tarball，使用 `deskwork-devkit create ./my-query-plugin --sdk /absolute/path/sdk.tgz` 创建独立项目。在新目录执行 `npm install`、`npm run check` 和 `npm run build`。
4. 在 Deskwork 插件面板安装 `file:/绝对路径/my-query-plugin`，绑定网站后，在任务中调用工具。模板本身只观察，不修改网站。

## 外部 AI 的 MCP 配置

使用已安装包内 CLI 的绝对路径。以下为配置形状，路径需换成本机实际值：

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

需要 Node 24；无需启动 Electron、访问网站或提供模型密钥。AI 先调用 `deskwork_development_info`，再按 ID 读取或搜索文档。stdio 只承载 MCP 协议；客户端启动此进程，关闭连接后进程退出。也可直接用文件工具读取本目录，不依赖 MCP。

## 原生 DSH 入口

本包同时包含标准 `dsh.bundle`。客户端已经随包提供开发模块，启动 DSH 时注册 `develop-deskwork-plugin` Skill 和文档读取工具。Skill 只负责开发路由，正文按需加载。普通业务任务只看到开发 Skill 的简短摘要，完整手册按需读取。不要在 Deskwork 重复安装同一开发模块。

[开发 Skill](skills/develop-deskwork-plugin/SKILL.md) 与 MCP 共用本目录内容。发布前运行类型检查和功能验证；不要把 Cookie、模型密钥或真实业务记录放进插件包。

## 连接已打开的网站

在桌面「插件 → 开发插件 · 连接编程 AI」中选择网站，点击「允许外部 AI 开发此网站」，复制生成的 MCP 配置。配置使用应用自带执行器和随包开发工具，无需系统 Node 或另装浏览器。连接凭证只存于本机用户数据目录，配置引用该文件，不包含网站 Cookie。

AI 首先调用 `deskwork_browser_status`、`deskwork_browser_observe`，再按新观察的元素引用调用 `deskwork_browser_act`。已验证查询可声明 `read`，写入声明 `write`，未知影响声明 `unknown`。写入确认只能在桌面完成，MCP 没有代替用户确认的工具。

收到 `waiting-for-human-confirmation` 后结束当前流程。用户确认后，读取状态和 `pendingAction`，重新观察实际结果；有待核对写入时调用 `deskwork_browser_verify`，不能重放提交。核对失败交给用户，必要时停止并在桌面手动核对。页面失效或人工接手后，由用户在桌面恢复，然后 AI 再读取状态。

开发连接固定一个网站并占用自动任务位置，其他网站可手动浏览。关闭 MCP 进程后可用同一配置重连；桌面点击断开、MCP 调用 `deskwork_browser_stop` 或退出客户端才撤销授权。重新开启连接后，需要重新启动 MCP 读取新凭证。重启不会恢复旧开发连接或重放确认。
