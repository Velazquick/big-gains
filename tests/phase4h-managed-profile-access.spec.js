import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const authUserId = '92000000-0000-0000-0000-000000000002';
const ownerUserId = '91000000-0000-0000-0000-000000000001';
const accountId = '91a00000-0000-0000-0000-000000000001';
const alexaProfileId = '91b00000-0000-0000-0000-000000000002';
const now = '2026-08-08T12:00:00.000Z';
const namespace = `managed-member-${authUserId}-${accountId}-${alexaProfileId}`;
const storageKey = `big-gains-${namespace}-v1`;
const queueKey = `big-gains-cloud-sync-queue-v1-${namespace}`;
const catalogKey = `big-gains-cloud-shadow-catalog-v1-${namespace}`;
const comparisonKey = `big-gains-cloud-shadow-comparison-v1-${namespace}`;
const recoveryKey = `big-gains-managed-recovery-v1-${namespace}`;

const account = { id: accountId, owner_user_id: ownerUserId, display_name: 'Managed account', created_at: now };
const alexaProfile = {
  id: alexaProfileId,
  account_id: accountId,
  client_id: 'alexa',
  display_name: 'Alexa',
  pet_enabled: true,
  accent: 'rose',
  theme: 'wellness-light',
  created_at: now
};
const membership = {
  user_id: authUserId,
  account_id: accountId,
  profile_id: alexaProfileId,
  access_kind: 'managed-member',
  created_at: now
};

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function routineClientId(name) {
  return `routine:${createHash('sha256').update(canonicalize({ name })).digest('hex')}`;
}

function bodyweightClientId(measuredAt, weightValue) {
  const identityHash = createHash('sha256').update(canonicalize({ measuredAt, weightValue, unit: 'lb' })).digest('hex');
  return `bodyweight:${identityHash}:1`;
}

function envelope(entityType, clientId, data) {
  return { contract: 'big-gains.shadow.v1', version: 1, profileClientId: 'alexa', entityType, clientId, data };
}

function cloudFixture() {
  const completedWorkout = {
    id: 'alexa-completed',
    type: 'PilatesPull',
    startedAt: '2026-08-07T14:00:00.000Z',
    completedAt: '2026-08-07T15:00:00.000Z',
    durationSeconds: 3600,
    prs: 1,
    exercises: [{
      id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable', collapsed: true,
      sets: [{ id: 'set-1', weight: 120, reps: 10, warmup: false, completed: true }]
    }]
  };
  const deletedWorkout = {
    id: 'alexa-deleted-workout', type: 'FullBody', startedAt: '2026-08-01T14:00:00.000Z',
    completedAt: '2026-08-01T15:00:00.000Z', durationSeconds: 3600, prs: 0, exercises: []
  };
  const activeWorkout = {
    id: 'alexa-active', type: 'PilatesPull', startedAt: '2026-08-08T11:30:00.000Z',
    exercises: [{
      id: 'seated-row', name: 'Seated Row', muscle: 'Back', equipment: 'Cable', collapsed: false,
      sets: [{ id: 'active-set', weight: '', reps: '', warmup: false, completed: false }]
    }]
  };
  const routineName = 'PilatesPull';
  const records = {
    workouts: [
      row('workouts', completedWorkout.id, envelope('completedWorkout', completedWorkout.id, completedWorkout), { completed_at: completedWorkout.completedAt }),
      row('workouts', deletedWorkout.id, envelope('completedWorkout', deletedWorkout.id, deletedWorkout), { completed_at: deletedWorkout.completedAt })
    ],
    routines: [row('routines', routineClientId(routineName), envelope('customRoutine', routineClientId(routineName), {
      name: routineName, exerciseIds: ['lat-pulldown', 'seated-row']
    }))],
    bodyweight_entries: [{
      id: 'remote-bodyweight', account_id: accountId, profile_id: alexaProfileId,
      client_id: bodyweightClientId('2026-08-06T12:00:00.000Z', 181.5), idempotency_key: 'bodyweight-key',
      measured_at: '2026-08-06T12:00:00.000Z', weight_value: 181.5, unit: 'lb', version: 1,
      created_at: now, updated_at: now
    }],
    preferences: [
      row('preferences', 'goals', envelope('goals', 'goals', {
        primary: 'Weight loss', secondary: ['Glute and leg growth', 'Back growth'], startingWeight: 225, targetDate: '2026-12-20'
      })),
      row('preferences', 'timer', envelope('timerPreferences', 'timer', { sound: false, vibration: true })),
      row('preferences', 'exercise:lat-pulldown', envelope('exercisePreference', 'exercise:lat-pulldown', {
        exerciseId: 'lat-pulldown', preference: { cue: 'Drive elbows down', restSeconds: 90 }
      }))
    ],
    active_sessions: [row('active_sessions', activeWorkout.id, envelope('activeSession', activeWorkout.id, {
      workout: activeWorkout, restTimerEndsAt: Date.parse('2036-08-08T12:02:00.000Z')
    }))]
  };
  const tombstones = [{
    id: 'remote-tombstone', account_id: accountId, profile_id: alexaProfileId,
    entity_type: 'workouts', entity_id: deletedWorkout.id, idempotency_key: 'delete-key',
    version: 2, deleted_at: '2026-08-08T10:00:00.000Z', created_at: now, updated_at: '2026-08-08T10:00:00.000Z'
  }];
  return { records, tombstones, completedWorkout, activeWorkout };

  function row(table, clientId, payload, extra = {}) {
    return {
      id: `remote-${table}-${clientId}`, account_id: accountId, profile_id: alexaProfileId,
      client_id: clientId, idempotency_key: `key-${table}-${clientId}`, payload, version: 1,
      created_at: now, updated_at: now, ...extra
    };
  }
}

