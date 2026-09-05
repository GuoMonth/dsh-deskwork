# 类型与边界

## 默认强类型

第一方可执行逻辑采用 TypeScript。启用 `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`noImplicitOverride`、`noFallthroughCasesInSwitch` 和未使用代码检查。

优先类型推断；导出函数明确返回类型。用字面量联合和可辨识联合表达状态，使用 `readonly` 表达不应修改的数据。避免以通用字典替代已知结构。

配置文件、IPC、模型输出、CDP、MCP 和 HTTP 响应都是运行时边界：先接为 `unknown`，校验后返回明确类型。类型断言不能当作输入校验，避免 `as unknown as T`、非空断言与 `@ts-ignore`。

第三方 API 返回 `any` 时优先立即接为 `unknown`，在边界内收窄；业务层不得传播不安全值。编译期不能检查的真实行为，用边界和集成测试覆盖。

## 允许但约束 any

只有第三方互操作、无法表达的动态调用或生成代码边界，且 `unknown` / 泛型 / 明确联合不能合理表达时，才允许显式 `any`。

每个例外必须：

1. 局限于最小适配函数，向外返回已验证的明确类型。
2. 在该行写带说明的 `eslint-disable-next-line @typescript-eslint/no-explicit-any -- ...`，说明外部限制和为何替代方式不可行。
3. 在局部注释或 PR 中说明范围与移除条件；只有影响多个模块的长期类型策略才建立 ADR，不为单个互操作例外增加流程。
4. 有覆盖正常值和错误值的边界测试。

不允许文件级禁用、全局放宽规则、以 `any` 解决普通编译报错。typed lint 检查不安全赋值、调用和返回；无用 suppression 视为错误。新增例外的理由与记录由 PR 审查，工具通过不等于例外已获证明。

## 测试同样强类型

夹具与替身遵循真实契约。可以用 `unknown` 构造非法输入来验证拒绝行为；不通过强制转换伪造合法对象。实验代码也遵循同一规则，避免把临时代码变成弱类型入口。
