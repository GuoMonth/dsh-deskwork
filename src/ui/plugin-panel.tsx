import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import type {
  PluginBridge,
  PluginCommand,
  PluginState,
  MarketPlugin,
  InstalledPlugin,
} from '../core/plugin-contracts.ts';
import type { Site } from '../core/contracts.ts';

export function PluginPanel({
  bridge,
  sites,
}: {
  bridge: PluginBridge;
  sites: readonly Site[];
}): ReactElement {
  const [state, setState] = useState<PluginState>({ installed: [], busy: false, progress: '' });
  const [results, setResults] = useState<MarketPlugin[]>([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [trusted, setTrusted] = useState(false);
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
    const timer = working ? setInterval(refresh, 1200) : undefined;
    return (): void => {
      disposed = true;
      clearInterval(timer);
    };
  }, [bridge, working]);
  async function run(command: PluginCommand): Promise<void> {
    setError('');
    setWorking(true);
    try {
      await bridge.command(command);
      setState(await bridge.state());
      if (command.action === 'install') {
        setSource('');
        setTrusted(false);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="plugin-panel">
      <p className="muted">从 DSH 社区市场安装本地扩展，为网站添加知识、技能和工具。</p>
      <form
        className="plugin-search"
        onSubmit={(event) => {
          event.preventDefault();
          setError('');
          setWorking(true);
          void bridge
            .search(query)
            .then(setResults)
            .catch((reason: unknown) => {
              setError(String(reason));
            })
            .finally(() => {
              setWorking(false);
            });
        }}
      >
        <input
          aria-label="搜索插件"
          placeholder="搜索市场中的插件"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        <button type="submit" disabled={working}>
          搜索市场
        </button>
      </form>
      {results.length ? (
        <div className="plugin-results" aria-label="市场搜索结果">
          {results.map((entry) => (
            <article key={entry.url} className="plugin-result">
              <strong>{entry.name}</strong>
              <span className="muted">{entry.owner}</span>
              <p>{entry.description}</p>
              <button
                disabled={working}
                onClick={() => {
                  setSource(entry.source);
                  setTrusted(false);
                }}
              >
                选择安装
              </button>
            </article>
          ))}
        </div>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run({ action: 'install', source: source.trim(), trusted: true });
        }}
      >
        <label>
          安装来源
          <input
            aria-label="插件安装来源"
            value={source}
            placeholder="npm 包名、GitHub 地址或 file:/ 本地插件目录"
            required
            onChange={(event) => {
              setSource(event.target.value);
              setTrusted(false);
            }}
          />
        </label>
        <label className="plugin-trust">
          <input
            type="checkbox"
            checked={trusted}
            onChange={(event) => {
              setTrusted(event.target.checked);
            }}
          />
          我信任此来源，并允许扩展在本机执行代码、访问文件和网络。
        </label>
        <button className="primary" disabled={working || state.busy || !trusted || !source.trim()}>
          安装插件
        </button>
      </form>
      <p role="status" className="muted">
        {state.progress || '安装后可启用、挂载到网站或随时取消。'}
      </p>
      {error ? (
        <pre role="alert" className="plugin-error">
          {error}
        </pre>
      ) : null}
      <h3>已安装 · {state.installed.length}</h3>
      {!state.installed.length ? <p className="muted">还没有安装插件。网站可以照常使用。</p> : null}
      {state.installed.map((plugin) => (
        <PluginSettings
          key={`${plugin.name}-${plugin.installationId}`}
          plugin={plugin}
          sites={sites}
          busy={working || state.busy}
          run={run}
        />
      ))}
    </div>
  );
}
function PluginSettings({
  plugin,
  sites,
  busy,
  run,
}: {
  plugin: InstalledPlugin;
  sites: readonly Site[];
  busy: boolean;
  run: (command: PluginCommand) => Promise<void>;
}): ReactElement {
  const [mountName, setMountName] = useState(plugin.mountName);
  const [siteIds, setSiteIds] = useState(plugin.siteIds);
  const [allSites, setAllSites] = useState(!plugin.siteIds.length);
  return (
    <article className="plugin-installed">
      <strong>{plugin.name}</strong>{' '}
      <span className="muted">
        {plugin.version} · {plugin.enabled ? '已启用' : '已禁用'}
      </span>
      <p className="muted plugin-source">{plugin.source}</p>
      <label>
        唯一挂载名
        <input
          value={mountName}
          pattern="[a-zA-Z0-9_-]+"
          maxLength={80}
          onChange={(event) => {
            setMountName(event.target.value);
          }}
        />
      </label>
      <label className="plugin-trust">
        <input
          type="checkbox"
          checked={allSites}
          onChange={(event) => {
            setAllSites(event.target.checked);
          }}
        />
        所有网站
      </label>
      {!allSites ? (
        <div className="plugin-sites">
          {sites.map((site) => (
            <label className="plugin-trust" key={site.id}>
              <input
                type="checkbox"
                checked={siteIds.includes(site.id)}
                onChange={(event) => {
                  setSiteIds(
                    event.target.checked
                      ? [...siteIds, site.id]
                      : siteIds.filter((id) => id !== site.id),
                  );
                }}
              />
              {site.name}
            </label>
          ))}
        </div>
      ) : null}
      <div className="plugin-actions">
        <button
          disabled={busy || !mountName || (!allSites && !siteIds.length)}
          onClick={() => {
            void run({
              action: 'configure',
              name: plugin.name,
              mountName,
              enabled: true,
              siteIds: allSites ? [] : siteIds,
            });
          }}
        >
          保存并启用
        </button>
        <button
          disabled={busy || !plugin.enabled}
          onClick={() => {
            void run({
              action: 'configure',
              name: plugin.name,
              mountName: plugin.mountName,
              enabled: false,
              siteIds: plugin.siteIds,
            });
          }}
        >
          取消挂载
        </button>
        <button
          disabled={busy}
          onClick={() => {
            void run({ action: 'update', name: plugin.name });
          }}
        >
          更新
        </button>
        <button
          className="danger"
          disabled={busy}
          onClick={() => {
            void run({ action: 'remove', name: plugin.name });
          }}
        >
          卸载
        </button>
      </div>
    </article>
  );
}
