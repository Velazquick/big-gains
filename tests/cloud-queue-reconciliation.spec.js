import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const authUserId = '84000000-0000-0000-0000-000000000001';
const accountId = '84a00000-0000-0000-0000-000000000001';
const profiles = {
  jorge: { id: '84b00000-0000-0000-0000-000000000001', account_id: accountId, client_id: 'jorge', display_name: 'Jorge', pet_enabled: true, accent: 'ember', theme: 'performance-dark' },
  alexa: { id: '84b00000-0000-0000-0000-000000000002', account_id: accountId, client_id: 'alexa', display_name: 'Alexa', pet_enabled: true, accent: 'rose', theme: 'wellness-light' }
};

async function installAuthenticatedSessionForReload(page) {
  const now = '2026-08-08T01:00:00.000Z';
  await page.addInitScript(({ authUserId, accountId, now }) => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = {
      supabaseUrl: 'https://synthetic-phase4fg-reconciliation.supabase.co',
      supabasePublishableKey: 'sb_publishable_phase4fg_reconciliation'
    };
    const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem('big-gains-supabase-auth-v1', JSON.stringify({
      access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: authUserId, role: 'authenticated', exp: expiresAt })}.synthetic`,
      refresh_token: 'synthetic-reconciliation-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
      user: { id: authUserId, aud: 'authenticated', role: 'authenticated', email: 'queue@example.test',
        email_confirmed_at: now, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: now }
    }));
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: { [authUserId]: { kind: 'managed', authUserId, cloudAccountId: accountId, expectedProfileIds: ['jorge', 'alexa'] } }
    }));
  }, { authUserId, accountId, now });
}

test('profile parity true safely reconciles stale superseded pending operations after verified readback', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa']);
  await openApp(page);

  const fixture = await page.evaluate(async ({ accountId, profiles, authUserId }) => {
    const states = {
      jorge: JSON.parse(localStorage.getItem('big-gains-v2')),
      alexa: JSON.parse(localStorage.getItem('big-gains-alexa-v1'))
    };
    const localProfiles = {};
    const rowsByTable = Object.fromEntries(BigGainsCloudShadow.tables.map(table => [table, []]));
    for (const profileClientId of BigGainsCloudShadow.profileIds) {
      const records = await BigGainsCloudShadow.localRecords(profileClientId, states[profileClientId]);
      localProfiles[profileClientId] = { records };
      for (const record of records) {
        const isFinalGoal = profileClientId === 'jorge' && record.table === 'preferences' && record.clientId === 'goals';
        const version = isFinalGoal ? 3 : 1;
        const updatedAt = isFinalGoal ? '2026-08-08T00:03:00.000Z' : '2026-08-08T00:01:00.000Z';
        rowsByTable[record.table].push({
          id: `${profileClientId}-${record.table}-${record.clientId}`,
          account_id: accountId,
          profile_id: profiles[profileClientId].id,
          client_id: record.clientId,
          idempotency_key: isFinalGoal ? 'already-applied-newest-operation' : `migration-${profileClientId}-${record.clientId}`,
          payload: BigGainsCloudShadow.envelopeFor(record),
          version,
          created_at: '2026-08-08T00:01:00.000Z',
          updated_at: updatedAt
        });
      }
    }
    const cloudState = await BigGainsCloudShadow.reconstructCloud({ rowsByTable, tombstones: [], profiles, accountId });
    const comparison = await BigGainsCloudShadow.compare({ localProfiles, cloud: cloudState });
    const journal = {
      id: 'journal', account_id: accountId, profile_id: profiles.jorge.id, client_id: 'migration:baseline',
      metadata: { format: 'big-gains.migration-journal.v1', migrationContract: 'big-gains.migration.v1', migrationId: 'migration-baseline', status: 'complete' },
      version: 1, created_at: '2026-08-08T00:00:00.000Z', updated_at: '2026-08-08T00:00:00.000Z'
    };
    const owner = { account: { id: accountId, owner_user_id: authUserId }, profiles };
    const catalog = BigGainsCloudShadow.catalogFromCloud({ cloud: cloudState, owner, journal });
    localStorage.setItem(BigGainsCloudSync.catalogKey, JSON.stringify(catalog));

    const stateFor = primary => ({ ...states.jorge, goals: { primary } });
    const oldRecord = (await BigGainsCloudShadow.localRecords('jorge', stateFor('Old goal'))).find(record => record.table === 'preferences' && record.clientId === 'goals');
    const middleRecord = (await BigGainsCloudShadow.localRecords('jorge', stateFor('Intermediate goal'))).find(record => record.table === 'preferences' && record.clientId === 'goals');
    const finalRecord = localProfiles.jorge.records.find(record => record.table === 'preferences' && record.clientId === 'goals');
    const ownerIds = { accountId, profileId: profiles.jorge.id };
    const stale = BigGainsCloud.createOperation({
      owner: ownerIds, entityType: 'preferences', entityId: 'goals', mutation: 'upsert', version: 2,
      updatedAt: '2026-08-08T00:02:00.000Z', payload: BigGainsCloudShadow.envelopeFor(middleRecord), payloadFingerprint: middleRecord.fingerprint,
      baseRevision: { version: 1, updatedAt: '2026-08-08T00:01:00.000Z', fingerprint: oldRecord.fingerprint, tombstone: false }
    });
    const newest = BigGainsCloud.createOperation({
      owner: ownerIds, entityType: 'preferences', entityId: 'goals', mutation: 'upsert', version: 3,
      updatedAt: '2026-08-08T00:03:00.000Z', payload: BigGainsCloudShadow.envelopeFor(finalRecord), payloadFingerprint: finalRecord.fingerprint,
      baseRevision: { version: 2, updatedAt: '2026-08-08T00:02:00.000Z', fingerprint: middleRecord.fingerprint, tombstone: false }
    });
    BigGainsCloudSync.queue.enqueue(stale);
    BigGainsCloudSync.queue.enqueue(newest);
    return { rowsByTable, journal, parity: comparison.parity, operationKeys: [stale.idempotencyKey, newest.idempotencyKey] };
  }, { accountId, profiles, authUserId });

  expect(fixture.parity).toBe(true);
  expect(await page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(2);

  await installAuthenticatedSessionForReload(page);
  const applicationWrites = [];
  await page.route('https://synthetic-phase4fg-reconciliation.supabase.co/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/auth/v1/user')) {
      return route.fulfill({ status: 200, headers, body: JSON.stringify({
        id: authUserId, aud: 'authenticated', role: 'authenticated', email: 'queue@example.test',
        email_confirmed_at: '2026-08-08T01:00:00.000Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-08-08T01:00:00.000Z'
      }) });
    }
    if (!['GET', 'HEAD'].includes(request.method())) {
      applicationWrites.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 500, headers, body: JSON.stringify({ message: 'reconciliation must not write' }) });
    }
    const table = url.pathname.split('/').pop();
    const body = table === 'accounts'
      ? [{ id: accountId, owner_user_id: authUserId, display_name: 'Managed account', created_at: '2026-08-08T00:00:00.000Z' }]
      : table === 'profiles' ? Object.values(profiles)
        : table === 'tombstones' ? []
          : table === 'sync_metadata' ? [fixture.journal]
            : fixture.rowsByTable[table] || [];
    return route.fulfill({
      status: 200,
      headers: { ...headers, 'content-range': body.length ? `0-${body.length - 1}/${body.length}` : '*/0' },
      body: request.method() === 'HEAD' ? '' : JSON.stringify(body)
    });
  });

  await page.reload();
  await expect.poll(() => page.evaluate(() => BigGainsCloudSync.queue.pending().length)).toBe(0);
  await expect(page.locator('#cloudShadowHeading')).toHaveText('In sync');
  await expect(page.locator('#cloudQueueStatus')).toContainText('Reconciled 2 obsolete queued changes after verified readback');

  const recovered = await page.evaluate(operationKeys => ({
    status: BigGainsCloudSync.status(),
    acknowledgements: operationKeys.map(key => BigGainsCloudSync.queue.acknowledgement(key))
  }), fixture.operationKeys);
  expect(recovered.status.lastComparison.parity).toBe(true);
  expect(recovered.status.lastResult).toMatchObject({ ok: true, pending: 0, reconciled: 2, reconciledEntities: 1 });
  expect(recovered.acknowledgements).toEqual([
    expect.objectContaining({ reason: 'semantic-state-already-current', reconciled: true, remoteVersion: 3 }),
    expect.objectContaining({ reason: 'semantic-state-already-current', reconciled: true, remoteVersion: 3 })
  ]);
  expect(applicationWrites).toEqual([]);

  await page.evaluate(({ accountId }) => {
    BigGainsCloudSync.queue.enqueue(BigGainsCloud.createOperation({
      owner: { accountId: `${accountId}-wrong`, profileId: 'wrong-profile' },
      entityType: 'preferences', entityId: 'goals', mutation: 'upsert', version: 1,
      updatedAt: '2026-08-08T00:04:00.000Z', payload: { synthetic: 'mapping mismatch' }
    }));
  }, { accountId });
  const blocked = await page.evaluate(() => BigGainsCloudSync.flush());
  expect(blocked).toMatchObject({ ok: false, blocked: true, reason: 'queue-owner-mismatch', pending: 1 });
  await expect(page.locator('#cloudShadowHeading')).toHaveText('DRIFT DETECTED');
  await expect(page.locator('#cloudAuthDetail')).toContainText('queue-owner-mismatch');
  await expect(page.locator('#cloudShadowDriftList')).toContainText('queue-owner-mismatch');
});

test('a failed revision blocks later operations only for the same logical entity and reports the exact reason', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  const result = await page.evaluate(async () => {
    const queue = BigGainsCloud.createMemoryQueue();
    const make = (entityId, version) => BigGainsCloud.createOperation({
      owner: { accountId: 'account', profileId: 'profile' }, entityType: 'preferences', entityId,
      mutation: 'upsert', version, updatedAt: `2026-08-08T00:0${version}:00.000Z`, payload: { version }
    });
    const first = make('goals', 2);
    const superseding = make('goals', 3);
    const independentEntity = make('timer', 2);
    [first, superseding, independentEntity].forEach(operation => queue.enqueue(operation));
    const calls = [];
    const runtime = BigGainsCloudSync.createSyncRuntime({
      durableQueue: queue,
      transport: {
        enabled: true,
        async send(operation) {
          calls.push(`${operation.entityId}:v${operation.version}`);
          if (operation.idempotencyKey === first.idempotencyKey) {
            return { ok: false, blocked: true, reason: 'remote-revision-conflict' };
          }
          return { ok: true, remoteVersion: operation.version };
        }
      }
    });
    return { sync: await runtime.flush(), calls, pending: queue.pending(), timerAck: queue.acknowledgement(independentEntity.idempotencyKey) };
  });

  expect(result.calls).toEqual(['goals:v2', 'timer:v2']);
  expect(result.sync).toMatchObject({
    ok: false, blocked: true, failed: 1, deferred: 1, pending: 2, reason: 'remote-revision-conflict'
  });
  expect(result.sync.failures[0]).toMatchObject({ entityType: 'preferences', entityId: 'goals', version: 2, reason: 'remote-revision-conflict', blocked: true });
  expect(result.pending.map(operation => `${operation.entityId}:v${operation.version}`)).toEqual(['goals:v2', 'goals:v3']);
  expect(result.timerAck.remoteVersion).toBe(2);
});
