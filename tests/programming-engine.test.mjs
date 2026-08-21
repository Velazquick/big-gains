import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

await import('../exercise-catalog.js');
await import('../program-analyzer.js');
await import('../programming-engine.js');

const catalog = globalThis.BigGainsExerciseCatalog;
const analyzer = globalThis.BigGainsProgramAnalyzer;
const engine = globalThis.BigGainsProgrammingEngine;
const bench = catalog.resolve('Barbell Bench Press');
const row = catalog.resolve('Barbell Row');
const squat = catalog.resolve('Back Squat');
const scope = { accountId: 'account-test', profileId: 'profile-test' };
const now = '2026-08-23T12:00:00.000Z';

function routine(id, label, exercises) {
  return {
    ...scope,
    routineId: `routine-${id}`,
    routineVersionId: `routine-version-${id}`,
    versionNumber: 1,
    predecessorRoutineVersionId: null,
    label,
    source: { kind: 'reviewed_rebuild', routineType: label },
    exercises: exercises.map((exercise, index) => ({
      exerciseId: exercise.exerciseId,
      sequence: index + 1,
      workingSets: exercise.workingSets,
      repTarget: { kind: 'range', text: exercise.repTarget || '4–6', min: 4, max: 6 },
      restSeconds: exercise.restSeconds ?? 180
    })),
    createdAt: '2026-07-01T12:00:00.000Z',
    effectiveAt: '2026-07-01T12:00:00.000Z',
    createdBy: 'user',
    approval: { kind: 'explicit_user', approvedAt: '2026-07-01T12:00:00.000Z' }
  };
}

function fixture({ sets = 6, repeatedDestination = false, benchExposures = 1, goalStatus = 'active', linked = true, labels = null } = {}) {
  const source = routine('source', labels?.source || 'Alpha', [
    { exerciseId: bench.canonicalId, workingSets: benchExposures === 2 ? Math.ceil(sets / 2) : sets },
    { exerciseId: row.canonicalId, workingSets: 2, repTarget: '8–10' }
  ]);
  const destinationExercises = [{ exerciseId: squat.canonicalId, workingSets: 4, repTarget: '5' }];
  if (benchExposures === 2) destinationExercises.push({ exerciseId: bench.canonicalId, workingSets: Math.floor(sets / 2) });
  const destination = routine('destination', labels?.destination || 'Beta', destinationExercises);
  const other = routine('other', labels?.other || 'Gamma', [{ exerciseId: row.canonicalId, workingSets: 3, repTarget: '8–10' }]);
  const routineVersions = [source, destination, other];
  const slot = (id, version, sequence) => ({
    slotId: `slot-${id}`,
    sequence,
    label: labels?.[`slot${sequence}`] || `Session ${sequence}`,
    preferredCalendarAnchor: null,
    routineId: version.routineId,
    routineVersionId: version.routineVersionId
  });
  const slots = [slot('source', source, 1), slot('destination', destination, 2), slot('other', other, 3)];
  if (repeatedDestination) slots.push(slot('destination-repeat', destination, 4));
  const goal = {
    ...scope,
    goalId: 'goal-bench',
    exerciseId: bench.canonicalId,
    metric: 'one_rep_max',
    targetValue: 250,
    unit: 'lb',
    targetBasis: bench.analytics.e1rmLoadBasis,
    targetDate: null,
    label: 'Bench 250',
    status: goalStatus,
    guidanceEnabled: true,
    policy: { id: 'strength_double_progression_v1', version: 1 },
    updatedAt: '2026-08-10T12:00:00.000Z'
  };
  const programVersion = {
    ...scope,
    programId: 'program-1',
    programVersionId: 'program-version-1',
    versionNumber: 1,
    predecessorProgramVersionId: null,
    name: 'Topology fixture',
    scheduleMode: 'rolling_cycle',
    cadencePolicy: { kind: 'rolling_cycle', advanceOn: 'completed_session' },
    duration: { mode: 'rolling', startsOn: '2026-07-01', endsOn: null },
    slots,
    blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4, onBoundary: 'review_required' },
    programmingAuthority: 'review',
    priorityGoalIds: linked ? [goal.goalId] : [],
    policyRefs: [],
    effectiveBoundary: { kind: 'next_unmaterialized_session', activeWorkoutIdAtAcceptance: null },
    createdAt: '2026-07-01T12:00:00.000Z',
    createdBy: 'user',
    versionNote: ''
  };
  const programAnalysis = analyzer.analyze({
    programVersion,
    routineVersions,
    catalog,
    goals: [goal],
    options: {
      programStatus: 'active',
      sequenceState: { programId: programVersion.programId, programVersionId: programVersion.programVersionId, nextSlotIndex: 0, completedCycles: 4, updatedAt: now }
    }
  });
  return { goal, programVersion, routineVersions, programAnalysis };
}

