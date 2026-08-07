import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const MIGRATION_PATH = new URL('../supabase/migrations/20260807000000_phase4b_cloud_foundation.sql', import.meta.url);
const RLS_TEST_PATH = new URL('../supabase/tests/database/phase4b_rls.test.sql', import.meta.url);

test('cloud boundary is disabled by default and makes no network request', async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.__cloudFetchCalls = [];
    window.fetch = (...args) => {
      window.__cloudFetchCalls.push(String(args[0]));
      return originalFetch(...args);
    };
  });
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa']);
  await openApp(page);

  const result = await page.evaluate(async () => ({
    enabled: BigGainsCloud.enabled,
    status: BigGainsCloud.status(),
    transport: await BigGainsCloud.transport.send({ ignored: true }),
    fetchCalls: window.__cloudFetchCalls
  }));

  expect(result.enabled).toBe(false);
  expect(result.status).toEqual({ enabled: false, configured: false, reason: 'supabase-not-configured' });
  expect(result.transport).toMatchObject({ ok: false, disabled: true });
  expect(result.fetchCalls).toEqual([]);
});

test('even supplied placeholders cannot enable Phase 4B transport', async ({ page }) => {
  await page.addInitScript(() => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = {
      supabaseUrl: 'https://example.supabase.co',
      supabasePublishableKey: 'sb_publishable_example'
    };
  });
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  expect(await page.evaluate(() => BigGainsCloud.status())).toEqual({
    enabled: false,
    configured: true,
    reason: 'phase-4b-transport-not-implemented'
  });
});

test('queued operations keep explicit account/profile ownership and stable idempotency across retries', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const input = {
      owner: { accountId: 'cloud-jorge-account', profileId: 'cloud-alexa-profile' },
      entityType: 'workouts',
      entityId: 'completed-workout-1',
      mutation: 'upsert',
      version: 3,
      updatedAt: '2026-08-07T12:00:00.000Z',
      payload: { type: 'FullBody', completedAt: '2026-08-07T11:30:00.000Z' }
    };
    const first = BigGainsCloud.createOperation(input);
    const rebuilt = BigGainsCloud.createOperation({ ...input, queuedAt: '2030-01-01T00:00:00.000Z' });
    const retry = BigGainsCloud.retryOperation(first);
    const queue = BigGainsCloud.createMemoryQueue();
    queue.enqueue(first);
    queue.enqueue(rebuilt);
    return { first, rebuilt, retry, pending: queue.pending() };
  });

  expect(result.first.owner).toEqual({ accountId: 'cloud-jorge-account', profileId: 'cloud-alexa-profile' });
  expect(result.first.idempotencyKey).toBe(result.rebuilt.idempotencyKey);
  expect(result.retry.idempotencyKey).toBe(result.first.idempotencyKey);
  expect(result.retry.attempts).toBe(1);
  expect(result.pending).toHaveLength(1);
});

test('local-first coordinator persists before enqueue and acknowledges a remote version', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(async () => {
    const events = [];
    const queue = BigGainsCloud.createMemoryQueue();
    const transport = {
      enabled: true,
      async send(operation) {
        events.push(`send:${operation.entityId}`);
        return { ok: true, remoteVersion: 8, acknowledgedAt: '2026-08-07T12:05:00.000Z' };
      }
    };
    const coordinator = BigGainsCloud.createLocalFirstCoordinator({
      owner: { accountId: 'cloud-jorge-account', profileId: 'cloud-jorge-profile' },
      queue,
      transport,
      persistLocal: async (_value, operation) => events.push(`local:${operation.entityId}`)
    });
    const operation = await coordinator.mutate({
      entityType: 'preferences', entityId: 'timer', mutation: 'upsert', version: 7,
      updatedAt: '2026-08-07T12:00:00.000Z', payload: { sound: true }, localValue: { sound: true }
    });
    events.push(`queued:${queue.pending().length}`);
    const sync = await coordinator.syncQuietly({ online: true });
    return { events, sync, pending: queue.pending(), acknowledgement: queue.acknowledgement(operation.idempotencyKey) };
  });

  expect(result.events).toEqual(['local:timer', 'queued:1', 'send:timer']);
  expect(result.sync).toEqual({ ok: true, sent: 1 });
  expect(result.pending).toEqual([]);
  expect(result.acknowledgement).toMatchObject({ remoteVersion: 8, acknowledgedAt: '2026-08-07T12:05:00.000Z' });
});

