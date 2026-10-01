import { useI18n } from './locale.tsx';
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
  const t = useI18n();
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
    <section className="development-panel" aria-label={t('Plugin development connection')}>
      <h3>{t('Plugin development')}</h3>
      <p className="muted">
        {t(
          'The app includes developer guides and the browser SDK. Once connected, an external coding AI can read and operate the selected website. Queries can run continuously; consequential actions require confirmation in the workspace.',
        )}
      </p>
      {state.connected ? (
        <>
          <p role="status">
            {t('Connected:')}
            {sites.find((site) => site.id === state.siteId)?.name ?? t('Development website')}
            {t('. Switching tabs does not change the target.')}
          </p>
          <label>
            {t('MCP configuration for external AI')}
            <textarea
              aria-label={t('Development MCP configuration')}
              readOnly
              value={state.configuration}
              rows={9}
            />
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
              {copied ? t('Copied') : t('Copy MCP configuration')}
            </button>
            <button
              disabled={busy}
              onClick={() => {
                void disconnect();
              }}
            >
              {t('Disconnect development session')}
            </button>
          </div>
          <small>
            {t(
              'After confirmation, ask the external AI to read task status and observe again. Disconnecting or quitting invalidates the old connection.',
            )}
          </small>
        </>
      ) : (
        <>
          <label>
            {t('Development website')}
            <select
              aria-label={t('Development website')}
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value);
              }}
              disabled={busy}
            >
              {!sites.length ? <option value="">{t('Add a website first')}</option> : null}
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
            {t('Allow external AI to develop this website')}
          </button>
        </>
      )}
      {error ? <p role="alert">{t(error)}</p> : null}
    </section>
  );
}
