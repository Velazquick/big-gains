import { expect, test } from '@playwright/test';
import { activeWorkout, blankState, completedWorkout, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const ZERO_COUNTS = Object.freeze({
  workouts: 0,
  routines: 0,
  bodyweight_entries: 0,
  preferences: 0,
  active_sessions: 0,
  sync_metadata: 0,
  tombstones: 0
});

function localState(profileId, overrides = {}) {
  return {
    ...blankState(profileId),
    exercisePreferences: {},
    ...overrides
  };
}

function localSnapshots(overrides = {}) {
  return {
    jorge: { ok: true, profileId: 'jorge', value: localState('jorge', overrides.jorge) },
    alexa: { ok: true, profileId: 'alexa', value: localState('alexa', overrides.alexa) }
  };
}

function remoteFixture(overrides = {}) {
  const account = { id: 'account-jorge', owner_user_id: 'auth-jorge' };
  return {
    signedInUserId: 'auth-jorge',
    accounts: [account],
    profiles: [
      { id: 'cloud-profile-jorge', account_id: account.id, client_id: 'jorge', display_name: 'Jorge' },
      { id: 'cloud-profile-alexa', account_id: account.id, client_id: 'alexa', display_name: 'Alexa' }
    ],
    counts: { ...ZERO_COUNTS },
    ...overrides
  };
}

async function build(page, snapshots = localSnapshots(), remote = remoteFixture(), options = {}) {
  return page.evaluate(async ({ snapshots, remote, options }) => BigGainsMigrationPreview.buildPreview({
    localSnapshots: snapshots,
    remote,
    generatedAt: options.generatedAt || '2026-08-07T18:00:00.000Z',
    appRelease: 'v47.1-phase4d-legacy-source-preview'
  }), { snapshots, remote, options });
}

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);
});

test('maps synthetic Jorge and Alexa profiles to one signed-in account and becomes ready', async ({ page }) => {
  const preview = await build(page, localSnapshots({
    jorge: { workouts: [completedWorkout()], customRoutines: { Push: ['press', 'fly'] } },
    alexa: { weights: [{ weight: 225, date: '2026-08-01T12:00:00.000Z' }] }
  }));

  expect(preview.status).toBe('READY FOR MIGRATION');
  expect(preview.ready).toBe(true);
  expect(preview.mappings).toEqual({
    jorge: {
      localProfileId: 'jorge', cloudProfileId: 'cloud-profile-jorge',
      cloudAccountId: 'account-jorge', cloudClientId: 'jorge'
    },
    alexa: {
      localProfileId: 'alexa', cloudProfileId: 'cloud-profile-alexa',
      cloudAccountId: 'account-jorge', cloudClientId: 'alexa'
    }
  });
  expect(preview.profiles.jorge.entities.completedWorkouts.count).toBe(1);
  expect(preview.profiles.jorge.entities.customRoutines.count).toBe(1);
  expect(preview.profiles.alexa.entities.bodyweightEntries.count).toBe(1);
});

test('accepts historical schema markers only when raw records satisfy the current migration contract', async ({ page }) => {
  const current = await build(page, localSnapshots({ jorge: { workouts: [completedWorkout()] } }));

  for (const version of [2, 3, 4]) {
    const preview = await build(page, localSnapshots({
      jorge: { version, workouts: [completedWorkout()] }
    }));

    expect(preview.ready).toBe(true);
    expect(preview.profiles.jorge.valid).toBe(true);
    expect(preview.profiles.jorge.storedSchemaVersion).toBe(version);
    expect(preview.profiles.jorge.checksum).toBe(current.profiles.jorge.checksum);
  }
});

test('blocks missing, nonnumeric, and future source schema markers', async ({ page }) => {
  for (const version of [undefined, '5', 6]) {
    const preview = await build(page, localSnapshots({ jorge: { version } }));

    expect(preview.ready).toBe(false);
    expect(preview.blockingReasons).toContain('Jorge: version — Source schema must be numeric version 2, 3, 4, or 5.');
  }
});

test('blocks a cloud profile whose account ownership does not match', async ({ page }) => {
  const remote = remoteFixture();
  remote.profiles[1] = { ...remote.profiles[1], account_id: 'different-account' };
  const preview = await build(page, localSnapshots(), remote);

  expect(preview.ready).toBe(false);
  expect(preview.blockingReasons).toContain('Cloud Alexa profile belongs to a different account.');
});

