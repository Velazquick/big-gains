import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context = { setTimeout: fn => { /* timers are advanced explicitly by each test */ }, clearTimeout() {} };
vm.runInNewContext(readFileSync(new URL('../pwa-update.js', import.meta.url), 'utf8'), context);
const create = context.BigGainsPwaUpdate.create;
function fixture({ release = 'old', deployment } = {}) {
  const events = () => ({ listeners: {}, addEventListener(n, f) { this.listeners[n] = f; }, fire(n) { this.listeners[n]?.(); } });
  const old = { release: 'old' }, next = { ...events(), release: 'new', state: 'installed' };
  const container = { ...events(), controller: old };
  const registration = { ...events(), waiting: next, installing: null, async update() { updates++; } };
  let safe = true, reloads = 0, updates = 0, time = 0, refusal = null;
  const sent = [];
  const api = create({ container, register: async () => registration, getSafety: () => ({ safe }),
    release, deployment, now: () => time, reload: () => reloads++,
    ask: async (worker, type) => {
      if (type === 'GET_VERSION') return worker ? { release: worker.release, deploymentVersion: worker.deploymentVersion } : null;
      sent.push(type); return refusal || { ok: true };
    } });
  return { api, container, registration, next, sent, setSafe: value => { safe = value; },
    advance: () => { time += 16000; }, refuse: () => { refusal = { ok: false, reason: 'other-clients' }; },
    counts: () => ({ reloads, updates }) };
}
test('startup checks and detects an already waiting worker without activating', async () => {
  const f = fixture(); await f.api.check();
  assert.equal(f.counts().updates, 1); assert.equal(f.api.status().waitingRelease, 'new'); assert.deepEqual(f.sent, []);
});
test('resume checks coalesce and resume after bounded throttle', async () => {
  const f = fixture(); await Promise.all([f.api.check(), f.api.check()]); await f.api.check();
  assert.equal(f.counts().updates, 1); f.advance(); await f.api.check(); assert.equal(f.counts().updates, 2);
});
for (const guard of ['workout', 'rest', 'queue', 'conflict', 'recovery', 'editor', 'unknown']) {
  test(`${guard} veto prevents approval message and reload; safe state later permits approval`, async () => {
    const f = fixture(); await f.api.check(); f.setSafe(false);
    assert.equal(await f.api.accept(), false); assert.deepEqual(f.sent, []);
    f.setSafe(true); await f.api.accept(); assert.deepEqual(f.sent, ['SKIP_WAITING']);
    f.container.controller = f.next; f.container.fire('controllerchange'); assert.equal(f.counts().reloads, 1);
  });
}
test('controllerchange without approval does not reload; accepted change reloads at most once', async () => {
  const f = fixture(); await f.api.check(); f.container.fire('controllerchange'); assert.equal(f.counts().reloads, 0);
  await f.api.accept(); f.container.controller = f.next;
  f.container.fire('controllerchange'); f.container.fire('controllerchange'); assert.equal(f.counts().reloads, 1);
});
test('safety is rechecked after activation and approval is consumed on unsafe race', async () => {
  const f = fixture(); await f.api.check(); await f.api.accept(); f.setSafe(false);
  f.container.controller = f.next; f.container.fire('controllerchange'); f.setSafe(true); f.container.fire('controllerchange');
  assert.equal(f.counts().reloads, 0);
});
test('Later suppresses repeat prompts until explicit check, not activation', async () => {
  const f = fixture(); await f.api.check(); f.api.later(); f.advance(); await f.api.check();
  assert.equal(f.api.status().dismissed, true); assert.deepEqual(f.sent, []);
  await f.api.check(true); assert.equal(f.api.status().dismissed, false);
});
test('another live client refusal leaves data/page in place', async () => {
  const f = fixture(); await f.api.check(); f.refuse(); assert.equal(await f.api.accept(), false);
  assert.equal(f.api.status().error, 'other-clients'); assert.equal(f.counts().reloads, 0);
});

