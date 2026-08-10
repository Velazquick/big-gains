import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { chooseSession, jorgeState, openApp, startSelectedSession } from './helpers/app.js';

async function expireCurrentRest(page) {
  await page.evaluate(() => {
    state.restTimerEndsAt = Date.now();
    workoutTimerController.reconcile();
  });
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'ready');
}

test('active workout starts with a mounted visible idle timer before any set', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await chooseSession(page, 'Push');
  await startSelectedSession(page);

  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'idle');
  await expect(page.locator('#timerDisplay')).toHaveText('02:30');
  await expect(page.locator('#timerNext')).toHaveText('Timer ready. Complete a set to start rest.');
  await expect(page.locator('#timerAdjust')).toBeEnabled();
  await expect(page.locator('#timerSkip')).toBeDisabled();

  const layout = await page.locator('#timerCard').evaluate(element => {
    const card = element.getBoundingClientRect();
    const adjust = document.getElementById('timerAdjust').getBoundingClientRect();
    const adjustStyle = getComputedStyle(document.getElementById('timerAdjust'));
    return {
      cardBottom: card.bottom,
      cardLeft: card.left,
      cardRight: card.right,
      adjustHeight: adjust.height,
      adjustBorder: adjustStyle.borderTopWidth,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      viewportHeight: innerHeight,
      viewportWidth: innerWidth
    };
  });
  expect(layout.horizontalOverflow).toBe(false);
  expect(layout.cardLeft).toBeGreaterThanOrEqual(0);
  expect(layout.cardRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.cardBottom).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.adjustHeight).toBeGreaterThanOrEqual(44);
  expect(layout.adjustBorder).not.toBe('0px');
});

test('each completed set starts a visible rest immediately, including after expiration', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'running');
  expect((await jorgeState(page)).restTimerEndsAt).toBeGreaterThan(Date.now());

  await expireCurrentRest(page);
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Rest complete. Ready for your next set.');
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();

  await page.getByRole('button', { name: 'Complete Set 2 of 3' }).click();
  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'running');
  await expect(page.locator('#timerDisplay')).toHaveText(/02:(29|30)/);
  expect((await jorgeState(page)).restTimerEndsAt).toBeGreaterThan(Date.now());
});

test('completion feedback transitions to idle without hiding the timer', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expireCurrentRest(page);

  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerCard')).toHaveClass(/timer-feedback-ready/);
  await page.waitForTimeout(3200);
  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'idle');
  await expect(page.locator('#timerCard')).not.toHaveClass(/timer-feedback-ready/);
  await expect(page.locator('#timerNext')).toHaveText('Ready for your next set.');
});

test('Skip returns to visible idle and the next completed set starts normally', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await page.locator('#timerSkip').click();

  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'idle');
  await expect(page.locator('#timerNext')).toHaveText('Rest skipped. Timer ready for the next set.');
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();

  await page.getByRole('button', { name: 'Complete Set 2 of 3' }).click();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'running');
  await expect(page.locator('#timerCard')).toBeVisible();
  expect((await jorgeState(page)).restTimerEndsAt).toBeGreaterThan(Date.now());
});

test('Adjust presets work while idle and while counting', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  await page.locator('#timerAdjust').click();
  await expect(page.locator('#timerPresets')).toBeVisible();
  await page.locator('[data-timer-preset="30"]').click();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'idle');
  await expect(page.locator('#timerDisplay')).toHaveText('00:30');
  await expect(page.locator('#timerNext')).toHaveText('Next rest set to 00:30.');
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();

  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  const shortDeadline = (await jorgeState(page)).restTimerEndsAt;
  expect(shortDeadline).toBeLessThanOrEqual(Date.now() + 31_000);
  await page.locator('#timerAdjust').click();
  await expect(page.locator('#timerPresets')).toBeVisible();
  await page.locator('[data-timer-preset="120"]').click();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'running');
  await expect(page.locator('#timerDisplay')).toHaveText(/01:(59|60)/);
  expect((await jorgeState(page)).restTimerEndsAt).toBeGreaterThan(Date.now() + 118_000);
});

test('persisted running rest resumes after reload', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.evaluate(() => {
    state.restTimerEndsAt = Date.now() + 90_000;
    saveState();
  });
  const deadline = (await jorgeState(page)).restTimerEndsAt;
  await page.reload();
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();

  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'running');
  await expect(page.locator('#timerDisplay')).toHaveText(/01:(2[7-9]|30)/);
  expect((await jorgeState(page)).restTimerEndsAt).toBe(deadline);
});

test('background visibility resolves an expired deadline once and keeps timer available', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.evaluate(() => {
    state.restTimerEndsAt = Date.now() - 1000;
    saveState();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });

  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'ready');
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Rest complete. Ready for your next set.');
  const completionKey = await page.evaluate(() => workoutTimerController.getStatus().lastAnnouncedCompletionKey);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(await page.evaluate(() => workoutTimerController.getStatus().lastAnnouncedCompletionKey)).toBe(completionKey);
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();
});

test('idle timer UI adds no schema persistence and no workout keeps timer unavailable', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  const before = await readStoredJson(page, STORAGE_KEYS.jorge);
  await page.locator('#timerAdjust').click();
  await page.locator('[data-timer-preset="60"]').click();
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);

  expect(after).toEqual(before);
  expect(after.version).toBe(5);
  expect(after.restTimerEndsAt).toBeNull();

  await page.evaluate(() => workoutSessionController.discard());
  await expect(page.locator('#activePanel')).toBeHidden();
  await expect(page.locator('#timerCard')).toBeHidden();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'unavailable');

  await page.evaluate(() => workoutSessionController.start('Push', { loadRoutine: false, scroll: false }));
  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'idle');
  await expect(page.locator('#timerDisplay')).toHaveText('02:30');
});
