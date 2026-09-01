import { test, expect } from '@playwright/test';
import { openApp } from './helpers/app.js';
import { blankState, completedWorkout, activeWorkout, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';

const ZERO_COUNTS = Object.freeze({
  workouts: 0,
  routines: 0,
  bodyweight_entries: 0,
  preferences: 0,
  active_sessions: 0,
  sync_metadata: 0,
  tombstones: 0
});

function snapshots(overrides = {}) {
  return {
    jorge: { ok: true, value: { ...blankState('jorge'), exercisePreferences: {}, ...overrides.jorge } },
    alexa: { ok: true, value: { ...blankState('alexa'), exercisePreferences: {}, ...overrides.alexa } }
  };
}

function remote(overrides = {}) {
  const account = { id: 'account-jorge', owner_user_id: 'auth-jorge' };
  return {
    signedInUserId: 'auth-jorge',
    accounts: [account],
    profiles: [
      { id: 'profile-jorge', account_id: account.id, client_id: 'jorge', display_name: 'Jorge' },
      { id: 'profile-alexa', account_id: account.id, client_id: 'alexa', display_name: 'Alexa' }
    ],
    counts: { ...ZERO_COUNTS },
    ...overrides
  };
}

async function approved(page, local = snapshots(), remoteState = remote()) {
  return page.evaluate(async ({ local, remoteState }) => {
    const preview = await BigGainsMigrationPreview.buildPreview({
      localSnapshots: local,
      remote: remoteState,
      generatedAt: '2026-08-07T18:00:00.000Z',
      appRelease: 'v47.1-phase4d-legacy-source-preview'
    });
    const audit = BigGainsMigrationPreview.auditArtifact(preview);
    delete audit.remoteCounts.bodyweight_entries;
    const plan = await BigGainsMigrationEngine.buildMigrationPlan({ audit, preview, localSnapshots: local });
    return { preview, audit, plan };
  }, { local, remoteState });
}

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa']);
  await openApp(page);
  await page.evaluate(() => {
    window.__migrationMemoryRepository = (options = {}) => {
      const tables = Object.fromEntries(BigGainsMigrationEngine.targetTables.map(table => [table, []]));
      const journals = [];
      let insertCount = 0;
      let lostOnce = false;
      const copy = value => JSON.parse(JSON.stringify(value));
      const rowWithId = row => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...copy(row) });
      const repository = {
        tables,
        journals,
        writes: [],
        async readJournals() { return copy(journals); },
        async findJournal(clientId) { return copy(journals.find(row => row.client_id === clientId) || null); },
        async insertJournal(row) {
          repository.writes.push({ type: 'journal-insert' });
          const saved = rowWithId(row);
          journals.push(saved);
          return copy(saved);
        },
        async updateJournal(id, values) {
          repository.writes.push({ type: 'journal-update', status: values.metadata.status });
          const index = journals.findIndex(row => row.id === id);
          if (index < 0) throw new Error('journal missing');
          journals[index] = { ...journals[index], ...copy(values) };
          return copy(journals[index]);
        },
        async insertRow(table, row) {
          insertCount += 1;
          if (options.failAtInsert === insertCount) throw Object.assign(new Error('synthetic interruption'), { code: 'network' });
          const existing = tables[table].find(value => value.profile_id === row.profile_id && value.client_id === row.client_id);
          if (existing) throw Object.assign(new Error('duplicate'), { code: '23505' });
          const saved = rowWithId(row);
          tables[table].push(saved);
          repository.writes.push({ type: 'row-insert', table });
          if (options.lostResponseOnce && !lostOnce) {
            lostOnce = true;
            throw Object.assign(new Error('lost response'), { code: 'network' });
          }
          return copy(saved);
        },
        async findRow(table, profileId, clientId) {
          return copy(tables[table].find(row => row.profile_id === profileId && row.client_id === clientId) || null);
        },
        async readAll(table) {
          const values = copy(tables[table]);
          if (options.dropReadbackTable === table) values.pop();
          if (options.corruptReadbackTable === table && values[0]?.payload?.data) values[0].payload.data.corrupted = true;
          return values;
        }
      };
      return repository;
    };
  });
});

test('accepts only the exact metadata-only Phase 4D audit shape', async ({ page }) => {
  const { audit } = await approved(page);
  const result = await page.evaluate(audit => {
    const accepted = BigGainsMigrationEngine.validateApprovedAudit(audit);
    const withRaw = JSON.parse(JSON.stringify(audit));
    withRaw.profiles.jorge.workouts = [{ note: 'must never be accepted' }];
    let rawCode = null;
    try { BigGainsMigrationEngine.validateApprovedAudit(withRaw); } catch (error) { rawCode = error.code; }
    let malformedCode = null;
    try { BigGainsMigrationEngine.validateApprovedAudit('{broken'); } catch (error) { malformedCode = error.code; }
    return { accepted: accepted.format, rawCode, malformedCode };
  }, audit);
  expect(result).toEqual({
    accepted: 'big-gains.migration-preview.v1',
    rawCode: 'raw-or-unknown-audit-field',
    malformedCode: 'invalid-json'
  });
});

