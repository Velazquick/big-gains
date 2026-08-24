(() => {
  'use strict';

  const root = document.documentElement;
  const detail = document.getElementById('bootShellDetail');
  const retry = document.getElementById('bootRetry');
  let state = 'loading';
  let reason = 'asset-loading';
  let attempt = 0;
  let diagnostic = null;
  const degraded = [];

  const safeToken = value => String(value || 'runtime')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'runtime';

  function publish() {
    root.dataset.runtimeState = state;
    window.BigGainsBootGate?.refreshVisibility?.();
    document.dispatchEvent(new CustomEvent('big-gains-runtime-state-changed', {
      detail: status()
    }));
  }

  function begin(nextReason = 'shell-composition') {
    if (state === 'interactive' || state === 'recovery') return false;
    attempt += 1;
    state = 'initializing';
    reason = safeToken(nextReason);
    diagnostic = null;
    if (detail) detail.textContent = 'Finishing the controls for your training space.';
    if (retry) retry.hidden = true;
    publish();
    return true;
  }

  function markInteractive(nextReason = 'core-shell-initialized') {
    if (state === 'recovery') return false;
    state = 'interactive';
    reason = safeToken(nextReason);
    diagnostic = null;
    if (retry) retry.hidden = true;
    publish();
    return true;
  }

  function fail(code = 'runtime-initialization-failed', component = 'runtime') {
    if (state === 'interactive') return false;
    const stable = Object.freeze({ code: safeToken(code), component: safeToken(component) });
    state = 'recovery';
    reason = stable.code;
    diagnostic = stable;
    if (detail) detail.textContent = 'Big Gains could not finish starting. Reload to try again. Your training data was not changed.';
    if (retry) retry.hidden = false;
    console.error(`Big Gains startup stopped safely: ${stable.code} (${stable.component}).`);
    publish();
    return true;
  }

  function degrade(component, code = 'optional-module-init-failed') {
    const stable = Object.freeze({ code: safeToken(code), component: safeToken(component) });
    if (!degraded.some(item => item.code === stable.code && item.component === stable.component)) degraded.push(stable);
    return stable;
  }

  function canInteract() {
    return state === 'interactive';
  }

  function status() {
    return Object.freeze({
      state,
      reason,
      attempt,
      diagnostic,
      degraded: Object.freeze(degraded.map(item => Object.freeze({ ...item })))
    });
  }

  window.BigGainsRuntimeGate = Object.freeze({ begin, markInteractive, fail, degrade, canInteract, status });
  publish();
})();
