import { expect, test } from '@playwright/test';
import { openApp } from './helpers/app.js';

const authUserId = '82000000-0000-0000-0000-000000000002';
const cloudAccountId = '82a00000-0000-0000-0000-000000000002';
const cloudProfileId = '82b00000-0000-0000-0000-000000000002';
const clientId = 'independent-syntheticfriend';
const namespace = `cloud-${cloudAccountId}-${cloudProfileId}`;
const storageKey = `big-gains-${namespace}-v1`;
const queueKey = `big-gains-cloud-sync-queue-v1-${namespace}`;
const catalogKey = `big-gains-cloud-shadow-catalog-v1-${namespace}`;

function friendState(overrides = {}) {
  return {
    version: 5,
    profileId: clientId,
    goals: { primary: 'Strength and consistency' },
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

async function installIndependentRuntime(page, { state = friendState(), includeState = true } = {}) {
  await page.addInitScript(({ authUserId, cloudAccountId, cloudProfileId, clientId, storageKey, state, includeState }) => {
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent', authUserId, cloudAccountId, cloudProfileId, clientId,
          displayName: 'Riley',
          presentation: { petEnabled: false, accent: 'cobalt', theme: 'performance-dark' }
        }
      }
    }));
    if (includeState && localStorage.getItem(storageKey) === null) localStorage.setItem(storageKey, JSON.stringify(state));
  }, { authUserId, cloudAccountId, cloudProfileId, clientId, storageKey, state, includeState });
}

