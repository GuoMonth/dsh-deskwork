# 使用 MVP 预览版

Alpha 预览版面向 macOS Apple Silicon，未签名／未公证。安装包及对应验证提交见 [GitHub Releases](https://github.com/GuoMonth/dsh-deskwork/releases)。旧版业务切片安装包不代表当前产品。

## 安装与配置

下载 Release 中的 macOS arm64 ZIP，解压后将 DSH Deskwork.app 放入 Applications。系统阻止打开未公证应用时，在「隐私与安全性」中允许打开已核对来源的预览包。

首次启动为空工作台。点击「添加网站」，填写网址，名称可选；添加几个就有几个固定标签。用户直接在原网站登录。点击「模型设置」，填写 DeepSeek 模型名称和 API 密钥；密钥由系统安全存储保存。

每个网站有独立对话与登录会话。Copilot 展示页面和对话，Agent 展开对话并保留「查看页面」。同一时间运行一个自动任务；切换标签不会把任务转移到另一个网站。

## 操作与核对

确认卡片展示即将执行的动作，能读取到前后值时显示差异。未经验证的输入框可能自动保存，因此填写也可能需要确认。点击「停止并接手」或直接在页面中使用键盘／鼠标，会暂停该网站的自动任务；恢复前重新观察。

工具执行成功不等于业务保存成功。有明确的预期正文结果时，宿主刷新页面回读；其他情况显示「结果待核对」。请重新打开或刷新结果页面后再选择核对结论，不要仅凭输入框的新值确认。结果不明时不会自动重复提交。

本轮主要支持普通 DOM 表单、链接、按钮、原生选择框和入口内的弹窗。跨域 iframe、封闭 Shadow DOM、canvas、复杂自定义控件、文件上传下载与通用 SSO 尚未验收，遇到这些情况请在页面中接手。网站若使用关闭即失效的会话 Cookie，重启后可能需要重新登录；已验证的是网站设置了有效期的持久 Cookie。

真实 DeepSeek 与已登录网站的只读链路已通过[功能冒烟](experiments/2026-09-08-desktop-smoke.md)；业务写入和用户 Mac 验收仍待完成，单次功能样本不能证明模型完成率。

## 本地开发与数据

按仓库固定 Node/npm 版本安装依赖，首次执行 `npm ci` 与 `npm run experiment:prepare`。

```sh
npm run dev             # 外壳交互预览，不连接网站或模型
npm run dev:desktop     # 真实桌面热更新，开发配置与正式用户数据分开
npm start               # 真实桌面；从空配置开始
npm run start:fixture   # 配置两个本地测试网站，模型仍需自行设置
npm run test:runtime    # 真实 DSH 进程与可控模型
npm run test:desktop    # 真实 DSH + Electron + 两个配置网站
npm run package:mac     # macOS arm64 ZIP
```

Linux 无显示环境时，桌面测试加 `xvfb-run -a`。夹具手工运行在已授权 host 隔离环境可使用 `npm run start:fixture -- --no-sandbox`。夹具配置与状态使用临时目录，不写入正常用户配置。

macOS 用户数据位于 `~/Library/Application Support/dsh-deskwork`。网址和对话自动保存；更新应用保留此目录。旧版网址与会话引用会先备份再迁移，旧任务确认、字段适配及技能文件进入 `archive/`，不自动执行。无需维护字段映射文件。

[森果配置样例](../examples/workspace.json)只用于测试或开发参考，产品不会自动导入。实验依据与限制见 [本轮验证](experiments/2026-09-06-configurable-mvp.md)。

开发环境可通过 `DESKWORK_DEVELOPMENT_API_KEY` 向宿主临时注入测试密钥；仅在未打包且启用本机开发外壳时读取，不保存到配置文件。正常客户端仍使用模型设置与系统安全存储。开发模式默认使用 `.artifacts/development-profile`，支持 `--profile-directory` 指定私有目录。
