import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

await import('../program-analyzer.js');

const analyzer = globalThis.BigGainsProgramAnalyzer;
const ACCOUNT = 'account-jorge';
const PROFILE = 'jorge';
const IDS = Object.freeze({
  bench: '10000000-0000-4000-8000-000000000001',
  row: '10000000-0000-4000-8000-000000000002',
  squat: '10000000-0000-4000-8000-000000000003',
  press: '10000000-0000-4000-8000-000000000004',
  curl: '10000000-0000-4000-8000-000000000005',
  hinge: '10000000-0000-4000-8000-000000000006',
  deadlift: '10000000-0000-4000-8000-000000000007',
  unknown: '10000000-0000-4000-8000-000000000008'
});

const definitions = [
  { canonicalId: IDS.bench, name: 'Bench Press', muscleRoles: { primary: ['Chest'], secondary: ['Triceps'], stabilizer: [] }, movementPatterns: ['horizontal_push'] },
  { canonicalId: IDS.row, name: 'Cable Row', muscleRoles: { primary: ['Back'], secondary: ['Biceps'], stabilizer: [] }, movementPatterns: ['horizontal_pull'] },
  { canonicalId: IDS.squat, name: 'Back Squat', muscleRoles: { primary: ['Quadriceps', 'Glutes'], secondary: ['Core'], stabilizer: [] }, movementPatterns: ['squat'] },
  { canonicalId: IDS.press, name: 'Overhead Press', muscleRoles: { primary: ['Shoulders'], secondary: ['Triceps'], stabilizer: [] }, movementPatterns: ['vertical_push'] },
  { canonicalId: IDS.curl, name: 'Cable Curl', muscleRoles: { primary: ['Biceps'], secondary: [], stabilizer: [] }, movementPatterns: ['elbow_flexion'] },
  { canonicalId: IDS.hinge, name: 'Romanian Deadlift', muscleRoles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Back'], stabilizer: [] }, movementPatterns: ['hinge'] },
  { canonicalId: IDS.deadlift, name: 'Deadlift', muscleRoles: { primary: ['Hamstrings', 'Glutes'], secondary: ['Back'], stabilizer: [] }, movementPatterns: ['hinge'] },
  { canonicalId: IDS.unknown, name: 'Catalog Mystery', programmingTags: [] }
];
const definitionById = new Map(definitions.map(definition => [definition.canonicalId, definition]));
const catalog = Object.freeze({
  canonicalIdFor: value => typeof value === 'string' && definitionById.has(value) ? value : null,
  getById: value => definitionById.get(value) || null
});

const prescription = (exerciseId, workingSets, repTarget = '', restSeconds = null) => ({
  exerciseId,
  workingSets,
  repTarget: typeof repTarget === 'object' ? repTarget : { kind: repTarget ? 'text' : 'unspecified', text: repTarget },
  restSeconds
});

const routineVersion = (id, label, exercises, overrides = {}) => ({
  routineVersionId: `version-${id}`,
  routineId: `routine-${id}`,
  accountId: ACCOUNT,
  profileId: PROFILE,
  versionNumber: 1,
  label,
  exercises,
  ...overrides
});

const slot = (position, routine, label = routine.label, weekday = null) => ({
  slotId: `slot-${position}`,
  sequence: position,
  label,
  preferredCalendarAnchor: weekday == null ? null : { weekday },
  routineId: routine.routineId,
  routineVersionId: routine.routineVersionId
});

const programVersion = (id, slots, overrides = {}) => ({
  programVersionId: `program-version-${id}`,
  programId: `program-${id}`,
  accountId: ACCOUNT,
  profileId: PROFILE,
  versionNumber: 1,
  name: `${id} Program`,
  scheduleMode: 'rolling_cycle',
  cadencePolicy: { kind: 'rolling_cycle', advanceOn: 'completed_session' },
  duration: { mode: 'rolling', startsOn: '2026-08-20', endsOn: null },
  slots,
  blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4, onBoundary: 'review_required' },
  programmingAuthority: 'review',
  priorityGoalIds: [],
  effectiveBoundary: { kind: 'next_unmaterialized_session', activeWorkoutIdAtAcceptance: null },
  createdAt: '2026-08-20T12:00:00.000Z',
  createdBy: 'user',
  ...overrides
});

const goal = (goalId, exerciseId, overrides = {}) => ({
  goalId,
  accountId: ACCOUNT,
  profileId: PROFILE,
  exerciseId,
  status: 'active',
  ...overrides
});

