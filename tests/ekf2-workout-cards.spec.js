import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
});

async function openExercise(page, exerciseId) {
  await page.evaluate(id => {
    if (window.workoutSessionController) window.workoutSessionController.discard();
    startWorkout('Other', false);
    addExercise(id, false);
    window.bigGainsViewShell?.showView('train', { instant: true, workout: true });
  }, exerciseId);
  const card = page.locator('#activeExercises .active-exercise').first();
  await expect(card).toBeVisible();
  return card;
}

test('EKF-4.4: canonical exercise selection drives compact fields and exposes no semantic override', async ({ page }) => {
  let card = await openExercise(page, 'incline-dumbbell-press');
  await expect(card.locator('.stepper-label').first()).toHaveText('Weight per dumbbell');
  await expect(card.locator('input[data-field="weight"]').first()).toHaveAttribute('aria-label', 'Weight per dumbbell');

  card = await openExercise(page, 'seated-iso-lateral-bench-press');
  await expect(card.locator('.stepper-label').first()).toHaveText('Weight per side');

  card = await openExercise(page, 'seated-machine-chest-press');
  await expect(card.locator('.stepper-label').first()).toHaveText('Machine weight');

  card = await openExercise(page, 'barbell-bench-press');
  await expect(card.locator('.stepper-label').first()).toHaveText('Total weight');

  card = await openExercise(page, 'assisted-pull-up');
  await expect(card.locator('.stepper-label').first()).toHaveText('Assistance');
  await expect(page.locator('[data-field="loadBasis"], [data-field="resistanceSemantics"], select[name*="semantic"]')).toHaveCount(0);
});

test('EKF-T09/T11: reps-only, duration, and carry cards render only their canonical inputs', async ({ page }) => {
  let card = await openExercise(page, 'push-up');
  await expect(card.locator('input[data-field="weight"]')).toHaveCount(0);
  await expect(card.locator('input[data-field="reps"]')).toHaveCount(3);

  card = await openExercise(page, 'plank');
  await expect(card.locator('input[data-field="duration"]')).toHaveCount(3);
  await expect(card.locator('input[data-field="weight"], input[data-field="reps"]')).toHaveCount(0);

  card = await openExercise(page, 'farmer-carry');
  await expect(card.locator('.stepper-label')).toHaveText(['Weight per hand', 'Distance', 'Weight per hand', 'Distance', 'Weight per hand', 'Distance']);
  await expect(card.locator('input[data-field="reps"]')).toHaveCount(0);
});

test('EKF-4.2/T04: history keeps the entered per-side value and labels its interpretation', async ({ page }) => {
  await page.evaluate(() => {
    state.workouts.unshift({
      id: 'ekf2-history', type: 'Push', startedAt: '2026-08-18T12:00:00.000Z', completedAt: '2026-08-18T13:00:00.000Z', durationSeconds: 3600, prs: 0,
      exercises: [{ id: 'iso-machine-shoulder-press', name: 'Iso Machine Shoulder Press', muscle: 'Shoulders', equipment: 'Machine', sets: [{ id: 'entered-120', weight: 120, reps: 8, warmup: false, completed: true }] }]
    });
    saveState();
    renderAll();
  });
  await page.evaluate(() => openHistory('ekf2-history'));
  await expect(page.locator('#historyDialogContent')).toContainText('120 lb per side');
  await expect(page.locator('#historyDialogContent')).toContainText('1,920 indicated lb');
  await expect(page.locator('#historyDialogContent')).not.toContainText('240 lb × 8');
});
