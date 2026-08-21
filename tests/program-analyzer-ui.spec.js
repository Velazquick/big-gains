import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

test('mobile Program Analyzer renders recomputed structural facts and opens linked Goal detail without mutation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const goalId = await page.evaluate(() => {
    const bench = BigGainsExerciseCatalog.resolve('Barbell Bench Press');
    const row = BigGainsExerciseCatalog.resolve('Barbell Row');
    const squat = BigGainsExerciseCatalog.resolve('Back Squat');
    const createdGoal = bigGainsGoals.createGoal({ exerciseId: bench.canonicalId, targetValue: 250, targetDate: '', label: 'Bench destination' });
    if (!createdGoal.ok) throw new Error(createdGoal.reason);
    let counter = 0;
    const createId = () => `analyzer-ui-${++counter}`;
    const now = () => '2026-08-20T12:00:00.000Z';
    const scope = { accountId: ACCOUNT.accountId, profileId: PROFILE.id };
    const approve = (capture, purposeKey, label, definition, workingSets, repTarget) => BigGainsProgramModel.approveRoutine({
      capture,
      ...scope,
      purposeKey,
      label,
      source: { kind: 'reviewed_rebuild', routineType: label },
      exercises: [{ exerciseId: definition.canonicalId, workingSets, targetReps: repTarget, restSeconds: null }],
      catalog: BigGainsExerciseCatalog,
      createId,
      now
    });
    let capture = BigGainsProgramModel.blankCapture();
    const pushResult = approve(capture, 'push', 'Push', bench, 3, '4–6');
    capture = pushResult.capture;
    const pullResult = approve(capture, 'pull', 'Pull', row, 4, '8–10');
    capture = pullResult.capture;
    const legsResult = approve(capture, 'legs', 'Legs/Core', squat, 5, '5');
    capture = legsResult.capture;
    const versions = [pushResult.version, pullResult.version, legsResult.version];
    const slots = [versions[0], versions[1], versions[2], versions[0], versions[1], versions[2]].map((version, index) => ({
      label: version.label,
      preferredCalendarAnchor: { weekday: index + 1 },
      routineId: version.routineId,
      routineVersionId: version.routineVersionId
    }));
    const draft = BigGainsProgramModel.createProgramDraft({
      capture,
      ...scope,
      purposeKey: 'canonical-program',
      name: 'Analyzer UI Program',
      slots,
      blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
      programmingAuthority: 'review',
      priorityGoalIds: [createdGoal.goal.goalId],
      startsOn: '2026-08-20',
      createId,
      now
    });
    state.programCapture = BigGainsProgramModel.activateProgram({
      capture: draft.capture,
      ...scope,
      programVersionId: draft.version.programVersionId,
      now
    });
    saveState();
    BigGainsProgramSetup.render();
    bigGainsViewShell.showView('library', { workout: false });
    return createdGoal.goal.goalId;
  });

  const panel = page.locator('#programAnalyzerPanel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Program structure');
  await expect(panel).toContainText('Exercise exposure');
  await expect(panel).toContainText('Goal support');
  await expect(panel).toContainText('Muscle exposure');
  await expect(panel).toContainText('Rep / prescription summary');
  await expect(panel).toContainText('Session spacing');
  await expect(panel).toContainText('Block context');
  await expect(panel).toContainText('Barbell Bench Press');
  await expect(panel).toContainText('2 exposures / cycle · 6 working sets');
  await expect(panel).toContainText('3 sessions apart');
  await expect(panel).toContainText('Chest');
  await expect(panel).toContainText('6 primary sets / cycle');
  await expect(panel).toContainText('Raw normalized targets');
  await expect(panel).not.toContainText(/too much|too little|optimal|imbalanced/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const before = await readStoredJson(page, STORAGE_KEYS.jorge);
  await panel.locator(`[data-program-open-goal="${goalId}"]`).click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'goals');
  await expect(page.locator(`.goal-card[data-goal-id="${goalId}"]`)).toBeVisible();
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after.programCapture).toEqual(before.programCapture);
  expect(after.goals).toEqual(before.goals);
  expect(after.activeWorkout).toEqual(before.activeWorkout);
  expect(after.workouts).toEqual(before.workouts);
});