function exposures({ count = 4, cycles = [1, 2, 3, 4], reasons = [] } = {}) {
  const dates = ['2026-08-01T12:00:00.000Z', '2026-08-08T12:00:00.000Z', '2026-08-15T12:00:00.000Z', '2026-08-22T12:00:00.000Z'];
  return dates.slice(0, count).map((completedAt, index) => ({
    exposureId: `exposure-${index + 1}`,
    workoutId: `workout-${index + 1}`,
    ...scope,
    exerciseId: bench.canonicalId,
    completedAt,
    comparable: true,
    progressionReasonCode: reasons[index] || 'HOLD_PARTIAL',
    programProvenance: {
      programVersionId: 'program-version-1',
      routineVersionId: 'routine-version-source',
      slotId: 'slot-source',
      cycleNumber: cycles[index] ?? cycles.at(-1),
      cycleCompleted: true
    }
  }));
}

function input(options = {}) {
  const base = fixture(options);
  const evidence = options.exposures || exposures();
  const adjustmentEvent = { eventId: 'adjustment-1', reasonCode: 'ADJUST_REPEATED_MISS', issuedAt: '2026-08-09T12:00:00.000Z', adopted: true };
  const opportunityIds = options.opportunityIds || ['exposure-3', 'exposure-4'];
  return {
    ...base,
    goals: [base.goal],
    performanceEvidence: {
      contract: 'big-gains.program-performance-evidence.v1',
      availability: 'available',
      programVersionId: base.programVersion.programVersionId,
      evidenceCutoff: now,
      exposures: evidence
    },
    goalProgressionEvidence: {
      contract: 'big-gains.goals-progression-evidence.v1',
      goalId: base.goal.goalId,
      exerciseId: base.goal.exerciseId,
      policy: { id: 'strength_double_progression_v1', version: 1 },
      adjustmentEvents: [adjustmentEvent],
      postAdjustmentOpportunities: opportunityIds.map(exposureId => ({ exposureId, adjustmentEventId: adjustmentEvent.eventId }))
    },
    catalog,
    options: {
      goalId: base.goal.goalId,
      programStatus: 'active',
      evaluatedAt: now,
      compatibleDestinationSlotIds: ['slot-destination'],
      currentBase: {
        programVersionId: base.programVersion.programVersionId,
        goalId: base.goal.goalId,
        routinePins: base.programVersion.slots.map(slot => ({ slotId: slot.slotId, routineVersionId: slot.routineVersionId }))
      }
    }
  };
}

test('A healthy Bench progression at two exposures per cycle returns no_change', () => {
  const candidate = input({ benchExposures: 2, sets: 6, exposures: exposures({ reasons: ['HOLD_PARTIAL', 'HOLD_PARTIAL', 'HOLD_PARTIAL', 'ADD_REPS'] }) });
  const result = engine.evaluate(candidate);
  assert.equal(result.status, 'no_change');
  assert.equal(result.primaryReasonCode, 'PROGRESSION_HEALTHY_NO_CHANGE');
  assert.equal(result.operations.length, 0);
});

