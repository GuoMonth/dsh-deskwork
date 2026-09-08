# 使用 MVP 预览版

Alpha 预览版面向 macOS Apple Silicon，使用临时签名（ad-hoc），没有 Developer ID 签名和 Apple 公证。安装包及对应验证提交见 [GitHub Releases](https://github.com/GuoMonth/dsh-deskwork/releases)。旧版业务切片安装包不代表当前产品。

## 安装与配置

下载 Release 中的 macOS arm64 DMG，打开后将 DSH Deskwork.app 拖入 Applications，再从 Applications 启动。

DMG 提供拖放安装；临时签名用于校验应用包完整性，不能替代 Apple 对开发者身份的验证。首次打开仍可能受到 Gatekeeper 拦截。在核对下载来源和 Release 中的 SHA-256 后，可按 [Apple 指引](https://support.apple.com/en-us/102445)在「隐私与安全性」中允许打开。若提示「已损坏」且无法允许打开，请保留提示与 macOS 版本用于定位，不代表已证明文件损坏或仅缺少签名。

面向正常分发、减少未验证开发者／未公证拦截，需要 Developer ID Application 证书及 Apple 公证；本 Alpha 尚未具备。CI 验证 DMG 挂载、复制后的签名完整性与应用启动，不等于用户 Mac 上 Gatekeeper 放行。

首次启动为空工作台。点击「添加网站」，填写网址，名称可选；添加几个就有几个固定标签。用户直接在原网站登录。点击「模型设置」，填写 DeepSeek 模型名称和 API 密钥；密钥由系统安全存储保存。

每个网站有独立对话与登录会话。Copilot 展示页面和对话，Agent 展开对话并保留「查看页面」。同一时间运行一个自动任务；切换标签不会把任务转移到另一个网站。

## M2 插件预览

在左侧「插件」中搜索 DSH 社区市场，或填入 npm 包名／GitHub Release 插件地址。核对来源并主动信任后安装。已安装插件可修改唯一挂载名、绑定网站、取消挂载、更新或卸载；影响任务的变更前先停止任务。开发时也可安装标准 `file:/` 插件目录，无 ZIP 资产导入。

插件是本地可执行代码。经过 Deskwork 浏览器接口的写入仍需确认；插件自身的文件和网络访问属于安装信任范围。开源预览不承诺兼容性，安装或加载失败会显示错误并保留旧版本。首个样例是[森果收支查询插件](../plugins/senguo-query/README.md)，可从[插件 Release](https://github.com/GuoMonth/dsh-deskwork/releases/tag/senguo-query-v0.1.0-alpha.1)复制 `.tgz` 资产下载地址安装。[M2 PR #14](https://github.com/GuoMonth/dsh-deskwork/pull/14)记录市场收录状态，收录前使用公开下载地址。

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
npm run package:mac     # macOS arm64 DMG
```

Linux 无显示环境时，桌面测试加 `xvfb-run -a`。夹具手工运行在已授权 host 隔离环境可使用 `npm run start:fixture -- --no-sandbox`。夹具配置与状态使用临时目录，不写入正常用户配置。

macOS 用户数据位于 `~/Library/Application Support/dsh-deskwork`。网址和对话自动保存；更新应用保留此目录。旧版网址与会话引用会先备份再迁移，旧任务确认、字段适配及技能文件进入 `archive/`，不自动执行。无需维护字段映射文件。

[森果配置样例](../examples/workspace.json)只用于测试或开发参考，产品不会自动导入。实验依据与限制见 [本轮验证](experiments/2026-09-06-configurable-mvp.md)。

开发环境可通过 `DESKWORK_DEVELOPMENT_API_KEY` 向宿主临时注入测试密钥；仅在未打包且启用本机开发外壳时读取，不保存到配置文件。正常客户端仍使用模型设置与系统安全存储。开发模式默认使用 `.artifacts/development-profile`，支持 `--profile-directory` 指定私有目录。
