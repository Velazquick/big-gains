import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

await import('../goals-progression.js');

const engine = globalThis.BigGainsGoalsProgression;
const EXERCISE_ID = 'fe9b24dd-e6db-41d3-9395-596830a0a37a';
const CUTOFF = '2026-08-19T12:00:00.000Z';
const DAY_MS = 24 * 60 * 60 * 1000;

const goal = (overrides = {}) => ({
  goalId: 'goal-bench-250',
  accountId: 'local-jorge',
  profileId: 'jorge',
  exerciseId: EXERCISE_ID,
  metric: 'one_rep_max',
  targetValue: 250,
  unit: 'lb',
  targetBasis: 'combined_external_load',
  status: 'active',
  guidanceEnabled: true,
  policy: { id: 'strength_double_progression_v1', version: 1 },
  attainmentState: 'in_progress',
  ...overrides
});

const measurement = (overrides = {}) => ({
  canonicalExerciseId: EXERCISE_ID,
  contentRevision: 2,
  trackingModel: 'load_reps',
  loadSemantics: { loadBasis: 'total', resistanceSemantics: 'external' },
  repSemantics: 'bilateral_cycle',
  laterality: 'bilateral',
  ui: { loadLabel: 'Total weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' },
  analytics: { e1rmPermitted: true, e1rmLoadBasis: 'combined_external_load' },
  ...overrides
});

const routine = (overrides = {}) => ({
  source: 'saved_routine',
  exerciseId: EXERCISE_ID,
  workingSetCount: 4,
  targetReps: '4–6',
  ...overrides
});

const set = (enteredLoad, reps, overrides = {}) => ({
  setId: overrides.setId || `set-${enteredLoad}-${reps}`,
  enteredLoad,
  combinedExternalLoad: enteredLoad,
  reps,
  completed: true,
  warmup: false,
  ...overrides
});

const e1rmSet = (enteredLoad, reps, estimate, overrides = {}) => set(enteredLoad, reps, {
  estimated1RM: estimate,
  e1rm: {
    value: estimate,
    formulaId: 'epley',
    formulaVersion: 1,
    canonicalExerciseId: EXERCISE_ID,
    contentRevision: 2,
    loadBasis: 'combined_external_load',
    quality: 'exact_arithmetic'
  },
  ...overrides
});

function isoDaysAgo(days) {
  return new Date(Date.parse(CUTOFF) - days * DAY_MS).toISOString();
}

function exposure(id, daysAgo, sets, overrides = {}) {
  return {
    exposureId: id,
    workoutId: `workout-${id}`,
    accountId: 'local-jorge',
    profileId: 'jorge',
    completedAt: isoDaysAgo(daysAgo),
    exerciseId: EXERCISE_ID,
    unit: 'lb',
    loadBasis: 'combined_external_load',
    contentRevision: 2,
    sets,
    ...overrides
  };
}

const uniformSets = (load, reps, count = 4, prefix = `${load}-${reps}`) =>
  Array.from({ length: count }, (_, index) => set(load, reps, { setId: `${prefix}-${index + 1}` }));

const prior = (enteredLoad, targetReps, overrides = {}) => ({
  decisionId: `prior-${enteredLoad}-${targetReps}`,
  exerciseId: EXERCISE_ID,
  enteredLoad,
  unit: 'lb',
  loadBasis: 'combined_external_load',
  workingSetCount: 4,
  targetReps,
  issuedAt: isoDaysAgo(21),
  ...overrides
});

const input = (overrides = {}) => ({
  goal: goal(),
  measurement: measurement(),
  routine: routine(),
  evidence: [],
  priorDecision: null,
  evidenceCutoff: CUTOFF,
  loadability: { increment: 5 },
  ...overrides
});

test('G1-7.4/G1-9.1 golden A: 190 stays anchored while reps build inside 4–6', () => {
  const result = engine.resolve(input({ evidence: [
    exposure('recent-1', 2, uniformSets(190, 5, 4, 'a')),
    exposure('recent-2', 7, uniformSets(190, 5, 4, 'b')),
    exposure('recent-3', 14, uniformSets(190, 5, 4, 'c'))
  ] }));

  assert.equal(result.status, 'available');
  assert.equal(result.decisionCode, 'HOLD_LOAD_BUILD_REPS');
  assert.equal(result.reasonCode, 'BUILD_STRENGTH_VOLUME');
  assert.equal(result.recommendation.enteredLoad, 190);
  assert.deepEqual(result.recommendation.repTargets, [5, 5, 5, 5]);
  assert.match(result.explanation, /top of the range before adding load/);
  assert.equal(result.evidence.exposureCount, 3);
});

