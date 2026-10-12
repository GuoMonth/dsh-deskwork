import { app, Menu, nativeImage, Tray } from 'electron';
import type { BrowserWindow, MenuItemConstructorOptions, NativeImage } from 'electron';
import { join } from 'node:path';
import type { Locale } from '../core/locale.ts';
import { localizeMessage } from '../core/locale.ts';
import type { TaskStatus } from '../core/contracts.ts';

/** The status shown in the native menus. Development is owned by the host bridge. */
export type DesktopShellTaskStatus = TaskStatus | 'development';

export interface DesktopShellOptions {
  readonly window: BrowserWindow;
  readonly iconDirectory: string;
  readonly getLocale: () => Locale;
  readonly getTaskStatus: () => DesktopShellTaskStatus;
  readonly onQuit: () => Promise<void>;
  /** Optional adapter used by focused tests and host-isolated Electron probes. */
  readonly runtime?: DesktopShellRuntime;
}

export interface DesktopShellTray {
  on(event: 'click', listener: () => void): void;
  removeAllListeners(): void;
  destroy(): void;
  setContextMenu(menu: Menu): void;
  setToolTip(toolTip: string): void;
}

export interface DesktopShellRuntime {
  readonly platform: NodeJS.Platform;
  readonly buildMenu: (template: MenuItemConstructorOptions[]) => Menu;
  readonly setApplicationMenu: (menu: Menu) => void;
  readonly createImage: (path: string) => NativeImage;
  readonly createTray: (image: NativeImage) => DesktopShellTray;
  readonly onBeforeQuit: (listener: (event: Electron.Event) => void) => () => void;
  readonly onActivate: (listener: () => void) => () => void;
  readonly onSecondInstance: (listener: () => void) => () => void;
  readonly quit: () => void;
  readonly exit: (code: number) => void;
}

export interface DesktopShell {
  /** Rebuild application and tray menus after locale or task state changes. */
  refresh(): void;
  /** Show and focus the existing window without creating another one. */
  restore(): void;
  /** Remove listeners and destroy the tray. Safe to call more than once. */
  dispose(): void;
  /** Run the host cleanup once, then ask Electron to quit. */
  quit(): Promise<void>;
}

/**
 * These labels are intentionally kept local to the desktop shell until the host locale contract
 * grows native-menu keys. The coordinator can move them to core/locale.ts without changing the
 * shell API.
 */
export const desktopShellTranslationKeys = [
  'Open Deskwork',
  'Exit Deskwork',
  'Development',
  'Task status',
  'Ready',
  'Working',
  'Waiting for your confirmation',
  'Paused · You can take over',
  'Result needs verification',
  'Turn completed',
  'Needs attention',
  'Cancelled',
  'Edit',
  'View',
  'Window',
] as const;

const shellTranslations: Readonly<Record<(typeof desktopShellTranslationKeys)[number], string>> = {
  'Open Deskwork': '打开 Deskwork',
  'Exit Deskwork': '退出 Deskwork',
  Development: '开发模式',
  'Task status': '任务状态',
  Ready: '准备就绪',
  Working: '正在处理',
  'Waiting for your confirmation': '等待你确认',
  'Paused · You can take over': '已暂停 · 可以接手',
  'Result needs verification': '结果待核对',
  'Turn completed': '本轮已完成',
  'Needs attention': '需要处理',
  Cancelled: '已取消',
  Edit: '编辑',
  View: '视图',
  Window: '窗口',
};

const defaultRuntime: DesktopShellRuntime = {
  platform: process.platform,
  buildMenu: (template: MenuItemConstructorOptions[]): Menu => Menu.buildFromTemplate(template),
  setApplicationMenu: (menu: Menu): void => {
    Menu.setApplicationMenu(menu);
  },
  createImage: (path: string): NativeImage => nativeImage.createFromPath(path),
  createTray: (image: NativeImage): DesktopShellTray => new Tray(image),
  onBeforeQuit: (listener: (event: Electron.Event) => void): (() => void) => {
    app.on('before-quit', listener);
    return (): void => {
      app.removeListener('before-quit', listener);
    };
  },
  onActivate: (listener: () => void): (() => void) => {
    app.on('activate', listener);
    return (): void => {
      app.removeListener('activate', listener);
    };
  },
  onSecondInstance: (listener: () => void): (() => void) => {
    app.on('second-instance', listener);
    return (): void => {
      app.removeListener('second-instance', listener);
    };
  },
  quit: (): void => {
    app.quit();
  },
  exit: (code: number): void => {
    app.exit(code);
  },
};

function shellLabel(locale: Locale, key: (typeof desktopShellTranslationKeys)[number]): string {
  return locale === 'zh' ? shellTranslations[key] : key;
}

function statusMessage(
  status: DesktopShellTaskStatus,
): (typeof desktopShellTranslationKeys)[number] {
  switch (status) {
    case 'idle':
      return 'Ready';
    case 'running':
      return 'Working';
    case 'waiting-user':
      return 'Waiting for your confirmation';
    case 'paused':
      return 'Paused · You can take over';
    case 'verifying':
      return 'Result needs verification';
    case 'succeeded':
      return 'Turn completed';
    case 'failed':
      return 'Needs attention';
    case 'cancelled':
      return 'Cancelled';
    case 'development':
      return 'Development';
  }
}

