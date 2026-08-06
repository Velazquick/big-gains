import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';

test('renders active notes and persists cue, session note, and rest preference', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  const notes = page.locator('[data-note-block="0"]');
  await expect(notes).toContainText('Notes & rest');
  await notes.locator('summary').click();
  await notes.locator('[data-saved-cue="0"]').fill('Seat 4 · slow negative');
  await notes.locator('[data-session-note="0"]').fill('Shoulder felt good.');
  await notes.locator('[data-rest-seconds="0"]').selectOption('60');

  await expect(notes.locator('summary span')).toHaveText('1:00');
  const stored = await jorgeState(page);
  expect(stored.exercisePreferences['seated-machine-chest-press']).toEqual({
    cue: 'Seat 4 · slow negative',
    restSeconds: 60
  });
  expect(stored.activeWorkout.exercises[0].note).toBe('Shoulder felt good.');
  expect(stored.activeWorkout.exercises[0].restSeconds).toBe(60);
});

test('starts, resumes, and expires rest with the existing messages', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  await page.locator('[data-note-block="0"] summary').click();
  await page.locator('[data-rest-seconds="0"]').selectOption('60');
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();

  await expect(page.locator('#timerCard')).not.toHaveClass(/hidden/);
  await expect(page.locator('#timerDisplay')).toHaveText(/00:(59|60)/);
  await expect(page.locator('#timerNext')).toHaveText('Seated Machine Chest Press · 1:00 recovery.');

  await page.reload();
  await expect(page).toHaveTitle('Big Gains');
  await expect(page.locator('#timerCard')).not.toHaveClass(/hidden/);
  await expect(page.locator('#timerNext')).toHaveText('Recover. Your next set is waiting.');

  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  await expect(page.locator('#timerDisplay')).toHaveText('00:00');
  await expect(page.locator('#timerNext')).toHaveText("Rest complete. You're up.");
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();
});

test('opens workout history and renders the saved session note', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);

  await page.locator('.bottom-nav button[data-view="progress"]').click();
  await page.locator('[data-history-id="completed-push-1"]').click();

  await expect(page.locator('#historyDialog')).toBeVisible();
  await expect(page.locator('#historyDialogTitle')).toHaveText('Push');
  await expect(page.locator('#historyDialogContent .history-exercise h3')).toHaveText('Seated Machine Chest Press');
  await expect(page.locator('#historyDialogContent .history-note')).toContainText('Strong setup and smooth reps.');
});
