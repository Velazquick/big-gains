import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { chooseSession, jorgeState, openApp, startSelectedSession } from './helpers/app.js';

async function installAudioMock(page, outcomes = ['success']) {
  await page.addInitScript(sequence => {
    window.__feedbackAudio = {
      activeListeners: 0,
      activations: [],
      maxListeners: 0,
      outcomes: [...sequence],
      pauses: 0,
      playCalls: 0,
      volumes: []
    };
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
      const outcome = window.__feedbackAudio.outcomes.shift() || 'success';
      window.__feedbackAudio.playCalls += 1;
      window.__feedbackAudio.activations.push(navigator.userActivation?.isActive ?? null);
      window.__feedbackAudio.volumes.push(this.volume);
      if (outcome === 'rejected') return Promise.reject(new DOMException('Playback blocked', 'NotAllowedError'));
      if (outcome === 'timeout') return Promise.resolve();
      queueMicrotask(() => this.dispatchEvent(new Event('playing')));
      return Promise.resolve();
    };
  }, outcomes);
}

async function prepareCompletedWork(page, { prs = true } = {}) {
  await page.evaluate(options => {
    active.startedAt = new Date(Date.now() - 125_000).toISOString();
    active.exercises.forEach(exercise => exercise.sets.forEach(set => { set.completed = false; }));
    const chest = active.exercises[0];
    chest.sets[0] = { ...chest.sets[0], weight: 50, reps: 10, warmup: true, completed: true };
    chest.sets[1] = { ...chest.sets[1], weight: 100, reps: 10, warmup: false, completed: true };
    const pull = active.exercises[1];
    pull.sets[1] = { ...pull.sets[1], weight: 90, reps: 10, warmup: false, completed: true };
    state.prs = options.prs ? {} : {
      [chest.id]: { exercise: chest.name, estimated1RM: 999, weight: 999, reps: 1, date: new Date(0).toISOString() },
      [pull.id]: { exercise: pull.name, estimated1RM: 999, weight: 999, reps: 1, date: new Date(0).toISOString() }
    };
    saveState();
    renderActive();
  }, { prs });
  await expect(page.locator('#finishWorkout')).toBeEnabled();
}

test('the saved-workout completion receipt is accurate, focused, reviewable, and exactly once', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await openApp(page);
  await prepareCompletedWork(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.__completionWrites = [];
    Storage.prototype.setItem = function(key, value) {
      if (key === 'big-gains-v2') {
        const persisted = JSON.parse(value);
        window.__completionWrites.push({
          activeWorkout: persisted.activeWorkout,
          completionHidden: document.getElementById('workoutCompletion').classList.contains('hidden'),
          restTimerEndsAt: persisted.restTimerEndsAt,
          workouts: persisted.workouts.length
        });
      }
      return original.call(this, key, value);
    };
  });

  await page.locator('#finishWorkout').click();
  await expect(page.locator('#workoutCompletion')).toBeVisible();
  const saved = (await jorgeState(page)).workouts[0];
  const expectedDuration = `${String(Math.floor(saved.durationSeconds / 60)).padStart(2, '0')}:${String(saved.durationSeconds % 60).padStart(2, '0')}`;

  await expect(page.locator('#workoutCompletionTitle')).toHaveText('Push complete');
  await expect(page.locator('#completionWorkoutType')).toHaveText('Push');
  await expect(page.locator('#completionDuration')).toHaveText(expectedDuration);
  await expect(page.locator('#completionExercises')).toHaveText('2');
  await expect(page.locator('#completionWorkingSets')).toHaveText('2');
  await expect(page.locator('#completionVolume')).toHaveText('1,900 lb');
  await expect(page.locator('#completionPrCount')).toHaveText('2');
  await expect(page.locator('#completionPrCopy')).toHaveText('2 new PRs.');
  await expect(page.locator('#completionPetSlot #trainingPetCard')).toBeVisible();
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'pr');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('workoutCompletionTitle');

  expect(saved.exercises.flatMap(exercise => exercise.sets)).toHaveLength(3);
  expect(saved.exercises.flatMap(exercise => exercise.sets).filter(set => !set.warmup)).toHaveLength(2);
  expect(saved.durationSeconds).toBeGreaterThanOrEqual(125);
  expect(await page.evaluate(() => window.__completionWrites.at(-1))).toEqual({
    activeWorkout: null,
    completionHidden: true,
    restTimerEndsAt: null,
    workouts: 1
  });
  expect(await page.evaluate(() => workoutSessionController.complete())).toBe(false);
  expect((await jorgeState(page)).workouts).toHaveLength(1);

  await page.locator('#completionReview').click();
  await expect(page.locator('#historyDialog')).toBeVisible();
  await expect(page.locator('#historyDialogTitle')).toHaveText('Push');
  await page.locator('#closeHistoryDialog').click();
  await page.locator('#completionDone').click();
  await expect(page.locator('#workoutCompletion')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'today');
  expect((await jorgeState(page)).workouts).toHaveLength(1);

  await page.reload();
  await expect(page.locator('#workoutCompletion')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'today');
  const reloaded = await jorgeState(page);
  expect(reloaded.version).toBe(5);
  expect(reloaded.activeWorkout).toBeNull();
  expect(reloaded.workouts).toHaveLength(1);
});

