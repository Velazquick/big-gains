import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';

async function switchProfile(page, profileId) {
  await Promise.all([
    page.waitForNavigation(),
    page.locator('#profileSelect').selectOption(profileId)
  ]);
  await expect(page.locator('#profileSelect')).toHaveValue(profileId);
}

test('WorkoutSessionController exposes a frozen domain API and an exact pure session-entry builder', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const previous = {
      workingSets: [
        { id: 'history-1', weight: 183, reps: 8, completed: true },
        { id: 'history-2', weight: 178, reps: 10, completed: true },
        { id: 'history-3', weight: '', reps: '', completed: true }
      ]
    };
    const previousBefore = JSON.stringify(previous);
    let seededId = 0;
    let freshId = 0;
    const definition = BigGainsExerciseCatalog.getById('barbell-bench-press');
    const seeded = BigGainsWorkoutSessionController.buildExercise({
      definition,
      prescription: { workingSets: 4, targetReps: '6–8' },
      previousPerformance: previous,
      createId: () => `seeded-${++seededId}`
    });
    const fresh = BigGainsWorkoutSessionController.buildExercise({
      definition,
      createId: () => `fresh-${++freshId}`
    });
    return {
      factoryKeys: Object.keys(BigGainsWorkoutSessionController),
      instanceKeys: Object.keys(workoutSessionController),
      frozenFactory: Object.isFrozen(BigGainsWorkoutSessionController),
      frozenInstance: Object.isFrozen(workoutSessionController),
      compatibilitySame: BigGainsWorkoutSessionController === window.bigGainsWorkoutSessionController,
      previousUnchanged: JSON.stringify(previous) === previousBefore,
      seeded,
      fresh
    };
  });

  expect(result).toMatchObject({
    factoryKeys: ['buildExercise', 'isCompletableSet', 'moveExercise', 'toggleExercise', 'advanceAfterCompletion', 'create'],
    instanceKeys: [
      'start', 'startProgram', 'resume', 'replace', 'loadRoutine', 'repairEmpty', 'addExercise',
      'focusExercise', 'moveExercise', 'toggleExercise', 'removeExercise', 'addSet',
      'removeSet', 'updateSet', 'adjustSet', 'toggleSetCompleted', 'complete', 'discard'
    ],
    frozenFactory: true,
    frozenInstance: true,
    compatibilitySame: true,
    previousUnchanged: true
  });
  expect(result.seeded).toEqual({
    id: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    collapsed: true,
    targetWorkingSets: 4,
    targetReps: '6–8',
    sets: [
      { id: 'seeded-1', weight: 110, reps: 10, warmup: true, completed: false },
      { id: 'seeded-2', weight: 183, reps: 8, warmup: false, completed: false },
      { id: 'seeded-3', weight: 178, reps: 10, warmup: false, completed: false },
      { id: 'seeded-4', weight: 183, reps: '', warmup: false, completed: false },
      { id: 'seeded-5', weight: 183, reps: '', warmup: false, completed: false }
    ]
  });
  expect(result.fresh).toEqual({
    id: 'barbell-bench-press',
    name: 'Barbell Bench Press',
    muscle: 'Chest',
    equipment: 'Barbell',
    collapsed: true,
    sets: [
      { id: 'fresh-1', weight: 0, reps: 10, warmup: true, completed: false },
      { id: 'fresh-2', weight: 0, reps: '', warmup: false, completed: false },
      { id: 'fresh-3', weight: 0, reps: '', warmup: false, completed: false },
      { id: 'fresh-4', weight: 0, reps: '', warmup: false, completed: false }
    ]
  });

  const controllerSource = await (await request.get('/workout-session-controller.js')).text();
  const appSource = await (await request.get('/app.js')).text();
  expect(controllerSource).toContain("Object.defineProperty(scope, 'BigGainsWorkoutSessionController'");
  expect(controllerSource).not.toMatch(/\b(?:document|localStorage|sessionStorage|Supabase)\b/);
  expect(appSource).not.toContain('function makeExercise');
  expect(appSource).not.toContain('const workoutSessionController=(()=>');
  expect(appSource).toContain('BigGainsWorkoutSessionController.create({');
});

