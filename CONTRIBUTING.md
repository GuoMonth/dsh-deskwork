# Contributing / 参与贡献

[English](#english) | [中文](#中文)

## English

Use the Node version in [.node-version](.node-version) and npm 11. Install with `npm ci` for a fresh setup; reuse dependencies when the lockfile is unchanged.

| Change           | Check                                                       |
| ---------------- | ----------------------------------------------------------- |
| Documentation    | `npm run check:docs`                                        |
| Code             | Relevant tests while editing; `npm run check` at completion |
| Checks or caches | `npm run check:fresh`                                       |

Format changed files with Prettier. Update both public README languages together and record reviewed hashes with `node scripts/check-translations.ts --write`.

Agents start with [AGENTS.md](AGENTS.md). Humans review product intent, consequential decisions and outcomes; AI handles routine implementation, tests and PR maintenance.

For Electron experiments, use [verification](docs/standards/verification.md). The supplied isolated development account uses host isolation; Linux without a display needs Xvfb. Keep business data, credentials and screenshots outside public source and artifacts.

Contributions must be yours to license under [MIT](LICENSE).

## 中文

使用 [.node-version](.node-version) 指定的 Node 和 npm 11。首次安装运行 `npm ci`；锁文件未变时复用已有依赖。

| 改动       | 检查                                           |
| ---------- | ---------------------------------------------- |
| 文档       | `npm run check:docs`                           |
| 代码       | 编辑时运行相关测试，完成后运行 `npm run check` |
| 检查或缓存 | `npm run check:fresh`                          |

用 Prettier 格式化改动文件。公开 README 双语同步修改，审阅后用 `node scripts/check-translations.ts --write` 记录摘要。

编码代理从 [AGENTS.md](AGENTS.md) 开始。人审阅产品目标、重要取舍与结果；AI 负责日常实现、测试和 PR 维护。

Electron 实验按[验证约定](docs/standards/verification.md)执行。当前隔离开发账号使用 host 隔离；Linux 无显示环境时需 Xvfb。业务数据、凭据和截图保存在公开源码与制品之外。

贡献者须有权将提交内容按 [MIT](LICENSE) 许可发布。