test('G1-7.7/G1-9.2 golden B: 190 × 6/6/6/6 earns exactly 195 × 4/4/4/4', () => {
  const result = engine.resolve(input({
    priorDecision: prior(190, 6),
    evidence: [exposure('top-complete', 1, uniformSets(190, 6))]
  }));

  assert.equal(result.decisionCode, 'INCREASE_LOAD');
  assert.equal(result.reasonCode, 'ADD_LOAD_RESET_REPS');
  assert.equal(result.recommendation.enteredLoad, 195);
  assert.deepEqual(result.recommendation.repTargets, [4, 4, 4, 4]);
  assert.match(result.explanation, /one valid load increment/);
});

test('G1-7.8/G1-9.3 golden C: one 195 × 4/4/3/3 attempt holds', () => {
  const result = engine.resolve(input({
    priorDecision: prior(195, 4),
    evidence: [exposure('partial', 1, [set(195, 4), set(195, 4), set(195, 3), set(195, 3)])]
  }));

  assert.equal(result.decisionCode, 'HOLD');
  assert.equal(result.reasonCode, 'HOLD_PARTIAL');
  assert.equal(result.recommendation.enteredLoad, 195);
  assert.deepEqual(result.recommendation.repTargets, [4, 4, 4, 4]);
});

test('G1-7.9/G1-9.3 golden D: two consecutive clear misses reduce one step only', () => {
  const miss = prefix => [set(195, 4, { setId: `${prefix}-1` }), set(195, 3, { setId: `${prefix}-2` }), set(195, 3, { setId: `${prefix}-3` }), set(195, 3, { setId: `${prefix}-4` })];
  const result = engine.resolve(input({
    priorDecision: prior(195, 4),
    evidence: [exposure('miss-2', 1, miss('b')), exposure('miss-1', 4, miss('a'))]
  }));

  assert.equal(result.decisionCode, 'DECREASE_LOAD');
  assert.equal(result.reasonCode, 'ADJUST_REPEATED_MISS');
  assert.equal(result.recommendation.enteredLoad, 190);
  assert.deepEqual(result.recommendation.repTargets, [4, 4, 4, 4]);
  assert.equal(result.evidence.priorOutcome.consecutiveClearMisses, 2);
});

test('G1-2.13/G1-8.6 golden E: e1RM crossing is estimated_reached context, never a load trigger', () => {
  const result = engine.resolve(input({
    priorDecision: prior(190, 5),
    evidence: [exposure('estimate-only', 1, [e1rmSet(215, 5, 251)])]
  }));

  assert.equal(result.reasonCode, 'USER_OVERRIDE_REVIEW');
  assert.equal(result.recommendation.enteredLoad, 190);
  assert.equal(result.attainment.status, 'estimated_reached');
  assert.equal(result.attainment.bestEstimate.value, 251);
  assert.match(result.attainment.explanation, /no qualifying target single/);
});

