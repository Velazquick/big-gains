import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';
import { createProgramFixture } from './helpers/program.js';

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await page.clock.setFixedTime(new Date('2026-08-21T16:00:00.000Z'));
  await openApp(page);
});

async function startNext(page) {
  return page.evaluate(() => {
    const session = BigGainsProgramSetup.startNextProgramSession();
    if (!session) throw new Error('Program session did not materialize.');
    return structuredClone(session);
  });
}

async function completeOneWorkingSet(page) {
  return page.evaluate(() => {
    const exercise = active.exercises[0];
    const set = exercise.sets.find(candidate => !candidate.warmup);
    set.weight = 200;
    set.reps = 5;
    set.completed = true;
    saveState();
    return workoutSessionController.complete();
  });
}

test('Program entry materializes the exact pin and reload or a later successor cannot rewrite its origin', async ({ page }) => {
  await createProgramFixture(page);
  await expect(page.locator('#todayPlanCard')).toContainText('Start next Program session');
  const session = await startNext(page);
  const expected = await page.evaluate(() => {
    const capture = BigGainsProgramModel.normalizeCapture(state.programCapture, {
      accountId: ACCOUNT.accountId,
      profileId: PROFILE.id,
      catalog: BigGainsExerciseCatalog
    });
    const version = capture.programVersions.find(item => item.programVersionId === capture.activeProgramVersionId);
    const slot = version.slots[capture.sequenceState.nextSlotIndex];
    const routine = capture.routineVersions.find(item => item.routineVersionId === slot.routineVersionId);
    return { version, slot, routine, sequence: capture.sequenceState };
  });
  expect(session.programOrigin).toEqual({
    contract: 'big-gains.program-origin.v1',
    accountId: expected.version.accountId,
    profileId: 'jorge',
    programId: expected.version.programId,
    programVersionId: expected.version.programVersionId,
    routineId: expected.routine.routineId,
    routineVersionId: expected.routine.routineVersionId,
    slotId: expected.slot.slotId,
    slotIndex: 0,
    cycleNumber: 1,
    materializedAt: '2026-08-21T16:00:00.000Z'
  });
  expect(session.type).toBe(expected.routine.source.routineType);
  expect(session.exercises.map(exercise => exercise.id)).toEqual(await page.evaluate(exercises => exercises.map(exercise => BigGainsExerciseCatalog.getById(exercise.exerciseId).id), expected.routine.exercises));
  expect(session.exercises.map(exercise => exercise.sets.filter(set => !set.warmup).length))
    .toEqual(expected.routine.exercises.map(exercise => exercise.workingSets));
  expect(expected.sequence).toMatchObject({ nextSlotIndex: 0, completedCycles: 0 });
  expect(await page.evaluate(async () => {
    const record = (await BigGainsCloudShadow.localRecords(PROFILE.id, state))
      .find(item => item.table === 'active_sessions');
    return structuredClone(record.data.workout.programOrigin);
  })).toEqual(session.programOrigin);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
  expect((await jorgeState(page)).activeWorkout.programOrigin).toEqual(session.programOrigin);

  const afterSuccessor = await page.evaluate(() => {
    const originBefore = structuredClone(active.programOrigin);
    const capture = BigGainsProgramModel.normalizeCapture(state.programCapture, {
      accountId: ACCOUNT.accountId, profileId: PROFILE.id, catalog: BigGainsExerciseCatalog
    });
    const version = capture.programVersions.find(item => item.programVersionId === capture.activeProgramVersionId);
    const result = BigGainsProgramModel.createProgramDraft({
      capture,
      accountId: ACCOUNT.accountId,
      profileId: PROFILE.id,
      purposeKey: 'canonical-program',
      name: 'Later successor',
      slots: version.slots.map(slot => ({
        label: slot.label,
        preferredCalendarAnchor: slot.preferredCalendarAnchor,
        routineId: slot.routineId,
        routineVersionId: slot.routineVersionId
      })),
      blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
      programmingAuthority: 'review',
      startsOn: '2026-08-22',
      activeWorkoutId: active.id,
      createId: () => crypto.randomUUID(),
      now: () => '2026-08-22T12:00:00.000Z'
    });
    state.programCapture = result.capture;
    saveState();
    return { originBefore, originAfter: structuredClone(active.programOrigin), successorId: result.version.programVersionId };
  });
  expect(afterSuccessor.originAfter).toEqual(afterSuccessor.originBefore);
  expect(afterSuccessor.successorId).not.toBe(session.programOrigin.programVersionId);
});

