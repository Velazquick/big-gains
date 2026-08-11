import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const SZW_CLIENT_ID = 'independent-09034233fa064233b85018aec182764d';
const AUTH_USER_ID = '94000000-0000-0000-0000-000000000001';
const CLOUD_ACCOUNT_ID = '94a00000-0000-0000-0000-000000000001';
const CLOUD_PROFILE_ID = '94b00000-0000-0000-0000-000000000001';
const NAMESPACE = `cloud-${CLOUD_ACCOUNT_ID}-${CLOUD_PROFILE_ID}`;
const STORAGE_KEY = `big-gains-${NAMESPACE}-v1`;
const FIXED_MONDAY = new Date('2026-08-10T12:00:00.000Z');

const expectedRoutines = {
  SzwPush1: [
    ['Barbell Bench Press', 5, '5'],
    ['Dumbbell Shoulder Press', 3, '6–8'],
    ['Incline Dumbbell Press', 3, '10–12'],
    ['Dumbbell Lateral Raise', 4, '10–12'],
    ['Cable Triceps Kickback', 4, '10–12']
  ],
  SzwPull1: [
    ['Deadlift', 5, '5'],
    ['Iso-Lateral Pulldown Machine', 3, '10–12'],
    ['Seated Cable Row', 3, '10–12'],
    ['Face Pull', 4, '12–15'],
    ['Hammer Curl', 4, '10–12'],
    ['Dumbbell Shrug', 4, '10–12'],
    ['EZ-Bar Curl', 4, '10–12']
  ],
  SzwLegs1: [
    ['Back Squat', 5, '5'],
    ['Romanian Deadlift', 3, '10–12'],
    ['Leg Press', 3, '10–12'],
    ['Calf Press on Leg Press', 4, 'Failure'],
    ['Seated Leg Curl', 4, '12–15']
  ],
  SzwPush2: [
    ['Iso Machine Shoulder Press', 5, '5'],
    ['Dumbbell Bench Press', 3, '8–10'],
    ['Dips', 4, '10–12'],
    ['Cable Lateral Raise', 4, '10–12'],
    ['Seated Pec Deck', 4, '10–12'],
    ['Overhead Triceps Extension', 4, '10–12']
  ],
  SzwPull2: [
    ['Barbell Row', 3, '6–8'],
    ['Pull-Up', 3, '8–10'],
    ['Iso-Lateral Row', 3, '8–10'],
    ['Cable Curl', 4, '10–12'],
    ['Barbell Shrug', 4, '10–12'],
    ['Dumbbell Curl', 4, '10–12']
  ],
  SzwLegs2: [
    ['Front Squat', 5, '5'],
    ['Hack Squat', 3, '10–12'],
    ['Leg Extension', 4, '10–12'],
    ['Standing Calf Raise', 4, '12–15']
  ]
};

function blankSzwState(overrides = {}) {
  return {
    version: 5,
    profileId: SZW_CLIENT_ID,
    goals: { primary: 'Strength and consistency' },
    workouts: [],
    weights: [],
    prs: {},
    activeWorkout: null,
    restTimerEndsAt: null,
    customRoutines: {},
    timerPreferences: { sound: true, vibration: true },
    ...overrides
  };
}

async function installIndependentRuntime(page, {
  clientId = SZW_CLIENT_ID,
  displayName = 'szw',
  state = blankSzwState()
} = {}) {
  const storageKey = STORAGE_KEY;
  const profileState = { ...state, profileId: clientId };
  await page.addInitScript(({ authUserId, cloudAccountId, cloudProfileId, clientId, displayName, storageKey, profileState }) => {
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent', authUserId, cloudAccountId, cloudProfileId, clientId, displayName,
          presentation: { petEnabled: false, accent: 'merlot', theme: 'slate-dark' }
        }
      }
    }));
    if (sessionStorage.getItem('big-gains-szw-fixture-ready') !== '1') {
      localStorage.setItem(storageKey, JSON.stringify(profileState));
      sessionStorage.setItem('big-gains-szw-fixture-ready', '1');
    }
  }, {
    authUserId: AUTH_USER_ID, cloudAccountId: CLOUD_ACCOUNT_ID, cloudProfileId: CLOUD_PROFILE_ID,
    clientId, displayName, storageKey, profileState
  });
  return storageKey;
}

