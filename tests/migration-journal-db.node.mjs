import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { startLane, bounded } from './helpers/migration-journal-db.js';
import { copy, sourceRoot, loadLegacyMigration } from './helpers/migration-journal.js';

let lane;
before(async () => { lane = await startLane(); });
after(async () => { if (lane) await lane.close(); });
const otherTablesUnchanged = (before, after) => {
  for (const table of Object.keys(before.tables).filter(t => t !== 'sync_metadata')) assert.equal(after.tables[table], before.tables[table], `${table} bytes preserved`);
};

for (const fresh of [false, true]) test(fresh ? 'fresh-read B completes and stale A failure preserves complete bytes' : 'both clients read version 7 and early CAS is safe supersession', async () => {
  const f = await lane.fixture(), initialA = await f.ARepo.findJournal(f.initial.client_id), initialB = await f.BRepo.findJournal(f.initial.client_id);
  assert.equal(initialA.id, initialB.id);assert.equal(initialA.version, 7);assert.deepEqual(initialA, initialB);
  const before = await f.snapshot('before');f.hold();const a = f.run('A', initialA);
  let b, afterB, resultA, final;
  try {
    await bounded(Promise.race([f.held.promise, a.then(() => { throw new Error('A ended before the held readback'); })]), 'A held readback');
    const observedB = fresh ? await f.BRepo.findJournal(f.initial.client_id) : initialB;
    if (fresh) assert.equal(observedB.version, 8);
    b = await bounded(f.run('B', observedB), 'B outcome');afterB = await f.snapshot('after-B');
  } finally { f.reject();resultA = await bounded(a, 'A original failure catch');final = await f.snapshot('after-A'); }
  otherTablesUnchanged(before, final);
  if (fresh) {
    assert.equal(b.error, undefined);assert.equal(afterB.journal.metadata.status, 'complete');assert.equal(afterB.journal.version, 10);
    assert.equal(final.bytes, afterB.bytes, 'B completed durable row remains byte-identical');assert.equal(final.journal.last_acknowledged_version, 2);
    assert.equal(resultA.error?.code, 'journal-transition-superseded');assert.match(resultA.error.migrationFailure.message, /Load failed/);
  } else {
    assert.equal(b.error?.code, 'journal-transition-superseded');assert.equal(afterB.journal.version, 8);assert.equal(afterB.journal.metadata.status, 'verifying');
    assert.equal(final.journal.metadata.status, 'failed');assert.equal(final.journal.version, 9);assert.match(resultA.error?.message, /Load failed/);
  }
});

test('lone genuine failure is durable and a later verified resume completes', async () => {
  const f = await lane.fixture(), before = await f.snapshot('before');f.hold();const execution = f.run('A', f.initial);
  try { await bounded(Promise.race([f.held.promise, execution.then(() => { throw new Error('A failed before the readback'); })]), 'held lone read'); }
  finally { f.reject(); }
  const failed = await bounded(execution, 'lone failure'), after = await f.snapshot('failed');
  assert.match(failed.error?.message, /Load failed/);assert.equal(after.journal.metadata.status, 'failed');assert.equal(after.journal.version, 9);
  assert.equal(after.journal.last_acknowledged_version, 0);assert.equal(after.journal.metadata.failure.code, 'migration-interrupted');otherTablesUnchanged(before, after);
  f.stopHolding();const resumed = await f.run('A', await f.ARepo.findJournal(f.initial.client_id));
  assert.equal(resumed.error, undefined);const complete = await f.snapshot('resumed-complete');assert.equal(complete.journal.metadata.status, 'complete');assert.equal(complete.journal.version, 11);
  otherTablesUnchanged(before, complete);
});

test('same-version competing completions have exactly one winner', async () => {
  const f = await lane.fixture('verifying'), before = await f.snapshot('before');
  const values = { version: 8, last_acknowledged_version: 2, metadata: { ...f.initial.metadata, status: 'complete', verification: { verified: true, sourceStillMatches: true, targetCombinedChecksum: f.plan.target.combinedChecksum } } };
  const outcomes = await Promise.allSettled([f.ARepo.updateJournal(f.initial.id, values, f.initial), f.BRepo.updateJournal(f.initial.id, values, copy(f.initial))]);
  const after = await f.snapshot('after-completion-race');assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(x => x.status === 'rejected').reason.code, 'journal-transition-superseded');assert.equal(after.journal.version, 8);assert.equal(after.journal.metadata.status, 'complete');otherTablesUnchanged(before, after);
});

