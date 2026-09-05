# AI 开发反馈成本与宿主隔离实验

日期：2026-09-05。源码：`848c895`。决策：[ADR-0002](../decisions/0002-ai-owned-development.md)。主要读者：维护该工作流的 AI；表格与结论供人审核。

## 结论

在同一份源码上，本机完整检查中位耗时从串行 2.573 秒降至并行温缓存 1.058 秒，约减少 59%；成功输出减少约 85%。大部分收益来自减少进程启动和并行执行，即便无缓存并行也只需 1.162 秒。无需更换已兼容的编译器和运行时。

H-001 在 host 隔离模式下通过，不再需要上轮 root/4755 helper 适配。该模式只关闭嵌套 Chromium sandbox，未改变被测会话分区、contextIsolation 或禁用 Node 集成的条件。

## 测量方法与观察

Linux x64、Node 24.18.0，同一源码、同一锁文件。每组顺序运行 3 次，温缓存组预热一次；未在测量期间并行进行其他工具操作。样本包含 npm 命令启动到结束的墙钟时间。没有测量峰值内存、其他操作系统或大型仓库。

| 入口                | 检查范围         | 中位耗时 | 成功输出中位字节数 |
| ------------------- | ---------------- | -------- | ------------------ |
| 原五项 npm 命令串行 | 完整             | 2573 ms  | 1370               |
| `check:fresh`       | 完整，无缓存     | 1162 ms  | 228                |
| `check`             | 完整，温缓存     | 1058 ms  | 211                |
| `check:docs`        | 仅格式与文档链接 | 159 ms   | 163                |

文档入口检查范围更小，不把它与完整检查比较成同等覆盖率的加速。[原始样本](evidence/2026-09-05-check-performance.json)

## 正确性反例

工具执行与模式解析的 4 项新增测试先失败、实现后通过；快速测试总数为 9。执行器保留失败退出和 stdout/stderr，参数中的空格与 shell 字符不会被解释执行。

先建立调用方 `readName().trim()` 并让检查通过，再只将被引用函数的返回类型从 string 改成 number。温缓存检查的 TypeScript 和 typed lint 均失败，调用方文件未修改；恢复后通过。[失效验证](evidence/2026-09-05-check-invalidation.json)

这证明本次跨文件类型变更被捕获，不代表所有未来插件或工具缓存都已验证。typed lint 仍不缓存结果；CI 使用完整无缓存入口。

## 两种隔离模式

先撤销上轮 Electron helper 符号链接，恢复下载包内的普通权限文件，再执行：

```sh
npm run experiment:electron-session:chromium
npm run experiment:electron-session
```

chromium 模式按真实环境失败：本机原始 helper 不是 root/4755，且没有静默回退。host 模式通过：两次真实 Electron 进程验证会话共享/隔离、重启恢复和 CDP 定向操作。报告中 `isolation=host`、`chromiumSandboxDisabled=true`，页面 Node 暴露检查仍通过。

[Host 模式观察](evidence/2026-09-05-h001-host-isolation.json) · [Chromium 模式失败摘要](evidence/2026-09-05-h001-chromium-mode.json)

本机外层隔离由项目发起人确认，此实验不检验外层隔离本身，也不证明产品发布时的 sandbox/真实 ERP/DSH/Browser Harness 能力。旧 Chromium 模式证据保留在[首轮记录](2026-09-05-electron-session-control.md)。
