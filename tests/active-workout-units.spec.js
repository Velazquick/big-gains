import { waitForControlledAppShell } from './helpers/app.js';
import { expect } from '@playwright/test';
import { test } from './helpers/network-outage.js';
import { activeWorkout, blankState, completedWorkout, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp, openExerciseOptions, clickCentered } from './helpers/app.js';

const unitPreference = weightUnit => ({ contractVersion: 1, weightUnit });

async function installState(page, value, { alexa = null, activeProfile = 'jorge' } = {}) {
  await page.addInitScript(({ jorgeKey, alexaKey, activeProfileKey, activeProfileId, state, alexaState }) => {
    if (localStorage.getItem('__active_workout_units_seeded__')) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(activeProfileKey, activeProfileId);
    localStorage.setItem(jorgeKey, JSON.stringify(state));
    if (alexaState) localStorage.setItem(alexaKey, JSON.stringify(alexaState));
    localStorage.setItem('__active_workout_units_seeded__', 'true');
  }, {
    jorgeKey: STORAGE_KEYS.jorge,
    alexaKey: STORAGE_KEYS.alexa,
    activeProfileKey: STORAGE_KEYS.activeProfile,
    activeProfileId: activeProfile,
    state: value,
    alexaState: alexa
  });
  await openApp(page);
}

const unitButton = (page, unit, index = 0) => page.locator(`[data-exercise-unit="${unit}"][data-ei="${index}"]`);
const weightInput = (page, exerciseIndex, setIndex) => page.locator(`input[data-field="weight"][data-ei="${exerciseIndex}"][data-si="${setIndex}"]`);

async function chooseExerciseUnit(page, unit, index = 0) {
  await clickCentered(unitButton(page, unit, index));
  await expect(unitButton(page, unit, index)).toHaveAttribute('aria-pressed', 'true');
}

function semanticActiveWorkout(overrides = {}) {
  const set = (id, weight, warmup = false) => ({ id, weight, reps: 8, warmup, completed: false });
  return activeWorkout({
    exercises: [
      {
        id: 'seated-machine-chest-press', name: 'Seated Machine Chest Press', muscle: 'Chest', equipment: 'Machine', collapsed: false,
        sets: [set('external-warmup', 45, true), set('external-working', 100)]
      },
      {
        id: 'pull-up', name: 'Pull-Up', muscle: 'Back', equipment: 'Bodyweight', collapsed: true,
        sets: [set('bodyweight-working', 25)]
      },
      {
        id: 'assisted-pull-up', name: 'Assisted Pull-Up', muscle: 'Back', equipment: 'Machine', collapsed: true,
        sets: [set('assistance-working', 50)]
      }
    ],
    ...overrides
  });
}

test('effective unit follows exercise override, then profile preference, then pounds', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), activeWorkout: activeWorkout() });
  expect(await page.evaluate(() => BigGainsUnits.effectiveUnitFor({}, {}))).toBe('lb');
  expect(await page.evaluate(() => BigGainsUnits.effectiveUnitFor({}, { unitPreferences: { weightUnit: 'kg' } }))).toBe('kg');
  expect(await page.evaluate(() => BigGainsUnits.effectiveUnitFor({ displayUnitOverride: 'lb' }, { unitPreferences: { weightUnit: 'kg' } }))).toBe('lb');
  await expect(unitButton(page, 'lb')).toHaveAttribute('aria-pressed', 'true');
  await expect(weightInput(page, 0, 1)).toHaveValue('100');

  await page.evaluate(() => { state.unitPreferences = { contractVersion: 1, weightUnit: 'kg' }; saveState(); renderAll(); });
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  await expect(weightInput(page, 0, 1)).toHaveValue('45.359');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[0].displayUnitOverride).toBeUndefined();
});

