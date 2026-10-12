# DSH Deskwork

[English](./README.md) | 中文

添加网站，照常登录，让 AI 帮你处理工作。Deskwork 是基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的本地桌面应用。Copilot 将页面与对话并排显示；Agent 在同一任务中展开对话。

## 下载

[macOS Apple Silicon](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-mac-arm64.dmg) · [Linux x64](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-linux-x64.tar.gz) · [发布说明与校验值](https://github.com/GuoMonth/dsh-deskwork/releases/latest)

macOS 打开 DMG，将应用拖入 Applications。Linux 解压后运行 `./linux-unpacked/dsh-deskwork`。两种安装包都自带运行时。macOS 仅支持 arm64，使用临时签名，尚未完成 Apple 公证。

## 开始使用

1. 添加网站，在页面中登录。
2. 打开**模型设置**，填写模型和 API 密钥，选择 English 或中文。默认语言为 English。
3. 说明任务，执行关键操作前审阅确认；随时可以停止并接手。
4. 到网站上核对结果。

每个网站保留独立登录和对话，同一时间运行一个自动任务。重启后先观察页面，再继续暂停的任务；旧确认失效。

安装、恢复和本地数据见[使用指南](docs/preview.md)。安装包测试使用合成网站和确定性模型，真实模型业务任务及用户 Mac 验收仍待完成。随包 DSH 仍为上游预发布版本，精确版本和检查结果见发布说明。

## 插件

通过 DSH 插件市场安装可信扩展。本地插件可以执行代码、访问文件和网络。

[Adapt ERP](https://github.com/GuoMonth/dsh-erp) 从 ERP 页面学习，将知识保存在本机。在 Deskwork 中，它复用当前任务浏览器；经验导出和导入按其指南操作。

插件作者从 [Devkit](packages/plugin-devkit/README.md) 开始。SDK 和 Devkit 的 TGZ 包在 Releases 下载，npm 包名尚未发布。

## 开发

使用仓库固定的 Node 24 和 npm 11：

```sh
npm ci
npm run experiment:prepare
npm run dev
```

`npm run dev` 打开界面预览；`npm start` 启动桌面应用。检查和打包命令见[贡献指南](CONTRIBUTING.md)。业务数据和凭据保存在仓库外。

[文档导航](docs/README.md) · [产品规格](docs/specs/m1-configurable-workspace.md)

## 许可

[MIT](LICENSE)。第三方依赖保留各自的许可证。
