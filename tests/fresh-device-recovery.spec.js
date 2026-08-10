import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { openApp } from './helpers/app.js';

const NOW = '2026-08-09T12:00:00.000Z';
const MANAGED_AUTH = '60000000-0000-0000-0000-000000000001';
const MANAGED_ACCOUNT = '60000000-0000-0000-0000-000000000002';
const JORGE_PROFILE = '60000000-0000-0000-0000-000000000003';
const ALEXA_PROFILE = '60000000-0000-0000-0000-000000000004';
const SZW_AUTH = '61000000-0000-0000-0000-000000000001';
const SZW_ACCOUNT = '61000000-0000-0000-0000-000000000002';
const SZW_PROFILE = '61000000-0000-0000-0000-000000000003';
const SZW_CLIENT = 'independent-09034233fa064233b85018aec182764d';
const MANAGED_RECOVERY_KEY = 'big-gains-fresh-device-recovery-v1-managed-jorge-alexa';

const managedIdentity = {
  kind: 'managed-owner', authUserId: MANAGED_AUTH,
  account: { id: MANAGED_ACCOUNT, owner_user_id: MANAGED_AUTH, display_name: 'Jorge account', created_at: NOW },
  profiles: {
    jorge: { id: JORGE_PROFILE, account_id: MANAGED_ACCOUNT, client_id: 'jorge', display_name: 'Jorge', pet_enabled: true, accent: 'ember', theme: 'performance-dark', created_at: NOW },
    alexa: { id: ALEXA_PROFILE, account_id: MANAGED_ACCOUNT, client_id: 'alexa', display_name: 'Alexa', pet_enabled: true, accent: 'rose', theme: 'wellness-light', created_at: NOW }
  }
};

const independentIdentity = {
  kind: 'independent', authUserId: SZW_AUTH,
  account: { id: SZW_ACCOUNT, owner_user_id: SZW_AUTH, display_name: 'SZW account', created_at: NOW },
  profiles: {
    [SZW_CLIENT]: { id: SZW_PROFILE, account_id: SZW_ACCOUNT, client_id: SZW_CLIENT, display_name: 'szw', pet_enabled: false, accent: 'merlot', theme: 'slate-dark', created_at: NOW }
  }
};

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

const sha256 = value => createHash('sha256').update(canonicalize(value)).digest('hex');
const routineClientId = name => `routine:${sha256({ name })}`;
const bodyweightClientId = (measuredAt, weightValue) => `bodyweight:${sha256({ measuredAt, weightValue, unit: 'lb' })}:1`;

