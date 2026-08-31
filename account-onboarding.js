(() => {
  'use strict';

  const boundary = window.BigGainsSupabase;
  const bootGate = window.BigGainsBootGate;
  let initialized = false;
  let subscription = null;
  let busy = false;
  let refreshInFlight = null;
  let rejectionMessage = '';
  let unconfirmedEmail = '';
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

  function signInMarkup(message = 'Sign in to open your private training space.') {
    const signupAction = boundary?.signupAvailable
      ? '<button id="accountOnboardingCreate" class="ghost" type="button">Create account</button>'
      : '<button class="ghost" type="button" disabled>Create account unavailable</button><small>New accounts will open after production email delivery is ready. Existing accounts can still sign in.</small>';
    return `<span class="label">Private cloud</span><h2>This device is ready for you.</h2><p id="accountOnboardingDetail">${escapeHtml(message)}</p>
      <form id="accountOnboardingSignIn" class="cloud-auth-form">
        <label><span>Email</span><input id="accountOnboardingEmail" type="email" autocomplete="email" required></label>
        <label><span>Password</span><input id="accountOnboardingPassword" type="password" autocomplete="current-password" required></label>
        <button class="primary" type="submit">Sign in</button>
        ${signupAction}
        <button id="accountOnboardingReset" class="ghost" type="button">Set or reset password</button>
        ${boundary?.isStandalone() ? '' : '<button id="accountOnboardingMagicLink" class="ghost" type="button">Use Magic Link in this browser</button>'}
      </form><small>Password sign-in keeps this Home Screen app independent from Safari storage. Training stays local first and remains available offline after setup.</small>`;
  }

  function signupMarkup(message = 'Create an independent Big Gains account. You will confirm your email before creating a profile.') {
    return `<span class="label">Create account</span><h2>Your private training space starts here.</h2><p id="accountOnboardingDetail">${escapeHtml(message)}</p>
      <form id="accountOnboardingSignup" class="cloud-auth-form">
        <label><span>Email</span><input id="accountSignupEmail" type="email" autocomplete="email" required></label>
        <label><span>Password</span><input id="accountSignupPassword" type="password" autocomplete="new-password" minlength="8" required><small>Use at least 8 characters.</small></label>
        <label><span>Confirm password</span><input id="accountSignupConfirm" type="password" autocomplete="new-password" minlength="8" required></label>
        <button class="primary" type="submit">Create account</button>
        <button id="accountOnboardingBackToSignIn" class="ghost" type="button">Back to sign in</button>
      </form><small>This step creates only an Auth identity. It cannot create or join a managed profile.</small>`;
  }

  function checkEmailMarkup(email, message = '') {
    const address = String(email || 'your email address');
    return `<span class="label">Confirm your email</span><h2>Check your email.</h2><p id="accountOnboardingDetail">${escapeHtml(message || `If an account can be created for ${address}, a confirmation message is on the way.`)}</p>
      <div class="cloud-auth-form">
        <button id="accountOnboardingResend" class="secondary" type="button">Resend confirmation</button>
        <button id="accountOnboardingEditSignup" class="ghost" type="button">Use a different email</button>
        <button id="accountOnboardingBackToSignIn" class="ghost" type="button">I already confirmed · Sign in</button>
      </div><small>Open the newest link in Safari. If Big Gains is on your Home Screen, return to the Home Screen app afterward and sign in with your password.</small>`;
  }

  function brokenConfirmationMarkup(message = 'This confirmation link is expired, was already used, or could not be verified.') {
    return `<span class="label">Email confirmation</span><h2>This link could not continue.</h2><p id="accountOnboardingDetail">${escapeHtml(message)}</p>
      <div class="cloud-auth-form">
        ${boundary?.signupAvailable ? '<button id="accountOnboardingRestartConfirmation" class="secondary" type="button">Send a new confirmation</button>' : ''}
        <button id="accountOnboardingBackToSignIn" class="ghost" type="button">Return to sign in</button>
      </div><small>If you opened the link in Safari for a Home Screen app, return to the Home Screen app and try password sign-in first.</small>`;
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
      const callback = boundary.authCallbackState;
      const pending = boundary.pendingSignup?.() || (unconfirmedEmail ? { email: unconfirmedEmail } : null);
      if (callback?.error) show(brokenConfirmationMarkup(callback.error));
      else if (callback?.confirmation && callback?.present) show(brokenConfirmationMarkup());
      else if (pending) show(checkEmailMarkup(pending.email));
      else if (rejectionMessage) show(rejectionMarkup(rejectionMessage));
      else if (window.bigGainsAccounts.runtime.kind === 'guest') show(signInMarkup());
      else hide();
      if (window.bigGainsAccounts.runtime.kind === 'guest' || rejectionMessage || pending || callback?.present) {
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
      if (error?.code === 'email-not-confirmed') {
        unconfirmedEmail = currentSession.user.email || boundary.pendingSignup?.()?.email || '';
        show(checkEmailMarkup(unconfirmedEmail, error.message));
        bootGate?.recover('Confirm your email before continuing.', 'email-not-confirmed');
        return null;
      }
      rejectionMessage = error?.message || 'The signed-in identity could not be verified.';
      show(rejectionMarkup(rejectionMessage));
      bootGate?.recover(rejectionMessage, 'identity-verification-failed');
      return null;
    }
    unconfirmedEmail = '';
    boundary.clearPendingSignup?.();
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

  async function submitSignup(form) {
    if (busy) return;
    const password = form.querySelector('#accountSignupPassword').value;
    const confirmation = form.querySelector('#accountSignupConfirm').value;
    const detail = document.getElementById('accountOnboardingDetail');
    if (password !== confirmation) {
      if (detail) detail.textContent = 'Passwords do not match. Nothing was sent.';
      form.querySelector('#accountSignupConfirm').focus();
      return;
    }
    busy = true;
    const button = form.querySelector('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = 'Creating…'; }
    try {
      const result = await boundary.signUpWithPassword(form.querySelector('#accountSignupEmail').value, password);
      show(checkEmailMarkup(result.email));
      renderCooldown(document.getElementById('accountOnboardingResend'), result.cooldownSeconds, 'Resend confirmation');
    } catch (error) {
      if (detail) detail.textContent = error?.message || 'Account creation could not be requested.';
    } finally {
      busy = false;
      if (button?.isConnected) { button.disabled = false; button.textContent = 'Create account'; }
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
      if (detail) detail.textContent = 'If an account can use password recovery, setup instructions are on the way. Open them in Safari, then return here to sign in.';
      renderCooldown(button, result.cooldownSeconds, 'Set or reset password');
    } catch (error) {
      if (detail) detail.textContent = error?.message || 'Enter your email address and try again.';
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

  async function resendSignupConfirmation() {
    const pending = boundary.pendingSignup?.() || (unconfirmedEmail ? { email: unconfirmedEmail } : null);
    const detail = document.getElementById('accountOnboardingDetail');
    const button = document.getElementById('accountOnboardingResend');
    if (!pending?.email) {
      show(signupMarkup('Enter the email address that should receive a new confirmation.'));
      return;
    }
    try {
      const result = await boundary.resendSignupConfirmation(pending.email);
      if (detail) detail.textContent = `If an account can be created for ${pending.email}, a new confirmation message is on the way.`;
      renderCooldown(button, result.cooldownSeconds, 'Resend confirmation');
    } catch (error) {
      if (detail) detail.textContent = error?.message || 'A new confirmation could not be requested.';
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
      if (event.target.id === 'accountOnboardingSignup') { event.preventDefault(); submitSignup(event.target); }
      if (event.target.id === 'independentProfileForm') { event.preventDefault(); submitProvision(event.target); }
    });
    document.addEventListener('click', event => {
      if (event.target.closest('#accountOnboardingCreate')) show(signupMarkup());
      if (event.target.closest('#accountOnboardingBackToSignIn')) show(signInMarkup());
      if (event.target.closest('#accountOnboardingEditSignup')) {
        unconfirmedEmail = '';
        boundary.clearPendingSignup?.();
        show(signupMarkup());
      }
      if (event.target.closest('#accountOnboardingRestartConfirmation')) show(signupMarkup('Enter your email to request a fresh confirmation message.'));
      if (event.target.closest('#accountOnboardingResend')) resendSignupConfirmation();
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
