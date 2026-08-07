(() => {
  'use strict';

  const config = window.__BIG_GAINS_CLOUD_CONFIG__ || {};
  const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  let client = null;

  function getClient() {
    if (!configured) return null;
    if (client) return client;
    if (typeof window.supabase?.createClient !== 'function') throw new Error('Supabase browser client is unavailable.');
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'big-gains-supabase-auth-v1'
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

  async function requestMagicLink(email) {
    const current = getClient();
    if (!current) throw new Error('Private cloud is not configured.');
    const normalized = String(email || '').trim();
    if (!normalized) throw new Error('Enter your email address.');
    const { error } = await current.auth.signInWithOtp({
      email: normalized,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: config.authRedirectUrl || 'https://velazquick.github.io/big-gains/'
      }
    });
    if (error) throw error;
    return true;
  }

  async function signOut() {
    const current = getClient();
    if (!current) return false;
    const { error } = await current.auth.signOut();
    if (error) throw error;
    return true;
  }

  async function readAccountState() {
    const current = getClient();
    const currentSession = await session();
    if (!current || !currentSession?.user?.id) return Object.freeze({ status: 'signed-out', account: null, profiles: Object.freeze({}) });
    const accounts = await current.from('accounts')
      .select('id,owner_user_id,display_name,created_at')
      .eq('owner_user_id', currentSession.user.id)
      .limit(3);
    if (accounts.error) throw accounts.error;
    if ((accounts.data || []).length === 0) {
      return Object.freeze({ status: 'needs-provisioning', account: null, profiles: Object.freeze({}), authUserId: currentSession.user.id });
    }
    if (accounts.data.length !== 1) {
      return Object.freeze({ status: 'unexpected', reason: `Expected one owned account; found ${accounts.data.length}.`, account: null, profiles: Object.freeze({}), authUserId: currentSession.user.id });
    }
    const account = accounts.data[0];
    const profiles = await current.from('profiles')
      .select('id,account_id,client_id,display_name,pet_enabled,accent,theme,created_at')
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
      status: 'ready', shape,
      account: Object.freeze(account), profiles: Object.freeze(byClientId), authUserId: currentSession.user.id
    });
  }

  async function readCloudAccount() {
    const state = await readAccountState();
    if (state.status !== 'ready') {
      const error = new Error(state.reason || (state.status === 'needs-provisioning'
        ? 'Create your private profile to continue.'
        : 'Sign in to use the private cloud.'));
      error.code = state.status;
      error.accountState = state;
      throw error;
    }
    return Object.freeze({ account: state.account, profiles: state.profiles, shape: state.shape });
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
    const result = await current.rpc('bootstrap_independent_account', { requested_display_name: normalized });
    if (result.error) throw result.error;
    const state = await readAccountState();
    if (state.status !== 'ready' || state.shape !== 'independent') {
      throw new Error(state.reason || 'The private profile could not be verified.');
    }
    return Object.freeze({ account: state.account, profiles: state.profiles, shape: state.shape, bootstrap: result.data });
  }

  function onAuthStateChange(callback) {
    const current = getClient();
    if (!current) return Object.freeze({ unsubscribe() {} });
    const { data } = current.auth.onAuthStateChange((event, nextSession) => callback(event, nextSession));
    return data.subscription;
  }

  window.BigGainsSupabase = Object.freeze({
    configured,
    status: () => Object.freeze({ configured, signedIn: false }),
    getClient,
    session,
    requestMagicLink,
    requestJorgeMagicLink: requestMagicLink,
    signOut,
    readAccountState,
    readCloudAccount,
    readJorgeCloudProfiles: readCloudAccount,
    bootstrapIndependentAccount,
    validatedDisplayName,
    onAuthStateChange
  });
})();
