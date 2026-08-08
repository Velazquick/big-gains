(() => {
  'use strict';

  const ACTIVE_PROFILE_KEY = 'big-gains-active-profile';
  const LEGACY_STATE_KEY = 'big-gains-v1';
  const RUNTIME_ACCOUNTS_KEY = 'big-gains-runtime-accounts-v1';
  const PRESENTATION = Object.freeze({
    accents: Object.freeze(['ember', 'rose', 'cobalt', 'merlot']),
    themes: Object.freeze(['performance-dark', 'wellness-light', 'slate-dark'])
  });
  const INDEPENDENT_PROFILE_PREFIX = 'independent-';
  const MANAGED_PROFILE_IDS = Object.freeze(['jorge', 'alexa']);
  const managedDescriptors = Object.freeze([
    Object.freeze({
      accountId: 'local-jorge', profileId: 'jorge', displayName: 'Jorge', storageNamespace: 'jorge',
      storageKey: 'big-gains-v2', profileConfigRef: 'jorge', legacyStateKey: LEGACY_STATE_KEY,
      presentation: Object.freeze({ petEnabled: true, accent: 'ember', theme: 'performance-dark' })
    }),
    Object.freeze({
      accountId: 'local-alexa', profileId: 'alexa', displayName: 'Alexa', storageNamespace: 'alexa',
      storageKey: 'big-gains-alexa-v1', profileConfigRef: 'alexa',
      presentation: Object.freeze({ petEnabled: true, accent: 'rose', theme: 'wellness-light' })
    })
  ]);

  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const readJson = key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  };
  const safeToken = value => String(value || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const presentationFor = value => Object.freeze({
    petEnabled: value?.petEnabled !== false,
    accent: PRESENTATION.accents.includes(value?.accent) ? value.accent : 'cobalt',
    theme: PRESENTATION.themes.includes(value?.theme) ? value.theme : 'performance-dark'
  });

  function cloudProfileShape(profiles) {
    const rows = Array.isArray(profiles) ? profiles : Object.values(profiles || {});
    const clientIds = rows.map(profile => profile?.client_id).sort();
    if (rows.length === 2 && clientIds[0] === 'alexa' && clientIds[1] === 'jorge') return 'managed';
    if (rows.length === 1 && typeof clientIds[0] === 'string' && clientIds[0].startsWith(INDEPENDENT_PROFILE_PREFIX)) return 'independent';
    return 'unexpected';
  }

  function unexpectedProfileShapeMessage(profiles) {
    const rows = Array.isArray(profiles) ? profiles : Object.values(profiles || {});
    const clientIds = rows.map(profile => typeof profile?.client_id === 'string' ? profile.client_id : '(missing)').sort();
    return `Expected exactly Jorge + Alexa or one independent-* profile; found ${rows.length}${rows.length ? ` (${clientIds.join(', ')})` : ''}.`;
  }

  function createRegistry(sourceDescriptors, {
    defaultAccountId = sourceDescriptors[0]?.accountId,
    activeSelectionKey = ACTIVE_PROFILE_KEY
  } = {}) {
    const accounts = sourceDescriptors.map(descriptor => Object.freeze({ ...descriptor }));
    const byAccountId = new Map(accounts.map(account => [account.accountId, account]));
    const byProfileId = new Map(accounts.map(account => [account.profileId, account]));
    const fallback = byAccountId.get(defaultAccountId) || accounts[0];
    if (!fallback) throw new Error('An account registry requires at least one descriptor.');
    if (byAccountId.size !== accounts.length || byProfileId.size !== accounts.length) throw new Error('Account and profile identifiers must be unique.');
    const resolve = identifier => byAccountId.get(identifier) || byProfileId.get(identifier) || null;
    const loadActive = () => resolve(localStorage.getItem(activeSelectionKey)) || fallback;
    const saveActive = identifier => {
      const account = resolve(identifier);
      if (!account) return false;
      localStorage.setItem(activeSelectionKey, account.profileId);
      return true;
    };
    const sessionKey = (accountOrId, feature) => {
      const account = typeof accountOrId === 'string' ? resolve(accountOrId) : accountOrId;
      return account && feature ? `big-gains-${feature}-${account.storageNamespace}` : null;
    };
    return Object.freeze({ accounts: Object.freeze(accounts), defaultAccount: fallback, resolve, loadActive, saveActive, sessionKey });
  }

  function runtimeStore() {
    const value = readJson(RUNTIME_ACCOUNTS_KEY);
    return value?.version === 1 && isRecord(value.accounts)
      ? value
      : { version: 1, activeAuthUserId: null, accounts: {} };
  }

  function independentRuntime(record) {
    const accountId = safeToken(record?.cloudAccountId);
    const profileId = safeToken(record?.cloudProfileId);
    const clientId = typeof record?.clientId === 'string' ? record.clientId : '';
    if (!accountId || !profileId || !record?.authUserId || !record?.displayName
      || !clientId.startsWith(INDEPENDENT_PROFILE_PREFIX)) return null;
    const storageNamespace = `cloud-${accountId}-${profileId}`;
    const descriptor = Object.freeze({
      accountId: `cloud:${record.cloudAccountId}`,
      profileId: clientId,
      displayName: record.displayName,
      storageNamespace,
      storageKey: `big-gains-${storageNamespace}-v1`,
      profileConfigRef: clientId,
      cloudAccountId: record.cloudAccountId,
      cloudProfileId: record.cloudProfileId,
      presentation: presentationFor(record.presentation)
    });
    return Object.freeze({
      kind: 'independent', authUserId: record.authUserId, cloudAccountId: record.cloudAccountId,
      descriptors: Object.freeze([descriptor]), expectedProfileIds: Object.freeze([clientId]),
      switcherVisible: false, storageNamespace,
      activeSelectionKey: `big-gains-active-profile-${storageNamespace}`,
      cloudKeys: Object.freeze({
        queue: `big-gains-cloud-sync-queue-v1-${storageNamespace}`,
        catalog: `big-gains-cloud-shadow-catalog-v1-${storageNamespace}`,
        comparison: `big-gains-cloud-shadow-comparison-v1-${storageNamespace}`
      })
    });
  }

  function managedOwnerRuntime(authUserId = null, cloudAccountId = null) {
    return Object.freeze({
      kind: 'managed-owner', authUserId, cloudAccountId, cloudShape: 'managed',
      descriptors: managedDescriptors,
      expectedProfileIds: MANAGED_PROFILE_IDS,
      switcherVisible: true,
      storageNamespace: 'managed-jorge-alexa',
      activeSelectionKey: ACTIVE_PROFILE_KEY,
      cloudKeys: Object.freeze({
        queue: 'big-gains-cloud-sync-queue-v1',
        catalog: 'big-gains-cloud-shadow-catalog-v1',
        comparison: 'big-gains-cloud-shadow-comparison-v1'
      })
    });
  }

  function managedMemberRuntime(record) {
    const accountId = safeToken(record?.cloudAccountId);
    const profileId = safeToken(record?.cloudProfileId);
    const authUserId = safeToken(record?.authUserId);
    const clientId = typeof record?.clientId === 'string' ? record.clientId : '';
    if (!accountId || !profileId || !authUserId || !MANAGED_PROFILE_IDS.includes(clientId)
      || !record?.displayName || record?.accessKind !== 'managed-member') return null;
    const storageNamespace = `managed-member-${authUserId}-${accountId}-${profileId}`;
    const descriptor = Object.freeze({
      accountId: `member:${record.cloudAccountId}`,
      profileId: clientId,
      displayName: record.displayName,
      storageNamespace,
      storageKey: `big-gains-${storageNamespace}-v1`,
      profileConfigRef: clientId,
      cloudAccountId: record.cloudAccountId,
      cloudProfileId: record.cloudProfileId,
      presentation: presentationFor(record.presentation)
    });
    return Object.freeze({
      kind: 'managed-member', accessKind: 'managed-member', authUserId: record.authUserId,
      cloudAccountId: record.cloudAccountId, cloudShape: 'managed-member',
      descriptors: Object.freeze([descriptor]), expectedProfileIds: Object.freeze([clientId]),
      switcherVisible: false, storageNamespace,
      activeSelectionKey: `big-gains-active-profile-${storageNamespace}`,
      recoveryKey: `big-gains-managed-recovery-v1-${storageNamespace}`,
      cloudKeys: Object.freeze({
        queue: `big-gains-cloud-sync-queue-v1-${storageNamespace}`,
        catalog: `big-gains-cloud-shadow-catalog-v1-${storageNamespace}`,
        comparison: `big-gains-cloud-shadow-comparison-v1-${storageNamespace}`
      })
    });
  }

  function guestRuntime() {
    const descriptor = Object.freeze({
      accountId: 'device-guest', profileId: 'guest', displayName: 'You', storageNamespace: 'device-guest',
      storageKey: 'big-gains-device-guest-v1', profileConfigRef: 'guest',
      presentation: Object.freeze({ petEnabled: false, accent: 'cobalt', theme: 'performance-dark' })
    });
    return Object.freeze({
      kind: 'guest', authUserId: null, cloudAccountId: null,
      descriptors: Object.freeze([descriptor]), expectedProfileIds: Object.freeze([]),
      switcherVisible: false, storageNamespace: 'device-guest',
      activeSelectionKey: 'big-gains-active-profile-device-guest',
      cloudKeys: Object.freeze({
        queue: 'big-gains-cloud-sync-queue-v1-device-guest',
        catalog: 'big-gains-cloud-shadow-catalog-v1-device-guest',
        comparison: 'big-gains-cloud-shadow-comparison-v1-device-guest'
      })
    });
  }

  function selectRuntime() {
    const store = runtimeStore();
    const cached = store.activeAuthUserId ? store.accounts[store.activeAuthUserId] : null;
    if (cached?.kind === 'independent') return independentRuntime(cached) || guestRuntime();
    if (cached?.kind === 'managed-member') return managedMemberRuntime(cached) || guestRuntime();
    if (cached?.kind === 'managed-owner' || cached?.kind === 'managed') {
      return managedOwnerRuntime(cached.authUserId, cached.cloudAccountId);
    }
    const hasManagedLocalData = [ACTIVE_PROFILE_KEY, LEGACY_STATE_KEY, 'big-gains-v2', 'big-gains-alexa-v1']
      .some(key => localStorage.getItem(key) !== null);
    return hasManagedLocalData ? managedOwnerRuntime() : guestRuntime();
  }

  let runtime = selectRuntime();
  let registry = createRegistry(runtime.descriptors, {
    defaultAccountId: runtime.descriptors[0].accountId,
    activeSelectionKey: runtime.activeSelectionKey
  });

  function cloudRuntimeRecord(owner, authUserId) {
    if (owner?.accessKind === 'managed-member') {
      const profiles = Object.values(owner?.profiles || {});
      const membership = owner?.membership;
      const profile = profiles[0];
      if (!owner?.account?.id || owner.account.owner_user_id === authUserId
        || owner?.authUserId !== authUserId || profiles.length !== 1
        || !MANAGED_PROFILE_IDS.includes(profile?.client_id)
        || membership?.user_id !== authUserId
        || membership?.account_id !== owner.account.id
        || membership?.profile_id !== profile?.id
        || profile?.account_id !== owner.account.id
        || membership?.access_kind !== 'managed-member') {
        throw new Error('Managed profile membership could not be verified.');
      }
      return Object.freeze({
        kind: 'managed-member', accessKind: 'managed-member', authUserId,
        cloudAccountId: owner.account.id, cloudProfileId: profile.id,
        clientId: profile.client_id, displayName: profile.display_name,
        presentation: presentationFor({
          petEnabled: profile.pet_enabled,
          accent: profile.accent,
          theme: profile.theme
        })
      });
    }
    if (!authUserId || owner?.account?.owner_user_id !== authUserId) {
      throw new Error('Cloud ownership could not be verified.');
    }
    const shape = cloudProfileShape(owner?.profiles);
    if (shape === 'managed') {
      return Object.freeze({
        kind: 'managed-owner', authUserId, cloudAccountId: owner.account.id,
        expectedProfileIds: MANAGED_PROFILE_IDS
      });
    }
    if (shape !== 'independent') throw new Error(unexpectedProfileShapeMessage(owner?.profiles));
    const profile = Object.values(owner.profiles)[0];
    return Object.freeze({
      kind: 'independent', authUserId, cloudAccountId: owner.account.id,
      cloudProfileId: profile.id, clientId: profile.client_id, displayName: profile.display_name,
      presentation: presentationFor({
        petEnabled: profile.pet_enabled,
        accent: profile.accent,
        theme: profile.theme
      })
    });
  }

  function activateCloudOwner(owner, authUserId) {
    const record = cloudRuntimeRecord(owner, authUserId);
    const store = runtimeStore();
    store.accounts[authUserId] = record;
    store.activeAuthUserId = authUserId;
    localStorage.setItem(RUNTIME_ACCOUNTS_KEY, JSON.stringify(store));
    return record;
  }

  function matchesCloudOwner(owner, authUserId) {
    let record;
    try { record = cloudRuntimeRecord(owner, authUserId); } catch { return false; }
    if (runtime.kind !== record.kind || runtime.authUserId !== authUserId
      || runtime.cloudAccountId !== record.cloudAccountId) return false;
    if (record.kind === 'managed-owner') return cloudProfileShape(owner.profiles) === 'managed';
    const profile = Object.values(owner.profiles || {})[0];
    return profile?.id === runtime.descriptors[0].cloudProfileId
      && profile?.client_id === runtime.descriptors[0].profileId;
  }

  function matchesCloudPresentation(owner) {
    if (runtime.kind === 'managed-owner') return true;
    if (runtime.kind === 'managed-member') {
      const profile = Object.values(owner?.profiles || {})[0];
      if (!profile || profile.id !== runtime.descriptors[0].cloudProfileId) return false;
      const cloud = presentationFor({
        petEnabled: profile.pet_enabled,
        accent: profile.accent,
        theme: profile.theme
      });
      const current = runtime.descriptors[0].presentation;
      return cloud.petEnabled === current.petEnabled
        && cloud.accent === current.accent
        && cloud.theme === current.theme;
    }
    if (runtime.kind !== 'independent') return false;
    if (cloudProfileShape(owner?.profiles) !== 'independent') return false;
    const profile = Object.values(owner.profiles)[0];
    const cloud = presentationFor({
      petEnabled: profile.pet_enabled,
      accent: profile.accent,
      theme: profile.theme
    });
    const current = runtime.descriptors[0].presentation;
    return cloud.petEnabled === current.petEnabled
      && cloud.accent === current.accent
      && cloud.theme === current.theme;
  }

  window.bigGainsAccounts = Object.freeze({
    activeSelectionKey: runtime.activeSelectionKey,
    legacyStateKey: LEGACY_STATE_KEY,
    runtimeAccountsKey: RUNTIME_ACCOUNTS_KEY,
    presentationAllowlist: PRESENTATION,
    createRegistry,
    registry,
    runtime,
    managedDescriptors,
    managedProfileIds: MANAGED_PROFILE_IDS,
    managedOwnerRuntime,
    managedMemberRuntime,
    presentationFor,
    cloudProfileShape,
    unexpectedProfileShapeMessage,
    activateCloudOwner,
    matchesCloudOwner,
    matchesCloudPresentation,
    cloudRuntimeRecord
  });
})();