test('explicit exercise overrides rerender immediately without changing either profile default', async ({ page }) => {
  await installState(page, {
    ...blankState('jorge'),
    unitPreferences: unitPreference('lb'),
    activeWorkout: activeWorkout()
  }, {
    alexa: { ...blankState('alexa'), unitPreferences: unitPreference('kg'), activeWorkout: activeWorkout({ id: 'alexa-active' }) }
  });

  await chooseExerciseUnit(page, 'kg');
  await expect(weightInput(page, 0, 0)).toHaveValue('20.412');
  await expect(weightInput(page, 0, 1)).toHaveValue('45.359');
  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.unitPreferences).toEqual(unitPreference('lb'));
  expect(stored.activeWorkout.exercises[0].displayUnitOverride).toBe('kg');

  await page.evaluate(() => { state.unitPreferences = { contractVersion: 1, weightUnit: 'kg' }; saveState(); renderAll(); });
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => { state.unitPreferences = { contractVersion: 1, weightUnit: 'lb' }; saveState(); renderAll(); });
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');

  await page.evaluate(() => localStorage.setItem('big-gains-active-profile', 'alexa'));
  await page.reload();
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  await chooseExerciseUnit(page, 'lb');
  stored = await readStoredJson(page, STORAGE_KEYS.alexa);
  expect(stored.unitPreferences).toEqual(unitPreference('kg'));
  expect(stored.activeWorkout.exercises[0].displayUnitOverride).toBe('lb');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[0].displayUnitOverride).toBe('kg');
});

test('repeated lb/kg toggles never mutate canonical sets and reload preserves only the active override', async ({ page }) => {
  const workout = semanticActiveWorkout({
    programOrigin: {
      contract: 'big-gains.program-origin.v1',
      accountId: 'local-jorge',
      profileId: 'jorge',
      programId: 'program-1',
      programVersionId: 'program-version-1',
      routineId: 'routine-1',
      routineVersionId: 'routine-version-1',
      slotId: 'slot-1',
      slotIndex: 0,
      cycleNumber: 1,
      materializedAt: '2026-08-05T12:00:00.000Z'
    }
  });
  await installState(page, { ...blankState('jorge'), activeWorkout: workout });
  const originalSets = await page.evaluate(() => JSON.stringify(state.activeWorkout.exercises.map(exercise => exercise.sets)));
  const originalOrigin = await page.evaluate(() => JSON.stringify(state.activeWorkout.programOrigin));

  for (const unit of ['kg', 'lb', 'kg', 'lb', 'kg']) await chooseExerciseUnit(page, unit);

  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(JSON.stringify(stored.activeWorkout.exercises.map(exercise => exercise.sets))).toBe(originalSets);
  expect(JSON.stringify(stored.activeWorkout.programOrigin)).toBe(originalOrigin);
  expect(stored.activeWorkout.exercises[0].displayUnitOverride).toBe('kg');
  const activeRecord = await page.evaluate(async () => (await BigGainsCloudShadow.localRecords('jorge', state))
    .find(record => record.table === 'active_sessions'));
  expect(activeRecord).toMatchObject({
    entityType: 'activeSession',
    data: { workout: { id: 'active-push-1', exercises: [{ displayUnitOverride: 'kg' }, {}, {}] } }
  });
  await page.reload();
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  await expect(weightInput(page, 0, 1)).toHaveValue('45.359');
  expect(JSON.stringify((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises.map(exercise => exercise.sets))).toBe(originalSets);
});

test('kg edits commit once to canonical pounds for warm-up, working, added-load, and assistance inputs', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), activeWorkout: semanticActiveWorkout() });
  for (const index of [0, 1, 2]) await chooseExerciseUnit(page, 'kg', index);

  await expect(weightInput(page, 0, 0)).toHaveValue('20.412');
  await expect(weightInput(page, 0, 1)).toHaveValue('45.359');
  await expect(weightInput(page, 1, 0)).toHaveValue('11.34');
  await expect(weightInput(page, 2, 0)).toHaveValue('22.68');
  await expect(page.locator('.weight-stepper .stepper-unit')).toHaveText(['kg', 'kg', 'kg', 'kg']);

  await weightInput(page, 0, 0).fill('10');
  await weightInput(page, 0, 1).fill('10');
  await page.locator('[data-toggle-exercise="1"]').click();
  await weightInput(page, 1, 0).fill('10');
  await page.locator('[data-toggle-exercise="2"]').click();
  await weightInput(page, 2, 0).fill('10');
  const weights = (await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises.map(exercise => exercise.sets.map(set => set.weight));
  for (const weight of weights.flat()) expect(weight).toBeCloseTo(22.046226218, 8);

  await page.locator('[data-toggle-exercise="1"]').click();
  await weightInput(page, 1, 0).fill('');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[1].sets[0].weight).toBe('');
  await weightInput(page, 1, 0).fill('0');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[1].sets[0].weight).toBe(0);
  await expect(page.locator('.active-exercise').nth(1)).toContainText('Added weight');
  await expect(page.locator('.active-exercise').nth(2)).toContainText('Assistance');
});

