# ADR-0003：Rust 性能扩展与运行时选择

状态：接受选择准则，尚未采用新运行时或 Rust 模块。日期：2026-09-05。来源：项目发起人的性能扩展方向与多年 Rust 经验。

## 决策

Node/TypeScript 继续承载业务编排和集成。出现可定位的计算、内存或本地资源瓶颈时，Rust 是优先评估的扩展语言；Wasm、Node-API 原生模块和独立进程按实际边界选择。Bun/Deno 保留为条件性备选，当前不引入。

AI 继续负责完整实现与验证。发起人的 Rust 经验用于必要的架构取舍和审核，不把普通 Rust 编码转交给人。已确认热点后，AI 可直接开展小规模对照实验，无需先穷尽所有 TS 微优化或为探索额外申请确认。

## 候选与适用条件

以下是实验选择建议，不是本项目已有性能结论：

| 观察到的瓶颈                                             | 优先比较的路径                                                              | 需要纳入成本                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 模型/API 等待、页面加载、过多工具往返                    | 请求合并、上下文裁剪、会话复用、技能批处理、合理并发                        | 等待时间与调用次数；换语言不直接消除外部等待                        |
| JS 计算阻塞主线程                                        | 调整算法、流式处理、复用 Worker 池或 utility process                        | 排队、传输、线程/进程启动与总内存                                   |
| 可独立的批量纯计算，如大表核对、文本解析、差异或索引计算 | TS 基线与 Rust/Wasm 对照；按调用方决定 Node Worker 或浏览器 Worker          | 编译/实例化、字符串编码、数据复制、线性内存与 JS 内存同时存在的成本 |
| 重文件 I/O、系统接口、本地库或对内存布局有要求           | Rust + Node-API（如 napi-rs）或常驻 Rust sidecar；Wasm 仍可参与合适的子问题 | 平台构建、目标 ABI/外部库、IPC、崩溃恢复与打包                      |
| Chromium 页面占用大量内存或存在泄漏                      | 定位 renderer、页面生命周期、缓存和对象保留，再决定组件优化                 | 整个进程树的 RSS；替换一个 TS 函数不会自动降低 Chromium 内存        |
| Node 工具启动或特定运行时行为成为实测主要成本            | 首先批处理/复用现有工具，再对单个工具评估 Bun/Deno                          | Node/npm 兼容、原生模块、调试、CI 和额外分发成本                    |

Wasm 同步计算也会占用调用线程，不能仅因换了语言就宣称 UI 更流畅。高频细粒度 JS ↔ Wasm/Rust/进程调用可能抵消计算收益，优先考虑批量输入、明确的数据布局与可复用实例。

Wasm 便于跨宿主复用纯计算模块，但不是所有系统 API 或 Rust crate 的直接运行目标，也不保证零拷贝或更低内存。Node-API 提供有范围的 ABI 稳定性，仍需验证 Electron 目标版本、OS/架构和外部原生依赖。常驻 sidecar 适合需要独立生命周期的任务，不为每次工具调用重新启动进程。

## 采用门槛

1. 先给出实际任务和基线：耗时分布、调用次数、CPU、峰值/稳态 RSS、事件循环或 UI 响应，按瓶颈选择必要指标。
2. 为待改善指标定义具体目标和允许的回归范围；比较相同输入和正确性判据，包含冷启动、温运行及典型/大数据量。
3. 测端到端收益，包括序列化、跨边界复制、初始化、线程/进程管理、安装包与构建成本。微基准只能用于定位，不能单独支持采用。
4. 保留一致的强类型 TS 边界；生成绑定时锁定生成工具，校验真实输入/输出、错误、取消及资源释放。共享正确性用例或差分测试，不手工维护两套漂移的契约。
5. Rust 模块优先安全 Rust；首次引入时再锁定工具链、建立 fmt/clippy/test 和必要的互操作检查。确有 unsafe/FFI 需求时限定在小边界并记录不变量，不把复杂度散到编排层。
6. 目标平台和实际 Electron/Node 进程中验证通过后，记录采用决策；保留可回退的旧路径或版本，不要求永久维护双实现。

当前尚无需要 Rust 重写的实测产品热点，不建立空 Cargo/Wasm 目录、不安装额外运行时、不用脱离产品的算法比赛制造架构结论。

## Bun / Deno 的边界

更换开发命令的运行时并不替换 Electron 内嵌的 Node/Chromium。DSH 或工具若运行在外部进程，也要分别核对该进程真实使用的运行时。若要使用 Bun/Deno，优先局限于一个有明显收益的独立工具，保留原有锁文件与兼容执行路径，避免顺带迁移整个工程。

官方兼容说明可以帮助挑选测试，但不能证明本项目的 Electron、DSH、MCP、原生模块或测试工具链已经兼容。现阶段已有反馈循环改进取得实测收益，继续使用现有组合成本更低。

## 设计线索

- [Node Worker threads](https://nodejs.org/api/worker_threads.html)：适合 CPU 密集工作，应考虑池化成本；不是 I/O 提速的通用方案。
- [Electron 进程模型](https://www.electronjs.org/docs/latest/tutorial/process-model)：主进程、renderer 与 utility process 的实际边界。
- [wasm-bindgen 字符串](https://rustwasm.github.io/docs/wasm-bindgen/reference/types/str.html)与[数值切片](https://rustwasm.github.io/docs/wasm-bindgen/reference/types/boxed-number-slices.html)：跨语言表示和复制成本需要测量。
- [Node-API](https://nodejs.org/api/n-api.html)与[napi-rs](https://napi.rs/docs/introduction/getting-started)：原生互操作候选。
- [Bun Node 兼容说明](https://bun.sh/docs/runtime/nodejs-compat)、[Deno Node/npm 兼容说明](https://docs.deno.com/runtime/fundamentals/node/)：仅作为未来兼容实验的输入。

以上来源是选型线索；本记录没有声称 Rust/Wasm、Bun 或 Deno 已在 Deskwork 获得性能收益。