for (const missing of ['jorge', 'alexa']) {
  test(`blocks when the ${missing} cloud profile is missing`, async ({ page }) => {
    const remote = remoteFixture();
    remote.profiles = remote.profiles.filter(profile => profile.client_id !== missing);
    const preview = await build(page, localSnapshots(), remote);

    expect(preview.ready).toBe(false);
    expect(preview.blockingReasons.some(reason => reason.includes(`Expected one ${missing === 'jorge' ? 'Jorge' : 'Alexa'} cloud profile; found 0.`))).toBe(true);
  });
}

test('blocks and names every nonzero account-scoped remote application table', async ({ page }) => {
  const preview = await build(page, localSnapshots(), remoteFixture({
    counts: { ...ZERO_COUNTS, workouts: 2, tombstones: 1 }
  }));

  expect(preview.status).toBe('BLOCKED');
  expect(preview.blockingReasons).toEqual(expect.arrayContaining([
    'workouts already has 2 rows for this account.',
    'tombstones already has 1 row for this account.'
  ]));
});

test('canonical SHA-256 is stable across object key order, line endings, and preview timestamps', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const left = { z: 0, a: { enabled: false, note: 'line one\r\nline two', empty: '', nullable: null } };
    const right = { a: { nullable: null, empty: '', note: 'line one\nline two', enabled: false }, z: 0 };
    return {
      canonicalLeft: BigGainsMigrationPreview.canonicalize(left),
      canonicalRight: BigGainsMigrationPreview.canonicalize(right),
      left: await BigGainsMigrationPreview.sha256(left),
      right: await BigGainsMigrationPreview.sha256(right)
    };
  });
  expect(result.canonicalLeft).toBe(result.canonicalRight);
  expect(result.left).toBe(result.right);

  const first = await build(page, localSnapshots(), remoteFixture(), { generatedAt: '2026-08-07T18:00:00.000Z' });
  const second = await build(page, localSnapshots(), remoteFixture(), { generatedAt: '2030-01-01T00:00:00.000Z' });
  expect(second.combinedChecksum).toBe(first.combinedChecksum);
});

test('checksum is stable across reloads', async ({ page }) => {
  const snapshots = localSnapshots({ jorge: { workouts: [completedWorkout()] } });
  const before = await build(page, snapshots);
  await page.reload();
  const after = await build(page, snapshots);

  expect(after.profiles.jorge.checksum).toBe(before.profiles.jorge.checksum);
  expect(after.combinedChecksum).toBe(before.combinedChecksum);
});

test('bodyweight audit details name the dedicated table without changing the v47.1 source checksum', async ({ page }) => {
  const preview = await build(page, localSnapshots({
    jorge: { weights: [{ weight: 218.4, date: '2026-08-04T18:30:00.000Z' }] }
  }));
  const compatibilityChecksum = await page.evaluate(async profile => {
    const destinations = {
      completedWorkouts: 'workouts',
      customRoutines: 'routines',
      bodyweightEntries: 'preferences',
      goals: 'preferences',
      timerPreferences: 'preferences',
      exercisePreferences: 'preferences',
      activeSession: 'active_sessions'
    };
    return BigGainsMigrationPreview.sha256({
      contract: BigGainsMigrationPreview.format,
      sourceSchemaVersion: BigGainsMigrationPreview.sourceSchemaVersion,
      profileClientId: 'jorge',
      entities: Object.fromEntries(BigGainsMigrationPreview.entityOrder.map(entityType => [entityType, {
        count: profile.entities[entityType].count,
        checksum: profile.entities[entityType].checksum,
        destination: destinations[entityType]
      }]))
    });
  }, preview.profiles.jorge);

  expect(preview.profiles.jorge.entities.bodyweightEntries.destination).toBe('bodyweight_entries');
  expect(preview.profiles.jorge.checksum).toBe(compatibilityChecksum);
});

