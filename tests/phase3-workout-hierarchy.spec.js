import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';

test('READY holds for three seconds, auto-dismisses, and keeps the pet ready', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });

  await expect(page.locator('#timerCard')).toHaveClass(/timer-feedback-ready/);
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Rest complete. Ready for your next set.');
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'ready');
  await page.waitForTimeout(3200);
  await expect(page.locator('#timerCard')).toBeHidden();
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'ready');

  await page.locator('input[data-ei="0"][data-si="1"][data-field="reps"]').fill('9');
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'calm');
});

test('background return announces an expired absolute deadline exactly once', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.evaluate(() => {
    state.restTimerEndsAt = Date.now() - 1000;
    saveState();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Rest complete. Ready for your next set.');
  const key = await page.evaluate(() => lastAnnouncedCompletionKey);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(await page.evaluate(() => lastAnnouncedCompletionKey)).toBe(key);
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();
});

test('compact presets stay hidden, preserve the deadline until selection, and replace it absolutely', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.evaluate(() => { state.restTimerEndsAt = Date.now() + 90_000; saveState(); runRestTimer(); });
  const original = (await jorgeState(page)).restTimerEndsAt;

  await expect(page.locator('#timerPresets')).toBeHidden();
  await page.locator('#timerAdjust').click();
  await expect(page.locator('#timerAdjust')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#timerPresets')).toBeVisible();
  expect((await jorgeState(page)).restTimerEndsAt).toBe(original);

  const selectedAt = Date.now();
  await page.locator('[data-timer-preset="120"]').click();
  await expect(page.locator('#timerPresets')).toBeHidden();
  const deadline = (await jorgeState(page)).restTimerEndsAt;
  expect(deadline).toBeGreaterThanOrEqual(selectedAt + 119_000);
  expect(deadline).toBeLessThanOrEqual(Date.now() + 121_000);
});

test('reduced motion removes timer and hierarchy animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  expect(await page.locator('#timerCard').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  expect(await page.locator('.active-exercise').first().evaluate(element => getComputedStyle(element).transitionDuration)).toMatch(/^(0s|0\.01s)$/);
});

test('exercise cards expose active, upcoming, completed, prior-performance, progress, and predictable focus', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await openApp(page);
  await page.evaluate(() => {
    state.workouts = [{
      id: 'prior-push', type: 'Push', completedAt: new Date(Date.now() - 86_400_000).toISOString(), exercises: [{
        id: 'seated-machine-chest-press', name: 'Seated Machine Chest Press', sets: [{ id: 'prior-set', weight: 100, reps: 10, warmup: false, completed: true }]
      }]
    }];
    saveState();
    renderActive();
  });
  const cards = page.locator('#activeExercises .active-exercise');

  await expect(cards.nth(0)).toHaveClass(/is-active/);
  await expect(cards.nth(0)).toHaveAttribute('aria-current', 'step');
  await expect(cards.nth(0).locator('.exercise-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(cards.nth(0)).toContainText('Last');
  await expect(cards.nth(0)).toContainText('100 × 10');
  await expect(cards.nth(0)).toContainText('Set 1 of 3');
  await expect(cards.nth(1)).toHaveClass(/is-upcoming/);
  await expect(cards.nth(1)).toHaveClass(/is-collapsed/);

  await cards.nth(1).getByRole('button', { name: 'Expand Lat Pulldown', exact: true }).click();
  await expect(cards.nth(1)).toHaveClass(/is-active/);
  expect((await jorgeState(page)).activeWorkout.focusedExerciseId).toBe('lat-pulldown');

  await page.evaluate(() => {
    const exercise = active.exercises[1];
    exercise.sets.filter(set => !set.warmup).forEach(set => { set.completed = true; });
    workoutControlsApi.advanceAfterCompletion(active, 1);
    autosave();
    renderActive();
  });
  await expect(cards.nth(1)).toHaveClass(/is-complete/);
  await expect(cards.nth(1)).toHaveClass(/is-collapsed/);
  await expect(cards.nth(1)).toContainText('3 of 3 complete');
  await expect(cards.nth(0)).toHaveClass(/is-active/);

  await cards.nth(1).getByRole('button', { name: 'Expand Lat Pulldown', exact: true }).click();
  await expect(cards.nth(1).locator('.active-exercise-body')).toBeVisible();
  await expect(cards.nth(1).getByRole('button', { name: /Mark set incomplete/ }).first()).toBeVisible();
  expect((await jorgeState(page)).activeWorkout.exercises).toHaveLength(2);
});
