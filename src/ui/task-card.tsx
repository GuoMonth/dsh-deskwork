import { useI18n } from './locale.tsx';
import type { ReactElement } from 'react';
import type { TaskState } from '../core/contracts.ts';
import { Icon } from './icon.tsx';
const labels = {
  idle: 'Ready',
  running: 'Working',
  'waiting-user': 'Waiting for your confirmation',
  paused: 'Paused · You can take over',
  verifying: 'Result needs verification',
  succeeded: 'Turn completed',
  failed: 'Needs attention',
  cancelled: 'Cancelled',
};
export function TaskCard({
  task,
  confirm,
  resolve,
}: {
  task: TaskState;
  confirm: (id: string) => void;
  resolve: (outcome: 'verified' | 'not-applied') => void;
}): ReactElement | null {
  const t = useI18n();
  if (task.status === 'idle') return null;
  const change = task.confirmation;
  const action = change?.proposal.action;
  const targetRef =
    action && 'ref' in action
      ? action.ref
      : action?.kind === 'key'
        ? change?.observation.focusedRef
        : undefined;
  const element = change?.observation.elements.find((entry) => entry.ref === targetRef);
  return (
    <section className={`task-card state-${task.status}`} aria-label={t('Task status')}>
      <div className="task-card-heading">
        <Icon name={task.status === 'succeeded' ? 'check' : 'sparkle'} />
        <strong>{t(labels[task.status])}</strong>
      </div>
      <p>{t(task.detail)}</p>
      {change ? (
        <div className="change-preview">
          <small>
            {change.observation.title} · {new URL(change.observation.url).hostname}
          </small>
          <strong>{change.proposal.summary}</strong>
          {change.proposal.expectedText ? (
            <p>
              {t('Expected result:')}
              {change.proposal.expectedText}
            </p>
          ) : null}
          {element ? (
            <p>
              {t('Target:')}
              {element.name || element.tag}
            </p>
          ) : null}
          {action?.kind === 'key' ? (
            <p>
              {t('Key:')}
              {action.key}
            </p>
          ) : null}
          {action && 'value' in action ? (
            <>
              <div className="change-value before">
                <small>{t('Current value')}</small>
                <p>{element?.value || t('Empty')}</p>
              </div>
              <div className="change-value after">
                <small>{t('New value')}</small>
                <p>{action.value || t('Empty')}</p>
              </div>
            </>
          ) : null}
          <button
            className="primary full"
            onClick={() => {
              confirm(change.id);
            }}
          >
            <Icon name="check" />
            {t('Confirm and execute')}
          </button>
        </div>
      ) : null}
      {task.status === 'verifying' ? (
        <div className="verification-actions">
          <p className="muted">
            {t(
              'Reopen or refresh the result page on the website. New form values alone do not prove that a change was saved.',
            )}
          </p>
          <button
            className="primary full"
            onClick={() => {
              resolve('verified');
            }}
          >
            {t('I checked: the result is correct')}
          </button>
          <button
            className="full"
            onClick={() => {
              resolve('not-applied');
            }}
          >
            {t('Not applied: finish verification')}
          </button>
        </div>
      ) : null}
      {task.result ? (
        <details>
          <summary>{t('Last observed page')}</summary>
          <p>{task.result.title}</p>
          <p className="evidence-text">{task.result.text.slice(0, 2000)}</p>
        </details>
      ) : null}
      <details className="technical-details">
        <summary>{t('Execution steps and details')}</summary>
        <ol>
          {task.steps.map((step) => (
            <li key={step.id}>{t(step.text)}</li>
          ))}
        </ol>
        <p>
          {t('Model requests')}
          {task.metrics.modelCalls} {t('· Tool calls')}
          {task.metrics.toolCalls} · {Math.round(task.metrics.elapsedMs / 1000)} {t('seconds')}
        </p>
      </details>
    </section>
  );
}
