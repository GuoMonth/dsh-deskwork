import { useI18n } from './locale.tsx';
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
import { DevelopmentPanel } from './development-panel.tsx';
import type { DevelopmentBridge } from '../core/development-contracts.ts';

export function PluginPanel({
  bridge,
  sites,
  development,
}: {
  bridge: PluginBridge;
  sites: readonly Site[];
  development: DevelopmentBridge;
}): ReactElement {
  const t = useI18n();
  const [state, setState] = useState<PluginState>({ installed: [], busy: false, progress: '' });
  const [results, setResults] = useState<MarketPlugin[]>([]);
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [trusted, setTrusted] = useState(false);
  const [section, setSection] = useState<'installed' | 'discover' | 'develop'>('installed');
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
        setSection('installed');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="plugin-panel">
      <nav className="plugin-navigation" aria-label={t('Plugin sections')}>
        {(
          [
            ['installed', t(`Installed · ${String(state.installed.length)}`)],
            ['discover', t('Discover')],
            ['develop', t('Develop')],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={section === value}
            onClick={() => {
              setSection(value);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="plugin-content">
        <section hidden={section !== 'discover'} aria-label={t('Discover plugins')}>
          <p className="muted">
            {t(
              'Install local extensions from the DSH community marketplace to add knowledge, skills and tools to your websites.',
            )}
          </p>
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
              aria-label={t('Search plugins')}
              placeholder={t('Search marketplace plugins')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
            />
            <button type="submit" disabled={working}>
              {t('Search marketplace')}
            </button>
          </form>
          {results.length ? (
            <div className="plugin-results" aria-label={t('Marketplace search results')}>
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
                    {t('Select for installation')}
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
              {t('Installation source')}
              <input
                aria-label={t('Plugin installation source')}
                value={source}
                placeholder={t('npm package, GitHub URL or file:/ local plugin directory')}
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
              {t(
                'I trust this source and allow the extension to run code and access files and the network on this computer.',
              )}
            </label>
            <button
              className="primary"
              disabled={working || state.busy || !trusted || !source.trim()}
            >
              {t('Install plugin')}
            </button>
          </form>
        </section>
        <section hidden={section !== 'installed'} aria-label={t('Installed plugins')}>
          <h3>
            {t('Installed ·')}
            {state.installed.length}
          </h3>
          {!state.installed.length ? (
            <div className="plugin-empty">
              <p>{t('No plugins installed. Your websites are ready to use.')}</p>
              <button
                className="primary"
                onClick={() => {
                  setSection('discover');
                }}
              >
                {t('Discover plugins')}
              </button>
            </div>
          ) : null}
          {state.installed.map((plugin) => (
            <PluginSettings
              key={`${plugin.name}-${plugin.installationId}`}
              plugin={plugin}
              sites={sites}
              busy={working || state.busy}
              run={run}
            />
          ))}
        </section>
        {section === 'develop' ? <DevelopmentPanel bridge={development} sites={sites} /> : null}
      </div>
      <div className="plugin-feedback" aria-live="polite">
        <p role="status" className="muted">
          {t(state.progress) ||
            t(
              'After installation, enable or mount a plugin to websites, or remove it at any time.',
            )}
        </p>
        {error ? (
          <pre role="alert" className="plugin-error">
            {t(error)}
          </pre>
        ) : null}
      </div>
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
  const t = useI18n();
  const [mountName, setMountName] = useState(plugin.mountName);
  const [siteIds, setSiteIds] = useState(plugin.siteIds);
  const [allSites, setAllSites] = useState(!plugin.siteIds.length);
  return (
    <article className="plugin-installed">
      <strong>{plugin.name}</strong>{' '}
      <span className="muted">
        {plugin.version} · {plugin.enabled ? t('Enabled') : t('Disabled')}
      </span>
      <p className="muted plugin-source">{plugin.source}</p>
      <label>
        {t('Unique mount name')}
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
        {t('All websites')}
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
          {t('Save and enable')}
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
          {t('Unmount')}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            void run({ action: 'update', name: plugin.name });
          }}
        >
          {t('Update')}
        </button>
        <button
          className="danger"
          disabled={busy}
          onClick={() => {
            void run({ action: 'remove', name: plugin.name });
          }}
        >
          {t('Uninstall')}
        </button>
      </div>
    </article>
  );
}
