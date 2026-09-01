import { expect, test } from '@playwright/test';
import { activeWorkout, blankState, completedWorkout, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const unitPreference = weightUnit => ({ contractVersion: 1, weightUnit });

async function installState(page, value, { alexa = null, activeProfile = 'jorge' } = {}) {
  await page.addInitScript(({ jorgeKey, alexaKey, activeProfileKey, activeProfileId, state, alexaState }) => {
    if (localStorage.getItem('__active_workout_units_seeded__')) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(activeProfileKey, activeProfileId);
    localStorage.setItem(jorgeKey, JSON.stringify(state));
    if (alexaState) localStorage.setItem(alexaKey, JSON.stringify(alexaState));
    localStorage.setItem('__active_workout_units_seeded__', 'true');
  }, {
    jorgeKey: STORAGE_KEYS.jorge,
    alexaKey: STORAGE_KEYS.alexa,
    activeProfileKey: STORAGE_KEYS.activeProfile,
    activeProfileId: activeProfile,
    state: value,
    alexaState: alexa
  });
  await openApp(page);
}

const unitButton = (page, unit) => page.locator(`[data-workout-unit="${unit}"]`);
const weightInput = (page, exerciseIndex, setIndex) => page.locator(`input[data-field="weight"][data-ei="${exerciseIndex}"][data-si="${setIndex}"]`);

async function chooseWorkoutUnit(page, unit) {
  await unitButton(page, unit).click();
  await expect(unitButton(page, unit)).toHaveAttribute('aria-pressed', 'true');
}

function semanticActiveWorkout(overrides = {}) {
  const set = (id, weight, warmup = false) => ({ id, weight, reps: 8, warmup, completed: false });
  return activeWorkout({
    exercises: [
      {
        id: 'seated-machine-chest-press', name: 'Seated Machine Chest Press', muscle: 'Chest', equipment: 'Machine', collapsed: false,
        sets: [set('external-warmup', 45, true), set('external-working', 100)]
      },
      {
        id: 'pull-up', name: 'Pull-Up', muscle: 'Back', equipment: 'Bodyweight', collapsed: true,
        sets: [set('bodyweight-working', 25)]
      },
      {
        id: 'assisted-pull-up', name: 'Assisted Pull-Up', muscle: 'Back', equipment: 'Machine', collapsed: true,
        sets: [set('assistance-working', 50)]
      }
    ],
    ...overrides
  });
}

test('effective unit follows workout override, then profile preference, then pounds', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), activeWorkout: activeWorkout() });
  expect(await page.evaluate(() => BigGainsUnits.effectiveUnitFor({}, {}))).toBe('lb');
  expect(await page.evaluate(() => BigGainsUnits.effectiveUnitFor({}, { unitPreferences: { weightUnit: 'kg' } }))).toBe('kg');
  expect(await page.evaluate(() => BigGainsUnits.effectiveUnitFor({ displayUnitOverride: 'lb' }, { unitPreferences: { weightUnit: 'kg' } }))).toBe('lb');
  await expect(unitButton(page, 'lb')).toHaveAttribute('aria-pressed', 'true');
  await expect(weightInput(page, 0, 1)).toHaveValue('100');

  await page.evaluate(() => { state.unitPreferences = { contractVersion: 1, weightUnit: 'kg' }; saveState(); renderAll(); });
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  await expect(weightInput(page, 0, 1)).toHaveValue('45.359');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.displayUnitOverride).toBeUndefined();
});

test('explicit workout overrides rerender immediately without changing either profile default', async ({ page }) => {
  await installState(page, {
    ...blankState('jorge'),
    unitPreferences: unitPreference('lb'),
    activeWorkout: activeWorkout()
  }, {
    alexa: { ...blankState('alexa'), unitPreferences: unitPreference('kg'), activeWorkout: activeWorkout({ id: 'alexa-active' }) }
  });

  await chooseWorkoutUnit(page, 'kg');
  await expect(weightInput(page, 0, 0)).toHaveValue('20.412');
  await expect(weightInput(page, 0, 1)).toHaveValue('45.359');
  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.unitPreferences).toEqual(unitPreference('lb'));
  expect(stored.activeWorkout.displayUnitOverride).toBe('kg');

  await page.evaluate(() => { state.unitPreferences = { contractVersion: 1, weightUnit: 'kg' }; saveState(); renderAll(); });
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { state.unitPreferences = { contractVersion: 1, weightUnit: 'lb' }; saveState(); renderAll(); });
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(() => localStorage.setItem('big-gains-active-profile', 'alexa'));
  await page.reload();
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  await chooseWorkoutUnit(page, 'lb');
  stored = await readStoredJson(page, STORAGE_KEYS.alexa);
  expect(stored.unitPreferences).toEqual(unitPreference('kg'));
  expect(stored.activeWorkout.displayUnitOverride).toBe('lb');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.displayUnitOverride).toBe('kg');
});

