# Use Deskwork

[简体中文](preview.md) · [Documentation](README.en.md)

## Install and configure a model

Download the macOS Apple Silicon DMG or Linux x64 archive from [Releases](https://github.com/GuoMonth/dsh-deskwork/releases) and follow the [quick start](../README.md#download). macOS uses ad-hoc signing. If Gatekeeper blocks the app, check its source and SHA-256, then follow [Apple's instructions](https://support.apple.com/en-us/102445).

The first workspace is empty. Add a website URL; enter your DeepSeek model and API key in Model settings and select a language. The OS secure store holds the key. Sign in to the website yourself.

## Tasks and confirmation

Each website saves its conversation and browser identity separately. Copilot shows the page beside the conversation; Agent expands the conversation and keeps page access. One automated task runs at a time; switching websites does not move it.

Critical actions use native DSH approval. Inputs may autosave, so filling a field can require confirmation. Stop/takeover or manual interaction pauses the task; observe again before continuing. Check the page when a submission result is unclear; it is not submitted again automatically.

Native DSH logs preserve tool history. After restart, tasks stay paused until Observe and continue; old approvals expire. New task starts a new session. If logs are missing or an older conversation has only text, it remains visible but requires a new task.

## Plugins

Search the DSH marketplace in Plugins, or supply an npm name, GitHub Release URL or local `file:/` directory. Review the source, install and bind it to a website. Stop the task before changes that affect its plugins. Plugins are trusted local code with file and network access.

ERP uses the current website and task browser; it owns configuration and storage. Sharing is covered in the [ERP guide](https://github.com/GuoMonth/dsh-erp/blob/60d82ea4763cdc4fab3f452c1b33c76ec24c5ea4/docs/native-and-sharing.en.md). Plugin authors use the [Devkit](../packages/plugin-devkit/README.en.md).

## Data and limits

macOS data lives in `~/Library/Application Support/dsh-deskwork`; updates retain websites and conversations. Login after restart depends on the website's cookie lifetime. Old confirmations do not become new authorization.

Regression checks cover ordinary DOM forms, links, buttons and native selects. Cross-origin frames, closed Shadow DOM, Canvas, complex controls, upload/download and general SSO remain unaccepted; take over when needed. This release's deterministic regression and installation checks are in the [release notes](releases/0.2.2.md#english). Live-model business tasks and user macOS acceptance remain pending.

Local commands, fixtures and checks are in [Contributing](../CONTRIBUTING.md).
