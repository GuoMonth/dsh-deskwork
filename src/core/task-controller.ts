import { randomUUID } from 'node:crypto';
import { idleTask } from './contracts.ts';
import { pluginReadActionIsAllowed } from './plugin-action-policy.ts';
import type {
  ActionProposal,
  BrowserAdapter,
  PageObservation,
  TaskState,
  TaskTarget,
} from './contracts.ts';

export class TaskController {
  state: TaskState;
  private generation = 0;
  private busy = false;
  private readonly browser: BrowserAdapter;
  private readonly persist: (state: TaskState) => Promise<void>;
  constructor(
    browser: BrowserAdapter,
    persist: (state: TaskState) => Promise<void>,
    restored = idleTask(),
  ) {
    this.browser = browser;
    this.persist = persist;
    this.state = restored;
    if (restored.pendingAction || restored.requiresVerification) {
      this.state.status = 'verifying';
      this.state.confirmation = null;
      this.state.detail = '上次操作结果待核对，不会自动重新提交';
    } else if (['running', 'waiting-user'].includes(restored.status)) {
      this.state.status = 'paused';
      this.state.confirmation = null;
      this.state.detail = '上次任务已中断，继续前重新观察页面';
    }
  }
  isBusy(): boolean {
    return this.busy;
  }
  target(): TaskTarget {
    if (!this.state.target) throw new Error('任务尚未绑定网站');
    return this.state.target;
  }
  async start(target: TaskTarget, title: string): Promise<void> {
    if (this.busy || ['running', 'waiting-user', 'verifying'].includes(this.state.status))
      throw new Error('请先停止任务或核对结果');
    this.generation++;
    this.state = {
      ...idleTask(),
      id: randomUUID(),
      target,
      title,
      status: 'running',
      detail: '正在观察网站',
      metrics: { modelCalls: 0, toolCalls: 0, startedAt: Date.now(), elapsedMs: 0 },
    };
    await this.save();
  }
  async observe(pageId?: string): Promise<PageObservation> {
    if (!['running', 'verifying'].includes(this.state.status)) throw new Error('任务已暂停');
    const generation = this.generation;
    const observation = await this.browser.observe(this.target(), pageId);
    if (generation !== this.generation) throw new Error('任务已停止');
    this.state.result = observation;
    await this.step('已观察页面：' + observation.title);
    return observation;
  }
  async propose(
    proposal: ActionProposal,
    pluginEffect?: 'read' | 'write' | 'unknown',
  ): Promise<{ status: string }> {
    if (this.busy || this.state.status !== 'running') throw new Error('任务未运行或正在等待确认');
    this.busy = true;
    const generation = this.generation;
    try {
      const observation = await this.browser.observe(this.target(), proposal.pageId);
      if (generation !== this.generation) throw new Error('任务已停止');
      if (observation.revision !== proposal.revision) throw new Error('页面已变化，请重新观察');
      if (
        pluginEffect === 'write' ||
        pluginEffect === 'unknown' ||
        (this.browser.needsConfirmation(observation, proposal) &&
          !(pluginEffect === 'read' && pluginReadActionIsAllowed(observation, proposal)))
      ) {
        this.state.confirmation = { id: randomUUID(), proposal, observation };
        this.state.status = 'waiting-user';
        this.state.detail = '请确认即将执行的操作';
        await this.step(proposal.summary);
        return { status: 'waiting-for-human-confirmation' };
      }
      await this.browser.execute(
        this.target(),
        proposal,
        () => generation === this.generation && this.state.status === 'running',
      );
      await this.step(proposal.summary);
      return { status: 'executed-observe-again' };
    } finally {
      this.busy = false;
    }
  }
  async confirm(id: string): Promise<void> {
    const confirmation = this.state.confirmation;
    if (this.busy || this.state.status !== 'waiting-user' || confirmation?.id !== id)
      throw new Error('确认已失效');
    this.busy = true;
    const generation = this.generation;
    try {
      const current = await this.browser.observe(this.target(), confirmation.proposal.pageId);
      if (
        generation !== this.generation ||
        current.revision !== confirmation.observation.revision
      ) {
        this.state.confirmation = null;
        this.state.status = this.state.requiresVerification ? 'verifying' : 'paused';
        this.state.detail = this.state.requiresVerification
          ? '页面或输入已变化；先核对已发出的操作，旧确认不会执行'
          : '页面或输入已变化，请重新观察并确认';
        await this.save();
        throw new Error(this.state.detail);
      }
      this.state.confirmation = null;
      this.state.pendingAction = confirmation;
      this.state.requiresVerification = true;
      this.state.status = 'verifying';
      this.state.detail = '正在执行已确认动作';
      await this.save();
      try {
        await this.browser.execute(
          this.target(),
          confirmation.proposal,
          () => generation === this.generation,
        );
        if (generation === this.generation) {
          this.state.status = 'running';
          this.state.detail = '动作已执行；继续观察实际结果';
        }
      } catch {
        this.state.status = 'verifying';
        this.state.detail = '操作响应未确认，请查看页面核对，不会重复执行';
      }
      await this.save();
    } finally {
      this.busy = false;
    }
  }
  async stop(): Promise<void> {
    this.generation++;
    this.state.confirmation = null;
    this.state.status =
      this.state.requiresVerification || this.state.pendingAction ? 'verifying' : 'paused';
    this.state.detail =
      this.state.status === 'verifying' ? '已停止；已发出的操作仍需核对' : '已停止，你可以接手页面';
    await this.save();
  }
  async resume(): Promise<void> {
    if (this.busy) throw new Error('上一步尚未结束');
    if (this.state.status === 'verifying') {
      const result = await this.verify();
      if (!result.verified) await this.observe();
      return;
    }
    if (!['paused', 'failed'].includes(this.state.status)) throw new Error('当前任务不能恢复');
    this.generation++;
    this.state.status = 'running';
    this.state.confirmation = null;
    await this.observe();
  }
  async verify(): Promise<{ verified: boolean; detail: string }> {
    if (!['running', 'verifying'].includes(this.state.status) || this.busy)
      throw new Error('当前不能核对');
    const pending = this.state.pendingAction;
    const expected = pending?.proposal.expectedText;
    if (!pending || !expected || pending.observation.text.includes(expected))
      return { verified: false, detail: '没有可独立验证的预期变化，请用户在原页面核对' };
    const generation = this.generation;
    this.busy = true;
    try {
      const actual = await this.browser.readback(this.target(), pending.proposal.pageId);
      if (generation !== this.generation) throw new Error('任务已停止');
      this.state.result = actual;
      const verified = actual.text.includes(expected) && actual.url === pending.observation.url;
      if (verified) {
        this.state.requiresVerification = false;
        this.state.pendingAction = null;
        if (this.state.status === 'verifying') this.state.status = 'succeeded';
        this.state.detail = '已刷新页面，回读结果符合用户确认的预期';
      } else this.state.detail = '刷新后的页面尚未验证预期结果，请核对；不会重复提交';
      await this.save();
      return { verified, detail: this.state.detail };
    } finally {
      this.busy = false;
    }
  }
  async resolveResult(outcome: 'verified' | 'not-applied'): Promise<void> {
    if (this.busy || this.state.status !== 'verifying') throw new Error('当前没有待核对的结果');
    this.state.requiresVerification = false;
    this.state.pendingAction = null;
    this.state.status = outcome === 'verified' ? 'succeeded' : 'paused';
    this.state.detail =
      outcome === 'verified' ? '用户已在原网站核对结果' : '用户确认未生效；需要继续时重新发起操作';
    await this.save();
  }
  async finish(detail: string): Promise<void> {
    if (this.state.status !== 'running') return;
    this.state.status = this.state.requiresVerification ? 'verifying' : 'succeeded';
    this.state.detail = this.state.requiresVerification
      ? '请在原网站重新打开或刷新结果页面，核对操作是否生效'
      : detail;
    await this.save();
  }
  async fail(detail: string): Promise<void> {
    if (!['running', 'verifying'].includes(this.state.status)) return;
    this.state.status = this.state.requiresVerification ? 'verifying' : 'failed';
    this.state.detail = detail;
    await this.save();
  }
  async step(text: string): Promise<void> {
    this.state.steps.push({ id: randomUUID(), text });
    this.state.steps = this.state.steps.slice(-80);
    await this.save();
  }
  async save(): Promise<void> {
    this.state.metrics.elapsedMs = this.state.metrics.startedAt
      ? Date.now() - this.state.metrics.startedAt
      : 0;
    await this.persist(structuredClone(this.state));
  }
}