test('blocks changed workouts, bodyweight, and preferences after audit approval', async ({ page }) => {
  const base = snapshots({ jorge: { workouts: [completedWorkout()], weights: [{ weight: 210, date: '2026-08-01T12:00:00Z' }] } });
  const { audit } = await approved(page, base);
  const changed = snapshots({ jorge: {
    version: 4,
    workouts: [completedWorkout({ durationSeconds: 2701 })],
    weights: [{ weight: 211, date: '2026-08-01T12:00:00Z' }],
    timerPreferences: { sound: false, vibration: true }
  } });
  const current = await page.evaluate(async ({ changed, remoteState }) => BigGainsMigrationPreview.buildPreview({ localSnapshots: changed, remote: remoteState }), { changed, remoteState: remote() });
  const blockers = await page.evaluate(({ audit, current }) => BigGainsMigrationEngine.compareAuditToPreview(audit, current), { audit, current });
  expect(blockers).toEqual(expect.arrayContaining([
    'The current local account checksum does not match the approved audit.',
    'Jorge stored schema marker changed after approval.',
    'Jorge completedWorkouts checksum changed after approval.',
    'Jorge bodyweightEntries checksum changed after approval.',
    'Jorge timerPreferences checksum changed after approval.'
  ]));
});

test('blocks account/profile mapping mismatch and remote rows before first migration', async ({ page }) => {
  const { audit } = await approved(page);
  const changedRemote = remote({
    profiles: [
      { id: 'different-jorge', account_id: 'account-jorge', client_id: 'jorge' },
      { id: 'profile-alexa', account_id: 'account-jorge', client_id: 'alexa' }
    ],
    counts: { ...ZERO_COUNTS, bodyweight_entries: 1 }
  });
  const current = await page.evaluate(async ({ local, changedRemote }) => BigGainsMigrationPreview.buildPreview({ localSnapshots: local, remote: changedRemote }), { local: snapshots(), changedRemote });
  const blockers = await page.evaluate(({ audit, current }) => BigGainsMigrationEngine.compareAuditToPreview(audit, current), { audit, current });
  expect(blockers).toEqual(expect.arrayContaining([
    'bodyweight_entries already has 1 row for this account.',
    'Jorge cloud mapping does not match the approved audit.'
  ]));
});

test('freezes deterministic target IDs, collision-safe bodyweight occurrences, and exact counts', async ({ page }) => {
  const local = snapshots({
    jorge: {
      workouts: [completedWorkout()],
      customRoutines: { Push: ['press', 'fly'] },
      weights: [
        { weight: 210, date: '2026-08-01T12:00:00Z' },
        { weight: 210, date: '2026-08-01T12:00:00Z' },
        { weight: 211, date: '2026-08-01T12:00:00Z' }
      ],
      exercisePreferences: { press: { cue: 'brace', restSeconds: 90 } },
      activeWorkout: activeWorkout()
    }
  });
  const first = await approved(page, local);
  const second = await approved(page, local);
  expect(second.plan.target.combinedChecksum).toBe(first.plan.target.combinedChecksum);
  expect(second.plan.records.map(row => row.clientId)).toEqual(first.plan.records.map(row => row.clientId));
  const bodyIds = first.plan.records.filter(row => row.table === 'bodyweight_entries').map(row => row.clientId);
  expect(new Set(bodyIds).size).toBe(3);
  expect(bodyIds[0].replace(/:1$/, '')).toBe(bodyIds[1].replace(/:2$/, ''));
  expect(first.plan.target.tableCounts).toEqual({ workouts: 1, routines: 1, bodyweight_entries: 3, preferences: 5, active_sessions: 1 });
  expect(first.plan.target.totalDatabaseRows).toBe(12);
  expect(first.plan.records.find(row => row.table === 'workouts').clientId).toBe('completed-push-1');
  expect(first.plan.records.find(row => row.canonical.entityType === 'goals').clientId).toBe('goals');
  expect(first.plan.records.find(row => row.canonical.entityType === 'timerPreferences').clientId).toBe('timer');
  expect(first.plan.records.find(row => row.canonical.entityType === 'exercisePreference').clientId).toBe('exercise:press');
});

