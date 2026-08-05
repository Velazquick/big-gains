import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
import { chooseSession, jorgeState, openApp, startSelectedSession } from './helpers/app.js';

test('starting and resuming a workout enters the focused, accessible Workout Mode', async ({ page }) => {
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

test('sound-off suppresses the chime and sound-on plays one two-note completion chime', async ({ page }) => {
  await page.addInitScript(() => {
    window.__audioStarts = 0;
    window.AudioContext = class {
      constructor() { this.currentTime = 0; this.destination = {}; this.state = 'running'; }
      createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() { window.__audioStarts += 1; }, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      resume() { return Promise.resolve(); }
    };
  });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Expand Seated Machine Chest Press' }).click();
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await page.locator('#timerSoundToggle').click();
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  expect(await page.evaluate(() => window.__audioStarts)).toBe(0);

  await page.locator('#timerSoundToggle').click();
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  expect(await page.evaluate(() => window.__audioStarts)).toBe(2);
});

test('blocked Web Audio never prevents safe timer completion', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => { window.AudioContext = class { constructor() { throw new Error('blocked'); } }; });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Expand Seated Machine Chest Press' }).click();
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await page.locator('#timerSoundToggle').click();
  await page.locator('#timerSoundToggle').click();
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });

  await expect(page.locator('#timerNext')).toHaveText("Rest complete. You're up.");
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();
  expect(pageErrors).toEqual([]);
});

test('reinitialization does not duplicate Workout Mode UI, listeners, or completion feedback', async ({ page }) => {
  await page.addInitScript(() => {
    window.__audioStarts = 0;
    window.AudioContext = class {
      constructor() { this.currentTime = 0; this.destination = {}; this.state = 'running'; }
      createOscillator() { return { frequency: { setValueAtTime() {} }, connect() {}, start() { window.__audioStarts += 1; }, stop() {} }; }
      createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      resume() { return Promise.resolve(); }
    };
  });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Expand Seated Machine Chest Press' }).click();
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await page.locator('#timerSoundToggle').click();
  await page.locator('#timerSoundToggle').click();
  expect(await page.evaluate(() => ({ shell: BigGainsShell.initialize(), mode: bigGainsWorkoutMode.initialize() }))).toEqual({ shell: false, mode: false });
  expect(await page.locator('#workoutReturnBar').count()).toBe(1);
  expect(await page.locator('#workoutPetSlot').count()).toBe(1);

  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  expect(await page.evaluate(() => window.__audioStarts)).toBe(2);
});