async function storedSzwState(page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

test('the exact SZW profile config owns the six-day plan without changing generic independent profiles', async ({ page }) => {
  await page.clock.setFixedTime(FIXED_MONDAY);
  await installIndependentRuntime(page);
  await openApp(page);

  const configured = await page.evaluate(() => ({
    profileId: PROFILE.id,
    weekPlan: PROFILE.weekPlan,
    routineTypes: PROFILE.libraryRoutineTypes,
    routineKeys: Object.keys(DEFAULT_ROUTINES),
    today: todaysWorkout()
  }));
  expect(configured).toEqual({
    profileId: SZW_CLIENT_ID,
    weekPlan: {
      0: 'Rest', 1: 'SzwPush1', 2: 'SzwPull1', 3: 'SzwLegs1',
      4: 'SzwPush2', 5: 'SzwPull2', 6: 'SzwLegs2'
    },
    routineTypes: Object.keys(expectedRoutines),
    routineKeys: [...Object.keys(expectedRoutines), 'Other'],
    today: 'SzwPush1'
  });
  await expect(page.locator('#nextWorkout')).toHaveText('Push 1');
  await expect(page.locator('#selectedSessionLabel')).toHaveText('Push 1');

  const genericPage = await page.context().newPage();
  await page.close();
  await genericPage.clock.setFixedTime(FIXED_MONDAY);
  await installIndependentRuntime(genericPage, {
    clientId: 'independent-generic-fixture',
    displayName: 'Generic',
    state: blankSzwState()
  });
  await openApp(genericPage);
  expect(await genericPage.evaluate(() => ({ monday: PROFILE.weekPlan[1], routines: Boolean(PROFILE.routines) })))
    .toEqual({ monday: 'Push', routines: false });
});

test('all six routines map exactly and create one warm-up plus the prescribed working sets', async ({ page }) => {
  await installIndependentRuntime(page);
  await openApp(page);

  const result = await page.evaluate(types => Object.fromEntries(types.map(type => {
    workoutSessionController.replace(type, { loadRoutine: true, scroll: false });
    return [type, active.exercises.map(exercise => ({
      name: exercise.name,
      targetReps: exercise.targetReps,
      targetWorkingSets: exercise.targetWorkingSets,
      warmups: exercise.sets.filter(set => set.warmup).length,
      workingSets: exercise.sets.filter(set => !set.warmup).length,
      workingReps: exercise.sets.filter(set => !set.warmup).map(set => set.reps)
    }))];
  })), Object.keys(expectedRoutines));

  for (const [type, expected] of Object.entries(expectedRoutines)) {
    expect(result[type].map(exercise => [exercise.name, exercise.workingSets, exercise.targetReps])).toEqual(expected);
    for (const exercise of result[type]) {
      expect(exercise.warmups).toBe(1);
      expect(exercise.targetWorkingSets).toBe(exercise.workingSets);
      expect(exercise.workingReps).toEqual(Array(exercise.workingSets).fill(''));
    }
  }
});

test('Library exposes six one-click routines and loads the selected SZW workout type', async ({ page }) => {
  await installIndependentRuntime(page);
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();

  await expect(page.locator('#dayTabs button')).toHaveCount(6);
  await expect(page.locator('#dayTabs button')).toHaveText(['Push 1', 'Pull 1', 'Legs 1', 'Push 2', 'Pull 2', 'Legs 2']);
  await page.locator('#dayTabs [data-day="SzwPull1"]').click();
  await expect(page.locator('#routineSelect')).toHaveValue('SzwPull1');
  await page.locator('#loadRoutine').click();

  await expect(page.locator('#activeWorkoutTitle')).toHaveText('Pull 1');
  await expect(page.locator('#activeExercises .active-exercise')).toHaveCount(7);
  const stored = await storedSzwState(page);
  expect(stored.activeWorkout.type).toBe('SzwPull1');
  expect(stored.activeWorkout.exercises.map(exercise => exercise.name)).toEqual(expectedRoutines.SzwPull1.map(([name]) => name));
});

test('Legs 2 defaults to Hack Squat and offers both rotation alternatives before loading', async ({ page }) => {
  await installIndependentRuntime(page);
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#dayTabs [data-day="SzwLegs2"]').click();

  await expect(page.locator('#routineSelect option')).toHaveText([
    'Legs 2 · Hack Squat', 'Legs 2 · Bulgarian Split Squat', 'Legs 2 · Single-Leg Press'
  ]);
  await expect(page.locator('#routineSelect')).toHaveValue('hack-squat');
  expect(await page.evaluate(() => routineFor('SzwLegs2'))).toContain('hack-squat');

  await page.locator('#routineSelect').selectOption('bulgarian-split-squat');
  await page.locator('#loadRoutine').click();
  expect((await storedSzwState(page)).activeWorkout.exercises.map(exercise => exercise.id))
    .toEqual(['front-squat', 'bulgarian-split-squat', 'leg-extension', 'standing-calf-raise']);

  await page.evaluate(() => workoutSessionController.discard());
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#dayTabs [data-day="SzwLegs2"]').click();
  await page.locator('#routineSelect').selectOption('single-leg-press');
  await page.locator('#loadRoutine').click();
  expect((await storedSzwState(page)).activeWorkout.exercises.map(exercise => exercise.id))
    .toEqual(['front-squat', 'single-leg-press', 'leg-extension', 'standing-calf-raise']);
});

test('targets remain metadata, previous performance seeds results, and schema-v5 reload preserves the routine', async ({ page }) => {
  const previous = {
    id: 'prior-szw-push-1', type: 'SzwPush1',
    startedAt: '2026-08-03T14:00:00.000Z', completedAt: '2026-08-03T15:00:00.000Z',
    durationSeconds: 3600, prs: 0,
    exercises: [{
      id: 'barbell-bench-press', name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell',
      sets: [{ id: 'prior-bench', weight: 185, reps: 5, warmup: false, completed: true }]
    }]
  };
  await installIndependentRuntime(page, { state: blankSzwState({ workouts: [previous] }) });
  await openApp(page);
  await page.evaluate(() => workoutSessionController.replace('SzwPush1', { loadRoutine: true, scroll: false }));

  const activeSnapshot = await storedSzwState(page);
  const bench = activeSnapshot.activeWorkout.exercises[0];
  const shoulder = activeSnapshot.activeWorkout.exercises[1];
  expect(bench.targetReps).toBe('5');
  expect(bench.sets.filter(set => !set.warmup)[0]).toMatchObject({ weight: 185, reps: 5, completed: false });
  expect(shoulder.targetReps).toBe('6–8');
  expect(shoulder.sets.filter(set => !set.warmup).map(set => set.reps)).toEqual(['', '', '']);
  await expect(page.locator('.active-exercise').first().locator('[data-target-reps="5"]')).toHaveText('Target 5');

  await page.reload();
  const reloaded = await storedSzwState(page);
  expect(reloaded.version).toBe(5);
  expect(reloaded.activeWorkout.type).toBe('SzwPush1');
  expect(reloaded.activeWorkout.exercises[0]).toMatchObject({ targetReps: '5', targetWorkingSets: 5 });
  expect(reloaded.activeWorkout.exercises[0].sets.filter(set => !set.warmup)).toHaveLength(5);
});

test('Dips and Pull-Up complete at zero load while weighted movements still require weight', async ({ page }) => {
  await installIndependentRuntime(page);
  await openApp(page);

  async function completeBodyweight(type, exerciseName) {
    await page.evaluate(({ type, exerciseName }) => {
      workoutSessionController.replace(type, { loadRoutine: true, scroll: false });
      const exercise = active.exercises.find(item => item.name === exerciseName);
      const set = exercise.sets.find(item => !item.warmup);
      Object.assign(set, { weight: 0, reps: 10 });
      active.focusedExerciseId = exercise.id;
      active.exercises.forEach(item => { item.collapsed = item !== exercise; });
      renderActive();
    }, { type, exerciseName });
    await page.evaluate(() => window.bigGainsViewShell.showView('train'));
    const card = page.locator('.active-exercise').filter({ has: page.getByRole('heading', { name: exerciseName }) });
    await expect(card.locator('.weight-stepper .stepper-label').first()).toHaveText('Added load');
    await expect(card.locator('.weight-stepper input').first()).toHaveAttribute('aria-label', 'Added load');
    await card.locator('.set-line').nth(1).locator('[data-complete-set]').click();
    const stored = await storedSzwState(page);
    expect(stored.activeWorkout.exercises.find(exercise => exercise.name === exerciseName).sets.find(set => !set.warmup).completed).toBe(true);
  }

  await completeBodyweight('SzwPush2', 'Dips');
  await completeBodyweight('SzwPull2', 'Pull-Up');

  await page.evaluate(() => {
    workoutSessionController.replace('SzwPull2', { loadRoutine: true, scroll: false });
    const exercise = active.exercises.find(item => item.name === 'Barbell Row');
    Object.assign(exercise.sets.find(item => !item.warmup), { weight: 0, reps: 8 });
    exercise.collapsed = false;
    active.focusedExerciseId = exercise.id;
    renderActive();
  });
  await page.evaluate(() => window.bigGainsViewShell.showView('train'));
  await page.locator('.active-exercise').filter({ has: page.getByRole('heading', { name: 'Barbell Row' }) })
    .locator('.set-line').nth(1).locator('[data-complete-set]').click();
  expect((await storedSzwState(page)).activeWorkout.exercises[0].sets.find(set => !set.warmup).completed).toBe(false);
});

test('custom routine ordering preserves known SZW prescriptions', async ({ page }) => {
  await installIndependentRuntime(page);
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#dayTabs [data-day="SzwPush1"]').click();
  await page.locator('#editRoutine').click();
  await page.locator('#routineEditorList [data-routine-move="down"]').first().click();
  await page.locator('#saveRoutine').click();
  await page.locator('#loadRoutine').click();

  const exercises = (await storedSzwState(page)).activeWorkout.exercises;
  expect(exercises.slice(0, 2).map(exercise => exercise.name)).toEqual(['Dumbbell Shoulder Press', 'Barbell Bench Press']);
  expect(exercises.slice(0, 2).map(exercise => [exercise.targetWorkingSets, exercise.targetReps]))
    .toEqual([[3, '6–8'], [5, '5']]);
});

test('retrospective history and analytics accept SZW types and zero-load Pull-Up work', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-08-14T12:00:00.000Z'));
  await installIndependentRuntime(page);
  await openApp(page);
  await page.locator('.bottom-nav [data-view="calendar"]').click();
  await page.locator('#logRetrospectiveWorkout').click();

  await expect(page.locator('#retrospectiveWorkoutType option')).toHaveText([
    'Push 1', 'Pull 1', 'Legs 1', 'Push 2', 'Pull 2', 'Legs 2'
  ]);
  await expect(page.locator('#retrospectiveWorkoutType')).toHaveValue('SzwPull2');
  const pullUp = page.locator('[data-retro-exercise="1"]');
  const workingSet = pullUp.locator('.retrospective-set').nth(1);
  await workingSet.locator('[data-retro-field="weight"]').fill('0');
  await workingSet.locator('[data-retro-field="reps"]').fill('8');
  await workingSet.locator('[data-retro-field="completed"]').check();
  await page.locator('#saveRetrospectiveWorkout').click();

  const stored = await storedSzwState(page);
  expect(stored.workouts[0].type).toBe('SzwPull2');
  expect(stored.workouts[0].exercises[0]).toMatchObject({ name: 'Pull-Up', targetReps: '8–10' });
  expect(stored.workouts[0].exercises[0].sets[0]).toMatchObject({ weight: 0, reps: 8, completed: true });
  const analytics = await page.evaluate(workout => {
    const summary = BigGainsAnalytics.workoutSummary(workout);
    return { workingSets: summary.workingSetCount, totalReps: summary.totalReps, volume: summary.workingSetVolume };
  }, stored.workouts[0]);
  expect(analytics).toEqual({ workingSets: 1, totalReps: 8, volume: null });
  const acceptedTypes = await page.evaluate(types => {
    const source = state.workouts[0];
    const normalized = statePersistenceApi.normalizeState({
      ...state,
      workouts: types.map((type, index) => ({ ...source, id: `accepted-${index}`, type }))
    });
    return {
      types: normalized.workouts.map(workout => workout.type),
      labels: normalized.workouts.map(workout => completionWorkoutLabel(workout.type)),
      workingSets: normalized.workouts.map(workout => BigGainsAnalytics.workoutSummary(workout).workingSetCount)
    };
  }, Object.keys(expectedRoutines));
  expect(acceptedTypes).toEqual({
    types: Object.keys(expectedRoutines),
    labels: ['Push 1', 'Pull 1', 'Legs 1', 'Push 2', 'Pull 2', 'Legs 2'],
    workingSets: [1, 1, 1, 1, 1, 1]
  });

  await page.locator('.bottom-nav [data-view="progress"]').click();
  await expect(page.locator('#history')).toContainText('Pull 2');
  await page.locator('#history [data-history-id]').first().click();
  await expect(page.locator('#historyDialogTitle')).toHaveText('Pull 2');
});

