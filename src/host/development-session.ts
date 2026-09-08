import { rm, writeFile } from 'node:fs/promises';
import {
  developmentConnectionSchema,
  developmentRequestSchema,
  developmentStatusSchema,
} from '../../packages/plugin-sdk/src/index.ts';
import type { BrowserAdapter } from '../core/contracts.ts';
import type { TaskController } from '../core/task-controller.ts';
import { startValidatedToolServer } from '../runtime/tool-server.ts';
import type { ToolServer } from '../runtime/tool-server.ts';

export class DevelopmentSession {
  private server: ToolServer | undefined;
  private enabled = false;
  private readonly controller: TaskController;
  private readonly browser: BrowserAdapter;
  private readonly filename: string;
  private readonly notify: () => void;
  readonly siteId: string;
  private readonly taskId: string;
  constructor(
    controller: TaskController,
    browser: BrowserAdapter,
    filename: string,
    notify: () => void,
  ) {
    this.controller = controller;
    this.browser = browser;
    this.filename = filename;
    this.notify = notify;
    this.siteId = controller.target().tabId;
    this.taskId = controller.state.id;
  }
  get active(): boolean {
    return this.enabled;
  }
  async open(): Promise<void> {
    if (this.server) throw new Error('开发连接已创建');
    this.server = await startValidatedToolServer(
      (raw) => developmentRequestSchema.parse(raw),
      async (request) => {
        if (!this.enabled || this.controller.state.id !== this.taskId)
          throw new Error('开发连接已撤销');
        const controller = this.controller;
        if (request.name === 'status') return this.status();
        if (request.name === 'stop') {
          await this.stop();
          return { status: 'disconnected' };
        }
        controller.state.metrics.toolCalls++;
        if (request.name === 'verify') return controller.verify();
        if (request.name === 'observe') return controller.observe(request.arguments.pageId);
        if (request.name === 'act' && controller.state.requiresVerification)
          return { status: 'verification-required', task: this.status() };
        if (controller.state.status !== 'running') return { status: 'paused', task: this.status() };
        switch (request.name) {
          case 'act':
            return controller.propose(request.arguments.proposal, request.arguments.effect);
          case 'pages':
            return { pages: this.browser.pages(controller.target()) };
          case 'capture':
            return {
              image: await this.browser.screenshot(controller.target(), request.arguments.pageId),
            };
          case 'select-page':
            this.browser.selectPage(controller.target(), request.arguments.pageId);
            return controller.observe(request.arguments.pageId);
        }
      },
      (request) => request.name === 'stop',
    );
    try {
      const connection = developmentConnectionSchema.parse({
        version: 1,
        endpoint: this.server.endpoint,
        token: this.server.token,
        siteId: this.siteId,
        taskId: this.taskId,
      });
      await writeFile(this.filename, JSON.stringify(connection), { mode: 0o600, flag: 'wx' });
      this.enabled = true;
      this.notify();
    } catch (error: unknown) {
      await this.server.close();
      this.server = undefined;
      throw error;
    }
  }
  status(): ReturnType<typeof developmentStatusSchema.parse> {
    const task = this.controller.state;
    return developmentStatusSchema.parse({
      taskId: this.taskId,
      siteId: this.siteId,
      status: task.status,
      detail: task.detail,
      requiresVerification: task.requiresVerification,
      confirmationId: task.confirmation?.id ?? null,
      pendingAction: task.pendingAction?.proposal ?? null,
    });
  }
  async stop(): Promise<void> {
    if (!this.enabled) return;
    this.enabled = false;
    this.server?.revoke();
    await rm(this.filename, { force: true });
    await this.controller.stop();
    this.notify();
  }
  async close(): Promise<void> {
    await this.stop();
    await this.server?.close();
    this.server = undefined;
  }
}
