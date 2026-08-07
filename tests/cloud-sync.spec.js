import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const configured = {
  supabaseUrl: 'https://synthetic-project.supabase.co',
  supabasePublishableKey: 'sb_publishable_synthetic_test'
};

test('durable queue survives reload outside the schema-v5 backup object', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);
  const before = await readStoredJson(page, STORAGE_KEYS.jorge);

  const operation = await page.evaluate(() => {
    const value = BigGainsCloud.createOperation({
      owner: { accountId: 'synthetic-account', profileId: 'synthetic-profile' },
      entityType: 'workouts', entityId: 'synthetic-workout-durable', mutation: 'upsert', version: 1,
      updatedAt: '2026-08-07T18:00:00.000Z', completedAt: '2026-08-07T18:00:00.000Z',
      payload: { id: 'synthetic-workout-durable', completedAt: '2026-08-07T18:00:00.000Z' }, synthetic: true
    });
    BigGainsCloudSync.queue.enqueue(value);
    return value;
  });
  await page.reload();

  const restored = await page.evaluate(key => ({
    pending: BigGainsCloudSync.queue.pending(),
    queueDocument: JSON.parse(localStorage.getItem(key)),
    backup: JSON.parse(statePersistenceApi.prepareExport(state).json)
  }), 'big-gains-cloud-sync-queue-v1');
  expect(restored.pending).toHaveLength(1);
  expect(restored.pending[0].idempotencyKey).toBe(operation.idempotencyKey);
  expect(restored.pending[0].owner).toEqual({ accountId: 'synthetic-account', profileId: 'synthetic-profile' });
  expect(restored.queueDocument.version).toBe(1);
  expect(restored.backup).toEqual(before);
  expect(await readStoredJson(page, STORAGE_KEYS.jorge)).toEqual(before);
});

test('synthetic completed workout persists locally before enqueue and remote failure is harmless', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(async () => {
    const events = [];
    const synthetic = {
      id: 'synthetic-local-first', type: 'Push', completedAt: '2026-08-07T18:00:00.000Z',
      updatedAt: '2026-08-07T18:00:00.000Z', exercises: []
    };
    const operation = await BigGainsCloudSync.enqueueSyntheticCompletedWorkout({
      owner: { accountId: 'synthetic-account', profileId: 'synthetic-profile' },
      workout: synthetic,
      persistLocal(workout) {
        events.push(`local:${workout.id}`);
        localStorage.setItem('big-gains-synthetic-proof-v1', JSON.stringify(workout));
      }
    });
    events.push(`queued:${BigGainsCloudSync.queue.pending().length}`);
    const runtime = BigGainsCloudSync.createSyncRuntime({
      durableQueue: BigGainsCloudSync.queue,
      transport: { enabled: true, async send() { events.push('remote:failed'); throw new Error('synthetic outage'); } },
      isOnline: () => true
    });
    const sync = await runtime.flush();
    return {
      events, operation, sync,
      local: JSON.parse(localStorage.getItem('big-gains-synthetic-proof-v1')),
      pending: BigGainsCloudSync.queue.pending()
    };
  });

  expect(result.events).toEqual(['local:synthetic-local-first', 'queued:1', 'remote:failed']);
  expect(result.local.id).toBe('synthetic-local-first');
  expect(result.sync).toMatchObject({ ok: false, failed: 1, pending: 1 });
  expect(result.pending[0].attempts).toBe(1);
  expect(result.pending[0].idempotencyKey).toBe(result.operation.idempotencyKey);
});