function pplFixture() {
  const push = routineVersion('push', 'Push', [
    prescription(IDS.bench, 3, { kind: 'range', text: '4–6', min: 4, max: 6 }, 180),
    prescription(IDS.press, 2, '8')
  ]);
  const pull = routineVersion('pull', 'Pull', [
    prescription(IDS.row, 4, '8–10', 150),
    prescription(IDS.curl, 3, '')
  ]);
  const legs = routineVersion('legs', 'Legs/Core', [
    prescription(IDS.squat, 5, '5', 210)
  ]);
  const routineVersions = [push, pull, legs];
  const slots = [push, pull, legs, push, pull, legs].map((routine, index) => slot(index + 1, routine, routine.label, index + 1));
  const goals = [goal('goal-bench', IDS.bench), goal('goal-deadlift', IDS.deadlift), goal('goal-unlinked', IDS.unknown)];
  return {
    programVersion: programVersion('ppl', slots, { priorityGoalIds: ['goal-bench', 'goal-deadlift'] }),
    routineVersions,
    catalog,
    goals,
    options: {
      programStatus: 'active',
      sequenceState: {
        programId: 'program-ppl',
        programVersionId: 'program-version-ppl',
        nextSlotIndex: 2,
        completedCycles: 1,
        updatedAt: '2026-08-20T13:00:00.000Z'
      }
    }
  };
}

function anteriorPosteriorFixture() {
  const anterior = routineVersion('anterior', 'Solar', [prescription(IDS.bench, 3, '5'), prescription(IDS.squat, 4, '8')]);
  const posterior = routineVersion('posterior', 'Lunar', [prescription(IDS.row, 3, '8–10'), prescription(IDS.hinge, 4, '6')]);
  const slots = [anterior, posterior, anterior, posterior].map((routine, index) => slot(index + 1, routine, `Session ${String.fromCharCode(81 + index)}`));
  return { programVersion: programVersion('ap', slots), routineVersions: [anterior, posterior], catalog, goals: [] };
}

function upperLowerFixture() {
  const upperA = routineVersion('upper-a', 'Upper A', [prescription(IDS.bench, 3, '5'), prescription(IDS.row, 3, '8')]);
  const lowerA = routineVersion('lower-a', 'Lower A', [prescription(IDS.squat, 4, '6')]);
  const upperB = routineVersion('upper-b', 'Upper B', [prescription(IDS.bench, 4, '8'), prescription(IDS.press, 2, '10')]);
  const lowerB = routineVersion('lower-b', 'Lower B', [prescription(IDS.hinge, 5, '6–8')]);
  const routines = [upperA, lowerA, upperB, lowerB];
  return { programVersion: programVersion('ul', routines.map((routine, index) => slot(index + 1, routine))), routineVersions: routines, catalog, goals: [] };
}

const exposure = (analysis, exerciseId) => analysis.exerciseExposure.find(item => item.exerciseId === exerciseId);
const muscle = (analysis, role, name) => analysis.muscleExposure[role].find(item => item.name === name);

test('PPL golden fixture reports six slots, routine reuse, exact exposure, goal spacing, roles, and block progress', () => {
  const analysis = analyzer.analyze(pplFixture());
  assert.equal(analysis.status, 'available');
  assert.deepEqual(analysis.topology.routineSlotCounts.map(item => [item.label, item.count]), [['Push', 2], ['Pull', 2], ['Legs/Core', 2]]);
  assert.equal(analysis.topology.totalSlotsPerCycle, 6);
  assert.equal(analysis.topology.uniqueRoutineVersionsUsed, 3);
  assert.deepEqual(analysis.topology.rollingSequence.map(item => item.label), ['Push', 'Pull', 'Legs/Core', 'Push', 'Pull', 'Legs/Core']);
  assert.equal(analysis.topology.preferredCalendar.availability, 'reliable');

  const bench = exposure(analysis, IDS.bench);
  assert.deepEqual({ exposures: bench.exposuresPerCycle, sets: bench.workingSetsPerCycle, positions: bench.slots.map(item => item.position), distances: bench.slotDistances, days: bench.nominalCalendarDayGaps }, {
    exposures: 2, sets: 6, positions: [1, 4], distances: [3, 3], days: [3, 4]
  });
  assert.deepEqual(bench.repTargets, [{ kind: 'range', text: '4–6', min: 4, max: 6, exposures: 2, workingSets: 6 }]);
  assert.deepEqual(bench.restPrescriptions, [{ restSeconds: 180, exposures: 2, workingSets: 6 }]);
  assert.equal(muscle(analysis, 'primary', 'Chest').workingSets, 6);
  assert.equal(muscle(analysis, 'secondary', 'Triceps').workingSets, 10);
  assert.equal(muscle(analysis, 'primary', 'Quadriceps').workingSets, 10);

  assert.deepEqual(analysis.goalExposure.map(item => ({ id: item.goalId, representation: item.representation, exposures: item.exposuresPerCycle, sets: item.workingSetsPerCycle, spacing: item.slotDistances })), [
    { id: 'goal-bench', representation: 'represented', exposures: 2, sets: 6, spacing: [3, 3] },
    { id: 'goal-deadlift', representation: 'not_represented', exposures: 0, sets: 0, spacing: [] }
  ]);
  assert.equal(analysis.goalExposure.some(item => item.goalId === 'goal-unlinked'), false);
  assert.deepEqual(analysis.blockContext.progress, {
    availability: 'available', completedCycles: 1, nextSlotPosition: 3, completedSlotsInCurrentCycle: 2,
    remainingSlotsInCurrentCycle: 4, updatedAt: '2026-08-20T13:00:00.000Z',
    boundaryProgress: { completed: 1, remaining: 3, reached: false }
  });
});

