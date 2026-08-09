import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';

const baselineIds = [
  'seated-machine-chest-press', 'incline-iso-machine-press', 'smith-machine-incline-press',
  'barbell-bench-press', 'dumbbell-bench-press', 'incline-dumbbell-press', 'cable-chest-fly',
  'seated-pec-deck', 'push-up', 'dips', 'iso-machine-shoulder-press', 'dumbbell-shoulder-press',
  'barbell-overhead-press', 'machine-shoulder-press', 'dumbbell-lateral-raise', 'cable-lateral-raise',
  'reverse-pec-deck', 'face-pull', 'overhead-triceps-extension', 'triceps-pushdown', 'rope-pushdown',
  'skull-crusher', 'close-grip-bench-press', 'single-arm-cable-extension', 'cable-triceps-kickback',
  'lat-pulldown', 'iso-lateral-pulldown-machine', 'assisted-pull-up', 'pull-up', 'seated-cable-row',
  'chest-supported-row', 't-bar-row', 'barbell-row', 'one-arm-dumbbell-row', 'iso-lateral-row',
  'straight-arm-pulldown', 'machine-pullover', 'rack-pull', 'dumbbell-shrug', 'barbell-shrug',
  'dumbbell-curl', 'hammer-curl', 'incline-dumbbell-curl', 'preacher-curl', 'machine-preacher-curl',
  'cable-curl', 'bayesian-cable-curl', 'ez-bar-curl', 'back-squat', 'front-squat', 'hack-squat',
  'leg-press', 'single-leg-press', 'smith-machine-squat', 'goblet-squat', 'bulgarian-split-squat',
  'walking-lunge', 'leg-extension', 'romanian-deadlift', 'dumbbell-romanian-deadlift',
  'seated-leg-curl', 'lying-leg-curl', 'hip-thrust', 'glute-bridge', 'cable-pull-through',
  'standing-calf-raise', 'seated-calf-raise', 'calf-press-on-leg-press', 'hip-abductor',
  'cable-crunch', 'hanging-knee-raise', 'hanging-leg-raise', 'ab-wheel-rollout', 'plank',
  'side-plank', 'pallof-press', 'machine-crunch', 'russian-twist', 'dead-bug', 'treadmill-run',
  'outdoor-run', 'incline-walk', 'stair-climber', 'stationary-bike', 'elliptical', 'rowing-machine',
  'deadlift', 'trap-bar-deadlift', 'farmer-carry', 'kettlebell-swing'
];

const additions = {
  'Flat Smith Machine Bench Press': ['flat-smith-machine-bench-press', 'Smith Bench'],
  'Decline Barbell Bench Press': ['decline-barbell-bench-press', 'Decline Bench'],
  'Decline Dumbbell Press': ['decline-dumbbell-press', 'Decline DB Press'],
  'Incline Cable Fly': ['incline-cable-fly', 'Incline Cable Chest Fly'],
  'Assisted Dip': ['assisted-dip', 'Assisted Dips'],
  'Arnold Press': ['arnold-press', 'Arnold Shoulder Press'],
  'Landmine Press': ['landmine-press', 'Single-Arm Landmine Press'],
  'Rear Delt Cable Fly': ['rear-delt-cable-fly', 'Cable Rear Delt Fly'],
  'Dumbbell Triceps Kickback': ['dumbbell-triceps-kickback', 'DB Tricep Kickback'],
  'Wide-Grip Lat Pulldown': ['wide-grip-lat-pulldown', 'Wide Grip Pulldown'],
  'Neutral-Grip Lat Pulldown': ['neutral-grip-lat-pulldown', 'Neutral Grip Pulldown'],
  'Close-Grip Seated Cable Row': ['close-grip-seated-cable-row', 'Close Grip Cable Row'],
  'One-Arm Cable Row': ['one-arm-cable-row', 'Single Arm Cable Row'],
  'Chest-Supported T-Bar Row': ['chest-supported-t-bar-row', 'Chest Supported T Bar Row'],
  'Meadows Row': ['meadows-row', 'Meadows Row'],
  'Rope Hammer Curl': ['rope-hammer-curl', 'Rope Hammer Curls'],
  'Spider Curl': ['spider-curl', 'Spider Curl'],
  'Concentration Curl': ['concentration-curl', 'Concentration Curl'],
  'Reverse Curl': ['reverse-curl', 'Reverse EZ-Bar Curl'],
  'Belt Squat': ['belt-squat', 'Belt Squat Machine'],
  'Pendulum Squat': ['pendulum-squat', 'Pendulum Squat Machine'],
  'V-Squat Machine': ['v-squat-machine', 'V Squat'],
  'Reverse Lunge': ['reverse-lunge', 'Reverse Lunges'],
  'Step-Up': ['step-up', 'Step Up'],
  'Nordic Hamstring Curl': ['nordic-hamstring-curl', 'Nordic Curl'],
  '45-Degree Back Extension': ['45-degree-back-extension', 'Back Extension'],
  'Cable Glute Kickback': ['cable-glute-kickback', 'Glute Cable Kickback'],
  'Hip Adductor': ['hip-adductor', 'Adductor Machine']
};

