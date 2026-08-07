import { expect, test } from '@playwright/test';
import { blankState, installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const accountId = 'account-phase4f';
const profiles = {
  jorge: { id: 'profile-jorge', account_id: accountId, client_id: 'jorge' },
  alexa: { id: 'profile-alexa', account_id: accountId, client_id: 'alexa' }
};

async function openBlank(page) {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
}

test('migration envelopes reconstruct into equal local/cloud shadow checksums without derived PR data', async ({ page }) => {
  await openBlank(page);
  const result = await page.evaluate(async ({ accountId, profiles }) => {
    const states = {
      jorge: {
        version: 5, profileId: 'jorge', goals: { primary: 'Strength' }, workouts: [{
          id: 'workout-1', type: 'Push', startedAt: '2026-08-01T10:00:00.000Z', completedAt: '2026-08-01T11:00:00.000Z',
          durationSeconds: 3600, prs: 1, exercises: []
        }], weights: [{ weight: 210, date: '2026-08-02T12:00:00.000Z' }],
        prs: { derived: { estimated1RM: 300, weight: 225, reps: 10, date: '2026-08-01T11:00:00.000Z' } },
        activeWorkout: null, restTimerEndsAt: null, customRoutines: { Push: ['press'] },
        timerPreferences: { sound: true, vibration: false }, exercisePreferences: { press: { cue: 'brace', restSeconds: 90 } }
      },
      alexa: {
        version: 5, profileId: 'alexa', goals: { primary: 'Wellness' }, workouts: [], weights: [], prs: {},
        activeWorkout: null, restTimerEndsAt: null, customRoutines: {}, timerPreferences: { sound: false, vibration: true }
      }
    };
    const localProfiles = {};
    const rowsByTable = Object.fromEntries(BigGainsCloudShadow.tables.map(table => [table, []]));
    const writes = [];
    const originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (...args) => { writes.push(args[0]); return originalSetItem(...args); };
    for (const profileClientId of BigGainsCloudShadow.profileIds) {
      const records = await BigGainsCloudShadow.localRecords(profileClientId, states[profileClientId]);
      localProfiles[profileClientId] = { records };
      for (const record of records) {
        const base = {
          id: `${profileClientId}-${record.table}-${record.clientId}`,
          account_id: accountId, profile_id: profiles[profileClientId].id, client_id: record.clientId,
          idempotency_key: `bg-migration-v1:${record.fingerprint}`, version: 1,
          created_at: '2026-08-07T18:00:00.000Z', updated_at: '2026-08-07T18:00:00.000Z'
        };
        if (record.table === 'bodyweight_entries') {
          rowsByTable[record.table].push({ ...base, measured_at: record.data.measuredAt, weight_value: record.data.weightValue, unit: record.data.unit });
        } else {
          rowsByTable[record.table].push({
            ...base,
            ...(record.table === 'workouts' ? { completed_at: record.data.completedAt } : {}),
            payload: { contract: 'big-gains.migration.v1', version: 1, profileClientId, entityType: record.entityType, clientId: record.clientId, data: record.data }
          });
        }
      }
    }
    states.jorge.prs.derived.estimated1RM = 999;
    const cloud = await BigGainsCloudShadow.reconstructCloud({ rowsByTable, tombstones: [], profiles, accountId });
    const comparison = await BigGainsCloudShadow.compare({ localProfiles, cloud });
    const journal = {
      account_id: accountId,
      metadata: { format: 'big-gains.migration-journal.v1', migrationContract: 'big-gains.migration.v1', migrationId: 'migration-baseline', status: 'complete' }
    };
    const catalog = BigGainsCloudShadow.catalogFromCloud({
      cloud,
      owner: { account: { id: accountId, owner_user_id: 'auth-owner' }, profiles },
      journal
    });
    return {
      comparison,
      writes,
      catalog,
      migrationPayloads: rowsByTable.workouts.map(row => row.payload.contract)
    };
  }, { accountId, profiles });

  expect(result.comparison.parity).toBe(true);
  expect(result.comparison.profiles.jorge.localChecksum).toBe(result.comparison.profiles.jorge.cloudChecksum);
  expect(result.writes).toEqual([]);
  expect(result.catalog.migrationId).toBe('migration-baseline');
  expect(result.catalog.profiles.jorge.records).toBeTruthy();
  expect(result.migrationPayloads).toEqual(['big-gains.migration.v1']);
});

test('missing, extra, tampered, wrong-profile, stale, and newer rows report exact drift without repair', async ({ page }) => {
  await openBlank(page);
  const result = await page.evaluate(async ({ accountId, profiles }) => {
    const state = {
      version: 5, profileId: 'jorge', goals: { primary: 'Strength' }, workouts: [], weights: [], prs: {},
      activeWorkout: null, restTimerEndsAt: null, customRoutines: {}, timerPreferences: { sound: true, vibration: true }
    };
    const alexaState = { ...state, profileId: 'alexa', goals: { primary: 'Wellness' } };
    const jorgeRecords = await BigGainsCloudShadow.localRecords('jorge', state);
    const alexaRecords = await BigGainsCloudShadow.localRecords('alexa', alexaState);
    const localProfiles = { jorge: { records: jorgeRecords }, alexa: { records: alexaRecords } };
    const rowFor = (record, profileClientId) => ({
      id: `${profileClientId}-${record.clientId}`, account_id: accountId, profile_id: profiles[profileClientId].id,
      client_id: record.clientId, idempotency_key: `migration:${record.clientId}`, version: 1,
      created_at: '2026-08-07T18:00:00.000Z', updated_at: '2026-08-07T18:00:00.000Z',
      payload: { contract: 'big-gains.migration.v1', version: 1, profileClientId, entityType: record.entityType, clientId: record.clientId, data: record.data }
    });
    const baseline = Object.fromEntries(BigGainsCloudShadow.tables.map(table => [table, []]));
    for (const record of jorgeRecords) baseline[record.table].push(rowFor(record, 'jorge'));
    for (const record of alexaRecords) baseline[record.table].push(rowFor(record, 'alexa'));
    const run = async (mutate, expectedCatalog = null) => {
      const rowsByTable = JSON.parse(JSON.stringify(baseline));
      mutate(rowsByTable);
      const cloud = await BigGainsCloudShadow.reconstructCloud({ rowsByTable, tombstones: [], profiles, accountId });
      return BigGainsCloudShadow.compare({ localProfiles, cloud, expectedCatalog });
    };
    const missing = await run(rows => rows.preferences.splice(0, 1));
    const extra = await run(rows => rows.preferences.push({ ...rows.preferences[0], id: 'extra', client_id: 'exercise:extra', payload: {
      contract: 'big-gains.migration.v1', version: 1, profileClientId: 'jorge', entityType: 'exercisePreference', clientId: 'exercise:extra', data: { exerciseId: 'extra', preference: { cue: 'extra' } }
    } }));
    const tampered = await run(rows => { rows.preferences[0].payload.data = { primary: 'tampered' }; });
    const wrongProfile = await run(rows => { rows.preferences[0].profile_id = 'unknown-profile'; });
    const cloudBaseline = await BigGainsCloudShadow.reconstructCloud({ rowsByTable: baseline, tombstones: [], profiles, accountId });
    const journal = { metadata: { migrationId: 'm', status: 'complete' } };
    const expected = BigGainsCloudShadow.catalogFromCloud({ cloud: cloudBaseline, owner: { account: { id: accountId, owner_user_id: 'auth' }, profiles }, journal });
    const stale = JSON.parse(JSON.stringify(expected));
    const firstKey = Object.keys(stale.profiles.jorge.records)[0];
    stale.profiles.jorge.records[firstKey].version = 2;
    const staleResult = await run(() => {}, stale);
    const newerRows = JSON.parse(JSON.stringify(baseline));
    newerRows.preferences.find(row => row.profile_id === profiles.jorge.id).version = 3;
    const newerCloud = await BigGainsCloudShadow.reconstructCloud({ rowsByTable: newerRows, tombstones: [], profiles, accountId });
    const newerResult = await BigGainsCloudShadow.compare({ localProfiles, cloud: newerCloud, expectedCatalog: expected });
    return {
      missing: missing.reasons, extra: extra.reasons, tampered: tampered.reasons,
      wrongProfile: wrongProfile.reasons, stale: staleResult.reasons, newer: newerResult.reasons
    };
  }, { accountId, profiles });

  expect(result.missing.join(' ')).toContain('missing from cloud');
  expect(result.extra.join(' ')).toContain('unexpected extra cloud row');
  expect(result.tampered.join(' ')).toContain('payload does not match local data');
  expect(result.wrongProfile.join(' ')).toContain('unexpected account or profile ownership');
  expect(result.stale.join(' ')).toContain('stale remote version');
  expect(result.newer.join(' ')).toContain('newer remote version; local remains authoritative');
});

test('tombstone wins an exact tie and only a strictly later intentional recreation becomes current', async ({ page }) => {
  await openBlank(page);
  const result = await page.evaluate(async ({ accountId, profiles }) => {
    const data = { name: 'Push', exerciseIds: ['press'] };
    const clientId = await BigGainsCloudShadow.routineClientId('Push');
    const row = {
      id: 'source', account_id: accountId, profile_id: profiles.jorge.id, client_id: clientId,
      idempotency_key: 'source-key', version: 2, created_at: '2026-08-07T18:00:00.000Z', updated_at: '2026-08-07T18:00:00.000Z',
      payload: { contract: 'big-gains.shadow.v1', version: 1, profileClientId: 'jorge', entityType: 'customRoutine', clientId, data }
    };
    const tombstone = {
      id: 'delete', account_id: accountId, profile_id: profiles.jorge.id, entity_type: 'routines', entity_id: clientId,
      idempotency_key: 'delete-key', version: 2, deleted_at: '2026-08-07T18:00:00.000Z',
      created_at: '2026-08-07T18:00:00.000Z', updated_at: '2026-08-07T18:00:00.000Z'
    };
    const rowsByTable = Object.fromEntries(BigGainsCloudShadow.tables.map(table => [table, table === 'routines' ? [row] : []]));
    const tied = await BigGainsCloudShadow.reconstructCloud({ rowsByTable, tombstones: [tombstone], profiles, accountId });
    row.version = 3;
    row.updated_at = '2026-08-07T18:01:00.000Z';
    const recreated = await BigGainsCloudShadow.reconstructCloud({ rowsByTable, tombstones: [tombstone], profiles, accountId });
    return {
      tiedCount: tied.profiles.jorge.current.length,
      tiedWinnerDeleted: tied.profiles.jorge.winners.get(BigGainsCloudShadow.keyFor('routines', clientId)).tombstone,
      recreatedCount: recreated.profiles.jorge.current.length,
      recreatedVersion: recreated.profiles.jorge.current[0].version
    };
  }, { accountId, profiles });
  expect(result).toEqual({ tiedCount: 0, tiedWinnerDeleted: true, recreatedCount: 1, recreatedVersion: 3 });
});

test('normal local mutations enqueue only after schema-v5 storage and survive signed-out offline reload', async ({ page, context }) => {
  await openBlank(page);
  await page.evaluate(async ({ accountId, profiles, alexa }) => {
    localStorage.setItem('big-gains-alexa-v1', JSON.stringify(alexa));
    const states = {
      jorge: JSON.parse(localStorage.getItem('big-gains-v2')),
      alexa
    };
    const catalogProfiles = {};
    for (const profileClientId of BigGainsCloudShadow.profileIds) {
      const records = await BigGainsCloudShadow.localRecords(profileClientId, states[profileClientId]);
      catalogProfiles[profileClientId] = { profileId: profiles[profileClientId].id, records: Object.fromEntries(records.map(record => [
        BigGainsCloudShadow.keyFor(record.table, record.clientId),
        { table: record.table, entityType: record.entityType, clientId: record.clientId, version: 1, updatedAt: '2026-08-07T18:00:00.000Z', fingerprint: record.fingerprint, tombstone: false, data: record.data }
      ])) };
    }
    localStorage.setItem('big-gains-cloud-shadow-catalog-v1', JSON.stringify({
      format: 'big-gains.shadow-catalog.v1', version: 1, accountId, authUserId: 'auth-owner', migrationId: 'migration-baseline', profiles: catalogProfiles
    }));
  }, { accountId, profiles, alexa: blankState('alexa') });
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await context.setOffline(true);

  const immediate = await page.evaluate(() => {
    state.goals = { primary: 'Updated strength goal' };
    state.timerPreferences.vibration = false;
    state.customRoutines.Push = ['seated-machine-chest-press'];
    state.weights.unshift({ weight: 209.5, date: '2026-08-07T19:00:00.000Z' });
    active = {
      id: 'active-shadow', type: 'Push', startedAt: '2026-08-07T19:00:00.000Z',
      exercises: [{ id: 'press', name: 'Press', sets: [{ id: 'set-1', weight: 100, reps: 8, warmup: false, completed: false }] }]
    };
    state.workouts.unshift({
      id: 'workout-shadow', type: 'Push', startedAt: '2026-08-07T17:00:00.000Z', completedAt: '2026-08-07T18:00:00.000Z',
      durationSeconds: 3600, prs: 0, exercises: []
    });
    saveState();
    return {
      stored: JSON.parse(localStorage.getItem('big-gains-v2')),
      pendingImmediately: BigGainsCloudSync.queue.pending().length
    };
  });
  expect(immediate.stored.goals.primary).toBe('Updated strength goal');
  expect(immediate.pendingImmediately).toBe(0);
  await expect.poll(() => page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(6);
  const invariants = await page.evaluate(() => ({
    types: BigGainsCloudSync.queue.pending().map(operation => operation.entityType).sort(),
    backup: JSON.parse(statePersistenceApi.prepareExport(state).json),
    snapshot: BigGainsSync.buildSnapshot()
  }));
  const types = invariants.types;
  expect(types).toEqual(['active_sessions', 'bodyweight_entries', 'preferences', 'preferences', 'routines', 'workouts']);
  expect(invariants.backup.version).toBe(5);
  expect(invariants.backup).not.toHaveProperty('cloud');
  expect(invariants.snapshot.schema).toBe('big-gains.snapshot.v1');
  const alexaOperation = await page.evaluate(async () => {
    const alexa = JSON.parse(localStorage.getItem('big-gains-alexa-v1'));
    alexa.goals = { ...alexa.goals, primary: 'Alexa updated locally' };
    localStorage.setItem('big-gains-alexa-v1', JSON.stringify(alexa));
    await BigGainsCloudSync.captureLocalSnapshot('alexa');
    return BigGainsCloudSync.queue.pending().find(operation => operation.owner.profileId === 'profile-alexa');
  });
  expect(alexaOperation).toMatchObject({ owner: { accountId, profileId: 'profile-alexa' }, entityType: 'preferences', entityId: 'goals' });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const restored = await page.evaluate(() => ({
    pending: BigGainsCloudSync.queue.pending().length,
    storedWorkout: JSON.parse(localStorage.getItem('big-gains-v2')).workouts[0].id,
    signedOut: !BigGainsCloudSync.status().ownerReady
  }));
  expect(restored).toEqual({ pending: 7, storedWorkout: 'workout-shadow', signedOut: true });
  await context.setOffline(false);
});

test('queue refuses a different signed-in account/profile mapping', async ({ page }) => {
  await openBlank(page);
  const operation = await page.evaluate(() => BigGainsCloud.createOperation({
    owner: { accountId: 'account-a', profileId: 'profile-a' }, entityType: 'preferences', entityId: 'goals',
    mutation: 'upsert', version: 1, updatedAt: '2026-08-07T18:00:00.000Z',
    payload: { contract: 'big-gains.shadow.v1', version: 1, profileClientId: 'jorge', entityType: 'goals', clientId: 'goals', data: { primary: 'Strength' } }
  }));
  expect(operation.owner).toEqual({ accountId: 'account-a', profileId: 'profile-a' });
  const response = await page.evaluate(async operation => {
    let calls = 0;
    const transport = BigGainsCloudSync.createProductionTransport({
      client: { from() { calls += 1; throw new Error('must not query'); } },
      owner: { account: { id: 'account-b' }, profiles: { jorge: { id: 'profile-b' }, alexa: { id: 'profile-c' } } }
    });
    return { result: await transport.send(operation), calls };
  }, operation);
  expect(response).toEqual({ result: { ok: false, blocked: true, reason: 'owner-mapping-mismatch' }, calls: 0 });
});

test('production transport adopts a migrated row, recovers lost ACKs, tombstones deletion, and requires explicit later recreation', async ({ page }) => {
  await openBlank(page);
  const result = await page.evaluate(async ({ accountId, profiles }) => {
    const store = { workouts: [], tombstones: [] };
    let nextId = 1;
    const matches = (row, filters) => Object.entries(filters).every(([key, value]) => row[key] === value);
    function query(table, mode = 'select', values = null) {
      const filters = {};
      const chain = {
        select() { return chain; },
        eq(key, value) { filters[key] = value; return chain; },
        insert(input) { return query(table, 'insert', input); },
        update(input) { return query(table, 'update', input); },
        async maybeSingle() {
          const found = store[table].find(row => matches(row, filters)) || null;
          return { data: found ? JSON.parse(JSON.stringify(found)) : null, error: null };
        },
        async single() {
          if (mode === 'insert') {
            const duplicate = store[table].find(row => table === 'tombstones'
              ? row.account_id === values.account_id && row.profile_id === values.profile_id && row.entity_type === values.entity_type && row.entity_id === values.entity_id
              : row.account_id === values.account_id && row.profile_id === values.profile_id && row.client_id === values.client_id);
            if (duplicate) return { data: null, error: { code: '23505', message: 'duplicate' } };
            const row = {
              ...JSON.parse(JSON.stringify(values)), id: `remote-${nextId++}`,
              created_at: values.updated_at || values.deleted_at,
              updated_at: values.updated_at || values.deleted_at
            };
            store[table].push(row);
            return { data: JSON.parse(JSON.stringify(row)), error: null };
          }
          if (mode === 'update') {
            const index = store[table].findIndex(row => matches(row, filters));
            if (index < 0) return { data: null, error: { code: 'PGRST116', message: 'no row' } };
            store[table][index] = { ...store[table][index], ...JSON.parse(JSON.stringify(values)) };
            return { data: JSON.parse(JSON.stringify(store[table][index])), error: null };
          }
          const found = store[table].find(row => matches(row, filters)) || null;
          return { data: found ? JSON.parse(JSON.stringify(found)) : null, error: found ? null : { code: 'PGRST116', message: 'no row' } };
        }
      };
      return chain;
    }
    const client = { from(table) { if (!store[table]) store[table] = []; return query(table); } };
    const owner = { account: { id: accountId }, profiles };
    const transport = BigGainsCloudSync.createProductionTransport({ client, owner });
    const baseState = {
      version: 5, profileId: 'jorge', goals: {}, weights: [], prs: {}, activeWorkout: null, restTimerEndsAt: null,
      customRoutines: {}, timerPreferences: { sound: true, vibration: true }, workouts: [{
        id: 'workout-production', type: 'Push', startedAt: '2026-08-07T17:00:00.000Z', completedAt: '2026-08-07T18:00:00.000Z',
        durationSeconds: 3600, prs: 0, exercises: []
      }]
    };
    const original = (await BigGainsCloudShadow.localRecords('jorge', baseState)).find(record => record.table === 'workouts');
    store.workouts.push({
      id: 'migrated-row', account_id: accountId, profile_id: profiles.jorge.id, client_id: original.clientId,
      idempotency_key: 'bg-migration-v1:original', completed_at: original.data.completedAt,
      payload: { contract: 'big-gains.migration.v1', version: 1, profileClientId: 'jorge', entityType: original.entityType, clientId: original.clientId, data: original.data },
      version: 1, created_at: '2026-08-07T18:00:00.000Z', updated_at: '2026-08-07T18:00:00.000Z'
    });
    const changedState = JSON.parse(JSON.stringify(baseState));
    changedState.workouts[0].note = 'normal post-migration edit';
    const changed = (await BigGainsCloudShadow.localRecords('jorge', changedState)).find(record => record.table === 'workouts');
    const update = BigGainsCloud.createOperation({
      owner: { accountId, profileId: profiles.jorge.id }, entityType: 'workouts', entityId: changed.clientId,
      mutation: 'upsert', version: 2, updatedAt: '2026-08-07T18:01:00.000Z',
      payload: BigGainsCloudShadow.envelopeFor(changed), payloadFingerprint: changed.fingerprint,
      baseRevision: { version: 1, updatedAt: '2026-08-07T18:00:00.000Z', fingerprint: original.fingerprint, tombstone: false }
    });
    const adopted = await transport.send(update);
    const lostAckRetry = await transport.send(update);
    const conflictingState = JSON.parse(JSON.stringify(changedState));
    conflictingState.workouts[0].note = 'different same-version payload';
    const conflicting = (await BigGainsCloudShadow.localRecords('jorge', conflictingState)).find(record => record.table === 'workouts');
    const conflict = await transport.send(BigGainsCloud.createOperation({
      owner: { accountId, profileId: profiles.jorge.id }, entityType: 'workouts', entityId: conflicting.clientId,
      mutation: 'upsert', version: 2, updatedAt: '2026-08-07T18:01:00.000Z',
      payload: BigGainsCloudShadow.envelopeFor(conflicting), payloadFingerprint: conflicting.fingerprint
    }));
    const deletedFingerprint = await BigGainsCloudShadow.fingerprint('jorge', 'workouts', changed.clientId, null, true);
    const deletion = BigGainsCloud.createOperation({
      owner: { accountId, profileId: profiles.jorge.id }, entityType: 'workouts', entityId: changed.clientId,
      mutation: 'delete', version: 3, updatedAt: '2026-08-07T18:02:00.000Z', payloadFingerprint: deletedFingerprint,
      baseRevision: { version: 2, updatedAt: '2026-08-07T18:01:00.000Z', fingerprint: changed.fingerprint, tombstone: false }
    });
    const deleted = await transport.send(deletion);
    const deleteRetry = await transport.send(deletion);
    const blockedRecreation = await transport.send(BigGainsCloud.createOperation({
      owner: { accountId, profileId: profiles.jorge.id }, entityType: 'workouts', entityId: changed.clientId,
      mutation: 'upsert', version: 4, updatedAt: '2026-08-07T18:03:00.000Z',
      payload: BigGainsCloudShadow.envelopeFor(changed), payloadFingerprint: changed.fingerprint,
      baseRevision: { version: 3, updatedAt: '2026-08-07T18:02:00.000Z', fingerprint: deletedFingerprint, tombstone: true }
    }));
    const recreation = BigGainsCloud.createOperation({
      owner: { accountId, profileId: profiles.jorge.id }, entityType: 'workouts', entityId: changed.clientId,
      mutation: 'upsert', version: 4, updatedAt: '2026-08-07T18:03:00.000Z',
      payload: BigGainsCloudShadow.envelopeFor(changed), payloadFingerprint: changed.fingerprint, allowRecreation: true,
      baseRevision: { version: 3, updatedAt: '2026-08-07T18:02:00.000Z', fingerprint: deletedFingerprint, tombstone: true }
    });
    const recreated = await transport.send(recreation);
    const recreatedRetry = await transport.send(recreation);
    return {
      adopted, lostAckRetry, conflict, deleted, deleteRetry, blockedRecreation, recreated, recreatedRetry,
      workoutRows: store.workouts.length, tombstones: store.tombstones.length,
      finalVersion: store.workouts[0].version, finalContract: store.workouts[0].payload.contract
    };
  }, { accountId, profiles });

  expect(result.adopted.ok).toBe(true);
  expect(result.lostAckRetry).toMatchObject({ ok: true, duplicate: true, remoteVersion: 2 });
  expect(result.conflict).toMatchObject({ ok: false, blocked: true, reason: 'unexpected-existing-identity' });
  expect(result.deleted.ok).toBe(true);
  expect(result.deleteRetry).toMatchObject({ ok: true, duplicate: true, remoteVersion: 3 });
  expect(result.blockedRecreation).toMatchObject({ ok: false, blocked: true, reason: 'recreation-not-authorized' });
  expect(result.recreated.ok).toBe(true);
  expect(result.recreatedRetry).toMatchObject({ ok: true, duplicate: true, remoteVersion: 4 });
  expect(result).toMatchObject({ workoutRows: 1, tombstones: 1, finalVersion: 4, finalContract: 'big-gains.shadow.v1' });
});