test('Anterior/Posterior golden fixture is label-agnostic and aggregates the same contract', () => {
  const analysis = analyzer.analyze(anteriorPosteriorFixture());
  assert.equal(analysis.status, 'available');
  assert.deepEqual(analysis.topology.rollingSequence.map(item => item.label), ['Session Q', 'Session R', 'Session S', 'Session T']);
  assert.deepEqual(analysis.topology.routineSlotCounts.map(item => item.count), [2, 2]);
  assert.deepEqual({ bench: [exposure(analysis, IDS.bench).exposuresPerCycle, exposure(analysis, IDS.bench).workingSetsPerCycle], row: [exposure(analysis, IDS.row).exposuresPerCycle, exposure(analysis, IDS.row).workingSetsPerCycle] }, {
    bench: [2, 6], row: [2, 6]
  });
  assert.deepEqual(exposure(analysis, IDS.hinge).slotDistances, [2, 2]);
  assert.equal(muscle(analysis, 'primary', 'Glutes').workingSets, 16);
});

test('Upper/Lower A/B golden fixture keeps four unique versions and aggregates across non-identical sessions', () => {
  const analysis = analyzer.analyze(upperLowerFixture());
  const bench = exposure(analysis, IDS.bench);
  assert.equal(analysis.topology.totalSlotsPerCycle, 4);
  assert.equal(analysis.topology.uniqueRoutineVersionsUsed, 4);
  assert.deepEqual(analysis.topology.routineSlotCounts.map(item => item.count), [1, 1, 1, 1]);
  assert.deepEqual({ exposures: bench.exposuresPerCycle, sets: bench.workingSetsPerCycle, routines: bench.routineVersionIds, spacing: bench.slotDistances }, {
    exposures: 2,
    sets: 7,
    routines: ['version-upper-a', 'version-upper-b'],
    spacing: [2, 2]
  });
});

test('linked Goal absent from Program is a factual gap while an unlinked absent Goal is ignored', () => {
  const fixture = pplFixture();
  fixture.programVersion.priorityGoalIds = ['goal-deadlift'];
  const analysis = analyzer.analyze(fixture);
  assert.deepEqual(analysis.goalExposure, [{
    goalId: 'goal-deadlift', lifecycle: 'active', exerciseId: IDS.deadlift, name: 'Deadlift', representation: 'not_represented',
    exposuresPerCycle: 0, workingSetsPerCycle: 0, slotPositions: [], slotDistances: [], nominalCalendarDayGaps: null
  }]);
});

test('malformed pinned Routine reference fails closed with a structured error and no partial metrics', () => {
  const fixture = pplFixture();
  fixture.programVersion.slots[4].routineVersionId = 'missing-version';
  const analysis = analyzer.analyze(fixture);
  assert.equal(analysis.status, 'unavailable');
  assert.deepEqual(analysis.errors, [{ code: 'PINNED_ROUTINE_VERSION_NOT_FOUND', path: 'programVersion.slots[4].routineVersionId', details: 'missing-version' }]);
  assert.equal(analysis.exerciseExposure, null);
});