test('active guidance, prior load, delta, and workload copy use the effective exercise unit', async ({ page }) => {
  const workout = activeWorkout();
  workout.exercises[0].goalGuidance = {
    version: 1,
    goalId: 'goal-1',
    exerciseId: 'seated-machine-chest-press',
    exerciseName: 'Seated Machine Chest Press',
    targetValue: 250,
    targetUnit: 'lb',
    targetBasis: 'entered_load',
    status: 'available',
    reasonCode: 'ADD_REPS',
    explanation: 'Keep the load and add reps.',
    recommendation: { enteredLoad: 190, repTargets: [5, 5, 5], workingSetCount: 3 },
    display: { goal: '250 lb', load: '190 lb', loadLabel: 'Weight' }
  };
  workout.exercises[0].sets[1].completed = true;
  await installState(page, {
    ...blankState('jorge'),
    workouts: [completedWorkout()],
    activeWorkout: workout
  });
  await chooseExerciseUnit(page, 'kg');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Today: 86.2 kg × 5 · 3 sets');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('113.4 kg');
  await expect(page.locator('[data-previous-performance="seated-machine-chest-press"]')).toContainText('45.4 kg');
  await expect(page.locator('.collapsed-summary')).toContainText('indicated kg');
});

test('completion and discard end override lifetime while History and the next workout use profile units', async ({ page }) => {
  await installState(page, {
    ...blankState('jorge'),
    unitPreferences: unitPreference('kg'),
    activeWorkout: activeWorkout({ displayUnitOverride: 'lb' })
  });
  await page.locator('button[data-complete-set][data-si="1"]').click();
  expect(await page.evaluate(() => workoutSessionController.complete())).toBe(true);
  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.activeWorkout).toBeNull();
  expect(stored.workouts[0]).not.toHaveProperty('displayUnitOverride');
  for (const exercise of stored.workouts[0].exercises) expect(exercise).not.toHaveProperty('displayUnitOverride');
  expect(stored.workouts[0].exercises[0].sets[0].weight).toBe(100);
  expect(stored.unitPreferences).toEqual(unitPreference('kg'));

  await page.locator('#completionDone').click();
  await page.evaluate(() => workoutSessionController.start('Push', { loadRoutine: true, scroll: false }));
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout).not.toHaveProperty('displayUnitOverride');
  await page.getByRole('button', { name: 'Return to workout' }).click();
  await chooseExerciseUnit(page, 'lb');
  expect(await page.evaluate(() => workoutSessionController.discard())).toBe(true);
  stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.activeWorkout).toBeNull();
  await page.evaluate(() => workoutSessionController.start('Push', { loadRoutine: true, scroll: false }));
  await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
});

test('completed History and retrospective editing ignore any legacy-looking workout override', async ({ page }) => {
  const historical = completedWorkout({ displayUnitOverride: 'kg' });
  historical.exercises[0].displayUnitOverride = 'kg';
  await installState(page, {
    ...blankState('jorge'),
    unitPreferences: unitPreference('lb'),
    workouts: [historical]
  });
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await expect(page.locator('#history')).toContainText('1K indicated lb');
  await page.locator('#history [data-history-id="completed-push-1"]').click();
  await expect(page.locator('#historyDialogContent')).toContainText('100 lb × 10');
  await page.locator('#editCompletedWorkout').click();
  await expect(page.locator('[data-retro-field="weight"]')).toHaveValue('100');
  expect(await page.evaluate(() => JSON.stringify(state.workouts).includes('displayUnitOverride'))).toBe(false);
});