test('disabled and offline sync paths keep the queue without transport work', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(async () => {
    const queue = BigGainsCloud.createMemoryQueue();
    const coordinator = BigGainsCloud.createLocalFirstCoordinator({
      owner: { accountId: 'cloud-jorge-account', profileId: 'cloud-jorge-profile' },
      queue,
      persistLocal: () => undefined
    });
    await coordinator.mutate({
      entityType: 'active_sessions', entityId: 'active-1', mutation: 'upsert', version: 1,
      updatedAt: '2026-08-07T12:00:00.000Z', payload: {}, localValue: {}
    });
    return {
      offline: await coordinator.syncQuietly({ online: false }),
      disabled: await coordinator.syncQuietly({ online: true }),
      pending: queue.pending().length
    };
  });

  expect(result.offline).toEqual({ ok: false, offline: true, sent: 0 });
  expect(result.disabled).toMatchObject({ ok: true, disabled: true, sent: 0 });
  expect(result.pending).toBe(1);
});

test('stale remote state cannot replace a newer local edit', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const base = {
      owner: { accountId: 'cloud-jorge-account', profileId: 'cloud-jorge-profile' },
      entityType: 'routines', entityId: 'push-routine', mutation: 'upsert'
    };
    return {
      staleVersion: BigGainsCloud.resolveConflict({
        entityType: 'routines',
        local: { ...base, version: 4, updatedAt: '2026-08-07T12:00:00.000Z' },
        remote: { ...base, version: 3, updatedAt: '2026-08-07T13:00:00.000Z' }
      }),
      staleTimestamp: BigGainsCloud.resolveConflict({
        entityType: 'routines',
        local: { ...base, version: 4, updatedAt: '2026-08-07T12:00:00.000Z' },
        remote: { ...base, version: 4, updatedAt: '2026-08-07T11:00:00.000Z' }
      })
    };
  });

  expect(result.staleVersion).toEqual({ winner: 'local', applyRemote: false, reason: 'stale-remote-version' });
  expect(result.staleTimestamp).toEqual({ winner: 'local', applyRemote: false, reason: 'stale-remote-timestamp' });
});

test('tombstones win equal revisions while newer edits beat stale deletions', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const base = {
      owner: { accountId: 'cloud-jorge-account', profileId: 'cloud-alexa-profile' },
      entityType: 'preferences', entityId: 'timer', updatedAt: '2026-08-07T12:00:00.000Z'
    };
    return {
      tie: BigGainsCloud.resolveConflict({
        entityType: 'preferences',
        local: { ...base, mutation: 'upsert', version: 5 },
        remote: { ...base, mutation: 'delete', tombstone: true, version: 5 }
      }),
      staleDelete: BigGainsCloud.resolveConflict({
        entityType: 'preferences',
        local: { ...base, mutation: 'upsert', version: 6 },
        remote: { ...base, mutation: 'delete', tombstone: true, version: 5 }
      })
    };
  });

  expect(result.tie).toEqual({ winner: 'remote', applyRemote: true, reason: 'tombstone-wins-tie' });
  expect(result.staleDelete).toEqual({ winner: 'local', applyRemote: false, reason: 'stale-remote-version' });
});

test('completed workout ties remain append-only and ownership cannot be forged', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const local = {
      owner: { accountId: 'cloud-jorge-account', profileId: 'cloud-jorge-profile' },
      entityType: 'workouts', entityId: 'workout-1', mutation: 'upsert', version: 1,
      updatedAt: '2026-08-07T12:00:00.000Z'
    };
    let ownershipError = '';
    try {
      BigGainsCloud.resolveConflict({
        entityType: 'workouts', local,
        remote: { ...local, owner: { accountId: 'cloud-friend-account', profileId: 'cloud-jorge-profile' } }
      });
    } catch (error) {
      ownershipError = error.message;
    }
    return {
      tie: BigGainsCloud.resolveConflict({ entityType: 'workouts', local, remote: { ...local } }),
      ownershipError
    };
  });

  expect(result.tie).toEqual({ winner: 'local', applyRemote: false, reason: 'append-only-local-tie' });
  expect(result.ownershipError).toContain('ownership is immutable');
});