test('first migration verifies readback and marks the journal complete only afterward', async ({ page }) => {
  const { plan } = await approved(page, snapshots({ jorge: { workouts: [completedWorkout()] } }));
  const result = await page.evaluate(async plan => {
    const repository = __migrationMemoryRepository();
    const result = await BigGainsMigrationEngine.executeMigration({
      plan, repository, verifySource: async () => ({ combinedChecksum: plan.source.combinedChecksum })
    });
    return { result, writes: repository.writes, tableCounts: Object.fromEntries(Object.entries(repository.tables).map(([key, rows]) => [key, rows.length])) };
  }, plan);
  expect(result.result.ok).toBe(true);
  expect(result.result.journal.metadata.status).toBe('complete');
  expect(result.result.verification.verified).toBe(true);
  expect(result.writes.findIndex(write => write.status === 'verifying')).toBeGreaterThan(result.writes.findLastIndex(write => write.type === 'row-insert'));
  expect(result.writes.at(-1)).toMatchObject({ type: 'journal-update', status: 'complete' });
  expect(result.tableCounts).toEqual(plan.target.tableCounts);
});

test('a lost response retry recovers exactly one row per source entity', async ({ page }) => {
  const { plan } = await approved(page, snapshots({ jorge: { workouts: [completedWorkout()] } }));
  const result = await page.evaluate(async plan => {
    const repository = __migrationMemoryRepository({ lostResponseOnce: true });
    await BigGainsMigrationEngine.executeMigration({ plan, repository, verifySource: async () => ({ combinedChecksum: plan.source.combinedChecksum }) });
    return Object.fromEntries(Object.entries(repository.tables).map(([key, rows]) => [key, rows.length]));
  }, plan);
  expect(result).toEqual(plan.target.tableCounts);
});

test('mid-migration failure preserves a matching journal and resumes without duplicates', async ({ page }) => {
  const { plan } = await approved(page, snapshots({ jorge: { workouts: [completedWorkout()], weights: [{ weight: 210, date: '2026-08-01' }] } }));
  const result = await page.evaluate(async plan => {
    const repository = __migrationMemoryRepository({ failAtInsert: 3 });
    let firstCode = null;
    try {
      await BigGainsMigrationEngine.executeMigration({ plan, repository, verifySource: async () => ({ combinedChecksum: plan.source.combinedChecksum }) });
    } catch (error) { firstCode = error.code; }
    const incomplete = JSON.parse(JSON.stringify(repository.journals[0]));
    delete repository.tables.__unused;
    const resumed = await BigGainsMigrationEngine.executeMigration({
      plan, repository, existingJournal: incomplete,
      verifySource: async () => ({ combinedChecksum: plan.source.combinedChecksum })
    });
    return {
      firstCode,
      firstStatus: incomplete.metadata.status,
      resumedStatus: resumed.journal.metadata.status,
      counts: Object.fromEntries(Object.entries(repository.tables).map(([key, rows]) => [key, rows.length]))
    };
  }, plan);
  expect(result.firstCode).toBe('network');
  expect(result.firstStatus).toBe('failed');
  expect(result.resumedStatus).toBe('complete');
  expect(result.counts).toEqual(plan.target.tableCounts);
});

test('mismatched existing row blocks instead of overwriting', async ({ page }) => {
  const { plan } = await approved(page, snapshots({ jorge: { workouts: [completedWorkout()] } }));
  const result = await page.evaluate(async plan => {
    const repository = __migrationMemoryRepository();
    const record = plan.records[0];
    repository.tables[record.table].push({ id: crypto.randomUUID(), ...record.row, idempotency_key: 'different-identity' });
    try {
      await BigGainsMigrationEngine.executeMigration({ plan, repository, verifySource: async () => ({ combinedChecksum: plan.source.combinedChecksum }) });
      return null;
    } catch (error) { return { code: error.code, count: repository.tables[record.table].length }; }
  }, plan);
  expect(result).toEqual({ code: 'row-conflict', count: 1 });
});

for (const scenario of [
  { name: 'readback count mismatch', options: { dropReadbackTable: 'preferences' }, code: 'readback-count-mismatch' },
  { name: 'readback checksum mismatch', options: { corruptReadbackTable: 'preferences' }, code: 'readback-checksum-mismatch' }
]) {
  test(`${scenario.name} blocks completion`, async ({ page }) => {
    const { plan } = await approved(page);
    const result = await page.evaluate(async ({ plan, scenario }) => {
      const repository = __migrationMemoryRepository(scenario.options);
      let code = null;
      try {
        await BigGainsMigrationEngine.executeMigration({ plan, repository, verifySource: async () => ({ combinedChecksum: plan.source.combinedChecksum }) });
      } catch (error) { code = error.code; }
      return { code, status: repository.journals[0].metadata.status };
    }, { plan, scenario });
    expect(result).toEqual({ code: scenario.code, status: 'failed' });
  });
}