test('active override and canonical edits survive an offline reload', async ({ page, context, setAppNetworkUnavailable }) => {
  await installState(page, { ...blankState('jorge'), activeWorkout: activeWorkout() });
  await waitForControlledAppShell(page);
  await chooseExerciseUnit(page, 'kg');
  await weightInput(page, 0, 1).fill('100');
  await setAppNetworkUnavailable(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle('Big Gains');
    await expect(unitButton(page, 'kg')).toHaveAttribute('aria-pressed', 'true');
    await expect(weightInput(page, 0, 1)).toHaveValue('100');
    expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[0].sets[1].weight).toBeCloseTo(220.46226218, 8);
  } finally {
    await setAppNetworkUnavailable(false);
  }
});

test('phone-width exercise controls stay tappable and clear of title and removal controls', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installState(page, { ...blankState('jorge'), activeWorkout: activeWorkout() });
  const boxes = await page.locator('[data-exercise-unit]').evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect();
    return { width: rect.width, height: rect.height, left: rect.left, right: rect.right };
  }));
  expect(boxes).toHaveLength(2);
  for (const box of boxes) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(390);
  }
  await expect(page.locator('#activeWorkoutUnitChoice, [data-workout-unit]')).toHaveCount(0);
  await expect(page.locator('.active-exercise-unit-choice')).toBeVisible();
  const bounds = await page.locator('.active-exercise').first().evaluate(card => {
    const choice = card.querySelector('.active-exercise-unit-choice').getBoundingClientRect();
    const head = card.querySelector('.exercise-head').getBoundingClientRect();
    return { choiceTop: choice.top, headBottom: head.bottom };
  });
  expect(bounds.choiceTop).toBeGreaterThanOrEqual(bounds.headBottom);
  await unitButton(page, 'kg').focus();
  await page.keyboard.press('Enter');
  await expect(unitButton(page, 'kg')).toBeFocused();
  await expect(unitButton(page, 'kg')).toHaveAccessibleName('Kilograms selected');
  await expect(unitButton(page, 'kg').locator('.unit-selected-mark')).toHaveText('✓');
  await expect(page.locator('#workoutClock')).toBeVisible();
  await expect(page.locator('#cancelWorkout')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('mobile-exercise-units.png'), fullPage: true });
});

test('mixed exercise units commit independently and only defaults follow live profile changes', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), activeWorkout: semanticActiveWorkout() });
  await expect(page.locator('[data-exercise-unit]')).toHaveCount(6);
  await expect(page.locator('#activePanel > .active-heading [data-exercise-unit], [data-workout-unit]')).toHaveCount(0);
  await chooseExerciseUnit(page, 'kg', 0);
  await chooseExerciseUnit(page, 'lb', 2);
  await weightInput(page, 0, 1).fill('40');
  await page.locator('[data-toggle-exercise="1"]').click();
  await weightInput(page, 1, 0).fill('80');
  let stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.activeWorkout.exercises[0].sets[1].weight).toBe(40 * 2.2046226218);
  expect(stored.activeWorkout.exercises[1].sets[0].weight).toBe(80);
  expect(stored.activeWorkout.exercises[1]).not.toHaveProperty('displayUnitOverride');
  await page.evaluate(() => { state.unitPreferences = { contractVersion: 1, weightUnit: 'kg' }; saveState(); renderAll(); });
  for (const index of [0, 1]) await expect(unitButton(page, 'kg', index)).toHaveAttribute('aria-pressed', 'true');
  await expect(unitButton(page, 'lb', 2)).toHaveAttribute('aria-pressed', 'true');
  await expect(weightInput(page, 0, 1)).toHaveValue('40');
  await expect(weightInput(page, 1, 0)).toHaveValue('36.287');
  await expect(weightInput(page, 2, 0)).toHaveValue('50');
  await page.reload();
  stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.activeWorkout).not.toHaveProperty('displayUnitOverride');
  expect(stored.activeWorkout.exercises.map(exercise => exercise.displayUnitOverride)).toEqual(['kg', undefined, 'lb']);
});

