((scope) => {
  'use strict';

  const CONTRACT = 'big-gains.program-domain-cutover.v1';
  const SNAPSHOT_CONTRACT = 'big-gains.program-domain-conflict-decision.v1';
  const CAPTURE_CONTRACT = 'big-gains.program-capture.v1';
  const COPY = Object.freeze({
    keepCloud: 'Use cloud Program',
    keepDevice: 'Use this device Program',
    publish: 'Publish this Program to cloud',
    stale: 'Your Program changed before this choice was applied. Review the latest version.'
  });
  const STATES = Object.freeze({
    UNSUPPORTED: 'unsupported',
    UNPUBLISHED_LOCAL: 'unpublished_local',
    UNPUBLISHED_EMPTY: 'unpublished_empty',
    CONVERGED: 'converged',
    CLOUD_AVAILABLE: 'cloud_available',
    CONFLICT: 'conflict',
    PENDING: 'pending',
    BLOCKED: 'blocked',
    INVALID: 'invalid'
  });
  const RESULTS = Object.freeze({
    SUCCESS: 'success',
    STALE: 'stale',
    BLOCKED: 'blocked',
    PENDING: 'pending',
    FAILED: 'failed',
    UNSUPPORTED: 'unsupported'
  });
  const REASON_CODES = Object.freeze({
    CAPABILITY_DISABLED: 'PROGRAM_CUTOVER_CAPABILITY_DISABLED',
    DEPENDENCY_UNAVAILABLE: 'PROGRAM_CUTOVER_DEPENDENCY_UNAVAILABLE',
    INVALID_SCOPE: 'PROGRAM_CUTOVER_INVALID_SCOPE',
    NOT_PUBLISHABLE: 'PROGRAM_CUTOVER_NOT_PUBLISHABLE',
    REMOTE_APPEARED: 'PROGRAM_CUTOVER_REMOTE_APPEARED',
    STALE_DECISION: 'PROGRAM_CUTOVER_STALE_DECISION',
    QUEUE_PENDING: 'PROGRAM_CUTOVER_QUEUE_PENDING',
    ACTIVE_SESSION_PRESENT: 'PROGRAM_CUTOVER_ACTIVE_SESSION_PRESENT',
    REST_STATE_PRESENT: 'PROGRAM_CUTOVER_REST_STATE_PRESENT',
    INVALID_CHOICE: 'PROGRAM_CUTOVER_INVALID_CHOICE',
    IMMUTABLE_IDENTITY_CONFLICT: 'PROGRAM_CUTOVER_IMMUTABLE_IDENTITY_CONFLICT',
    LINEAGE_NOT_MERGEABLE: 'PROGRAM_CUTOVER_LINEAGE_NOT_MERGEABLE',
    SEQUENCE_NOT_MERGEABLE: 'PROGRAM_CUTOVER_SEQUENCE_NOT_MERGEABLE',
    EMPTY_DEVICE_CANNOT_REPLACE_GRAPH: 'PROGRAM_CUTOVER_EMPTY_DEVICE_CANNOT_REPLACE_GRAPH',
    ENQUEUE_FAILED: 'PROGRAM_CUTOVER_ENQUEUE_FAILED',
    TRANSPORT_FAILED: 'PROGRAM_CUTOVER_TRANSPORT_FAILED',
    LOCAL_ADOPTION_FAILED: 'PROGRAM_CUTOVER_LOCAL_ADOPTION_FAILED'
  });

  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function result(value) {
    return deepFreeze({ contract: CONTRACT, ...value });
  }

  function mappingFor(input = {}) {
    const owner = input.owner || { accountId: input.accountId, profileId: input.profileId };
    const profileScope = input.scope || { accountId: input.accountId, profileId: input.profileId };
    if (!nonempty(owner?.accountId) || !nonempty(owner?.profileId)
      || !nonempty(profileScope?.accountId) || !nonempty(profileScope?.profileId)) return null;
    return { owner: clone(owner), scope: clone(profileScope) };
  }

  function emptyCapture() {
    return {
      contract: CAPTURE_CONTRACT,
      storageMode: 'local_only',
      routines: [], routineVersions: [], programs: [], programVersions: [],
      applicationTraces: [], activeProgramVersionId: null, sequenceState: null
    };
  }

  function meaningful(capture) {
    return Boolean(capture && (capture.routineVersions?.length || capture.programVersions?.length));
  }

  function programOperations(queue, mapping, syncApi) {
    if (!queue?.pending) return [];
    return queue.pending().filter(operation => syncApi?.isProgramDomainOperation?.(operation)
      && operation.owner.accountId === mapping.owner.accountId
      && operation.owner.profileId === mapping.owner.profileId);
  }

  function identity(record) {
    if (!record) return null;
    return {
      version: record.version,
      updatedAt: record.updatedAt,
      fingerprint: record.fingerprint,
      definitionsRevision: record.definitionsRevision,
      definitionsFingerprint: record.definitionsFingerprint,
      headsRevision: record.headsRevision,
      headsFingerprint: record.headsFingerprint,
      sequenceRevision: record.sequenceRevision,
      sequenceFingerprint: record.sequenceFingerprint
    };
  }

  function same(left, right, canonicalize) {
    return canonicalize(left) === canonicalize(right);
  }

  async function localProjection({ capture, mapping, envelopeApi, programModel, catalog }) {
    const normalized = programModel.normalizeCapture(capture, {
      accountId: mapping.scope.accountId,
      profileId: mapping.scope.profileId,
      catalog
    });
    const semantic = { ...clone(normalized), applicationTraces: [] };
    const envelope = await envelopeApi.build({
      accountId: mapping.scope.accountId,
      profileId: mapping.scope.profileId,
      programCapture: meaningful(semantic) ? semantic : null,
      catalog,
      lastTransition: null
    });
    const revisions = Object.keys(envelope).length === 0
      ? { definitions: 0, heads: 0, sequence: 0 }
      : {
          definitions: envelope.definitionsRevision,
          heads: envelope.headsRevision,
          sequence: envelope.sequenceRevision
        };
    const hashes = await envelopeApi.fingerprints(envelope, {
      accountId: mapping.scope.accountId,
      profileId: mapping.scope.profileId,
      revisions
    });
    return { normalized, semantic, envelope, hashes };
  }

  function conflictKind(projection, remote) {
    const localMeaningful = meaningful(projection.semantic);
    const remoteEmpty = Object.keys(remote.envelope).length === 0;
    if (remoteEmpty && localMeaningful) return 'remote_empty_local_meaningful';
    if (!remoteEmpty && !localMeaningful) return 'remote_meaningful_local_empty';
    const record = remote.record;
    if (projection.hashes.definitionsFingerprint === record.definitionsFingerprint
      && projection.hashes.headsFingerprint === record.headsFingerprint
      && projection.hashes.sequenceFingerprint !== record.sequenceFingerprint) return 'sequence';
    return 'graph';
  }

  function decisionSnapshot({ mapping, projection, remote, classification, envelopeApi }) {
    const localIdentity = {
      fingerprint: projection.hashes.fingerprint,
      definitionsRevision: projection.hashes.definitionsRevision,
      definitionsFingerprint: projection.hashes.definitionsFingerprint,
      headsRevision: projection.hashes.headsRevision,
      headsFingerprint: projection.hashes.headsFingerprint,
      sequenceRevision: projection.hashes.sequenceRevision,
      sequenceFingerprint: projection.hashes.sequenceFingerprint
    };
    const remoteIdentity = identity(remote.record);
    const kind = conflictKind(projection, remote);
    const snapshot = {
      contract: SNAPSHOT_CONTRACT,
      owner: clone(mapping.owner),
      scope: clone(mapping.scope),
      classification: classification.state,
      conflictKind: kind,
      remote: remoteIdentity,
      local: localIdentity
    };
    snapshot.decisionId = [
      'program-cutover', mapping.owner.accountId, mapping.owner.profileId,
      remoteIdentity.fingerprint, localIdentity.fingerprint, kind
    ].join(':');
    return deepFreeze(snapshot);
  }

  function publicInspection(classification, projection, remote, snapshot = null) {
    const base = {
      classification: classification.state,
      reasonCode: classification.reasonCode || null,
      local: classification.local || null,
      remote: classification.remote || null,
      actionRequired: false,
      actions: []
    };
    if (classification.state === 'legacy_unpublished_local') {
      return result({ ...base, state: STATES.UNPUBLISHED_LOCAL, actionRequired: true,
        actions: [{ id: 'publish_legacy', label: COPY.publish }] });
    }
    if (classification.state === 'remote_absent') {
      return result({ ...base, state: STATES.UNPUBLISHED_EMPTY, actionRequired: true,
        actions: [{ id: 'publish_empty', label: COPY.publish }] });
    }
    if (classification.state === 'exact') return result({ ...base, state: STATES.CONVERGED });
    if (classification.state === 'remote_fast_forward_safe') {
      return result({ ...base, state: STATES.CLOUD_AVAILABLE, actionRequired: true,
        actions: [{ id: 'keep_cloud', label: COPY.keepCloud }] });
    }
    if (classification.state === 'divergent_conflict') {
      return result({ ...base, state: STATES.CONFLICT, actionRequired: true, snapshot,
        conflictKind: snapshot?.conflictKind || null,
        actions: [
          { id: 'keep_cloud', label: COPY.keepCloud },
          { id: 'keep_device', label: COPY.keepDevice }
        ] });
    }
    if (classification.state === 'local_ahead_pending' || classification.state === 'blocked_pending_queue') {
      return result({ ...base, state: STATES.PENDING });
    }
    if (classification.state === 'blocked_active_session') return result({ ...base, state: STATES.BLOCKED });
    if (classification.state === 'invalid_remote') return result({ ...base, state: STATES.INVALID });
    return result({ ...base, state: STATES.UNSUPPORTED });
  }

  function immutableKey(kind, item) {
    if (kind === 'routines') return item.routineId;
    if (kind === 'routineVersions') return item.routineVersionId;
    if (kind === 'programs') return item.programId;
    return item.programVersionId;
  }

  function manifestMap(manifest, kind) {
    return new Map((manifest?.[kind] || []).map(item => [immutableKey(kind, item), item.fingerprint]));
  }

  function immutableCompatible(localManifest, remoteManifest) {
    for (const kind of ['routines', 'routineVersions', 'programs', 'programVersions']) {
      const remote = manifestMap(remoteManifest, kind);
      for (const item of localManifest?.[kind] || []) {
        const key = immutableKey(kind, item);
        if (remote.has(key) && remote.get(key) !== item.fingerprint) return false;
      }
    }
    return true;
  }

  function mergeByIdentity(remote, local, key) {
    const values = new Map(remote.map(item => [item[key], clone(item)]));
    local.forEach(item => values.set(item[key], clone(item)));
    return [...values.values()];
  }

  function sequenceSemantic(sequence) {
    if (!sequence) return null;
    return {
      programId: sequence.programId,
      programVersionId: sequence.programVersionId,
      nextSlotIndex: sequence.nextSlotIndex,
      completedCycles: sequence.completedCycles,
      updatedAt: sequence.updatedAt
    };
  }

  async function buildDeviceRebase({ projection, remote, mapping, envelopeApi, programModel, recoveryApi, catalog, localLastTransition }) {
    if (!meaningful(projection.semantic) && Object.keys(remote.envelope).length > 0) {
      return { ok: false, reasonCode: REASON_CODES.EMPTY_DEVICE_CANNOT_REPLACE_GRAPH };
    }
    if (!immutableCompatible(projection.hashes.manifest, remote.hashes?.manifest || remote.envelope?.manifest)) {
      return { ok: false, reasonCode: REASON_CODES.IMMUTABLE_IDENTITY_CONFLICT };
    }
    const remoteCapture = recoveryApi.captureFromEnvelope(remote.envelope) || emptyCapture();
    const localCapture = projection.normalized;
    const candidate = programModel.normalizeCapture({
      contract: CAPTURE_CONTRACT,
      storageMode: 'local_only',
      routines: mergeByIdentity(remoteCapture.routines, localCapture.routines, 'routineId'),
      routineVersions: mergeByIdentity(remoteCapture.routineVersions, localCapture.routineVersions, 'routineVersionId'),
      programs: mergeByIdentity(remoteCapture.programs, localCapture.programs, 'programId'),
      programVersions: mergeByIdentity(remoteCapture.programVersions, localCapture.programVersions, 'programVersionId'),
      applicationTraces: clone(localCapture.applicationTraces || []),
      activeProgramVersionId: localCapture.activeProgramVersionId,
      sequenceState: clone(localCapture.sequenceState)
    }, { accountId: mapping.scope.accountId, profileId: mapping.scope.profileId, catalog });
    if (candidate.routineVersions.length < Math.max(remoteCapture.routineVersions.length, localCapture.routineVersions.length)
      || candidate.programVersions.length < Math.max(remoteCapture.programVersions.length, localCapture.programVersions.length)) {
      return { ok: false, reasonCode: REASON_CODES.LINEAGE_NOT_MERGEABLE };
    }
    let lastTransition = localLastTransition || null;
    const localSequence = sequenceSemantic(localCapture.sequenceState);
    const remoteSequence = sequenceSemantic(remote.envelope.sequence);
    if (localSequence && same(localSequence, remoteSequence, envelopeApi.canonicalize)) {
      lastTransition = remote.envelope.sequence?.lastTransition || null;
    } else if (localSequence && remote.record.sequenceRevision > 0 && !lastTransition) {
      return { ok: false, reasonCode: REASON_CODES.SEQUENCE_NOT_MERGEABLE };
    }
    try {
      await envelopeApi.build({
        accountId: mapping.scope.accountId,
        profileId: mapping.scope.profileId,
        programCapture: meaningful(candidate) ? candidate : null,
        catalog,
        lastTransition
      });
    } catch {
      return { ok: false, reasonCode: REASON_CODES.LINEAGE_NOT_MERGEABLE };
    }
    return { ok: true, capture: candidate, lastTransition };
  }

  function createService({
    enabled = false,
    client = null,
    queue = null,
    syncService = null,
    readRemote = null,
    verifyAuthenticated = null,
    envelopeApi = scope.BigGainsProgramDomainEnvelope,
    programModel = scope.BigGainsProgramModel,
    recoveryApi = scope.BigGainsProgramDomainRecovery,
    syncApi = scope.BigGainsProgramDomainSync,
    catalog = null,
    now = () => new Date().toISOString()
  } = {}) {
    const dependenciesAvailable = Boolean(queue?.pending && syncService?.enqueueProgramDomain
      && syncService?.flush && envelopeApi?.build && programModel?.normalizeCapture
      && recoveryApi?.readRemote && recoveryApi?.classify && recoveryApi?.adopt);

    async function inspectInternal(input = {}) {
      if (!enabled) return { public: result({ state: STATES.UNSUPPORTED, reasonCode: REASON_CODES.CAPABILITY_DISABLED,
        actionRequired: false, actions: [] }) };
      if (!dependenciesAvailable) return { public: result({ state: STATES.UNSUPPORTED, reasonCode: REASON_CODES.DEPENDENCY_UNAVAILABLE,
        actionRequired: false, actions: [] }) };
      const mapping = mappingFor(input);
      if (!mapping) return { public: result({ state: STATES.INVALID, reasonCode: REASON_CODES.INVALID_SCOPE,
        actionRequired: false, actions: [] }) };
      const remoteRead = await (typeof readRemote === 'function'
        ? readRemote({ ...input, owner: mapping.owner, scope: mapping.scope })
        : recoveryApi.readRemote({ client, enabled: true, verifyAuthenticated, envelopeApi,
            owner: mapping.owner, scope: mapping.scope }));
      const operations = queue.pending();
      const classification = await recoveryApi.classify({
        capabilityAvailable: true,
        remoteRead,
        acceptedRemote: input.acceptedRemote || null,
        localProgramCapture: input.localProgramCapture || null,
        operations,
        initialized: input.initialized !== false,
        pristine: input.pristine === true,
        freshDevice: input.freshDevice === true,
        activeWorkout: input.activeWorkout || null,
        restTimerEndsAt: input.restTimerEndsAt ?? null,
        availableGoalIds: input.availableGoalIds ?? [],
        envelopeApi,
        programModel,
        catalog,
        owner: mapping.owner,
        scope: mapping.scope
      });
      let projection = null;
      let snapshot = null;
      if (classification.state === 'divergent_conflict') {
        projection = await localProjection({ capture: input.localProgramCapture, mapping, envelopeApi, programModel, catalog });
        snapshot = decisionSnapshot({ mapping, projection, remote: remoteRead.remote, classification, envelopeApi });
      }
      return {
        public: publicInspection(classification, projection, remoteRead.remote, snapshot),
        mapping, remoteRead, remote: remoteRead.remote, classification, projection, snapshot
      };
    }

    async function inspectCutover(input = {}) {
      return (await inspectInternal(input)).public;
    }

    function guardBlocked(input, mapping) {
      if (programOperations(queue, mapping, syncApi).length) return REASON_CODES.QUEUE_PENDING;
      if (input.activeWorkout) return REASON_CODES.ACTIVE_SESSION_PRESENT;
      if (input.restTimerEndsAt != null) return REASON_CODES.REST_STATE_PRESENT;
      return null;
    }

    async function publishLegacy(input = {}) {
      if (!enabled) return result({ status: RESULTS.UNSUPPORTED, ok: false, reasonCode: REASON_CODES.CAPABILITY_DISABLED });
      const mapping = mappingFor(input);
      if (!mapping) return result({ status: RESULTS.FAILED, ok: false, reasonCode: REASON_CODES.INVALID_SCOPE });
      const guard = guardBlocked(input, mapping);
      if (guard) return result({ status: RESULTS.BLOCKED, ok: false, reasonCode: guard });
      const fresh = await inspectInternal(input);
      if (![STATES.UNPUBLISHED_LOCAL, STATES.UNPUBLISHED_EMPTY].includes(fresh.public.state)) {
        const stale = input.inspection && fresh.public.state !== input.inspection.state;
        return result({ status: stale ? RESULTS.STALE : RESULTS.BLOCKED, ok: false,
          reasonCode: fresh.remote ? REASON_CODES.REMOTE_APPEARED : REASON_CODES.NOT_PUBLISHABLE,
          message: stale ? COPY.stale : null });
      }
      if (input.inspection && input.inspection.state !== fresh.public.state) {
        return result({ status: RESULTS.STALE, ok: false, reasonCode: REASON_CODES.STALE_DECISION, message: COPY.stale });
      }
      let enqueued;
      try {
        enqueued = await syncService.enqueueProgramDomain({
          accountId: mapping.owner.accountId,
          profileId: mapping.owner.profileId,
          scope: mapping.scope,
          programCapture: fresh.public.state === STATES.UNPUBLISHED_EMPTY ? null : input.localProgramCapture,
          acceptedBase: null,
          lastTransition: null,
          catalog,
          updatedAt: input.updatedAt || now()
        });
      } catch {
        return result({ status: RESULTS.FAILED, ok: false, reasonCode: REASON_CODES.ENQUEUE_FAILED });
      }
      if (!enqueued?.ok || !enqueued.enqueued) {
        return result({ status: RESULTS.FAILED, ok: false,
          reasonCode: enqueued?.reasonCode || REASON_CODES.ENQUEUE_FAILED });
      }
      let flushed = null;
      try { flushed = input.deferTransport === true ? null : await syncService.flush(); } catch {}
      if (!flushed || !flushed.ok) {
        return result({ status: RESULTS.PENDING, ok: false, reasonCode: flushed?.reasonCode || REASON_CODES.TRANSPORT_FAILED,
          enqueued: true, operation: clone(enqueued.operation), pending: programOperations(queue, mapping, syncApi).length });
      }
      return result({ status: RESULTS.SUCCESS, ok: true, reasonCode: null, enqueued: true,
        operation: clone(enqueued.operation), remoteVersion: enqueued.operation.version, verifiedReadback: true });
    }

    async function resolveKeepCloud(fresh, input) {
      let adopted;
      try { adopted = await recoveryApi.adopt({
        classification: fresh.classification,
        remote: fresh.remote,
        explicitChoice: true,
        readRaw: input.readRaw,
        writeRaw: input.writeRaw,
        removeRaw: input.removeRaw,
        candidateProfile: input.candidateProfile ?? null,
        getOperations: () => queue.pending(),
        initialized: input.initialized !== false,
        freshDevice: input.freshDevice === true,
        envelopeApi,
        programModel,
        catalog,
        owner: fresh.mapping.owner,
        scope: fresh.mapping.scope
      }); } catch { adopted = { ok: false, reasonCode: REASON_CODES.LOCAL_ADOPTION_FAILED }; }
      if (!adopted.ok) {
        const blocked = [recoveryApi.reasonCodes.PROGRAM_QUEUE_PENDING,
          recoveryApi.reasonCodes.ACTIVE_SESSION_PRESENT, recoveryApi.reasonCodes.REST_STATE_PRESENT].includes(adopted.reasonCode);
        return result({ status: blocked ? RESULTS.BLOCKED : RESULTS.FAILED, ok: false,
          reasonCode: adopted.reasonCode, rolledBack: adopted.rolledBack === true });
      }
      return result({ status: RESULTS.SUCCESS, ok: true, reasonCode: null, choice: 'keep_cloud',
        remoteIdentity: clone(adopted.remoteIdentity), queueChanged: false });
    }

    async function resolveKeepDevice(fresh, input) {
      const rebased = await buildDeviceRebase({
        projection: fresh.projection,
        remote: fresh.remote,
        mapping: fresh.mapping,
        envelopeApi,
        programModel,
        recoveryApi,
        catalog,
        localLastTransition: input.localLastTransition || null
      });
      if (!rebased.ok) return result({ status: RESULTS.BLOCKED, ok: false, reasonCode: rebased.reasonCode });
      let enqueued;
      try { enqueued = await syncService.enqueueProgramDomain({
          accountId: fresh.mapping.owner.accountId,
          profileId: fresh.mapping.owner.profileId,
          scope: fresh.mapping.scope,
          programCapture: rebased.capture,
          acceptedBase: fresh.remote.record,
          lastTransition: rebased.lastTransition,
          catalog,
          updatedAt: input.updatedAt || now()
        });
      } catch {
        return result({ status: RESULTS.FAILED, ok: false, reasonCode: REASON_CODES.ENQUEUE_FAILED });
      }
      if (!enqueued?.ok || !enqueued.enqueued) {
        return result({ status: RESULTS.FAILED, ok: false,
          reasonCode: enqueued?.reasonCode || REASON_CODES.ENQUEUE_FAILED });
      }
      let flushed = null;
      try { flushed = input.deferTransport === true ? null : await syncService.flush(); } catch {}
      if (!flushed || !flushed.ok) {
        return result({ status: RESULTS.PENDING, ok: false,
          reasonCode: flushed?.reasonCode || REASON_CODES.TRANSPORT_FAILED,
          enqueued: true, operation: clone(enqueued.operation), localMutation: false,
          pending: programOperations(queue, fresh.mapping, syncApi).length });
      }
      const localCanonical = envelopeApi.canonicalize(fresh.projection.semantic);
      const publishedCapture = recoveryApi.captureFromEnvelope(enqueued.operation.payload, {
        applicationTraces: fresh.projection.normalized.applicationTraces || []
      });
      const publishedSemantic = publishedCapture
        ? { ...clone(publishedCapture), applicationTraces: [] }
        : emptyCapture();
      if (envelopeApi.canonicalize(publishedSemantic) === localCanonical) {
        return result({ status: RESULTS.SUCCESS, ok: true, reasonCode: null, choice: 'keep_device',
          remoteVersion: enqueued.operation.version, verifiedReadback: true, localMutation: false });
      }
      let adopted;
      try { adopted = await recoveryApi.adopt({
        classification: {
          state: recoveryApi.states.DIVERGENT_CONFLICT,
          guard: {
            localSemanticCanonical: localCanonical,
            remoteIdentity: syncApi.baseFromOperation(enqueued.operation)
          }
        },
        remote: { record: syncApi.baseFromOperation(enqueued.operation), envelope: clone(enqueued.operation.payload) },
        explicitChoice: true,
        readRaw: input.readRaw,
        writeRaw: input.writeRaw,
        removeRaw: input.removeRaw,
        candidateProfile: input.candidateProfile ?? null,
        getOperations: () => queue.pending(),
        initialized: input.initialized !== false,
        freshDevice: input.freshDevice === true,
        envelopeApi,
        programModel,
        catalog,
        owner: fresh.mapping.owner,
        scope: fresh.mapping.scope
      }); } catch { adopted = { ok: false, reasonCode: REASON_CODES.LOCAL_ADOPTION_FAILED }; }
      if (!adopted.ok) return result({ status: RESULTS.FAILED, ok: false,
        reasonCode: REASON_CODES.LOCAL_ADOPTION_FAILED, adoptionReasonCode: adopted.reasonCode,
        cloudPublished: true, localMutation: false, rolledBack: adopted.rolledBack === true });
      return result({ status: RESULTS.SUCCESS, ok: true, reasonCode: null, choice: 'keep_device',
        remoteVersion: enqueued.operation.version, verifiedReadback: true, localMutation: true });
    }

    async function resolveConflict(choice, snapshot, input = {}) {
      if (!enabled) return result({ status: RESULTS.UNSUPPORTED, ok: false, reasonCode: REASON_CODES.CAPABILITY_DISABLED });
      if (!['keep_cloud', 'keep_device'].includes(choice)) {
        return result({ status: RESULTS.FAILED, ok: false, reasonCode: REASON_CODES.INVALID_CHOICE });
      }
      const mapping = mappingFor(input);
      if (!mapping) return result({ status: RESULTS.FAILED, ok: false, reasonCode: REASON_CODES.INVALID_SCOPE });
      const guard = guardBlocked(input, mapping);
      if (guard) return result({ status: RESULTS.BLOCKED, ok: false, reasonCode: guard });
      let fresh;
      try { fresh = await inspectInternal(input); } catch {
        return result({ status: RESULTS.FAILED, ok: false, reasonCode: REASON_CODES.DEPENDENCY_UNAVAILABLE,
          mutationPerformed: false });
      }
      if (fresh.public.state !== STATES.CONFLICT || !snapshot || !fresh.snapshot
        || !same(snapshot, fresh.snapshot, envelopeApi.canonicalize)) {
        return result({ status: RESULTS.STALE, ok: false, reasonCode: REASON_CODES.STALE_DECISION,
          message: COPY.stale, mutationPerformed: false });
      }
      return choice === 'keep_cloud' ? resolveKeepCloud(fresh, input) : resolveKeepDevice(fresh, input);
    }

    async function flushPending() {
      if (!enabled) return result({ status: RESULTS.UNSUPPORTED, ok: false, reasonCode: REASON_CODES.CAPABILITY_DISABLED });
      let flushed;
      try { flushed = await syncService.flush(); } catch {
        flushed = { ok: false, reasonCode: REASON_CODES.TRANSPORT_FAILED };
      }
      return result({ status: flushed.ok ? RESULTS.SUCCESS : RESULTS.PENDING, ok: flushed.ok,
        reasonCode: flushed.reasonCode || null, ...clone(flushed) });
    }

    return deepFreeze({
      enabled: enabled === true,
      inspectCutover,
      publishLegacy,
      resolveConflict,
      flushPending,
      copy: COPY,
      states: STATES,
      results: RESULTS,
      reasonCodes: REASON_CODES
    });
  }

  scope.BigGainsProgramDomainCutover = Object.freeze({
    contract: CONTRACT,
    snapshotContract: SNAPSHOT_CONTRACT,
    copy: COPY,
    states: STATES,
    results: RESULTS,
    reasonCodes: REASON_CODES,
    createService
  });
})(typeof window === 'object' ? window : globalThis);
