import { expect, test } from '@playwright/test';
import { blankState, completedWorkout, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const DUMBBELL_BENCH_CANONICAL_ID = '64a28c27-909f-4f0a-adfa-7a294dcea60c';

async function openLibrary(page) {
  await page.evaluate(() => bigGainsViewShell.showView('library', { workout: false }));
  await expect(page.locator('#viewLibrary')).toBeVisible();
}

async function openProgram(page) {
  await openLibrary(page);
  await page.locator('.bottom-nav [data-view="plan"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'plan');
  await page.locator('[data-plan-setup]').first().click();
  await expect(page.locator('#programSetupDialog')).toBeVisible();
}

async function choosePickerResult(page, search, name) {
  await page.locator('#exercisePickerSearch').fill(search);
  const result = page.locator('.exercise-picker-all [data-exercise-picker-select]', { hasText: name });
  await expect(result).toHaveCount(1);
  await result.click();
}

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
});

test('Program Setup replaces the implicit Arnold Press first option with exact canonical add, exclusion, replace, and approval invalidation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openApp(page);
  await openProgram(page);
  await page.getByLabel('Build or revise this session').check();

  const initialCount = await page.locator('[data-program-exercise]').count();
  await expect(page.locator('#programAddExercise')).toHaveCount(0);
  await page.locator('[data-program-add]').click();
  await expect(page.locator('#exercisePickerDialog')).toBeVisible();
  await expect(page.locator('#programSetupDialog')).not.toHaveAttribute('open', '');
  await expect(page.locator('[data-program-exercise]')).toHaveCount(initialCount);
  await expect(page.locator('.exercise-picker-suggested [data-exercise-picker-select] h3').first()).toHaveText('Arnold Press');

  await choosePickerResult(page, 'DB Bench', 'Dumbbell Bench Press');
  await expect(page.locator('#programSetupDialog')).toBeVisible();
  await expect(page.locator('[data-program-exercise]')).toHaveCount(initialCount + 1);
  await expect(page.locator('[data-program-exercise] header strong').last()).toHaveText('Dumbbell Bench Press');

  await page.locator('[data-program-add]').click();
  await page.locator('#exercisePickerSearch').fill('DB Bench');
  await expect(page.locator('.exercise-picker-all [data-exercise-picker-select]')).toHaveCount(0);
  await page.locator('#closeExercisePicker').click();

  await page.locator('[data-program-approve-routine]').click();
  await expect(page.locator('#programSetupNext')).toBeEnabled();
  const approved = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(approved.programCapture.routineVersions[0].exercises.at(-1).exerciseId).toBe(DUMBBELL_BENCH_CANONICAL_ID);

  await page.locator('[data-program-replace]').last().click();
  await expect(page.locator('[data-exercise-picker-select][aria-current="true"]')).toContainText('Dumbbell Bench Press');
  await choosePickerResult(page, 'Cable Chest Press', 'Cable Chest Press');
  await expect(page.locator('[data-program-exercise] header strong').last()).toHaveText('Cable Chest Press');
  await expect(page.locator('#programSetupNext')).toBeDisabled();
  await expect(page.locator('[data-program-approve-routine]')).toContainText('Approve Push for future Program slots');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).programCapture.routineVersions).toEqual(approved.programCapture.routineVersions);
});

test('Suggested stays visibly separate while All exercises remains deterministic true A–Z for arbitrary session labels', async ({ page }) => {
  await openApp(page);
  await openProgram(page);
  await page.locator('[data-program-add]').click();
  await expect(page.locator('.exercise-picker-suggested .exercise-picker-section-head')).toContainText('Suggested for Push');
  const names = await page.locator('.exercise-picker-all [data-exercise-picker-select] h3').allTextContents();
  expect(names).toEqual(names.slice().sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })));
  expect(names[0]).toBe('45-Degree Back Extension');

  await page.locator('#closeExercisePicker').click();
  const arbitrary = await page.evaluate(() => {
    const suggestion = BigGainsExerciseCatalog.resolve('Deadlift').canonicalId;
    bigGainsExercisePicker.open({
      title: 'Choose for Power-ish Tuesday',
      suggestionIds: [suggestion],
      suggestionLabel: 'Suggested for Power-ish Tuesday'
    });
    return suggestion;
  });
  await expect(page.locator('.exercise-picker-suggested')).toContainText('Suggested for Power-ish Tuesday');
  await expect(page.locator(`.exercise-picker-suggested [data-exercise-picker-select="${arbitrary}"]`)).toContainText('Deadlift');
  const arbitraryAll = await page.locator('.exercise-picker-all [data-exercise-picker-select] h3').allTextContents();
  expect(arbitraryAll).toEqual(arbitraryAll.slice().sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })));
});

