import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
});

async function createEligibleProgrammingReview(page) {
  return page.evaluate(() => {
    const bench = BigGainsExerciseCatalog.resolve('Barbell Bench Press');
    const squat = BigGainsExerciseCatalog.resolve('Back Squat');
    const row = BigGainsExerciseCatalog.resolve('Barbell Row');
    const created = bigGainsGoals.createGoal({ exerciseId: bench.canonicalId, targetValue: 250, label: 'Bench 250' });
    if (!created.ok) throw new Error(created.reason);
    const goal = state.goals.strengthGoals.find(item => item.goalId === created.goal.goalId);
    goal.guidanceEnabled = true;
    let counter = 0;
    const createId = () => `pe-ui-${++counter}`;
    const now = () => '2026-07-01T12:00:00.000Z';
    const owner = { accountId: ACCOUNT.accountId, profileId: PROFILE.id };
    const approve = (capture, purposeKey, label, definition, workingSets, routineType) => BigGainsProgramModel.approveRoutine({
      capture,
      ...owner,
      purposeKey,
      label,
      source: { kind: 'reviewed_rebuild', routineType },
      exercises: [{ exerciseId: definition.canonicalId, workingSets, targetReps: '4–6', restSeconds: 180 }],
      catalog: BigGainsExerciseCatalog,
      createId,
      now
    });
    let capture = BigGainsProgramModel.blankCapture();
    const source = approve(capture, 'pe-source', 'Strength One', bench, 6, 'Push');
    capture = source.capture;
    const destination = approve(capture, 'pe-destination', 'Strength Two', squat, 4, 'Legs');
    capture = destination.capture;
    const other = approve(capture, 'pe-other', 'Strength Three', row, 3, 'Pull');
    capture = other.capture;
    const slots = [source.version, destination.version, other.version, destination.version].map((version, index) => ({
      label: `Route ${index + 1}`,
      preferredCalendarAnchor: null,
      routineId: version.routineId,
      routineVersionId: version.routineVersionId
    }));
    const draft = BigGainsProgramModel.createProgramDraft({
      capture,
      ...owner,
      purposeKey: 'canonical-program',
      name: 'PE-1A Review Route',
      slots,
      blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
      programmingAuthority: 'review',
      priorityGoalIds: [goal.goalId],
      startsOn: '2026-07-01',
      createId,
      now
    });
    state.programCapture = BigGainsProgramModel.activateProgram({
      capture: draft.capture,
      ...owner,
      programVersionId: draft.version.programVersionId,
      now
    });
    const dates = ['2026-08-01T12:00:00.000Z', '2026-08-08T12:00:00.000Z', '2026-08-15T12:00:00.000Z', '2026-08-22T12:00:00.000Z'];
    const routineById = new Map([source.version, destination.version, other.version]
      .map(version => [version.routineVersionId, version]));
    state.workouts = dates.flatMap((cycleCompletedAt, cycleIndex) => draft.version.slots.map((slot, slotIndex) => {
      const completedAt = new Date(Date.parse(cycleCompletedAt) + slotIndex * 60_000).toISOString();
      const routine = routineById.get(slot.routineVersionId);
      const definition = BigGainsExerciseCatalog.getById(routine.exercises[0].exerciseId);
      const isExposure = slotIndex === 0;
      return {
        id: isExposure ? `pe-exposure-${cycleIndex + 1}` : `pe-cycle-${cycleIndex + 1}-slot-${slotIndex + 1}`,
        type: routine.source.routineType,
        startedAt: completedAt,
        completedAt,
        durationSeconds: 1800,
        prs: 0,
        programOrigin: {
          contract: BigGainsProgramOrigin.contract,
          accountId: ACCOUNT.accountId,
          profileId: PROFILE.id,
          programId: draft.version.programId,
          programVersionId: draft.version.programVersionId,
          routineId: routine.routineId,
          routineVersionId: routine.routineVersionId,
          slotId: slot.slotId,
          slotIndex,
          cycleNumber: cycleIndex + 1,
          materializedAt: completedAt
        },
        exercises: [{
          id: definition.canonicalId,
          definitionId: definition.canonicalId,
          name: definition.name,
          muscle: definition.muscle,
          equipment: definition.equipment,
          collapsed: true,
          sets: Array.from({ length: isExposure ? 6 : 1 }, (_, setIndex) => ({
            id: `pe-set-${cycleIndex + 1}-${slotIndex + 1}-${setIndex + 1}`,
            weight: 200,
            reps: 4,
            warmup: false,
            completed: true
          }))
        }]
      };
    }));
    const decision = (id, issuedAt, selectedExposureIds, reasonCode = 'HOLD_PARTIAL') => ({
      decisionId: id,
      issuedAt,
      evidenceCutoff: issuedAt,
      exerciseId: bench.canonicalId,
      enteredLoad: 200,
      unit: 'lb',
      loadBasis: goal.targetBasis,
      workingSetCount: 6,
      repTargets: [4, 4, 4, 4, 4, 4],
      repRange: { min: 4, max: 6 },
      decisionCode: reasonCode === 'ADJUST_REPEATED_MISS' ? 'DECREASE_LOAD' : 'HOLD',
      reasonCode,
      explanation: reasonCode,
      policy: { id: 'strength_double_progression_v1', version: 1 },
      selectedExposureIds,
      attainmentState: 'in_progress'
    });
    const decisions = [
      decision('decision-4', '2026-08-22T13:00:00.000Z', ['pe-exposure-4']),
      decision('decision-3', '2026-08-15T13:00:00.000Z', ['pe-exposure-3']),
      decision('adjustment-1', '2026-08-09T12:00:00.000Z', ['pe-exposure-2'], 'ADJUST_REPEATED_MISS'),
      decision('decision-2', '2026-08-08T13:00:00.000Z', ['pe-exposure-2']),
      decision('decision-1', '2026-08-01T13:00:00.000Z', ['pe-exposure-1'])
    ];
    goal.progressionState = { current: decisions[0], trace: decisions };
    goal.updatedAt = decisions[0].issuedAt;
    saveState();
    renderAll();
    BigGainsProgramSetup.render();
    BigGainsProgramSetup.openProgramDetail();
    return {
      programVersionId: draft.version.programVersionId,
      goalId: goal.goalId,
      sourceRoutineVersionId: source.version.routineVersionId,
      destinationRoutineVersionId: destination.version.routineVersionId
    };
  });
}

