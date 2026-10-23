// Opt-in test-only worker-stage observations; default worker bytes are unchanged.
// Inject only into this target's disposable native-server service-worker.js bytes.
// Original repository worker/core files and all test assertions remain unchanged.
import { createHash } from 'node:crypto';

export const WORKER_BASE_SHA256 = '098f059bf134477d088d16b930467ee627a354056cb91a4ce2be57704d167501';
const IMPORT_LINE = "importScripts('./asset-manifest.js?v=v123-reliability-completion-config-925e766c1b907250', './service-worker-core.js');";
const HANDLE = '__BG_TEST_INSTALL_STAGE_20261023__';

function workerStageBootstrap() {
  // A unique lexical binding is introduced only in diagnostic served bytes.
  // Every marker is best-effort metadata I/O, never an event lifetime promise.
  const nativeFetch = self.fetch;
  const nativeThen = Promise.prototype.then;
  const apply = Reflect.apply;
  // Runtime-only observer identity distinguishes separate worker evaluations.
  // This value is never interpolated into served script bytes or user data.
  let instance;
  try { instance = self.crypto.randomUUID(); }
  catch { instance = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; }
  let sequence = 0, nextOpen = 0, observeCacheOpen = true;
  const marker = (stage, operation = 0) => {
    try {
      const url = new URL('/__bg_test_worker_stage__', self.location.href);
      url.searchParams.set('stage', stage);
      url.searchParams.set('seq', String(++sequence));
      url.searchParams.set('op', String(operation));
      url.searchParams.set('instance', instance);
      const observerRequest = apply(nativeFetch, self, [url.href, {
        method: 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error'
      }]);
      // This child promise is observer-owned, not a replacement product promise.
      apply(nativeThen, observerRequest, [() => undefined, () => undefined]);
    } catch { /* Observer-only failure must not alter the original worker path. */ }
  };
  const observe = (promise, fulfilled, rejected, operation = 0, completed) => {
    try {
      apply(nativeThen, promise, [
        () => { marker(fulfilled, operation); if (completed) completed(); },
        () => { marker(rejected, operation); if (completed) completed(); }
      ]);
    } catch { marker('observer-promise-hook-failed', operation); }
    return promise; // SAME original promise; no assimilation/replacement.
  };
  marker('bootstrap');
  try {
    const prototype = self.CacheStorage.prototype;
    const original = Object.getOwnPropertyDescriptor(prototype, 'open');
    if (!original || typeof original.value !== 'function' || !original.writable) throw new Error('observer-hook-unavailable');
    const nativeOpen = original.value;
    Object.defineProperty(prototype, 'open', { ...original, value: function (...args) {
      const instrument = observeCacheOpen;
      const operation = instrument ? ++nextOpen : 0;
      if (instrument) marker('cache-open-start', operation);
      let result;
      try { result = apply(nativeOpen, this, args); }
      catch (error) { if (instrument) marker('cache-open-threw', operation); throw error; }
      if (instrument) marker('cache-open-returned', operation);
      if (instrument) observe(result, 'cache-open-fulfilled', 'cache-open-rejected', operation);
      return result; // Native this/arguments/result and synchronous throw preserved.
    } });
    marker('observer-cache-hook-ready');
  } catch { marker('observer-cache-hook-failed'); }

  try {
    const prototype = self.ExtendableEvent.prototype;
    const original = Object.getOwnPropertyDescriptor(prototype, 'waitUntil');
    if (!original || typeof original.value !== 'function' || !original.writable) throw new Error('observer-hook-unavailable');
    const nativeWaitUntil = original.value;
    Object.defineProperty(prototype, 'waitUntil', { ...original, value: function (...args) {
      // Forward first. The original application call and its exact promise remain.
      // Native synchronous exceptions propagate unchanged, with no observer catch.
      const result = apply(nativeWaitUntil, this, args);
      try {
        if (this.type === 'install') {
          marker('install-waituntil-returned');
          // At this pinned source the sole install waitUntil receives runtime.precache().
          observe(args[0], 'install-promise-fulfilled', 'install-promise-rejected', 0,
            () => { observeCacheOpen = false; });
        }
      } catch { marker('observer-install-hook-failed'); }
      return result;
    } });
    marker('observer-waituntil-hook-ready');
  } catch { marker('observer-waituntil-hook-failed'); }

  try {
    self.addEventListener('install', () => marker('install-dispatch'));
    marker('observer-install-listener-ready');
  } catch { marker('observer-install-listener-failed'); }
  return Object.freeze({ marker });
}

export function instrumentSelectedWorkerBytes(originalBytes, { enabled = false } = {}) {
  // Default and every non-selected request preserve the SAME original Buffer.
  // The caller must combine explicit opt-in + WebKit + exact target identity.
  if (enabled !== true) return originalBytes;
  if (createHash('sha256').update(originalBytes).digest('hex') !== WORKER_BASE_SHA256) throw new Error('Pinned original worker byte hash changed.');
  const source = originalBytes.toString('utf8');
  if (source.includes(HANDLE)) throw new Error('Diagnostic worker already instrumented.');
  if (!source.startsWith(IMPORT_LINE)) throw new Error('Pinned worker import prefix changed.');
  const suffix = source.slice(IMPORT_LINE.length);
  const newline = suffix.startsWith('\r\n') ? '\r\n' : suffix.startsWith('\n') ? '\n' : null;
  if (!newline) throw new Error('Pinned worker import line boundary changed.');
  if (source.split('event.waitUntil(runtime.precache());').length !== 2) throw new Error('Pinned install waitUntil contract changed.');
  const prefix = `const ${HANDLE} = (${workerStageBootstrap.toString()})();${newline}`;
  const afterImports = `${HANDLE}.marker('imports-returned');${newline}`;
  // Keep every original byte in order. Insert one prefix and one post-import marker.
  return Buffer.from(prefix + source.slice(0, IMPORT_LINE.length + newline.length)
    + afterImports + source.slice(IMPORT_LINE.length + newline.length), 'utf8');
}