test('meaningful workout changes and meaningful array order change checksums', async ({ page }) => {
  const baseWorkout = completedWorkout();
  const changedWorkout = completedWorkout({ exercises: [{
    ...baseWorkout.exercises[0],
    sets: [{ ...baseWorkout.exercises[0].sets[0], reps: 11 }]
  }] });
  const base = await build(page, localSnapshots({ jorge: { workouts: [baseWorkout] } }));
  const changed = await build(page, localSnapshots({ jorge: { workouts: [changedWorkout] } }));
  const reordered = await build(page, localSnapshots({ jorge: { workouts: [
    completedWorkout({ id: 'one' }),
    completedWorkout({ id: 'two', completedAt: '2026-08-03T18:30:00.000Z' })
  ] } }));
  const reverse = await build(page, localSnapshots({ jorge: { workouts: [
    completedWorkout({ id: 'two', completedAt: '2026-08-03T18:30:00.000Z' }),
    completedWorkout({ id: 'one' })
  ] } }));

  expect(changed.profiles.jorge.entities.completedWorkouts.checksum).not.toBe(base.profiles.jorge.entities.completedWorkouts.checksum);
  expect(reverse.profiles.jorge.entities.completedWorkouts.checksum).not.toBe(reordered.profiles.jorge.entities.completedWorkouts.checksum);
});

test('null, false, zero, and empty values remain distinct in the checksum contract', async ({ page }) => {
  const hashes = await page.evaluate(async () => Promise.all([
    null, false, 0, ''
  ].map(value => BigGainsMigrationPreview.sha256({ value }))));
  expect(new Set(hashes).size).toBe(4);
});

test('invalid and unsupported local records are surfaced without normalization and block readiness', async ({ page }) => {
  const snapshots = localSnapshots({
    jorge: {
      unsupportedFuturePayload: { hidden: true },
      workouts: [{ ...completedWorkout(), completedAt: 'not-a-date' }],
      weights: [{ weight: -1, date: 'not-a-date' }]
    }
  });
  const preview = await build(page, snapshots);

  expect(preview.ready).toBe(false);
  expect(preview.profiles.jorge.valid).toBe(false);
  expect(preview.blockingReasons).toEqual(expect.arrayContaining([
    'Jorge: unsupportedFuturePayload — Unsupported top-level local field.',
    'Jorge: workouts[0].completedAt — Workout completion time is invalid.',
    'Jorge: weights[0] — Bodyweight entry requires a non-negative weight and valid date.'
  ]));
});

test('remote verification issues SELECT-only account-scoped queries and has no write surface', async ({ page }) => {
  const result = await page.evaluate(async zeroCounts => {
    const calls = [];
    const account = { id: 'account-jorge', owner_user_id: 'auth-jorge' };
    const profiles = [
      { id: 'profile-jorge', account_id: account.id, client_id: 'jorge', display_name: 'Jorge' },
      { id: 'profile-alexa', account_id: account.id, client_id: 'alexa', display_name: 'Alexa' }
    ];
    const client = {
      from(table) {
        calls.push({ method: 'from', table });
        let selectOptions = null;
        const filters = {};
        const query = {
          select(columns, options) { calls.push({ method: 'select', table, columns, options }); selectOptions = options || null; return query; },
          eq(column, value) { calls.push({ method: 'eq', table, column, value }); filters[column] = value; return query; },
          limit(value) { calls.push({ method: 'limit', table, value }); return query; },
          insert() { calls.push({ method: 'insert', table }); throw new Error('write attempted'); },
          update() { calls.push({ method: 'update', table }); throw new Error('write attempted'); },
          delete() { calls.push({ method: 'delete', table }); throw new Error('write attempted'); },
          upsert() { calls.push({ method: 'upsert', table }); throw new Error('write attempted'); },
          then(resolve, reject) {
            const response = table === 'accounts'
              ? { data: [account], error: null }
              : table === 'profiles'
                ? { data: profiles, error: null }
                : { data: null, count: selectOptions?.head ? zeroCounts[table] : null, error: null };
            return Promise.resolve(response).then(resolve, reject);
          }
        };
        return query;
      }
    };
    const remote = await BigGainsMigrationPreview.readRemoteDestination({ client, session: { user: { id: 'auth-jorge' } } });
    return { remote, calls };
  }, ZERO_COUNTS);

  expect(result.remote.counts).toEqual(ZERO_COUNTS);
  expect(result.calls.filter(call => ['insert', 'update', 'delete', 'upsert'].includes(call.method))).toEqual([]);
  for (const table of Object.keys(ZERO_COUNTS)) {
    expect(result.calls).toContainEqual({ method: 'eq', table, column: 'account_id', value: 'account-jorge' });
  }
});