test('frozen legacy engine stale failure cannot erase a fresh client completion', async () => {
  const f = await lane.fixture(), legacy = loadLegacyMigration(), before = await f.snapshot('before');f.hold();
  const a = f.run('A', f.initial, legacy);let completed, resultA;
  try {
    await bounded(Promise.race([f.held.promise, a.then(() => { throw new Error('Legacy A ended before verification'); })]), 'legacy held read');
    const b = await f.run('B', await f.BRepo.findJournal(f.initial.client_id));assert.equal(b.error, undefined);completed = await f.snapshot('fresh-complete');
  } finally { f.reject();resultA = await bounded(a, 'legacy failure recording'); }
  const after = await f.snapshot('after-legacy-failure');assert.equal(completed.journal.metadata.status, 'complete');assert.equal(after.bytes, completed.bytes);
  assert.match(resultA.error?.message, /Load failed/);otherTablesUnchanged(before, after);
});

test('frozen legacy engine still records genuine failure and successful resume', async () => {
  const f = await lane.fixture(), legacy = loadLegacyMigration(), before = await f.snapshot('before');f.hold();
  const a = f.run('A', f.initial, legacy);
  try { await bounded(Promise.race([f.held.promise, a.then(() => { throw new Error('Legacy A ended before readback'); })]), 'legacy lone failure'); }
  finally { f.reject(); }
  assert.match((await bounded(a, 'legacy failure')).error?.message, /Load failed/);
  const failed = await f.snapshot('legacy-failed');assert.equal(failed.journal.metadata.status, 'failed');assert.equal(failed.journal.last_acknowledged_version, 0);
  f.stopHolding();const resumed = await f.run('A', await f.ARepo.findJournal(f.initial.client_id), legacy);assert.equal(resumed.error, undefined);
  const after = await f.snapshot('legacy-complete');assert.equal(after.journal.metadata.status, 'complete');assert.equal(after.journal.last_acknowledged_version, 2);otherTablesUnchanged(before, after);
});

test('legacy unconditional failure, verifying and identity relabel cannot alter complete', async () => {
  const f = await lane.fixture('complete'), before = await f.snapshot('before');
  for (const values of [
    { version: 8, last_acknowledged_version: 0, metadata: { ...f.initial.metadata, status: 'failed' } },
    { version: 8, last_acknowledged_version: 1, metadata: { ...f.initial.metadata, status: 'verifying' } },
    { version: 8, metadata: { format: 'other-format', status: 'failed' } },
    { client_id: 'ordinary-metadata', version: 8 }
  ]) {
    const result = await f.AClient.from('sync_metadata').update(values).eq('account_id', f.account.id).eq('id', f.initial.id).select('*').single();
    assert.equal(result.error?.code, '23514');
  }
  const after = await f.snapshot('after-legacy-attempts');assert.equal(after.bytes, before.bytes);otherTablesUnchanged(before, after);
});

test('legacy nonterminal version regression, stale equal version and invalid status are denied', async () => {
  const f = await lane.fixture('verifying'), before = await f.snapshot('before');
  for (const values of [
    { version: 6, metadata: { ...f.initial.metadata, status: 'failed' }, last_acknowledged_version: 0 },
    { version: 7, metadata: { ...f.initial.metadata, status: 'verifying' }, last_acknowledged_version: 1 },
    { version: 8, metadata: { ...f.initial.metadata, status: null }, last_acknowledged_version: 0 },
    { version: 8, metadata: { ...f.initial.metadata, status: 'complete' }, last_acknowledged_version: 0 }
  ]) {
    const result = await f.AClient.from('sync_metadata').update(values).eq('id', f.initial.id).select('*').single();assert.equal(result.error?.code, '23514');
  }
  assert.equal((await f.snapshot('after-invalid')).bytes, before.bytes);
});