test('start, resume, and replace preserve one live active object and invalidate the prior timer identity', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge', { now: '2026-08-05T12:00:00.000Z' });
  await openApp(page);

  const result = await page.evaluate(() => {
    const started = workoutSessionController.start('Push', { loadRoutine: true, scroll: false });
    const startedSnapshot = {
      id: started.id,
      type: started.type,
      exerciseIds: started.exercises.map(exercise => exercise.id),
      validStartedAt: Number.isFinite(Date.parse(started.startedAt)),
      stateSharesActive: state.activeWorkout === active && active === started
    };
    state.restTimerEndsAt = Date.now() + 60_000;
    workoutTimerController.reconcile();
    const timerA = workoutTimerController.getStatus();
    const resumed = workoutSessionController.resume(false, { enterMode: false });
    const replacement = workoutSessionController.replace('Pull', { loadRoutine: true, scroll: false });
    const timerAfter = workoutTimerController.getStatus();
    return {
      startedSnapshot,
      resumedSame: resumed === started,
      replacement: {
        id: replacement.id,
        type: replacement.type,
        exerciseIds: replacement.exercises.map(exercise => exercise.id),
        stateSharesActive: state.activeWorkout === active && active === replacement
      },
      selectedDay,
      timerA: { activeWorkoutId: timerA.activeWorkoutId, deadline: timerA.deadline, lifecycle: timerA.lifecycle },
      timerAfter: { activeWorkoutId: timerAfter.activeWorkoutId, deadline: timerAfter.deadline, lifecycle: timerAfter.lifecycle }
    };
  });

  expect(result.startedSnapshot).toMatchObject({
    type: 'Push',
    validStartedAt: true,
    stateSharesActive: true,
    exerciseIds: [
      'seated-machine-chest-press', 'incline-iso-machine-press', 'iso-machine-shoulder-press',
      'seated-pec-deck', 'triceps-pushdown', 'overhead-triceps-extension'
    ]
  });
  expect(result.resumedSame).toBe(true);
  expect(result.replacement.id).not.toBe(result.startedSnapshot.id);
  expect(result.replacement).toMatchObject({
    type: 'Pull',
    stateSharesActive: true,
    exerciseIds: ['lat-pulldown', 'seated-cable-row', 'chest-supported-row', 'reverse-pec-deck', 'dumbbell-curl', 'hammer-curl']
  });
  expect(result.selectedDay).toBe('Pull');
  expect(result.timerA).toMatchObject({ activeWorkoutId: result.startedSnapshot.id, lifecycle: 'running' });
  expect(result.timerA.deadline).toBeGreaterThan(0);
  expect(result.timerAfter).toEqual({ activeWorkoutId: result.replacement.id, deadline: null, lifecycle: 'idle' });
  expect((await jorgeState(page)).activeWorkout.id).toBe(result.replacement.id);
});

test('routine loading appends only missing exercises and preserves the existing session', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const session = workoutSessionController.start('Pull', { loadRoutine: false, scroll: false });
    workoutSessionController.addExercise('lat-pulldown', { scroll: false });
    const beforeLoad = session.exercises.map(exercise => exercise.id);
    workoutSessionController.loadRoutine('Pull', { scroll: false });
    const afterFirstLoad = session.exercises.map(exercise => exercise.id);
    workoutSessionController.loadRoutine('Pull', { scroll: false });
    return {
      sameSession: session === active,
      beforeLoad,
      afterFirstLoad,
      afterSecondLoad: session.exercises.map(exercise => exercise.id),
      setCounts: session.exercises.map(exercise => exercise.sets.length)
    };
  });

  expect(result).toEqual({
    sameSession: true,
    beforeLoad: ['lat-pulldown'],
    afterFirstLoad: ['lat-pulldown', 'seated-cable-row', 'chest-supported-row', 'reverse-pec-deck', 'dumbbell-curl', 'hammer-curl'],
    afterSecondLoad: ['lat-pulldown', 'seated-cable-row', 'chest-supported-row', 'reverse-pec-deck', 'dumbbell-curl', 'hammer-curl'],
    setCounts: [4, 4, 4, 4, 4, 4]
  });
});

