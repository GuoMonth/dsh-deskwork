# 实验记录

- [DSH 0.2.0 原生能力与经验分享](2026-10-01-dsh-020-native-experience.md)：Messages API、宿主 Browser Use、原生 Skill 与 ERP 制品联合验证。

- [DSH 0.2.0-rc.2 升级](2026-10-01-dsh-020-alignment.md)：Messages、提供方启用检查、自包含桌面运行时与新版回归。
- [通用工作台 MVP](2026-09-06-configurable-mvp.md)：配置式双站点、真实 DSH／Electron 工具链、确认与回读边界，真实模型和用户 Mac 待验收。

- [M1 集成验证](2026-09-05-m1-integration.md)：Browser Harness 范围、发布版 DSH 工具桥、真实 Electron 夹具闭环。

源码位于根目录 `experiments/`，与产品实现隔离。每份结果记录注明假设、日期、代码身份、工具版本、命令、观察与局限。后续结果追加记录，不覆盖旧结论。

| 日期                                                 | 假设  | 结果                                                                 |
| ---------------------------------------------------- | ----- | -------------------------------------------------------------------- |
| [2026-09-05](2026-09-05-electron-session-control.md) | H-001 | 原始 sandbox 启动失败；适配后会话/CDP 判据通过；隔离负对照按预期失败 |

- [AI 反馈成本与 host 隔离](2026-09-05-ai-feedback-loop.md)：同源码完整检查约快 59%，跨文件类型负对照有效；host 模式通过，chromium 模式失败未自动降级。

- [DSH 0.1.6-alpha.2 对齐](2026-09-19-dsh-016-alignment.md)：运行时、Electron 加载器与插件回归。

- [官方桌面端与浏览器复用调研](2026-10-01-official-desktop-research.md)：DSH 0.2.0-rc.2 的真实附加实验、协议迁移发现与升级方案。
