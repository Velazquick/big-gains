import assert from 'node:assert/strict';
import test from 'node:test';

await import('../exercise-catalog.js');
await import('../program-model.js');
await import('../program-analyzer.js');
await import('../programming-engine.js');
await import('../program-origin.js');
await import('../programming-application.js');

const catalog = globalThis.BigGainsExerciseCatalog;
const model = globalThis.BigGainsProgramModel;
const analyzer = globalThis.BigGainsProgramAnalyzer;
const engine = globalThis.BigGainsProgrammingEngine;
const application = globalThis.BigGainsProgrammingEngineApplication;
const bench = catalog.resolve('Barbell Bench Press');
const row = catalog.resolve('Barbell Row');
const squat = catalog.resolve('Back Squat');
const scope = { accountId: 'account-application', profileId: 'profile-application' };
const evaluatedAt = '2026-08-23T12:00:00.000Z';
const appliedAt = '2026-08-24T12:00:00.000Z';
const clone = value => JSON.parse(JSON.stringify(value));

function routine(key, label, exercises) {
  return {
    ...scope,
    routineId: `routine-${key}`,
    routineVersionId: `routine-version-${key}`,
    versionNumber: 1,
    predecessorRoutineVersionId: null,
    label,
    source: { kind: 'reviewed_rebuild', routineType: label },
    exercises: exercises.map((item, index) => ({
      sequence: index + 1,
      exerciseId: item.exerciseId,
      workingSets: item.workingSets,
      repTarget: item.repTarget || { kind: 'range', text: '4–6', min: 4, max: 6 },
      restSeconds: item.restSeconds ?? 180
    })),
    createdAt: '2026-07-01T12:00:00.000Z',
    effectiveAt: '2026-07-01T12:00:00.000Z',
    createdBy: 'user',
    approval: { kind: 'explicit_user', approvedAt: '2026-07-01T12:00:00.000Z' }
  };
}

