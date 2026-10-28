# DSH 0.2.1-rc.3 对齐

日期：2026-10-28。应用版本 0.2.3，所有 DSH 依赖精确锁定 **0.2.1-rc.3**，对应上游标签 `dsh-v0.2.1-rc.3`、提交 `1f81c047fc48fa190a683e469daa699857e9afe8`。选择 rc.3 是因为官方桌面 nightly 更新源当前发布的正是该版本；npm `next` 的 0.2.1-rc.4 只修复 ACP 模式 stdout 诊断，Deskwork 不使用 ACP，`0.2.2-alpha.2` 仍是 alpha。

本地环境：Linux x64、Node 24.18.0、npm 11.16.0、Electron 44.7.0（内嵌 Node 24.21.0），Electron 测试使用 Xvfb；网站和模型均为确定性夹具。真实模型、真实 ERP 写入和用户 macOS 实机验收仍不在本轮结论内。

## 依赖与基线

- 34 个 `@deepseek-ai/dsh-*` 包统一为 `0.2.1-rc.3`；移除上游已删除且本仓库未使用的 `@deepseek-ai/dsh-subagent-in-process-driver`。
- Cordis `4.0.5`、`@deepseek-ai/cordis-plugin-group` `1.0.5`、pnpm `11.28.5`、Electron `44.7.0`、electron-builder `26.17.0`，与官方桌面 0.2.1-rc.3 的技术基线一致。
- SDK 与 Devkit 升为 `0.1.0-alpha.4`；模板、catalog 和 peer 依赖同步到 rc.3。
- ERP 消费方升为 `0.1.2`，与宿主使用同一 DSH 预发布版本。

## 按官方方向收敛

1. **会话生命周期改用官方协议。** 0.2.0-rc.2 没有恢复方法，Deskwork 曾在自定义 `deskwork/session/prompt` 中用 `ctx.agents.resume()` 补入口。0.2.1 提供 `session/resume`、`session/wait` 和 `session/working-directory/get|set`，本轮删除自定义会话表和恢复逻辑，客户端按官方语义先 `session/resume` 再 `session/prompt`，只保留桌面宿主的模型提供方守卫和插件加载状态查询。
2. **按官方 bundle 重新组合工具面。** `sdk-minimal` 现在是“最小编码 Agent”，新增 `fs-local`、`attachment-local`、`tool-fs`（`read_image`）、`working-directory` 及工具、`token-meter`、`compaction-basic`、`image-offload`。Deskwork 继续只提供网站工作台工具面：显式关闭 `tool-fs`、`tool-working-directory`、shell、PTY 和编辑器；保留官方的上下文压缩、token 计量与图片卸载服务。已删除不再存在的 `str-replace-editor` 禁用项。
3. **沿用官方运行时策略。** 吸收 0.2.1 的 node-pty ConPTY、domino `.yarn`、fs-ext 编译产物、pdb、koffi 导入库等运行时排除项，同时保留 Deskwork 自己的 `.gitkeep` 处理和独立 runtime 布局。
4. **不迁入官方完整 Web UI 或私有桌面 SDK。** 浏览器、审批、任务和插件宿主仍由 Deskwork 自己的实现负责。

## 关键回归与处理

- 官方 `session/prompt` 在已持久化但未恢复的 Session ID 上会拒绝创建。重启续聊必须显式走 `session/resume`；运行时按原生 Session ID 记录已打开状态，避免同一进程重复恢复。
- 官方 SDK 在关闭时先退订 session 通知、再释放 Agent，因此关闭瞬间的审批取消不会作为实时 `session.event` 送达；持久日志仍恰好包含一次 `approval/asked` 和一次 `approval/decided`（`cancelled`）。迟到回答测试改为核对持久日志，产品侧的“关闭后不再执行”语义不变。
- Electron 44.7 不接受未安装的 `LC_ALL`/`LANG` 名称。语言测试改用 `LANGUAGE=zh-CN` 选择 Chromium 语言，并把 POSIX locale 保持为可用的 `C.UTF-8`。
- ERP 的原生 Browser Use 组合新增 `working-directory` peer；独立测试组合挂载 `dsh-fs-local` 和 `dsh-working-directory` 后再加载官方 Playwright MCP 提供方。
- ERP 制品冒烟需要拉取 `playwright-core` 预发布包和 CUA Driver；本轮本机到 npmjs 的连接不稳定，使用可访问的 npm 镜像完成安装验证，未修改发布源或锁文件协议。

## 验证状态

- Deskwork `npm run build`、类型检查、文档检查、格式和 47 项单元测试通过。
- 运行时集成 4 项通过：工具回合、重启原生恢复、缺失日志拒绝、禁用模型提供方拒绝。
- 桌面集成 1 项通过：真实 DSH + Electron、确认、回读、隔离会话和重启。
- 插件与浏览器集成通过：原生审批 5 项、浏览器边界 1 项、插件运行时 3 项、插件桌面 1 项、外部开发连接 1 项、语言桌面 1 项、桌面壳 2 项。
- ERP `docs:check`、类型检查、84 项测试和包外制品冒烟通过；冒烟覆盖标准安装、原生 Browser Use、审批、SQLite、知识记录/查询、Skill 分享与进程清理。
- `node scripts/verify-package.ts` 在仓库外、空 PATH 下校验封装运行时：41010 个文件、DSH 0.2.1-rc.3、Node 24.21.0、Electron 44.7.0，16 项随包集成通过；使用 ERP 0.1.2 TGZ 的跨仓库原生测试也通过。
- Linux 目录包由本地 Electron 44.7.0 分发物构建；electron-builder 从 GitHub 下载默认分发物在本机网络失败，因此使用 `-c.electronDist=node_modules/electron/dist`。macOS arm64 由 Desktop preview CI 单独构建和安装验证。
- 真实市场探针：公开目录当前约 9.5 MB，宿主改为流式限额读取；目录中的 `dsh-tool-calculator@0.0.1` 仍声明 `<0.2.0` 的 `dsh-invariants`/`dsh-tools` peer，被 DSH 0.2.1-rc.3 的官方版本门禁拒绝。验证记录该拒绝，不绕过门禁，也不声称本轮有可用的市场计算器安装。

## 范围与限制

DSH 上游仍是预发布版本，Deskwork 不承诺跨版本兼容矩阵。自动上下文压缩是 0.2.1 的新默认行为，模型可见历史可能被摘要替换，持久 JSONL 与界面历史保留原事件；真实长对话效果仍待真实模型验证。真实 ERP 写入、用户 macOS 和 Apple 公证继续按原验收范围单独执行。
