((scope) => {
  'use strict';

  const CONTRACT = 'big-gains.program-portability-envelope.v1';
  const CONTRACT_VERSION = 1;
  const CLIENT_ID = 'program-domain';
  const CAPTURE_CONTRACT = 'big-gains.program-capture.v1';
  const PROGRAM_STATUSES = Object.freeze(['draft', 'active', 'completed', 'archived']);
  const AUTHORITIES = Object.freeze(['off', 'review']);
  const TRANSITION_KINDS = Object.freeze(['activation', 'successor_carry', 'completion']);
  const MANIFEST_KEYS = Object.freeze(['routines', 'routineVersions', 'programs', 'programVersions']);
  const EMPTY_MANIFEST = Object.freeze({
    routines: Object.freeze([]),
    routineVersions: Object.freeze([]),
    programs: Object.freeze([]),
    programVersions: Object.freeze([])
  });

  const ERROR_CODES = Object.freeze({
    MALFORMED_PAYLOAD: 'MALFORMED_PAYLOAD',
    UNSUPPORTED_CONTRACT: 'UNSUPPORTED_CONTRACT',
    PROFILE_SCOPE_MISMATCH: 'PROFILE_SCOPE_MISMATCH',
    DUPLICATE_IDENTITY: 'DUPLICATE_IDENTITY',
    INVALID_LINEAGE: 'INVALID_LINEAGE',
    UNRESOLVED_PIN: 'UNRESOLVED_PIN',
    INVALID_POINTER: 'INVALID_POINTER',
    INVALID_SLOT: 'INVALID_SLOT',
    INVALID_SEQUENCE: 'INVALID_SEQUENCE',
    UNSUPPORTED_AUTHORITY: 'UNSUPPORTED_AUTHORITY',
    NONCANONICAL_VALUE: 'NONCANONICAL_VALUE',
    MANIFEST_MISMATCH: 'MANIFEST_MISMATCH',
    INVALID_REVISION: 'INVALID_REVISION',
    PROGRAM_MODEL_UNAVAILABLE: 'PROGRAM_MODEL_UNAVAILABLE',
    SOURCE_NORMALIZATION_LOSS: 'SOURCE_NORMALIZATION_LOSS'
  });

  class ProgramDomainEnvelopeError extends Error {
    constructor(reasonCode) {
      super(reasonCode);
      this.name = 'ProgramDomainEnvelopeError';
      this.reasonCode = reasonCode;
    }
  }

  const fail = reasonCode => { throw new ProgramDomainEnvelopeError(reasonCode); };
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const isPlainRecord = value => isRecord(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
  const safeNonnegativeInteger = value => Number.isSafeInteger(value) && value >= 0;
  const safePositiveInteger = value => Number.isSafeInteger(value) && value > 0;
  const isoInstant = value => typeof value === 'string'
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString() === value;
  const isoDate = value => typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  const hexFingerprint = value => typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
  const compareText = (left, right) => left < right ? -1 : left > right ? 1 : 0;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function assertCanonicalValue(value, seen = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail(ERROR_CODES.NONCANONICAL_VALUE);
      return;
    }
    if (typeof value !== 'object') fail(ERROR_CODES.NONCANONICAL_VALUE);
    if (seen.has(value)) fail(ERROR_CODES.NONCANONICAL_VALUE);
    seen.add(value);
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) fail(ERROR_CODES.NONCANONICAL_VALUE);
        assertCanonicalValue(value[index], seen);
      }
    } else {
      if (!isPlainRecord(value)) fail(ERROR_CODES.NONCANONICAL_VALUE);
      Object.keys(value).forEach(key => {
        assertCanonicalValue(key, seen);
        assertCanonicalValue(value[key], seen);
      });
    }
    seen.delete(value);
  }

  function canonicalize(value) {
    assertCanonicalValue(value);
    if (value === null) return 'null';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
    return `{${Object.keys(value).sort(compareText)
      .map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }

  async function sha256(value) {
    const subtle = scope.crypto?.subtle;
    if (!subtle || typeof TextEncoder !== 'function') fail(ERROR_CODES.NONCANONICAL_VALUE);
    const digest = await subtle.digest('SHA-256', new TextEncoder().encode(canonicalize(value)));
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function exactKeys(value, keys, reasonCode = ERROR_CODES.MALFORMED_PAYLOAD) {
    if (!isPlainRecord(value)) fail(reasonCode);
    const actual = Object.keys(value).sort(compareText);
    const expected = [...keys].sort(compareText);
    if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(reasonCode);
  }

  function unique(values, reasonCode = ERROR_CODES.DUPLICATE_IDENTITY) {
    if (new Set(values).size !== values.length) fail(reasonCode);
  }

  function validateScope(scopeValue, expected = {}) {
    exactKeys(scopeValue, ['accountId', 'profileId'], ERROR_CODES.PROFILE_SCOPE_MISMATCH);
    if (!nonempty(scopeValue.accountId) || !nonempty(scopeValue.profileId)) fail(ERROR_CODES.PROFILE_SCOPE_MISMATCH);
    if ((expected.accountId && scopeValue.accountId !== expected.accountId)
      || (expected.profileId && scopeValue.profileId !== expected.profileId)) fail(ERROR_CODES.PROFILE_SCOPE_MISMATCH);
  }

  function validateRevisions(revisions, { empty = false, hasSequence = false } = {}) {
    exactKeys(revisions, ['definitions', 'heads', 'sequence'], ERROR_CODES.INVALID_REVISION);
    if (![revisions.definitions, revisions.heads, revisions.sequence].every(safeNonnegativeInteger)) {
      fail(ERROR_CODES.INVALID_REVISION);
    }
    if (empty && (revisions.definitions !== 0 || revisions.heads !== 0 || revisions.sequence !== 0)) {
      fail(ERROR_CODES.INVALID_REVISION);
    }
    if (!empty && (revisions.definitions < 1 || revisions.heads < 1)) fail(ERROR_CODES.INVALID_REVISION);
    if (hasSequence ? revisions.sequence < 1 : revisions.sequence !== 0) fail(ERROR_CODES.INVALID_REVISION);
  }

  function envelopeRevisions(envelope) {
    return {
      definitions: envelope.definitionsRevision,
      heads: envelope.headsRevision,
      sequence: envelope.sequenceRevision
    };
  }

  function validateRoutineDefinition(value, scopeValue) {
    exactKeys(value, ['routineId', 'accountId', 'profileId', 'purposeKey', 'createdAt']);
    if (![value.routineId, value.purposeKey].every(nonempty) || !isoInstant(value.createdAt)
      || value.accountId !== scopeValue.accountId || value.profileId !== scopeValue.profileId) {
      fail(ERROR_CODES.PROFILE_SCOPE_MISMATCH);
    }
  }

  function validateExercise(value, index) {
    exactKeys(value, ['sequence', 'exerciseId', 'workingSets', 'repTarget', 'restSeconds']);
    if (value.sequence !== index + 1 || !nonempty(value.exerciseId)
      || !safePositiveInteger(value.workingSets) || value.workingSets > 12
      || (value.restSeconds !== null && (!safePositiveInteger(value.restSeconds) || value.restSeconds > 900))) {
      fail(ERROR_CODES.MALFORMED_PAYLOAD);
    }
    if (!isPlainRecord(value.repTarget) || !['unspecified', 'exact', 'range', 'text'].includes(value.repTarget.kind)
      || typeof value.repTarget.text !== 'string') fail(ERROR_CODES.MALFORMED_PAYLOAD);
    if (value.repTarget.kind === 'unspecified' || value.repTarget.kind === 'text') {
      exactKeys(value.repTarget, ['kind', 'text']);
    } else if (value.repTarget.kind === 'exact') {
      exactKeys(value.repTarget, ['kind', 'text', 'value']);
      if (!safePositiveInteger(value.repTarget.value)) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    } else {
      exactKeys(value.repTarget, ['kind', 'text', 'min', 'max']);
      if (!safePositiveInteger(value.repTarget.min) || !safePositiveInteger(value.repTarget.max)
        || value.repTarget.min > value.repTarget.max) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    }
  }

  function validateRoutineVersion(value, scopeValue) {
    exactKeys(value, [
      'routineVersionId', 'routineId', 'accountId', 'profileId', 'versionNumber',
      'predecessorRoutineVersionId', 'label', 'source', 'exercises', 'createdAt',
      'effectiveAt', 'createdBy', 'approval'
    ]);
    if (![value.routineVersionId, value.routineId, value.label].every(nonempty)
      || value.accountId !== scopeValue.accountId || value.profileId !== scopeValue.profileId
      || !safePositiveInteger(value.versionNumber)
      || (value.predecessorRoutineVersionId !== null && !nonempty(value.predecessorRoutineVersionId))
      || !isoInstant(value.createdAt) || !isoInstant(value.effectiveAt) || value.createdBy !== 'user'
      || !Array.isArray(value.exercises) || value.exercises.length === 0) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    exactKeys(value.source, Object.hasOwn(value.source || {}, 'basedOnRoutineVersionId')
      ? ['kind', 'routineType', 'basedOnRoutineVersionId'] : ['kind', 'routineType']);
    if (!['existing_custom', 'coded_default', 'reviewed_rebuild'].includes(value.source.kind)
      || !nonempty(value.source.routineType)
      || (Object.hasOwn(value.source, 'basedOnRoutineVersionId') && !nonempty(value.source.basedOnRoutineVersionId))) {
      fail(ERROR_CODES.MALFORMED_PAYLOAD);
    }
    exactKeys(value.approval, ['kind', 'approvedAt']);
    if (value.approval.kind !== 'explicit_user' || !isoInstant(value.approval.approvedAt)) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    value.exercises.forEach(validateExercise);
    unique(value.exercises.map(exercise => exercise.exerciseId));
  }

  function validateProgramDefinition(value, scopeValue) {
    exactKeys(value, ['programId', 'accountId', 'profileId', 'purposeKey', 'createdAt']);
    if (![value.programId, value.purposeKey].every(nonempty) || !isoInstant(value.createdAt)
      || value.accountId !== scopeValue.accountId || value.profileId !== scopeValue.profileId) {
      fail(ERROR_CODES.PROFILE_SCOPE_MISMATCH);
    }
  }

  function validateBoundary(value) {
    exactKeys(value, ['boundaryKind', 'boundaryValue', 'onBoundary']);
    if (!['completed_cycles', 'weeks', 'date'].includes(value.boundaryKind)
      || value.onBoundary !== 'review_required') fail(ERROR_CODES.MALFORMED_PAYLOAD);
    if (value.boundaryKind === 'date') {
      if (!isoDate(value.boundaryValue)) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    } else if (!safePositiveInteger(value.boundaryValue) || value.boundaryValue > 520) {
      fail(ERROR_CODES.MALFORMED_PAYLOAD);
    }
  }

  function validateSlot(value, index) {
    exactKeys(value, ['slotId', 'sequence', 'label', 'preferredCalendarAnchor', 'routineId', 'routineVersionId']);
    if (![value.slotId, value.label, value.routineId, value.routineVersionId].every(nonempty)
      || value.sequence !== index + 1) fail(ERROR_CODES.INVALID_SLOT);
    if (value.preferredCalendarAnchor !== null) {
      exactKeys(value.preferredCalendarAnchor, ['weekday'], ERROR_CODES.INVALID_SLOT);
      if (!Number.isInteger(value.preferredCalendarAnchor.weekday)
        || value.preferredCalendarAnchor.weekday < 0 || value.preferredCalendarAnchor.weekday > 6) {
        fail(ERROR_CODES.INVALID_SLOT);
      }
    }
  }

  function validateProgramVersion(value, scopeValue) {
    exactKeys(value, [
      'programVersionId', 'programId', 'accountId', 'profileId', 'versionNumber',
      'predecessorProgramVersionId', 'name', 'scheduleMode', 'cadencePolicy', 'duration',
      'slots', 'blockReviewPolicy', 'programmingAuthority', 'priorityGoalIds', 'policyRefs',
      'effectiveBoundary', 'createdAt', 'createdBy', 'versionNote'
    ]);
    if (![value.programVersionId, value.programId, value.name].every(nonempty)
      || value.accountId !== scopeValue.accountId || value.profileId !== scopeValue.profileId
      || !safePositiveInteger(value.versionNumber)
      || (value.predecessorProgramVersionId !== null && !nonempty(value.predecessorProgramVersionId))
      || value.scheduleMode !== 'rolling_cycle' || !isoInstant(value.createdAt)
      || value.createdBy !== 'user' || typeof value.versionNote !== 'string'
      || !Array.isArray(value.slots) || value.slots.length === 0
      || !Array.isArray(value.priorityGoalIds) || !Array.isArray(value.policyRefs)) {
      fail(ERROR_CODES.MALFORMED_PAYLOAD);
    }
    exactKeys(value.cadencePolicy, ['kind', 'advanceOn']);
    if (value.cadencePolicy.kind !== 'rolling_cycle' || value.cadencePolicy.advanceOn !== 'completed_session') {
      fail(ERROR_CODES.MALFORMED_PAYLOAD);
    }
    exactKeys(value.duration, ['mode', 'startsOn', 'endsOn']);
    if (value.duration.mode !== 'rolling' || !isoDate(value.duration.startsOn) || value.duration.endsOn !== null) {
      fail(ERROR_CODES.MALFORMED_PAYLOAD);
    }
    validateBoundary(value.blockReviewPolicy);
    if (!AUTHORITIES.includes(value.programmingAuthority)) fail(ERROR_CODES.UNSUPPORTED_AUTHORITY);
    value.slots.forEach(validateSlot);
    unique(value.slots.map(slot => slot.slotId));
    if (!value.priorityGoalIds.every(nonempty)) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    unique(value.priorityGoalIds);
    if (value.policyRefs.length !== 0) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    exactKeys(value.effectiveBoundary, ['kind', 'activeWorkoutIdAtAcceptance']);
    if (value.effectiveBoundary.kind !== 'next_unmaterialized_session'
      || (value.effectiveBoundary.activeWorkoutIdAtAcceptance !== null
        && !nonempty(value.effectiveBoundary.activeWorkoutIdAtAcceptance))) fail(ERROR_CODES.MALFORMED_PAYLOAD);
  }

  function validateTransitionPosition(value, { allowNullVersion = false } = {}) {
    exactKeys(value, ['programVersionId', 'nextSlotIndex', 'completedCycles']);
    if ((allowNullVersion ? value.programVersionId !== null && !nonempty(value.programVersionId) : !nonempty(value.programVersionId))
      || (value.nextSlotIndex !== null && !safeNonnegativeInteger(value.nextSlotIndex))
      || (value.completedCycles !== null && !safeNonnegativeInteger(value.completedCycles))) {
      fail(ERROR_CODES.INVALID_SEQUENCE);
    }
  }

  function validateTransition(value, currentSequence, programVersions) {
    exactKeys(value, ['transitionId', 'kind', 'before', 'after', 'occurredAt', 'workoutId']);
    if (!nonempty(value.transitionId) || !TRANSITION_KINDS.includes(value.kind) || !isoInstant(value.occurredAt)
      || (value.workoutId !== null && !nonempty(value.workoutId))) fail(ERROR_CODES.INVALID_SEQUENCE);
    validateTransitionPosition(value.before, { allowNullVersion: value.kind === 'activation' });
    validateTransitionPosition(value.after);
    if (value.after.programVersionId !== currentSequence.programVersionId
      || value.after.nextSlotIndex !== currentSequence.nextSlotIndex
      || value.after.completedCycles !== currentSequence.completedCycles
      || value.occurredAt !== currentSequence.updatedAt) fail(ERROR_CODES.INVALID_SEQUENCE);
    if (!programVersions.has(value.after.programVersionId)
      || (value.before.programVersionId !== null && !programVersions.has(value.before.programVersionId))) {
      fail(ERROR_CODES.INVALID_SEQUENCE);
    }
    if (value.kind === 'activation') {
      if (value.before.programVersionId !== null || value.before.nextSlotIndex !== null
        || value.before.completedCycles !== null || value.after.nextSlotIndex !== 0
        || value.after.completedCycles !== 0 || value.workoutId !== null) fail(ERROR_CODES.INVALID_SEQUENCE);
    } else if (value.kind === 'successor_carry') {
      const afterVersion = programVersions.get(value.after.programVersionId);
      if (value.workoutId !== null || value.before.programVersionId === value.after.programVersionId
        || afterVersion.predecessorProgramVersionId !== value.before.programVersionId
        || value.before.nextSlotIndex !== value.after.nextSlotIndex
        || value.before.completedCycles !== value.after.completedCycles) fail(ERROR_CODES.INVALID_SEQUENCE);
    } else {
      const version = programVersions.get(value.after.programVersionId);
      const expectedSlot = (value.before.nextSlotIndex + 1) % version.slots.length;
      const expectedCycles = value.before.completedCycles + (expectedSlot === 0 ? 1 : 0);
      if (!value.workoutId || value.before.programVersionId !== value.after.programVersionId
        || value.after.nextSlotIndex !== expectedSlot || value.after.completedCycles !== expectedCycles) {
        fail(ERROR_CODES.INVALID_SEQUENCE);
      }
    }
  }

  function validateDefinitions(definitions, scopeValue) {
    exactKeys(definitions, ['routines', 'routineVersions', 'programs', 'programVersions']);
    if (!MANIFEST_KEYS.every(key => Array.isArray(definitions[key]))) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    definitions.routines.forEach(value => validateRoutineDefinition(value, scopeValue));
    definitions.routineVersions.forEach(value => validateRoutineVersion(value, scopeValue));
    definitions.programs.forEach(value => validateProgramDefinition(value, scopeValue));
    definitions.programVersions.forEach(value => validateProgramVersion(value, scopeValue));

    unique(definitions.routines.map(value => value.routineId));
    unique(definitions.routineVersions.map(value => value.routineVersionId));
    unique(definitions.programs.map(value => value.programId));
    unique(definitions.programVersions.map(value => value.programVersionId));
    unique(definitions.routineVersions.map(value => `${value.routineId}\u0000${value.versionNumber}`));
    unique(definitions.programVersions.map(value => `${value.programId}\u0000${value.versionNumber}`));

    const routineIds = new Set(definitions.routines.map(value => value.routineId));
    const routineVersions = new Map(definitions.routineVersions.map(value => [value.routineVersionId, value]));
    const programIds = new Set(definitions.programs.map(value => value.programId));
    const programVersions = new Map(definitions.programVersions.map(value => [value.programVersionId, value]));
    if (definitions.routineVersions.some(value => !routineIds.has(value.routineId))
      || definitions.programVersions.some(value => !programIds.has(value.programId))) fail(ERROR_CODES.INVALID_LINEAGE);

    const slotOwners = new Map();
    definitions.programVersions.forEach(version => version.slots.forEach(slot => {
      const owner = slotOwners.get(slot.slotId);
      if (owner && owner !== version.programId) fail(ERROR_CODES.DUPLICATE_IDENTITY);
      slotOwners.set(slot.slotId, version.programId);
      const pin = routineVersions.get(slot.routineVersionId);
      if (!pin || pin.routineId !== slot.routineId || !routineIds.has(slot.routineId)) fail(ERROR_CODES.UNRESOLVED_PIN);
    }));

    validateLineage(definitions.routineVersions, {
      id: value => value.routineVersionId,
      owner: value => value.routineId,
      version: value => value.versionNumber,
      predecessor: value => value.predecessorRoutineVersionId,
      auxiliary: (value, predecessor) => value.versionNumber === 1
        && value.routineId !== predecessor.routineId
        && value.source.basedOnRoutineVersionId === predecessor.routineVersionId
    });
    validateLineage(definitions.programVersions, {
      id: value => value.programVersionId,
      owner: value => value.programId,
      version: value => value.versionNumber,
      predecessor: value => value.predecessorProgramVersionId,
      auxiliary: () => false
    });

    return { routineIds, routineVersions, programIds, programVersions };
  }

  function validateLineage(values, access) {
    const byId = new Map(values.map(value => [access.id(value), value]));
    const children = new Map();
    values.forEach(value => {
      const predecessorId = access.predecessor(value);
      if (predecessorId === null) {
        if (access.version(value) !== 1) fail(ERROR_CODES.INVALID_LINEAGE);
        return;
      }
      const predecessor = byId.get(predecessorId);
      if (!predecessor) fail(ERROR_CODES.INVALID_LINEAGE);
      const ordinary = access.owner(value) === access.owner(predecessor)
        && access.version(value) === access.version(predecessor) + 1;
      if (!ordinary && !access.auxiliary(value, predecessor)) fail(ERROR_CODES.INVALID_LINEAGE);
      if (ordinary) {
        const key = `${access.owner(value)}\u0000${predecessorId}`;
        children.set(key, (children.get(key) || 0) + 1);
        if (children.get(key) > 1) fail(ERROR_CODES.INVALID_LINEAGE);
      }
    });
    values.forEach(value => {
      const seen = new Set();
      let current = value;
      while (current && access.predecessor(current) !== null) {
        const currentId = access.id(current);
        if (seen.has(currentId)) fail(ERROR_CODES.INVALID_LINEAGE);
        seen.add(currentId);
        current = byId.get(access.predecessor(current));
      }
    });
  }

  function validateHeads(heads, graph) {
    exactKeys(heads, ['routines', 'programs', 'activeProgramVersionId']);
    if (!Array.isArray(heads.routines) || !Array.isArray(heads.programs)
      || (heads.activeProgramVersionId !== null && !nonempty(heads.activeProgramVersionId))) {
      fail(ERROR_CODES.INVALID_POINTER);
    }
    heads.routines.forEach(value => {
      exactKeys(value, ['routineId', 'currentVersionId'], ERROR_CODES.INVALID_POINTER);
      if (!nonempty(value.routineId) || !nonempty(value.currentVersionId)) fail(ERROR_CODES.INVALID_POINTER);
    });
    heads.programs.forEach(value => {
      exactKeys(value, ['programId', 'status', 'latestVersionId', 'activeVersionId', 'updatedAt'], ERROR_CODES.INVALID_POINTER);
      if (!nonempty(value.programId) || !PROGRAM_STATUSES.includes(value.status)
        || !nonempty(value.latestVersionId) || !isoInstant(value.updatedAt)
        || (value.activeVersionId !== null && !nonempty(value.activeVersionId))) fail(ERROR_CODES.INVALID_POINTER);
    });
    unique(heads.routines.map(value => value.routineId));
    unique(heads.programs.map(value => value.programId));
    if (heads.routines.length !== graph.routineIds.size || heads.programs.length !== graph.programIds.size
      || heads.routines.some(value => !graph.routineIds.has(value.routineId))
      || heads.programs.some(value => !graph.programIds.has(value.programId))) fail(ERROR_CODES.INVALID_POINTER);

    heads.routines.forEach(head => {
      const version = graph.routineVersions.get(head.currentVersionId);
      if (!version || version.routineId !== head.routineId) fail(ERROR_CODES.INVALID_POINTER);
      const sameIdentity = [...graph.routineVersions.values()].filter(value => value.routineId === head.routineId);
      if (sameIdentity.some(value => value.versionNumber > version.versionNumber)) fail(ERROR_CODES.INVALID_POINTER);
    });
    heads.programs.forEach(head => {
      const latest = graph.programVersions.get(head.latestVersionId);
      if (!latest || latest.programId !== head.programId) fail(ERROR_CODES.INVALID_POINTER);
      const sameIdentity = [...graph.programVersions.values()].filter(value => value.programId === head.programId);
      if (sameIdentity.some(value => value.versionNumber > latest.versionNumber)) fail(ERROR_CODES.INVALID_POINTER);
      if (head.status === 'active') {
        const active = graph.programVersions.get(head.activeVersionId);
        if (!active || active.programId !== head.programId || head.activeVersionId !== head.latestVersionId) {
          fail(ERROR_CODES.INVALID_POINTER);
        }
      } else if (head.activeVersionId !== null) fail(ERROR_CODES.INVALID_POINTER);
    });

    const activeHeads = heads.programs.filter(value => value.status === 'active');
    if (activeHeads.length > 1) fail(ERROR_CODES.INVALID_POINTER);
    if (activeHeads.length === 0 ? heads.activeProgramVersionId !== null
      : heads.activeProgramVersionId !== activeHeads[0].activeVersionId) fail(ERROR_CODES.INVALID_POINTER);
  }

  function validateSequence(sequence, graph, heads, revisions) {
    if (sequence === null) {
      if (heads.activeProgramVersionId !== null) fail(ERROR_CODES.INVALID_SEQUENCE);
      return;
    }
    exactKeys(sequence, ['programId', 'programVersionId', 'nextSlotIndex', 'completedCycles', 'updatedAt', 'lastTransition'], ERROR_CODES.INVALID_SEQUENCE);
    if (!nonempty(sequence.programId) || !nonempty(sequence.programVersionId)
      || !safeNonnegativeInteger(sequence.nextSlotIndex) || !safeNonnegativeInteger(sequence.completedCycles)
      || !isoInstant(sequence.updatedAt) || heads.activeProgramVersionId !== sequence.programVersionId) {
      fail(ERROR_CODES.INVALID_SEQUENCE);
    }
    const version = graph.programVersions.get(sequence.programVersionId);
    if (!version || version.programId !== sequence.programId || sequence.nextSlotIndex >= version.slots.length) {
      fail(ERROR_CODES.INVALID_SEQUENCE);
    }
    if (sequence.lastTransition === null) {
      // Existing schema-v5 captures predate transition identity. Only their
      // revision-1 publication baseline may honestly retain that absence.
      if (revisions.sequence !== 1) fail(ERROR_CODES.INVALID_SEQUENCE);
    } else validateTransition(sequence.lastTransition, sequence, graph.programVersions);
  }

  function expectedManifestShape(value) {
    exactKeys(value, MANIFEST_KEYS, ERROR_CODES.MANIFEST_MISMATCH);
    if (!MANIFEST_KEYS.every(key => Array.isArray(value[key]))) fail(ERROR_CODES.MANIFEST_MISMATCH);
  }

  async function createManifest(definitions) {
    const routines = await Promise.all(definitions.routines.map(async value => ({
      routineId: value.routineId,
      fingerprint: await sha256(value)
    })));
    const routineVersions = await Promise.all(definitions.routineVersions.map(async value => ({
      routineId: value.routineId,
      routineVersionId: value.routineVersionId,
      fingerprint: await sha256(value)
    })));
    const programs = await Promise.all(definitions.programs.map(async value => ({
      programId: value.programId,
      fingerprint: await sha256(value)
    })));
    const programVersions = await Promise.all(definitions.programVersions.map(async value => ({
      programId: value.programId,
      programVersionId: value.programVersionId,
      fingerprint: await sha256(value)
    })));
    return { routines, routineVersions, programs, programVersions };
  }

  async function validateManifest(manifest, definitions) {
    expectedManifestShape(manifest);
    const expected = await createManifest(definitions);
    if (canonicalize(manifest) !== canonicalize(expected)) fail(ERROR_CODES.MANIFEST_MISMATCH);
  }

  function resultOk(envelope) {
    return deepFreeze({ ok: true, reasonCode: null, envelope });
  }

  async function validateOrThrow(envelope, options = {}) {
    assertCanonicalValue(envelope);
    if (!isPlainRecord(envelope)) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    if (Object.keys(envelope).length === 0) {
      const revisions = options.revisions || { definitions: 0, heads: 0, sequence: 0 };
      validateRevisions(revisions, { empty: true });
      return envelope;
    }
    exactKeys(envelope, [
      'contract', 'contractVersion', 'clientId', 'scope',
      'definitionsRevision', 'headsRevision', 'sequenceRevision',
      'definitions', 'heads', 'sequence', 'manifest'
    ]);
    if (envelope.contract !== CONTRACT || envelope.contractVersion !== CONTRACT_VERSION
      || envelope.clientId !== CLIENT_ID) fail(ERROR_CODES.UNSUPPORTED_CONTRACT);
    validateScope(envelope.scope, options);
    const revisions = envelopeRevisions(envelope);
    validateRevisions(revisions, { hasSequence: envelope.sequence !== null });
    if (options.revisions && canonicalize(options.revisions) !== canonicalize(revisions)) {
      fail(ERROR_CODES.INVALID_REVISION);
    }
    const graph = validateDefinitions(envelope.definitions, envelope.scope);
    if (graph.routineIds.size === 0 && graph.programIds.size === 0) fail(ERROR_CODES.MALFORMED_PAYLOAD);
    validateHeads(envelope.heads, graph);
    validateSequence(envelope.sequence, graph, envelope.heads, revisions);
    await validateManifest(envelope.manifest, envelope.definitions);
    return envelope;
  }

  async function validate(envelope, options = {}) {
    try {
      await validateOrThrow(envelope, options);
      return resultOk(envelope);
    } catch (error) {
      if (!(error instanceof ProgramDomainEnvelopeError)) throw error;
      return deepFreeze({ ok: false, reasonCode: error.reasonCode, envelope: null });
    }
  }

  function sourceSemanticValues(programCapture) {
    return ['routines', 'routineVersions', 'programs', 'programVersions', 'activeProgramVersionId', 'sequenceState']
      .filter(key => Object.hasOwn(programCapture, key))
      .map(key => programCapture[key]);
  }

  function assertSourceScope(programCapture, accountId, profileId) {
    for (const key of ['routines', 'routineVersions', 'programs', 'programVersions']) {
      const values = programCapture[key];
      if (!Array.isArray(values)) fail(ERROR_CODES.MALFORMED_PAYLOAD);
      if (values.some(value => !isPlainRecord(value))) fail(ERROR_CODES.MALFORMED_PAYLOAD);
      if (values.some(value => value.accountId !== accountId || value.profileId !== profileId)) {
        fail(ERROR_CODES.PROFILE_SCOPE_MISMATCH);
      }
    }
  }

  function assertNormalizationPreserved(source, normalized) {
    for (const key of ['routines', 'routineVersions', 'programs', 'programVersions']) {
      if (source[key].length !== normalized[key].length) fail(ERROR_CODES.SOURCE_NORMALIZATION_LOSS);
    }
    const normalizedRoutines = new Map(normalized.routines.map(value => [value.routineId, value]));
    source.routines.forEach(value => {
      const current = normalizedRoutines.get(String(value.routineId || '').trim());
      if (!current || current.currentVersionId !== String(value.currentVersionId || '').trim()) {
        fail(ERROR_CODES.INVALID_POINTER);
      }
    });
    const normalizedPrograms = new Map(normalized.programs.map(value => [value.programId, value]));
    source.programs.forEach(value => {
      const current = normalizedPrograms.get(String(value.programId || '').trim());
      const activeVersionId = String(value.activeVersionId || '').trim() || null;
      if (!current || current.status !== value.status
        || current.latestVersionId !== String(value.latestVersionId || '').trim()
        || current.activeVersionId !== activeVersionId) fail(ERROR_CODES.INVALID_POINTER);
    });
    const sourceActive = String(source.activeProgramVersionId || '').trim() || null;
    if (sourceActive !== normalized.activeProgramVersionId) fail(ERROR_CODES.INVALID_POINTER);
    source.programVersions.forEach((value, index) => {
      const goalIds = Array.isArray(value.priorityGoalIds) ? value.priorityGoalIds : [];
      if (goalIds.length !== normalized.programVersions[index].priorityGoalIds.length) {
        fail(ERROR_CODES.SOURCE_NORMALIZATION_LOSS);
      }
      if (Array.isArray(value.policyRefs) && value.policyRefs.length !== 0) fail(ERROR_CODES.SOURCE_NORMALIZATION_LOSS);
    });
    if (source.sequenceState != null && normalized.sequenceState === null) fail(ERROR_CODES.INVALID_SEQUENCE);
  }

  function sorted(values, selector) {
    return [...values].sort((left, right) => compareText(selector(left), selector(right)));
  }

  function partition(normalized, lastTransition) {
    const definitions = {
      routines: sorted(normalized.routines.map(value => ({
        routineId: value.routineId,
        accountId: value.accountId,
        profileId: value.profileId,
        purposeKey: value.purposeKey,
        createdAt: value.createdAt
      })), value => value.routineId),
      routineVersions: sorted(normalized.routineVersions.map(clone), value => value.routineVersionId),
      programs: sorted(normalized.programs.map(value => ({
        programId: value.programId,
        accountId: value.accountId,
        profileId: value.profileId,
        purposeKey: value.purposeKey,
        createdAt: value.createdAt
      })), value => value.programId),
      programVersions: sorted(normalized.programVersions.map(clone), value => value.programVersionId)
    };
    const heads = {
      routines: sorted(normalized.routines.map(value => ({
        routineId: value.routineId,
        currentVersionId: value.currentVersionId
      })), value => value.routineId),
      programs: sorted(normalized.programs.map(value => ({
        programId: value.programId,
        status: value.status,
        latestVersionId: value.latestVersionId,
        activeVersionId: value.activeVersionId,
        updatedAt: value.updatedAt
      })), value => value.programId),
      activeProgramVersionId: normalized.activeProgramVersionId
    };
    const sequence = normalized.sequenceState ? {
      ...clone(normalized.sequenceState),
      lastTransition: lastTransition == null ? null : clone(lastTransition)
    } : null;
    return { definitions, heads, sequence };
  }

  function initialRevisions(parts) {
    const hasDefinitions = parts.definitions.routines.length > 0 || parts.definitions.programs.length > 0;
    return { definitions: hasDefinitions ? 1 : 0, heads: hasDefinitions ? 1 : 0, sequence: parts.sequence ? 1 : 0 };
  }

  async function build({
    accountId,
    profileId,
    programCapture,
    catalog = null,
    revisions = null,
    lastTransition = null,
    normalizeCapture = scope.BigGainsProgramModel?.normalizeCapture
  } = {}) {
    if (!nonempty(accountId) || !nonempty(profileId)) fail(ERROR_CODES.PROFILE_SCOPE_MISMATCH);
    if (programCapture == null) return empty({ accountId, profileId });
    if (!isPlainRecord(programCapture) || programCapture.contract !== CAPTURE_CONTRACT) {
      fail(ERROR_CODES.MALFORMED_PAYLOAD);
    }
    sourceSemanticValues(programCapture).forEach(value => assertCanonicalValue(value));
    assertSourceScope(programCapture, accountId, profileId);
    if (typeof normalizeCapture !== 'function') fail(ERROR_CODES.PROGRAM_MODEL_UNAVAILABLE);
    const normalized = normalizeCapture(programCapture, { accountId, profileId, catalog });
    assertNormalizationPreserved(programCapture, normalized);
    const parts = partition(normalized, lastTransition);
    const defaults = initialRevisions(parts);
    if (defaults.definitions === 0) {
      if (parts.sequence !== null || normalized.activeProgramVersionId !== null) fail(ERROR_CODES.INVALID_SEQUENCE);
      if (revisions) validateRevisions(revisions, { empty: true });
      return empty({ accountId, profileId });
    }
    const selectedRevisions = revisions || defaults;
    validateRevisions(selectedRevisions, { hasSequence: parts.sequence !== null });
    const manifest = await createManifest(parts.definitions);
    const envelope = deepFreeze({
      contract: CONTRACT,
      contractVersion: CONTRACT_VERSION,
      clientId: CLIENT_ID,
      scope: { accountId, profileId },
      definitionsRevision: selectedRevisions.definitions,
      headsRevision: selectedRevisions.heads,
      sequenceRevision: selectedRevisions.sequence,
      definitions: parts.definitions,
      heads: parts.heads,
      sequence: parts.sequence,
      manifest
    });
    await validateOrThrow(envelope, { accountId, profileId, revisions: selectedRevisions });
    return envelope;
  }

  function empty({ accountId, profileId } = {}) {
    if (!nonempty(accountId) || !nonempty(profileId)) fail(ERROR_CODES.PROFILE_SCOPE_MISMATCH);
    return Object.freeze({});
  }

  async function fingerprints(envelope, options = {}) {
    await validateOrThrow(envelope, options);
    const isEmpty = Object.keys(envelope).length === 0;
    const revisions = isEmpty
      ? options.revisions || { definitions: 0, heads: 0, sequence: 0 }
      : envelopeRevisions(envelope);
    let definitions = {};
    let heads = {};
    let sequence = null;
    let aggregateMaterial;
    if (isEmpty) {
      if (!nonempty(options.accountId) || !nonempty(options.profileId)) fail(ERROR_CODES.PROFILE_SCOPE_MISMATCH);
      aggregateMaterial = {
        contract: CONTRACT,
        contractVersion: CONTRACT_VERSION,
        clientId: CLIENT_ID,
        scope: { accountId: options.accountId, profileId: options.profileId },
        payload: {},
        definitionsRevision: revisions.definitions,
        headsRevision: revisions.heads,
        sequenceRevision: revisions.sequence,
        manifest: EMPTY_MANIFEST
      };
    } else {
      ({ definitions, heads, sequence } = envelope);
      aggregateMaterial = envelope;
    }
    const [definitionsFingerprint, headsFingerprint, sequenceFingerprint, fingerprint] = await Promise.all([
      sha256(definitions),
      sha256(heads),
      sha256(sequence),
      sha256(aggregateMaterial)
    ]);
    return deepFreeze({
      fingerprint,
      definitionsFingerprint,
      headsFingerprint,
      definitionsRevision: revisions.definitions,
      headsRevision: revisions.heads,
      sequenceRevision: revisions.sequence,
      sequenceFingerprint,
      manifest: isEmpty ? clone(EMPTY_MANIFEST) : clone(envelope.manifest)
    });
  }

  const api = Object.freeze({
    contract: CONTRACT,
    contractVersion: CONTRACT_VERSION,
    clientId: CLIENT_ID,
    errorCodes: ERROR_CODES,
    build,
    validate,
    canonicalize,
    fingerprints,
    empty
  });
  Object.defineProperty(scope, 'BigGainsProgramDomainEnvelope', {
    configurable: false,
    enumerable: true,
    value: api,
    writable: false
  });
})(typeof window === 'object' ? window : globalThis);
