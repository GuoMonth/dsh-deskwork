import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-user-approval';
import { z } from 'zod';

export const name = 'deskwork-user-approval';
export const inject = ['approval'];
const knowledgeTools = new Set([
  'erp_experience_import',
  'erp_knowledge_correct',
  'erp_knowledge_confirm',
]);

/** Use DSH's one-call approval lifecycle and audit, with the desktop host as answerer. */
export function apply(ctx: Context): void {
  ctx.on('approval/request', async (request, next) => {
    if (!knowledgeTools.has(request.toolName)) return next();
    const endpoint = process.env['DESKWORK_TOOL_ENDPOINT'];
    const token = process.env['DESKWORK_TOOL_TOKEN'];
    if (!endpoint || !token || new URL(endpoint).hostname !== '127.0.0.1') return 'unavailable';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'native_approval',
          arguments: {
            toolName: request.toolName,
            reason: request.reason ?? request.toolName,
          },
        }),
        ...(request.signal ? { signal: request.signal } : {}),
      });
      if (!response.ok) return 'unavailable';
      return z
        .object({ outcome: z.enum(['allowed-once', 'rejected', 'cancelled']) })
        .strict()
        .parse(await response.json()).outcome;
    } catch {
      return request.signal?.aborted ? 'cancelled' : 'unavailable';
    }
  });
}
