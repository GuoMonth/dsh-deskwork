# Contributing / 参与贡献

DSH Deskwork 由 AI 主导开发。人主要提供业务规格、必要决策和审核；AI 负责代码、测试、实验、文档维护与 PR。

给人看的入口：[产品介绍](README.md)、[原则](docs/principles/product.md)、[设计](docs/design/workspace.md)、[决策](docs/decisions/README.md)。编码代理从 [AGENTS.md](AGENTS.md) 按需加载规范，无需每次阅读全部文档。

## 开发入口（供 AI 使用）

首次准备使用 [.node-version](.node-version) 指定的 Node.js 和 npm 11，执行 `npm ci`。已有匹配锁文件的依赖直接复用。

| 场景                         | 命令                                           |
| ---------------------------- | ---------------------------------------------- |
| 编辑期间                     | 相关测试或 `npm run typecheck`                 |
| 仅文档                       | `npm run check:docs`                           |
| 代码改动完成                 | `npm run check`                                |
| CI / 排查缓存                | `npm run check:fresh`                          |
| 调整格式                     | `npm exec -- prettier --write path/to/file`    |
| 首次下载 Electron            | `npm run experiment:prepare`                   |
| 已隔离开发环境中的实验       | `npm run experiment:electron-session`          |
| 验证 Chromium sandbox 的实验 | `npm run experiment:electron-session:chromium` |

当前提供的账号已是隔离开发环境，默认本地实验使用外层隔离，不再配置嵌套 Chromium sandbox。输出记录隔离模式；该结果不证明产品发布环境的安全或兼容性。Linux 无显示环境仍需 Xvfb。实验只运行模拟 ERP，使用临时 profile 并清理进程。

成功检查输出简短摘要，完整日志见 `.artifacts/check-latest.json`；实验输出见 `.artifacts/electron-session-control/latest.json`。详细执行约定见[验证规范](docs/standards/verification.md)。

贡献需拥有相应权利，并同意采用本仓库 [MIT License](LICENSE)。

## English

AI owns implementation, tests, experiments, documentation maintenance, and PR updates. Humans provide specifications, consequential decisions, and review. Agents load [AGENTS.md](AGENTS.md) and only relevant context.

Reuse the pinned toolchain. Use `check:docs` for documentation, `check` at a code-change boundary, and `check:fresh` for CI or cache diagnosis. The default Electron fixture experiment uses host isolation on the supplied isolated development account; the separate `:chromium` command tests nested Chromium isolation. Reports distinguish these modes. Contributions are licensed under MIT.
