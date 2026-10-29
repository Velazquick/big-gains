import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  blankState,
  completedWorkout,
  activeWorkout,
  installLocalStorageFixture,
  localStorageFixtures,
  readStoredJson,
  STORAGE_KEYS
} from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

async function switchProfile(page, profileId) {
  await Promise.all([
    page.waitForNavigation(),
    page.locator('#profileSelect').selectOption(profileId)
  ]);
  await expect(page.locator('#profileSelect')).toHaveValue(profileId);
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();
}

test('missing optional notes preferences do not cause a startup write and normalize only on an explicit save', async ({ page }) => {
  const value=blankState('jorge');
  delete value.exercisePreferences;
  value.workouts=[completedWorkout()];
  value.workouts[0].exercises[0].collapsed=true;
  const original=JSON.stringify(value);
  await page.addInitScript(({key,original})=>{if(!localStorage.getItem('__optional_pref_seed')){localStorage.setItem('big-gains-active-profile','jorge');localStorage.setItem(key,original);localStorage.setItem('__optional_pref_seed','1');}}, {key:STORAGE_KEYS.jorge,original});
  await openApp(page);
  expect(await page.evaluate(key=>localStorage.getItem(key),STORAGE_KEYS.jorge)).toBe(original);
  await page.evaluate(()=>saveState());
  const saved=await readStoredJson(page,STORAGE_KEYS.jorge);
  expect(saved.exercisePreferences).toEqual({});
  const {exercisePreferences,...facts}=saved;
  expect(facts).toEqual(value);
});

test('loads, normalizes, and saves a profile through the persistence API', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);

  const roundTrip = await page.evaluate(() => {
    const normalized = JSON.stringify(state);
    statePersistenceApi.save(state, active);
    const reloaded = statePersistenceApi.load();
    return {
      normalized,
      reloaded: JSON.stringify(reloaded),
      profileId: statePersistenceApi.profileId,
      storageKey: statePersistenceApi.storageKey,
      api: {
        blankState: typeof statePersistenceApi.blankState,
        normalizeState: typeof statePersistenceApi.normalizeState,
        load: typeof statePersistenceApi.load,
        save: typeof statePersistenceApi.save,
        prepareExport: typeof statePersistenceApi.prepareExport,
        validateImport: typeof statePersistenceApi.validateImport,
        migration: typeof statePersistenceApi.migrations.legacyV1
      }
    };
  });

  expect(roundTrip.reloaded).toBe(roundTrip.normalized);
  expect(roundTrip.profileId).toBe('jorge');
  expect(roundTrip.storageKey).toBe(STORAGE_KEYS.jorge);
  expect(Object.values(roundTrip.api)).toEqual(Array(7).fill('function'));
  expect(await readStoredJson(page, STORAGE_KEYS.jorge)).toEqual(JSON.parse(roundTrip.normalized));
});

test('normalizes historical schema markers to version 5 in memory', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const versions = await page.evaluate(() => [2, 3, 4].map(version => (
    statePersistenceApi.normalizeState({ ...state, version }).version
  )));

  expect(versions).toEqual([5, 5, 5]);
});

test('keeps Jorge and Alexa localStorage isolated', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);

  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator('#bodyweight').fill('210');
  await page.locator('#weightForm button[type="submit"]').click();
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).weights[0].weight).toBe(210);
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).weights).toHaveLength(0);

  await switchProfile(page, 'alexa');
  await expect(page.locator('#latestWeight')).toHaveText('—');
  await page.locator('#bodyweight').fill('225');
  await page.locator('#weightForm button[type="submit"]').click();
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).weights[0].weight).toBe(225);

  await switchProfile(page, 'jorge');
  await expect(page.locator('#latestWeight')).toHaveText('210 lb');
  const jorge = await readStoredJson(page, STORAGE_KEYS.jorge);
  const alexa = await readStoredJson(page, STORAGE_KEYS.alexa);
  expect(jorge.profileId).toBe('jorge');
  expect(jorge.weights.map(entry => entry.weight)).toEqual([210]);
  expect(alexa.profileId).toBe('alexa');
  expect(alexa.weights.map(entry => entry.weight)).toEqual([225]);
});

test('rejects a cross-profile import without modifying either profile', async ({ page }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);
  await page.locator('.bottom-nav [data-view="more"]').click();
  await page.locator('#openSettings').click();
  const jorgeBefore = await readStoredJson(page, STORAGE_KEYS.jorge);
  const alexaBefore = await readStoredJson(page, STORAGE_KEYS.alexa);

  const alexaBackup = {
    ...blankState('alexa'),
    goals: { primary: 'Alexa imported goal' },
    weights: [{ weight: 224, date: '2026-08-01T12:00:00.000Z' }],
    workouts: [completedWorkout({ id: 'alexa-imported-workout', type: 'FullBody' })]
  };

  const dialogPromise = page.waitForEvent('dialog');
  await page.locator('#importData').setInputFiles({
    name: 'alexa-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(alexaBackup))
  });
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe('This backup belongs to Alexa, not Jorge. Switch profiles before restoring it.');
  await dialog.accept();

  expect(await readStoredJson(page, STORAGE_KEYS.jorge)).toEqual(jorgeBefore);
  expect(await readStoredJson(page, STORAGE_KEYS.alexa)).toEqual(alexaBefore);
});