function analyticsWorkouts() {
  const set = (id, weight, reps, overrides = {}) => ({ id, weight, reps, warmup: false, completed: true, ...overrides });
  const exercise = (id, name, muscle, sets) => ({ id, name, muscle, equipment: 'Test', sets });
  return [
    {
      id: 'latest', type: 'Push', startedAt: '2026-08-05T09:00:00.000Z',
      completedAt: '2026-08-05T10:00:00.000Z', durationSeconds: 3600, prs: 2,
      exercises: [
        exercise('barbell-bench-press', 'Barbell Bench Press', 'Chest', [
          set('warm-latest', 45, 10, { warmup: true }), set('latest-1', 155, 10),
          set('latest-2', 145, 12), set('unfinished', 200, 1, { completed: false })
        ]),
        exercise('seated-calf-raise', 'Seated Calf Raise', 'Calves', [
          set('calf-latest-1', 100, 12), set('calf-latest-2', 100, 10)
        ])
      ]
    },
    {
      id: 'previous', type: 'Push', startedAt: '2026-08-01T09:30:00.000Z',
      completedAt: '2026-08-01T10:00:00.000Z', prs: 0,
      exercises: [
        exercise('barbell-bench-press', 'Barbell Bench Press', 'Chest', [
          set('warm-previous', 45, 20, { warmup: true }), set('previous-1', 100, 10), set('previous-2', 100, 8)
        ]),
        exercise('standing-calf-raise', 'Standing Calf Raise', 'Calves', [set('calf-previous', 200, 15)])
      ]
    },
    {
      id: 'older', type: 'Push', startedAt: '2026-07-10T09:00:00.000Z',
      completedAt: '2026-07-10T09:30:00.000Z', prs: 0,
      exercises: [exercise('barbell-bench-press', 'Barbell Bench Press', 'Chest', [set('older-1', 90, 10)])]
    }
  ];
}

test('catalog preserves every prior stable ID and adds 28 unique commercial-gym movements', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const catalog = await page.evaluate(({ baselineIds, additions }) => {
    const exercises = bigGainsExerciseCatalog.exercises;
    const termOwners = new Map();
    exercises.forEach(exercise => [exercise.name, ...exercise.aliases].forEach(term => {
      const normalized = bigGainsExerciseCatalog.normalizeTerm(term);
      if (!termOwners.has(normalized)) termOwners.set(normalized, new Set());
      termOwners.get(normalized).add(exercise.id);
    }));
    return {
      count: exercises.length,
      missingBaseline: baselineIds.filter(id => !exercises.some(exercise => exercise.id === id)),
      added: Object.fromEntries(Object.entries(additions).map(([name, [id, alias]]) => [name, {
        id: exercises.find(exercise => exercise.name === name)?.id,
        aliasOwner: bigGainsExerciseCatalog.resolve(alias)?.id || null,
        searches: exercises.filter(exercise => bigGainsExerciseCatalog.matchesSearch(exercise, alias)).map(exercise => exercise.id)
      }])),
      ids: exercises.map(exercise => exercise.id),
      names: exercises.map(exercise => exercise.name.toLowerCase()),
      collisions: [...termOwners.entries()].filter(([, owners]) => owners.size > 1),
      calves: ['standing-calf-raise', 'seated-calf-raise', 'calf-press-on-leg-press'].map(id => {
        const exercise = exercises.find(item => item.id === id);
        return { id: exercise.id, muscle: exercise.muscle, family: exercise.family };
      })
    };
  }, { baselineIds, additions });

  expect(catalog.count).toBe(118);
  expect(catalog.missingBaseline).toEqual([]);
  expect(new Set(catalog.ids).size).toBe(catalog.ids.length);
  expect(new Set(catalog.names).size).toBe(catalog.names.length);
  expect(catalog.collisions).toEqual([]);
  for (const [name, [id]] of Object.entries(additions)) {
    expect(catalog.added[name].id).toBe(id);
    expect(catalog.added[name].aliasOwner).toBe(id);
    expect(catalog.added[name].searches).toContain(id);
  }
  expect(catalog.calves).toEqual([
    { id: 'standing-calf-raise', muscle: 'Calves', family: 'calf-raise' },
    { id: 'seated-calf-raise', muscle: 'Calves', family: 'calf-raise' },
    { id: 'calf-press-on-leg-press', muscle: 'Calves', family: 'calf-raise' }
  ]);
});

