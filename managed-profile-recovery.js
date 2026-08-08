(() => {
  'use strict';

  const FORMAT = 'big-gains.managed-profile-recovery.v1';
  const runtime = window.bigGainsAccounts.runtime;
  const shadow = window.BigGainsCloudShadow;
  let recoveryInFlight = null;
  let suppressLocalSave = false;

  const readJson = key => {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  };
  const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  function verifiedOwner(owner, session) {
    return runtime.kind === 'managed-member'
      && session?.user?.id === runtime.authUserId
      && owner?.authUserId === runtime.authUserId
      && owner?.accessKind === 'managed-member'
      && window.bigGainsAccounts.matchesCloudOwner(owner, session.user.id)
      && window.bigGainsAccounts.matchesCloudPresentation(owner);
  }

  function markerMatches(marker, owner, descriptor) {
    return marker?.format === FORMAT
      && marker.authUserId === runtime.authUserId
      && marker.accountId === owner.account.id
      && marker.profileId === descriptor.cloudProfileId
      && marker.profileClientId === descriptor.profileId
      && marker.storageKey === descriptor.storageKey;
  }

  function completedForCurrentRuntime() {
    if (runtime.kind !== 'managed-member') return false;
    const descriptor = runtime.descriptors[0];
    const marker = readJson(runtime.recoveryKey);
    const state = readJson(descriptor.storageKey);
    return state?.version === 5
      && state.profileId === descriptor.profileId
      && marker?.format === FORMAT
      && marker.authUserId === runtime.authUserId
      && marker.accountId === runtime.cloudAccountId
      && marker.profileId === descriptor.cloudProfileId
      && marker.profileClientId === descriptor.profileId
      && marker.storageKey === descriptor.storageKey;
  }

  function blocked(reason, message, details = {}) {
    return Object.freeze({ ok: false, blocked: true, reason, message, ...details });
  }

  async function performRestore({ owner, session }) {
    if (!verifiedOwner(owner, session)) {
      return blocked('membership-verification-failed', 'The signed-in managed-profile membership could not be verified. No local data was changed.');
    }
    const descriptor = runtime.descriptors[0];
    const existingState = localStorage.getItem(descriptor.storageKey);
    const existingMarker = readJson(runtime.recoveryKey);
    if (existingState !== null) {
      if (markerMatches(existingMarker, owner, descriptor) && completedForCurrentRuntime()) {
        return Object.freeze({ ok: true, status: 'already-restored', profileClientId: descriptor.profileId });
      }
      return blocked(
        'local-namespace-not-empty',
        'This device already contains local data for this managed profile. Big Gains will not overwrite or merge it. Review this device with the account owner before continuing.'
      );
    }

    const namespaceKeys = [
      runtime.cloudKeys.queue,
      runtime.cloudKeys.catalog,
      runtime.cloudKeys.comparison,
      runtime.recoveryKey
    ];
    if (namespaceKeys.some(key => localStorage.getItem(key) !== null)) {
      return blocked(
        'local-namespace-not-pristine',
        'This managed-profile namespace was already initialized. Recovery stopped without overwriting local data; review the saved recovery details before continuing.'
      );
    }
    if (window.BigGainsCloudSync?.queue?.pending().length) {
      return blocked('local-queue-not-empty', 'Local outbound changes already exist for this profile, so cloud recovery stopped without changing local data.');
    }

    let remote;
    let cloud;
    let restored;
    try {
      const repository = shadow.createRepository({
        client: window.BigGainsSupabase.getClient(),
        accountId: owner.account.id
      });
      remote = await repository.readAll();
      cloud = await shadow.reconstructCloud({
        ...remote,
        profiles: owner.profiles,
        accountId: owner.account.id
      });
      if (cloud.ownershipIssues.length) {
        return blocked('cloud-ownership-mismatch', 'Cloud recovery returned rows outside the verified account/profile membership. No local data was changed.');
      }
      restored = await shadow.schemaV5FromCloud({ cloud, profileClientId: descriptor.profileId });
    } catch (error) {
      return blocked(
        error?.code || 'cloud-reconstruction-failed',
        error?.message || 'The cloud profile could not be reconstructed safely. No local data was changed.',
        { details: error?.issues || error?.reasons || null }
      );
    }

    const journal = shadow.completedMigrationJournal(remote.journals, owner.account.id);
    const catalog = shadow.catalogFromCloud({ cloud, owner, journal });
    catalog.migrationId = journal?.metadata?.migrationId || 'managed-member-fresh-recovery';
    const comparison = {
      contract: restored.comparison.contract,
      parity: true,
      comparedAt: restored.comparison.comparedAt,
      profiles: Object.fromEntries(shadow.profileIds.map(profileClientId => [profileClientId, {
        parity: restored.comparison.profiles[profileClientId].parity,
        localChecksum: restored.comparison.profiles[profileClientId].localChecksum,
        cloudChecksum: restored.comparison.profiles[profileClientId].cloudChecksum,
        reasons: restored.comparison.profiles[profileClientId].reasons
      }])),
      reasons: []
    };
    const marker = {
      format: FORMAT,
      version: 1,
      authUserId: runtime.authUserId,
      accountId: owner.account.id,
      profileId: descriptor.cloudProfileId,
      profileClientId: descriptor.profileId,
      storageKey: descriptor.storageKey,
      recoveredAt: new Date().toISOString(),
      semanticChecksum: restored.comparison.profiles[descriptor.profileId].cloudChecksum
    };

    try {
      suppressLocalSave = true;
      writeJson(descriptor.storageKey, restored.state);
      writeJson(runtime.cloudKeys.catalog, catalog);
      writeJson(runtime.cloudKeys.comparison, comparison);
      writeJson(runtime.recoveryKey, marker);
    } catch (error) {
      return blocked(
        'recovery-persistence-failed',
        'Recovery could not be finalized on this device. Big Gains stopped and will not overwrite the partial local state; review device storage availability before continuing.',
        { error: error?.message || String(error) }
      );
    }
    return Object.freeze({
      ok: true,
      status: 'restored',
      profileClientId: descriptor.profileId,
      queuePending: window.BigGainsCloudSync?.queue?.pending().length || 0,
      parity: true,
      state: restored.state,
      catalog,
      marker
    });
  }

  function restore(input) {
    if (recoveryInFlight) return recoveryInFlight;
    recoveryInFlight = performRestore(input).finally(() => { recoveryInFlight = null; });
    return recoveryInFlight;
  }

  window.BigGainsManagedProfileRecovery = Object.freeze({
    format: FORMAT,
    restore,
    completedForCurrentRuntime,
    suppressingLocalSave: () => suppressLocalSave
  });
})();
