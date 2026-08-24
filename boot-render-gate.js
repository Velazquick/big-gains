(() => {
  'use strict';

  const ROOT_SELECTOR = 'body > .app-shell, body > dialog';
  const root = document.documentElement;
  const shell = document.getElementById('bootShell');
  const detail = document.getElementById('bootShellDetail');
  let state = 'unresolved';
  let reason = 'startup';
  let epoch = 0;
  let authorizing = false;

  function personalizedRoots() {
    return [...document.querySelectorAll(ROOT_SELECTOR)];
  }

  function syncVisibility() {
    const visible = state === 'verified'
      && !authorizing
      && window.BigGainsRuntimeGate?.canInteract?.() === true;
    root.dataset.bootState = state;
    personalizedRoots().forEach(element => {
      element.inert = !visible;
      if (visible) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', 'true');
    });
    if (shell) shell.hidden = visible;
    return visible;
  }

  function conceal(nextReason = reason) {
    reason = nextReason;
    syncVisibility();
  }

  function beginTransition(nextReason = 'identity-transition') {
    const token = Object.freeze({ epoch: ++epoch, state, reason });
    state = 'unresolved';
    conceal(nextReason);
    document.dispatchEvent(new CustomEvent('big-gains-boot-concealed', {
      detail: Object.freeze({ reason })
    }));
    return token;
  }

  function authorize(nextReason = 'identity-resolved') {
    if (state === 'verified' && root.dataset.bootState === 'verified') {
      syncVisibility();
      return false;
    }
    epoch += 1;
    state = 'verified';
    reason = nextReason;
    root.dataset.bootState = state;
    // Render while the personalized roots are still concealed. The DOM becomes
    // visible only after every authorized render listener and the separate
    // runtime composition boundary have both completed.
    authorizing = true;
    try {
      document.dispatchEvent(new CustomEvent('big-gains-boot-authorized', {
        detail: Object.freeze({ reason })
      }));
    } finally {
      authorizing = false;
      syncVisibility();
    }
    return true;
  }

  function recover(message = 'Your private training space could not be verified.', nextReason = 'identity-recovery') {
    epoch += 1;
    state = 'recovery';
    if (detail) detail.textContent = message;
    conceal(nextReason);
    return true;
  }

  function restore(token) {
    if (!token || token.epoch !== epoch || state !== 'unresolved') return false;
    if (token.state === 'verified') return authorize(token.reason || 'identity-resolved');
    if (token.state === 'recovery') return recover(undefined, token.reason || 'identity-recovery');
    return false;
  }

  function canRender() {
    return state === 'verified';
  }

  window.BigGainsBootGate = Object.freeze({
    beginTransition,
    authorize,
    recover,
    restore,
    canRender,
    refreshVisibility: syncVisibility,
    status: () => Object.freeze({ state, reason, epoch })
  });

  conceal('startup');
})();
