import { createHash } from 'node:crypto';
import type { WebContents } from 'electron';
import { z } from 'zod';
import { observationSchema } from '../core/contracts.ts';
import type {
  ActionProposal,
  BrowserAdapter,
  BrowserPage,
  PageObservation,
  TaskTarget,
} from '../core/contracts.ts';

const evaluationSchema = z.object({
  result: z.object({ value: z.unknown() }),
  exceptionDetails: z.unknown().optional(),
});
export async function evaluate(contents: WebContents, expression: string): Promise<unknown> {
  if (contents.isDestroyed()) throw new Error('页面已关闭');
  if (!contents.debugger.isAttached()) contents.debugger.attach('1.3');
  const raw: unknown = await contents.debugger.sendCommand('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    timeout: 10000,
  });
  const response = evaluationSchema.parse(raw);
  if (response.exceptionDetails) throw new Error('页面操作未完成，请重新观察或接手');
  return response.result.value;
}
// Application-owned expressions only; no scripts, selectors, or executable code from the model.
const collectExpression = `(() => {
  const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  const nodes = [...document.querySelectorAll('a,button,input,textarea,select,[role="button"],[role="link"],[contenteditable="true"]')].filter(visible);
  const elements = nodes.slice(0, 160).map((element, index) => {
    const type = element.getAttribute('type') || '';
    const name = element.getAttribute('aria-label') || (element.labels && [...element.labels].map(label => label.innerText).join(' ')) || element.getAttribute('placeholder') || element.innerText || element.getAttribute('title') || '';
    return { ref: 'e' + index, tag: element.tagName.toLowerCase(), role: element.getAttribute('role') || '', name: name.trim().slice(0, 200), value: type === 'password' ? '' : String(element.value || '').slice(0, 2000), type, href: element instanceof HTMLAnchorElement ? element.href : '', disabled: Boolean(element.disabled) || element.getAttribute('aria-disabled') === 'true' || String(element.value || '').length > 2000, ...(element instanceof HTMLSelectElement ? { options: [...element.options].slice(0, 100).map(option => ({ label: option.text, value: option.value, disabled: option.disabled })) } : {}) };
  });
  const focusedIndex = nodes.slice(0, 160).indexOf(document.activeElement);
  return { url: location.href, title: document.title, text: document.body.innerText.slice(0, 14000), elements, focusedRef: focusedIndex < 0 ? null : 'e' + focusedIndex };
})()`;
const dangerous =
  /保存|提交|删除|确认|审批|付款|支付|取消订单|退出|注销|save|submit|delete|confirm|approve|pay|sign.?out|logout/i;
