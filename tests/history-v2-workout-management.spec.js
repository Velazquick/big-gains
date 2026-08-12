import { expect, test } from '@playwright/test';
import { openApp } from './helpers/app.js';
import { blankState, completedWorkout, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';

async function installState(page, value) {
  await page.addInitScript(({ key, state }) => {
    if (localStorage.getItem(key) === null) {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('big-gains-active-profile', 'jorge');
      localStorage.setItem(key, JSON.stringify(state));
    }
  }, { key: STORAGE_KEYS.jorge, state: value });
  await openApp(page);
}

async function openWorkoutDetail(page, workoutId) {
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator(`[data-history-id="${workoutId}"]`).first().click();
  await expect(page.locator('#historyDialog')).toBeVisible();
}

function exercise({ id, definitionId, name, muscle, equipment, sets, note = '' }) {
  return { id, ...(definitionId ? { definitionId } : {}), name, muscle, equipment, note, sets };
}

test('editing a reps typo updates the same workout and derived analytics without rewriting unrelated history', async ({ page }) => {
  const typo = completedWorkout({
    id: 'reps-typo',
    entryMethod: 'retrospective',
    note: 'Paper log retained',
    exercises: [exercise({
      id: 'historical-exercise-id',
      definitionId: 'seated-machine-chest-press',
      name: 'Seated Machine Chest Press',
      muscle: 'Chest',
      equipment: 'Machine',
      note: 'Original exercise note',
      sets: [{ id: 'historical-set-id', weight: 100, reps: 120, warmup: false, completed: true }]
    })]
  });
  const unrelated = completedWorkout({
    id: 'unrelated-workout',
    type: 'Pull',
    completedAt: '2026-08-03T18:30:00.000Z',
    startedAt: '2026-08-03T17:45:00.000Z',
    note: 'unrelated payload sentinel',
    exercises: [exercise({
      id: 'unrelated-exercise', definitionId: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable',
      sets: [{ id: 'unrelated-set', weight: 80, reps: 8, warmup: false, completed: true }]
    })]
  });
  await installState(page, { ...blankState('jorge'), workouts: [typo, unrelated], prs: {} });
  const unrelatedBefore = (await readStoredJson(page, STORAGE_KEYS.jorge)).workouts.find(workout => workout.id === unrelated.id);

  await openWorkoutDetail(page, typo.id);
  await page.locator('#editCompletedWorkout').click();
  await expect(page.locator('#retrospectiveTitle')).toHaveText('Edit workout');
  const expectedCompletionTime = await page.evaluate(completedAt => {
    const date = new Date(completedAt);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }, typo.completedAt);
  await expect(page.locator('#retrospectiveCompletionTime')).toHaveValue(expectedCompletionTime);
  await expect(page.locator('[data-retro-exercise-definition="0"]')).toHaveValue('seated-machine-chest-press');
  await page.locator('[data-retro-field="reps"][data-ei="0"][data-si="0"]').fill('12');
  await page.locator('#saveRetrospectiveWorkout').click();

  await expect(page.locator('#historyDialog')).toBeVisible();
  await expect(page.locator('#historyDialogContent')).toContainText('100 lb × 12');
  await expect(page.locator('#historyDialogContent')).toContainText('1,200 lb');
  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.workouts).toHaveLength(2);
  const updated = stored.workouts.find(workout => workout.id === typo.id);
  expect(updated).toMatchObject({
    id: typo.id,
    entryMethod: 'retrospective',
    startedAt: typo.startedAt,
    completedAt: typo.completedAt,
    durationSeconds: typo.durationSeconds,
    note: typo.note
  });
  expect(updated.exercises[0]).toMatchObject({ id: 'historical-exercise-id', definitionId: 'seated-machine-chest-press', note: 'Original exercise note' });
  expect(updated.exercises[0].sets[0]).toEqual({ id: 'historical-set-id', weight: 100, reps: 12, warmup: false, completed: true });
  expect(stored.workouts.find(workout => workout.id === unrelated.id)).toEqual(unrelatedBefore);
  expect(stored.prs['seated-machine-chest-press']).toMatchObject({ estimated1RM: 140, weight: 100, reps: 12 });
});

