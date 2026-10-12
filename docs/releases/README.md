# Release authoring

English | [中文](./README.zh.md)

Keep public README pairs and release notes aligned. Write notes in `docs/releases/<version>.md`, with English first and a complete Chinese section. Cover delivered behavior, downloads, verification and remaining limits. Keep upstream prerelease and macOS signing status accurate.

Build from a fixed, verified source tree. Test the packaged installation and compare uploaded SHA256 values before publishing. A stable release is neither draft nor prerelease and is set as latest. Fixed desktop asset names keep `releases/latest/download` working.

Publish desktop binaries, SDK/Devkit packages and integrity metadata. Keep private plugins, screenshots and account data outside public source, CI and Releases.

After reviewing both README languages, record their hashes with `node scripts/check-translations.ts --write`. Run `npm run check:docs` before committing. See [0.2.2](0.2.2.md) for a bilingual release note.
