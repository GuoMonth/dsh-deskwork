# Deskwork 视觉与交互原则

状态：M1 基线。品牌语义为「清晰、可信、高效，少一些操作、多一些完成」。颜色和尺寸的事实来源是 `src/ui/design-tokens.ts`，组件和可交互预览表达实现；本文只维护原则和取舍。

## 参考与取舍

[Fluent 语义 Token](https://fluent2.microsoft.design/design-tokens)提供主要方法：基础值到语义角色，再由组件消费。以浅冷灰、白色内容面、蓝色主操作与青色 AI 状态建立 Deskwork 品牌。

[SAP 企业设计](https://www.sap.com/design/design-system)提供角色、业务状态、简单一致的原则；[Oracle Design](https://design.oracle.com/)作为企业任务体验的辅助参考。保持适度信息密度，让业务对象、变更与结果比装饰更醒目。

采用 [VS Code 工作台](https://code.visualstudio.com/docs/editing/getting-started/userinterface)的区域分工：工作区导航、业务标签、辅助对话与命令入口。Copilot 和 Agent 是同一工作的两种视图。森果等第三方业务页面保留原样，统一设计覆盖 Deskwork 自有外壳。

## 一致性约束

- 组件消费语义 CSS 变量，Token 从类型明确的源文件生成；不能再维护另一份人工主题数值表。
- 业务状态同时使用文本与视觉标记。会话与任务目标始终可见，提交前展示对象和具体差异。
- 进度呈现可验证的业务步骤。常用操作直接可见，工具细节按需展开。
- 科技感通过及时反馈和减少操作体现。轻量动效支持减少动态效果，不能妨碍阅读或业务输入。
- 保留 macOS 原生窗口控制。面板可调、侧栏可折叠，模式切换保留上下文；支持键盘操作与可见焦点。
- 交互预览明确标注合成数据。预览页面不能冒充真实 ERP；错误和等待状态也是设计验收的一部分。

运行 `npm run dev` 可检查预览；产品和预览复用同一组件。M1 首先实现浅色，深色与高对比主题后续按同一语义层扩展。