test('Jorge, Alexa, and a friend account remain separate in queued cloud ownership', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa']);
  await openApp(page);

  const owners = await page.evaluate(() => {
    const create = (accountId, profileId, entityId) => BigGainsCloud.createOperation({
      owner: { accountId, profileId }, entityType: 'workouts', entityId, mutation: 'upsert', version: 1,
      updatedAt: '2026-08-07T12:00:00.000Z', payload: {}
    }).owner;
    return [
      create('cloud-jorge-account', 'cloud-jorge-profile', 'jorge-workout'),
      create('cloud-jorge-account', 'cloud-alexa-profile', 'alexa-workout'),
      create('cloud-friend-account', 'cloud-friend-profile', 'friend-workout')
    ];
  });

  expect(owners).toEqual([
    { accountId: 'cloud-jorge-account', profileId: 'cloud-jorge-profile' },
    { accountId: 'cloud-jorge-account', profileId: 'cloud-alexa-profile' },
    { accountId: 'cloud-friend-account', profileId: 'cloud-friend-profile' }
  ]);
});

test('cloud contract use does not alter local state, backup, or snapshot formats', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);
  const before = await readStoredJson(page, STORAGE_KEYS.jorge);

  const result = await page.evaluate(async () => {
    const queue = BigGainsCloud.createMemoryQueue();
    const coordinator = BigGainsCloud.createLocalFirstCoordinator({
      owner: { accountId: 'future-only-account', profileId: 'future-only-profile' }, queue,
      persistLocal: () => undefined
    });
    await coordinator.mutate({
      entityType: 'workouts', entityId: 'future-only-workout', mutation: 'upsert', version: 1,
      updatedAt: '2026-08-07T12:00:00.000Z', payload: {}, localValue: {}
    });
    return {
      backup: JSON.parse(statePersistenceApi.prepareExport(state).json),
      snapshot: BigGainsSync.buildSnapshot(),
      version: state.version
    };
  });

  expect(result.backup).toEqual(before);
  expect(result.version).toBe(5);
  expect(result.snapshot.schema).toBe('big-gains.snapshot.v1');
  expect(result.snapshot.source.stateVersion).toBe(5);
  expect(await readStoredJson(page, STORAGE_KEYS.jorge)).toEqual(before);
});

test('cloud status, queue, and conflict evaluation perform no browser storage writes', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const writes = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    const calls = [];
    Storage.prototype.setItem = function (key, value) {
      calls.push({ key, value });
      return original.call(this, key, value);
    };
    try {
      BigGainsCloud.status();
      const queue = BigGainsCloud.createMemoryQueue();
      queue.enqueue(BigGainsCloud.createOperation({
        owner: { accountId: 'a', profileId: 'p' }, entityType: 'preferences', entityId: 'timer',
        mutation: 'upsert', version: 1, updatedAt: '2026-08-07T12:00:00.000Z', payload: {}
      }));
      return calls;
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  expect(writes).toEqual([]);
});

test('Supabase schema enables RLS everywhere and adversarial examples cover cross-account denial', async () => {
  const migration = await readFile(MIGRATION_PATH, 'utf8');
  const adversarial = await readFile(RLS_TEST_PATH, 'utf8');
  const tables = ['accounts', 'profiles', 'workouts', 'routines', 'preferences', 'active_sessions', 'sync_metadata', 'tombstones'];

  for (const table of tables) {
    expect(migration).toContain(`alter table public.${table} enable row level security;`);
    expect(migration).toContain(`alter table public.${table} force row level security;`);
  }
  expect(migration).toContain('private.owns_account(account_id)');
  expect(migration).toContain('foreign key (account_id, profile_id)');
  expect(migration).toContain('from public, anon;');
  expect(migration).toContain('unique (account_id, profile_id, client_id)');
  expect(migration).toContain('unique (account_id, idempotency_key)');
  expect(adversarial).toContain('Jorge sees both Jorge and Alexa profiles');
  expect(adversarial).toContain('friend workout is invisible to Jorge');
  expect(adversarial).toContain('Jorge cannot insert into the friend account');
  expect(adversarial).toContain('a profile id from another account cannot be paired');
  expect(adversarial).toContain('anonymous users have no table access');
});

test('browser cloud module contains no transport, SDK, or privileged credential path', async () => {
  const source = await readFile(new URL('../cloud-storage.js', import.meta.url), 'utf8');
  const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

  expect(source).not.toMatch(/\bfetch\s*\(/);
  expect(source).not.toContain('createClient(');
  expect(source).not.toMatch(/service[_-]?role/i);
  expect(envExample.trim().split('\n').filter(line => !line.startsWith('#'))).toEqual([
    'SUPABASE_URL=',
    'SUPABASE_PUBLISHABLE_KEY='
  ]);
});
