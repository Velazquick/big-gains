((scope) => {
  'use strict';

  const CONTRACT = 'big-gains.program-portability-runtime.v1';
  const CAPABILITY_VERSION = 1;
  const ACCEPTED_FORMAT = 'big-gains.program-domain-accepted.v1';
  const QUEUE_FORMAT = 'big-gains.program-domain-queue.v1';
  const STATUS = Object.freeze({
    OFF: 'off',
    CHECKING: 'checking',
    LOCAL_ONLY: 'local_only',
    NO_PROGRAM: 'no_program',
    IN_SYNC: 'in_sync',
    UPDATE_AVAILABLE: 'update_available',
    CONFLICT: 'conflict',
    PENDING: 'pending',
    BLOCKED: 'blocked',
    ERROR: 'error'
  });

  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function capability(config = scope.__BIG_GAINS_CLOUD_CONFIG__ || {}) {
    const enabled = config.programPortability === true
      && Number(config.programPortabilityVersion) === CAPABILITY_VERSION;
    return freeze({
      enabled,
      version: enabled ? CAPABILITY_VERSION : null,
      reason: enabled ? null : 'capability-disabled'
    });
  }

  function position(sequence) {
    if (!sequence) return { programVersionId: null, nextSlotIndex: null, completedCycles: null };
    return {
      programVersionId: sequence.programVersionId,
      nextSlotIndex: Number(sequence.nextSlotIndex),
      completedCycles: Number(sequence.completedCycles)
    };
  }

  function samePosition(left, right) {
    return left?.programVersionId === right?.programVersionId
      && Number(left?.nextSlotIndex) === Number(right?.nextSlotIndex)
      && Number(left?.completedCycles) === Number(right?.completedCycles);
  }

  function transitionId(kind, before, after, occurredAt, workoutId) {
    return ['program-transition', kind, before.programVersionId || 'none', after.programVersionId,
      before.nextSlotIndex ?? 'none', after.nextSlotIndex, before.completedCycles ?? 'none',
      after.completedCycles, occurredAt, workoutId || 'none'].join(':');
  }

  function operationTimestamp(acceptedUpdatedAt, transition = null, now = Date.now()) {
    const acceptedTime = Date.parse(acceptedUpdatedAt || '');
    const transitionTime = transition?.changed ? Date.parse(transition?.lastTransition?.occurredAt || '') : NaN;
    const nowTime = typeof now === 'number' ? now : Date.parse(now || '');
    const candidate = Number.isFinite(transitionTime) ? transitionTime : nowTime;
    if (!Number.isFinite(candidate)) throw new TypeError('PROGRAM_OPERATION_TIME_INVALID');
    return new Date(Number.isFinite(acceptedTime) && candidate <= acceptedTime
      ? acceptedTime + 1
      : candidate).toISOString();
  }

  function deriveTransition({ beforeEnvelope = null, afterCapture = null, workouts = [] } = {}) {
    const beforeSequence = beforeEnvelope?.sequence || null;
    const afterSequence = afterCapture?.sequenceState || null;
    if (samePosition(position(beforeSequence), position(afterSequence))
      && beforeSequence?.updatedAt === afterSequence?.updatedAt) {
      return freeze({ ok: true, changed: false, lastTransition: clone(beforeSequence?.lastTransition || null) });
    }
    if (!afterSequence || !Number.isFinite(Date.parse(afterSequence.updatedAt))) {
      return freeze({ ok: false, changed: true, reasonCode: 'PROGRAM_TRANSITION_UNPROVABLE' });
    }
    const before = position(beforeSequence);
    const after = position(afterSequence);
    const occurredAt = new Date(afterSequence.updatedAt).toISOString();
    let kind = null;
    let workoutId = null;
    if (!beforeSequence && after.programVersionId && after.nextSlotIndex === 0 && after.completedCycles === 0) {
      kind = 'activation';
    } else if (beforeSequence && before.programVersionId !== after.programVersionId
      && before.nextSlotIndex === after.nextSlotIndex && before.completedCycles === after.completedCycles) {
      const successor = (afterCapture?.programVersions || []).find(value => value.programVersionId === after.programVersionId);
      if (successor?.predecessorProgramVersionId === before.programVersionId) kind = 'successor_carry';
    } else if (beforeSequence && before.programVersionId === after.programVersionId) {
      const version = (afterCapture?.programVersions || []).find(value => value.programVersionId === after.programVersionId);
      const slotCount = version?.slots?.length || 0;
      const expectedSlot = slotCount ? (before.nextSlotIndex + 1) % slotCount : null;
      const expectedCycles = before.completedCycles + (expectedSlot === 0 ? 1 : 0);
      const workout = (workouts || []).find(value => value?.id
        && value.completedAt === occurredAt
        && value.programOrigin?.programVersionId === before.programVersionId
        && Number(value.programOrigin?.slotIndex) === before.nextSlotIndex
        && Number(value.programOrigin?.cycleNumber) === before.completedCycles + 1);
      if (expectedSlot === after.nextSlotIndex && expectedCycles === after.completedCycles && workout) {
        kind = 'completion';
        workoutId = workout.id;
      }
    }
    if (!kind) return freeze({ ok: false, changed: true, reasonCode: 'PROGRAM_TRANSITION_UNPROVABLE' });
    return freeze({
      ok: true,
      changed: true,
      lastTransition: {
        transitionId: transitionId(kind, before, after, occurredAt, workoutId),
        kind,
        before,
        after,
        occurredAt,
        workoutId
      }
    });
  }

  let initialized = false;
  let queue = null;
  let syncService = null;
  let cutoverService = null;
  let currentMapping = null;
  let currentInspection = null;
  let currentSnapshot = freeze({ status: STATUS.OFF, enabled: false, pending: 0, reasonCode: 'capability-disabled' });
  let captureChain = Promise.resolve();
  let busy = false;

  function liveState() { return typeof state === 'object' && state ? state : null; }
  function liveActive() { return typeof active === 'object' && active ? active : null; }
  function liveAccount() { return typeof ACCOUNT === 'object' && ACCOUNT ? ACCOUNT : null; }
  function liveProfile() { return typeof PROFILE === 'object' && PROFILE ? PROFILE : null; }
  function persistence() { return typeof statePersistenceApi === 'object' ? statePersistenceApi : null; }
  function catalog() { return typeof exerciseCatalog === 'object' ? exerciseCatalog : null; }
  function cloudRuntime() { return scope.bigGainsAccounts?.runtime || null; }
  function boundary() { return scope.BigGainsSupabase || null; }
  function client() { return boundary()?.getClient?.() || null; }
  function goals(value = liveState()) {
    return (value?.goals?.strengthGoals || []).map(goal => goal?.goalId).filter(Boolean);
  }
  function meaningful(capture) {
    return Boolean(capture && (capture.routineVersions?.length || capture.programVersions?.length));
  }

  function namespace() {
    const runtime = cloudRuntime();
    const profile = liveProfile();
    return runtime?.storageNamespace && profile?.id ? `${runtime.storageNamespace}-${profile.id}` : null;
  }

  function acceptedKey() {
    const value = namespace();
    return value ? `big-gains-program-domain-accepted-v1-${value}` : null;
  }

  function queueKey() {
    const value = namespace();
    return value ? `big-gains-program-domain-queue-v1-${value}` : null;
  }

  function readAccepted(mapping = currentMapping) {
    const key = acceptedKey();
    if (!key || !mapping) return null;
    try {
      const value = JSON.parse(scope.localStorage.getItem(key) || 'null');
      if (value?.format !== ACCEPTED_FORMAT
        || value.owner?.accountId !== mapping.owner.accountId
        || value.owner?.profileId !== mapping.owner.profileId
        || value.scope?.accountId !== mapping.scope.accountId
        || value.scope?.profileId !== mapping.scope.profileId
        || !value.remote?.record || !isRecord(value.remote?.envelope)) return null;
      return value.remote;
    } catch { return null; }
  }

  function writeAccepted(mapping, remote) {
    const key = acceptedKey();
    if (!key || !mapping || !remote?.record || !isRecord(remote?.envelope)) return false;
    scope.localStorage.setItem(key, JSON.stringify({
      format: ACCEPTED_FORMAT,
      owner: clone(mapping.owner),
      scope: clone(mapping.scope),
      remote: clone(remote)
    }));
    return true;
  }

  function summary(next) {
    currentSnapshot = freeze({
      enabled: capability().enabled,
      pending: queue?.pending?.().filter(scope.BigGainsProgramDomainSync?.isProgramDomainOperation || (() => false)).length || 0,
      ...next
    });
    render();
    return currentSnapshot;
  }

  function panel() { return scope.document?.getElementById('programPortabilityStatus'); }

  function render() {
    const box = panel();
    if (!box) return false;
    if (!capability().enabled) {
      box.hidden = true;
      box.innerHTML = '';
      return true;
    }
    box.hidden = false;
    const value = currentSnapshot;
    const copy = {
      [STATUS.CHECKING]: ['Program continuity', 'Checking your private Program copy.', ''],
      [STATUS.LOCAL_ONLY]: ['Program saved on this device', 'Publish it deliberately when you are ready to use it on another signed-in device.', '<button class="primary compact" type="button" data-program-portability="publish">Publish Program</button>'],
      [STATUS.NO_PROGRAM]: ['Program continuity ready', 'Create and approve a Program here before publishing it to your other devices.', ''],
      [STATUS.IN_SYNC]: ['Program available on your devices', 'This device matches the verified private Program copy.', ''],
      [STATUS.UPDATE_AVAILABLE]: ['Program update available', 'A verified Program from another device is ready. Your History will not be changed.', '<button class="primary compact" type="button" data-program-portability="cloud">Use cloud Program</button>'],
      [STATUS.CONFLICT]: ['Choose which Program to keep', 'This Program changed on two devices. Nothing will be replaced until you choose.', '<button class="primary compact" type="button" data-program-portability="cloud">Use cloud Program</button><button class="secondary compact" type="button" data-program-portability="device">Use this device Program</button>'],
      [STATUS.PENDING]: ['Program waiting to sync', 'Training stays local. The exact saved Program change will retry when the connection is ready.', '<button class="secondary compact" type="button" data-program-portability="retry">Retry</button>'],
      [STATUS.BLOCKED]: ['Program sync paused safely', 'Finish the active workout or rest interval, then review Program continuity again.', '<button class="secondary compact" type="button" data-program-portability="retry">Check again</button>'],
      [STATUS.ERROR]: ['Program sync needs attention', 'Your local Program and History were left unchanged. Try again before making another Program change.', '<button class="secondary compact" type="button" data-program-portability="retry">Try again</button>']
    }[value.status] || ['Program continuity', 'Checking your private Program copy.', ''];
    box.innerHTML = `<div><span class="label">${copy[0]}</span><strong>${copy[1]}</strong></div><div class="program-portability-actions">${copy[2]}</div>`;
    box.querySelectorAll('button').forEach(button => { button.disabled = busy; });
    return true;
  }

  async function resolveMapping() {
    const runtime = cloudRuntime();
    const account = liveAccount();
    const profile = liveProfile();
    const api = boundary();
    if (!runtime || runtime.kind === 'guest' || !account || !profile || !api?.readCloudAccount || !api?.verifiedUser) {
      throw Object.assign(new Error('Program cloud identity is unavailable.'), { code: 'PROGRAM_IDENTITY_UNAVAILABLE' });
    }
    const verified = await api.verifiedUser(runtime.authUserId || null);
    const owner = await api.readCloudAccount();
    if (!scope.bigGainsAccounts?.matchesCloudOwner?.(owner, verified.id)) {
      throw Object.assign(new Error('Program cloud identity changed.'), { code: 'PROGRAM_IDENTITY_MISMATCH' });
    }
    const profileRows = Array.isArray(owner?.profiles) ? owner.profiles : Object.values(owner?.profiles || {});
    const cloudProfile = profileRows.find(value => value?.client_id === profile.id);
    if (!owner?.account?.id || !cloudProfile?.id || cloudProfile.account_id !== owner.account.id) {
      throw Object.assign(new Error('Program profile mapping is unavailable.'), { code: 'PROGRAM_PROFILE_MAPPING_MISMATCH' });
    }
    currentMapping = freeze({
      owner: { accountId: owner.account.id, profileId: cloudProfile.id },
      scope: { accountId: account.accountId, profileId: profile.id }
    });
    return currentMapping;
  }

  function input(mapping, snapshot = liveState(), extra = {}) {
    const store = persistence();
    const raw = () => scope.bigGainsStatePersistence.readRawOwnedState(store.storageKey);
    return {
      owner: mapping.owner,
      scope: mapping.scope,
      localProgramCapture: snapshot?.programCapture || null,
      acceptedRemote: readAccepted(mapping),
      activeWorkout: snapshot?.activeWorkout || liveActive(),
      restTimerEndsAt: snapshot?.restTimerEndsAt ?? null,
      availableGoalIds: goals(snapshot),
      initialized: true,
      pristine: store?.hasStoredState?.() !== true,
      freshDevice: Boolean(!meaningful(snapshot?.programCapture) && snapshot?.activeWorkout?.programOrigin),
      readRaw: raw,
      writeRaw: value => scope.bigGainsStatePersistence.writeRawOwnedState(store.storageKey, value),
      removeRaw: () => scope.bigGainsStatePersistence.removeRawOwnedState(store.storageKey),
      ...extra
    };
  }

  function reloadAfterAdoption() {
    if (!persistence()?.load) return false;
    state = persistence().load();
    active = state.activeWorkout || null;
    if (typeof renderAll === 'function') renderAll();
    return true;
  }

  async function readRemote(mapping) {
    return scope.BigGainsProgramDomainRecovery.readRemote({
      client: client(),
      enabled: true,
      verifyAuthenticated: () => boundary().verifiedUser(cloudRuntime().authUserId || null),
      envelopeApi: scope.BigGainsProgramDomainEnvelope,
      owner: mapping.owner,
      scope: mapping.scope
    });
  }

  async function refresh({ force = false } = {}) {
    if (!capability().enabled) return summary({ status: STATUS.OFF, reasonCode: 'capability-disabled' });
    if (busy && !force) return currentSnapshot;
    busy = true;
    summary({ status: STATUS.CHECKING, reasonCode: null });
    try {
      const mapping = await resolveMapping();
      const remoteRead = await readRemote(mapping);
      if (remoteRead.state === scope.BigGainsProgramDomainRecovery.states.INVALID_REMOTE
        || remoteRead.state === scope.BigGainsProgramDomainRecovery.states.UNSUPPORTED) {
        currentInspection = null;
        return summary({ status: STATUS.ERROR, reasonCode: remoteRead.reasonCode });
      }
      currentInspection = await cutoverService.inspectCutover(input(mapping));
      const mapped = {
        unpublished_local: STATUS.LOCAL_ONLY,
        unpublished_empty: STATUS.NO_PROGRAM,
        converged: STATUS.IN_SYNC,
        cloud_available: STATUS.UPDATE_AVAILABLE,
        conflict: STATUS.CONFLICT,
        pending: STATUS.PENDING,
        blocked: STATUS.BLOCKED,
        invalid: STATUS.ERROR,
        unsupported: STATUS.ERROR
      }[currentInspection.state] || STATUS.ERROR;
      if (currentInspection.state === 'converged' && remoteRead.remote) writeAccepted(mapping, remoteRead.remote);
      return summary({
        status: mapped,
        reasonCode: currentInspection.reasonCode || null,
        remoteVersion: remoteRead.remote?.record?.version || null,
        remoteFingerprint: remoteRead.remote?.record?.fingerprint || null
      });
    } catch (error) {
      currentInspection = null;
      return summary({ status: navigator.onLine === false ? STATUS.PENDING : STATUS.ERROR,
        reasonCode: error?.code || 'PROGRAM_REFRESH_FAILED' });
    } finally {
      busy = false;
      render();
    }
  }

  async function publishLegacy() {
    if (!capability().enabled || busy) return currentSnapshot;
    busy = true;
    render();
    try {
      const mapping = currentMapping || await resolveMapping();
      const snapshot = clone(liveState());
      if (!meaningful(snapshot?.programCapture)) {
        return summary({ status: STATUS.NO_PROGRAM, reasonCode: 'PROGRAM_PUBLICATION_REQUIRES_PROGRAM' });
      }
      const inspection = currentInspection || await cutoverService.inspectCutover(input(mapping, snapshot));
      const result = await cutoverService.publishLegacy(input(mapping, snapshot, { inspection }));
      if (!result.ok) return summary({
        status: result.status === 'pending' ? STATUS.PENDING : result.status === 'blocked' ? STATUS.BLOCKED : STATUS.ERROR,
        reasonCode: result.reasonCode
      });
      return await refresh({ force: true });
    } finally {
      busy = false;
      render();
    }
  }

  async function useCloud() {
    if (!capability().enabled || busy) return currentSnapshot;
    busy = true;
    render();
    try {
      const mapping = currentMapping || await resolveMapping();
      const snapshot = clone(liveState());
      const prepared = input(mapping, snapshot);
      const remoteRead = await readRemote(mapping);
      if (!remoteRead.remote) return summary({ status: STATUS.ERROR, reasonCode: remoteRead.reasonCode });
      const classification = await scope.BigGainsProgramDomainRecovery.classify({
        capabilityAvailable: true,
        remoteRead,
        acceptedRemote: readAccepted(mapping),
        localProgramCapture: prepared.localProgramCapture,
        operations: queue.pending(),
        initialized: true,
        pristine: prepared.pristine,
        freshDevice: prepared.freshDevice,
        activeWorkout: prepared.activeWorkout,
        restTimerEndsAt: prepared.restTimerEndsAt,
        availableGoalIds: prepared.availableGoalIds,
        envelopeApi: scope.BigGainsProgramDomainEnvelope,
        programModel: scope.BigGainsProgramModel,
        catalog: catalog(),
        owner: mapping.owner,
        scope: mapping.scope
      });
      let result;
      if (classification.state === scope.BigGainsProgramDomainRecovery.states.REMOTE_FAST_FORWARD_SAFE) {
        result = await scope.BigGainsProgramDomainRecovery.adopt({
          classification,
          remote: remoteRead.remote,
          readRaw: prepared.readRaw,
          writeRaw: prepared.writeRaw,
          removeRaw: prepared.removeRaw,
          candidateProfile: prepared.pristine ? snapshot : null,
          getOperations: () => queue.pending(),
          initialized: true,
          freshDevice: prepared.freshDevice,
          envelopeApi: scope.BigGainsProgramDomainEnvelope,
          programModel: scope.BigGainsProgramModel,
          catalog: catalog(),
          owner: mapping.owner,
          scope: mapping.scope
        });
      } else if (currentInspection?.state === 'conflict') {
        result = await cutoverService.resolveConflict('keep_cloud', currentInspection.snapshot, prepared);
      } else return summary({ status: STATUS.BLOCKED, reasonCode: classification.reasonCode });
      if (!result?.ok) return summary({ status: result?.status === 'blocked' ? STATUS.BLOCKED : STATUS.ERROR,
        reasonCode: result?.reasonCode || 'PROGRAM_ADOPTION_FAILED' });
      writeAccepted(mapping, remoteRead.remote);
      reloadAfterAdoption();
      return await refresh({ force: true });
    } finally {
      busy = false;
      render();
    }
  }

  async function useDevice() {
    if (!capability().enabled || busy || currentInspection?.state !== 'conflict') return currentSnapshot;
    busy = true;
    render();
    try {
      const mapping = currentMapping || await resolveMapping();
      const result = await cutoverService.resolveConflict('keep_device', currentInspection.snapshot, input(mapping));
      if (!result.ok) return summary({ status: result.status === 'pending' ? STATUS.PENDING
        : result.status === 'blocked' ? STATUS.BLOCKED : STATUS.ERROR, reasonCode: result.reasonCode });
      if (result.localMutation) reloadAfterAdoption();
      return await refresh({ force: true });
    } finally {
      busy = false;
      render();
    }
  }

  function latestPending(mapping) {
    return queue.pending().filter(operation => scope.BigGainsProgramDomainSync.isProgramDomainOperation(operation)
      && operation.owner.accountId === mapping.owner.accountId
      && operation.owner.profileId === mapping.owner.profileId)
      .sort((left, right) => right.version - left.version)[0] || null;
  }

  async function captureOne(snapshot) {
    if (!capability().enabled || !meaningful(snapshot?.programCapture)) return currentSnapshot;
    let mapping;
    try { mapping = currentMapping || await resolveMapping(); }
    catch { return summary({ status: STATUS.PENDING, reasonCode: 'PROGRAM_IDENTITY_UNAVAILABLE' }); }
    const pending = latestPending(mapping);
    const accepted = pending
      ? { record: scope.BigGainsProgramDomainSync.baseFromOperation(pending), envelope: clone(pending.payload) }
      : readAccepted(mapping);
    if (!accepted?.record || !accepted?.envelope) return await refresh();
    const transition = deriveTransition({
      beforeEnvelope: accepted.envelope,
      afterCapture: snapshot.programCapture,
      workouts: snapshot.workouts || []
    });
    if (!transition.ok) return summary({ status: STATUS.ERROR, reasonCode: transition.reasonCode });
    const enqueued = await syncService.enqueueProgramDomain({
      accountId: mapping.owner.accountId,
      profileId: mapping.owner.profileId,
      scope: mapping.scope,
      programCapture: snapshot.programCapture,
      acceptedBase: accepted.record,
      lastTransition: transition.lastTransition,
      catalog: catalog(),
      updatedAt: operationTimestamp(accepted.record.updatedAt, transition)
    });
    if (!enqueued.ok) return summary({ status: STATUS.ERROR, reasonCode: enqueued.reasonCode });
    if (!enqueued.enqueued) return summary({ status: STATUS.IN_SYNC, reasonCode: null,
      remoteVersion: accepted.record.version, remoteFingerprint: accepted.record.fingerprint });
    const flushed = await syncService.flush();
    if (!flushed.ok) return summary({ status: STATUS.PENDING, reasonCode: flushed.reasonCode });
    return await refresh();
  }

  function captureLocalSnapshot(_profileId = null, { stateSnapshot = null } = {}) {
    const snapshot = clone(stateSnapshot || liveState());
    captureChain = captureChain.then(() => captureOne(snapshot)).catch(error =>
      summary({ status: STATUS.ERROR, reasonCode: error?.code || error?.message || 'PROGRAM_CAPTURE_FAILED' }));
    return captureChain;
  }

  async function retry() {
    if (!capability().enabled || busy) return currentSnapshot;
    busy = true;
    render();
    try {
      const flushed = await syncService.flush();
      if (!flushed.ok && flushed.pending) return summary({ status: STATUS.PENDING, reasonCode: flushed.reasonCode });
      return await refresh({ force: true });
    } finally {
      busy = false;
      render();
    }
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    if (!capability().enabled) {
      render();
      return true;
    }
    const key = queueKey();
    if (!key || !scope.BigGainsCloud?.createDurableQueue || !client()) {
      summary({ status: STATUS.ERROR, reasonCode: 'PROGRAM_RUNTIME_DEPENDENCY_UNAVAILABLE' });
      return true;
    }
    queue = scope.BigGainsCloud.createDurableQueue({ key });
    syncService = scope.BigGainsProgramDomainSync.createService({
      queue,
      client: client(),
      enabled: true,
      verifyAuthenticated: () => boundary().verifiedUser(cloudRuntime().authUserId || null)
    });
    cutoverService = scope.BigGainsProgramDomainCutover.createService({
      enabled: true,
      client: client(),
      queue,
      syncService,
      verifyAuthenticated: () => boundary().verifiedUser(cloudRuntime().authUserId || null),
      catalog: catalog()
    });
    panel()?.addEventListener('click', event => {
      const action = event.target.closest('[data-program-portability]')?.dataset.programPortability;
      if (action === 'publish') publishLegacy();
      else if (action === 'cloud') useCloud();
      else if (action === 'device') useDevice();
      else if (action === 'retry') retry();
    });
    scope.addEventListener('online', retry);
    scope.addEventListener('pageshow', refresh);
    scope.document?.addEventListener('visibilitychange', () => {
      if (scope.document.visibilityState === 'visible') refresh();
    });
    refresh();
    return true;
  }

  scope.BigGainsProgramPortability = Object.freeze({
    contract: CONTRACT,
    capabilityVersion: CAPABILITY_VERSION,
    queueFormat: QUEUE_FORMAT,
    statusValues: STATUS,
    capability,
    deriveTransition,
    operationTimestamp,
    initialize,
    refresh,
    publishLegacy,
    useCloud,
    useDevice,
    retry,
    captureLocalSnapshot,
    status: () => currentSnapshot,
    queue: () => queue
  });
})(typeof window === 'object' ? window : globalThis);
