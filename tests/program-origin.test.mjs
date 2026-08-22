import assert from 'node:assert/strict';
import test from 'node:test';

await import('../exercise-catalog.js');
await import('../program-model.js');
await import('../program-origin.js');

const catalog = globalThis.BigGainsExerciseCatalog;
const model = globalThis.BigGainsProgramModel;
const originApi = globalThis.BigGainsProgramOrigin;
const scope = { accountId: 'account-origin', profileId: 'profile-origin' };

function fixture() {
  let counter = 0;
  const createId = () => `origin-${++counter}`;
  const now = () => '2026-08-01T12:00:00.000Z';
  const approve = (capture, purposeKey, label, routineType, exerciseId) => model.approveRoutine({
    capture,
    ...scope,
    purposeKey,
    label,
    source: { kind: 'reviewed_rebuild', routineType },
    exercises: [{ exerciseId, workingSets: 3, targetReps: '4-6', restSeconds: 180 }],
    catalog,
    createId,
    now
  });
  let capture = model.blankCapture();
  const push = approve(capture, 'push', 'Push', 'Push', catalog.resolve('Barbell Bench Press').canonicalId);
  capture = push.capture;
  const pull = approve(capture, 'pull', 'Pull', 'Pull', catalog.resolve('Barbell Row').canonicalId);
  capture = pull.capture;
  const draft = model.createProgramDraft({
    capture,
    ...scope,
    purposeKey: 'program',
    name: 'Origin Program',
    slots: [push.version, pull.version].map(version => ({
      label: version.label,
      preferredCalendarAnchor: null,
      routineId: version.routineId,
      routineVersionId: version.routineVersionId
    })),
    blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
    programmingAuthority: 'review',
    startsOn: '2026-08-01',
    createId,
    now
  });
  capture = model.activateProgram({
    capture: draft.capture,
    ...scope,
    programVersionId: draft.version.programVersionId,
    now
  });
  return { capture, programVersion: draft.version, routines: [push.version, pull.version], createId, now };
}

function workout(materialization, id, completedAt) {
  return {
    id,
    type: materialization.routineVersion.source.routineType,
    startedAt: materialization.programOrigin.materializedAt,
    completedAt,
    durationSeconds: 1800,
    prs: 0,
    programOrigin: materialization.programOrigin,
    exercises: []
  };
}

test('materialization snapshots an immutable exact zero-based slot and one-based cycle without advancing', () => {
  const base = fixture();
  const before = JSON.stringify(base.capture.sequenceState);
  const first = originApi.materializeNext({
    capture: base.capture,
    ...scope,
    catalog,
    materializedAt: '2026-08-02T12:00:00.000Z'
  });
  assert.deepEqual(first.programOrigin, {
    contract: 'big-gains.program-origin.v1',
    ...scope,
    programId: base.programVersion.programId,
    programVersionId: base.programVersion.programVersionId,
    routineId: base.routines[0].routineId,
    routineVersionId: base.routines[0].routineVersionId,
    slotId: base.programVersion.slots[0].slotId,
    slotIndex: 0,
    cycleNumber: 1,
    materializedAt: '2026-08-02T12:00:00.000Z'
  });
  assert.equal(Object.isFrozen(first.programOrigin), true);
  assert.equal(JSON.stringify(base.capture.sequenceState), before);
  assert.deepEqual(first.routineVersion.exercises, base.routines[0].exercises);
});