test('search supports canonical names and trusted aliases; muscle and equipment filters compose with distinguishing metadata', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => bigGainsExercisePicker.open({ title: 'Catalog test' }));

  await page.locator('#exercisePickerSearch').fill('Dumbbell Bench Press');
  await expect(page.locator('.exercise-picker-all [data-exercise-picker-select] h3')).toHaveText('Dumbbell Bench Press');
  await page.locator('#exercisePickerSearch').fill('DB Bench');
  const aliasResult = page.locator('.exercise-picker-all [data-exercise-picker-select]');
  await expect(aliasResult).toHaveCount(1);
  await expect(aliasResult).toContainText('Dumbbell Bench Press');
  await expect(aliasResult).toContainText('Dumbbell');
  await expect(aliasResult).toContainText('Weight per dumbbell');

  await page.locator('#exercisePickerSearch').fill('');
  await page.locator('#exercisePickerMuscle').selectOption('Chest');
  await page.locator('#exercisePickerEquipment').selectOption('Dumbbell');
  const filtered = page.locator('.exercise-picker-all [data-exercise-picker-select]');
  expect(await filtered.count()).toBeGreaterThan(1);
  const metadata = await filtered.evaluateAll(rows => rows.map(row => row.textContent));
  expect(metadata.every(text => text.includes('Chest') && text.includes('Dumbbell'))).toBe(true);

  await page.locator('#exercisePickerClearFilters').click();
  await page.locator('#exercisePickerSearch').fill('Seated Iso-Lateral Bench Press');
  const isoLateralResult = page.locator('.exercise-picker-all [data-exercise-picker-select]').filter({
    has: page.locator('h3', { hasText: /^Seated Iso-Lateral Bench Press$/ })
  });
  await expect(isoLateralResult).toContainText('Weight per side');
  await page.locator('#exercisePickerSearch').fill('Seated Machine Chest Press');
  const machineResult = page.locator('.exercise-picker-all [data-exercise-picker-select]').filter({
    has: page.locator('h3', { hasText: /^Seated Machine Chest Press$/ })
  });
  await expect(machineResult).toContainText('Machine weight');
});

test('Recent is bounded, most-recent-first, canonical, and fails closed across profile boundaries', async ({ page }) => {
  const recentState = {
    ...blankState('jorge'),
    workouts: [
      completedWorkout({
        id: 'newer',
        completedAt: '2026-08-19T18:00:00.000Z',
        exercises: [{ id: 'dumbbell-bench-press', name: 'Dumbbell Bench Press', muscle: 'Chest', equipment: 'Dumbbell', sets: [] }]
      }),
      completedWorkout({
        id: 'older',
        completedAt: '2026-08-18T18:00:00.000Z',
        exercises: [{ id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable', sets: [] }]
      })
    ]
  };
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEYS.jorge, value: recentState });
  await openApp(page);
  await page.evaluate(() => bigGainsExercisePicker.open({ title: 'Recent test' }));
  await expect(page.locator('.exercise-picker-recent h3').nth(1)).toHaveText('Dumbbell Bench Press');
  await expect(page.locator('.exercise-picker-recent h3').nth(2)).toHaveText('Lat Pulldown');

  const isolation = await page.evaluate(() => ({
    current: BigGainsExercisePicker.recentExerciseIds({ state, profileId: 'jorge', catalog: BigGainsExerciseCatalog, limit: 1 }),
    wrongState: BigGainsExercisePicker.recentExerciseIds({ state: { ...state, profileId: 'alexa' }, profileId: 'jorge', catalog: BigGainsExerciseCatalog }),
    wrongRequest: BigGainsExercisePicker.recentExerciseIds({ state, profileId: 'alexa', catalog: BigGainsExerciseCatalog })
  }));
  expect(isolation.current).toEqual([DUMBBELL_BENCH_CANONICAL_ID]);
  expect(isolation.wrongState).toEqual([]);
  expect(isolation.wrongRequest).toEqual([]);
});

