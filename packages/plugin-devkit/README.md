# Deskwork Plugin Devkit

面向 AI 插件作者的本地开发套件：同一份指南通过文件、原生 DSH Skill 和 MCP stdio 读取。开发版；当前不提供外部浏览器调试连接，不承诺版本兼容性。

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

本包同时包含标准 `dsh.bundle`，可按 DSH 插件安装，注册 `develop-deskwork-plugin` Skill 和文档读取工具。Skill 只负责开发路由，正文按需加载。这一版提供可安装模块；尚未默认预装到客户端，不向日常 ERP 对话注入开发手册。

[开发 Skill](skills/develop-deskwork-plugin/SKILL.md) 与 MCP 共用本目录内容。发布前运行类型检查和功能验证；不要把 Cookie、模型密钥或真实业务记录放进插件包。