test('journal RLS still isolates owner, different owner and anonymous', async () => {
  const f = await lane.fixture(), other = await lane.fixture(), before = await f.snapshot('before');
  assert.equal((await f.ARepo.findJournal(f.initial.client_id)).id, f.initial.id);assert.equal((await f.BRepo.findJournal(f.initial.client_id)).id, f.initial.id);
  const crossRead = await other.AClient.from('sync_metadata').select('*').eq('id', f.initial.id);
  const crossWrite = await other.AClient.from('sync_metadata').update({ last_acknowledged_version: 999 }).eq('id', f.initial.id).select('*');
  assert.equal(crossRead.error, null);assert.deepEqual(crossRead.data, []);assert.equal(crossWrite.error, null);assert.deepEqual(crossWrite.data, []);
  assert.equal((await f.anonymous()).status, 401);
  const reassigned = await f.AClient.from('sync_metadata').update({ account_id: other.account.id }).eq('id', f.initial.id).select('*');
  assert.ok(['23514', '42501'].includes(reassigned.error?.code));
  assert.equal((await f.snapshot('after-denied-access')).bytes, before.bytes);
  assert.ok(lane.facts.roles.every(r => !r.rolsuper && !r.rolbypassrls));assert.ok(lane.facts.rls.every(r => r.relrowsecurity && r.relforcerowsecurity));
});

test('ordinary sync metadata remains outside the migration guard', async () => {
  const f = await lane.fixture();
  const inserted = await f.AClient.from('sync_metadata').insert({ account_id: f.account.id, profile_id: f.profiles[0].id, client_id: 'ordinary-delivery-receipt', metadata: { format: 'operational.v1' }, version: 1 }).select('*').single();
  assert.equal(inserted.error, null);
  const updated = await f.AClient.from('sync_metadata').update({ metadata: { format: 'operational.v1', note: 'owned' }, last_acknowledged_version: 12 }).eq('id', inserted.data.id).select('*').single();
  assert.equal(updated.error, null);assert.equal(updated.data.version, 1);assert.equal(updated.data.last_acknowledged_version, 12);
});

test('complete journal remains a managed-owner baseline and cannot restart migration', async () => {
  const f = await lane.fixture('complete'), before = await f.snapshot('before');
  const rejected = await f.run('A', f.initial);assert.equal(rejected.error?.code, 'migration-already-complete');
  const store = new Map(), owner = { account: f.account, authUserId: f.owner, profiles: Object.fromEntries(f.profiles.map(p => [p.client_id, p])) };
  const window = f.context.window;
  window.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) };
  window.bigGainsAccounts = {
    runtime: { kind: 'managed-owner', expectedProfileIds: ['jorge', 'alexa'], storageNamespace: 'owned', cloudKeys: { queue: 'queue', catalog: 'catalog', comparison: 'comparison' } },
    registry: { resolve: id => ({ displayName: id }) }, matchesCloudOwner: () => true, cloudProfileShape: () => 'managed-owner'
  };
  // This isolated comparison fixture owns its synthetic persistence ports. PR
  // 130 calls assertWriter before publishing a catalog, unlike older main.
  window.bigGainsStatePersistence = { readProfileSnapshot: id => f.localSnapshots[id], assertWriter() {} };
  window.BigGainsSupabase = { configured: true, getClient: () => f.AClient, session: async () => ({ user: { id: f.owner } }), verifiedUser: async () => ({ id: f.owner }), readCloudAccount: async () => owner, onAuthStateChange: () => ({ unsubscribe() {} }) };
  window.addEventListener = () => {};window.setTimeout = setTimeout;window.clearTimeout = clearTimeout;
  f.context.localStorage = window.localStorage;f.context.navigator = { onLine: true };f.context.document = { visibilityState: 'visible', getElementById: () => null, addEventListener() {} };
  for (const file of ['cloud-storage.js', 'cloud-shadow.js', 'cloud-sync.js']) vm.runInContext(fs.readFileSync(path.join(sourceRoot, file), 'utf8'), f.context, { filename: file });
  const journal = window.BigGainsCloudShadow.completedMigrationJournal([f.initial], f.account.id);assert.equal(journal.id, f.initial.id);
  const sync = window.BigGainsCloudSync;sync.initialize();
  await bounded((async () => { while (!sync.status().lastComparison) await new Promise(r => setTimeout(r, 10)); })(), 'managed comparison');
  lane.record('managed-comparison', { status: sync.status() });
  assert.equal(sync.status().lastComparison.parity, true);assert.equal(sync.status().baselineAdopted, true);
  assert.equal((await f.snapshot('after-consumers')).bytes, before.bytes);
});