function createTrayImage(iconDirectory: string, runtime: DesktopShellRuntime): NativeImage {
  const path = join(iconDirectory, runtime.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png');
  const image = runtime.createImage(path);
  if (runtime.platform === 'darwin') image.setTemplateImage(true);
  return image;
}

function isUsableWindow(window: BrowserWindow): boolean {
  return !window.isDestroyed();
}

/**
 * Owns native window affordances and quit ordering for one BrowserWindow. The host keeps all
 * runtime/task state in its onQuit callback; this module only coordinates native UI lifecycle.
 */
export function createDesktopShell(options: DesktopShellOptions): DesktopShell {
  const { window } = options;
  const runtime = options.runtime ?? defaultRuntime;
  let disposed = false;
  let quitting = false;
  let quitPromise: Promise<void> | undefined;
  let tray: DesktopShellTray | undefined;
  let trayAvailable = false;
  let menuLocale: Locale | undefined;
  let menuStatus: DesktopShellTaskStatus | undefined;

  const restore = (): void => {
    if (disposed || !isUsableWindow(window)) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  };

  const requestQuit = (): Promise<void> => {
    if (quitPromise) return quitPromise;
    quitting = true;
    quitPromise = (async (): Promise<void> => {
      try {
        await options.onQuit();
      } catch (error: unknown) {
        // Cleanup must not leave an unhandled rejection or a half-running desktop process.
        console.error('Deskwork cleanup failed during quit', error);
        try {
          runtime.exit(1);
        } catch (exitError: unknown) {
          console.error('Deskwork could not exit after cleanup failure', exitError);
        }
      } finally {
        dispose();
        try {
          runtime.quit();
        } catch (error: unknown) {
          console.error('Deskwork could not quit Electron', error);
        }
      }
    })();
    return quitPromise;
  };

  const buildMenus = (): void => {
    if (disposed) return;
    const locale = options.getLocale();
    const taskStatus = options.getTaskStatus();
    if (menuLocale === locale && menuStatus === taskStatus) return;
    menuLocale = locale;
    menuStatus = taskStatus;
    const status = shellLabel(locale, statusMessage(taskStatus));
    const statusLabel = `${shellLabel(locale, 'Task status')}: ${status}`;
    const openLabel = shellLabel(locale, 'Open Deskwork');
    const exitLabel = shellLabel(locale, 'Exit Deskwork');
    const shellMenu: MenuItemConstructorOptions = {
      label: 'DSH Deskwork',
      submenu: [
        { id: 'deskwork-open', label: openLabel, accelerator: 'CmdOrCtrl+Shift+O', click: restore },
        { id: 'deskwork-status', label: statusLabel, enabled: false },
        { type: 'separator' },
        {
          id: 'deskwork-quit',
          label: exitLabel,
          accelerator: 'CmdOrCtrl+Q',
          click: (): void => {
            void requestQuit();
          },
        },
      ],
    };
    runtime.setApplicationMenu(
      runtime.buildMenu([
        // Preserve native macOS services/hide affordances and platform window behavior.
        { role: 'appMenu' },
        shellMenu,
        { role: 'editMenu', label: shellLabel(locale, 'Edit') },
        { role: 'viewMenu', label: shellLabel(locale, 'View') },
        { role: 'windowMenu', label: shellLabel(locale, 'Window') },
      ]),
    );
    if (!tray) return;
    const trayMenu = runtime.buildMenu([
      { id: 'deskwork-open', label: openLabel, accelerator: 'CmdOrCtrl+Shift+O', click: restore },
      { id: 'deskwork-status', label: statusLabel, enabled: false },
      { type: 'separator' },
      {
        id: 'deskwork-quit',
        label: exitLabel,
        accelerator: 'CmdOrCtrl+Q',
        click: (): void => {
          void requestQuit();
        },
      },
    ]);
    tray.setContextMenu(trayMenu);
    tray.setToolTip(statusLabel);
  };

  const closeWindow = (event: Electron.Event): void => {
    if (quitting || disposed) return;
    if (!trayAvailable) {
      event.preventDefault();
      void requestQuit();
      return;
    }
    event.preventDefault();
    window.hide();
  };
  const beforeQuit = (event: Electron.Event): void => {
    if (quitting || disposed) return;
    event.preventDefault();
    void requestQuit();
  };
  const activate = (): void => {
    restore();
  };
  const secondInstance = (): void => {
    restore();
  };

  window.on('close', closeWindow);
  const removeBeforeQuit = runtime.onBeforeQuit(beforeQuit);
  const removeActivate = runtime.onActivate(activate);
  const removeSecondInstance = runtime.onSecondInstance(secondInstance);

  try {
    const image = createTrayImage(options.iconDirectory, runtime);
    if (image.isEmpty()) throw new Error('Tray image is empty');
    tray = runtime.createTray(image);
    trayAvailable = true;
    tray.on('click', restore);
  } catch (error: unknown) {
    tray = undefined;
    trayAvailable = false;
    // Application menu remains installed below. A normal window close invokes before-quit and
    // performs the same cleanup as Exit, preserving an exit/reopen path without a tray.
    console.error('Deskwork tray is unavailable; using application-menu fallback', error);
  }

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    window.removeListener('close', closeWindow);
    removeBeforeQuit();
    removeActivate();
    removeSecondInstance();
    tray?.removeAllListeners();
    tray?.destroy();
    tray = undefined;
    trayAvailable = false;
  };

  const shell: DesktopShell = {
    refresh: buildMenus,
    restore,
    dispose,
    quit: requestQuit,
  };
  buildMenus();
  return shell;
}

/**
 * Convert a host status to the existing localized host wording when available. Kept exported for
 * focused tests and for coordinators that need to render the same status elsewhere.
 */
export function localizedDesktopStatus(locale: Locale, status: DesktopShellTaskStatus): string {
  return localizeMessage(locale, statusMessage(status));
}