function profileCloud(profileClientId, { workoutType, workoutId, weight, routineName, routine, activeType = null, tombstoneActive = false } = {}) {
  const identity = profileClientId === 'jorge' ? managedIdentity : profileClientId === 'alexa' ? managedIdentity : independentIdentity;
  const profile = identity.profiles[profileClientId];
  const accountId = identity.account.id;
  const completedAt = profileClientId === 'alexa' ? '2026-08-08T16:00:00.000Z' : '2026-08-08T14:00:00.000Z';
  const workout = {
    id: workoutId,
    type: workoutType,
    startedAt: '2026-08-08T13:00:00.000Z',
    completedAt,
    durationSeconds: 3600,
    prs: 1,
    exercises: [{
      id: 'barbell-bench-press', name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell', collapsed: true,
      sets: [{ id: `${workoutId}-set`, weight: 100, reps: 10, warmup: false, completed: true }]
    }]
  };
  const activeWorkout = activeType ? {
    id: `${profileClientId}-active`, type: activeType, startedAt: '2026-08-09T11:30:00.000Z',
    exercises: [{
      id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable', collapsed: false,
      sets: [{ id: `${profileClientId}-active-set`, weight: 90, reps: 10, warmup: false, completed: false }]
    }]
  } : null;
  const envelope = (entityType, clientId, data) => ({ contract: 'big-gains.shadow.v1', version: 1, profileClientId, entityType, clientId, data });
  const row = (table, clientId, payload, extra = {}) => ({
    id: `${profileClientId}-${table}-${clientId}`,
    account_id: accountId,
    profile_id: profile.id,
    client_id: clientId,
    idempotency_key: `${profileClientId}-${table}-${clientId}-key`,
    payload,
    version: 1,
    created_at: NOW,
    updated_at: NOW,
    ...extra
  });
  const measuredAt = profileClientId === 'alexa' ? '2026-08-07T12:00:00.000Z' : '2026-08-06T12:00:00.000Z';
  const records = {
    workouts: [row('workouts', workout.id, envelope('completedWorkout', workout.id, workout), { completed_at: workout.completedAt })],
    routines: [row('routines', routineClientId(routineName), envelope('customRoutine', routineClientId(routineName), { name: routineName, exerciseIds: routine }))],
    bodyweight_entries: [{
      id: `${profileClientId}-bodyweight`, account_id: accountId, profile_id: profile.id,
      client_id: bodyweightClientId(measuredAt, weight), idempotency_key: `${profileClientId}-bodyweight-key`,
      measured_at: measuredAt, weight_value: weight, unit: 'lb', version: 1, created_at: NOW, updated_at: NOW
    }],
    preferences: [
      row('preferences', 'goals', envelope('goals', 'goals', { primary: profileClientId === 'alexa' ? 'Weight loss' : 'Strength and performance' })),
      row('preferences', 'timer', envelope('timerPreferences', 'timer', { sound: profileClientId !== 'jorge', vibration: profileClientId !== SZW_CLIENT })),
      row('preferences', 'exercise:barbell-bench-press', envelope('exercisePreference', 'exercise:barbell-bench-press', {
        exerciseId: 'barbell-bench-press', preference: { cue: `${profileClientId} cloud cue`, restSeconds: 120 }
      }))
    ],
    active_sessions: activeWorkout ? [row('active_sessions', activeWorkout.id, envelope('activeSession', activeWorkout.id, {
      workout: activeWorkout, restTimerEndsAt: Date.parse('2036-08-09T12:02:00.000Z')
    }))] : []
  };
  const tombstones = tombstoneActive && activeWorkout ? [{
    id: `${profileClientId}-active-tombstone`, account_id: accountId, profile_id: profile.id,
    entity_type: 'active_sessions', entity_id: activeWorkout.id, idempotency_key: `${profileClientId}-active-delete`,
    version: 2, deleted_at: '2026-08-09T12:05:00.000Z', created_at: NOW, updated_at: '2026-08-09T12:05:00.000Z'
  }] : [];
  return { records, tombstones, workout, activeWorkout, measuredAt };
}

function cloudFixture(identity, { malformed = false } = {}) {
  const definitions = identity.kind === 'managed-owner'
    ? {
        jorge: { workoutType: 'Push', workoutId: 'jorge-cloud-workout', weight: 220.5, routineName: 'Push', routine: ['barbell-bench-press'], activeType: 'Pull', tombstoneActive: true },
        alexa: { workoutType: 'PilatesPull', workoutId: 'alexa-cloud-workout', weight: 181.5, routineName: 'PilatesPull', routine: ['lat-pulldown'], activeType: 'PilatesPull' }
      }
    : {
        [SZW_CLIENT]: { workoutType: 'SzwPush1', workoutId: 'szw-cloud-workout', weight: 205, routineName: 'SzwPush1', routine: [{ exerciseId: 'barbell-bench-press', workingSets: 5, targetReps: '5' }], activeType: 'SzwPull1' }
      };
  const profiles = Object.fromEntries(Object.entries(definitions).map(([profileId, definition]) => [profileId, profileCloud(profileId, definition)]));
  const records = Object.fromEntries(['workouts', 'routines', 'bodyweight_entries', 'preferences', 'active_sessions']
    .map(table => [table, Object.values(profiles).flatMap(profile => profile.records[table])]));
  const tombstones = Object.values(profiles).flatMap(profile => profile.tombstones);
  if (malformed) records.preferences[0].payload.contract = 'unsupported-cloud-contract';
  return { profiles, records, tombstones };
}

