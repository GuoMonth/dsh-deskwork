# DSH 0.1.5-alpha.1 对齐

## 选择与判据

2026-09-09 核对 npm registry 和 [上游发布](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.5-alpha.1)：最新发布／`alpha` 为 `0.1.5-alpha.1`，`latest` 和 `next` 仍指向 `0.1.2-rc.1`。按项目采用单个选定版本的原则，显式锁定新版 alpha，不依赖 dist-tag 浮动。

基于 Deskwork `ebc67f7`。升级判据：运行时可启动，系统提示词到达模型，MCP 与原生插件工具可用，停止／恢复和桌面确认／回读闭环不回退；仓库外模板可以独立编译。macOS arm64 分发由 PR CI 单独验证。

## 变更与结论

- 根运行时依赖、Devkit peerDependencies／能力说明、插件模板及森果参考插件统一对齐；lockfile 中 229 个 DSH 包条目均为 `0.1.5-alpha.1`，未混入旧 DSH 版本。
- 上游调整 Agent／Inbox API 和会话格式 V3。当前插件不使用被移除的 `ctx.agent` 或可构造 Inbox；既有 SDK JSON-RPC、流式事件与工具注册通过实际回归，本轮无需增加适配代码。
- Deskwork 从自己的消息记录重建上下文并使用新的运行时会话标识；未读取或降级上游 V3 日志。当前结果不证明任意第三方插件兼容，也不覆盖原生 DSH 历史日志迁移。

## 本地验证

Linux、Node 24.18.0、实际发布 DSH 进程、可控模型、本地网站夹具、临时 profile；Electron 沿用 Xvfb 与 `--no-sandbox` 实验模式。

- `npm run build`：通过，含公开 SDK／Devkit、模板、参考插件和桌面构建。
- `xvfb-run -a node --test tests/runtime.integration.ts tests/desktop.integration.ts tests/browser-boundary.integration.ts tests/plugin-runtime.integration.ts tests/plugin-desktop.integration.ts tests/development-desktop.integration.ts tests/plugin-devkit.integration.ts`：8 项通过。覆盖系统提示词、流式工具调用、停止／上下文恢复、双站点确认／回读／重启、浏览器身份边界、原生 Skill、插件生命周期、外部开发连接和仓库外插件编译。
- `npm run check`：格式、文档链接、类型、lint 与单元回归。

日志保存在忽略目录 `.artifacts/dsh-upgrade-{install,build,integration}.log`。真实模型／业务未在本轮调用，macOS 安装包结果以该 PR CI 为准；本轮不发布客户端或插件 Release，不升级用户数据目录中的既有安装。
