# DSH Deskwork

[English](./README.md) | 中文

**登录你的业务系统，让 AI 帮你把事办完。**

DSH Deskwork 是基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的本地桌面工作台。添加网址、照常登录，就能让 AI 在同一浏览器会话中协助工作。Copilot 将页面与对话并排显示；Agent 展开对话，保留相同任务和浏览器身份。

## 下载

[macOS Apple Silicon](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-mac-arm64.dmg) · [Linux x64 便携包](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-linux-x64.tar.gz) · [发布说明与校验值](https://github.com/GuoMonth/dsh-deskwork/releases/latest)

打开 macOS DMG，将应用拖入 Applications。解压 Linux 便携包后运行 `./linux-unpacked/dsh-deskwork`。macOS 应用目前使用临时签名，尚未配置 Developer ID 签名和 Apple 公证。

应用默认使用 **English**。在 **模型设置 → 语言**中选择 **English** 或 **中文**。选择保存在本机，重启后恢复；后续模型任务使用所选语言。网站内容、名称和已有对话保留原文。

运行时精确锁定 **DSH `0.2.0-rc.2`**（上游预发布）及 Electron **`44.0.0`**。桌面包包含独立运行时、Node-mode 和 pnpm。验证使用真实 DSH、Electron、确定性模型和合成网站；真实模型业务任务及用户 macOS 实机验收仍待完成。

## 使用网站

- 从空工作台添加网址，每个入口保留独立对话和持久浏览器身份。
- 在原网站手动登录，向 AI 说明目标、观察过程，必要时停止或接手。
- 执行关键操作前审阅确认，重新打开或刷新结果页面，核对变更是否保存。
- 通过现有 DSH 插件市场安装可信本地扩展。扩展可以在本机执行代码、访问文件和网络。

## 复用 ERP 经验

插件安装来源填入 `@guosheng_047/dsh-erp@latest`，安装我们发布的最新 [ERP 包](https://www.npmjs.com/package/@guosheng_047/dsh-erp)。使用 `@guosheng_047/dsh-erp@0.1.0` 可复现已发布的固定组合。

ERP 通过原生 Browser Use 复用任务浏览器，并复用原生工具、审批、附件、Session 和 Skill。Computer Use 由 ERP 插件显式启用官方 Cua Driver Native。

通过对话中的一次工具调用导出、导入经验。导出目录包含标准 `SKILL.md` 与 `references/knowledge.json`，另一用户可以导入并通过 DSH Skill 复用。导入知识绑定接收方 ERP 范围，并标为待复核。分享排除结构化身份、原始证据和业务样本；分享前仍需检查自由文本。

## 开发

使用仓库固定的 Node 24 与 npm 11 版本：

```sh
npm ci
npm run experiment:prepare
npm run dev
```

`npm run dev` 打开合成交互预览；`npm start` 启动桌面应用；`npm run check` 执行标准检查；`npm run test:devkit` 验证仓库外 SDK/Devkit 消费。公开测试使用生成数据和保留示例域名，私有集成输入保存在仓库外。

[预览指南](./docs/preview.md) · [贡献指南](./CONTRIBUTING.md) · [文档导航](./docs/README.md) · [产品规格](./docs/specs/m1-configurable-workspace.md) · [运行时验证](./docs/experiments/2026-10-01-dsh-020-native-experience.md)

公开 README 配对和双语发布说明遵循[上游文档约定](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/i18n/README.md)：英文源文档、`.zh.md` 中文对应文档、语言互链，以及要求两侧同步更新的检查。发布说明包含互链的英文和中文章节；见[发布编写约定](./docs/releases/README.md)。

## 许可

[MIT](./LICENSE)。第三方运行时依赖保留各自的许可证。
