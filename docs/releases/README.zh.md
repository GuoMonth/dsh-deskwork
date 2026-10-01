# 发布编写

[English](./README.md) | 中文

公开文档默认使用英文。同步维护公开 README 配对：`README.md` 与 `README.zh.md`，互相链接、章节对应。使用 `node scripts/check-translations.ts --write` 记录已审阅内容摘要；`npm run docs:check` 拒绝未同步的配对。

发布说明写入 `docs/releases/<version>.md`，包含 `[English](#english) | [中文](#中文)`，英文在前，两种语言各有完整章节。说明已交付行为、平台下载、校验值、验证与实际限制。如实保留运行时上游预发布状态及 macOS 签名状态。

从固定、已验证源码树构建制品，验证安装包及上传 SHA256 后再发布 GitHub Release。正式版本去掉 draft 与 prerelease 标记，并设为 latest。保留固定桌面资产名，使 `releases/latest/download` 指向本项目最新已发布版本。

仅分发桌面包、SDK/Devkit 包与校验值。私有集成插件、业务截图及账号数据保存在源码、CI 资产和公开 Release 之外；公开回归使用合成夹具。

参考：[上游文档配对](https://github.com/deepseek-ai/deepseek-harness/blob/main/docs/i18n/README.md)和[上游双语 Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.0-rc.2)。
