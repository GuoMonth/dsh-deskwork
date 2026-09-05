import { app, BrowserWindow, WebContentsView, ipcMain, safeStorage, Menu } from 'electron';
import type { IpcMainInvokeEvent, WebContents } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { commandSchema, defaultWorkspace, idleTask, workspaceSchema } from '../core/contracts.ts';
import type {
  BusinessRecord,
  ChatMessage,
  Site,
  TaskTarget,
  WorkspaceSnapshot,
} from '../core/contracts.ts';
import { SkillLedger } from '../core/skill-ledger.ts';
import { TaskController } from '../core/task-controller.ts';
import { ElectronRecordBrowser } from '../browser/electron-browser.ts';
import { fixtureProfile, recordProfileSchema } from '../browser/record-profile.ts';
import { StateStore } from './state-store.ts';
import { startErpFixture } from './erp-fixture.ts';
import { startToolServer } from '../runtime/tool-server.ts';
import { DshRuntime } from '../runtime/dsh-runtime.ts';

const profileArgument = process.argv.find((argument) =>
  argument.startsWith('--profile-directory='),
);
if (profileArgument) app.setPath('userData', profileArgument.slice('--profile-directory='.length));
const fixtureMode = process.argv.includes('--fixture');
const fixtureAgent = process.argv.includes('--fixture-agent');
if (fixtureAgent && !fixtureMode)
  throw new Error('Fixture agent requires an explicit local fixture');

