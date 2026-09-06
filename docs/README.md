# 文档导航

M1 范围纠偏待审阅；现有代码尚未对齐。入口：[规格](specs/m1-configurable-workspace.md)、[视觉与交互](design/visual-system.md)、[现有预览限制](preview.md)、[历史集成证据](experiments/2026-09-05-m1-integration.md)、[范围决策](decisions/0005-configurable-workspace-scope.md)、[执行计划](roadmap.md)。

大部分文档面向 AI 执行与按需检索；人主要阅读产品规格、架构选择与结论。文档记录「为什么、约束、选择和证据」；类型、命名、实现与测试表达「现在如何工作」。不维护逐函数解释或已实现功能的平行文档。

| 目录                                  | 内容                         | 更新时机             |
| ------------------------------------- | ---------------------------- | -------------------- |
| [principles](principles/product.md)   | 产品与工程的长期原则         | 原则发生变化         |
| [standards](standards/engineering.md) | 可以执行和审查的开发约定     | 开发流程或约束变化   |
| [design](design/workspace.md)         | 尚在讨论的产品设计           | 目标、边界与方案变化 |
| [decisions](decisions/README.md)      | 有状态、理由、替代方案的决策 | 接受或替代重要选择   |
| [hypotheses](hypotheses/README.md)    | 未知问题、判据和验证状态     | 提出或验证一个假设   |
| [experiments](experiments/README.md)  | 固定环境下的结果与结论边界   | 完成一次有意义的实验 |
| [roadmap](roadmap.md)                 | 阶段目标                     | 阶段或优先级变化     |

AI 从 [AGENTS.md](../AGENTS.md) 的任务路由读取必要材料，不要求顺序通读本索引或所有规范。`standards/`、假设和实验明细主要供 AI 使用；原则、设计、ADR 的决策摘要与路线图供人决策和审核。

新增文档前确认已有归属，避免为同一个事实创建第二份可变副本。实验源码在仓库根目录 `experiments/`；原始运行输出在被忽略的 `.artifacts/`，可公开的精简证据随实验记录提交。
