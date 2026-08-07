(() => {
  'use strict';

  const boundary = window.BigGainsSupabase;
  let initialized = false;
  let subscription = null;
  let busy = false;

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
        <button class="primary" type="submit">Email sign-in link</button>
      </form><small>Your training stays local first and remains available offline after setup.</small>`;
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

  function currentRuntimeMatches(owner, userId) {
    const runtime = window.bigGainsAccounts.runtime;
    return runtime.authUserId === userId
      && runtime.cloudAccountId === owner.account.id
      && window.bigGainsAccounts.matchesCloudOwner(owner, userId);
  }

  async function refresh() {
    if (!boundary?.configured) {
      if (window.bigGainsAccounts.runtime.kind === 'guest') show(signInMarkup('Private cloud is not configured on this build.'), { blocking: false });
      return null;
    }
    let currentSession = null;
    try { currentSession = await boundary.session(); } catch (error) {
      show(`<span class="label">Private cloud</span><h2>Sign-in could not be checked.</h2><p>${escapeHtml(error?.message || 'Try again when connected.')}</p>`);
      return null;
    }
    if (!currentSession?.user?.id) {
      if (window.bigGainsAccounts.runtime.kind === 'guest') show(signInMarkup());
      else hide();
      return null;
    }
    let accountState;
    try { accountState = await boundary.readAccountState(); } catch (error) {
      show(`<span class="label">Private cloud</span><h2>Account check stopped safely.</h2><p>${escapeHtml(error?.message || 'The account could not be verified.')}</p>`);
      return null;
    }
    if (accountState.status === 'needs-provisioning') {
      show(provisionMarkup(currentSession.user.email));
      return accountState;
    }
    if (accountState.status !== 'ready') {
      show(`<span class="label">Private cloud</span><h2>Account setup needs attention.</h2><p>${escapeHtml(accountState.reason || 'Unexpected account/profile state.')}</p><small>No local or cloud training data was changed.</small>`);
      return accountState;
    }
    const owner = { account: accountState.account, profiles: accountState.profiles };
    if (!currentRuntimeMatches(owner, currentSession.user.id)) {
      window.bigGainsAccounts.activateCloudOwner(owner, currentSession.user.id);
      location.reload();
      return accountState;
    }
    hide();
    return accountState;
  }

  async function submitSignIn(form) {
    const detail = document.getElementById('accountOnboardingDetail');
    try {
      await boundary.requestMagicLink(form.querySelector('#accountOnboardingEmail').value);
      if (detail) detail.textContent = 'Check your email for the private sign-in link.';
    } catch (error) {
      if (detail) detail.textContent = error?.message || 'The sign-in link could not be sent.';
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
      window.bigGainsAccounts.activateCloudOwner(owner, currentSession.user.id);
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
