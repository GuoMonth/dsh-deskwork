# DSH 0.1.6-alpha.2 对齐

日期：2026-09-19。任务：[Issue #24](https://github.com/GuoMonth/dsh-deskwork/issues/24)。基准 main ebc67f7f69ec4812a9f95b40f156afa248333115。

## 选定版本与改动

- DSH **0.1.6-alpha.2**，对应[官方发布标签](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.6-alpha.2)。当日 npm alpha 为此版本，latest/next 仍为 0.1.5-rc.2；不使用浮动标签安装。
- Electron **44.0.0**。DSH 0.1.6 的 app-boot 改为通过 node-addon-require-builtin 0.1.6 获取内部模块。当前 Electron 44.2.0 实测被原生加载器拒绝：unsupported Electron runtime fingerprint（Node 24.20.0，V8 15.2.124.19-electron.0）。其诊断列出 43.0.0、44.0.0、45.0.0-alpha.6，因此选择同主版本的 44.0.0；这限制了 Electron 补丁版本，后续升级须重新验证加载器。
- 宿主依赖、Devkit peer、公开能力元数据、模板及参考插件均对齐 DSH；旧 dsh-code-runtime 替换为 dsh-ptc-runtime。未使用的工作流执行器无需加入 sdk-minimal。
- DSH 默认改为 Messages；Deskwork 显式设置 chat-completions，保持已有自定义 API 地址的协议与行为。
- sdk-minimal 新增 MCP 资源工具；真实工具目录回归保留完整断言，加入 list_mcp_resources、list_mcp_resource_templates 和 read_mcp_resource。

## 验证

Linux x64，Node 24.21.0，npm 11.19.0；本机已有隔离环境，桌面夹具按仓库规则使用 host 模式及 --no-sandbox，全部业务和模型为受控测试替身。

- `npm run check`：格式、文档链接、严格类型、lint 和单元回归通过。
- `npm run build`：桌面、MCP、SDK、Devkit 和参考插件构建通过。
- `node --test tests/plugin-devkit.integration.ts`：仓库外 TGZ 安装、指南读取、模板创建与编译通过（本轮与 plugin-runtime 同次启动，Devkit 用例独立通过）。
- `xvfb-run -a node --test tests/runtime.integration.ts tests/desktop.integration.ts tests/browser-boundary.integration.ts tests/plugin-runtime.integration.ts tests/plugin-desktop.integration.ts tests/development-desktop.integration.ts`：7 项全部通过，涵盖真实 DSH 与 Electron、受控模型工具回合、双站点确认/回读/重启、身份边界、原生插件/Skill/装卸及外部开发 MCP。
- lockfile 中全部 250 个 DSH 包条目均为 0.1.6-alpha.2，无旧版 DSH 残留。

初次回归真实发现旧 Electron 原生加载失败及工具目录变化；修复配置与精确版本后，以上相应边界通过。没有使用旧 PR 测试结果代替新回归。

## 范围

本轮对齐运行时；未启用上游 Browser Use/Computer Use 提供方，未验证真实模型、真实 ERP、用户 Mac 或新版安装包。现有 Electron CDP 与插件浏览器接口继续使用。旧 PR #22 的 0.1.5-alpha.1 证据不作为本轮验收，也未合并或关闭该 PR。
