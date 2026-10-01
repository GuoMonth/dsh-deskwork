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
      case 'language':
        snapshot.workspace.locale = command.locale;
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
          detail: 'Preview: observing the page',
        };
        snapshot.runningSiteId = site.id;
        emit();
        await new Promise<void>((resolve) => setTimeout(resolve, 700));
        if (current.task.status !== 'running') return;
        if (/fail|失败/i.test(command.text)) {
          current.task.status = 'failed';
          current.task.detail = 'Preview: cannot locate the page. Check it and retry.';
          snapshot.runningSiteId = null;
        } else if (/confirm|确认/i.test(command.text)) {
          const observation = {
            pageId: 'preview-page',
            revision: 'preview',
            url: site.url,
            title: site.name,
            text: 'Interactive preview',
            elements: [],
          };
          current.task.status = 'waiting-user';
          current.task.detail = 'Preview: review the action to execute';
          current.task.confirmation = {
            id: crypto.randomUUID(),
            observation,
            proposal: {
              pageId: 'preview-page',
              revision: 'preview',
              action: { kind: 'click', ref: 'e0' },
              risk: 'consequential',
              summary: 'Submit the reviewed content on this page (interactive example)',
            },
          };
        } else {
          current.task.status = 'succeeded';
          current.task.detail = 'Preview: query complete';
          snapshot.runningSiteId = null;
        }
        current.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'This is an interactive workspace preview. The desktop app reads your configured websites and shows the actual execution steps here.',
        });
        break;
      }
      case 'confirm':
        if (context?.task.confirmation?.id === command.confirmationId) {
          context.task.confirmation = null;
          context.task.requiresVerification = true;
          context.task.status = 'verifying';
          context.task.detail = 'Preview: verify the result on the original page';
        }
        break;
      case 'stop':
        if (context) {
          context.task.status = context.task.requiresVerification ? 'verifying' : 'paused';
          context.task.confirmation = null;
          context.task.detail = 'Stopped. You can take over the page';
          snapshot.runningSiteId = context.task.requiresVerification ? siteId : null;
        }
        break;
      case 'resume':
        if (context) {
          context.task.status = 'succeeded';
          context.task.detail = 'Preview: observation complete';
          snapshot.runningSiteId = null;
        }
        break;
      case 'resolve-result':
        if (context) {
          context.task.status = command.outcome === 'verified' ? 'succeeded' : 'paused';
          context.task.requiresVerification = false;
          context.task.detail = 'Preview: result reviewed';
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
    development: {
      state: () => Promise.resolve({ connected: false, siteId: null, configuration: '' }),
      start: () => Promise.reject(new Error('Start a development connection in the desktop app')),
      stop: () => Promise.resolve(),
    },
    plugins: {
      state: () =>
        Promise.resolve({
          installed: [],
          busy: false,
          progress: 'The preview does not install plugins',
        }),
      search: () => Promise.resolve([]),
      command: () => Promise.reject(new Error('Install plugins in the desktop app')),
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
