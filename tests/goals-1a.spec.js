import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const BENCH_CANONICAL_ID = 'fe9b24dd-e6db-41d3-9395-596830a0a37a';

async function openGoals(page) {
  const view = await page.locator('body').getAttribute('data-view');
  if (view === 'today') await page.locator('#todayGoalsOpen').click();
  else if (view !== 'goals') await page.evaluate(() => bigGainsViewShell.showView('goals', { workout: false }));
  await expect(page.locator('body')).toHaveAttribute('data-view', 'goals');
  await expect(page.locator('#viewGoals')).toBeVisible();
}

async function createGoal(page, { exercise = 'Barbell Bench Press — lb total', target = '250', date = '', label = '' } = {}) {
  await openGoals(page);
  await page.locator('#createStrengthGoal').click();
  await page.locator('#goalExerciseSelect').selectOption({ label: exercise });
  await page.locator('#goalTargetValue').fill(target);
  if (date) await page.locator('#goalTargetDate').fill(date);
  if (label) await page.locator('#goalLabel').fill(label);
  await page.locator('#saveGoal').click();
  await expect(page.locator('#goalDialog')).not.toHaveAttribute('open', '');
  await expect(page.locator('#activeGoalsList .goal-card')).toHaveCount(1);
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.includes('managed profiles')) {
    await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  } else {
    await installLocalStorageFixture(page, 'blankJorge');
  }
});

test('G1-11.1: Today opens a standalone Goals hub without a sixth bottom destination', async ({ page }) => {
  await openApp(page);

  await expect(page.locator('.bottom-nav button')).toHaveCount(5);
  await expect(page.locator('.bottom-nav [data-view="goals"]')).toHaveCount(0);
  await expect(page.locator('#todayGoalsHeadline')).toHaveText('Set a strength goal');
  await openGoals(page);
  await expect(page.locator('#activeGoalsList')).toContainText('No strength goals yet.');
  await page.locator('#goalsBackToday').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'today');
});

test('G1-2.1/G1-2.5: creation persists an exact opaque EKF identity with guidance off', async ({ page }) => {
  await openApp(page);
  await createGoal(page, { date: '2027-01-15', label: 'Two plates' });

  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.version).toBe(5);
  expect(stored.goals.strengthGoals).toHaveLength(1);
  expect(stored.goals.strengthGoals[0]).toMatchObject({
    accountId: 'local-jorge',
    profileId: 'jorge',
    exerciseId: BENCH_CANONICAL_ID,
    legacyExerciseId: 'barbell-bench-press',
    metric: 'one_rep_max',
    targetValue: 250,
    unit: 'lb',
    targetBasis: 'combined_external_load',
    targetDate: '2027-01-15',
    label: 'Two plates',
    status: 'active',
    guidanceEnabled: false,
    policy: { id: 'strength_double_progression_v1', version: 1 }
  });
  expect(stored.goals.strengthGoals[0].goalId).toMatch(/^[0-9a-f-]{20,}$/i);
  await expect(page.locator('#activeGoalsList')).toContainText('Tracking only');
  await page.reload();
  await expect(page.locator('#todayGoalsHeadline')).toHaveText('Barbell Bench Press');
  await expect(page.locator('#todayGoalsDetail')).toContainText('Target 250 lb total · Guidance off');
});

test('G1-1.3: only EKF external-load e1RM exercises are selectable', async ({ page }) => {
  await openApp(page);
  const eligibility = await page.evaluate(() => ({
    count: BigGainsGoals.eligibleExercises(BigGainsExerciseCatalog).length,
    bench: BigGainsGoals.isEligibleExercise(BigGainsExerciseCatalog.getById('barbell-bench-press')),
    machine: BigGainsGoals.isEligibleExercise(BigGainsExerciseCatalog.getById('seated-machine-chest-press')),
    carry: BigGainsGoals.isEligibleExercise(BigGainsExerciseCatalog.getById('farmer-carry')),
    bodyweight: BigGainsGoals.isEligibleExercise(BigGainsExerciseCatalog.getById('pull-up')),
    catalogCount: BigGainsExerciseCatalog.exercises.length
  }));
  expect(eligibility).toMatchObject({ bench: true, machine: false, carry: false, bodyweight: false, catalogCount: 155 });
  expect(eligibility.count).toBeGreaterThan(10);

  await openGoals(page);
  await page.locator('#createStrengthGoal').click();
  await page.locator('#goalExerciseSearch').fill('seated machine chest press');
  await expect(page.locator('#goalExerciseSelect option')).toHaveCount(0);
  await expect(page.locator('#goalExerciseNoResults')).toBeVisible();
  await expect(page.locator('#saveGoal')).toBeDisabled();
});

