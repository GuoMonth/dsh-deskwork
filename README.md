# DSH Deskwork

English | [中文](./README.zh.md)

Add a website, sign in, and let AI help with your work. Deskwork is a local desktop app powered by [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Copilot shows the page beside the conversation; Agent expands the conversation within the same task.

## Download

[macOS Apple Silicon](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-mac-arm64.dmg) · [Linux x64](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-linux-x64.tar.gz) · [Release notes and checksums](https://github.com/GuoMonth/dsh-deskwork/releases/latest)

On macOS, drag the app from the DMG into Applications. On Linux, extract the archive and run `./linux-unpacked/dsh-deskwork`. Both packages include their runtime. macOS supports arm64 only and uses ad-hoc signing; Apple notarization is pending.

## Start working

1. Add a website and sign in on its page.
2. Open **Model settings**, enter your model and API key, and choose English or 中文. English is the default.
3. Describe the task. Review critical actions before they run; stop and take over whenever needed.
4. Check the result on the website.

Each website keeps its own login and conversation. One automatic task runs at a time. After restart, observe the page before continuing a paused task; earlier approvals expire.

See the [user guide](docs/preview.md) for installation, recovery and local data. Packaged tests use synthetic sites and deterministic models; live-model business tasks and user Mac acceptance are still pending. The bundled DSH version is an upstream prerelease; exact versions and checks are in the release notes.

## Plugins

Install trusted extensions through the DSH plugin marketplace. Local plugins can execute code and access files and the network.

[Adapt ERP](https://github.com/GuoMonth/dsh-erp) learns from your ERP pages and saves knowledge locally. It reuses the current task browser in Deskwork. Follow its guide to export and import experience as Skills.

Plugin authors can start with the [Devkit](packages/plugin-devkit/README.md). SDK and Devkit TGZ files are available in Releases; their npm package names are not published.

## Develop

Use the pinned Node 24 and npm 11 toolchain:

```sh
npm ci
npm run experiment:prepare
npm run dev
```

`npm run dev` opens the UI preview; `npm start` opens the desktop app. Checks and packaging commands are in [CONTRIBUTING](CONTRIBUTING.md). Keep business data and credentials outside the repository.

[Documentation](docs/README.md) · [Product specification](docs/specs/m1-configurable-workspace.md)

## License

[MIT](LICENSE). Third-party dependencies retain their own licenses.