function storageFor(identity) {
  if (identity.kind === 'managed-owner') return {
    states: { jorge: 'big-gains-v2', alexa: 'big-gains-alexa-v1' },
    queue: 'big-gains-cloud-sync-queue-v1', catalog: 'big-gains-cloud-shadow-catalog-v1',
    comparison: 'big-gains-cloud-shadow-comparison-v1', recovery: MANAGED_RECOVERY_KEY
  };
  const namespace = `cloud-${identity.account.id}-${Object.values(identity.profiles)[0].id}`;
  return {
    states: { [SZW_CLIENT]: `big-gains-${namespace}-v1` },
    queue: `big-gains-cloud-sync-queue-v1-${namespace}`,
    catalog: `big-gains-cloud-shadow-catalog-v1-${namespace}`,
    comparison: `big-gains-cloud-shadow-comparison-v1-${namespace}`,
    recovery: `big-gains-fresh-device-recovery-v1-${namespace}`
  };
}

async function installIdentity(page, identity, {
  driftMetadata = false,
  localStates = {},
  queueDocument = null,
  failPersistenceKey = null
} = {}) {
  const storage = storageFor(identity);
  await page.addInitScript(({ identity, storage, driftMetadata, localStates, queueDocument, failPersistenceKey, now }) => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = {
      supabaseUrl: 'https://synthetic-phase4k.supabase.co',
      supabasePublishableKey: 'sb_publishable_phase4k',
      authRedirectUrl: 'https://velazquick.github.io/big-gains/'
    };
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('big-gains-supabase-auth-v1', JSON.stringify({
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: identity.authUserId, role: 'authenticated', exp: expiresAt })}.synthetic`,
      refresh_token: `${identity.kind}-refresh`, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
      user: { id: identity.authUserId, aud: 'authenticated', role: 'authenticated', email: `${identity.kind}@example.test`,
        email_confirmed_at: now, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: now }
    }));
    const profile = Object.values(identity.profiles)[0];
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: identity.authUserId,
      accounts: {
        [identity.authUserId]: identity.kind === 'managed-owner'
          ? { kind: 'managed-owner', authUserId: identity.authUserId, cloudAccountId: identity.account.id }
          : {
              kind: 'independent', authUserId: identity.authUserId, cloudAccountId: identity.account.id,
              cloudProfileId: profile.id, clientId: profile.client_id, displayName: profile.display_name,
              presentation: { petEnabled: profile.pet_enabled, accent: profile.accent, theme: profile.theme }
            }
      }
    }));
    if (identity.kind === 'managed-owner') localStorage.setItem('big-gains-active-profile', 'jorge');
    for (const [profileId, value] of Object.entries(localStates)) localStorage.setItem(storage.states[profileId], JSON.stringify(value));
    if (driftMetadata) {
      localStorage.setItem(storage.comparison, JSON.stringify({
        contract: 'big-gains.shadow.v1', parity: false, comparedAt: now,
        profiles: {}, reasons: ['Fresh local profile was empty during the first comparison.']
      }));
      localStorage.setItem(storage.catalog, JSON.stringify({
        format: 'big-gains.shadow-catalog.v1', version: 1, accountId: identity.account.id,
        authUserId: identity.authUserId, migrationId: 'harmless-stale-metadata', profiles: {}
      }));
    }
    if (queueDocument) localStorage.setItem(storage.queue, JSON.stringify(queueDocument));
    if (failPersistenceKey) {
      const original = Storage.prototype.setItem;
      let failed = false;
      Storage.prototype.setItem = function(key, value) {
        if (!failed && key === failPersistenceKey) { failed = true; throw new DOMException('Synthetic quota failure', 'QuotaExceededError'); }
        return original.call(this, key, value);
      };
    }
  }, { identity, storage, driftMetadata, localStates, queueDocument, failPersistenceKey, now: NOW });
  return storage;
}

async function installCloud(page, identity, { malformed = false, slow = false } = {}) {
  const fixture = cloudFixture(identity, { malformed });
  const writes = [];
  let delayed = false;
  await page.route('https://synthetic-phase4k.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const table = url.pathname.split('/').pop();
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(`${request.method()} ${table}`);
      return route.fulfill({ status: 500, headers, body: JSON.stringify({ message: 'Recovery must remain read-only.' }) });
    }
    let data = [];
    if (table === 'accounts') data = [identity.account];
    else if (table === 'profile_memberships') data = [];
    else if (table === 'profiles') data = Object.values(identity.profiles);
    else if (table === 'tombstones') data = fixture.tombstones;
    else if (table === 'sync_metadata') data = identity.kind === 'managed-owner' ? [{
      id: 'managed-journal', account_id: identity.account.id, profile_id: null,
      client_id: 'migration:managed-baseline', metadata: {
        format: 'big-gains.migration-journal.v1', migrationContract: 'big-gains.migration.v1',
        status: 'complete', migrationId: 'managed-production-baseline'
      }, version: 1, created_at: NOW, updated_at: NOW
    }] : [];
    else if (fixture.records[table]) {
      if (slow && !delayed) { delayed = true; await new Promise(resolve => setTimeout(resolve, 1_500)); }
      data = fixture.records[table];
    }
    return route.fulfill({
      status: 200,
      headers: { ...headers, 'content-range': data.length ? `0-${data.length - 1}/${data.length}` : '*/0' },
      body: request.method() === 'HEAD' ? '' : JSON.stringify(data)
    });
  });
  return { fixture, writes };
}

function blankLocal(profileId, primary = 'Local sentinel') {
  return {
    version: 5, profileId, goals: { primary }, workouts: [], weights: [], prs: {}, activeWorkout: null,
    restTimerEndsAt: null, customRoutines: {}, timerPreferences: { sound: true, vibration: true }
  };
}

test('managed owner restores Jorge and Alexa from fresh cloud despite prior drift metadata', async ({ page, context }) => {
  const storage = await installIdentity(page, managedIdentity, { driftMetadata: true });
  await page.addInitScript(() => {
    const rememberRecoveryCopy = () => {
      const text = document.getElementById('independentAccountOnboarding')?.textContent || '';
      if (text.includes('Restoring your training to this device') && text.includes('verified private cloud copy')) {
        sessionStorage.setItem('big-gains-test-recovery-copy-seen', text);
      }
    };
    new MutationObserver(rememberRecoveryCopy).observe(document, { childList: true, subtree: true, characterData: true });
  });
  const cloud = await installCloud(page, managedIdentity, { slow: true });
  await openApp(page);

  await expect.poll(async () => {
    try { return await page.evaluate(() => sessionStorage.getItem('big-gains-test-recovery-copy-seen')); }
    catch { return null; }
  }).toMatch(/Restoring your training to this device[\s\S]*verified private cloud copy/);
  await expect(page.locator('#independentAccountOnboarding')).toBeHidden();
  const restored = await page.evaluate(storageKeys => ({
    jorge: JSON.parse(localStorage.getItem(storageKeys.states.jorge)),
    alexa: JSON.parse(localStorage.getItem(storageKeys.states.alexa)),
    catalog: JSON.parse(localStorage.getItem(storageKeys.catalog)),
    comparison: JSON.parse(localStorage.getItem(storageKeys.comparison)),
    marker: JSON.parse(localStorage.getItem(storageKeys.recovery)),
    queue: localStorage.getItem(storageKeys.queue),
    pending: BigGainsCloudSync.queue.pending().length
  }), storage);

  expect(restored.jorge).toMatchObject({
    version: 5, profileId: 'jorge', workouts: [{ id: 'jorge-cloud-workout' }],
    weights: [{ date: '2026-08-06T12:00:00.000Z', weight: 220.5 }],
    customRoutines: { Push: ['barbell-bench-press'] },
    timerPreferences: { sound: false, vibration: true },
    exercisePreferences: { 'barbell-bench-press': { cue: 'jorge cloud cue', restSeconds: 120 } },
    activeWorkout: null, restTimerEndsAt: null,
    prs: { 'barbell-bench-press': { estimated1RM: 133, weight: 100, reps: 10 } }
  });
  expect(restored.alexa).toMatchObject({
    version: 5, profileId: 'alexa', workouts: [{ id: 'alexa-cloud-workout' }],
    weights: [{ date: '2026-08-07T12:00:00.000Z', weight: 181.5 }],
    customRoutines: { PilatesPull: ['lat-pulldown'] },
    activeWorkout: { id: 'alexa-active' }, restTimerEndsAt: Date.parse('2036-08-09T12:02:00.000Z')
  });
  expect(restored.catalog).toMatchObject({
    accountId: MANAGED_ACCOUNT, authUserId: MANAGED_AUTH, migrationId: 'managed-production-baseline',
    profiles: { jorge: { profileId: JORGE_PROFILE }, alexa: { profileId: ALEXA_PROFILE } }
  });
  expect(restored.comparison.parity).toBe(true);
  expect(restored.comparison.profiles.jorge.parity).toBe(true);
  expect(restored.comparison.profiles.alexa.parity).toBe(true);
  expect(restored.marker).toMatchObject({
    format: 'big-gains.fresh-device-recovery.v1', kind: 'managed-owner',
    authUserId: MANAGED_AUTH, accountId: MANAGED_ACCOUNT
  });
  expect(restored.marker.profiles.map(profile => profile.profileClientId).sort()).toEqual(['alexa', 'jorge']);
  expect(restored.queue).toBeNull();
  expect(restored.pending).toBe(0);
  expect(cloud.writes).toEqual([]);

  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#independentAccountOnboarding')).toBeHidden();
  await expect(page.locator('#history')).toContainText('Push');
  expect(await page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(0);
});

test('existing SZW independent profile restores schema v5 and preserves stable presentation identity', async ({ page }) => {
  const storage = await installIdentity(page, independentIdentity);
  const cloud = await installCloud(page, independentIdentity, { slow: true });
  await openApp(page);

  await expect(page.locator('#independentAccountOnboarding')).toContainText('Restoring your training to this device');
  await expect(page.locator('#independentAccountOnboarding')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-profile-config', SZW_CLIENT);
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'merlot');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate-dark');
  await expect(page.locator('html')).toHaveAttribute('data-pet-enabled', 'false');
  const restored = await page.evaluate(storageKeys => ({
    state: JSON.parse(localStorage.getItem(storageKeys.states[Object.keys(storageKeys.states)[0]])),
    comparison: JSON.parse(localStorage.getItem(storageKeys.comparison)),
    marker: JSON.parse(localStorage.getItem(storageKeys.recovery)),
    runtime: bigGainsAccounts.runtime
  }), storage);
  expect(restored.state).toMatchObject({
    version: 5, profileId: SZW_CLIENT, workouts: [{ id: 'szw-cloud-workout', type: 'SzwPush1' }],
    weights: [{ weight: 205 }],
    customRoutines: { SzwPush1: [{ exerciseId: 'barbell-bench-press', workingSets: 5, targetReps: '5' }] },
    timerPreferences: { sound: true, vibration: false }, activeWorkout: { type: 'SzwPull1' }
  });
  expect(restored.comparison.parity).toBe(true);
  expect(restored.marker).toMatchObject({ format: 'big-gains.fresh-device-recovery.v1', kind: 'independent' });
  expect(restored.runtime.descriptors[0]).toMatchObject({ profileId: SZW_CLIENT, cloudProfileId: SZW_PROFILE });
  expect(cloud.writes).toEqual([]);
});

test('populated local owner profile blocks direct recovery without overwrite', async ({ page }) => {
  const sentinel = blankLocal('jorge', 'Local owner data survives');
  const storage = await installIdentity(page, managedIdentity, { localStates: { jorge: sentinel } });
  const cloud = await installCloud(page, managedIdentity);
  await openApp(page);

  const result = await page.evaluate(async () => BigGainsManagedProfileRecovery.restore({
    owner: await BigGainsSupabase.readCloudAccount(),
    session: await BigGainsSupabase.session()
  }));
  expect(result).toMatchObject({ ok: false, blocked: true, reason: 'local-namespace-not-empty' });
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).goals.primary, storage.states.jorge)).toBe('Local owner data survives');
  expect(await page.evaluate(key => localStorage.getItem(key), storage.recovery)).toBeNull();
  expect(cloud.writes).toEqual([]);
});

test('non-empty outbound queue blocks recovery before cloud training read or persistence', async ({ page }) => {
  const operation = {
    contract: 'big-gains.sync-op.v1', contractVersion: 1,
    owner: { accountId: MANAGED_ACCOUNT, profileId: JORGE_PROFILE },
    entityType: 'workouts', entityId: 'local-pending', mutation: 'upsert', version: 1,
    updatedAt: NOW, payload: { local: true }, payloadFingerprint: 'pending-fingerprint', baseRevision: null,
    allowRecreation: false, synthetic: false,
    idempotencyKey: `bg-sync-v1:${[MANAGED_ACCOUNT, JORGE_PROFILE, 'workouts', 'local-pending', 'upsert', 1, NOW].map(value => encodeURIComponent(String(value))).join(':')}`,
    attempts: 0, queuedAt: NOW
  };
  const storage = await installIdentity(page, managedIdentity, { queueDocument: { version: 1, pending: [operation], acknowledgements: [] } });
  const cloud = await installCloud(page, managedIdentity);
  await openApp(page);

  await expect(page.locator('#independentAccountOnboarding')).toContainText('Recovery stopped safely');
  await expect(page.locator('#independentAccountOnboarding')).toContainText('outbound changes');
  expect(await page.evaluate(keys => Object.values(keys.states).map(key => localStorage.getItem(key)), storage)).toEqual([null, null]);
  expect(await page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(1);
  expect(cloud.writes).toEqual([]);
});

test('account/profile ownership mismatch blocks before reconstruction', async ({ page }) => {
  const storage = await installIdentity(page, managedIdentity);
  await page.addInitScript(key => {
    localStorage.setItem(key, JSON.stringify({ format: 'incomplete-recovery-sentinel' }));
  }, storage.recovery);
  const cloud = await installCloud(page, managedIdentity);
  await openApp(page);
  const result = await page.evaluate(async () => {
    const owner = await BigGainsSupabase.readCloudAccount();
    return BigGainsManagedProfileRecovery.restore({
      owner: { ...owner, profiles: { ...owner.profiles, jorge: { ...owner.profiles.jorge, account_id: 'wrong-profile-owner' } } },
      session: await BigGainsSupabase.session()
    });
  });
  expect(result).toMatchObject({ ok: false, blocked: true, reason: 'fresh-recovery-profile-mismatch' });
  expect(cloud.writes).toEqual([]);
});

test('malformed cloud record stops safely and leaves both managed training namespaces absent', async ({ page }) => {
  const storage = await installIdentity(page, managedIdentity);
  const cloud = await installCloud(page, managedIdentity, { malformed: true });
  await openApp(page);

  await expect(page.locator('#independentAccountOnboarding')).toContainText('Recovery stopped safely');
  await expect(page.locator('#independentAccountOnboarding')).toContainText('unsupported payload contract');
  const local = await page.evaluate(keys => ({
    states: Object.values(keys.states).map(key => localStorage.getItem(key)),
    marker: localStorage.getItem(keys.recovery),
    pending: BigGainsCloudSync.queue.pending().length
  }), storage);
  expect(local.states).toEqual([null, null]);
  expect(local.marker).toBeNull();
  expect(local.pending).toBe(0);
  expect(cloud.writes).toEqual([]);
});

test('persistence failure rolls back reconstructed profiles and preserves prior comparison metadata', async ({ page }) => {
  const storage = storageFor(managedIdentity);
  await installIdentity(page, managedIdentity, { driftMetadata: true, failPersistenceKey: storage.catalog });
  const cloud = await installCloud(page, managedIdentity);
  await openApp(page);

  await expect(page.locator('#independentAccountOnboarding')).toContainText('Recovery stopped safely');
  await expect(page.locator('#independentAccountOnboarding')).toContainText('rolled back');
  const local = await page.evaluate(keys => ({
    states: Object.values(keys.states).map(key => localStorage.getItem(key)),
    marker: localStorage.getItem(keys.recovery),
    comparison: JSON.parse(localStorage.getItem(keys.comparison))
  }), storage);
  expect(local.states).toEqual([null, null]);
  expect(local.marker).toBeNull();
  expect(local.comparison.parity).toBe(false);
  expect(cloud.writes).toEqual([]);
});