test('edit mode preserves effective bodyweight load while supporting set, exercise, order, and type corrections', async ({ page }) => {
  const workout = completedWorkout({
    id: 'bodyweight-edit',
    type: 'Pull',
    prs: 1,
    exercises: [
      exercise({
        id: 'pull-up-record', definitionId: 'pull-up', name: 'Pull-Up', muscle: 'Back', equipment: 'Bodyweight',
        sets: [{ id: 'pull-up-set', weight: 0, reps: 8, warmup: false, completed: true }]
      }),
      exercise({
        id: 'old-row-record', definitionId: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable',
        sets: [{ id: 'old-row-set', weight: 80, reps: 10, warmup: false, completed: true }]
      })
    ]
  });
  await installState(page, { ...blankState('jorge'), workouts: [workout], weights: [{ weight: 200, date: workout.completedAt }], prs: {} });

  await openWorkoutDetail(page, workout.id);
  await page.locator('#editCompletedWorkout').click();
  await page.locator('[data-retro-remove-exercise="1"]').click();
  await page.locator('[data-retro-field="setType"][data-ei="0"][data-si="0"]').selectOption('warmup');
  await page.locator('#saveRetrospectiveWorkout').click();
  await expect(page.locator('#retrospectiveError')).toContainText('at least one working set');
  await page.locator('[data-retro-field="setType"][data-ei="0"][data-si="0"]').selectOption('working');

  await page.locator('[data-retro-add-set="0"]').click();
  await page.locator('[data-retro-field="weight"][data-ei="0"][data-si="1"]').fill('25');
  await page.locator('[data-retro-field="reps"][data-ei="0"][data-si="1"]').fill('6');
  await page.locator('[data-retro-remove-set="0"][data-ei="0"]').click();
  await page.locator('#retrospectiveExerciseSelect').selectOption('lat-pulldown');
  await page.locator('#retrospectiveAddExercise').click();
  await page.locator('[data-retro-exercise-definition="1"]').selectOption('seated-cable-row');
  await page.locator('[data-retro-field="weight"][data-ei="1"][data-si="0"]').fill('90');
  await page.locator('[data-retro-field="reps"][data-ei="1"][data-si="0"]').fill('10');
  await page.locator('#saveRetrospectiveWorkout').click();

  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  const updated = stored.workouts[0];
  expect(updated.id).toBe(workout.id);
  expect(updated.exercises).toHaveLength(2);
  expect(updated.exercises[0]).toMatchObject({ id: 'pull-up-record', definitionId: 'pull-up', name: 'Pull-Up' });
  expect(updated.exercises[0].sets).toEqual([{ id: expect.any(String), weight: 25, reps: 6, warmup: false, completed: true }]);
  expect(updated.exercises[1]).toMatchObject({ definitionId: 'seated-cable-row', name: 'Seated Cable Row', equipment: 'Cable' });
  expect(updated.exercises[1].id).not.toBe('seated-cable-row');
  const analytics = await page.evaluate(workoutId => {
    const workout = state.workouts.find(item => item.id === workoutId);
    return BigGainsAnalytics.workoutSummary(workout, { bodyweight: 200, loadModeFor: BigGainsExerciseCatalog.loadModeFor });
  }, workout.id);
  expect(analytics).toMatchObject({ workingSetCount: 2, workingSetVolume: 2250 });
  expect(stored.prs['pull-up']).toMatchObject({ weight: 25, effectiveLoad: 225, reps: 6 });
});

test('weighted warm-ups and working sets use the same canonical completion validation', async ({ page }) => {
  const workout = completedWorkout({ id: 'set-validation' });
  await installState(page, { ...blankState('jorge'), workouts: [workout] });
  const before = (await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0];
  await openWorkoutDetail(page, workout.id);
  await page.locator('#editCompletedWorkout').click();
  await page.locator('[data-retro-add-set="0"]').click();
  await page.locator('[data-retro-field="setType"][data-ei="0"][data-si="1"]').selectOption('warmup');
  await page.locator('[data-retro-field="weight"][data-ei="0"][data-si="1"]').fill('0');
  await page.locator('#saveRetrospectiveWorkout').click();
  await expect(page.locator('#retrospectiveError')).toContainText('positive external load');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).workouts[0]).toEqual(before);
});