test('derived analytics cover performance, deltas, working totals, duration, PRs, muscles, windows, and families', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  const workouts = analyticsWorkouts();

  const result = await page.evaluate(({ workouts, now }) => {
    const analytics = BigGainsAnalytics;
    const latest = analytics.workoutSummary(workouts[0]);
    const previous = analytics.previousPerformance(workouts, 'barbell-bench-press');
    const history = analytics.exerciseHistory(workouts, 'barbell-bench-press');
    const trend = analytics.exerciseTrend(workouts, 'barbell-bench-press');
    const windows = analytics.muscleWorkloadWindows(workouts, { now });
    const families = analytics.exerciseFamilyTotals(workouts, bigGainsExerciseCatalog.exercises);
    return {
      api: Object.keys(analytics), latest, previous, history, trend, windows, families,
      muscles: analytics.muscleTotals(workouts),
      derivedDuration: analytics.durationSeconds({ startedAt: '2026-08-01T09:30:00.000Z', completedAt: '2026-08-01T10:00:00.000Z' }),
      warmupIsWorking: analytics.isWorkingSet(workouts[0].exercises[0].sets[0])
    };
  }, { workouts, now: '2026-08-06T12:00:00.000Z' });

  expect(result.latest).toMatchObject({
    workingSetCount: 4, workingSetVolume: 5490, totalReps: 44,
    durationSeconds: 3600, prCount: 2, exerciseCount: 2
  });
  expect(result.latest.bestWorkingSet).toMatchObject({ id: 'latest-1', weight: 155, reps: 10, estimated1RM: 207 });
  expect(result.previous).toMatchObject({ workoutId: 'latest', workingSetCount: 2, workingSetVolume: 3290 });
  expect(result.history).toHaveLength(3);
  expect(result.history[0].delta).toMatchObject({
    weightDelta: 55, repsDelta: 0, improvement: { kind: 'weight', value: 55, label: '+55 lb' }
  });
  expect(result.trend.points.map(point => point.workoutId)).toEqual(['older', 'previous', 'latest']);
  expect(result.trend.bestWorkingSet).toMatchObject({ id: 'latest-1', weight: 155, reps: 10 });
  expect(result.muscles).toEqual({
    Chest: { workingSets: 5, workingSetVolume: 5990, totalReps: 50 },
    Calves: { workingSets: 3, workingSetVolume: 5200, totalReps: 37 }
  });
  expect(result.windows.sevenDay).toMatchObject({
    days: 7, workoutCount: 2,
    muscles: {
      Chest: { workingSets: 4, workingSetVolume: 5090, totalReps: 40 },
      Calves: { workingSets: 3, workingSetVolume: 5200, totalReps: 37 }
    }
  });
  expect(result.windows.thirtyDay).toMatchObject({ days: 30, workoutCount: 3 });
  expect(result.families['calf-raise']).toEqual({ workingSets: 3, workingSetVolume: 5200, totalReps: 37 });
  expect(result.derivedDuration).toBe(1800);
  expect(result.warmupIsWorking).toBe(false);
});