test('G1-2.14/G1-9.5 golden F: eligible 250 × 1 is achieved and stops prescribing', () => {
  const result = engine.resolve(input({ evidence: [exposure('target-single', 1, [e1rmSet(250, 1, 258)])] }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.decisionCode, 'UNAVAILABLE');
  assert.equal(result.reasonCode, 'ACHIEVED');
  assert.equal(result.recommendation, null);
  assert.equal(result.attainment.status, 'achieved');
  assert.deepEqual(result.attainment.evidenceRefs, [{ exposureId: 'target-single', setId: 'set-250-1' }]);
});

test('G1-2.8 golden G: guidance off returns an explicit unavailable result', () => {
  const result = engine.resolve(input({ goal: goal({ guidanceEnabled: false }) }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reasonCode, 'GUIDANCE_DISABLED');
  assert.equal(result.recommendation, null);
});

test('G1-2.7/G1-2.9/G1-2.10 golden H: inactive lifecycle states never recommend', () => {
  for (const status of ['paused', 'completed', 'archived']) {
    const result = engine.resolve(input({ goal: goal({ status, guidanceEnabled: true }) }));
    assert.equal(result.status, 'unavailable', status);
    assert.equal(result.reasonCode, 'GOAL_NOT_ACTIVE', status);
    assert.equal(result.recommendation, null, status);
  }
});

test('G1-8.4 golden I: evidence at the 42-day boundary is stale and requires baseline', () => {
  const result = engine.resolve(input({ evidence: [exposure('exact-boundary', 42, uniformSets(190, 5))] }));
  assert.equal(result.reasonCode, 'STALE_EVIDENCE');
  assert.equal(result.recommendation, null);
  assert.deepEqual(result.evidence.selectedExposureIds, []);
});

test('G1-8.11 golden J: one or two unambiguous exposures are used conservatively and disclosed', () => {
  for (const count of [1, 2]) {
    const evidence = Array.from({ length: count }, (_, index) => exposure(`sparse-${index}`, index + 1, uniformSets(190, 5, 4, `s${index}`)));
    const result = engine.resolve(input({ evidence }));
    assert.equal(result.status, 'available', String(count));
    assert.equal(result.reasonCode, 'BUILD_STRENGTH_VOLUME', String(count));
    assert.equal(result.evidence.exposureCount, count, String(count));
    assert.equal(result.evidence.confidence, count === 1 ? 'single_exposure' : 'limited');
  }
});

test('G1-8.12 golden J sparse branch: one isolated set cannot establish four-set capacity', () => {
  const result = engine.resolve(input({ evidence: [exposure('one-set', 1, [set(190, 5)])] }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reasonCode, 'ESTABLISH_BASELINE');
});

test('G1-1.3/G1-8.2 golden K/L: EKF and defensive measurement failures close the gate', () => {
  const invalidMeasurements = [
    measurement({ analytics: { e1rmPermitted: false, e1rmLoadBasis: null } }),
    measurement({ trackingModel: 'load_distance' }),
    measurement({ loadSemantics: { loadBasis: 'total', resistanceSemantics: 'machine_indicated' } }),
    measurement({ analytics: { e1rmPermitted: true, e1rmLoadBasis: 'effective_system_load' } })
  ];
  for (const invalid of invalidMeasurements) {
    const result = engine.resolve(input({ measurement: invalid }));
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reasonCode, 'MEASUREMENT_INCOMPATIBLE');
  }
});

test('G1-4.3/G1-4.4 golden M: explicit routine range has precedence through intersection', () => {
  const result = engine.resolve(input({
    routine: routine({ targetReps: '5–8' }),
    evidence: [exposure('routine-range', 1, uniformSets(190, 5))]
  }));
  assert.deepEqual(result.routine.requestedRepRange, { min: 5, max: 8 });
  assert.deepEqual(result.routine.effectiveRepRange, { min: 5, max: 6 });
  assert.deepEqual(result.recommendation.repRange, { min: 5, max: 6 });
});

test('G1-4.6 golden N: non-overlapping routine range returns structured conflict without mutation', () => {
  const savedRoutine = routine({ targetReps: '8–12' });
  const before = structuredClone(savedRoutine);
  const result = engine.resolve(input({ routine: savedRoutine }));
  assert.equal(result.status, 'conflict');
  assert.equal(result.decisionCode, 'CONFLICT');
  assert.equal(result.reasonCode, 'ROUTINE_CONFLICT');
  assert.equal(result.recommendation, null);
  assert.deepEqual(result.conflict, { reasonCode: 'ROUTINE_CONFLICT', explanation: result.explanation, routinePreserved: true });
  assert.deepEqual(savedRoutine, before);
});

test('G1-4.10/G1-7.14 golden O: missing set count never invents working sets', () => {
  for (const value of [undefined, null, 0, '']) {
    const result = engine.resolve(input({ routine: routine({ workingSetCount: value }) }));
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reasonCode, 'ROUTINE_STRUCTURE_REQUIRED');
    assert.equal(result.recommendation, null);
  }
});

test('G1-7.15 golden P: between-increment target rounds conservatively downward', () => {
  const result = engine.resolve(input({
    priorDecision: prior(192.5, 6),
    evidence: [exposure('unaligned-success', 1, uniformSets(192.5, 6))],
    loadability: { increment: 5, validLoads: [185, 190, 195, 200] }
  }));
  assert.equal(result.reasonCode, 'ADD_LOAD_RESET_REPS');
  assert.equal(result.recommendation.enteredLoad, 195);
  assert.ok(result.recommendation.enteredLoad < 197.5);
});

test('G1-6.3 golden Q: exact inputs produce byte-identical immutable output', () => {
  const exactInput = input({ evidence: [exposure('deterministic', 1, uniformSets(190, 5))] });
  const first = engine.resolve(exactInput);
  const second = engine.resolve(exactInput);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.recommendation), true);
});

