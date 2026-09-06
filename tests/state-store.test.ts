import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { StateStore } from '../src/host/state-store.ts';
import { idleTask } from '../src/core/contracts.ts';
await test('first launch is empty; legacy config preserves identities but legacy confirmations are archived', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'deskwork-migration-'));
  const store = new StateStore(directory);
  try {
    assert.equal((await store.loadWorkspace()).sites.length, 0);
    const sites = [
      { id: 'a', name: 'A', url: 'https://a.test/', sessionId: 'existing', profileId: 'old' },
    ];
    await writeFile(
      join(directory, 'workspace.json'),
      JSON.stringify({ version: 1, name: 'Mine', sites }),
    );
    await writeFile(
      join(directory, 'task.json'),
      JSON.stringify({ version: 1, task: { status: 'verifying', confirmation: 'old' } }),
    );
    const workspace = await store.loadWorkspace();
    assert.equal(workspace.sites[0]?.sessionId, 'existing');
    assert.equal('profileId' in workspace.sites[0], false);
    assert.deepEqual(await store.load(), []);
    assert.equal((await readdir(join(directory, 'archive'))).length, 2);
    const contexts = ['a', 'b'].map((siteId) => ({
      siteId,
      task: idleTask(),
      messages: [{ id: siteId, role: 'user' as const, text: siteId }],
    }));
    await store.save(contexts);
    assert.deepEqual(await store.load(), contexts);
    assert.match(await readFile(join(directory, 'task.json'), 'utf8'), /"version":2/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
