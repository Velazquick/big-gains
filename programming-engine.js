((scope) => {
  'use strict';

  const CONTRACT_VERSION = 'big-gains.programming-engine.v1';
  const ENGINE_POLICY_VERSION = 'pe-strength-rules.v1.0.0';
  const CAPABILITY_VERSION = 'pe-1a-volume-neutral-exposure-redistribution.v1.0.0';
  const ANALYZER_CONTRACT = 'big-gains.program-analysis.v1';
  const PERFORMANCE_CONTRACT = 'big-gains.program-performance-evidence.v1';
  const GOALS_EVIDENCE_CONTRACT = 'big-gains.goals-progression-evidence.v1';
  const PROPOSAL_TYPE = 'redistribute_exact_exercise_exposure';
  const EFFECTIVE_BOUNDARY = 'next_unmaterialized_session_or_later';
  const POLICY = Object.freeze({
    stallComparableExposureCount: 4,
    minimumCompletedCycles: 2,
    postGoalsAdjustmentComparableOpportunities: 2,
    enabledExposureDeltas: Object.freeze([1]),
    minimumWorkingSetsPerExposure: 1,
    allocation: Object.freeze({
      method: 'balanced_integer_earliest_remainder',
      order: 'authoritative_rolling_program_order',
      version: 1
    })
  });
  const PROGRESS_REASONS = new Set(['ADD_REPS', 'ADD_LOAD_RESET_REPS']);
  const LOCAL_ADJUSTMENT_REASON = 'ADJUST_REPEATED_MISS';
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const list = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === 'string' ? value.trim() : '';
  const iso = value => {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
  };
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (!isRecord(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined && typeof value[key] !== 'function')
      .map(key => [key, stableValue(value[key])]));
  }

  function stableStringify(value) {
    return JSON.stringify(stableValue(value));
  }

  function digest(value) {
    const source = stableStringify(value);
    let hash = 0x811c9dc5;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return `fnv1a32:${hash.toString(16).padStart(8, '0')}`;
  }

  function orderedUnique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function traceEntry(trace, gate, outcome, reasonCode, details = null) {
    trace.push({ sequence: trace.length + 1, gate, outcome, reasonCode, details });
  }

  function pinsFor(programVersion) {
    return list(programVersion?.slots).map(slot => ({
      slotId: text(slot?.slotId),
      routineId: text(slot?.routineId),
      routineVersionId: text(slot?.routineVersionId)
    }));
  }

  function catalogDefinition(catalog, exerciseId) {
    if (!catalog || typeof catalog.canonicalIdFor !== 'function' || typeof catalog.getById !== 'function') return null;
    return catalog.canonicalIdFor(exerciseId) === exerciseId ? catalog.getById(exerciseId) : null;
  }

  function normalizedDigestInput(input, goal, definition) {
    return {
      contractVersion: CONTRACT_VERSION,
      enginePolicyVersion: ENGINE_POLICY_VERSION,
      capabilityVersion: CAPABILITY_VERSION,
      programVersion: clone(input.programVersion),
      routineVersions: clone(input.routineVersions),
      programAnalysis: clone(input.programAnalysis),
      goals: clone(input.goals),
      performanceEvidence: clone(input.performanceEvidence),
      goalProgressionEvidence: clone(input.goalProgressionEvidence),
      exactCatalogIdentity: definition ? {
        canonicalId: definition.canonicalId || goal?.exerciseId || null,
        contentRevision: definition.contentRevision ?? null,
        measurement: definition.measurement || null,
        analytics: definition.analytics || null
      } : null,
      options: clone(input.options || {})
    };
  }

  function baseEnvelope(input, goal, definition) {
    const programVersion = isRecord(input.programVersion) ? input.programVersion : null;
    const performance = isRecord(input.performanceEvidence) ? input.performanceEvidence : {};
    const options = isRecord(input.options) ? input.options : {};
    const normalized = normalizedDigestInput(input, goal, definition);
    const inputDigest = digest(normalized);
    const baseRoutinePins = pinsFor(programVersion);
    const evaluatedAt = iso(options.evaluatedAt || performance.evidenceCutoff || programVersion?.createdAt);
    const evidenceCutoff = iso(performance.evidenceCutoff);
    return {
      contractVersion: CONTRACT_VERSION,
      enginePolicyVersion: ENGINE_POLICY_VERSION,
      capabilityVersion: CAPABILITY_VERSION,
      evaluationId: `pe-evaluation-${inputDigest.split(':')[1]}`,
      inputDigest,
      profileScope: {
        accountId: text(programVersion?.accountId) || null,
        profileId: text(programVersion?.profileId) || null
      },
      evaluatedAt,
      evidenceCutoff,
      baseProgramVersionId: text(programVersion?.programVersionId) || null,
      baseRoutineVersionIds: baseRoutinePins.map(pin => pin.routineVersionId),
      baseRoutinePins,
      targetScope: goal ? {
        goalId: text(goal.goalId) || null,
        exerciseId: text(goal.exerciseId) || null,
        exerciseName: definition?.name || goal.label || null,
        slotIds: []
      } : null,
      effectiveBoundary: EFFECTIVE_BOUNDARY
    };
  }

  function staleGuard(envelope, input, goal) {
    return {
      expectedProgramVersionId: envelope.baseProgramVersionId,
      expectedProgramVersionNumber: Number(input.programVersion?.versionNumber) || null,
      expectedRoutinePins: clone(envelope.baseRoutinePins),
      expectedGoal: goal ? {
        goalId: text(goal.goalId),
        exerciseId: text(goal.exerciseId),
        status: goal.status,
        updatedAt: iso(goal.updatedAt)
      } : null,
      analyzerContract: input.programAnalysis?.contract || null,
      analyzerDigest: isRecord(input.programAnalysis) ? digest(input.programAnalysis) : null,
      evidenceCutoff: envelope.evidenceCutoff,
      evidenceDigest: isRecord(input.performanceEvidence) ? digest(input.performanceEvidence) : null,
      inputDigest: envelope.inputDigest
    };
  }

  function finalResult({ input, goal = null, definition = null, status, primaryReasonCode, reasonCodes = [], trace = [], evidence = {}, availability, explanation, proposal = null, noChangeRule = null, futureReviewTrigger = null, resolutionAction = null }) {
    const envelope = baseEnvelope(input, goal, definition);
    const allReasons = orderedUnique([primaryReasonCode, ...reasonCodes]);
    const result = {
      ...envelope,
      status,
      primaryReasonCode,
      reasonCodes: allReasons,
      reasonTrace: trace,
      evidence,
      availability: availability || {
        state: status === 'unavailable' ? 'unavailable' : 'available',
        failedGates: status === 'unavailable' ? [primaryReasonCode] : [],
        resolutionAction
      },
      staleBaseGuard: staleGuard(envelope, input, goal),
      proposalType: proposal ? PROPOSAL_TYPE : null,
      operations: proposal ? proposal.operations : [],
      approval: proposal ? { userApprovalRequired: true, authorityCeiling: 'review', applicationAvailable: false }
        : { userApprovalRequired: false, authorityCeiling: 'review', applicationAvailable: false },
      explanation,
      noChangeRule,
      futureReviewTrigger,
      resolutionAction,
      ...(proposal || {})
    };
    return deepFreeze(result);
  }

  function unavailable(input, code, trace, details = {}) {
    traceEntry(trace, details.gate || 'availability', 'failed', code, details.traceDetails || null);
    return finalResult({
      input,
      goal: details.goal || null,
      definition: details.definition || null,
      status: 'unavailable',
      primaryReasonCode: code,
      reasonCodes: details.reasonCodes || [],
      trace,
      evidence: details.evidence || { facts: [], refs: [], excluded: [] },
      availability: {
        state: 'unavailable',
        failedGates: orderedUnique([code, ...(details.failedGates || [])]),
        missingOrIncompatibleInputs: details.missingOrIncompatibleInputs || [],
        resolutionAction: details.resolutionAction || null
      },
      resolutionAction: details.resolutionAction || null,
      explanation: {
        summary: details.summary || 'Programming review is unavailable because a required deterministic gate did not pass.',
        affectedGoal: details.goal ? { goalId: details.goal.goalId, exerciseId: details.goal.exerciseId, name: details.definition?.name || null } : null,
        exactChange: null,
        why: details.why || [code],
        evidenceUsed: details.evidenceUsed || [],
        expectedEffect: null,
        diffLabels: [],
        caveats: ['No Program, Routine, active workout, or completed History facts were changed.'],
        reasonCodeReferences: orderedUnique([code, ...(details.reasonCodes || [])])
      }
    });
  }

  function noChange(input, code, trace, details = {}) {
    traceEntry(trace, details.gate || 'decision', 'retained', code, details.traceDetails || null);
    const reasons = orderedUnique([code, ...(details.reasonCodes || [])]);
    return finalResult({
      input,
      goal: details.goal || null,
      definition: details.definition || null,
      status: 'no_change',
      primaryReasonCode: code,
      reasonCodes: reasons,
      trace,
      evidence: details.evidence || { facts: [], refs: [], excluded: [] },
      noChangeRule: details.noChangeRule || code,
      futureReviewTrigger: details.futureReviewTrigger || 'Re-evaluate after a fresh completed comparable exact-exercise exposure.',
      explanation: {
        summary: details.summary || 'The current Program remains unchanged under the evaluated rule.',
        affectedGoal: details.goal ? { goalId: details.goal.goalId, exerciseId: details.goal.exerciseId, name: details.definition?.name || null } : null,
        exactChange: 'No structural change.',
        why: details.why || reasons,
        evidenceUsed: details.evidenceUsed || [],
        expectedEffect: 'The current Program and Routine versions continue unchanged.',
        diffLabels: ['Before: current Program', 'After: current Program'],
        caveats: ['Deadline distance does not change the prescription.', 'Active workouts and completed History remain untouched.'],
        reasonCodeReferences: reasons
      }
    });
  }

  function validateBase(input, trace) {
    const program = input.programVersion;
    if (!isRecord(program) || !text(program.programVersionId) || !text(program.programId)
      || !text(program.accountId) || !text(program.profileId) || !Array.isArray(program.slots) || !program.slots.length) {
      return { code: 'INVALID_BASE_PROGRAM', missing: ['programVersion'] };
    }
    if (program.scheduleMode !== 'rolling_cycle' || program.cadencePolicy?.kind !== 'rolling_cycle'
      || program.cadencePolicy?.advanceOn !== 'completed_session') {
      return { code: 'PROGRAM_STRUCTURE_INCOMPATIBLE', missing: ['programVersion.cadencePolicy'] };
    }
    if (!['off', 'review'].includes(program.programmingAuthority)) {
      return { code: program.programmingAuthority === 'auto' ? 'AUTO_AUTHORITY_OUT_OF_SCOPE' : 'INVALID_BASE_PROGRAM', missing: ['programVersion.programmingAuthority'] };
    }
    const routines = list(input.routineVersions);
    const byId = new Map(routines.map(routine => [text(routine?.routineVersionId), routine]));
    const slotIds = new Set();
    for (const [index, slot] of program.slots.entries()) {
      if (!isRecord(slot) || !text(slot.slotId) || slotIds.has(slot.slotId) || Number(slot.sequence) !== index + 1) {
        return { code: 'PROGRAM_STRUCTURE_INCOMPATIBLE', missing: [`programVersion.slots[${index}]`] };
      }
      slotIds.add(slot.slotId);
      const routine = byId.get(text(slot.routineVersionId));
      if (!routine || routine.routineId !== slot.routineId) return { code: 'MISSING_ROUTINE_PIN', missing: [slot.routineVersionId || `slot:${slot.slotId}`] };
      if (routine.accountId !== program.accountId || routine.profileId !== program.profileId) return { code: 'PROFILE_SCOPE_MISMATCH', missing: [routine.routineVersionId] };
      if (!Array.isArray(routine.exercises) || !routine.exercises.length) return { code: 'MISSING_ROUTINE_PIN', missing: [routine.routineVersionId] };
    }
    traceEntry(trace, 'base_program_and_routine_pins', 'passed', 'BASE_VERSION_PINS_VALID', {
      programVersionId: program.programVersionId,
      routinePins: pinsFor(program)
    });
    return { byId };
  }

  function selectGoal(input, trace) {
    const program = input.programVersion;
    const goalId = text(input.options?.goalId);
    const linked = list(input.goals).filter(goal => isRecord(goal) && list(program.priorityGoalIds).includes(goal.goalId));
    const candidates = goalId ? linked.filter(goal => goal.goalId === goalId) : linked.filter(goal => goal.status === 'active');
    if (candidates.length > 1) return { code: 'GOAL_PRIORITY_CONFLICT' };
    const goal = candidates[0] || null;
    if (!goal || goal.status !== 'active' || !list(program.priorityGoalIds).includes(goal.goalId)) {
      return { code: 'GOAL_NOT_LINKED_OR_INACTIVE', goal };
    }
    if (goal.accountId !== program.accountId || goal.profileId !== program.profileId) return { code: 'PROFILE_SCOPE_MISMATCH', goal };
    const definition = catalogDefinition(input.catalog, goal.exerciseId);
    if (!definition || definition.canonicalId !== goal.exerciseId) return { code: 'INCOMPATIBLE_EVIDENCE_IDENTITY', goal };
    const measurement = definition.measurement || {};
    const analytics = definition.analytics || measurement.analytics || {};
    if (goal.metric !== 'one_rep_max' || goal.unit !== measurement.ui?.loadUnit
      || goal.targetBasis !== analytics.e1rmLoadBasis || analytics.e1rmPermitted !== true) {
      return { code: 'INCOMPATIBLE_EVIDENCE_IDENTITY', goal };
    }
    traceEntry(trace, 'exact_active_linked_goal', 'passed', 'EXACT_GOAL_SCOPE_VALID', {
      goalId: goal.goalId,
      exerciseId: goal.exerciseId,
      contentRevision: definition.contentRevision ?? null
    });
    return { goal, definition };
  }

  function occurrencesFor(program, routineById, exerciseId) {
    return program.slots.flatMap((slot, index) => {
      const routine = routineById.get(slot.routineVersionId);
      const prescription = list(routine?.exercises).find(exercise => exercise.exerciseId === exerciseId);
      return prescription ? [{
        slotId: slot.slotId,
        position: index + 1,
        routineId: slot.routineId,
        routineVersionId: slot.routineVersionId,
        workingSets: Number(prescription.workingSets),
        prescription
      }] : [];
    });
  }

  function validateAnalysis(input, routineById, goal, trace) {
    const analysis = input.programAnalysis;
    if (!isRecord(analysis) || analysis.contract !== ANALYZER_CONTRACT || analysis.status !== 'available') {
      return { code: 'ANALYZER_UNAVAILABLE' };
    }
    if (analysis.programVersionId !== input.programVersion.programVersionId) return { code: 'ANALYZER_STALE' };
    const expectedPins = pinsFor(input.programVersion);
    const analyzedPins = list(analysis.topology?.rollingSequence).map(slot => ({ slotId: slot.slotId, routineVersionId: slot.routineVersionId }));
    if (stableStringify(expectedPins.map(({ slotId, routineVersionId }) => ({ slotId, routineVersionId }))) !== stableStringify(analyzedPins)) {
      return { code: 'ANALYZER_STALE' };
    }
    const occurrences = occurrencesFor(input.programVersion, routineById, goal.exerciseId);
    const fact = list(analysis.exerciseExposure).find(exercise => exercise.exerciseId === goal.exerciseId);
    if (!fact && occurrences.length) return { code: 'ANALYZER_STALE' };
    if (!occurrences.length) return { code: 'GOAL_NOT_REPRESENTED', occurrences: [] };
    const factual = {
      exposures: Number(fact?.exposuresPerCycle),
      sets: Number(fact?.workingSetsPerCycle),
      slots: list(fact?.slots).map(slot => ({ slotId: slot.slotId, routineVersionId: slot.routineVersionId, workingSets: Number(slot.workingSets) }))
    };
    const recomputed = {
      exposures: occurrences.length,
      sets: occurrences.reduce((sum, occurrence) => sum + occurrence.workingSets, 0),
      slots: occurrences.map(occurrence => ({ slotId: occurrence.slotId, routineVersionId: occurrence.routineVersionId, workingSets: occurrence.workingSets }))
    };
    if (stableStringify(factual) !== stableStringify(recomputed)) return { code: 'ANALYZER_STALE' };
    traceEntry(trace, 'analyzer_freshness', 'passed', 'ANALYZER_EXACT_FACTS_MATCH_BASE', recomputed);
    return { occurrences, fact, totalSets: recomputed.sets };
  }

  function staleMismatch(input) {
    const current = input.options?.currentBase;
    if (!isRecord(current)) return [];
    const expectedPins = pinsFor(input.programVersion).map(pin => ({ slotId: pin.slotId, routineVersionId: pin.routineVersionId }));
    const suppliedPins = list(current.routinePins).map(pin => ({ slotId: text(pin?.slotId), routineVersionId: text(pin?.routineVersionId) }));
    const mismatches = [];
    if (current.programVersionId !== input.programVersion.programVersionId) mismatches.push('programVersionId');
    if (current.goalId != null && current.goalId !== input.options?.goalId && input.options?.goalId) mismatches.push('goalId');
    if (current.routinePins && stableStringify(suppliedPins) !== stableStringify(expectedPins)) mismatches.push('routinePins');
    return mismatches;
  }

  function normalizeEvidence(input, goal, trace) {
    const evidence = input.performanceEvidence;
    if (!isRecord(evidence) || evidence.contract !== PERFORMANCE_CONTRACT) return { code: 'INSUFFICIENT_COMPARABLE_EVIDENCE' };
    if (evidence.availability === 'unavailable') {
      return { code: evidence.reasonCode === 'BLOCK_PROVENANCE_UNAVAILABLE' ? 'BLOCK_PROVENANCE_UNAVAILABLE' : 'INSUFFICIENT_COMPARABLE_EVIDENCE' };
    }
    if (!iso(evidence.evidenceCutoff)) return { code: 'INSUFFICIENT_COMPARABLE_EVIDENCE' };
    if (evidence.programVersionId !== input.programVersion.programVersionId) return { code: 'STALE_BASE' };
    const excluded = [];
    const exact = [];
    for (const exposure of list(evidence.exposures)) {
      const exposureId = text(exposure?.exposureId);
      if (!exposureId || !iso(exposure?.completedAt)) {
        excluded.push({ exposureId: exposureId || null, reasonCode: 'MALFORMED_EXPOSURE_EVIDENCE' });
        continue;
      }
      if (exposure.accountId !== input.programVersion.accountId || exposure.profileId !== input.programVersion.profileId) {
        return { code: 'PROFILE_SCOPE_MISMATCH' };
      }
      if (exposure.exerciseId !== goal.exerciseId) {
        if (exposure.comparable === true) return { code: 'INCOMPATIBLE_EVIDENCE_IDENTITY' };
        excluded.push({ exposureId, reasonCode: 'EXERCISE_MISMATCH' });
        continue;
      }
      if (exposure.comparable !== true) {
        excluded.push({ exposureId, reasonCode: exposure.exclusionReasonCode || 'NOT_COMPARABLE' });
        continue;
      }
      const provenance = exposure.programProvenance;
      if (!isRecord(provenance) || provenance.programVersionId !== input.programVersion.programVersionId
        || !text(provenance.slotId) || !text(provenance.routineVersionId)
        || !Number.isInteger(Number(provenance.cycleNumber)) || Number(provenance.cycleNumber) < 1
        || provenance.cycleCompleted !== true) {
        return { code: 'BLOCK_PROVENANCE_UNAVAILABLE', evidence: { excluded } };
      }
      const slot = input.programVersion.slots.find(candidate => candidate.slotId === provenance.slotId);
      if (!slot || slot.routineVersionId !== provenance.routineVersionId) return { code: 'STALE_BASE' };
      exact.push({
        exposureId,
        workoutId: text(exposure.workoutId) || null,
        completedAt: iso(exposure.completedAt),
        progressionReasonCode: text(exposure.progressionReasonCode) || null,
        progressEvent: PROGRESS_REASONS.has(exposure.progressionReasonCode),
        programProvenance: {
          programVersionId: provenance.programVersionId,
          routineVersionId: provenance.routineVersionId,
          slotId: provenance.slotId,
          cycleNumber: Number(provenance.cycleNumber),
          cycleCompleted: true
        }
      });
    }
    exact.sort((left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt) || left.exposureId.localeCompare(right.exposureId));
    const selected = exact.slice(0, POLICY.stallComparableExposureCount);
    traceEntry(trace, 'comparable_exact_exercise_evidence', 'passed', 'COMPARABLE_EVIDENCE_NORMALIZED', {
      comparableCount: exact.length,
      selectedExposureIds: selected.map(item => item.exposureId),
      excludedCount: excluded.length
    });
    return { exact, selected, excluded };
  }

  function goalsAdjustmentEvidence(input, goal, selected) {
    const evidence = input.goalProgressionEvidence;
    if (!isRecord(evidence) || evidence.contract !== GOALS_EVIDENCE_CONTRACT
      || evidence.goalId !== goal.goalId || evidence.exerciseId !== goal.exerciseId
      || evidence.policy?.id !== 'strength_double_progression_v1' || Number(evidence.policy?.version) !== 1) {
      return { count: 0, adjustmentEvent: null, refs: [] };
    }
    const adjustments = list(evidence.adjustmentEvents)
      .filter(event => text(event?.eventId) && event.reasonCode === LOCAL_ADJUSTMENT_REASON && iso(event.issuedAt))
      .sort((left, right) => Date.parse(right.issuedAt) - Date.parse(left.issuedAt) || left.eventId.localeCompare(right.eventId));
    for (const adjustmentEvent of adjustments) {
      const refs = list(evidence.postAdjustmentOpportunities).filter(ref => (
        ref?.adjustmentEventId === adjustmentEvent.eventId
        && selected.some(exposure => exposure.exposureId === ref.exposureId && Date.parse(exposure.completedAt) > Date.parse(adjustmentEvent.issuedAt))
      )).map(ref => ({ exposureId: ref.exposureId, adjustmentEventId: ref.adjustmentEventId }));
      const unique = [...new Map(refs.map(ref => [ref.exposureId, ref])).values()];
      if (unique.length) return { count: unique.length, adjustmentEvent: clone(adjustmentEvent), refs: unique };
    }
    return { count: 0, adjustmentEvent: adjustments[0] ? clone(adjustments[0]) : null, refs: [] };
  }

  function allocateSets(totalSets, exposures) {
    if (!Number.isInteger(totalSets) || totalSets < 1 || !Number.isInteger(exposures) || exposures < 1) return null;
    const base = Math.floor(totalSets / exposures);
    const remainder = totalSets % exposures;
    return Array.from({ length: exposures }, (_, index) => base + (index < remainder ? 1 : 0));
  }

  function destinationFor(input, routineById, source, exerciseId) {
    const program = input.programVersion;
    const declared = Array.isArray(input.options?.compatibleDestinationSlotIds)
      ? new Set(input.options.compatibleDestinationSlotIds)
      : null;
    const ordered = [...program.slots.slice(source.position), ...program.slots.slice(0, source.position - 1)];
    const candidates = ordered.filter(slot => {
      if (declared && !declared.has(slot.slotId)) return false;
      const routine = routineById.get(slot.routineVersionId);
      return routine && !routine.exercises.some(exercise => exercise.exerciseId === exerciseId);
    });
    return candidates[0] || null;
  }

  function proposedId(kind, inputDigest, suffix) {
    return `proposed:${kind}:${inputDigest.split(':')[1]}:${suffix}`;
  }

  function successorRoutine(base, { inputDigest, suffix, routineId = base.routineId, label = base.label, exercises, variant = false }) {
    return {
      ...clone(base),
      routineVersionId: proposedId('routine-version', inputDigest, suffix),
      routineId,
      versionNumber: variant ? 1 : Number(base.versionNumber) + 1,
      predecessorRoutineVersionId: base.routineVersionId,
      label,
      source: {
        kind: 'programming_engine_proposal',
        proposalType: PROPOSAL_TYPE,
        baseRoutineVersionId: base.routineVersionId,
        auxiliaryVariant: variant
      },
      exercises,
      createdAt: null,
      effectiveAt: null,
      createdBy: 'programming_engine_proposal',
      approval: { kind: 'pending_explicit_user', approvedAt: null }
    };
  }

  function buildProposal(input, goal, definition, routineById, source, destination, totalSets, allocation, evidence, adjustment, trace) {
    const envelope = baseEnvelope(input, goal, definition);
    const program = input.programVersion;
    const sourceRoutine = routineById.get(source.routineVersionId);
    const destinationRoutine = routineById.get(destination.routineVersionId);
    const destinationUseCount = program.slots.filter(slot => slot.routineVersionId === destination.routineVersionId).length;
    const auxiliaryVariantRequired = destinationUseCount > 1;
    const positions = [source, {
      slotId: destination.slotId,
      position: program.slots.findIndex(slot => slot.slotId === destination.slotId) + 1,
      routineId: destination.routineId,
      routineVersionId: destination.routineVersionId
    }].sort((left, right) => left.position - right.position);
    const perExposureSetAllocation = positions.map((position, index) => ({
      order: index + 1,
      programPosition: position.position,
      slotId: position.slotId,
      baseRoutineVersionId: position.routineVersionId,
      workingSets: allocation[index]
    }));
    const sourceSets = perExposureSetAllocation.find(item => item.slotId === source.slotId).workingSets;
    const destinationSets = perExposureSetAllocation.find(item => item.slotId === destination.slotId).workingSets;
    const sourceExercises = sourceRoutine.exercises.map(exercise => exercise.exerciseId === goal.exerciseId
      ? { ...clone(exercise), workingSets: sourceSets }
      : clone(exercise));
    const destinationPrescription = { ...clone(source.prescription), workingSets: destinationSets };
    const destinationExercises = [...destinationRoutine.exercises.map(clone), destinationPrescription];
    const sourceSuccessor = successorRoutine(sourceRoutine, {
      inputDigest: envelope.inputDigest,
      suffix: 'source',
      exercises: sourceExercises
    });
    const destinationRoutineId = auxiliaryVariantRequired
      ? proposedId('routine', envelope.inputDigest, 'auxiliary')
      : destinationRoutine.routineId;
    const destinationSuccessor = successorRoutine(destinationRoutine, {
      inputDigest: envelope.inputDigest,
      suffix: auxiliaryVariantRequired ? 'auxiliary' : 'destination',
      routineId: destinationRoutineId,
      label: auxiliaryVariantRequired ? `${destinationRoutine.label} B` : destinationRoutine.label,
      exercises: destinationExercises,
      variant: auxiliaryVariantRequired
    });
    const proposalId = proposedId('proposal', envelope.inputDigest, 'pe-1a');
    const programSuccessorId = proposedId('program-version', envelope.inputDigest, 'successor');
    const successorSlots = program.slots.map(slot => {
      if (slot.slotId === source.slotId) return { ...clone(slot), routineVersionId: sourceSuccessor.routineVersionId };
      if (slot.slotId === destination.slotId) return {
        ...clone(slot),
        routineId: destinationSuccessor.routineId,
        routineVersionId: destinationSuccessor.routineVersionId,
        label: auxiliaryVariantRequired ? destinationSuccessor.label : slot.label
      };
      return clone(slot);
    });
    const programSuccessor = {
      ...clone(program),
      programVersionId: programSuccessorId,
      versionNumber: Number(program.versionNumber) + 1,
      predecessorProgramVersionId: program.programVersionId,
      slots: successorSlots,
      createdAt: null,
      createdBy: 'programming_engine_proposal',
      versionNote: `Pending ${PROPOSAL_TYPE} review for ${definition.name}.`
    };
    const reasonCodes = orderedUnique([
      'EXPOSURE_REDISTRIBUTION_PROPOSED',
      'FREQUENCY_REDISTRIBUTION_PROPOSED',
      'REPEATED_STALL',
      ...(auxiliaryVariantRequired ? ['AUXILIARY_ROUTINE_VARIANT_REQUIRED', 'ROUTINE_VARIANT_REQUIRED'] : [])
    ]);
    const primaryOperation = {
      operationType: PROPOSAL_TYPE,
      target: { goalId: goal.goalId, exerciseId: goal.exerciseId, sourceSlotId: source.slotId, destinationSlotId: destination.slotId },
      preconditions: {
        baseProgramVersionId: program.programVersionId,
        sourceRoutineVersionId: source.routineVersionId,
        destinationRoutineVersionId: destination.routineVersionId,
        exposureDelta: 1
      },
      parameters: {
        allocationPolicy: clone(POLICY.allocation),
        totalCycleWorkingSets: totalSets,
        perExposureSetAllocation: clone(perExposureSetAllocation)
      },
      before: { exposuresPerCycle: 1, totalCycleWorkingSets: totalSets, occurrences: [{ slotId: source.slotId, workingSets: totalSets }] },
      after: { exposuresPerCycle: 2, totalCycleWorkingSets: totalSets, occurrences: clone(perExposureSetAllocation) },
      successorVersionEffect: {
        routineVersionIds: [sourceSuccessor.routineVersionId, destinationSuccessor.routineVersionId],
        programVersionId: programSuccessorId
      },
      reasonCodeReferences: ['REPEATED_STALL', 'FREQUENCY_REDISTRIBUTION_PROPOSED'],
      invariantAssertions: {
        exactExerciseUnchanged: true,
        totalCycleWorkingSetsUnchanged: true,
        repRangeUnchanged: true,
        slotOrderUnchanged: true,
        otherExercisesUnchanged: true,
        activeWorkoutUntouched: true,
        completedHistoryUntouched: true
      }
    };
    const operations = [primaryOperation];
    if (auxiliaryVariantRequired) {
      operations.push({
        operationType: 'create_routine_variant_for_typed_change',
        target: { slotId: destination.slotId, baseRoutineVersionId: destinationRoutine.routineVersionId },
        preconditions: { repeatedBaseRoutinePinCount: destinationUseCount, companionOperationType: PROPOSAL_TYPE },
        parameters: { newRoutineId: destinationSuccessor.routineId, newRoutineVersionId: destinationSuccessor.routineVersionId },
        before: clone(destinationRoutine),
        after: clone(destinationSuccessor),
        successorVersionEffect: { repinnedSlotIds: [destination.slotId] },
        reasonCodeReferences: ['ROUTINE_VARIANT_REQUIRED', 'FREQUENCY_REDISTRIBUTION_PROPOSED'],
        invariantAssertions: { auxiliaryOnly: true, unselectedSlotsUnchanged: true, unrelatedExercisesUnchanged: true }
      });
    }
    traceEntry(trace, 'bounded_proposal_construction', 'proposed', 'EXPOSURE_REDISTRIBUTION_PROPOSED', {
      proposalId,
      sourceSlotId: source.slotId,
      destinationSlotId: destination.slotId,
      allocation: perExposureSetAllocation.map(item => item.workingSets),
      auxiliaryVariantRequired
    });
    const exactDiff = {
      goalId: goal.goalId,
      exerciseId: goal.exerciseId,
      exerciseName: definition.name,
      beforeExposureCount: 1,
      afterExposureCount: 2,
      exposureDelta: 1,
      totalCycleWorkingSetsBefore: totalSets,
      totalCycleWorkingSetsAfter: totalSets,
      perExposureSetAllocation: clone(perExposureSetAllocation),
      repRangeChanged: false,
      slotOrderChanged: false,
      activeWorkoutChanged: false,
      completedHistoryChanged: false
    };
    const proposal = {
      proposalId,
      proposalType: PROPOSAL_TYPE,
      targetScope: { goalId: goal.goalId, exerciseId: goal.exerciseId, exerciseName: definition.name, slotIds: [source.slotId, destination.slotId] },
      beforeExposureCount: 1,
      afterExposureCount: 2,
      totalCycleWorkingSetsBefore: totalSets,
      totalCycleWorkingSetsAfter: totalSets,
      perExposureSetAllocation,
      allocationPolicy: clone(POLICY.allocation),
      auxiliaryRoutineVariantRequired: auxiliaryVariantRequired,
      operations,
      exactDiff,
      expectedConservativeEffect: `Distributes the same ${definition.name} working sets across two cycle positions instead of one.`,
      invariantChecklist: primaryOperation.invariantAssertions,
      proposedSuccessorGraph: {
        baseProgramVersionId: program.programVersionId,
        baseRoutineVersionIds: pinsFor(program).map(pin => pin.routineVersionId),
        routineSuccessors: [sourceSuccessor, destinationSuccessor],
        programSuccessor,
        effectiveBoundary: EFFECTIVE_BOUNDARY,
        persistenceAuthorized: false
      },
      experimentalTrace: {
        goalId: goal.goalId,
        exerciseId: goal.exerciseId,
        baseProgramVersionId: program.programVersionId,
        baseRoutineVersionIds: pinsFor(program).map(pin => pin.routineVersionId),
        beforeExposureCount: 1,
        afterExposureCount: 2,
        totalCycleWorkingSetsBefore: totalSets,
        totalCycleWorkingSetsAfter: totalSets,
        perExposureSetAllocation: clone(perExposureSetAllocation),
        stallEvidenceExposureIds: evidence.selected.map(item => item.exposureId),
        stallEvidenceWorkoutIds: evidence.selected.map(item => item.workoutId).filter(Boolean),
        completedCycleNumbers: [...new Set(evidence.selected.map(item => item.programProvenance.cycleNumber))].sort((left, right) => left - right),
        goalsAdjustmentEvent: clone(adjustment.adjustmentEvent),
        postAdjustmentOpportunityRefs: clone(adjustment.refs),
        reasonCodes,
        policyVersion: ENGINE_POLICY_VERSION,
        capabilityVersion: CAPABILITY_VERSION,
        disposition: null,
        outcomeLink: null
      }
    };
    return finalResult({
      input,
      goal,
      definition,
      status: 'proposal',
      primaryReasonCode: 'EXPOSURE_REDISTRIBUTION_PROPOSED',
      reasonCodes,
      trace,
      evidence: {
        facts: [
          { name: 'consecutiveComparableStalls', value: evidence.selected.length, required: POLICY.stallComparableExposureCount },
          { name: 'completedProgramCycles', value: [...new Set(evidence.selected.map(item => item.programProvenance.cycleNumber))].length, required: POLICY.minimumCompletedCycles },
          { name: 'postGoalsAdjustmentOpportunities', value: adjustment.count, required: POLICY.postGoalsAdjustmentComparableOpportunities }
        ],
        refs: evidence.selected.map(item => ({ exposureId: item.exposureId, workoutId: item.workoutId, role: 'stall_comparable_exposure' })),
        excluded: clone(evidence.excluded)
      },
      proposal,
      explanation: {
        summary: `${definition.name} remained stalled across four comparable exposures, at least two completed Program cycles, and at least two post-adjustment opportunities.`,
        affectedGoal: { goalId: goal.goalId, exerciseId: goal.exerciseId, name: definition.name },
        exactChange: `${definition.name} changes from one to two exposures per cycle; total working sets remain ${totalSets}.`,
        why: ['REPEATED_STALL', 'FREQUENCY_REDISTRIBUTION_PROPOSED'],
        evidenceUsed: [
          `${evidence.selected.length} consecutive exact comparable exposures without progress`,
          `${[...new Set(evidence.selected.map(item => item.programProvenance.cycleNumber))].length} completed Program cycles`,
          `${adjustment.count} post-Goals-adjustment comparable opportunities`
        ],
        expectedEffect: proposal.expectedConservativeEffect,
        diffLabels: [
          `Before: 1 exposure, ${totalSets} total cycle working sets`,
          `After: 2 exposures, ${totalSets} total cycle working sets (${perExposureSetAllocation.map(item => item.workingSets).join(' + ')})`
        ],
        caveats: [
          'Earlier-position remainder allocation is a deterministic tie-breaker, not a physiological claim.',
          'Approval is required; application wiring follows in PE-1B.',
          'Active workouts and completed History remain untouched.'
        ],
        reasonCodeReferences: reasonCodes
      }
    });
  }

  function evaluate(rawInput = {}) {
    const input = {
      programVersion: clone(rawInput.programVersion),
      routineVersions: clone(rawInput.routineVersions),
      programAnalysis: clone(rawInput.programAnalysis),
      goals: clone(rawInput.goals),
      performanceEvidence: clone(rawInput.performanceEvidence),
      goalProgressionEvidence: clone(rawInput.goalProgressionEvidence),
      catalog: rawInput.catalog,
      options: clone(rawInput.options || {})
    };
    const trace = [];
    if (input.options.exposureDelta != null && Number(input.options.exposureDelta) !== 1) {
      return unavailable(input, 'EXPOSURE_DIRECTION_UNSUPPORTED', trace, {
        gate: 'capability_direction',
        reasonCodes: ['VOLUME_REDUCTION_EVIDENCE_UNAVAILABLE'],
        summary: 'PE-1A enables only a +1 exposure redistribution.',
        resolutionAction: 'Recompute without a reduction request; -1 exposure is not an enabled PE-1A capability.'
      });
    }
    const base = validateBase(input, trace);
    if (base.code) return unavailable(input, base.code, trace, {
      gate: 'base_program_and_routine_pins',
      missingOrIncompatibleInputs: base.missing || [],
      resolutionAction: 'Resolve the current immutable Program and all exact pinned Routine versions.'
    });
    const goalResult = selectGoal(input, trace);
    if (goalResult.code) return unavailable(input, goalResult.code, trace, {
      gate: 'exact_active_linked_goal',
      goal: goalResult.goal || null,
      resolutionAction: 'Select one active exact-exercise Goal explicitly linked to this Program version.'
    });
    const { goal, definition } = goalResult;
    const mismatches = staleMismatch(input);
    if (mismatches.length) return unavailable(input, 'STALE_BASE', trace, {
      gate: 'stale_base', goal, definition,
      traceDetails: { mismatches },
      resolutionAction: 'Recompute the review from the current Program, Routine pins, and Goal.'
    });
    traceEntry(trace, 'stale_base', 'passed', 'BASE_CURRENT', null);
    const analysis = validateAnalysis(input, base.byId, goal, trace);
    if (analysis.code) return unavailable(input, analysis.code, trace, {
      gate: 'analyzer_freshness', goal, definition,
      resolutionAction: analysis.code === 'GOAL_NOT_REPRESENTED'
        ? 'Add an explicit user-authored starting prescription before PE-1A can evaluate redistribution.'
        : 'Recompute Program Analyzer facts from the exact current Program and Routine pins.'
    });
    const programStatus = input.options.programStatus || input.programAnalysis?.blockContext?.programStatus;
    if (programStatus !== 'active') return unavailable(input, 'INVALID_BASE_PROGRAM', trace, {
      gate: 'current_active_program', goal, definition,
      traceDetails: { programStatus: programStatus || null },
      resolutionAction: 'Evaluate the currently active immutable Program version.'
    });
    traceEntry(trace, 'current_active_program', 'passed', 'ACTIVE_BASE_PROGRAM', { programStatus });
    const performance = normalizeEvidence(input, goal, trace);
    if (performance.code) return unavailable(input, performance.code, trace, {
      gate: performance.code === 'BLOCK_PROVENANCE_UNAVAILABLE' ? 'completed_program_cycle_provenance' : 'comparable_exact_exercise_evidence',
      goal, definition,
      evidence: performance.evidence || { facts: [], refs: [], excluded: [] },
      resolutionAction: performance.code === 'BLOCK_PROVENANCE_UNAVAILABLE'
        ? 'Wait for completed workouts with explicit Program version, Routine pin, slot, and completed-cycle provenance.'
        : 'Record enough exact comparable completed exposure evidence under the current Program.'
    });
    const evidenceSummary = {
      facts: [{ name: 'comparableExposureCount', value: performance.exact.length }],
      refs: performance.selected.map(item => ({ exposureId: item.exposureId, workoutId: item.workoutId, role: 'recent_comparable_exposure' })),
      excluded: clone(performance.excluded)
    };
    if (performance.selected.some(exposure => exposure.progressEvent)) {
      return noChange(input, 'PROGRESSION_HEALTHY_NO_CHANGE', trace, {
        gate: 'healthy_progress', goal, definition,
        reasonCodes: goal.targetDate ? ['DEADLINE_DOES_NOT_CHANGE_PRESCRIPTION'] : [],
        evidence: evidenceSummary,
        summary: `${definition.name} has a valid recent progression event under the current Program.`,
        noChangeRule: 'PE1-6.4 healthy exact-exercise progression',
        futureReviewTrigger: 'Re-evaluate only after a fresh complete stall threshold under the current versions.'
      });
    }
    traceEntry(trace, 'healthy_progress', 'not_satisfied', 'NO_RECENT_PROGRESS_EVENT', {
      comparableCount: performance.exact.length
    });
    if (performance.exact.length === 1) {
      return noChange(input, 'SINGLE_EXPOSURE_NO_PROGRAM_CHANGE', trace, {
        gate: 'stall_threshold', goal, definition,
        reasonCodes: ['STALL_THRESHOLD_NOT_MET'],
        evidence: evidenceSummary,
        summary: 'One exact comparable exposure does not justify a Program restructure.',
        noChangeRule: 'PE1-7.5 one bad workout',
        futureReviewTrigger: 'Let Goals next-exposure handling continue and reassess only after additional comparable exposures.'
      });
    }
    if (performance.exact.length < POLICY.stallComparableExposureCount) {
      if (!performance.exact.length) return unavailable(input, 'INSUFFICIENT_COMPARABLE_EVIDENCE', trace, {
        gate: 'stall_threshold', goal, definition, evidence: evidenceSummary,
        resolutionAction: 'Complete exact comparable exposures under the current Program.'
      });
      return noChange(input, 'STALL_THRESHOLD_NOT_MET', trace, {
        gate: 'stall_threshold', goal, definition,
        reasonCodes: ['GOALS_RESTORATION_NOT_YET_TESTED'],
        evidence: evidenceSummary,
        summary: `Only ${performance.exact.length} of four required comparable stalled exposures are available.`,
        noChangeRule: 'PE1-6.16 higher-horizon stall window not complete'
      });
    }
    const selected = performance.selected;
    const completedCycles = [...new Set(selected.map(exposure => exposure.programProvenance.cycleNumber))];
    if (completedCycles.length < POLICY.minimumCompletedCycles) return unavailable(input, 'PROGRAM_CYCLES_NOT_MET', trace, {
      gate: 'completed_program_cycles', goal, definition,
      evidence: evidenceSummary,
      traceDetails: { completedCycleNumbers: completedCycles, required: POLICY.minimumCompletedCycles },
      resolutionAction: 'Wait until the four comparable exposures span at least two explicitly completed Program cycles.'
    });
    traceEntry(trace, 'completed_program_cycles', 'passed', 'PROGRAM_CYCLE_THRESHOLD_MET', {
      completedCycleNumbers: completedCycles.sort((left, right) => left - right)
    });
    const adjustment = goalsAdjustmentEvidence(input, goal, selected);
    if (adjustment.count < POLICY.postGoalsAdjustmentComparableOpportunities) return unavailable(input, 'POST_ADJUSTMENT_OPPORTUNITIES_NOT_MET', trace, {
      gate: 'goals_local_adjustment_restoration', goal, definition,
      reasonCodes: ['GOALS_RESTORATION_NOT_YET_TESTED'],
      evidence: evidenceSummary,
      traceDetails: { count: adjustment.count, required: POLICY.postGoalsAdjustmentComparableOpportunities },
      resolutionAction: 'Allow the Goals repeated-miss adjustment at least two later exact comparable opportunities.'
    });
    traceEntry(trace, 'goals_local_adjustment_restoration', 'passed', 'POST_ADJUSTMENT_OPPORTUNITY_THRESHOLD_MET', {
      count: adjustment.count,
      adjustmentEventId: adjustment.adjustmentEvent?.eventId || null
    });
    traceEntry(trace, 'stall_threshold', 'passed', 'REPEATED_STALL', {
      comparableExposureCount: selected.length,
      completedCycleCount: completedCycles.length,
      postAdjustmentOpportunityCount: adjustment.count
    });
    if (input.programVersion.programmingAuthority !== 'review') return unavailable(input, 'PROGRAM_AUTHORITY_REVIEW_REQUIRED', trace, {
      gate: 'review_authority', goal, definition,
      resolutionAction: 'Enable Review authority on a future Program version; PE-1A never enables Auto.'
    });
    traceEntry(trace, 'review_authority', 'passed', 'REVIEW_AUTHORITY_AVAILABLE', null);
    if (analysis.occurrences.length !== 1) return unavailable(input, 'PROGRAM_STRUCTURE_INCOMPATIBLE', trace, {
      gate: 'pe_1a_current_exposure_shape', goal, definition,
      traceDetails: { currentExposureCount: analysis.occurrences.length, supportedInitialCount: 1 },
      resolutionAction: 'PE-1A currently supports the canonical one-to-two exposure experiment only.'
    });
    const source = analysis.occurrences[0];
    const totalSets = analysis.totalSets;
    const rawAllocation = allocateSets(totalSets, 2);
    if (!rawAllocation || rawAllocation.some(sets => sets < POLICY.minimumWorkingSetsPerExposure)) {
      return unavailable(input, 'VOLUME_NEUTRAL_ALLOCATION_INVALID', trace, {
        gate: 'volume_neutral_allocation', goal, definition,
        traceDetails: { totalSets, exposureCount: 2, allocation: rawAllocation },
        resolutionAction: 'Keep the current structure; PE-1A cannot create an invalid working-set prescription.'
      });
    }
    const destination = destinationFor(input, base.byId, source, goal.exerciseId);
    if (!destination) return unavailable(input, 'PROGRAM_STRUCTURE_INCOMPATIBLE', trace, {
      gate: 'compatible_destination', goal, definition,
      resolutionAction: 'Use a Program topology with an existing compatible destination slot; PE-1A does not invent slots.'
    });
    const destinationRoutine = base.byId.get(destination.routineVersionId);
    if (destinationRoutine.routineId === source.routineId) return unavailable(input, 'PROGRAM_STRUCTURE_INCOMPATIBLE', trace, {
      gate: 'compatible_destination', goal, definition,
      resolutionAction: 'The selected source and destination cannot require conflicting successors of one Routine identity.'
    });
    const orderedPositions = [source.position, input.programVersion.slots.findIndex(slot => slot.slotId === destination.slotId) + 1].sort((left, right) => left - right);
    traceEntry(trace, 'volume_neutral_allocation', 'passed', 'VOLUME_NEUTRAL_ALLOCATION_VALID', {
      totalSets,
      orderedPositions,
      allocation: rawAllocation,
      method: POLICY.allocation.method
    });
    return buildProposal(input, goal, definition, base.byId, source, destination, totalSets, rawAllocation, performance, adjustment, trace);
  }

  function checkStaleBase(result, current = {}) {
    if (!isRecord(result?.staleBaseGuard)) return deepFreeze({ status: 'unavailable', reasonCode: 'STALE_BASE', mismatches: ['staleBaseGuard'] });
    const guard = result.staleBaseGuard;
    const currentPins = list(current.routinePins).map(pin => ({
      slotId: text(pin?.slotId), routineId: text(pin?.routineId), routineVersionId: text(pin?.routineVersionId)
    }));
    const mismatches = [];
    if (current.programVersionId !== guard.expectedProgramVersionId) mismatches.push('programVersionId');
    if (stableStringify(currentPins) !== stableStringify(guard.expectedRoutinePins)) mismatches.push('routinePins');
    if (guard.expectedGoal && (current.goalId !== guard.expectedGoal.goalId
      || current.goalExerciseId !== guard.expectedGoal.exerciseId
      || current.goalStatus !== guard.expectedGoal.status
      || (guard.expectedGoal.updatedAt && iso(current.goalUpdatedAt) !== guard.expectedGoal.updatedAt))) mismatches.push('goal');
    if (current.analyzerDigest != null && current.analyzerDigest !== guard.analyzerDigest) mismatches.push('analyzerDigest');
    if (current.evidenceDigest != null && current.evidenceDigest !== guard.evidenceDigest) mismatches.push('evidenceDigest');
    return deepFreeze(mismatches.length
      ? { status: 'unavailable', reasonCode: 'STALE_BASE', mismatches, recomputeRequired: true }
      : { status: 'current', reasonCode: 'BASE_CURRENT', mismatches: [], recomputeRequired: false });
  }

  const api = deepFreeze({
    evaluate,
    checkStaleBase,
    allocateSets,
    digest,
    stableStringify,
    contractVersion: CONTRACT_VERSION,
    enginePolicyVersion: ENGINE_POLICY_VERSION,
    capabilityVersion: CAPABILITY_VERSION,
    policy: POLICY,
    contracts: {
      analysis: ANALYZER_CONTRACT,
      performanceEvidence: PERFORMANCE_CONTRACT,
      goalsProgressionEvidence: GOALS_EVIDENCE_CONTRACT
    }
  });
  Object.defineProperty(scope, 'BigGainsProgrammingEngine', { configurable: false, enumerable: true, value: api, writable: false });
})(typeof window === 'object' ? window : globalThis);
