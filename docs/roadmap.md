# 路线图

[English](roadmap.en.md) · [文档目录](README.md)

[0.2.3](releases/0.2.3.md#中文) 已发布：配置网站、原生会话恢复、任务审批和插件网站上下文可用，并已对齐 DSH 0.2.1-rc.3。实现证据见[本版验证](experiments/2026-10-28-dsh-021-alignment.md)，任务状态以 Issue 为准。

| 方向                                             | 当前进度                                   | 后续工作                                                                     |
| ------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| [网站工作台](specs/m1-configurable-workspace.md) | 配置式网站、独立对话、接手与恢复已交付     | [实机与业务验收 #6](https://github.com/GuoMonth/dsh-deskwork/issues/6)       |
| [DSH 插件](specs/m2-dsh-plugins.md)              | 安装、绑定网站、原生工具与审批可用         | [市场收录与用户反馈 #12](https://github.com/GuoMonth/dsh-deskwork/issues/12) |
| [开发套件](specs/m3-plugin-development-kit.md)   | SDK、Devkit、指南和外部 MCP 开发连接已交付 | [第三方独立开发闭环 #18](https://github.com/GuoMonth/dsh-deskwork/issues/18) |

SDK 和 Devkit 当前以 Release TGZ 分发，尚未发布到 npm。真实模型业务任务、用户 macOS 验收、签名公证和自动更新继续按需求推进，不因安装包已发布而视作完成。
