# DSH Deskwork

[English](./README.md) · [版本发布](https://github.com/GuoMonth/dsh-deskwork/releases)

登录业务系统，在同一浏览器会话里与 AI 协作。Deskwork 是基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的本地桌面工作台。Copilot 并排显示页面和对话；Agent 展开对话，保留当前任务。

当前版本 **0.2.2**，使用 **DSH 0.2.0-rc.2**（上游预发布版），ERP 集成使用 **0.1.1**。详见[发布说明](docs/releases/0.2.2.md#中文)。

## 下载

[macOS Apple Silicon](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-mac-arm64.dmg) · [Linux x64](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-linux-x64.tar.gz) · [校验值](https://github.com/GuoMonth/dsh-deskwork/releases/latest)

macOS 打开 DMG，将应用拖入 Applications；Linux 解压后运行 `./linux-unpacked/dsh-deskwork`。两种安装包都自带运行时和 pnpm。macOS 使用临时签名，Apple 公证待完成。

## 使用

1. 添加网站，自行登录，在**模型设置**中配置模型。也可在这里选择 **English** 或**中文**，默认英文。
2. 向 AI 说明目标。每个网站保留自己的对话和浏览器身份，同时运行一个自动任务。
3. 确认关键操作，在页面上核对结果；随时停止或接手。
4. 重启后重新观察页面并明确继续。旧确认失效，新建任务使用独立对话。

通过现有 DSH 市场安装可信本地插件。插件可执行代码、访问文件和网络。[ERP 插件](https://github.com/GuoMonth/dsh-erp/blob/main/docs/README.zh-CN.md)复用任务浏览器，可将经验导出为 Skill，由接收者复核后导入。

测试使用真实 DSH/Electron、确定性模型和合成网站。真实模型业务任务及用户 macOS 验收待完成。配置、数据和限制见[使用指南](docs/preview.md)。

## 开发

使用仓库固定的 Node、npm 版本：

```sh
npm ci
npm run experiment:prepare
npm run dev
```

`npm run dev` 打开界面预览，`npm start` 启动桌面应用。检查命令见[参与开发](CONTRIBUTING.md)，插件开发见 [Devkit](packages/plugin-devkit/README.md)。

[文档目录](docs/README.md) · [路线图](docs/roadmap.md) · [MIT](LICENSE)
