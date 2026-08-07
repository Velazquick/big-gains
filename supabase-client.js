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

  async function ensureJorgeCloudProfiles() {
    const current = getClient();
    const currentSession = await session();
    if (!current || !currentSession?.user?.id) throw new Error('Jorge must be signed in.');

    let { data: accounts, error } = await current.from('accounts').select('id,owner_user_id').limit(1);
    if (error) throw error;
    let account = accounts?.[0] || null;
    if (!account) {
      const created = await current.from('accounts').insert({
        owner_user_id: currentSession.user.id,
        display_name: 'Jorge account'
      }).select('id,owner_user_id').single();
      if (created.error?.code === '23505') {
        const existing = await current.from('accounts').select('id,owner_user_id').limit(1).single();
        if (existing.error) throw existing.error;
        account = existing.data;
      } else {
        if (created.error) throw created.error;
        account = created.data;
      }
    }

    const profileRows = [
      { account_id: account.id, client_id: 'jorge', display_name: 'Jorge' },
      { account_id: account.id, client_id: 'alexa', display_name: 'Alexa' }
    ];
    const inserted = await current.from('profiles').upsert(profileRows, {
      onConflict: 'account_id,client_id',
      ignoreDuplicates: true
    });
    if (inserted.error) throw inserted.error;
    const profiles = await current.from('profiles').select('id,account_id,client_id,display_name').eq('account_id', account.id);
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
    ensureJorgeCloudProfiles,
    onAuthStateChange
  });
})();