function fixture({ sets = 6, repeatedDestination = false, nextSlotIndex = 0, activeProgramWorkout = false, manualWorkout = false } = {}) {
  const source = routine('source', 'Alpha', [
    { exerciseId: bench.canonicalId, workingSets: sets },
    { exerciseId: row.canonicalId, workingSets: 2, repTarget: { kind: 'range', text: '8–10', min: 8, max: 10 } }
  ]);
  const destination = routine('destination', 'Beta', [{ exerciseId: squat.canonicalId, workingSets: 4 }]);
  const other = routine('other', 'Gamma', [{ exerciseId: row.canonicalId, workingSets: 3 }]);
  const routineVersions = [source, destination, other];
  const slot = (key, version, index) => ({
    slotId: `slot-${key}`,
    sequence: index + 1,
    label: `Position ${index + 1}`,
    preferredCalendarAnchor: index < 3 ? { weekday: index + 1 } : null,
    routineId: version.routineId,
    routineVersionId: version.routineVersionId
  });
  const slots = [slot('source', source, 0), slot('destination', destination, 1), slot('other', other, 2)];
  if (repeatedDestination) slots.push(slot('destination-repeat', destination, 3));
  const goal = {
    ...scope,
    goalId: 'goal-bench',
    exerciseId: bench.canonicalId,
    metric: 'one_rep_max',
    targetValue: 250,
    unit: 'lb',
    targetBasis: bench.analytics.e1rmLoadBasis,
    status: 'active',
    guidanceEnabled: true,
    policy: { id: 'strength_double_progression_v1', version: 1 },
    updatedAt: '2026-08-22T13:00:00.000Z'
  };
  const programVersion = {
    ...scope,
    programId: 'program-1',
    programVersionId: 'program-version-1',
    versionNumber: 1,
    predecessorProgramVersionId: null,
    name: 'Application fixture',
    scheduleMode: 'rolling_cycle',
    cadencePolicy: { kind: 'rolling_cycle', advanceOn: 'completed_session' },
    duration: { mode: 'rolling', startsOn: '2026-07-01', endsOn: null },
    slots,
    blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4, onBoundary: 'review_required' },
    programmingAuthority: 'review',
    priorityGoalIds: [goal.goalId],
    policyRefs: [],
    effectiveBoundary: { kind: 'next_unmaterialized_session', activeWorkoutIdAtAcceptance: null },
    createdAt: '2026-07-01T12:00:00.000Z',
    createdBy: 'user',
    versionNote: ''
  };
  const sequenceState = {
    programId: programVersion.programId,
    programVersionId: programVersion.programVersionId,
    nextSlotIndex,
    completedCycles: 4,
    updatedAt: evaluatedAt
  };
  const analysis = analyzer.analyze({
    programVersion,
    routineVersions,
    catalog,
    goals: [goal],
    options: { programStatus: 'active', sequenceState }
  });
  const exposures = ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22'].map((date, index) => ({
    exposureId: `exposure-${index + 1}`,
    workoutId: `workout-${index + 1}`,
    ...scope,
    exerciseId: bench.canonicalId,
    completedAt: `${date}T12:00:00.000Z`,
    comparable: true,
    progressionReasonCode: 'HOLD_PARTIAL',
    programProvenance: {
      programId: programVersion.programId,
      programVersionId: programVersion.programVersionId,
      routineId: source.routineId,
      routineVersionId: source.routineVersionId,
      slotId: slots[0].slotId,
      slotIndex: 0,
      cycleNumber: index + 1,
      cycleCompleted: true
    }
  }));
  const proposal = engine.evaluate({
    programVersion,
    routineVersions,
    programAnalysis: analysis,
    goals: [goal],
    performanceEvidence: {
      contract: 'big-gains.program-performance-evidence.v1',
      availability: 'available',
      programVersionId: programVersion.programVersionId,
      evidenceCutoff: evaluatedAt,
      exposures
    },
    goalProgressionEvidence: {
      contract: 'big-gains.goals-progression-evidence.v1',
      goalId: goal.goalId,
      exerciseId: goal.exerciseId,
      policy: { id: 'strength_double_progression_v1', version: 1 },
      adjustmentEvents: [{ eventId: 'adjustment-1', reasonCode: 'ADJUST_REPEATED_MISS', issuedAt: '2026-08-09T12:00:00.000Z', adopted: true }],
      postAdjustmentOpportunities: ['exposure-3', 'exposure-4'].map(exposureId => ({ exposureId, adjustmentEventId: 'adjustment-1' }))
    },
    catalog,
    options: {
      goalId: goal.goalId,
      programStatus: 'active',
      evaluatedAt,
      compatibleDestinationSlotIds: [slots[1].slotId],
      currentBase: { programVersionId: programVersion.programVersionId, goalId: goal.goalId, routinePins: slots.map(item => ({ slotId: item.slotId, routineVersionId: item.routineVersionId })) }
    }
  });
  assert.equal(proposal.status, 'proposal');
  const capture = model.normalizeCapture({
    ...model.blankCapture(),
    routines: routineVersions.map((version, index) => ({
      routineId: version.routineId,
      ...scope,
      purposeKey: `purpose-${index + 1}`,
      currentVersionId: version.routineVersionId,
      createdAt: version.createdAt
    })),
    routineVersions,
    programs: [{
      programId: programVersion.programId,
      ...scope,
      purposeKey: 'canonical-program',
      status: 'active',
      latestVersionId: programVersion.programVersionId,
      activeVersionId: programVersion.programVersionId,
      createdAt: programVersion.createdAt,
      updatedAt: programVersion.createdAt
    }],
    programVersions: [programVersion],
    activeProgramVersionId: programVersion.programVersionId,
    sequenceState
  }, { ...scope, catalog });
  const originSlot = slots[nextSlotIndex];
  const originRoutine = routineVersions.find(version => version.routineVersionId === originSlot.routineVersionId);
  const activeWorkout = activeProgramWorkout ? {
    id: 'active-program-workout',
    type: 'Program',
    startedAt: evaluatedAt,
    exercises: [{ id: 'frozen', sets: [{ id: 'set-frozen', weight: 100, reps: 5, completed: false }] }],
    programOrigin: {
      contract: 'big-gains.program-origin.v1',
      ...scope,
      programId: programVersion.programId,
      programVersionId: programVersion.programVersionId,
      routineId: originRoutine.routineId,
      routineVersionId: originRoutine.routineVersionId,
      slotId: originSlot.slotId,
      slotIndex: nextSlotIndex,
      cycleNumber: 5,
      materializedAt: evaluatedAt
    }
  } : manualWorkout ? { id: 'manual-active', type: 'Push', startedAt: evaluatedAt, exercises: [{ id: 'manual', sets: [] }] } : null;
  const history = [{ id: 'history-old', completedAt: evaluatedAt, programOrigin: { programVersionId: programVersion.programVersionId } }];
  const state = { version: 5, profileId: scope.profileId, programCapture: capture, goals: { strengthGoals: [goal] }, activeWorkout, workouts: history, customRoutines: {}, weights: [], prs: {} };
  return { proposal, capture, goal, state, history, base: { source, destination, other, programVersion } };
}