test('G1-7.6: successful 5s add exactly one rep per set without changing load', () => {
  const result = engine.resolve(input({ priorDecision: prior(190, 5), evidence: [exposure('five-success', 1, uniformSets(190, 5))] }));
  assert.equal(result.reasonCode, 'ADD_REPS');
  assert.equal(result.decisionCode, 'HOLD_LOAD_BUILD_REPS');
  assert.equal(result.recommendation.enteredLoad, 190);
  assert.deepEqual(result.recommendation.repTargets, [6, 6, 6, 6]);
});

test('G1-7.5/G1-6.6: extra reps do not skip the one-action bound', () => {
  const result = engine.resolve(input({ priorDecision: prior(190, 5), evidence: [exposure('extra-reps', 1, uniformSets(190, 8))] }));
  assert.equal(result.reasonCode, 'ADD_REPS');
  assert.equal(result.recommendation.enteredLoad, 190);
  assert.deepEqual(result.recommendation.repTargets, [6, 6, 6, 6]);
});

test('G1-7.9: one clear miss holds, and exactly half below the floor is not a clear miss', () => {
  const cases = [
    [set(195, 4), set(195, 3), set(195, 3), set(195, 3)],
    [set(195, 4), set(195, 4), set(195, 3), set(195, 3)]
  ];
  for (const sets of cases) {
    const result = engine.resolve(input({ priorDecision: prior(195, 4), evidence: [exposure(`case-${sets[1].reps}`, 1, sets)] }));
    assert.equal(result.reasonCode, 'HOLD_PARTIAL');
    assert.equal(result.recommendation.enteredLoad, 195);
  }
});

test('G1-7.9/G1-7.10: an intervening override breaks consecutive clear misses', () => {
  const miss = [set(195, 4), set(195, 3), set(195, 3), set(195, 3)];
  const override = uniformSets(190, 4);
  const result = engine.resolve(input({
    priorDecision: prior(195, 4),
    evidence: [exposure('latest-miss', 1, miss), exposure('intervening-override', 2, override), exposure('older-miss', 3, miss)]
  }));
  assert.equal(result.reasonCode, 'HOLD_PARTIAL');
  assert.equal(result.recommendation.enteredLoad, 195);
});

test('G1-7.10/G1-10.6: latest different load is evidence but never an automatic rebase', () => {
  const result = engine.resolve(input({ priorDecision: prior(195, 4), evidence: [exposure('override', 1, uniformSets(205, 4))] }));
  assert.equal(result.reasonCode, 'USER_OVERRIDE_REVIEW');
  assert.equal(result.recommendation.enteredLoad, 195);
  assert.deepEqual(result.recommendation.repTargets, [4, 4, 4, 4]);
});

test('G1-8.1: warm-ups are excluded while four completed working sets establish the anchor', () => {
  const sets = [set(95, 8, { warmup: true, setId: 'warmup' }), ...uniformSets(190, 5)];
  const result = engine.resolve(input({ evidence: [exposure('warmup-plus-work', 1, sets)] }));
  assert.equal(result.status, 'available');
  assert.equal(result.recommendation.enteredLoad, 190);
  assert.equal(result.evidence.observations[0].sets.length, 4);
});

test('G1-7.8: incomplete logged sets hold the prior target', () => {
  const sets = [set(190, 5), set(190, 5), set(190, 5, { completed: false }), set(190, 5, { completed: false })];
  const result = engine.resolve(input({ priorDecision: prior(190, 5), evidence: [exposure('incomplete', 1, sets)] }));
  assert.equal(result.reasonCode, 'HOLD_PARTIAL');
  assert.deepEqual(result.evidence.priorOutcome, { kind: 'partial', exposureId: 'incomplete', completedWorkingSetCount: 2, recordedSetCount: 4 });
});

