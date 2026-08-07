(() => {
  'use strict';

  const existing = window.__BIG_GAINS_CLOUD_CONFIG__;
  window.__BIG_GAINS_CLOUD_CONFIG__ = Object.freeze({
    supabaseUrl: typeof existing?.supabaseUrl === 'string' ? existing.supabaseUrl : '',
    supabasePublishableKey: typeof existing?.supabasePublishableKey === 'string' ? existing.supabasePublishableKey : '',
    authRedirectUrl: 'https://velazquick.github.io/big-gains/'
  });
})();
