import type { ReactElement } from 'react';
import type { TaskState } from '../core/contracts.ts';
import { Icon } from './icon.tsx';
const labels = {
  idle: '准备就绪',
  running: '正在处理',
  'waiting-user': '等待你确认',
  paused: '已暂停 · 可以接手',
  verifying: '结果待核对',
  succeeded: '本轮已完成',
  failed: '需要处理',
  cancelled: '已取消',
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
    <section className={`task-card state-${task.status}`} aria-label="任务状态">
      <div className="task-card-heading">
        <Icon name={task.status === 'succeeded' ? 'check' : 'sparkle'} />
        <strong>{labels[task.status]}</strong>
      </div>
      <p>{task.detail}</p>
      {change ? (
        <div className="change-preview">
          <small>
            {change.observation.title} · {new URL(change.observation.url).hostname}
          </small>
          <strong>{change.proposal.summary}</strong>
          {change.proposal.expectedText ? <p>预期结果：{change.proposal.expectedText}</p> : null}
          {element ? <p>目标：{element.name || element.tag}</p> : null}
          {action?.kind === 'key' ? <p>按键：{action.key}</p> : null}
          {action && 'value' in action ? (
            <>
              <div className="change-value before">
                <small>当前值</small>
                <p>{element?.value || '空'}</p>
              </div>
              <div className="change-value after">
                <small>将填写</small>
                <p>{action.value || '空'}</p>
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
            确认并执行
          </button>
        </div>
      ) : null}
      {task.status === 'verifying' ? (
        <div className="verification-actions">
          <p className="muted">请重新打开或刷新网站的结果页面。表单中的新值本身不代表保存成功。</p>
          <button
            className="primary full"
            onClick={() => {
              resolve('verified');
            }}
          >
            我已核对，结果正确
          </button>
          <button
            className="full"
            onClick={() => {
              resolve('not-applied');
            }}
          >
            确认未生效，结束核对
          </button>
        </div>
      ) : null}
      {task.result ? (
        <details>
          <summary>最近观察的页面</summary>
          <p>{task.result.title}</p>
          <p className="evidence-text">{task.result.text.slice(0, 2000)}</p>
        </details>
      ) : null}
      <details className="technical-details">
        <summary>执行步骤与详情</summary>
        <ol>
          {task.steps.map((step) => (
            <li key={step.id}>{step.text}</li>
          ))}
        </ol>
        <p>
          模型请求 {task.metrics.modelCalls} · 工具调用 {task.metrics.toolCalls} ·{' '}
          {Math.round(task.metrics.elapsedMs / 1000)} 秒
        </p>
      </details>
    </section>
  );
}