test('G1-8.2: blank, zero, and invalid entered load never become a recommendation', () => {
  for (const load of ['', 0, -5]) {
    const result = engine.resolve(input({ evidence: [exposure(`invalid-${String(load)}`, 1, uniformSets(load, 5))] }));
    assert.equal(result.status, 'unavailable');
    assert.equal(result.reasonCode, 'ESTABLISH_BASELINE');
  }
});

test('G1-8.4: duplicate logical exposure is deduped instead of double-weighted', () => {
  const original = exposure('same-id', 1, uniformSets(190, 5));
  const result = engine.resolve(input({ evidence: [original, structuredClone(original)] }));
  assert.equal(result.status, 'available');
  assert.equal(result.evidence.exposureCount, 1);
  assert.equal(result.evidence.confidence, 'single_exposure');
  assert.deepEqual(result.evidence.excluded, [{ exposureId: 'same-id', reasonCode: 'DUPLICATE_EXPOSURE' }]);
});

test('G1-6.3/G1-8.12: conflicting duplicate logical exposure fails closed', () => {
  const original = exposure('same-id', 1, uniformSets(190, 5));
  const conflict = structuredClone(original);
  conflict.sets[0].reps = 6;
  const result = engine.resolve(input({ evidence: [original, conflict] }));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.reasonCode, 'EVIDENCE_UNAVAILABLE');
});

test('G1-1.4/G1-12.5: alias identity and cross-profile evidence are excluded at the boundary', () => {
  const wrongIdentity = exposure('alias', 1, uniformSets(190, 5), { exerciseId: 'barbell-bench-press' });
  const wrongProfile = exposure('alexa', 2, uniformSets(190, 5), { profileId: 'alexa' });
  const result = engine.resolve(input({ evidence: [wrongIdentity, wrongProfile] }));
  assert.equal(result.reasonCode, 'ESTABLISH_BASELINE');
  assert.deepEqual(result.evidence.excluded, [
    { exposureId: 'alexa', reasonCode: 'SCOPE_MISMATCH' },
    { exposureId: 'alias', reasonCode: 'EXERCISE_MISMATCH' }
  ]);
});

test('G1-12.5: engine reads only supplied evidence and never mutates caller-owned inputs', () => {
  const supplied = input({ evidence: [exposure('immutable', 1, uniformSets(190, 5))] });
  const before = structuredClone(supplied);
  engine.resolve(supplied);
  assert.deepEqual(supplied, before);
});

test('G1-8.3: missing or incompatible unit/content basis fails closed', () => {
  const unitResult = engine.resolve(input({ measurement: measurement({ ui: { loadUnit: 'kg', loadStep: 2.5 } }) }));
  assert.equal(unitResult.reasonCode, 'MEASUREMENT_INCOMPATIBLE');

  const evidenceResult = engine.resolve(input({ evidence: [exposure('wrong-revision', 1, uniformSets(190, 5), { contentRevision: 1 })] }));
  assert.equal(evidenceResult.reasonCode, 'ESTABLISH_BASELINE');
  assert.deepEqual(evidenceResult.evidence.excluded, [{ exposureId: 'wrong-revision', reasonCode: 'MEASUREMENT_MISMATCH' }]);
});

test('G1-4.8: evidence after the exact cutoff is excluded', () => {
  const result = engine.resolve(input({ evidence: [exposure('future', -1, uniformSets(190, 5))] }));
  assert.equal(result.reasonCode, 'ESTABLISH_BASELINE');
  assert.deepEqual(result.evidence.excluded, [{ exposureId: 'future', reasonCode: 'AFTER_CUTOFF' }]);
});

test('G1-6.1/G1-7.15: missing loadability fails closed', () => {
  const noStepMeasurement = measurement({ ui: { loadUnit: 'lb' } });
  const result = engine.resolve(input({ measurement: noStepMeasurement, loadability: {} }));
  assert.equal(result.reasonCode, 'LOADABILITY_UNAVAILABLE');
  assert.equal(result.recommendation, null);
});

test('G1-7.15: an explicit valid-load sequence advances to its next value, never its last value', () => {
  const result = engine.resolve(input({
    priorDecision: prior(190, 6),
    evidence: [exposure('sequence', 1, uniformSets(190, 6))],
    loadability: { validLoads: [185, 190, 195, 200, 205] }
  }));
  assert.equal(result.recommendation.enteredLoad, 195);
});