test('Plan displays an eligible PE-1A proposal and Later remains view-local', async ({ page }) => {
  await createEligibleProgrammingReview(page);
  const before = await readStoredJson(page, STORAGE_KEYS.jorge);
  const card = page.locator('[data-programming-review-status="proposal"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Redistribute Barbell Bench Press exposure');
  await expect(card).toContainText('1 exposure');
  await expect(card).toContainText('2 exposures');
  await expect(card).toContainText('6 total cycle sets');
  await expect(card).toContainText('3 sets in position 1 + 3 sets in position 2');
  await expect(card).toContainText('Auxiliary Routine variant required');
  await expect(card.getByRole('button', { name: 'Approve' })).toBeEnabled();
  await card.getByRole('button', { name: 'Later' }).click();
  await expect(card.locator('[data-programming-disposition-status]')).toContainText('Saved for later in this view only');
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after).toEqual(before);
});

test('Approve confirms and atomically activates one successor with a persisted trace', async ({ page }) => {
  const base = await createEligibleProgrammingReview(page);
  const before = await readStoredJson(page, STORAGE_KEYS.jorge);
  const card = page.locator('[data-programming-review-status="proposal"]');
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card).toContainText('Confirm the exact before/after diff above');
  await card.getByRole('button', { name: 'Confirm approval' }).click();
  const applied = page.locator('[data-programming-application-trace]');
  await expect(applied).toBeVisible();
  await expect(applied).toContainText('Successor active for future sessions');
  await expect(applied).toContainText('3 + 3');
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after.workouts).toEqual(before.workouts);
  expect(after.activeWorkout).toEqual(before.activeWorkout);
  expect(after.programCapture.programVersions).toHaveLength(2);
  expect(after.programCapture.routineVersions).toHaveLength(5);
  expect(after.programCapture.applicationTraces).toHaveLength(1);
  expect(after.programCapture.programVersions[0].programVersionId).toBe(base.programVersionId);
  expect(after.programCapture.activeProgramVersionId).toBe(after.programCapture.programVersions[1].programVersionId);
  expect(after.programCapture.applicationTraces[0]).toMatchObject({
    proposalId: expect.any(String),
    baseProgramVersionId: base.programVersionId,
    newProgramVersionId: after.programCapture.activeProgramVersionId,
    beforeExposureCount: 1,
    afterExposureCount: 2,
    totalCycleWorkingSetsBefore: 6,
    totalCycleWorkingSetsAfter: 6,
    allocation: [3, 3],
    disposition: 'approved'
  });
});