test('completion alone advances, wrap increments one cycle once, and calendar distance never skips a slot', () => {
  const base = fixture();
  const first = originApi.materializeNext({ capture: base.capture, ...scope, catalog, materializedAt: '2026-08-02T12:00:00.000Z' });
  const sameReservation = originApi.materializeNext({ capture: base.capture, ...scope, catalog, materializedAt: '2026-09-30T12:00:00.000Z' });
  assert.equal(sameReservation.programOrigin.slotIndex, 0);
  assert.equal(sameReservation.programOrigin.cycleNumber, 1);
  const afterFirst = originApi.advanceCaptureForCompletion({ capture: base.capture, programOrigin: first.programOrigin, ...scope, catalog, completedAt: '2026-08-02T13:00:00.000Z' });
  assert.equal(afterFirst.advanced, true);
  assert.deepEqual(afterFirst.capture.sequenceState, {
    programId: base.programVersion.programId,
    programVersionId: base.programVersion.programVersionId,
    nextSlotIndex: 1,
    completedCycles: 0,
    updatedAt: '2026-08-02T13:00:00.000Z'
  });
  const second = originApi.materializeNext({ capture: afterFirst.capture, ...scope, catalog, materializedAt: '2026-10-15T12:00:00.000Z' });
  assert.equal(second.programOrigin.slotIndex, 1);
  assert.equal(second.programOrigin.cycleNumber, 1);
  const wrapped = originApi.advanceCaptureForCompletion({ capture: afterFirst.capture, programOrigin: second.programOrigin, ...scope, catalog, completedAt: '2026-10-15T13:00:00.000Z' });
  assert.equal(wrapped.capture.sequenceState.nextSlotIndex, 0);
  assert.equal(wrapped.capture.sequenceState.completedCycles, 1);
  const duplicate = originApi.advanceCaptureForCompletion({ capture: wrapped.capture, programOrigin: second.programOrigin, ...scope, catalog, completedAt: '2026-10-15T14:00:00.000Z' });
  assert.equal(duplicate.advanced, false);
  assert.deepEqual(duplicate.capture.sequenceState, wrapped.capture.sequenceState);
});

test('a later Program successor cannot mutate or advance an already materialized origin', () => {
  const base = fixture();
  const materialized = originApi.materializeNext({ capture: base.capture, ...scope, catalog, materializedAt: '2026-08-02T12:00:00.000Z' });
  const originBefore = JSON.stringify(materialized.programOrigin);
  const successor = model.createProgramDraft({
    capture: base.capture,
    ...scope,
    purposeKey: 'program',
    name: 'Origin Program successor',
    slots: base.programVersion.slots.map(slot => ({
      label: slot.label,
      preferredCalendarAnchor: slot.preferredCalendarAnchor,
      routineId: slot.routineId,
      routineVersionId: slot.routineVersionId
    })),
    blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
    programmingAuthority: 'review',
    startsOn: '2026-08-03',
    activeWorkoutId: 'active-program-workout',
    createId: base.createId,
    now: () => '2026-08-03T12:00:00.000Z'
  });
  const activated = model.activateProgram({
    capture: successor.capture,
    ...scope,
    programVersionId: successor.version.programVersionId,
    now: () => '2026-08-03T12:01:00.000Z'
  });
  const completion = originApi.advanceCaptureForCompletion({
    capture: activated,
    programOrigin: materialized.programOrigin,
    ...scope,
    catalog,
    completedAt: '2026-08-03T13:00:00.000Z'
  });
  assert.equal(JSON.stringify(materialized.programOrigin), originBefore);
  assert.equal(completion.advanced, false);
  assert.equal(completion.capture.activeProgramVersionId, successor.version.programVersionId);
  assert.equal(completion.capture.sequenceState.nextSlotIndex, 0);
});

test('completed cycles require every explicit pinned slot; legacy, wrong-scope, and partial records do not count', () => {
  const base = fixture();
  const first = originApi.materializeNext({ capture: base.capture, ...scope, catalog, materializedAt: '2026-08-02T12:00:00.000Z' });
  const afterFirst = originApi.advanceCaptureForCompletion({ capture: base.capture, programOrigin: first.programOrigin, ...scope, catalog, completedAt: '2026-08-02T13:00:00.000Z' });
  const second = originApi.materializeNext({ capture: afterFirst.capture, ...scope, catalog, materializedAt: '2026-08-03T12:00:00.000Z' });
  const partial = [workout(first, 'first', '2026-08-02T13:00:00.000Z')];
  assert.deepEqual(originApi.completedCycleNumbers({ workouts: partial, programVersion: base.programVersion }), []);
  assert.deepEqual(originApi.completedCycleNumbers({
    workouts: [...partial, workout(second, 'second', '2026-08-03T13:00:00.000Z'), { id: 'legacy', completedAt: '2026-08-04T13:00:00.000Z' }],
    programVersion: base.programVersion
  }), [1]);
  assert.equal(originApi.normalize({ ...first.programOrigin, profileId: 'another-profile' }, scope), null);
});
