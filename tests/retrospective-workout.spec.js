import { expect, test } from '@playwright/test';
import { activeWorkout, blankState, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

test.use({ timezoneId: 'America/New_York' });

const FIXED_NOW = new Date('2026-08-06T16:00:00.000Z');

async function openCalendar(page, fixture = 'blankJorge') {
  await installLocalStorageFixture(page, fixture);
  await page.clock.setFixedTime(FIXED_NOW);
  await openApp(page);
  await page.locator('.bottom-nav [data-view="calendar"]').click();
}

async function selectDate(page, dateKey) {
  await page.locator(`[data-calendar-date="${dateKey}"]`).click();
}

async function openEditor(page, dateKey) {
  await selectDate(page, dateKey);
  await page.locator('#logRetrospectiveWorkout').click();
  await expect(page.locator('#retrospectiveDialog')).toBeVisible();
  await expect(page.locator('#retrospectiveTitle')).toBeFocused();
}

async function completeFirstWorkingSet(page, { weight = '100', reps = '8' } = {}) {
  await page.locator('[data-retro-field="weight"][data-ei="0"][data-si="1"]').fill(weight);
  await page.locator('[data-retro-field="reps"][data-ei="0"][data-si="1"]').fill(reps);
  await page.locator('[data-retro-field="completed"][data-ei="0"][data-si="1"]').check();
}

test('Log workout is limited to non-future dates and defaults from the account weekday plan', async ({ page }) => {
  await openCalendar(page);
  await selectDate(page, '2026-08-03');
  await expect(page.locator('#logRetrospectiveWorkout')).toBeVisible();
  await page.locator('#logRetrospectiveWorkout').click();
  await expect(page.locator('#retrospectiveWorkoutType')).toHaveValue('Push');
  await expect(page.locator('.retrospective-exercise')).toHaveCount(6);
  await page.locator('#retrospectiveBlankWorkout').click();
  await expect(page.locator('.retrospective-exercise')).toHaveCount(0);
  await page.locator('#retrospectiveLoadRoutine').click();
  await expect(page.locator('.retrospective-exercise')).toHaveCount(6);
  await page.locator('#cancelRetrospectiveWorkout').click();

  await openEditor(page, '2026-08-02');
  await expect(page.locator('#retrospectiveWorkoutType')).toHaveValue('Other');
  await expect(page.locator('.retrospective-exercise')).toHaveCount(0);
  await page.locator('#cancelRetrospectiveWorkout').click();
  await selectDate(page, '2026-08-06');
  await expect(page.locator('#logRetrospectiveWorkout')).toBeVisible();
  await selectDate(page, '2026-08-07');
  await expect(page.locator('#logRetrospectiveWorkout')).toBeHidden();
});

test('editor supports editable blank workouts, exercise ordering, and set add/remove controls', async ({ page }) => {
  await openCalendar(page);
  await openEditor(page, '2026-08-02');
  await page.locator('#retrospectiveAddExercise').click();
  await page.locator('.exercise-picker-all [data-exercise-picker-select]').first().click();
  await expect(page.locator('.retrospective-exercise')).toHaveCount(1);
  const firstName = await page.locator('.retrospective-exercise h3').first().textContent();
  await page.locator('[data-retro-add-set="0"]').click();
  await expect(page.locator('[data-retro-exercise="0"] .retrospective-set')).toHaveCount(5);
  await page.locator('[data-retro-remove-set="4"][data-ei="0"]').click();
  await expect(page.locator('[data-retro-exercise="0"] .retrospective-set')).toHaveCount(4);
  await page.locator('#retrospectiveAddExercise').click();
  await page.locator('.exercise-picker-all [data-exercise-picker-select]').first().click();
  await expect(page.locator('.retrospective-exercise')).toHaveCount(2);
  const secondName = await page.locator('.retrospective-exercise h3').nth(1).textContent();
  await page.locator('[data-retro-move="up"][data-ei="1"]').click();
  await expect(page.locator('.retrospective-exercise h3').first()).toHaveText(secondName);
  await page.locator('[data-retro-remove-exercise="0"]').click();
  await expect(page.locator('.retrospective-exercise')).toHaveCount(1);
  await expect(page.locator('.retrospective-exercise h3')).toHaveText(firstName);
});

test('editing historical set values cannot silently mutate working sets into warm-ups', async ({ page }) => {
  await openCalendar(page);
  await openEditor(page, '2026-08-03');

  const firstExercise = page.locator('[data-retro-exercise="0"]');
  const setTypes = firstExercise.locator('[data-retro-field="setType"]');
  await expect(firstExercise.locator('[data-retro-field="warmup"]')).toHaveCount(0);
  expect(await setTypes.evaluateAll(selects => selects.map(select => select.value))).toEqual(['warmup', 'working', 'working', 'working']);

  for (let setIndex = 1; setIndex <= 3; setIndex += 1) {
    await firstExercise.locator(`[data-retro-field="weight"][data-si="${setIndex}"]`).fill(String(100 + setIndex * 5));
    await firstExercise.locator(`[data-retro-field="reps"][data-si="${setIndex}"]`).fill(String(10 - setIndex));
    await firstExercise.locator(`[data-retro-field="completed"][data-si="${setIndex}"]`).check();
  }

  expect(await setTypes.evaluateAll(selects => selects.map(select => select.value))).toEqual(['warmup', 'working', 'working', 'working']);
  await page.locator('#saveRetrospectiveWorkout').click();
  const savedSets = (await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0].exercises[0].sets;
  expect(savedSets.map(set => set.warmup)).toEqual([false, false, false]);
});

test('retrospective bodyweight work accepts zero added load while weighted work still requires load', async ({ page }) => {
  await openCalendar(page, 'completedWorkouts');
  const historicalBefore = structuredClone((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0]);
  await openEditor(page, '2026-08-02');
  await page.locator('#retrospectiveExerciseSelect').selectOption('pull-up');
  await page.locator('#retrospectiveAddExercise').click();

  const pullUp = page.locator('[data-retro-exercise="0"]');
  await expect(pullUp).toContainText('Log only added load');
  await expect(pullUp.locator('[data-retro-field="weight"]').nth(1)).toHaveAttribute('aria-label', 'Added weight');
  await pullUp.locator('[data-retro-field="reps"]').nth(1).fill('8');
  await pullUp.locator('[data-retro-field="completed"]').nth(1).check();
  await pullUp.locator('[data-retro-field="weight"]').nth(2).fill('25');
  await pullUp.locator('[data-retro-field="reps"]').nth(2).fill('6');
  await pullUp.locator('[data-retro-field="completed"]').nth(2).check();
  await page.locator('#saveRetrospectiveWorkout').click();

  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.workouts[0].exercises[0]).toMatchObject({ definitionId: 'pull-up', name: 'Pull-Up' });
  expect(stored.workouts[0].exercises[0].sets[0]).toMatchObject({ weight: 0, reps: 8, warmup: false, completed: true });
  expect(stored.workouts[0].exercises[0].sets[1]).toMatchObject({ weight: 25, reps: 6, warmup: false, completed: true });
  expect(stored.workouts[1]).toEqual(historicalBefore);
  await page.locator('#calendarDayWorkouts [data-history-id]').click();
  await expect(page.locator('#historyDialogContent')).toContainText('Bodyweight × 8');
  await expect(page.locator('#historyDialogContent')).toContainText('Bodyweight + 25 lb × 6');
  await page.locator('#closeHistoryDialog').click();

  await openEditor(page, '2026-08-03');
  const weighted = page.locator('[data-retro-exercise="0"]');
  await weighted.locator('[data-retro-field="weight"]').nth(1).fill('0');
  await weighted.locator('[data-retro-field="reps"]').nth(1).fill('8');
  await weighted.locator('[data-retro-field="completed"]').nth(1).check();
  await page.locator('#saveRetrospectiveWorkout').click();
  await expect(page.locator('#retrospectiveError')).toContainText('external load');
  stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.workouts).toHaveLength(2);
  expect(stored.workouts[1]).toEqual(historicalBefore);
});

