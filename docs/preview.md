# 使用 Deskwork

下载和平台要求见 [README](../README.zh.md#下载)，精确版本、校验值和验证范围见[最新 Release](https://github.com/GuoMonth/dsh-deskwork/releases/latest)。

## 安装与配置

macOS 打开 DMG，将应用拖入 Applications 后启动。若系统拦截，在核对来源和 SHA-256 后，按 [Apple 指引](https://support.apple.com/en-us/102445)从「隐私与安全性」允许打开。若仍提示已损坏，记录提示和 macOS 版本以便排查。

Linux 解压便携包，运行 `./linux-unpacked/dsh-deskwork`。

首次启动点击「添加网站」，填写网址，名称可选。每个网站形成一个固定标签，直接在原页面登录。打开「模型设置」，填写 DeepSeek 模型名称和 API 密钥；密钥使用系统安全存储。语言可选 English 或中文，默认 English。

## 任务、确认与恢复

每个网站有独立登录和对话。Copilot 并排显示页面与对话；Agent 展开对话，保留「查看页面」。同一时间运行一个自动任务，切换标签不会改变它的目标。

关键操作会请求确认。填写、选择和按键也可能触发自动保存，不能仅凭按钮名称判断是否只读。点击「停止并接手」或在页面中操作键鼠会暂停自动任务；恢复前重新观察。

重启后任务保持暂停，点击「重新观察并继续」才恢复，旧确认失效。「新建任务」归档原对话并创建独立会话。原生会话日志丢失时，仍可查看聊天，但需要新建任务。

工具返回成功后，仍需核对网站结果。能按已确认的预期正文回读时，宿主刷新页面检查；其余情况显示「结果待核对」。请求已发出但结果不明时，先观察，不自动重复提交。

## 安装插件

在左侧「插件」搜索社区市场，或填写 npm 包名、GitHub Release 插件地址。核对来源并信任后安装；已安装插件可命名、绑定网站、更新或卸载。影响当前任务的变更需先停止任务。更新失败会保留原安装。

开发插件可从标准 `file:/` 目录安装；外部 AI 调试见 [Devkit](../packages/plugin-devkit/README.md)。

## 本地数据与限制

macOS 用户数据位于 `~/Library/Application Support/dsh-deskwork`。更新应用保留网址、对话及登录资料。网站的会话 Cookie 若随关闭失效，重启后仍需登录。旧配置迁移前会备份，旧动作不会自动执行。

当前回归覆盖普通 DOM 表单、链接、按钮、原生选择框和入口内弹窗。跨域 iframe、封闭 Shadow DOM、canvas、复杂控件、文件传输和通用 SSO 尚未验收，遇到缺口可在页面中接手。真实模型业务任务和用户 Mac 验收见 Release 中的待办。

## 本地开发

依赖准备与检查见[贡献指南](../CONTRIBUTING.md)。常用运行命令：

```sh
npm run dev             # 界面预览
npm run dev:desktop     # 桌面热更新
npm start               # 桌面应用
npm run start:fixture   # 两个本地测试网站
```

Linux 无显示环境时使用 `xvfb-run -a`。已授权的隔离开发账号可运行 `npm run start:fixture -- --no-sandbox`，记录隔离模式。测试配置使用临时目录。

开发模式默认使用 `.artifacts/development-profile`，可用 `--profile-directory` 指定私有目录。`DESKWORK_DEVELOPMENT_API_KEY` 仅供未打包开发外壳临时读取，不写入配置；正常客户端使用模型设置。