function memoryPorts(initialState, proposal, mode = 'ok') {
  let raw = JSON.stringify(initialState);
  let commits = 0;
  return {
    ports: {
      readState: () => JSON.parse(raw),
      snapshotRaw: () => raw,
      commitState: next => {
        commits += 1;
        if (mode === 'throw-before') throw new Error('first write failed');
        raw = JSON.stringify(next);
        if (mode === 'throw-after') throw new Error('write reported failure');
        if (mode === 'mismatch') {
          const changed = JSON.parse(raw);
          changed.programCapture.applicationTraces = [];
          raw = JSON.stringify(changed);
        }
      },
      restoreRaw: snapshot => { raw = snapshot; },
      recomputeProposal: () => mode === 'stale-evidence' ? { status: 'unavailable' } : proposal
    },
    state: () => JSON.parse(raw),
    raw: () => raw,
    commits: () => commits
  };
}

function applyFixture(options = {}, portMode = 'ok', mutate = null) {
  const value = fixture(options);
  if (mutate) mutate(value);
  const memory = memoryPorts(value.state, value.proposal, portMode);
  const before = memory.raw();
  const result = application.apply({
    proposal: value.proposal,
    currentProgramCapture: value.capture,
    goals: value.state.goals,
    activeWorkout: value.state.activeWorkout,
    ...scope,
    now: appliedAt,
    ports: memory.ports
  });
  return { ...value, memory, before, result, after: memory.state() };
}

test('fresh 6-set proposal applies exact 3+3 successors and trace', () => {
  const value = applyFixture({ sets: 6 });
  assert.equal(value.result.status, 'applied');
  assert.deepEqual(value.result.trace.allocation, [3, 3]);
  assert.equal(value.after.programCapture.programVersions.length, 2);
  assert.equal(value.after.programCapture.routineVersions.length, 5);
  assert.equal(value.after.programCapture.applicationTraces.length, 1);
});

test('7 sets apply the exact deterministic 4+3 allocation', () => {
  assert.deepEqual(applyFixture({ sets: 7 }).result.trace.allocation, [4, 3]);
});

test('auxiliary variant preserves unrelated prescriptions and changes only the selected destination pin', () => {
  const value = applyFixture({ repeatedDestination: true });
  const capture = value.after.programCapture;
  const successor = capture.programVersions.find(version => version.programVersionId === value.result.newProgramVersionId);
  const unchangedRepeat = successor.slots.find(slot => slot.slotId === 'slot-destination-repeat');
  assert.equal(unchangedRepeat.routineVersionId, value.base.destination.routineVersionId);
  const destinationNew = capture.routineVersions.find(version => version.routineVersionId === successor.slots[1].routineVersionId);
  assert.deepEqual(destinationNew.exercises.filter(item => item.exerciseId !== bench.canonicalId), value.base.destination.exercises);
});

test('Routine and Program lineage is monotonic while immutable bases remain deep-equal', () => {
  const value = applyFixture();
  const capture = value.after.programCapture;
  assert.deepEqual(capture.routineVersions.slice(0, 3), value.capture.routineVersions);
  assert.deepEqual(capture.programVersions[0], value.capture.programVersions[0]);
  assert.ok(capture.routineVersions.slice(3).every(version => version.predecessorRoutineVersionId));
  assert.equal(capture.programVersions[1].predecessorProgramVersionId, value.base.programVersion.programVersionId);
  assert.equal(capture.programVersions[1].versionNumber, 2);
});

