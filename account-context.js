(() => {
  'use strict';

  const ACTIVE_ACCOUNT_KEY = 'big-gains-active-profile';
  const LEGACY_STATE_KEY = 'big-gains-v1';
  const descriptors = [
    { accountId: 'local-jorge', profileId: 'jorge', displayName: 'Jorge', storageNamespace: 'jorge', storageKey: 'big-gains-v2', profileConfigRef: 'jorge', legacyStateKey: LEGACY_STATE_KEY },
    { accountId: 'local-alexa', profileId: 'alexa', displayName: 'Alexa', storageNamespace: 'alexa', storageKey: 'big-gains-alexa-v1', profileConfigRef: 'alexa' }
  ];

  function createRegistry(sourceDescriptors, { defaultAccountId = sourceDescriptors[0]?.accountId } = {}) {
    const accounts = sourceDescriptors.map(descriptor => Object.freeze({ ...descriptor }));
    const byAccountId = new Map(accounts.map(account => [account.accountId, account]));
    const byProfileId = new Map(accounts.map(account => [account.profileId, account]));
    const fallback = byAccountId.get(defaultAccountId) || accounts[0];
    if (!fallback) throw new Error('An account registry requires at least one descriptor.');
    if (byAccountId.size !== accounts.length || byProfileId.size !== accounts.length) throw new Error('Account and profile identifiers must be unique.');
    const resolve = identifier => byAccountId.get(identifier) || byProfileId.get(identifier) || null;
    const loadActive = () => resolve(localStorage.getItem(ACTIVE_ACCOUNT_KEY)) || fallback;
    const saveActive = identifier => {
      const account = resolve(identifier);
      if (!account) return false;
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, account.profileId);
      return true;
    };
    const sessionKey = (accountOrId, feature) => {
      const account = typeof accountOrId === 'string' ? resolve(accountOrId) : accountOrId;
      return account && feature ? `big-gains-${feature}-${account.storageNamespace}` : null;
    };
    return Object.freeze({ accounts: Object.freeze(accounts), defaultAccount: fallback, resolve, loadActive, saveActive, sessionKey });
  }

  const registry = createRegistry(descriptors, { defaultAccountId: 'local-jorge' });
  window.bigGainsAccounts = Object.freeze({ activeSelectionKey: ACTIVE_ACCOUNT_KEY, legacyStateKey: LEGACY_STATE_KEY, createRegistry, registry });
})();
