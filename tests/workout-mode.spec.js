import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
import { chooseSession, jorgeState, openApp, startSelectedSession } from './helpers/app.js';

async function installVibrationMock(page, supported = true) {
  await page.addInitScript(value => {
    window.__vibrationCalls = [];
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: value ? pattern => { window.__vibrationCalls.push(pattern); return true; } : undefined
    });
  }, supported);
}

async function installAudioMock(page, { outcome = 'success' } = {}) {
  await page.addInitScript(options => {
    window.__feedbackAudio = { activeListeners: 0, activations: [], maxListeners: 0, outcome: options.outcome, pauses: 0, playCalls: 0 };
    const trackedListeners = new Set();
    const addEventListener = HTMLMediaElement.prototype.addEventListener;
    const removeEventListener = HTMLMediaElement.prototype.removeEventListener;
    HTMLMediaElement.prototype.addEventListener = function(type, listener, settings) {
      if (this.id === 'timerCompletionAudio' && type === 'playing' && !trackedListeners.has(listener)) {
        trackedListeners.add(listener);
        window.__feedbackAudio.activeListeners += 1;
        window.__feedbackAudio.maxListeners = Math.max(window.__feedbackAudio.maxListeners, window.__feedbackAudio.activeListeners);
      }
      return addEventListener.call(this, type, listener, settings);
    };
    HTMLMediaElement.prototype.removeEventListener = function(type, listener, settings) {
      if (this.id === 'timerCompletionAudio' && type === 'playing' && trackedListeners.delete(listener)) {
        window.__feedbackAudio.activeListeners -= 1;
      }
      return removeEventListener.call(this, type, listener, settings);
    };
    HTMLMediaElement.prototype.pause = function() {
      if (this.id === 'timerCompletionAudio') window.__feedbackAudio.pauses += 1;
    };
    HTMLMediaElement.prototype.play = function() {
      if (this.id !== 'timerCompletionAudio') return Promise.resolve();
      window.__feedbackAudio.playCalls += 1;
      window.__feedbackAudio.activations.push(navigator.userActivation?.isActive ?? null);
      if (window.__feedbackAudio.outcome === 'rejected') return Promise.reject(new DOMException('Playback blocked', 'NotAllowedError'));
      if (window.__feedbackAudio.outcome === 'timeout') return Promise.resolve();
      queueMicrotask(() => this.dispatchEvent(new Event('playing')));
      return Promise.resolve();
    };
  }, { outcome });
}

async function showRestTimer(page) {
  await page.evaluate(() => {
    state.restTimerEndsAt = Date.now() + 60_000;
    workoutTimerController.reconcile();
  });
  await expect(page.locator('#timerCard')).toBeVisible();
}

test('starting and resuming a workout enters the focused, accessible Workout Mode', async ({ page }) => {
  await installVibrationMock(page);
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await chooseSession(page, 'Pull');
  await startSelectedSession(page);

  await expect(page.locator('body')).toHaveClass(/workout-mode/);
  await expect(page.locator('.bottom-nav')).toBeHidden();
  await expect(page.locator('#activePanel')).toBeVisible();
  await expect(page.locator('#exitWorkoutMode')).toBeVisible();
  await expect(page.locator('#browseWorkoutLibrary')).toBeVisible();
  await expect(page.locator('#timerSoundToggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#timerVibrationToggle')).toHaveAttribute('aria-pressed', 'true');

  const startedAt = (await jorgeState(page)).activeWorkout.startedAt;
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/workout-mode/);
  expect((await jorgeState(page)).activeWorkout.startedAt).toBe(startedAt);
});