test('empty-session repair is narrowly eligible and add creates a session while blocking duplicates', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const repaired = await page.evaluate(() => {
    const current = workoutSessionController.start('Pull', { loadRoutine: false, scroll: false });
    const first = workoutSessionController.repairEmpty(current, { scroll: false });
    const ids = current.exercises.map(exercise => exercise.id);
    const second = workoutSessionController.repairEmpty(current, { scroll: false });
    const wrongReference = workoutSessionController.repairEmpty({ ...current, exercises: [] }, { scroll: false });
    return { first, ids, second, wrongReference };
  });
  expect(repaired).toEqual({
    first: true,
    ids: ['lat-pulldown', 'seated-cable-row', 'chest-supported-row', 'reverse-pec-deck', 'dumbbell-curl', 'hammer-curl'],
    second: false,
    wrongReference: false
  });

  await page.evaluate(() => workoutSessionController.discard());
  const added = await page.evaluate(() => {
    selectedDay = 'Other';
    const created = workoutSessionController.addExercise('barbell-bench-press', { scroll: false });
    const duplicate = workoutSessionController.addExercise('barbell-bench-press', { scroll: false });
    const unknown = workoutSessionController.addExercise('not-a-catalog-id', { scroll: false });
    return {
      sameReferences: created === duplicate && duplicate === unknown && created === active && state.activeWorkout === active,
      type: created.type,
      ids: created.exercises.map(exercise => exercise.id)
    };
  });
  expect(added).toEqual({ sameReferences: true, type: 'Other', ids: ['barbell-bench-press'] });
});

test('live state replacement immediately drives previous-performance seeding without mutating history', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(() => {
    const original = state;
    const originalBefore = JSON.stringify(original);
    const history = {
      id: 'imported-bench-history',
      type: 'Push',
      startedAt: '2026-08-01T10:00:00.000Z',
      completedAt: '2026-08-01T11:00:00.000Z',
      durationSeconds: 3600,
      prs: 0,
      exercises: [{
        id: 'barbell-bench-press',
        name: 'Barbell Bench Press',
        muscle: 'Chest',
        equipment: 'Barbell',
        sets: [
          { id: 'imported-1', weight: 200, reps: 5, warmup: false, completed: true },
          { id: 'imported-2', weight: 190, reps: 8, warmup: false, completed: true }
        ]
      }]
    };
    const historyBefore = JSON.stringify(history);
    state = { ...JSON.parse(JSON.stringify(state)), workouts: [history], activeWorkout: null };
    active = null;
    selectedDay = 'Other';
    const session = workoutSessionController.addExercise('barbell-bench-press', { scroll: false });
    return {
      oldStateUnchanged: JSON.stringify(original) === originalBefore,
      historyUnchanged: JSON.stringify(history) === historyBefore,
      stateSharesActive: state.activeWorkout === active && active === session,
      sets: session.exercises[0].sets.map(set => ({ weight: set.weight, reps: set.reps, warmup: set.warmup }))
    };
  });

  expect(result).toEqual({
    oldStateUnchanged: true,
    historyUnchanged: true,
    stateSharesActive: true,
    sets: [
      { weight: 120, reps: 10, warmup: true },
      { weight: 200, reps: 5, warmup: false },
      { weight: 190, reps: 8, warmup: false },
      { weight: 200, reps: '', warmup: false }
    ]
  });
});

test('completion refuses zero work and otherwise preserves filtering, duration, record, and cloud payload semantics', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises', { now: '2026-08-05T12:10:00.000Z' });
  await openApp(page);

  const refusal = await page.evaluate(() => ({
    result: workoutSessionController.complete(),
    activeId: active.id,
    workouts: state.workouts.length
  }));
  expect(refusal).toEqual({ result: false, activeId: 'active-push-1', workouts: 0 });

  const completed = await page.evaluate(async () => {
    active.startedAt = new Date(Date.now() - 600_000).toISOString();
    const chest = active.exercises[0];
    chest.sets[0] = { ...chest.sets[0], weight: 50, reps: 10, warmup: true, completed: true };
    chest.sets[1] = { ...chest.sets[1], weight: 100, reps: 10, warmup: false, completed: true };
    chest.sets[2] = { ...chest.sets[2], weight: 110, reps: 8, warmup: false, completed: true };
    chest.sets[3] = { ...chest.sets[3], weight: 120, reps: 6, warmup: false, completed: false };
    state.prs = {
      [chest.id]: { exercise: chest.name, estimated1RM: 130, weight: 95, reps: 10, date: '2026-08-01T12:00:00.000Z' }
    };
    const source = active;
    const sourceBefore = JSON.stringify(source);
    const result = workoutSessionController.complete();
    const workout = state.workouts[0];
    const cloudRecord = (await BigGainsCloudShadow.localRecords(PROFILE.id, state))
      .find(record => record.table === 'workouts' && record.clientId === workout.id);
    return {
      result,
      activeCleared: active === null && state.activeWorkout === null,
      sourceUnchanged: JSON.stringify(source) === sourceBefore,
      historyLength: state.workouts.length,
      workout,
      cloudData: cloudRecord.data,
      pr: state.prs['seated-machine-chest-press']
    };
  });

  expect(completed.result).toBe(true);
  expect(completed.activeCleared).toBe(true);
  expect(completed.sourceUnchanged).toBe(true);
  expect(completed.historyLength).toBe(1);
  expect(completed.workout.durationSeconds).toBeGreaterThanOrEqual(600);
  expect(completed.workout.durationSeconds).toBeLessThanOrEqual(601);
  expect(completed.workout.prs).toBe(2);
  expect(completed.workout.exercises).toHaveLength(1);
  expect(completed.workout.exercises[0].sets.map(set => set.id)).toEqual([
    'active-warmup-1', 'active-working-1', 'active-working-2'
  ]);
  expect(completed.cloudData).toEqual(completed.workout);
  expect(completed.pr).toBeUndefined();
  expect((await jorgeState(page)).workouts).toEqual([completed.workout]);
});