test('G1-7.9/G1-7.15: a valid-load sequence without a uniform increment reduces to its nearest lower value', () => {
  const miss = [set(195, 4), set(195, 3), set(195, 3), set(195, 3)];
  const result = engine.resolve(input({
    priorDecision: prior(195, 4),
    evidence: [exposure('irregular-miss-new', 1, miss), exposure('irregular-miss-old', 2, miss)],
    loadability: { validLoads: [180, 187.5, 195, 202.5] }
  }));
  assert.equal(result.reasonCode, 'ADJUST_REPEATED_MISS');
  assert.equal(result.recommendation.enteredLoad, 187.5);
});

test('G1-4.4: exact routine target 5 advances load after success instead of leaving the routine range', () => {
  const result = engine.resolve(input({
    routine: routine({ targetReps: '5' }),
    priorDecision: prior(190, 5),
    evidence: [exposure('exact-five', 1, uniformSets(190, 5))]
  }));
  assert.equal(result.reasonCode, 'ADD_LOAD_RESET_REPS');
  assert.equal(result.recommendation.enteredLoad, 195);
  assert.deepEqual(result.recommendation.repTargets, [5, 5, 5, 5]);
});

test('G1-7.13: absent explicit rep detail uses 4–6 only when set count exists', () => {
  const result = engine.resolve(input({ routine: routine({ targetReps: '' }), evidence: [exposure('default-range', 1, uniformSets(190, 5))] }));
  assert.equal(result.routine.usedDefaultRepRange, true);
  assert.deepEqual(result.routine.effectiveRepRange, { min: 4, max: 6 });
});

test('G1-4.6: malformed nonblank routine rep structure is a conflict, not a default', () => {
  const result = engine.resolve(input({ routine: routine({ targetReps: 'about five' }) }));
  assert.equal(result.status, 'conflict');
  assert.equal(result.reasonCode, 'ROUTINE_CONFLICT');
});

test('G1-8.12: conflicting recent working loads do not fabricate a stable baseline', () => {
  const result = engine.resolve(input({ evidence: [
    exposure('latest', 1, uniformSets(195, 5)),
    exposure('older-a', 3, uniformSets(190, 5)),
    exposure('older-b', 5, uniformSets(185, 5))
  ] }));
  assert.equal(result.reasonCode, 'ESTABLISH_BASELINE');
});

test('G1-8.6: estimate crossing during comparable success still earns reps, not load', () => {
  const sets = Array.from({ length: 4 }, (_, index) => e1rmSet(215, 5, 251, { setId: `estimated-${index}` }));
  const result = engine.resolve(input({ priorDecision: prior(215, 5), evidence: [exposure('estimated-success', 1, sets)] }));
  assert.equal(result.attainment.status, 'estimated_reached');
  assert.equal(result.reasonCode, 'ADD_REPS');
  assert.equal(result.recommendation.enteredLoad, 215);
  assert.deepEqual(result.recommendation.repTargets, [6, 6, 6, 6]);
});

test('G1-8.10: noncanonical estimate metadata is ignored as attainment evidence', () => {
  const invalid = e1rmSet(215, 5, 251);
  invalid.e1rm.formulaId = 'custom';
  const result = engine.resolve(input({ evidence: [exposure('bad-formula', 1, [invalid])] }));
  assert.equal(result.attainment.status, 'in_progress');
  assert.equal(result.attainment.bestEstimate, null);
});

test('G1-2.9: preexisting achieved attainment defensively stops an active corrupted goal', () => {
  const result = engine.resolve(input({ goal: goal({ attainmentState: 'achieved' }) }));
  assert.equal(result.reasonCode, 'ACHIEVED');
  assert.equal(result.recommendation, null);
});

test('G1-2.14: performed target single remains achieved even when older than the progression window', () => {
  const result = engine.resolve(input({ evidence: [exposure('old-target-single', 100, [e1rmSet(250, 1, 258)])] }));
  assert.equal(result.reasonCode, 'ACHIEVED');
  assert.equal(result.attainment.status, 'achieved');
});