test('repeated lb/kg toggles never mutate canonical sets and reload preserves only the active override', async ({ page }) => {
  const workout = semanticActiveWorkout({
    programOrigin: {
      contract: 'big-gains.program-origin.v1',
      accountId: 'local-jorge',
      profileId: 'jorge',
      programId: 'program-1',
      programVersionId: 'program-version-1',
      routineId: 'routine-1',
      routineVersionId: 'routine-version-1',
      slotId: 'slot-1',
      slotIndex: 0,
      cycleNumber: 1,
      materializedAt: '2026-08-05T12:00:00.000Z'
    }
  });
  await installState(page, { ...blankState('jorge'), activeWorkout: workout });
  const originalSets = await page.evaluate(() => JSON.stringify(state.activeWorkout.exercises.map(exercise => exercise.sets)));
  const originalOrigin = await page.evaluate(() => JSON.stringify(state.activeWorkout.programOrigin));

  for (const unit of ['kg', 'lb', 'kg', 'lb', 'kg']) await chooseWorkoutUnit(page, unit);

  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(JSON.stringify(stored.activeWorkout.exercises.map(exercise => exercise.sets))).toBe(originalSets);
  expect(JSON.stringify(stored.activeWorkout.programOrigin)).toBe(originalOrigin);
  expect(stored.activeWorkout.displayUnitOverride).toBe('kg');
  const activeRecord = await page.evaluate(async () => (await BigGainsCloudShadow.localRecords('jorge', state))
    .find(record => record.table === 'active_sessions'));
  expect(activeRecord).toMatchObject({
    entityType: 'activeSession',
    data: { workout: { id: 'active-push-1', displayUnitOverride: 'kg' } }
  });
  await page.reload();
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  await expect(weightInput(page, 0, 1)).toHaveValue('45.359');
  expect(JSON.stringify((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises.map(exercise => exercise.sets))).toBe(originalSets);
});

test('kg edits commit once to canonical pounds for warm-up, working, added-load, and assistance inputs', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), activeWorkout: semanticActiveWorkout() });
  await chooseWorkoutUnit(page, 'kg');

  await expect(weightInput(page, 0, 0)).toHaveValue('20.412');
  await expect(weightInput(page, 0, 1)).toHaveValue('45.359');
  await expect(weightInput(page, 1, 0)).toHaveValue('11.34');
  await expect(weightInput(page, 2, 0)).toHaveValue('22.68');
  await expect(page.locator('.weight-stepper .stepper-unit')).toHaveText(['kg', 'kg', 'kg', 'kg']);

  await weightInput(page, 0, 0).fill('10');
  await weightInput(page, 0, 1).fill('10');
  await page.locator('[data-toggle-exercise="1"]').click();
  await weightInput(page, 1, 0).fill('10');
  await page.locator('[data-toggle-exercise="2"]').click();
  await weightInput(page, 2, 0).fill('10');
  const weights = (await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises.map(exercise => exercise.sets.map(set => set.weight));
  for (const weight of weights.flat()) expect(weight).toBeCloseTo(22.046226218, 8);

  await page.locator('[data-toggle-exercise="1"]').click();
  await weightInput(page, 1, 0).fill('');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[1].sets[0].weight).toBe('');
  await weightInput(page, 1, 0).fill('0');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[1].sets[0].weight).toBe(0);
  await expect(page.locator('.active-exercise').nth(1)).toContainText('Added weight');
  await expect(page.locator('.active-exercise').nth(2)).toContainText('Assistance');
});