test('Goals picker keeps the exact EKF e1RM eligibility gate strict', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => bigGainsViewShell.showView('goals', { workout: false }));
  await page.locator('#createStrengthGoal').click();
  await page.locator('#chooseGoalExercise').click();
  await page.locator('#exercisePickerSearch').fill('Seated Machine Chest Press');
  await expect(page.locator('.exercise-picker-all [data-exercise-picker-select]')).toHaveCount(0);
  await page.locator('#exercisePickerSearch').fill('bench');
  const ids = await page.locator('.exercise-picker-all [data-exercise-picker-select]').evaluateAll(rows => rows.map(row => row.dataset.exercisePickerSelect));
  const allEligible = await page.evaluate(values => values.every(id => BigGainsGoals.isEligibleExercise(BigGainsExerciseCatalog.getById(id))), ids);
  expect(allEligible).toBe(true);
  expect(ids.length).toBeGreaterThan(0);
});

test('focus, Escape, keyboard selection, and browser Back work without a nested modal stack', async ({ page }) => {
  await openApp(page);
  await openLibrary(page);
  await page.locator('#addSelectedExercise').click();
  await expect(page.locator('#exercisePickerSearch')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#exercisePickerDialog')).not.toHaveAttribute('open', '');
  await expect(page.locator('#addSelectedExercise')).toBeFocused();

  await page.locator('#editRoutine').click();
  await page.locator('[data-routine-choose]').first().click();
  expect(await page.locator('dialog[open]').count()).toBe(1);
  await page.evaluate(() => history.back());
  await expect(page.locator('#exercisePickerDialog')).not.toHaveAttribute('open', '');
  await expect(page.locator('#routineDialog')).toBeVisible();

  await page.locator('[data-routine-choose]').first().click();
  await page.locator('#exercisePickerSearch').fill('DB Bench');
  const keyboardResult = page.locator('.exercise-picker-all [data-exercise-picker-select]');
  await keyboardResult.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#routineDialog')).toBeVisible();
  await expect(page.locator('[data-routine-index]').first()).toContainText('Dumbbell Bench Press');
});

test('Library reuses search/filter/result metadata and the picker remains local while offline', async ({ page, context }) => {
  await openApp(page);
  await openLibrary(page);
  await page.locator('#dayTabs [data-day="Push"]').click();
  await page.locator('#viewLibrary details').evaluate(details => { details.open = true; });
  const initialNames = await page.locator('#exerciseLibrary h3').allTextContents();
  expect(initialNames).toEqual(initialNames.slice().sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })));
  await page.locator('#exerciseSearch').fill('DB Bench');
  await expect(page.locator('#exerciseLibrary h3')).toHaveText('Dumbbell Bench Press');
  await expect(page.locator('#exerciseLibrary .exercise-card')).toContainText('Weight per dumbbell');
  await page.locator('#exerciseSearch').fill('');
  await page.locator('#muscleFilter').selectOption('Chest');
  await page.locator('#equipmentFilter').selectOption('Dumbbell');
  const filtered = await page.locator('#exerciseLibrary .exercise-card').evaluateAll(cards => cards.map(card => card.textContent));
  expect(filtered.length).toBeGreaterThan(0);
  expect(filtered.every(text => text.includes('Chest') && text.includes('Dumbbell'))).toBe(true);

  await context.setOffline(true);
  try {
    await page.locator('#addSelectedExercise').click();
    await page.locator('#exercisePickerSearch').fill('DB Bench');
    await expect(page.locator('.exercise-picker-all [data-exercise-picker-select]')).toContainText('Dumbbell Bench Press');
  } finally {
    await context.setOffline(false);
  }
});

test('safe retrospective replacement uses the picker but does not persist until the existing save authority is used', async ({ page }) => {
  const workout = completedWorkout();
  const seeded = { ...blankState('jorge'), workouts: [workout] };
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEYS.jorge, value: seeded });
  await openApp(page);
  const storedBefore = (await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0];
  await page.evaluate(() => bigGainsViewShell.showView('progress', { workout: false }));
  await page.locator(`[data-history-id="${workout.id}"]`).first().click();
  await page.locator('#editCompletedWorkout').click();
  await page.locator('[data-retro-choose="0"]').click();
  await choosePickerResult(page, 'Dumbbell Bench Press', 'Dumbbell Bench Press');
  await expect(page.locator('[data-retro-exercise="0"] h3')).toHaveText('Dumbbell Bench Press');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0]).toEqual(storedBefore);
  await page.locator('#cancelRetrospectiveWorkout').click();
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0]).toEqual(storedBefore);
});