test('only required slot pins change and cadence, Goals, authority, anchors, and order are preserved', () => {
  const value = applyFixture({ repeatedDestination: true });
  const successor = value.after.programCapture.programVersions[1];
  const changed = successor.slots.filter((slot, index) => slot.routineVersionId !== value.base.programVersion.slots[index].routineVersionId);
  assert.deepEqual(changed.map(slot => slot.slotId), ['slot-source', 'slot-destination']);
  assert.equal(successor.programmingAuthority, 'review');
  assert.deepEqual(successor.priorityGoalIds, value.base.programVersion.priorityGoalIds);
  assert.deepEqual(successor.slots.map(slot => slot.preferredCalendarAnchor), value.base.programVersion.slots.map(slot => slot.preferredCalendarAnchor));
});

test('total Goal-exercise cycle sets and rep ranges remain unchanged', () => {
  const value = applyFixture({ sets: 7 });
  const capture = value.after.programCapture;
  const successor = capture.programVersions[1];
  const byId = new Map(capture.routineVersions.map(version => [version.routineVersionId, version]));
  const prescriptions = successor.slots.flatMap(slot => byId.get(slot.routineVersionId).exercises.filter(item => item.exerciseId === bench.canonicalId));
  assert.equal(prescriptions.reduce((sum, item) => sum + item.workingSets, 0), 7);
  assert.ok(prescriptions.every(item => item.repTarget.text === '4–6'));
});

for (const nextSlotIndex of [0, 1, 2]) {
  test(`approval without an active session preserves logical next slot ${nextSlotIndex}`, () => {
    const value = applyFixture({ nextSlotIndex });
    assert.equal(value.after.programCapture.sequenceState.nextSlotIndex, nextSlotIndex);
    assert.equal(value.after.programCapture.sequenceState.completedCycles, 4);
  });
}

for (const nextSlotIndex of [0, 1, 2]) {
  test(`active frozen session at slot ${nextSlotIndex} advances the successor only on completion`, () => {
    const value = applyFixture({ nextSlotIndex, activeProgramWorkout: true });
    const expected = (nextSlotIndex + 1) % 3;
    assert.equal(value.after.programCapture.sequenceState.nextSlotIndex, nextSlotIndex);
    assert.equal(value.after.programCapture.sequenceState.completedCycles, 4);
    assert.deepEqual(value.after.activeWorkout, value.state.activeWorkout);
    const completion = globalThis.BigGainsProgramOrigin.advanceCaptureForCompletion({
      capture: value.after.programCapture,
      programOrigin: value.after.activeWorkout.programOrigin,
      workoutId: value.after.activeWorkout.id,
      ...scope,
      catalog,
      completedAt: '2026-08-24T13:00:00.000Z'
    });
    assert.equal(completion.advanced, true);
    assert.equal(completion.reasonCode, 'SEQUENCE_ADVANCED_ON_FROZEN_PREDECESSOR_COMPLETION');
    assert.equal(completion.capture.sequenceState.nextSlotIndex, expected);
    assert.equal(completion.capture.sequenceState.completedCycles, nextSlotIndex === 2 ? 5 : 4);
  });
}

test('active final-slot approval wraps once without repeat or skip', () => {
  const value = applyFixture({ nextSlotIndex: 2, activeProgramWorkout: true });
  assert.deepEqual(value.result.futureEffectiveBoundary, {
    kind: 'next_unmaterialized_session',
    activeWorkoutIdAtAcceptance: 'active-program-workout',
    baseNextSlotIndex: 2,
    successorNextSlotIndex: 2,
    completedCycles: 4,
    activeProgramOriginCompletionPending: true
  });
  const completion = globalThis.BigGainsProgramOrigin.advanceCaptureForCompletion({
    capture: value.after.programCapture,
    programOrigin: value.after.activeWorkout.programOrigin,
    workoutId: value.after.activeWorkout.id,
    ...scope,
    catalog,
    completedAt: '2026-08-24T13:00:00.000Z'
  });
  assert.equal(completion.advanced, true);
  assert.equal(completion.capture.sequenceState.nextSlotIndex, 0);
  assert.equal(completion.capture.sequenceState.completedCycles, 5);
  const duplicate = globalThis.BigGainsProgramOrigin.advanceCaptureForCompletion({
    capture: completion.capture,
    programOrigin: value.after.activeWorkout.programOrigin,
    workoutId: value.after.activeWorkout.id,
    ...scope,
    catalog,
    completedAt: '2026-08-24T13:01:00.000Z'
  });
  assert.equal(duplicate.advanced, false);
  assert.deepEqual(duplicate.capture.sequenceState, completion.capture.sequenceState);
});