test('Jorge and Alexa keep their existing routine definitions and default set behavior', async ({ browser }) => {
  const jorgeContext = await browser.newContext();
  const jorgePage = await jorgeContext.newPage();
  await installLocalStorageFixture(jorgePage, 'blankJorge');
  await openApp(jorgePage);
  const jorge = await jorgePage.evaluate(() => {
    workoutSessionController.replace('Push', { loadRoutine: true, scroll: false });
    return {
      tabs: [...document.querySelectorAll('#dayTabs button')].map(button => button.dataset.day),
      names: active.exercises.map(exercise => exercise.name),
      workingSets: active.exercises.map(exercise => exercise.sets.filter(set => !set.warmup).length),
      targets: active.exercises.map(exercise => exercise.targetReps || null),
      targetHooks: document.querySelectorAll('[data-target-reps]').length
    };
  });
  expect(jorge.tabs).toEqual(['Push', 'Pull', 'Legs', 'Core', 'FullBody', 'Cardio', 'Other']);
  expect(jorge.names).toEqual([
    'Seated Machine Chest Press', 'Incline Iso Machine Press', 'Iso Machine Shoulder Press',
    'Seated Pec Deck', 'Triceps Pushdown', 'Overhead Triceps Extension'
  ]);
  expect(jorge.workingSets).toEqual([3, 3, 3, 3, 3, 3]);
  expect(jorge.targets).toEqual([null, null, null, null, null, null]);
  expect(jorge.targetHooks).toBe(0);
  await jorgeContext.close();

  const alexaContext = await browser.newContext();
  const alexaPage = await alexaContext.newPage();
  await installLocalStorageFixture(alexaPage, 'blankAlexa');
  await openApp(alexaPage);
  const alexa = await alexaPage.evaluate(() => {
    workoutSessionController.replace('PilatesPull', { loadRoutine: true, scroll: false });
    return {
      weekPlan: PROFILE.weekPlan,
      names: active.exercises.map(exercise => exercise.name),
      workingSets: active.exercises.map(exercise => exercise.sets.filter(set => !set.warmup).length),
      targets: active.exercises.map(exercise => exercise.targetReps || null),
      targetHooks: document.querySelectorAll('[data-target-reps]').length
    };
  });
  expect(alexa.weekPlan[1]).toBe('PilatesPull');
  expect(alexa.names).toEqual(['Lat Pulldown', 'Seated Cable Row', 'Chest-Supported Row', 'Face Pull', 'Dumbbell Curl']);
  expect(alexa.workingSets).toEqual([3, 3, 3, 3, 3]);
  expect(alexa.targets).toEqual([null, null, null, null, null]);
  expect(alexa.targetHooks).toBe(0);
  await alexaContext.close();
});
