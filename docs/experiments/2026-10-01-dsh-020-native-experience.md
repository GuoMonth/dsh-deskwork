# DSH 0.2.0 原生能力与 ERP 经验复用

任务：[跨仓库 Issue #122](https://github.com/GuoMonth/dsh-multi-tenant/issues/122)。用户要求对齐最新版并复用原生操作与生态，使一个人积累的 ERP 经验可导出给其他人导入。

## 选定上游与实现

2026-10-01 查询 GitHub Release 与 npm，最新为 [DSH 0.2.0-rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)，2026-09-29 发布，仍为预发布；上游固定提交 `639ed015397290b3745d163aafe02ffee4aa3f84`。所有有效运行依赖、SDK/Devkit 和样例插件均对齐这个版本，Cordis 对齐 4.0.4；旧实验记录保留原版本事实。

复用原生 Browser Use 注册，Deskwork 将自己的任务浏览器注册为唯一 `deskwork` 提供方。ERP 消费方因此继续操作原来的 Electron 页面，使用原来的页面引用、确认、结果回读和任务撤销。它不会在 Deskwork 中启动 Playwright 浏览器。宿主服务由应用路径加载，避免独立插件安装 profile 的包解析差异。

rc.2 的官方 API-Key 适配器使用原生 Messages API，已移除旧 `chat-completions` 配置；确定性模型夹具同步改用 Messages 请求与 SSE 事件。测试端点实际收到请求，检查模型指令、工具调用和历史恢复，不能仅凭 initialize 成功断言模型配置已生效。

API-Key 适配器的原生 Messages helper `@deepseek-ai/dsh-llm-deepseek` 显式列为生产依赖，确保生产安装和封存的桌面运行时包含该包。打包后将 Linux 应用复制到仓库外再运行集成测试，避免仓库的 node_modules 掩盖缺失依赖。

新增按入口隔离的原生 filesystem Skill 根目录，关闭全局默认目录发现。ERP 自己注册导入的经验 Skill；现有浏览器插件与开发指南继续用同一个原生 Skill 服务。

ERP 提供一次调用导出/导入：生成标准 `SKILL.md` 和 JSON 引用目录；接收者范围下的知识和关系原子写入，标为待核验，重复导入保留本地修正。数据边界及操作示例见 [ERP 原生分享指南](https://github.com/GuoMonth/dsh-erp/blob/issue-122-native-erp/docs/native-and-sharing.md)。导出不上传或发布，分享者仍需检查描述里的自由文本。

Deskwork 使用 DSH 原生 approval 服务和一次调用的审批事件/审计，由 Electron 确认对话框回答经验导入和知识更正/确认请求。取消为默认；停止运行时撤销未决对话框，晚到的回答不能被新任务使用。该桥不自动批准浏览器或桌面工具。

Computer Use 在 ERP 插件中通过 `computerUse: true` 显式加载官方 Cua Driver Native；Deskwork 没有默认打开整台电脑的操作能力。原生提供方负责截图附件与操作实现，不复制自己的 OS 驱动。原生能力不是插件沙箱。

## 验证

环境：Linux x64、Node 24.21.0、npm 11.19.0、Electron 44.0.0、DSH 0.2.0-rc.2。测试模型为本机确定性 Messages 端点，没有调用真实业务账号。Electron 测试运行在 Xvfb；仅夹具禁用 Chromium sandbox。

```sh
npm run check
npm run test:runtime
node --test tests/plugin-runtime.integration.ts
xvfb-run -a node --test tests/desktop.integration.ts
DESKWORK_ERP_TARBALL=/absolute/path/to/candidate.tgz node --test tests/native-erp.integration.ts
```

联合测试安装 ERP npm TGZ，验证宿主提供方为 `deskwork`，模型目录没有另一个 Playwright 或旧 ERP 浏览器操作工具。通过真实 DSH Agent loop 调用：观察 → 原生证据保存 → 知识记录 → Skill 导出 → 拒绝导入 → 允许导入 → Skill 目录发现 → 本地知识核对。随后停止并重启运行时，在新 Session 中重新发现 Skill 并读取导入知识，无需再次导入或观察。来源用户的两次审批写入原生 Session 审计；导出的 JSON 不含本地入口身份和证据 ID。

再用独立插件目录重新安装同一 TGZ，为第二个账号创建空运行目录，确认没有来源 Skill 或知识。第二个账号经原生审批导入同一分享文件后，只得到绑定自身范围的待核验知识，不继承证据或确认；再次重启并创建新 Session，仍可发现 Skill 和读取知识。整个联合检查共 20 次真实模型请求、3 次原生导入审批，仅来源用户调用一次页面观察。

现有插件测试覆盖标准安装、原生 Skill 加载、示例 ERP查询与开发指南；真实 Electron 测试覆盖确认、读取结果、提交后刷新、拒绝伪成功、会话隔离和重启恢复。ERP 仓库另有真实 Chromium 官方 Playwright MCP 与跨用户经验分享回归。Cua Driver 在隔离的 Linux Xvfb 中实际捕获可见窗口 PNG、后台点击并重新截图，由独立页面读取确认点击结果；使用上游原生二进制和完整尺寸窗口内坐标。

制品摘要、双方确切提交和 PR 关联记录在 Issue #122 的交付评论；消费方测试需要提供该摘要对应的 ERP TGZ。建议先合并 ERP 接口，再合并 Deskwork 消费方；两侧合并本身不构成 npm 发布。

## 对齐最新 main

合并前同步 [PR #27](https://github.com/GuoMonth/dsh-deskwork/pull/27) 的 main 提交 `b7d570e585b44b63615f876b28a008b60fd87395`。保留应用 `0.2.0-alpha.2`、SDK/Devkit `0.1.0-alpha.2`、Cordis group `1.0.4`、pnpm `11.20.0`、独立 `Resources/runtime`、文件清单封存、Node-mode 环境和 SDK 提供方启用检查。原生服务和审批入口与 SDK server 一起构建、复制到该运行时，从运行时自己的生产依赖加载；不恢复根仓库依赖打包。

复用 main 的 Messages 测试夹具，重新验证 9 项桌面/runtime/plugin 集成、仓库外 Devkit 和指定 ERP TGZ 的跨账号导入及重启。联合测试也支持 `DESKWORK_TEST_EXECUTABLE` 与 `DESKWORK_TEST_RESOURCES`，可直接以仓库外安装包的可执行文件和 `resources/runtime` 验证同一分享链路。

Linux 安装包在仓库外、空 PATH 下的 8 项现有集成及 ERP 跨用户分享/重启联合验证通过；市场计算器安装后实际回读 `96`，再次核对 16,858 个运行时文件清单一致。命令：`DESKWORK_ERP_TARBALL=/absolute/path/to/candidate.tgz xvfb-run -a node scripts/verify-package.ts`。这同时确认新增服务使用随包运行时，没有依赖开发仓库提供 Node 或模块。CI 与最终合并提交的结果另记于 Issue #122。

## 未覆盖范围

真实 DeepSeek、真实 ERP 权限/业务结果、真实模型视觉附件往返、用户 macOS 和分享文件的人工保密审阅尚未验收。标准 Skill 目录可传递复用，本轮没有自动上传分享链接或独立导入导出按钮；用户通过对话触发一次工具调用完成导出或导入。
