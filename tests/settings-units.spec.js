import { expect, test } from '@playwright/test';
import { activeWorkout, blankState, completedWorkout, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

async function installState(page, value, activeProfile = 'jorge') {
  await page.addInitScript(({ key, profile, state }) => {
    if (localStorage.getItem('__settings_units_seeded__')) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('big-gains-active-profile', profile);
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem('__settings_units_seeded__', 'true');
  }, { key: STORAGE_KEYS[activeProfile], profile: activeProfile, state: value });
  await openApp(page);
}

async function chooseUnit(page, unit) {
  await page.locator('#openSettings').click();
  await page.locator(`#weightUnitChoice label:has(input[value="${unit}"])`).click();
}

test('canonical conversion boundary is deterministic, precise, blank-safe, and malformed-safe', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  const result = await page.evaluate(() => ({
    defaultUnit: BigGainsUnits.unitFor(state),
    poundsToKg: BigGainsUnits.fromCanonicalPounds(225, 'kg'),
    kgToPounds: BigGainsUnits.toCanonicalPounds('100', 'kg'),
    decimalKg: BigGainsUnits.toCanonicalPounds('102.5', 'kg'),
    blank: BigGainsUnits.toCanonicalPounds('', 'kg'),
    zero: BigGainsUnits.toCanonicalPounds('0', 'kg'),
    malformed: BigGainsUnits.toCanonicalPounds('10kg', 'kg')
  }));
  expect(result.defaultUnit).toBe('lb');
  expect(result.poundsToKg).toBe(102.1);
  expect(result.kgToPounds).toBeCloseTo(220.46226218, 8);
  expect(result.decimalKg).toBeCloseTo(225.9738187345, 8);
  expect(result.blank).toBe('');
  expect(result.zero).toBe(0);
  expect(result.malformed).toBeNull();
});

test('profile preference persists while repeated toggles never rewrite canonical History or bodyweight', async ({ page }) => {
  const original = {
    ...blankState('jorge'),
    workouts: [completedWorkout()],
    weights: [{ weight: 218.4, date: '2026-08-04T18:30:00.000Z' }]
  };
  await installState(page, original);
  await chooseUnit(page, 'kg');
  await expect(page.locator('#diagnosticWeightUnit')).toHaveText('Kilograms (kg)');
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await expect(page.locator('#latestWeight')).toHaveText('99.1 kg');
  await expect(page.locator('#history')).toContainText('454 indicated kg');

  await chooseUnit(page, 'lb');
  await chooseUnit(page, 'kg');
  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.unitPreferences).toEqual({ contractVersion: 1, weightUnit: 'kg' });
  expect(stored.workouts[0].exercises[0].sets[0].weight).toBe(100);
  expect(stored.weights[0].weight).toBe(218.4);

  await page.reload();
  await expect(page.locator('#latestWeight')).toHaveText('99.1 kg');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0].exercises[0].sets[0].weight).toBe(100);
});

test('unit preference is profile-isolated and projects through the existing cloud preference boundary', async ({ page }) => {
  await page.addInitScript(({ jorgeKey, alexaKey, jorge, alexa }) => {
    if (localStorage.getItem('__settings_units_profiles_seeded__')) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('big-gains-active-profile', 'jorge');
    localStorage.setItem(jorgeKey, JSON.stringify(jorge));
    localStorage.setItem(alexaKey, JSON.stringify(alexa));
    localStorage.setItem('__settings_units_profiles_seeded__', 'true');
  }, {
    jorgeKey: STORAGE_KEYS.jorge,
    alexaKey: STORAGE_KEYS.alexa,
    jorge: blankState('jorge'),
    alexa: blankState('alexa')
  });
  await openApp(page);
  await chooseUnit(page, 'kg');

  const unitRecord = await page.evaluate(async () => (await BigGainsCloudShadow.localRecords('jorge', state))
    .find(record => record.table === 'preferences' && record.clientId === 'units'));
  expect(unitRecord).toMatchObject({ entityType: 'unitPreferences', data: { contractVersion: 1, weightUnit: 'kg' } });

  let reloaded = page.waitForEvent('framenavigated');
  await page.locator('#profileSelect').selectOption('alexa');
  await reloaded;
  await page.locator('#openSettings').click();
  await expect(page.locator('#diagnosticWeightUnit')).toHaveText('Pounds (lb)');
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).unitPreferences).toBeUndefined();

  reloaded = page.waitForEvent('framenavigated');
  await page.locator('#profileSelect').selectOption('jorge');
  await reloaded;
  await page.locator('#openSettings').click();
  await expect(page.locator('#diagnosticWeightUnit')).toHaveText('Kilograms (kg)');
});

