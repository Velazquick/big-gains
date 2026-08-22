((scope) => {
  'use strict';

  const CONTRACT = 'big-gains.program-capture.v1';
  const STORAGE_MODE = 'local_only';
  const ROUTINE_SOURCE_KINDS = Object.freeze(['existing_custom', 'coded_default', 'reviewed_rebuild']);
  const PROGRAM_STATUSES = Object.freeze(['draft', 'active', 'completed', 'archived']);
  const AUTHORITIES = Object.freeze(['off', 'review']);
  const BOUNDARY_KINDS = Object.freeze(['completed_cycles', 'weeks', 'date']);
  const APPLICATION_TRACE_CONTRACT = 'big-gains.programming-application-trace.v1';
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const validDate = value => (typeof value === 'string' || typeof value === 'number')
    && Number.isFinite(new Date(value).getTime());
  const cleanString = (value, limit = 160) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
  const positiveInteger = (value, fallback = null, maximum = Number.MAX_SAFE_INTEGER) => {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 && number <= maximum ? number : fallback;
  };
  const idString = value => cleanString(value, 200);
  const scopeMatches = (value, accountId, profileId) => value?.accountId === accountId && value?.profileId === profileId;

  function blankCapture() {
    return {
      contract: CONTRACT,
      storageMode: STORAGE_MODE,
      routines: [],
      routineVersions: [],
      programs: [],
      programVersions: [],
      applicationTraces: [],
      activeProgramVersionId: null,
      sequenceState: null
    };
  }

  function parseRepTarget(value) {
    const text = cleanString(isRecord(value) ? value.text : value, 40);
    if (!text) return { kind: 'unspecified', text: '' };
    const exact = text.match(/^(\d+)$/);
    if (exact && Number(exact[1]) > 0) return { kind: 'exact', text, value: Number(exact[1]) };
    const range = text.match(/^(\d+)\s*[-\u2013\u2014]\s*(\d+)$/);
    if (range && Number(range[1]) > 0 && Number(range[1]) <= Number(range[2])) {
      return { kind: 'range', text, min: Number(range[1]), max: Number(range[2]) };
    }
    return { kind: 'text', text };
  }

  function normalizeExercisePrescription(value, catalog = null, sequence = 1) {
    if (!isRecord(value)) return null;
    const canonicalId = catalog?.canonicalIdFor
      ? catalog.canonicalIdFor(value.exerciseId)
      : idString(value.exerciseId);
    if (!canonicalId) return null;
    const workingSets = positiveInteger(value.workingSets, null, 12);
    if (!workingSets) return null;
    const restSeconds = value.restSeconds == null || value.restSeconds === ''
      ? null
      : positiveInteger(value.restSeconds, null, 900);
    if (value.restSeconds != null && value.restSeconds !== '' && !restSeconds) return null;
    return {
      sequence,
      exerciseId: canonicalId,
      workingSets,
      repTarget: parseRepTarget(value.repTarget ?? value.targetReps),
      restSeconds
    };
  }

  function normalizeSource(value) {
    if (!isRecord(value) || !ROUTINE_SOURCE_KINDS.includes(value.kind)) return null;
    const routineType = cleanString(value.routineType, 80);
    if (!routineType) return null;
    const source = { kind: value.kind, routineType };
    const basedOnRoutineVersionId = idString(value.basedOnRoutineVersionId);
    if (basedOnRoutineVersionId) source.basedOnRoutineVersionId = basedOnRoutineVersionId;
    return source;
  }

  function normalizeRoutineVersion(value, accountId, profileId, catalog = null) {
    if (!isRecord(value) || !scopeMatches(value, accountId, profileId)) return null;
    const routineVersionId = idString(value.routineVersionId);
    const routineId = idString(value.routineId);
    const versionNumber = positiveInteger(value.versionNumber);
    const label = cleanString(value.label, 80);
    const source = normalizeSource(value.source);
    if (!routineVersionId || !routineId || !versionNumber || !label || !source
      || !validDate(value.createdAt) || !validDate(value.effectiveAt)
      || value.createdBy !== 'user' || value.approval?.kind !== 'explicit_user'
      || !validDate(value.approval?.approvedAt) || !Array.isArray(value.exercises) || !value.exercises.length) return null;
    const exercises = value.exercises
      .map((entry, index) => normalizeExercisePrescription(entry, catalog, index + 1))
      .filter(Boolean);
    if (exercises.length !== value.exercises.length
      || new Set(exercises.map(entry => entry.exerciseId)).size !== exercises.length) return null;
    return {
      routineVersionId,
      routineId,
      accountId,
      profileId,
      versionNumber,
      predecessorRoutineVersionId: idString(value.predecessorRoutineVersionId) || null,
      label,
      source,
      exercises,
      createdAt: new Date(value.createdAt).toISOString(),
      effectiveAt: new Date(value.effectiveAt).toISOString(),
      createdBy: 'user',
      approval: { kind: 'explicit_user', approvedAt: new Date(value.approval.approvedAt).toISOString() }
    };
  }

  function normalizeRoutine(value, accountId, profileId) {
    if (!isRecord(value) || !scopeMatches(value, accountId, profileId)) return null;
    const routineId = idString(value.routineId);
    const purposeKey = cleanString(value.purposeKey, 80);
    const currentVersionId = idString(value.currentVersionId);
    if (!routineId || !purposeKey || !currentVersionId || !validDate(value.createdAt)) return null;
    return { routineId, accountId, profileId, purposeKey, currentVersionId, createdAt: new Date(value.createdAt).toISOString() };
  }

  function normalizeBoundary(value) {
    if (!isRecord(value) || !BOUNDARY_KINDS.includes(value.boundaryKind) || value.onBoundary !== 'review_required') return null;
    if (value.boundaryKind === 'date') {
      const boundaryValue = cleanString(value.boundaryValue, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(boundaryValue) || !validDate(boundaryValue)) return null;
      return { boundaryKind: 'date', boundaryValue, onBoundary: 'review_required' };
    }
    const boundaryValue = positiveInteger(value.boundaryValue, null, 520);
    return boundaryValue ? { boundaryKind: value.boundaryKind, boundaryValue, onBoundary: 'review_required' } : null;
  }

  function normalizeSlot(value, index = 0) {
    if (!isRecord(value)) return null;
    const slotId = idString(value.slotId);
    const routineId = idString(value.routineId);
    const routineVersionId = idString(value.routineVersionId);
    const label = cleanString(value.label, 80);
    const anchor = value.preferredCalendarAnchor == null
      ? null
      : Number.isInteger(Number(value.preferredCalendarAnchor?.weekday))
        && Number(value.preferredCalendarAnchor.weekday) >= 0
        && Number(value.preferredCalendarAnchor.weekday) <= 6
        ? { weekday: Number(value.preferredCalendarAnchor.weekday) }
        : undefined;
    if (!slotId || !routineId || !routineVersionId || !label || anchor === undefined) return null;
    return { slotId, sequence: index + 1, label, preferredCalendarAnchor: anchor, routineId, routineVersionId };
  }

  function normalizeProgramVersion(value, accountId, profileId) {
    if (!isRecord(value) || !scopeMatches(value, accountId, profileId)) return null;
    const programVersionId = idString(value.programVersionId);
    const programId = idString(value.programId);
    const versionNumber = positiveInteger(value.versionNumber);
    const name = cleanString(value.name, 100);
    const startsOn = cleanString(value.duration?.startsOn, 10);
    const blockReviewPolicy = normalizeBoundary(value.blockReviewPolicy);
    const programmingAuthority = AUTHORITIES.includes(value.programmingAuthority) ? value.programmingAuthority : null;
    const activeWorkoutIdAtAcceptance = idString(value.effectiveBoundary?.activeWorkoutIdAtAcceptance) || null;
    if (!programVersionId || !programId || !versionNumber || !name
      || value.scheduleMode !== 'rolling_cycle'
      || value.cadencePolicy?.kind !== 'rolling_cycle'
      || value.cadencePolicy?.advanceOn !== 'completed_session'
      || value.duration?.mode !== 'rolling' || !/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !validDate(startsOn)
      || value.duration?.endsOn != null || !blockReviewPolicy || !programmingAuthority
      || value.effectiveBoundary?.kind !== 'next_unmaterialized_session'
      || !validDate(value.createdAt) || value.createdBy !== 'user'
      || !Array.isArray(value.slots) || !value.slots.length) return null;
    const slots = value.slots.map(normalizeSlot).filter(Boolean);
    if (slots.length !== value.slots.length || new Set(slots.map(slot => slot.slotId)).size !== slots.length) return null;
    return {
      programVersionId,
      programId,
      accountId,
      profileId,
      versionNumber,
      predecessorProgramVersionId: idString(value.predecessorProgramVersionId) || null,
      name,
      scheduleMode: 'rolling_cycle',
      cadencePolicy: { kind: 'rolling_cycle', advanceOn: 'completed_session' },
      duration: { mode: 'rolling', startsOn, endsOn: null },
      slots,
      blockReviewPolicy,
      programmingAuthority,
      priorityGoalIds: Array.isArray(value.priorityGoalIds) ? [...new Set(value.priorityGoalIds.map(idString).filter(Boolean))] : [],
      policyRefs: [],
      effectiveBoundary: { kind: 'next_unmaterialized_session', activeWorkoutIdAtAcceptance },
      createdAt: new Date(value.createdAt).toISOString(),
      createdBy: 'user',
      versionNote: cleanString(value.versionNote, 300)
    };
  }

  function normalizeProgram(value, accountId, profileId) {
    if (!isRecord(value) || !scopeMatches(value, accountId, profileId) || !PROGRAM_STATUSES.includes(value.status)) return null;
    const programId = idString(value.programId);
    const purposeKey = cleanString(value.purposeKey, 80);
    const latestVersionId = idString(value.latestVersionId);
    const activeVersionId = idString(value.activeVersionId) || null;
    if (!programId || !purposeKey || !latestVersionId || !validDate(value.createdAt) || !validDate(value.updatedAt)) return null;
    return {
      programId, accountId, profileId, purposeKey, status: value.status,
      latestVersionId, activeVersionId,
      createdAt: new Date(value.createdAt).toISOString(), updatedAt: new Date(value.updatedAt).toISOString()
    };
  }

  function normalizeApplicationTrace(value, accountId, profileId) {
    if (!isRecord(value) || value.contract !== APPLICATION_TRACE_CONTRACT
      || !scopeMatches(value, accountId, profileId) || value.disposition !== 'approved'
      || !validDate(value.appliedAt)) return null;
    const applicationId = idString(value.applicationId);
    const proposalId = idString(value.proposalId);
    const inputDigest = idString(value.inputDigest);
    const goalId = idString(value.goalId);
    const exerciseId = idString(value.exerciseId);
    const baseProgramVersionId = idString(value.baseProgramVersionId);
    const newProgramVersionId = idString(value.newProgramVersionId);
    const boundary = value.futureEffectiveBoundary;
    const allocation = Array.isArray(value.allocation)
      ? value.allocation.map(Number).filter(number => Number.isInteger(number) && number > 0)
      : [];
    const transitions = (Array.isArray(value.routineVersionTransitions) ? value.routineVersionTransitions : [])
      .map(item => isRecord(item) ? {
        baseRoutineVersionId: idString(item.baseRoutineVersionId),
        newRoutineVersionId: idString(item.newRoutineVersionId),
        routineId: idString(item.routineId)
      } : null)
      .filter(item => item?.baseRoutineVersionId && item.newRoutineVersionId && item.routineId);
    if (!applicationId || !proposalId || !inputDigest || !goalId || !exerciseId
      || !baseProgramVersionId || !newProgramVersionId || !allocation.length || !transitions.length
      || !isRecord(boundary) || boundary.kind !== 'next_unmaterialized_session'
      || !Number.isInteger(Number(boundary.baseNextSlotIndex)) || Number(boundary.baseNextSlotIndex) < 0
      || !Number.isInteger(Number(boundary.successorNextSlotIndex)) || Number(boundary.successorNextSlotIndex) < 0
      || !Number.isInteger(Number(boundary.completedCycles)) || Number(boundary.completedCycles) < 0) return null;
    return {
      contract: APPLICATION_TRACE_CONTRACT,
      applicationId,
      proposalId,
      inputDigest,
      accountId,
      profileId,
      goalId,
      exerciseId,
      baseProgramVersionId,
      newProgramVersionId,
      routineVersionTransitions: transitions,
      beforeExposureCount: Number(value.beforeExposureCount),
      afterExposureCount: Number(value.afterExposureCount),
      totalCycleWorkingSetsBefore: Number(value.totalCycleWorkingSetsBefore),
      totalCycleWorkingSetsAfter: Number(value.totalCycleWorkingSetsAfter),
      allocation,
      reasonCodes: Array.isArray(value.reasonCodes) ? value.reasonCodes.map(idString).filter(Boolean) : [],
      operations: Array.isArray(value.operations) ? clone(value.operations) : [],
      contractVersion: idString(value.contractVersion),
      enginePolicyVersion: idString(value.enginePolicyVersion),
      capabilityVersion: idString(value.capabilityVersion),
      appliedAt: new Date(value.appliedAt).toISOString(),
      disposition: 'approved',
      futureEffectiveBoundary: {
        kind: 'next_unmaterialized_session',
        activeWorkoutIdAtAcceptance: idString(boundary.activeWorkoutIdAtAcceptance) || null,
        baseNextSlotIndex: Number(boundary.baseNextSlotIndex),
        successorNextSlotIndex: Number(boundary.successorNextSlotIndex),
        completedCycles: Number(boundary.completedCycles),
        activeProgramOriginCompletionPending: boundary.activeProgramOriginCompletionPending === true
      }
    };
  }

  function normalizeCapture(value, { accountId, profileId, catalog = null } = {}) {
    const empty = blankCapture();
    if (!accountId || !profileId || !isRecord(value) || value.contract !== CONTRACT) return empty;
    const routineVersions = (Array.isArray(value.routineVersions) ? value.routineVersions : [])
      .map(entry => normalizeRoutineVersion(entry, accountId, profileId, catalog)).filter(Boolean);
    const versionIds = new Set(routineVersions.map(entry => entry.routineVersionId));
    const routines = (Array.isArray(value.routines) ? value.routines : [])
      .map(entry => normalizeRoutine(entry, accountId, profileId))
      .filter(entry => entry && versionIds.has(entry.currentVersionId)
        && routineVersions.some(version => version.routineVersionId === entry.currentVersionId && version.routineId === entry.routineId));
    const routineIds = new Set(routines.map(entry => entry.routineId));
    const programVersions = (Array.isArray(value.programVersions) ? value.programVersions : [])
      .map(entry => normalizeProgramVersion(entry, accountId, profileId))
      .filter(entry => entry && entry.slots.every(slot => routineIds.has(slot.routineId)
        && routineVersions.some(version => version.routineVersionId === slot.routineVersionId && version.routineId === slot.routineId)));
    const programVersionIds = new Set(programVersions.map(entry => entry.programVersionId));
    let programs = (Array.isArray(value.programs) ? value.programs : [])
      .map(entry => normalizeProgram(entry, accountId, profileId))
      .filter(entry => entry && programVersionIds.has(entry.latestVersionId)
        && (!entry.activeVersionId || programVersionIds.has(entry.activeVersionId)));
    let activeProgramVersionId = idString(value.activeProgramVersionId) || null;
    if (!activeProgramVersionId || !programVersionIds.has(activeProgramVersionId)) activeProgramVersionId = null;
    let foundActive = false;
    programs = programs.map(program => {
      const isActive = activeProgramVersionId && program.activeVersionId === activeProgramVersionId && !foundActive;
      if (isActive) foundActive = true;
      if (isActive) return { ...program, status: 'active' };
      if (program.status === 'active') return { ...program, status: 'archived', activeVersionId: null };
      return program;
    });
    if (!foundActive) activeProgramVersionId = null;
    const activeVersion = programVersions.find(version => version.programVersionId === activeProgramVersionId);
    const rawSequence = value.sequenceState;
    const applicationTraces = (Array.isArray(value.applicationTraces) ? value.applicationTraces : [])
      .map(entry => normalizeApplicationTrace(entry, accountId, profileId)).filter(Boolean)
      .filter((entry, index, all) => all.findIndex(candidate => candidate.applicationId === entry.applicationId) === index);
    const sequenceState = activeVersion && isRecord(rawSequence)
      && rawSequence.programId === activeVersion.programId
      && rawSequence.programVersionId === activeVersion.programVersionId
      && Number.isInteger(Number(rawSequence.nextSlotIndex))
      && Number(rawSequence.nextSlotIndex) >= 0
      && Number(rawSequence.nextSlotIndex) < activeVersion.slots.length
      && Number.isInteger(Number(rawSequence.completedCycles))
      && Number(rawSequence.completedCycles) >= 0
      && validDate(rawSequence.updatedAt)
      ? {
        programId: activeVersion.programId,
        programVersionId: activeVersion.programVersionId,
        nextSlotIndex: Number(rawSequence.nextSlotIndex),
        completedCycles: Number(rawSequence.completedCycles),
        updatedAt: new Date(rawSequence.updatedAt).toISOString()
      }
      : activeVersion ? {
        programId: activeVersion.programId,
        programVersionId: activeVersion.programVersionId,
        nextSlotIndex: 0,
        completedCycles: 0,
        updatedAt: activeVersion.createdAt
      } : null;
    return { ...empty, routines, routineVersions, programs, programVersions, applicationTraces, activeProgramVersionId, sequenceState };
  }

  function sameRoutineContent(left, right) {
    if (!left) return false;
    return JSON.stringify({ label: left.label, source: left.source, exercises: left.exercises })
      === JSON.stringify({ label: right.label, source: right.source, exercises: right.exercises });
  }

  function approveRoutine({ capture, accountId, profileId, purposeKey, label, source, exercises, catalog, createId, now = () => new Date().toISOString() }) {
    if (!accountId || !profileId || !cleanString(purposeKey, 80) || !cleanString(label, 80)
      || typeof createId !== 'function' || !catalog?.canonicalIdFor) throw new TypeError('Routine approval requires profile scope, identity, label, catalog, and ID creation.');
    const normalizedSource = normalizeSource(source);
    if (!normalizedSource) throw new Error('Choose a valid routine source before approval.');
    if (!Array.isArray(exercises) || !exercises.length) throw new Error('An approved routine needs at least one exercise.');
    const normalizedExercises = exercises.map((entry, index) => normalizeExercisePrescription(entry, catalog, index + 1));
    if (normalizedExercises.some(entry => !entry)
      || new Set(normalizedExercises.map(entry => entry.exerciseId)).size !== normalizedExercises.length) {
      throw new Error('Routine exercises must use unique canonical EKF identities and valid prescriptions.');
    }
    const working = normalizeCapture(capture, { accountId, profileId, catalog });
    const approvedAt = new Date(now()).toISOString();
    let routine = working.routines.find(entry => entry.purposeKey === purposeKey);
    const routineId = routine?.routineId || idString(createId());
    const predecessor = routine ? working.routineVersions.find(version => version.routineVersionId === routine.currentVersionId) : null;
    const candidate = {
      routineVersionId: '', routineId, accountId, profileId,
      versionNumber: predecessor ? predecessor.versionNumber + 1 : 1,
      predecessorRoutineVersionId: predecessor?.routineVersionId || null,
      label: cleanString(label, 80), source: normalizedSource, exercises: normalizedExercises,
      createdAt: approvedAt, effectiveAt: approvedAt, createdBy: 'user',
      approval: { kind: 'explicit_user', approvedAt }
    };
    if (sameRoutineContent(predecessor, candidate)) return { capture: working, version: clone(predecessor), created: false };
    candidate.routineVersionId = idString(createId());
    const nextRoutine = routine
      ? { ...routine, currentVersionId: candidate.routineVersionId }
      : { routineId, accountId, profileId, purposeKey: cleanString(purposeKey, 80), currentVersionId: candidate.routineVersionId, createdAt: approvedAt };
    return {
      capture: {
        ...working,
        routines: [...working.routines.filter(entry => entry.routineId !== routineId), nextRoutine],
        routineVersions: [...working.routineVersions, candidate]
      },
      version: clone(candidate),
      created: true
    };
  }

  function createProgramDraft({ capture, accountId, profileId, purposeKey, name, slots, blockReviewPolicy, programmingAuthority, priorityGoalIds = [], startsOn, activeWorkoutId = null, versionNote = '', createId, now = () => new Date().toISOString() }) {
    if (!AUTHORITIES.includes(programmingAuthority)) throw new Error('Program-1A permits programming authority Off or Review only.');
    if (!accountId || !profileId || !cleanString(purposeKey, 80) || !cleanString(name, 100)
      || typeof createId !== 'function') throw new TypeError('Program creation requires profile scope, identity, name, and ID creation.');
    const working = normalizeCapture(capture, { accountId, profileId });
    const boundary = normalizeBoundary({ ...blockReviewPolicy, onBoundary: 'review_required' });
    if (!boundary) throw new Error('Choose a valid block review boundary.');
    const startDate = cleanString(startsOn, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !validDate(startDate)) throw new Error('Choose a valid Program start date.');
    if (!Array.isArray(slots) || !slots.length) throw new Error('A Program needs at least one ordered session slot.');
    const createdAt = new Date(now()).toISOString();
    let program = working.programs.find(entry => entry.purposeKey === purposeKey);
    const programId = program?.programId || idString(createId());
    const predecessor = program ? working.programVersions.find(version => version.programVersionId === program.latestVersionId) : null;
    const normalizedSlots = slots.map((slot, index) => normalizeSlot({
      ...slot,
      slotId: idString(slot.slotId) || idString(createId()),
      sequence: index + 1
    }, index));
    if (normalizedSlots.some(slot => !slot)) throw new Error('Program slots are invalid.');
    normalizedSlots.forEach(slot => {
      const routineVersion = working.routineVersions.find(version => version.routineVersionId === slot.routineVersionId);
      if (!routineVersion || routineVersion.routineId !== slot.routineId || !scopeMatches(routineVersion, accountId, profileId)) {
        throw new Error('Every Program slot must pin an approved Routine version from the same profile.');
      }
    });
    const version = {
      programVersionId: idString(createId()), programId, accountId, profileId,
      versionNumber: predecessor ? predecessor.versionNumber + 1 : 1,
      predecessorProgramVersionId: predecessor?.programVersionId || null,
      name: cleanString(name, 100), scheduleMode: 'rolling_cycle',
      cadencePolicy: { kind: 'rolling_cycle', advanceOn: 'completed_session' },
      duration: { mode: 'rolling', startsOn: startDate, endsOn: null },
      slots: normalizedSlots,
      blockReviewPolicy: boundary,
      programmingAuthority,
      priorityGoalIds: [...new Set(priorityGoalIds.map(idString).filter(Boolean))],
      policyRefs: [],
      effectiveBoundary: { kind: 'next_unmaterialized_session', activeWorkoutIdAtAcceptance: idString(activeWorkoutId) || null },
      createdAt, createdBy: 'user', versionNote: cleanString(versionNote, 300)
    };
    const nextProgram = program
      ? { ...program, latestVersionId: version.programVersionId, updatedAt: createdAt }
      : {
        programId, accountId, profileId, purposeKey: cleanString(purposeKey, 80), status: 'draft',
        latestVersionId: version.programVersionId, activeVersionId: null, createdAt, updatedAt: createdAt
      };
    return {
      capture: {
        ...working,
        programs: [...working.programs.filter(entry => entry.programId !== programId), nextProgram],
        programVersions: [...working.programVersions, version]
      },
      version: clone(version)
    };
  }

  function activateProgram({ capture, accountId, profileId, programVersionId, now = () => new Date().toISOString() }) {
    const working = normalizeCapture(capture, { accountId, profileId });
    const version = working.programVersions.find(entry => entry.programVersionId === programVersionId);
    if (!version) throw new Error('The Program version is unavailable for this profile.');
    const activatedAt = new Date(now()).toISOString();
    const programs = working.programs.map(program => {
      if (program.programId === version.programId) {
        return { ...program, status: 'active', activeVersionId: version.programVersionId, updatedAt: activatedAt };
      }
      if (program.status === 'active') return { ...program, status: 'archived', activeVersionId: null, updatedAt: activatedAt };
      return program;
    });
    return {
      ...working,
      programs,
      activeProgramVersionId: version.programVersionId,
      sequenceState: {
        programId: version.programId,
        programVersionId: version.programVersionId,
        nextSlotIndex: 0,
        completedCycles: 0,
        updatedAt: activatedAt
      }
    };
  }

  function advanceSequence(sequenceState, programVersion, now = () => new Date().toISOString()) {
    if (!isRecord(sequenceState) || !isRecord(programVersion)
      || sequenceState.programId !== programVersion.programId
      || sequenceState.programVersionId !== programVersion.programVersionId
      || !Array.isArray(programVersion.slots) || !programVersion.slots.length
      || !Number.isInteger(Number(sequenceState.nextSlotIndex))
      || Number(sequenceState.nextSlotIndex) < 0
      || Number(sequenceState.nextSlotIndex) >= programVersion.slots.length) {
      throw new Error('Sequence advancement requires a matching active Program version and stable position.');
    }
    const nextSlotIndex = (Number(sequenceState.nextSlotIndex) + 1) % programVersion.slots.length;
    return {
      programId: programVersion.programId,
      programVersionId: programVersion.programVersionId,
      nextSlotIndex,
      completedCycles: Number(sequenceState.completedCycles || 0) + (nextSlotIndex === 0 ? 1 : 0),
      updatedAt: new Date(now()).toISOString()
    };
  }

  const api = Object.freeze({
    contract: CONTRACT,
    storageMode: STORAGE_MODE,
    routineSourceKinds: ROUTINE_SOURCE_KINDS,
    programStatuses: PROGRAM_STATUSES,
    authorities: AUTHORITIES,
    boundaryKinds: BOUNDARY_KINDS,
    applicationTraceContract: APPLICATION_TRACE_CONTRACT,
    blankCapture,
    parseRepTarget,
    normalizeCapture,
    approveRoutine,
    createProgramDraft,
    activateProgram,
    advanceSequence
  });
  Object.defineProperty(scope, 'BigGainsProgramModel', { configurable: false, enumerable: true, value: api, writable: false });
})(typeof window === 'object' ? window : globalThis);
