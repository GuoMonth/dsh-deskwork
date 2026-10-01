import { randomUUID } from 'node:crypto';
import type { BrowserActionResult } from '../../packages/plugin-sdk/src/index.ts';
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
      this.state.detail =
        'The previous action needs verification and will not be submitted again automatically';
    } else if (['running', 'waiting-user'].includes(restored.status)) {
      this.state.status = 'paused';
      this.state.confirmation = null;
      this.state.detail =
        'The previous task was interrupted. Observe the page again before continuing.';
    }
  }
  isBusy(): boolean {
    return this.busy;
  }
  target(): TaskTarget {
    if (!this.state.target) throw new Error('The task has no website target');
    return this.state.target;
  }
  async start(target: TaskTarget, title: string): Promise<void> {
    if (this.busy || ['running', 'waiting-user', 'verifying'].includes(this.state.status))
      throw new Error('Stop the task or verify its result first');
    this.generation++;
    this.state = {
      ...idleTask(),
      id: randomUUID(),
      target,
      title,
      status: 'running',
      detail: 'Observing the website',
      metrics: { modelCalls: 0, toolCalls: 0, startedAt: Date.now(), elapsedMs: 0 },
    };
    await this.save();
  }
  async observe(pageId?: string): Promise<PageObservation> {
    if (!['running', 'verifying'].includes(this.state.status)) throw new Error('Task paused');
    const generation = this.generation;
    const observation = await this.browser.observe(this.target(), pageId);
    if (generation !== this.generation) throw new Error('Task stopped');
    this.state.result = observation;
    await this.step('Observed page: ' + observation.title);
    return observation;
  }
  async propose(
    proposal: ActionProposal,
    pluginEffect?: 'read' | 'write' | 'unknown',
  ): Promise<BrowserActionResult> {
    if (this.busy || this.state.status !== 'running')
      throw new Error('The task is not running or is waiting for confirmation');
    this.busy = true;
    const generation = this.generation;
    try {
      const observation = await this.browser.observe(this.target(), proposal.pageId);
      if (generation !== this.generation) throw new Error('Task stopped');
      if (observation.revision !== proposal.revision)
        throw new Error('The page changed. Observe it again.');
      if (
        pluginEffect === 'write' ||
        pluginEffect === 'unknown' ||
        (this.browser.needsConfirmation(observation, proposal) &&
          !(pluginEffect === 'read' && pluginReadActionIsAllowed(observation, proposal)))
      ) {
        this.state.confirmation = { id: randomUUID(), proposal, observation };
        this.state.status = 'waiting-user';
        this.state.detail = 'Confirm the action to execute';
        await this.step(proposal.summary);
        return {
          status: 'waiting-for-human-confirmation',
          confirmationId: this.state.confirmation.id,
        };
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
      throw new Error('Confirmation expired');
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
          ? 'The page or input changed. Verify the action already sent; the old confirmation will not execute.'
          : 'The page or input changed. Observe and confirm again.';
        await this.save();
        throw new Error(this.state.detail);
      }
      this.state.confirmation = null;
      this.state.pendingAction = confirmation;
      this.state.requiresVerification = true;
      this.state.status = 'verifying';
      this.state.detail = 'Executing the confirmed action';
      await this.save();
      try {
        await this.browser.execute(
          this.target(),
          confirmation.proposal,
          () => generation === this.generation,
        );
        if (generation === this.generation) {
          this.state.status = 'running';
          this.state.detail = 'Action executed; observe the actual result next';
        }
      } catch {
        this.state.status = 'verifying';
        this.state.detail =
          'The action response is uncertain. Check the page; the action will not be repeated.';
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
      this.state.status === 'verifying'
        ? 'Stopped; actions already sent still need verification'
        : 'Stopped. You can take over the page.';
    await this.save();
  }
  async resume(): Promise<void> {
    if (this.busy) throw new Error('The previous operation is still running');
    if (this.state.status === 'verifying') {
      const result = await this.verify();
      if (!result.verified) await this.observe();
      return;
    }
    if (!['paused', 'failed'].includes(this.state.status))
      throw new Error('The current task cannot resume');
    this.generation++;
    this.state.status = 'running';
    this.state.confirmation = null;
    await this.observe();
  }
  async verify(): Promise<{ verified: boolean; detail: string }> {
    if (!['running', 'verifying'].includes(this.state.status) || this.busy)
      throw new Error('Cannot verify at this time');
    const pending = this.state.pendingAction;
    const expected = pending?.proposal.expectedText;
    if (!pending || !expected || pending.observation.text.includes(expected))
      return {
        verified: false,
        detail: 'No independently verifiable expected change. Check the original page.',
      };
    const generation = this.generation;
    this.busy = true;
    try {
      const actual = await this.browser.readback(this.target(), pending.proposal.pageId);
      if (generation !== this.generation) throw new Error('Task stopped');
      this.state.result = actual;
      const verified = actual.text.includes(expected) && actual.url === pending.observation.url;
      if (verified) {
        this.state.requiresVerification = false;
        this.state.pendingAction = null;
        if (this.state.status === 'verifying') this.state.status = 'succeeded';
        this.state.detail = 'Refreshed page matches the expected result you confirmed';
      } else
        this.state.detail =
          'The refreshed page does not yet verify the expected result. Check it; the action will not be submitted again.';
      await this.save();
      return { verified, detail: this.state.detail };
    } finally {
      this.busy = false;
    }
  }
  async resolveResult(outcome: 'verified' | 'not-applied'): Promise<void> {
    if (this.busy || this.state.status !== 'verifying')
      throw new Error('No result awaiting verification');
    this.state.requiresVerification = false;
    this.state.pendingAction = null;
    this.state.status = outcome === 'verified' ? 'succeeded' : 'paused';
    this.state.detail =
      outcome === 'verified'
        ? 'You verified the result on the original website'
        : 'You confirmed the action was not applied. Start a new action if needed.';
    await this.save();
  }
  async finish(detail: string): Promise<void> {
    if (this.state.status !== 'running') return;
    this.state.status = this.state.requiresVerification ? 'verifying' : 'succeeded';
    this.state.detail = this.state.requiresVerification
      ? 'Reopen or refresh the result page on the original website to verify the action'
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
