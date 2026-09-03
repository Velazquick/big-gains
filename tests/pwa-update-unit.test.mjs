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
