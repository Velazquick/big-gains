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
    const approve = (capture, purposeKey, label, definition, workingSets) => BigGainsProgramModel.approveRoutine({
      capture,
      ...owner,
      purposeKey,
      label,
      source: { kind: 'reviewed_rebuild', routineType: label },
      exercises: [{ exerciseId: definition.canonicalId, workingSets, targetReps: '4–6', restSeconds: 180 }],
      catalog: BigGainsExerciseCatalog,
      createId,
      now
    });
    let capture = BigGainsProgramModel.blankCapture();
    const source = approve(capture, 'pe-source', 'Strength One', bench, 6);
    capture = source.capture;
    const destination = approve(capture, 'pe-destination', 'Strength Two', squat, 4);
    capture = destination.capture;
    const other = approve(capture, 'pe-other', 'Strength Three', row, 3);
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
    state.workouts = dates.map((completedAt, index) => ({
      id: `pe-exposure-${index + 1}`,
      type: `Arbitrary ${index + 1}`,
      startedAt: completedAt,
      completedAt,
      durationSeconds: 1800,
      prs: 0,
      programOrigin: {
        programVersionId: draft.version.programVersionId,
        routineVersionId: source.version.routineVersionId,
        slotId: draft.version.slots[0].slotId,
        cycleNumber: index + 1,
        cycleCompleted: true
      },
      exercises: [{
        id: bench.canonicalId,
        definitionId: bench.canonicalId,
        name: bench.name,
        muscle: 'Chest',
        equipment: 'Barbell',
        collapsed: true,
        sets: Array.from({ length: 6 }, (_, setIndex) => ({
          id: `pe-set-${index + 1}-${setIndex + 1}`,
          weight: 200,
          reps: 4,
          warmup: false,
          completed: true
        }))
      }]
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

test('Plan displays an eligible PE-1A proposal without applying or persisting it', async ({ page }) => {
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
  await expect(card.getByRole('button', { name: 'Approve' })).toBeDisabled();
  await expect(card).toContainText('application and stale-base wiring follow in PE-1B');
  await card.getByRole('button', { name: 'Later' }).click();
  await expect(card.locator('[data-programming-disposition-status]')).toContainText('Saved for later in this view only');
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after).toEqual(before);
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