test('G1-2.8/G1-5.2: guidance persists but both off and on leave Train untouched in 1A', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    startWorkout('Other', false);
    addExercise('barbell-bench-press', false);
    active.exercises[0].sets[0].weight = 135;
    active.exercises[0].sets[0].reps = 5;
    saveState();
  });
  const before = await page.evaluate(() => ({ active: structuredClone(active), routines: structuredClone(state.customRoutines), workouts: structuredClone(state.workouts) }));
  await createGoal(page);
  const guidance = page.locator('[data-goal-guidance]').first();
  await expect(guidance).not.toBeChecked();
  await guidance.check();
  await expect(page.locator('#activeGoalsList')).toContainText('Train remains unchanged');

  const after = await page.evaluate(() => ({ active: structuredClone(active), routines: structuredClone(state.customRoutines), workouts: structuredClone(state.workouts) }));
  expect(after).toEqual(before);
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).goals.strengthGoals[0].guidanceEnabled).toBe(true);
  await page.reload();
  await openGoals(page);
  await expect(page.locator('[data-goal-guidance]').first()).toBeChecked();
  await expect(page.locator('#activePanel input[data-field="weight"]').first()).toHaveValue('135');
});

test('G1-2.6/G1-2.7/G1-2.11: edit, pause, resume, and remove preserve lifecycle history', async ({ page }) => {
  await openApp(page);
  await createGoal(page);
  await page.locator('[data-goal-action="edit"]').click();
  await page.locator('#goalTargetValue').fill('255');
  await page.locator('#saveGoal').click();
  await expect(page.locator('.goal-target')).toContainText('255 lb total');

  await page.locator('[data-goal-guidance]').check();
  await page.locator('[data-goal-action="pause"]').click();
  let goal = (await readStoredJson(page, STORAGE_KEYS.jorge)).goals.strengthGoals[0];
  expect(goal).toMatchObject({ status: 'paused', guidanceEnabled: false, targetValue: 255 });
  expect(goal.pausedAt).toBeTruthy();
  await page.locator('[data-goal-action="resume"]').click();
  goal = (await readStoredJson(page, STORAGE_KEYS.jorge)).goals.strengthGoals[0];
  expect(goal).toMatchObject({ status: 'active', guidanceEnabled: false });

  await page.locator('[data-goal-action="archive"]').click();
  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.goals.strengthGoals).toHaveLength(1);
  expect(stored.goals.strengthGoals[0]).toMatchObject({ status: 'archived', guidanceEnabled: false });
  await expect(page.locator('#pastGoalsSection')).toBeVisible();
  await expect(page.locator('#activeGoalsList')).toContainText('No strength goals yet.');
});

test('G1-2.6: changing the exercise archives the old identity and creates a new goal', async ({ page }) => {
  await openApp(page);
  await createGoal(page);
  const originalId = (await readStoredJson(page, STORAGE_KEYS.jorge)).goals.strengthGoals[0].goalId;
  await page.locator('[data-goal-action="edit"]').click();
  await page.locator('#goalExerciseSelect').selectOption({ label: 'Deadlift — lb total' });
  await page.locator('#goalTargetValue').fill('405');
  await page.locator('#saveGoal').click();

  const goals = (await readStoredJson(page, STORAGE_KEYS.jorge)).goals.strengthGoals;
  expect(goals).toHaveLength(2);
  expect(goals[0]).toMatchObject({ goalId: originalId, status: 'archived', guidanceEnabled: false, exerciseId: BENCH_CANONICAL_ID });
  expect(goals[1].goalId).not.toBe(originalId);
  expect(goals[1]).toMatchObject({ status: 'active', guidanceEnabled: false, legacyExerciseId: 'deadlift', targetValue: 405 });
});

test('G1-2.12: duplicate guided goals for one exercise fail closed', async ({ page }) => {
  await openApp(page);
  await openGoals(page);
  const results = await page.evaluate(() => {
    const first = bigGainsGoals.createGoal({ exerciseId: 'fe9b24dd-e6db-41d3-9395-596830a0a37a', targetValue: 250 });
    const second = bigGainsGoals.createGoal({ exerciseId: 'fe9b24dd-e6db-41d3-9395-596830a0a37a', targetValue: 275 });
    const firstEnabled = bigGainsGoals.setGuidance(first.goal.goalId, true);
    const secondEnabled = bigGainsGoals.setGuidance(second.goal.goalId, true);
    return { first, second, firstEnabled, secondEnabled };
  });
  expect(results.first.ok).toBe(true);
  expect(results.second.ok).toBe(true);
  expect(results.firstEnabled.ok).toBe(true);
  expect(results.secondEnabled).toEqual({ ok: false, reason: 'Another goal for this exercise already has guidance enabled.' });
  const goals = (await readStoredJson(page, STORAGE_KEYS.jorge)).goals.strengthGoals;
  expect(goals.filter(goal => goal.guidanceEnabled)).toHaveLength(1);
});