test('completion respects reduced motion and uses the non-PR pet completion state', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await openApp(page);
  await prepareCompletedWork(page, { prs: false });
  await page.locator('#finishWorkout').click();

  await expect(page.locator('#completionPrCopy')).toBeHidden();
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', 'complete');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('workoutCompletionTitle');
  expect(await page.locator('#workoutCompletion').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await expect(page.locator('#workoutCompletion')).not.toHaveAttribute('aria-modal', 'true');
});

test('completion preserves one sync catch-up while the receipt remains on screen', async ({ page }) => {
  const writes = [];
  await page.route('https://api.github.com/repos/Velazquick/firstcut-validator/contents/**', async route => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'Not Found' }) });
      return;
    }
    writes.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'snapshot-sha' } }) });
  });
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await openApp(page);
  await prepareCompletedWork(page);
  await page.evaluate(() => localStorage.setItem('big-gains-sync-gateway-v1', JSON.stringify({
    token: 'test-token',
    lastSyncedAt: new Date().toISOString(),
    lastWorkoutByProfile: {}
  })));

  await page.locator('#finishWorkout').click();
  await expect(page.locator('#workoutCompletion')).toBeVisible();
  await expect.poll(() => writes.length).toBe(1);
  await page.waitForTimeout(900);
  expect(writes).toHaveLength(1);
  const snapshot = JSON.parse(Buffer.from(writes[0].content, 'base64').toString('utf8'));
  expect(snapshot.latestWorkout.id).toBe((await jorgeState(page)).workouts[0].id);
  expect(snapshot.summary.completedWorkouts).toBe(1);
  await expect(page.locator('#workoutCompletion')).toBeVisible();
});

test('Test Sound is absent and a trusted workout start quietly arms one persistent audio element', async ({ page }) => {
  await installAudioMock(page);
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  await expect(page.locator('#timerTestSound')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /test sound/i })).toHaveCount(0);
  await chooseSession(page, 'Pull');
  await startSelectedSession(page);
  await expect.poll(() => page.evaluate(() => workoutTimerFeedback.getSoundSessionState())).toBe('verified');

  expect(await page.evaluate(() => ({
    activeListeners: window.__feedbackAudio.activeListeners,
    activations: window.__feedbackAudio.activations,
    audioElements: document.querySelectorAll('#timerCompletionAudio').length,
    maxListeners: window.__feedbackAudio.maxListeners,
    pauses: window.__feedbackAudio.pauses,
    playCalls: window.__feedbackAudio.playCalls,
    restoredVolume: document.getElementById('timerCompletionAudio').volume,
    volumes: window.__feedbackAudio.volumes
  }))).toEqual({
    activeListeners: 0,
    activations: [true],
    audioElements: 1,
    maxListeners: 1,
    pauses: 2,
    playCalls: 1,
    restoredVolume: 1,
    volumes: [0.01]
  });
});

test('failed automatic arming stays retryable and completion plays once after a later trusted arm', async ({ page }) => {
  await installAudioMock(page, ['rejected', 'success', 'success']);
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expect.poll(() => page.evaluate(() => workoutTimerFeedback.getSoundSessionState())).toBe('unverified');
  await expect(page.locator('#timerSoundToggle')).toBeEnabled();
  expect((await jorgeState(page)).timerPreferences.sound).toBe(true);

  await page.getByRole('button', { name: 'Complete Set 2 of 3' }).click();
  await expect.poll(() => page.evaluate(() => workoutTimerFeedback.getSoundSessionState())).toBe('verified');
  await page.evaluate(() => { window.__feedbackAudio.playCalls = 0; window.__feedbackAudio.activations = []; });
  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });

  expect(await page.evaluate(() => window.__feedbackAudio.playCalls)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.__feedbackAudio.activeListeners)).toBe(0);
  expect(await page.locator('#timerCompletionAudio').count()).toBe(1);
  await expect(page.locator('#timerFeedbackStatus')).toHaveText('Rest complete. Ready for your next set.');
});