test('Train warm-up and working inputs prefill in kg and commit only once to canonical pounds', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), unitPreferences: { contractVersion: 1, weightUnit: 'kg' }, activeWorkout: activeWorkout() });
  const warmup = page.locator('input[data-field="weight"][data-si="0"]');
  const working = page.locator('input[data-field="weight"][data-si="1"]');
  await expect(warmup).toHaveValue('20.412');
  await expect(working).toHaveValue('45.359');
  await working.fill('100');
  await expect.poll(() => page.evaluate(() => state.activeWorkout.exercises[0].sets[1].weight)).toBeCloseTo(220.46226218, 8);
  await page.locator('button[data-adjust="5"][data-field="weight"][data-si="1"]').click();
  expect(await page.evaluate(() => state.activeWorkout.exercises[0].sets[1].weight)).toBeCloseTo(225.46226218, 8);
});

test('History, Progress records, Goal editing, and retrospective editing convert presentation only', async ({ page }) => {
  const workout = completedWorkout({
    exercises: [{
      id: 'triceps-pushdown', definitionId: 'triceps-pushdown', name: 'Triceps Pushdown', muscle: 'Triceps', equipment: 'Cable',
      sets: [{ id: 'push-100', weight: 100, reps: 8, warmup: false, completed: true }]
    }]
  });
  const stateValue = { ...blankState('jorge'), workouts: [workout] };
  await installState(page, stateValue);
  await chooseUnit(page, 'kg');
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await expect(page.locator('#history')).toContainText('363 indicated kg');
  await page.locator('#history [data-history-id="completed-push-1"]').click();
  await expect(page.locator('#historyDialogContent')).toContainText('45.4 kg × 8');
  await page.locator('#editCompletedWorkout').click();
  await expect(page.locator('[data-retro-field="weight"]')).toHaveValue('45.359');
  await page.locator('#cancelRetrospectiveWorkout').click();
  await page.locator('#progressExerciseSelect').selectOption('triceps-pushdown');
  await expect(page.locator('#progressPreview')).toContainText('Indicated Load Record');
  await expect(page.locator('#progressPreview')).toContainText('45.4 kg');
  await expect(page.locator('#progressPreview')).toContainText('machine setups may differ');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0].exercises[0].sets[0].weight).toBe(100);
});

test('strength Goal input, prefill, and display use kg while preserving canonical target storage', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), unitPreferences: { contractVersion: 1, weightUnit: 'kg' } });
  await page.locator('#todayGoalsOpen').click();
  await page.locator('#createStrengthGoal').click();
  await page.locator('#goalExerciseSelect').selectOption({ label: 'Barbell Bench Press — kg total' });
  await page.locator('#goalTargetValue').fill('100');
  await page.locator('#saveGoal').click();
  await expect(page.locator('.goal-target')).toContainText('100 kg total');
  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.goals.strengthGoals[0].targetValue).toBeCloseTo(220.46226218, 8);
  expect(stored.goals.strengthGoals[0].unit).toBe('lb');

  await page.locator('[data-goal-action="edit"]').click();
  await expect(page.locator('#goalTargetValue')).toHaveValue('100');
  await page.locator('#goalTargetValue').fill('102.5');
  await page.locator('#saveGoal').click();
  stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.goals.strengthGoals[0].targetValue).toBeCloseTo(225.9738187345, 8);
});

test('export v1 stays canonical and explicit while carrying additive preferred-unit metadata', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), workouts: [completedWorkout()], unitPreferences: { contractVersion: 1, weightUnit: 'kg' } });
  const exported = await page.evaluate(() => BigGainsUserDataExport.prepare({
    state,
    profile: { id: 'jorge', displayName: 'Jorge', presentation: {} },
    catalog: BigGainsExerciseCatalog,
    appVersion: BIG_GAINS_ASSET_MANIFEST.release,
    exportedAt: '2026-08-31T12:00:00.000Z'
  }).json.data);
  expect(exported.format).toBe('big-gains.user-export.v1');
  expect(exported.metadata).toMatchObject({ canonicalWeightUnit: 'lb', preferredWeightUnit: 'kg' });
  expect(exported.workouts[0].exercises[0].sets[0].entered).toMatchObject({ load: 100, loadUnit: 'lb' });
  expect(exported.preferences.weightUnits).toEqual({ canonicalStorageUnit: 'lb', preferredDisplayUnit: 'kg' });
});

test('Settings is scannable at phone width and engineering details stay collapsed', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await page.locator('#openSettings').click();
  await expect(page.locator('#viewSettings')).toBeVisible();
  await expect(page.locator('#weightUnitChoice')).toBeVisible();
  await expect(page.locator('#advancedDiagnostics')).not.toHaveAttribute('open');
  await expect(page.locator('.cloud-advanced-diagnostics')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
