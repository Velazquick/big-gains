(() => {
  'use strict';

  const existing = window.__BIG_GAINS_CLOUD_CONFIG__;
  window.__BIG_GAINS_CLOUD_CONFIG__ = Object.freeze({
    supabaseUrl: typeof existing?.supabaseUrl === 'string' ? existing.supabaseUrl : '',
    supabasePublishableKey: typeof existing?.supabasePublishableKey === 'string' ? existing.supabasePublishableKey : '',
    automaticReconciliation: existing?.automaticReconciliation === true,
    selfServeSignup: existing?.selfServeSignup === true,
    programPortability: existing?.programPortability === true,
    programPortabilityVersion: existing?.programPortability === true
      && Number(existing?.programPortabilityVersion) === 1 ? 1 : null,
    authRedirectUrl: 'https://app.getbiggains.com/',
    authSetupRedirectUrl: 'https://app.getbiggains.com/auth-setup.html'
  });
})();
