((scope) => {
  'use strict';

  // No storage writes, queue acknowledgements, or cloud calls belong here.
  function safety() {
    const blocked = reason => ({ safe: false, reason });
    try {
      if (!scope.BigGainsRuntimeGate?.canInteract() || !scope.BigGainsAppRuntime?.initialized
          || scope.BigGainsRuntimeGate.status().degraded.length) return blocked('startup');
      const local = scope.BigGainsAppRuntime.updateSafety();
      if (!local.safe) return local;
      if (document.querySelector('dialog[open], [role="dialog"]:not([hidden])')) return blocked('editor');
      // Restore reads File.text() asynchronously; the styled file input can be
      // hidden while that mutation is pending. Its files clear in the writer's finally.
      if ([...document.querySelectorAll('input[type="file"]')].some(el => el.files?.length)) return blocked('editor');
      // Form values not yet submitted are also unsaved work (including sign-in).
      if ([...document.querySelectorAll('input, textarea, [contenteditable="true"]')].some(el =>
        el.getClientRects().length && ((el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea')
          && el.value !== el.defaultValue) || (el.isContentEditable && el.textContent)))) return blocked('editor');
      const sync = scope.BigGainsCloudSync?.status();
      if (!sync || sync.pending || sync.busy || sync.comparing || sync.capturePending || sync.reconciliationInFlight) return blocked('sync');
      if (sync.sameEntityConflict?.eligible || sync.remoteFastForward?.conflict || sync.lastResult?.blocked
          || sync.lastResult?.conflict || sync.lastComparison?.parity === false) return blocked('recovery');
      if (scope.BigGainsManagedProfileRecovery?.updateSafety?.() !== true) return blocked('recovery');
      if (scope.BigGainsProgramPortability?.updateSafety?.() !== true) return blocked('program');
      if (scope.BigGainsAppearance?.updateSafety?.() !== true) return blocked('appearance');
      if (scope.BigGainsControlledMigration?.status?.().busy) return blocked('recovery');
      // Inspect durable envelopes too: in-memory queues can ignore malformed records
      // or miss another window/profile's outstanding work. Fail closed, never repair.
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (/^big-gains-(cloud-sync-queue-v1|program-domain-queue-v1)/.test(key)) {
          const value = JSON.parse(localStorage.getItem(key));
          if (value?.version !== 1 || !Array.isArray(value.pending) || value.pending.length) return blocked('queue');
        }
        if (key.startsWith('big-gains-appearance-v1-')) {
          const value = JSON.parse(localStorage.getItem(key));
          if (!value || !Object.hasOwn(value, 'pending') || value.pending) return blocked('appearance');
        }
      }
      return { safe: true, reason: null };
    } catch { return blocked('unknown'); }
  }

  function message(worker, type, timeout = 2500) {
    return new Promise(resolve => {
      if (!worker) { resolve(null); return; }
      const channel = new MessageChannel();
      const finish = value => { clearTimeout(timer); channel.port1.close(); resolve(value); };
      const timer = setTimeout(() => finish(null), timeout);
      channel.port1.onmessage = event => finish(event.data);
      try { worker.postMessage({ type, deploymentVersion: scope.BIG_GAINS_ASSET_MANIFEST?.deploymentVersion }, [channel.port2]); } catch { finish(null); }
    });
  }

  function create({ container, register, getSafety, reload, publish = () => {}, ask = message,
    release, deployment = release, now = () => Date.now() }) {
    let registration = null;
    let checking = null;
    let lastCheck = -Infinity;
    let waiting = null;
    let approved = null;
    let dismissed = null;
    let reloaded = false;
    let applying = false;
    let workerRelease = null;
    let workerDeployment = null;
    let waitingRelease = null;
    let error = null;
    let previousController = container.controller;
    let replacementController = null;
    const watched = new WeakSet();
    const status = () => ({ release, workerRelease, workerDeployment, waitingRelease, waiting: Boolean(waiting), applying,
      available: Boolean(waiting || (replacementController === container.controller && replacementController && workerDeployment && workerDeployment !== deployment)),
      dismissed: Boolean(dismissed) && dismissed === (waiting || container.controller), error, safety: getSafety() });
    const emit = () => publish(status());
    async function inspect() {
      waiting = registration?.waiting || null;
      const target = waiting;
      const controller = container.controller;
      const [next, current] = await Promise.all([ask(target, 'GET_VERSION'), ask(controller, 'GET_VERSION')]);
      if (target === waiting) waitingRelease = next?.release || null;
      if (controller === container.controller) {
        workerRelease = current?.release || null;
        workerDeployment = current?.deploymentVersion || current?.release || null;
      }
      emit();
      // Only the sole, current, safely idle client may retire old shell caches.
      // The worker additionally checks exact deployment identity and no install.
      if (workerDeployment === deployment && !waiting && getSafety().safe) void ask(controller, 'PRUNE_CACHES');
    }
    function watch() {
      const worker = registration?.installing;
      if (!worker || watched.has(worker)) return;
      watched.add(worker);
      worker.addEventListener('statechange', () => { if (['installed', 'activated', 'redundant'].includes(worker.state)) void inspect(); });
    }
    async function check(force = false) {
      if (force) dismissed = null;
      if (checking) return checking;
      if (!force && now() - lastCheck < 15000) { emit(); return; }
      lastCheck = now();
      checking = (async () => {
        try {
          if (!registration) {
            registration = await register();
            registration.addEventListener('updatefound', watch);
          }
          watch();
          await registration.update();
          error = null;
        } catch { error = 'check-unavailable'; }
        await inspect();
      })().finally(() => { checking = null; });
      return checking;
    }
    function guardedReload() {
      if (!approved || reloaded || !getSafety().safe) { applying = false; approved = null; emit(); return false; }
      reloaded = true;
      reload();
      return true;
    }
    container.addEventListener('controllerchange', () => {
      // A version mismatch alone may mean this page is newer than its worker.
      // Only an observed replacement can offer restart without a waiting update.
      if (previousController && container.controller !== previousController) replacementController = container.controller;
      previousController = container.controller;
      if (approved && container.controller === approved) guardedReload();
      void inspect();
    });
    async function accept() {
      if (applying || reloaded || !getSafety().safe) { emit(); return false; }
      const target = registration?.waiting;
      if (!target) {
        if (replacementController !== container.controller || !workerDeployment || workerDeployment === deployment) return false;
        approved = container.controller;
        return guardedReload();
      }
      approved = target;
      applying = true;
      error = null;
      emit();
      // No asynchronous work between the fresh guard and approval message.
      const result = await ask(target, 'SKIP_WAITING');
      if (!result?.ok && !reloaded) {
        approved = null; applying = false;
        error = result?.reason === 'other-clients' ? 'other-clients' : 'activation-unavailable';
        emit();
        return false;
      }
      // A failed/suspended activation must not freeze input indefinitely.
      setTimeout(() => {
        if (!reloaded) { approved = null; applying = false; void inspect(); }
      }, 10000);
      return true;
    }
    return Object.freeze({ check, accept, status, refresh: emit,
      later: () => { dismissed = waiting || container.controller; emit(); } });
  }

  scope.BigGainsPwaUpdate = Object.freeze({ create, safety });
  if (!scope.navigator?.serviceWorker || !scope.document) return;
  const el = id => document.getElementById(id);
  const setText = (id, value) => { const node = el(id); if (node && node.textContent !== value) node.textContent = value; };
  const runtime = create({
    container: navigator.serviceWorker,
    register: () => navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none', scope: './' }),
    release: scope.BIG_GAINS_ASSET_MANIFEST.release,
    deployment: scope.BIG_GAINS_ASSET_MANIFEST.deploymentVersion,
    getSafety: safety,
    reload: () => location.reload(),
    publish: value => {
      const banner = el('pwaUpdate');
      if (!banner) return;
      banner.hidden = !value.available || value.dismissed;
      el('pwaUpdateNow').disabled = !value.safety.safe || value.applying;
      const detail = value.error === 'other-clients' ? 'Close other Big Gains windows, then try again.'
        : value.applying ? 'Restarting Big Gains…'
          : !value.safety.safe ? 'Finish your workout and let saved changes sync. Close any open editor before updating.'
            : value.error === 'activation-unavailable' ? 'Update could not start. Try again when connected.' : '';
      setText('pwaUpdateDetail', detail);
      setText('diagnosticWorkerVersion', value.workerRelease || (navigator.serviceWorker.controller ? 'Older worker / version unavailable' : 'Not controlled yet'));
      setText('diagnosticUpdateState', value.waiting ? `Update waiting${value.waitingRelease ? ` (${value.waitingRelease})` : ''}`
        : value.available ? 'Restart available' : value.error === 'check-unavailable' ? 'Check unavailable / offline' : 'No waiting update');
      setText('diagnosticAppOrigin', location.origin + new URL('./', location.href).pathname);
    }
  });
  scope.bigGainsPwaUpdate = runtime;
  el('pwaUpdateNow')?.addEventListener('click', () => void runtime.accept());
  el('pwaUpdateLater')?.addEventListener('click', () => runtime.later());
  el('pwaCheckUpdate')?.addEventListener('click', () => void runtime.check(true));
  // Keep a brief accepted restart atomic with respect to user interactions.
  for (const name of ['click', 'keydown', 'beforeinput', 'submit']) document.addEventListener(name, event => {
    if (runtime.status().applying && !event.target.closest?.('#pwaUpdate')) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  for (const name of ['focus', 'pageshow', 'online']) scope.addEventListener(name, () => void runtime.check());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void runtime.check(); });
  setInterval(() => { if (document.visibilityState === 'visible') runtime.refresh(); }, 1000);
  // The asset loader can finish after window.load; never depend on that event.
  void runtime.check(true);
})(typeof window === 'object' ? window : globalThis);
