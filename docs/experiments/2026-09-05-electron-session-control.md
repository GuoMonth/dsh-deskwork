# H-001：首轮本地结果

日期：2026-09-05。假设：[H-001](../hypotheses/h001-electron-session-control.md)。源码提交：`9b1429e45adb59aa4089d45a87dac7a77a031761`。

本记录保留当时命令与隔离条件；当前开发政策见 [ADR-0002](../decisions/0002-ai-owned-development.md)。当前默认实验命令已改为 host 隔离，复现本记录需使用 `npm run experiment:electron-session:chromium` 并满足原记录的 helper 条件。

## 结论

在下述 Linux 环境、已配置 sandbox helper 和模拟 ERP 范围内，配置创建页面、会话共享/隔离、完整进程重启后的登录恢复以及 CDP 定向操作均通过。**未经准备的 npm Electron sandbox 在本机启动失败**，因此不支持「下载后直接在所有 Linux 桌面可用」的推断。

这支持继续验证 Browser Harness 接入 Electron；不等于 Electron + DSH + Browser Harness 三组件已集成。

## 环境与复现

- Linux x64，kernel `7.0.0-28-generic`，Node `24.18.0`，npm `11.19.0`。
- Electron `44.2.0`，实际 Chromium `152.0.7977.76`，依赖由锁文件固定。
- Xvfb 提供显示，真实 Electron 进程，模拟 ERP 监听随机 loopback 端口。
- 每次实验使用全新临时 profile；seed 与 restore 是两个先后退出/启动的进程，共用该 profile。
- 本机启用了 AppArmor 非特权 user namespace 限制。

命令：

```sh
npm ci
npm run experiment:prepare
npm run check
npm run experiment:electron-session
```

本次额外准备：默认 Node 下载器停滞，改用 curl 获取相同的官方 Electron release ZIP，并对照锁定 npm 包中的 `checksums.json` 校验 SHA-256 后解压。该包的 runtime 是显式准备/按需安装，不能把 `npm ci` 成功视为二进制已就绪。

原始 Electron sandbox helper 不具备 root/4755，启动报错并退出 133。设置 `CHROME_DEVEL_SANDBOX` 在本环境未生效。随后仅在本地依赖目录内，将 Electron 的 helper 替换为指向现有 `/opt/google/chrome/chrome-sandbox` 的符号链接；该系统文件为 root/4755，未修改系统文件、关闭 sandbox 或放宽主机策略。此兼容方式仅在本次版本组合上获得证据。

另一台机器需具备有效的 Chromium sandbox 环境，不能机械复制本机路径。手动 CI 在一次性 runner 中配置 Electron 自带 helper 的 owner/mode，这是另一种启动准备，尚不等同于本机复现结果。

## 预期与观察

| 判据                               | 观察                                                                  |
| ---------------------------------- | --------------------------------------------------------------------- |
| 配置创建三个页面目标               | 三个不同 WebContents ID，配置身份与顺序保留                           |
| 登录前均无身份                     | 受保护 API 状态 `[401, 401, 401]`                                     |
| 表单登录后同分区共享，另一分区隔离 | `[200, 200, 401]`                                                     |
| CDP 只操作指定页面                 | 点击计数 `[1, 0, 0]`                                                  |
| 完整退出后重新启动，不再次登录     | 初始 API 状态 `[200, 200, 401]`                                       |
| 业务页不直接暴露 Node              | 三个页面的 `typeof require/typeof process` 均为 `undefined/undefined` |

[机器可读观察及来源](evidence/2026-09-05-h001-supported.json)包含实际运行时版本、时间、源码身份、锁文件校验值和 sandbox helper 身份。此处的 Node 暴露检查不构成完整桌面安全审计。

## 测试有效性与失败记录

- 配置解析先以抛出未实现错误的 stub 运行测试：5 项中 4 项失败；完成校验后 5 项通过。红灯来自行为缺失，不是编译失败。
- 首次集成启动停在运行时下载，且旧超时仅结束 Xvfb 包装进程，未清理子进程。随后分离运行时准备与执行，改为有界进程组清理；此失败不用于推断 Electron 会话能力。
- 原始 sandbox 启动失败，适配后集成测试通过。
- 故意将第三个页面的分区改为 account-a，保留它应未登录的断言，实验按预期失败：实际 `[200, 200, 200]`，预期 `[200, 200, 401]`。恢复配置后再次通过。[负对照摘要](evidence/2026-09-05-h001-negative-control.json)
- agent-browser 独立检查模拟页面：内容和按钮可见，等待登录导航完成后 API 为 200，按钮计数为 1，无页面错误。该检查只证明夹具可交互，不作为 Electron 集成证据。
- `npm run check` 通过：格式、严格 TypeScript、typed lint、本地文档文件链接、5 项快速测试。真实 Electron 集成 1 项通过，无跳过。

## 未证明的事项与下一步

未覆盖真实账号登录、SSO/MFA、其他操作系统、崩溃恢复、凭据加密、业务写入、Browser Harness 或 DSH。未进行性能基准，也未证明自学习。

下一步 H-002：固定 Browser Harness 版本，验证它连接的确实是这些 Electron 页面，并测试目标发现、切换、弹窗和重连。H-003 再验证 DSH 的工具调用与生命周期；不提前固定产品模块架构。
