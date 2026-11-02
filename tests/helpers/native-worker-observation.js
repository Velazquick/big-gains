// Passive native lifecycle evidence for the original managed-recovery worker wait.
// This is test instrumentation, not a registration/recovery implementation.
import os from 'node:os';

const TARGET = 'fresh managed member restores exact Alexa schema v5, adopts a zero-queue baseline, and remains local-first offline';
const PREFIX = '__BG_NATIVE_WORKER_OBSERVATION__';

export async function installNativeWorkerObservation({ page, context, browser, browserName, appTransport }, testInfo) {
  if (testInfo.title !== TARGET) return { async finish() {} };
  const records = [];
  const seen = new Map();
  const cleanup = [];
  const safeUrl = value => { try { const u = new URL(value); return u.origin + u.pathname; } catch { return String(value); } };
  const nodeRecord = (event, detail = {}, writeStdout = true) => {
    const row = { nodeEpoch: Date.now(), event, ...detail };
    records.push(row);
    if (writeStdout) {
      try { console.log('[native-worker] ' + JSON.stringify(row)); }
      catch (error) { records.push({ event: 'observation-output-error', nodeEpoch: Date.now(), message: String(error) }); }
    }
  };
  const accept = (entry, delivery) => {
    if (!entry || typeof entry !== 'object') return;
    const key = `${entry.documentId}:${entry.sequence}`;
    if (seen.has(key)) { const row = seen.get(key); if (!row.deliveries.includes(delivery)) row.deliveries.push(delivery); return; }
    const row = { ...entry, receivedAt: Date.now(), deliveries: [delivery] };
    seen.set(key, row); records.push(row);
    try { console.log('[native-worker] ' + JSON.stringify(row)); }
    catch (error) { records.push({ event: 'observation-output-error', nodeEpoch: Date.now(), message: String(error) }); }
  };
  const listen = (emitter, name, fn) => { emitter.on(name, fn); cleanup.push(() => emitter.off(name, fn)); };
  nodeRecord('observation-start', {
    pid: process.pid, ppid: process.ppid, node: process.version, platform: process.platform,
    arch: process.arch, osRelease: os.release(), browserName, browserVersion: browser.version(),
    workerIndex: testInfo.workerIndex, parallelIndex: testInfo.parallelIndex, retry: testInfo.retry,
    timeout: testInfo.timeout, configuredWorkers: testInfo.config.workers,
    contextPages: context.pages().length, browserConnected: browser.isConnected(),
    reuseContextEnvironmentPresent: Boolean(process.env.PW_TEST_REUSE_CONTEXT),
    workerStageMode: appTransport?.workerStageMode?.() ?? { requested: process.env.BIG_GAINS_NATIVE_WORKER_STAGE_DIAGNOSTICS === 'true', enabled: false, transport: 'original-static-server' }
  });
  listen(browser, 'disconnected', () => nodeRecord('browser-disconnected'));
  listen(context, 'close', () => nodeRecord('context-close'));
  listen(page, 'close', () => nodeRecord('page-close'));
  listen(page, 'crash', () => nodeRecord('page-crash'));
  listen(page, 'framenavigated', frame => { if (frame === page.mainFrame()) nodeRecord('main-frame-navigated', { url: safeUrl(frame.url()) }); });
  listen(page, 'requestfailed', request => nodeRecord('page-request-failed', { url: safeUrl(request.url()), errorText: request.failure()?.errorText }));
  listen(page, 'pageerror', error => nodeRecord('page-error', { message: String(error) }));
  listen(page, 'console', message => {
    const text = message.text();
    if (!text.startsWith(PREFIX)) return;
    try { accept(JSON.parse(text.slice(PREFIX.length)), 'console'); }
    catch (error) { nodeRecord('observation-decode-error', { message: String(error) }); }
  });
  if (appTransport?.subscribeNativeObserver) {
    // Full HTTP rows remain in JSON. Its port prints only critical rows itself;
    // never duplicate the complete stream to stdout from this subscriber.
    cleanup.push(appTransport.subscribeNativeObserver(event => nodeRecord('native-http', { nativeEvent: event }, false)));
  } else nodeRecord('native-http-port-absent');
  await page.exposeBinding('__bgNativeWorkerObservation', (_source, entry) => accept(entry, 'binding'));
  await page.addInitScript(() => {
    const prefix = '__BG_NATIVE_WORKER_OBSERVATION__';
    const documentId = `${performance.timeOrigin}:${Math.random().toString(36).slice(2)}`;
    let sequence = 0, readySettled = false, readyRejected = false, waitStage = 'not-entered';
    let nextWorkerId = 0;
    const ids = new WeakMap(), registrations = new Set(), watchedWorkers = new WeakSet();
    const sw = navigator.serviceWorker;
    const safeUrl = value => { try { const u = new URL(value, location.href); return u.origin + u.pathname; } catch { return String(value); } };
    const worker = value => {
      if (!value) return null;
      if (!ids.has(value)) ids.set(value, ++nextWorkerId);
      return { id: ids.get(value), state: value.state, scriptURL: safeUrl(value.scriptURL) };
    };
    const reg = value => ({ scope: safeUrl(value.scope), updateViaCache: value.updateViaCache, installing: worker(value.installing), waiting: worker(value.waiting), active: worker(value.active) });
    const snapshot = () => ({
      documentId, url: location.origin + location.pathname, documentState: document.readyState,
      visibility: document.visibilityState, readySettled, readyRejected, waitStage,
      controller: sw ? worker(sw.controller) : null,
      registrations: Array.from(registrations, reg), pwaRuntimePresent: Boolean(globalThis.bigGainsPwaUpdate)
    });
    const emit = (event, extra = {}) => {
      try {
        const entry = { ...snapshot(), sequence: ++sequence, event, epoch: Date.now(), at: performance.now(), ...extra };
        try { console.debug(prefix + JSON.stringify(entry)); } catch {}
        try { globalThis.__bgNativeWorkerObservation(entry).catch(() => {}); } catch {}
      } catch {}
    };
    const watchWorker = value => {
      if (!value || watchedWorkers.has(value)) return;
      watchedWorkers.add(value);
      value.addEventListener('statechange', () => {
        try { emit('worker-statechange', { changedWorker: worker(value) }); }
        catch (error) { emit('observation-error', { where: 'statechange', message: String(error) }); }
      });
    };
    const watchRegistration = value => {
      if (!value) return;
      if (!registrations.has(value)) {
        registrations.add(value);
        value.addEventListener('updatefound', () => {
          try { watchWorker(value.installing); watchWorker(value.waiting); watchWorker(value.active); emit('updatefound', { registration: reg(value) }); }
          catch (error) { emit('observation-error', { where: 'updatefound', message: String(error) }); }
        });
      }
      watchWorker(value.installing); watchWorker(value.waiting); watchWorker(value.active);
    };
    const inventory = reason => {
      try {
        const result = sw.getRegistrations(); // Read-only, never awaited by the test.
        result.then(values => {
          try { values.forEach(watchRegistration); emit('registration-inventory-resolved', { reason, inventory: values.map(reg) }); }
          catch (error) { emit('observation-error', { where: 'inventory-result', message: String(error) }); }
        }, error => emit('registration-inventory-rejected', { reason, message: String(error) }));
        emit('registration-inventory-started', { reason });
      } catch (error) { emit('observation-error', { where: 'inventory', message: String(error) }); }
    };
    globalThis.__bgWorkerWaitMark = stage => {
      // Optional marks must not throw into or alter the original test path.
      try { waitStage = stage; emit('original-wait-stage'); if (stage === 'entered') inventory('original-wait-entry'); } catch {}
    };
    emit('document-init', { capability: Boolean(sw) });
    for (const event of ['DOMContentLoaded', 'pageshow', 'pagehide', 'visibilitychange']) globalThis.addEventListener(event, () => emit(event), { capture: true });
    if (!sw) return;
    sw.addEventListener('controllerchange', () => { try { watchWorker(sw.controller); emit('controllerchange'); } catch (error) { emit('observation-error', { where: 'controllerchange', message: String(error) }); } });
    watchWorker(sw.controller);
    try {
      const nativeRegister = sw.register;
      sw.register = function (...args) {
        emit('register-called', { scriptURL: safeUrl(args[0]), scope: args[1]?.scope, updateViaCache: args[1]?.updateViaCache });
        let result;
        try { result = Reflect.apply(nativeRegister, this, args); }
        catch (error) { emit('register-threw', { message: String(error) }); throw error; }
        try {
          result.then(value => { try { watchRegistration(value); emit('register-resolved', { registration: reg(value) }); } catch (error) { emit('observation-error', { where: 'register-result', message: String(error) }); } },
            error => emit('register-rejected', { message: String(error) }));
        } catch (error) { emit('observation-error', { where: 'register-promise', message: String(error) }); }
        return result; // SAME native promise, not a chained/replacement promise.
      };
      emit('register-observer-installed');
    } catch (error) { emit('observation-error', { where: 'register-wrapper', message: String(error) }); }
    try {
      sw.ready.then(value => {
        readySettled = true;
        try { watchRegistration(value); emit('ready-resolved', { registration: reg(value) }); } catch (error) { emit('observation-error', { where: 'ready-result', message: String(error) }); }
      }, error => { readyRejected = true; emit('ready-rejected', { message: String(error) }); });
      emit('ready-observer-installed');
    } catch (error) { emit('observation-error', { where: 'ready-observer', message: String(error) }); }
    inventory('document-init');
  });
  return {
    async finish() {
      nodeRecord('observation-end', { status: testInfo.status, expectedStatus: testInfo.expectedStatus,
        browserConnected: browser.isConnected(), pageClosed: page.isClosed(), contextPages: context.pages().length,
        workerStageMode: appTransport?.workerStageMode?.() ?? { requested: process.env.BIG_GAINS_NATIVE_WORKER_STAGE_DIAGNOSTICS === 'true', enabled: false, transport: 'original-static-server' } });
      for (const off of cleanup.reverse()) off();
      // No new page evaluation, worker-state wait, timer or readiness gate here.
      await testInfo.attach('native-worker-observation', { contentType: 'application/json', body: Buffer.from(JSON.stringify({ records }, null, 2)) });
    }
  };
}