test('source change during upload blocks completion', async ({ page }) => {
  const { plan } = await approved(page);
  const result = await page.evaluate(async plan => {
    const repository = __migrationMemoryRepository();
    let code = null;
    try {
      await BigGainsMigrationEngine.executeMigration({ plan, repository, verifySource: async () => ({ combinedChecksum: '0'.repeat(64) }) });
    } catch (error) { code = error.code; }
    return { code, status: repository.journals[0].metadata.status };
  }, plan);
  expect(result).toEqual({ code: 'source-changed-during-migration', status: 'failed' });
});

test('post-migration audit is metadata-only', async ({ page }) => {
  const sensitive = snapshots({ jorge: {
    workouts: [completedWorkout({ note: 'private workout sentinel' })],
    weights: [{ weight: 219.75, date: '2026-08-01' }],
    exercisePreferences: { press: { cue: 'private cue sentinel', restSeconds: 90 } }
  } });
  const { plan } = await approved(page, sensitive);
  const audit = await page.evaluate(async plan => {
    const repository = __migrationMemoryRepository();
    return (await BigGainsMigrationEngine.executeMigration({
      plan, repository, verifySource: async () => ({ combinedChecksum: plan.source.combinedChecksum })
    })).audit;
  }, plan);
  const serialized = JSON.stringify(audit);
  expect(audit.format).toBe('big-gains.migration-audit.v1');
  expect(audit.migration.status).toBe('complete');
  expect(serialized).not.toContain('private workout sentinel');
  expect(serialized).not.toContain('private cue sentinel');
  expect(serialized).not.toContain('219.75');
  expect(serialized).not.toContain('payload');
});

test('no write occurs without file selection and second inline confirmation', async ({ page }) => {
  await page.evaluate(zeroCounts => {
    const account = { id: 'account-jorge', owner_user_id: 'auth-jorge' };
    const profiles = [
      { id: 'profile-jorge', account_id: account.id, client_id: 'jorge' },
      { id: 'profile-alexa', account_id: account.id, client_id: 'alexa' }
    ];
    window.__migrationUiWrites = [];
    const client = { from(table) {
      const query = {
        select(_columns, options) { query.options = options; return query; }, eq() { return query; }, limit() { return query; }, like() { return query; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        insert() { window.__migrationUiWrites.push({ table, method: 'insert' }); return query; }, update() { window.__migrationUiWrites.push({ table, method: 'update' }); return query; },
        then(resolve, reject) {
          const response = table === 'accounts' ? { data: [account], error: null }
            : table === 'profiles' ? { data: profiles, error: null }
              : table === 'sync_metadata' && !query.options?.head ? { data: [], error: null }
                : { data: null, count: zeroCounts[table], error: null };
          return Promise.resolve(response).then(resolve, reject);
        }
      };
      return query;
    } };
    window.BigGainsSupabase = { configured: true, async session() { return { user: { id: 'auth-jorge' } }; }, getClient() { return client; }, onAuthStateChange() { return { unsubscribe() {} }; } };
  }, ZERO_COUNTS);
  await page.evaluate(() => BigGainsControlledMigration.refresh());
  await page.locator('#openSettings').click();
  await page.locator('#advancedDiagnostics').evaluate(element => { element.open = true; });
  const card = page.locator('#controlledMigrationCard');
  await expect(card.locator('#approvedMigrationAudit')).toBeVisible();
  await expect(card.locator('#runControlledMigration')).toHaveCount(0);
  expect(await page.evaluate(() => window.__migrationUiWrites)).toEqual([]);
});

test('planning and execution leave local storage, schema v5, backup, and snapshot unchanged', async ({ page }) => {
  const beforeJorge = await readStoredJson(page, STORAGE_KEYS.jorge);
  const beforeAlexa = await readStoredJson(page, STORAGE_KEYS.alexa);
  const { plan } = await approved(page);
  const result = await page.evaluate(async plan => {
    const backupBefore = statePersistenceApi.prepareExport(state).json;
    const snapshotBefore = BigGainsSync.buildSnapshot();
    const repository = __migrationMemoryRepository();
    await BigGainsMigrationEngine.executeMigration({ plan, repository, verifySource: async () => ({ combinedChecksum: plan.source.combinedChecksum }) });
    const snapshotAfter = BigGainsSync.buildSnapshot();
    return {
      backupSame: statePersistenceApi.prepareExport(state).json === backupBefore,
      snapshotSame: JSON.stringify({ ...snapshotAfter, generatedAt: null }) === JSON.stringify({ ...snapshotBefore, generatedAt: null }),
      version: state.version
    };
  }, plan);
  expect(result).toEqual({ backupSame: true, snapshotSame: true, version: 5 });
  expect(await readStoredJson(page, STORAGE_KEYS.jorge)).toEqual(beforeJorge);
  expect(await readStoredJson(page, STORAGE_KEYS.alexa)).toEqual(beforeAlexa);
});
