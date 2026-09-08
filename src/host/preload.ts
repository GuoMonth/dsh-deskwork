import { z } from 'zod';
import {
  pluginStateSchema,
  marketPluginSchema,
  pluginCommandSchema,
} from '../core/plugin-contracts.ts';
import { contextBridge, ipcRenderer } from 'electron';
import { commandSchema, snapshotSchema } from '../core/contracts.ts';
import type { DeskworkBridge, WorkspaceCommand, WorkspaceSnapshot } from '../core/contracts.ts';

const bridge: DeskworkBridge = {
  plugins: {
    state: async () => {
      const raw: unknown = await ipcRenderer.invoke('deskwork:plugins');
      return pluginStateSchema.parse(raw);
    },
    search: async (query) => {
      const raw: unknown = await ipcRenderer.invoke('deskwork:plugin-search', query);
      return z.array(marketPluginSchema).parse(raw);
    },
    command: async (command) => {
      await ipcRenderer.invoke('deskwork:plugin-command', pluginCommandSchema.parse(command));
    },
  },
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
