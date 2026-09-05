# 文档导航

文档记录「为什么、约束、选择和证据」；类型、命名、实现与测试表达「现在如何工作」。不维护逐函数解释或已实现功能的平行文档。

| 目录                                  | 内容                         | 更新时机             |
| ------------------------------------- | ---------------------------- | -------------------- |
| [principles](principles/product.md)   | 产品与工程的长期原则         | 原则发生变化         |
| [standards](standards/engineering.md) | 可以执行和审查的开发约定     | 开发流程或约束变化   |
| [design](design/workspace.md)         | 尚在讨论的产品设计           | 目标、边界与方案变化 |
| [decisions](decisions/README.md)      | 有状态、理由、替代方案的决策 | 接受或替代重要选择   |
| [hypotheses](hypotheses/README.md)    | 未知问题、判据和验证状态     | 提出或验证一个假设   |
| [experiments](experiments/README.md)  | 固定环境下的结果与结论边界   | 完成一次有意义的实验 |
| [roadmap](roadmap.md)                 | 阶段目标                     | 阶段或优先级变化     |

阅读入口：[仓库约定](../AGENTS.md) → [工程标准](standards/engineering.md) → [类型标准](standards/typescript.md) → [验证标准](standards/verification.md)。

新增文档前确认已有归属，避免为同一个事实创建第二份可变副本。实验源码在仓库根目录 `experiments/`；原始运行输出在被忽略的 `.artifacts/`，可公开的精简证据随实验记录提交。