test('discarding the frozen predecessor session leaves the same successor slot due', () => {
  const value = applyFixture({ nextSlotIndex: 1, activeProgramWorkout: true });
  const materialized = globalThis.BigGainsProgramOrigin.materializeNext({
    capture: value.after.programCapture,
    ...scope,
    catalog,
    materializedAt: '2026-08-24T14:00:00.000Z'
  });
  assert.equal(materialized.slotIndex, 1);
  assert.equal(materialized.programOrigin.programVersionId, value.result.newProgramVersionId);
});

test('manual active Train remains byte/deep-equal and does not consume a Program slot', () => {
  const value = applyFixture({ nextSlotIndex: 1, manualWorkout: true });
  assert.deepEqual(value.after.activeWorkout, value.state.activeWorkout);
  assert.equal(value.after.programCapture.sequenceState.nextSlotIndex, 1);
});

test('new future materialization gets successor origin while old History retains base IDs', () => {
  const value = applyFixture();
  const materialized = globalThis.BigGainsProgramOrigin.materializeNext({
    capture: value.after.programCapture,
    ...scope,
    catalog,
    materializedAt: appliedAt
  });
  assert.equal(materialized.programOrigin.programVersionId, value.result.newProgramVersionId);
  assert.equal(value.after.workouts[0].programOrigin.programVersionId, value.base.programVersion.programVersionId);
});

test('completed History is deep-equal after approval', () => {
  const value = applyFixture();
  assert.deepEqual(value.after.workouts, value.history);
});

test('stale active Program version rejects with zero mutation', () => {
  const value = applyFixture({}, 'ok', item => { item.state.programCapture.activeProgramVersionId = 'newer'; });
  assert.equal(value.result.status, 'stale');
  assert.equal(value.memory.raw(), value.before);
});

test('stale Routine pin rejects with zero mutation', () => {
  const value = applyFixture({}, 'ok', item => { item.state.programCapture.programVersions[0].slots[0].routineVersionId = item.base.other.routineVersionId; });
  assert.equal(value.result.status, 'stale');
  assert.equal(value.memory.raw(), value.before);
});

for (const status of ['paused', 'archived']) {
  test(`${status} Goal rejects with zero mutation`, () => {
    const value = applyFixture({}, 'ok', item => { item.state.goals.strengthGoals[0].status = status; });
    assert.equal(value.result.status, 'stale');
    assert.equal(value.memory.raw(), value.before);
  });
}

test('unlinked Goal rejects with zero mutation', () => {
  const value = applyFixture({}, 'ok', item => { item.state.programCapture.programVersions[0].priorityGoalIds = []; });
  assert.equal(value.result.status, 'stale');
  assert.equal(value.memory.raw(), value.before);
});

test('changed exposure/set assumptions reject as stale with zero mutation', () => {
  const value = applyFixture({}, 'ok', item => { item.state.programCapture.routineVersions[0].exercises[0].workingSets = 5; });
  assert.equal(value.result.status, 'stale');
  assert.equal(value.memory.raw(), value.before);
});

test('changed evidence digest requires recomputation with zero mutation', () => {
  const value = applyFixture({}, 'stale-evidence');
  assert.equal(value.result.status, 'stale');
  assert.equal(value.memory.raw(), value.before);
});

test('unsupported proposal type is unavailable with zero mutation', () => {
  const value = fixture();
  const proposal = clone(value.proposal);
  proposal.proposalType = 'increase_exact_exercise_working_sets';
  const memory = memoryPorts(value.state, proposal);
  const before = memory.raw();
  const result = application.apply({ proposal, currentProgramCapture: value.capture, goals: value.state.goals, ...scope, now: appliedAt, ports: memory.ports });
  assert.equal(result.status, 'unavailable');
  assert.equal(memory.raw(), before);
});

for (const mode of ['throw-before', 'throw-after']) {
  test(`${mode} persistence failure restores the exact pre-state`, () => {
    const value = applyFixture({}, mode);
    assert.equal(value.result.status, 'failed');
    assert.equal(value.result.reasonCode, 'PERSISTENCE_COMMIT_FAILED');
    assert.equal(value.memory.raw(), value.before);
    assert.equal(value.result.diagnostics.rolledBack, true);
  });
}

