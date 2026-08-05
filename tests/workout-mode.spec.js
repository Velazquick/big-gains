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

async function installAudioMock(page, { initialState = 'running', blocked = false, resumeBlocked = false } = {}) {
  await page.addInitScript(options => {
    window.__feedbackAudio = { contexts: 0, resumes: 0, primes: 0, tones: [] };
    window.AudioContext = class {
      constructor() {
        if (options.blocked) throw new Error('blocked');
        window.__feedbackAudio.contexts += 1;
        this.currentTime = 0;
        this.destination = {};
        this.state = options.initialState;
      }
      createBuffer() { return {}; }
      createBufferSource() {
        return { buffer: null, connect() {}, start() { window.__feedbackAudio.primes += 1; } };
      }
      createOscillator() {
        let frequency = 0;
        return {
          type: '',
          frequency: { setValueAtTime(value) { frequency = value; } },
          connect() {},
          start() { window.__feedbackAudio.tones.push(frequency); },
          stop() {}
        };
      }
      createGain() {
        return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
      }
      async resume() {
        window.__feedbackAudio.resumes += 1;
        if (options.resumeBlocked) throw new Error('resume blocked');
        this.state = 'running';
      }
    };
  }, { initialState, blocked, resumeBlocked });
}

async function showRestTimer(page) {
  await page.evaluate(() => {
    state.restTimerEndsAt = Date.now() + 60_000;
    runRestTimer();
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

  await page.getByRole('button', { name: 'Expand Seated Machine Chest Press' }).click();
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
  await page.getByRole('button', { name: 'Expand Seated Machine Chest Press' }).click();
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

test('the integrated pet stays restrained through calm, rest, rest-complete, and PR states', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await expect(page.locator('#workoutPetSlot #trainingPet')).toHaveAttribute('data-state', 'calm');
  await expect(page.locator('#trainingPetMessage')).toHaveText('Lock in.');

  await page.getByRole('button', { name: 'Expand Seated Machine Chest Press' }).click();
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'attentive');
  await expect(page.locator('#trainingPetMessage')).toHaveText('Breathe.');

  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#trainingPetMessage')).toHaveText("You're up.");

  await page.locator('#finishWorkout').click();
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'pr');
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

test('unsupported vibration is clearly unavailable without changing the saved preference', async ({ page }) => {
  await installVibrationMock(page, false);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);

  await expect(page.locator('#timerVibrationToggle')).toBeDisabled();
  await expect(page.locator('#timerVibrationToggle')).toHaveText('Vibration unavailable');
  await expect(page.locator('#timerVibrationToggle')).toHaveAttribute('aria-disabled', 'true');
  expect((await jorgeState(page)).timerPreferences.vibration).toBe(true);
});

test('supported vibration follows its independent per-profile preference', async ({ page }) => {
  await installVibrationMock(page);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);

  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  expect(await page.evaluate(() => window.__vibrationCalls)).toEqual([[150, 80, 150]]);

  await page.locator('#timerVibrationToggle').click();
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  expect(await page.evaluate(() => window.__vibrationCalls)).toEqual([[150, 80, 150]]);
  expect((await jorgeState(page)).timerPreferences.vibration).toBe(false);
});

test('turning Sound on directly unlocks audio and plays one brief confirmation', async ({ page }) => {
  await installAudioMock(page);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);
  await page.locator('#timerSoundToggle').evaluate(button => button.click());

  await page.locator('#timerSoundToggle').click();
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Sound on. Confirmation played.');
  expect(await page.evaluate(() => window.__feedbackAudio)).toEqual({ contexts: 1, resumes: 0, primes: 1, tones: [783.99] });
});

test('Test Sound unlocks audio and plays the two-note chime immediately', async ({ page }) => {
  await installAudioMock(page);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);

  await page.locator('#timerTestSound').click();
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Test sound played.');
  expect(await page.evaluate(() => window.__feedbackAudio)).toEqual({ contexts: 1, resumes: 0, primes: 1, tones: [523.25, 659.25] });
});

test('a suspended mobile-style context is resumed and awaited from the Test Sound gesture', async ({ page }) => {
  await installAudioMock(page, { initialState: 'suspended' });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);

  await page.locator('#timerTestSound').click();
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Test sound played.');
  expect(await page.evaluate(() => window.__feedbackAudio)).toEqual({ contexts: 1, resumes: 1, primes: 1, tones: [523.25, 659.25] });
});

test('rest completion schedules exactly one prepared two-note chime and shows the accessible ready fallback', async ({ page }) => {
  await installAudioMock(page);
  await installVibrationMock(page);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);
  await page.locator('#timerTestSound').click();
  await page.evaluate(() => { window.__feedbackAudio.tones = []; window.__vibrationCalls = []; });

  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Rest complete. Ready for your next set.');
  await expect(page.locator('#timerCard')).toHaveClass(/timer-feedback-ready/);
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'ready');
  expect(await page.evaluate(() => window.__feedbackAudio.tones)).toEqual([523.25, 659.25]);
  expect(await page.evaluate(() => window.__vibrationCalls)).toEqual([[150, 80, 150]]);
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();
});

test('blocked Web Audio never prevents safe timer completion', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await installAudioMock(page, { blocked: true });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await showRestTimer(page);
  await page.locator('#timerTestSound').click();
  await expect(page.locator('#timerFeedbackStatus')).toContainText('could not play');
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });

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
  await showRestTimer(page);
  await page.locator('#timerTestSound').click();
  await page.evaluate(() => { window.__feedbackAudio.tones = []; window.__vibrationCalls = []; });
  expect(await page.evaluate(() => ({ shell: BigGainsShell.initialize(), mode: bigGainsWorkoutMode.initialize() }))).toEqual({ shell: false, mode: false });
  expect(await page.locator('#workoutReturnBar').count()).toBe(1);
  expect(await page.locator('#workoutPetSlot').count()).toBe(1);

  const results = await page.evaluate(() => [workoutTimerFeedback.complete('same-rest'), workoutTimerFeedback.complete('same-rest')]);
  expect(results[1].duplicate).toBe(true);
  expect(await page.evaluate(() => window.__feedbackAudio.tones)).toEqual([523.25, 659.25]);
  expect(await page.evaluate(() => window.__vibrationCalls)).toEqual([[150, 80, 150]]);
});
