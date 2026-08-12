import { expect, test } from '@playwright/test';
import { activeWorkout, blankState, completedWorkout, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const SZW_CLIENT_ID = 'independent-09034233fa064233b85018aec182764d';

async function installIndependentRuntime(page, { clientId = SZW_CLIENT_ID, displayName = 'szw', state } = {}) {
  const profileState = state || { ...blankState(clientId), goals: { primary: 'Strength and consistency' } };
  await page.addInitScript(({ clientId, displayName, profileState }) => {
    const authUserId = '94000000-0000-0000-0000-000000000001';
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent', authUserId,
          cloudAccountId: '94a00000-0000-0000-0000-000000000001',
          cloudProfileId: '94b00000-0000-0000-0000-000000000001',
          clientId, displayName,
          presentation: { petEnabled: false, accent: 'merlot', theme: 'slate-dark' }
        }
      }
    }));
    if (sessionStorage.getItem('routine-prescription-profile') !== clientId) {
      localStorage.setItem('big-gains-cloud-94a00000-0000-0000-0000-000000000001-94b00000-0000-0000-0000-000000000001-v1', JSON.stringify(profileState));
      sessionStorage.setItem('routine-prescription-profile', clientId);
    }
  }, { clientId, displayName, profileState });
}

test('schema-v5 normalization preserves legacy ID arrays and structured prescriptions', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(async () => {
    const source = {
      ...state,
      customRoutines: {
        Push: ['seated-machine-chest-press', 'incline-iso-machine-press'],
        Pull: [
          { exerciseId: 'lat-pulldown', workingSets: 5, targetReps: '6–8' },
          { exerciseId: 'seated-cable-row', workingSets: 4, targetReps: 'Failure' }
        ]
      }
    };
    const normalized = statePersistenceApi.normalizeState(source);
    const imported = statePersistenceApi.validateImport(JSON.parse(statePersistenceApi.prepareExport(normalized).json));
    const records = await BigGainsCloudShadow.localRecords('jorge', normalized);
    return {
      version: normalized.version,
      routines: normalized.customRoutines,
      importRoutines: imported.state.customRoutines,
      issues: BigGainsMigrationPreview.validateLocalState(normalized, 'jorge'),
      cloudRoutine: records.find(record => record.entityType === 'customRoutine' && record.data.name === 'Pull')?.data
    };
  });

  expect(result).toEqual({
    version: 5,
    routines: {
      Push: ['seated-machine-chest-press', 'incline-iso-machine-press'],
      Pull: [
        { exerciseId: 'lat-pulldown', workingSets: 5, targetReps: '6–8' },
        { exerciseId: 'seated-cable-row', workingSets: 4, targetReps: 'Failure' }
      ]
    },
    importRoutines: {
      Push: ['seated-machine-chest-press', 'incline-iso-machine-press'],
      Pull: [
        { exerciseId: 'lat-pulldown', workingSets: 5, targetReps: '6–8' },
        { exerciseId: 'seated-cable-row', workingSets: 4, targetReps: 'Failure' }
      ]
    },
    issues: [],
    cloudRoutine: {
      name: 'Pull',
      exerciseIds: [
        { exerciseId: 'lat-pulldown', workingSets: 5, targetReps: '6–8' },
        { exerciseId: 'seated-cable-row', workingSets: 4, targetReps: 'Failure' }
      ]
    }
  });
});