test('reading and hashing a historical schema marker performs no local writes', async ({ page }) => {
  const result = await page.evaluate(async remote => {
    const jorgeStorageKey = bigGainsStatePersistence.storageKeyForProfile('jorge');
    const historicalState = JSON.parse(localStorage.getItem(jorgeStorageKey));
    historicalState.version = 4;
    localStorage.setItem(jorgeStorageKey, JSON.stringify(historicalState));
    const rawBefore = localStorage.getItem(jorgeStorageKey);
    const originalSetItem = Storage.prototype.setItem;
    const originalRemoveItem = Storage.prototype.removeItem;
    const writes = [];
    Storage.prototype.setItem = function (...args) { writes.push({ method: 'setItem', key: args[0] }); return originalSetItem.apply(this, args); };
    Storage.prototype.removeItem = function (...args) { writes.push({ method: 'removeItem', key: args[0] }); return originalRemoveItem.apply(this, args); };
    try {
      const localSnapshots = {
        jorge: bigGainsStatePersistence.readProfileSnapshot('jorge'),
        alexa: bigGainsStatePersistence.readProfileSnapshot('alexa')
      };
      const preview = await BigGainsMigrationPreview.buildPreview({ localSnapshots, remote });
      return {
        writes,
        status: preview.status,
        storedSchemaVersion: preview.profiles.jorge.storedSchemaVersion,
        rawUnchanged: localStorage.getItem(jorgeStorageKey) === rawBefore
      };
    } finally {
      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.removeItem = originalRemoveItem;
    }
  }, remoteFixture());

  expect(result.writes).toEqual([]);
  expect(result.status).toBe('READY FOR MIGRATION');
  expect(result.storedSchemaVersion).toBe(4);
  expect(result.rawUnchanged).toBe(true);
});

test('authenticated Settings UI shows quiet mapping, counts, audit details, and no migration action', async ({ page }) => {
  await page.evaluate(zeroCounts => {
    const account = { id: 'account-jorge', owner_user_id: 'auth-jorge' };
    const profiles = [
      { id: 'profile-jorge', account_id: account.id, client_id: 'jorge', display_name: 'Jorge' },
      { id: 'profile-alexa', account_id: account.id, client_id: 'alexa', display_name: 'Alexa' }
    ];
    const client = {
      from(table) {
        let options = null;
        const query = {
          select(_columns, value) { options = value || null; return query; },
          eq() { return query; },
          limit() { return query; },
          then(resolve, reject) {
            const response = table === 'accounts'
              ? { data: [account], error: null }
              : table === 'profiles'
                ? { data: profiles, error: null }
                : { data: null, count: options?.head ? zeroCounts[table] : null, error: null };
            return Promise.resolve(response).then(resolve, reject);
          }
        };
        return query;
      }
    };
    window.BigGainsSupabase = {
      configured: true,
      async session() { return { user: { id: 'auth-jorge' } }; },
      getClient() { return client; }
    };
  }, ZERO_COUNTS);
  await page.evaluate(() => BigGainsMigrationPreview.refresh());
  await page.locator('#openSettings').click();
  await page.locator('#advancedDiagnostics').evaluate(element => { element.open = true; });

  const card = page.locator('#migrationPreviewCard');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Local Jorge → Cloud Jorge');
  await expect(card).toContainText('Local Alexa → Cloud Alexa');
  await expect(card).toContainText('READY FOR MIGRATION');
  await expect(card).toContainText('Remote data rows');
  await expect(card.locator('details')).toHaveCount(2);
  await expect(card.locator('#exportMigrationPreview')).toBeVisible();
  await expect(card.getByRole('button', { name: /migrate now/i })).toHaveCount(0);
});

