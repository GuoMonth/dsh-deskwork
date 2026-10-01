# DSH Deskwork

English | [中文](./README.zh.md)

**Sign in to your business systems. Let AI help get the work done.**

DSH Deskwork is a local desktop workspace powered by [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Add a website, sign in as usual, and work with AI in the same browser session. Copilot places the page next to the conversation; Agent expands the conversation while keeping the same task and browser identity.

## Download

[macOS Apple Silicon](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-mac-arm64.dmg) · [Linux x64 portable archive](https://github.com/GuoMonth/dsh-deskwork/releases/latest/download/DSH-Deskwork-linux-x64.tar.gz) · [Release notes and checksums](https://github.com/GuoMonth/dsh-deskwork/releases/latest)

Open the macOS DMG and drag the app into Applications. Extract the Linux archive and run `./linux-unpacked/dsh-deskwork`. The macOS app currently uses ad-hoc signing; Developer ID signing and Apple notarization are not configured.

The app defaults to **English**. Choose **English** or **中文** in **Model settings → Language**. The selection is saved locally and restored after restart; subsequent model tasks use the selected language. Website content, names and existing conversations retain their original text.

The runtime pins **DSH `0.2.0-rc.2`**, an upstream prerelease, and Electron **`44.0.0`**. Packages include an independent runtime, Node-mode and pnpm. Verification uses real DSH and Electron with deterministic models and synthetic websites; live-model business tasks and user macOS acceptance remain pending.

## Work with websites

- Add URLs to an empty workspace. Each entry keeps its own conversation and persistent browser identity.
- Sign in manually on the original website. Tell AI your goal, observe its progress, and stop or take over when needed.
- Review consequential actions before execution. Reopen or refresh result pages to verify that changes were saved.
- Use the existing DSH plugin marketplace for trusted local extensions. Extensions can execute code and access files and the network on your computer.

## Reuse ERP experience

Enter `@guosheng_047/dsh-erp@latest` as the plugin installation source to install our latest [ERP package](https://www.npmjs.com/package/@guosheng_047/dsh-erp). Use `@guosheng_047/dsh-erp@0.1.0` to reproduce the published fixed combination.

ERP reuses the task browser through native Browser Use, plus native tools, approvals, attachments, Sessions and Skills. Computer Use explicitly enables the official Cua Driver Native through the ERP plugin.

Export and import experience through a single tool call in the conversation. The exported directory contains standard `SKILL.md` and `references/knowledge.json`, so another user can import it and reuse it through DSH Skills. Imported knowledge binds to the recipient's ERP scope and requires review. Structured identities, raw evidence and business samples are excluded from sharing; review free text before sharing it.

## Develop

Use the pinned Node 24 and npm 11 versions:

```sh
npm ci
npm run experiment:prepare
npm run dev
```

`npm run dev` opens a synthetic UI preview. Use `npm start` for the desktop app, `npm run check` for standard checks, and `npm run test:devkit` for external SDK/Devkit consumers. Public tests use generated data and reserved example domains. Keep private integration inputs outside the repository.

[Preview guide](./docs/preview.md) · [Contributor guide](./CONTRIBUTING.md) · [Documentation index](./docs/README.md) · [Product specification](./docs/specs/m1-configurable-workspace.md) · [Runtime verification](./docs/experiments/2026-10-01-dsh-020-native-experience.md)

Public README pairs and bilingual release notes follow the [upstream documentation convention](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/i18n/README.md): English source, a `.zh.md` counterpart, language links, and checks that require both sides to be updated. Release notes provide linked English and Chinese sections; see [release authoring](./docs/releases/README.md).

## License

[MIT](./LICENSE). Third-party runtime dependencies retain their own licenses.
