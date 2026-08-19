import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const BENCH = 'fe9b24dd-e6db-41d3-9395-596830a0a37a';
const NOW = '2026-08-19T16:00:00.000Z';

function exposure({ id = 'bench-exposure', completedAt = '2026-08-18T16:00:00.000Z', load = 190, reps = [5, 5, 5, 5] } = {}) {
  return {
    id,
    type: 'Other',
    startedAt: new Date(Date.parse(completedAt) - 3600000).toISOString(),
    completedAt,
    durationSeconds: 3600,
    prs: 0,
    exercises: [{
      id: 'barbell-bench-press',
      definitionId: BENCH,
      name: 'Barbell Bench Press',
      muscle: 'Chest',
      equipment: 'Barbell',
      sets: reps.map((rep, index) => ({ id: `${id}-set-${index + 1}`, weight: load, reps: rep, warmup: false, completed: true }))
    }]
  };
}

function prior({ load = 190, reps = [5, 5, 5, 5], issuedAt = '2026-08-17T16:00:00.000Z' } = {}) {
  return {
    decisionId: `prior-${load}-${reps.join('-')}`,
    issuedAt,
    evidenceCutoff: issuedAt,
    exerciseId: BENCH,
    enteredLoad: load,
    unit: 'lb',
    loadBasis: 'combined_external_load',
    workingSetCount: 4,
    repTargets: reps,
    decisionCode: 'HOLD_LOAD_BUILD_REPS',
    reasonCode: 'BUILD_STRENGTH_VOLUME',
    explanation: 'Prior deterministic target.',
    policy: { id: 'strength_double_progression_v1', version: 1 },
    selectedExposureIds: [],
    attainmentState: 'in_progress'
  };
}

async function setup(page) {
  await installLocalStorageFixture(page, 'blankJorge', { now: NOW });
  await openApp(page);
}

async function configureBench(page, {
  workouts = [exposure()],
  guidance = true,
  priorDecision = null,
  targetReps = '4-6',
  start = true
} = {}) {
  return page.evaluate(({ workouts, guidance, priorDecision, targetReps, start, bench }) => {
    if (active) workoutSessionController.discard();
    state.workouts = workouts;
    state.customRoutines.Other = [{ exerciseId: 'barbell-bench-press', workingSets: 4, targetReps }];
    state.goals.strengthGoals = [];
    const created = bigGainsGoals.createGoal({ exerciseId: bench, targetValue: 250 });
    if (guidance) bigGainsGoals.setGuidance(created.goal.goalId, true);
    const goal = state.goals.strengthGoals[0];
    if (priorDecision) goal.progressionState = { current: priorDecision, trace: [priorDecision] };
    saveState();
    if (start) {
      workoutSessionController.start('Other', { loadRoutine: true, scroll: false });
      bigGainsViewShell.showView('train', { workout: true, instant: true, scroll: false });
    }
    return structuredClone({ active, goal: state.goals.strengthGoals[0] });
  }, { workouts, guidance, priorDecision, targetReps, start, bench: BENCH });
}

function workingValues(session) {
  return session.exercises[0].sets.filter(set => !set.warmup).map(set => ({ weight: set.weight, reps: set.reps }));
}

test('G1-5.1/G1-5.2: no goal and guidance off preserve ordinary Train construction exactly', async ({ page }) => {
  await setup(page);
  const history = [exposure()];
  const noGoal = await page.evaluate(({ history }) => {
    state.workouts = history;
    state.customRoutines.Other = [{ exerciseId: 'barbell-bench-press', workingSets: 4, targetReps: '4-6' }];
    workoutSessionController.start('Other', { loadRoutine: true, scroll: false });
    const snapshot = structuredClone(active);
    workoutSessionController.discard();
    return snapshot;
  }, { history });
  const off = await configureBench(page, { workouts: history, guidance: false });

  expect(noGoal.exercises[0]).not.toHaveProperty('goalGuidance');
  expect(off.active.exercises[0]).not.toHaveProperty('goalGuidance');
  expect(workingValues(off.active)).toEqual(workingValues(noGoal));
  expect(workingValues(off.active)).toEqual(Array(4).fill({ weight: 190, reps: 5 }));
});

