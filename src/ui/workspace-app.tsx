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
  { kind: 'site'; site?: Site } | { kind: 'settings' } | { kind: 'commands' } | null;
function Dialog({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}): ReactElement {
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
        <button className="icon-button" aria-label="关闭对话框" onClick={close}>
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
      <p className="muted">把每天使用的网站放进工作台。登录仍在原网站中完成。</p>
      <label>
        网站网址
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
        名称 <span className="muted">（可选）</span>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="例如：我的业务系统"
          maxLength={100}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <button className="primary full" disabled={busy} type="submit">
        {site ? '保存网站设置' : '添加网站'}
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
          移除此入口（保留网站数据）
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
          ? '交互预览不连接模型，请勿输入真实密钥。'
          : '密钥保存在本机系统安全存储，仅供 DSH 使用。'}
      </p>
      <label>
        模型名称
        <input
          value={model}
          onChange={(event) => {
            setModel(event.target.value);
          }}
          required
        />
      </label>
      <label>
        API 密钥
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
      {error ? <p role="alert">{error}</p> : null}
      <button className="primary full">保存模型配置</button>
    </form>
  );
}
export function WorkspaceApp({ bridge }: { bridge: DeskworkBridge }): ReactElement {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>();
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
        正在打开 Deskwork…{error ? <p role="alert">{error}</p> : null}
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
    <div
      className="workspace"
      style={
        {
          '--sidebar-width': sidebar ? '204px' : '0px',
          '--panel-width': `${String(panelWidth)}px`,
        } as CSSProperties
      }
    >
      <header className="titlebar">
        <span className="window-controls-space" />
        <button
          className="icon-button"
          aria-label="折叠工作区导航"
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
          搜索命令<kbd>⌘ ⇧ P</kbd>
        </button>
        {snapshot.preview ? <span className="preview-label">交互预览</span> : null}
      </header>
      <div className="workbench">
        {sidebar ? (
          <aside className="sidebar">
            <div className="brand">
              <span className="brand-mark">
                D<span>·</span>
              </span>
              <div>
                Deskwork<small>你的 AI 工作台</small>
              </div>
            </div>
            <div className="section-label">
              工作区 <span>{snapshot.workspace.sites.length}</span>
            </div>
            <nav aria-label="网站导航">
              {snapshot.workspace.sites.map((entry) => (
                <button
                  key={entry.id}
                  className={`nav-entry ${site?.id === entry.id ? 'selected' : ''}`}
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
              添加网站
            </button>
            <div className="sidebar-bottom">
              <p>
                网站照常使用
                <br />让 AI 协助完成工作
              </p>
              <button
                onClick={() => {
                  setDialog({ kind: 'settings' });
                }}
              >
                <Icon name="settings" />
                模型设置
              </button>
            </div>
          </aside>
        ) : null}
        <main className="main-area">
          <div className="workspace-toolbar">
            <div>
              <span className="eyebrow">工作台</span>
              <strong>{site?.name ?? '把工作放在一起'}</strong>
            </div>
            <div className="mode-switch" aria-label="工作模式">
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
          <div className="tabs" role="tablist" aria-label="固定网站标签">
            {snapshot.workspace.sites.map((entry) => (
              <button
                role="tab"
                aria-selected={site?.id === entry.id}
                className={site?.id === entry.id ? 'active' : ''}
                key={entry.id}
                onClick={() => {
                  sendCommand({ type: 'select-site', siteId: entry.id });
                }}
              >
                <span className="site-glyph" aria-hidden="true">
                  {entry.name.slice(0, 1).toUpperCase()}
                </span>
                {entry.name}
              </button>
            ))}
            <button
              aria-label="添加固定网站"
              onClick={() => {
                setDialog({ kind: 'site' });
              }}
            >
              <Icon name="plus" size={16} />
            </button>
          </div>
          <div className={`content-area mode-${mode}`}>
            <section
              className="browser-area"
              style={mode === 'agent' ? { flex: '0 0 0', width: 0, overflow: 'hidden' } : undefined}
              aria-label="网站页面"
            >
              {site ? (
                <div className="addressbar">
                  <Icon name="link" size={14} />
                  <span title={currentPage?.url || site.url}>{currentPage?.url || site.url}</span>
                  <button
                    className="icon-button"
                    aria-label="刷新网站"
                    onClick={() => {
                      sendCommand({ type: 'reload', siteId: site.id });
                    }}
                  >
                    <Icon name="refresh" size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="网站设置"
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
                        {page.title || '页面'}
                      </button>
                      {page.popup ? (
                        <button
                          aria-label={`关闭 ${page.title}`}
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
                    <span className="eyebrow">从你熟悉的网站开始</span>
                    <h1>你的工作，一个入口。</h1>
                    <p>
                      添加每天使用的网站，照常登录。
                      <br />
                      页面在这里，AI 在身边。
                    </p>
                    <button
                      className="primary"
                      onClick={() => {
                        setDialog({ kind: 'site' });
                      }}
                    >
                      <Icon name="plus" />
                      添加第一个网站
                    </button>
                    <div className="empty-guide">
                      <span>01 添加网址</span>
                      <span>02 登录网站</span>
                      <span>03 开始对话</span>
                    </div>
                  </div>
                ) : snapshot.preview ? (
                  <div className="page-placeholder">
                    <Icon name="link" size={32} />
                    <h2>{site.name}</h2>
                    <p>{site.url}</p>
                    <p>桌面客户端会在此原样打开网站</p>
                    <small>此处仅预览工作台布局</small>
                  </div>
                ) : null}
              </div>
            </section>
            {mode === 'copilot' ? (
              <div
                className="panel-resizer"
                role="separator"
                tabIndex={0}
                aria-label="调整 AI 面板宽度"
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
                    setPanelWidth(Math.min(600, Math.max(340, window.innerWidth - event.clientX)));
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
            <section className="ai-panel" aria-label="DSH 对话">
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
                      查看页面
                    </button>
                  ) : null}
                  <button
                    className="icon-button"
                    aria-label="新建任务"
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
                {site?.name ?? '尚未添加网站'}
                <span>{site ? '独立对话' : '配置后即可开始'}</span>
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
                    <h2>今天，有什么需要处理？</h2>
                    <p>
                      告诉我你的目标，
                      <br />
                      我会在当前网站中协助你完成。
                    </p>
                    {site ? (
                      <div className="suggestions">
                        {['看看当前页面有哪些信息', '帮我查找需要处理的事项'].map((text) => (
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
                      <small>{message.role === 'user' ? '你' : 'DSH'}</small>
                      <p>{message.text}</p>
                    </article>
                  ))
                )}
                <TaskCard
                  task={task}
                  confirm={(id) => {
                    if (site) sendCommand({ type: 'confirm', siteId: site.id, confirmationId: id });
                  }}
                  resolve={(outcome) => {
                    if (site) sendCommand({ type: 'resolve-result', siteId: site.id, outcome });
                  }}
                />
              </div>
              <div className="conversation-bottom">
                {error ? (
                  <div className="error-banner" role="alert">
                    {error}
                    <button
                      aria-label="关闭错误"
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
                    另一个网站的任务尚未结束。
                    <button
                      onClick={() => {
                        if (snapshot.runningSiteId)
                          sendCommand({ type: 'select-site', siteId: snapshot.runningSiteId });
                      }}
                    >
                      查看任务
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
                    停止并接手
                  </button>
                ) : null}
                {site && ['paused', 'failed', 'verifying'].includes(task.status) ? (
                  <button
                    className="resume-button"
                    onClick={() => {
                      sendCommand({ type: 'resume', siteId: site.id });
                    }}
                  >
                    {task.status === 'verifying' ? '重新读取结果' : '重新观察并继续'}
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
                    aria-label="告诉 DSH 你的目标"
                    placeholder={site ? '告诉我你想完成什么…' : '添加网站后开始对话'}
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
                      DeepSeek <small>{snapshot.runtimeConfigured ? '已配置' : '配置模型'}</small>
                    </button>
                    <button
                      className="send-button"
                      type="submit"
                      aria-label="发送任务"
                      disabled={!site || !prompt.trim() || busy}
                    >
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                </form>
                <p className="composer-hint">Enter 发送 · Shift Enter 换行</p>
              </div>
            </section>
          </div>
        </main>
      </div>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          本地工作台
        </span>
        <span>
          {snapshot.preview ? '交互预览 · 不连接网站或模型' : '网站保持原样 · 任务绑定当前入口'}
        </span>
        <span>DSH Deskwork</span>
      </footer>
      {dialog ? (
        <Dialog
          title={
            dialog.kind === 'site'
              ? dialog.site
                ? '网站设置'
                : '添加网站'
              : dialog.kind === 'settings'
                ? '连接 DeepSeek'
                : '命令入口'
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
          ) : dialog.kind === 'settings' ? (
            <ModelForm
              bridge={bridge}
              preview={snapshot.preview}
              done={() => {
                setDialog(null);
              }}
            />
          ) : (
            <div className="command-list">
              <button
                onClick={() => {
                  setDialog({ kind: 'site' });
                }}
              >
                添加网站
              </button>
              <button
                onClick={() => {
                  setMode('copilot');
                  setDialog(null);
                }}
              >
                切换到 Copilot
              </button>
              <button
                onClick={() => {
                  setMode('agent');
                  setDialog(null);
                }}
              >
                切换到 Agent
              </button>
              <button
                onClick={() => {
                  setDialog({ kind: 'settings' });
                }}
              >
                设置模型连接
              </button>
            </div>
          )}
        </Dialog>
      ) : null}
    </div>
  );
}
