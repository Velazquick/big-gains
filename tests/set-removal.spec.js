import { expect, test } from '@playwright/test';
import { blankState, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

async function installState(page, value) {
  await page.addInitScript(({ key, state }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('big-gains-active-profile', 'jorge');
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEYS.jorge, state: value });
  await openApp(page);
}

const done = (id, weight, reps, warmup = false) => ({ id, weight, reps, warmup, completed: true });
const completed = (id, completedAt, sets, prs) => ({
  id, type: 'Push', startedAt: completedAt, completedAt, durationSeconds: 1200, prs,
  exercises: [{ id: `exercise-${id}`, definitionId: 'seated-machine-chest-press', name: 'Seated Machine Chest Press', muscle: 'Chest', equipment: 'Machine', targetWorkingSets: 3, sets }]
});

test('retrospective warm-up and working-set removal confirms, recomputes workload and records, and preserves provenance', async ({ page }) => {
  const older = completed('older', '2026-08-01T12:00:00.000Z', [done('old-95', 95, 8)], 1);
  const newer = completed('newer', '2026-08-02T12:00:00.000Z', [
    done('new-warmup', 50, 10, true), done('new-90', 90, 8), done('new-100-record', 100, 8)
  ], 1);
  await installState(page, { ...blankState('jorge'), workouts: [newer, older] });
  const origin = await page.evaluate(() => {
    state.workouts[0].programOrigin = { contractVersion: 1, marker: 'history-provenance' };
    saveState();
    return structuredClone(state.workouts[0].programOrigin);
  });

  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator('[data-history-id="newer"]').first().click();
  await expect(page.locator('.record-chip')).toHaveText('Load record');
  await page.locator('#editCompletedWorkout').click();

  const recordRemove = page.locator('[data-retro-remove-set="2"][data-ei="0"]');
  await recordRemove.click();
  await expect(page.locator('[data-retro-remove-set="2"][data-ei="0"]')).toHaveText('Sure?');
  await page.locator('[data-retro-remove-set="2"][data-ei="0"]').click();
  const warmupRemove = page.locator('[data-retro-remove-set="0"][data-ei="0"]');
  await warmupRemove.click();
  await expect(page.locator('[data-retro-remove-set="0"][data-ei="0"]')).toHaveText('Sure?');
  await page.locator('[data-retro-remove-set="0"][data-ei="0"]').click();
  await page.locator('#saveRetrospectiveWorkout').click();

  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  const edited = stored.workouts.find(workout => workout.id === 'newer');
  const fallback = stored.workouts.find(workout => workout.id === 'older');
  expect(edited.exercises[0].sets).toEqual([done('new-90', 90, 8)]);
  expect(edited.exercises[0].targetWorkingSets).toBe(3);
  expect(edited.programOrigin).toEqual(origin);
  expect(edited.prs).toBe(0);
  expect(fallback.prs).toBe(1);
  await expect(page.locator('#historyDialogContent')).toContainText('720 indicated lb');
  await expect(page.locator('.record-chip')).toHaveCount(0);

  const derived = await page.evaluate(() => {
    const result = BigGainsAnalytics.derivePerformanceRecords(state.workouts, analyticsOptions());
    const exerciseId = BigGainsExerciseCatalog.getById('seated-machine-chest-press').canonicalId;
    const prepared = BigGainsUserDataExport.prepare({
      state,
      profile: { id: PROFILE.id, displayName: ACCOUNT.displayName, presentation: PRESENTATION },
      catalog: BigGainsExerciseCatalog,
      appVersion: BIG_GAINS_ASSET_MANIFEST.release,
      exportedAt: '2026-08-31T12:00:00.000Z'
    });
    return {
      current: result.currentRecordStates[exerciseId].indicatedLoad.observedValue,
      events: result.recordEvents.map(event => event.source.setId),
      exported: JSON.parse(prepared.json.content)
    };
  });
  expect(derived.current).toBe(95);
  expect(derived.events).toEqual(['old-95']);
  const exportedSets = derived.exported.workouts.find(workout => workout.completedAt === newer.completedAt).exercises[0].sets;
  expect(exportedSets).toHaveLength(1);
  expect(exportedSets[0].entered).toMatchObject({ load: 90, reps: 8 });
});

test('active removal remains local-first while offline and survives an offline reload', async ({ page, context }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  try {
    const remove = page.getByRole('button', { name: 'Remove Set 3 of 3' });
    await remove.click();
    await page.getByRole('button', { name: 'Confirm: Remove this set from this workout?' }).click();
    expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[0].sets.filter(set => !set.warmup)).toHaveLength(2);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Remove Set 2 of 2' })).toBeVisible();
    expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[0].sets.filter(set => !set.warmup)).toHaveLength(2);
  } finally {
    await context.setOffline(false);
  }
});
