import { defaultWorkspace, idleTask } from '../core/contracts.ts';
import type { DeskworkBridge, WorkspaceSnapshot, WorkspaceCommand } from '../core/contracts.ts';
export function createPreviewBridge(): DeskworkBridge {
  const snapshot: WorkspaceSnapshot = {
    workspace: structuredClone(defaultWorkspace),
    contexts: [],
    pages: [],
    activeSiteId: '',
    runningSiteId: null,
    runtimeConfigured: false,
    preview: true,
  };
  const listeners = new Set<(state: WorkspaceSnapshot) => void>();
  function emit(): void {
    for (const listener of listeners) listener(structuredClone(snapshot));
  }
  async function command(command: WorkspaceCommand): Promise<void> {
    const siteId = 'siteId' in command ? command.siteId : snapshot.activeSiteId;
    const context = snapshot.contexts.find((entry) => entry.siteId === siteId);
    switch (command.type) {
      case 'add-site': {
        const id = crypto.randomUUID();
        snapshot.workspace.sites.push({
          id,
          name: command.name.trim() || new URL(command.url).hostname,
          url: command.url,
          sessionId: id,
        });
        snapshot.contexts.push({ siteId: id, task: idleTask(), messages: [] });
        snapshot.activeSiteId = id;
        break;
      }
      case 'edit-site': {
        const site = snapshot.workspace.sites.find((entry) => entry.id === siteId);
        if (site) {
          site.name = command.name.trim() || new URL(command.url).hostname;
          site.url = command.url;
        }
        break;
      }
      case 'remove-site':
        snapshot.workspace.sites = snapshot.workspace.sites.filter((entry) => entry.id !== siteId);
        snapshot.contexts = snapshot.contexts.filter((entry) => entry.siteId !== siteId);
        snapshot.activeSiteId = snapshot.workspace.sites[0]?.id ?? '';
        break;
      case 'select-site':
        snapshot.activeSiteId = siteId;
        break;
      case 'settings':
        snapshot.runtimeConfigured = true;
        break;
      case 'send': {
        const current = snapshot.contexts.find((entry) => entry.siteId === command.tabId);
        const site = snapshot.workspace.sites.find((entry) => entry.id === command.tabId);
        if (!current || !site) return;
        current.messages.push({ id: crypto.randomUUID(), role: 'user', text: command.text });
        current.task = {
          ...idleTask(),
          id: crypto.randomUUID(),
          status: 'running',
          title: command.text,
          target: { tabId: site.id, sessionId: site.sessionId },
          detail: '交互预览：正在观察页面',
        };
        snapshot.runningSiteId = site.id;
        emit();
        await new Promise<void>((resolve) => setTimeout(resolve, 700));
        if (current.task.status !== 'running') return;
        if (/失败/.test(command.text)) {
          current.task.status = 'failed';
          current.task.detail = '预览：页面无法定位，请查看页面后重试';
          snapshot.runningSiteId = null;
        } else if (/确认/.test(command.text)) {
          const observation = {
            pageId: 'preview-page',
            revision: 'preview',
            url: site.url,
            title: site.name,
            text: '交互预览',
            elements: [],
          };
          current.task.status = 'waiting-user';
          current.task.detail = '预览：请核对即将执行的动作';
          current.task.confirmation = {
            id: crypto.randomUUID(),
            observation,
            proposal: {
              pageId: 'preview-page',
              revision: 'preview',
              action: { kind: 'click', ref: 'e0' },
              risk: 'consequential',
              summary: '提交当前页面中已核对的内容（交互示例）',
            },
          };
        } else {
          current.task.status = 'succeeded';
          current.task.detail = '预览：查询完成';
          snapshot.runningSiteId = null;
        }
        current.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: '这是工作台交互预览。桌面客户端会在这里读取你配置的网站，并显示实际操作步骤。',
        });
        break;
      }
      case 'confirm':
        if (context?.task.confirmation?.id === command.confirmationId) {
          context.task.confirmation = null;
          context.task.requiresVerification = true;
          context.task.status = 'verifying';
          context.task.detail = '预览：请在原页面核对结果';
        }
        break;
      case 'stop':
        if (context) {
          context.task.status = context.task.requiresVerification ? 'verifying' : 'paused';
          context.task.confirmation = null;
          context.task.detail = '已停止，可以接手页面';
          snapshot.runningSiteId = context.task.requiresVerification ? siteId : null;
        }
        break;
      case 'resume':
        if (context) {
          context.task.status = 'succeeded';
          context.task.detail = '预览：重新观察完成';
          snapshot.runningSiteId = null;
        }
        break;
      case 'resolve-result':
        if (context) {
          context.task.status = command.outcome === 'verified' ? 'succeeded' : 'paused';
          context.task.requiresVerification = false;
          context.task.detail = '预览：用户已核对';
          snapshot.runningSiteId = null;
        }
        break;
      case 'new-task':
        if (context) {
          context.task = idleTask();
          context.messages = [];
        }
        break;
      case 'layout':
      case 'reload':
      case 'select-page':
      case 'close-page':
        return;
    }
    emit();
  }
  return {
    plugins: {
      state: () => Promise.resolve({ installed: [], busy: false, progress: '交互预览不安装插件' }),
      search: () => Promise.resolve([]),
      command: () => Promise.reject(new Error('请在桌面客户端安装插件')),
    },
    snapshot: () => Promise.resolve(structuredClone(snapshot)),
    command,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