test('Later also dismisses a new controller after an unsafe restart race', async () => {
  const f = fixture(); await f.api.check(); await f.api.accept(); f.setSafe(false);
  f.registration.waiting = null; f.container.controller = f.next; f.container.fire('controllerchange');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.api.status().available, true); assert.equal(f.counts().reloads, 0);
  f.api.later(); f.setSafe(true); f.api.refresh();
  assert.equal(f.api.status().dismissed, true); assert.equal(f.counts().reloads, 0);
  await f.api.check(true); assert.equal(f.api.status().dismissed, false);
  await f.api.accept(); assert.equal(f.counts().reloads, 1);
});

test('a newer page with an older controller and no waiting worker never offers a false restart', async () => {
  const f = fixture({ release: 'new' }); f.registration.waiting = null; await f.api.check();
  assert.equal(f.api.status().workerRelease, 'old'); assert.equal(f.api.status().available, false);
  assert.equal(await f.api.accept(), false); assert.equal(f.counts().reloads, 0);
});

test('an observed controller replacement offers restart without automatically reloading', async () => {
  const f = fixture(); f.registration.waiting = null; await f.api.check();
  f.container.controller = f.next; f.container.fire('controllerchange');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.api.status().available, true); assert.equal(f.counts().reloads, 0);
  await f.api.accept(); assert.equal(f.counts().reloads, 1);
});

test('a config-only controller replacement still offers a guarded restart', async () => {
  const f = fixture({ release: 'same', deployment: 'same-config-old' });
  f.container.controller.release = 'same'; f.container.controller.deploymentVersion = 'same-config-old';
  f.next.release = 'same'; f.next.deploymentVersion = 'same-config-new';
  f.registration.waiting = null; await f.api.check();
  assert.equal(f.api.status().available, false);
  f.container.controller = f.next; f.container.fire('controllerchange');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.api.status().available, true); assert.equal(f.counts().reloads, 0);
  await f.api.accept(); assert.equal(f.counts().reloads, 1);
});
test('installing worker state transition is observed', async () => {
  const f = fixture(); f.registration.waiting = null; f.registration.installing = f.next;
  await f.api.check(); assert.equal(f.api.status().waiting, false);
  f.registration.waiting = f.next; f.next.fire('statechange');
  await new Promise(resolve => setImmediate(resolve)); assert.equal(f.api.status().waiting, true);
});
test('client-free activation prunes only obsolete owned shell caches', async () => {
  const scope = { URL, Request }; vm.runInNewContext(readFileSync(new URL('../service-worker-core.js', import.meta.url), 'utf8'), scope);
  const deleted = [];
  const runtime = scope.BigGainsServiceWorkerCore.createRuntime({ manifest: {
    coreAssets: [], styles: [], scripts: [], legacyCacheNames: [], cachePrefix: 'shell-', runtimeCachePrefix: 'runtime-', cacheName: 'shell-new', runtimeCacheName: 'runtime-new'
  }, cacheStorage: { keys: async () => ['shell-old', 'runtime-old', 'shell-new', 'unrelated', 'shell-installing'], delete: async n => deleted.push(n) },
  baseUrl: 'https://app.example/service-worker.js', clientApi: { matchAll: async () => [], claim: async () => {} } });
  await runtime.activate(); assert.deepEqual(deleted, ['shell-old', 'runtime-old']);
});

test('worker failure diagnostic targets only the requesting client and carries no URL', async () => {
  const ctx={URL,Request,Promise,Object};
  vm.runInNewContext(readFileSync(new URL('../service-worker-core.js',import.meta.url),'utf8'),ctx);
  const messages=[],requested=[];
  const runtime=ctx.BigGainsServiceWorkerCore.createRuntime({manifest:{coreAssets:['./app.js'],styles:[],scripts:[],legacyCacheNames:[],cacheName:'test',runtimeCacheName:'runtime'},baseUrl:'https://example.test/service-worker.js',cacheStorage:{open:async()=>({match:async()=>null})},fetcher:async()=>{throw Error('sensitive');},clientApi:{get:async id=>{requested.push(id);return {postMessage:v=>messages.push(v)};}}});
  await assert.rejects(runtime.handle(new Request('https://example.test/app.js?token=secret'),'requesting-tab'));
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(requested,['requesting-tab']);
  assert.equal(JSON.stringify(messages),'[{"type":"BG_RESOURCE_UNAVAILABLE","module_id":"app.js"}]');
  await assert.rejects(runtime.handle(new Request('https://example.test/app.js')));
  assert.equal(messages.length,1);
});