test('G1-8.4: only the last three eligible exposures enter the decision summary', () => {
  const evidence = Array.from({ length: 5 }, (_, index) => exposure(`recent-${index + 1}`, index + 1, uniformSets(190, 5, 4, `r${index}`)));
  const result = engine.resolve(input({ evidence }));
  assert.deepEqual(result.evidence.selectedExposureIds, ['recent-1', 'recent-2', 'recent-3']);
  assert.equal(result.evidence.exposureCount, 3);
  assert.deepEqual(result.evidence.excluded, [
    { exposureId: 'recent-4', reasonCode: 'BEYOND_RECENT_LIMIT' },
    { exposureId: 'recent-5', reasonCode: 'BEYOND_RECENT_LIMIT' }
  ]);
});

test('G1-6.3: equal timestamps are normalized by stable exposure identity, not caller order', () => {
  const a = exposure('a', 1, uniformSets(190, 5, 4, 'a'));
  const b = exposure('b', 1, uniformSets(190, 5, 4, 'b'));
  const first = engine.resolve(input({ evidence: [b, a] }));
  const second = engine.resolve(input({ evidence: [a, b] }));
  assert.deepEqual(first, second);
  assert.deepEqual(first.evidence.selectedExposureIds, ['a', 'b']);
});

test('G1-6.1: invalid prior target and unsupported policy fail closed', () => {
  const wrongPrior = engine.resolve(input({ priorDecision: prior(190, 5, { exerciseId: 'alias-id' }) }));
  assert.equal(wrongPrior.reasonCode, 'EVIDENCE_UNAVAILABLE');

  const wrongPolicy = engine.resolve(input({ goal: goal({ policy: { id: 'other', version: 1 } }) }));
  assert.equal(wrongPolicy.reasonCode, 'POLICY_UNSUPPORTED');
});

test('G1-7.9/G1-7.15: repeated misses fail closed when no lower valid load exists', () => {
  const miss = [set(195, 4), set(195, 3), set(195, 3), set(195, 3)];
  const result = engine.resolve(input({
    priorDecision: prior(195, 4),
    evidence: [exposure('miss-new', 1, miss), exposure('miss-old', 2, miss)],
    loadability: { increment: 5, validLoads: [195, 200] }
  }));
  assert.equal(result.reasonCode, 'LOADABILITY_UNAVAILABLE');
  assert.equal(result.recommendation, null);
});

test('G1-7.7/G1-7.15: top completion fails closed when no higher valid load exists', () => {
  const result = engine.resolve(input({
    priorDecision: prior(195, 6),
    evidence: [exposure('top-no-load', 1, uniformSets(195, 6))],
    loadability: { increment: 5, validLoads: [185, 190, 195] }
  }));
  assert.equal(result.reasonCode, 'LOADABILITY_UNAVAILABLE');
  assert.equal(result.recommendation, null);
});

const projectionRecommendation = (overrides = {}) => ({
  enteredLoad: 215,
  workingSetCount: 5,
  repTargets: [5, 5, 5, 5, 5],
  repRange: { min: 4, max: 6 },
  ...overrides
});

test('G1.1 trajectory: 215 × 5 projects only conditional double-progression transitions', () => {
  const result = engine.projectTrajectory({
    recommendation: projectionRecommendation(),
    loadability: { increment: 5 }
  });
  assert.equal(result.status, 'available');
  assert.deepEqual(result.current, { enteredLoad: 215, repTargets: [5, 5, 5, 5, 5], workingSetCount: 5, repRange: { min: 4, max: 6 } });
  assert.deepEqual(result.steps.map(step => [step.enteredLoad, step.repTargets[0], step.decisionCode]), [
    [215, 6, 'HOLD_LOAD_BUILD_REPS'],
    [220, 4, 'INCREASE_LOAD'],
    [220, 5, 'HOLD_LOAD_BUILD_REPS']
  ]);
  assert.match(result.condition, /all 5 sets at 6 reps/);
  assert.equal(result.conditional, true);
  assert.equal(JSON.stringify(result).includes('date'), false);
  assert.equal(JSON.stringify(result).includes('week'), false);
});

