# rc.2 原生能力收敛

日期：2026-10-10。需求：[Issue #31](https://github.com/GuoMonth/dsh-deskwork/issues/31)。官方依据固定为 `dsh-v0.2.0-rc.2`，提交 `639ed015397290b3745d163aafe02ffee4aa3f84`。本地验证环境 Linux x64、Node 24.21.0、Electron 44.0.0；Electron 夹具使用 host-isolated 模式及容器内 `--no-sandbox`，页面和模型数据均为生成数据。

## 选择与边界

DSH 负责 Agent、Session、工具历史、approval 审计与 Skill。官方 rc.2 JSON-RPC 尚无恢复方法，因此保留官方传输和事件服务，用公开 `ctx.agents.resume()` 添加很薄的原生会话入口。每入口持久化 native Session ID，普通续聊保留日志，新任务创建新 ID。重启与停止后必须明确继续；缺失日志不以聊天文字替代。

内置浏览器工具在原函数栈中通过 DSH approval 等待决定。允许一次后，Deskwork 仍重新观察并核对 revision，先持久化动作意图，再执行；停止、迟到回答、拒绝与失效确认不能继续写入。已提交且尚未核对的动作禁止再提议。外部开发 MCP 保留结构化暂停，不能替代用户确认。

插件安装状态与 Loader 实际加载状态分开，读取公开 Loader entry/fiber，失败更新回滚原安装。宿主提供通用网站上下文，删除 ERP 包名分支；业务配置由 ERP 消费方推导。消费方在 Deskwork 等待已有浏览器服务，独立 DSH 继续使用其原生提供方逻辑。

采用固定官方桌面实现的登录 shell 读取，保护启动器变量并保留代理与 PATH，限时失败后回退。官方 `MarkdownText`、`Button`、`StateDot` 使用既有语义 token；Markdown 提供表格、代码和双语复制标签。官方发布的 UI 聚合入口缺少声明其构建所需的运行依赖，渲染构建依赖按该固定版本 lockfile 显式固定，随 Vite 编译进 UI；没有将 UI 包加入桌面 DSH 生产依赖树。

## 验证

- 原生日志 red → green：重启后模型请求仍包含结构化 tool_result 和工具结果中的独立 token；此前仅重放对话文字会丢失该 token。同进程后续对话保持原历史。缺失原生日志、禁用模型提供方和无效 Messages URL 拒绝运行。
- 原生审批：任意插件工具的允许、拒绝、取消、不可用和停止后迟到回答；每次 asked/decided 恰好一次，仅允许时执行一次。标准插件 SDK 的原函数栈在审批后继续观察，另有真实 Electron MCP 卡片确认闭环。
- 桌面双网站：确认、写入回读、身份隔离、持久 Cookie、重启暂停、旧确认失效、明确继续保留原生 ID、新任务清空会话引用、失败保存不重提、切换入口不转移任务、人工接手和身份失效撤销确认。
- 插件：两种页面结构的查询、实际 loaded 状态、启动失败更新回滚旧安装、挂载与卸载。双语与官方 Markdown 的标题、表格、代码、复制标签及 HTML 作为文本的行为已验证。
- SDK/Devkit：alpha.3 候选包在仓库外安装、读取同源指南、生成插件、类型检查和打包。此验证不等于市场认证或所有业务页面调试成功。

跨仓库提供方为 Deskwork 通用上下文，消费方为 ERP 提交 `d1a18feaaa334b0c70f2e960ed9a59525d228a2d`（候选 0.1.1）。消费方 `npm run verify` 包含类型、84 个行为测试、包外制品冒烟及真实 DSH CLI。联合测试为 `DESKWORK_ERP_TARBALL=<固定候选包> node --test tests/native-erp.integration.ts`，验证宿主浏览器复用、知识范围、原生导入审批、另一用户的 Skill 分享与重启。PR 中记录最终提供方提交、候选制品 SHA-256 和联合组合；先合并消费方，再合并宿主。

最终检查及 macOS arm64 DMG 安装结果以关联 PR 的 CI 为准。macOS 工作流固定上述 ERP 消费方源码，在源代码与随包环境分别联合验证。npm 与桌面公开 Release 不由这次 PR 合并自动发布。用户 Mac 的 Gatekeeper、真实模型效果与业务写入仍按原验收范围另行验证。
