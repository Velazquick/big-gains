import { expect, test } from '@playwright/test';
import {
  blankState,
  completedWorkout,
  installLocalStorageFixture,
  readStoredJson,
  STORAGE_KEYS
} from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

async function switchProfile(page, profileId) {
  await Promise.all([
    page.waitForNavigation(),
    page.locator('#profileSelect').selectOption(profileId)
  ]);
  await expect(page.locator('#profileSelect')).toHaveValue(profileId);
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();
}

test('keeps Jorge and Alexa localStorage isolated', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);

  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator('#bodyweight').fill('210');
  await page.locator('#weightForm button[type="submit"]').click();
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).weights[0].weight).toBe(210);
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).weights).toHaveLength(0);

  await switchProfile(page, 'alexa');
  await expect(page.locator('#latestWeight')).toHaveText('—');
  await page.locator('#bodyweight').fill('225');
  await page.locator('#weightForm button[type="submit"]').click();
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).weights[0].weight).toBe(225);

  await switchProfile(page, 'jorge');
  await expect(page.locator('#latestWeight')).toHaveText('210 lb');
  const jorge = await readStoredJson(page, STORAGE_KEYS.jorge);
  const alexa = await readStoredJson(page, STORAGE_KEYS.alexa);
  expect(jorge.profileId).toBe('jorge');
  expect(jorge.weights.map(entry => entry.weight)).toEqual([210]);
  expect(alexa.profileId).toBe('alexa');
  expect(alexa.weights.map(entry => entry.weight)).toEqual([225]);
});

test('rejects a cross-profile import without modifying either profile', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();
  const jorgeBefore = await readStoredJson(page, STORAGE_KEYS.jorge);
  const alexaBefore = await readStoredJson(page, STORAGE_KEYS.alexa);

  const alexaBackup = {
    ...blankState('alexa'),
    goals: { primary: 'Alexa imported goal' },
    weights: [{ weight: 224, date: '2026-08-01T12:00:00.000Z' }],
    workouts: [completedWorkout({ id: 'alexa-imported-workout', type: 'FullBody' })]
  };

  const dialogPromise = page.waitForEvent('dialog');
  await page.locator('#importData').setInputFiles({
    name: 'alexa-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(alexaBackup))
  });
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe('This backup belongs to Alexa, not Jorge. Switch profiles before restoring it.');
  await dialog.accept();

  expect(await readStoredJson(page, STORAGE_KEYS.jorge)).toEqual(jorgeBefore);
  expect(await readStoredJson(page, STORAGE_KEYS.alexa)).toEqual(alexaBefore);
});

test('renders completed workout history from persisted state', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);
  await page.locator('.bottom-nav [data-view="progress"]').click();

  await expect(page.locator('#history .history-item')).toHaveCount(1);
  await expect(page.locator('#history .history-item')).toContainText('Push');
  await expect(page.locator('#trainingVolume')).toHaveText('1,000 lb');
  await expect(page.locator('#latestWeight')).toHaveText('218.4 lb');
});

test('recovers a malformed but parseable current-profile state', async ({ page }) => {
  await installLocalStorageFixture(page, 'malformedButParseableState');
  await openApp(page);

  const normalized = await page.evaluate(() => ({
    workouts: Array.isArray(state.workouts),
    weights: Array.isArray(state.weights),
    prs: Boolean(state.prs) && !Array.isArray(state.prs) && typeof state.prs === 'object',
    prCount: Object.keys(state.prs).length,
    activeWorkout: state.activeWorkout,
    customRoutines: state.customRoutines,
    goals: state.goals,
    restTimerEndsAt: state.restTimerEndsAt
  }));

  expect(normalized).toEqual({
    workouts: true,
    weights: true,
    prs: true,
    prCount: 0,
    activeWorkout: null,
    customRoutines: { Pull: ['lat-pulldown'] },
    goals: { primary: 'Strength and performance' },
    restTimerEndsAt: null
  });
  await expect(page.locator('#routineSelect option')).toHaveCount(1);
  await expect(page.locator('#history')).toHaveText('Your completed workouts will appear here.');
  await expect(page.locator('#weightHistory')).toHaveText('No weigh-ins yet.');
});

test('migrates legacy workouts and weights into Jorge state', async ({ page }) => {
  await installLocalStorageFixture(page, 'legacyState');
  await openApp(page);
  await page.locator('.bottom-nav [data-view="progress"]').click();

  const migrated = await readStoredJson(page, STORAGE_KEYS.jorge);
  const migrationResult = {
    weightCount: migrated.weights.length,
    firstWeight: migrated.weights[0]?.weight ?? null,
    workoutCount: migrated.workouts.length,
    firstExercise: migrated.workouts[0]?.exercises?.[0]?.name ?? null
  };

  // Known defect: legacy migration preserves weights but discards legacy workouts.
  // This guard runs before test.fail so any result other than the exact defect or the intended fix fails normally.
  expect([
    { weightCount: 1, firstWeight: 220, workoutCount: 0, firstExercise: null },
    { weightCount: 1, firstWeight: 220, workoutCount: 1, firstExercise: 'Seated Machine Chest Press' }
  ]).toContainEqual(migrationResult);
  test.fail(true, 'Legacy migration preserves weights but discards legacy workouts.');

  expect(migrationResult).toEqual({
    weightCount: 1,
    firstWeight: 220,
    workoutCount: 1,
    firstExercise: 'Seated Machine Chest Press'
  });
  await expect(page.locator('#history .history-item')).toHaveCount(1);
});
