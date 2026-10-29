import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { approvedFixture, loadMigration, journalFor, copy, sourceRoot } from './helpers/migration-journal.js';

test('current export is rejected; retained legacy approval requires the same source', async () => {
  const f = await approvedFixture();
  const current = await f.previewApi.buildPreview({ localSnapshots: f.localSnapshots, remote: f.remote, appRelease: 'v123-reliability-completion' });
  assert.throws(() => f.engine.validateApprovedAudit(f.previewApi.auditArtifact(current)), e => e.code === 'unsupported-release');
  assert.equal(f.engine.compareAuditToPreview(f.audit, current).length, 0);
  const changed = copy(f.localSnapshots); changed.jorge.value.weights[0].weight++;
  const newer = await f.previewApi.buildPreview({ localSnapshots: changed, remote: f.remote });
  assert.ok(f.engine.compareAuditToPreview(f.audit, newer).some(x => x.includes('checksum')));
});

test('repository submits version and prior status in the same update and reports zero rows', async () => {
  const f = await approvedFixture(), calls = [];
  const client = { from(table) {
    calls.push(['from', table]);
    const query = Object.fromEntries(['update', 'eq', 'select'].map(method => [method, (...args) => { calls.push([method, ...args]); return query; }]));
    query.maybeSingle = async () => { calls.push(['maybeSingle']); return { data: null, error: null }; };
    return query;
  } };
  const prior = { id: 'owned-row', ...journalFor(f, 'verifying') };
  await assert.rejects(f.engine.createSupabaseRepository({ client, accountId: f.account.id }).updateJournal(prior.id,
    { metadata: { ...prior.metadata, status: 'complete' }, version: 8 }, prior), e => e.code === 'journal-transition-superseded');
  assert.deepEqual(calls.filter(x => x[0] === 'eq').map(copy), [
    ['eq', 'account_id', f.account.id], ['eq', 'id', prior.id], ['eq', 'version', 7], ['eq', 'metadata->>status', 'verifying']
  ]);
  assert.equal(calls.filter(x => x[0] === 'update').length, 1);
});

for (const insertConflict of [false, true]) test(`engine refuses complete before target writes${insertConflict ? ' after insert-conflict recovery' : ''}`, async () => {
  const f = await approvedFixture(), complete = { id: 'complete', ...journalFor(f, 'complete') };let writes = 0;
  const repository = {
    async insertJournal() { throw Object.assign(new Error('duplicate'), { code: '23505' }); }, async findJournal() { return complete; },
    async insertRow() { writes++; throw new Error('must not upload'); }, async updateJournal() { writes++; throw new Error('must not alter complete'); }
  };
  await assert.rejects(f.engine.executeMigration({ plan: f.plan, repository, existingJournal: insertConflict ? null : complete, verifySource: async () => ({ combinedChecksum: f.plan.source.combinedChecksum }) }), e => e.code === 'migration-already-complete');
  assert.equal(writes, 0);
});

test('controller refuses an authoritative complete journal after an audit was prepared', async () => {
  const f = await approvedFixture();let journal = null, writes = 0;
  const client = { from() { const q = { select() { return q; }, eq() { return q; }, like() { return q; },
    insert() { writes++; return q; }, update() { writes++; return q; },
    then(resolve, reject) { return Promise.resolve({ data: journal ? [journal] : [], error: null }).then(resolve, reject); } }; return q; } };
  f.context.document = { getElementById() { return null; } };
  f.context.window.BigGainsSupabase = { configured: true, session: async () => ({ user: { id: f.owner } }), getClient: () => client };
  f.context.window.bigGainsStatePersistence = { readProfileSnapshot: id => f.localSnapshots[id] };
  f.context.window.BigGainsMigrationPreview = { ...f.previewApi, refresh: async () => f.preview };
  vm.runInContext(fs.readFileSync(path.join(sourceRoot, 'controlled-migration.js'), 'utf8'), f.context);
  const controller = f.context.window.BigGainsControlledMigration;
  await controller.refresh(); await controller.loadAudit({ text: async () => JSON.stringify(f.audit) });
  assert.equal(controller.status().hasPlan, true);
  journal = { id: 'complete', ...journalFor(f, 'complete') };await controller.runMigration();
  assert.equal(writes, 0);assert.equal(controller.status().hasPlan, false);assert.equal(controller.status().journalStatus, 'complete');
});

test('uncertain failure recording preserves the original rejection and reports uncertainty', async () => {
  const f = await approvedFixture();f.plan.records = [];
  const original = new TypeError('owned readback failed'), writeError = new TypeError('failure response unavailable');
  const repository = { async updateJournal(id, values) { if (values.metadata.status === 'failed') throw writeError;return { id, ...values }; }, async readAll() { throw original; } };
  await assert.rejects(f.engine.executeMigration({ plan: f.plan, repository, existingJournal: { id: 'owned', ...journalFor(f) }, verifySource: async () => ({ combinedChecksum: f.plan.source.combinedChecksum }) }), e => e.code === 'journal-failure-recording-unconfirmed' && e.migrationFailure === original && e.cause === writeError);
});