for (const legacyUnit of ['lb', 'kg']) test(`legacy ${legacyUnit} migrates once on resume, preserving valid exercise choices`, async ({ page }) => {
  const workout = semanticActiveWorkout({ displayUnitOverride: legacyUnit });
  workout.exercises[1].displayUnitOverride = legacyUnit === 'kg' ? 'lb' : 'kg';
  workout.exercises[2].displayUnitOverride = 'invalid';
  await installState(page, { ...blankState('jorge'), activeWorkout: workout });
  const normalized = await page.evaluate(() => structuredClone(active));
  expect(normalized).not.toHaveProperty('displayUnitOverride');
  expect(normalized.exercises.map(exercise => exercise.displayUnitOverride)).toEqual([legacyUnit, workout.exercises[1].displayUnitOverride, legacyUnit]);
  expect(normalized.exercises.map(exercise => exercise.sets)).toEqual(workout.exercises.map(exercise => exercise.sets));
  await page.evaluate(() => saveState());
  await page.reload();
  expect(await page.evaluate(() => active)).toEqual(normalized);
  await page.evaluate(() => workoutSessionController.addExercise('lat-pulldown', { scroll: false }));
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises.at(-1)).not.toHaveProperty('displayUnitOverride');
  await expect(unitButton(page, 'lb', 3)).toHaveAttribute('aria-pressed', 'true');
});

test('invalid override metadata falls back to profile preference without altering source state', async ({ page }) => {
  const workout = semanticActiveWorkout({ displayUnitOverride: 'invalid' });
  workout.exercises[0].displayUnitOverride = null;
  workout.exercises[1].displayUnitOverride = 'invalid';
  await installState(page, { ...blankState('jorge'), unitPreferences: unitPreference('kg'), activeWorkout: workout });
  expect(await page.evaluate(() => JSON.stringify(active).includes('displayUnitOverride'))).toBe(false);
  for (const index of [0, 1, 2]) await expect(unitButton(page, 'kg', index)).toHaveAttribute('aria-pressed', 'true');
});

test('existing cloud active-session recovery round-trips mixed units with exact parity', async ({ page }) => {
  const workout = semanticActiveWorkout();
  workout.exercises[0].displayUnitOverride = 'kg';
  workout.exercises[2].displayUnitOverride = 'lb';
  await installState(page, { ...blankState('jorge'), activeWorkout: workout });
  const result = await page.evaluate(async () => {
    const current = await BigGainsCloudShadow.localRecords('jorge', state);
    const recovered = await BigGainsCloudShadow.schemaV5FromCloud({
      cloud: { ownershipIssues: [], profiles: { jorge: { current, tombstones: [], winners: new Map(current.map(record => [BigGainsCloudShadow.keyFor(record.table, record.clientId), record])) } } }, profileClientId: 'jorge'
    });
    return { parity: recovered.comparison.parity, workout: statePersistenceApi.normalizeState(recovered.state).activeWorkout };
  });
  expect(result.parity).toBe(true);
  expect(result.workout.exercises.map(exercise => exercise.displayUnitOverride)).toEqual(['kg', undefined, 'lb']);
  expect(result.workout.exercises.map(exercise => exercise.sets)).toEqual(workout.exercises.map(exercise => exercise.sets));
});

