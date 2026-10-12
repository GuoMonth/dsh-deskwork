# DSH Deskwork

[中文](./README.zh.md) · [Releases](https://github.com/GuoMonth/dsh-deskwork/releases)

Sign in to your business systems and work with AI in the same browser session. Deskwork is a local desktop workspace powered by [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Copilot shows the page beside the conversation; Agent expands the conversation while keeping the same task.

Current release: **0.2.2**, with **DSH 0.2.0-rc.2** (upstream prerelease). ERP integration uses **0.1.1**. See [release notes](docs/releases/0.2.2.md#english).

## Download

[macOS Apple Silicon](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-mac-arm64.dmg) · [Linux x64](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-linux-x64.tar.gz) · [Checksums](https://github.com/GuoMonth/dsh-deskwork/releases/latest)

On macOS, open the DMG and drag the app into Applications. On Linux, extract the archive and run `./linux-unpacked/dsh-deskwork`. Both include their runtime and pnpm. macOS uses ad-hoc signing; Apple notarization is pending.

## Use

1. Add a website, sign in manually and configure a model in **Settings**. The UI follows the system language by default; select **English** or **中文** to override it.
2. Tell AI your goal. Each website keeps its own conversation and browser identity; one automated task runs at a time.
3. Review critical actions and check the result on the page. Stop or take over when needed.
4. After restart, observe the page and explicitly continue. Previous approvals expire; a new task starts a separate conversation.

The current source adds a tray menu for opening Deskwork, checking task status and exiting. Closing the window keeps the task running; choose **Exit Deskwork** to stop and save it. These desktop changes are included in the next release; published packages follow their release notes.

The existing DSH marketplace installs trusted local plugins. They can execute code and access your files and network. The [ERP plugin](https://github.com/GuoMonth/dsh-erp) reuses the task browser and can export experience as a Skill for another user to review and import.

Tests use real DSH/Electron with deterministic models and synthetic websites. Live-model business tasks and user macOS acceptance remain pending. Setup, data and limitations are in the [user guide](docs/preview.en.md).

## Develop

Use the repository's pinned Node and npm versions:

```sh
npm ci
npm run experiment:prepare
npm run dev
```

`npm run dev` opens the UI preview; `npm start` launches the desktop app. See [Contributing](CONTRIBUTING.md) for checks and the [Devkit](packages/plugin-devkit/README.en.md) for plugin development.

[Documentation](docs/README.en.md) · [Roadmap](docs/roadmap.en.md) · [MIT](LICENSE)