// Execute the real sync owner with synthetic storage/network boundaries. No production client.
function syncSafetyFixture() {
  const storage = new Map();
  const catalog = { format: 'big-gains.shadow-catalog.v1', accountId: 'account', authUserId: 'user', profiles: { proof: { profileId: 'profile' } } };
  storage.set('catalog', JSON.stringify(catalog));
  const controls = { recovery: { ok: false, reason: 'synthetic-recovery' }, parity: true, pending: [], timers: [], comparingHook: null };
  const scope = {
    setTimeout: fn => { controls.timers.push(fn); return controls.timers.length; }, clearTimeout() {},
    BigGainsCloud: { createDurableQueue: () => ({ pending: () => controls.pending }) },
    bigGainsAccounts: { runtime: { kind: 'independent', cloudShape: 'independent', cloudKeys: { queue: 'queue', catalog: 'catalog', comparison: 'comparison' } }, matchesCloudOwner: () => true, cloudProfileShape: () => 'independent' },
    BigGainsSupabase: { session: async () => ({ user: { id: 'user' } }), verifiedUser: async () => { if (controls.sessionFailure) throw Error('synthetic verification failure'); return { id: 'user' }; }, readCloudAccount: async () => ({ account: { id: 'account' }, authUserId: 'user', profiles: { proof: { id: 'profile' } } }), getClient: () => ({}) },
    BigGainsManagedProfileRecovery: { adoptionRecoveryStatus: () => controls.recovery, inspectRemoteFastForward: () => ({ eligible: false, reason: 'synthetic-drift' }) },
    BigGainsCloudShadow: { profileIds: ['proof'], createRepository: () => ({ readAll: async () => ({ journals: [] }) }), completedMigrationJournal: () => null, reconstructCloud: async () => ({}), readLocalProfiles: async () => ({}), compare: async () => { await controls.comparingHook?.(); return { parity: controls.parity, profiles: { proof: { parity: controls.parity } } }; }, catalogFromCloud: () => catalog }
  };
  const ctx = { window: scope, document: { visibilityState: 'visible', getElementById: () => null }, navigator: { onLine: true }, localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) } };
  vm.runInNewContext(readFileSync(new URL('../cloud-sync.js', import.meta.url), 'utf8'), ctx);
  return { controls, api: scope.BigGainsCloudSync, async reconcile() { scope.BigGainsCloudSync.scheduleReconciliation('synthetic', 0); await controls.timers.pop()(); await new Promise(resolve => setImmediate(resolve)); } };
}

test('recovered reconciliation retires a historical blocked result only after fresh parity', async () => {
  const f = syncSafetyFixture(); await f.reconcile();
  assert.equal(f.api.status().lastResult.blocked, true);
  f.controls.recovery = { ok: true }; await f.reconcile();
  assert.equal(f.api.status().lastComparison.parity, true);
  assert.equal(f.api.status().reconciliationInFlight, false);
  assert.equal(Boolean(f.api.status().lastResult.blocked), false);
});

test('failed parity retains the historical recovery guard', async () => {
  const f = syncSafetyFixture(); await f.reconcile();
  f.controls.recovery = { ok: true }; f.controls.parity = false; await f.reconcile();
  assert.equal(f.api.status().lastResult.blocked, true);
  assert.equal(f.api.status().lastComparison.parity, false);
});

test('recovered reconciliation retires historical conflict without mutating the queue', async () => {
  const f = syncSafetyFixture(); f.controls.recovery = { ok: true }; await f.reconcile();
  f.controls.pending = [{ id: 'synthetic' }]; await f.api.applyRemoteFastForward();
  assert.equal(f.api.status().lastResult.conflict, true);
  assert.equal(f.controls.pending.length, 1);
  f.controls.pending = []; // Synthetic owner has independently completed its work.
  await f.reconcile();
  assert.equal(Boolean(f.api.status().lastResult.conflict), false);
  assert.equal(f.api.status().remoteFastForward, null);
  assert.equal(f.api.status().sameEntityConflict, null);
});

