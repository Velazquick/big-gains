import { expect, test } from '@playwright/test';
import { blankState, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const set = (id, weight, reps, { warmup = false } = {}) => ({ id, weight, reps, warmup, completed: true });
const NAMES = { 'barbell-bench-press': 'Barbell Bench Press', 'triceps-pushdown': 'Triceps Pushdown', 'rope-pushdown': 'Rope Pushdown', 'pull-up': 'Pull-Up' };
const exercise = (definitionId, sets) => ({ id: definitionId, definitionId, name: NAMES[definitionId] || definitionId, muscle: 'Test', equipment: 'Test', sets });
const workout = (id, completedAt, exercises, prs = 0) => ({
  id, type: 'Other', startedAt: completedAt, completedAt, durationSeconds: 600, exercises, prs
});

async function installState(page, state) {
  await page.addInitScript(({ key, value }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('big-gains-active-profile', 'jorge');
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: STORAGE_KEYS.jorge, value: state });
  await openApp(page);
}

test('Performance Records v1 derives only e1RM and indicated-load families with exact sequential attribution', async ({ page }) => {
  await installState(page, blankState('jorge'));
  const result = await page.evaluate(({ oldest, middle, newest }) => {
    const derived = BigGainsAnalytics.derivePerformanceRecords([newest, middle, oldest]);
    const definition = id => BigGainsExerciseCatalog.getById(id);
    return {
      types: [...new Set(derived.recordEvents.map(event => event.recordType))].sort(),
      events: derived.recordEvents.map(event => ({ workoutId: event.workoutId, setId: event.source.setId, type: event.recordType, value: event.observedValue })),
      counts: derived.workoutRecordCounts,
      bench: derived.currentRecordStates[definition('barbell-bench-press').canonicalId],
      pushdown: derived.currentRecordStates[definition('triceps-pushdown').canonicalId],
      rope: derived.currentRecordStates[definition('rope-pushdown').canonicalId],
      legacyE1rmKeys: Object.keys(derived.records),
      variantIds: [definition('triceps-pushdown').canonicalId, definition('rope-pushdown').canonicalId]
    };
  }, {
    oldest: workout('oldest', '2026-08-01T12:00:00.000Z', [
      exercise('triceps-pushdown', [set('push-warmup', 200, 10, { warmup: true }), set('push-80', 80, 8)]),
      exercise('barbell-bench-press', [set('bench-100', 100, 5)]),
      exercise('rope-pushdown', [set('rope-70', 70, 12)])
    ], 3),
    middle: workout('middle', '2026-08-02T12:00:00.000Z', [
      exercise('triceps-pushdown', [set('push-equal', 80, 12), set('push-lower-more-reps', 75, 20)]),
      exercise('barbell-bench-press', [set('bench-lower', 90, 8)])
    ]),
    newest: workout('newest', '2026-08-03T12:00:00.000Z', [
      exercise('triceps-pushdown', [set('push-85', 85, 5), set('push-90', 90, 1)]),
      exercise('barbell-bench-press', [set('bench-110', 110, 5)])
    ], 3)
  });

  expect(result.types).toEqual(['e1rm', 'indicated_load']);
  expect(result.events).toEqual([
    { workoutId: 'oldest', setId: 'push-80', type: 'indicated_load', value: 80 },
    { workoutId: 'oldest', setId: 'bench-100', type: 'e1rm', value: 117 },
    { workoutId: 'oldest', setId: 'rope-70', type: 'indicated_load', value: 70 },
    { workoutId: 'newest', setId: 'push-85', type: 'indicated_load', value: 85 },
    { workoutId: 'newest', setId: 'push-90', type: 'indicated_load', value: 90 },
    { workoutId: 'newest', setId: 'bench-110', type: 'e1rm', value: 128 }
  ]);
  expect(result.counts).toEqual({ oldest: 3, middle: 0, newest: 3 });
  expect(result.bench.e1rm).toMatchObject({ recordLabel: 'e1RM Record', observedValue: 128 });
  expect(result.bench).not.toHaveProperty('indicatedLoad');
  expect(result.pushdown.indicatedLoad).toMatchObject({ recordLabel: 'Indicated Load Record', observedValue: 90, quality: 'limited_comparison' });
  expect(result.pushdown).not.toHaveProperty('e1rm');
  expect(result.rope.indicatedLoad.observedValue).toBe(70);
  expect(result.variantIds[0]).not.toBe(result.variantIds[1]);
  expect(result.legacyE1rmKeys).toEqual(['barbell-bench-press']);
});

test('bodyweight e1RM uses as-of-session bodyweight and fails closed when it is missing', async ({ page }) => {
  await installState(page, blankState('jorge'));
  const result = await page.evaluate(source => {
    const unavailable = BigGainsAnalytics.derivePerformanceRecords([source], { weights: [{ weight: 200, date: '2026-08-02T00:00:00.000Z' }] });
    const available = BigGainsAnalytics.derivePerformanceRecords([source], { weights: [{ weight: 200, date: '2025-12-31T00:00:00.000Z' }] });
    return {
      unavailableEvents: unavailable.recordEvents,
      availableEvents: available.recordEvents.map(event => ({ type: event.recordType, value: event.observedValue, quality: event.quality }))
    };
  }, workout('pullup', '2026-01-01T12:00:00.000Z', [exercise('pull-up', [set('pullup-set', 25, 6)])]));

  expect(result.unavailableEvents).toEqual([]);
  expect(result.availableEvents).toEqual([{ type: 'e1rm', value: 270, quality: 'modeled' }]);
});

test('retrospective edit and delete deterministically reattribute events and fall current state back', async ({ page }) => {
  await installState(page, blankState('jorge'));
  const result = await page.evaluate(({ oldWorkout, newWorkout }) => {
    const id = BigGainsExerciseCatalog.getById('barbell-bench-press').canonicalId;
    const initial = BigGainsAnalytics.derivePerformanceRecords([newWorkout, oldWorkout]);
    const withoutNewSet = BigGainsAnalytics.derivePerformanceRecords([{ ...newWorkout, exercises: [] }, oldWorkout]);
    const editedOld = structuredClone(oldWorkout);
    editedOld.exercises[0].sets[0].weight = 120;
    const afterEarlierEdit = BigGainsAnalytics.derivePerformanceRecords([newWorkout, editedOld]);
    const afterDelete = BigGainsAnalytics.derivePerformanceRecords([newWorkout]);
    return {
      initial: initial.recordEvents.map(event => event.source.setId),
      fallback: withoutNewSet.currentRecordStates[id].e1rm.observedValue,
      afterEarlierEdit: afterEarlierEdit.recordEvents.map(event => ({ setId: event.source.setId, value: event.observedValue })),
      afterDelete: afterDelete.currentRecordStates[id].e1rm.observedValue
    };
  }, {
    oldWorkout: workout('old', '2026-08-01T12:00:00.000Z', [exercise('barbell-bench-press', [set('old-set', 100, 5)])]),
    newWorkout: workout('new', '2026-08-02T12:00:00.000Z', [exercise('barbell-bench-press', [set('new-set', 110, 5)])])
  });

  expect(result.initial).toEqual(['old-set', 'new-set']);
  expect(result.fallback).toBe(117);
  expect(result.afterEarlierEdit).toEqual([{ setId: 'old-set', value: 140 }]);
  expect(result.afterDelete).toBe(128);
});

test('History distinguishes workout BEST from exact typed Record Events and Progress explains indicated-load limits', async ({ page }) => {
  const state = {
    ...blankState('jorge'),
    workouts: [
      workout('new-load', '2026-08-03T12:00:00.000Z', [exercise('triceps-pushdown', [set('load-85', 85, 8)])], 1),
      workout('lower-bench', '2026-08-02T12:00:00.000Z', [exercise('barbell-bench-press', [set('bench-90', 90, 8)])], 0),
      workout('old-bench', '2026-08-01T12:00:00.000Z', [exercise('barbell-bench-press', [set('bench-100', 100, 5)])], 1)
    ]
  };
  await installState(page, state);

  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator('#history [data-history-id="lower-bench"]').click();
  await expect(page.locator('.best-chip')).toHaveText('BEST');
  await expect(page.locator('.record-chip')).toHaveCount(0);
  await page.locator('#closeHistoryDialog').click();
  await page.locator('#history [data-history-id="new-load"]').click();
  await expect(page.locator('.record-chip')).toHaveText('Load record');
  await expect(page.locator('.history-record-list')).toContainText('Triceps Pushdown');
  await page.locator('#closeHistoryDialog').click();

  await page.locator('#progressExerciseSelect').selectOption('triceps-pushdown');
  await expect(page.locator('#progressPreview')).toContainText('Indicated Load Record');
  await expect(page.locator('#progressPreview')).toContainText('85 lb');
  await expect(page.locator('#progressPreview')).toContainText('machine setups may differ');
});