test('save requires a completed working set and excludes warmups from volume and working-set count', async ({ page }) => {
  await openCalendar(page);
  await openEditor(page, '2026-08-03');
  await page.locator('[data-retro-field="weight"][data-ei="0"][data-si="0"]').fill('50');
  await page.locator('[data-retro-field="reps"][data-ei="0"][data-si="0"]').fill('10');
  await page.locator('[data-retro-field="completed"][data-ei="0"][data-si="0"]').check();
  await page.locator('#saveRetrospectiveWorkout').click();
  await expect(page.locator('#retrospectiveError')).toContainText('at least one working set');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts).toHaveLength(0);

  await completeFirstWorkingSet(page, { weight: '120', reps: '5' });
  await page.locator('#saveRetrospectiveWorkout').click();
  const workout = (await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0];
  expect(workout.exercises[0].sets).toHaveLength(2);
  expect(workout.exercises[0].sets.filter(set => !set.warmup)).toHaveLength(1);
  await expect(page.locator('#calendarDayWorkouts')).toContainText('1 working sets');
  await expect(page.locator('#calendarDayWorkouts')).toContainText('600 indicated lb');
});

test('local completion time stays on the selected day near UTC midnight and metadata reuses history detail', async ({ page }) => {
  await openCalendar(page);
  await openEditor(page, '2026-08-04');
  await completeFirstWorkingSet(page, { weight: '110', reps: '9' });
  await page.locator('[data-retro-exercise-note="0"]').fill('Retrospective exercise note');
  await page.locator('#retrospectiveWorkoutNote').fill('Imported from paper notes');
  await page.locator('#retrospectiveCompletionTime').fill('23:45');
  await page.locator('#retrospectiveDuration').fill('50');
  await page.locator('#saveRetrospectiveWorkout').click();

  const workout = (await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0];
  expect(workout).toMatchObject({ entryMethod: 'retrospective', durationSeconds: 3000, note: 'Imported from paper notes' });
  expect(workout.exercises[0].note).toBe('Retrospective exercise note');
  expect(workout.exercises[0].definitionId).toBe('lat-pulldown');
  expect(workout.exercises[0].id).not.toBe(workout.exercises[0].definitionId);
  expect(new Set([workout.id, workout.exercises[0].id, ...workout.exercises[0].sets.map(set => set.id)]).size).toBe(3);
  expect(await page.evaluate(iso => {
    const date = new Date(iso);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }, workout.completedAt)).toBe('2026-08-04');
  expect(new Date(workout.completedAt).toISOString().startsWith('2026-08-05')).toBe(true);
  await expect(page.locator('#calendarDayWorkouts')).toContainText('Entered later');
  await expect(page.locator('#calendarDayWorkouts')).toContainText('50:00');
  await page.locator('#calendarDayWorkouts [data-history-id]').click();
  await expect(page.locator('#historyDialog')).toBeVisible();
  await expect(page.locator('#historyDialogContent')).toContainText('Entered later');
  await expect(page.locator('#historyDialogContent')).toContainText('Imported from paper notes');
  await expect(page.locator('#historyDialogContent')).toContainText('Retrospective exercise note');
});

