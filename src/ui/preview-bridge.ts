import { defaultWorkspace, idleTask } from '../core/contracts.ts';
import type { DeskworkBridge, WorkspaceSnapshot, WorkspaceCommand } from '../core/contracts.ts';

export function createPreviewBridge(): DeskworkBridge {
  let snapshot: WorkspaceSnapshot = {
    workspace: defaultWorkspace,
    task: idleTask(),
    messages: [],
    runtimeConfigured: false,
    preview: true,
  };
  const listeners = new Set<(state: WorkspaceSnapshot) => void>();
  function emit(): void {
    for (const listener of listeners) listener(structuredClone(snapshot));
  }
  const record = {
    shopId: '演示档口',
    objectId: 'SG-1001',
    name: '山东红富士苹果',
    field: '备注',
    value: '优选果，常温存放',
    pageRevision: 'preview-v1',
  };
  async function command(command: WorkspaceCommand): Promise<void> {
    switch (command.type) {
      case 'send':
        snapshot.messages.push({ id: crypto.randomUUID(), role: 'user', text: command.text });
        snapshot.task = {
          ...idleTask(),
          id: crypto.randomUUID(),
          title: command.text,
          status: 'running',
          target: { tabId: command.tabId, sessionId: 'senguo', profileId: 'preview' },
          detail: '正在读取商品资料',
          steps: [{ id: 'read', text: '读取当前店铺与商品资料' }],
        };
        emit();
        await new Promise<void>((resolve) => setTimeout(resolve, 700));
        if (snapshot.task.status !== 'running') return;
        snapshot.task = {
          ...snapshot.task,
          status: 'waiting-user',
          detail: '请核对以下修改',
          confirmation: {
            id: crypto.randomUUID(),
            record,
            nextValue: '优选果，到货后优先检查品质',
          },
        };
        snapshot.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: '已找到山东红富士苹果。以下是准备的备注修改，确认后才会保存。',
        });
        break;
      case 'confirm':
        if (snapshot.task.confirmation?.id !== command.confirmationId)
          throw new Error('确认已失效');
        snapshot.task = {
          ...snapshot.task,
          status: 'succeeded',
          writeVerified: true,
          detail: '预览：保存完成，已回读核对',
          result: { ...record, value: snapshot.task.confirmation.nextValue },
          confirmation: null,
          steps: [...snapshot.task.steps, { id: 'verify', text: '保存并回读核对结果' }],
        };
        snapshot.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          text: '商品备注已更新。你可以在业务页面核对，也可以继续处理下一件事。',
        });
        break;
      case 'stop':
        snapshot.task = {
          ...snapshot.task,
          status: 'paused',
          confirmation: null,
          detail: '已停止，你可以接手页面',
        };
        break;
      case 'resume':
        snapshot.task = {
          ...snapshot.task,
          status: 'failed',
          detail: '预览：页面内容已变化，请重新选择商品',
        };
        break;
      case 'new-task':
        snapshot = { ...snapshot, task: idleTask(), messages: [] };
        break;
      case 'settings':
        snapshot.runtimeConfigured = true;
        break;
      case 'reload':
      case 'layout':
        return;
    }
    emit();
  }
  return {
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
