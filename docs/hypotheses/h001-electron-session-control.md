# H-001：Electron 会话与页面控制

状态：会话/CDP 在已记录环境内支持；隔离模式分开记录。候选技术：Electron 44.2.0。来源：固定 ERP 工作台设计。

## 假设

同一个 Electron 应用可以从配置创建多个 WebContentsView；同分区复用登录，不同分区隔离。持久化会话在真实进程退出后恢复，CDP 操作仅作用于指定页面。

## 预先定义的判据

1. 配置生成三个独立页面目标：两个使用账户 A 的同一持久化分区，一个使用账户 B 分区。
2. 初始均未登录；在第一个页面通过表单向模拟 ERP 登录后，第一个与第二个页面的受保护 API 返回 200，第三个仍为 401。
3. 使用 CDP 点击第一个页面按钮，只有该页面计数增加；其他目标计数不变。
4. 完整退出 Electron 后，以相同配置/profile 启动第二个进程，不再次登录，同分区 API 仍为 200，另一分区仍为 401。
5. ERP 页面不能访问 Node 的 `require` 或 `process`；保持 contextIsolation，禁用 nodeIntegration；报告实际实验隔离模式。

任一断言失败则本次实验失败；不能通过另开普通 Chrome 替代 Electron。允许在已隔离宿主上关闭嵌套 Chromium sandbox，必须记录模式且不外推安全结论。旧 Chromium 模式结果保留，政策变更见 [ADR-0002](../decisions/0002-ai-owned-development.md)。

## 范围

仅测试本机 Linux、模拟 HTTP ERP、持久化 Cookie 与 Electron 原生 CDP。未覆盖 Browser Harness、DSH、真实 SSO/MFA、操作系统密钥保护、崩溃恢复、Windows/macOS 或产品标签栏 UI。

实验入口：`npm run experiment:electron-session`。测试契约先于实验实现编写；结果见 [2026-09-05 实验记录](../experiments/2026-09-05-electron-session-control.md)。

## 设计线索

[WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)、[session](https://www.electronjs.org/docs/latest/api/session)、[Debugger](https://www.electronjs.org/docs/latest/api/debugger)。这些是待实测接口说明，不是本假设的验证结果。

补充：[host 隔离与检查成本验证](../experiments/2026-09-05-ai-feedback-loop.md)，与首轮 Chromium 模式证据分别保留。