async function main(): Promise<void> {
  await app.whenReady();
  const directory = app.getPath('userData');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const fixture = fixtureMode
    ? await startErpFixture(directory, Number(process.env['DESKWORK_FIXTURE_PORT'] ?? 0))
    : undefined;
  let workspace = defaultWorkspace;
  try {
    workspace = workspaceSchema.parse(
      JSON.parse(await readFile(join(directory, 'workspace.json'), 'utf8')),
    );
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  if (fixture)
    workspace = {
      version: 1,
      name: '本地验证工作区',
      sites: [
        {
          id: 'fixture',
          name: '本地 ERP · 测试店铺',
          url: `${fixture.origin}/products`,
          sessionId: 'fixture',
          profileId: 'fixture',
        },
      ],
    };
  const profiles = new Map<string, z.infer<typeof recordProfileSchema>>();
  if (fixture) profiles.set('fixture', fixtureProfile(fixture.origin));
  try {
    const raw: unknown = JSON.parse(
      await readFile(join(directory, 'record-profiles.json'), 'utf8'),
    );
    for (const profile of z.array(recordProfileSchema).parse(raw))
      profiles.set(profile.id, profile);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
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
  const views = new Map<string, WebContentsView>();
  let visibleTab = workspace.sites[0]?.id ?? '';
  let latestBounds = { x: 204, y: 182, width: 800, height: 734 };
  let browserVisible = true;
  const resolve = (target: TaskTarget): WebContents => {
    const site = workspace.sites.find((entry) => entry.id === target.tabId);
    const view = views.get(target.tabId);
    if (
      !view ||
      !site ||
      site.sessionId !== target.sessionId ||
      site.profileId !== target.profileId
    )
      throw new Error('任务目标会话不匹配');
    return view.webContents;
  };
  const layout = (): void => {
    const bounds = window.getContentBounds();
    for (const [id, view] of views) {
      view.setVisible(browserVisible && id === visibleTab);
      if (id === visibleTab)
        view.setBounds({
          x: latestBounds.x,
          y: latestBounds.y,
          width: Math.max(0, Math.min(latestBounds.width, bounds.width - latestBounds.x)),
          height: Math.max(0, Math.min(latestBounds.height, bounds.height - latestBounds.y)),
        });
    }
  };
  const addView = (site: Site): void => {
    const view = new WebContentsView({
      webPreferences: {
        partition: `persist:deskwork-${site.sessionId}`,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    views.set(site.id, view);
    window.contentView.addChildView(view);
    view.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false);
    });
    view.webContents.session.setPermissionCheckHandler(() => false);
    view.webContents.on('will-navigate', (event, url) => {
      if (!['https:', 'http:'].includes(new URL(url).protocol)) event.preventDefault();
    });
    view.webContents.setWindowOpenHandler(({ url }) => {
      if (['https:', 'http:'].includes(new URL(url).protocol) && workspace.sites.length < 12) {
        const popup = { ...site, id: `popup-${randomUUID()}`, name: `${site.name} · 新页面`, url };
        workspace = { ...workspace, sites: [...workspace.sites, popup] };
        addView(popup);
        publish();
      }
      return { action: 'deny' };
    });
    void view.webContents.loadURL(site.url).catch((error: unknown) => {
      console.error(
        'Business page load failed:',
        error instanceof Error ? error.message : 'unknown',
      );
    });
    layout();
  };
  const store = new StateStore(directory);
  const saved = await store.load();
  let messages: ChatMessage[] = saved?.messages ?? [];
  let configured = fixtureAgent;
  let runtime: DshRuntime | undefined;
  let runtimeGeneration = 0;
  let model = 'deepseek-v4-flash';
  let apiKey = '';
  const settingsSchema = z.object({ model: z.string(), encryptedKey: z.string() }).strict();
  try {
    const settings = settingsSchema.parse(
      JSON.parse(await readFile(join(directory, 'model.json'), 'utf8')),
    );
    apiKey = safeStorage.decryptString(Buffer.from(settings.encryptedKey, 'base64'));
    model = settings.model;
    configured = true;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
      console.error('Stored model configuration unavailable; configure again.');
  }
  let ledger = new SkillLedger();
  try {
    ledger = new SkillLedger(JSON.parse(await readFile(join(directory, 'skills.json'), 'utf8')));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  const browser = new ElectronRecordBrowser(resolve, profiles);
  const recordBrowser = {
    read: async (
      target: TaskTarget,
      objectId: string,
      source?: 'page' | 'server',
    ): Promise<BusinessRecord> => {
      const record = await browser.read(target, objectId, source);
      controller.state.metrics.skillReused ||= ledger.canReuse(target, record);
      return record;
    },
    write: (target: TaskTarget, record: BusinessRecord, value: string): Promise<void> =>
      browser.write(target, record, value),
  };
  const controller = new TaskController(
    recordBrowser,
    async (state) => {
      await store.save(state, messages);
      publish();
    },
    saved?.task,
  );
  function snapshot(): WorkspaceSnapshot {
    return {
      workspace,
      task: controller.state,
      messages,
      runtimeConfigured: configured,
      preview: false,
    };
  }
  let streamPublishTimer: ReturnType<typeof setTimeout> | undefined;
  function publish(): void {
    clearTimeout(streamPublishTimer);
    streamPublishTimer = undefined;
    if (!window.isDestroyed() && !window.webContents.isDestroyed())
      window.webContents.send('deskwork:state', snapshot());
  }
  function publishStream(): void {
    streamPublishTimer ??= setTimeout(publish, 80);
  }
  const tools = await startToolServer(async (request) => {
    if (controller.state.status !== 'running' || !controller.state.target)
      throw new Error('任务工具已撤销或正在等待确认');
    controller.state.metrics.toolCalls++;
    switch (request.name) {
      case 'observe_page': {
        const target = controller.state.target;
        const taskId = controller.state.id;
        const result = await browser.observe(target);
        if (controller.state.id !== taskId || !['running'].includes(controller.state.status))
          throw new Error('任务已停止');
        await controller.step('已观察当前业务页面');
        return { page: result };
      }
      case 'read_record':
        return controller.read(request.arguments.objectId);
      case 'propose_record_change':
        await controller.propose(request.arguments.objectId, request.arguments.nextValue);
        return { status: 'waiting-for-human-confirmation', saved: false };
    }
  });
  const stopRuntime = async (): Promise<void> => {
    runtimeGeneration++;
    tools.revoke();
    const previous = runtime;
    runtime = undefined;
    await previous?.close();
  };
  const launchRuntime = async (text: string): Promise<void> => {
    if (fixtureAgent) {
      await controller.read('SG-1001');
      if (/修改|备注|更新/.test(text))
        await controller.propose('SG-1001', '优选果，到货后优先检查品质');
      else await controller.finish('夹具查询完成');
      return;
    }
    if (!apiKey) {
      await controller.fail('请在设置中配置 DeepSeek API 密钥后继续');
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
        dataDirectory: join(directory, 'runtime'),
        apiKey,
        model,
        toolEndpoint: tools.endpoint,
        toolToken: tools.token,
        recoveryContext: [
          ...messages,
          {
            role: 'assistant',
            text: `已核对的业务事实：${JSON.stringify({ target: controller.state.target, result: controller.state.result, writeVerified: controller.state.writeVerified })}`,
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
                  const id = `dsh-${controller.state.id}-${String(chunk.data.step)}`;
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
                  const id = `dsh-${controller.state.id}-${String(message.data.step)}`;
                  const existing = messages.find((entry) => entry.id === id);
                  if (existing) existing.text = text;
                  else if (text) messages.push({ id, role: 'assistant', text });
                  await store.save(controller.state, messages);
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
    const context = controller.state.target;
    await runtime.prompt(controller.state.id, `任务绑定：${JSON.stringify(context)}\n${text}`);
  };

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
  ipcMain.handle('deskwork:command', async (event, raw: unknown) => {
    requireShell(event);
    const command = commandSchema.parse(raw);
    switch (command.type) {
      case 'layout':
        if (!views.has(command.tabId)) throw new Error('Unknown tab');
        visibleTab = command.tabId;
        latestBounds = command.bounds;
        browserVisible = command.visible;
        layout();
        break;
      case 'reload': {
        const view = views.get(command.tabId);
        if (!view) throw new Error('Unknown tab');
        view.webContents.reload();
        break;
      }
      case 'settings':
        if (['running', 'waiting-user', 'verifying'].includes(controller.state.status))
          throw new Error('请先停止当前任务再更换模型配置');
        if (
          !safeStorage.isEncryptionAvailable() ||
          (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text')
        )
          throw new Error('系统安全存储不可用，无法保存密钥');
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
      case 'send': {
        if (['running', 'waiting-user', 'verifying'].includes(controller.state.status))
          throw new Error('当前会话已有任务');
        const site = workspace.sites.find((entry) => entry.id === command.tabId);
        if (!site) throw new Error('Unknown tab');
        await stopRuntime();
        await controller.start(
          { tabId: site.id, sessionId: site.sessionId, profileId: site.profileId },
          command.text,
        );
        messages.push({ id: randomUUID(), role: 'user', text: command.text });
        await store.save(controller.state, messages);
        publish();
        void launchRuntime(command.text).catch((error: unknown) => {
          void controller.fail(error instanceof Error ? error.message : 'DSH 连接失败');
        });
        break;
      }
      case 'confirm':
        await controller.confirm(command.confirmationId);
        await stopRuntime();
        if (controller.state.writeVerified && controller.state.result && controller.state.target) {
          const entries = ledger.verified(
            controller.state.target,
            controller.state.result,
            controller.state.metrics,
          );
          await writeFile(join(directory, 'skills.json'), JSON.stringify(entries), {
            mode: 0o600,
            flush: true,
          });
          messages.push({
            id: randomUUID(),
            role: 'assistant',
            text: `Deskwork 已保存并回读核对：${JSON.stringify(controller.state.result)}`,
          });
          await store.save(controller.state, messages);
          publish();
        }
        break;
      case 'stop':
        await controller.stop();
        await stopRuntime();
        break;
      case 'resume':
        await controller.resume();
        if (controller.state.status === 'running') {
          await stopRuntime();
          void launchRuntime(
            `恢复任务。先重新观察页面并核对身份，不能复用旧确认。原目标：${controller.state.title}`,
          ).catch((error: unknown) => {
            void controller.fail(error instanceof Error ? error.message : '恢复失败');
          });
        }
        break;
      case 'new-task':
        if (['running', 'waiting-user', 'verifying'].includes(controller.state.status))
          throw new Error('请先结束当前任务');
        await stopRuntime();
        controller.state = idleTask();
        messages = [];
        await store.save(controller.state, messages);
        publish();
        break;
    }
  });
  for (const site of workspace.sites) addView(site);
  window.on('resize', layout);
  let closing = false;
  window.on('close', (event) => {
    if (closing) return;
    event.preventDefault();
    closing = true;
    const cleanup = async (): Promise<void> => {
      if (['running', 'waiting-user', 'verifying'].includes(controller.state.status))
        await controller.stop();
      await stopRuntime();
      await tools.close();
      for (const view of views.values()) {
        await view.webContents.session.cookies.flushStore();
        view.webContents.session.flushStorageData();
        view.webContents.close();
      }
      await fixture?.close();
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
