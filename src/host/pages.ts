import { WebContentsView } from 'electron';
import type { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import type { BrowserPage, Site, TaskTarget } from '../core/contracts.ts';
import type { PageHandle } from '../browser/electron-browser.ts';
interface OwnedPage extends PageHandle {
  site: Site;
  view?: WebContentsView;
  popupWindow?: BrowserWindow;
}
export class Pages {
  private readonly entries = new Map<string, OwnedPage>();
  private readonly selected = new Map<string, string>();
  private readonly window: BrowserWindow;
  private readonly changed: () => void;
  private readonly takeover: (siteId: string) => void;
  private activeSite = '';
  private visible = true;
  private bounds = { x: 204, y: 130, width: 600, height: 600 };
  constructor(window: BrowserWindow, changed: () => void, takeover: (siteId: string) => void) {
    this.window = window;
    this.changed = changed;
    this.takeover = takeover;
  }
  all(): BrowserPage[] {
    return [...this.entries.values()].map((entry) => ({
      ...entry.page,
      selected: this.selected.get(entry.site.id) === entry.page.id,
    }));
  }
  list(target: TaskTarget): BrowserPage[] {
    return [...this.entries.values()]
      .filter(
        (entry) => entry.site.id === target.tabId && entry.site.sessionId === target.sessionId,
      )
      .map((entry) => ({
        ...entry.page,
        selected: this.selected.get(entry.site.id) === entry.page.id,
      }));
  }
  resolve(target: TaskTarget, pageId?: string): OwnedPage {
    const id = pageId ?? this.selected.get(target.tabId);
    const entry = id ? this.entries.get(id) : undefined;
    if (
      !entry ||
      entry.contents.isDestroyed() ||
      entry.site.id !== target.tabId ||
      entry.site.sessionId !== target.sessionId
    )
      throw new Error('目标页面不属于当前网站，或已关闭');
    return entry;
  }
  select(target: TaskTarget, pageId: string): void {
    const entry = this.resolve(target, pageId);
    this.selected.set(target.tabId, pageId);
    if (this.activeSite === target.tabId) entry.popupWindow?.show();
    this.layout();
    this.changed();
  }
  add(site: Site): void {
    const view = new WebContentsView({
      webPreferences: {
        partition: `persist:deskwork-${site.sessionId}`,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    const entry: OwnedPage = {
      contents: view.webContents,
      site,
      view,
      page: {
        id: `page-${randomUUID()}`,
        siteId: site.id,
        title: site.name,
        url: site.url,
        popup: false,
      },
      epoch: 0,
    };
    this.entries.set(entry.page.id, entry);
    this.selected.set(site.id, entry.page.id);
    this.window.contentView.addChildView(view);
    this.attach(entry);
    void view.webContents.loadURL(site.url).catch(() => {
      entry.page.title = '无法打开网站 · 请检查网址或网络';
      this.changed();
    });
    this.layout();
  }
  private attach(entry: OwnedPage): void {
    const contents = entry.contents;
    const cookieJar = contents.session.cookies;
    const cookieChanged = (_event: Electron.Event, cookie: Electron.Cookie): void => {
      entry.epoch++;
      if (cookie.httpOnly || /session|auth|token|sid|identity/i.test(cookie.name))
        this.takeover(entry.site.id);
    };
    cookieJar.on('changed', cookieChanged);
    contents.once('destroyed', () => {
      cookieJar.removeListener('changed', cookieChanged);
    });
    contents.session.setPermissionRequestHandler((_contents, _permission, callback) => {
      callback(false);
    });
    contents.session.setPermissionCheckHandler(() => false);
    contents.on('will-navigate', (event, url) => {
      if (!['http:', 'https:', 'about:'].includes(new URL(url).protocol)) event.preventDefault();
    });
    contents.on('did-navigate', () => {
      entry.epoch++;
      entry.page.url = contents.getURL();
      this.changed();
    });
    contents.on('did-navigate-in-page', () => {
      entry.epoch++;
      entry.page.url = contents.getURL();
      this.changed();
    });
    contents.on('page-title-updated', (_event, title) => {
      entry.page.title = title;
      this.changed();
    });
    contents.on('before-input-event', () => {
      if (!entry.automating) {
        entry.epoch++;
        this.takeover(entry.site.id);
      }
    });
    contents.on('before-mouse-event', (_event, input) => {
      if (input.type === 'mouseDown' && !entry.automating) {
        entry.epoch++;
        this.takeover(entry.site.id);
      }
    });
    contents.setWindowOpenHandler(({ url }) => {
      if (
        !['https:', 'http:', 'about:'].includes(new URL(url).protocol) ||
        this.list({ tabId: entry.site.id, sessionId: entry.site.sessionId }).length >= 8
      )
        return { action: 'deny' };
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1000,
          height: 760,
          show: false,
          parent: this.window,
          webPreferences: {
            partition: `persist:deskwork-${entry.site.sessionId}`,
            sandbox: true,
            contextIsolation: true,
            nodeIntegration: false,
          },
        },
      };
    });
    contents.on('did-create-window', (popup) => {
      const child: OwnedPage = {
        contents: popup.webContents,
        popupWindow: popup,
        site: entry.site,
        epoch: 0,
        page: {
          id: `page-${randomUUID()}`,
          siteId: entry.site.id,
          title: '新页面',
          url: popup.webContents.getURL(),
          popup: true,
        },
      };
      this.entries.set(child.page.id, child);
      this.selected.set(entry.site.id, child.page.id);
      if (this.activeSite === entry.site.id && this.visible) popup.show();
      this.attach(child);
      this.changed();
      popup.on('closed', () => {
        this.entries.delete(child.page.id);
        if (this.selected.get(entry.site.id) === child.page.id)
          this.selected.set(entry.site.id, entry.page.id);
        this.takeover(entry.site.id);
        this.layout();
        this.changed();
      });
    });
    contents.on('render-process-gone', () => {
      entry.epoch++;
      this.takeover(entry.site.id);
      entry.page.title = '页面进程已退出，请刷新';
      this.changed();
    });
  }
  setActiveSite(siteId: string): void {
    this.activeSite = siteId;
    this.layout();
  }
  setLayout(siteId: string, visible: boolean, bounds = this.bounds): void {
    this.activeSite = siteId;
    this.visible = visible;
    this.bounds = bounds;
    this.layout();
  }
  private layout(): void {
    const windowBounds = this.window.getContentBounds();
    for (const entry of this.entries.values()) {
      if (entry.view) {
        entry.view.setVisible(this.visible && entry.site.id === this.activeSite);
        if (entry.site.id === this.activeSite)
          entry.view.setBounds({
            x: this.bounds.x,
            y: this.bounds.y,
            width: Math.max(0, Math.min(this.bounds.width, windowBounds.width - this.bounds.x)),
            height: Math.max(0, Math.min(this.bounds.height, windowBounds.height - this.bounds.y)),
          });
      }
      if (entry.site.id !== this.activeSite || !this.visible) entry.popupWindow?.hide();
      else if (this.selected.get(entry.site.id) === entry.page.id) entry.popupWindow?.show();
    }
  }
  async remove(siteId: string): Promise<void> {
    for (const entry of [...this.entries.values()].filter((value) => value.site.id === siteId)) {
      await entry.contents.session.cookies.flushStore();
      entry.contents.session.flushStorageData();
      this.entries.delete(entry.page.id);
      if (entry.view) this.window.contentView.removeChildView(entry.view);
      entry.popupWindow?.destroy();
      if (!entry.contents.isDestroyed()) entry.contents.close();
    }
    this.selected.delete(siteId);
  }
  closePopup(pageId: string): void {
    const entry = this.entries.get(pageId);
    if (!entry?.popupWindow) throw new Error('固定入口请使用网站设置移除');
    entry.popupWindow.close();
  }
  async close(): Promise<void> {
    for (const siteId of new Set([...this.entries.values()].map((entry) => entry.site.id)))
      await this.remove(siteId);
  }
  async reload(siteId: string): Promise<void> {
    const entry = [...this.entries.values()].find(
      (value) => value.site.id === siteId && value.page.id === this.selected.get(siteId),
    );
    if (!entry) throw new Error('页面已关闭');
    entry.epoch++;
    this.takeover(siteId);
    await entry.contents.loadURL(entry.contents.getURL() || entry.page.url || entry.site.url);
  }
}
