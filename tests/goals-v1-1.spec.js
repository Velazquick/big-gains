import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const BENCH = 'fe9b24dd-e6db-41d3-9395-596830a0a37a';
const NOW = '2026-08-19T16:00:00.000Z';

function historyExercise({ id = 'barbell-bench-press', definitionId = BENCH, canonicalId = null, name = 'Barbell Bench Press', load = 215, reps = [5, 5, 5, 5, 5] } = {}) {
  return {
    ...(id ? { id } : {}),
    ...(definitionId ? { definitionId } : {}),
    ...(canonicalId ? { canonicalId } : {}),
    name,
    muscle: 'Chest',
    equipment: 'Barbell',
    sets: reps.map((rep, index) => ({ id: `set-${index + 1}`, weight: load, reps: rep, warmup: false, completed: true }))
  };
}

function workout(exercise, { id = 'synthetic-workout', completedAt = '2026-08-18T16:00:00.000Z' } = {}) {
  return {
    id,
    type: 'Push',
    startedAt: new Date(Date.parse(completedAt) - 3600000).toISOString(),
    completedAt,
    durationSeconds: 3600,
    prs: 0,
    exercises: [exercise]
  };
}

async function setup(page) {
  await installLocalStorageFixture(page, 'blankJorge', { now: NOW });
  await openApp(page);
}

async function configureGuidedBench(page, { workouts, target = 315, targetDate = null, routineDay = 'Other', workingSets = 5 } = {}) {
  return page.evaluate(({ workouts, target, targetDate, routineDay, workingSets, bench }) => {
    if (active) workoutSessionController.discard();
    state.workouts = workouts;
    state.goals.strengthGoals = [];
    state.customRoutines[routineDay] = [{ exerciseId: 'barbell-bench-press', workingSets, targetReps: '4-6' }];
    const created = bigGainsGoals.createGoal({ exerciseId: bench, targetValue: target, targetDate });
    bigGainsGoals.setGuidance(created.goal.goalId, true);
    workoutSessionController.start(routineDay, { loadRoutine: true, scroll: false });
    bigGainsGoals.render();
    return structuredClone({ exercise: active.exercises[0], goal: state.goals.strengthGoals[0] });
  }, { workouts, target, targetDate, routineDay, workingSets, bench: BENCH });
}

test('Goals v1.1: permanent delete confirms, removes only the past goal, and survives preferences reload', async ({ page }) => {
  await setup(page);
  const keepWorkout = workout(historyExercise(), { id: 'keep-workout' });
  const before = await page.evaluate(({ bench, keepWorkout }) => {
    state.workouts = [keepWorkout];
    state.customRoutines.Push = [{ exerciseId: 'barbell-bench-press', workingSets: 5, targetReps: '4-6' }];
    const created = bigGainsGoals.createGoal({ exerciseId: bench, targetValue: 255 });
    bigGainsGoals.transition(created.goal.goalId, 'archive');
    bigGainsViewShell.showView('goals', { workout: false, instant: true });
    return structuredClone({ workouts: state.workouts, routines: state.customRoutines });
  }, { bench: BENCH, keepWorkout });

  await page.locator('#pastGoalsSection summary').click();
  await expect(page.locator('#pastGoalsList [data-goal-action="delete"]')).toHaveText('Delete permanently');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#pastGoalsList [data-goal-action="delete"]').click();
  await expect(page.locator('#pastGoalsList .goal-card')).toHaveCount(1);

  page.once('dialog', dialog => dialog.accept());
  await page.locator('#pastGoalsList [data-goal-action="delete"]').click();
  await expect(page.locator('#pastGoalsSection')).toBeHidden();
  const after = await page.evaluate(() => structuredClone({ workouts: state.workouts, routines: state.customRoutines, goals: state.goals.strengthGoals }));
  expect(after.workouts).toEqual(before.workouts);
  expect(after.routines).toEqual(before.routines);
  expect(after.goals).toEqual([]);

  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.version).toBe(5);
  expect(stored.goals.strengthGoals).toEqual([]);
  const shadow = await page.evaluate(async () => (await BigGainsCloudShadow.localRecords('jorge', state)).find(record => record.clientId === 'goals'));
  expect(shadow.data.strengthGoals).toEqual([]);
  await page.reload();
  await expect(page.locator('#todayGoalsHeadline')).toHaveText('Set a strength goal');
});

test('Goals v1.1: canonical, legacy definitionId, and trusted name-only exact Bench rows all establish baseline', async ({ page }) => {
  await setup(page);
  const shapes = [
    historyExercise({ id: BENCH, definitionId: null }),
    historyExercise({ id: 'canonical-instance', definitionId: null, canonicalId: BENCH }),
    historyExercise({ id: 'retrospective-instance', definitionId: 'barbell-bench-press' }),
    historyExercise({ id: 'barbell-bench-press', definitionId: 'unsupported-definition-id' }),
    historyExercise({ id: null, definitionId: null, name: 'Bench' })
  ];
  for (let index = 0; index < shapes.length; index += 1) {
    const result = await configureGuidedBench(page, { workouts: [workout(shapes[index], { id: `exact-${index}` })] });
    expect(result.exercise.goalGuidance.status).toBe('available');
    expect(result.exercise.goalGuidance.reasonCode).toBe('BUILD_STRENGTH_VOLUME');
    expect(result.exercise.goalGuidance.recommendation.enteredLoad).toBe(215);
  }
  const untrustedFallback = await configureGuidedBench(page, {
    workouts: [workout(historyExercise({ id: 'unsupported-instance-id', definitionId: null, name: 'Bench' }), { id: 'unsupported-id' })]
  });
  expect(untrustedFallback.exercise.goalGuidance).toMatchObject({
    status: 'unavailable', reasonCode: 'ESTABLISH_BASELINE', diagnostic: { state: 'exact_missing' }
  });
});

