import { expect, test } from '@playwright/test';
import { blankState, installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const set = (id, weight, reps, overrides = {}) => ({ id, weight, reps, warmup: false, completed: true, ...overrides });
const exercise = (id, name, sets, overrides = {}) => ({ id, name, muscle: 'Test', equipment: 'Test', sets, ...overrides });
const workout = (id, completedAt, exercises) => ({ id, type: 'Test', completedAt, durationSeconds: 1800, prs: 0, exercises });

async function analyticsPage(page) {
  await installLocalStorageFixture(page, 'blankJorge', { now: '2026-08-20T12:00:00.000Z' });
  await openApp(page);
}

test('historical bodyweight is deterministic as of workout time and recomputes modeled formulas without rewriting History', async ({ page }) => {
  await analyticsPage(page);
  const result = await page.evaluate(() => {
    const weighted = {
      id: 'weighted', type: 'Pull', completedAt: '2026-08-10T12:00:00.000Z', exercises: [
        { id: 'pull-up', name: 'Pull-Up', sets: [{ id: 'pull', weight: 25, reps: 6, completed: true, warmup: false }] }
      ]
    };
    const assisted = {
      id: 'assisted', type: 'Push', completedAt: '2026-08-10T12:00:00.000Z', exercises: [
        { id: 'assisted-dip', name: 'Assisted Dip', sets: [{ id: 'assist', weight: 200, reps: 5, completed: true, warmup: false }] }
      ]
    };
    const tooEarly = { ...weighted, id: 'too-early', completedAt: '2026-07-01T12:00:00.000Z' };
    const weights = [
      { weight: 999, date: '2026-08-20T12:00:00.000Z' },
      { weight: 185, date: '2026-08-10T08:00:00.000Z' },
      { weight: 180, date: '2026-08-10T08:00:00.000Z' },
      { weight: 170, date: '2026-08-01T08:00:00.000Z' },
      { weight: 0, date: '2026-08-10T10:00:00.000Z' },
      { weight: 500, date: 'invalid' }
    ];
    const options = { weights, measurementFor: bigGainsExerciseCatalog.measurementFor };
    const original = JSON.stringify([weighted, assisted, tooEarly]);
    const weightedSession = BigGainsAnalytics.exerciseHistory([weighted], 'pull-up', options)[0];
    const assistedSession = BigGainsAnalytics.exerciseHistory([assisted], 'assisted-dip', options)[0];
    const unavailable = BigGainsAnalytics.exerciseHistory([tooEarly], 'pull-up', options)[0];
    const futureRemoved = BigGainsAnalytics.exerciseHistory([weighted], 'pull-up', {
      ...options, weights: weights.filter(entry => entry.weight !== 999)
    })[0];
    const edited = BigGainsAnalytics.exerciseHistory([weighted], 'pull-up', {
      ...options, weights: [{ weight: 195, date: '2026-08-10T08:00:00.000Z' }]
    })[0];
    return {
      chosen: BigGainsAnalytics.bodyweightAt(weights, weighted.completedAt),
      weighted: weightedSession.workload,
      weightedEffective: weightedSession.bestWorkingSet.effectiveLoad,
      assisted: assistedSession.workload,
      assistedEffective: assistedSession.bestWorkingSet.effectiveLoad,
      unavailable: unavailable.workload,
      unavailableEstimate: unavailable.bestWorkingSet.estimated1RM,
      futureRemoved: futureRemoved.workload,
      edited: edited.workload,
      profileIsolation: BigGainsAnalytics.exerciseHistory([weighted], 'pull-up', {
        ...options, weights: [{ weight: 120, date: '2026-08-01T08:00:00.000Z' }]
      })[0].workload,
      unchanged: JSON.stringify([weighted, assisted, tooEarly]) === original
    };
  });

  expect(result).toEqual({
    chosen: 185,
    weighted: 1260,
    weightedEffective: 210,
    assisted: 0,
    assistedEffective: 0,
    unavailable: null,
    unavailableEstimate: null,
    futureRemoved: 1260,
    edited: 1320,
    profileIsolation: 870,
    unchanged: true
  });
});

test('family windows retain semantics across mixed workouts, rolling 7D/30D boundaries, edits, and deletes', async ({ page }) => {
  await analyticsPage(page);
  const result = await page.evaluate(() => {
    const s = (id, weight, reps, overrides = {}) => ({ id, weight, reps, completed: true, warmup: false, ...overrides });
    const e = (id, sets) => ({ id, name: id, sets });
    const w = (id, completedAt, exercises) => ({ id, type: 'Test', completedAt, exercises });
    const mixed = w('mixed', '2026-08-18T12:00:00.000Z', [
      e('barbell-bench-press', [s('external', 100, 10), s('warmup', 999, 10, { warmup: true }), s('incomplete', 999, 10, { completed: false })]),
      e('dumbbell-bench-press', [s('per-hand', 20, 10)]),
      e('seated-machine-chest-press', [s('machine', 50, 10)]),
      e('pull-up', [s('weighted-bodyweight', 20, 5)]),
      e('assisted-dip', [s('assisted-floor', 200, 5)]),
      e('push-up', [s('reps-only', 0, 20)]),
      e('plank', [{ id: 'duration', duration: 60, completed: true, warmup: false }]),
      e('farmer-carry', [{ id: 'distance', weight: 80, distance: 40, completed: true, warmup: false }])
    ]);
    const prior = w('prior', '2026-08-12T12:00:00.000Z', [
      e('barbell-bench-press', [s('prior-external', 50, 10)]),
      e('seated-machine-chest-press', [s('prior-machine', 30, 10)]),
      e('pull-up', [s('prior-modeled', 0, 5)])
    ]);
    const thirtyPrevious = w('thirty-previous', '2026-07-10T12:00:00.000Z', [e('barbell-bench-press', [s('old', 20, 10)])]);
    const workouts = [mixed, prior, thirtyPrevious];
    const options = {
      now: '2026-08-20T12:00:00.000Z',
      weights: [{ weight: 180, date: '2026-08-01T08:00:00.000Z' }],
      measurementFor: bigGainsExerciseCatalog.measurementFor
    };
    const seven = BigGainsAnalytics.trainingWorkloadWindows(workouts, { ...options, days: 7 });
    const thirty = BigGainsAnalytics.trainingWorkloadWindows(workouts, { ...options, days: 30 });
    const editedWorkouts = structuredClone(workouts);
    editedWorkouts[0].exercises[0].sets[0].weight = 200;
    const edited = BigGainsAnalytics.trainingWorkloadWindows(editedWorkouts, { ...options, days: 7 });
    const deleted = BigGainsAnalytics.trainingWorkloadWindows(workouts.filter(item => item.id !== 'mixed'), { ...options, days: 7 });
    return {
      seven: seven.families,
      thirty: thirty.families,
      editedExternal: edited.families.external_load.current.total,
      deletedCurrent: deleted.current.families,
      universalTotal: seven.total,
      originalExternal: mixed.exercises[0].sets[0].weight
    };
  });

  expect(result.seven.external_load).toEqual({
    current: { total: 1400, workingSetCount: 2, sessionCount: 1, gapCount: 0, gapSessionCount: 0 },
    previous: { total: 500, workingSetCount: 1, sessionCount: 1, gapCount: 0, gapSessionCount: 0 }
  });
  expect(result.seven.machine_indicated.current).toMatchObject({ total: 500, workingSetCount: 1, sessionCount: 1 });
  expect(result.seven.machine_indicated.previous).toMatchObject({ total: 300, workingSetCount: 1, sessionCount: 1 });
  expect(result.seven.modeled_system_load.current).toMatchObject({ total: 1000, workingSetCount: 2, sessionCount: 1, gapCount: 0 });
  expect(result.seven.modeled_system_load.previous).toMatchObject({ total: 900, workingSetCount: 1, sessionCount: 1, gapCount: 0 });
  expect(result.thirty.external_load.current.total).toBe(1900);
  expect(result.thirty.external_load.previous.total).toBe(200);
  expect(result.thirty.machine_indicated.current.total).toBe(800);
  expect(result.thirty.modeled_system_load.current.total).toBe(1900);
  expect(result.editedExternal).toBe(2400);
  expect(Object.values(result.deletedCurrent)).toEqual([
    { total: 0, workingSetCount: 0, sessionCount: 0, gapCount: 0, gapSessionCount: 0 },
    { total: 0, workingSetCount: 0, sessionCount: 0, gapCount: 0, gapSessionCount: 0 },
    { total: 0, workingSetCount: 0, sessionCount: 0, gapCount: 0, gapSessionCount: 0 }
  ]);
  expect(result.universalTotal).toBeUndefined();
  expect(result.originalExternal).toBe(100);
});

test('exercise workload trends preserve exact identity, machine usefulness, modeled gaps, and edit/delete recomputation', async ({ page }) => {
  await analyticsPage(page);
  const result = await page.evaluate(() => {
    const set = (id, weight, reps) => ({ id, weight, reps, completed: true, warmup: false });
    const performed = (id, definitionId, weight, reps) => ({ id, definitionId, name: definitionId, sets: [set(`${id}-set`, weight, reps)] });
    const sessions = [
      { id: 'new', type: 'Test', completedAt: '2026-08-18T12:00:00.000Z', exercises: [performed('new-machine', 'seated-machine-chest-press', 80, 10), performed('new-pull', 'pull-up', 20, 5), performed('new-pushup', 'push-up', 0, 20)] },
      { id: 'old', type: 'Test', completedAt: '2026-08-10T12:00:00.000Z', exercises: [performed('old-machine', 'seated-machine-chest-press', 70, 10), performed('old-pull', 'pull-up', 0, 5)] },
      { id: 'variant', type: 'Test', completedAt: '2026-08-15T12:00:00.000Z', exercises: [performed('variant-row', 'lat-pulldown', 999, 10)] }
    ];
    const options = { weights: [{ weight: 180, date: '2026-08-12T12:00:00.000Z' }], measurementFor: bigGainsExerciseCatalog.measurementFor };
    const machine = BigGainsAnalytics.exerciseTrend(sessions, 'seated-machine-chest-press', options);
    const pull = BigGainsAnalytics.exerciseTrend(sessions, 'pull-up', options);
    const nonLoad = BigGainsAnalytics.exerciseTrend(sessions, 'push-up', options);
    const editedSessions = structuredClone(sessions);
    editedSessions[0].exercises[0].sets[0].weight = 90;
    const edited = BigGainsAnalytics.exerciseTrend(editedSessions, 'seated-machine-chest-press', options);
    const deleted = BigGainsAnalytics.exerciseTrend(sessions.filter(item => item.id !== 'new'), 'seated-machine-chest-press', options);
    return {
      machineFamily: machine.workloadFamily,
      machinePoints: machine.points.map(point => [point.workoutId, point.workload, point.estimated1RM]),
      pullPoints: pull.points.map(point => [point.workoutId, point.workload]),
      nonLoadFamily: nonLoad.workloadFamily,
      nonLoadPoint: nonLoad.points[0].workload,
      editedLatest: edited.points.at(-1).workload,
      deletedIds: deleted.points.map(point => point.workoutId),
      variantLeak: BigGainsAnalytics.exerciseHistory(sessions, 'seated-machine-chest-press', options).map(item => item.workoutId)
    };
  });

  expect(result.machineFamily).toBe('machine_indicated');
  expect(result.machinePoints).toEqual([['old', 700, null], ['new', 800, null]]);
  expect(result.pullPoints).toEqual([['old', null], ['new', 1000]]);
  expect(result.nonLoadFamily).toBeNull();
  expect(result.nonLoadPoint).toBeNull();
  expect(result.editedLatest).toBe(900);
  expect(result.deletedIds).toEqual(['old']);
  expect(result.variantLeak).toEqual(['new', 'old']);
});

test('Progress renders separate workload families, neutral comparisons, exposure language, and useful chart states on mobile', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge', { now: '2026-08-20T12:00:00.000Z' });
  const state = {
    ...blankState('jorge'),
    workouts: [
      workout('mixed', '2026-08-18T12:00:00.000Z', [
        exercise('barbell-bench-press', 'Barbell Bench Press', [set('bench', 100, 10)], { muscle: 'Chest', equipment: 'Barbell' }),
        exercise('seated-machine-chest-press', 'Seated Machine Chest Press', [set('machine', 50, 10)], { muscle: 'Chest', equipment: 'Machine' }),
        exercise('pull-up', 'Pull-Up', [set('pull', 20, 5)], { muscle: 'Back', equipment: 'Bodyweight' }),
        exercise('push-up', 'Push-Up', [set('pushup', 0, 20)], { muscle: 'Chest', equipment: 'Bodyweight' })
      ]),
      workout('modeled-gap', '2026-08-10T12:00:00.000Z', [
        exercise('pull-up', 'Pull-Up', [set('old-pull', 0, 5)], { muscle: 'Back', equipment: 'Bodyweight' }),
        exercise('barbell-bench-press', 'Barbell Bench Press', [set('old-bench', 50, 10)], { muscle: 'Chest', equipment: 'Barbell' })
      ])
    ],
    weights: [{ weight: 180, date: '2026-08-12T12:00:00.000Z' }]
  };
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEYS.jorge, value: state });
  await openApp(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.bottom-nav [data-view="progress"]').click();

  const workloadCard = page.locator('.progress-training-workload-card');
  await expect(workloadCard).toContainText('Training workload · Last 7 days');
  await expect(workloadCard.locator('.training-workload-row')).toHaveCount(3);
  await expect(workloadCard).toContainText('External-load volume');
  await expect(workloadCard).toContainText('Machine-indicated volume');
  await expect(workloadCard).toContainText('Modeled system-load volume');
  await expect(workloadCard).toContainText('New in this window');
  await expect(workloadCard.locator('[data-workload-family="external_load"]')).toContainText('+500 lb · +100% vs prior');
  await expect(page.locator('.progress-overview-grid')).not.toContainText('Volume');
  await expect(page.locator('.progress-workload-card')).toContainText('Primary working-set exposure');
  await expect(page.locator('.progress-workload-card')).not.toContainText('tonnage');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if (process.env.PROGRESS_WORKLOAD_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.PROGRESS_WORKLOAD_SCREENSHOT_DIR}/progress-workload-mobile.png`, fullPage: true });
  }

  await page.locator('#progressExerciseSelect').selectOption('seated-machine-chest-press');
  await page.locator('#openSelectedProgress').click();
  await expect(page.locator('.progress-workload-chart')).toContainText('Machine-indicated volume trend');
  await expect(page.locator('.progress-chart').filter({ hasText: 'Estimated 1RM trend' })).toHaveCount(0);
  await page.locator('#closeProgressDialog').click();

  await page.locator('#progressExerciseSelect').selectOption('pull-up');
  await page.locator('#openSelectedProgress').click();
  await expect(page.locator('.progress-workload-chart')).toContainText('Modeled system-load volume trend');
  await expect(page.locator('.progress-gap-marker')).toHaveCount(1);
  await expect(page.locator('.progress-chart-gap-note')).toContainText('not zero workload');
  if (process.env.PROGRESS_WORKLOAD_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.PROGRESS_WORKLOAD_SCREENSHOT_DIR}/progress-workload-trend-mobile.png`, fullPage: true });
  }
  await page.locator('#closeProgressDialog').click();

  await page.locator('#progressExerciseSelect').selectOption('push-up');
  await page.locator('#openSelectedProgress').click();
  await expect(page.locator('.progress-chart-empty')).toContainText('No load-volume trend');
  await page.locator('#closeProgressDialog').click();

  await page.evaluate(() => {
    state.weights = [{ weight: 190, date: '2026-08-19T12:00:00.000Z' }];
    saveState();
    renderAll();
  });
  const unavailable = page.locator('[data-workload-family="modeled_system_load"]');
  await expect(unavailable.locator('.training-workload-value > strong')).toHaveText('Unavailable');
  await expect(unavailable.locator('.training-workload-value > strong')).not.toContainText('0 lb');
});
