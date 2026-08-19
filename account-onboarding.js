(() => {
  'use strict';

  const boundary = window.BigGainsSupabase;
  const bootGate = window.BigGainsBootGate;
  let initialized = false;
  let subscription = null;
  let busy = false;
  let refreshInFlight = null;
  let rejectionMessage = '';
  let cooldownTimer = null;

  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  function ensurePanel() {
    let panel = document.getElementById('independentAccountOnboarding');
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = 'independentAccountOnboarding';
    panel.className = 'account-onboarding';
    panel.hidden = true;
    panel.setAttribute('aria-live', 'polite');
    document.body.appendChild(panel);
    return panel;
  }

  function show(markup, { blocking = true } = {}) {
    const panel = ensurePanel();
    panel.innerHTML = `<div class="account-onboarding-card">${markup}</div>`;
    panel.hidden = false;
    panel.classList.toggle('is-blocking', blocking);
    document.body.classList.toggle('account-onboarding-open', blocking);
  }

  function hide() {
    const panel = ensurePanel();
    panel.hidden = true;
    panel.innerHTML = '';
    document.body.classList.remove('account-onboarding-open');
  }

  function signInMarkup(message = 'Sign in with an invited email address. Public registration is not available.') {
    return `<span class="label">Private cloud</span><h2>This device is ready for you.</h2><p id="accountOnboardingDetail">${escapeHtml(message)}</p>
      <form id="accountOnboardingSignIn" class="cloud-auth-form">
        <label><span>Email</span><input id="accountOnboardingEmail" type="email" autocomplete="email" required></label>
        <label><span>Password</span><input id="accountOnboardingPassword" type="password" autocomplete="current-password" required></label>
        <button class="primary" type="submit">Sign in</button>
        <button id="accountOnboardingReset" class="ghost" type="button">Set or reset password</button>
        ${boundary?.isStandalone() ? '' : '<button id="accountOnboardingMagicLink" class="ghost" type="button">Use Magic Link in this browser</button>'}
      </form><small>Password sign-in keeps this Home Screen app independent from Safari storage. Training stays local first and remains available offline after setup.</small>`;
  }

  function rejectionMarkup(message) {
    return `<span class="label">Private cloud</span><h2>Account setup needs attention.</h2><p id="accountOnboardingDetail">${escapeHtml(message)}</p>
      <button id="accountOnboardingTryAgain" class="primary" type="button">Return to sign in</button>
      <small>The rejected session was removed only from this browser or Home Screen app. No local or cloud training data was changed.</small>`;
  }

  function provisionMarkup(email) {
    const suggested = String(email || '').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, value => value.toUpperCase()).slice(0, 60);
    return `<span class="label">First sign-in</span><h2>Create your private profile.</h2><p>Choose the name Big Gains should use on this device.</p>
      <form id="independentProfileForm" class="cloud-auth-form">
        <label><span>Display name</span><input id="independentDisplayName" type="text" minlength="1" maxlength="60" autocomplete="name" value="${escapeHtml(suggested)}" required></label>
        <div class="account-presentation-preview"><span>Cobalt accent</span><span>Performance dark</span><span>Companion off</span></div>
        <button class="primary" type="submit">Create private profile</button>
      </form><small>This creates one account and one profile owned only by your signed-in Auth user.</small>`;
  }

  function ownerFromState(accountState) {
    return {
      account: accountState.account,
      profiles: accountState.profiles,
      shape: accountState.shape,
      accessKind: accountState.accessKind,
      membership: accountState.membership || null,
      authUserId: accountState.authUserId
    };
  }

  function restoredRuntimeAvailableOffline(userId) {
    return window.bigGainsAccounts.runtime.authUserId === userId
      && window.BigGainsManagedProfileRecovery?.completedForCurrentRuntime();
  }

  function currentRuntimeMatches(owner, userId) {
    const runtime = window.bigGainsAccounts.runtime;
    return runtime.authUserId === userId
      && runtime.cloudAccountId === owner.account.id
      && window.bigGainsAccounts.matchesCloudOwner(owner, userId)
      && window.bigGainsAccounts.matchesCloudPresentation(owner);
  }

  async function performRefresh() {
    if (!boundary?.configured) {
      if (window.bigGainsAccounts.runtime.kind === 'guest') show(signInMarkup('Private cloud is not configured on this build.'), { blocking: false });
      bootGate?.authorize('local-config-unavailable');
      return null;
    }
    bootGate?.beginTransition('identity-resolution');
    let currentSession = null;
    try { currentSession = await boundary.session(); } catch (error) {
      show(`<span class="label">Private cloud</span><h2>Sign-in could not be checked.</h2><p>${escapeHtml(error?.message || 'Try again when connected.')}</p>`);
      bootGate?.recover('Sign-in could not be checked. Try again when connected.', 'session-check-failed');
      return null;
    }
    if (!currentSession?.user?.id) {
      if (rejectionMessage) show(rejectionMarkup(rejectionMessage));
      else if (window.bigGainsAccounts.runtime.kind === 'guest') show(signInMarkup());
      else hide();
      if (window.bigGainsAccounts.runtime.kind === 'guest' || rejectionMessage) {
        bootGate?.recover(rejectionMessage || 'Sign in to open your private training space.', 'signed-out');
      } else {
        bootGate?.authorize('local-signed-out');
      }
      return null;
    }
    let verifiedUser;
    try {
      verifiedUser = await boundary.verifiedUser(currentSession.user.id);
    } catch (error) {
      if (error?.code === 'identity-verification-unavailable'
        && restoredRuntimeAvailableOffline(currentSession.user.id)) {
        hide();
        bootGate?.authorize('offline-cached-identity');
        return Object.freeze({ status: 'offline-cached', reason: error?.message || 'Cloud unavailable.' });
      }
      await boundary.signOut({ scope: 'local' }).catch(() => {});
      rejectionMessage = error?.message || 'The signed-in identity could not be verified.';
      show(rejectionMarkup(rejectionMessage));
      bootGate?.recover(rejectionMessage, 'identity-verification-failed');
      return null;
    }
    let accountState;
    try { accountState = await boundary.readAccountState(verifiedUser.id); } catch (error) {
      if (restoredRuntimeAvailableOffline(verifiedUser.id)) {
        hide();
        bootGate?.authorize('offline-cached-account');
        return Object.freeze({ status: 'offline-cached', reason: error?.message || 'Cloud unavailable.' });
      }
      show(`<span class="label">Private cloud</span><h2>Account check stopped safely.</h2><p>${escapeHtml(error?.message || 'The account could not be verified.')}</p>`);
      bootGate?.recover('Account access could not be verified. Try again when connected.', 'account-verification-failed');
      return null;
    }
    if (accountState.status === 'needs-provisioning') {
      if (window.bigGainsAccounts.runtime.kind === 'managed-member'
        && window.bigGainsAccounts.runtime.authUserId === verifiedUser.id) {
        show('<span class="label">Private cloud</span><h2>Managed access needs review.</h2><p>The previously verified profile membership is no longer available. Independent onboarding is disabled for this device identity.</p><small>No local or cloud training data was changed.</small>');
        bootGate?.recover('Managed profile access needs review.', 'managed-access-review');
        return accountState;
      }
      show(provisionMarkup(verifiedUser.email));
      bootGate?.recover('Finish setting up this private profile to continue.', 'profile-provisioning');
      return accountState;
    }
    if (accountState.status !== 'ready') {
      rejectionMessage = accountState.reason || 'Unexpected account/profile state.';
      await boundary.signOut({ scope: 'local' }).catch(() => {});
      show(rejectionMarkup(rejectionMessage));
      bootGate?.recover(rejectionMessage, 'account-shape-rejected');
      return accountState;
    }
    rejectionMessage = '';
    const owner = ownerFromState(accountState);
    if (!currentRuntimeMatches(owner, verifiedUser.id)) {
      window.bigGainsAccounts.activateCloudOwner(owner, verifiedUser.id);
      location.reload();
      return accountState;
    }
    const shouldRecover = accountState.accessKind === 'managed-member'
      || window.BigGainsManagedProfileRecovery?.needsRecoveryForCurrentRuntime();
    if (shouldRecover) {
      const memberCopy = accountState.accessKind === 'managed-member';
      show(memberCopy
        ? '<span class="label">Private cloud</span><h2>Restoring your profile to this device.</h2><p>Your verified managed profile is being checked and reconstructed from its private cloud baseline.</p><small>Existing local training data is never overwritten.</small>'
        : '<span class="label">Private cloud</span><h2>Restoring your training to this device.</h2><p>Your verified private cloud copy is being read fresh and reconstructed locally.</p><small>Existing local training data is never overwritten or merged.</small>');
      const recovery = await window.BigGainsManagedProfileRecovery.restore({ owner, session: currentSession });
      if (recovery.ok && recovery.status === 'restored') {
        location.reload();
        return accountState;
      }
      if (!recovery.ok) {
        show(`<span class="label">Recovery stopped safely</span><h2>This profile was not restored.</h2><p>${escapeHtml(recovery.message)}</p><small>No existing local training data was overwritten or merged.</small>`);
        bootGate?.recover('Profile recovery stopped safely. Review the recovery details.', 'profile-recovery-failed');
        return Object.freeze({ ...accountState, recovery });
      }
    }
    hide();
    bootGate?.authorize('verified-account-profile');
    return accountState;
  }

  function refresh() {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = performRefresh().finally(() => { refreshInFlight = null; });
    return refreshInFlight;
  }

  async function submitSignIn(form) {
    if (busy) return;
    busy = true;
    const detail = document.getElementById('accountOnboardingDetail');
    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Verifying…'; }
    try {
      await boundary.signInWithPassword(
        form.querySelector('#accountOnboardingEmail').value,
        form.querySelector('#accountOnboardingPassword').value
      );
      rejectionMessage = '';
      await refresh();
    } catch (error) {
      if (detail) detail.textContent = error?.message || 'Email or password could not be verified.';
    } finally {
      busy = false;
      if (button?.isConnected) { button.disabled = false; button.textContent = 'Sign in'; }
    }
  }

  function renderCooldown(button, seconds, idleLabel) {
    if (!button) return;
    window.clearInterval(cooldownTimer);
    let remaining = Math.max(1, Number(seconds) || 60);
    button.disabled = true;
    button.textContent = `${idleLabel} (${remaining}s)`;
    cooldownTimer = window.setInterval(() => {
      remaining -= 1;
      if (remaining > 0 && button.isConnected) button.textContent = `${idleLabel} (${remaining}s)`;
      else {
        window.clearInterval(cooldownTimer);
        if (button.isConnected) { button.disabled = false; button.textContent = idleLabel; }
      }
    }, 1000);
  }

  async function requestPasswordReset() {
    const email = document.getElementById('accountOnboardingEmail');
    const detail = document.getElementById('accountOnboardingDetail');
    const button = document.getElementById('accountOnboardingReset');
    try {
      const result = await boundary.requestPasswordReset(email?.value);
      if (detail) detail.textContent = 'If this invited account exists, password setup instructions are on the way. Open them in Safari, then return here to sign in.';
      renderCooldown(button, result.cooldownSeconds, 'Set or reset password');
    } catch (error) {
      if (detail) detail.textContent = error?.message || 'Enter the invited email address and try again.';
    }
  }

  async function requestBrowserMagicLink() {
    const detail = document.getElementById('accountOnboardingDetail');
    const button = document.getElementById('accountOnboardingMagicLink');
    try {
      const result = await boundary.requestMagicLink(document.getElementById('accountOnboardingEmail')?.value);
      if (detail) detail.textContent = 'Check your email for the browser sign-in link. Magic Link does not sign in the separate Home Screen app.';
      renderCooldown(button, result.cooldownSeconds, 'Use Magic Link in this browser');
    } catch (error) {
      if (detail) detail.textContent = error?.message || 'The browser sign-in link could not be sent.';
    }
  }

  async function submitProvision(form) {
    if (busy) return;
    busy = true;
    const button = form.querySelector('button');
    if (button) { button.disabled = true; button.textContent = 'Creating…'; }
    try {
      const owner = await boundary.bootstrapIndependentAccount(form.querySelector('#independentDisplayName').value);
      const currentSession = await boundary.session();
      const verifiedUser = await boundary.verifiedUser(currentSession?.user?.id, { rejectOnFailure: true });
      window.bigGainsAccounts.activateCloudOwner(owner, verifiedUser.id, { newlyProvisioned: true });
      location.reload();
    } catch (error) {
      show(`${provisionMarkup(form.querySelector('#independentDisplayName').value)}<p class="account-onboarding-error" role="alert">${escapeHtml(error?.message || 'The private profile could not be created.')}</p>`);
    } finally {
      busy = false;
    }
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    ensurePanel();
    document.addEventListener('submit', event => {
      if (event.target.id === 'accountOnboardingSignIn') { event.preventDefault(); submitSignIn(event.target); }
      if (event.target.id === 'independentProfileForm') { event.preventDefault(); submitProvision(event.target); }
    });
    document.addEventListener('click', event => {
      if (event.target.closest('#accountOnboardingReset')) requestPasswordReset();
      if (event.target.closest('#accountOnboardingMagicLink')) requestBrowserMagicLink();
      if (event.target.closest('#accountOnboardingTryAgain')) {
        rejectionMessage = '';
        show(signInMarkup());
      }
    });
    subscription = boundary?.onAuthStateChange(() => window.setTimeout(refresh, 0));
    refresh();
    return true;
  }

  window.BigGainsAccountOnboarding = Object.freeze({
    initialize,
    refresh,
    status: () => Object.freeze({ initialized, busy, active: !ensurePanel().hidden, authSubscribed: Boolean(subscription) })
  });
})();