test('PR evaluation ON updates records while OFF saves normal volume without PR changes', async ({ page }) => {
  await openCalendar(page);
  await openEditor(page, '2026-08-03');
  await expect(page.locator('#retrospectiveEvaluatePrs')).toBeChecked();
  await completeFirstWorkingSet(page, { weight: '200', reps: '10' });
  await page.locator('#saveRetrospectiveWorkout').click();
  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.workouts[0].prs).toBe(0);
  expect(stored.prs['seated-machine-chest-press']).toBeUndefined();

  await openEditor(page, '2026-08-04');
  await page.locator('#retrospectiveEvaluatePrs').uncheck();
  await completeFirstWorkingSet(page, { weight: '300', reps: '10' });
  await page.locator('#saveRetrospectiveWorkout').click();
  stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.workouts[0].prs).toBe(0);
  expect(stored.prs['lat-pulldown']).toBeUndefined();
  expect(stored.workouts[0].exercises[0].sets[0]).toMatchObject({ weight: 300, reps: 10 });
});

test('save is exact-once and updates calendar, history, progress, and workout totals', async ({ page }) => {
  await openCalendar(page);
  await openEditor(page, '2026-08-03');
  await completeFirstWorkingSet(page, { weight: '100', reps: '10' });
  await page.evaluate(() => {
    document.getElementById('saveRetrospectiveWorkout').click();
    document.getElementById('saveRetrospectiveWorkout').click();
  });
  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.workouts).toHaveLength(1);
  const snapshot = await page.evaluate(() => BigGainsSync.buildSnapshot());
  expect(snapshot.schema).toBe('big-gains.snapshot.v1');
  expect(snapshot.source.stateVersion).toBe(5);
  expect(snapshot.workouts[0].entryMethod).toBe('retrospective');
  await expect(page.locator('#calendarDayWorkouts .calendar-day-workout')).toHaveCount(1);
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await expect(page.locator('#history .history-item')).toHaveCount(1);
  await expect(page.locator('#history')).toContainText('Entered later');
  await expect(page.locator('#progressExerciseSelect')).toContainText('Seated Machine Chest Press');
  await page.locator('.bottom-nav [data-view="today"]').click();
  await expect(page.locator('#weeklyWorkouts')).toHaveText('1');
  await expect(page.locator('#trainingVolume')).toHaveText('1,000 lb');
});

