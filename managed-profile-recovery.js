(() => {
  'use strict';

  const MEMBER_FORMAT = 'big-gains.managed-profile-recovery.v1';
  const FRESH_FORMAT = 'big-gains.fresh-device-recovery.v1';
  const SUPPORTED_KINDS = new Set(['managed-owner', 'independent', 'managed-member']);
  const runtime = window.bigGainsAccounts.runtime;
  const shadow = window.BigGainsCloudShadow;
  const statePersistence = window.bigGainsStatePersistence;
  let recoveryInFlight = null;
  let commitProtection = false;

  const trainingKeys = new Set([
    ...runtime.descriptors.map(descriptor => descriptor.storageKey),
    ...(runtime.kind === 'managed-owner' && window.bigGainsAccounts.legacyStateKey ? [window.bigGainsAccounts.legacyStateKey] : [])
  ]);
  const readStorage = key => trainingKeys.has(key) ? statePersistence.readRawOwnedState(key) : localStorage.getItem(key);
  const writeStorage = (key, value) => trainingKeys.has(key) ? statePersistence.writeRawOwnedState(key, value) : localStorage.setItem(key, value);
  const removeStorage = key => trainingKeys.has(key) ? statePersistence.removeRawOwnedState(key) : localStorage.removeItem(key);
  const readJson = key => {
    try { return JSON.parse(readStorage(key) || 'null'); } catch { return null; }
  };
  const blocked = (reason, message, details = {}) => Object.freeze({ ok: false, blocked: true, reason, message, ...details });
  const profileRows = owner => Object.values(owner?.profiles || {});

  function supportedRuntime() {
    return SUPPORTED_KINDS.has(runtime.kind) && Boolean(runtime.recoveryKey);
  }

  function localTrainingKeys() {
    return [...trainingKeys];
  }

  function pristineTrainingNamespace() {
    if (!supportedRuntime() || runtime.newlyProvisioned === true) return false;
    try { return localTrainingKeys().every(key => readStorage(key) === null); } catch { return false; }
  }

  function targetsFor(owner) {
    return runtime.descriptors.map(descriptor => {
      const profile = owner?.profiles?.[descriptor.profileId];
      if (!profile || profile.account_id !== owner.account.id || profile.client_id !== descriptor.profileId
        || (descriptor.cloudProfileId && descriptor.cloudProfileId !== profile.id)) {
        throw Object.assign(new Error(`Verified cloud profile ${descriptor.profileId} does not match this runtime.`), {
          code: 'fresh-recovery-profile-mismatch'
        });
      }
      return Object.freeze({ descriptor, profile, profileClientId: descriptor.profileId, cloudProfileId: profile.id });
    });
  }

  function verifiedOwner(owner, session) {
    if (!supportedRuntime()
      || session?.user?.id !== runtime.authUserId
      || owner?.authUserId !== runtime.authUserId
      || owner?.account?.id !== runtime.cloudAccountId
      || !window.bigGainsAccounts.matchesCloudOwner(owner, session.user.id)
      || !window.bigGainsAccounts.matchesCloudPresentation(owner)) return false;
    if (runtime.kind === 'managed-member') return owner.accessKind === 'managed-member' && profileRows(owner).length === 1;
    if (runtime.kind === 'managed-owner') return owner.accessKind === 'managed-owner'
      && window.bigGainsAccounts.cloudProfileShape(owner.profiles) === 'managed';
    return owner.accessKind === 'independent'
      && window.bigGainsAccounts.cloudProfileShape(owner.profiles) === 'independent';
  }

  function sameVerifiedMapping(left, right) {
    if (left?.account?.id !== right?.account?.id || left?.authUserId !== right?.authUserId
      || left?.accessKind !== right?.accessKind) return false;
    const leftProfiles = Object.fromEntries(profileRows(left).map(profile => [profile.client_id, profile.id]).sort(([a], [b]) => a.localeCompare(b)));
    const rightProfiles = Object.fromEntries(profileRows(right).map(profile => [profile.client_id, profile.id]).sort(([a], [b]) => a.localeCompare(b)));
    return JSON.stringify(leftProfiles) === JSON.stringify(rightProfiles);
  }

  function memberMarkerMatches(marker, owner, target) {
    return marker?.format === MEMBER_FORMAT
      && marker.authUserId === runtime.authUserId
      && marker.accountId === owner.account.id
      && marker.profileId === target.cloudProfileId
      && marker.profileClientId === target.profileClientId
      && marker.storageKey === target.descriptor.storageKey;
  }

  function freshMarkerMatches(marker, owner, targets) {
    if (marker?.format !== FRESH_FORMAT || marker.version !== 1
      || marker.kind !== runtime.kind || marker.authUserId !== runtime.authUserId
      || marker.accountId !== owner.account.id || !Array.isArray(marker.profiles)
      || marker.profiles.length !== targets.length) return false;
    return targets.every(target => marker.profiles.some(profile => profile.profileClientId === target.profileClientId
      && profile.profileId === target.cloudProfileId
      && profile.storageKey === target.descriptor.storageKey
      && typeof profile.semanticChecksum === 'string'));
  }

  function completedForCurrentRuntime(ownerOverride = null) {
    if (!supportedRuntime()) return false;
    const marker = readJson(runtime.recoveryKey);
    const owner = ownerOverride || {
      account: { id: runtime.cloudAccountId },
      profiles: Object.fromEntries(runtime.descriptors.map(descriptor => [descriptor.profileId, {
        id: descriptor.cloudProfileId || marker?.profiles?.find(profile => profile.profileClientId === descriptor.profileId)?.profileId || marker?.profileId,
        account_id: runtime.cloudAccountId,
        client_id: descriptor.profileId
      }]))
    };
    let targets;
    try { targets = targetsFor(owner); } catch { return false; }
    const validStates = targets.every(target => {
      const state = readJson(target.descriptor.storageKey);
      return state?.version === 5 && state.profileId === target.profileClientId;
    });
    if (!validStates) return false;
    return runtime.kind === 'managed-member'
      ? memberMarkerMatches(marker, owner, targets[0])
      : freshMarkerMatches(marker, owner, targets);
  }

  function needsRecoveryForCurrentRuntime() {
    return pristineTrainingNamespace();
  }

  function inMemoryStateIsBlank(state) {
    return state?.version === 5
      && Array.isArray(state.workouts) && state.workouts.length === 0
      && Array.isArray(state.weights) && state.weights.length === 0
      && !state.activeWorkout && !state.restTimerEndsAt
      && Object.keys(state.prs || {}).length === 0
      && Object.keys(state.customRoutines || {}).length === 0
      && Object.keys(state.exercisePreferences || {}).length === 0
      && state.timerPreferences?.sound === true
      && state.timerPreferences?.vibration === true;
  }

  function verifiablyEmptyQueue() {
    if ((window.BigGainsCloudSync?.queue?.pending?.().length || 0) !== 0) return false;
    let raw;
    try { raw = localStorage.getItem(runtime.cloudKeys.queue); } catch { return false; }
    if (raw === null) return true;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.version === 1 && Array.isArray(parsed.pending) && parsed.pending.length === 0;
    } catch { return false; }
  }

  function comparisonDocument(comparison) {
    return {
      contract: comparison.contract,
      parity: comparison.parity,
      comparedAt: comparison.comparedAt,
      profiles: Object.fromEntries(shadow.profileIds.map(profileClientId => [profileClientId, {
        parity: comparison.profiles[profileClientId].parity,
        localChecksum: comparison.profiles[profileClientId].localChecksum,
        cloudChecksum: comparison.profiles[profileClientId].cloudChecksum,
        reasons: comparison.profiles[profileClientId].reasons
      }])),
      reasons: comparison.reasons
    };
  }

  function recoveryMarker(owner, targets, comparison) {
    const recoveredAt = new Date().toISOString();
    if (runtime.kind === 'managed-member') {
      const target = targets[0];
      return {
        format: MEMBER_FORMAT,
        version: 1,
        authUserId: runtime.authUserId,
        accountId: owner.account.id,
        profileId: target.cloudProfileId,
        profileClientId: target.profileClientId,
        storageKey: target.descriptor.storageKey,
        recoveredAt,
        semanticChecksum: comparison.profiles[target.profileClientId].cloudChecksum
      };
    }
    return {
      format: FRESH_FORMAT,
      version: 1,
      kind: runtime.kind,
      authUserId: runtime.authUserId,
      accountId: owner.account.id,
      recoveredAt,
      profiles: targets.map(target => ({
        profileClientId: target.profileClientId,
        profileId: target.cloudProfileId,
        storageKey: target.descriptor.storageKey,
        semanticChecksum: comparison.profiles[target.profileClientId].cloudChecksum
      }))
    };
  }

  function persistAtomically(documents, validate) {
    const snapshots = new Map(documents.map(({ key }) => [key, readStorage(key)]));
    try {
      for (const { key, value } of documents) writeStorage(key, JSON.stringify(value));
      for (const { key, value } of documents) {
        if (readStorage(key) !== JSON.stringify(value)) throw new Error(`Device storage did not retain ${key}.`);
      }
      if (!validate()) throw new Error('The recovery marker and reconstructed profiles did not validate after persistence.');
      return true;
    } catch (error) {
      const rollbackErrors = [];
      for (const [key, previous] of snapshots) {
        try {
          if (previous === null) removeStorage(key);
          else writeStorage(key, previous);
        } catch (rollbackError) { rollbackErrors.push(rollbackError?.message || String(rollbackError)); }
      }
      if (rollbackErrors.length) error.rollbackErrors = rollbackErrors;
      throw error;
    }
  }

  async function performRestore({ owner, session }) {
    if (!verifiedOwner(owner, session)) {
      return blocked('owner-verification-failed', 'The signed-in account and profile ownership could not be verified. No local data was changed.');
    }
    let targets;
    try { targets = targetsFor(owner); } catch (error) {
      return blocked(error.code || 'fresh-recovery-profile-mismatch', error.message || 'The cloud profile mapping did not match this runtime. No local data was changed.');
    }
    const existingMarker = readJson(runtime.recoveryKey);
    const existingStates = targets.filter(target => readStorage(target.descriptor.storageKey) !== null);
    if (existingStates.length) {
      if (existingStates.length === targets.length && completedForCurrentRuntime(owner)) {
        return Object.freeze({ ok: true, status: 'already-restored', profileClientIds: targets.map(target => target.profileClientId) });
      }
      return blocked('local-namespace-not-empty', 'This device already contains local training data for this account. Big Gains will not overwrite or merge it.');
    }
    if (runtime.kind === 'managed-owner' && window.bigGainsAccounts.legacyStateKey
      && readStorage(window.bigGainsAccounts.legacyStateKey) !== null) {
      return blocked('local-namespace-not-empty', 'This device contains legacy Jorge training data. Big Gains will not overwrite or merge it.');
    }
    if (runtime.kind === 'managed-member') {
      const namespaceKeys = [runtime.cloudKeys.queue, runtime.cloudKeys.catalog, runtime.cloudKeys.comparison, runtime.recoveryKey];
      if (namespaceKeys.some(key => localStorage.getItem(key) !== null)) {
        return blocked('local-namespace-not-pristine', 'This managed-profile namespace was already initialized. Recovery stopped without overwriting local data; review the saved recovery details before continuing.');
      }
    } else if (existingMarker !== null) {
      return blocked('recovery-marker-without-state', 'This device has an incomplete recovery marker without its local training profiles. Recovery stopped for review.');
    }
    if (!verifiablyEmptyQueue()) {
      return blocked('local-queue-not-empty', 'Local outbound changes already exist or the queue cannot be proven empty, so cloud recovery stopped without changing local data.');
    }

    commitProtection = true;
    let freshOwner;
    let remote;
    let cloud;
    let restoredProfiles;
    let comparison;
    try {
      freshOwner = await window.BigGainsSupabase.readCloudAccount();
      if (!verifiedOwner(freshOwner, session) || !sameVerifiedMapping(owner, freshOwner)) {
        return blocked('owner-verification-changed', 'The verified account/profile mapping changed during recovery. No local data was changed.');
      }
      targets = targetsFor(freshOwner);
      if (!verifiablyEmptyQueue() || !pristineTrainingNamespace()) {
        return blocked('local-state-changed-during-recovery', 'Local training state or the outbound queue changed while recovery was reading cloud data. Nothing was overwritten.');
      }
      const repository = shadow.createRepository({
        client: window.BigGainsSupabase.getClient(),
        accountId: freshOwner.account.id
      });
      remote = await repository.readAll();
      cloud = await shadow.reconstructCloud({ ...remote, profiles: freshOwner.profiles, accountId: freshOwner.account.id });
      if (cloud.ownershipIssues.length) {
        return blocked('cloud-ownership-mismatch', 'Cloud recovery returned rows outside the verified account/profile mapping. No local data was changed.');
      }
      const restoredEntries = await Promise.all(targets.map(async target => [
        target.profileClientId,
        await shadow.schemaV5FromCloud({ cloud, profileClientId: target.profileClientId })
      ]));
      restoredProfiles = Object.fromEntries(restoredEntries);
      comparison = await shadow.compare({
        localProfiles: Object.fromEntries(restoredEntries.map(([profileClientId, restored]) => [profileClientId, {
          stateVersion: 5,
          records: restored.records
        }])),
        cloud
      });
      if (!comparison.parity) {
        return blocked('fresh-recovery-semantic-mismatch', 'The reconstructed profiles did not exactly match the fresh cloud readback. No local data was changed.', { details: comparison.reasons });
      }
    } catch (error) {
      return blocked(
        error?.code || 'cloud-reconstruction-failed',
        error?.message || 'The cloud training copy could not be reconstructed safely. No local data was changed.',
        { details: error?.issues || error?.reasons || null }
      );
    }

    if (!verifiablyEmptyQueue() || !pristineTrainingNamespace()) {
      return blocked('local-state-changed-during-recovery', 'Local training state or the outbound queue changed before recovery could be finalized. Nothing was overwritten.');
    }
    const journal = shadow.completedMigrationJournal(remote.journals, freshOwner.account.id);
    const catalog = shadow.catalogFromCloud({ cloud, owner: freshOwner, journal });
    catalog.migrationId = journal?.metadata?.migrationId || `${runtime.kind}-fresh-recovery`;
    const comparisonValue = comparisonDocument(comparison);
    const marker = recoveryMarker(freshOwner, targets, comparison);
    const documents = [
      ...targets.map(target => ({ key: target.descriptor.storageKey, value: restoredProfiles[target.profileClientId].state })),
      { key: runtime.cloudKeys.catalog, value: catalog },
      { key: runtime.cloudKeys.comparison, value: comparisonValue },
      { key: runtime.recoveryKey, value: marker }
    ];
    try {
      persistAtomically(documents, () => completedForCurrentRuntime(freshOwner));
    } catch (error) {
      commitProtection = false;
      return blocked(
        'recovery-persistence-failed',
        'Recovery could not be finalized on this device. All recoverable local changes were rolled back and cloud data was left untouched.',
        { error: error?.message || String(error), rollbackErrors: error?.rollbackErrors || [] }
      );
    }
    return Object.freeze({
      ok: true,
      status: 'restored',
      profileClientIds: targets.map(target => target.profileClientId),
      queuePending: window.BigGainsCloudSync?.queue?.pending().length || 0,
      parity: true,
      states: Object.freeze(Object.fromEntries(targets.map(target => [target.profileClientId, restoredProfiles[target.profileClientId].state]))),
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
    format: MEMBER_FORMAT,
    freshFormat: FRESH_FORMAT,
    restore,
    completedForCurrentRuntime,
    needsRecoveryForCurrentRuntime,
    suppressingLocalSave: state => commitProtection || (pristineTrainingNamespace() && inMemoryStateIsBlank(state))
  });
})();
