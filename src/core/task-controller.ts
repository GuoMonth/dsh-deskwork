import { randomUUID } from 'node:crypto';
import { idleTask } from './contracts.ts';
import type { BusinessRecord, RecordBrowser, TaskState, TaskTarget } from './contracts.ts';

type Persist = (state: TaskState) => Promise<void>;
export class TaskController {
  state: TaskState;
  private generation = 0;
  private readonly browser: RecordBrowser;
  private readonly persist: Persist;
  private inFlight = false;

  constructor(browser: RecordBrowser, persist: Persist, restored: TaskState = idleTask()) {
    this.browser = browser;
    this.persist = persist;
    this.state = restored;
    if (['running', 'waiting-user'].includes(restored.status)) {
      this.state = {
        ...restored,
        status: 'paused',
        confirmation: null,
        detail: '上次任务已中断，继续前将重新读取页面',
      };
    }
  }

  async start(target: TaskTarget, title: string): Promise<void> {
    if (this.inFlight || ['running', 'waiting-user', 'verifying'].includes(this.state.status))
      throw new Error('当前会话已有任务，请先停止或核对结果');
    this.generation++;
    this.state = {
      ...idleTask(),
      id: randomUUID(),
      target,
      title,
      status: 'running',
      detail: '正在理解任务',
      metrics: {
        modelCalls: 0,
        toolCalls: 0,
        startedAt: Date.now(),
        elapsedMs: 0,
        skillReused: false,
      },
    };
    await this.save();
  }

  async read(objectId: string): Promise<BusinessRecord> {
    const generation = this.requireRunning();
    const record = await this.browser.read(this.target(), objectId);
    this.checkGeneration(generation);
    this.state.result = record;
    await this.step(`已读取 ${record.name} · ${record.field}`);
    return record;
  }

  async propose(objectId: string, nextValue: string): Promise<void> {
    const generation = this.requireRunning();
    const record = await this.browser.read(this.target(), objectId);
    this.checkGeneration(generation);
    if (record.value === nextValue) {
      this.state.result = record;
      this.state.status = 'succeeded';
      this.state.detail = '当前值已符合目标，无需保存';
    } else {
      this.state.confirmation = { id: randomUUID(), record, nextValue };
      this.state.status = 'waiting-user';
      this.state.detail = '请核对店铺、商品和修改内容';
    }
    await this.step('已准备变更，尚未保存');
  }

  async confirm(confirmationId: string): Promise<void> {
    const confirmation = this.state.confirmation;
    if (
      this.inFlight ||
      this.state.status !== 'waiting-user' ||
      confirmation?.id !== confirmationId
    )
      throw new Error('确认已失效，请重新读取并准备修改');
    this.inFlight = true;
    const generation = this.generation;
    try {
      const current = await this.browser.read(this.target(), confirmation.record.objectId);
      this.checkGeneration(generation);
      if (JSON.stringify(current) !== JSON.stringify(confirmation.record)) {
        this.state.status = 'paused';
        this.state.confirmation = null;
        this.state.detail = '店铺、商品或页面已变化，请重新核对';
        await this.save();
        return;
      }
      // Persist intent before dispatch: recovery must read the outcome, never replay a save.
      this.state.status = 'verifying';
      this.state.detail = '正在保存并核对结果';
      await this.save();
      this.checkGeneration(generation);
      try {
        await this.browser.write(this.target(), confirmation.record, confirmation.nextValue);
      } catch {
        this.state.detail = '保存响应未确认，正在回读实际结果';
      }
      await this.verify();
    } catch (error) {
      if (generation === this.generation) {
        this.state.detail = error instanceof Error ? error.message : '无法核对结果';
        if (this.state.status !== 'verifying') this.state.status = 'paused';
        await this.save();
      }
    } finally {
      this.inFlight = false;
    }
  }

  async verify(): Promise<void> {
    const confirmation = this.state.confirmation;
    if (!confirmation || this.state.status !== 'verifying') throw new Error('没有待核对的写入');
    const actual = await this.browser.read(this.target(), confirmation.record.objectId, 'server');
    if (
      actual.shopId !== confirmation.record.shopId ||
      actual.objectId !== confirmation.record.objectId ||
      actual.field !== confirmation.record.field
    )
      throw new Error('当前身份或对象不同，请回到原店铺核对结果');
    this.state.result = actual;
    if (actual.value === confirmation.nextValue) {
      this.state.status = 'succeeded';
      this.state.detail = '保存成功，已回读核对';
      this.state.writeVerified = true;
      this.state.confirmation = null;
      await this.step('业务页面中的实际结果与目标一致');
    } else {
      this.state.detail = '结果尚未与目标一致，请核对；不会自动重复保存';
      await this.save();
    }
  }

  async stop(): Promise<void> {
    this.generation++;
    if (this.state.status === 'verifying')
      this.state.detail = '已停止后续操作；已发出的保存仍需核对';
    else {
      this.state.status = 'paused';
      this.state.confirmation = null;
      this.state.detail = '已停止自动操作，你可以接手页面';
    }
    await this.save();
  }

  async resume(): Promise<void> {
    if (this.inFlight) throw new Error('正在等待上一步结束');
    if (this.state.status === 'verifying') {
      await this.verify();
      return;
    }
    if (!['paused', 'failed'].includes(this.state.status)) throw new Error('当前任务不能恢复');
    this.generation++;
    this.state.status = 'running';
    this.state.detail = '恢复任务，重新观察当前页面';
    await this.save();
  }

  async finish(detail: string): Promise<void> {
    if (this.state.status !== 'running') return;
    this.state.status = 'succeeded';
    this.state.detail = detail;
    await this.save();
  }

  async fail(detail: string): Promise<void> {
    if (this.state.status !== 'running') return;
    this.state.status = 'failed';
    this.state.detail = detail;
    await this.save();
  }

  async step(text: string): Promise<void> {
    this.state.steps.push({ id: randomUUID(), text });
    await this.save();
  }

  private target(): TaskTarget {
    if (!this.state.target) throw new Error('任务未绑定业务页面');
    return this.state.target;
  }
  private requireRunning(): number {
    if (this.state.status !== 'running') throw new Error('任务未运行，工具调用已撤销');
    return this.generation;
  }
  private checkGeneration(generation: number): void {
    if (generation !== this.generation) throw new Error('任务已停止');
  }
  private async save(): Promise<void> {
    this.state.metrics.elapsedMs = this.state.metrics.startedAt
      ? Date.now() - this.state.metrics.startedAt
      : 0;
    await this.persist(structuredClone(this.state));
  }
}
