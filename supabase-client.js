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

  async function requestJorgeMagicLink(email) {
    const current = getClient();
    if (!current) throw new Error('Supabase is not configured.');
    const normalized = String(email || '').trim();
    if (!normalized) throw new Error('Enter Jorge’s email address.');
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

  async function readJorgeCloudProfiles() {
    const current = getClient();
    const currentSession = await session();
    if (!current || !currentSession?.user?.id) throw new Error('Jorge must be signed in.');
    const accounts = await current.from('accounts')
      .select('id,owner_user_id')
      .eq('owner_user_id', currentSession.user.id)
      .limit(2);
    if (accounts.error) throw accounts.error;
    const account = accounts.data?.length === 1 ? accounts.data[0] : null;
    if (!account) throw new Error('Exactly one signed-in cloud account is required.');
    const profiles = await current.from('profiles')
      .select('id,account_id,client_id,display_name')
      .eq('account_id', account.id);
    if (profiles.error) throw profiles.error;
    const byClientId = Object.fromEntries((profiles.data || []).map(profile => [profile.client_id, profile]));
    if (!byClientId.jorge || !byClientId.alexa) throw new Error('Both Jorge and Alexa cloud profiles are required.');
    return Object.freeze({ account: Object.freeze(account), profiles: Object.freeze(byClientId) });
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
    requestJorgeMagicLink,
    signOut,
    readJorgeCloudProfiles,
    onAuthStateChange
  });
})();
