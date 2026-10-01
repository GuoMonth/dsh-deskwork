import { useI18n, LocaleProvider } from './locale.tsx';
import { PluginPanel } from './plugin-panel.tsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type {
  DeskworkBridge,
  Site,
  WorkspaceCommand,
  WorkspaceSnapshot,
} from '../core/contracts.ts';
import { idleTask } from '../core/contracts.ts';
import { Icon } from './icon.tsx';
import { TaskCard } from './task-card.tsx';

type DialogState =
  | { kind: 'site'; site?: Site }
  | { kind: 'settings' }
  | { kind: 'commands' }
  | { kind: 'plugins' }
  | null;
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}): ReactElement {
  const t = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement;
    element?.showModal();
    return (): void => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      aria-label={title}
    >
      <div className="modal-heading">
        <h2>{title}</h2>
        <button className="icon-button" aria-label={t('Close dialog')} onClick={close}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function SiteForm({
  site,
  save,
  remove,
}: {
  site?: Site;
  save: (url: string, name: string) => Promise<void>;
  remove: (() => Promise<void>) | undefined;
}): ReactElement {
  const t = useI18n();
  const [url, setUrl] = useState(site?.url ?? '');
  const [name, setName] = useState(site?.name ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function run(action: () => Promise<void>): void {
    setBusy(true);
    setError('');
    void action()
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        setBusy(false);
      });
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => save(url.trim(), name.trim()));
      }}
    >
      <p className="muted">
        {t('Add the websites you use every day. Sign in on the original website.')}
      </p>
      <label>
        {t('Website URL')}
        <input
          type="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
          }}
          placeholder="https://your-workplace.example"
          required
          autoFocus
        />
      </label>
      <label>
        {t('Name')}
        <span className="muted">{t('(optional)')}</span>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder={t('For example: My business system')}
          maxLength={100}
        />
      </label>
      {error ? <p role="alert">{t(error)}</p> : null}
      <button className="primary full" disabled={busy} type="submit">
        {site ? t('Save website settings') : t('Add website')}
      </button>
      {remove ? (
        <button
          type="button"
          className="danger full"
          disabled={busy}
          onClick={() => {
            run(remove);
          }}
        >
          {t('Remove this entry (keep website data)')}
        </button>
      ) : null}
    </form>
  );
}
function ModelForm({
  bridge,
  preview,
  done,
}: {
  bridge: DeskworkBridge;
  preview: boolean;
  done: () => void;
}): ReactElement {
  const t = useI18n();
  const [key, setKey] = useState('');
  const [model, setModel] = useState('deepseek-v4-flash');
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void bridge
          .command({ type: 'settings', apiKey: key, model })
          .then(done)
          .catch((reason: unknown) => {
            setError(String(reason));
          });
      }}
    >
      <p className="muted">
        {preview
          ? t('The preview does not connect to a model. Do not enter a real API key.')
          : t('Your key is stored in the system secure storage on this computer, for DSH only.')}
      </p>
      <label>
        {t('Model name')}
        <input
          value={model}
          onChange={(event) => {
            setModel(event.target.value);
          }}
          required
        />
      </label>
      <label>
        {t('API key')}
        <input
          type="password"
          value={key}
          onChange={(event) => {
            setKey(event.target.value);
          }}
          autoComplete="off"
          required
        />
      </label>
      {error ? <p role="alert">{t(error)}</p> : null}
      <button className="primary full">{t('Save model settings')}</button>
    </form>
  );
}
export function WorkspaceApp({ bridge }: { bridge: DeskworkBridge }): ReactElement {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>();
  const t = useI18n(snapshot?.workspace.locale);
  const [mode, setMode] = useState<'copilot' | 'agent'>('copilot');
  const [sidebar, setSidebar] = useState(true);
  const [panelWidth, setPanelWidth] = useState(400);
  const [dragging, setDragging] = useState(false);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const viewport = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
  const report = useCallback((reason: unknown) => {
    setError(reason instanceof Error ? reason.message : String(reason));
  }, []);
  const sendCommand = useCallback(
    (command: WorkspaceCommand) => {
      setError('');
      void bridge.command(command).catch(report);
    },
    [bridge, report],
  );
  useEffect(() => {
    document.documentElement.lang = snapshot?.workspace.locale === 'zh' ? 'zh-CN' : 'en';
  }, [snapshot?.workspace.locale]);
  useEffect(() => {
    let alive = true;
    const unsubscribe = bridge.subscribe((state) => {
      if (alive) setSnapshot(state);
    });
    void bridge
      .snapshot()
      .then((state) => {
        if (alive) setSnapshot(state);
      })
      .catch(report);
    return (): void => {
      alive = false;
      unsubscribe();
    };
  }, [bridge, report]);
  const site = snapshot?.workspace.sites.find((entry) => entry.id === snapshot.activeSiteId);
  const context = snapshot?.contexts.find((entry) => entry.siteId === site?.id);
  const task = context?.task ?? idleTask();
  const prompt = site ? (drafts[site.id] ?? '') : '';
  const modalOpen = dialog !== null;
  const hasSite = Boolean(site);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = (): void => {
      const rect = element.getBoundingClientRect();
      void bridge
        .command({
          type: 'layout',
          visible: hasSite && mode === 'copilot' && !modalOpen && !dragging,
          bounds: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          },
        })
        .catch(report);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return (): void => {
      observer.disconnect();
    };
  }, [bridge, report, mode, modalOpen, dragging, hasSite, snapshot?.activeSiteId]);
  useEffect(() => {
    followMessages.current = true;
  }, [site?.id, task.id]);
  useEffect(() => {
    if (followMessages.current)
      conversation.current?.scrollTo({
        top: context?.messages.length ? conversation.current.scrollHeight : 0,
        behavior: 'instant',
      });
  }, [site?.id, task.id, context?.messages.length, context?.messages.at(-1)?.text, task.status]);
  useEffect(() => {
    const key = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setSidebar((value) => !value);
      }
      if (event.key.toLowerCase() === 'l') {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key.toLowerCase() === 'p' && event.shiftKey) {
        event.preventDefault();
        setDialog({ kind: 'commands' });
      }
    };
    window.addEventListener('keydown', key);
    return (): void => {
      window.removeEventListener('keydown', key);
    };
  }, []);
  if (!snapshot)
    return (
      <main className="loading">
        {t('Opening Deskwork…')}
        {error ? <p role="alert">{t(error)}</p> : null}
      </main>
    );
  const busy = Boolean(snapshot.runningSiteId);
  function submit(): void {
    if (!site || !prompt.trim() || busy) return;
    const text = prompt;
    setError('');
    void bridge
      .command({ type: 'send', tabId: site.id, text })
      .then(() => {
        setDrafts((values) => ({ ...values, [site.id]: '' }));
      })
      .catch(report);
  }
  function setPrompt(value: string): void {
    if (site) setDrafts((values) => ({ ...values, [site.id]: value }));
  }
  const ownPages = snapshot.pages.filter((page) => page.siteId === site?.id);
  const currentPage = ownPages.find((page) => page.selected) ?? ownPages[0];
  return (
    <LocaleProvider locale={snapshot.workspace.locale}>
      <div
        className="workspace"
        style={
          {
            '--sidebar-width': sidebar ? 'var(--size-sidebar)' : '0px',
            '--panel-width': `${String(panelWidth)}px`,
          } as CSSProperties
        }
      >
        <header className="titlebar">
          <span className="window-controls-space" />
          <button
            className="icon-button"
            aria-label={
              sidebar ? t('Collapse workspace navigation') : t('Expand workspace navigation')
            }
            aria-expanded={sidebar}
            onClick={() => {
              setSidebar((value) => !value);
            }}
          >
            <Icon name="sidebar" />
          </button>
          <span className="workspace-title">DSH Deskwork</span>
          <button
            className="command-trigger"
            onClick={() => {
              setDialog({ kind: 'commands' });
            }}
          >
            <Icon name="search" size={14} />
            {t('Search commands')}
            <kbd>⌘ ⇧ P</kbd>
          </button>
          {snapshot.preview ? (
            <span className="preview-label">{t('Interactive preview')}</span>
          ) : null}
        </header>
        <div className="workbench">
          {sidebar ? (
            <aside className="sidebar">
              <div className="brand">
                <span className="brand-mark">
                  D<span>·</span>
                </span>
                <span>Deskwork</span>
              </div>
              <div className="section-label">
                {t('Workspace')}
                <span>{snapshot.workspace.sites.length}</span>
              </div>
              <nav aria-label={t('Website navigation')}>
                {snapshot.workspace.sites.map((entry) => (
                  <button
                    key={entry.id}
                    className={`nav-entry ${site?.id === entry.id ? 'selected' : ''}`}
                    title={entry.name}
                    onClick={() => {
                      sendCommand({ type: 'select-site', siteId: entry.id });
                    }}
                  >
                    <Icon name="link" size={16} />
                    <span>{entry.name}</span>
                    {snapshot.runningSiteId === entry.id ? <span className="status-dot" /> : null}
                  </button>
                ))}
              </nav>
              <button
                className="add-entry"
                onClick={() => {
                  setDialog({ kind: 'site' });
                }}
              >
                <Icon name="plus" size={16} />
                {t('Add website')}
              </button>
              <div className="sidebar-bottom">
                <button
                  onClick={() => {
                    setDialog({ kind: 'plugins' });
                  }}
                >
                  <Icon name="grid" />
                  {t('Plugins')}
                </button>
                <button
                  onClick={() => {
                    setDialog({ kind: 'settings' });
                  }}
                >
                  <Icon name="settings" />
                  {t('Model settings')}
                </button>
              </div>
            </aside>
          ) : null}
          <main className="main-area">
            <div className="workspace-toolbar">
              <div
                className="tabs"
                role="tablist"
                aria-label={t('Pinned websites')}
                onKeyDown={(event) => {
                  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                  const tabs = Array.from(
                    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
                  );
                  const index = tabs.findIndex((tab) => tab === event.target);
                  if (index < 0) return;
                  event.preventDefault();
                  const next =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) %
                          tabs.length;
                  tabs[next]?.focus();
                  tabs[next]?.click();
                }}
              >
                {snapshot.workspace.sites.map((entry) => (
                  <button
                    role="tab"
                    aria-selected={site?.id === entry.id}
                    tabIndex={site?.id === entry.id ? 0 : -1}
                    title={entry.name}
                    className={site?.id === entry.id ? 'active' : ''}
                    key={entry.id}
                    onClick={() => {
                      sendCommand({ type: 'select-site', siteId: entry.id });
                    }}
                  >
                    <span className="site-glyph" aria-hidden="true">
                      {entry.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="tab-name">{entry.name}</span>
                  </button>
                ))}
              </div>
              <button
                className="icon-button add-tab"
                aria-label={t('Add pinned website')}
                onClick={() => {
                  setDialog({ kind: 'site' });
                }}
              >
                <Icon name="plus" size={16} />
              </button>
              <div className="mode-switch" aria-label={t('Work mode')}>
                <button
                  aria-pressed={mode === 'copilot'}
                  className={mode === 'copilot' ? 'active' : ''}
                  onClick={() => {
                    setMode('copilot');
                  }}
                >
                  Copilot
                </button>
                <button
                  aria-pressed={mode === 'agent'}
                  className={mode === 'agent' ? 'active' : ''}
                  onClick={() => {
                    setMode('agent');
                  }}
                >
                  Agent
                </button>
              </div>
            </div>
            <div className={`content-area mode-${mode}`}>
              <section
                className="browser-area"
                style={
                  mode === 'agent' ? { flex: '0 0 0', width: 0, overflow: 'hidden' } : undefined
                }
                aria-label={t('Website page')}
              >
                {site ? (
                  <div className="addressbar">
                    <Icon name="link" size={14} />
                    <span title={currentPage?.url || site.url}>{currentPage?.url || site.url}</span>
                    <button
                      className="icon-button"
                      aria-label={t('Refresh website')}
                      onClick={() => {
                        sendCommand({ type: 'reload', siteId: site.id });
                      }}
                    >
                      <Icon name="refresh" size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={t('Website settings')}
                      onClick={() => {
                        setDialog({ kind: 'site', site });
                      }}
                    >
                      <Icon name="settings" size={15} />
                    </button>
                  </div>
                ) : null}
                {ownPages.some((page) => page.popup) ? (
                  <div className="page-list">
                    {ownPages.map((page) => (
                      <span key={page.id}>
                        <button
                          aria-pressed={page.selected ?? false}
                          onClick={() => {
                            sendCommand({ type: 'select-page', pageId: page.id });
                          }}
                        >
                          {page.title || t('Page')}
                        </button>
                        {page.popup ? (
                          <button
                            aria-label={t(`Close ${page.title}`)}
                            onClick={() => {
                              sendCommand({ type: 'close-page', pageId: page.id });
                            }}
                          >
                            ×
                          </button>
                        ) : null}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div ref={viewport} className="browser-viewport">
                  {!site ? (
                    <div className="empty-workspace">
                      <span className="empty-icon">
                        <Icon name="grid" size={30} />
                      </span>
                      <span className="eyebrow">{t('Start with a website you know')}</span>
                      <h1>{t('Your work, in one place.')}</h1>
                      <p>
                        {t('Add your daily websites and sign in as usual.')}
                        <br />
                        {t('Your page here. AI by your side.')}
                      </p>
                      <button
                        className="primary"
                        onClick={() => {
                          setDialog({ kind: 'site' });
                        }}
                      >
                        <Icon name="plus" />
                        {t('Add your first website')}
                      </button>
                      <div className="empty-guide">
                        <span>{t('01 Add a URL')}</span>
                        <span>{t('02 Sign in')}</span>
                        <span>{t('03 Start a conversation')}</span>
                      </div>
                    </div>
                  ) : snapshot.preview ? (
                    <div className="page-placeholder">
                      <Icon name="link" size={32} />
                      <h2>{site.name}</h2>
                      <p>{site.url}</p>
                      <p>{t('The desktop app opens the original website here')}</p>
                      <small>{t('This preview shows the workspace layout only')}</small>
                    </div>
                  ) : null}
                </div>
              </section>
              {mode === 'copilot' ? (
                <div
                  className="panel-resizer"
                  role="separator"
                  tabIndex={0}
                  aria-label={t('Resize AI panel')}
                  aria-orientation="vertical"
                  aria-valuemin={340}
                  aria-valuemax={600}
                  aria-valuenow={panelWidth}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowLeft')
                      setPanelWidth((value) => Math.min(600, value + 20));
                    if (event.key === 'ArrowRight')
                      setPanelWidth((value) => Math.max(340, value - 20));
                  }}
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging(true);
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId))
                      setPanelWidth(
                        Math.min(600, Math.max(340, window.innerWidth - event.clientX)),
                      );
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    setDragging(false);
                  }}
                  onLostPointerCapture={() => {
                    setDragging(false);
                  }}
                />
              ) : null}
              <section className="ai-panel" aria-label={t('DSH conversation')}>
                <header className="ai-heading">
                  <span>
                    <Icon name="sparkle" />
                    DSH {mode === 'agent' ? 'Agent' : 'Copilot'}
                  </span>
                  <div>
                    {mode === 'agent' ? (
                      <button
                        onClick={() => {
                          setMode('copilot');
                        }}
                      >
                        {t('View page')}
                      </button>
                    ) : null}
                    <button
                      className="icon-button"
                      aria-label={t('New task')}
                      disabled={!site || (busy && snapshot.runningSiteId === site.id)}
                      onClick={() => {
                        if (site) sendCommand({ type: 'new-task', siteId: site.id });
                      }}
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                </header>
                <div className="task-context">
                  <Icon name="link" size={13} />
                  <span className="task-site-name" title={site?.name}>
                    {site?.name ?? t('No website added')}
                  </span>
                  <span className="task-context-kind">
                    {site ? t('Separate conversation') : t('Configure a website to begin')}
                  </span>
                </div>
                <div
                  className="conversation"
                  ref={conversation}
                  onScroll={(event) => {
                    const element = event.currentTarget;
                    followMessages.current =
                      element.scrollHeight - element.scrollTop - element.clientHeight < 48;
                  }}
                >
                  {!context?.messages.length ? (
                    <div className="chat-welcome">
                      <span className="agent-emblem">
                        <Icon name="sparkle" size={24} />
                      </span>
                      <h2>{t('What would you like to work on today?')}</h2>
                      <p>
                        {t('Tell me your goal,')}
                        <br />
                        {t('and I will help you on the current website.')}
                      </p>
                      {site ? (
                        <div className="suggestions">
                          {[
                            t('Show me what is on the current page'),
                            t('Help me find items that need attention'),
                          ].map((text) => (
                            <button
                              key={text}
                              onClick={() => {
                                setPrompt(text);
                                input.current?.focus();
                              }}
                            >
                              <Icon name="chevron" size={14} />
                              {text}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    context.messages.map((message) => (
                      <article key={message.id} className={`message ${message.role}`}>
                        <small>{message.role === 'user' ? t('You') : 'DSH'}</small>
                        <p>{message.text}</p>
                      </article>
                    ))
                  )}
                  <TaskCard
                    task={task}
                    confirm={(id) => {
                      if (site)
                        sendCommand({ type: 'confirm', siteId: site.id, confirmationId: id });
                    }}
                    resolve={(outcome) => {
                      if (site) sendCommand({ type: 'resolve-result', siteId: site.id, outcome });
                    }}
                  />
                </div>
                <div className="conversation-bottom">
                  {error ? (
                    <div className="error-banner" role="alert">
                      {t(error)}
                      <button
                        aria-label={t('Dismiss error')}
                        onClick={() => {
                          setError('');
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : null}
                  {snapshot.runningSiteId && snapshot.runningSiteId !== site?.id ? (
                    <p className="muted">
                      {t('A task on another website is still active.')}
                      <button
                        onClick={() => {
                          if (snapshot.runningSiteId)
                            sendCommand({ type: 'select-site', siteId: snapshot.runningSiteId });
                        }}
                      >
                        {t('View task')}
                      </button>
                    </p>
                  ) : null}
                  {site && ['running', 'waiting-user'].includes(task.status) ? (
                    <button
                      className="stop-button"
                      onClick={() => {
                        sendCommand({ type: 'stop', siteId: site.id });
                      }}
                    >
                      <Icon name="stop" size={14} />
                      {t('Stop and take over')}
                    </button>
                  ) : null}
                  {site && ['paused', 'failed', 'verifying'].includes(task.status) ? (
                    <button
                      className="resume-button"
                      onClick={() => {
                        sendCommand({ type: 'resume', siteId: site.id });
                      }}
                    >
                      {task.status === 'verifying'
                        ? t('Read the result again')
                        : t('Observe again and continue')}
                    </button>
                  ) : null}
                  <form
                    className="composer"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submit();
                    }}
                  >
                    <textarea
                      ref={input}
                      aria-label={t('Tell DSH your goal')}
                      placeholder={
                        site
                          ? t('Tell me what you want to do…')
                          : t('Add a website to start a conversation')
                      }
                      value={prompt}
                      disabled={!site || busy}
                      onChange={(event) => {
                        setPrompt(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          submit();
                        }
                      }}
                    />
                    <div className="composer-footer">
                      <button
                        type="button"
                        className="model-button"
                        onClick={() => {
                          setDialog({ kind: 'settings' });
                        }}
                      >
                        <span className="status-dot" />
                        DeepSeek{' '}
                        <small>
                          {snapshot.runtimeConfigured ? t('Configured') : t('Configure model')}
                        </small>
                      </button>
                      <button
                        className="send-button"
                        type="submit"
                        aria-label={t('Send task')}
                        disabled={!site || !prompt.trim() || busy}
                      >
                        <Icon name="arrow" size={17} />
                      </button>
                    </div>
                  </form>
                  <p className="composer-hint">{t('Enter to send · Shift Enter for a new line')}</p>
                </div>
              </section>
            </div>
          </main>
        </div>
        <footer className="statusbar">
          <span>
            <span className="status-dot" />
            {t('Local workspace')}
          </span>
          <span>
            {snapshot.preview
              ? t('Preview · No website or model connection')
              : t('Original websites · Tasks use the selected entry')}
          </span>
          <span>DSH Deskwork</span>
        </footer>
        {dialog ? (
          <Dialog
            title={
              dialog.kind === 'site'
                ? dialog.site
                  ? t('Website settings')
                  : t('Add website')
                : dialog.kind === 'settings'
                  ? t('Connect DeepSeek')
                  : dialog.kind === 'plugins'
                    ? t('Plugins')
                    : t('Commands')
            }
            close={() => {
              setDialog(null);
            }}
          >
            {dialog.kind === 'site' ? (
              <SiteForm
                {...(dialog.site ? { site: dialog.site } : {})}
                save={async (url, name) => {
                  await bridge.command(
                    dialog.site
                      ? { type: 'edit-site', siteId: dialog.site.id, url, name }
                      : { type: 'add-site', url, name },
                  );
                  setDialog(null);
                }}
                remove={
                  dialog.site
                    ? async (): Promise<void> => {
                        if (dialog.site)
                          await bridge.command({ type: 'remove-site', siteId: dialog.site.id });
                        setDialog(null);
                      }
                    : undefined
                }
              />
            ) : dialog.kind === 'plugins' ? (
              <PluginPanel
                bridge={bridge.plugins}
                sites={snapshot.workspace.sites}
                development={bridge.development}
              />
            ) : dialog.kind === 'settings' ? (
              <>
                <label>
                  {t('Language')}
                  <select
                    aria-label={t('Language')}
                    value={snapshot.workspace.locale}
                    onChange={(event) => {
                      const locale = event.target.value;
                      if (locale === 'en' || locale === 'zh')
                        sendCommand({ type: 'language', locale });
                    }}
                  >
                    <option value="en">English</option>
                    <option value="zh">中文</option>
                  </select>
                </label>
                <ModelForm
                  bridge={bridge}
                  preview={snapshot.preview}
                  done={() => {
                    setDialog(null);
                  }}
                />
              </>
            ) : (
              <div className="command-list">
                <button
                  onClick={() => {
                    setDialog({ kind: 'site' });
                  }}
                >
                  {t('Add website')}
                </button>
                <button
                  onClick={() => {
                    setMode('copilot');
                    setDialog(null);
                  }}
                >
                  {t('Switch to Copilot')}
                </button>
                <button
                  onClick={() => {
                    setMode('agent');
                    setDialog(null);
                  }}
                >
                  {t('Switch to Agent')}
                </button>
                <button
                  onClick={() => {
                    setDialog({ kind: 'settings' });
                  }}
                >
                  {t('Configure model connection')}
                </button>
              </div>
            )}
          </Dialog>
        ) : null}
      </div>
    </LocaleProvider>
  );
}
