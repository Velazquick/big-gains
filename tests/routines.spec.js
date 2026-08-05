import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { chooseSession, jorgeState, openApp, startSelectedSession } from './helpers/app.js';

const routines = [
  { selectorType: 'Push', storedType: 'Push', title: 'Jorge Push', count: 6, first: 'Seated Machine Chest Press' },
  { selectorType: 'Pull', storedType: 'Pull', title: 'Pull — Back + Biceps', count: 6, first: 'Lat Pulldown' },
  { selectorType: 'Legs', storedType: 'Legs', title: 'Legs + Core', count: 7, first: 'Leg Press' },
  { selectorType: 'Core', storedType: 'Core', title: 'Core', count: 10, first: 'Cable Crunch' },
  { selectorType: 'FullBody', storedType: 'FullBody', title: 'Full Body', count: 8, first: 'Seated Machine Chest Press' },
  { selectorType: 'Cardio', storedType: 'Cardio', title: 'Conditioning', count: 1, first: 'Treadmill Run' }
];

for (const routine of routines) {
  test(`loads the ${routine.title} routine from the session selector`, async ({ page }) => {
    await installLocalStorageFixture(page, 'blankJorge');
    await openApp(page);
    await chooseSession(page, routine.selectorType);
    await startSelectedSession(page);

    await expect(page.locator('#activeWorkoutTitle')).toHaveText(routine.title);
    await expect(page.locator('#activeExercises .active-exercise')).toHaveCount(routine.count);
    await expect(page.locator('#activeExercises .active-exercise').first().locator('h3')).toHaveText(routine.first);

    const stored = await jorgeState(page);
    expect(stored.activeWorkout.type).toBe(routine.storedType);
    expect(stored.activeWorkout.exercises).toHaveLength(routine.count);
  });
}

test('starts a selected session and resumes it after reload', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await chooseSession(page, 'Pull');
  await startSelectedSession(page);
  await expect(page.locator('#activeWorkoutTitle')).toHaveText('Pull — Back + Biceps');

  await page.reload();
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();
  await page.locator('.bottom-nav [data-view="today"]').click();
  await expect(page.locator('#quickStartSession')).toHaveText('Resume');
  await page.locator('#quickStartSession').click();

  await expect(page.locator('body')).toHaveAttribute('data-view', 'train');
  await expect(page.locator('#activeWorkoutTitle')).toHaveText('Pull — Back + Biceps');
  await expect(page.locator('#activeExercises .active-exercise')).toHaveCount(6);
});

test('repairs an empty persisted active session with its saved routine', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithZeroExercises');
  await openApp(page);

  await expect.poll(async () => (await jorgeState(page)).activeWorkout.exercises.length).toBe(6);
  await expect(page.locator('#activeWorkoutTitle')).toHaveText('Pull — Back + Biceps');
  await expect(page.locator('#activeExercises .active-exercise')).toHaveCount(6);
  await expect(page.locator('#quickStartSession')).toHaveText('Resume');
});

test('loads a Library routine while a different workout is active', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  const originalId = (await jorgeState(page)).activeWorkout.id;

  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#dayTabs [data-day="Pull"]').click();
  await expect(page.locator('#routineSelect')).toHaveValue('Pull');
  await page.locator('#loadRoutine').click();

  await expect(page.locator('body')).toHaveAttribute('data-view', 'train');
  await expect(page.locator('#activeWorkoutTitle')).toHaveText('Pull — Back + Biceps');
  await expect(page.locator('#activeExercises .active-exercise')).toHaveCount(6);

  const stored = await jorgeState(page);
  expect(stored.activeWorkout.id).not.toBe(originalId);
  expect(stored.activeWorkout.type).toBe('Pull');
});