test('cancel and reload discard only the draft while an active workout and return bar remain untouched', async ({ page }) => {
  const active = activeWorkout({ sessionNote: 'live state marker' });
  await page.addInitScript(({ key, value }) => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('big-gains-active-profile', 'jorge');
    localStorage.setItem(key, JSON.stringify({ ...value, activeWorkout: value.activeWorkout }));
  }, { key: STORAGE_KEYS.jorge, value: { ...blankState('jorge'), activeWorkout: active } });
  await page.clock.setFixedTime(FIXED_NOW);
  await openApp(page);
  await page.locator('#exitWorkoutMode').click();
  const petState = await page.locator('body').getAttribute('data-workout-pet-state');
  await page.locator('.bottom-nav [data-view="calendar"]').click();
  await openEditor(page, '2026-08-03');
  await completeFirstWorkingSet(page);
  await page.locator('#cancelRetrospectiveWorkout').click();
  await expect(page.locator('#workoutReturnBar')).toBeVisible();
  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.activeWorkout).toEqual(active);
  expect(stored.workouts).toHaveLength(0);
  expect(stored.restTimerEndsAt).toBeNull();
  expect(await page.locator('body').getAttribute('data-workout-pet-state')).toBe(petState);
  await expect(page.locator('#timerCard')).toHaveClass(/hidden/);
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'idle');

  await openEditor(page, '2026-08-03');
  await completeFirstWorkingSet(page);
  await page.reload();
  stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.activeWorkout).toEqual(active);
  expect(stored.workouts).toHaveLength(0);
  await expect(page.locator('#workoutCompletion')).toHaveClass(/hidden/);
});

test('account isolation and backup normalization preserve optional retrospective metadata for deployed and synthetic accounts', async ({ page }) => {
  await openCalendar(page);
  await openEditor(page, '2026-08-03');
  await completeFirstWorkingSet(page);
  await page.locator('#saveRetrospectiveWorkout').click();
  const jorge = await readStoredJson(page, STORAGE_KEYS.jorge);
  await Promise.all([page.waitForNavigation(), page.locator('#profileSelect').selectOption('alexa')]);
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).workouts).toHaveLength(0);
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts).toEqual(jorge.workouts);
  await page.locator('.bottom-nav [data-view="calendar"]').click();
  await openEditor(page, '2026-08-05');
  await expect(page.locator('#retrospectiveWorkoutType')).toHaveValue('Other');
  await expect(page.locator('.retrospective-exercise')).toHaveCount(0);
  await page.locator('#cancelRetrospectiveWorkout').click();
  await openEditor(page, '2026-08-06');
  await expect(page.locator('#retrospectiveWorkoutType')).toHaveValue('PilatesCardioAccessory');
  await expect(page.locator('.retrospective-exercise')).toHaveCount(5);
  await page.locator('#cancelRetrospectiveWorkout').click();

  const result = await page.evaluate(workout => {
    const third = { accountId: 'test-riley-account', profileId: 'riley', displayName: 'Riley', storageNamespace: 'riley-test', storageKey: 'big-gains-test-riley-v1', profileConfigRef: 'riley' };
    const profile = { id: 'riley', name: 'Riley', goals: { primary: 'General fitness' }, weekPlan: { 0: 'Rest', 1: 'Push' }, capabilities: { allExercises: false, restFallbackWorkout: 'Push', wellnessPresentation: false } };
    const api = bigGainsStatePersistence.create({ account: third, profile, profileConfig: { riley: profile }, validWorkoutTypes: ['Push'], createId: () => crypto.randomUUID(), slug: value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-') });
    const state = api.blankState();
    state.workouts = [workout];
    api.save(state);
    const backup = JSON.parse(api.prepareExport(api.load()).json);
    const roundTrip = api.validateImport(backup);
    const invalidMetadata = api.normalizeState({ ...state, workouts: [{ ...workout, entryMethod: 'unexpected' }] });
    return { backupMethod: backup.workouts[0].entryMethod, roundTripMethod: roundTrip.state.workouts[0].entryMethod, invalidPresent: 'entryMethod' in invalidMetadata.workouts[0], profileId: roundTrip.state.profileId };
  }, jorge.workouts[0]);
  expect(result).toEqual({ backupMethod: 'retrospective', roundTripMethod: 'retrospective', invalidPresent: false, profileId: 'riley' });
});

test('retrospective logging and save work from the offline v44 app shell', async ({ page, context }) => {
  await openCalendar(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.bottom-nav [data-view="calendar"]').click();
    await openEditor(page, '2026-08-03');
    await completeFirstWorkingSet(page);
    await page.locator('#saveRetrospectiveWorkout').click();
    await expect(page.locator('#calendarDayWorkouts')).toContainText('Entered later');
    expect((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts).toHaveLength(1);
  } finally {
    await context.setOffline(false);
  }
});