test('missing EKF taxonomy is preserved in unknown muscle and movement buckets without name inference', () => {
  const mystery = routineVersion('mystery', 'Press-like arbitrary label', [prescription(IDS.unknown, 3, '')]);
  const analysis = analyzer.analyze({ programVersion: programVersion('mystery', [slot(1, mystery, 'Squat-looking label')]), routineVersions: [mystery], catalog });
  assert.equal(analysis.status, 'available');
  assert.deepEqual(analysis.muscleExposure.unknown, [{ exerciseId: IDS.unknown, name: 'Catalog Mystery', workingSets: 3, exposures: 1, missingRoles: ['primary', 'secondary'] }]);
  assert.deepEqual(analysis.movementExposure, [{ name: 'unknown', workingSets: 3, exerciseExposures: 1, slotsExposed: 1, contributingExercises: [{ exerciseId: IDS.unknown, name: 'Catalog Mystery', workingSets: 3, exposures: 1 }] }]);
  assert.deepEqual(analysis.prescriptionSummary.repTargets, [{ kind: 'unavailable', text: null, min: null, max: null, exposures: 1, workingSets: 3, exercises: 1 }]);
  assert.deepEqual(analysis.prescriptionSummary.restSeconds, [{ restSeconds: null, exposures: 1, workingSets: 3, exercises: 1 }]);
});

test('exact same inputs produce deep-equal immutable output', () => {
  const fixture = pplFixture();
  const first = analyzer.analyze(fixture);
  const second = analyzer.analyze(fixture);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.exerciseExposure[0].slots[0]), true);
});

test('analyzer never mutates Program, Routine, Goal, catalog, or options inputs', () => {
  const fixture = pplFixture();
  const before = structuredClone({ programVersion: fixture.programVersion, routineVersions: fixture.routineVersions, goals: fixture.goals, options: fixture.options });
  analyzer.analyze(fixture);
  assert.deepEqual({ programVersion: fixture.programVersion, routineVersions: fixture.routineVersions, goals: fixture.goals, options: fixture.options }, before);
});

test('Program authority Off and Review yield identical structural analysis', () => {
  const review = pplFixture();
  const off = pplFixture();
  off.programVersion.programmingAuthority = 'off';
  assert.deepEqual(analyzer.analyze(off), analyzer.analyze(review));
});

test('rolling spacing includes wrap-around distance exactly', () => {
  const repeated = routineVersion('repeated', 'Arbitrary', [prescription(IDS.bench, 2, '5')]);
  const filler = routineVersion('filler', 'Anything', [prescription(IDS.row, 2, '8')]);
  const slots = [filler, repeated, filler, repeated, filler, filler].map((routine, index) => slot(index + 1, routine));
  const analysis = analyzer.analyze({ programVersion: programVersion('spacing', slots), routineVersions: [repeated, filler], catalog });
  assert.deepEqual(exposure(analysis, IDS.bench).slotDistances, [2, 4]);
  assert.deepEqual(exposure(analysis, IDS.row).slotDistances, [2, 2, 1, 1]);
});

test('same exercise twice in one Routine is rejected by the current Routine contract', () => {
  const duplicate = routineVersion('duplicate', 'Duplicate', [prescription(IDS.bench, 3, '5'), prescription(IDS.bench, 2, '8')]);
  const analysis = analyzer.analyze({ programVersion: programVersion('duplicate', [slot(1, duplicate)]), routineVersions: [duplicate], catalog });
  assert.equal(analysis.status, 'unavailable');
  assert.equal(analysis.errors.some(item => item.code === 'DUPLICATE_EXERCISE_IN_ROUTINE'), true);
});

test('cross-profile Routine references fail closed and archived Programs remain analyzable without current progress', () => {
  const fixture = upperLowerFixture();
  fixture.routineVersions[0].profileId = 'alexa';
  assert.equal(analyzer.analyze(fixture).errors.some(item => item.code === 'ROUTINE_SCOPE_MISMATCH'), true);

  const archived = upperLowerFixture();
  archived.options = { programStatus: 'archived', sequenceState: { programId: 'program-ul', programVersionId: 'program-version-ul', nextSlotIndex: 1, completedCycles: 2 } };
  const analysis = analyzer.analyze(archived);
  assert.equal(analysis.status, 'available');
  assert.deepEqual(analysis.blockContext.progress, { availability: 'unavailable', reasonCode: 'EXPLICIT_SEQUENCE_PROGRESS_UNAVAILABLE' });
});

test('pure analyzer module contains no DOM, persistence, Supabase, or network ownership', async () => {
  const source = await readFile(new URL('../program-analyzer.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bdocument\b|localStorage|sessionStorage|saveState|Supabase|supabase|XMLHttpRequest|\bfetch\s*\(/);
});