test('Exit Workout Mode preserves the session and timer, survives reload, and exposes a return bar', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  const before = await jorgeState(page);

  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  const restTimerEndsAt = (await jorgeState(page)).restTimerEndsAt;
  await page.locator('#exitWorkoutMode').click();

  await expect(page.locator('body')).not.toHaveClass(/workout-mode/);
  await expect(page.locator('#workoutReturnBar')).toBeVisible();
  await expect(page.locator('#workoutReturnType')).toHaveText('Jorge Push');
  await expect(page.locator('#workoutReturnElapsed')).toHaveText(/\d{2}:\d{2}(?::\d{2})?/);
  const exited = await jorgeState(page);
  expect(exited.activeWorkout.id).toBe(before.activeWorkout.id);
  expect(exited.activeWorkout.startedAt).toBe(before.activeWorkout.startedAt);
  expect(exited.restTimerEndsAt).toBe(restTimerEndsAt);

  await page.reload();
  await expect(page.locator('body')).not.toHaveClass(/workout-mode/);
  await expect(page.locator('#workoutReturnBar')).toBeVisible();
  await page.locator('#returnToWorkout').click();
  await expect(page.locator('body')).toHaveClass(/workout-mode/);
  await expect(page.locator('#workoutReturnBar')).toBeHidden();
});

test('Library access adds through the session controller and returns without resetting session timing', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  const before = await jorgeState(page);

  await page.locator('#browseWorkoutLibrary').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'library');
  await expect(page.locator('#workoutReturnBar')).toBeVisible();
  await page.locator('#viewLibrary details').evaluate(details => { details.open = true; });
  await page.locator('#exerciseSearch').fill('Incline Iso Machine Press');
  await page.locator('[data-add="incline-iso-machine-press"]').click();
  await expect(page.locator('[data-add="incline-iso-machine-press"]')).toHaveText('Added');

  const afterAdd = await jorgeState(page);
  expect(afterAdd.activeWorkout.id).toBe(before.activeWorkout.id);
  expect(afterAdd.activeWorkout.startedAt).toBe(before.activeWorkout.startedAt);
  expect(afterAdd.restTimerEndsAt).toBe(before.restTimerEndsAt);
  expect(afterAdd.activeWorkout.exercises.map(exercise => exercise.id)).toContain('incline-iso-machine-press');

  await page.locator('#returnToWorkout').click();
  await expect(page.locator('body')).toHaveClass(/workout-mode/);
  await expect(page.locator('#activeExercises')).toContainText('Incline Iso Machine Press');
});

test('bottom Add Exercise action stays separate from the timer and meets the mobile touch target', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  const action = page.getByRole('button', { name: 'Add Exercise', exact: true });
  await expect(page.locator('#timerCard')).toBeHidden();
  await expect(action).toBeVisible();
  expect(await action.evaluate(button => button.closest('#timerCard') === null)).toBe(true);
  const layout = await action.evaluate(button => {
    const rect = button.getBoundingClientRect();
    const exercises = document.getElementById('activeExercises').getBoundingClientRect();
    return {
      height: rect.height,
      left: rect.left,
      right: rect.right,
      followsExercises: rect.top >= exercises.bottom,
      viewportWidth: innerWidth
    };
  });
  expect(layout.height).toBeGreaterThanOrEqual(44);
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.followsExercises).toBe(true);

  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expect(page.locator('#timerCard')).toBeVisible();
  await action.scrollIntoViewIfNeeded();
  const runningLayout = await page.evaluate(() => {
    const timer = document.getElementById('timerCard').getBoundingClientRect();
    const action = document.getElementById('browseWorkoutLibrary').getBoundingClientRect();
    return { actionTop: action.top, timerBottom: timer.bottom };
  });
  expect(runningLayout.timerBottom).toBeLessThanOrEqual(runningLayout.actionTop);

  const workoutId = (await jorgeState(page)).activeWorkout.id;
  await action.click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'library');
  expect((await jorgeState(page)).activeWorkout.id).toBe(workoutId);
});

