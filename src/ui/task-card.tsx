import type { ReactElement } from 'react';
import type { TaskState } from '../core/contracts.ts';
import { Icon } from './icon.tsx';

export function TaskCard({
  task,
  confirm,
}: {
  task: TaskState;
  confirm: (id: string) => void;
}): ReactElement | null {
  if (task.status === 'idle') return null;
  const change = task.confirmation;
  return (
    <section className={`task-card state-${task.status}`} aria-label="任务状态">
      <div className="task-card-heading">
        <Icon name={task.status === 'succeeded' ? 'check' : 'sparkle'} />
        <strong>
          {task.status === 'succeeded'
            ? task.writeVerified
              ? '已完成并核对'
              : '本轮已完成'
            : task.status === 'waiting-user'
              ? '等待你确认'
              : task.status === 'paused'
                ? '已暂停 · 可以接手'
                : task.status === 'failed'
                  ? '需要处理'
                  : task.status === 'verifying'
                    ? '正在核对结果'
                    : '正在处理'}
        </strong>
      </div>
      {task.steps.length > 0 ? (
        <ol className="steps">
          {task.steps.map((step) => (
            <li key={step.id}>
              <Icon name="check" size={14} />
              {step.text}
            </li>
          ))}
        </ol>
      ) : null}
      <p className="muted">{task.detail}</p>
      {change ? (
        <div className="change-preview">
          <div className="object-context">
            <span>{change.record.shopId}</span>
            <strong>{change.record.name}</strong>
            <small>
              {change.record.objectId} · {change.record.field}
            </small>
          </div>
          <div className="change-value before">
            <small>修改前</small>
            <p>{change.record.value || '空'}</p>
          </div>
          <div className="change-value after">
            <small>修改后</small>
            <p>{change.nextValue || '空'}</p>
          </div>
          {task.status === 'waiting-user' ? (
            <button
              className="primary full"
              onClick={() => {
                confirm(change.id);
              }}
            >
              <Icon name="check" size={16} />
              确认并保存
            </button>
          ) : null}
        </div>
      ) : null}
      {task.result && task.status === 'succeeded' ? (
        <div className="result-summary">
          <strong>{task.result.name}</strong>
          <span>
            {task.result.field}：{task.result.value}
          </span>
        </div>
      ) : null}
      <details className="technical-details">
        <summary>执行详情</summary>
        <p>
          模型请求 {task.metrics.modelCalls} · 工具调用 {task.metrics.toolCalls} ·{' '}
          {Math.round(task.metrics.elapsedMs / 1000)} 秒
        </p>
        <p>{task.metrics.skillReused ? '复用已验证的业务技能' : '首次执行或尚未复用'}</p>
      </details>
    </section>
  );
}
