# DSH 0.2.0-rc.2 与桌面运行时对齐

日期：2026-10-01。用户已批准[研究方案](2026-10-01-official-desktop-research.md)，需求与验收在 [Issue #26](https://github.com/GuoMonth/dsh-deskwork/issues/26)，实现和研究共用 [PR #27](https://github.com/GuoMonth/dsh-deskwork/pull/27)。

## 版本与环境

应用 `0.2.0-alpha.2`，所有 DSH 依赖精确锁定 `0.2.0-rc.2`，lockfile 中 289 个 DSH 包条目无其他 DSH 版本。SDK/Devkit 与随包参考插件 `0.1.0-alpha.2`；Cordis peer 改为 `4.0.4`，group 对齐 `1.0.4`。Electron `44.0.0` 与 electron-builder `26.15.3` 保持官方基线；复用已验证的 pnpm `11.20.0`。Electron Node 模式实测 Node `24.18.1`、ABI `149`，应用版本、DSH 包版本和 SDK 握手协议版本 `0.0.1` 分别表达。

上游依据固定 [DSH tag](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2) 的提交 `639ed015397290b3745d163aafe02ffee4aa3f84`。复用 Node-mode 环境、SDK transport 接线、运行时清单和原生文件选择思路；所用源码保留 [MIT 声明](../../packaging/DSH-LICENSE)。没有引入官方完整 Web UI、私有桌面 SDK 或双浏览器默认路径。

本地：Linux x64、Node `24.21.0` / npm `11.19.0`，已授权 host 隔离，真实 Electron 使用 `--no-sandbox`，网站和模型为受控夹具。临时身份与子进程在实验结束释放。

## 三步实施结果

1. **运行时与开发接口**：移除 Chat Completions 配置，模型夹具改用 `/v1/messages` 与 Messages SSE，真实工具回合、系统提示和恢复上下文通过。保留官方 `sdk-minimal`、SDK server 与 transport，仅在宿主 SDK 入口拒绝未启用的选定提供方，阻止 upstream initialize 静默创建默认路由。非法自定义地址在启动前拒绝，错误不回显 URL 凭据。Devkit peer、模板和能力元数据使用本轮版本，仓库外 TGZ 安装与模板编译通过。
2. **桌面打包**：从同一 npm lockfile 安装生产依赖，物化为独立 `Resources/runtime`。ASAR 只放宿主、preload 与 UI；核心 JS、动态资源、目标原生模块和 pnpm 使用真实文件路径。electron-builder 不再收集根仓库依赖，避免两个核心树；显式复制 runtime 的 node_modules，保留未识别资源。清单记录版本、目标、锁文件摘要、文件 SHA-256/大小/权限。macOS 原生签名完成后重新封存最终字节，再签名外层应用，临时签名范围不变。用户插件、安装器 shim 与配置仅放在 userData。
3. **浏览器与插件**：保留现有宿主 CDP、任务目标与确认机制。源码和安装包测试覆盖独立网站/同源身份、确认失效、停止、写入待核对、退出重启、原生 Skill/插件、外部 MCP 开发连接。安装包从仓库外启动，PATH 不提供系统 Node/pnpm；标准插件 postinstall 真实执行并断言使用应用自身的 Electron Node 模式。测试后再次核对核心文件清单。

## 关键失败与回归

- Messages 夹具先在旧 Chat Completions 路由下失败，实际宿主工具调用为零；迁移后工具回合通过。
- 禁用选定 llm 插件时，原有 SDK 握手仍成功。新增负对照先报 `Missing expected rejection`；宿主入口检查后启动明确失败，不发起模型回合或创建默认路由。
- 仓库外 SDK 安装先因旧 Cordis `4.0.2` peer 冲突失败；对齐 `4.0.4` 后安装/编译通过，没有使用 force 或 legacy-peer-deps。
- 新协议把用户文本与工具结果放入 content blocks；旧夹具对 JSON 文本的直接匹配会错误重提已执行点击。改为读取块中的文本，提交失败后的待核对回归恢复。
- 打包首次发现依赖收集重复、资源根 node_modules 被默认排除，以及空 `.gitkeep` 标记被忽略。显式资源映射与 beforeBuild 外部依赖模式修复；ASAR 内没有核心 node_modules，完整清单一致。
- 空 PATH 的插件 postinstall 先因 pnpm 找不到 `sh` 失败。安装环境明确选用 `/bin/sh`，Node 仍来自私有 shim；这不要求用户安装系统 Node/pnpm，也不承诺任意第三方扩展的所有系统程序均随包提供。
- 清单回归拒绝错误架构、修改和删除原生文件；目标文件策略保留实际 target natives 与未知资产。

## 验证状态

- `npm run build`：通过。
- 源码集成：runtime、desktop、browser-boundary、plugin-runtime、plugin-desktop、development-desktop、plugin-devkit 均通过，10 项集成全部成功（约 11.4 秒）。
- Linux 安装目录：在仓库外、空 PATH 下的 8 项随包集成通过，验证实际 Node/native 加载、postinstall、核心树不变及退出重启。`npm run check` 格式、文档、严格类型、typed lint、单元回归全部通过。
- macOS arm64：[Desktop preview CI](https://github.com/GuoMonth/dsh-deskwork/actions/runs/36798587064) 在实现提交 `3edb4454b37102952a47b4ace3f53d74c0b9db94` 通过。源码 9 项集成；DMG verify/挂载、仓库外复制、`codesign --verify --deep --strict`、17,586 个运行时文件完整清单，以及空 PATH 下 8 项随包集成均通过；核对 Node `24.18.1` 与实际原生加载，测试后核心清单仍一致。预览包为应用 `0.2.0-alpha.2`，使用临时签名。
- [确定性 CI](https://github.com/GuoMonth/dsh-deskwork/actions/runs/36798587029)：格式、文档、类型、lint、单元测试和仓库外 Devkit 均通过。
- [arm64 DMG 工件](https://github.com/GuoMonth/dsh-deskwork/actions/runs/36798587064/artifacts/11134748159)：对应上述固定实现提交，工件保留 14 天。

## 范围与限制

受控 Messages 模型证明协议和宿主行为，不证明真实模型质量；本轮没有使用真实 API 密钥或真实 ERP 写入。用户 Mac、真实模型/ERP、样例市场收录继续按对应任务验收。本轮标准插件通过本地原生安装链路验证；既有市场目录与信任安装入口保留，不把本地样例当成市场收录证据。宿主确认覆盖宿主介导浏览器动作，继续遵循 ADR-0006 的可执行扩展信任范围。
