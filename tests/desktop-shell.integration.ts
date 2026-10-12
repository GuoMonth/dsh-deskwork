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

await test(
  'desktop shell hides/restores the same window and exposes localized native actions',
  { timeout: 90000, concurrency: false },
  async () => {
    const profile = await mkdtemp(join(tmpdir(), 'deskwork-shell-profile-'));
    const brandDirectory = resolve('dist/brand');
    await mkdir(brandDirectory, { recursive: true });
    await writeFile(join(brandDirectory, 'tray.png'), onePixelPng);
    const executablePath = process.env['DESKWORK_TEST_EXECUTABLE'];
    const application = await electron.launch({
      ...(executablePath ? { executablePath } : {}),
      cwd: process.env['DESKWORK_TEST_WORKING_DIRECTORY'] ?? resolve('.'),
      args: [
        ...(executablePath ? [] : [resolve('.')]),
        `--profile-directory=${profile}`,
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      ],
    });

    try {
      const shell = await application.firstWindow();
      await expect(shell.getByRole('heading', { name: 'Your work, in one place.' })).toBeVisible();
      const windowIdentity = await application.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return window?.webContents.id;
      });
      assert.ok(windowIdentity);
      const menuIds = await application.evaluate(
        ({ Menu }) =>
          Menu.getApplicationMenu()
            ?.items.flatMap((item) => item.submenu?.items ?? [])
            .map((item) => item.id) ?? [],
      );
      assert.ok(menuIds.includes('deskwork-open'));
      assert.ok(menuIds.includes('deskwork-status'));
      assert.ok(menuIds.includes('deskwork-quit'));

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
        await window.deskwork?.command({ type: 'language', preference: 'zh' });
      });
      await expect
        .poll(() =>
          application.evaluate(
            ({ Menu }) => Menu.getApplicationMenu()?.items[1]?.submenu?.items[0]?.label,
          ),
        )
        .toBe('打开 Deskwork');
    } finally {
      await application.close();
      await rm(profile, { recursive: true, force: true });
      await rm(join(brandDirectory, 'tray.png'), { force: true });
    }
  },
);

await test(
  'desktop shell exits through cleanup when the tray image is unavailable',
  { timeout: 90000, concurrency: false },
  async () => {
    const profile = await mkdtemp(join(tmpdir(), 'deskwork-shell-no-tray-'));
    const trayPath = join(resolve('dist/brand'), 'tray.png');
    await rm(trayPath, { force: true });
    const executablePath = process.env['DESKWORK_TEST_EXECUTABLE'];
    const application = await electron.launch({
      ...(executablePath ? { executablePath } : {}),
      cwd: process.env['DESKWORK_TEST_WORKING_DIRECTORY'] ?? resolve('.'),
      args: [
        ...(executablePath ? [] : [resolve('.')]),
        `--profile-directory=${profile}`,
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
      ],
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