test('G1-4.8/G1-4.9/G1-5.3: baseline copy is honest, editable, and stable across reload and new history', async ({ page }) => {
  await setup(page);
  const configured = await configureBench(page);
  expect(workingValues(configured.active)).toEqual(Array(4).fill({ weight: 190, reps: 5 }));
  expect(configured.active.exercises[0].goalGuidance).toMatchObject({
    status: 'available', reasonCode: 'BUILD_STRENGTH_VOLUME', decisionCode: 'HOLD_LOAD_BUILD_REPS'
  });
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Starting point');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Today: 190 lb × 5 · 4 sets');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Using your recent working load');

  const workingInputs = page.locator('.active-exercise').first().locator('.set-line:not(:first-child)');
  await workingInputs.first().locator('input[data-field="weight"]').fill('185');
  await workingInputs.first().locator('input[data-field="reps"]').fill('4');
  await page.evaluate(newExposure => {
    state.workouts.unshift(newExposure);
    saveState();
  }, exposure({ id: 'remote-history-after-session', completedAt: '2026-08-19T17:00:00.000Z', load: 205, reps: [6, 6, 6, 6] }));
  await page.reload();
  await expect(page.locator('.active-exercise').first().locator('input[data-field="weight"]').nth(1)).toHaveValue('185');
  await expect(page.locator('.active-exercise').first().locator('input[data-field="reps"]').nth(1)).toHaveValue('4');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Today: 190 lb × 5 · 4 sets');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).version).toBe(5);
});

test('G1-7.6/G1-7.7: exact bench progression renders add-reps then add-load targets', async ({ page }) => {
  await setup(page);
  let result = await configureBench(page, { priorDecision: prior({ reps: [5, 5, 5, 5] }) });
  expect(workingValues(result.active)).toEqual(Array(4).fill({ weight: 190, reps: 6 }));
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Build reps');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Today: 190 lb × 6 · 4 sets');

  result = await configureBench(page, {
    priorDecision: prior({ reps: [6, 6, 6, 6] }),
    workouts: [exposure({ reps: [6, 6, 6, 6] })]
  });
  expect(workingValues(result.active)).toEqual(Array(4).fill({ weight: 195, reps: 4 }));
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Add load');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Today: 195 lb × 4 · 4 sets');
});

test('G1-7.8/G1-7.9/G1-10.6: partials hold, repeated misses adjust, and overrides request review without rebasing', async ({ page }) => {
  await setup(page);
  let result = await configureBench(page, {
    priorDecision: prior({ load: 195, reps: [4, 4, 4, 4] }),
    workouts: [exposure({ load: 195, reps: [4, 4, 3, 3] })]
  });
  expect(result.active.exercises[0].goalGuidance.reasonCode).toBe('HOLD_PARTIAL');
  expect(workingValues(result.active)).toEqual(Array(4).fill({ weight: 195, reps: 4 }));

  result = await configureBench(page, {
    priorDecision: prior({ load: 195, reps: [4, 4, 4, 4] }),
    workouts: [
      exposure({ id: 'miss-2', completedAt: '2026-08-18T16:00:00.000Z', load: 195, reps: [3, 3, 3, 3] }),
      exposure({ id: 'miss-1', completedAt: '2026-08-17T20:00:00.000Z', load: 195, reps: [3, 3, 3, 3] })
    ]
  });
  expect(result.active.exercises[0].goalGuidance.reasonCode).toBe('ADJUST_REPEATED_MISS');
  expect(workingValues(result.active)).toEqual(Array(4).fill({ weight: 190, reps: 4 }));
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Adjust');

  result = await configureBench(page, {
    priorDecision: prior({ load: 195, reps: [4, 4, 4, 4] }),
    workouts: [exposure({ id: 'override', load: 200, reps: [4, 4, 4, 4] })]
  });
  expect(result.active.exercises[0].goalGuidance.reasonCode).toBe('USER_OVERRIDE_REVIEW');
  expect(workingValues(result.active)).toEqual(Array(4).fill({ weight: 195, reps: 4 }));
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Your performance differed from the target');
});