async function installSession(page, { runtime = false, localState = null } = {}) {
  await page.addInitScript(({ authUserId, accountId, alexaProfileId, now, runtime, localState, storageKey }) => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = {
      supabaseUrl: 'https://synthetic-phase4h.supabase.co',
      supabasePublishableKey: 'sb_publishable_phase4h',
      authRedirectUrl: 'https://velazquick.github.io/big-gains/'
    };
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('big-gains-supabase-auth-v1', JSON.stringify({
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: authUserId, role: 'authenticated', exp: expiresAt })}.synthetic`,
      refresh_token: 'synthetic-phase4h-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
      user: { id: authUserId, aud: 'authenticated', role: 'authenticated', email: 'alexa-phase4h@example.test',
        email_confirmed_at: now, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: now }
    }));
    if (runtime) {
      localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
        version: 1,
        activeAuthUserId: authUserId,
        accounts: {
          [authUserId]: {
            kind: 'managed-member', accessKind: 'managed-member', authUserId, cloudAccountId: accountId,
            cloudProfileId: alexaProfileId, clientId: 'alexa', displayName: 'Alexa',
            presentation: { petEnabled: true, accent: 'rose', theme: 'wellness-light' }
          }
        }
      }));
    }
    if (localState !== null) localStorage.setItem(storageKey, JSON.stringify(localState));
  }, { authUserId, accountId, alexaProfileId, now, runtime, localState, storageKey });
}

async function installCloudRoutes(page, { membershipRow = membership, slowRecovery = false, activeSessionDeleted = false } = {}) {
  const fixture = cloudFixture();
  if (activeSessionDeleted) {
    fixture.records.active_sessions[0].version = 2;
    fixture.records.active_sessions[0].updated_at = '2026-08-09T01:52:00.000Z';
    fixture.tombstones.push({
      id: 'remote-active-session-tombstone', account_id: accountId, profile_id: alexaProfileId,
      entity_type: 'active_sessions', entity_id: fixture.activeWorkout.id, idempotency_key: 'active-delete-key',
      version: 3, deleted_at: '2026-08-09T01:53:06.086Z', created_at: now, updated_at: '2026-08-09T01:53:06.086Z'
    });
  }
  const applicationWrites = [];
  let delayed = false;
  await page.route('https://synthetic-phase4h.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers, body: '' });
    if (url.pathname.endsWith('/auth/v1/user')) {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({
        id: authUserId, aud: 'authenticated', role: 'authenticated', email: 'alexa-phase4h@example.test',
        email_confirmed_at: now, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: now
      }) });
    }
    const table = url.pathname.split('/').pop();
    if (!['GET', 'HEAD'].includes(request.method())) {
      applicationWrites.push(`${request.method()} ${table}`);
      return route.fulfill({ status: 500, headers, body: JSON.stringify({ message: 'unexpected write in recovery fixture' }) });
    }
    let data = [];
    if (table === 'accounts') {
      data = url.searchParams.has('owner_user_id') ? [] : [account];
    } else if (table === 'profile_memberships') {
      data = membershipRow ? [membershipRow] : [];
    } else if (table === 'profiles') {
      data = membershipRow?.profile_id === alexaProfileId ? [alexaProfile] : [];
    } else if (table === 'tombstones') {
      data = fixture.tombstones;
    } else if (table === 'sync_metadata') {
      data = [];
    } else if (fixture.records[table]) {
      if (slowRecovery && !delayed) {
        delayed = true;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      data = fixture.records[table];
    }
    return route.fulfill({
      status: 200,
      headers: { ...headers, 'content-range': data.length ? `0-${data.length - 1}/${data.length}` : '*/0' },
      body: request.method() === 'HEAD' ? '' : JSON.stringify(data)
    });
  });
  return { fixture, applicationWrites };
}

test('stale independent onboarding cannot bootstrap after managed membership resolves', async ({ page }) => {
  await installSession(page, { runtime: true });
  await page.addInitScript(({ authUserId, accountId, alexaProfileId, storageKey, recoveryKey }) => {
    localStorage.setItem(storageKey, JSON.stringify({ version: 5, profileId: 'alexa' }));
    localStorage.setItem(recoveryKey, JSON.stringify({
      format: 'big-gains.managed-profile-recovery.v1', version: 1,
      authUserId, accountId, profileId: alexaProfileId,
      profileClientId: 'alexa', storageKey
    }));
  }, { authUserId, accountId, alexaProfileId, storageKey, recoveryKey });
  const cloud = await installCloudRoutes(page);
  await openApp(page);

  const result = await page.evaluate(async () => {
    try {
      await BigGainsSupabase.bootstrapIndependentAccount('Alexa');
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error.code, message: error.message, accessKind: error.accountState?.accessKind };
    }
  });

  expect(result).toMatchObject({
    ok: false,
    code: 'managed-member',
    accessKind: 'managed-member'
  });
  expect(result.message).toContain('Managed profile access is already active');
  expect(cloud.applicationWrites).toEqual([]);
});

test('fresh managed member restores exact Alexa schema v5, adopts a zero-queue baseline, and remains local-first offline', async ({ page, context }) => {
  await installSession(page);
  const cloud = await installCloudRoutes(page, { slowRecovery: true });
  await openApp(page);

  await expect(page.locator('#independentAccountOnboarding')).toContainText('Restoring your profile to this device');
  await expect(page.locator('html')).toHaveAttribute('data-account-mode', 'managed-member');
  await expect(page.locator('#independentAccountOnboarding')).toBeHidden();
  await expect(page.locator('.profile-switcher')).toBeHidden();
  await expect(page.locator('#profileSelect option')).toHaveCount(1);
  await expect(page.locator('#profileSelect option')).toHaveText('Alexa');
  await expect(page.locator('html')).toHaveAttribute('data-profile', 'alexa');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'rose');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'wellness-light');
  await expect(page.locator('html')).toHaveAttribute('data-pet-enabled', 'true');
  await expect(page.locator('#greeting')).toContainText('Alexa');

  const restored = await page.evaluate(({ storageKey, queueKey, catalogKey, comparisonKey, recoveryKey }) => ({
    state: JSON.parse(localStorage.getItem(storageKey)),
    queue: localStorage.getItem(queueKey),
    pending: BigGainsCloudSync.queue.pending().length,
    catalog: JSON.parse(localStorage.getItem(catalogKey)),
    comparison: JSON.parse(localStorage.getItem(comparisonKey)),
    marker: JSON.parse(localStorage.getItem(recoveryKey)),
    managedJorge: localStorage.getItem('big-gains-v2'),
    managedAlexa: localStorage.getItem('big-gains-alexa-v1')
  }), { storageKey, queueKey, catalogKey, comparisonKey, recoveryKey });
  expect(restored.state).toMatchObject({
    version: 5,
    profileId: 'alexa',
    goals: { primary: 'Weight loss' },
    workouts: [{ id: 'alexa-completed' }],
    weights: [{ date: '2026-08-06T12:00:00.000Z', weight: 181.5 }],
    customRoutines: { PilatesPull: ['lat-pulldown', 'seated-row'] },
    timerPreferences: { sound: false, vibration: true },
    exercisePreferences: { 'lat-pulldown': { cue: 'Drive elbows down', restSeconds: 90 } },
    activeWorkout: { id: 'alexa-active' },
    restTimerEndsAt: Date.parse('2036-08-08T12:02:00.000Z'),
    prs: { 'lat-pulldown': { estimated1RM: 160, weight: 120, reps: 10, date: '2026-08-07T15:00:00.000Z' } }
  });
  expect(restored.state.workouts.map(workout => workout.id)).toEqual(['alexa-completed']);
  expect(restored.pending).toBe(0);
  expect(restored.queue).toBeNull();
  expect(restored.catalog).toMatchObject({
    accountId,
    authUserId,
    migrationId: 'managed-member-fresh-recovery',
    profiles: { alexa: { profileId: alexaProfileId } }
  });
  expect(restored.comparison.parity).toBe(true);
  expect(restored.marker).toMatchObject({
    format: 'big-gains.managed-profile-recovery.v1', authUserId, accountId,
    profileId: alexaProfileId, profileClientId: 'alexa', storageKey
  });
  expect(restored.managedJorge).toBeNull();
  expect(restored.managedAlexa).toBeNull();
  expect(cloud.applicationWrites).toEqual([]);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#independentAccountOnboarding')).toBeHidden();
  await expect(page.locator('#greeting')).toContainText('Alexa');
  expect(await page.evaluate(storageKeyValue => JSON.parse(localStorage.getItem(storageKeyValue)).workouts[0].id, storageKey)).toBe('alexa-completed');

  await page.evaluate(() => {
    state.activeWorkout.exercises[0].sets[0].weight = 95;
    saveState();
  });
  await expect.poll(() => page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBeGreaterThan(0);
  const pending = await page.evaluate(() => BigGainsCloudSync.queue.pending());
  expect(pending.map(operation => `${operation.entityType}/${operation.entityId}`)).toEqual(['active_sessions/alexa-active']);
  const queued = pending[0];
  expect(queued).toMatchObject({
    owner: { accountId, profileId: alexaProfileId },
    entityType: 'active_sessions', entityId: 'alexa-active', mutation: 'upsert', version: 2
  });
  const synced = await page.evaluate(async () => BigGainsCloudSync.createSyncRuntime({
    durableQueue: BigGainsCloudSync.queue,
    transport: { enabled: true, async send(operation) { return { ok: true, remoteVersion: operation.version }; } },
    isOnline: () => true
  }).flush());
  expect(synced).toMatchObject({ ok: true, sent: 1, pending: 0 });
  expect(await page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(0);
});

test('a non-empty managed-member namespace is never overwritten or merged', async ({ page }) => {
  const localSentinel = {
    version: 5, profileId: 'alexa', goals: { primary: 'Local sentinel must survive' }, workouts: [], weights: [], prs: {},
    activeWorkout: null, restTimerEndsAt: null, customRoutines: {}, timerPreferences: { sound: true, vibration: true }
  };
  await installSession(page, { runtime: true, localState: localSentinel });
  const cloud = await installCloudRoutes(page);
  await openApp(page);

  await expect(page.locator('#independentAccountOnboarding')).toBeVisible();
  await expect(page.locator('#independentAccountOnboarding')).toContainText('Recovery stopped safely');
  await expect(page.locator('#independentAccountOnboarding')).toContainText('will not overwrite or merge');
  await expect(page.locator('#independentAccountOnboarding')).not.toContainText('clearing localStorage');
  const result = await page.evaluate(({ storageKey, catalogKey, recoveryKey }) => ({
    state: JSON.parse(localStorage.getItem(storageKey)),
    catalog: localStorage.getItem(catalogKey),
    marker: localStorage.getItem(recoveryKey),
    pending: BigGainsCloudSync.queue.pending().length
  }), { storageKey, catalogKey, recoveryKey });
  expect(result.state.goals.primary).toBe('Local sentinel must survive');
  expect(result.state.workouts).toEqual([]);
  expect(result.state.weights).toEqual([]);
  expect(result.state.activeWorkout).toBeNull();
  expect(result.catalog).toBeNull();
  expect(result.marker).toBeNull();
  expect(result.pending).toBe(0);
  expect(cloud.applicationWrites).toEqual([]);
});

test('managed-member active session upsert then delete adopts the higher tombstone winner and returns to in sync', async ({ page, context }) => {
  await installSession(page);
  const cloud = await installCloudRoutes(page);
  await openApp(page);
  await expect(page.locator('#independentAccountOnboarding')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-account-mode', 'managed-member');
  await expect(page.locator('#activeExercises input[data-field="weight"]').first()).toBeVisible();
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#activeExercises input[data-field="weight"]').first()).toBeVisible();
  expect(await page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey))?.activeWorkout?.id || null, storageKey)).toBe('alexa-active');

  await context.setOffline(true);
  await page.locator('#activeExercises input[data-field="weight"]').first().fill('95');
  await expect.poll(() => page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(1);
  await page.evaluate(() => workoutSessionController.discard());
  await expect.poll(() => page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(2);

  const captured = await page.evaluate(({ catalogKey }) => {
    const pending = BigGainsCloudSync.queue.pending();
    const catalog = JSON.parse(localStorage.getItem(catalogKey));
    return {
      operations: pending.map(operation => ({ mutation: operation.mutation, version: operation.version, entityType: operation.entityType, entityId: operation.entityId })),
      winner: catalog.profiles.alexa.records[`active_sessions\u0000alexa-active`],
      bodyweightCount: Object.values(catalog.profiles.alexa.records).filter(record => record.table === 'bodyweight_entries' && !record.tombstone).length,
      preferenceCount: Object.values(catalog.profiles.alexa.records).filter(record => record.table === 'preferences' && !record.tombstone).length
    };
  }, { catalogKey });
  expect(captured.operations).toEqual([
    { mutation: 'upsert', version: 2, entityType: 'active_sessions', entityId: 'alexa-active' },
    { mutation: 'delete', version: 3, entityType: 'active_sessions', entityId: 'alexa-active' }
  ]);
  expect(captured.winner).toMatchObject({ version: 3, tombstone: true, data: null });
  expect(captured.bodyweightCount).toBe(1);
  expect(captured.preferenceCount).toBe(3);

  const acknowledged = await page.evaluate(async () => BigGainsCloudSync.createSyncRuntime({
    durableQueue: BigGainsCloudSync.queue,
    transport: { enabled: true, async send(operation) { return { ok: true, remoteVersion: operation.version }; } },
    isOnline: () => true
  }).flush());
  expect(acknowledged).toMatchObject({ ok: true, sent: 2, pending: 0 });
  await page.evaluate(({ catalogKey }) => {
    const catalog = JSON.parse(localStorage.getItem(catalogKey));
    const key = `active_sessions\u0000alexa-active`;
    catalog.profiles.alexa.records[key] = {
      ...catalog.profiles.alexa.records[key], version: 2, updatedAt: '2026-08-09T01:52:00.000Z',
      tombstone: false, data: { workout: { id: 'alexa-active' }, restTimerEndsAt: null }
    };
    localStorage.setItem(catalogKey, JSON.stringify(catalog));
  }, { catalogKey });

  await context.setOffline(false);
  await page.unrouteAll({ behavior: 'wait' });
  const deletedCloud = await installCloudRoutes(page, { activeSessionDeleted: true });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');
  await expect.poll(() => page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(0);

  const healed = await page.evaluate(({ catalogKey }) => {
    const catalog = JSON.parse(localStorage.getItem(catalogKey));
    return {
      winner: catalog.profiles.alexa.records[`active_sessions\u0000alexa-active`],
      comparison: BigGainsCloudSync.status().lastComparison
    };
  }, { catalogKey });
  expect(healed.winner).toMatchObject({ version: 3, tombstone: true, data: null });
  expect(healed.comparison.parity).toBe(true);
  expect(healed.comparison.profiles.alexa.entities.active_sessions).toMatchObject({ parity: true, localCount: 0, cloudCount: 0 });
  expect(deletedCloud.applicationWrites).toEqual([]);
  expect(cloud.applicationWrites).toEqual([]);
});

test('mismatched membership/profile ownership blocks before runtime activation or independent onboarding', async ({ page }) => {
  await installSession(page);
  const mismatched = { ...membership, profile_id: '91b00000-0000-0000-0000-000000000099' };
  const cloud = await installCloudRoutes(page, { membershipRow: mismatched });
  await openApp(page);

  await expect(page.locator('#independentAccountOnboarding')).toBeVisible();
  await expect(page.locator('#independentAccountOnboarding')).toContainText('Account setup needs attention');
  await expect(page.locator('#independentAccountOnboarding')).toContainText('does not match exactly one existing managed profile');
  await expect(page.locator('#independentAccountOnboarding')).not.toContainText('Create your private profile');
  expect(await page.evaluate(() => bigGainsAccounts.runtime.kind)).toBe('guest');
  expect(await page.evaluate(storageKeyValue => localStorage.getItem(storageKeyValue), storageKey)).toBeNull();
  expect(cloud.applicationWrites).toEqual([]);
});

test('Jorge managed-owner runtime remains the two-profile switcher', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-account-mode', 'managed-owner');
  await expect(page.locator('.profile-switcher')).toBeVisible();
  await expect(page.locator('#profileSelect option')).toHaveCount(2);
  expect(await page.locator('#profileSelect option').allTextContents()).toEqual(['Jorge', 'Alexa']);
});
