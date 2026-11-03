# DSH 0.2.1-rc.5 对齐

日期：2026-11-03。应用版本仍是已发布的 0.2.3。源码里的 DSH 依赖从 **0.2.1-rc.3** 精确锁定到 **0.2.1-rc.5**，对应上游标签 `dsh-v0.2.1-rc.5`、提交 `b830ec950faba0a46dda564be3e2d854afed94f1`。选择 rc.5 是因为 npm `latest` 与 `next` 都是该版本；不使用 `0.2.2-alpha.*`。已发布的 v0.2.3 桌面二进制仍是 rc.3 构建，本次不替换这些制品。

本地环境与命令结果见文末验证。网站和模型仍用确定性夹具。真实模型、真实 ERP 写入和用户 macOS 实机验收不在本轮结论内。

## 上游差异

`dsh-v0.2.1-rc.3...dsh-v0.2.1-rc.5` 共 13 个提交。`@deepseek-ai/dsh` 的依赖名单没有增减，第三方依赖版本没有变化；Cordis、Electron、pnpm、electron-builder 保持 rc.3 对齐时的基线。`sdk-minimal` 只改了版本号，工具组合没有变化。

实质行为只有三处，都在 Deskwork 不承载的表面上：

1. **rc.4：ACP 的 stdout 只留给协议。** 账号目录日志改走 stderr；MCP `resources/list` 在服务端未声明 resources 能力时直接返回空页，避免 SDK 把 `console.debug` 写进 ACP 的 stdout。
2. **rc.4：官方 Web 的视图 tooltip。** 「更多视图」不再把当前名称拼进悬浮文案；标签未溢出时不显示 tooltip。
3. **rc.5：官方对话里的思考内容。** `conversation.chat.reasoning.body` 的 `text` 改为 Chat 准备好的展示文本，新增 `rawText` 保留模型原文；`running` 不变。内容工厂仍接收调用方选定的 `text`。

Deskwork 不启动 ACP，不嵌入官方 Web UI，也不向 reasoning body slot 注册渲染。运行时继续把 `llm-deepseek` 的 `thinking` 设为 `disabled`。因此没有调用点要改，也没有因 rc.5 而失效的兼容垫片需要删除。MCP 诊断修复随 `@deepseek-ai/dsh-mcp-client` 进入，Deskwork 继续使用该包，不复制客户端。

## 保留的产品差异

这些不是版本兼容层，rc.5 也没有提供可替换的官方等价物：

- 网站工作台继续关闭 `persistent-bash`、`persistent-pwsh`、`terminal-bash`、`terminal-pwsh`、`pty`、`tool-fs`、`tool-working-directory`。上下文压缩、token 计量和图片卸载仍来自官方 `sdk-minimal`。
- SDK 传输仍包住官方 `HarnessSdkJsonRpcServer`。额外保留 `deskwork/plugins/status`，并在配置的 `deepseek-official` 提供方缺失时直接失败。官方 `initialize` 会在适配器失败后改用默认路由；Deskwork 需要这个失败可见，所以守卫留下。
- 浏览器、审批和对话界面仍由 Deskwork 实现。不迁入官方完整 Web UI。

## 依赖

直接依赖、开发依赖、SDK 与 Devkit 的 peer、插件模板和 catalog 都是 `0.2.1-rc.5`。SDK 与 Devkit 自身版本仍是 `0.1.0-alpha.4`；变的是它们声明的 DSH peer，不是包版本号。不承诺旧 peer 范围仍可安装。

## 验证

环境：Linux x64、Node 24.18.0、npm 11.16.0、Electron 44.7.0（内嵌 Node 24.21.0）。Electron 测试使用 Xvfb。Linux 目录包由本机 Electron 分发物构建：`electron-builder --linux dir --publish never -c.electronDist=node_modules/electron/dist`，没有从 GitHub 再下载一份。

- `npm run check:fresh`：格式、文档、类型、lint、单元测试通过。
- `npm run build` 通过。
- `npm run test:devkit`：仓库外 Devkit 集成 1 项通过。
- 运行时集成 4 项通过：工具回合、缺失日志拒绝、禁用模型提供方拒绝、非法模型地址拒绝。
- 原生审批 5 项、浏览器边界 1 项、插件运行时 3 项通过。
- 桌面集成通过：桌面壳 2 项、真实 DSH + Electron 1 项、外部开发连接 1 项、语言 1 项、插件桌面 1 项。
- `node scripts/prepare-desktop-runtime.ts` 得到 41010 个文件、DSH 0.2.1-rc.5、Electron 44.7.0、Node 24.21.0。
- `node scripts/verify-package.ts` 在空 PATH 下复跑随包集成 16 项通过，并核对 app.asar 内 12 个品牌资源。实时市场探针仍是手动 opt-in，本轮未跑。
- 已发布 ERP 0.1.2 TGZ（`guosheng_047-dsh-erp-0.1.2.tgz`）的 `tests/native-erp.integration.ts` **失败**。该包把 `dsh-llm`、`dsh-tools`、`dsh-skill` 的 peer 精确写成 `0.2.1-rc.3`，官方插件门禁拒绝在 0.2.1-rc.5 上安装。本轮不使用 `allow-version` 豁免。

登录 shell 探测在空 PATH 下有候选失败，测试继续使用可用环境；这不是 DSH 版本回归。

## 范围与限制

DSH 仍是预发布版本。Deskwork 不对 rc.3 与 rc.5 做兼容矩阵，也不保留只为旧 RC 服务的路径，也不给精确 peer 不匹配的插件开豁免。已发布的 ERP 0.1.2 因此不能装进 rc.5 运行时，需要该插件自行改 peer 并重新发布。自动上下文压缩仍是 0.2.1 的默认行为。真实 ERP 写入、用户 macOS 和 Apple 公证继续按原验收范围单独执行。