test('offline reconnect retry produces exactly one synthetic remote row and acknowledgement', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(async () => {
    const queueKey = 'phase4c-proof-queue';
    localStorage.removeItem(queueKey);
    const proofQueue = BigGainsCloud.createDurableQueue({ storage: localStorage, key: queueKey });
    const operation = BigGainsCloud.createOperation({
      owner: { accountId: 'synthetic-account', profileId: 'synthetic-profile' },
      entityType: 'workouts', entityId: 'synthetic-exactly-once', mutation: 'upsert', version: 1,
      updatedAt: '2026-08-07T18:00:00.000Z',
      payload: { id: 'synthetic-exactly-once', completedAt: '2026-08-07T18:00:00.000Z' }, synthetic: true
    });
    proofQueue.enqueue(operation);
    const rows = [];
    const client = {
      from() {
        return {
          insert(row) {
            return { select() { return { async single() {
              const duplicate = rows.find(value => value.client_id === row.client_id);
              if (duplicate) return { data: null, error: { code: '23505', message: 'duplicate' } };
              const stored = { ...row, id: 'remote-synthetic-row' };
              rows.push(stored);
              return { data: stored, error: null };
            } }; } };
          },
          select() {
            const filters = {};
            const chain = {
              eq(name, value) { filters[name] = value; return chain; },
              async maybeSingle() {
                const data = rows.find(row => Object.entries(filters).every(([name, value]) => row[name] === value)) || null;
                return { data, error: null };
              }
            };
            return chain;
          }
        };
      }
    };
    const completedTransport = BigGainsCloudSync.createCompletedWorkoutTransport({ client });
    let loseFirstAcknowledgement = true;
    const lossyTransport = {
      enabled: true,
      async send(value) {
        const response = await completedTransport.send(value);
        if (loseFirstAcknowledgement) {
          loseFirstAcknowledgement = false;
          return { ok: false, reason: 'acknowledgement-lost' };
        }
        return response;
      }
    };
    let online = false;
    const runtime = BigGainsCloudSync.createSyncRuntime({ durableQueue: proofQueue, transport: lossyTransport, isOnline: () => online });
    const offline = await runtime.flush();
    online = true;
    const first = await runtime.flush();
    const retryKey = proofQueue.pending()[0].idempotencyKey;
    const second = await runtime.flush();
    const third = await runtime.flush();
    return {
      offline, first, second, third, rows,
      acknowledgement: proofQueue.acknowledgement(operation.idempotencyKey),
      originalKey: operation.idempotencyKey,
      retryKey
    };
  });

  expect(result.offline).toMatchObject({ offline: true, sent: 0, pending: 1 });
  expect(result.first).toMatchObject({ ok: false, failed: 1, pending: 1 });
  expect(result.retryKey).toBe(result.originalKey);
  expect(result.second).toMatchObject({ ok: true, sent: 1, pending: 0 });
  expect(result.third).toMatchObject({ ok: true, sent: 0, pending: 0 });
  expect(result.rows).toHaveLength(1);
  expect(result.acknowledgement).toMatchObject({ remoteId: 'remote-synthetic-row', remoteVersion: 1 });
});

test('completed-workout transport rejects real operations before a client call', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  const result = await page.evaluate(async () => {
    let calls = 0;
    const client = { from() { calls += 1; throw new Error('must not be reached'); } };
    const transport = BigGainsCloudSync.createCompletedWorkoutTransport({ client });
    const operation = BigGainsCloud.createOperation({
      owner: { accountId: 'jorge-account', profileId: 'jorge-profile' }, entityType: 'workouts',
      entityId: 'real-workout', mutation: 'upsert', version: 1, updatedAt: '2026-08-07T18:00:00.000Z',
      payload: { completedAt: '2026-08-07T18:00:00.000Z' }
    });
    return { response: await transport.send(operation), calls };
  });
  expect(result).toEqual({ response: { ok: false, rejected: true, reason: 'synthetic-only' }, calls: 0 });
});

test('Jorge magic-link auth disables signup and uses the GitHub Pages redirect', async ({ page }) => {
  await page.addInitScript(value => { window.__BIG_GAINS_CLOUD_CONFIG__ = value; }, configured);
  let requestBody = null;
  let requestUrl = null;
  await page.route('**/auth/v1/otp**', async route => {
    requestBody = route.request().postDataJSON();
    requestUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: '{}'
    });
  });
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#cloudAuthEmail').fill('jorge.synthetic@example.com');
  await page.locator('#cloudAuthForm button').click();
  await expect(page.locator('#cloudAuthDetail')).toContainText('Check Jorge’s email');
  expect(requestBody).toMatchObject({
    email: 'jorge.synthetic@example.com',
    create_user: false
  });
  expect(new URL(requestUrl).searchParams.get('redirect_to')).toBe('https://velazquick.github.io/big-gains/');
});