test('exports the existing backup format and restores it without schema changes', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);
  await page.locator('.bottom-nav [data-view="more"]').click();
  await page.locator('#openSettings').click();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportData').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const exported = JSON.parse(await readFile(downloadPath, 'utf8'));

  expect(download.suggestedFilename()).toMatch(/^big-gains-backup-\d{4}-\d{2}-\d{2}\.json$/);
  expect(exported).toMatchObject({
    version: 5,
    profileId: 'jorge',
    workouts: [{ id: 'completed-push-1' }],
    weights: [{ weight: 218.4 }],
    activeWorkout: null,
    restTimerEndsAt: null
  });

  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator('#bodyweight').fill('211');
  await page.locator('#weightForm button[type="submit"]').click();
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).weights[0].weight).toBe(211);

  await page.locator('.bottom-nav [data-view="more"]').click();
  await page.locator('#openSettings').click();
  const dialogPromise = page.waitForEvent('dialog');
  await page.locator('#importData').setInputFiles(downloadPath);
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe('Backup restored for Jorge.');
  await dialog.accept();

  expect(await readStoredJson(page, STORAGE_KEYS.jorge)).toEqual(exported);
});

test('same-profile imports replace live timer ports without retaining the prior state or session', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  const timerA = await page.evaluate(() => workoutTimerController.getStatus());
  await page.locator('#exitWorkoutMode').click();
  await page.locator('.bottom-nav [data-view="more"]').click();
  await page.locator('#openSettings').click();

  const importedDeadline = Date.now() + 120_000;
  const imported = {
    ...blankState('jorge'),
    exercisePreferences: {},
    activeWorkout: activeWorkout({ id: 'imported-active-workout' }),
    restTimerEndsAt: importedDeadline
  };
  let dialogPromise = page.waitForEvent('dialog');
  await page.locator('#importData').setInputFiles({
    name: 'jorge-active-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(imported))
  });
  let dialog = await dialogPromise;
  expect(dialog.message()).toBe('Backup restored for Jorge.');
  await dialog.accept();

  const timerB = await page.evaluate(() => workoutTimerController.getStatus());
  expect(timerB.identity).toEqual({ activeWorkoutId: 'imported-active-workout', exactDeadline: importedDeadline });
  expect(timerB.identity).not.toEqual(timerA.identity);
  expect(timerB.lifecycle).toBe('running');

  dialogPromise = page.waitForEvent('dialog');
  await page.locator('#importData').setInputFiles({
    name: 'jorge-blank-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(blankState('jorge')))
  });
  dialog = await dialogPromise;
  expect(dialog.message()).toBe('Backup restored for Jorge.');
  await dialog.accept();

  const cleared = await page.evaluate(() => workoutTimerController.getStatus());
  expect(cleared).toMatchObject({ activeWorkoutId: null, deadline: null, lifecycle: 'unavailable', tickerActive: false });
  await expect(page.locator('#timerCard')).toBeHidden();
});

test('renders completed workout history from persisted state', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);
  await page.locator('.bottom-nav [data-view="progress"]').click();

  await expect(page.locator('#history .history-item')).toHaveCount(1);
  await expect(page.locator('#history .history-item')).toContainText('Push');
  await expect(page.locator('#trainingVolume [data-workload-family="machine_indicated"] strong')).toHaveText('1,000 lb');
  await expect(page.locator('#latestWeight')).toHaveText('218.4 lb');
});

test('protects malformed current-profile bytes while normalizing a recovery preview', async ({ page }) => {
  await installLocalStorageFixture(page, 'malformedButParseableState');
  await page.goto('/');
  await page.waitForFunction(() => window.BigGainsAppRuntime?.initialized);
  const original = await page.evaluate(() => localStorage.getItem(statePersistenceApi.storageKey));

  const normalized = await page.evaluate(() => ({
    workouts: Array.isArray(state.workouts),
    weights: Array.isArray(state.weights),
    prs: Boolean(state.prs) && !Array.isArray(state.prs) && typeof state.prs === 'object',
    prCount: Object.keys(state.prs).length,
    activeWorkout: state.activeWorkout,
    customRoutines: state.customRoutines,
    goals: state.goals,
    restTimerEndsAt: state.restTimerEndsAt
  }));

  expect(normalized).toEqual({
    workouts: true,
    weights: true,
    prs: true,
    prCount: 0,
    activeWorkout: null,
    customRoutines: { Pull: ['lat-pulldown'] },
    goals: { primary: 'Strength and performance' },
    restTimerEndsAt: null
  });
  await expect(page.locator('#bootShellDetail')).toContainText('original data is unchanged');
  await expect(page.locator('#downloadRecoveryData')).toBeVisible();
  await expect(page.locator('.app-shell')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.evaluate(() => BigGainsBootGate.status().state)).toBe('recovery');
  expect(await page.evaluate(() => {
    try { statePersistenceApi.save(state, active); return null; } catch (error) { return error.code; }
  })).toBe('local-state-unreadable');
  expect(await page.evaluate(() => localStorage.getItem(statePersistenceApi.storageKey))).toBe(original);
});