export function actionNeedsConfirmation(
  observation: PageObservation,
  proposal: ActionProposal,
): boolean {
  if (proposal.risk === 'consequential') return true;
  const action = proposal.action;
  if (action.kind === 'scroll') return false;
  if (action.kind === 'navigate')
    return dangerous.test(action.url) || Boolean(new URL(action.url).search);
  // Tab can trigger blur/autosave; arrow keys can change and save a selection.
  if (action.kind === 'key') return true;
  const element = observation.elements.find((entry) => entry.ref === action.ref);
  if (!element || element.disabled || element.type === 'password')
    throw new Error('元素不可操作，请用户在页面中接手');
  // Unknown controls and edits may autosave. Only plain, non-action links bypass review.
  if (action.kind === 'click' && element.tag === 'a' && /^https?:/.test(element.href))
    return dangerous.test(element.name + element.href) || Boolean(new URL(element.href).search);
  return true;
}
export interface PageHandle {
  contents: WebContents;
  page: BrowserPage;
  epoch: number;
  automating?: boolean;
}
export class ElectronBrowser implements BrowserAdapter {
  private readonly resolve: (target: TaskTarget, pageId?: string) => PageHandle;
  private readonly list: (target: TaskTarget) => BrowserPage[];
  private readonly select: (target: TaskTarget, pageId: string) => void;
  constructor(
    resolve: (target: TaskTarget, pageId?: string) => PageHandle,
    list: (target: TaskTarget) => BrowserPage[],
    select: (target: TaskTarget, pageId: string) => void,
  ) {
    this.resolve = resolve;
    this.list = list;
    this.select = select;
  }
  pages(target: TaskTarget): BrowserPage[] {
    return this.list(target);
  }
  selectPage(target: TaskTarget, pageId: string): void {
    this.select(target, pageId);
  }
  needsConfirmation(observation: PageObservation, proposal: ActionProposal): boolean {
    return actionNeedsConfirmation(observation, proposal);
  }
  async observe(target: TaskTarget, pageId?: string): Promise<PageObservation> {
    const handle = this.resolve(target, pageId);
    const raw = await evaluate(handle.contents, collectExpression);
    const observation = observationSchema.parse({
      ...z.record(z.string(), z.unknown()).parse(raw),
      pageId: handle.page.id,
      revision: 'pending',
    });
    observation.revision = createHash('sha256')
      .update(JSON.stringify({ observation, epoch: handle.epoch }))
      .digest('hex');
    return observation;
  }
  async readback(target: TaskTarget, pageId: string): Promise<PageObservation> {
    const handle = this.resolve(target, pageId);
    await handle.contents.loadURL(handle.contents.getURL());
    return this.observe(target, pageId);
  }
  async execute(target: TaskTarget, proposal: ActionProposal, valid: () => boolean): Promise<void> {
    const current = await this.observe(target, proposal.pageId);
    if (!valid() || current.revision !== proposal.revision) throw new Error('页面或任务已变化');
    const handle = this.resolve(target, proposal.pageId);
    const action = proposal.action;
    if (action.kind === 'navigate') {
      if (!valid()) throw new Error('任务已停止');
      await handle.contents.loadURL(action.url);
      return;
    }
    if (action.kind === 'key') {
      const focused = current.elements.find((element) => element.ref === current.focusedRef);
      if (!focused || focused.disabled || focused.type === 'password')
        throw new Error('键盘目标不可确认，请用户在页面中接手');
      if (!valid()) throw new Error('任务已停止');
      handle.automating = true;
      try {
        handle.contents.sendInputEvent({ type: 'keyDown', keyCode: action.key });
        handle.contents.sendInputEvent({ type: 'keyUp', keyCode: action.key });
        await evaluate(handle.contents, 'true');
      } finally {
        handle.automating = false;
      }
      return;
    }
    if (!valid()) throw new Error('任务已停止');
    const result = await evaluate(
      handle.contents,
      `(() => {
      const expected = ${JSON.stringify({ url: current.url, title: current.title, text: current.text, elements: current.elements, focusedRef: current.focusedRef })};
      if (JSON.stringify(${collectExpression}) !== JSON.stringify(expected)) throw Error('Page changed before action');
      const action = ${JSON.stringify(action)};
      if (action.kind === 'scroll') { window.scrollBy(0, (action.direction === 'down' ? 1 : -1) * Math.round(innerHeight * 0.75)); return true; }
      const nodes = [...document.querySelectorAll('a,button,input,textarea,select,[role="button"],[role="link"],[contenteditable="true"]')].filter(element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
      const element = nodes[Number(action.ref.slice(1))];
      if (!/^e[0-9]+$/.test(action.ref) || !element || element.disabled || element.type === 'password') throw Error('Unavailable element');
      element.scrollIntoView({ block: 'center' });
      if (action.kind === 'click') element.click();
      else if (action.kind === 'fill') {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) || element.readOnly || ['file','password','hidden','checkbox','radio','submit'].includes(element.type)) throw Error('Unsupported field');
        const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, action.value);
        element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (action.kind === 'select') {
        if (!(element instanceof HTMLSelectElement) || ![...element.options].some(option => option.value === action.value)) throw Error('Unsupported option');
        element.value = action.value; element.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return true;
    })()`,
    );
    if (result !== true) throw new Error('页面没有确认动作执行');
  }
  async screenshot(target: TaskTarget, pageId: string): Promise<string> {
    const handle = this.resolve(target, pageId);
    const observation = await this.observe(target, pageId);
    // Login screenshots could expose credentials; leave authentication to the user.
    if (observation.elements.some((element) => element.type === 'password'))
      throw new Error('登录页面请由用户操作，不发送截图');
    const capture = await handle.contents.capturePage();
    return capture
      .resize({ width: Math.min(1280, capture.getSize().width) })
      .toJPEG(70)
      .toString('base64');
  }
}
