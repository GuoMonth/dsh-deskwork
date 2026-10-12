import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { _electron as electron, expect } from '@playwright/test';

const onePixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function launchArguments(profile: string): string[] {
  return [
    ...(process.env['DESKWORK_TEST_EXECUTABLE'] ? [] : [resolve('.')]),
    `--profile-directory=${profile}`,
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
  ];
}

await test(
  'desktop shell hides and restores the same window, refreshes localized menus, and keeps native roles',
  { timeout: 90000, concurrency: false },
  async () => {
    const profile = await mkdtemp(join(tmpdir(), 'deskwork-shell-profile-'));
    const brandDirectory = resolve('dist/brand');
    const trayPath = join(brandDirectory, 'tray.png');
    await mkdir(brandDirectory, { recursive: true });
    await writeFile(trayPath, onePixelPng);
    const executablePath = process.env['DESKWORK_TEST_EXECUTABLE'];
    const application = await electron.launch({
      ...(executablePath ? { executablePath } : {}),
      cwd: process.env['DESKWORK_TEST_WORKING_DIRECTORY'] ?? resolve('.'),
      args: launchArguments(profile),
    });

    try {
      const shell = await application.firstWindow();
      await expect(shell.getByRole('heading', { name: 'Your work, in one place.' })).toBeVisible();
      const windowIdentity = await application.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return window?.webContents.id;
      });
      assert.ok(windowIdentity);
      const menuSnapshot = await application.evaluate(({ Menu }) => {
        const menu = Menu.getApplicationMenu();
        return menu?.items.map((item) => ({
          role: item.role,
          label: item.label,
          children: item.submenu?.items.map((child) => ({
            id: child.id,
            label: child.label,
            accelerator: child.accelerator,
          })),
        }));
      });
      assert.ok(menuSnapshot);
      const shellMenu = menuSnapshot.find((item) =>
        item.children?.some((child) => child.id === 'deskwork-open'),
      );
      assert.ok(shellMenu?.children);
      assert.deepEqual(
        shellMenu.children
          .filter((child) => child.id)
          .map((child) => ({
            id: child.id,
            accelerator: child.accelerator,
          })),
        [
          { id: 'deskwork-open', accelerator: 'CmdOrCtrl+Shift+O' },
          { id: 'deskwork-status', accelerator: null },
          { id: 'deskwork-quit', accelerator: 'CmdOrCtrl+Q' },
        ],
      );
      assert.deepEqual(
        menuSnapshot
          .filter((item) => ['editmenu', 'viewmenu', 'windowmenu'].includes(item.role ?? ''))
          .map((item) => item.role),
        ['editmenu', 'viewmenu', 'windowmenu'],
      );
      assert.equal(
        shellMenu.children.find((child) => child.id === 'deskwork-status')?.label,
        'Task status: Ready',
      );

      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
      await expect
        .poll(() =>
          application.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]?.isVisible(),
          ),
        )
        .toBe(false);
      assert.equal(
        await application.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.id,
        ),
        windowIdentity,
      );
      await application.evaluate(({ Menu }) => {
        const item = Menu.getApplicationMenu()
          ?.items.flatMap((entry) => entry.submenu?.items ?? [])
          .find((entry) => entry.id === 'deskwork-open');
        item?.click();
      });
      await expect
        .poll(() =>
          application.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]?.isVisible(),
          ),
        )
        .toBe(true);
      await application.evaluate(({ app }) => app.emit('activate'));
      await expect
        .poll(() =>
          application.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]?.isVisible(),
          ),
        )
        .toBe(true);
      await application.evaluate(({ app }) => app.emit('second-instance', {}, []));
      await expect
        .poll(() =>
          application.evaluate(({ BrowserWindow }) =>
            BrowserWindow.getAllWindows()[0]?.isVisible(),
          ),
        )
        .toBe(true);

      await shell.evaluate(async () => {
        await window.deskwork?.command({ type: 'language', locale: 'zh' });
      });
      await expect
        .poll(() =>
          application.evaluate(({ Menu }) => {
            const menu = Menu.getApplicationMenu();
            return menu?.items
              .flatMap((item) => item.submenu?.items ?? [])
              .find((item) => item.id === 'deskwork-open')?.label;
          }),
        )
        .toBe('打开 Deskwork');
      await expect
        .poll(() =>
          application.evaluate(
            ({ Menu }) =>
              Menu.getApplicationMenu()
                ?.items.flatMap((item) => item.submenu?.items ?? [])
                .find((item) => item.id === 'deskwork-status')?.label,
          ),
        )
        .toBe('任务状态: 准备就绪');
      await application.evaluate(({ Menu }) => {
        const item = Menu.getApplicationMenu()
          ?.items.flatMap((entry) => entry.submenu?.items ?? [])
          .find((entry) => entry.id === 'deskwork-quit');
        item?.click();
      });
      await expect.poll(() => application.windows().length).toBe(0);
    } finally {
      await application.close();
      await rm(profile, { recursive: true, force: true });
      await rm(trayPath, { force: true });
    }
  },
);

await test(
  'desktop shell exits through bounded cleanup when the tray image is unavailable',
  { timeout: 90000, concurrency: false },
  async () => {
    const profile = await mkdtemp(join(tmpdir(), 'deskwork-shell-no-tray-'));
    const trayPath = join(resolve('dist/brand'), 'tray.png');
    await rm(trayPath, { force: true });
    const executablePath = process.env['DESKWORK_TEST_EXECUTABLE'];
    const application = await electron.launch({
      ...(executablePath ? { executablePath } : {}),
      cwd: process.env['DESKWORK_TEST_WORKING_DIRECTORY'] ?? resolve('.'),
      args: launchArguments(profile),
    });
    try {
      const shell = await application.firstWindow();
      await expect(shell.getByRole('heading', { name: 'Your work, in one place.' })).toBeVisible();
      await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
      await expect.poll(() => application.windows().length).toBe(0);
    } finally {
      await application.close();
      await rm(profile, { recursive: true, force: true });
    }
  },
);