test('real Program materialization and Routine versions remain identical through exercise toggles', async ({ page }) => {
  await installState(page, blankState('jorge'));
  const before = await page.evaluate(() => {
    const owner = { accountId: ACCOUNT.accountId, profileId: PROFILE.id };
    const createId = () => crypto.randomUUID();
    const now = () => '2026-08-25T12:00:00.000Z';
    const routine = BigGainsProgramModel.approveRoutine({
      capture: BigGainsProgramModel.blankCapture(), ...owner, purposeKey: 'unit-fixture', label: 'Unit fixture',
      source: { kind: 'reviewed_rebuild', routineType: 'Push' },
      exercises: [{ exerciseId: BigGainsExerciseCatalog.getById('seated-machine-chest-press').canonicalId, workingSets: 3, targetReps: '6–8', restSeconds: 90 }],
      catalog: BigGainsExerciseCatalog, createId, now
    });
    const program = BigGainsProgramModel.createProgramDraft({
      capture: routine.capture, ...owner, purposeKey: 'unit-fixture', name: 'Unit fixture',
      slots: [{ label: 'Push', preferredCalendarAnchor: null, routineId: routine.version.routineId, routineVersionId: routine.version.routineVersionId }],
      blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 3 }, programmingAuthority: 'review', priorityGoalIds: [], startsOn: '2026-08-25', createId, now
    });
    state.programCapture = BigGainsProgramModel.activateProgram({ capture: program.capture, ...owner, programVersionId: program.version.programVersionId, now });
    const materialization = BigGainsProgramOrigin.materializeNext({ capture: state.programCapture, ...owner, catalog: BigGainsExerciseCatalog, materializedAt: now() });
    workoutSessionController.startProgram(materialization, { scroll: false });
    window.bigGainsViewShell.showView('train', { workout: true, instant: true });
    return structuredClone({ programCapture: state.programCapture, customRoutines: state.customRoutines, workout: active });
  });
  expect(before.workout.programOrigin).toBeTruthy();
  for (const unit of ['kg', 'lb', 'kg']) await chooseExerciseUnit(page, unit);
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after.programCapture).toEqual(before.programCapture);
  expect(after.customRoutines).toEqual(before.customRoutines);
  delete after.activeWorkout.exercises[0].displayUnitOverride;
  expect(after.activeWorkout).toEqual(before.workout);
});

test('reorder keeps choices with exercise identity and unit toggle disarms removal confirmation', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), activeWorkout: semanticActiveWorkout() });
  await chooseExerciseUnit(page, 'kg', 0);
  await openExerciseOptions(page, 'Seated Machine Chest Press');
  await page.locator('#reorderWorkout').click();
  await page.locator('#reorderList select').first().selectOption({value:'1'});
  await page.locator('#closeReorder').click();
  await expect(unitButton(page, 'kg', 1)).toHaveAttribute('aria-pressed', 'true');
  await expect(unitButton(page, 'lb', 0)).toHaveAttribute('aria-pressed', 'true');
  await openExerciseOptions(page, 'Seated Machine Chest Press');
  await page.locator('[data-remove-exercise="1"]').click();
  await expect(page.locator('[data-remove-exercise="1"]')).toHaveText('Sure?');
  await chooseExerciseUnit(page, 'lb', 1);
  await openExerciseOptions(page, 'Seated Machine Chest Press');
  await page.locator('[data-remove-exercise="1"]').click();
  await expect(page.locator('[data-remove-exercise="1"]')).toHaveText('Sure?');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises).toHaveLength(3);
});

test('only load-bearing measurement families expose unit controls', async ({ page }) => {
  await installState(page, blankState('jorge'));
  const families = await page.evaluate(() => {
    const definitions = BigGainsExerciseCatalog.exercises;
    const models = [...new Set(definitions.map(exercise => exercise.measurement.trackingModel))];
    workoutSessionController.start('Other', { loadRoutine: false, scroll: false });
    for (const model of models) workoutSessionController.addExercise(definitions.find(exercise => exercise.measurement.trackingModel === model).id, { scroll: false });
    return active.exercises.map(exercise => ({ id: exercise.id, load: BigGainsExerciseCatalog.inputFieldsFor(exercise).some(field => field.name === 'weight') }));
  });
  expect(families.some(family => !family.load)).toBe(true);
  for (const [index, family] of families.entries()) {
    await expect(page.locator(`.active-exercise-unit-choice [data-ei="${index}"]`)).toHaveCount(family.load ? 2 : 0);
  }
});

test('unit rerender disarms set removal so the fresh icon still requires confirmation', async ({ page }) => {
  await installState(page, { ...blankState('jorge'), activeWorkout: activeWorkout() });
  const remove = page.locator('[data-remove-set][data-ei="0"][data-si="1"]');
  await remove.click();
  await expect(remove).toHaveText('Sure?');
  await chooseExerciseUnit(page, 'kg');
  await expect(remove).not.toHaveText('Sure?');
  await remove.click();
  await expect(remove).toHaveText('Sure?');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[0].sets).toHaveLength(4);
  await remove.click();
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[0].sets).toHaveLength(3);
});
