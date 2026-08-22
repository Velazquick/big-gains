((scope) => {
  'use strict';

  const APPLICATION_CONTRACT = 'big-gains.programming-engine-application.v1';
  const TRACE_CONTRACT = 'big-gains.programming-application-trace.v1';
  const SUPPORTED_PROPOSAL_TYPE = 'redistribute_exact_exercise_exposure';
  const SUPPORTED_CONTRACT = 'big-gains.programming-engine.v1';
  const SUPPORTED_POLICY = 'pe-strength-rules.v1.0.0';
  const SUPPORTED_CAPABILITY = 'pe-1a-volume-neutral-exposure-redistribution.v1.0.0';
  const PRIMARY_OPERATION = 'redistribute_exact_exercise_exposure';
  const AUXILIARY_OPERATION = 'create_routine_variant_for_typed_change';
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const list = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === 'string' ? value.trim() : '';
  const validDate = value => Number.isFinite(Date.parse(value));

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

  const stableStringify = value => JSON.stringify(stableValue(value));
  const same = (left, right) => stableStringify(left) === stableStringify(right);
  const fail = (status, reasonCode, diagnostics = {}) => deepFreeze({
    contract: APPLICATION_CONTRACT,
    status,
    reasonCode,
    proposalId: diagnostics.proposalId || null,
    inputDigest: diagnostics.inputDigest || null,
    mutationPerformed: false,
    recomputeRequired: status === 'stale',
    retrySafe: status === 'failed',
    diagnostics: diagnostics.details || null
  });

  function pins(programVersion) {
    return list(programVersion?.slots).map(slot => ({
      slotId: text(slot?.slotId),
      routineId: text(slot?.routineId),
      routineVersionId: text(slot?.routineVersionId)
    }));
  }

  function strengthGoals(value) {
    if (Array.isArray(value)) return value;
    return list(value?.strengthGoals);
  }

  function applicationIdentity(proposal) {
    const suffix = text(proposal?.inputDigest).split(':').at(-1);
    return suffix ? `pe-application:${suffix}:approved` : null;
  }

  function publicApplied(trace, { idempotent = false } = {}) {
    return deepFreeze({
      contract: APPLICATION_CONTRACT,
      status: 'applied',
      reasonCode: idempotent ? 'ALREADY_APPLIED' : 'PROPOSAL_APPLIED',
      proposalId: trace.proposalId,
      inputDigest: trace.inputDigest,
      applicationId: trace.applicationId,
      idempotent,
      mutationPerformed: !idempotent,
      recomputeRequired: false,
      retrySafe: true,
      oldProgramVersionId: trace.baseProgramVersionId,
      newProgramVersionId: trace.newProgramVersionId,
      routineVersionTransitions: clone(trace.routineVersionTransitions),
      operations: clone(trace.operations),
      futureEffectiveBoundary: clone(trace.futureEffectiveBoundary),
      trace: clone(trace)
    });
  }

  function preliminarilyEligible({ proposal, currentProgramCapture, goals, activeWorkout = null, accountId, profileId }) {
    const planned = buildPlan({ proposal, currentProgramCapture, goals, activeWorkout, accountId, profileId, now: proposal?.evaluatedAt });
    return deepFreeze(planned.status === 'ready'
      ? { eligible: true, reasonCode: 'APPLICATION_READY' }
      : { eligible: false, reasonCode: planned.reasonCode, status: planned.status });
  }

  function supportedProposal(proposal) {
    if (!isRecord(proposal) || proposal.status !== 'proposal') return 'PROPOSAL_STATUS_UNSUPPORTED';
    if (proposal.proposalType !== SUPPORTED_PROPOSAL_TYPE) return 'PROPOSAL_TYPE_UNSUPPORTED';
    if (proposal.contractVersion !== SUPPORTED_CONTRACT
      || proposal.enginePolicyVersion !== SUPPORTED_POLICY
      || proposal.capabilityVersion !== SUPPORTED_CAPABILITY) return 'PROPOSAL_VERSION_UNSUPPORTED';
    if (proposal.approval?.userApprovalRequired !== true || proposal.approval?.authorityCeiling !== 'review') return 'PROPOSAL_AUTHORITY_UNSUPPORTED';
    const digestSuffix = text(proposal.inputDigest).split(':').at(-1);
    if (!digestSuffix || proposal.proposalId !== `proposed:proposal:${digestSuffix}:pe-1a`) return 'PROPOSAL_IDENTITY_INVALID';
    const operationTypes = list(proposal.operations).map(operation => operation?.operationType);
    if (!operationTypes.length || operationTypes[0] !== PRIMARY_OPERATION
      || operationTypes.some(type => type !== PRIMARY_OPERATION && type !== AUXILIARY_OPERATION)
      || operationTypes.filter(type => type === PRIMARY_OPERATION).length !== 1
      || operationTypes.filter(type => type === AUXILIARY_OPERATION).length > 1) return 'PROPOSAL_OPERATIONS_UNSUPPORTED';
    return null;
  }

  function activeOriginDisposition(activeWorkout, baseProgram, sequence, accountId, profileId) {
    const origin = activeWorkout?.programOrigin;
    if (!isRecord(origin)) return { pendingCompletion: false, conflict: false };
    if (origin.accountId !== accountId || origin.profileId !== profileId) return { pendingCompletion: false, conflict: true };
    if (origin.programId !== baseProgram.programId) return { pendingCompletion: false, conflict: false };
    const slot = baseProgram.slots?.[Number(origin.slotIndex)];
    const exact = origin.programVersionId === baseProgram.programVersionId
      && origin.slotId === slot?.slotId && origin.routineId === slot?.routineId
      && origin.routineVersionId === slot?.routineVersionId
      && Number(sequence?.nextSlotIndex) === Number(origin.slotIndex)
      && Number(origin.cycleNumber) === Number(sequence?.completedCycles) + 1;
    return { pendingCompletion: exact, conflict: !exact };
  }

  function exposureFacts(programVersion, routineByVersion, exerciseId) {
    const occurrences = [];
    list(programVersion?.slots).forEach((slot, index) => {
      const routine = routineByVersion.get(slot.routineVersionId);
      const prescription = list(routine?.exercises).find(exercise => exercise.exerciseId === exerciseId);
      if (prescription) occurrences.push({
        slotId: slot.slotId,
        programPosition: index + 1,
        routineId: slot.routineId,
        routineVersionId: slot.routineVersionId,
        workingSets: Number(prescription.workingSets),
        prescription
      });
    });
    return { occurrences, totalSets: occurrences.reduce((sum, item) => sum + item.workingSets, 0) };
  }

  function buildPlan({ proposal: rawProposal, currentProgramCapture, goals, activeWorkout = null, accountId, profileId, now = null }) {
    const proposal = clone(rawProposal);
    const proposalId = text(proposal?.proposalId) || null;
    const inputDigest = text(proposal?.inputDigest) || null;
    const unsupported = supportedProposal(proposal);
    if (unsupported) return { status: 'unavailable', reasonCode: unsupported, proposalId, inputDigest };
    if (!accountId || !profileId || proposal.profileScope?.accountId !== accountId || proposal.profileScope?.profileId !== profileId) {
      return { status: 'unavailable', reasonCode: 'PROFILE_SCOPE_MISMATCH', proposalId, inputDigest };
    }
    const model = scope.BigGainsProgramModel;
    if (!model?.normalizeCapture) return { status: 'failed', reasonCode: 'PROGRAM_MODEL_UNAVAILABLE', proposalId, inputDigest };
    const capture = model.normalizeCapture(currentProgramCapture, { accountId, profileId });
    const priorTrace = capture.applicationTraces.find(trace => trace.proposalId === proposalId && trace.inputDigest === inputDigest);
    if (priorTrace) return { status: 'already_applied', reasonCode: 'ALREADY_APPLIED', trace: priorTrace, proposalId, inputDigest };
    const baseProgram = capture.programVersions.find(version => version.programVersionId === proposal.baseProgramVersionId);
    const programRecord = baseProgram && capture.programs.find(program => program.programId === baseProgram.programId);
    if (!baseProgram || capture.activeProgramVersionId !== baseProgram.programVersionId
      || programRecord?.status !== 'active' || programRecord.activeVersionId !== baseProgram.programVersionId
      || programRecord.latestVersionId !== baseProgram.programVersionId) {
      return { status: 'stale', reasonCode: 'STALE_BASE', mismatches: ['activeProgramVersion'], proposalId, inputDigest };
    }
    if (baseProgram.programmingAuthority !== 'review') {
      return { status: 'unavailable', reasonCode: 'REVIEW_AUTHORITY_REQUIRED', proposalId, inputDigest };
    }
    const expectedPins = list(proposal.staleBaseGuard?.expectedRoutinePins);
    if (!same(pins(baseProgram), expectedPins) || !same(pins(baseProgram), list(proposal.baseRoutinePins))) {
      return { status: 'stale', reasonCode: 'STALE_BASE', mismatches: ['routinePins'], proposalId, inputDigest };
    }
    const routineByVersion = new Map(capture.routineVersions.map(version => [version.routineVersionId, version]));
    const staleRoutine = expectedPins.find(pin => {
      const version = routineByVersion.get(pin.routineVersionId);
      const record = capture.routines.find(routine => routine.routineId === pin.routineId);
      return !version || version.routineId !== pin.routineId || record?.currentVersionId !== pin.routineVersionId;
    });
    if (staleRoutine) return { status: 'stale', reasonCode: 'STALE_BASE', mismatches: ['routineVersion'], proposalId, inputDigest };
    const goal = strengthGoals(goals).find(item => item?.goalId === proposal.targetScope?.goalId);
    const guardedGoal = proposal.staleBaseGuard?.expectedGoal;
    if (!goal || goal.accountId !== accountId || goal.profileId !== profileId || goal.status !== 'active'
      || goal.exerciseId !== proposal.targetScope?.exerciseId || !baseProgram.priorityGoalIds.includes(goal.goalId)
      || goal.goalId !== guardedGoal?.goalId || goal.exerciseId !== guardedGoal?.exerciseId
      || goal.status !== guardedGoal?.status || (guardedGoal?.updatedAt && (!validDate(goal.updatedAt) || new Date(goal.updatedAt).toISOString() !== guardedGoal.updatedAt))) {
      return { status: 'stale', reasonCode: 'STALE_BASE', mismatches: ['goal'], proposalId, inputDigest };
    }
    const sequence = capture.sequenceState;
    if (sequence?.programId !== baseProgram.programId || sequence?.programVersionId !== baseProgram.programVersionId
      || !Number.isInteger(Number(sequence.nextSlotIndex)) || Number(sequence.nextSlotIndex) < 0
      || Number(sequence.nextSlotIndex) >= baseProgram.slots.length) {
      return { status: 'stale', reasonCode: 'STALE_BASE', mismatches: ['sequenceState'], proposalId, inputDigest };
    }
    const activeDisposition = activeOriginDisposition(activeWorkout, baseProgram, sequence, accountId, profileId);
    if (activeDisposition.conflict) return { status: 'stale', reasonCode: 'STALE_BASE', mismatches: ['activeWorkoutOrigin'], proposalId, inputDigest };

    const primary = proposal.operations.find(operation => operation.operationType === PRIMARY_OPERATION);
    const auxiliary = proposal.operations.find(operation => operation.operationType === AUXILIARY_OPERATION) || null;
    const sourceSlot = baseProgram.slots.find(slot => slot.slotId === primary?.target?.sourceSlotId);
    const destinationSlot = baseProgram.slots.find(slot => slot.slotId === primary?.target?.destinationSlotId);
    const facts = exposureFacts(baseProgram, routineByVersion, goal.exerciseId);
    const allocation = list(primary?.parameters?.perExposureSetAllocation).map(item => ({
      order: Number(item?.order),
      programPosition: Number(item?.programPosition),
      slotId: text(item?.slotId),
      baseRoutineVersionId: text(item?.baseRoutineVersionId),
      workingSets: Number(item?.workingSets)
    }));
    const orderedTargets = [sourceSlot, destinationSlot].filter(Boolean)
      .map(slot => ({ slotId: slot.slotId, programPosition: baseProgram.slots.findIndex(item => item.slotId === slot.slotId) + 1, baseRoutineVersionId: slot.routineVersionId }))
      .sort((left, right) => left.programPosition - right.programPosition);
    if (!sourceSlot || !destinationSlot || sourceSlot.slotId === destinationSlot.slotId
      || primary.target.goalId !== goal.goalId || primary.target.exerciseId !== goal.exerciseId
      || primary.preconditions?.baseProgramVersionId !== baseProgram.programVersionId
      || primary.preconditions?.sourceRoutineVersionId !== sourceSlot.routineVersionId
      || primary.preconditions?.destinationRoutineVersionId !== destinationSlot.routineVersionId
      || Number(primary.preconditions?.exposureDelta) !== 1
      || facts.occurrences.length !== 1 || facts.occurrences[0].slotId !== sourceSlot.slotId
      || facts.totalSets !== Number(primary.before?.totalCycleWorkingSets)
      || Number(primary.before?.exposuresPerCycle) !== 1 || Number(primary.after?.exposuresPerCycle) !== 2
      || Number(primary.after?.totalCycleWorkingSets) !== facts.totalSets
      || Number(primary.parameters?.totalCycleWorkingSets) !== facts.totalSets
      || allocation.length !== 2 || allocation.some(item => !Number.isInteger(item.workingSets) || item.workingSets < 1)
      || allocation.reduce((sum, item) => sum + item.workingSets, 0) !== facts.totalSets
      || !same(allocation.map(({ slotId, programPosition, baseRoutineVersionId }) => ({ slotId, programPosition, baseRoutineVersionId })), orderedTargets)
      || !same(allocation.map(item => item.workingSets), proposal.perExposureSetAllocation?.map(item => Number(item.workingSets)))
      || proposal.beforeExposureCount !== 1 || proposal.afterExposureCount !== 2
      || proposal.totalCycleWorkingSetsBefore !== facts.totalSets || proposal.totalCycleWorkingSetsAfter !== facts.totalSets) {
      return { status: 'stale', reasonCode: 'STALE_BASE', mismatches: ['typedOperationAssumptions'], proposalId, inputDigest };
    }

    const sourceBase = routineByVersion.get(sourceSlot.routineVersionId);
    const destinationBase = routineByVersion.get(destinationSlot.routineVersionId);
    const destinationPinCount = baseProgram.slots.filter(slot => slot.routineVersionId === destinationSlot.routineVersionId).length;
    const variantRequired = destinationPinCount > 1;
    if (!sourceBase || !destinationBase || sourceBase.routineId !== sourceSlot.routineId || destinationBase.routineId !== destinationSlot.routineId
      || variantRequired !== Boolean(proposal.auxiliaryRoutineVariantRequired)
      || variantRequired !== Boolean(auxiliary)) {
      return { status: 'stale', reasonCode: 'STALE_BASE', mismatches: ['successorTopology'], proposalId, inputDigest };
    }
    const graph = proposal.proposedSuccessorGraph;
    const proposedRoutines = list(graph?.routineSuccessors);
    const proposedProgram = graph?.programSuccessor;
    if (graph?.baseProgramVersionId !== baseProgram.programVersionId || proposedRoutines.length !== 2 || !isRecord(proposedProgram)
      || proposedProgram.predecessorProgramVersionId !== baseProgram.programVersionId
      || Number(proposedProgram.versionNumber) !== Number(baseProgram.versionNumber) + 1) {
      return { status: 'unavailable', reasonCode: 'PROPOSAL_SUCCESSOR_GRAPH_INVALID', proposalId, inputDigest };
    }
    const proposedSource = proposedRoutines.find(version => version.predecessorRoutineVersionId === sourceBase.routineVersionId && version.routineId === sourceBase.routineId);
    const proposedDestination = proposedRoutines.find(version => version.routineVersionId !== proposedSource?.routineVersionId);
    const sourceSets = allocation.find(item => item.slotId === sourceSlot.slotId)?.workingSets;
    const destinationSets = allocation.find(item => item.slotId === destinationSlot.slotId)?.workingSets;
    const sourceExercises = sourceBase.exercises.map(exercise => exercise.exerciseId === goal.exerciseId
      ? { ...clone(exercise), workingSets: sourceSets } : clone(exercise));
    const sourcePrescription = sourceBase.exercises.find(exercise => exercise.exerciseId === goal.exerciseId);
    const destinationExercises = [...destinationBase.exercises.map(clone), { ...clone(sourcePrescription), workingSets: destinationSets }];
    const destinationRoutineId = variantRequired ? text(auxiliary?.parameters?.newRoutineId) : destinationBase.routineId;
    if (!proposedSource || !proposedDestination || !sourcePrescription || !destinationRoutineId
      || proposedSource.routineVersionId !== primary.successorVersionEffect?.routineVersionIds?.[0]
      || proposedDestination.routineVersionId !== primary.successorVersionEffect?.routineVersionIds?.[1]
      || proposedDestination.routineId !== destinationRoutineId
      || !same(proposedSource.exercises, sourceExercises) || !same(proposedDestination.exercises, destinationExercises)) {
      return { status: 'unavailable', reasonCode: 'PROPOSAL_SUCCESSOR_GRAPH_INVALID', proposalId, inputDigest };
    }

    const appliedAt = validDate(now) ? new Date(now).toISOString() : new Date().toISOString();
    const actualSource = {
      ...clone(sourceBase),
      routineVersionId: proposedSource.routineVersionId,
      versionNumber: Number(sourceBase.versionNumber) + 1,
      predecessorRoutineVersionId: sourceBase.routineVersionId,
      source: { ...clone(sourceBase.source), basedOnRoutineVersionId: sourceBase.routineVersionId },
      exercises: sourceExercises,
      createdAt: appliedAt,
      effectiveAt: appliedAt,
      createdBy: 'user',
      approval: { kind: 'explicit_user', approvedAt: appliedAt }
    };
    const actualDestination = {
      ...clone(destinationBase),
      routineVersionId: proposedDestination.routineVersionId,
      routineId: destinationRoutineId,
      versionNumber: variantRequired ? 1 : Number(destinationBase.versionNumber) + 1,
      predecessorRoutineVersionId: destinationBase.routineVersionId,
      label: proposedDestination.label,
      source: { ...clone(destinationBase.source), basedOnRoutineVersionId: destinationBase.routineVersionId },
      exercises: destinationExercises,
      createdAt: appliedAt,
      effectiveAt: appliedAt,
      createdBy: 'user',
      approval: { kind: 'explicit_user', approvedAt: appliedAt }
    };
    const successorSlots = baseProgram.slots.map(slot => {
      if (slot.slotId === sourceSlot.slotId) return { ...clone(slot), routineVersionId: actualSource.routineVersionId };
      if (slot.slotId === destinationSlot.slotId) return {
        ...clone(slot), routineId: actualDestination.routineId, routineVersionId: actualDestination.routineVersionId,
        label: variantRequired ? actualDestination.label : slot.label
      };
      return clone(slot);
    });
    if (!same(proposedProgram.slots, successorSlots) || proposedProgram.programVersionId !== primary.successorVersionEffect?.programVersionId) {
      return { status: 'unavailable', reasonCode: 'PROPOSAL_SUCCESSOR_GRAPH_INVALID', proposalId, inputDigest };
    }
    const baseNextSlotIndex = Number(sequence.nextSlotIndex);
    const successorNextSlotIndex = baseNextSlotIndex;
    const completedCycles = Number(sequence.completedCycles);
    const successorProgram = {
      ...clone(baseProgram),
      programVersionId: proposedProgram.programVersionId,
      versionNumber: Number(baseProgram.versionNumber) + 1,
      predecessorProgramVersionId: baseProgram.programVersionId,
      slots: successorSlots,
      effectiveBoundary: { kind: 'next_unmaterialized_session', activeWorkoutIdAtAcceptance: text(activeWorkout?.id) || null },
      createdAt: appliedAt,
      createdBy: 'user',
      versionNote: `Approved ${SUPPORTED_PROPOSAL_TYPE} for ${proposal.targetScope.exerciseName || goal.exerciseId}.`
    };
    const transitions = [actualSource, actualDestination].map(version => ({
      baseRoutineVersionId: version.predecessorRoutineVersionId,
      newRoutineVersionId: version.routineVersionId,
      routineId: version.routineId
    }));
    const trace = {
      contract: TRACE_CONTRACT,
      applicationId: applicationIdentity(proposal),
      proposalId,
      inputDigest,
      accountId,
      profileId,
      goalId: goal.goalId,
      exerciseId: goal.exerciseId,
      baseProgramVersionId: baseProgram.programVersionId,
      newProgramVersionId: successorProgram.programVersionId,
      routineVersionTransitions: transitions,
      beforeExposureCount: proposal.beforeExposureCount,
      afterExposureCount: proposal.afterExposureCount,
      totalCycleWorkingSetsBefore: proposal.totalCycleWorkingSetsBefore,
      totalCycleWorkingSetsAfter: proposal.totalCycleWorkingSetsAfter,
      allocation: allocation.map(item => item.workingSets),
      reasonCodes: clone(proposal.reasonCodes),
      operations: clone(proposal.operations),
      contractVersion: proposal.contractVersion,
      enginePolicyVersion: proposal.enginePolicyVersion,
      capabilityVersion: proposal.capabilityVersion,
      appliedAt,
      disposition: 'approved',
      futureEffectiveBoundary: {
        kind: 'next_unmaterialized_session',
        activeWorkoutIdAtAcceptance: text(activeWorkout?.id) || null,
        baseNextSlotIndex,
        successorNextSlotIndex,
        completedCycles,
        activeProgramOriginCompletionPending: activeDisposition.pendingCompletion
      }
    };
    const routines = capture.routines.map(routine => {
      if (routine.routineId === sourceBase.routineId) return { ...routine, currentVersionId: actualSource.routineVersionId };
      if (!variantRequired && routine.routineId === destinationBase.routineId) return { ...routine, currentVersionId: actualDestination.routineVersionId };
      return routine;
    });
    if (variantRequired) routines.push({
      routineId: actualDestination.routineId,
      accountId,
      profileId,
      purposeKey: `pe-auxiliary:${proposalId}:${destinationSlot.slotId}`,
      currentVersionId: actualDestination.routineVersionId,
      createdAt: appliedAt
    });
    const programs = capture.programs.map(program => program.programId === baseProgram.programId ? {
      ...program,
      status: 'active',
      latestVersionId: successorProgram.programVersionId,
      activeVersionId: successorProgram.programVersionId,
      updatedAt: appliedAt
    } : program);
    const nextCapture = model.normalizeCapture({
      ...capture,
      routines,
      routineVersions: [...capture.routineVersions, actualSource, actualDestination],
      programs,
      programVersions: [...capture.programVersions, successorProgram],
      applicationTraces: [...capture.applicationTraces, trace],
      activeProgramVersionId: successorProgram.programVersionId,
      sequenceState: {
        programId: successorProgram.programId,
        programVersionId: successorProgram.programVersionId,
        nextSlotIndex: successorNextSlotIndex,
        completedCycles,
        updatedAt: appliedAt
      }
    }, { accountId, profileId });
    if (!nextCapture.programVersions.some(version => version.programVersionId === successorProgram.programVersionId)
      || !nextCapture.applicationTraces.some(item => item.applicationId === trace.applicationId)
      || nextCapture.routineVersions.length !== capture.routineVersions.length + 2) {
      return { status: 'failed', reasonCode: 'SUCCESSOR_VALIDATION_FAILED', proposalId, inputDigest };
    }
    return { status: 'ready', reasonCode: 'APPLICATION_READY', proposalId, inputDigest, nextCapture, trace };
  }

  function plan(input) {
    const planned = buildPlan(input || {});
    if (planned.status === 'already_applied') return publicApplied(planned.trace, { idempotent: true });
    if (planned.status !== 'ready') return fail(planned.status, planned.reasonCode, {
      proposalId: planned.proposalId, inputDigest: planned.inputDigest, details: planned.mismatches || null
    });
    return deepFreeze({
      contract: APPLICATION_CONTRACT,
      status: 'ready',
      reasonCode: 'APPLICATION_READY',
      proposalId: planned.proposalId,
      inputDigest: planned.inputDigest,
      applicationId: planned.trace.applicationId,
      newProgramVersionId: planned.trace.newProgramVersionId,
      routineVersionTransitions: clone(planned.trace.routineVersionTransitions),
      futureEffectiveBoundary: clone(planned.trace.futureEffectiveBoundary),
      capture: clone(planned.nextCapture),
      trace: clone(planned.trace)
    });
  }

  function safeRollback(ports, rawSnapshot) {
    try {
      ports.restoreRaw(rawSnapshot);
      if (typeof ports.snapshotRaw === 'function' && ports.snapshotRaw() !== rawSnapshot) {
        return { rolledBack: false, rollbackReasonCode: 'ROLLBACK_READBACK_MISMATCH' };
      }
      return { rolledBack: true, rollbackReasonCode: 'ROLLBACK_VERIFIED' };
    } catch {
      return { rolledBack: false, rollbackReasonCode: 'ROLLBACK_FAILED' };
    }
  }

  function apply({ proposal, currentProgramCapture, goals, activeWorkout = null, accountId, profileId, now = null, ports = null } = {}) {
    const requiredPorts = ports && ['readState', 'snapshotRaw', 'commitState', 'restoreRaw'].every(name => typeof ports[name] === 'function');
    if (!requiredPorts) return fail('failed', 'PERSISTENCE_PORT_UNAVAILABLE', { proposalId: proposal?.proposalId, inputDigest: proposal?.inputDigest });
    let authoritative;
    let rawSnapshot;
    try {
      authoritative = clone(ports.readState());
      rawSnapshot = ports.snapshotRaw();
    } catch {
      return fail('failed', 'AUTHORITATIVE_READ_FAILED', { proposalId: proposal?.proposalId, inputDigest: proposal?.inputDigest });
    }
    const authoritativeCapture = authoritative?.programCapture ?? currentProgramCapture;
    const authoritativeGoals = authoritative?.goals ?? goals;
    const authoritativeActive = authoritative?.activeWorkout ?? activeWorkout;
    const planned = buildPlan({
      proposal,
      currentProgramCapture: authoritativeCapture,
      goals: authoritativeGoals,
      activeWorkout: authoritativeActive,
      accountId,
      profileId,
      now
    });
    if (planned.status === 'already_applied') return publicApplied(planned.trace, { idempotent: true });
    if (planned.status !== 'ready') return fail(planned.status, planned.reasonCode, {
      proposalId: planned.proposalId,
      inputDigest: planned.inputDigest,
      details: planned.mismatches || null
    });
    if (typeof ports.recomputeProposal === 'function') {
      let fresh;
      try { fresh = ports.recomputeProposal(authoritative); } catch { fresh = null; }
      if (!fresh || fresh.status !== 'proposal' || fresh.proposalId !== proposal?.proposalId || fresh.inputDigest !== proposal?.inputDigest) {
        return fail('stale', 'STALE_BASE', {
          proposalId: proposal?.proposalId,
          inputDigest: proposal?.inputDigest,
          details: ['inputDigest']
        });
      }
    }
    try {
      ports.commitState({ ...authoritative, programCapture: planned.nextCapture });
    } catch {
      const rollback = safeRollback(ports, rawSnapshot);
      return fail('failed', 'PERSISTENCE_COMMIT_FAILED', {
        proposalId: planned.proposalId,
        inputDigest: planned.inputDigest,
        details: rollback
      });
    }
    let readback;
    try { readback = ports.readState(); } catch { readback = null; }
    const normalizedReadback = scope.BigGainsProgramModel.normalizeCapture(readback?.programCapture, { accountId, profileId });
    if (!readback || !same(normalizedReadback, planned.nextCapture)) {
      const rollback = safeRollback(ports, rawSnapshot);
      return fail('failed', 'PERSISTENCE_READBACK_MISMATCH', {
        proposalId: planned.proposalId,
        inputDigest: planned.inputDigest,
        details: rollback
      });
    }
    return publicApplied(planned.trace);
  }

  const api = deepFreeze({
    apply,
    plan,
    preliminarilyEligible,
    contract: APPLICATION_CONTRACT,
    supportedProposalType: SUPPORTED_PROPOSAL_TYPE,
    supportedVersions: {
      contract: SUPPORTED_CONTRACT,
      policy: SUPPORTED_POLICY,
      capability: SUPPORTED_CAPABILITY
    }
  });
  Object.defineProperty(scope, 'BigGainsProgrammingEngineApplication', { configurable: false, enumerable: true, value: api, writable: false });
})(typeof window === 'object' ? window : globalThis);
