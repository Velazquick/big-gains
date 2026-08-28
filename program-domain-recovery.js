((scope) => {
  'use strict';

  const ENTITY_TYPE = 'program_domains';
  const CLIENT_ID = 'program-domain';
  const CAPTURE_CONTRACT = 'big-gains.program-capture.v1';
  const CAPTURE_STORAGE_MODE = 'local_only';
  const ROW_COLUMNS = [
    'id', 'account_id', 'profile_id', 'client_id', 'contract', 'contract_version',
    'payload', 'version', 'fingerprint', 'definitions_revision', 'definitions_fingerprint',
    'heads_revision', 'heads_fingerprint', 'sequence_revision', 'sequence_fingerprint',
    'idempotency_key', 'base_version', 'base_updated_at', 'base_fingerprint',
    'base_definitions_revision', 'base_definitions_fingerprint', 'base_heads_revision',
    'base_heads_fingerprint', 'base_sequence_revision', 'base_sequence_fingerprint',
    'created_at', 'updated_at'
  ].join(',');

  const STATES = Object.freeze({
    UNSUPPORTED: 'unsupported',
    REMOTE_ABSENT: 'remote_absent',
    EXACT: 'exact',
    REMOTE_FAST_FORWARD_SAFE: 'remote_fast_forward_safe',
    LOCAL_AHEAD_PENDING: 'local_ahead_pending',
    DIVERGENT_CONFLICT: 'divergent_conflict',
    INVALID_REMOTE: 'invalid_remote',
    BLOCKED_ACTIVE_SESSION: 'blocked_active_session',
    BLOCKED_PENDING_QUEUE: 'blocked_pending_queue',
    LEGACY_UNPUBLISHED_LOCAL: 'legacy_unpublished_local'
  });

  const REASON_CODES = Object.freeze({
    CAPABILITY_UNAVAILABLE: 'PROGRAM_RECOVERY_CAPABILITY_UNAVAILABLE',
    AUTH_REJECTED: 'PROGRAM_RECOVERY_AUTH_REJECTED',
    REMOTE_ABSENT: 'PROGRAM_RECOVERY_REMOTE_ABSENT',
    REMOTE_READ_FAILED: 'PROGRAM_RECOVERY_REMOTE_READ_FAILED',
    REMOTE_SHAPE_INVALID: 'PROGRAM_RECOVERY_REMOTE_SHAPE_INVALID',
    REMOTE_IDENTITY_MISMATCH: 'PROGRAM_RECOVERY_REMOTE_IDENTITY_MISMATCH',
    REMOTE_FINGERPRINT_MISMATCH: 'PROGRAM_RECOVERY_REMOTE_FINGERPRINT_MISMATCH',
    REMOTE_REVISION_DOWNGRADE: 'PROGRAM_RECOVERY_REMOTE_REVISION_DOWNGRADE',
    EQUAL_REVISION_DISAGREEMENT: 'PROGRAM_RECOVERY_EQUAL_REVISION_DISAGREEMENT',
    IMMUTABLE_LINEAGE_DIVERGED: 'PROGRAM_RECOVERY_IMMUTABLE_LINEAGE_DIVERGED',
    UNRESOLVED_GOAL_REFERENCE: 'PROGRAM_RECOVERY_UNRESOLVED_GOAL_REFERENCE',
    ACTIVE_ORIGIN_UNRESOLVED: 'PROGRAM_RECOVERY_ACTIVE_ORIGIN_UNRESOLVED',
    ACTIVE_SESSION_PRESENT: 'PROGRAM_RECOVERY_ACTIVE_SESSION_PRESENT',
    REST_STATE_PRESENT: 'PROGRAM_RECOVERY_REST_STATE_PRESENT',
    PROGRAM_QUEUE_PENDING: 'PROGRAM_RECOVERY_PROGRAM_QUEUE_PENDING',
    LOCAL_ADVANCEMENT_PENDING: 'PROGRAM_RECOVERY_LOCAL_ADVANCEMENT_PENDING',
    LOCAL_REMOTE_DIVERGED: 'PROGRAM_RECOVERY_LOCAL_REMOTE_DIVERGED',
    LEGACY_PUBLICATION_REQUIRED: 'PROGRAM_RECOVERY_LEGACY_PUBLICATION_REQUIRED',
    ADOPTION_NOT_SAFE: 'PROGRAM_RECOVERY_ADOPTION_NOT_SAFE',
    ADOPTION_STATE_CHANGED: 'PROGRAM_RECOVERY_ADOPTION_STATE_CHANGED',
    ADOPTION_PERSISTENCE_FAILED: 'PROGRAM_RECOVERY_ADOPTION_PERSISTENCE_FAILED',
    ADOPTION_READBACK_MISMATCH: 'PROGRAM_RECOVERY_ADOPTION_READBACK_MISMATCH',
    ADOPTION_ROLLBACK_FAILED: 'PROGRAM_RECOVERY_ADOPTION_ROLLBACK_FAILED'
  });

  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
  const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
  const nonnegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
  const fingerprint = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  const normalizedInstant = value => typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : null;

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function result(value) {
    return deepFreeze(value);
  }

  function identity(value) {
    if (!value) return null;
    return result({
      version: value.version,
      updatedAt: value.updatedAt,
      fingerprint: value.fingerprint,
      definitionsRevision: value.definitionsRevision,
      definitionsFingerprint: value.definitionsFingerprint,
      headsRevision: value.headsRevision,
      headsFingerprint: value.headsFingerprint,
      sequenceRevision: value.sequenceRevision,
      sequenceFingerprint: value.sequenceFingerprint
    });
  }

  function sameIdentity(left, right) {
    const a = identity(left);
    const b = identity(right);
    return Boolean(a && b && Object.keys(a).every(key => a[key] === b[key]));
  }

  function ownerAndScope(options = {}) {
    const owner = options.owner || { accountId: options.accountId, profileId: options.profileId };
    const profileScope = options.scope || { accountId: options.accountId, profileId: options.profileId };
    if (!nonempty(owner?.accountId) || !nonempty(owner?.profileId)
      || !nonempty(profileScope?.accountId) || !nonempty(profileScope?.profileId)) return null;
    return result({ owner: clone(owner), scope: clone(profileScope) });
  }

  function baseFields(row) {
    return {
      version: row.base_version,
      updatedAt: normalizedInstant(row.base_updated_at),
      fingerprint: row.base_fingerprint,
      definitionsRevision: row.base_definitions_revision,
      definitionsFingerprint: row.base_definitions_fingerprint,
      headsRevision: row.base_heads_revision,
      headsFingerprint: row.base_heads_fingerprint,
      sequenceRevision: row.base_sequence_revision,
      sequenceFingerprint: row.base_sequence_fingerprint
    };
  }

  function validIdentityFields(value, { positiveVersion = true } = {}) {
    return Boolean((positiveVersion ? positiveInteger(value?.version) : nonnegativeInteger(value?.version))
      && normalizedInstant(value?.updatedAt) === value.updatedAt
      && fingerprint(value?.fingerprint)
      && nonnegativeInteger(value?.definitionsRevision) && fingerprint(value?.definitionsFingerprint)
      && nonnegativeInteger(value?.headsRevision) && fingerprint(value?.headsFingerprint)
      && nonnegativeInteger(value?.sequenceRevision) && fingerprint(value?.sequenceFingerprint));
  }

  function validBaseShape(row) {
    const fields = [
      'base_version', 'base_updated_at', 'base_fingerprint',
      'base_definitions_revision', 'base_definitions_fingerprint',
      'base_heads_revision', 'base_heads_fingerprint',
      'base_sequence_revision', 'base_sequence_fingerprint'
    ];
    if (row.version === 1) return fields.every(key => row[key] == null);
    const base = baseFields(row);
    return base.version === row.version - 1 && validIdentityFields(base);
  }

  function remoteRecord(row, mapping) {
    return result({
      remoteId: row.id || null,
      owner: clone(mapping.owner),
      scope: clone(mapping.scope),
      clientId: CLIENT_ID,
      version: row.version,
      updatedAt: normalizedInstant(row.updated_at),
      fingerprint: row.fingerprint,
      definitionsRevision: row.definitions_revision,
      definitionsFingerprint: row.definitions_fingerprint,
      headsRevision: row.heads_revision,
      headsFingerprint: row.heads_fingerprint,
      sequenceRevision: row.sequence_revision,
      sequenceFingerprint: row.sequence_fingerprint,
      idempotencyKey: row.idempotency_key,
      acceptedBase: row.version === 1 ? null : baseFields(row),
      payload: clone(row.payload)
    });
  }

  function errorCode(error) {
    return String(error?.code || error?.status || '').toUpperCase();
  }

  function unavailableError(error) {
    const code = errorCode(error);
    const message = String(error?.message || '').toLowerCase();
    return ['42P01', 'PGRST205', '404'].includes(code)
      || message.includes('does not exist') || message.includes('schema cache');
  }

  async function validateRemoteRow(row, options = {}) {
    const mapping = ownerAndScope(options);
    const envelopeApi = options.envelopeApi || scope.BigGainsProgramDomainEnvelope;
    if (!mapping || !envelopeApi?.validate || !envelopeApi?.fingerprints || !isRecord(row)) {
      return result({ ok: false, reasonCode: REASON_CODES.REMOTE_SHAPE_INVALID });
    }
    if (row.account_id !== mapping.owner.accountId || row.profile_id !== mapping.owner.profileId
      || row.client_id !== CLIENT_ID || row.contract !== envelopeApi.contract
      || row.contract_version !== envelopeApi.contractVersion) {
      return result({ ok: false, reasonCode: REASON_CODES.REMOTE_IDENTITY_MISMATCH });
    }
    const record = remoteRecord(row, mapping);
    if (!positiveInteger(record.version) || !record.updatedAt || !fingerprint(record.fingerprint)
      || !nonnegativeInteger(record.definitionsRevision) || !fingerprint(record.definitionsFingerprint)
      || !nonnegativeInteger(record.headsRevision) || !fingerprint(record.headsFingerprint)
      || !nonnegativeInteger(record.sequenceRevision) || !fingerprint(record.sequenceFingerprint)
      || !nonempty(record.idempotencyKey) || !isRecord(record.payload) || !validBaseShape(row)) {
      return result({ ok: false, reasonCode: REASON_CODES.REMOTE_SHAPE_INVALID });
    }
    const revisions = {
      definitions: record.definitionsRevision,
      heads: record.headsRevision,
      sequence: record.sequenceRevision
    };
    try {
      const validation = await envelopeApi.validate(record.payload, {
        accountId: mapping.scope.accountId,
        profileId: mapping.scope.profileId,
        revisions
      });
      if (!validation.ok) {
        return result({ ok: false, reasonCode: validation.reasonCode || REASON_CODES.REMOTE_SHAPE_INVALID });
      }
      const hashes = await envelopeApi.fingerprints(record.payload, {
        accountId: mapping.scope.accountId,
        profileId: mapping.scope.profileId,
        revisions
      });
      if (hashes.fingerprint !== record.fingerprint
        || hashes.definitionsFingerprint !== record.definitionsFingerprint
        || hashes.headsFingerprint !== record.headsFingerprint
        || hashes.sequenceFingerprint !== record.sequenceFingerprint) {
        return result({ ok: false, reasonCode: REASON_CODES.REMOTE_FINGERPRINT_MISMATCH });
      }
      return result({ ok: true, reasonCode: null, record, envelope: clone(record.payload), hashes });
    } catch {
      return result({ ok: false, reasonCode: REASON_CODES.REMOTE_SHAPE_INVALID });
    }
  }

  async function authenticate(client, verifyAuthenticated) {
    if (typeof verifyAuthenticated === 'function') {
      const verified = await verifyAuthenticated();
      return Boolean(verified === true || verified?.id);
    }
    if (typeof client?.auth?.getUser !== 'function') return false;
    const response = await client.auth.getUser();
    return Boolean(!response?.error && response?.data?.user?.id);
  }

  async function readRemote({ client, enabled = false, verifyAuthenticated = null, envelopeApi, ...options } = {}) {
    const mapping = ownerAndScope(options);
    if (!enabled || !client || !mapping) {
      return result({ state: STATES.UNSUPPORTED, reasonCode: REASON_CODES.CAPABILITY_UNAVAILABLE, remote: null });
    }
    try {
      if (!await authenticate(client, verifyAuthenticated)) {
        return result({ state: STATES.INVALID_REMOTE, reasonCode: REASON_CODES.AUTH_REJECTED, remote: null });
      }
      const response = await client.from(ENTITY_TYPE).select(ROW_COLUMNS)
        .eq('account_id', mapping.owner.accountId)
        .eq('profile_id', mapping.owner.profileId)
        .eq('client_id', CLIENT_ID)
        .maybeSingle();
      if (response?.error) {
        if (unavailableError(response.error)) {
          return result({ state: STATES.UNSUPPORTED, reasonCode: REASON_CODES.CAPABILITY_UNAVAILABLE, remote: null });
        }
        return result({ state: STATES.INVALID_REMOTE, reasonCode: REASON_CODES.REMOTE_READ_FAILED, remote: null });
      }
      if (!response?.data) {
        return result({ state: STATES.REMOTE_ABSENT, reasonCode: REASON_CODES.REMOTE_ABSENT, remote: null });
      }
      const validation = await validateRemoteRow(response.data, { ...mapping, envelopeApi });
      if (!validation.ok) {
        return result({ state: STATES.INVALID_REMOTE, reasonCode: validation.reasonCode, remote: null });
      }
      return result({ state: 'remote_available', reasonCode: null, remote: validation });
    } catch (error) {
      if (unavailableError(error)) {
        return result({ state: STATES.UNSUPPORTED, reasonCode: REASON_CODES.CAPABILITY_UNAVAILABLE, remote: null });
      }
      return result({ state: STATES.INVALID_REMOTE, reasonCode: REASON_CODES.REMOTE_READ_FAILED, remote: null });
    }
  }

  function emptyCapture() {
    return {
      contract: CAPTURE_CONTRACT,
      storageMode: CAPTURE_STORAGE_MODE,
      routines: [], routineVersions: [], programs: [], programVersions: [],
      applicationTraces: [], activeProgramVersionId: null, sequenceState: null
    };
  }

  function captureFromEnvelope(envelope, { applicationTraces = [] } = {}) {
    if (!isRecord(envelope) || Object.keys(envelope).length === 0) return null;
    const routineHeads = new Map(envelope.heads.routines.map(value => [value.routineId, value]));
    const programHeads = new Map(envelope.heads.programs.map(value => [value.programId, value]));
    return {
      contract: CAPTURE_CONTRACT,
      storageMode: CAPTURE_STORAGE_MODE,
      routines: envelope.definitions.routines.map(value => ({
        ...clone(value), currentVersionId: routineHeads.get(value.routineId).currentVersionId
      })),
      routineVersions: clone(envelope.definitions.routineVersions),
      programs: envelope.definitions.programs.map(value => ({
        ...clone(value), ...clone(programHeads.get(value.programId))
      })),
      programVersions: clone(envelope.definitions.programVersions),
      applicationTraces: clone(applicationTraces),
      activeProgramVersionId: envelope.heads.activeProgramVersionId,
      sequenceState: envelope.sequence ? {
        programId: envelope.sequence.programId,
        programVersionId: envelope.sequence.programVersionId,
        nextSlotIndex: envelope.sequence.nextSlotIndex,
        completedCycles: envelope.sequence.completedCycles,
        updatedAt: envelope.sequence.updatedAt
      } : null
    };
  }

  function normalizeCapture(value, mapping, { programModel = scope.BigGainsProgramModel, catalog = null } = {}) {
    if (!programModel?.normalizeCapture) return emptyCapture();
    return programModel.normalizeCapture(value, {
      accountId: mapping.scope.accountId,
      profileId: mapping.scope.profileId,
      catalog
    });
  }

  function captureSemantic(value, mapping, options = {}) {
    const normalized = normalizeCapture(value, mapping, options);
    return {
      ...clone(normalized),
      applicationTraces: []
    };
  }

  function meaningfulCapture(value) {
    return Boolean(value && (value.routineVersions?.length || value.programVersions?.length));
  }

  function sameCapture(left, right, envelopeApi = scope.BigGainsProgramDomainEnvelope) {
    return envelopeApi.canonicalize(left) === envelopeApi.canonicalize(right);
  }

  function summaryFromCapture(capture) {
    const active = capture?.programVersions?.find(value => value.programVersionId === capture.activeProgramVersionId) || null;
    const head = capture?.programs?.find(value => value.activeVersionId === capture.activeProgramVersionId)
      || capture?.programs?.[0] || null;
    const version = active || capture?.programVersions?.find(value => value.programVersionId === head?.latestVersionId)
      || capture?.programVersions?.[0] || null;
    return result({
      hasProgram: meaningfulCapture(capture),
      name: version?.name || null,
      status: head?.status || null,
      versionNumber: version?.versionNumber || null,
      nextSlotIndex: capture?.sequenceState?.nextSlotIndex ?? null,
      completedCycles: capture?.sequenceState?.completedCycles ?? null
    });
  }

  function programOperations(operations, mapping) {
    return (operations || []).filter(operation => operation?.entityType === ENTITY_TYPE
      && operation?.entityId === CLIENT_ID
      && operation?.owner?.accountId === mapping.owner.accountId
      && operation?.owner?.profileId === mapping.owner.profileId);
  }

  function pendingRepresentsLocal(operation, localSemantic, remote, mapping, options) {
    if (!operation || !isRecord(operation.payload)) return false;
    const operationCapture = captureFromEnvelope(operation.payload);
    const operationSemantic = captureSemantic(operationCapture, mapping, options);
    const base = operation.programDomain?.acceptedBase;
    const baseMatches = remote ? sameIdentity(base, remote.record) : base == null;
    return sameCapture(operationSemantic, localSemantic, options.envelopeApi) && baseMatches;
  }

  function memberKey(kind, value) {
    if (kind === 'routines') return value.routineId;
    if (kind === 'routineVersions') return value.routineVersionId;
    if (kind === 'programs') return value.programId;
    return value.programVersionId;
  }

  function immutableSuccessor(acceptedEnvelope, remoteEnvelope) {
    if (!acceptedEnvelope || !remoteEnvelope || Object.keys(acceptedEnvelope).length === 0) return true;
    if (Object.keys(remoteEnvelope).length === 0) return false;
    for (const kind of ['routines', 'routineVersions', 'programs', 'programVersions']) {
      const remoteMembers = new Map(remoteEnvelope.manifest[kind].map(value => [memberKey(kind, value), value.fingerprint]));
      for (const member of acceptedEnvelope.manifest[kind]) {
        if (remoteMembers.get(memberKey(kind, member)) !== member.fingerprint) return false;
      }
    }
    return true;
  }

  function monotonicRemote(remote, acceptedRemote) {
    if (!acceptedRemote) return { ok: true, advanced: true };
    const current = remote.record;
    const accepted = acceptedRemote.record || acceptedRemote;
    if (current.version < accepted.version) return { ok: false, reasonCode: REASON_CODES.REMOTE_REVISION_DOWNGRADE };
    if (current.version === accepted.version) {
      return sameIdentity(current, accepted)
        ? { ok: true, advanced: false }
        : { ok: false, reasonCode: REASON_CODES.EQUAL_REVISION_DISAGREEMENT };
    }
    if (Date.parse(current.updatedAt) < Date.parse(accepted.updatedAt)) {
      return { ok: false, reasonCode: REASON_CODES.REMOTE_REVISION_DOWNGRADE };
    }
    for (const component of ['definitions', 'heads', 'sequence']) {
      const revisionKey = `${component}Revision`;
      const fingerprintKey = `${component}Fingerprint`;
      if (current[revisionKey] < accepted[revisionKey]
        || (current[revisionKey] === accepted[revisionKey]
          && current[fingerprintKey] !== accepted[fingerprintKey])) {
        return { ok: false, reasonCode: REASON_CODES.REMOTE_REVISION_DOWNGRADE };
      }
    }
    const acceptedEnvelope = acceptedRemote.envelope || acceptedRemote.payload;
    if (acceptedEnvelope && !immutableSuccessor(acceptedEnvelope, remote.envelope)) {
      return { ok: false, reasonCode: REASON_CODES.IMMUTABLE_LINEAGE_DIVERGED };
    }
    return { ok: true, advanced: true };
  }

  function goalReferences(envelope) {
    if (!envelope || Object.keys(envelope).length === 0) return [];
    return [...new Set(envelope.definitions.programVersions.flatMap(value => value.priorityGoalIds || []))];
  }

  function goalsResolve(envelope, availableGoalIds) {
    const references = goalReferences(envelope);
    if (!references.length) return true;
    if (availableGoalIds == null) return false;
    const available = availableGoalIds instanceof Set ? availableGoalIds : new Set(availableGoalIds);
    return references.every(value => available.has(value));
  }

  function validateActiveOrigin(activeWorkout, envelope, mapping, programOriginApi = scope.BigGainsProgramOrigin) {
    const raw = activeWorkout?.programOrigin;
    if (raw == null) return { ok: true };
    const origin = programOriginApi?.normalize?.(raw, {
      accountId: mapping.scope.accountId,
      profileId: mapping.scope.profileId
    });
    if (!origin || !envelope || Object.keys(envelope).length === 0) {
      return { ok: false, reasonCode: REASON_CODES.ACTIVE_ORIGIN_UNRESOLVED };
    }
    const version = envelope.definitions.programVersions
      .find(value => value.programVersionId === origin.programVersionId && value.programId === origin.programId);
    const slot = version?.slots?.[origin.slotIndex];
    const routine = envelope.definitions.routineVersions
      .find(value => value.routineVersionId === origin.routineVersionId && value.routineId === origin.routineId);
    if (!version || !slot || !routine || slot.slotId !== origin.slotId
      || slot.routineId !== origin.routineId || slot.routineVersionId !== origin.routineVersionId) {
      return { ok: false, reasonCode: REASON_CODES.ACTIVE_ORIGIN_UNRESOLVED };
    }
    return { ok: true };
  }

  function classification(state, reasonCode, details = {}) {
    return result({ state, reasonCode, canAdopt: state === STATES.REMOTE_FAST_FORWARD_SAFE, ...details });
  }

  async function classify({
    capabilityAvailable = false,
    remoteRead = null,
    remote = remoteRead?.remote || null,
    acceptedRemote = null,
    localProgramCapture = null,
    operations = [],
    initialized = true,
    pristine = false,
    freshDevice = false,
    activeWorkout = null,
    restTimerEndsAt = null,
    availableGoalIds = null,
    envelopeApi = scope.BigGainsProgramDomainEnvelope,
    programModel = scope.BigGainsProgramModel,
    catalog = null,
    ...options
  } = {}) {
    const mapping = ownerAndScope(options);
    const common = { envelopeApi, programModel, catalog };
    if (!capabilityAvailable || !mapping || remoteRead?.state === STATES.UNSUPPORTED) {
      return classification(STATES.UNSUPPORTED, REASON_CODES.CAPABILITY_UNAVAILABLE);
    }
    if (remoteRead?.state === STATES.INVALID_REMOTE) {
      return classification(STATES.INVALID_REMOTE, remoteRead.reasonCode || REASON_CODES.REMOTE_SHAPE_INVALID);
    }
    const localSemantic = captureSemantic(localProgramCapture, mapping, common);
    const localMeaningful = meaningfulCapture(localSemantic);
    const pending = programOperations(operations, mapping);
    if (remoteRead?.state === STATES.REMOTE_ABSENT || !remote) {
      if (pending.length) {
        return classification(STATES.BLOCKED_PENDING_QUEUE, REASON_CODES.PROGRAM_QUEUE_PENDING, {
          queueCount: pending.length, local: summaryFromCapture(localSemantic), remote: null
        });
      }
      if (localMeaningful) {
        return classification(STATES.LEGACY_UNPUBLISHED_LOCAL, REASON_CODES.LEGACY_PUBLICATION_REQUIRED, {
          legacyKind: 'meaningful_program', local: summaryFromCapture(localSemantic), remote: null
        });
      }
      return classification(STATES.REMOTE_ABSENT, REASON_CODES.REMOTE_ABSENT, {
        legacyKind: 'no_program', local: summaryFromCapture(localSemantic), remote: null
      });
    }
    const monotonic = monotonicRemote(remote, acceptedRemote);
    if (!monotonic.ok) return classification(STATES.INVALID_REMOTE, monotonic.reasonCode);
    if (!goalsResolve(remote.envelope, availableGoalIds)) {
      return classification(STATES.INVALID_REMOTE, REASON_CODES.UNRESOLVED_GOAL_REFERENCE);
    }
    const remoteCapture = captureFromEnvelope(remote.envelope);
    const remoteSemantic = captureSemantic(remoteCapture, mapping, common);
    const localMatchesRemote = sameCapture(localSemantic, remoteSemantic, envelopeApi);
    if (pending.length) {
      const localAhead = pending.length === 1
        && pendingRepresentsLocal(pending[0], localSemantic, remote, mapping, common);
      return classification(localAhead ? STATES.LOCAL_AHEAD_PENDING : STATES.BLOCKED_PENDING_QUEUE,
        localAhead ? REASON_CODES.LOCAL_ADVANCEMENT_PENDING : REASON_CODES.PROGRAM_QUEUE_PENDING, {
          queueCount: pending.length,
          local: summaryFromCapture(localSemantic),
          remote: summaryFromCapture(remoteSemantic)
        });
    }
    if (localMatchesRemote && !(pristine || freshDevice)) {
      return classification(STATES.EXACT, null, {
        local: summaryFromCapture(localSemantic), remote: summaryFromCapture(remoteSemantic)
      });
    }
    let localMatchesAccepted = false;
    if (acceptedRemote?.envelope || acceptedRemote?.payload) {
      const acceptedCapture = captureFromEnvelope(acceptedRemote.envelope || acceptedRemote.payload);
      localMatchesAccepted = sameCapture(localSemantic, captureSemantic(acceptedCapture, mapping, common), envelopeApi);
    }
    const freshSafe = (pristine || freshDevice) && !localMeaningful;
    const fastForwardSafe = localMatchesRemote || freshSafe || (monotonic.advanced && localMatchesAccepted);
    if (!fastForwardSafe) {
      return classification(STATES.DIVERGENT_CONFLICT, REASON_CODES.LOCAL_REMOTE_DIVERGED, {
        local: summaryFromCapture(localSemantic),
        remote: summaryFromCapture(remoteSemantic),
        message: 'This Program changed on both devices.',
        remoteIdentity: identity(remote.record),
        guard: {
          localSemanticCanonical: envelopeApi.canonicalize(localSemantic),
          remoteIdentity: identity(remote.record)
        },
        decisions: [
          { id: 'keep_cloud', label: 'Use cloud Program', supported: true },
          { id: 'keep_device', label: 'Use this device Program', supported: true }
        ]
      });
    }
    if (initialized && !freshDevice && activeWorkout) {
      return classification(STATES.BLOCKED_ACTIVE_SESSION, REASON_CODES.ACTIVE_SESSION_PRESENT, {
        deferred: true, message: 'Program changes are available from another device.'
      });
    }
    if (initialized && !freshDevice && restTimerEndsAt != null) {
      return classification(STATES.BLOCKED_ACTIVE_SESSION, REASON_CODES.REST_STATE_PRESENT, {
        deferred: true, message: 'Program changes are available from another device.'
      });
    }
    if (freshDevice) {
      const origin = validateActiveOrigin(activeWorkout, remote.envelope, mapping);
      if (!origin.ok) return classification(STATES.INVALID_REMOTE, origin.reasonCode);
    }
    return classification(STATES.REMOTE_FAST_FORWARD_SAFE, null, {
      local: summaryFromCapture(localSemantic),
      remote: summaryFromCapture(remoteSemantic),
      message: 'Program changes are available from another device.',
      remoteIdentity: identity(remote.record),
      guard: {
        localSemanticCanonical: envelopeApi.canonicalize(localSemantic),
        remoteIdentity: identity(remote.record)
      }
    });
  }

  async function verifyPersistedProfile(raw, remote, mapping, options = {}) {
    let profile;
    try { profile = JSON.parse(raw); } catch { return false; }
    if (!isRecord(profile)) return false;
    const applicationTraces = Array.isArray(profile.programCapture?.applicationTraces)
      ? profile.programCapture.applicationTraces : [];
    const capture = remote.envelope && Object.keys(remote.envelope).length
      ? normalizeCapture(profile.programCapture, mapping, options)
      : null;
    if (Object.keys(remote.envelope).length === 0 && Object.hasOwn(profile, 'programCapture')) return false;
    if (capture && applicationTraces.length !== capture.applicationTraces.length) return false;
    try {
      const revisions = {
        definitions: remote.record.definitionsRevision,
        heads: remote.record.headsRevision,
        sequence: remote.record.sequenceRevision
      };
      const lastTransition = remote.envelope?.sequence?.lastTransition || null;
      const rebuilt = await options.envelopeApi.build({
        accountId: mapping.scope.accountId,
        profileId: mapping.scope.profileId,
        programCapture: capture,
        revisions,
        lastTransition,
        catalog: options.catalog,
        normalizeCapture: options.programModel?.normalizeCapture
      });
      const hashes = await options.envelopeApi.fingerprints(rebuilt, {
        accountId: mapping.scope.accountId,
        profileId: mapping.scope.profileId,
        revisions
      });
      return hashes.fingerprint === remote.record.fingerprint
        && hashes.definitionsFingerprint === remote.record.definitionsFingerprint
        && hashes.headsFingerprint === remote.record.headsFingerprint
        && hashes.sequenceFingerprint === remote.record.sequenceFingerprint;
    } catch {
      return false;
    }
  }

  async function adopt({
    classification: inspected,
    remote,
    readRaw,
    writeRaw,
    removeRaw,
    candidateProfile = null,
    getOperations = () => [],
    initialized = true,
    freshDevice = false,
    explicitChoice = false,
    envelopeApi = scope.BigGainsProgramDomainEnvelope,
    programModel = scope.BigGainsProgramModel,
    catalog = null,
    ...options
  } = {}) {
    const mapping = ownerAndScope(options);
    const portsValid = mapping && typeof readRaw === 'function' && typeof writeRaw === 'function'
      && typeof removeRaw === 'function' && envelopeApi?.build && programModel?.normalizeCapture;
    const permittedState = inspected?.state === STATES.REMOTE_FAST_FORWARD_SAFE
      || (explicitChoice === true && inspected?.state === STATES.DIVERGENT_CONFLICT);
    if (!portsValid || !permittedState || !remote?.record || !remote?.envelope) {
      return result({ ok: false, reasonCode: REASON_CODES.ADOPTION_NOT_SAFE });
    }
    if (!sameIdentity(inspected?.guard?.remoteIdentity, remote.record)) {
      return result({ ok: false, reasonCode: REASON_CODES.ADOPTION_STATE_CHANGED });
    }
    if (programOperations(getOperations(), mapping).length) {
      return result({ ok: false, reasonCode: REASON_CODES.PROGRAM_QUEUE_PENDING });
    }
    let beforeRaw;
    let current;
    try {
      beforeRaw = await readRaw();
      if (candidateProfile != null && beforeRaw !== null) {
        return result({ ok: false, reasonCode: REASON_CODES.ADOPTION_STATE_CHANGED });
      }
      current = candidateProfile == null ? JSON.parse(beforeRaw) : clone(candidateProfile);
      if (!isRecord(current)) throw new Error('Profile candidate is not an object.');
    } catch {
      return result({ ok: false, reasonCode: REASON_CODES.ADOPTION_PERSISTENCE_FAILED });
    }
    if (initialized && !freshDevice && (current.activeWorkout || current.restTimerEndsAt != null)) {
      return result({ ok: false, reasonCode: current.activeWorkout
        ? REASON_CODES.ACTIVE_SESSION_PRESENT : REASON_CODES.REST_STATE_PRESENT });
    }
    if (freshDevice) {
      const origin = validateActiveOrigin(current.activeWorkout, remote.envelope, mapping);
      if (!origin.ok) return result({ ok: false, reasonCode: origin.reasonCode });
    }
    const currentSemantic = captureSemantic(current.programCapture, mapping, { programModel, catalog });
    if (envelopeApi.canonicalize(currentSemantic) !== inspected.guard.localSemanticCanonical) {
      return result({ ok: false, reasonCode: REASON_CODES.ADOPTION_STATE_CHANGED });
    }
    const traces = Array.isArray(current.programCapture?.applicationTraces)
      ? clone(current.programCapture.applicationTraces) : [];
    const remoteCapture = captureFromEnvelope(remote.envelope, { applicationTraces: traces });
    const next = clone(current);
    if (remoteCapture) {
      next.programCapture = normalizeCapture(remoteCapture, mapping, { programModel, catalog });
    } else delete next.programCapture;
    const candidateRaw = JSON.stringify(next);
    const rollback = async () => {
      if (beforeRaw === null) await removeRaw();
      else await writeRaw(beforeRaw);
      if (await readRaw() !== beforeRaw) throw new Error(REASON_CODES.ADOPTION_ROLLBACK_FAILED);
    };
    try {
      if (programOperations(getOperations(), mapping).length) {
        return result({ ok: false, reasonCode: REASON_CODES.PROGRAM_QUEUE_PENDING });
      }
      if (await readRaw() !== beforeRaw) {
        return result({ ok: false, reasonCode: REASON_CODES.ADOPTION_STATE_CHANGED });
      }
      await writeRaw(candidateRaw);
      const afterRaw = await readRaw();
      if (afterRaw !== candidateRaw || !await verifyPersistedProfile(afterRaw, remote, mapping, {
        envelopeApi, programModel, catalog
      })) throw new Error(REASON_CODES.ADOPTION_READBACK_MISMATCH);
      if (programOperations(getOperations(), mapping).length) throw new Error(REASON_CODES.ADOPTION_STATE_CHANGED);
      return result({
        ok: true,
        status: 'program-domain-adopted',
        profile: clone(next),
        remoteIdentity: identity(remote.record),
        queueChanged: false
      });
    } catch (error) {
      try {
        await rollback();
      } catch (rollbackError) {
        return result({
          ok: false,
          reasonCode: REASON_CODES.ADOPTION_ROLLBACK_FAILED,
          error: error?.message || String(error),
          rollbackError: rollbackError?.message || String(rollbackError)
        });
      }
      return result({
        ok: false,
        reasonCode: [REASON_CODES.ADOPTION_STATE_CHANGED, REASON_CODES.ADOPTION_READBACK_MISMATCH]
          .includes(error?.message)
          ? error.message
          : REASON_CODES.ADOPTION_PERSISTENCE_FAILED,
        error: error?.message || String(error),
        rolledBack: true
      });
    }
  }

  scope.BigGainsProgramDomainRecovery = Object.freeze({
    entityType: ENTITY_TYPE,
    clientId: CLIENT_ID,
    states: STATES,
    reasonCodes: REASON_CODES,
    readRemote,
    validateRemoteRow,
    captureFromEnvelope,
    validateActiveOrigin,
    classify,
    adopt
  });
})(typeof window === 'object' ? window : globalThis);
