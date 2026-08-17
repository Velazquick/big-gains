import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { openApp } from './helpers/app.js';

const authUserId = '85000000-0000-0000-0000-000000000001';
const accountId = '85a00000-0000-0000-0000-000000000001';
const profileId = '85b00000-0000-0000-0000-000000000001';
const clientId = 'independent-crossdevice';
const namespace = `cloud-${accountId}-${profileId}`;
const storageKey = `big-gains-${namespace}-v1`;
const catalogKey = `big-gains-cloud-shadow-catalog-v1-${namespace}`;
const baselineAt = '2026-08-11T20:00:00.000Z';
const advancedAt = '2026-08-11T20:05:00.000Z';

function profileState(primary, overrides = {}) {
  return {
    version: 5,
    profileId: clientId,
    goals: { primary },
    workouts: [],
    weights: [],
    prs: {},
    activeWorkout: null,
    restTimerEndsAt: null,
    customRoutines: {},
    timerPreferences: { sound: true, vibration: true },
    ...overrides
  };
}

async function installReceiver(page, input = 'Shared baseline') {
  const state = typeof input === 'string' ? profileState(input) : input;
  await page.addInitScript(({ authUserId, accountId, profileId, clientId, storageKey, state }) => {
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent', authUserId, cloudAccountId: accountId, cloudProfileId: profileId,
          clientId, displayName: 'Sontai',
          presentation: { petEnabled: false, accent: 'cobalt', theme: 'performance-dark' }
        }
      }
    }));
    if (localStorage.getItem(storageKey) === null) localStorage.setItem(storageKey, JSON.stringify(state));
  }, { authUserId, accountId, profileId, clientId, storageKey, state });
  await openApp(page);
  await page.evaluate(async ({ accountId, profileId, authUserId, clientId, catalogKey, baselineAt }) => {
    const records = await BigGainsCloudShadow.localRecords(clientId, state);
    localStorage.setItem(catalogKey, JSON.stringify({
      format: 'big-gains.shadow-catalog.v1',
      version: 1,
      accountId,
      authUserId,
      migrationId: 'cross-device-baseline',
      adoptedAt: baselineAt,
      profiles: {
        [clientId]: {
          profileId,
          records: Object.fromEntries(records.map(record => [
            BigGainsCloudShadow.keyFor(record.table, record.clientId),
            {
              table: record.table,
              entityType: record.entityType,
              clientId: record.clientId,
              version: 1,
              updatedAt: baselineAt,
              fingerprint: record.fingerprint,
              tombstone: false,
              data: record.data
            }
          ]))
        }
      }
    }));
  }, { accountId, profileId, authUserId, clientId, catalogKey, baselineAt });
}