test('persists pending state on pagehide and when the page becomes hidden', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  await page.evaluate(() => {
    state.weights.unshift({ weight: 207, date: '2026-08-05T13:00:00.000Z' });
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
  });
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).weights[0].weight).toBe(207);

  await page.evaluate(() => {
    state.weights.unshift({ weight: 206, date: '2026-08-05T14:00:00.000Z' });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).weights.map(entry => entry.weight)).toEqual([206, 207]);
});

test('routes profile storage reads and writes through the explicit API', async ({ page }) => {
  await page.addInitScript(({ activeProfileKey, jorgeKey, state }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(activeProfileKey, 'jorge');
    localStorage.setItem(jorgeKey, JSON.stringify(state));
    window.__profileStorageCalls = [];
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function getItem(key) {
      window.__profileStorageCalls.push({ method: 'getItem', key, stack: new Error().stack });
      return originalGetItem.call(this, key);
    };
    Storage.prototype.setItem = function setItem(key, value) {
      window.__profileStorageCalls.push({ method: 'setItem', key, stack: new Error().stack });
      return originalSetItem.call(this, key, value);
    };
  }, { activeProfileKey: STORAGE_KEYS.activeProfile, jorgeKey: STORAGE_KEYS.jorge, state: blankState('jorge') });
  await openApp(page);

  const evidence = await page.evaluate(async keys => {
    statePersistenceApi.save(state, active);
    const appSource = await (await fetch('/app.js')).text();
    const profilesSource = await (await fetch('/profiles.js')).text();
    const calls = window.__profileStorageCalls.filter(call => keys.includes(call.key));
    return {
      calls,
      appOwnsStorage: appSource.includes('localStorage'),
      profilesOwnsStorage: profilesSource.includes('localStorage'),
      ownedKeys: window.bigGainsStatePersistence.storageKeys
    };
  }, Object.values(STORAGE_KEYS));

  expect(evidence.appOwnsStorage).toBe(false);
  expect(evidence.profilesOwnsStorage).toBe(false);
  expect(evidence.ownedKeys).toEqual(STORAGE_KEYS);
  expect(evidence.calls.some(call => call.method === 'getItem' && call.key === STORAGE_KEYS.jorge)).toBe(true);
  expect(evidence.calls.some(call => call.method === 'setItem' && call.key === STORAGE_KEYS.jorge)).toBe(true);
  expect(evidence.calls.filter(call => call.method === 'setItem').every(call => call.stack.includes('state-persistence.js'))).toBe(true);
  expect(evidence.calls.filter(call => call.method === 'getItem').every(call => (
    call.stack.includes('state-persistence.js') || call.stack.includes('account-context.js')
  ))).toBe(true);
});

test('rendering stateful views does not write persistence', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);

  const writes = await page.evaluate(() => {
    let count = 0;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(...args) {
      count += 1;
      return originalSetItem.apply(this, args);
    };
    renderHero();
    renderLibrary();
    renderHistory();
    renderWeights();
    renderAll();
    return count;
  });

  expect(writes).toBe(0);
});

test('migrates valid legacy weights once and retains unsupported workouts in the untouched legacy payload', async ({ page }) => {
  await installLocalStorageFixture(page, 'legacyState');
  await openApp(page);
  await page.locator('.bottom-nav [data-view="progress"]').click();

  const expectedLegacyRaw = JSON.stringify(localStorageFixtures.legacyState.values[STORAGE_KEYS.legacy]);
  const migrationResult = await page.evaluate(keys => {
    const firstLoad = statePersistenceApi.load();
    const storedAfterFirstLoad = localStorage.getItem(keys.jorge);
    const secondLoad = statePersistenceApi.load();
    return {
      firstLoad,
      secondLoad,
      storedAfterFirstLoad,
      storedAfterSecondLoad: localStorage.getItem(keys.jorge),
      legacyRaw: localStorage.getItem(keys.legacy)
    };
  }, STORAGE_KEYS);

  expect(migrationResult.firstLoad).toMatchObject({
    version: 5,
    profileId: 'jorge',
    weights: [{ weight: 220, date: '2026-07-28T12:00:00.000Z' }],
    workouts: []
  });
  expect(migrationResult.secondLoad).toEqual(migrationResult.firstLoad);
  expect(migrationResult.storedAfterSecondLoad).toBe(migrationResult.storedAfterFirstLoad);
  expect(migrationResult.legacyRaw).toBe(expectedLegacyRaw);
  await expect(page.locator('#latestWeight')).toHaveText('220 lb');
  await expect(page.locator('#history')).toHaveText('Your completed workouts will appear here.');
});
