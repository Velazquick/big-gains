(() => {
  'use strict';

  const ROOT_SELECTOR = 'body > .app-shell, body > dialog';
  const root = document.documentElement;
  const shell = document.getElementById('bootShell');
  const detail = document.getElementById('bootShellDetail');
  let state = 'unresolved';
  let reason = 'startup';
  let epoch = 0;

  function personalizedRoots() {
    return [...document.querySelectorAll(ROOT_SELECTOR)];
  }

  function conceal(nextReason = reason) {
    reason = nextReason;
    root.dataset.bootState = state;
    personalizedRoots().forEach(element => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    if (shell) shell.hidden = false;
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
    if (state === 'verified' && root.dataset.bootState === 'verified') return false;
    epoch += 1;
    state = 'verified';
    reason = nextReason;
    // Render while the personalized roots are still concealed. The DOM becomes
    // visible only after every authorized render listener has completed.
    document.dispatchEvent(new CustomEvent('big-gains-boot-authorized', {
      detail: Object.freeze({ reason })
    }));
    personalizedRoots().forEach(element => {
      element.inert = false;
      element.removeAttribute('aria-hidden');
    });
    root.dataset.bootState = 'verified';
    if (shell) shell.hidden = true;
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
    status: () => Object.freeze({ state, reason, epoch })
  });

  conceal('startup');
})();
