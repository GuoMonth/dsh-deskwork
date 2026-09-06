import { app, BrowserWindow, ipcMain, safeStorage, Menu } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { commandSchema, idleTask, workspaceSchema } from '../core/contracts.ts';
import type { EntryContext, Site, WorkspaceSnapshot } from '../core/contracts.ts';
import { TaskController } from '../core/task-controller.ts';
import { ElectronBrowser } from '../browser/electron-browser.ts';
import { StateStore } from './state-store.ts';
import { Pages } from './pages.ts';
import { startToolServer } from '../runtime/tool-server.ts';
import { DshRuntime } from '../runtime/dsh-runtime.ts';

const profileArgument = process.argv.find((argument) =>
  argument.startsWith('--profile-directory='),
);
if (profileArgument) app.setPath('userData', profileArgument.slice('--profile-directory='.length));
async function main(): Promise<void> {
  await app.whenReady();
  const directory = app.getPath('userData');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const store = new StateStore(directory);
  let workspace = await store.loadWorkspace();
  const saved = await store.load();
  let activeSiteId = workspace.sites[0]?.id ?? '';
  let closing = false;
  let runtime: DshRuntime | undefined;
  let runtimeGeneration = 0;
  let model = 'deepseek-v4-flash';
  let apiKey = '';
  let configured = false;
  const testModelArgument = process.argv.find((argument) =>
    argument.startsWith('--test-model-url='),
  );
  const testModelURL = testModelArgument?.slice('--test-model-url='.length);
  if (testModelURL) {
    if (new URL(testModelURL).hostname !== '127.0.0.1') throw new Error('测试模型仅允许本机端点');
    apiKey = 'fixture-key-not-a-secret';
    configured = true;
  } else {
    try {
      const settings = z
        .object({ model: z.string(), encryptedKey: z.string() })
        .strict()
        .parse(JSON.parse(await readFile(join(directory, 'model.json'), 'utf8')));
      apiKey = safeStorage.decryptString(Buffer.from(settings.encryptedKey, 'base64'));
      model = settings.model;
      configured = true;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
        console.error('模型设置无法读取，请在设置中重新配置。');
    }
  }
  const shellPath = join(app.getAppPath(), 'dist/ui/index.html');
  const window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#f5f7fa',
    title: 'DSH Deskwork',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(app.getAppPath(), 'dist/host/preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]),
  );
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
  const contexts = new Map<string, EntryContext>();
  const controllers = new Map<string, TaskController>();
  let streamPublishTimer: ReturnType<typeof setTimeout> | undefined;
  function runningSite(): string | null {
    return (
      [...controllers].find(
        ([, controller]) =>
          controller.isBusy() ||
          ['running', 'waiting-user', 'verifying'].includes(controller.state.status),
      )?.[0] ?? null
    );
  }
  function snapshot(): WorkspaceSnapshot {
    return {
      workspace,
      contexts: [...contexts.values()],
      pages: pages.all(),
      activeSiteId,
      runningSiteId: runningSite(),
      runtimeConfigured: configured,
      preview: false,
    };
  }
  function publish(): void {
    clearTimeout(streamPublishTimer);
    streamPublishTimer = undefined;
    if (!window.isDestroyed()) window.webContents.send('deskwork:state', snapshot());
  }
  function publishStream(): void {
    streamPublishTimer ??= setTimeout(publish, 80);
  }
  async function persist(): Promise<void> {
    await store.save([...contexts.values()]);
    publish();
  }
  const pages = new Pages(window, publish, (siteId) => {
    if (closing) return;
    const controller = controllers.get(siteId);
    if (
      controller &&
      (controller.isBusy() ||
        ['running', 'waiting-user', 'verifying'].includes(controller.state.status))
    ) {
      void controller
        .stop()
        .then(stopRuntime)
        .catch((error: unknown) => {
          console.error(error);
        });
    }
  });
  const browser = new ElectronBrowser(
    (target, pageId) => pages.resolve(target, pageId),
    (target) => pages.list(target),
    (target, pageId) => {
      pages.select(target, pageId);
    },
  );
  function addContext(site: Site, restored?: EntryContext): void {
    const context = restored ?? { siteId: site.id, task: idleTask(), messages: [] };
    contexts.set(site.id, context);
    const controller = new TaskController(
      browser,
      async (state) => {
        context.task = state;
        await persist();
      },
      context.task,
    );
    context.task = controller.state;
    controllers.set(site.id, controller);
  }
  for (const site of workspace.sites) {
    addContext(
      site,
      saved.find((context) => context.siteId === site.id),
    );
    pages.add(site);
  }
  pages.setActiveSite(activeSiteId);
  const tools = await startToolServer(async (request) => {
    const siteId = runningSite();
    const controller = siteId ? controllers.get(siteId) : undefined;
    if (!controller || controller.state.status !== 'running')
      throw new Error('任务工具已暂停或正在等待确认');
    controller.state.metrics.toolCalls++;
    switch (request.name) {
      case 'observe_page':
        return controller.observe(request.arguments.pageId).finally(publish);
      case 'request_takeover':
        await controller.stop();
        controller.state.detail = request.arguments.reason;
        await controller.save();
        return { status: 'waiting-for-user-takeover' };
      case 'verify_result':
        return controller.verify().finally(publish);
      case 'act_on_page':
        return controller.propose(request.arguments).finally(publish);
      case 'list_pages':
        return { pages: browser.pages(controller.target()) };
      case 'select_page':
        browser.selectPage(controller.target(), request.arguments.pageId);
        return { selected: request.arguments.pageId };
      case 'capture_page':
        return { image: await browser.screenshot(controller.target(), request.arguments.pageId) };
    }
  });
  async function stopRuntime(): Promise<void> {
    runtimeGeneration++;
    tools.revoke();
    const previous = runtime;
    runtime = undefined;
    await previous?.close();
  }
  async function launchRuntime(siteId: string, text: string): Promise<void> {
    const controller = controllers.get(siteId);
    const context = contexts.get(siteId);
    if (!controller || !context) throw new Error('网站入口不存在');
    const messages = context.messages;
    if (!apiKey) {
      await controller.fail('请在设置中配置 DeepSeek 模型与密钥');
      return;
    }
    if (!runtime) {
      const generation = ++runtimeGeneration;
      const runtimeRoot = app.isPackaged
        ? join(process.resourcesPath, 'app.asar.unpacked')
        : app.getAppPath();
      runtime = new DshRuntime({
        executable: process.execPath,
        cliPath: join(runtimeRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
        mcpPath: join(runtimeRoot, 'dist/runtime/mcp-server.mjs'),
        dataDirectory: join(directory, 'runtime', siteId),
        apiKey,
        model,
        ...(testModelURL ? { baseURL: testModelURL } : {}),
        toolEndpoint: tools.endpoint,
        toolToken: tools.token,
        recoveryContext: [
          ...messages,
          {
            role: 'assistant',
            text: `宿主状态：${JSON.stringify({ target: controller.state.target, requiresVerification: controller.state.requiresVerification, detail: controller.state.detail })}`,
          },
        ],
        onNotification: (method, raw): void => {
          if (generation !== runtimeGeneration) return;
          const handle = async (): Promise<void> => {
            if (method === 'session.event') {
              const event = z
                .object({
                  sessionId: z.string(),
                  event: z.object({ type: z.string(), data: z.unknown() }),
                })
                .safeParse(raw);
              if (!event.success) return;
              if (event.data.sessionId !== controller.state.id) return;
              if (event.data.event.type === 'step/start') {
                controller.state.metrics.modelCalls++;
                publish();
              }
              if (event.data.event.type === 'turn/end') {
                const end = z
                  .object({
                    reason: z.object({
                      kind: z.string(),
                      error: z.object({ message: z.string() }).optional(),
                    }),
                  })
                  .safeParse(event.data.event.data);
                if (
                  end.success &&
                  ['error', 'max-tokens', 'interrupted'].includes(end.data.reason.kind)
                )
                  await controller.fail(
                    end.data.reason.error?.message ?? '模型本轮未完成，请核对后继续',
                  );
              }
              if (event.data.event.type === 'assistant/chunk') {
                const chunk = z
                  .object({
                    step: z.number(),
                    chunk: z.object({ type: z.string(), text: z.string().optional() }),
                  })
                  .safeParse(event.data.event.data);
                if (
                  chunk.success &&
                  chunk.data.chunk.type === 'text-delta' &&
                  chunk.data.chunk.text
                ) {
                  const id = `dsh-${String(generation)}-${controller.state.id}-${String(chunk.data.step)}`;
                  const existing = messages.find((message) => message.id === id);
                  if (existing) existing.text += chunk.data.chunk.text;
                  else messages.push({ id, role: 'assistant', text: chunk.data.chunk.text });
                  publishStream();
                }
              }
              if (event.data.event.type === 'assistant/message') {
                const message = z
                  .object({
                    step: z.number(),
                    message: z.object({
                      content: z.array(
                        z.object({ type: z.string(), text: z.string().optional() }).loose(),
                      ),
                    }),
                  })
                  .safeParse(event.data.event.data);
                if (message.success) {
                  const text = message.data.message.content
                    .filter((block) => block.type === 'text')
                    .map((block) => block.text ?? '')
                    .join('\n');
                  const id = `dsh-${String(generation)}-${controller.state.id}-${String(message.data.step)}`;
                  const existing = messages.find((entry) => entry.id === id);
                  if (existing) existing.text = text;
                  else if (text) messages.push({ id, role: 'assistant', text });
                  await persist();
                  publish();
                }
              }
            } else if (method === 'session.status') {
              const status = z
                .object({ sessionId: z.string(), status: z.enum(['running', 'idle']) })
                .parse(raw);
              if (status.sessionId === controller.state.id && status.status === 'idle')
                await controller.finish('本轮对话已结束；业务结果以回读核对为准');
            } else if (method === 'deskwork.exit')
              await controller.fail('DSH 已退出，请重新连接后继续');
          };
          void handle().catch((error: unknown) => {
            console.error(
              'Runtime event failed:',
              error instanceof Error ? error.message : 'unknown',
            );
          });
        },
      });
    }
    await runtime.prompt(
      controller.state.id,
      `任务网站：${workspace.sites.find((site) => site.id === siteId)?.url ?? ''}\n${text}`,
    );
  }
  function controllerFor(siteId: string): TaskController {
    const controller = controllers.get(siteId);
    if (!controller) throw new Error('网站入口不存在');
    return controller;
  }
  function requireNoOtherTask(siteId?: string): void {
    const other = runningSite();
    if (other && other !== siteId) throw new Error('另一个网站的任务尚未结束，请先停止或核对结果');
  }
  function requireEditable(siteId: string): void {
    const controller = controllerFor(siteId);
    if (
      controller.isBusy() ||
      ['running', 'waiting-user', 'verifying'].includes(controller.state.status)
    )
      throw new Error('请先停止该入口任务并核对结果，再修改或移除');
  }
  function launch(siteId: string, text: string): void {
    void launchRuntime(siteId, text).catch((error: unknown) => {
      void controllerFor(siteId).fail(error instanceof Error ? error.message : '模型连接失败');
    });
  }
  function requireShell(event: IpcMainInvokeEvent): void {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== pathToFileURL(shellPath).href
    )
      throw new Error('Untrusted IPC sender');
  }
  ipcMain.handle('deskwork:snapshot', (event) => {
    requireShell(event);
    return snapshot();
  });
  let commandBusy = false;
  ipcMain.handle('deskwork:command', async (event, raw: unknown) => {
    requireShell(event);
    const command = commandSchema.parse(raw);
    if (command.type === 'layout') {
      pages.setLayout(activeSiteId, command.visible, command.bounds);
      return;
    }
    if (command.type === 'select-site') {
      controllerFor(command.siteId);
      activeSiteId = command.siteId;
      pages.setActiveSite(activeSiteId);
      publish();
      return;
    }
    if (command.type === 'stop') {
      requireNoOtherTask(command.siteId);
      await controllerFor(command.siteId).stop();
      await stopRuntime();
      return;
    }
    if (commandBusy) throw new Error('正在完成上一步，请稍后再试');
    commandBusy = true;
    try {
      switch (command.type) {
        case 'add-site': {
          if (workspace.sites.length >= 24) throw new Error('MVP 最多配置 24 个网站');
          const site: Site = {
            id: randomUUID(),
            name: command.name.trim() || new URL(command.url).hostname,
            url: command.url,
            sessionId: randomUUID(),
          };
          const updated = workspaceSchema.parse({
            ...workspace,
            sites: [...workspace.sites, site],
          });
          await store.saveWorkspace(updated);
          workspace = updated;
          addContext(site);
          pages.add(site);
          activeSiteId = site.id;
          pages.setActiveSite(activeSiteId);
          await persist();
          break;
        }
        case 'edit-site': {
          requireEditable(command.siteId);
          const site = workspace.sites.find((entry) => entry.id === command.siteId);
          if (!site) throw new Error('网站不存在');
          const updated = {
            ...site,
            url: command.url,
            name: command.name.trim() || new URL(command.url).hostname,
          };
          const next = workspaceSchema.parse({
            ...workspace,
            sites: workspace.sites.map((entry) => (entry.id === site.id ? updated : entry)),
          });
          await store.saveWorkspace(next);
          workspace = next;
          if (site.url !== updated.url) {
            const context = contexts.get(site.id);
            if (context) await store.archiveContext(context);
            addContext(updated);
          }
          await pages.remove(site.id);
          pages.add(updated);
          pages.setActiveSite(activeSiteId);
          await persist();
          break;
        }
        case 'remove-site': {
          requireEditable(command.siteId);
          const context = contexts.get(command.siteId);
          if (context) await store.archiveContext(context);
          const next = {
            ...workspace,
            sites: workspace.sites.filter((site) => site.id !== command.siteId),
          };
          await store.saveWorkspace(next);
          workspace = next;
          await pages.remove(command.siteId);
          contexts.delete(command.siteId);
          controllers.delete(command.siteId);
          if (activeSiteId === command.siteId) activeSiteId = workspace.sites[0]?.id ?? '';
          pages.setActiveSite(activeSiteId);
          await persist();
          break;
        }
        case 'select-page': {
          const site = workspace.sites.find((entry) => entry.id === activeSiteId);
          if (!site) throw new Error('没有选中网站');
          const controller = controllerFor(site.id);
          if (['running', 'waiting-user'].includes(controller.state.status)) {
            await controller.stop();
            await stopRuntime();
          }
          pages.select({ tabId: site.id, sessionId: site.sessionId }, command.pageId);
          break;
        }
        case 'close-page':
          pages.closePopup(command.pageId);
          break;
        case 'reload':
          await pages.reload(command.siteId);
          break;
        case 'settings': {
          requireNoOtherTask();
          if (
            !safeStorage.isEncryptionAvailable() ||
            (process.platform === 'linux' &&
              safeStorage.getSelectedStorageBackend() === 'basic_text')
          )
            throw new Error('系统安全存储不可用');
          await stopRuntime();
          await writeFile(
            join(directory, 'model.json'),
            JSON.stringify({
              model: command.model,
              encryptedKey: safeStorage.encryptString(command.apiKey).toString('base64'),
            }),
            { mode: 0o600 },
          );
          apiKey = command.apiKey;
          model = command.model;
          configured = true;
          publish();
          break;
        }
        case 'send': {
          requireNoOtherTask(command.tabId);
          const controller = controllerFor(command.tabId);
          const site = workspace.sites.find((entry) => entry.id === command.tabId);
          const context = contexts.get(command.tabId);
          if (!site || !context) throw new Error('入口不存在');
          if (!configured) throw new Error('请先配置 DeepSeek 模型与密钥');
          await stopRuntime();
          await controller.start({ tabId: site.id, sessionId: site.sessionId }, command.text);
          context.messages.push({ id: randomUUID(), role: 'user', text: command.text });
          await persist();
          launch(site.id, command.text);
          break;
        }
        case 'confirm': {
          requireNoOtherTask(command.siteId);
          const controller = controllerFor(command.siteId);
          await stopRuntime();
          await controller.confirm(command.confirmationId);
          if (controller.state.status === 'running')
            launch(
              command.siteId,
              `宿主已执行用户确认动作：${JSON.stringify(controller.state.pendingAction?.proposal)}。重新观察页面，继续原任务，不要重复上一动作；如果刚刚是提交，请先 verify_result。`,
            );
          break;
        }
        case 'resume': {
          requireNoOtherTask(command.siteId);
          const controller = controllerFor(command.siteId);
          await stopRuntime();
          await controller.resume();
          if (controller.state.status === 'running')
            launch(
              command.siteId,
              `恢复任务，先重新观察；旧确认失效。原目标：${controller.state.title}`,
            );
          break;
        }
        case 'resolve-result':
          await controllerFor(command.siteId).resolveResult(command.outcome);
          await stopRuntime();
          break;
        case 'new-task': {
          requireEditable(command.siteId);
          const context = contexts.get(command.siteId);
          const site = workspace.sites.find((entry) => entry.id === command.siteId);
          if (!context || !site) throw new Error('入口不存在');
          await store.archiveContext(context);
          addContext(site);
          await persist();
          break;
        }
      }
    } finally {
      commandBusy = false;
      publish();
    }
  });
  window.on('close', (event) => {
    if (closing) return;
    event.preventDefault();
    closing = true;
    const cleanup = async (): Promise<void> => {
      for (const controller of controllers.values())
        if (['running', 'waiting-user'].includes(controller.state.status)) await controller.stop();
      await stopRuntime();
      await tools.close();
      await persist();
      await pages.close();
      window.destroy();
      app.quit();
    };
    void cleanup().catch((error: unknown) => {
      console.error(error);
      app.exit(1);
    });
  });
  await window.loadFile(shellPath);
}
void main().catch((error: unknown) => {
  console.error(error);
  app.exit(1);
});
