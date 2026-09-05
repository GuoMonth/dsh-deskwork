import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import type { DeskworkBridge, WorkspaceCommand, WorkspaceSnapshot } from '../core/contracts.ts';
import { Icon } from './icon.tsx';
import { TaskCard } from './task-card.tsx';

export function WorkspaceApp({ bridge }: { bridge: DeskworkBridge }): ReactElement {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>();
  const [mode, setMode] = useState<'copilot' | 'agent'>('copilot');
  const [sidebar, setSidebar] = useState(true);
  const [panelWidth, setPanelWidth] = useState(400);
  const [tabId, setTabId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek-v4-flash');
  const browserRegion = useRef<HTMLDivElement>(null);
  const conversationEnd = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const selectedTab = tabId || snapshot?.workspace.sites[0]?.id || '';
  const sendCommand = useCallback(
    (command: WorkspaceCommand): void => {
      setError('');
      void bridge.command(command).catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : '操作失败，请重试');
      });
    },
    [bridge],
  );

  useEffect((): (() => void) => {
    let active = true;
    const unsubscribe = bridge.subscribe((value) => {
      if (active) setSnapshot(value);
    });
    void bridge
      .snapshot()
      .then((value) => {
        if (active) setSnapshot(value);
      })
      .catch((reason: unknown) => {
        setError(String(reason));
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);
  useEffect((): (() => void) => {
    const keydown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setSidebar((value) => !value);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key === 'Escape') {
        setCommandOpen(false);
        setSettings(false);
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      window.removeEventListener('keydown', keydown);
    };
  }, []);
  useEffect((): (() => void) | undefined => {
    const region = browserRegion.current;
    if (!region || !selectedTab) return;
    const update = (): void => {
      const bounds = region.getBoundingClientRect();
      sendCommand({
        type: 'layout',
        tabId: selectedTab,
        visible: mode === 'copilot' && !settings && !commandOpen,
        bounds: {
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        },
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(region);
    update();
    return () => {
      observer.disconnect();
    };
  }, [
    mode,
    sidebar,
    panelWidth,
    selectedTab,
    settings,
    commandOpen,
    sendCommand,
    snapshot?.preview,
  ]);
  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [snapshot?.messages.length, snapshot?.task.status]);

  if (!snapshot)
    return (
      <div className="startup">正在打开 Deskwork…{error ? <p role="alert">{error}</p> : null}</div>
    );
  const { task, messages } = snapshot;
  const busy = ['running', 'waiting-user', 'verifying'].includes(task.status);
  const activeSite = snapshot.workspace.sites.find((site) => site.id === selectedTab);
  const submit = (): void => {
    if (!prompt.trim() || busy) return;
    sendCommand({ type: 'send', text: prompt, tabId: selectedTab });
    setPrompt('');
  };
  const style = {
    '--panel-width': `${String(panelWidth)}px`,
    '--sidebar-width': sidebar ? '204px' : '58px',
  } as CSSProperties;

  return (
    <div className={`workspace mode-${mode}`} style={style}>
      <header className="titlebar">
        <div className="window-controls-space" />
        <button
          className="icon-button"
          aria-label="切换侧栏"
          onClick={() => {
            setSidebar(!sidebar);
          }}
        >
          <Icon name="sidebar" />
        </button>
        <span className="workspace-title">{snapshot.workspace.name}</span>
        <button
          className="command-trigger"
          onClick={() => {
            setCommandOpen(true);
          }}
        >
          <Icon name="search" size={15} />
          <span>搜索任务或执行命令</span>
          <kbd>⌘ ⇧ P</kbd>
        </button>
        <span className="preview-label">
          {snapshot.preview ? '交互预览 · 合成数据' : 'M1 PREVIEW'}
        </span>
      </header>
      <div className="workbench">
        <aside className={`sidebar ${sidebar ? '' : 'collapsed'}`}>
          <div className="brand">
            <span className="brand-mark">
              d<span>•</span>
            </span>
            {sidebar ? (
              <span>
                Deskwork<small>让业务，简单发生</small>
              </span>
            ) : null}
          </div>
          <button
            className="new-task"
            title="新建任务"
            onClick={() => {
              sendCommand({ type: 'new-task' });
            }}
            disabled={busy}
          >
            <Icon name="plus" />
            {sidebar ? '新建任务' : null}
          </button>
          <nav aria-label="工作区导航">
            {sidebar ? <div className="section-label">工作空间</div> : null}
            <button
              className="navigation-item active"
              title="业务工作台"
              onClick={() => {
                setMode('copilot');
              }}
            >
              <Icon name="grid" />
              {sidebar ? (
                <>
                  <span>业务工作台</span>
                  <span className="count">{snapshot.workspace.sites.length}</span>
                </>
              ) : null}
            </button>
            <button
              className="navigation-item"
              title="Agent 对话"
              onClick={() => {
                setMode('agent');
              }}
            >
              <Icon name="chat" />
              {sidebar ? <span>Agent 对话</span> : null}
            </button>
          </nav>
          {sidebar ? (
            <div className="task-history">
              <div className="section-label">当前任务</div>
              {task.title ? (
                <button
                  onClick={() => {
                    input.current?.focus();
                  }}
                >
                  <Icon name="clock" size={15} />
                  <span>{task.title}</span>
                </button>
              ) : (
                <p>每一件事，从一句话开始。</p>
              )}
            </div>
          ) : null}
          <div className="sidebar-bottom">
            <button
              className="navigation-item"
              title="模型设置"
              onClick={() => {
                setSettings(true);
              }}
            >
              <Icon name="settings" />
              {sidebar ? '设置与连接' : null}
            </button>
            {sidebar ? (
              <div className="local-status">
                <span className="status-dot" />
                登录会话保存在本机
              </div>
            ) : null}
          </div>
        </aside>
        <main className="main-workspace">
          <div className="workspace-toolbar">
            <div className="breadcrumb">
              <span>工作台</span>
              <Icon name="chevron" size={13} />
              <strong>森果档口批发</strong>
            </div>
            <div className="mode-switch" aria-label="工作模式">
              <button
                aria-pressed={mode === 'copilot'}
                onClick={() => {
                  setMode('copilot');
                }}
              >
                <Icon name="sidebar" size={14} />
                Copilot
              </button>
              <button
                aria-pressed={mode === 'agent'}
                onClick={() => {
                  setMode('agent');
                }}
              >
                <Icon name="sparkle" size={14} />
                Agent
              </button>
            </div>
          </div>
          <div className="panels">
            <section className="browser-panel" aria-label="业务页面">
              <div className="tab-strip" role="tablist" aria-label="业务标签">
                {snapshot.workspace.sites.map((site) => (
                  <button
                    role="tab"
                    key={site.id}
                    aria-selected={selectedTab === site.id}
                    onClick={() => {
                      setTabId(site.id);
                    }}
                  >
                    <span className="site-mark">森</span>
                    {site.name}
                  </button>
                ))}
              </div>
              <div className="address-bar">
                <button
                  className="icon-button"
                  aria-label="刷新业务页面"
                  onClick={() => {
                    sendCommand({ type: 'reload', tabId: selectedTab });
                  }}
                >
                  <Icon name="refresh" size={15} />
                </button>
                <Icon name="lock" size={12} />
                <span>{activeSite ? new URL(activeSite.url).hostname : ''}</span>
                <span className="session-label">独立业务会话</span>
              </div>
              <div className="browser-region" ref={browserRegion}>
                {snapshot.preview ? (
                  <PreviewBusiness />
                ) : (
                  <div className="browser-placeholder">
                    <Icon name="link" size={28} />
                    <p>正在打开业务页面</p>
                    <small>请在页面中自行登录，DSH 将使用同一会话。</small>
                  </div>
                )}
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
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId))
                    setPanelWidth(Math.max(340, Math.min(600, window.innerWidth - event.clientX)));
                }}
                onPointerUp={(event) => {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
              />
            ) : null}
            <section className="assistant-panel" aria-label="DSH 对话">
              <div className="assistant-header">
                <span className="assistant-symbol">
                  <Icon name="sparkle" size={16} />
                </span>
                <strong>DSH 助手</strong>
                <span className="assistant-caption">你的业务搭档</span>
                {mode === 'agent' ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      setMode('copilot');
                    }}
                  >
                    查看页面
                  </button>
                ) : null}
              </div>
              <div className="bound-context">
                <Icon name="link" size={13} />
                <span>
                  {task.target
                    ? snapshot.workspace.sites.find((site) => site.id === task.target?.tabId)?.name
                    : activeSite?.name}
                </span>
                <span className="context-tag">{task.target ? '任务已绑定' : '当前页面'}</span>
              </div>
              <div className="conversation" aria-live="polite">
                {messages.length === 0 ? (
                  <div className="welcome">
                    <div className="welcome-symbol">
                      <Icon name="sparkle" size={26} />
                    </div>
                    <span className="eyebrow">少一些操作，多一些完成</span>
                    <h1>今天，有什么需要处理？</h1>
                    <p>
                      打开熟悉的业务系统，告诉我你的目标。
                      <br />
                      我会协助查询、整理，并准备好下一步。
                    </p>
                    <div className="suggestions">
                      <button
                        onClick={() => {
                          setPrompt('帮我查看当前页面的商品资料');
                          input.current?.focus();
                        }}
                      >
                        <Icon name="search" size={16} />
                        <span>查看当前商品资料</span>
                        <Icon name="chevron" size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setPrompt('帮我修改商品备注，保存前让我确认');
                          input.current?.focus();
                        }}
                      >
                        <Icon name="check" size={16} />
                        <span>准备一项资料修改</span>
                        <Icon name="chevron" size={14} />
                      </button>
                    </div>
                    <div className="welcome-note">
                      <Icon name="lock" size={13} />
                      保存前，你始终可以核对与接手
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <article key={message.id} className={`message message-${message.role}`}>
                      <div className="message-label">
                        {message.role === 'user' ? (
                          '你'
                        ) : (
                          <>
                            <Icon name="sparkle" size={14} />
                            DSH
                          </>
                        )}
                      </div>
                      <p>{message.text}</p>
                    </article>
                  ))
                )}
                <TaskCard
                  task={task}
                  confirm={(confirmationId) => {
                    sendCommand({ type: 'confirm', confirmationId });
                  }}
                />
                {error ? (
                  <div className="error-banner" role="alert">
                    {error}
                  </div>
                ) : null}
                <div ref={conversationEnd} />
              </div>
              <div className="composer-area">
                {busy ? (
                  <div className="execution-controls">
                    <span>
                      <span className="status-dot pulsing" />
                      {task.status === 'waiting-user' ? '等待确认' : '任务进行中'}
                    </span>
                    {task.status === 'verifying' ? (
                      <button
                        className="text-button"
                        onClick={() => {
                          sendCommand({ type: 'resume' });
                        }}
                      >
                        重新核对结果
                      </button>
                    ) : null}
                    <button
                      className="text-button"
                      onClick={() => {
                        sendCommand({ type: 'stop' });
                      }}
                    >
                      <Icon name="stop" size={12} />
                      停止并接手
                    </button>
                  </div>
                ) : ['paused', 'failed'].includes(task.status) ? (
                  <button
                    className="resume-button"
                    onClick={() => {
                      sendCommand({ type: 'resume' });
                    }}
                  >
                    重新观察并继续
                    <Icon name="chevron" size={14} />
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
                    aria-label="告诉 DSH 你的业务目标"
                    placeholder="告诉我你想完成的业务…"
                    value={prompt}
                    disabled={busy}
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
                        setSettings(true);
                      }}
                    >
                      <span className="status-dot" />
                      DeepSeek
                      <small>{snapshot.runtimeConfigured ? '已连接配置' : '配置模型'}</small>
                    </button>
                    <button
                      className="send-button"
                      type="submit"
                      aria-label="发送任务"
                      disabled={!prompt.trim() || busy}
                    >
                      <Icon name="arrow" size={17} />
                    </button>
                  </div>
                </form>
                <p className="composer-hint">
                  Enter 发送 · Shift Enter 换行<span>DSH Deskwork</span>
                </p>
              </div>
            </section>
          </div>
        </main>
      </div>
      <footer className="statusbar">
        <span>
          <span className="status-dot" />
          本地工作区
        </span>
        <span>
          {snapshot.preview ? '界面预览不连接真实 ERP 或模型' : '业务浏览器 · 身份与任务明确绑定'}
        </span>
        <span>Deskwork 0.1.0</span>
      </footer>
      {settings ? (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
          >
            <div className="modal-heading">
              <h2 id="settings-title">连接 DeepSeek</h2>
              <button
                className="icon-button"
                aria-label="关闭设置"
                onClick={() => {
                  setSettings(false);
                }}
              >
                <Icon name="close" />
              </button>
            </div>
            <p className="muted">API 密钥由本机安全存储保存，仅供 DSH 运行时使用。</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void bridge
                  .command({ type: 'settings', apiKey, model })
                  .then(() => {
                    setApiKey('');
                    setSettings(false);
                  })
                  .catch((reason: unknown) => {
                    setError(String(reason));
                  });
              }}
            >
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
                  value={apiKey}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                  }}
                  autoComplete="off"
                  required
                />
              </label>
              {snapshot.preview ? <p className="muted">这是交互预览，请勿输入真实密钥。</p> : null}
              {error ? <p role="alert">{error}</p> : null}
              <button className="primary full" type="submit">
                保存连接配置
              </button>
            </form>
          </section>
        </div>
      ) : null}
      {commandOpen ? (
        <div className="modal-backdrop">
          <section
            className="modal command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="命令面板"
          >
            <h2>你想做什么？</h2>
            {[
              ['切换到 Copilot', 'copilot'],
              ['切换到 Agent', 'agent'],
            ].map(([label, value]) => (
              <button
                key={value}
                onClick={() => {
                  setMode(value === 'agent' ? 'agent' : 'copilot');
                  setCommandOpen(false);
                }}
              >
                <Icon name="grid" />
                {label}
              </button>
            ))}
            <button
              onClick={() => {
                setCommandOpen(false);
                setSettings(true);
              }}
            >
              <Icon name="settings" />
              设置模型连接
            </button>
            <button
              onClick={() => {
                setCommandOpen(false);
              }}
            >
              <Icon name="close" />
              关闭命令面板
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PreviewBusiness(): ReactElement {
  return (
    <div className="preview-business">
      <div className="erp-demo-header">
        <span className="erp-logo">森果</span>
        <strong>档口批发</strong>
        <span>演示档口</span>
      </div>
      <div className="erp-demo-body">
        <nav>
          <strong>业务管理</strong>
          <span>经营概览</span>
          <span>销售开单</span>
          <span>采购入库</span>
          <span className="selected">商品资料</span>
          <span>客户管理</span>
          <span>库存查询</span>
        </nav>
        <div className="erp-product">
          <div className="erp-breadcrumb">基础资料 / 商品资料</div>
          <h2>商品资料</h2>
          <p>管理档口商品，让每一笔生意清清楚楚。</p>
          <div className="erp-search">
            搜索商品名称或编号 <Icon name="search" size={15} />
          </div>
          <div className="erp-table">
            <div className="erp-table-row heading">
              <span>商品名称</span>
              <span>编号</span>
              <span>状态</span>
            </div>
            <div className="erp-table-row">
              <strong>山东红富士苹果</strong>
              <span>SG-1001</span>
              <span className="erp-active">在售</span>
            </div>
          </div>
          <div className="erp-record">
            <div className="erp-record-title">
              <span className="product-monogram">果</span>
              <div>
                <strong>山东红富士苹果</strong>
                <small>商品编号 SG-1001</small>
              </div>
            </div>
            <label>商品备注</label>
            <div className="erp-field">优选果，常温存放</div>
            <small>仅用于展示工作台与业务页面的关系</small>
          </div>
          <div className="synthetic-label">合成 ERP 页面 · 非森果真实界面</div>
        </div>
      </div>
    </div>
  );
}