async function installCloudIdentityShape(page, profileClientId) {
  const now = '2026-08-07T20:00:00.000Z';
  await page.addInitScript(({ authUserId, now }) => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = {
      supabaseUrl: 'https://synthetic-phase4g-shape.supabase.co',
      supabasePublishableKey: 'sb_publishable_phase4g_shape',
      authRedirectUrl: 'https://velazquick.github.io/big-gains/'
    };
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: authUserId, role: 'authenticated', exp: expiresAt })}.synthetic`;
    localStorage.setItem('big-gains-supabase-auth-v1', JSON.stringify({
      access_token: accessToken, refresh_token: 'synthetic-shape-refresh', token_type: 'bearer',
      expires_in: 3600, expires_at: expiresAt,
      user: { id: authUserId, aud: 'authenticated', role: 'authenticated', email: 'shape@example.test',
        email_confirmed_at: now, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: now }
    }));
  }, { authUserId, now });

  await page.route('https://synthetic-phase4g-shape.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/accounts')) {
      return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '0-0/1' }, body: JSON.stringify([{
        id: cloudAccountId, owner_user_id: authUserId, display_name: 'Shape fixture', created_at: now
      }]) });
    }
    if (url.pathname.endsWith('/profiles')) {
      return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '0-0/1' }, body: JSON.stringify([{
        id: cloudProfileId, account_id: cloudAccountId, client_id: profileClientId, display_name: 'Shape fixture',
        pet_enabled: false, accent: 'cobalt', theme: 'performance-dark', created_at: now
      }]) });
    }
    if (url.pathname.endsWith('/preferences') && profileClientId.startsWith('independent-')) {
      const preference = (clientId, entityType, data) => ({
        id: `shape-${clientId}`, account_id: cloudAccountId, profile_id: cloudProfileId,
        client_id: clientId, idempotency_key: `shape-${clientId}-v1`, version: 1,
        payload: {
          contract: 'big-gains.shadow.v1', version: 1, profileClientId,
          entityType, clientId, data
        },
        created_at: now, updated_at: now
      });
      const body = [
        preference('goals', 'goals', { primary: 'Strength and consistency' }),
        preference('timer', 'timerPreferences', { sound: true, vibration: true })
      ];
      return route.fulfill({
        status: 200,
        headers: { ...headers, 'content-range': `0-${body.length - 1}/${body.length}` },
        body: JSON.stringify(body)
      });
    }
    return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '*/0' }, body: '[]' });
  });
}

for (const identityShape of [
  { label: 'lone Jorge', profileClientId: 'jorge', expectedStatus: 'unexpected', expectedShape: 'unexpected' },
  { label: 'lone Alexa', profileClientId: 'alexa', expectedStatus: 'unexpected', expectedShape: 'unexpected' },
  { label: 'arbitrary single profile', profileClientId: 'riley', expectedStatus: 'unexpected', expectedShape: 'unexpected' },
  { label: 'valid independent-*', profileClientId: 'independent-riley', expectedStatus: 'ready', expectedShape: 'independent' }
]) {
  test(`${identityShape.label} obeys the browser identity-shape invariant`, async ({ page }) => {
    await installCloudIdentityShape(page, identityShape.profileClientId);
    await openApp(page);

    if (identityShape.expectedStatus === 'unexpected') {
      await expect(page.locator('#independentAccountOnboarding')).toBeVisible();
      await expect(page.locator('#independentAccountOnboarding')).toHaveClass(/is-blocking/);
      await expect(page.locator('#independentAccountOnboarding')).toContainText('Account setup needs attention');
    } else {
      await expect(page.locator('html')).toHaveAttribute('data-account-mode', 'independent');
      await expect(page.locator('#independentAccountOnboarding')).toBeHidden();
    }

    let result = null;
    await expect.poll(async () => {
      try {
        result = await page.evaluate(async () => {
          const state = await BigGainsSupabase.readAccountState();
          const owner = { account: state.account, profiles: state.profiles };
          let runtimeRecord = null;
          let runtimeError = null;
          try { runtimeRecord = bigGainsAccounts.cloudRuntimeRecord(owner, state.authUserId); }
          catch (error) { runtimeError = error.message; }
          return {
            status: state.status,
            stateShape: state.shape || null,
            classifiedShape: bigGainsAccounts.cloudProfileShape(state.profiles),
            runtimeKind: runtimeRecord?.kind || null,
            runtimeError,
            ownerMatchesRuntime: bigGainsAccounts.matchesCloudOwner(owner, state.authUserId)
          };
        });
        return [result.status, result.runtimeKind, result.ownerMatchesRuntime];
      } catch { return null; }
    }).toEqual(identityShape.expectedStatus === 'ready'
      ? ['ready', 'independent', true]
      : ['unexpected', null, false]);

    expect(result.status).toBe(identityShape.expectedStatus);
    expect(result.stateShape).toBe(identityShape.expectedStatus === 'ready' ? identityShape.expectedShape : null);
    expect(result.classifiedShape).toBe(identityShape.expectedShape);
    if (identityShape.expectedStatus === 'ready') {
      expect(result).toMatchObject({ runtimeKind: 'independent', runtimeError: null, ownerMatchesRuntime: true });
    } else {
      expect(result.runtimeKind).toBeNull();
      expect(result.runtimeError).toContain('one independent-* profile');
      expect(result.ownerMatchesRuntime).toBe(false);
    }
  });
}

test('independent runtime renders one identity with cobalt performance tokens and no managed-profile or pet leakage', async ({ page }) => {
  await installIndependentRuntime(page);
  await page.addInitScript(() => {
    localStorage.setItem('big-gains-v2', 'managed-sentinel');
    localStorage.setItem('big-gains-alexa-v1', 'alexa-sentinel');
  });
  await openApp(page);

  await expect(page.locator('html')).toHaveAttribute('data-account-mode', 'independent');
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'cobalt');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'performance-dark');
  await expect(page.locator('html')).toHaveAttribute('data-pet-enabled', 'false');
  await expect(page.locator('#greeting')).toContainText('Riley');
  await expect(page.locator('.profile-switcher')).toBeHidden();
  await expect(page.locator('#profileSelect option')).toHaveCount(1);
  await expect(page.locator('#profileSelect option')).toHaveText('Riley');
  await expect(page.locator('#trainingPetCard')).toBeHidden();
  expect(await page.locator('[data-profile-only="alexa"]').evaluateAll(elements => elements.every(element => element.hidden))).toBe(true);
  await page.locator('.bottom-nav [data-view="library"]').click();
  await expect(page.locator('#routineSelect')).not.toContainText('Jorge');
  expect(await page.evaluate(() => ({
    managed: localStorage.getItem('big-gains-v2'),
    alexa: localStorage.getItem('big-gains-alexa-v1'),
    storageKey: statePersistenceApi.storageKey,
    expectedProfiles: BigGainsCloudShadow.profileIds,
    queueKey: BigGainsCloudSync.queue.key
  }))).toEqual({
    managed: 'managed-sentinel', alexa: 'alexa-sentinel', storageKey,
    expectedProfiles: [clientId], queueKey
  });
});

test('independent logging stays local first, queues only into its account namespace, survives offline reload, and reaches one-profile parity', async ({ page, context }) => {
  await installIndependentRuntime(page);
  await openApp(page);
  await page.evaluate(async ({ catalogKey, cloudAccountId, cloudProfileId, authUserId, clientId }) => {
    const records = await BigGainsCloudShadow.localRecords(clientId, state);
    localStorage.setItem(catalogKey, JSON.stringify({
      format: 'big-gains.shadow-catalog.v1', version: 1, accountId: cloudAccountId, authUserId,
      migrationId: 'synthetic-independent-baseline', adoptedAt: new Date().toISOString(),
      profiles: { [clientId]: { profileId: cloudProfileId, records: Object.fromEntries(records.map(record => [
        BigGainsCloudShadow.keyFor(record.table, record.clientId),
        { table: record.table, entityType: record.entityType, clientId: record.clientId, version: 1,
          updatedAt: '2026-08-07T18:00:00.000Z', fingerprint: record.fingerprint, tombstone: false, data: record.data }
      ])) } }
    }));
  }, { catalogKey, cloudAccountId, cloudProfileId, authUserId, clientId });
  await page.reload();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await context.setOffline(true);

  const local = await page.evaluate(() => {
    state.workouts.unshift({
      id: 'friend-offline-workout', type: 'Push',
      startedAt: '2026-08-07T17:00:00.000Z', completedAt: '2026-08-07T18:00:00.000Z',
      durationSeconds: 3600, prs: 0, exercises: []
    });
    saveState();
    return JSON.parse(localStorage.getItem(statePersistenceApi.storageKey));
  });
  expect(local.workouts[0].id).toBe('friend-offline-workout');
  await expect.poll(() => page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(1);
  const queued = await page.evaluate(() => ({
    operation: BigGainsCloudSync.queue.pending()[0],
    queue: JSON.parse(localStorage.getItem(BigGainsCloudSync.queue.key)),
    managedQueue: localStorage.getItem('big-gains-cloud-sync-queue-v1')
  }));
  expect(queued.operation.owner).toEqual({ accountId: cloudAccountId, profileId: cloudProfileId });
  expect(queued.operation.entityId).toBe('friend-offline-workout');
  expect(queued.queue.pending).toHaveLength(1);
  expect(queued.managedQueue).toBeNull();

  await page.reload({ waitUntil: 'domcontentloaded' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem(statePersistenceApi.storageKey)).workouts[0].id)).toBe('friend-offline-workout');
  expect(await page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(1);
  await context.setOffline(false);

  const parity = await page.evaluate(async ({ cloudAccountId, cloudProfileId, clientId }) => {
    const localProfiles = await BigGainsCloudShadow.readLocalProfiles();
    const rowsByTable = Object.fromEntries(BigGainsCloudShadow.tables.map(table => [table, []]));
    for (const record of localProfiles[clientId].records) {
      const row = {
        id: `cloud-${record.clientId}`, account_id: cloudAccountId, profile_id: cloudProfileId,
        client_id: record.clientId, idempotency_key: `synthetic-${record.clientId}`, version: 1,
        created_at: '2026-08-07T18:00:00.000Z', updated_at: '2026-08-07T18:00:00.000Z'
      };
      if (record.table === 'bodyweight_entries') Object.assign(row, {
        measured_at: record.data.measuredAt, weight_value: record.data.weightValue, unit: record.data.unit
      });
      else {
        row.payload = BigGainsCloudShadow.envelopeFor(record);
        if (record.table === 'workouts') row.completed_at = record.data.completedAt;
      }
      rowsByTable[record.table].push(row);
    }
    const owner = { [clientId]: { id: cloudProfileId, client_id: clientId, display_name: 'Riley' } };
    const cloud = await BigGainsCloudShadow.reconstructCloud({ rowsByTable, tombstones: [], profiles: owner, accountId: cloudAccountId });
    return BigGainsCloudShadow.compare({ localProfiles, cloud });
  }, { cloudAccountId, cloudProfileId, clientId });
  expect(parity.parity).toBe(true);
  expect(Object.keys(parity.profiles)).toEqual([clientId]);
});

test('fresh invited Auth user sees onboarding, provisions once through RPC, and reloads into isolated friend storage', async ({ page }) => {
  const now = new Date().toISOString();
  let provisioned = false;
  let rpcCalls = 0;
  await page.addInitScript(({ authUserId, now }) => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = {
      supabaseUrl: 'https://synthetic-phase4g.supabase.co',
      supabasePublishableKey: 'sb_publishable_phase4g',
      authRedirectUrl: 'https://velazquick.github.io/big-gains/'
    };
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: authUserId, role: 'authenticated', exp: expiresAt })}.synthetic`;
    localStorage.setItem('big-gains-supabase-auth-v1', JSON.stringify({
      access_token: accessToken, refresh_token: 'synthetic-refresh', token_type: 'bearer',
      expires_in: 3600, expires_at: expiresAt,
      user: { id: authUserId, aud: 'authenticated', role: 'authenticated', email: 'riley@example.test',
        email_confirmed_at: now, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: now }
    }));
  }, { authUserId, now });

  await page.route('https://synthetic-phase4g.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.includes('/rpc/bootstrap_independent_account')) {
      rpcCalls += 1;
      provisioned = true;
      return route.fulfill({ status: 200, headers, body: JSON.stringify([{
        account_id: cloudAccountId, owner_user_id: authUserId, account_display_name: 'Riley',
        profile_id: cloudProfileId, client_id: clientId, profile_display_name: 'Riley',
        pet_enabled: false, accent: 'cobalt', theme: 'performance-dark'
      }]) });
    }
    if (url.pathname.endsWith('/accounts')) {
      return route.fulfill({ status: 200, headers: { ...headers, 'content-range': provisioned ? '0-0/1' : '*/0' }, body: JSON.stringify(provisioned ? [{
        id: cloudAccountId, owner_user_id: authUserId, display_name: 'Riley', created_at: now
      }] : []) });
    }
    if (url.pathname.endsWith('/profiles')) {
      return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '0-0/1' }, body: JSON.stringify([{
        id: cloudProfileId, account_id: cloudAccountId, client_id: clientId, display_name: 'Riley',
        pet_enabled: false, accent: 'cobalt', theme: 'performance-dark', created_at: now
      }]) });
    }
    if (request.method() === 'POST' || request.method() === 'PATCH') {
      const value = request.postDataJSON() || {};
      return route.fulfill({ status: 201, headers, body: JSON.stringify([{ ...value, id: crypto.randomUUID(), created_at: now }]) });
    }
    return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '*/0' }, body: '[]' });
  });

  await openApp(page);
  await expect(page.locator('#independentAccountOnboarding')).toBeVisible();
  await expect(page.locator('#independentAccountOnboarding')).toContainText('Create your private profile');
  await expect(page.locator('#independentAccountOnboarding')).not.toContainText(/Jorge|Alexa/);
  await page.locator('#independentDisplayName').fill('Riley');
  await page.locator('#independentProfileForm button').click();
  await expect(page.locator('html')).toHaveAttribute('data-account-mode', 'independent');
  await expect(page.locator('#greeting')).toContainText('Riley');
  await expect(page.locator('#independentAccountOnboarding')).toBeHidden();
  expect(rpcCalls).toBe(1);
  const result = await page.evaluate(({ storageKey, authUserId }) => ({
    state: JSON.parse(localStorage.getItem(storageKey)),
    runtime: JSON.parse(localStorage.getItem('big-gains-runtime-accounts-v1')),
    managed: localStorage.getItem('big-gains-v2'),
    alexa: localStorage.getItem('big-gains-alexa-v1')
  }), { storageKey, authUserId });
  expect(result.state).toMatchObject({ version: 5, profileId: clientId, workouts: [], weights: [] });
  expect(result.runtime.activeAuthUserId).toBe(authUserId);
  expect(result.runtime.accounts[authUserId]).toMatchObject({ kind: 'independent', cloudAccountId, cloudProfileId, clientId });
  expect(result.managed).toBeNull();
  expect(result.alexa).toBeNull();
});

