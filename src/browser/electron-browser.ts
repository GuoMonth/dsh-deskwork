import type { WebContents } from 'electron';
import { z } from 'zod';
import { recordSchema } from '../core/contracts.ts';
import type { BusinessRecord, RecordBrowser, TaskTarget } from '../core/contracts.ts';
import type { RecordProfile } from './record-profile.ts';

const evaluationSchema = z.object({
  result: z.object({ value: z.unknown() }),
  exceptionDetails: z.unknown().optional(),
});
export async function evaluate(contents: WebContents, expression: string): Promise<unknown> {
  if (contents.isDestroyed()) throw new Error('业务页面已关闭');
  if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
  const raw: unknown = await contents.debugger.sendCommand('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    timeout: 10000,
  });
  const response = evaluationSchema.parse(raw);
  if (response.exceptionDetails) throw new Error('页面结构或状态不匹配，请重新核对业务页面');
  return response.result.value;
}

// This expression is application-owned. Model content is never evaluated as JavaScript.
function recordExpression(profile: RecordProfile): string {
  return `(() => {
    const profile = ${JSON.stringify(profile)};
    if (location.origin !== profile.origin || !location.pathname.startsWith(profile.pathPrefix)) throw Error('Wrong page');
    const one = (selector) => { const nodes = document.querySelectorAll(selector); if(nodes.length !== 1) throw Error('Selector mismatch'); return nodes[0]; };
    const text = (selector) => one(selector).textContent.trim();
    const field = one(profile.selectors.value);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || field.type === 'password' || field.disabled || field.readOnly) throw Error('Field not editable');
    const result = { shopId: text(profile.selectors.shop), objectId: text(profile.selectors.object), name: text(profile.selectors.name), field: profile.fieldName, value: field.value, pageRevision: text(profile.selectors.revision) };
    if(result.shopId !== profile.shopId || result.pageRevision !== profile.pageRevision) throw Error('Profile expired');
    return result;
  })()`;
}

export class ElectronRecordBrowser implements RecordBrowser {
  private readonly resolve: (target: TaskTarget) => WebContents;
  private readonly profiles: ReadonlyMap<string, RecordProfile>;
  constructor(
    resolve: (target: TaskTarget) => WebContents,
    profiles: ReadonlyMap<string, RecordProfile>,
  ) {
    this.resolve = resolve;
    this.profiles = profiles;
  }

  async read(
    target: TaskTarget,
    objectId: string,
    source: 'page' | 'server' = 'page',
  ): Promise<BusinessRecord> {
    const profile = this.profile(target);
    const contents = this.resolve(target);
    if (source === 'server') {
      // A local input value is not proof that the server accepted the write.
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
      await contents.loadURL(contents.getURL());
    }
    const record = recordSchema.parse(await evaluate(contents, recordExpression(profile)));
    if (record.objectId !== objectId) throw new Error('当前商品与任务对象不同，请打开指定商品资料');
    return record;
  }

  async write(target: TaskTarget, expected: BusinessRecord, value: string): Promise<void> {
    const profile = this.profile(target);
    const contents = this.resolve(target);
    const result = await evaluate(
      contents,
      `(() => {
      const current = ${recordExpression(profile)};
      const expected = ${JSON.stringify(expected)};
      if (JSON.stringify(current) !== JSON.stringify(expected)) throw Error('Record changed');
      const field = document.querySelector(${JSON.stringify(profile.selectors.value)});
      const button = document.querySelector(${JSON.stringify(profile.selectors.save)});
      if (!button || button.disabled) throw Error('Save unavailable');
      const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, ${JSON.stringify(value)});
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
      button.click();
      return true;
    })()`,
    );
    if (result !== true) throw new Error('未确认保存操作');
  }

  async observe(target: TaskTarget): Promise<string> {
    const value = await evaluate(
      this.resolve(target),
      `(() => {
      const clone = document.body.cloneNode(true);
      clone.querySelectorAll('script,style,input,textarea,[contenteditable], [hidden]').forEach(node => node.remove());
      return JSON.stringify({ title: document.title, origin: location.origin, path: location.pathname + location.hash, text: clone.textContent.replace(/\\s+/g, ' ').slice(0, 14000) });
    })()`,
    );
    return z.string().parse(value);
  }

  private profile(target: TaskTarget): RecordProfile {
    const profile = this.profiles.get(target.profileId);
    if (!profile)
      throw new Error(
        '此页面尚未完成字段适配。请先登录测试店铺并完成基础资料勘察；当前仅可读取页面。',
      );
    return profile;
  }
}