test('delete confirms clearly, removes only the selected workout, and queues its existing schema-v5 tombstone offline', async ({ page }) => {
  const deleted = completedWorkout({ id: 'delete-me', note: 'delete target' });
  const retained = completedWorkout({
    id: 'keep-me', type: 'Pull', completedAt: '2026-08-03T18:30:00.000Z', startedAt: '2026-08-03T17:45:00.000Z',
    note: 'retained payload sentinel',
    exercises: [exercise({
      id: 'keep-exercise', definitionId: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable',
      sets: [{ id: 'keep-set', weight: 90, reps: 10, warmup: false, completed: true }]
    })]
  });
  await installState(page, { ...blankState('jorge'), workouts: [deleted, retained], prs: {} });
  await page.evaluate(async ({ alexaKey, alexa }) => {
    localStorage.setItem(alexaKey, JSON.stringify(alexa));
    const profiles = {};
    for (const profileClientId of BigGainsCloudShadow.profileIds) {
      const local = JSON.parse(localStorage.getItem(bigGainsStatePersistence.storageKeyForProfile(profileClientId)));
      const records = await BigGainsCloudShadow.localRecords(profileClientId, local);
      profiles[profileClientId] = {
        profileId: `cloud-${profileClientId}`,
        records: Object.fromEntries(records.map(record => [BigGainsCloudShadow.keyFor(record.table, record.clientId), {
          table: record.table, entityType: record.entityType, clientId: record.clientId, version: 1,
          updatedAt: '2026-08-05T12:00:00.000Z', fingerprint: record.fingerprint, tombstone: false, data: record.data
        }]))
      };
    }
    localStorage.setItem(bigGainsAccounts.runtime.cloudKeys.catalog, JSON.stringify({
      format: 'big-gains.shadow-catalog.v1', version: 1, accountId: 'offline-account', authUserId: 'offline-user',
      migrationId: 'offline-delete-baseline', adoptedAt: '2026-08-05T12:00:00.000Z', profiles
    }));
  }, { alexaKey: STORAGE_KEYS.alexa, alexa: blankState('alexa') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  const catalogDiagnostic = await page.evaluate(() => ({
    profileIds: BigGainsCloudShadow.profileIds,
    key: bigGainsAccounts.runtime.cloudKeys.catalog,
    catalog: JSON.parse(localStorage.getItem(bigGainsAccounts.runtime.cloudKeys.catalog) || 'null')
  }));
  expect(catalogDiagnostic.catalog).toMatchObject({ format: 'big-gains.shadow-catalog.v1', profiles: { jorge: {}, alexa: {} } });
  const retainedBefore = (await readStoredJson(page, STORAGE_KEYS.jorge)).workouts.find(workout => workout.id === retained.id);

  await openWorkoutDetail(page, deleted.id);
  await page.locator('#requestDeleteCompletedWorkout').click();
  await expect(page.locator('#deleteWorkoutConfirmation')).toBeVisible();
  await expect(page.locator('#deleteWorkoutConfirmationText')).toContainText('every synced device');
  await page.locator('#cancelDeleteCompletedWorkout').click();
  await expect(page.locator('#deleteWorkoutConfirmation')).toBeHidden();
  await page.locator('#requestDeleteCompletedWorkout').click();
  await page.locator('#confirmDeleteCompletedWorkout').click();

  const capture = await page.evaluate(() => BigGainsCloudSync.captureLocalSnapshot('jorge'));
  expect(capture).not.toHaveProperty('reason');
  await expect.poll(() => page.evaluate(workoutId => BigGainsCloudSync.queue.pending().some(operation => operation.entityId === workoutId && operation.mutation === 'delete'), deleted.id)).toBe(true);
  const result = await page.evaluate(workoutId => {
    const catalog = JSON.parse(localStorage.getItem(bigGainsAccounts.runtime.cloudKeys.catalog));
    const key = BigGainsCloudShadow.keyFor('workouts', workoutId);
    return {
      state: JSON.parse(localStorage.getItem(bigGainsStatePersistence.storageKeyForProfile('jorge'))),
      tombstone: catalog.profiles.jorge.records[key],
      operation: BigGainsCloudSync.queue.pending().find(item => item.entityId === workoutId)
    };
  }, deleted.id);
  expect(result.state.workouts).toEqual([retainedBefore]);
  expect(result.state.prs['lat-pulldown']).toMatchObject({ weight: 90, reps: 10 });
  expect(result.tombstone).toMatchObject({ clientId: deleted.id, version: 2, tombstone: true, data: null });
  expect(result.operation).toMatchObject({ entityType: 'workouts', entityId: deleted.id, mutation: 'delete', version: 2 });
  await expect(page.locator(`[data-history-id="${deleted.id}"]`)).toHaveCount(0);
  expect(result.state.workouts[0]).toEqual(retainedBefore);
});
