(() => {
  'use strict';

  const config = window.__BIG_GAINS_CLOUD_CONFIG__ || {};
  const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  const signupAvailable = configured && config.selfServeSignup === true;
  const AUTH_STORAGE_KEY = 'big-gains-supabase-auth-v1';
  const SIGNUP_COOLDOWN_KEY = 'big-gains-signup-cooldown-v1';
  const SIGNUP_PENDING_KEY = 'big-gains-signup-pending-v1';
  const RESET_COOLDOWN_KEY = 'big-gains-password-reset-cooldown-v1';
  const MAGIC_LINK_COOLDOWN_KEY = 'big-gains-magic-link-cooldown-v1';
  const REQUEST_COOLDOWN_MS = 60_000;
  let client = null;
  let passwordSignInBusy = false;
  let signupBusy = false;
  let passwordResetBusy = false;
  let magicLinkBusy = false;

  function captureAuthCallback() {
    const query = new URLSearchParams(location.search);
    const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
    const read = name => query.get(name) || fragment.get(name) || '';
    const type = read('type');
    const error = read('error_description') || read('error');
    return Object.freeze({
      present: Boolean(type || error || read('code') || read('access_token') || read('refresh_token')),
      type,
      confirmation: type === 'signup' || type === 'email',
      error: error ? String(error).replaceAll('+', ' ') : '',
      errorCode: read('error_code')
    });
  }

  const authCallbackState = captureAuthCallback();

  function getClient() {
    if (!configured) return null;
    if (client) return client;
    if (typeof window.supabase?.createClient !== 'function') throw new Error('Supabase browser client is unavailable.');
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY
      }
    });
    return client;
  }

  async function session() {
    const current = getClient();
    if (!current) return null;
    const { data, error } = await current.auth.getSession();
    if (error) throw error;
    return data.session || null;
  }

  function standalone() {
    return navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
  }

  function normalizedEmail(email) {
    const value = String(email || '').trim().toLowerCase();
    if (!value) throw new Error('Enter your email address.');
    return value;
  }

  function pendingSignup() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(SIGNUP_PENDING_KEY) || 'null');
      return parsed?.email
        ? Object.freeze({ email: String(parsed.email), requestedAt: Number(parsed.requestedAt) || 0 })
        : null;
    } catch { return null; }
  }

  function rememberSignup(email) {
    try { sessionStorage.setItem(SIGNUP_PENDING_KEY, JSON.stringify({ email, requestedAt: Date.now() })); } catch {}
  }

  function clearPendingSignup() {
    try { sessionStorage.removeItem(SIGNUP_PENDING_KEY); } catch {}
  }

  function cooldownRemaining(key) {
    try {
      return Math.max(0, Number(localStorage.getItem(key) || 0) - Date.now());
    } catch {
      return 0;
    }
  }

  function beginCooldown(key) {
    const until = Date.now() + REQUEST_COOLDOWN_MS;
    try { localStorage.setItem(key, String(until)); } catch {}
    return until;
  }

  async function rejectSession() {
    const current = getClient();
    if (!current) return false;
    try { await current.auth.signOut({ scope: 'local' }); } catch {}
    return true;
  }

  async function verifiedUser(expectedUserId = null, { rejectOnFailure = false } = {}) {
    const current = getClient();
    if (!current) throw new Error('Private cloud is not configured.');
    let result;
    try {
      result = await current.auth.getUser();
    } catch (cause) {
      const error = new Error('The signed-in identity could not be verified.');
      error.code = 'identity-verification-unavailable';
      error.cause = cause;
      if (rejectOnFailure) await rejectSession();
      throw error;
    }
    if (result.error) {
      const error = new Error('The signed-in identity could not be verified.');
      error.code = 'identity-verification-unavailable';
      error.cause = result.error;
      if (rejectOnFailure) await rejectSession();
      throw error;
    }
    const user = result.data?.user || null;
    if (!user?.id || (expectedUserId && user.id !== expectedUserId)) {
      await rejectSession();
      const error = new Error('The signed-in identity could not be verified.');
      error.code = 'identity-mismatch';
      throw error;
    }
    if (user.email_confirmed_at === null && !user.confirmed_at) {
      if (rejectOnFailure) await rejectSession();
      const error = new Error('Confirm your email before continuing. Open the newest Big Gains confirmation message, then sign in again.');
      error.code = 'email-not-confirmed';
      throw error;
    }
    return Object.freeze({ ...user });
  }

  async function signUpWithPassword(email, password) {
    const current = getClient();
    if (!current || !signupAvailable) {
      const error = new Error('Account creation is not available yet. Existing users can still sign in.');
      error.code = 'signup-unavailable';
      throw error;
    }
    if (navigator.onLine === false) {
      const error = new Error('Connect to the internet to create an account.');
      error.code = 'network-unavailable';
      throw error;
    }
    const normalized = normalizedEmail(email);
    const secret = String(password || '');
    if (secret.length < 8) throw new Error('Use at least 8 characters for your password.');
    const remaining = cooldownRemaining(SIGNUP_COOLDOWN_KEY);
    if (remaining || signupBusy) {
      return Object.freeze({ accepted: true, email: normalized, cooldownSeconds: Math.max(1, Math.ceil(remaining / 1000)) });
    }
    signupBusy = true;
    try {
      const { data, error } = await current.auth.signUp({
        email: normalized,
        password: secret,
        options: { emailRedirectTo: config.authRedirectUrl || 'https://app.getbiggains.com/' }
      });
      beginCooldown(SIGNUP_COOLDOWN_KEY);
      if (data?.session) await rejectSession();
      if (error) {
        const message = String(error.message || '').toLowerCase();
        if (error.status === 429 || message.includes('rate limit')) {
          const rejected = new Error('Please wait a minute before trying again.');
          rejected.code = 'signup-rate-limited';
          throw rejected;
        }
        if (message.includes('password') && (message.includes('weak') || message.includes('characters'))) throw error;
        if (message.includes('signup') && message.includes('disabled')) {
          const rejected = new Error('Account creation is not available yet. Existing users can still sign in.');
          rejected.code = 'signup-unavailable';
          throw rejected;
        }
        // Existing-account responses are intentionally indistinguishable from accepted requests.
      }
      rememberSignup(normalized);
      return Object.freeze({ accepted: true, email: normalized, cooldownSeconds: Math.ceil(REQUEST_COOLDOWN_MS / 1000) });
    } finally {
      signupBusy = false;
    }
  }

  async function resendSignupConfirmation(email) {
    const current = getClient();
    if (!current || !signupAvailable) throw new Error('Account creation is not available yet.');
    const normalized = normalizedEmail(email);
    const remaining = cooldownRemaining(SIGNUP_COOLDOWN_KEY);
    if (remaining || signupBusy) {
      return Object.freeze({ accepted: true, cooldownSeconds: Math.max(1, Math.ceil(remaining / 1000)) });
    }
    signupBusy = true;
    beginCooldown(SIGNUP_COOLDOWN_KEY);
    rememberSignup(normalized);
    try {
      await current.auth.resend({
        type: 'signup',
        email: normalized,
        options: { emailRedirectTo: config.authRedirectUrl || 'https://app.getbiggains.com/' }
      });
    } catch {}
    finally { signupBusy = false; }
    return Object.freeze({ accepted: true, cooldownSeconds: Math.ceil(REQUEST_COOLDOWN_MS / 1000) });
  }

  async function signInWithPassword(email, password) {
    const current = getClient();
    if (!current) throw new Error('Private cloud is not configured.');
    if (navigator.onLine === false) throw new Error('Connect to the internet to sign in on a new device.');
    const normalized = normalizedEmail(email);
    const secret = String(password || '');
    if (!secret) throw new Error('Enter your password.');
    if (passwordSignInBusy) throw new Error('Sign-in is already being checked.');
    const transition = window.BigGainsBootGate?.beginTransition('auth-sign-in');
    passwordSignInBusy = true;
    try {
      const { data, error } = await current.auth.signInWithPassword({ email: normalized, password: secret });
      if (error || !data?.session?.user?.id) {
        await rejectSession();
        const rejected = new Error('Email or password is incorrect, or this account is not ready.');
        rejected.code = 'password-sign-in-rejected';
        rejected.cause = error || null;
        throw rejected;
      }
      const user = await verifiedUser(data.session.user.id, { rejectOnFailure: true });
      return Object.freeze({ session: data.session, user });
    } catch (error) {
      window.BigGainsBootGate?.restore(transition);
      throw error;
    } finally {
      passwordSignInBusy = false;
    }
  }

  async function requestPasswordReset(email) {
    const current = getClient();
    if (!current) throw new Error('Private cloud is not configured.');
    const normalized = normalizedEmail(email);
    const remaining = cooldownRemaining(RESET_COOLDOWN_KEY);
    if (remaining || passwordResetBusy) {
      return Object.freeze({ accepted: true, cooldownSeconds: Math.max(1, Math.ceil(remaining / 1000)) });
    }
    passwordResetBusy = true;
    beginCooldown(RESET_COOLDOWN_KEY);
    try {
      await current.auth.resetPasswordForEmail(normalized, {
        redirectTo: config.authSetupRedirectUrl || 'https://app.getbiggains.com/auth-setup.html'
      });
    } catch {}
    finally { passwordResetBusy = false; }
    return Object.freeze({ accepted: true, cooldownSeconds: Math.ceil(REQUEST_COOLDOWN_MS / 1000) });
  }

  async function requestMagicLink(email) {
    const current = getClient();
    if (!current) throw new Error('Private cloud is not configured.');
    if (standalone()) throw new Error('Magic Link is available only in a browser. Use password sign-in in the Home Screen app.');
    const normalized = normalizedEmail(email);
    const remaining = cooldownRemaining(MAGIC_LINK_COOLDOWN_KEY);
    if (remaining || magicLinkBusy) return Object.freeze({ accepted: true, cooldownSeconds: Math.max(1, Math.ceil(remaining / 1000)) });
    magicLinkBusy = true;
    beginCooldown(MAGIC_LINK_COOLDOWN_KEY);
    try {
      const { error } = await current.auth.signInWithOtp({
        email: normalized,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: config.authRedirectUrl || 'https://app.getbiggains.com/'
        }
      });
      if (error) throw error;
      return Object.freeze({ accepted: true, cooldownSeconds: Math.ceil(REQUEST_COOLDOWN_MS / 1000) });
    } finally {
      magicLinkBusy = false;
    }
  }

  async function signOut({ scope = 'global' } = {}) {
    const current = getClient();
    if (!current) return false;
    const transition = window.BigGainsBootGate?.beginTransition('auth-sign-out');
    try {
      const { error } = await current.auth.signOut({ scope });
      if (error) throw error;
      return true;
    } catch (error) {
      window.BigGainsBootGate?.restore(transition);
      throw error;
    }
  }

  async function readAccountState(expectedAuthUserId = null) {
    const current = getClient();
    const currentSession = await session();
    if (!current || !currentSession?.user?.id) return Object.freeze({ status: 'signed-out', account: null, profiles: Object.freeze({}) });
    if (expectedAuthUserId && currentSession.user.id !== expectedAuthUserId) {
      return Object.freeze({
        status: 'unexpected', reason: 'Verified Auth identity does not match the persisted session.',
        account: null, profiles: Object.freeze({}), authUserId: currentSession.user.id
      });
    }
    const [accounts, memberships] = await Promise.all([
      current.from('accounts')
        .select('id,owner_user_id,display_name,created_at')
        .eq('owner_user_id', currentSession.user.id)
        .limit(3),
      current.from('profile_memberships')
        .select('user_id,account_id,profile_id,access_kind,created_at')
        .eq('user_id', currentSession.user.id)
        .limit(3)
    ]);
    if (accounts.error) throw accounts.error;
    if (memberships.error) throw memberships.error;
    const ownedRows = accounts.data || [];
    const membershipRows = memberships.data || [];
    if (ownedRows.length > 1 || membershipRows.length > 1 || (ownedRows.length && membershipRows.length)) {
      return Object.freeze({
        status: 'unexpected', reason: 'Expected exactly one owner account or one managed-profile membership.',
        account: null, profiles: Object.freeze({}), authUserId: currentSession.user.id
      });
    }
    if (ownedRows.length === 0 && membershipRows.length === 0) {
      return Object.freeze({ status: 'needs-provisioning', account: null, profiles: Object.freeze({}), authUserId: currentSession.user.id });
    }

    if (membershipRows.length === 1) {
      const membership = membershipRows[0];
      const [memberAccounts, memberProfiles] = await Promise.all([
        current.from('accounts')
          .select('id,owner_user_id,display_name,created_at')
          .eq('id', membership.account_id)
          .limit(2),
        current.from('profiles')
          .select('id,account_id,client_id,display_name,pet_enabled,accent,accent_version,theme,created_at')
          .eq('account_id', membership.account_id)
          .eq('id', membership.profile_id)
          .limit(2)
      ]);
      if (memberAccounts.error) throw memberAccounts.error;
      if (memberProfiles.error) throw memberProfiles.error;
      const account = (memberAccounts.data || [])[0];
      const profile = (memberProfiles.data || [])[0];
      const exact = (memberAccounts.data || []).length === 1
        && (memberProfiles.data || []).length === 1
        && membership.user_id === currentSession.user.id
        && membership.access_kind === 'managed-member'
        && membership.account_id === account?.id
        && membership.profile_id === profile?.id
        && profile?.account_id === account?.id
        && account?.owner_user_id !== currentSession.user.id
        && window.bigGainsAccounts.managedProfileIds.includes(profile?.client_id);
      if (!exact) {
        return Object.freeze({
          status: 'unexpected', reason: 'Managed profile membership does not match exactly one existing managed profile.',
          account: account ? Object.freeze(account) : null, profiles: Object.freeze({}),
          membership: Object.freeze(membership), authUserId: currentSession.user.id
        });
      }
      return Object.freeze({
        status: 'ready', shape: 'managed-member', accessKind: 'managed-member',
        account: Object.freeze(account),
        profiles: Object.freeze({ [profile.client_id]: Object.freeze(profile) }),
        membership: Object.freeze(membership), authUserId: currentSession.user.id
      });
    }

    const account = ownedRows[0];
    const profiles = await current.from('profiles')
      .select('id,account_id,client_id,display_name,pet_enabled,accent,accent_version,theme,created_at')
      .eq('account_id', account.id)
      .limit(4);
    if (profiles.error) throw profiles.error;
    const rows = profiles.data || [];
    const byClientId = Object.fromEntries(rows.map(profile => [profile.client_id, Object.freeze(profile)]));
    const shape = window.bigGainsAccounts.cloudProfileShape(rows);
    if (shape === 'unexpected') {
      return Object.freeze({
        status: 'unexpected', reason: window.bigGainsAccounts.unexpectedProfileShapeMessage(rows),
        account: Object.freeze(account), profiles: Object.freeze(byClientId), authUserId: currentSession.user.id
      });
    }
    return Object.freeze({
      status: 'ready', shape, accessKind: shape === 'managed' ? 'managed-owner' : 'independent',
      account: Object.freeze(account), profiles: Object.freeze(byClientId), authUserId: currentSession.user.id
    });
  }

  async function readCloudAccount(expectedAuthUserId = null) {
    let verifiedAuthUserId = expectedAuthUserId;
    if (!verifiedAuthUserId) {
      const currentSession = await session();
      if (currentSession?.user?.id) verifiedAuthUserId = (await verifiedUser(currentSession.user.id)).id;
    }
    const state = await readAccountState(verifiedAuthUserId);
    if (state.status !== 'ready') {
      const error = new Error(state.reason || (state.status === 'needs-provisioning'
        ? 'Create your private profile to continue.'
        : 'Sign in to use the private cloud.'));
      error.code = state.status;
      error.accountState = state;
      throw error;
    }
    return Object.freeze({
      account: state.account,
      profiles: state.profiles,
      shape: state.shape,
      accessKind: state.accessKind,
      membership: state.membership || null,
      authUserId: state.authUserId
    });
  }

  // Presentation writes use verified ownership and compare-and-set on only
  // the two accent columns. A stale device never overwrites a newer choice.
  async function updateProfileAccent({ authUserId, accountId, profileId, clientId, expected, accent }) {
    const model = window.BigGainsAppearanceModel;
    if (!model?.names.includes(accent) || !model.normalize(expected)) throw new Error('Invalid accent operation.');
    const currentSession = await session();
    if (currentSession?.user?.id !== authUserId) throw new Error('Presentation identity changed.');
    await verifiedUser(authUserId);
    const owner = await readCloudAccount(authUserId);
    const row = owner.profiles[clientId];
    if (!window.bigGainsAccounts.matchesCloudOwner(owner, authUserId)
      || owner.account.id !== accountId || row?.id !== profileId || row.account_id !== accountId) {
      throw new Error('Presentation profile ownership changed.');
    }
    if ((await session())?.user?.id !== authUserId) throw new Error('Presentation session changed.');
    const result = await getClient().from('profiles')
      .update({ accent, accent_version: 1 })
      .eq('id', profileId).eq('account_id', accountId).eq('client_id', clientId)
      .eq('accent', expected.accent).eq('accent_version', expected.version)
      .select('id,account_id,client_id,accent,accent_version');
    if (result.error) throw result.error;
    if (!result.data?.length) return null;
    if (result.data.length !== 1 || result.data[0].id !== profileId
      || result.data[0].account_id !== accountId || result.data[0].client_id !== clientId
      || result.data[0].accent !== accent || result.data[0].accent_version !== 1) throw new Error('Presentation readback mismatch.');
    return result.data[0];
  }

  function validatedDisplayName(value) {
    const displayName = String(value || '').trim().replace(/\s+/g, ' ');
    if (!displayName || displayName.length > 60 || /[\u0000-\u001f\u007f]/.test(displayName)) {
      throw new Error('Enter a display name between 1 and 60 normal characters.');
    }
    return displayName;
  }

  async function bootstrapIndependentAccount(displayName) {
    const current = getClient();
    const currentSession = await session();
    if (!current || !currentSession?.user?.id) throw new Error('Sign in before creating a private profile.');
    const normalized = validatedDisplayName(displayName);
    const verified = await verifiedUser(currentSession.user.id, { rejectOnFailure: true });
    const preflight = await readAccountState(verified.id);
    if (preflight.status !== 'needs-provisioning') {
      const error = new Error(preflight.accessKind === 'managed-member'
        ? 'Managed profile access is already active; independent onboarding is unavailable.'
        : preflight.status === 'ready'
          ? 'This user already has a private cloud account.'
          : preflight.reason || 'Account setup must be reviewed before creating a private profile.');
      error.code = preflight.accessKind === 'managed-member' ? 'managed-member' : preflight.status;
      error.accountState = preflight;
      throw error;
    }
    const result = await current.rpc('bootstrap_independent_account', { requested_display_name: normalized });
    if (result.error) throw result.error;
    const state = await readAccountState(verified.id);
    if (state.status !== 'ready' || state.shape !== 'independent') {
      throw new Error(state.reason || 'The private profile could not be verified.');
    }
    return Object.freeze({ account: state.account, profiles: state.profiles, shape: state.shape, bootstrap: result.data });
  }

  function onAuthStateChange(callback) {
    const current = getClient();
    if (!current) return Object.freeze({ unsubscribe() {} });
    const { data } = current.auth.onAuthStateChange((event, nextSession) => {
      if (['SIGNED_IN', 'SIGNED_OUT', 'PASSWORD_RECOVERY', 'USER_UPDATED'].includes(event)) {
        window.BigGainsBootGate?.beginTransition(`auth-${event.toLowerCase().replaceAll('_', '-')}`);
      }
      callback(event, nextSession);
    });
    return data.subscription;
  }

  window.BigGainsSupabase = Object.freeze({
    configured,
    signupAvailable,
    authCallbackState,
    status: () => Object.freeze({ configured, signedIn: false }),
    getClient,
    session,
    verifiedUser,
    signInWithPassword,
    signUpWithPassword,
    resendSignupConfirmation,
    pendingSignup,
    clearPendingSignup,
    requestPasswordReset,
    requestMagicLink,
    requestJorgeMagicLink: requestMagicLink,
    signOut,
    updateProfileAccent,
    readAccountState,
    readCloudAccount,
    readJorgeCloudProfiles: readCloudAccount,
    bootstrapIndependentAccount,
    validatedDisplayName,
    onAuthStateChange,
    isStandalone: standalone,
    cooldowns: () => Object.freeze({
      passwordResetMs: cooldownRemaining(RESET_COOLDOWN_KEY),
      signupMs: cooldownRemaining(SIGNUP_COOLDOWN_KEY),
      magicLinkMs: cooldownRemaining(MAGIC_LINK_COOLDOWN_KEY)
    })
  });
})();