test('G1.1 trajectory: build-reps and add-load starting decisions change the first projection step', () => {
  const fromSixes = engine.projectTrajectory({
    recommendation: projectionRecommendation({ repTargets: [6, 6, 6, 6, 6] }),
    loadability: { increment: 5 }
  });
  const fromNewLoad = engine.projectTrajectory({
    recommendation: projectionRecommendation({ enteredLoad: 220, repTargets: [4, 4, 4, 4, 4] }),
    loadability: { increment: 5 }
  });
  assert.deepEqual([fromSixes.steps[0].enteredLoad, fromSixes.steps[0].repTargets[0]], [220, 4]);
  assert.deepEqual([fromNewLoad.steps[0].enteredLoad, fromNewLoad.steps[0].repTargets[0]], [220, 5]);
});

test('G1.1 deadline: absent date is No deadline and unknown cadence is Unclear', () => {
  const base = {
    evidenceCutoff: CUTOFF,
    targetValue: 315,
    currentEstimate: 251,
    recommendation: projectionRecommendation(),
    loadability: { increment: 5 }
  };
  assert.deepEqual(engine.deadlineOutlook(base), {
    status: 'no_deadline', label: 'No deadline', explanation: 'No target date is set.',
    requiredExposures: null, availableExposures: null, prescriptionChanged: false
  });
  const unclear = engine.deadlineOutlook({ ...base, targetDate: '2026-09-14' });
  assert.equal(unclear.status, 'unclear');
  assert.match(unclear.explanation, /will not invent a weekly cadence/);
  assert.equal(unclear.prescriptionChanged, false);
});

test('G1.1 deadline: reliable cadence yields deterministic Aggressive and On pace schedule math', () => {
  const aggressiveInput = {
    targetDate: '2026-09-14',
    evidenceCutoff: CUTOFF,
    targetValue: 315,
    currentEstimate: 251,
    exposuresPerWeek: 1,
    recommendation: projectionRecommendation(),
    loadability: { increment: 5 }
  };
  const before = structuredClone(aggressiveInput.recommendation);
  const aggressive = engine.deadlineOutlook(aggressiveInput);
  assert.equal(aggressive.status, 'aggressive');
  assert.equal(aggressive.availableExposures, 3);
  assert.ok(aggressive.requiredExposures > aggressive.availableExposures);
  assert.equal(aggressive.prescriptionChanged, false);
  assert.deepEqual(aggressiveInput.recommendation, before);

  const onPace = engine.deadlineOutlook({ ...aggressiveInput, targetValue: 255, exposuresPerWeek: 2 });
  assert.equal(onPace.status, 'on_pace');
  assert.ok(onPace.availableExposures >= onPace.requiredExposures);
});

test('G1.1 explainability helpers are deterministic, immutable, and never rewrite the resolver recommendation', () => {
  const trajectoryInput = { recommendation: projectionRecommendation(), loadability: { increment: 5 } };
  const firstPath = engine.projectTrajectory(trajectoryInput);
  const secondPath = engine.projectTrajectory(structuredClone(trajectoryInput));
  assert.deepEqual(firstPath, secondPath);
  assert.equal(Object.isFrozen(firstPath), true);
  assert.equal(Object.isFrozen(firstPath.steps[0]), true);

  const resolved = engine.resolve(input({ evidence: [exposure('unchanged-baseline', 1, uniformSets(215, 5, 5))], routine: routine({ workingSetCount: 5 }) }));
  const recommendationBefore = structuredClone(resolved.recommendation);
  engine.projectTrajectory({ recommendation: resolved.recommendation, loadability: { increment: 5 } });
  engine.deadlineOutlook({
    targetDate: '2026-09-14', evidenceCutoff: CUTOFF, targetValue: 315, currentEstimate: 251,
    exposuresPerWeek: 1, recommendation: resolved.recommendation, loadability: { increment: 5 }
  });
  assert.deepEqual(resolved.recommendation, recommendationBefore);
});

test('G1-3.2/G1-12.1/G1-12.4: module boundary contains no DOM, persistence, cloud, or session ownership', async () => {
  const source = await readFile(new URL('../goals-progression.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:document|localStorage|sessionStorage|fetch|Supabase)\b/);
  assert.doesNotMatch(source, /\b(?:saveState|persist|enqueue|activeWorkout|customRoutines)\b/);
  assert.match(source, /Object\.defineProperty\(scope, 'BigGainsGoalsProgression'/);
  assert.equal(Object.keys(engine).join(','), 'deadlineOutlook,projectTrajectory,resolve,policy,constants');
});