test('discard atomically clears the live session and timer without creating history', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  const result = await page.evaluate(() => {
    state.restTimerEndsAt = Date.now() + 60_000;
    saveState();
    workoutTimerController.reconcile();
    const before = workoutTimerController.getStatus();
    const discarded = workoutSessionController.discard();
    const after = workoutTimerController.getStatus();
    return {
      discarded,
      before: { activeWorkoutId: before.activeWorkoutId, lifecycle: before.lifecycle },
      after: { activeWorkoutId: after.activeWorkoutId, deadline: after.deadline, lifecycle: after.lifecycle },
      activeCleared: active === null && state.activeWorkout === null,
      restTimerEndsAt: state.restTimerEndsAt,
      workouts: state.workouts.length
    };
  });

  expect(result).toEqual({
    discarded: true,
    before: { activeWorkoutId: 'active-push-1', lifecycle: 'running' },
    after: { activeWorkoutId: null, deadline: null, lifecycle: 'unavailable' },
    activeCleared: true,
    restTimerEndsAt: null,
    workouts: 0
  });
  const stored = await jorgeState(page);
  expect(stored.activeWorkout).toBeNull();
  expect(stored.restTimerEndsAt).toBeNull();
  expect(stored.workouts).toEqual([]);
});

test('session transactions save locally before rejected cloud capture and do not roll back', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(async () => {
    const order = [];
    const originalSetItem = Storage.prototype.setItem;
    const originalCloud = window.BigGainsCloudSync;
    const preventRejection = event => event.preventDefault();
    window.addEventListener('unhandledrejection', preventRejection);
    Storage.prototype.setItem = function(key, value) {
      if (key === 'big-gains-v2') order.push('local');
      return originalSetItem.call(this, key, value);
    };
    window.BigGainsCloudSync = {
      captureLocalSnapshot() {
        order.push('cloud');
        return Promise.reject(new Error('simulated cloud capture rejection'));
      }
    };
    try {
      const session = workoutSessionController.start('Other', { loadRoutine: false, scroll: false });
      await new Promise(resolve => setTimeout(resolve, 0));
      const persisted = JSON.parse(localStorage.getItem('big-gains-v2'));
      return {
        order,
        liveId: session.id,
        persistedId: persisted.activeWorkout.id,
        version: persisted.version
      };
    } finally {
      Storage.prototype.setItem = originalSetItem;
      window.BigGainsCloudSync = originalCloud;
      window.removeEventListener('unhandledrejection', preventRejection);
    }
  });

  expect(result.order).toEqual(['local', 'cloud']);
  expect(result.persistedId).toBe(result.liveId);
  expect(result.version).toBe(5);
});

test('Jorge and Alexa session state remains isolated across controller recreation on profile switch', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);

  const jorgeId = await page.evaluate(() => workoutSessionController.start('Other', { loadRoutine: false, scroll: false }).id);
  await switchProfile(page, 'alexa');
  expect(await page.evaluate(() => workoutSessionController.resume(false))).toBeNull();
  const alexaId = await page.evaluate(() => workoutSessionController.start('Other', { loadRoutine: false, scroll: false }).id);
  expect(alexaId).not.toBe(jorgeId);

  await switchProfile(page, 'jorge');
  expect(await page.evaluate(() => active?.id)).toBe(jorgeId);
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).activeWorkout.id).toBe(alexaId);
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.id).toBe(jorgeId);
});
