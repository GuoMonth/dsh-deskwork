import assert from 'node:assert/strict';
import { test } from 'node:test';
import { actionNeedsConfirmation } from '../src/browser/electron-browser.ts';
import { proposalSchema, workspaceSchema } from '../src/core/contracts.ts';
import type { ActionProposal, PageObservation } from '../src/core/contracts.ts';
const observation: PageObservation = {
  pageId: 'page',
  revision: 'r1',
  url: 'https://example.test/',
  title: 'Example',
  text: '',
  elements: [
    {
      ref: 'e0',
      name: 'Save',
      tag: 'button',
      role: '',
      type: 'submit',
      value: '',
      href: '',
      disabled: false,
    },
    {
      ref: 'e1',
      name: 'About',
      tag: 'a',
      role: '',
      type: '',
      value: '',
      href: 'https://example.test/about',
      disabled: false,
    },
    {
      ref: 'e2',
      name: 'Auto-save text',
      tag: 'input',
      role: '',
      type: 'text',
      value: '',
      href: '',
      disabled: false,
    },
  ],
};
function proposal(action: ActionProposal['action']): ActionProposal {
  return { pageId: 'page', revision: 'r1', action, summary: 'Navigate', risk: 'ordinary' };
}
await test('model ordinary label cannot bypass submit buttons or unverified autosaving inputs', () => {
  assert.equal(actionNeedsConfirmation(observation, proposal({ kind: 'click', ref: 'e0' })), true);
  assert.equal(
    actionNeedsConfirmation(observation, proposal({ kind: 'fill', ref: 'e2', value: 'new' })),
    true,
  );
  assert.equal(actionNeedsConfirmation(observation, proposal({ kind: 'click', ref: 'e1' })), false);
  assert.equal(
    actionNeedsConfirmation(observation, {
      ...proposal({ kind: 'click', ref: 'e1' }),
      risk: 'consequential',
    }),
    true,
  );
  assert.throws(() =>
    actionNeedsConfirmation(observation, proposal({ kind: 'click', ref: 'missing' })),
  );
});
await test('configuration and action boundaries reject scripts, embedded credentials and executable payloads', () => {
  for (const url of ['javascript:alert(1)', 'file:///tmp/a', 'https://user:password@example.test'])
    assert.equal(
      proposalSchema.safeParse({ ...proposal({ kind: 'navigate', url }), script: 'attack' })
        .success,
      false,
    );
  assert.equal(workspaceSchema.safeParse({ version: 2, name: 'Empty', sites: [] }).success, true);
  assert.equal(
    proposalSchema.safeParse({
      ...proposal({ kind: 'click', ref: 'e0' }),
      action: { kind: 'evaluate', code: 'anything' },
    }).success,
    false,
  );
});