test('the integrated pet stays restrained through calm, rest, rest-complete, and ineligible-machine completion states', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await expect(page.locator('#workoutPetSlot #trainingPet')).toHaveAttribute('data-state', 'calm');
  await expect(page.locator('#trainingPetMessage')).toHaveText('Lock in.');

  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'attentive');
  await expect(page.locator('#trainingPetMessage')).toHaveText('Breathe.');

  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); workoutTimerController.reconcile(); });
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#trainingPetMessage')).toHaveText("You're up.");

  await page.locator('#finishWorkout').click();
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'complete');
  await expect(page.locator('#trainingPetCard')).toBeVisible();
});

test('sound and vibration settings persist independently per profile', async ({ page }) => {
  await installVibrationMock(page);
  await installLocalStorageFixture(page, ['activeWorkoutWithExercises', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);
  await page.locator('#timerSoundToggle').evaluate(button => button.click());
  await expect(page.locator('#timerSoundToggle')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#exitWorkoutMode').click();
  await page.locator('#profileSelect').selectOption('alexa');
  await expect(page.locator('#greeting')).toContainText('Alexa');

  await expect(page.locator('#timerSoundToggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#timerVibrationToggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#timerVibrationToggle').evaluate(button => button.click());
  const alexa = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEYS.alexa);
  expect(alexa.timerPreferences).toEqual({ sound: true, vibration: false });

  await page.locator('#profileSelect').selectOption('jorge');
  await expect(page.locator('#greeting')).toContainText('Jorge');
  await expect(page.locator('#timerSoundToggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#timerVibrationToggle')).toHaveAttribute('aria-pressed', 'true');
});

test('unsupported vibration is hidden without changing the saved preference', async ({ page }) => {
  await installVibrationMock(page, false);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);

  await expect(page.locator('#timerVibrationToggle')).toBeHidden();
  await expect(page.locator('#timerVibrationToggle')).toHaveAttribute('aria-disabled', 'true');
  expect((await jorgeState(page)).timerPreferences.vibration).toBe(true);
});

test('supported vibration follows its independent per-profile preference', async ({ page }) => {
  await installVibrationMock(page);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);

  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); workoutTimerController.reconcile(); });
  expect(await page.evaluate(() => window.__vibrationCalls)).toEqual([[150, 80, 150]]);

  await page.locator('#timerVibrationToggle').click();
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); workoutTimerController.reconcile(); });
  expect(await page.evaluate(() => window.__vibrationCalls)).toEqual([[150, 80, 150]]);
  expect((await jorgeState(page)).timerPreferences.vibration).toBe(false);
});

test('turning Sound on directly tests the persistent HTMLAudio element', async ({ page }) => {
  await installAudioMock(page);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);
  await page.locator('#timerSoundToggle').evaluate(button => button.click());

  await page.locator('#timerSoundToggle').click();
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Sound on. Chime confirmed.');
  expect(await page.evaluate(() => ({
    audioElements: document.querySelectorAll('#timerCompletionAudio').length,
    activations: window.__feedbackAudio.activations,
    playCalls: window.__feedbackAudio.playCalls
  }))).toEqual({ audioElements: 1, activations: [true], playCalls: 1 });
});

test('Sound toggle feedback remains accessible without adding a visible timer row', async ({ page }) => {
  await installAudioMock(page);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);

  const card = page.locator('#timerCard');
  const status = page.locator('#timerFeedbackStatus');
  const beforeHeight = await card.evaluate(element => element.getBoundingClientRect().height);
  await page.locator('#timerSoundToggle').click();
  await expect(page.locator('#timerSoundToggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(status).toHaveText('Sound off. Visual feedback stays on.');
  await expect(status).toHaveAttribute('role', 'status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  const hiddenLayout = await status.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return { height: rect.height, overflow: style.overflow, position: style.position, width: rect.width };
  });
  expect(hiddenLayout).toEqual({ height: 1, overflow: 'hidden', position: 'absolute', width: 1 });
  expect(await card.evaluate(element => element.getBoundingClientRect().height)).toBe(beforeHeight);
});

