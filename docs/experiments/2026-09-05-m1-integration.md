# M1 集成验证 · 2026-09-05

源码身份：本记录所在提交的 `src/`、`tests/` 与 `experiments/browser-harness-electron.integration.ts`；依赖以该提交的 package-lock 为准。

环境：Linux x64，Node 24.18.0、Electron 44.2.0、DSH CLI 0.1.2-rc.1。桌面测试在 Xvfb 中显式使用 `--no-sandbox`，范围为本地合成 ERP。产品保持默认 sandbox。

| 验证                  | 命令                                                                          | 已观察结果                                                         | 限制                                           |
| --------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| Browser Harness H-002 | `xvfb-run -a node --test experiments/browser-harness-electron.integration.ts` | 0.1.13 可发现并读取 Electron ERP；同时暴露 shell 目标              | 未验证通用弹窗、重连和 macOS；产品采用宿主 CDP |
| DSH H-003             | `npm run test:runtime`                                                        | 真实发布进程握手、三个 MCP 工具发现、模型请求和工具回传、退出      | 模型为本地可控响应，无真实 API 密钥            |
| 桌面业务切片          | `xvfb-run -a npm run test:desktop`                                            | 手动登录、确认前零写入、Agent 切换、保存、服务端回读、页面无宿主桥 | 本地 ERP 夹具，不代表森果真实页面              |
| 任务边界              | `node --test tests/task-controller.test.ts tests/tool-server.test.ts`         | 身份变化使确认失效、响应丢失只核对、停止撤销确认和工具凭据         | 确定性回归                                     |
| 技能 H-005 的子集     | `node --test tests/skill-ledger.test.ts`                                      | 持久记录可复用，身份/字段/版本变化使记录不适用                     | 手写技能复用，不证明自主学习或实测加速         |

行为开发：先定义确认与副作用回归，再实现状态控制。桌面闭环首次运行在业务断言全部通过后因截图采集方式失败；改用 Electron capturePage 返回图像字节后通过。保留截图采集错误与业务错误的区别。

原始本地证据：`.artifacts/runtime/events.json`、`.artifacts/browser-harness/result.json`、`.artifacts/desktop/`。只使用合成数据，真实凭据不进入这些工件。

尚未验证：真实森果店铺与商品字段、真实模型质量/耗时、用户 Mac 安装与登录、页面长期稳定性和自动进化。macOS CI 与安装包结果在 PR 中附对应运行链接，未通过前不标记 M1 完成。

恢复负例：DSH 同 ID 重启的历史断言失败；改用宿主保存并显式提供的恢复上下文后通过。另有保存失败但输入框已更新的负例，要求回读服务端而不是读取本地表单值。桌面测试使用 URL 精确识别 shell 和业务页面，避免依赖不确定的窗口创建顺序。

macOS 首轮证据：[arm64 CI 33972961722](https://github.com/GuoMonth/dsh-deskwork/actions/runs/33972961722)，提交 `10d2690`。源码测试、ZIP 打包和 `verify-package.ts` 均通过；后者直接运行发行包内的客户端及 DSH CLI。Linux 打包目录也通过相同检查。测试验证包括重启保留 cookie、业务结果与技能复用，末尾恢复合成商品原值。CI 模型仍为合成响应，不是用户 Mac 或真实业务验收。