async function installAuthenticatedCloud(page, remoteInput) {
  const options = typeof remoteInput === 'string' ? { remotePrimary: remoteInput } : remoteInput;
  const {
    remotePrimary = 'Shared baseline',
    goalVersion = typeof remoteInput === 'string' ? 2 : 1,
    goalUpdatedAt = goalVersion > 1 ? advancedAt : baselineAt,
    remoteWorkouts = [],
    remoteTombstones = [],
    remoteBodyweights = [],
    remotePreferences = [],
    remoteActiveSessions = [],
    allowWrites = false,
    automaticReconciliation = true,
    includeAutomaticReconciliation = true
  } = options;
  const now = advancedAt;
  await page.addInitScript(({ authUserId, now, automaticReconciliation, includeAutomaticReconciliation }) => {
    const config = {
      supabaseUrl: 'https://synthetic-cross-device.supabase.co',
      supabasePublishableKey: 'sb_publishable_cross_device'
    };
    if (includeAutomaticReconciliation) config.automaticReconciliation = automaticReconciliation;
    window.__BIG_GAINS_CLOUD_CONFIG__ = config;
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('big-gains-supabase-auth-v1', JSON.stringify({
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: authUserId, role: 'authenticated', exp: expiresAt })}.synthetic`,
      refresh_token: 'synthetic-cross-device-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
      user: {
        id: authUserId, aud: 'authenticated', role: 'authenticated', email: 'sontai@example.test',
        email_confirmed_at: now, app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {}, identities: [], created_at: now
      }
    }));
  }, { authUserId, now, automaticReconciliation, includeAutomaticReconciliation });

  const writes = [];
  await page.route('https://synthetic-cross-device.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/auth/v1/user')) {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({
        id: authUserId, aud: 'authenticated', role: 'authenticated', email: 'sontai@example.test',
        email_confirmed_at: now, app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: {}, identities: [], created_at: now
      }) });
    }
    if (request.method() === 'PATCH' && allowWrites && url.pathname.endsWith('/workouts')) {
      const body = request.postDataJSON();
      const index = remoteWorkouts.findIndex(row => row.client_id === body.client_id);
      if (index < 0) return route.fulfill({ status: 409, headers, body: JSON.stringify({ message: 'missing synthetic workout' }) });
      remoteWorkouts[index] = { ...remoteWorkouts[index], ...body };
      writes.push(`${request.method()} ${url.pathname} v${body.version}`);
      const response = request.headers().accept?.includes('application/vnd.pgrst.object+json')
        ? remoteWorkouts[index] : [remoteWorkouts[index]];
      return route.fulfill({ status: 200, headers, body: JSON.stringify(response) });
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 500, headers, body: JSON.stringify({ message: 'Fast-forward must not write cloud data.' }) });
    }
    const table = url.pathname.split('/').pop();
    let rows = table === 'accounts' ? [{
      id: accountId, owner_user_id: authUserId, display_name: 'Sontai', created_at: baselineAt
    }] : table === 'profile_memberships' ? []
      : table === 'profiles' ? [{
        id: profileId, account_id: accountId, client_id: clientId, display_name: 'Sontai',
        pet_enabled: false, accent: 'cobalt', theme: 'performance-dark', created_at: baselineAt
      }]
        : table === 'preferences' ? [
          {
            id: 'remote-goals', account_id: accountId, profile_id: profileId, client_id: 'goals',
            idempotency_key: `remote-goals-v${goalVersion}`, version: goalVersion,
            payload: {
              contract: 'big-gains.shadow.v1', version: 1, profileClientId: clientId,
              entityType: 'goals', clientId: 'goals', data: { primary: remotePrimary }
            },
            created_at: baselineAt, updated_at: goalUpdatedAt
          },
          {
            id: 'remote-timer', account_id: accountId, profile_id: profileId, client_id: 'timer',
            idempotency_key: 'remote-timer-v1', version: 1,
            payload: {
              contract: 'big-gains.shadow.v1', version: 1, profileClientId: clientId,
              entityType: 'timerPreferences', clientId: 'timer', data: { sound: true, vibration: true }
            },
            created_at: baselineAt, updated_at: baselineAt
          },
          ...remotePreferences
        ] : table === 'workouts' ? remoteWorkouts
          : table === 'active_sessions' ? remoteActiveSessions
          : table === 'bodyweight_entries' ? remoteBodyweights
          : table === 'tombstones' ? remoteTombstones
            : [];
    const clientFilter = url.searchParams.get('client_id');
    const entityFilter = url.searchParams.get('entity_id');
    if (clientFilter?.startsWith('eq.')) rows = rows.filter(row => row.client_id === clientFilter.slice(3));
    if (entityFilter?.startsWith('eq.')) rows = rows.filter(row => row.entity_id === entityFilter.slice(3));
    if (request.headers().accept?.includes('application/vnd.pgrst.object+json')) rows = rows[0] || null;
    return route.fulfill({
      status: 200,
      headers: { ...headers, 'content-range': Array.isArray(rows) && rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' },
      body: request.method() === 'HEAD' ? '' : JSON.stringify(rows)
    });
  });
  return writes;
}

function workoutRow(workout, version, updatedAt) {
  return {
    id: `remote-${workout.id}`, account_id: accountId, profile_id: profileId, client_id: workout.id,
    idempotency_key: `${workout.id}-v${version}`, completed_at: workout.completedAt, version,
    payload: {
      contract: 'big-gains.shadow.v1', version: 1, profileClientId: clientId,
      entityType: 'completedWorkout', clientId: workout.id, data: workout
    },
    created_at: baselineAt, updated_at: updatedAt
  };
}

function tombstoneRow(workoutId, version = 2, updatedAt = advancedAt) {
  return {
    id: `tombstone-${workoutId}`, account_id: accountId, profile_id: profileId,
    entity_type: 'workouts', entity_id: workoutId, idempotency_key: `${workoutId}-delete-v${version}`,
    version, deleted_at: updatedAt, created_at: baselineAt, updated_at: updatedAt
  };
}

function exercisePreferenceRow(exerciseId) {
  return {
    id: `remote-pref-${exerciseId}`, account_id: accountId, profile_id: profileId,
    client_id: `exercise:${encodeURIComponent(exerciseId)}`, idempotency_key: `remote-pref-${exerciseId}-v1`, version: 1,
    payload: {
      contract: 'big-gains.shadow.v1', version: 1, profileClientId: clientId,
      entityType: 'exercisePreference', clientId: `exercise:${encodeURIComponent(exerciseId)}`,
      data: { exerciseId, preference: { note: 'Remote-only preference' } }
    },
    created_at: advancedAt, updated_at: advancedAt
  };
}

function bodyweightRow() {
  const identity = { measuredAt: '2026-08-11T12:00:00.000Z', weightValue: 188, unit: 'lb' };
  const canonical = JSON.stringify(identity, Object.keys(identity).sort());
  const identityHash = createHash('sha256').update(canonical).digest('hex');
  return {
    id: 'remote-bodyweight', account_id: accountId, profile_id: profileId,
    client_id: `bodyweight:${identityHash}:1`, idempotency_key: 'remote-bodyweight-v1',
    measured_at: identity.measuredAt, weight_value: identity.weightValue, unit: identity.unit, version: 1,
    created_at: advancedAt, updated_at: advancedAt
  };
}

function activeWorkout(id = 'active-cross-device') {
  return {
    id,
    type: 'Push',
    startedAt: '2026-08-11T19:30:00.000Z',
    focusedExerciseId: 'active-bench',
    exercises: [{
      id: 'active-bench', definitionId: 'barbell-bench-press', name: 'Barbell Bench Press',
      muscle: 'Chest', equipment: 'Barbell', collapsed: false,
      sets: [{ id: 'active-bench-set', weight: '', reps: '', warmup: false, completed: false }]
    }]
  };
}

function activeSessionRow(workout, restTimerEndsAt = null) {
  return {
    id: `remote-${workout.id}`,
    account_id: accountId,
    profile_id: profileId,
    client_id: workout.id,
    idempotency_key: `${workout.id}-v1`,
    version: 1,
    payload: {
      contract: 'big-gains.shadow.v1', version: 1, profileClientId: clientId,
      entityType: 'activeSession', clientId: workout.id, data: { workout, restTimerEndsAt }
    },
    created_at: baselineAt,
    updated_at: baselineAt
  };
}

function completedWorkout(id, reps, completedAt = '2026-08-10T18:30:00.000Z') {
  return {
    id, type: 'Pull', startedAt: '2026-08-10T17:45:00.000Z', completedAt, durationSeconds: 2700, prs: 1,
    exercises: [{
      id: `${id}-exercise`, definitionId: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable', collapsed: true,
      sets: [{ id: `${id}-set`, weight: 100, reps, warmup: false, completed: true }]
    }]
  };
}

async function expectAutomaticRemoteFastForward(page, expectedPrimary) {
  await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');
  await page.locator('.bottom-nav [data-view="library"]').click();
  await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');
  const result = await page.evaluate(({ storageKey, catalogKey, clientId }) => ({
    state: JSON.parse(localStorage.getItem(storageKey)),
    catalog: JSON.parse(localStorage.getItem(catalogKey)),
    queuePending: BigGainsCloudSync.queue.pending().length,
    comparison: BigGainsCloudSync.status().lastComparison,
    observability: BigGainsCloudSync.status().observability,
    goalKey: BigGainsCloudShadow.keyFor('preferences', 'goals'),
    clientId
  }), { storageKey, catalogKey, clientId });
  expect(result.state).toMatchObject({ version: 5, profileId: clientId, goals: { primary: expectedPrimary } });
  expect(result.catalog.profiles[result.clientId].records[result.goalKey]).toMatchObject({ version: 2, tombstone: false });
  expect(result.catalog.migrationId).toBe('cross-device-baseline');
  expect(result.queuePending).toBe(0);
  expect(result.comparison.parity).toBe(true);
  expect(result.observability.counters.automaticAdoptions).toBe(1);
}

for (const direction of [
  { label: 'PC to mobile', remotePrimary: 'PC remote advancement' },
  { label: 'mobile to PC', remotePrimary: 'Mobile remote advancement' }
]) {
  test(`${direction.label} automatically applies a guarded remote fast-forward`, async ({ page }) => {
    await installReceiver(page);
    const writes = await installAuthenticatedCloud(page, direction.remotePrimary);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expectAutomaticRemoteFastForward(page, direction.remotePrimary);
    expect(writes).toEqual([]);
  });
}

test('the rollout flag can keep guarded remote advancement manual on one device', async ({ page }) => {
  await installReceiver(page);
  const writes = await installAuthenticatedCloud(page, {
    remotePrimary: 'Manual rollout advancement',
    goalVersion: 2,
    automaticReconciliation: false
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.locator('.bottom-nav [data-view="library"]').click();
  await expect(page.locator('#cloudShadowHeading')).toHaveText('Changes from another device');
  await expect(page.locator('#cloudRemoteFastForward')).toBeVisible();
  expect(await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)).goals.primary, storageKey)).toBe('Shared baseline');
  const reloaded = page.waitForEvent('framenavigated');
  await page.locator('#cloudRemoteFastForward').click();
  await reloaded;
  await expect.poll(() => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)).goals.primary, storageKey)).toBe('Manual rollout advancement');
  expect(writes).toEqual([]);
});

test('a missing rollout flag defaults guarded remote advancement to manual', async ({ page }) => {
  await installReceiver(page);
  const writes = await installAuthenticatedCloud(page, {
    remotePrimary: 'Default-off remote advancement',
    goalVersion: 2,
    includeAutomaticReconciliation: false
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.locator('.bottom-nav [data-view="library"]').click();
  await expect(page.locator('#cloudShadowHeading')).toHaveText('Changes from another device');
  await expect(page.locator('#cloudRemoteFastForward')).toBeVisible();
  const result = await page.evaluate(storageKey => ({
    primary: JSON.parse(localStorage.getItem(storageKey)).goals.primary,
    automaticReconciliationEnabled: BigGainsCloudSync.status().automaticReconciliationEnabled
  }), storageKey);
  expect(result).toEqual({ primary: 'Shared baseline', automaticReconciliationEnabled: false });
  expect(writes).toEqual([]);
});

test('startup rolls an interrupted automatic adoption back to the complete pre-adoption document set', async ({ page }) => {
  await installReceiver(page);
  const interrupted = await page.evaluate(({ storageKey, catalogKey }) => {
    const adoptionKey = BigGainsManagedProfileRecovery.adoptionKey;
    const comparisonKey = BigGainsCloudSync.comparisonKey;
    const queueKey = BigGainsCloudSync.queue.key;
    const stateBefore = localStorage.getItem(storageKey);
    const catalogBefore = localStorage.getItem(catalogKey);
    const comparisonBefore = localStorage.getItem(comparisonKey);
    const queueBefore = localStorage.getItem(queueKey);
    const candidateState = { ...JSON.parse(stateBefore), goals: { primary: 'Interrupted candidate' } };
    const candidateCatalog = { ...JSON.parse(catalogBefore), adoptedAt: '2026-08-11T20:06:00.000Z' };
    const snapshots = [
      { key: storageKey, before: stateBefore, candidate: JSON.stringify(candidateState) },
      { key: catalogKey, before: catalogBefore, candidate: JSON.stringify(candidateCatalog) },
      { key: comparisonKey, before: comparisonBefore, candidate: JSON.stringify({ parity: true }) },
      { key: queueKey, before: queueBefore, candidate: null }
    ];
    localStorage.setItem(adoptionKey, JSON.stringify({
      format: 'big-gains.automatic-adoption.v1', version: 1,
      createdAt: '2026-08-11T20:06:00.000Z', snapshots
    }));
    localStorage.setItem(storageKey, JSON.stringify(candidateState));
    localStorage.setItem(catalogKey, JSON.stringify(candidateCatalog));
    localStorage.setItem(comparisonKey, JSON.stringify({ parity: true }));
    return { adoptionKey, catalogBefore, queueBefore };
  }, { storageKey, catalogKey });

  await page.reload({ waitUntil: 'domcontentloaded' });
  const restored = await page.evaluate(({ storageKey, catalogKey, adoptionKey }) => ({
    state: JSON.parse(localStorage.getItem(storageKey)),
    catalog: localStorage.getItem(catalogKey),
    journal: localStorage.getItem(adoptionKey),
    recovery: BigGainsManagedProfileRecovery.adoptionRecoveryStatus()
  }), { storageKey, catalogKey, adoptionKey: interrupted.adoptionKey });
  expect(restored.state.goals.primary).toBe('Shared baseline');
  expect(restored.catalog).toBe(interrupted.catalogBefore);
  expect(restored.journal).toBeNull();
  expect(restored.recovery).toEqual({ ok: true, recovered: true });
});

test('an active workout defers automatic adoption without changing local history, session, queue, or cloud', async ({ page }) => {
  const workout = activeWorkout();
  await installReceiver(page, profileState('Shared baseline', { activeWorkout: workout }));
  const writes = await installAuthenticatedCloud(page, {
    remotePrimary: 'Waiting remote advancement',
    goalVersion: 2,
    remoteActiveSessions: [activeSessionRow(workout)]
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cloudShadowHeading')).toHaveText('Updates waiting until the workout ends');
  const result = await page.evaluate(storageKey => ({
    state: JSON.parse(localStorage.getItem(storageKey)),
    pending: BigGainsCloudSync.queue.pending().length,
    fastForward: BigGainsCloudSync.status().remoteFastForward,
    lastResult: BigGainsCloudSync.status().lastResult,
    observability: BigGainsCloudSync.status().observability
  }), storageKey);
  expect(result.state.goals.primary).toBe('Shared baseline');
  expect(result.state.activeWorkout.id).toBe(workout.id);
  expect(result.pending).toBe(0);
  expect(result.fastForward).toMatchObject({
    eligible: false,
    conflict: false,
    deferred: true,
    reason: 'active-workout-in-progress',
    advancedRevisions: 1
  });
  expect(result.lastResult).toMatchObject({ ok: false, deferred: true, reason: 'active-workout-in-progress' });
  expect(result.observability.counters).toMatchObject({ automaticAdoptions: 0, activeWorkoutDeferrals: 1 });
  expect(writes).toEqual([]);
});

test('a stale stored rest deadline rejects that adoption generation while canonical timer lifecycle clears the deadline', async ({ page }) => {
  const workout = activeWorkout('active-with-stale-timer');
  const staleDeadline = Date.parse('2026-08-11T19:31:00.000Z');
  await installReceiver(page, profileState('Shared baseline', { activeWorkout: workout, restTimerEndsAt: staleDeadline }));
  const writes = await installAuthenticatedCloud(page, {
    remotePrimary: 'Blocked by stale timer',
    goalVersion: 2,
    remoteActiveSessions: [activeSessionRow(workout, staleDeadline)]
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cloudShadowHeading')).toHaveText('Retry needed');
  const result = await page.evaluate(storageKey => ({
    state: JSON.parse(localStorage.getItem(storageKey)),
    fastForward: BigGainsCloudSync.status().remoteFastForward,
    observability: BigGainsCloudSync.status().observability
  }), storageKey);
  expect(result.state.goals.primary).toBe('Shared baseline');
  expect(result.state.activeWorkout.id).toBe(workout.id);
  expect(result.state.restTimerEndsAt).toBeNull();
  expect(result.fastForward).toMatchObject({ eligible: false });
  expect(result.observability.counters.verificationRejections).toBe(1);
  expect(writes).toEqual([]);
});

test('concurrent local edit remains a real conflict and never overwrites local state', async ({ page }) => {
  await installReceiver(page);
  await page.evaluate(() => {
    state.goals.primary = 'Local concurrent edit';
    statePersistenceApi.save(state, state.activeWorkout);
  });
  const writes = await installAuthenticatedCloud(page, 'Remote concurrent edit');
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cloudShadowHeading')).toHaveText('SYNC CONFLICT');
  await expect(page.locator('#cloudAuthDetail')).toContainText('both changed');
  await expect(page.locator('#cloudRemoteFastForward')).toBeHidden();
  const result = await page.evaluate(storageKey => ({
    primary: JSON.parse(localStorage.getItem(storageKey)).goals.primary,
    pending: BigGainsCloudSync.queue.pending().length,
    fastForward: BigGainsCloudSync.status().remoteFastForward
  }), storageKey);
  expect(result.primary).toBe('Local concurrent edit');
  expect(result.pending).toBe(0);
  expect(result.fastForward).toMatchObject({ eligible: false, conflict: true, reason: 'concurrent-local-edit' });
  expect(writes).toEqual([]);
});

test('a higher completed-workout revision fast-forwards onto the second device without duplicating or rewriting other history', async ({ page }) => {
  const baseline = completedWorkout('shared-workout', 120);
  const corrected = completedWorkout('shared-workout', 12);
  const unrelated = completedWorkout('unrelated-workout', 8, '2026-08-09T18:30:00.000Z');
  unrelated.startedAt = '2026-08-09T17:45:00.000Z';
  await installReceiver(page, profileState('Shared baseline', { workouts: [baseline, unrelated] }));
  const writes = await installAuthenticatedCloud(page, {
    remoteWorkouts: [workoutRow(corrected, 2, advancedAt), workoutRow(unrelated, 1, baselineAt)]
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');
  await page.locator('.bottom-nav [data-view="library"]').click();
  await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');

  const result = await page.evaluate(({ storageKey, catalogKey, clientId, workoutId }) => {
    const state = JSON.parse(localStorage.getItem(storageKey));
    const catalog = JSON.parse(localStorage.getItem(catalogKey));
    return {
      workouts: state.workouts,
      record: catalog.profiles[clientId].records[BigGainsCloudShadow.keyFor('workouts', workoutId)],
      pending: BigGainsCloudSync.queue.pending().length
    };
  }, { storageKey, catalogKey, clientId, workoutId: baseline.id });
  expect(result.workouts).toHaveLength(2);
  expect(result.workouts.find(workout => workout.id === baseline.id)).toEqual(corrected);
  expect(result.workouts.find(workout => workout.id === unrelated.id)).toEqual(unrelated);
  expect(result.record).toMatchObject({ version: 2, tombstone: false, data: corrected });
  expect(result.pending).toBe(0);
  expect(writes).toEqual([]);
});

test('a higher workout tombstone fast-forwards onto the second device and cannot resurrect after adoption', async ({ page }) => {
  const deleted = completedWorkout('deleted-workout', 10);
  const retained = completedWorkout('retained-workout', 8, '2026-08-09T18:30:00.000Z');
  retained.startedAt = '2026-08-09T17:45:00.000Z';
  await installReceiver(page, profileState('Shared baseline', { workouts: [deleted, retained] }));
  const writes = await installAuthenticatedCloud(page, {
    remoteWorkouts: [workoutRow(deleted, 1, baselineAt), workoutRow(retained, 1, baselineAt)],
    remoteTombstones: [tombstoneRow(deleted.id)]
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');
  await page.locator('.bottom-nav [data-view="library"]').click();
  await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');

  const result = await page.evaluate(({ storageKey, catalogKey, clientId, workoutId }) => {
    const state = JSON.parse(localStorage.getItem(storageKey));
    const catalog = JSON.parse(localStorage.getItem(catalogKey));
    return {
      workouts: state.workouts,
      record: catalog.profiles[clientId].records[BigGainsCloudShadow.keyFor('workouts', workoutId)],
      pending: BigGainsCloudSync.queue.pending().length,
      comparison: BigGainsCloudSync.status().lastComparison
    };
  }, { storageKey, catalogKey, clientId, workoutId: deleted.id });
  expect(result.workouts).toEqual([retained]);
  expect(result.record).toMatchObject({ version: 2, tombstone: true, data: null });
  expect(result.pending).toBe(0);
  expect(result.comparison.parity).toBe(true);
  expect(writes).toEqual([]);
});

test('a stale local workout correction remains blocked when the same workout advanced remotely', async ({ page }) => {
  const baseline = completedWorkout('conflicting-workout', 8);
  const remote = completedWorkout('conflicting-workout', 10);
  await installReceiver(page, profileState('Shared baseline', { workouts: [baseline] }));
  await page.evaluate(() => {
    state.workouts[0].exercises[0].sets[0].reps = 9;
    statePersistenceApi.save(state, state.activeWorkout);
  });
  const writes = await installAuthenticatedCloud(page, {
    remoteWorkouts: [workoutRow(remote, 2, advancedAt)]
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cloudShadowHeading')).toHaveText('SYNC CONFLICT');
  await expect(page.locator('#cloudRemoteFastForward')).toBeHidden();
  const result = await page.evaluate(storageKey => ({
    reps: JSON.parse(localStorage.getItem(storageKey)).workouts[0].exercises[0].sets[0].reps,
    fastForward: BigGainsCloudSync.status().remoteFastForward,
    pending: BigGainsCloudSync.queue.pending().length
  }), storageKey);
  expect(result.reps).toBe(9);
  expect(result.fastForward).toMatchObject({ eligible: false, conflict: true, reason: 'concurrent-local-edit', advancedRevisions: 1 });
  expect(result.pending).toBe(0);
  expect(writes).toEqual([]);
});

test('equal revision with a different fingerprint remains drift and cannot fast-forward', async ({ page }) => {
  await installReceiver(page);
  const writes = await installAuthenticatedCloud(page, {
    remotePrimary: 'Equal-version tamper',
    goalVersion: 1,
    goalUpdatedAt: baselineAt
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cloudShadowHeading')).toHaveText('Retry needed');
  await expect(page.locator('#cloudRemoteFastForward')).toBeHidden();
  const result = await page.evaluate(storageKey => ({
    primary: JSON.parse(localStorage.getItem(storageKey)).goals.primary,
    pending: BigGainsCloudSync.queue.pending().length,
    fastForward: BigGainsCloudSync.status().remoteFastForward
  }), storageKey);
  expect(result.primary).toBe('Shared baseline');
  expect(result.pending).toBe(0);
  expect(result.fastForward).toMatchObject({
    eligible: false,
    conflict: false,
    reason: 'remote-revision-not-monotonic',
    advancedRevisions: 0
  });
  expect(result.fastForward.reasons.join(' ')).toContain('changed identity without advancing revision 1');
  expect(writes).toEqual([]);
});

for (const choice of [
  { label: 'Keep Cloud', button: '#cloudKeepCloud', expectedReps: 11, expectedVersion: 3, writes: [] },
  { label: 'Keep This Device', button: '#cloudKeepDevice', expectedReps: 9, expectedVersion: 4, writes: ['PATCH /rest/v1/workouts v4'] }
]) {
  test(`${choice.label} resolves one stale workout while preserving unrelated remote advancement`, async ({ page }) => {
    const baseline = completedWorkout('7c016750-9636-4379-b224-06438df363ab', 8);
    const localEdit = completedWorkout(baseline.id, 9);
    const remoteEdit = completedWorkout(baseline.id, 11);
    const unrelated = completedWorkout('remote-only-workout', 7, '2026-08-11T19:00:00.000Z');
    await installReceiver(page, profileState('Shared baseline', { workouts: [baseline] }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.evaluate(async localEdit => {
      state.workouts = [localEdit];
      statePersistenceApi.save(state, state.activeWorkout);
      await BigGainsCloudSync.captureLocalSnapshot(state.profileId);
    }, localEdit);
    expect(await page.evaluate(() => BigGainsCloudSync.queue.pending()[0])).toMatchObject({
      entityType: 'workouts', entityId: baseline.id, mutation: 'upsert', version: 2,
      baseRevision: { version: 1 }
    });

    const writes = await installAuthenticatedCloud(page, {
      remoteWorkouts: [workoutRow(remoteEdit, 3, advancedAt), workoutRow(unrelated, 1, advancedAt)],
      remotePreferences: [exercisePreferenceRow('lat-pulldown')],
      remoteBodyweights: [bodyweightRow()],
      allowWrites: choice.expectedVersion === 4
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.bottom-nav [data-view="library"]').click();

    await expect(page.locator('#cloudShadowHeading')).toHaveText('SYNC CONFLICT');
    await expect(page.locator('#cloudConflictTitle')).toContainText('Pull');
    await expect(page.locator('#cloudConflictSummary')).toContainText('changed here and on another device');
    await expect(page.locator('#cloudConflictSummary')).toContainText('3 unrelated cloud changes will also be preserved');
    await expect(page.locator('#cloudConflictLocalSummary')).toContainText('Revision 2 · 1 exercise · 1 working set');
    await expect(page.locator('#cloudConflictRemoteSummary')).toContainText('Revision 3 · 1 exercise · 1 working set');
    await expect(page.locator('#cloudConflictTechnical')).toBeHidden();
    const before = await page.evaluate(storageKey => ({
      state: JSON.parse(localStorage.getItem(storageKey)),
      pending: BigGainsCloudSync.queue.pending(),
      conflict: BigGainsCloudSync.status().sameEntityConflict
    }), storageKey);
    expect(before.state.workouts[0]).toEqual(localEdit);
    expect(before.pending).toHaveLength(1);
    expect(before.conflict).toMatchObject({
      eligible: true, reason: 'same-entity-conflict', entityId: baseline.id,
      localRevision: 2, remoteRevision: 3, unrelatedAdvancements: 3
    });

    const reloaded = page.waitForEvent('framenavigated');
    await page.locator(choice.button).click();
    await reloaded;
    await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');
    const after = await page.evaluate(({ storageKey, catalogKey, clientId, workoutId }) => {
      const state = JSON.parse(localStorage.getItem(storageKey));
      const catalog = JSON.parse(localStorage.getItem(catalogKey));
      return {
        state,
        pending: BigGainsCloudSync.queue.pending(),
        comparison: BigGainsCloudSync.status().lastComparison,
        workoutRevision: catalog.profiles[clientId].records[BigGainsCloudShadow.keyFor('workouts', workoutId)].version
      };
    }, { storageKey, catalogKey, clientId, workoutId: baseline.id });
    expect(after.state.workouts.find(workout => workout.id === baseline.id).exercises[0].sets[0].reps).toBe(choice.expectedReps);
    expect(after.state.workouts.find(workout => workout.id === unrelated.id)).toEqual(unrelated);
    expect(after.state.weights).toEqual([{ date: '2026-08-11T12:00:00.000Z', weight: 188 }]);
    expect(after.state.exercisePreferences['lat-pulldown']).toEqual({ note: 'Remote-only preference' });
    expect(after.workoutRevision).toBe(choice.expectedVersion);
    expect(after.pending).toHaveLength(0);
    expect(after.comparison.parity).toBe(true);
    expect(writes).toEqual(choice.writes);
  });
}