test('a rejected Sound-toggle verification marks sound unavailable only for the current session', async ({ page }) => {
  await installAudioMock(page, { outcome: 'rejected' });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);

  await page.locator('#timerSoundToggle').evaluate(button => button.click());
  await page.locator('#timerSoundToggle').click();
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Sound unavailable this session: playback was rejected.');
  await expect(page.locator('#timerSoundToggle')).toBeDisabled();
  expect((await jorgeState(page)).timerPreferences.sound).toBe(true);
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); workoutTimerController.reconcile(); });
  expect(await page.evaluate(() => window.__feedbackAudio.playCalls)).toBe(1);
});

test('a Sound-toggle playback timeout leaves the saved preference intact', async ({ page }) => {
  await installAudioMock(page, { outcome: 'timeout' });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);

  await page.locator('#timerSoundToggle').evaluate(button => button.click());
  await page.locator('#timerSoundToggle').click();
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Sound unavailable this session: playback did not start.');
  await expect(page.locator('#timerSoundToggle')).toBeDisabled();
  expect((await jorgeState(page)).timerPreferences.sound).toBe(true);
  expect(await page.evaluate(() => window.__feedbackAudio.activeListeners)).toBe(0);
});

test('rest completion requests exactly one verified audio playback and shows the accessible ready fallback', async ({ page }) => {
  await installAudioMock(page);
  await installVibrationMock(page);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expect.poll(() => page.evaluate(() => workoutTimerFeedback.getSoundSessionState())).toBe('verified');
  await page.evaluate(() => { window.__feedbackAudio.playCalls = 0; window.__feedbackAudio.activations = []; window.__vibrationCalls = []; });

  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); workoutTimerController.reconcile(); });
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Rest complete. Ready for your next set.');
  await expect(page.locator('#timerCard')).toHaveClass(/timer-feedback-ready/);
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'ready');
  expect(await page.evaluate(() => window.__feedbackAudio.playCalls)).toBe(1);
  expect(await page.evaluate(() => window.__vibrationCalls)).toEqual([[150, 80, 150]]);
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();
});

test('failed automatic HTMLAudio arming never prevents safe visual timer completion', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await installAudioMock(page, { outcome: 'rejected' });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expect(page.locator('#timerSoundToggle')).toBeEnabled();
  expect((await jorgeState(page)).timerPreferences.sound).toBe(true);
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); workoutTimerController.reconcile(); });

  await expect(page.locator('#timerNext')).toHaveText("Rest complete. You're up.");
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Rest complete. Ready for your next set.');
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'ready');
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();
  expect(pageErrors).toEqual([]);
});

test('duplicate completion requests produce only one sound and one vibration', async ({ page }) => {
  await installAudioMock(page);
  await installVibrationMock(page);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expect.poll(() => page.evaluate(() => workoutTimerFeedback.getSoundSessionState())).toBe('verified');
  await page.evaluate(() => { window.__feedbackAudio.playCalls = 0; window.__vibrationCalls = []; });
  expect(await page.evaluate(() => ({ shell: BigGainsShell.initialize(), mode: bigGainsWorkoutMode.initialize() }))).toEqual({ shell: false, mode: false });
  expect(await page.locator('#workoutReturnBar').count()).toBe(1);
  expect(await page.locator('#workoutPetSlot').count()).toBe(1);

  const results = await page.evaluate(() => [workoutTimerFeedback.complete('same-rest'), workoutTimerFeedback.complete('same-rest')]);
  expect(results[1].duplicate).toBe(true);
  expect(await page.evaluate(() => window.__feedbackAudio.playCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => ({
    activeListeners: window.__feedbackAudio.activeListeners,
    audioElements: document.querySelectorAll('#timerCompletionAudio').length,
    maxListeners: window.__feedbackAudio.maxListeners
  }))).toEqual({ activeListeners: 0, audioElements: 1, maxListeners: 1 });
  expect(await page.evaluate(() => window.__vibrationCalls)).toEqual([[150, 80, 150]]);
});
