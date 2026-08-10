(() => {
  'use strict';

  const config = window.__BIG_GAINS_CLOUD_CONFIG__ || {};
  const detail = document.getElementById('authSetupDetail');
  const form = document.getElementById('authSetupForm');
  const complete = document.getElementById('authSetupComplete');
  let client = null;
  let verifiedUserId = null;
  let busy = false;

  function message(value) {
    detail.textContent = value;
  }

  async function localSignOut() {
    try { await client?.auth.signOut({ scope: 'local' }); } catch {}
  }

  async function verify(expectedUserId = null) {
    const { data, error } = await client.auth.getUser();
    const user = data?.user || null;
    if (error || !user?.id || (expectedUserId && user.id !== expectedUserId)) {
      await localSignOut();
      throw new Error('This setup link could not be verified. Request a new password setup email from Big Gains.');
    }
    return user;
  }

  async function initialize() {
    if (!config.supabaseUrl || !config.supabasePublishableKey || typeof window.supabase?.createClient !== 'function') {
      message('Password setup is unavailable on this build. Return to Big Gains and try again later.');
      return;
    }
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'big-gains-supabase-auth-v1'
      }
    });
    try {
      const { data, error } = await client.auth.getSession();
      if (error || !data?.session?.user?.id) throw new Error('This setup link has expired or has already been used. Request a new password setup email from Big Gains.');
      const user = await verify(data.session.user.id);
      verifiedUserId = user.id;
      history.replaceState(null, '', `${location.pathname}${location.search}`);
      message('Choose a password for future sign-in from the standalone Home Screen app.');
      form.hidden = false;
    } catch (error) {
      await localSignOut();
      message(error?.message || 'This setup link could not be verified.');
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !verifiedUserId) return;
    const password = document.getElementById('authSetupPassword').value;
    const confirmation = document.getElementById('authSetupConfirm').value;
    if (password.length < 8) { message('Use at least 8 characters.'); return; }
    if (password !== confirmation) { message('The two passwords do not match.'); return; }
    busy = true;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Saving…';
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      await verify(verifiedUserId);
      await localSignOut();
      form.hidden = true;
      detail.hidden = true;
      complete.hidden = false;
    } catch (error) {
      message(error?.message || 'The password could not be saved. Request a new setup email and try again.');
      button.disabled = false;
      button.textContent = 'Save password';
    } finally {
      busy = false;
    }
  });

  initialize();
})();