test('exercise history uses retrospective definition IDs and never combines same-name records', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  const workouts = analyticsWorkouts();
  workouts.unshift({
    id: 'retrospective-definition', type: 'Push', startedAt: '2026-08-07T09:00:00.000Z', completedAt: '2026-08-07T10:00:00.000Z', prs: 0,
    exercises: [{
      id: 'retrospective-instance-id', definitionId: 'barbell-bench-press', name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell',
      sets: [{ id: 'retrospective-set', weight: 165, reps: 8, warmup: false, completed: true }]
    }]
  });
  workouts.unshift({
    id: 'wrong-id', type: 'Push', startedAt: '2026-08-06T09:00:00.000Z', completedAt: '2026-08-06T10:00:00.000Z', prs: 0,
    exercises: [{
      id: 'synthetic-different-bench', name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell',
      sets: [{ id: 'wrong-set', weight: 500, reps: 10, warmup: false, completed: true }]
    }]
  });

  const result = await page.evaluate(workouts => ({
    canonical: BigGainsAnalytics.exerciseHistory(workouts, 'barbell-bench-press').map(session => session.workoutId),
    synthetic: BigGainsAnalytics.exerciseHistory(workouts, 'synthetic-different-bench').map(session => session.workoutId)
  }), workouts);

  expect(result.canonical).toEqual(['retrospective-definition', 'latest', 'previous', 'older']);
  expect(result.synthetic).toEqual(['wrong-id']);
});

test('active workout shows canonical previous performance and a meaningful improvement delta', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedAndActiveWorkouts');
  await openApp(page);
  const card = page.locator('#activeExercises .active-exercise').first();

  await expect(card.locator('[data-previous-performance="seated-machine-chest-press"]')).toHaveText('100 × 10');
  await expect(card.locator('[data-improvement-delta]')).toHaveCount(0);
  await card.locator('input[data-field="weight"][data-si="1"]').fill('155');
  await card.locator('input[data-field="reps"][data-si="1"]').fill('10');
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await expect(card.locator('[data-improvement-delta="weight"]')).toHaveText('+55 lb');
});

test('completed-workout recap is driven by working analytics and excludes warmups', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  await page.evaluate(() => {
    active.startedAt = new Date(Date.now() - 3_600_000).toISOString();
    const [warmup, first, second] = active.exercises[0].sets;
    Object.assign(warmup, { weight: 45, reps: 10, completed: true });
    Object.assign(first, { weight: 100, reps: 10, completed: true });
    Object.assign(second, { weight: 50, reps: 5, completed: true });
    saveState();
    workoutSessionController.complete();
  });

  await expect(page.locator('#workoutCompletion')).toBeVisible();
  await expect(page.locator('#completionDuration')).toHaveText('60:00');
  await expect(page.locator('#completionWorkingSets')).toHaveText('2');
  await expect(page.locator('#completionVolume')).toHaveText('1,250 lb');
  await expect(page.locator('#completionPrCount')).toHaveText('1');
  const stored = await jorgeState(page);
  expect(stored.workouts[0].sets).toBeUndefined();
  expect(stored.workouts[0].exercises[0].sets).toHaveLength(3);
});

test('historical Jorge schema-v5 workout payloads still normalize and feed analytics unchanged', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);

  const result = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('big-gains-v2'));
    return {
      version: state.version,
      profileId: state.profileId,
      workoutId: state.workouts[0].id,
      exerciseId: state.workouts[0].exercises[0].id,
      setId: state.workouts[0].exercises[0].sets[0].id,
      summary: BigGainsAnalytics.workoutSummary(state.workouts[0]),
      stored
    };
  });

  expect(result).toMatchObject({
    version: 5,
    profileId: 'jorge',
    workoutId: 'completed-push-1',
    exerciseId: 'seated-machine-chest-press',
    setId: 'completed-set-1',
    summary: { workingSetCount: 1, workingSetVolume: 1000, totalReps: 10, durationSeconds: 2700, prCount: 1 }
  });
  expect(result.stored.version).toBe(5);
  expect(result.stored.profileId).toBe('jorge');
});
