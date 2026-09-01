import { expect, test } from '@playwright/test';
import {
  activeWorkout,
  blankState,
  completedWorkout,
  installLocalStorageFixture,
  readStoredJson,
  STORAGE_KEYS
} from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';

async function installMutationTrace(page, { rejectCloud = false } = {}) {
  await page.evaluate(({ storageKey, shouldRejectCloud }) => {
    window.__setMutationTrace = [];
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === storageKey) {
        const snapshot = JSON.parse(value);
        const exercise = snapshot.activeWorkout?.exercises?.[0] || null;
        window.__setMutationTrace.push({
          kind: 'local',
          deadline: snapshot.restTimerEndsAt,
          warmup: exercise?.sets?.[0] || null,
          working: exercise?.sets?.[1] || null
        });
      }
      return originalSetItem.call(this, key, value);
    };
    const cloud = window.BigGainsCloudSync;
    window.BigGainsCloudSync = Object.freeze({
      ...cloud,
      captureLocalSnapshot(profileId) {
        window.__setMutationTrace.push({ kind: 'cloud', profileId });
        return shouldRejectCloud
          ? Promise.reject(new Error('characterized cloud capture rejection'))
          : Promise.resolve({ ok: true });
      }
    });
    if (shouldRejectCloud) {
      window.addEventListener('unhandledrejection', event => {
        if (event.reason?.message === 'characterized cloud capture rejection') event.preventDefault();
      });
    }
  }, { storageKey: STORAGE_KEYS.jorge, shouldRejectCloud: rejectCloud });
}

async function mutationTrace(page) {
  await expect.poll(() => page.evaluate(() => window.__setMutationTrace.some(entry => entry.kind === 'cloud'))).toBe(true);
  return page.evaluate(() => window.__setMutationTrace);
}

async function switchProfile(page, profileId) {
  await Promise.all([
    page.waitForNavigation(),
    page.evaluate(({ storageKey, nextProfile }) => {
      localStorage.setItem(storageKey, nextProfile);
      location.reload();
    }, { storageKey: STORAGE_KEYS.activeProfile, nextProfile: profileId })
  ]);
  await expect(page.locator('#profileSelect')).toHaveValue(profileId);
}

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
});

test('WorkoutSessionController owns session mutation while app and workout controls retain thin adapters', async ({ page, request }) => {
  const ownership = await page.evaluate(() => ({
    factoryFrozen: Object.isFrozen(BigGainsWorkoutSessionController),
    instanceFrozen: Object.isFrozen(workoutSessionController),
    moveShim: workoutControls.moveExercise === BigGainsWorkoutSessionController.moveExercise,
    toggleShim: workoutControls.toggleExercise === BigGainsWorkoutSessionController.toggleExercise,
    advanceShim: workoutControls.advanceAfterCompletion === BigGainsWorkoutSessionController.advanceAfterCompletion,
    bodyweightZero: BigGainsWorkoutSessionController.isCompletableSet(
      { equipment: 'Bodyweight' }, { weight: 0, reps: 8 }
    ),
    weightedZero: BigGainsWorkoutSessionController.isCompletableSet(
      { equipment: 'Machine' }, { weight: 0, reps: 8 }
    )
  }));
  expect(ownership).toEqual({
    factoryFrozen: true,
    instanceFrozen: true,
    moveShim: true,
    toggleShim: true,
    advanceShim: true,
    bodyweightZero: true,
    weightedZero: false
  });

  const appSource = await (await request.get('/app.js')).text();
  const controllerSource = await (await request.get('/workout-session-controller.js')).text();
  expect(appSource).toContain('workoutSessionController.updateSet(');
  expect(appSource).toContain('workoutSessionController.toggleSetCompleted(');
  expect(appSource).not.toContain('active.exercises[exerciseIndex].sets');
  expect(appSource).not.toContain('exercise.sets.push({id:uid()');
  expect(controllerSource).not.toMatch(/\b(?:document|localStorage|sessionStorage|Supabase)\b/);
});

test('set inputs preserve numeric and blank normalization for working and warm-up sets', async ({ page }) => {
  const workingWeight = page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]');
  const workingReps = page.locator('input[data-field="reps"][data-ei="0"][data-si="1"]');
  const warmupWeight = page.locator('input[data-field="weight"][data-ei="0"][data-si="0"]');
  const warmupReps = page.locator('input[data-field="reps"][data-ei="0"][data-si="0"]');

  await workingWeight.fill('127.5');
  await workingReps.fill('');
  await warmupWeight.fill('52.5');
  await warmupReps.fill('12');

  const stored = await jorgeState(page);
  expect(stored.activeWorkout.exercises[0].sets[0]).toMatchObject({
    weight: 52.5, reps: 12, warmup: true, completed: false
  });
  expect(stored.activeWorkout.exercises[0].sets[1]).toMatchObject({
    weight: 127.5, reps: '', warmup: false, completed: false
  });
  expect(stored.restTimerEndsAt).toBeNull();
});

test('working-set completion persists, starts one rest, and uncompletion or re-editing does not restart it', async ({ page }) => {
  await installMutationTrace(page);
  const complete = page.getByRole('button', { name: 'Complete Set 1 of 3' });
  await complete.click();
  const firstDeadline = (await jorgeState(page)).restTimerEndsAt;
  expect(firstDeadline).toBeGreaterThan(Date.now());

  await page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]').fill('115');
  await page.getByRole('button', { name: 'Mark set incomplete' }).click();

  const stored = await jorgeState(page);
  expect(stored.activeWorkout.exercises[0].sets[1]).toMatchObject({ weight: 115, reps: 8, completed: false });
  expect(stored.restTimerEndsAt).toBe(firstDeadline);
  const trace = await mutationTrace(page);
  const distinctRunningDeadlines = new Set(trace
    .filter(entry => entry.kind === 'local' && Number(entry.deadline) > 0)
    .map(entry => entry.deadline));
  expect(distinctRunningDeadlines).toEqual(new Set([firstDeadline]));
});

