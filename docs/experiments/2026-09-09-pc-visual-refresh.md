# PC 工作台视觉更新

## 判据与环境

本轮在 `c5948cc` 的外壳上更新视觉，目标是加强阅读层次、减少重复标题占用，并让插件安装与开发入口可区分。产品网站仍通过原有 Electron 页面承载。

Linux 本地 Chromium 热重载预览，1440×900 与 1280×800；Electron 使用临时测试 profile、Xvfb 和已有 `--no-sandbox` 实验模式。首次直接启动 Electron 缺少显示环境，改为 Xvfb 后执行回归；这不是产品行为的失败证据。

## 结果

- 浏览器预览覆盖空状态、两个入口、长名称、Copilot／Agent、确认、暂停／继续、失败及插件栏目。页面无横向溢出，控制台无错误。截图见 [视觉审阅](../design/previews/README.md)。
- 相同尺寸下，网站承载区起点由顶部 188px 降至 122px；固定标签与模式切换占用一行。面板键盘调整从 400px 到 420px，再恢复；左右方向键与 Home 导航选中对应网站。
- 插件栏目切换保留安装来源；未信任来源时安装按钮禁用，安装成功回到已安装列表。外部开发连接由新入口开启，桌面确认、回读、撤销连接沿用同一链路。
- 颜色对比抽查：正文／白底 16.10:1、辅助文字／侧栏底 6.23:1、主按钮白字／蓝底 5.17:1。这是选定 Token 的计算，不是完整无障碍认证。

## 验证入口

- `npm run check`：格式、文档链接、类型、lint、单元回归。
- `npm run build`：桌面、预加载、运行时和界面构建。
- `xvfb-run -a node --test tests/desktop.integration.ts tests/plugin-desktop.integration.ts tests/development-desktop.integration.ts`：3 项通过。包含真实 DSH 进程与可控模型、配置双网站、确认前不写入、回读、独立对话、重启、插件生命周期和外部开发 MCP。补充标签键盘切换与跨栏目保留安装输入的断言。
- React 复核：未新增依赖或状态镜像；已有插件状态刷新保持集中，开发面板只在可见栏目挂载并清理轮询；按钮有名称与焦点状态，网站标签使用单个 Tab 停靠点和方向键导航。

主要本地日志在忽略目录 `.artifacts/ui-build.log` 和 `.artifacts/ui-desktop-check.log`。本轮不调用真实模型或真实业务网站，不发布 Release。macOS 构建和安装包冒烟由本 PR 的 CI 单独报告，用户 Mac 的字体与视觉观感仍需审阅。