test('approval preserves an active predecessor session and advances the successor only when it completes', async ({ page }) => {
  const base = await createEligibleProgrammingReview(page);
  const frozen = await page.evaluate(() => {
    const session = BigGainsProgramSetup.startNextProgramSession();
    if (!session?.programOrigin) throw new Error('Program session did not materialize.');
    BigGainsProgramSetup.openProgramDetail();
    return structuredClone(session);
  });
  const card = page.locator('[data-programming-review-status="proposal"]');
  await card.getByRole('button', { name: 'Approve' }).click();
  await card.getByRole('button', { name: 'Confirm approval' }).click();
  const afterApproval = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(afterApproval.activeWorkout).toEqual(frozen);
  expect(afterApproval.programCapture.sequenceState.nextSlotIndex).toBe(0);
  expect(afterApproval.programCapture.sequenceState.completedCycles).toBe(0);
  const successorId = afterApproval.programCapture.activeProgramVersionId;
  expect(successorId).not.toBe(base.programVersionId);

  await page.evaluate(() => {
    const exercise = active.exercises[0];
    const set = exercise.sets.find(candidate => !candidate.warmup);
    set.weight = 200;
    set.reps = 5;
    set.completed = true;
    saveState();
    if (!workoutSessionController.complete()) throw new Error('Frozen Program session did not complete.');
  });
  const completed = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(completed.activeWorkout).toBeNull();
  expect(completed.programCapture.activeProgramVersionId).toBe(successorId);
  expect(completed.programCapture.sequenceState).toMatchObject({
    programVersionId: successorId,
    nextSlotIndex: 1,
    completedCycles: 0
  });
  expect(completed.workouts[0].programOrigin.programVersionId).toBe(base.programVersionId);
});

test('a stale proposal cannot be approved and leaves local state unchanged', async ({ page }) => {
  await createEligibleProgrammingReview(page);
  const before = await readStoredJson(page, STORAGE_KEYS.jorge);
  const card = page.locator('[data-programming-review-status="proposal"]');
  await card.getByRole('button', { name: 'Approve' }).click();
  await page.evaluate(() => {
    state.goals.strengthGoals[0].status = 'paused';
    saveState();
  });
  await card.getByRole('button', { name: 'Confirm approval' }).click();
  await expect(card).toContainText('Program or evidence changed');
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after.programCapture).toEqual(before.programCapture);
  expect(after.workouts).toEqual(before.workouts);
  expect(after.activeWorkout).toEqual(before.activeWorkout);
});

test('production-shaped exact History without Program origin is unavailable rather than cycle-guessed', async ({ page }) => {
  await createEligibleProgrammingReview(page);
  await page.evaluate(() => {
    state.workouts.forEach(workout => { delete workout.programOrigin; });
    saveState();
    BigGainsProgramSetup.openProgramDetail();
  });
  const card = page.locator('[data-programming-review-status="unavailable"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('BLOCK_PROVENANCE_UNAVAILABLE');
  await expect(card).toContainText('Program version, Routine pin, slot, and completed-cycle provenance');
  await expect(page.locator('[data-programming-review-status="proposal"]')).toHaveCount(0);
});