test('the consecutive stall window ignores progress older than the latest four comparable exposures', () => {
  const stalled = exposures();
  const olderProgress = {
    ...stalled[0],
    exposureId: 'exposure-older-progress',
    workoutId: 'workout-older-progress',
    completedAt: '2026-07-25T12:00:00.000Z',
    progressionReasonCode: 'ADD_REPS'
  };
  const result = engine.evaluate(input({ exposures: [olderProgress, ...stalled] }));
  assert.equal(result.status, 'proposal');
  assert.deepEqual(result.experimentalTrace.stallEvidenceExposureIds, ['exposure-4', 'exposure-3', 'exposure-2', 'exposure-1']);
});

test('B one bad workout retains the current Program', () => {
  const result = engine.evaluate(input({ exposures: exposures({ count: 1 }) }));
  assert.equal(result.status, 'no_change');
  assert.equal(result.primaryReasonCode, 'SINGLE_EXPOSURE_NO_PROGRAM_CHANGE');
  assert.ok(result.reasonCodes.includes('STALL_THRESHOLD_NOT_MET'));
});

test('C four stalls mapped to only one completed Program cycle are unavailable', () => {
  const result = engine.evaluate(input({ exposures: exposures({ cycles: [1, 1, 1, 1] }) }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.primaryReasonCode, 'PROGRAM_CYCLES_NOT_MET');
  assert.equal(result.reasonCodes.includes('BLOCK_PROVENANCE_UNAVAILABLE'), false);
});

test('D fewer than two post-adjustment opportunities are unavailable', () => {
  const result = engine.evaluate(input({ opportunityIds: ['exposure-4'] }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.primaryReasonCode, 'POST_ADJUSTMENT_OPPORTUNITIES_NOT_MET');
});

for (const [label, total, allocation] of [['E', 6, [3, 3]], ['F', 7, [4, 3]], ['G', 5, [3, 2]]]) {
  test(`${label} ${total} sets redistribute volume-neutrally to ${allocation.join('+')}`, () => {
    const result = engine.evaluate(input({ sets: total }));
    assert.equal(result.status, 'proposal');
    assert.equal(result.beforeExposureCount, 1);
    assert.equal(result.afterExposureCount, 2);
    assert.equal(result.totalCycleWorkingSetsBefore, total);
    assert.equal(result.totalCycleWorkingSetsAfter, total);
    assert.deepEqual(result.perExposureSetAllocation.map(item => item.workingSets), allocation);
    assert.equal(result.approval.userApprovalRequired, true);
    assert.equal(result.approval.authorityCeiling, 'review');
    assert.equal(result.approval.applicationAvailable, false);
  });
}

test('H redistribution that violates the Routine minimum is unavailable', () => {
  const result = engine.evaluate(input({ sets: 1 }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.primaryReasonCode, 'VOLUME_NEUTRAL_ALLOCATION_INVALID');
});

test('I a repeated destination pin creates only the necessary auxiliary variant and preserves unrelated exercises', () => {
  const candidate = input({ repeatedDestination: true });
  const destinationBefore = candidate.routineVersions.find(version => version.routineVersionId === 'routine-version-destination');
  const result = engine.evaluate(candidate);
  assert.equal(result.status, 'proposal');
  assert.equal(result.auxiliaryRoutineVariantRequired, true);
  assert.deepEqual(result.operations.map(operation => operation.operationType), [
    'redistribute_exact_exercise_exposure',
    'create_routine_variant_for_typed_change'
  ]);
  const destinationAfter = result.proposedSuccessorGraph.routineSuccessors.find(version => version.source.auxiliaryVariant);
  assert.deepEqual(destinationAfter.exercises.filter(exercise => exercise.exerciseId !== bench.canonicalId), destinationBefore.exercises);
  const unchangedRepeat = result.proposedSuccessorGraph.programSuccessor.slots.find(slot => slot.slotId === 'slot-destination-repeat');
  assert.equal(unchangedRepeat.routineVersionId, destinationBefore.routineVersionId);
});

test('J an aggressive deadline cannot override healthy progression', () => {
  const candidate = input({ exposures: exposures({ reasons: ['HOLD_PARTIAL', 'HOLD_PARTIAL', 'HOLD_PARTIAL', 'ADD_LOAD_RESET_REPS'] }) });
  candidate.goals[0].targetDate = '2026-08-24';
  const result = engine.evaluate(candidate);
  assert.equal(result.status, 'no_change');
  assert.equal(result.primaryReasonCode, 'PROGRESSION_HEALTHY_NO_CHANGE');
  assert.ok(result.reasonCodes.includes('DEADLINE_DOES_NOT_CHANGE_PRESCRIPTION'));
});

test('K an inactive or unlinked Goal cannot produce a proposal', () => {
  const inactive = engine.evaluate(input({ goalStatus: 'paused' }));
  const unlinked = engine.evaluate(input({ linked: false }));
  assert.equal(inactive.status, 'unavailable');
  assert.equal(unlinked.status, 'unavailable');
  assert.equal(inactive.primaryReasonCode, 'GOAL_NOT_LINKED_OR_INACTIVE');
  assert.equal(unlinked.primaryReasonCode, 'GOAL_NOT_LINKED_OR_INACTIVE');
});

test('L a stale current base fails closed', () => {
  const candidate = input();
  candidate.options.currentBase.programVersionId = 'program-version-newer';
  const result = engine.evaluate(candidate);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.primaryReasonCode, 'STALE_BASE');
});

test('M identical inputs return deeply equal immutable output', () => {
  const candidate = input();
  const first = engine.evaluate(candidate);
  const second = engine.evaluate(candidate);
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.operations), true);
  assert.equal(Object.isFrozen(first.proposedSuccessorGraph), true);
});