test('G1-2.13/G1-2.14: estimated reached stays contextual while a performed target single stops prescription', async ({ page }) => {
  await setup(page);
  let result = await configureBench(page, { workouts: [exposure({ load: 215, reps: [5, 5, 5, 5] })] });
  expect(result.active.exercises[0].goalGuidance.attainment.status).toBe('estimated_reached');
  expect(result.active.exercises[0].goalGuidance.status).toBe('available');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('a completed target single is still required');

  result = await configureBench(page, { workouts: [exposure({ id: 'target-single', load: 250, reps: [1] })] });
  expect(result.active.exercises[0].goalGuidance).toMatchObject({ status: 'unavailable', reasonCode: 'ACHIEVED' });
  expect(workingValues(result.active)).not.toEqual(Array(4).fill({ weight: 250, reps: 1 }));
  await expect(page.locator('[data-goal-guidance-status="unavailable"]')).toContainText('The completed goal no longer prescribes work');
});

test('G1-4.6/G1-5.4: stale evidence and routine conflict fail closed; routine review never autosaves', async ({ page }) => {
  await setup(page);
  let result = await configureBench(page, {
    workouts: [exposure({ completedAt: '2026-06-01T16:00:00.000Z' })]
  });
  expect(result.active.exercises[0].goalGuidance).toMatchObject({ status: 'unavailable', reasonCode: 'STALE_EVIDENCE' });
  await expect(page.locator('[data-goal-guidance-status="unavailable"]')).toContainText('Recent evidence is too old');

  result = await configureBench(page, { targetReps: '8-10' });
  expect(result.active.exercises[0].goalGuidance).toMatchObject({ status: 'conflict', reasonCode: 'ROUTINE_CONFLICT' });
  const before = await page.evaluate(() => structuredClone(state.customRoutines.Other));
  await expect(page.locator('[data-goal-use-today]')).toBeDisabled();
  await page.locator('[data-goal-review-routine]').click();
  await expect(page.locator('#routineDialog')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => structuredClone(state.customRoutines.Other))).toEqual(before);
  await page.locator('#closeRoutineDialog').click();

  const safeAction = await page.evaluate(() => {
    const routineBefore = JSON.stringify(state.customRoutines.Other);
    const exercise = active.exercises[0];
    exercise.goalGuidance = {
      ...exercise.goalGuidance,
      conflict: { safeRecommendation: { enteredLoad: 185, workingSetCount: 4, repTargets: [4, 4, 4, 4] } }
    };
    const applied = bigGainsGoalsTrainGuidance.useForToday(exercise);
    return { applied, values: exercise.sets.filter(set => !set.warmup).map(set => [set.weight, set.reps]), routineSame: JSON.stringify(state.customRoutines.Other) === routineBefore };
  });
  expect(safeAction).toEqual({ applied: true, values: Array(4).fill([185, 4]), routineSame: true });
});

test('G1-10.4/G1-12.5: progression snapshots stay schema-v5/profile-scoped and work while offline', async ({ page, context }) => {
  await setup(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  const result = await configureBench(page, { priorDecision: prior({ reps: [5, 5, 5, 5] }) });
  expect(result.active.exercises[0].goalGuidance).toMatchObject({ status: 'available', reasonCode: 'ADD_REPS' });
  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.version).toBe(5);
  expect(stored.goals.strengthGoals[0]).toMatchObject({ accountId: 'local-jorge', profileId: 'jorge' });
  expect(stored.goals.strengthGoals[0].progressionState.current).toMatchObject({ enteredLoad: 190, repTargets: [6, 6, 6, 6] });
  expect(stored.goals.strengthGoals[0].progressionState.trace.length).toBeLessThanOrEqual(8);
  await page.reload();
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Today: 190 lb × 6 · 4 sets');
  await context.setOffline(false);
});

