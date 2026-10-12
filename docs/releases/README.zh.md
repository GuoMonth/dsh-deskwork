# 编写发布说明

[English](./README.md) | 中文

公开 README 和发布说明保持双语一致。发布说明写入 `docs/releases/<version>.md`，英文在前，中文章节完整对应。说明已交付内容、下载、验证与剩余限制，如实标明上游预发布状态和 macOS 签名状态。

从固定且已验证的源码构建，检查安装包和上传后的 SHA256，再发布。正式版本去掉 draft、prerelease 标记并设为 latest；桌面资产名称固定，让 `releases/latest/download` 持续可用。

只发布桌面二进制、SDK/Devkit 包和完整性元数据。私有插件、截图和账号数据保存在公开源码、CI 和 Releases 之外。

审阅两种 README 后，用 `node scripts/check-translations.ts --write` 记录摘要。提交前运行 `npm run check:docs`。双语发布说明示例见 [0.2.2](0.2.2.md)。