test('N evaluation does not mutate inputs', () => {
  const candidate = input();
  const before = JSON.stringify(candidate, (key, value) => typeof value === 'function' ? `[function:${key}]` : value);
  engine.evaluate(candidate);
  const after = JSON.stringify(candidate, (key, value) => typeof value === 'function' ? `[function:${key}]` : value);
  assert.equal(after, before);
});

test('O arbitrary labels and non-PPL topology obey the same exact-content rules', () => {
  const result = engine.evaluate(input({ labels: { source: 'Orion', destination: 'Tide', other: 'Quartz', slot1: 'North', slot2: 'Blue', slot3: '???' } }));
  assert.equal(result.status, 'proposal');
  assert.deepEqual(result.perExposureSetAllocation.map(item => item.workingSets), [3, 3]);
});

test('P -1 exposure is absent from PE-1A and fails as unsupported', () => {
  const candidate = input();
  candidate.options.exposureDelta = -1;
  const result = engine.evaluate(candidate);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.primaryReasonCode, 'EXPOSURE_DIRECTION_UNSUPPORTED');
  assert.ok(result.reasonCodes.includes('VOLUME_REDUCTION_EVIDENCE_UNAVAILABLE'));
  assert.equal(result.operations.length, 0);
});

test('missing explicit Program-origin cycle metadata fails closed', () => {
  const candidate = input();
  delete candidate.performanceEvidence.exposures[0].programProvenance;
  const result = engine.evaluate(candidate);
  assert.equal(result.status, 'unavailable');
  assert.equal(result.primaryReasonCode, 'BLOCK_PROVENANCE_UNAVAILABLE');
});

test('stale-base checker verifies complete pins and Goal identity', () => {
  const result = engine.evaluate(input());
  const current = {
    programVersionId: result.baseProgramVersionId,
    routinePins: result.baseRoutinePins,
    goalId: result.targetScope.goalId,
    goalExerciseId: result.targetScope.exerciseId,
    goalStatus: 'active',
    goalUpdatedAt: '2026-08-10T12:00:00.000Z'
  };
  assert.deepEqual(engine.checkStaleBase(result, current), { status: 'current', reasonCode: 'BASE_CURRENT', mismatches: [], recomputeRequired: false });
  current.routinePins = current.routinePins.slice(1);
  assert.equal(engine.checkStaleBase(result, current).reasonCode, 'STALE_BASE');
});

test('the pure engine owns no DOM, persistence, Supabase, or network behavior', async () => {
  const source = await readFile(new URL('../programming-engine.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bdocument\b|localStorage|sessionStorage|indexedDB|XMLHttpRequest|\bfetch\s*\(|\bsupabase\b/i);
});
