# ADR-0004：M1 桌面集成边界

状态：**产品工具范围已被 [ADR-0005](0005-configurable-workspace-scope.md) 部分替代。** 下文保留原决策与证据；其中三个资料工具、声明式字段适配和默认森果业务入口不再约束新的 M1。Electron、DSH 进程与打包路径继续有效，真实业务和分发结论受验收环境限制。

## 背景与证据

H-001 已证明范围内的 Electron 会话与 CDP 控制。新实验使用 Browser Harness 0.1.13、Electron 44.2.0，确认 Harness 可以发现和读取内嵌 ERP 页面，同时其目标列表也包含拥有宿主桥接能力的 Deskwork shell。它的原始 CDP/JS 工具不具备本项目要求的任务授权与确认边界。

DSH npm CLI 为 0.1.2-rc.1，SDK client npm 为旧的 0.0.1-rc.1，后者 peer 范围和 GitHub 当前代码不同。真实发布运行时已通过本地 JSON-RPC 握手、MCP 工具发现与可控模型工具调用实验。

## 选择

- Electron WebContentsView 持有业务会话，宿主通过自己的 WebContents 引用调用 CDP。产品不开放 remote-debugging 端口，不把 Harness 的通用工具集暴露给模型。
- Browser Harness 保留为独立实验候选。M1 使用同一浏览器适配边界下的 Electron CDP 实现，省去 Python 运行时和第二层 daemon 分发；不能把这一取舍解释为 Harness 无法控制 Electron。
- 固定 DSH CLI 与完整依赖锁，采用本地强类型 JSON-RPC 适配器，暂不混用旧 npm SDK client。协议输入按当前发布运行时验证，上游 SDK 同步后可替换适配层。
- 使用 `sdk-minimal` 专用 patch 关闭 shell/editor 工具。通过私有本地 MCP 桥只提供页面观察、资料读取、变更提议；实际保存由宿主确认路径执行。
- DSH 独立进程使用 Electron 自带 Node，通过 `ELECTRON_RUN_AS_NODE` 启动；运行时和桥接文件放在发行包解包资源中，用户无需安装 Node/Python。
- 停止先撤销任务工具与运行时连接凭据，再终止进程。恢复使用同一业务目标并重新观察，不能把旧确认重放。
- 实测相同 SDK session ID 在进程重启后未将旧消息重新送入模型。Deskwork 从自己的持久对话提供有界恢复上下文，每个运行时使用独立 wire session，避免错误依赖上游 ID 的恢复语义；不承诺恢复模型内部推理状态。

## 后果与限制

M1 只允许经过现场验证的声明式字段适配，不向模型开放任意脚本写入。默认森果入口可登录和观察；真实字段适配仍待登录后勘察。

全量 DSH 发布包包含未启用的功能及依赖，增加体积；先验证安装包自包含性，再依据体积与启动数据决定裁剪，避免手工遗漏动态插件。生产默认 Chromium sandbox；Linux 夹具明确使用用户已授权的 host 隔离。

实验命令和结论见 [M1 证据](../experiments/2026-09-05-m1-integration.md)。这份决策不证明真实 DeepSeek API、森果业务或用户 Mac 已通过验收。
