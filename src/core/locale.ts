import { z } from 'zod';

export const localeSchema = z.enum(['en', 'zh']);
export type Locale = z.infer<typeof localeSchema>;
export const defaultLocale: Locale = 'en';

// English is the authored source. Interpolation preserves user and website content.
export const chineseMessages = {
  Language: '语言',
  Settings: '设置',
  'Close dialog': '关闭对话框',
  'Add the websites you use every day. Sign in on the original website.':
    '把每天使用的网站放进工作台。登录仍在原网站中完成。',
  'Website URL': '网站网址',
  Name: '名称',
  '(optional)': '（可选）',
  'For example: My business system': '例如：我的业务系统',
  'Save website settings': '保存网站设置',
  'Add website': '添加网站',
  'Remove this entry (keep website data)': '移除此入口（保留网站数据）',
  'The preview does not connect to a model. Do not enter a real API key.':
    '交互预览不连接模型，请勿输入真实密钥。',
  'Your key is stored in the system secure storage on this computer, for DSH only.':
    '密钥保存在本机系统安全存储，仅供 DSH 使用。',
  'Model name': '模型名称',
  'API key': 'API 密钥',
  'Save model settings': '保存模型配置',
  'Opening Deskwork…': '正在打开 Deskwork…',
  'Collapse workspace navigation': '折叠工作区导航',
  'Expand workspace navigation': '展开工作区导航',
  'Search commands': '搜索命令',
  'Interactive preview': '交互预览',
  Workspace: '工作区',
  'Website navigation': '网站导航',
  Plugins: '插件',
  'Model settings': '模型设置',
  'Pinned websites': '固定网站标签',
  'Add pinned website': '添加固定网站',
  'Work mode': '工作模式',
  'Website page': '网站页面',
  'Refresh website': '刷新网站',
  'Website settings': '网站设置',
  Page: '页面',
  'Start with a website you know': '从你熟悉的网站开始',
  'Your work, in one place.': '你的工作，一个入口。',
  'Add your daily websites and sign in as usual.': '添加每天使用的网站，照常登录。',
  'Your page here. AI by your side.': '页面在这里，AI 在身边。',
  'Add your first website': '添加第一个网站',
  '01 Add a URL': '01 添加网址',
  '02 Sign in': '02 登录网站',
  '03 Start a conversation': '03 开始对话',
  'The desktop app opens the original website here': '桌面客户端会在此原样打开网站',
  'This preview shows the workspace layout only': '此处仅预览工作台布局',
  'Resize AI panel': '调整 AI 面板宽度',
  'DSH conversation': 'DSH 对话',
  'View page': '查看页面',
  'New task': '新建任务',
  'No website added': '尚未添加网站',
  'Separate conversation': '独立对话',
  'Configure a website to begin': '配置后即可开始',
  'What would you like to work on today?': '今天，有什么需要处理？',
  'Tell me your goal,': '告诉我你的目标，',
  'and I will help you on the current website.': '我会在当前网站中协助你完成。',
  'Show me what is on the current page': '看看当前页面有哪些信息',
  'Help me find items that need attention': '帮我查找需要处理的事项',
  You: '你',
  'Dismiss error': '关闭错误',
  'A task on another website is still active.': '另一个网站的任务尚未结束。',
  'View task': '查看任务',
  'Stop and take over': '停止并接手',
  'Read the result again': '重新读取结果',
  'Observe again and continue': '重新观察并继续',
  'Tell DSH your goal': '告诉 DSH 你的目标',
  'Tell me what you want to do…': '告诉我你想完成什么…',
  'Add a website to start a conversation': '添加网站后开始对话',
  Configured: '已配置',
  'Configure model': '配置模型',
  'Send task': '发送任务',
  'Enter to send · Shift Enter for a new line': 'Enter 发送 · Shift Enter 换行',
  'Local workspace': '本地工作台',
  'Preview · No website or model connection': '交互预览 · 不连接网站或模型',
  'Original websites · Tasks use the selected entry': '网站保持原样 · 任务绑定当前入口',
  'Connect DeepSeek': '连接 DeepSeek',
  Commands: '命令入口',
  'Switch to Copilot': '切换到 Copilot',
  'Switch to Agent': '切换到 Agent',
  'Configure model connection': '设置模型连接',
  'Plugin sections': '插件栏目',
  Discover: '发现',
  Develop: '开发',
  'Discover plugins': '发现插件',
  'Install local extensions from the DSH community marketplace to add knowledge, skills and tools to your websites.':
    '从 DSH 社区市场安装本地扩展，为网站添加知识、技能和工具。',
  'Search plugins': '搜索插件',
  'Search marketplace plugins': '搜索市场中的插件',
  'Search marketplace': '搜索市场',
  'Marketplace search results': '市场搜索结果',
  'Select for installation': '选择安装',
  'Installation source': '安装来源',
  'Plugin installation source': '插件安装来源',
  'npm package, GitHub URL or file:/ local plugin directory':
    'npm 包名、GitHub 地址或 file:/ 本地插件目录',
  'I trust this source and allow the extension to run code and access files and the network on this computer.':
    '我信任此来源，并允许扩展在本机执行代码、访问文件和网络。',
  'Install plugin': '安装插件',
  'Installed plugins': '已安装插件',
  'Installed ·': '已安装 ·',
  'Installed · {count}': '已安装 · {count}',
  'No plugins installed. Your websites are ready to use.': '还没有安装插件。网站可以照常使用。',
  'After installation, enable or mount a plugin to websites, or remove it at any time.':
    '安装后可启用、挂载到网站或随时取消。',
  Enabled: '已启用',
  Disabled: '已禁用',
  'Unique mount name': '唯一挂载名',
  'All websites': '所有网站',
  'Save and enable': '保存并启用',
  Unmount: '取消挂载',
  Update: '更新',
  Uninstall: '卸载',
  'Plugin development connection': '插件开发连接',
  'Plugin development': '插件开发',
  'The app includes developer guides and the browser SDK. Once connected, an external coding AI can read and operate the selected website. Queries can run continuously; consequential actions require confirmation in the workspace.':
    '开发指南和浏览器 SDK 已随客户端提供。连接后，外部编程 AI 可读取并操作选定网站；查询可连续执行，关键操作在工作台确认。',
  'Connected:': '已连接：',
  'Development website': '开发网站',
  '. Switching tabs does not change the target.': '。切换标签不会改变目标。',
  'MCP configuration for external AI': '外部 AI 的 MCP 配置',
  'Development MCP configuration': '开发 MCP 配置',
  Copied: '已复制',
  'Copy MCP configuration': '复制 MCP 配置',
  'Disconnect development session': '断开开发连接',
  'After confirmation, ask the external AI to read task status and observe again. Disconnecting or quitting invalidates the old connection.':
    '完成确认后，让外部 AI 读取任务状态并重新观察。断开或退出客户端后，旧连接失效。',
  'Add a website first': '请先添加网站',
  'Allow external AI to develop this website': '允许外部 AI 开发此网站',
  Ready: '准备就绪',
  Working: '正在处理',
  'Waiting for your confirmation': '等待你确认',
  'Paused · You can take over': '已暂停 · 可以接手',
  'Result needs verification': '结果待核对',
  'Turn completed': '本轮已完成',
  'Needs attention': '需要处理',
  Cancelled: '已取消',
  'Task status': '任务状态',
  'Expected result:': '预期结果：',
  'Target:': '目标：',
  'Key:': '按键：',
  'Current value': '当前值',
  Empty: '空',
  'New value': '将填写',
  'Confirm and execute': '确认并执行',
  'Reopen or refresh the result page on the website. New form values alone do not prove that a change was saved.':
    '请重新打开或刷新网站的结果页面。表单中的新值本身不代表保存成功。',
  'I checked: the result is correct': '我已核对，结果正确',
  'Not applied: finish verification': '确认未生效，结束核对',
  'Last observed page': '最近观察的页面',
  'Execution steps and details': '执行步骤与详情',
  'Model requests': '模型请求',
  '· Tool calls': '· 工具调用',
  seconds: '秒',
  'Close {title}': '关闭 {title}',
  'My workspace': '我的工作台',
  'Ready to start your work': '准备好开始今天的工作',
  'Duplicate website entry IDs': '入口标识重复',
  'Unsupported configuration version. Keep the original file.': '配置版本不受支持，请保留原文件',
  'The previous action needs verification and will not be submitted again automatically':
    '上次操作结果待核对，不会自动重新提交',
  'The previous task was interrupted. Observe the page again before continuing.':
    '上次任务已中断，继续前重新观察页面',
  'The task has no website target': '任务尚未绑定网站',
  'Stop the task or verify its result first': '请先停止任务或核对结果',
  'Observing the website': '正在观察网站',
  'Task paused': '任务已暂停',
  'Observed page: {title}': '已观察页面：{title}',
  'Observed page:': '已观察页面：',
  'The task is not running or is waiting for confirmation': '任务未运行或正在等待确认',
  'The page changed. Observe it again.': '页面已变化，请重新观察',
  'Confirm the action to execute': '请确认即将执行的操作',
  'Confirmation expired': '确认已失效',
  'The page or input changed. Verify the action already sent; the old confirmation will not execute.':
    '页面或输入已变化；先核对已发出的操作，旧确认不会执行',
  'The page or input changed. Observe and confirm again.': '页面或输入已变化，请重新观察并确认',
  'Executing the confirmed action': '正在执行已确认动作',
  'Action executed; observe the actual result next': '动作已执行；继续观察实际结果',
  'The action response is uncertain. Check the page; the action will not be repeated.':
    '操作响应未确认，请查看页面核对，不会重复执行',
  'Stopped; actions already sent still need verification': '已停止；已发出的操作仍需核对',
  'Stopped. You can take over the page.': '已停止，你可以接手页面',
  'The previous operation is still running': '上一步尚未结束',
  'The current task cannot resume': '当前任务不能恢复',
  'Cannot verify at this time': '当前不能核对',
  'No independently verifiable expected change. Check the original page.':
    '没有可独立验证的预期变化，请用户在原页面核对',
  'Refreshed page matches the expected result you confirmed':
    '已刷新页面，回读结果符合用户确认的预期',
  'The refreshed page does not yet verify the expected result. Check it; the action will not be submitted again.':
    '刷新后的页面尚未验证预期结果，请核对；不会重复提交',
  'No result awaiting verification': '当前没有待核对的结果',
  'You verified the result on the original website': '用户已在原网站核对结果',
  'You confirmed the action was not applied. Start a new action if needed.':
    '用户确认未生效；需要继续时重新发起操作',
  'Reopen or refresh the result page on the original website to verify the action':
    '请在原网站重新打开或刷新结果页面，核对操作是否生效',
  'The target page does not belong to this website or has closed':
    '目标页面不属于当前网站，或已关闭',
  'Cannot open the website · Check the URL or network': '无法打开网站 · 请检查网址或网络',
  'New page': '新页面',
  'The page process exited. Refresh the page.': '页面进程已退出，请刷新',
  'Remove pinned entries from website settings': '固定入口请使用网站设置移除',
  'Page closed': '页面已关闭',
  'The development shell only allows an unpackaged app with a local HTTP root URL':
    '开发外壳只允许未打包应用使用本机 HTTP 根地址',
  'Marketplace directory too large': '市场目录过大',
  'Development connection created': '开发连接已创建',
  'Development connection revoked': '开发连接已撤销',
  'The application version does not match its bundled runtime': '应用与随包运行时版本不匹配',
  'Installation verification has no running website task': '安装验证没有运行中的网站任务',
  'The test model must use a local endpoint': '测试模型仅允许本机端点',
  'Cannot read model settings. Configure them again in Settings.':
    '模型设置无法读取，请在设置中重新配置。',
  'Task tools are paused or waiting for confirmation': '任务工具已暂停或正在等待确认',
  'Confirm ERP experience update': '确认更新 ERP 经验',
  'Allow this one local knowledge update?': '是否允许这一次本地知识更新？',
  Cancel: '取消',
  'Allow once': '允许一次',
  'The plugin is not mounted on the current task': '插件未挂载到当前任务',
  'Disconnect the external AI development session first': '请先断开外部 AI 开发连接',
  'Website entry not found': '网站入口不存在',
  'Configure a DeepSeek model and API key in Settings': '请在设置中配置 DeepSeek 模型与密钥',
  'The model turn did not finish. Check before continuing.': '模型本轮未完成，请核对后继续',
  'The conversation turn ended; verify business results by reading them back':
    '本轮对话已结束；业务结果以回读核对为准',
  'DSH exited. Reconnect before continuing.': 'DSH 已退出，请重新连接后继续',
  'A task on another website is active. Stop it or verify its result first.':
    '另一个网站的任务尚未结束，请先停止或核对结果',
  'Disconnect the development session first': '请先断开开发连接',
  'Stop this entry task and verify its result before editing or removing it':
    '请先停止该入口任务并核对结果，再修改或移除',
  'Model connection failed': '模型连接失败',
  'Wait for the current operation to finish': '请等待当前操作完成',
  'Development website not found': '开发网站不存在',
  'External AI plugin development': '外部 AI 插件开发',
  'Mounted website not found': '挂载网站不存在',
  'Finishing the previous step. Try again shortly.': '正在完成上一步，请稍后再试',
  'The MVP supports up to 24 websites': 'MVP 最多配置 24 个网站',
  'Website not found': '网站不存在',
  'No website selected': '没有选中网站',
  'System secure storage is unavailable': '系统安全存储不可用',
  'Entry not found': '入口不存在',
  'Configure a DeepSeek model and API key first': '请先配置 DeepSeek 模型与密钥',
  'Duplicate plugin or mount name': '插件或挂载名重复',
  'Plugin manager closed': '插件管理已关闭',
  'A plugin change is in progress or the app has closed': '插件变更正在进行或客户端已关闭',
  'Plugin not installed': '插件未安装',
  'Plugin uninstalled': '插件已卸载',
  'Mount name already in use': '挂载名已被使用',
  'Plugin settings saved; the next task uses the new settings':
    '插件设置已保存，下次任务使用新设置',
  'Plugin operation failed': '插件操作失败',
  'Installation did not produce a unique plugin package': '安装结果没有唯一的插件包',
  'The update source returned a different plugin': '升级源返回了不同插件',
  'Plugin already installed; use Update': '插件已安装，请使用更新',
  'Wait for the plugin change to finish': '请等待插件变更完成',
  'The page operation did not finish. Observe again or take over.':
    '页面操作未完成，请重新观察或接手',
  'The element is not actionable. Take over on the page.': '元素不可操作，请用户在页面中接手',
  'The page or task changed': '页面或任务已变化',
  'Task stopped': '任务已停止',
  'Cannot confirm the keyboard target. Take over on the page.':
    '键盘目标不可确认，请用户在页面中接手',
  'The page did not confirm the action': '页面没有确认动作执行',
  'Sign in manually on the login page; screenshots are not sent':
    '登录页面请由用户操作，不发送截图',
  'Enter an npm package, GitHub URL or file:/ local plugin directory':
    '请输入 npm 包名、GitHub 地址或 file:/ 本地插件目录',
  'Cannot connect to the Deskwork desktop host. Restart the app or check the installation.':
    '无法连接 Deskwork 桌面宿主，请重新启动或检查安装包。',
  'Preview: observing the page': '交互预览：正在观察页面',
  'Preview: cannot locate the page. Check it and retry.': '预览：页面无法定位，请查看页面后重试',
  'Preview: review the action to execute': '预览：请核对即将执行的动作',
  'Submit the reviewed content on this page (interactive example)':
    '提交当前页面中已核对的内容（交互示例）',
  'Preview: query complete': '预览：查询完成',
  'This is an interactive workspace preview. The desktop app reads your configured websites and shows the actual execution steps here.':
    '这是工作台交互预览。桌面客户端会在这里读取你配置的网站，并显示实际操作步骤。',
  'Preview: verify the result on the original page': '预览：请在原页面核对结果',
  'Stopped. You can take over the page': '已停止，可以接手页面',
  'Preview: observation complete': '预览：重新观察完成',
  'Preview: result reviewed': '预览：用户已核对',
  'Start a development connection in the desktop app': '请在桌面客户端开启开发连接',
  'The preview does not install plugins': '交互预览不安装插件',
  'Install plugins in the desktop app': '请在桌面客户端安装插件',
  'The selected DeepSeek provider is disabled. Check the model URL and plugin configuration; the runtime will not switch to a default route.':
    '选定的 DeepSeek 模型提供方未启用，请检查模型地址与插件配置；不会切换到默认路由。',
  'The bundled runtime platform or architecture does not match': '随包运行时的平台或架构不匹配',
  'Bundled core versions do not match the runtime manifest': '随包核心版本与运行时清单不匹配',
  'Duplicate paths in the runtime manifest': '运行时清单包含重复路径',
  'Bundled runtime files, contents or executable permissions differ from the manifest':
    '随包运行时文件、内容或执行权限与清单不匹配',
  'Invalid model URL: use the HTTP(S) root URL of the Messages API.':
    '模型地址无效：请填写 Messages API 的 HTTP(S) 根地址。',
  'Invalid model URL: use the Messages API root URL without credentials, query parameters or a request path.':
    '模型地址无效：请填写 Messages API 根地址，不含凭据、查询参数或请求路径。',
  'DSH returned incompatible protocol data': 'DSH 返回了不兼容的协议数据',
  'Handshake failed': '握手失败',
  'DSH runtime closed': 'DSH 运行时已关闭',
  'DSH not started': 'DSH 未启动',
  'Tool call revoked': '工具调用已撤销',
  'Tool execution failed': '工具执行失败',
  'Marketplace loading failed ({status}). Try again later.': '市场加载失败 ({status})，请稍后重试',
  'Installing {source}': '正在安装 {source}',
  'Installed {name} {version}': '已安装 {name} {version}',
  'Plugin installation or loading failed ({code})\n{output}':
    '插件安装或加载失败 ({code})\n{output}',
  'Runtime contains an unmaterialized link: {name}': '运行时包含未物化的链接：{name}',
  'Bundled runtime missing {required}': '随包运行时缺少 {required}',
  'Bundled dependency version mismatch: {name}': '随包依赖版本不匹配：{name}',
  'DSH exited ({code})': 'DSH 已退出 ({code})',
  'DSH startup failed: {error}\n{detail}': 'DSH 启动失败：{error}\n{detail}',
  'DSH {method} timed out': 'DSH {method} 超时',
} as const;

export type MessageKey = keyof typeof chineseMessages;
function format(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
}
export function translate(
  locale: Locale,
  message: MessageKey,
  values: Readonly<Record<string, string | number>> = {},
): string {
  return format(locale === 'zh' ? chineseMessages[message] : message, values);
}

// Host-owned status and error text can be localized after a language change.
// Callers keep model replies, user input, website content and plugin output untouched.
const patterns = Object.entries(chineseMessages).map(([en, zh]) => {
  const names: string[] = [];
  const escaped = en.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = escaped.replace(/\\\{(\w+)\\\}/g, (_placeholder: string, name: string) => {
    names.push(name);
    return '([\\s\\S]*?)';
  });
  return { en, zh, names, pattern: new RegExp(`^${source}$`) };
});
export function localizeMessage(locale: Locale, text: string): string {
  for (const entry of patterns) {
    if (text === entry.zh) return locale === 'en' ? entry.en : text;
    const match = entry.pattern.exec(text);
    if (!match) continue;
    const values = Object.fromEntries(
      entry.names.map((name, index) => [name, match[index + 1] ?? '']),
    );
    return format(locale === 'zh' ? entry.zh : entry.en, values);
  }
  return text;
}
