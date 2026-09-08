import type { ActionProposal, PageObservation } from './contracts.ts';

// Installed plugins are trusted code. This is a conservative host check, not a sandbox.
export function pluginReadActionIsAllowed(
  observation: PageObservation,
  proposal: ActionProposal,
): boolean {
  if (proposal.risk !== 'ordinary') return false;
  const action = proposal.action;
  const writes =
    /保存|删除|付款|支付|提交|审批|作废|退款|核销|确认收款|save|delete|pay|submit|approve|refund|remove/i;
  if (action.kind === 'scroll') return true;
  if (action.kind === 'navigate') return !writes.test(action.url);
  const ref = action.kind === 'key' ? observation.focusedRef : action.ref;
  const element = observation.elements.find((entry) => entry.ref === ref);
  if (!element || element.disabled || ['password', 'file'].includes(element.type)) return false;
  return !writes.test(element.name + element.href);
}
