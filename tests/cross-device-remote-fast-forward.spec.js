import { expect, test } from '@playwright/test';
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

function profileState(primary) {
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
    timerPreferences: { sound: true, vibration: true }
  };
}

async function installReceiver(page, primary = 'Shared baseline') {
  const state = profileState(primary);
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
  const { remotePrimary, goalVersion = 2, goalUpdatedAt = advancedAt } = options;
  const now = advancedAt;
  await page.addInitScript(({ authUserId, now }) => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = {
      supabaseUrl: 'https://synthetic-cross-device.supabase.co',
      supabasePublishableKey: 'sb_publishable_cross_device'
    };
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
  }, { authUserId, now });

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
    if (!['GET', 'HEAD'].includes(request.method())) {
      writes.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 500, headers, body: JSON.stringify({ message: 'Fast-forward must not write cloud data.' }) });
    }
    const table = url.pathname.split('/').pop();
    const rows = table === 'accounts' ? [{
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
          }
        ] : [];
    return route.fulfill({
      status: 200,
      headers: { ...headers, 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' },
      body: request.method() === 'HEAD' ? '' : JSON.stringify(rows)
    });
  });
  return writes;
}

async function expectRemoteFastForward(page, expectedPrimary) {
  await page.locator('.bottom-nav [data-view="library"]').click();
  await expect(page.locator('#cloudShadowHeading')).toHaveText('Changes from another device');
  await expect(page.locator('#cloudRemoteFastForward')).toBeVisible();
  await expect(page.locator('#cloudRemoteFastForward')).toHaveText('Update this device');
  expect(await page.evaluate(() => BigGainsCloudSync.status().remoteFastForward)).toMatchObject({
    eligible: true,
    conflict: false,
    reason: 'newer-remote-revisions',
    advancedRevisions: 1
  });

  const reloaded = page.waitForEvent('framenavigated');
  await page.locator('#cloudRemoteFastForward').click();
  await reloaded;
  await expect.poll(() => page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)).goals.primary, storageKey)).toBe(expectedPrimary);
  await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');
  const result = await page.evaluate(({ storageKey, catalogKey, clientId }) => ({
    state: JSON.parse(localStorage.getItem(storageKey)),
    catalog: JSON.parse(localStorage.getItem(catalogKey)),
    queuePending: BigGainsCloudSync.queue.pending().length,
    comparison: BigGainsCloudSync.status().lastComparison,
    goalKey: BigGainsCloudShadow.keyFor('preferences', 'goals'),
    clientId
  }), { storageKey, catalogKey, clientId });
  expect(result.state).toMatchObject({ version: 5, profileId: clientId, goals: { primary: expectedPrimary } });
  expect(result.catalog.profiles[result.clientId].records[result.goalKey]).toMatchObject({ version: 2, tombstone: false });
  expect(result.catalog.migrationId).toBe('cross-device-baseline');
  expect(result.queuePending).toBe(0);
  expect(result.comparison.parity).toBe(true);
}

for (const direction of [
  { label: 'PC to mobile', remotePrimary: 'PC remote advancement' },
  { label: 'mobile to PC', remotePrimary: 'Mobile remote advancement' }
]) {
  test(`${direction.label} offers and applies a guarded remote fast-forward`, async ({ page }) => {
    await installReceiver(page);
    const writes = await installAuthenticatedCloud(page, direction.remotePrimary);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await expectRemoteFastForward(page, direction.remotePrimary);
    expect(writes).toEqual([]);
  });
}

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

test('equal revision with a different fingerprint remains drift and cannot fast-forward', async ({ page }) => {
  await installReceiver(page);
  const writes = await installAuthenticatedCloud(page, {
    remotePrimary: 'Equal-version tamper',
    goalVersion: 1,
    goalUpdatedAt: baselineAt
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  await expect(page.locator('#cloudShadowHeading')).toHaveText('DRIFT DETECTED');
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
