import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type { DevelopmentBridge, DevelopmentState } from '../core/development-contracts.ts';
import type { Site } from '../core/contracts.ts';

export function DevelopmentPanel({
  bridge,
  sites,
}: {
  bridge: DevelopmentBridge;
  sites: readonly Site[];
}): ReactElement {
  const [state, setState] = useState<DevelopmentState>({
    connected: false,
    siteId: null,
    configuration: '',
  });
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let disposed = false;
    const refresh = (): void => {
      void bridge
        .state()
        .then((value) => {
          if (!disposed) setState(value);
        })
        .catch((reason: unknown) => {
          if (!disposed) setError(String(reason));
        });
    };
    refresh();
    const timer = setInterval(refresh, 1500);
    return (): void => {
      disposed = true;
      clearInterval(timer);
    };
  }, [bridge]);
  async function connect(): Promise<void> {
    setBusy(true);
    setError('');
    setCopied(false);
    try {
      setState(await bridge.start(siteId));
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
  async function disconnect(): Promise<void> {
    setBusy(true);
    setError('');
    try {
      await bridge.stop();
      setState(await bridge.state());
    } catch (reason: unknown) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="development-panel" aria-label="插件开发连接">
      <h3>插件开发</h3>
      <p className="muted">
        开发指南和浏览器 SDK 已随客户端提供。连接后，外部编程 AI
        可读取并操作选定网站；查询可连续执行，关键操作在工作台确认。
      </p>
      {state.connected ? (
        <>
          <p role="status">
            已连接：{sites.find((site) => site.id === state.siteId)?.name ?? '开发网站'}
            。切换标签不会改变目标。
          </p>
          <label>
            外部 AI 的 MCP 配置
            <textarea aria-label="开发 MCP 配置" readOnly value={state.configuration} rows={9} />
          </label>
          <div className="development-actions">
            <button
              onClick={() => {
                void navigator.clipboard
                  .writeText(state.configuration)
                  .then(() => {
                    setCopied(true);
                  })
                  .catch((reason: unknown) => {
                    setError(String(reason));
                  });
              }}
            >
              {copied ? '已复制' : '复制 MCP 配置'}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                void disconnect();
              }}
            >
              断开开发连接
            </button>
          </div>
          <small>
            完成确认后，让外部 AI 读取任务状态并重新观察。断开或退出客户端后，旧连接失效。
          </small>
        </>
      ) : (
        <>
          <label>
            开发网站
            <select
              aria-label="开发网站"
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value);
              }}
              disabled={busy}
            >
              {!sites.length ? <option value="">请先添加网站</option> : null}
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={busy || !sites.some((site) => site.id === siteId)}
            onClick={() => {
              void connect();
            }}
          >
            允许外部 AI 开发此网站
          </button>
        </>
      )}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
