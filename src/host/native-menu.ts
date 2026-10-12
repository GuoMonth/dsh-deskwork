import type { MenuItemConstructorOptions } from 'electron';
import { localizeMessage } from '../core/locale.ts';
import type { Locale } from '../core/locale.ts';

/** Build host-owned entries while retaining Electron's platform edit/view/window roles. */
export function nativeMenuTemplate(
  locale: Locale,
  onOpen: () => void,
  onExit: () => void,
): MenuItemConstructorOptions[] {
  return [
    {
      label: 'DSH Deskwork',
      submenu: [
        {
          label: localizeMessage(locale, 'Open Deskwork'),
          accelerator: 'CmdOrCtrl+Shift+O',
          click: onOpen,
        },
        { type: 'separator' },
        {
          label: localizeMessage(locale, 'Exit Deskwork'),
          accelerator: 'CmdOrCtrl+Q',
          click: onExit,
        },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ];
}