test('warm-up completion uses the same qualifying completion path and starts rest once', async ({ page }) => {
  await installMutationTrace(page);
  await page.getByRole('button', { name: 'Complete Warm-up' }).click();

  const stored = await jorgeState(page);
  expect(stored.activeWorkout.exercises[0].sets[0]).toMatchObject({
    weight: 45, reps: 10, warmup: true, completed: true
  });
  expect(stored.restTimerEndsAt).toBeGreaterThan(Date.now());
  const trace = await mutationTrace(page);
  const distinctRunningDeadlines = new Set(trace
    .filter(entry => entry.kind === 'local' && Number(entry.deadline) > 0)
    .map(entry => entry.deadline));
  expect(distinctRunningDeadlines.size).toBe(1);
});

test('ordinary edits persist locally before rejected cloud capture and never start rest', async ({ page }) => {
  await installMutationTrace(page, { rejectCloud: true });
  await page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]').fill('135');

  const trace = await mutationTrace(page);
  expect(trace[0]).toMatchObject({ kind: 'local', deadline: null, working: { weight: 135, completed: false } });
  expect(trace.findIndex(entry => entry.kind === 'local')).toBeLessThan(trace.findIndex(entry => entry.kind === 'cloud'));
  expect((await jorgeState(page)).activeWorkout.exercises[0].sets[1].weight).toBe(135);
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();
});

test('set completion saves locally before rejected cloud capture and remains completed with one timer deadline', async ({ page }) => {
  await installMutationTrace(page, { rejectCloud: true });
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();

  const trace = await mutationTrace(page);
  const firstCloud = trace.findIndex(entry => entry.kind === 'cloud');
  expect(trace.slice(0, firstCloud).filter(entry => entry.kind === 'local')).toHaveLength(2);
  expect(trace[0]).toMatchObject({ kind: 'local', deadline: null, working: { completed: true } });
  expect(trace[1].kind).toBe('local');
  expect(trace[1].deadline).toBeGreaterThan(Date.now());
  const stored = await jorgeState(page);
  expect(stored.activeWorkout.exercises[0].sets[1].completed).toBe(true);
  expect(stored.restTimerEndsAt).toBe(trace[1].deadline);
});

test('notes and rest preference keep their existing mutation path without starting the timer', async ({ page }) => {
  const notes = page.locator('[data-note-block="0"]');
  await notes.locator('summary').click();
  await notes.locator('[data-saved-cue="0"]').fill('Pin shoulder blades');
  await notes.locator('[data-session-note="0"]').fill('Smooth today');
  await notes.locator('[data-rest-seconds="0"]').selectOption('90');

  const stored = await jorgeState(page);
  expect(stored.exercisePreferences['seated-machine-chest-press']).toEqual({
    cue: 'Pin shoulder blades', restSeconds: 90
  });
  expect(stored.activeWorkout.exercises[0]).toMatchObject({ note: 'Smooth today', restSeconds: 90 });
  expect(stored.restTimerEndsAt).toBeNull();
});

test('editing an active set leaves previous-performance history and display untouched', async ({ page }) => {
  const history = completedWorkout();
  await page.evaluate(workout => {
    state.workouts = [workout];
    saveState();
    renderActive();
  }, history);
  await expect(page.locator('[data-previous-performance="seated-machine-chest-press"]')).toHaveText('100 lb × 10');
  const before = (await jorgeState(page)).workouts;

  await page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]').fill('145');

  const stored = await jorgeState(page);
  expect(stored.workouts).toEqual(before);
  expect(stored.activeWorkout.exercises[0].sets[1].weight).toBe(145);
  await expect(page.locator('[data-previous-performance="seated-machine-chest-press"]')).toHaveText('100 lb × 10');
});

test('set mutation follows a replaced live state and never mutates the previous active object', async ({ page }) => {
  await page.evaluate(() => {
    window.__replacedActive = active;
    const replacement = JSON.parse(JSON.stringify(active));
    replacement.id = 'replacement-active';
    replacement.exercises[0].sets[1].weight = 155;
    state = { ...state, activeWorkout: replacement };
    active = replacement;
    renderAll();
  });
  await page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]').fill('165');

  const result = await page.evaluate(() => ({
    oldWeight: window.__replacedActive.exercises[0].sets[1].weight,
    liveWeight: active.exercises[0].sets[1].weight,
    stateSharesActive: state.activeWorkout === active
  }));
  expect(result).toEqual({ oldWeight: 100, liveWeight: 165, stateSharesActive: true });
  expect((await jorgeState(page)).activeWorkout.id).toBe('replacement-active');
});

test('set edits remain isolated across Jorge and Alexa profile reloads', async ({ page }) => {
  const alexa = {
    ...blankState('alexa'),
    activeWorkout: activeWorkout({ id: 'alexa-active', type: 'FullBody' })
  };
  await page.evaluate(({ storageKey, value }) => {
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, { storageKey: STORAGE_KEYS.alexa, value: alexa });

  await page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]').fill('111');
  await switchProfile(page, 'alexa');
  await page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]').fill('77');
  await switchProfile(page, 'jorge');

  const jorge = await jorgeState(page);
  const storedAlexa = await readStoredJson(page, STORAGE_KEYS.alexa);
  expect(jorge.activeWorkout.exercises[0].sets[1].weight).toBe(111);
  expect(storedAlexa.activeWorkout.exercises[0].sets[1].weight).toBe(77);
});
