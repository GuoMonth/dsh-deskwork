# Release authoring

English | [中文](./README.zh.md)

Keep English as the default public documentation language. Maintain public README pairs together: `README.md` and `README.zh.md`, with links to each other and matching sections. Record reviewed content hashes with `node scripts/check-translations.ts --write`; `npm run docs:check` rejects stale pairs.

Write release notes in `docs/releases/<version>.md` with `[English](#english) | [中文](#中文)`, English first, and complete sections for both languages. Describe delivered behavior, platform downloads, checksums, verification and real limitations. Keep the runtime's upstream prerelease status and macOS signing status accurate.

Build assets from a fixed, verified source tree. Check packaged installation and uploaded SHA256 values before publishing a GitHub Release. A stable release is published without the draft or prerelease flag and set as latest. Keep fixed desktop asset names so `releases/latest/download` resolves to the project's newest published release.

Distribute desktop packages, SDK/Devkit packages and checksums only. Private integration plugins, business screenshots and account data stay outside source, CI artifacts and public releases. Public regressions use synthetic fixtures.

Reference: [upstream documentation pairing](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/i18n/README.md) and [bilingual upstream release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2).