test('independent production transport recovers a lost ACK and preserves friend tombstone semantics', async ({ page }) => {
  await installIndependentRuntime(page);
  await openApp(page);
  const result = await page.evaluate(async ({ cloudAccountId, cloudProfileId, clientId }) => {
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
            const row = { ...JSON.parse(JSON.stringify(values)), id: `friend-remote-${nextId++}`, created_at: values.updated_at, updated_at: values.updated_at };
            store[table].push(row);
            return { data: JSON.parse(JSON.stringify(row)), error: null };
          }
          const index = store[table].findIndex(row => matches(row, filters));
          if (index < 0) return { data: null, error: { code: 'PGRST116', message: 'missing' } };
          store[table][index] = { ...store[table][index], ...JSON.parse(JSON.stringify(values)) };
          return { data: JSON.parse(JSON.stringify(store[table][index])), error: null };
        }
      };
      return chain;
    }
    const client = { from(table) { if (!store[table]) store[table] = []; return query(table); } };
    const owner = {
      account: { id: cloudAccountId, owner_user_id: 'synthetic-owner' },
      profiles: { [clientId]: { id: cloudProfileId, client_id: clientId, display_name: 'Riley' } }
    };
    const transport = BigGainsCloudSync.createProductionTransport({ client, owner });
    const workout = {
      id: 'friend-lost-ack', type: 'Push', startedAt: '2026-08-07T17:00:00.000Z',
      completedAt: '2026-08-07T18:00:00.000Z', durationSeconds: 3600, prs: 0, exercises: []
    };
    const record = (await BigGainsCloudShadow.localRecords(clientId, friendStateForBrowser(workout))).find(value => value.table === 'workouts');
    const upsert = BigGainsCloud.createOperation({
      owner: { accountId: cloudAccountId, profileId: cloudProfileId }, entityType: 'workouts', entityId: workout.id,
      mutation: 'upsert', version: 1, updatedAt: workout.completedAt,
      payload: BigGainsCloudShadow.envelopeFor(record), payloadFingerprint: record.fingerprint
    });
    const first = await transport.send(upsert);
    const lostAckRetry = await transport.send(upsert);
    const deletedFingerprint = await BigGainsCloudShadow.fingerprint(clientId, 'workouts', workout.id, null, true);
    const deletion = BigGainsCloud.createOperation({
      owner: { accountId: cloudAccountId, profileId: cloudProfileId }, entityType: 'workouts', entityId: workout.id,
      mutation: 'delete', version: 2, updatedAt: '2026-08-07T18:01:00.000Z', payloadFingerprint: deletedFingerprint,
      baseRevision: { version: 1, updatedAt: workout.completedAt, fingerprint: record.fingerprint, tombstone: false }
    });
    const deleted = await transport.send(deletion);
    const deleteRetry = await transport.send(deletion);
    const rowsByTable = Object.fromEntries(BigGainsCloudShadow.tables.map(table => [table, table === 'workouts' ? store.workouts : []]));
    const cloud = await BigGainsCloudShadow.reconstructCloud({ rowsByTable, tombstones: store.tombstones, profiles: owner.profiles, accountId: cloudAccountId });
    return { first, lostAckRetry, deleted, deleteRetry, workoutRows: store.workouts.length, tombstones: store.tombstones.length, current: cloud.profiles[clientId].current.length };

    function friendStateForBrowser(value) {
      return { version: 5, profileId: clientId, goals: {}, workouts: [value], weights: [], prs: {}, activeWorkout: null,
        restTimerEndsAt: null, customRoutines: {}, timerPreferences: { sound: true, vibration: true } };
    }
  }, { cloudAccountId, cloudProfileId, clientId });
  expect(result.first.ok).toBe(true);
  expect(result.lostAckRetry).toMatchObject({ ok: true, duplicate: true, remoteVersion: 1 });
  expect(result.deleted.ok).toBe(true);
  expect(result.deleteRetry).toMatchObject({ ok: true, duplicate: true, remoteVersion: 2 });
  expect(result).toMatchObject({ workoutRows: 1, tombstones: 1, current: 0 });
});
