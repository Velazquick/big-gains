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
  let protectUnsafeBlankSave = true;
  const RECOVERABLE_BLANK_KEYS = new Set([
    'version', 'profileId', 'goals', 'workouts', 'weights', 'prs', 'activeWorkout',
    'restTimerEndsAt', 'customRoutines', 'timerPreferences', 'exercisePreferences'
  ]);

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
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

  function valuesMatch(left, right) {
    if (left === right) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
      return Array.isArray(left) && Array.isArray(right) && left.length === right.length
        && left.every((value, index) => valuesMatch(value, right[index]));
    }
    if (!isRecord(left) || !isRecord(right)) return false;
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key, index) => key === rightKeys[index] && valuesMatch(left[key], right[key]));
  }

  function supportedRuntime() {
    return SUPPORTED_KINDS.has(runtime.kind)
      && Boolean(runtime.recoveryKey && runtime.authUserId && runtime.cloudAccountId);
  }

  function localTrainingKeys() {
    return [...trainingKeys];
  }

  function pristineTrainingNamespace() {
    if (!supportedRuntime() || runtime.newlyProvisioned === true) return false;
    try { return localTrainingKeys().every(key => readStorage(key) === null); } catch { return false; }
  }

  function localTargets() {
    return runtime.descriptors.map(descriptor => Object.freeze({
      descriptor,
      profileClientId: descriptor.profileId
    }));
  }

  function defaultGoalsFor(target) {
    const config = typeof PROFILE_CONFIG === 'object' && PROFILE_CONFIG
      ? PROFILE_CONFIG[target.descriptor.profileConfigRef]
      : null;
    return isRecord(config?.goals) ? config.goals : null;
  }

  function recoverableExercisePreferences(value) {
    return isRecord(value) && Object.values(value).every(preference =>
      isRecord(preference) && Object.keys(preference).length === 0);
  }

  function recoverableBlankArtifact(value, target) {
    if (!isRecord(value) || value.version !== 5 || value.profileId !== target.profileClientId
      || Object.keys(value).some(key => !RECOVERABLE_BLANK_KEYS.has(key))
      || !Array.isArray(value.workouts) || value.workouts.length !== 0
      || !Array.isArray(value.weights) || value.weights.length !== 0
      || !isRecord(value.prs) || Object.keys(value.prs).length !== 0
      || !isRecord(value.customRoutines) || Object.keys(value.customRoutines).length !== 0
      || (value.activeWorkout !== null && value.activeWorkout !== undefined)
      || (value.restTimerEndsAt !== null && value.restTimerEndsAt !== undefined)
      || ('exercisePreferences' in value
        && !recoverableExercisePreferences(value.exercisePreferences))
      || !isRecord(value.timerPreferences)
      || Object.keys(value.timerPreferences).sort().join(',') !== 'sound,vibration'
      || value.timerPreferences.sound !== true || value.timerPreferences.vibration !== true) return false;
    if (!('goals' in value)) return true;
    const defaults = defaultGoalsFor(target);
    return defaults !== null && valuesMatch(value.goals, defaults);
  }

  function inspectRecoverableNamespace(targets) {
    if (!supportedRuntime() || runtime.newlyProvisioned === true || !targets.length) {
      return Object.freeze({ recoverable: false, profiles: Object.freeze([]) });
    }
    const profiles = targets.map(target => {
      let raw;
      try { raw = readStorage(target.descriptor.storageKey); } catch {
        return Object.freeze({ profileClientId: target.profileClientId, status: 'storage-unavailable' });
      }
      if (raw === null) return Object.freeze({ profileClientId: target.profileClientId, status: 'missing' });
      let value;
      try { value = JSON.parse(raw); } catch {
        return Object.freeze({ profileClientId: target.profileClientId, status: 'invalid-json' });
      }
      return Object.freeze({
        profileClientId: target.profileClientId,
        status: recoverableBlankArtifact(value, target) ? 'blank-artifact' : 'meaningful'
      });
    });
    return Object.freeze({
      recoverable: profiles.every(profile => profile.status === 'missing' || profile.status === 'blank-artifact'),
      profiles: Object.freeze(profiles)
    });
  }

  function legacyStateAbsent() {
    if (!window.bigGainsAccounts.legacyStateKey) return true;
    try { return readStorage(window.bigGainsAccounts.legacyStateKey) === null; } catch { return false; }
  }

  function recoveryMarkerAbsent() {
    try { return readStorage(runtime.recoveryKey) === null; } catch { return false; }
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
    if (runtime.kind === 'managed-member') return pristineTrainingNamespace();
    return inspectRecoverableNamespace(localTargets()).recoverable
      && legacyStateAbsent()
      && recoveryMarkerAbsent()
      && verifiablyEmptyQueue();
  }

  function inMemoryStateIsBlank(state) {
    const target = localTargets().find(candidate => candidate.profileClientId === state?.profileId);
    return Boolean(target && recoverableBlankArtifact(state, target));
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

  function recoveryCheckpoint(targets) {
    if (runtime.kind === 'managed-member') return pristineTrainingNamespace() && verifiablyEmptyQueue();
    return inspectRecoverableNamespace(targets).recoverable
      && legacyStateAbsent()
      && recoveryMarkerAbsent()
      && verifiablyEmptyQueue();
  }

  function suppressingLocalSave(state, activeWorkout = state?.activeWorkout) {
    if (commitProtection) return true;
    if (!supportedRuntime()) return false;
    const candidate = activeWorkout === state?.activeWorkout ? state : { ...state, activeWorkout };
    if (!inMemoryStateIsBlank(candidate)) {
      protectUnsafeBlankSave = false;
      return false;
    }
    if (needsRecoveryForCurrentRuntime()) return true;
    if (!protectUnsafeBlankSave) return false;
    const profile = inspectRecoverableNamespace(localTargets()).profiles
      .find(entry => entry.profileClientId === state.profileId);
    return Boolean(profile && profile.status !== 'missing' && profile.status !== 'blank-artifact');
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

  function catalogMatchesOwner(catalog, owner, targets) {
    return catalog?.format === 'big-gains.shadow-catalog.v1'
      && catalog.accountId === owner?.account?.id
      && catalog.authUserId === runtime.authUserId
      && Object.keys(catalog.profiles || {}).length === targets.length
      && targets.every(target => catalog.profiles?.[target.profileClientId]?.profileId === target.cloudProfileId);
  }

  function validRevisionIdentity(record) {
    return Number.isSafeInteger(Number(record?.version))
      && Number(record.version) > 0
      && typeof record?.updatedAt === 'string'
      && Number.isFinite(Date.parse(record.updatedAt))
      && typeof record?.fingerprint === 'string'
      && record.fingerprint.length > 0;
  }

  function inspectRemoteFastForward({ owner, session, localProfiles, cloud, catalog }) {
    if (!verifiedOwner(owner, session)) {
      return Object.freeze({ eligible: false, conflict: false, reason: 'owner-verification-failed', reasons: Object.freeze(['The signed-in account/profile identity is not verified.']) });
    }
    let targets;
    try { targets = targetsFor(owner); } catch (error) {
      return Object.freeze({ eligible: false, conflict: false, reason: error.code || 'remote-fast-forward-profile-mismatch', reasons: Object.freeze([error.message]) });
    }
    if (!catalogMatchesOwner(catalog, owner, targets)) {
      return Object.freeze({ eligible: false, conflict: false, reason: 'remote-fast-forward-catalog-mismatch', reasons: Object.freeze(['The local revision catalog does not match the verified account/profile mapping.']) });
    }
    if (!verifiablyEmptyQueue()) {
      return Object.freeze({ eligible: false, conflict: true, reason: 'local-queue-not-empty', reasons: Object.freeze(['Local outbound changes are pending.']) });
    }
    if (cloud?.ownershipIssues?.length) {
      return Object.freeze({ eligible: false, conflict: false, reason: 'cloud-ownership-mismatch', reasons: Object.freeze([...cloud.ownershipIssues]) });
    }

    const localReasons = [];
    const remoteReasons = [];
    let advancedRevisions = 0;
    for (const target of targets) {
      const profileClientId = target.profileClientId;
      const localByKey = new Map((localProfiles?.[profileClientId]?.records || [])
        .map(record => [shadow.keyFor(record.table, record.clientId), record]));
      const expectedRecords = catalog.profiles[profileClientId].records || {};
      const localKeys = new Set([...localByKey.keys(), ...Object.keys(expectedRecords)]);
      for (const key of localKeys) {
        const local = localByKey.get(key) || null;
        const expected = expectedRecords[key] || null;
        if (!expected && local) {
          localReasons.push(`${profileClientId}/${key} was added locally after the last verified catalog.`);
        } else if (expected?.tombstone && local) {
          localReasons.push(`${profileClientId}/${key} was recreated locally after the last verified catalog.`);
        } else if (expected && !expected.tombstone && (!local || local.fingerprint !== expected.fingerprint)) {
          localReasons.push(`${profileClientId}/${key} changed locally after the last verified catalog.`);
        }
      }

      const remoteWinners = cloud?.profiles?.[profileClientId]?.winners;
      if (!(remoteWinners instanceof Map)) {
        remoteReasons.push(`${profileClientId} has no verified remote revision map.`);
        continue;
      }
      const remoteKeys = new Set([...Object.keys(expectedRecords), ...remoteWinners.keys()]);
      for (const key of remoteKeys) {
        const expected = expectedRecords[key] || null;
        const remote = remoteWinners.get(key) || null;
        if (expected && !validRevisionIdentity(expected)) {
          remoteReasons.push(`${profileClientId}/${key} has an invalid local catalog revision identity.`);
          continue;
        }
        if (remote && !validRevisionIdentity(remote)) {
          remoteReasons.push(`${profileClientId}/${key} has an invalid remote revision identity.`);
          continue;
        }
        if (!expected && remote) {
          advancedRevisions += 1;
          continue;
        }
        if (expected && !remote) {
          remoteReasons.push(`${profileClientId}/${key} disappeared instead of advancing through a tombstone.`);
          continue;
        }
        if (!expected || !remote) continue;
        if (remote.version < expected.version) {
          remoteReasons.push(`${profileClientId}/${key} moved backward from revision ${expected.version} to ${remote.version}.`);
          continue;
        }
        if (remote.version > expected.version) {
          if (Date.parse(remote.updatedAt) < Date.parse(expected.updatedAt)) {
            remoteReasons.push(`${profileClientId}/${key} advanced revision while moving its timestamp backward.`);
            continue;
          }
          advancedRevisions += 1;
          continue;
        }
        if (remote.fingerprint !== expected.fingerprint
          || remote.tombstone !== (expected.tombstone === true)
          || remote.updatedAt !== expected.updatedAt) {
          remoteReasons.push(`${profileClientId}/${key} changed identity without advancing revision ${expected.version}.`);
        }
      }
    }

    if (remoteReasons.length) {
      return Object.freeze({
        eligible: false,
        conflict: localReasons.length > 0,
        reason: 'remote-revision-not-monotonic',
        reasons: Object.freeze([...localReasons, ...remoteReasons]),
        advancedRevisions
      });
    }
    if (!advancedRevisions) {
      return Object.freeze({ eligible: false, conflict: false, reason: 'no-newer-remote-revisions', reasons: Object.freeze([]), advancedRevisions: 0 });
    }
    if (localReasons.length) {
      return Object.freeze({
        eligible: false,
        conflict: true,
        reason: 'concurrent-local-edit',
        reasons: Object.freeze(localReasons),
        advancedRevisions
      });
    }
    return Object.freeze({
      eligible: true,
      conflict: false,
      reason: 'newer-remote-revisions',
      reasons: Object.freeze([]),
      advancedRevisions
    });
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

  async function adoptRemoteFastForward({ owner, session, localProfiles, cloud, catalog, journal = null }) {
    const initial = inspectRemoteFastForward({ owner, session, localProfiles, cloud, catalog });
    if (!initial.eligible) {
      return blocked(initial.reason, initial.conflict
        ? 'Local and remote training data both changed after the last verified revision. Nothing was overwritten.'
        : 'The remote changes could not be verified as a safe fast-forward. Nothing was overwritten.', {
        conflict: initial.conflict,
        details: initial.reasons
      });
    }
    let targets;
    let restoredProfiles;
    let comparison;
    try {
      targets = targetsFor(owner);
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
        return blocked('remote-fast-forward-semantic-mismatch', 'The reconstructed schema-v5 profiles did not match the verified remote state. Nothing was overwritten.', {
          details: comparison.reasons
        });
      }
    } catch (error) {
      return blocked(
        error?.code || 'remote-fast-forward-reconstruction-failed',
        error?.message || 'The remote changes could not reconstruct valid schema-v5 data. Nothing was overwritten.',
        { details: error?.issues || error?.reasons || null }
      );
    }

    let currentLocalProfiles;
    try { currentLocalProfiles = await shadow.readLocalProfiles(); } catch (error) {
      return blocked(error?.code || 'remote-fast-forward-local-read-failed', error?.message || 'Local training data could not be rechecked. Nothing was overwritten.');
    }
    const finalCheck = inspectRemoteFastForward({ owner, session, localProfiles: currentLocalProfiles, cloud, catalog });
    if (!finalCheck.eligible) {
      return blocked(finalCheck.reason, 'Local state, queue state, or verified revisions changed during the update. Nothing was overwritten.', {
        conflict: finalCheck.conflict,
        details: finalCheck.reasons
      });
    }

    const adoptedCatalog = shadow.catalogFromCloud({ cloud, owner, journal });
    if (catalog.migrationId) adoptedCatalog.migrationId = catalog.migrationId;
    const comparisonValue = comparisonDocument(comparison);
    const documents = [
      ...targets.map(target => ({ key: target.descriptor.storageKey, value: restoredProfiles[target.profileClientId].state })),
      { key: runtime.cloudKeys.catalog, value: adoptedCatalog },
      { key: runtime.cloudKeys.comparison, value: comparisonValue }
    ];
    commitProtection = true;
    try {
      persistAtomically(documents, () => targets.every(target => {
        const stored = readJson(target.descriptor.storageKey);
        return valuesMatch(stored, restoredProfiles[target.profileClientId].state);
      }) && valuesMatch(readJson(runtime.cloudKeys.catalog), adoptedCatalog)
        && readJson(runtime.cloudKeys.comparison)?.parity === true);
    } catch (error) {
      commitProtection = false;
      return blocked(
        'remote-fast-forward-persistence-failed',
        'The device update could not be finalized. All local writes were rolled back and cloud data was left untouched.',
        { error: error?.message || String(error), rollbackErrors: error?.rollbackErrors || [] }
      );
    }
    return Object.freeze({
      ok: true,
      status: 'fast-forwarded',
      parity: true,
      advancedRevisions: finalCheck.advancedRevisions,
      states: Object.freeze(Object.fromEntries(targets.map(target => [target.profileClientId, restoredProfiles[target.profileClientId].state]))),
      catalog: adoptedCatalog,
      comparison
    });
  }

  async function performRestore({ owner, session }) {
    if (!verifiedOwner(owner, session)) {
      return blocked('owner-verification-failed', 'The signed-in account and profile ownership could not be verified. No local data was changed.');
    }
    let targets;
    try { targets = targetsFor(owner); } catch (error) {
      return blocked(error.code || 'fresh-recovery-profile-mismatch', error.message || 'The cloud profile mapping did not match this runtime. No local data was changed.');
    }
    let existingMarkerRaw;
    try { existingMarkerRaw = readStorage(runtime.recoveryKey); } catch {
      return blocked('recovery-storage-unavailable', 'This device storage could not be verified, so recovery stopped without changing local data.');
    }
    let existingStates;
    try { existingStates = targets.filter(target => readStorage(target.descriptor.storageKey) !== null); } catch {
      return blocked('recovery-storage-unavailable', 'This device storage could not be verified, so recovery stopped without changing local data.');
    }
    if (existingStates.length === targets.length && completedForCurrentRuntime(owner)) {
      return Object.freeze({ ok: true, status: 'already-restored', profileClientIds: targets.map(target => target.profileClientId) });
    }
    if (runtime.kind === 'managed-member') {
      if (existingStates.length) {
        return blocked('local-namespace-not-empty', 'This device already contains local training data for this account. Big Gains will not overwrite or merge it.');
      }
      const namespaceKeys = [runtime.cloudKeys.queue, runtime.cloudKeys.catalog, runtime.cloudKeys.comparison, runtime.recoveryKey];
      if (namespaceKeys.some(key => localStorage.getItem(key) !== null)) {
        return blocked('local-namespace-not-pristine', 'This managed-profile namespace was already initialized. Recovery stopped without overwriting local data; review the saved recovery details before continuing.');
      }
    } else {
      const namespace = inspectRecoverableNamespace(targets);
      if (!namespace.recoverable) {
        return blocked('local-namespace-not-empty', 'This device contains meaningful or invalid local profile data. Big Gains will not overwrite or merge it.', {
          profiles: namespace.profiles
        });
      }
      if (!legacyStateAbsent()) {
        return blocked('local-namespace-not-empty', 'This device contains legacy Jorge training data. Big Gains will not overwrite or merge it.');
      }
      if (existingMarkerRaw !== null) {
        return blocked('recovery-marker-without-state', 'This device has an incomplete recovery marker without its finalized local training profiles. Recovery stopped for review.');
      }
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
      if (!recoveryCheckpoint(targets)) {
        return blocked('local-state-changed-during-recovery', 'Local training state, recovery marker, legacy state, or outbound queue changed before the fresh cloud read. Nothing was overwritten.');
      }
      freshOwner = await window.BigGainsSupabase.readCloudAccount();
      if (!verifiedOwner(freshOwner, session) || !sameVerifiedMapping(owner, freshOwner)) {
        return blocked('owner-verification-changed', 'The verified account/profile mapping changed during recovery. No local data was changed.');
      }
      targets = targetsFor(freshOwner);
      if (!recoveryCheckpoint(targets)) {
        return blocked('local-state-changed-during-recovery', 'Local training state or the outbound queue changed while recovery was reading cloud data. Nothing was overwritten.');
      }
      const repository = shadow.createRepository({
        client: window.BigGainsSupabase.getClient(),
        accountId: freshOwner.account.id
      });
      remote = await repository.readAll();
      if (!recoveryCheckpoint(targets)) {
        return blocked('local-state-changed-during-recovery', 'Local training state, recovery marker, legacy state, or outbound queue changed during the authoritative cloud read. Nothing was overwritten.');
      }
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

    if (!recoveryCheckpoint(targets)) {
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
    inspectRemoteFastForward,
    adoptRemoteFastForward,
    completedForCurrentRuntime,
    needsRecoveryForCurrentRuntime,
    suppressingLocalSave
  });
})();