test('audit export contains identifiers, counts, and checksums but no personal record payloads', async ({ page }) => {
  const sensitiveWorkout = completedWorkout({
    note: 'private workout note sentinel',
    exercises: [{
      ...completedWorkout().exercises[0],
      note: 'private exercise cue sentinel',
      sets: [{ ...completedWorkout().exercises[0].sets[0], weight: 137.25 }]
    }]
  });
  const preview = await build(page, localSnapshots({
    jorge: {
      workouts: [sensitiveWorkout],
      weights: [{ weight: 219.75, date: '2026-08-01T12:00:00.000Z' }],
      exercisePreferences: { press: { cue: 'private saved cue sentinel', restSeconds: 90 } }
    }
  }));
  const audit = await page.evaluate(preview => BigGainsMigrationPreview.auditArtifact(preview), preview);
  const serialized = JSON.stringify(audit);

  expect(audit).toMatchObject({
    format: 'big-gains.migration-preview.v1',
    version: 1,
    source: { schemaVersion: 5, appRelease: 'v47.1-phase4d-legacy-source-preview' },
    status: 'READY FOR MIGRATION'
  });
  expect(audit.profiles.jorge.counts.completedWorkouts).toBe(1);
  expect(audit.profiles.jorge.storedSchemaVersion).toBe(5);
  expect(audit.profiles.jorge.entityChecksums.completedWorkouts).toHaveLength(64);
  expect(serialized).not.toContain('private workout note sentinel');
  expect(serialized).not.toContain('private exercise cue sentinel');
  expect(serialized).not.toContain('private saved cue sentinel');
  expect(serialized).not.toContain('137.25');
  expect(serialized).not.toContain('219.75');
});

test('schema-v5 backup and snapshot payloads remain unchanged after preview inspection', async ({ page }) => {
  const beforeJorge = await readStoredJson(page, STORAGE_KEYS.jorge);
  const beforeAlexa = await readStoredJson(page, STORAGE_KEYS.alexa);
  const result = await page.evaluate(async remote => {
    const backupBefore = JSON.parse(statePersistenceApi.prepareExport(state).json);
    const snapshotBefore = BigGainsSync.buildSnapshot();
    const localSnapshots = {
      jorge: bigGainsStatePersistence.readProfileSnapshot('jorge'),
      alexa: bigGainsStatePersistence.readProfileSnapshot('alexa')
    };
    await BigGainsMigrationPreview.buildPreview({ localSnapshots, remote });
    return {
      backupBefore,
      backupAfter: JSON.parse(statePersistenceApi.prepareExport(state).json),
      snapshotBefore: { ...snapshotBefore, generatedAt: null },
      snapshotAfter: { ...BigGainsSync.buildSnapshot(), generatedAt: null }
    };
  }, remoteFixture());

  expect(result.backupBefore.version).toBe(5);
  expect(result.backupAfter).toEqual(result.backupBefore);
  expect(result.snapshotBefore.schema).toBe('big-gains.snapshot.v1');
  expect(result.snapshotAfter).toEqual(result.snapshotBefore);
  expect(await readStoredJson(page, STORAGE_KEYS.jorge)).toEqual(beforeJorge);
  expect(await readStoredJson(page, STORAGE_KEYS.alexa)).toEqual(beforeAlexa);
});

test('preview card stays absent while signed out and offline-safe local use remains available', async ({ page, context }) => {
  await page.evaluate(() => {
    window.BigGainsSupabase = {
      configured: true,
      async session() { return null; }
    };
  });
  await BigGainsMigrationPreviewRefresh(page);
  await expect(page.locator('#migrationPreviewCard')).toHaveCount(0);

  await context.setOffline(true);
  try {
    await expect(page.locator('#quickStartSession')).toBeVisible();
    expect(await page.evaluate(() => state.version)).toBe(5);
  } finally {
    await context.setOffline(false);
  }
});

test('ordinary workout completion does not call Supabase application transport', async ({ page }) => {
  await page.evaluate(workout => {
    active = workout;
    state.activeWorkout = workout;
    statePersistenceApi.save(state, active);
    window.__phase4dRemoteCalls = [];
    const originalFetch = window.fetch;
    window.fetch = (...args) => {
      const url = String(args[0]);
      if (url.includes('.supabase.co/rest/v1/')) window.__phase4dRemoteCalls.push(url);
      return originalFetch(...args);
    };
  }, activeWorkout());
  const completed = await page.evaluate(() => {
    active.exercises.forEach(exercise => exercise.sets.filter(set => !set.warmup).forEach(set => { set.completed = true; }));
    return workoutSessionController.complete();
  });

  expect(completed).toBe(true);
  expect(await page.evaluate(() => window.__phase4dRemoteCalls)).toEqual([]);
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts).toHaveLength(1);
});

async function BigGainsMigrationPreviewRefresh(page) {
  await page.evaluate(() => window.BigGainsMigrationPreview.refresh());
}
