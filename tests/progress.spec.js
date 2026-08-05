import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

test('decorates the exercise library after a library render', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  await page.locator('.bottom-nav button[data-view="library"]').click();
  await page.getByText('Browse full exercise library').click();
  await page.locator('#exerciseLibrary [data-progress-exercise]').evaluateAll(buttons => buttons.forEach(button => button.remove()));
  await page.evaluate(() => window.renderLibrary());

  const firstCard = page.locator('#exerciseLibrary .exercise-card').first();
  await expect(firstCard.getByRole('button', { name: 'Progress' })).toBeVisible();
  await expect(firstCard.locator('[data-add]')).toBeVisible();
});

test('decorates the active session after an active render', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  await page.locator('#activeExercises [data-progress-exercise]').evaluateAll(buttons => buttons.forEach(button => button.remove()));
  await page.evaluate(() => window.renderActive());

  const activeExercise = page.locator('#activeExercises .active-exercise').first();
  await expect(activeExercise.getByRole('button', { name: 'Progress' })).toBeVisible();
  await expect(activeExercise.locator('[data-remove-exercise]')).toBeVisible();
});

test('decorates workout history when history opens', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);

  await page.locator('.bottom-nav button[data-view="progress"]').click();
  await page.locator('[data-history-id="completed-push-1"]').click();

  await expect(page.locator('#historyDialog')).toBeVisible();
  const exercise = page.locator('#historyDialogContent .history-exercise').first();
  await expect(exercise.getByRole('button', { name: 'Progress' })).toBeVisible();
  await expect(exercise.getByRole('button', { name: 'Progress' })).toHaveAttribute('data-progress-exercise', 'seated-machine-chest-press');
});

test('refreshes the progress panel after a full render without persisting', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);

  const storageWrites = await page.evaluate(() => {
    document.getElementById('progressExerciseSelect').innerHTML = '<option>stale</option>';
    document.getElementById('progressPreview').textContent = 'stale';
    const original = Storage.prototype.setItem;
    let writes = 0;
    Storage.prototype.setItem = function (...args) {
      writes += 1;
      return original.apply(this, args);
    };
    try {
      window.renderAll();
      return writes;
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  expect(storageWrites).toBe(0);
  await expect(page.locator('#progressExerciseSelect')).toHaveValue('seated-machine-chest-press');
  await expect(page.locator('#progressPreview')).toContainText('Seated Machine Chest Press');
  await expect(page.locator('#progressPreview')).toContainText('Best e1RM');
});
