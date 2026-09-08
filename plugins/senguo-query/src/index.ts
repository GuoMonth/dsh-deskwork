import type { PageObservation } from '../../../packages/plugin-sdk/src/index.ts';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-skill';
import type {} from '@deepseek-ai/dsh-tools';
import { PluginBrowserClient } from '../../../packages/plugin-sdk/src/index.ts';
import { z } from 'zod';

export const name = 'senguo-query';
export const inject = ['tools', 'skills'];
export const knowledge = `# 森果收支类别查询
适用：用户自行登录的 pf.senguo.cc 档口批发 PC 后台，对账中心 → 其他收支页面 /manage/#/main/home/tab/takenote。
页面关系：商户中心选择「档口批发」店铺 → 对账中心 → 其他收支 → 类别筛选 → 可见类别选项。旧 /cashierdesk/flow.html 不作为直达入口。
列表中的类别只代表已出现的数据，不等于筛选控件的全部类别。保留页面原始名称，不拆分、不猜测类别。
使用 senguo_query_categories 工具进入其他收支页面，必要时展开「类别」筛选，再读取可见选项；不点击记一笔、确认或任何保存操作。筛选可能分层或分页，可见选项不等于全部类别。
结果附带页面地址、标题、当前文本及选项证据。若没有找到唯一类别筛选入口，返回需要重新观察，不能宣称得到全部类别。
页面变化、登录失效或出现编辑／保存页面时停止复用。插件没有登录身份，也不能跳过用户登录。`;
export function apply(ctx: Context): void {
  ctx.effect(() =>
    ctx.skills.register({
      name: 'senguo-query',
      description: '森果档口批发 PC 其他收支：读取类别筛选可见选项。',
      source: 'runtime',
      content: knowledge,
    }),
  );
  ctx.effect(() =>
    ctx.tools.register({
      name: 'senguo_query_categories',
      description:
        'Read Senguo PC income/expense category filter options using a bounded read-only browser flow. Requires the logged-in wholesale PC backend; never edits business data.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [
          { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value) },
        ],
      },
      async execute(args, exec) {
        z.object({}).strict().parse(args);
        const browser = new PluginBrowserClient('@guomonth/dsh-senguo-query', exec.signal);
        let page = await browser.observe();
        const url = new URL(page.url);
        if (url.hostname !== 'pf.senguo.cc' || !url.pathname.startsWith('/manage/'))
          throw new Error('请先登录并打开森果档口批发 PC 后台，再调用此查询工具。');
        if (!url.hash.startsWith('#/main/home/tab/takenote')) {
          await browser.act(
            page,
            { kind: 'navigate', url: 'https://pf.senguo.cc/manage/#/main/home/tab/takenote' },
            'read',
            '打开其他收支查询页面',
          );
          page = await browser.observe();
        }
        for (
          let attempt = 0;
          attempt < 8 && !page.elements.some((element) => /^(类别|收支类别)$/.test(element.name));
          attempt++
        ) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 200);
          });
          page = await browser.observe();
        }
        if (
          new URL(page.url).hostname !== 'pf.senguo.cc' ||
          !new URL(page.url).hash.startsWith('#/main/home/tab/takenote')
        )
          throw new Error('页面已变化或登录失效，请重新打开其他收支页面。');
        if (page.text.includes('所有类别')) return categoryEvidence(page);
        const candidates = page.elements.filter(
          (element) => /^(类别|收支类别)$/.test(element.name) && !element.disabled,
        );
        if (candidates.length !== 1 || !candidates[0])
          return JSON.stringify({
            status: 'needs-observation',
            detail: '尚未定位唯一类别筛选，请通过通用观察确认入口，不声称完整选项。',
            url: page.url,
            title: page.title,
          });
        const filter = candidates[0];
        if (filter.options?.length)
          return JSON.stringify({
            status: 'observed',
            options: filter.options,
            url: page.url,
            title: page.title,
          });
        await browser.act(
          page,
          { kind: 'click', ref: filter.ref },
          'read',
          '展开收支类别筛选，读取选项',
        );
        page = await browser.observe();
        return categoryEvidence(page);
      },
    }),
  );
}

function categoryEvidence(page: PageObservation): string {
  const marker = page.text.indexOf('所有类别');
  if (marker < 0)
    return JSON.stringify({
      status: 'needs-observation',
      detail: '筛选未展开，无法确认类别选项。',
      url: page.url,
    });
  const text =
    page.text
      .slice(marker)
      .split(/确认\s*[（(]/)[0]
      ?.slice(0, 6000) ?? '';
  return JSON.stringify({
    status: 'observed-filter',
    scope: '当前已显示的类别；未遍历折叠分组或分页，不声称完整列表。',
    url: page.url,
    title: page.title,
    evidence: text,
  });
}
