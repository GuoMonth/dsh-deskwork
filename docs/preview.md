# 现有预览与限制

**现有安装包属于纠偏前的技术预览，不是新版 M1 的验收交付。** 当前代码仍默认打开森果，配置入口仍需修改文件，UI 与工具含商品流程耦合。新目标是空状态添加网址、固定标签和通用浏览器操作，见 [M1 审阅稿](specs/m1-configurable-workspace.md)。本页仅帮助核对旧版本的实际能力，不要求用户为森果准备商品适配。

## 启动

从 PR 的 macOS artifact 下载 arm64 ZIP，解压后把 DSH Deskwork.app 放入 Applications。当前包尚未签名公证，macOS 可能要求在系统设置的「隐私与安全性」中允许打开该应用。只对本项目已核对来源的预览包使用该操作。

打开「设置与连接」，填写你使用的 DeepSeek 模型名称与 API 密钥。密钥保存在本机系统安全存储，网页会话由 Electron 独立持久化；默认模型名称可按账号实际可用模型调整。

## 本地开发与验证

使用仓库固定的 Node/npm 版本，首次运行 `npm ci` 和 `npm run experiment:prepare`。

```sh
npm run dev              # 仅交互预览，合成数据，不输入真实密钥
npm start                # 真实桌面与森果入口
npm run start:fixture    # 本地 ERP，仍使用真实 DSH
npm run test:runtime     # 真实 DSH + 可控模型
npm run test:desktop     # 真 Electron + 合成 ERP + 确定性任务驱动
npm run package:mac      # macOS arm64 ZIP
```

Linux 无显示环境时，桌面测试加 `xvfb-run -a`。手工运行夹具可在已授权 host 隔离环境使用 `npm run build` 后执行 `electron . --fixture --fixture-agent --no-sandbox`，其中 `--fixture-agent` 仅用于确定性演示，不是 DSH 模型。

## 配置入口

macOS 用户数据位于 `~/Library/Application Support/dsh-deskwork`。`workspace.json` 描述固定站点与会话；样例见 [启动配置](../examples/workspace.json)。旧配置中同一 `sessionId` 共享登录，不同值隔离身份。这是当前实现说明；新 M1 将由宿主生成并管理会话，用户只需填写网址和可选名称。样例中的森果不应成为产品默认身份。

当前旧实现的资料工具依赖 `record-profiles.json`。这属于待移除的产品前置依赖，不是新版接入网站的配置步骤；没有映射的网页目前只能登录与观察。后续由通用浏览器工具替换，不继续开发森果专属字段适配。

`task.json`、`skills.json` 与 `runtime/` 位于同一用户数据目录，包含任务和业务数据，不应提交仓库。替换应用保留此目录；备份时退出客户端后整体复制。真正的跨版本迁移仍需单独验收。

停止后如提示「结果待核对」，回到原店铺核对保存是否生效，再点击继续核对。不要因为没有收到响应就再次保存。登录过期时直接在业务页面重新登录。
