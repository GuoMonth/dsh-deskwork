# 官方 DSH 桌面端对齐与浏览器复用调研

日期：2026-10-01。任务：[Issue #26](https://github.com/GuoMonth/dsh-deskwork/issues/26)。Deskwork 基准：`226ba8d2cde662e03628ffca71ca26e1cc38cc8d`。本记录提供升级实施方案；生产依赖与默认浏览器实现尚未修改。

## 结论

对齐官方 **DSH 0.2.0-rc.2、Electron 44.0.0、electron-builder 26.15.3**。保留 Deskwork 的配置网站、持久身份、任务与宿主浏览器接口，复用官方 DSH 核心及适用的运行时准备和打包逻辑。

本轮默认浏览器继续采用宿主持有的 CDP 引用。官方 Playwright 提供方确实能操作现有 Electron 页面，并支持本次跨域 iframe 的观察；但直接接入会开放其他入口与外壳，且原生填写和点击不经过 Deskwork 确认。要替换默认实现，仍须增加目标映射、动作转换、确认和停止的适配，无法直接删除当前浏览器层。此次版本升级不同时引入该替换，也不同时维护两个默认操作路径。

官方 Sidebar Browser 不能直接覆盖网站工作台需求：它不注册模型工具，Desktop 使用按工作区 CWD 共享的进程内分区，Cookie/Web storage 不跨应用重启保留。其公开 Client tab API 不提供持久站点身份与宿主操作接口。[官方说明](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/client/ui-sidebar-browser/README.zh.md)

## 基准与判据

- 官方源码：`dsh-v0.2.0-rc.2` / `639ed015397290b3745d163aafe02ffee4aa3f84`，候选预发布版本。npm 主包 `latest`/`next` 及 macOS、Windows 官方更新清单均为 `0.2.0-rc.2`。官方网站已提供安装包。[发布](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)、[下载](https://www.deepseek.com/harness/)、[macOS 清单](https://download.deepseek.com/dsh-desk/feeds/mac-arm64/nightly-mac.yml)、[Windows 清单](https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml)
- 研究基准 Deskwork DSH 为 `0.1.6-alpha.2`；Electron 与 electron-builder 已与官方该 tag 的 lockfile 一致。宿主与 Devkit 涉及的 27 个 DSH 包均有目标版本；部分子包的 `latest` 指向旧版，必须使用精确版本。
- 浏览器复用通过条件：操作用户已登录的相同 WebContents，无第二个浏览器或重复登录；保持入口身份、任务目标、确认、停止和恢复行为。实际连接成功只满足其中一部分。
- 分发对齐通过条件：发行包自带运行时和包管理器，目标原生模块可加载，插件安装不修改应用资源，仓库外安装、退出与重启有效；开发启动不能代替这些判据。

## 实测与发现

Linux x64，Node `24.21.0`，npm `11.19.0`。真实 Deskwork/Electron `44.0.0`，官方 DSH 与 Playwright 提供方 `0.2.0-rc.2`，其实际依赖 `@playwright/mcp 0.0.80`。按已授权的 **host** 隔离运行，启动参数包含 `--no-sandbox`；只使用本地合成网站、虚构凭据和受控 Messages 模型服务。临时 profile 与进程在退出时清理。

| 判据           | 观察                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| 附加现有页面   | 官方 MCP snapshot 读到用户手动登录的同一入口，无新 Chromium 或凭据复制                                                |
| 官方完整工具链 | Electron RunAsNode 启动 DSH；受控模型经官方提供方完成列页、选页、snapshot，4 次模型请求                               |
| 页面能力       | snapshot 包含跨域 Settings iframe 的正文标题                                                                          |
| 目标负对照     | 同一工具目录能列出 Deskwork shell、同源另一入口及第二网站，没有宿主任务的目标过滤                                     |
| 确认负对照     | 原生 `browser_fill_form` 与 `browser_click` 在测试站点完成一次写入，Deskwork 没出现确认；不能原样用作宿主默认动作路径 |
| 会话与释放     | 同源另一入口仍未登录；关闭附加连接不关闭应用；重启后原入口保持登录，另一入口仍隔离                                    |

### 升级中的真实阻塞

首次尝试沿用当前宿主的 `protocol: chat-completions` 时，官方 `llm-deepseek` 拒绝启用，诊断为 `protocol is not configurable; remove it and use a Messages-compatible baseURL`。SDK `initialize` 仍能返回成功，随后会话使用默认路由，受控模型没有收到请求。用虚构 key 产生的认证失败不是有效模型验证。

删除旧协议设置、采用本地 Messages 服务、从安装目录明确加载官方提供方后，完整工具链通过。因此实施必须同时迁移请求/事件夹具、核对默认与自定义模型地址，并验证选定提供方实际启用；不能只检查进程存活或 SDK 握手。[官方配置实现](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/llm/llm-deepseek/src/index.ts)

SDK 握手返回的 `serverInfo.version` 是 `0.0.1`，不能将它当作 npm DSH 版本。本实验以已安装 manifest 确认发行版本。

### 复现与检查

先按仓库流程安装基础依赖并运行 `npm run experiment:prepare`，然后：

```sh
node experiments/official-browser-use/prepare.ts
npm run build
xvfb-run -a node --test experiments/official-browser-use.integration.ts
```

原始结果与诊断在 `.artifacts/official-browser-use/result.json`、`.artifacts/official-browser-use-test.log`；官方依赖隔离在 `.artifacts/official-dsh`，不改变生产 lockfile。实验中使用的调试端口只属于临时应用实例，不是产品启动配置。

## 可执行升级方案

### 1. 迁移运行时与开发接口

将根依赖、锁文件、SDK/Devkit 元数据、peer、模板、参考插件及诊断统一到 `0.2.0-rc.2`。保留 `sdk-minimal` 与现有网站工具服务，按真实接口变化更新配置；先将当前工具回归改为能揭示新版行为的失败测试，再完成迁移。

采用官方 Messages 路由，更新模型夹具及实际请求/事件验证。默认 DeepSeek 地址按官方实现解析；已有自定义地址不能机械套用旧 Chat Completions 设置，加载前给出明确的地址/协议错误，不允许静默使用默认路由。增加选定提供方启用失败的回归。支持的配置以本轮实际采用版本为准，不增加历史版本适配。

执行 `runtime`、`plugin-runtime`、`plugin-devkit` 及桌面链路中相关测试。验证原生 Skill、宿主工具、外部开发 MCP 与运行时释放；公开指南保持一份来源。版本信息从运行依赖/能力元数据产生，SDK 协议版本单独表达。

### 2. 对齐桌面运行与打包

沿用已有 Electron 与 electron-builder。官方 `dsh-desktop` 是私有 monorepo 应用，不是可以直接依赖的公开壳 SDK；按固定源码复用适用逻辑，保留 Deskwork 外壳与公开 DSH CLI，而不迁入完整官方 Web 产品。[桌面 manifest](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/apps/desktop/package.json)

| 改动落点                                | 实施内容                                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/build.ts`、打包配置            | 在构建时准备锁定的生产运行依赖树；按目标平台保留原生与动态加载资源，验证 ASAR 解包；先保持完整运行闭包，裁剪须有证据                   |
| `scripts/verify-package.ts` 与准备脚本  | 从官方运行时清单/校验思路提取所需部分，记录 DSH、Electron、内嵌 Node、平台、架构、包管理器与核心包版本，增加错误目标与缺失原生文件负例 |
| `src/host/main.ts`、`plugin-manager.ts` | 核心代码从只读资源加载；插件与用户配置继续独立存放。包内 Node/pnpm 完成安装及必要脚本，失败保留旧环境；不在首次启动下载核心运行时      |
| `desktop-preview.yml`                   | arm64 DMG 安装到仓库外；在缺少系统 Node/pnpm 的运行环境验证 DSH、市场安装与加载、退出、重启及用户数据保留                              |

优先复用官方 [Node-mode 环境](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/apps/desktop/src/node-environment.ts)、[运行时描述与验证](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/apps/desktop/src/runtime-tree.ts)、[文件选择](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/apps/desktop/scripts/runtime-file-policy.ts)和 [smoke 检查](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/apps/desktop/scripts/smoke-runtime.ts)中适用的部分。具体导入与依赖闭包在实现中核对，不把 monorepo 私有脚本宣称为现成公共 API。上游版权与许可证随复用源码保留。

应用自身版本与 DSH 基线分别记录。保持当前 macOS arm64 预览交付和临时签名范围；官方签名身份、更新服务器及未使用的 Office/Python 功能不自动成为本轮依赖。

### 3. 保持浏览器行为并验收

保留 `Pages`、`ElectronBrowser`、`TaskController` 与 `deskworkBrowser` 服务，作为单一默认路径。升级后重跑双站点和同源双身份、确认失效、用户接手、停止、弹窗、结果待核对与重启回归。官方 Browser Use 的真实连接能力保留为实验，不将其全量工具直接加入网站任务。

未来若实际 ERP 的 iframe/复杂控件缺口需要更强操作能力，以本实验为起点，验证受控 Playwright 后端能否在相同 `BrowserAdapter` 与确认语义内替换底层，再决定删除相应 CDP 实现；本轮没有该实现或产品接入承诺。用户主动信任的可执行插件仍遵循 ADR-0006，宿主确认不等于限制插件自身的一切本地访问。

整轮结束运行 `npm run check`、构建和新版集成检查，提供一个实现 PR及可验证 arm64 包。真实模型、真实 ERP 与用户 Mac 分开验收；未执行项明确保留，不能用本次 Linux 合成实验代替。

## 本次结论边界

已验证真实 Electron、当前 Deskwork 页面、官方 DSH/npm 提供方与 MCP、受控模型工具链、登录分区与重启。没有验证真实模型质量、真实 ERP/SSO、用户 Mac、升级后 DMG、官方安装包的实际启动，或受控 Playwright 后端替换实现。桌面打包部分是源码审查形成的实施方案，尚不构成分发通过证据。