test('mobile editor adds, removes, reorders, and edits a future prescription only', async ({ page }) => {
  const initialActive = activeWorkout();
  const initialCompleted = completedWorkout();
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'blankJorge');
  await page.addInitScript(({ key, active, completed }) => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.activeWorkout = active;
    saved.workouts = [completed];
    localStorage.setItem(key, JSON.stringify(saved));
  }, { key: STORAGE_KEYS.jorge, active: initialActive, completed: initialCompleted });
  await openApp(page);
  const before = await page.evaluate(() => ({
    activeWorkout: JSON.parse(JSON.stringify(state.activeWorkout)),
    workouts: JSON.parse(JSON.stringify(state.workouts))
  }));
  await page.evaluate(() => window.bigGainsViewShell.showView('library', { workout: false }));
  await page.locator('#editRoutine').click();

  const first = page.locator('[data-routine-index="0"]');
  await first.locator('[data-routine-field="exerciseId"]').selectOption('dumbbell-bench-press');
  await first.locator('[data-routine-field="workingSets"]').fill('5');
  await first.locator('[data-routine-field="targetReps"]').fill('Failure');
  await first.locator('[data-routine-field="targetReps"]').press('Tab');
  await page.locator('[data-routine-move="down"]').first().click();
  await page.locator('[data-routine-remove="5"]').click();
  await page.locator('#routineExerciseSelect').selectOption('barbell-bench-press');
  await page.locator('#addRoutineExercise').click();
  await page.locator('#saveRoutine').click();

  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.activeWorkout).toEqual(before.activeWorkout);
  expect(stored.workouts).toEqual(before.workouts);
  expect(stored.customRoutines.Push).toHaveLength(6);
  expect(stored.customRoutines.Push.slice(0, 2).map(entry => entry.exerciseId)).toEqual([
    'incline-iso-machine-press', 'dumbbell-bench-press'
  ]);
  expect(stored.customRoutines.Push[1]).toEqual({
    exerciseId: 'dumbbell-bench-press', workingSets: 5, targetReps: 'Failure'
  });
  expect(stored.customRoutines.Push.at(-1)).toEqual({
    exerciseId: 'barbell-bench-press', workingSets: 3, targetReps: '8–10'
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('custom loading generates warm-up plus exact working sets and keeps previous reps separate from target', async ({ page }) => {
  const history = completedWorkout({
    exercises: [{
      id: 'seated-machine-chest-press', name: 'Seated Machine Chest Press', muscle: 'Chest', equipment: 'Machine',
      sets: [
        { id: 'old-1', weight: 100, reps: 9, warmup: false, completed: true },
        { id: 'old-2', weight: 105, reps: 7, warmup: false, completed: true }
      ]
    }]
  });
  const customized = {
    ...blankState('jorge'), workouts: [history],
    customRoutines: { Push: [{ exerciseId: 'seated-machine-chest-press', workingSets: 5, targetReps: '12–15' }] }
  };
  await page.addInitScript(({ activeKey, storageKey, customized }) => {
    localStorage.setItem(activeKey, 'jorge');
    localStorage.setItem(storageKey, JSON.stringify(customized));
  }, { activeKey: STORAGE_KEYS.activeProfile, storageKey: STORAGE_KEYS.jorge, customized });
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#dayTabs [data-day="Push"]').click();
  await expect(page.locator('#dayTabs [data-day="Push"]')).toHaveClass(/active/);
  await page.locator('#loadRoutine').click();

  const exercise = (await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.exercises[0];
  expect(exercise.targetReps).toBe('12–15');
  expect(exercise.targetWorkingSets).toBe(5);
  expect(exercise.sets.filter(set => set.warmup)).toHaveLength(1);
  expect(exercise.sets.filter(set => !set.warmup)).toHaveLength(5);
  expect(exercise.sets.filter(set => !set.warmup).slice(0, 2).map(set => [set.weight, set.reps])).toEqual([[100, 9], [105, 7]]);
});

test('SZW routine prescriptions remain independent across routine types and survive reload', async ({ page }) => {
  await installIndependentRuntime(page);
  await openApp(page);
  await page.evaluate(() => {
    state.customRoutines.SzwPush1 = [{ exerciseId: 'barbell-bench-press', workingSets: 4, targetReps: '6–8' }];
    state.customRoutines.SzwPush2 = [{ exerciseId: 'dumbbell-bench-press', workingSets: 2, targetReps: '10–12' }];
    saveState();
  });
  await page.reload();
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();

  const routines = await page.evaluate(async () => {
    const records = await BigGainsCloudShadow.localRecords(PROFILE.id, state);
    const winners = new Map(records.map(record => [BigGainsCloudShadow.keyFor(record.table, record.clientId), record]));
    const recovered = await BigGainsCloudShadow.schemaV5FromCloud({
      profileClientId: PROFILE.id,
      cloud: { ownershipIssues: [], profiles: { [PROFILE.id]: { current: records, winners } } }
    });
    return {
      push1: routineFor('SzwPush1'), prescription1: routinePrescription('SzwPush1', 'barbell-bench-press'),
      push2: routineFor('SzwPush2'), prescription2: routinePrescription('SzwPush2', 'dumbbell-bench-press'),
      stored: state.customRoutines,
      recovered: recovered.state.customRoutines
    };
  });
  expect(routines.push1).toEqual(['barbell-bench-press']);
  expect(routines.prescription1).toEqual({ workingSets: 4, targetReps: '6–8' });
  expect(routines.push2).toEqual(['dumbbell-bench-press']);
  expect(routines.prescription2).toEqual({ workingSets: 2, targetReps: '10–12' });
  expect(routines.stored.SzwPush1).not.toEqual(routines.stored.SzwPush2);
  expect(routines.recovered).toEqual(routines.stored);
});

test('SZW exact config gets #801616 with derived supporting tokens', async ({ page }) => {
  await installIndependentRuntime(page);
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('data-profile-config', SZW_CLIENT_ID);
  const szwTokens = await page.locator('html').evaluate(element => ({
    accent: getComputedStyle(element).getPropertyValue('--accent').trim(),
    border: getComputedStyle(element).getPropertyValue('--accent-border').trim(),
    glow: getComputedStyle(element).getPropertyValue('--accent-glow').trim()
  }));
  expect(szwTokens.accent).toBe('#801616');
  expect(szwTokens.border).toContain('color-mix');
  expect(szwTokens.glow).toContain('color-mix');
});

test('generic independent merlot is not globally redefined by SZW', async ({ page }) => {
  await installIndependentRuntime(page, { clientId: 'independent-generic123', displayName: 'Generic' });
  await openApp(page);
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).getPropertyValue('--accent').trim())).toBe('#bf607b');
});

test('Jorge and Alexa retain their existing presentation tokens and routine editor', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).getPropertyValue('--accent').trim())).not.toBe('#801616');
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#dayTabs [data-day="Push"]').click();
  await page.locator('#editRoutine').click();
  await expect(page.locator('[data-routine-index]')).toHaveCount(6);
  await page.locator('#cancelRoutineDialog').click();
  await Promise.all([page.waitForNavigation(), page.locator('#profileSelect').selectOption('alexa')]);
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();
  await expect(page.locator('html')).toHaveAttribute('data-profile', 'alexa');
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).getPropertyValue('--accent').trim())).toBe('#c85f98');
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#editRoutine').click();
  await expect(page.locator('[data-routine-index]').first()).toBeVisible();
});