test('readback mismatch rolls back exact pre-state and exposes no partial successor', () => {
  const value = applyFixture({}, 'mismatch');
  assert.equal(value.result.reasonCode, 'PERSISTENCE_READBACK_MISMATCH');
  assert.equal(value.memory.raw(), value.before);
});

test('double approval and exact retry create one successor set only', () => {
  const value = fixture();
  const memory = memoryPorts(value.state, value.proposal);
  const input = { proposal: value.proposal, currentProgramCapture: value.capture, goals: value.state.goals, ...scope, now: appliedAt, ports: memory.ports };
  const first = application.apply(input);
  const second = application.apply(input);
  assert.equal(first.status, 'applied');
  assert.equal(second.reasonCode, 'ALREADY_APPLIED');
  assert.equal(second.idempotent, true);
  assert.equal(memory.state().programCapture.programVersions.length, 2);
});

test('confirmed retry checks the persisted trace before production recomputation', () => {
  const value = fixture();
  const memory = memoryPorts(value.state, value.proposal);
  const input = { proposal: value.proposal, currentProgramCapture: value.capture, goals: value.state.goals, ...scope, now: appliedAt };
  assert.equal(application.apply({ ...input, ports: memory.ports }).status, 'applied');
  const retry = application.apply({
    ...input,
    ports: {
      ...memory.ports,
      commitState: () => { throw new Error('idempotent retry must not commit'); },
      restoreRaw: () => { throw new Error('idempotent retry must not roll back'); },
      recomputeProposal: () => ({ status: 'no_change' })
    }
  });
  assert.equal(retry.status, 'applied');
  assert.equal(retry.idempotent, true);
  assert.equal(retry.reasonCode, 'ALREADY_APPLIED');
});

test('retry after rolled-back failure may succeed exactly once', () => {
  const value = fixture();
  const failedMemory = memoryPorts(value.state, value.proposal, 'throw-after');
  const input = { proposal: value.proposal, currentProgramCapture: value.capture, goals: value.state.goals, ...scope, now: appliedAt };
  assert.equal(application.apply({ ...input, ports: failedMemory.ports }).status, 'failed');
  const retryMemory = memoryPorts(failedMemory.state(), value.proposal);
  assert.equal(application.apply({ ...input, ports: retryMemory.ports }).status, 'applied');
  assert.equal(retryMemory.state().programCapture.programVersions.length, 2);
});

test('profile/account isolation prevents cross-profile application', () => {
  const value = fixture();
  const memory = memoryPorts(value.state, value.proposal);
  const result = application.apply({ proposal: value.proposal, currentProgramCapture: value.capture, goals: value.state.goals, accountId: 'other', profileId: scope.profileId, now: appliedAt, ports: memory.ports });
  assert.equal(result.reasonCode, 'PROFILE_SCOPE_MISMATCH');
});

test('offline/local-only approval uses no network port and survives normalize/reload with trace', () => {
  const value = applyFixture();
  const reloaded = model.normalizeCapture(value.after.programCapture, { ...scope, catalog });
  assert.equal(reloaded.storageMode, 'local_only');
  assert.equal(reloaded.activeProgramVersionId, value.result.newProgramVersionId);
  assert.equal(reloaded.applicationTraces[0].proposalId, value.proposal.proposalId);
});

test('same deterministic application input produces stable plan IDs', () => {
  const value = fixture();
  const input = { proposal: value.proposal, currentProgramCapture: value.capture, goals: value.state.goals, activeWorkout: null, ...scope, now: appliedAt };
  const first = application.plan(input);
  const second = application.plan(input);
  assert.deepEqual(first, second);
  assert.equal(first.applicationId, second.applicationId);
});

test('application never mutates proposal, capture, Goals, active workout, or inputs', () => {
  const value = fixture({ activeProgramWorkout: true });
  const before = clone({ proposal: value.proposal, capture: value.capture, goals: value.state.goals, activeWorkout: value.state.activeWorkout });
  const memory = memoryPorts(value.state, value.proposal);
  application.apply({ proposal: value.proposal, currentProgramCapture: value.capture, goals: value.state.goals, activeWorkout: value.state.activeWorkout, ...scope, now: appliedAt, ports: memory.ports });
  assert.deepEqual({ proposal: value.proposal, capture: value.capture, goals: value.state.goals, activeWorkout: value.state.activeWorkout }, before);
});