test('G1-5.3/EKF-2: eligible total and per-hand loads keep their exact card semantics; per-side stays ineligible', async ({ page }) => {
  await setup(page);
  const result = await page.evaluate(() => {
    const dumbbell = BigGainsExerciseCatalog.getById('dumbbell-bench-press');
    const eligiblePerSide = BigGainsGoals.eligibleExercises(BigGainsExerciseCatalog)
      .filter(exercise => exercise.measurement.loadSemantics.loadBasis === 'per_side').length;
    state.workouts = [{
      id: 'dumbbell-baseline', type: 'Other', startedAt: '2026-08-18T15:00:00.000Z', completedAt: '2026-08-18T16:00:00.000Z', durationSeconds: 3600, prs: 0,
      exercises: [{
        id: dumbbell.id, definitionId: dumbbell.canonicalId, name: dumbbell.name, muscle: dumbbell.muscle, equipment: dumbbell.equipment,
        sets: [1, 2, 3, 4].map(index => ({ id: `db-set-${index}`, weight: 50, reps: 5, warmup: false, completed: true }))
      }]
    }];
    state.customRoutines.Other = [{ exerciseId: dumbbell.id, workingSets: 4, targetReps: '4-6' }];
    const created = bigGainsGoals.createGoal({ exerciseId: dumbbell.canonicalId, targetValue: 80 });
    bigGainsGoals.setGuidance(created.goal.goalId, true);
    workoutSessionController.start('Other', { loadRoutine: true, scroll: false });
    bigGainsViewShell.showView('train', { workout: true, instant: true, scroll: false });
    return {
      eligiblePerSide,
      goalBasis: state.goals.strengthGoals[0].targetBasis,
      measurementBasis: dumbbell.measurement.loadSemantics.loadBasis,
      display: active.exercises[0].goalGuidance.display,
      working: active.exercises[0].sets.filter(set => !set.warmup).map(set => [set.weight, set.reps])
    };
  });
  expect(result).toEqual({
    eligiblePerSide: 0,
    goalBasis: 'entered_load',
    measurementBasis: 'per_hand',
    display: { goal: '80 lb per hand', load: '50 lb per hand', loadLabel: 'Weight per dumbbell' },
    working: Array(4).fill([50, 5])
  });
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Today: 50 lb per hand × 5 · 4 sets');
  await expect(page.locator('[data-goal-guidance-status="available"]')).toContainText('Weight per dumbbell');
});

test('G1-12.5: a foreign-profile guided goal cannot attach to the current profile card', async ({ page }) => {
  await setup(page);
  const session = await page.evaluate(({ bench, now }) => {
    state.workouts = [];
    state.customRoutines.Other = [{ exerciseId: 'barbell-bench-press', workingSets: 4, targetReps: '4-6' }];
    state.goals.strengthGoals = [{
      goalId: 'foreign-guided-goal', accountId: 'local-alexa', profileId: 'alexa', exerciseId: bench,
      legacyExerciseId: 'barbell-bench-press', metric: 'one_rep_max', targetValue: 250, unit: 'lb',
      targetBasis: 'combined_external_load', targetDate: null, label: '', status: 'active', guidanceEnabled: true,
      policy: { id: 'strength_double_progression_v1', version: 1 }, createdAt: now, updatedAt: now
    }];
    workoutSessionController.start('Other', { loadRoutine: true, scroll: false });
    return structuredClone(active);
  }, { bench: BENCH, now: NOW });
  expect(session.exercises[0]).not.toHaveProperty('goalGuidance');
});

test('G1-6.6: every engine reason has safe user copy and unknown reasons fall back neutrally', async ({ page }) => {
  await setup(page);
  const mapping = await page.evaluate(() => ({
    engineReasons: Object.values(BigGainsGoalsProgression.constants.reasons),
    mappedReasons: Object.keys(BigGainsGoalsTrainGuidance.reasonPresentation),
    unknown: bigGainsGoalsTrainGuidance.presentationFor({ reasonCode: 'FUTURE_REASON' })
  }));
  expect(mapping.engineReasons.every(reason => mapping.mappedReasons.includes(reason))).toBe(true);
  expect(mapping.unknown).toEqual({ chip: 'Goal guidance', title: 'Goal target review' });
});
