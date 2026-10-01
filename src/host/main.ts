import { localizeMessage } from '../core/locale.ts';
import { readRuntimeDescriptor } from '../runtime/desktop-runtime.ts';
import { DevelopmentSession } from './development-session.ts';
import type { DevelopmentState } from '../core/development-contracts.ts';
import { PluginManager } from './plugin-manager.ts';
import { PluginMarket } from './plugin-market.ts';
import { pluginCommandSchema } from '../core/plugin-contracts.ts';
import { app, BrowserWindow, ipcMain, safeStorage, Menu, dialog } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { commandSchema, idleTask, workspaceSchema, identifier } from '../core/contracts.ts';
import type { EntryContext, Site, WorkspaceSnapshot } from '../core/contracts.ts';
import { TaskController } from '../core/task-controller.ts';
import { ElectronBrowser } from '../browser/electron-browser.ts';
import { StateStore } from './state-store.ts';
import { Pages } from './pages.ts';
import { startToolServer } from '../runtime/tool-server.ts';
import { DshRuntime } from '../runtime/dsh-runtime.ts';
import { shellLocation } from './shell-location.ts';

const profileArgument = process.argv.find((argument) =>
  argument.startsWith('--profile-directory='),
);
if (profileArgument) app.setPath('userData', profileArgument.slice('--profile-directory='.length));
async function main(): Promise<void> {
  await app.whenReady();
  const developmentUrl = process.argv
    .find((argument) => argument.startsWith('--dev-server-url='))
    ?.slice('--dev-server-url='.length);
  const shellURL = shellLocation(app.getAppPath(), app.isPackaged, developmentUrl);
  const directory = app.getPath('userData');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const connectionPath = join(directory, 'development-connection.json');
  await rm(connectionPath, { force: true });
  let development: DevelopmentSession | undefined;
  const runtimeRoot = app.isPackaged ? join(process.resourcesPath, 'runtime') : app.getAppPath();
  if (app.isPackaged) {
    const descriptor = await readRuntimeDescriptor(runtimeRoot);
    if (
      descriptor.appVersion !== app.getVersion() ||
      descriptor.electronVersion !== process.versions.electron
    )
      throw new Error('The application version does not match its bundled runtime');
  }
  const plugins = new PluginManager({
    directory: join(directory, 'plugins'),
    executable: process.execPath,
    cliPath: join(runtimeRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
    pnpmPath: join(runtimeRoot, 'node_modules/pnpm/bin/pnpm.cjs'),
    validate: async (home, plugin): Promise<void> => {
      const probeBridge = await startToolServer(() =>
        Promise.reject(new Error('Installation verification has no running website task')),
      );
      const probe = new DshRuntime({
        executable: process.execPath,
        cliPath: join(runtimeRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
        mcpPath: join(runtimeRoot, 'dist/runtime/mcp-server.mjs'),
        dataDirectory: home,
        plugins: [plugin],
        apiKey: 'installation-probe',
        model: 'deepseek-v4-flash',
        toolEndpoint: probeBridge.endpoint,
        toolToken: probeBridge.token,
        onNotification: (): void => {},
      });
      try {
        await probe.start();
      } finally {
        await probe.close();
        await probeBridge.close();
      }
    },
  });
  await plugins.load();
  const market = new PluginMarket();
  const store = new StateStore(directory);
  let workspace = await store.loadWorkspace();
  const saved = await store.load();
  let activeSiteId = workspace.sites[0]?.id ?? '';
  let closing = false;
  let runtime: DshRuntime | undefined;
  let runtimeGeneration = 0;
  const nativeApprovals = new Set<AbortController>();
  let model = 'deepseek-v4-flash';
  let apiKey = '';
  let configured = false;
  const testModelArgument = process.argv.find((argument) =>
    argument.startsWith('--test-model-url='),
  );
  const testModelURL = testModelArgument?.slice('--test-model-url='.length);
  if (testModelURL) {
    if (new URL(testModelURL).hostname !== '127.0.0.1')
      throw new Error('The test model must use a local endpoint');
    apiKey = 'fixture-key-not-a-secret';
    configured = true;
  } else if (developmentUrl && process.env['DESKWORK_DEVELOPMENT_API_KEY']) {
    apiKey = process.env['DESKWORK_DEVELOPMENT_API_KEY'];
    delete process.env['DESKWORK_DEVELOPMENT_API_KEY'];
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
        console.error('Cannot read model settings. Configure them again in Settings.');
    }
  }
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
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== shellURL) event.preventDefault();
  });
  const contexts = new Map<string, EntryContext>();
  const controllers = new Map<string, TaskController>();
  let streamPublishTimer: ReturnType<typeof setTimeout> | undefined;
  function runningSite(): string | null {
    if (development?.active) return development.siteId;
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
      throw new Error('Task tools are paused or waiting for confirmation');
    controller.state.metrics.toolCalls++;
    switch (request.name) {
      case 'native_approval': {
        const generation = runtimeGeneration;
        const cancellation = new AbortController();
        nativeApprovals.add(cancellation);
        try {
          const decision = await dialog.showMessageBox(window, {
            type: 'question',
            title: localizeMessage(workspace.locale, 'Confirm ERP experience update'),
            message: localizeMessage(workspace.locale, 'Allow this one local knowledge update?'),
            detail: request.arguments.reason,
            buttons: ['Cancel', 'Allow once'].map((label) =>
              localizeMessage(workspace.locale, label),
            ),
            defaultId: 0,
            cancelId: 0,
            signal: cancellation.signal,
          });
          return {
            outcome:
              cancellation.signal.aborted ||
              generation !== runtimeGeneration ||
              controllers.get(siteId ?? '')?.state.status !== 'running'
                ? 'cancelled'
                : decision.response === 1
                  ? 'allowed-once'
                  : 'rejected',
          };
        } finally {
          nativeApprovals.delete(cancellation);
        }
      }
      case 'plugin_action': {
        const plugin = plugins
          .state()
          .installed.find(
            (entry) =>
              entry.enabled &&
              entry.mountName === request.arguments.mountName &&
              (!entry.siteIds.length || entry.siteIds.includes(siteId ?? '')),
          );
        if (!plugin) throw new Error('The plugin is not mounted on the current task');
        return controller
          .propose(request.arguments.proposal, request.arguments.effect)
          .finally(publish);
      }
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
    for (const pending of nativeApprovals) pending.abort();
    tools.revoke();
    const previous = runtime;
    runtime = undefined;
    await previous?.close();
  }
  async function launchRuntime(siteId: string, text: string): Promise<void> {
    if (development?.active)
      throw new Error('Disconnect the external AI development session first');
    const controller = controllers.get(siteId);
    const context = contexts.get(siteId);
    if (!controller || !context) throw new Error('Website entry not found');
    const messages = context.messages;
    if (!apiKey) {
      await controller.fail('Configure a DeepSeek model and API key in Settings');
      return;
    }
    if (!runtime) {
      const generation = ++runtimeGeneration;
      const selectedPlugins = await plugins.prepareRuntime(
        join(directory, 'runtime', siteId),
        siteId,
      );
      if (generation !== runtimeGeneration || controller.state.status !== 'running') return;
      const runtimeSite = workspace.sites.find((site) => site.id === siteId);
      runtime = new DshRuntime({
        executable: process.execPath,
        cliPath: join(runtimeRoot, 'node_modules/@deepseek-ai/dsh/lib/bin.js'),
        mcpPath: join(runtimeRoot, 'dist/runtime/mcp-server.mjs'),
        dataDirectory: join(directory, 'runtime', siteId),
        apiKey,
        model,
        locale: workspace.locale,
        ...(testModelURL ? { baseURL: testModelURL } : {}),
        toolEndpoint: tools.endpoint,
        toolToken: tools.token,
        plugins: selectedPlugins,
        ...(runtimeSite ? { site: runtimeSite } : {}),
        recoveryContext: [
          ...messages,
          {
            role: 'assistant',
            text: `Host state: ${JSON.stringify({ target: controller.state.target, requiresVerification: controller.state.requiresVerification, detail: controller.state.detail })}`,
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
                    end.data.reason.error?.message ??
                      'The model turn did not finish. Check before continuing.',
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
                await controller.finish(
                  'The conversation turn ended; verify business results by reading them back',
                );
            } else if (method === 'deskwork.exit')
              await controller.fail('DSH exited. Reconnect before continuing.');
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
      `Task website: ${workspace.sites.find((site) => site.id === siteId)?.url ?? ''}\n${text}`,
    );
  }
  function controllerFor(siteId: string): TaskController {
    const controller = controllers.get(siteId);
    if (!controller) throw new Error('Website entry not found');
    return controller;
  }
  function requireNoOtherTask(siteId?: string): void {
    const other = runningSite();
    if (other && other !== siteId)
      throw new Error('A task on another website is active. Stop it or verify its result first.');
  }
  function requireEditable(siteId: string): void {
    if (development?.active && development.siteId === siteId)
      throw new Error('Disconnect the development session first');
    const controller = controllerFor(siteId);
    if (
      controller.isBusy() ||
      ['running', 'waiting-user', 'verifying'].includes(controller.state.status)
    )
      throw new Error('Stop this entry task and verify its result before editing or removing it');
  }
  function launch(siteId: string, text: string): void {
    void launchRuntime(siteId, text).catch((error: unknown) => {
      void controllerFor(siteId).fail(
        error instanceof Error ? error.message : 'Model connection failed',
      );
    });
  }
  function requireShell(event: IpcMainInvokeEvent): void {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== shellURL
    )
      throw new Error('Untrusted IPC sender');
  }
  ipcMain.handle('deskwork:snapshot', (event) => {
    requireShell(event);
    return snapshot();
  });
  function developmentState(): DevelopmentState {
    const connected = development?.active ?? false;
    return {
      connected,
      siteId: connected ? (development?.siteId ?? null) : null,
      configuration: connected
        ? JSON.stringify(
            {
              mcpServers: {
                'deskwork-development': {
                  command: process.execPath,
                  args: [
                    join(runtimeRoot, 'dist/runtime/devkit/lib/cli.js'),
                    'mcp',
                    '--connection',
                    connectionPath,
                  ],
                  env: { ELECTRON_RUN_AS_NODE: '1' },
                },
              },
            },
            null,
            2,
          )
        : '',
    };
  }
  ipcMain.handle('deskwork:development-state', (event) => {
    requireShell(event);
    return developmentState();
  });
  ipcMain.handle('deskwork:development-start', async (event, raw: unknown) => {
    requireShell(event);
    const siteId = identifier.parse(raw);
    requireNoOtherTask();
    if (commandBusy || plugins.state().busy)
      throw new Error('Wait for the current operation to finish');
    const site = workspace.sites.find((entry) => entry.id === siteId);
    if (!site) throw new Error('Development website not found');
    commandBusy = true;
    try {
      await development?.close();
      await stopRuntime();
      const controller = controllerFor(siteId);
      await controller.start(
        { tabId: site.id, sessionId: site.sessionId },
        'External AI plugin development',
      );
      development = new DevelopmentSession(controller, browser, connectionPath, publish);
      try {
        await development.open();
      } catch (error: unknown) {
        await controller.stop();
        throw error;
      }
      return developmentState();
    } finally {
      commandBusy = false;
      publish();
    }
  });
  ipcMain.handle('deskwork:development-stop', async (event) => {
    requireShell(event);
    await development?.stop();
  });
  ipcMain.handle('deskwork:plugins', (event) => {
    requireShell(event);
    return plugins.state();
  });
  ipcMain.handle('deskwork:plugin-search', (event, raw: unknown) => {
    requireShell(event);
    return market.search(z.string().max(200).parse(raw));
  });
  ipcMain.handle('deskwork:plugin-command', async (event, raw: unknown) => {
    requireShell(event);
    const command = pluginCommandSchema.parse(raw);
    requireNoOtherTask();
    if (commandBusy || plugins.state().busy)
      throw new Error('Wait for the current operation to finish');
    if (
      command.action === 'configure' &&
      command.siteIds.some((id) => !workspace.sites.some((site) => site.id === id))
    )
      throw new Error('Mounted website not found');
    commandBusy = true;
    try {
      await stopRuntime();
      await plugins.command(command);
    } finally {
      commandBusy = false;
      publish();
    }
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
      if (development?.siteId === command.siteId) await development.stop();
      requireNoOtherTask(command.siteId);
      await controllerFor(command.siteId).stop();
      await stopRuntime();
      return;
    }
    if (commandBusy) throw new Error('Finishing the previous step. Try again shortly.');
    commandBusy = true;
    try {
      switch (command.type) {
        case 'add-site': {
          if (workspace.sites.length >= 24) throw new Error('The MVP supports up to 24 websites');
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
          if (!site) throw new Error('Website not found');
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
          if (!site) throw new Error('No website selected');
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
        case 'language': {
          const updated = workspaceSchema.parse({ ...workspace, locale: command.locale });
          await store.saveWorkspace(updated);
          workspace = updated;
          publish();
          break;
        }
        case 'settings': {
          requireNoOtherTask();
          if (
            !safeStorage.isEncryptionAvailable() ||
            (process.platform === 'linux' &&
              safeStorage.getSelectedStorageBackend() === 'basic_text')
          )
            throw new Error('System secure storage is unavailable');
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
          if (development?.active)
            throw new Error('Disconnect the external AI development session first');
          requireNoOtherTask(command.tabId);
          const controller = controllerFor(command.tabId);
          const site = workspace.sites.find((entry) => entry.id === command.tabId);
          const context = contexts.get(command.tabId);
          if (!site || !context) throw new Error('Entry not found');
          if (!configured) throw new Error('Configure a DeepSeek model and API key first');
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
          if (controller.state.status === 'running' && !development?.active)
            launch(
              command.siteId,
              `The host executed the action you confirmed: ${JSON.stringify(controller.state.pendingAction?.proposal)}. Observe again and continue the original task without repeating that action. If it was a submission, call verify_result first.`,
            );
          break;
        }
        case 'resume': {
          requireNoOtherTask(command.siteId);
          const controller = controllerFor(command.siteId);
          await stopRuntime();
          await controller.resume();
          if (controller.state.status === 'running' && !development?.active)
            launch(
              command.siteId,
              `Resume the task by observing again; old confirmations are invalid. Original goal: ${controller.state.title}`,
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
          if (!context || !site) throw new Error('Entry not found');
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
      await development?.close();
      await plugins.close();
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
  await window.loadURL(shellURL);
}
void main().catch((error: unknown) => {
  console.error(error);
  app.exit(1);
});
