# Contributing / 参与贡献

先阅读 [AGENTS.md](./AGENTS.md) 与[文档导航](./docs/README.md)。人和 AI 使用同一套语义、强类型、测试与证据规则；规范不要求为每个小改动建立额外文档。

## 环境与检查

使用 [.node-version](./.node-version) 指定的 Node.js 和 npm 11：

```sh
npm ci
npm run check
```

修改格式运行 `npm run format`。统一检查入口包括格式、TypeScript、typed lint、本地 Markdown 文件链接和快速行为测试。

## 本地 Electron 实验

```sh
npm run experiment:prepare
npm run experiment:electron-session
```

准备步骤下载锁定的 Electron 二进制；实验不依赖模型 API Key。Linux 无显示环境需要 `xvfb-run` 与 Electron 系统库。保留 Chromium sandbox；若环境不支持，记录限制，不通过关闭 sandbox 伪造通过结果。

脚本启动模拟 ERP 和两个先后运行的真实 Electron 进程，使用临时 profile 并清理。机器可读结果位于 `.artifacts/electron-session-control/latest.json`。实验尚不覆盖真实 ERP、DSH 或 Browser Harness。

PR CI 运行相同的 `npm run check`。较重的浏览器实验优先本地执行，也可从 GitHub Actions 的 Verify 工作流手动触发。

## 提交贡献

业务场景说明目标、当前步骤与成功判据，使用模拟或脱敏数据。行为改动先测试，再实现；架构变化记录理由与证据。PR 说明最终结果和实际验证，文档避免翻译已经清楚的实现。

贡献需拥有相应权利，并同意采用本仓库 [MIT License](./LICENSE)。

## English

Read [AGENTS.md](./AGENTS.md) first. Use the pinned Node.js version and npm 11, then run `npm ci` and `npm run check`. Format changes with `npm run format`.

For the real Electron experiment, run `npm run experiment:prepare` followed by `npm run experiment:electron-session`. Headless Linux needs Xvfb and Electron system libraries. Do not disable Chromium sandbox to pass verification. The experiment uses synthetic ERP data and temporary profiles; it does not prove real ERP, DSH, or Browser Harness compatibility.

Use behavioral tests before implementation and record decisions and evidence rather than duplicating code in prose. Keep changes focused and describe actual validation in the PR. Contributions are licensed under MIT.
