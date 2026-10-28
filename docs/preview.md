# 使用 Deskwork

[English](preview.en.md) · [文档目录](README.md)

## 安装与模型

从 [Releases](https://github.com/GuoMonth/dsh-deskwork/releases) 下载 macOS Apple Silicon DMG 或 Linux x64 便携包，按[快速开始](../README.zh.md#下载)安装。macOS 使用临时签名；核对来源与 SHA-256 后，如被 Gatekeeper 拦截，按 [Apple 指引](https://support.apple.com/en-us/102445)允许打开。

首次启动为空工作台。点击「添加网站」，填写 URL；在「模型设置」中填写 DeepSeek 模型和 API 密钥，选择界面语言。密钥由系统安全存储保存，网站由你自行登录。

## 任务与确认

每个网站独立保存对话和浏览器身份。Copilot 并排显示页面与对话，Agent 展开对话并保留页面入口。同一时间运行一个自动任务，切换网站不会转移任务。

关键动作通过 DSH 原生审批。输入框可能自动保存，填写也可能需要确认。「停止并接手」或人工操作会暂停任务，继续前重新观察。提交结果不明时先核对页面，不自动重复提交。

原生 DSH 日志保留工具历史。重启后任务暂停，点击「重新观察并继续」才恢复；旧审批失效。「新建任务」开始新会话。日志丢失或旧版只有对话文本时，可查看原对话，但需新建任务。

## 插件

在「插件」中搜索 DSH 市场，或输入 npm 包名、GitHub Release 地址、本地 `file:/` 目录。核对来源后安装、绑定网站；更改影响任务的插件前先停止任务。插件是可信本地代码，可访问文件和网络。

ERP 使用当前网站与任务浏览器，配置和存储由插件管理。经验分享见 [ERP 指南](https://github.com/GuoMonth/dsh-erp/blob/60d82ea4763cdc4fab3f452c1b33c76ec24c5ea4/docs/native-and-sharing.md)。第三方开发使用 [Devkit](../packages/plugin-devkit/README.md)。

## 数据与限制

macOS 数据目录为 `~/Library/Application Support/dsh-deskwork`，升级保留网址和对话。重启后的登录取决于网站 Cookie 有效期；旧任务确认不会迁移为新授权。

普通 DOM 表单、链接、按钮和原生选择框有回归覆盖。跨域 iframe、封闭 Shadow DOM、Canvas、复杂控件、上传下载和通用 SSO 未完成验收，遇到时请接手。当前版本的确定性回归与安装验证见[发布说明](releases/0.2.3.md#中文)；真实模型业务任务和用户 macOS 验收待完成。

本地开发命令、夹具和验证方式见[参与开发](../CONTRIBUTING.md)。