for (const race of ['capture-pending', 'completed-concurrent-mutation', 'new-queue', 'lifecycle']) {
  test(`fresh parity cannot retire a blocker during ${race}`, async () => {
    const f = syncSafetyFixture(); await f.reconcile(); f.controls.recovery = { ok: true };
    f.controls.comparingHook = () => {
      if (race === 'new-queue') f.controls.pending = [{ id: 'new' }];
      else if (race === 'lifecycle') f.api.scheduleReconciliation('new-generation', 0);
      else { const finish = f.api.beginLocalMutation(); if (race === 'completed-concurrent-mutation') finish(); }
    };
    await f.reconcile();
    assert.equal(f.api.status().lastResult.blocked, true);
  });
}

function safetyFixture() {
  const records = new Map();
  const scope = {
    BigGainsRuntimeGate: { canInteract: () => true, status: () => ({ degraded: [] }) },
    BigGainsAppRuntime: { initialized: true, updateSafety: () => ({ safe: true, reason: null }) },
    BigGainsCloudSync: { status: () => ({ pending: 0, busy: false, comparing: false, capturePending: 0, reconciliationInFlight: false }) },
    BigGainsManagedProfileRecovery: { updateSafety: () => true },
    BigGainsProgramPortability: { updateSafety: () => true },
    BigGainsAppearance: { updateSafety: () => true },
    BigGainsControlledMigration: { status: () => ({ busy: false }) },
    document: { querySelectorAll: () => [] },
    localStorage: { get length() { return records.size; }, key: i => [...records.keys()][i], getItem: key => records.get(key) }
  };
  vm.runInNewContext(readFileSync(new URL('../pwa-update.js', import.meta.url), 'utf8'), scope);
  return { scope, records, safety: scope.BigGainsPwaUpdate.safety };
}

for (const owner of ['BigGainsCloudSync', 'BigGainsManagedProfileRecovery', 'BigGainsProgramPortability', 'BigGainsAppearance', 'BigGainsControlledMigration']) {
  test(`missing or throwing ${owner} fails closed with bounded unknown`, () => {
    const f = safetyFixture(); assert.equal(f.safety().safe, true);
    const original = f.scope[owner]; f.scope[owner] = null;
    assert.equal(f.safety().reason, 'unknown');
    f.scope[owner] = { status() { throw Error('private state must not leak'); }, updateSafety() { throw Error('private state must not leak'); } };
    assert.equal(f.safety().reason, 'unknown'); f.scope[owner] = original; assert.equal(f.safety().safe, true);
  });
}

test('multiple blockers use the first authoritative owner in fixed order', () => {
  const f = safetyFixture(); f.scope.BigGainsProgramPortability.updateSafety = () => false;
  f.scope.BigGainsAppRuntime.updateSafety = () => ({ safe: false, reason: 'workout' });
  assert.equal(f.safety().reason, 'workout');
  f.scope.BigGainsAppRuntime.updateSafety = () => ({ safe: true }); assert.equal(f.safety().reason, 'program');
  f.scope.BigGainsRuntimeGate.canInteract = () => false; assert.equal(f.safety().reason, 'startup');
});

test('invalid local safety payload and malformed sync fields never permit update', () => {
  const f = safetyFixture(); f.scope.BigGainsAppRuntime.updateSafety = () => ({ safe: 'yes', reason: 'private data' });
  assert.equal(f.safety().reason, 'unknown');
  f.scope.BigGainsAppRuntime.updateSafety = () => ({ safe: true });
  f.scope.BigGainsCloudSync.status = () => ({}); assert.equal(f.safety().reason, 'unknown');
});

test('a newer sync failure during readback is not mistaken for historical evidence', async () => {
  const f = syncSafetyFixture(); await f.reconcile(); f.controls.recovery = { ok: true };
  f.controls.comparingHook = async () => { f.controls.sessionFailure = true; await f.api.flush(); };
  await f.reconcile();
  assert.equal(f.api.status().lastComparison.parity, true);
  assert.equal(f.api.status().lastResult.blocked, true);
  assert.equal(f.api.status().lastResult.reason, 'session-verification-failed');
  f.controls.sessionFailure = false; f.controls.comparingHook = null; await f.reconcile();
  assert.equal(f.api.status().lastResult.ok, true);
  assert.equal(Boolean(f.api.status().lastResult.blocked), false);
});
