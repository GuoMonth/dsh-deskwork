import { contextBridge, ipcRenderer } from 'electron';
import { commandSchema, snapshotSchema } from '../core/contracts.ts';
import type { DeskworkBridge, WorkspaceCommand, WorkspaceSnapshot } from '../core/contracts.ts';

const bridge: DeskworkBridge = {
  snapshot: async (): Promise<WorkspaceSnapshot> => {
    const raw: unknown = await ipcRenderer.invoke('deskwork:snapshot');
    return snapshotSchema.parse(raw);
  },
  command: async (command: WorkspaceCommand): Promise<void> => {
    await ipcRenderer.invoke('deskwork:command', commandSchema.parse(command));
  },
  subscribe: (listener): (() => void) => {
    const receive = (_event: Electron.IpcRendererEvent, raw: unknown): void => {
      listener(snapshotSchema.parse(raw));
    };
    ipcRenderer.on('deskwork:state', receive);
    return () => {
      ipcRenderer.removeListener('deskwork:state', receive);
    };
  },
};
contextBridge.exposeInMainWorld('deskwork', bridge);
