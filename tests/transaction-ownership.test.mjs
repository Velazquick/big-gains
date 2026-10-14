import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const descriptor = { accountId: 'synthetic-account', profileId: 'synthetic-profile', storageKey: 'synthetic-profile-state' };
const keys = { catalog: 'synthetic-catalog', comparison: 'synthetic-comparison', queue: 'synthetic-queue' };
const adoptionKey = `${keys.catalog}-automatic-adoption-v1`;
const history = id => ({ id, type: 'Push', completedAt: '2026-10-14T12:00:00.000Z', exercises: [{ name: 'Bench', sets: [{ weight: 100, reps: 8, completed: true }] }] });
const profile = (id = descriptor.profileId) => JSON.stringify({ version: 5, profileId: id, goals: {}, workouts: [history('retained-history')], weights: [], activeWorkout: null, customRoutines: {}, restTimerEndsAt: null });
const oldQueue = JSON.stringify({ version: 1, pending: [], acknowledgements: [] });
const newQueue = JSON.stringify({ version: 1, pending: [{ idempotencyKey: 'synthetic-newer-pending' }], acknowledgements: [] });

function fixture({ newerKey = null, beforeProfile = profile(), candidateProfile = null, failKey = null, duringWrite = null, kind = 'independent' } = {}) {
  const candidate = candidateProfile || JSON.stringify({ ...JSON.parse(beforeProfile), goals: { primary: 'candidate' } });
  const snapshots = [
    { key: descriptor.storageKey, before: beforeProfile, candidate },
    { key: keys.catalog, before: '{"revision":1}', candidate: '{"revision":2}' },
    { key: keys.comparison, before: '{"parity":false}', candidate: '{"parity":true}' },
    // Version-1 journals used null for the untouched queue, not a deletion.
    { key: keys.queue, before: oldQueue, candidate: null }
  ];
  const intent = JSON.stringify({ format: 'big-gains.automatic-adoption.v1', version: 1, createdAt: '2026-10-14T11:00:00.000Z', snapshots });
  const storage = new Map(snapshots.map(s => [s.key, s.key === keys.queue ? s.before : s.candidate]));
  storage.set(adoptionKey, intent);
  if (newerKey === keys.queue) storage.set(newerKey, newQueue);
  else if (newerKey) storage.set(newerKey, JSON.stringify({ ...JSON.parse(candidate), workouts: [history('new-durable-history'), history('retained-history')], activeWorkout: { id: 'new-active', type: 'Push', startedAt: '2026-10-14T12:30:00.000Z', exercises: [{ name: 'Bench', sets: [] }] } }));
  const writes = []; let failure = failKey;
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem(key, value) { if (failure === key) { failure = null; throw Error('synthetic interrupted rollback'); } writes.push(key); storage.set(key, String(value)); duringWrite?.(key, storage); },
    removeItem(key) { if (failure === key) { failure = null; throw Error('synthetic interrupted removal'); } writes.push(key); storage.delete(key); }
  };
  function load() {
    const scope = { console, localStorage, addEventListener() {}, navigator: { locks: { request: async (_name, _options, callback) => callback({ name: 'synthetic-owned' }) } },
      bigGainsAccounts: { registry: { accounts: [descriptor], resolve: () => descriptor }, activeSelectionKey: 'synthetic-selection', runtime: { kind, storageNamespace: 'synthetic', descriptors: [descriptor], cloudKeys: keys } } };
    scope.window = scope;
    vm.createContext(scope);
    vm.runInContext(readFileSync(new URL('../state-persistence.js', import.meta.url), 'utf8'), scope);
    // The baseline has no writerReady. Both persistence implementations are exercised.
    return Promise.resolve(scope.bigGainsStatePersistence.writerReady).then(() => {
      vm.runInContext(readFileSync(new URL('../managed-profile-recovery.js', import.meta.url), 'utf8'), scope);
      return scope;
    });
  }
  return { storage, snapshots, intent, writes, load };
}

for (const kind of ['independent', 'managed-owner', 'managed-member']) for (const newerKey of [descriptor.storageKey, keys.queue]) test(`journal ownership preserves newer ${newerKey} and every other document for ${kind}`, async () => {
  const h = fixture({ newerKey, kind }); const before = [...h.storage]; const scope = await h.load();
  assert.equal(scope.BigGainsManagedProfileRecovery.adoptionRecoveryStatus().ok, false);
  assert.deepEqual([...h.storage], before);
  assert.deepEqual(h.writes, []);
  assert.equal(scope.BigGainsManagedProfileRecovery.updateSafety(), false);
});

test('journal ownership restores only known candidate documents and preserves untouched queue', async () => {
  const h = fixture(); const scope = await h.load();
  assert.equal(scope.BigGainsManagedProfileRecovery.adoptionRecoveryStatus().ok, true);
  for (const snapshot of h.snapshots) assert.equal(h.storage.get(snapshot.key), snapshot.before);
  assert.equal(h.storage.has(adoptionKey), false);
  assert.equal(h.writes.includes(keys.queue), false);
});

test('journal ownership interrupted rollback retains intent and retries without duplicate History', async () => {
  const h = fixture({ failKey: keys.catalog }); const first = await h.load();
  assert.equal(first.BigGainsManagedProfileRecovery.adoptionRecoveryStatus().ok, false);
  assert.equal(h.storage.get(adoptionKey), h.intent);
  assert.equal(h.storage.get(descriptor.storageKey), h.snapshots[0].before);
  assert.equal(h.storage.get(keys.comparison), h.snapshots[2].candidate);
  const second = await h.load();
  assert.equal(second.BigGainsManagedProfileRecovery.adoptionRecoveryStatus().ok, true);
  for (const snapshot of h.snapshots) assert.equal(h.storage.get(snapshot.key), snapshot.before);
  assert.equal(JSON.parse(h.storage.get(descriptor.storageKey)).workouts.length, 1);
  assert.equal(h.storage.has(adoptionKey), false);
});

test('journal ownership never restores a snapshot for another profile', async () => {
  const h = fixture({ beforeProfile: profile('another-profile') }); const before = [...h.storage]; const scope = await h.load();
  assert.equal(scope.BigGainsManagedProfileRecovery.adoptionRecoveryStatus().ok, false);
  assert.deepEqual([...h.storage], before);
  assert.deepEqual(h.writes, []);
});

test('journal ownership cannot clear a replacement intent during rollback', async () => {
  const replacement = '{"synthetic":"newer journal"}';
  const h = fixture({ duringWrite(key, storage) { if (key === descriptor.storageKey) storage.set(adoptionKey, replacement); } });
  const scope = await h.load();
  assert.equal(scope.BigGainsManagedProfileRecovery.adoptionRecoveryStatus().ok, false);
  assert.equal(h.storage.get(adoptionKey), replacement);
  assert.equal(h.storage.get(keys.catalog), h.snapshots[1].candidate);
});

test('journal ownership failed final journal removal can be safely retried', async () => {
  const h = fixture({ failKey: adoptionKey }); const first = await h.load();
  assert.equal(first.BigGainsManagedProfileRecovery.adoptionRecoveryStatus().ok, false);
  assert.equal(h.storage.get(adoptionKey), h.intent);
  const second = await h.load();
  assert.equal(second.BigGainsManagedProfileRecovery.adoptionRecoveryStatus().ok, true);
  for (const snapshot of h.snapshots) assert.equal(h.storage.get(snapshot.key), snapshot.before);
});