test('Goals v1.1: related Bench variants never satisfy exact Bench evidence and receive explicit supporting copy', async ({ page }) => {
  await setup(page);
  for (const relatedId of ['dumbbell-bench-press', 'flat-smith-machine-bench-press', 'seated-machine-chest-press']) {
    const definition = await page.evaluate(id => BigGainsExerciseCatalog.getById(id), relatedId);
    const related = historyExercise({ id: definition.id, definitionId: definition.canonicalId, name: definition.name });
    const result = await configureGuidedBench(page, { workouts: [workout(related, { id: `related-${relatedId}` })] });
    expect(result.exercise.goalGuidance).toMatchObject({
      status: 'unavailable',
      reasonCode: 'ESTABLISH_BASELINE',
      diagnostic: { state: 'related_only', title: 'Related pressing history found' }
    });
    expect(result.exercise.goalGuidance.recommendation).toBeNull();
  }
  await expect(page.locator('[data-goal-guidance-status="unavailable"]')).toContainText('will not treat related exercise loads as equivalent');
});

test('Goals v1.1: stale and structurally ineligible exact history have distinct diagnostics', async ({ page }) => {
  await setup(page);
  let result = await configureGuidedBench(page, {
    workouts: [workout(historyExercise(), { completedAt: '2026-06-01T16:00:00.000Z' })]
  });
  expect(result.exercise.goalGuidance.diagnostic).toMatchObject({ state: 'exact_stale', title: 'Recent evidence is too old' });

  result = await configureGuidedBench(page, {
    workouts: [workout(historyExercise({ reps: [5, 5, 5] }), { id: 'recent-ineligible' })]
  });
  expect(result.exercise.goalGuidance.diagnostic).toMatchObject({ state: 'exact_ineligible' });
  expect(result.exercise.goalGuidance.diagnostic.title).toContain('Recent Barbell Bench Press history');
});

test('Goals v1.1: active goal detail shows a conditional trajectory and aggressive outlook without changing today', async ({ page }) => {
  await setup(page);
  const result = await configureGuidedBench(page, {
    workouts: [workout(historyExercise())],
    target: 315,
    targetDate: '2026-09-14',
    routineDay: 'Push'
  });
  const working = result.exercise.sets.filter(set => !set.warmup).map(set => [set.weight, set.reps]);
  expect(working).toEqual(Array(5).fill([215, 5]));

  await page.evaluate(() => bigGainsViewShell.showView('goals', { workout: false, instant: true }));
  const card = page.locator('#activeGoalsList .goal-card');
  await card.locator('.goal-trajectory').click();
  await expect(card.locator('.goal-trajectory')).toContainText('Current next exposure: 215 × 5 × 5');
  await expect(card.locator('.goal-trajectory li')).toHaveCount(3);
  await expect(card.locator('.goal-trajectory')).toContainText('215 × 6 × 5');
  await expect(card.locator('.goal-trajectory')).toContainText('220 × 4 × 5');
  await expect(card.locator('.goal-trajectory')).toContainText('actual performance differs');
  await expect(card.locator('.goal-trajectory')).not.toContainText('Week 1');
  await expect(card.locator('.goal-deadline-outlook')).toHaveAttribute('data-deadline-status', 'aggressive');
  await expect(card.locator('.goal-deadline-outlook')).toContainText('Aggressive');
  await expect(card.locator('.goal-deadline-outlook')).toContainText("never changes today's prescription");
  expect(await page.evaluate(() => active.exercises[0].sets.filter(set => !set.warmup).map(set => [set.weight, set.reps]))).toEqual(working);
});

test('Goals v1.1: a dated ad-hoc exercise with unknown cadence reports Unclear', async ({ page }) => {
  await setup(page);
  await configureGuidedBench(page, {
    workouts: [workout(historyExercise())],
    target: 255,
    targetDate: '2026-12-31',
    routineDay: 'Other'
  });
  await page.evaluate(() => bigGainsViewShell.showView('goals', { workout: false, instant: true }));
  const outlook = page.locator('#activeGoalsList .goal-deadline-outlook');
  await expect(outlook).toHaveAttribute('data-deadline-status', 'unclear');
  await expect(outlook).toContainText('will not invent a weekly cadence');
});

test('Goals v1.1: deleting one managed profile past goal cannot delete another profile goal', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge', now: NOW });
  await openApp(page);
  await page.evaluate(bench => {
    const created = bigGainsGoals.createGoal({ exerciseId: bench, targetValue: 255 });
    bigGainsGoals.transition(created.goal.goalId, 'archive');
  }, BENCH);

  await Promise.all([page.waitForNavigation(), page.locator('#profileSelect').selectOption('alexa')]);
  await page.evaluate(bench => {
    const created = bigGainsGoals.createGoal({ exerciseId: bench, targetValue: 225 });
    bigGainsGoals.transition(created.goal.goalId, 'archive');
  }, BENCH);
  const alexaGoalId = (await readStoredJson(page, STORAGE_KEYS.alexa)).goals.strengthGoals[0].goalId;

  await Promise.all([page.waitForNavigation(), page.locator('#profileSelect').selectOption('jorge')]);
  await page.evaluate(() => bigGainsViewShell.showView('goals', { workout: false, instant: true }));
  await page.locator('#pastGoalsSection summary').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#pastGoalsList [data-goal-action="delete"]').click();
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).goals.strengthGoals).toEqual([]);
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).goals.strengthGoals[0].goalId).toBe(alexaGoalId);
});