test('completion copies origin exactly, advances once, round-trips through cloud JSON, and labels History detail', async ({ page }) => {
  await createProgramFixture(page, { name: 'Jorge Program' });
  const session = await startNext(page);
  expect(await completeOneWorkingSet(page)).toBe(true);
  const result = await page.evaluate(async () => {
    const workout = state.workouts[0];
    const records = await BigGainsCloudShadow.localRecords(PROFILE.id, state);
    const cloud = records.find(record => record.table === 'workouts' && record.clientId === workout.id);
    return {
      workout: structuredClone(workout),
      cloud: structuredClone(cloud.data),
      sequence: structuredClone(state.programCapture.sequenceState)
    };
  });
  expect(result.workout.programOrigin).toEqual(session.programOrigin);
  expect(result.cloud.programOrigin).toEqual(session.programOrigin);
  expect(result.cloud).toEqual(result.workout);
  expect(result.sequence).toMatchObject({ nextSlotIndex: 1, completedCycles: 0 });

  await page.locator('#completionDone').click();
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator(`[data-history-id="${result.workout.id}"]`).first().click();
  await expect(page.locator('#historyDialogContent')).toContainText('Jorge Program v1 · Push · Cycle 1 · Slot 1');
});

test('rolling completion wraps one cycle exactly once while repeated starts and missed weekdays do not skip', async ({ page }) => {
  await createProgramFixture(page);
  const identities = [];
  for (let index = 0; index < 6; index += 1) {
    const first = await startNext(page);
    const repeated = await startNext(page);
    expect(repeated.id).toBe(first.id);
    identities.push(first.programOrigin);
    expect(await completeOneWorkingSet(page)).toBe(true);
    await page.clock.setFixedTime(new Date(Date.parse('2026-08-21T16:00:00.000Z') + (index + 3) * 86_400_000));
  }
  expect(identities.map(origin => origin.slotIndex)).toEqual([0, 1, 2, 3, 4, 5]);
  expect(identities.map(origin => origin.cycleNumber)).toEqual([1, 1, 1, 1, 1, 1]);
  const stored = await jorgeState(page);
  expect(stored.programCapture.sequenceState).toMatchObject({ nextSlotIndex: 0, completedCycles: 1 });
  const next = await startNext(page);
  expect(next.programOrigin).toMatchObject({ slotIndex: 0, cycleNumber: 2 });
});

test('manual entry has no origin and a failed Program completion rolls back History and sequence', async ({ page }) => {
  await createProgramFixture(page);
  const programSession = await startNext(page);
  const before = await jorgeState(page);
  const failed = await page.evaluate(() => {
    const set = active.exercises[0].sets.find(candidate => !candidate.warmup);
    set.weight = 200;
    set.reps = 5;
    set.completed = true;
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'big-gains-v2') throw new Error('simulated local save failure');
      return original.call(this, key, value);
    };
    try {
      return workoutSessionController.complete();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
  expect(failed).toBe(false);
  const rolledBack = await jorgeState(page);
  expect(rolledBack.workouts).toEqual(before.workouts);
  expect(rolledBack.programCapture.sequenceState).toEqual(before.programCapture.sequenceState);
  expect(rolledBack.activeWorkout.programOrigin).toEqual(programSession.programOrigin);

  await page.evaluate(() => workoutSessionController.discard());
  const manual = await page.evaluate(() => structuredClone(workoutSessionController.start('Push', { loadRoutine: true, scroll: false })));
  expect(manual).not.toHaveProperty('programOrigin');
});

test('profile scope rejects cross-profile Program origin and History editing preserves it', async ({ page }) => {
  await createProgramFixture(page);
  const session = await startNext(page);
  expect(await page.evaluate(origin => BigGainsProgramOrigin.normalize(origin, { accountId: 'local-alexa', profileId: 'alexa' }), session.programOrigin)).toBeNull();
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).activeWorkout).toBeNull();
  expect((await jorgeState(page)).activeWorkout.programOrigin).toEqual(session.programOrigin);

  expect(await completeOneWorkingSet(page)).toBe(true);
  const completed = (await jorgeState(page)).workouts[0];
  await page.locator('#completionDone').click();
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator(`[data-history-id="${completed.id}"]`).first().click();
  await page.locator('#editCompletedWorkout').click();
  await page.locator('[data-retro-field="reps"][data-ei="0"][data-si="0"]').fill('6');
  await page.locator('#saveRetrospectiveWorkout').click();
  const edited = (await jorgeState(page)).workouts.find(workout => workout.id === completed.id);
  expect(edited.programOrigin).toEqual(completed.programOrigin);
});
