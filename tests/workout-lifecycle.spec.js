import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';

test('completes a set, starts rest, and finishes the workout', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  await page.locator('[data-toggle-exercise="0"]').click();
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();

  await expect(page.locator('#timerCard')).not.toHaveClass(/hidden/);
  await expect(page.locator('#timerDisplay')).toHaveText(/02:(29|30)/);
  await expect(page.locator('#finishWorkout')).toBeEnabled();

  const duringRest = await jorgeState(page);
  expect(duringRest.activeWorkout.exercises[0].sets[1].completed).toBe(true);
  expect(duringRest.restTimerEndsAt).toBeGreaterThan(Date.now());

  await page.locator('#finishWorkout').click();
  await expect(page.locator('#activePanel')).toHaveClass(/hidden/);
  await expect(page.locator('body')).toHaveAttribute('data-view', 'today');

  const finished = await jorgeState(page);
  expect(finished.activeWorkout).toBeNull();
  expect(finished.restTimerEndsAt).toBeNull();
  expect(finished.workouts).toHaveLength(1);
  expect(finished.workouts[0].exercises[0].sets).toHaveLength(1);
  expect(finished.workouts[0].exercises[0].sets[0].completed).toBe(true);
});

test('discards an active workout only after the two-step confirmation', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  await page.locator('#cancelWorkout').click();
  await expect(page.locator('#cancelWorkout')).toHaveText('Tap again to discard');
  expect((await jorgeState(page)).activeWorkout).not.toBeNull();

  await page.locator('#cancelWorkout').click();
  await expect(page.locator('#activePanel')).toHaveClass(/hidden/);

  const discarded = await jorgeState(page);
  expect(discarded.activeWorkout).toBeNull();
  expect(discarded.workouts).toHaveLength(0);
});