test('G1-2.13/G1-2.14: estimated reached and achieved remain visibly distinct', async ({ page }) => {
  await openApp(page);
  await page.evaluate(canonicalId => {
    const completedAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    state.workouts.unshift({
      id: 'stale-estimated-bench', type: 'Push', startedAt: completedAt, completedAt, durationSeconds: 3600, prs: 0,
      exercises: [{ id: 'barbell-bench-press', definitionId: canonicalId, name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell', sets: [{ id: 'stale-estimated-set', weight: 225, reps: 5, warmup: false, completed: true }] }]
    });
    saveState();
  }, BENCH_CANONICAL_ID);
  await createGoal(page);
  await expect(page.locator('#activeGoalsList')).not.toContainText('Estimated target reached');

  await page.evaluate(canonicalId => {
    const completedAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    state.workouts.unshift({
      id: 'estimated-bench', type: 'Push', startedAt: completedAt, completedAt, durationSeconds: 3600, prs: 0,
      exercises: [{ id: 'barbell-bench-press', definitionId: canonicalId, name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell', sets: [{ id: 'estimated-set', weight: 215, reps: 5, warmup: false, completed: true }] }]
    });
    saveState();
    renderAll();
  }, BENCH_CANONICAL_ID);
  await expect(page.locator('#activeGoalsList')).toContainText('Estimated target reached · No target single logged');
  await expect(page.locator('[data-goal-action="complete"]')).toBeDisabled();

  await page.evaluate(canonicalId => {
    state.workouts.unshift({
      id: 'achieved-bench', type: 'Push', startedAt: '2026-08-19T12:00:00.000Z', completedAt: '2026-08-19T13:00:00.000Z', durationSeconds: 3600, prs: 0,
      exercises: [{ id: 'barbell-bench-press', definitionId: canonicalId, name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell', sets: [{ id: 'achieved-set', weight: 250, reps: 1, warmup: false, completed: true }] }]
    });
    saveState();
    renderAll();
  }, BENCH_CANONICAL_ID);
  await expect(page.locator('#activeGoalsList')).toContainText('Target achieved · Completed single recorded');
  await page.locator('[data-goal-action="complete"]').click();
  const goal = (await readStoredJson(page, STORAGE_KEYS.jorge)).goals.strengthGoals[0];
  expect(goal).toMatchObject({ status: 'completed', guidanceEnabled: false, attainmentState: 'achieved' });
  expect(goal.attainmentEvidence).toMatchObject({ workoutId: 'achieved-bench', setId: 'achieved-set', load: 250, reps: 1 });
});

test('G1-12.5: goals stay isolated across managed profiles', async ({ page }) => {
  await openApp(page);
  await createGoal(page);

  await Promise.all([
    page.waitForNavigation(),
    page.locator('#profileSelect').selectOption('alexa')
  ]);
  await expect(page.locator('#todayGoalsHeadline')).toHaveText('Set a strength goal');
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).goals).not.toHaveProperty('strengthGoals');

  await Promise.all([
    page.waitForNavigation(),
    page.locator('#profileSelect').selectOption('jorge')
  ]);
  await expect(page.locator('#todayGoalsHeadline')).toHaveText('Barbell Bench Press');
  expect(await page.evaluate(() => {
    const foreign = { ...state.goals.strengthGoals[0], profileId: 'alexa', accountId: 'local-alexa' };
    return statePersistenceApi.normalizeState({ ...state, goals: { ...state.goals, strengthGoals: [foreign] } }).goals.strengthGoals;
  })).toEqual([]);
});

test('G1-10.4: a failed local write rolls back the goal mutation', async ({ page }) => {
  await openApp(page);
  await openGoals(page);
  await page.locator('#createStrengthGoal').click();
  await page.locator('#goalExerciseSelect').selectOption({ label: 'Barbell Bench Press — lb total' });
  await page.locator('#goalTargetValue').fill('250');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__restoreGoalStorage = () => { Storage.prototype.setItem = original; };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'big-gains-v2') throw new Error('simulated goal persistence failure');
      return original.call(this, key, value);
    };
  });
  await page.locator('#saveGoal').click();
  await expect(page.locator('#goalFormError')).toContainText('not saved');
  expect(await page.evaluate(() => state.goals.strengthGoals || [])).toEqual([]);
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).goals).not.toHaveProperty('strengthGoals');
  await page.evaluate(() => window.__restoreGoalStorage());
});

test('G1-10.5: the existing singleton goals preference remains the only sync source', async ({ page }) => {
  await openApp(page);
  await createGoal(page);
  const record = await page.evaluate(async () => {
    const records = await BigGainsCloudShadow.localRecords('jorge', state);
    return records.find(item => item.table === 'preferences' && item.clientId === 'goals');
  });
  expect(record).toMatchObject({ table: 'preferences', entityType: 'goals', clientId: 'goals' });
  expect(record.data.strengthGoals).toHaveLength(1);
  expect(record.data.strengthGoals[0]).toMatchObject({ exerciseId: BENCH_CANONICAL_ID, targetValue: 250 });
});