test('active guidance, prior load, delta, and workload copy use the effective workout unit', async ({ page }) => {
  const workout = activeWorkout();
  workout.exercises[0].goalGuidance = {
    version: 1,
    goalId: 'goal-1',
    exerciseId: 'seated-machine-chest-press',
    exerciseName: 'Seated Machine Chest Press',
    targetValue: 250,
    targetUnit: 'lb',
    targetBasis: 'entered_load',
    status: 'available',
    reasonCode: 'ADD_REPS',
    explanation: 'Keep the load and add reps.',
    recommendation: { enteredLoad: 190, repTargets: [5, 5, 5], workingSetCount: 3 },
    display: { goal: '250 lb', load: '190 lb', loadLabel: 'Weight' }
  };
  workout.exercises[0].sets[1].completed = true;
  await installState(page, {
    ...blankState('jorge'),
    workouts: [completedWorkout()],
    activeWorkout: workout
  });
  await chooseWorkoutUnit(page, 'kg');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Today: 86.2 kg × 5 · 3 sets');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('113.4 kg');
  await expect(page.locator('[data-previous-performance="seated-machine-chest-press"]')).toContainText('45.4 kg');
  await expect(page.locator('.collapsed-summary')).toContainText('indicated kg');
});

test('completion and discard end override lifetime while History and the next workout use profile units', async ({ page }) => {
  await installState(page, {
    ...blankState('jorge'),
    unitPreferences: unitPreference('kg'),
    activeWorkout: activeWorkout({ displayUnitOverride: 'lb' })
  });
  await page.locator('button[data-complete-set][data-si="1"]').click();
  expect(await page.evaluate(() => workoutSessionController.complete())).toBe(true);
  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.activeWorkout).toBeNull();
  expect(stored.workouts[0]).not.toHaveProperty('displayUnitOverride');
  expect(stored.workouts[0].exercises[0].sets[0].weight).toBe(100);
  expect(stored.unitPreferences).toEqual(unitPreference('kg'));

  await page.locator('#completionDone').click();
  await page.evaluate(() => workoutSessionController.start('Push', { loadRoutine: true, scroll: false }));
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout).not.toHaveProperty('displayUnitOverride');
  await page.getByRole('button', { name: 'Return to workout' }).click();
  await chooseWorkoutUnit(page, 'lb');
  expect(await page.evaluate(() => workoutSessionController.discard())).toBe(true);
  stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.activeWorkout).toBeNull();
  await page.evaluate(() => workoutSessionController.start('Push', { loadRoutine: true, scroll: false }));
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
});

test('completed History and retrospective editing ignore any legacy-looking workout override', async ({ page }) => {
  const historical = completedWorkout({ displayUnitOverride: 'kg' });
  await installState(page, {
    ...blankState('jorge'),
    unitPreferences: unitPreference('lb'),
    workouts: [historical]
  });
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await expect(page.locator('#history')).toContainText('1K indicated lb');
  await page.locator('#history [data-history-id="completed-push-1"]').click();
  await expect(page.locator('#historyDialogContent')).toContainText('100 lb × 10');
  await page.locator('#editCompletedWorkout').click();
  await expect(page.locator('[data-retro-field="weight"]')).toHaveValue('100');
  expect(await page.evaluate(() => Object.hasOwn(state.workouts[0], 'displayUnitOverride'))).toBe(false);
});

test('active override and canonical edits survive an offline reload', async ({ page, context }) => {
  await installState(page, { ...blankState('jorge'), activeWorkout: activeWorkout() });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await chooseWorkoutUnit(page, 'kg');
  await weightInput(page, 0, 1).fill('100');
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle('Big Gains');
    await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
    await expect(weightInput(page, 0, 1)).toHaveValue('100');
    expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[0].sets[1].weight).toBeCloseTo(220.46226218, 8);
  } finally {
    await context.setOffline(false);
  }
});

test('phone-width segmented control stays tappable and inside the sticky workout header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installState(page, { ...blankState('jorge'), activeWorkout: activeWorkout() });
  const boxes = await page.locator('[data-workout-unit]').evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect();
    return { width: rect.width, height: rect.height, left: rect.left, right: rect.right };
  }));
  expect(boxes).toHaveLength(2);
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(42);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(390);
  }
  await expect(page.locator('#activeWorkoutUnitChoice')).toBeVisible();
  await expect(page.locator('#workoutClock')).toBeVisible();
  await expect(page.locator('#cancelWorkout')).toBeVisible();
});
