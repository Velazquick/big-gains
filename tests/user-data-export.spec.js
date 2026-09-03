import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';
import { createProgramFixture } from './helpers/program.js';

const EXPORTED_AT = '2026-08-31T16:30:00.000Z';

function parseCsv(source) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const text = source.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted && character === '"' && text[index + 1] === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') quoted = !quoted;
    else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  return rows;
}

async function prepareCurrent(page, exportedAt = EXPORTED_AT) {
  return page.evaluate(at => BigGainsUserDataExport.prepare({
    state,
    profile: { id: PROFILE.id, displayName: ACCOUNT.displayName, presentation: PRESENTATION },
    catalog: BigGainsExerciseCatalog,
    appVersion: BIG_GAINS_ASSET_MANIFEST.release,
    exportedAt: at
  }), exportedAt);
}

test('empty current profile exports valid versioned files without mutating state', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(at => {
    const before = JSON.stringify(state);
    const prepared = BigGainsUserDataExport.prepare({
      state,
      profile: { id: PROFILE.id, displayName: 'Jorge', presentation: PRESENTATION },
      catalog: BigGainsExerciseCatalog,
      appVersion: BIG_GAINS_ASSET_MANIFEST.release,
      exportedAt: at
    });
    return { prepared, unchanged: JSON.stringify(state) === before };
  }, EXPORTED_AT);

  const data = JSON.parse(result.prepared.json.content);
  const rows = parseCsv(result.prepared.csv.content);
  expect(result.unchanged).toBe(true);
  expect(result.prepared.csv.filename).toBe('big-gains-jorge-2026-08-31-completed-sets.csv');
  expect(result.prepared.json.filename).toBe('big-gains-jorge-2026-08-31-data.json');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toEqual(await page.evaluate(() => [...BigGainsUserDataExport.CSV_HEADERS]));
  expect(data).toMatchObject({
    format: 'big-gains.user-export.v1',
    version: 1,
    metadata: { exportedAt: EXPORTED_AT, appVersion: 'v104-custom-domain-app', displayName: 'Jorge' },
    workouts: [],
    bodyweight: [],
    routines: [],
    program: { programs: [], versions: [], routineVersions: [], currentPosition: null }
  });
  expect(data.goals.strengthGoals).toEqual([]);
  expect(result.prepared.json.content).not.toMatch(/accountId|profileId|authUserId|cloudAccount|queue|fingerprint|applicationTraces|programOrigin/);
});

test('CSV and JSON preserve every completed raw measurement with readable semantics', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const prepared = await page.evaluate(at => {
    const definition = name => BigGainsExerciseCatalog.resolve(name);
    const exercise = (name, sets, note = '') => {
      const item = definition(name);
      return { id: item.id, name: item.name, equipment: item.equipment, muscle: item.muscle, note, sets };
    };
    const done = (id, values) => ({ id, completed: true, warmup: false, ...values });
    const fixture = {
      ...state,
      workouts: [{
        id: 'measurement-workout', type: 'Complete facts', startedAt: '2026-08-29T14:00:00.000Z', completedAt: '2026-08-29T15:00:00.000Z', durationSeconds: 3600,
        note: 'Comma, quote "yes", and\nnewline — café',
        exercises: [
          exercise('Seated Machine Chest Press', [
            { id: 'machine-warmup', weight: 40, reps: 12, completed: true, warmup: true },
            done('machine-work', { weight: 100, reps: 8, note: 'set "note"' }),
            { id: 'not-performed', weight: 120, reps: 5, completed: false, warmup: false }
          ], 'Machine note'),
          exercise('Pull-Up', [done('weighted', { weight: 25, reps: 6 })]),
          exercise('Assisted Pull-Up', [done('assisted', { weight: 70, reps: 8 })]),
          exercise(BigGainsExerciseCatalog.exercises.find(item => item.measurement.trackingModel === 'reps_only').name, [done('reps-only', { weight: 999, reps: 20 })]),
          exercise('Plank', [done('duration', { weight: 999, reps: 999, duration: 75 })]),
          exercise('Treadmill Run', [done('distance', { weight: 999, reps: 999, distance: 3.1, duration: 1500 })]),
          exercise('Dumbbell Bench Press', [done('per-hand', { weight: 55, reps: 10 })])
        ]
      }]
    };
    return BigGainsUserDataExport.prepare({
      state: fixture,
      profile: { id: 'jorge', displayName: 'Jorge', presentation: PRESENTATION },
      catalog: BigGainsExerciseCatalog,
      appVersion: 'test',
      exportedAt: at
    });
  }, EXPORTED_AT);

  const data = JSON.parse(prepared.json.content);
  const rows = parseCsv(prepared.csv.content);
  const headers = rows[0];
  const objects = rows.slice(1).map(row => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
  const byExercise = name => objects.filter(row => row.Exercise === name);

  expect(objects).toHaveLength(8);
  expect(byExercise('Seated Machine Chest Press').map(row => row['Set type'])).toEqual(['Warm-up', 'Working']);
  expect(byExercise('Seated Machine Chest Press')[1]).toMatchObject({ 'Load entered': '100', 'Load unit': 'lb', 'Load meaning': expect.stringContaining('Machine-indicated load') });
  expect(byExercise('Pull-Up')[0]).toMatchObject({ 'Load entered': '25', 'Load meaning': 'Added load — total', Reps: '6' });
  expect(byExercise('Assisted Pull-Up')[0]).toMatchObject({ 'Load entered': '70', 'Load meaning': 'Assistance — total', Reps: '8' });
  const repsOnly = objects.find(row => row.Measurement === 'Reps only');
  expect(repsOnly).toMatchObject({ 'Load entered': '', 'Load unit': '', Reps: '20' });
  expect(byExercise('Plank')[0]).toMatchObject({ 'Load entered': '', Reps: '', Duration: '75', 'Duration unit': 'sec' });
  expect(byExercise('Treadmill Run')[0]).toMatchObject({ Distance: '3.1', 'Distance unit': 'mi', Duration: '1500' });
  expect(byExercise('Dumbbell Bench Press')[0]['Load meaning']).toContain('per hand');
  expect(prepared.csv.content).toContain('"Comma, quote ""yes"", and\nnewline — café"');
  expect(prepared.csv.content).toContain('"set ""note"""');
  expect(data.workouts[0].exercises.flatMap(item => item.sets)).toHaveLength(8);
  expect(data.workouts[0].exercises.find(item => item.exercise.name === 'Pull-Up').sets[0].entered.load).toBe(25);
  expect(data.workouts[0].exercises.find(item => item.exercise.name === 'Assisted Pull-Up').sets[0].entered.load).toBe(70);
  expect(data.workouts[0].exercises.find(item => item.exercise.name === 'Plank').sets[0].entered.load).toBeNull();
});

test('ordering is deterministic and authoritative history reflects edits while absent workouts stay absent', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const result = await page.evaluate(at => {
    const make = (id, completedAt, name, note) => ({
      id, type: name, startedAt: completedAt, completedAt, durationSeconds: 0, note,
      exercises: [{ id: 'push-up', name: 'Push-Up', equipment: 'Bodyweight', note: 'Élan', sets: [{ id: `${id}-set`, reps: 12, weight: 0, completed: true, warmup: false }] }]
    });
    const fixture = { ...state, workouts: [
      make('newer', '2026-08-30T12:00:00.000Z', 'Newer', 'Retrospective edit is here'),
      make('older', '2026-08-20T12:00:00.000Z', 'Older', 'First')
    ] };
    const options = { state: fixture, profile: { id: 'jorge', displayName: 'Jörgé / Strong', presentation: PRESENTATION }, catalog: BigGainsExerciseCatalog, appVersion: 'test', exportedAt: at };
    const first = BigGainsUserDataExport.prepare(options);
    const second = BigGainsUserDataExport.prepare(options);
    return { first, second };
  }, EXPORTED_AT);

  const data = JSON.parse(result.first.json.content);
  expect(result.first.csv.content).toBe(result.second.csv.content);
  expect(result.first.json.content).toBe(result.second.json.content);
  expect(result.first.csv.filename).toBe('big-gains-jorge-strong-2026-08-31-completed-sets.csv');
  expect(data.workouts.map(workout => workout.name)).toEqual(['Older', 'Newer']);
  expect(data.workouts[1].note).toBe('Retrospective edit is here');
  expect(result.first.json.content).not.toContain('deleted-workout');
  expect(result.first.json.content).toContain('Élan');

  const emailFilename = await page.evaluate(at => BigGainsUserDataExport.prepare({
    state,
    profile: { id: 'jorge', displayName: 'jorge@example.com', presentation: PRESENTATION },
    catalog: BigGainsExerciseCatalog,
    appVersion: 'test',
    exportedAt: at
  }).json.filename, EXPORTED_AT);
  expect(emailFilename).toBe('big-gains-profile-2026-08-31-data.json');
});

test('Goals, custom routines, Program lineage, bodyweight, and preferences stay meaningful without transport internals', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await createProgramFixture(page);
  await page.evaluate(() => {
    state.weights = [{ weight: 217.5, date: '2026-08-28T08:00:00.000Z' }];
    state.customRoutines = { Push: [{ exerciseId: 'barbell-bench-press', workingSets: 4, targetReps: '5–8' }] };
    state.timerPreferences = { sound: false, vibration: true };
    state.exercisePreferences = { 'barbell-bench-press': { cue: 'Pause, then drive', restSeconds: 180 } };
    const goal = state.goals.strengthGoals[0];
    goal.progressionState = { current: {
      decisionId: 'internal-decision', issuedAt: '2026-08-30T12:00:00.000Z', evidenceCutoff: '2026-08-29T12:00:00.000Z',
      exerciseId: goal.exerciseId, enteredLoad: 205, unit: 'lb', loadBasis: 'entered_load', workingSetCount: 3,
      repTargets: [6, 6, 6], decisionCode: 'HOLD', reasonCode: 'ACCUMULATE_EVIDENCE', explanation: 'Repeat clean work.',
      selectedExposureIds: ['internal-exposure'], attainmentState: 'in_progress'
    }, trace: [{ secret: 'engine trace' }] };
    state.programCapture.applicationTraces = [{ secret: 'PE trace' }];
    state.cloudRevision = 'must-not-export';
    saveState();
  });

  const prepared = await prepareCurrent(page);
  const data = JSON.parse(prepared.json.content);
  const serialized = prepared.json.content;
  const scopeIds = await page.evaluate(() => ({ accountId: ACCOUNT.accountId, profileId: PROFILE.id }));

  expect(data.bodyweight).toEqual([{ measuredAt: '2026-08-28T08:00:00.000Z', weight: 217.5, unit: 'lb' }]);
  expect(data.goals.strengthGoals[0]).toMatchObject({
    goalRef: 'goal-1',
    target: { metric: 'one rep max', value: 250, unit: 'lb' },
    currentRecommendation: { enteredLoad: 205, workingSetCount: 3, repTargets: [6, 6, 6], explanation: 'Repeat clean work.' }
  });
  expect(data.routines[0]).toMatchObject({ name: 'Push', prescriptions: [{ workingSets: 4, repTarget: '5–8' }] });
  expect(data.program.programs).toHaveLength(1);
  expect(data.program.versions).toHaveLength(1);
  expect(data.program.routineVersions).toHaveLength(3);
  expect(data.program.versions[0].slots.every(slot => slot.routineRef && slot.routineVersionRef)).toBe(true);
  expect(data.program.versions[0].priorityGoalRefs).toEqual(['goal-1']);
  expect(data.program.currentPosition).toMatchObject({ programRef: 'program-1', programVersionRef: 'program-version-1', nextSlotNumber: 1, completedCycles: 0 });
  expect(data.preferences).toMatchObject({
    timer: { sound: false, vibration: true },
    exercises: [{ cue: 'Pause, then drive', restSeconds: 180 }]
  });
  expect(serialized).not.toContain(scopeIds.accountId);
  expect(serialized).not.toContain(`"profileId"`);
  expect(serialized).not.toMatch(/applicationTraces|engine trace|PE trace|internal-decision|internal-exposure|cloudRevision|must-not-export|fingerprint|idempotency|programOrigin/);
});

test('managed Jorge and Alexa exports are isolated to the selected profile', async ({ page }) => {
  await installLocalStorageFixture(page, ['completedWorkouts', 'blankAlexa'], { activeProfile: 'jorge' });
  await page.addInitScript(({ alexaKey }) => {
    const alexa = JSON.parse(localStorage.getItem(alexaKey));
    alexa.workouts = [{ id: 'alexa-private', type: 'Alexa only', startedAt: '2026-08-01T10:00:00.000Z', completedAt: '2026-08-01T11:00:00.000Z', exercises: [] }];
    localStorage.setItem(alexaKey, JSON.stringify(alexa));
  }, { alexaKey: STORAGE_KEYS.alexa });
  await openApp(page);

  const prepared = await prepareCurrent(page);
  expect(prepared.json.content).toContain('Seated Machine Chest Press');
  expect(prepared.json.content).not.toContain('Alexa only');
  expect(JSON.parse(prepared.json.content).metadata.displayName).toBe('Jorge');
});

test('independent profile export excludes managed local data and rejects mismatched scope', async ({ page }) => {
  const authUserId = '82000000-0000-0000-0000-000000000002';
  const accountId = '82a00000-0000-0000-0000-000000000002';
  const profileId = '82b00000-0000-0000-0000-000000000002';
  const clientId = 'independent-riley';
  const storageKey = `big-gains-cloud-${accountId}-${profileId}-v1`;
  await page.addInitScript(({ authUserId, accountId, profileId, clientId, storageKey }) => {
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1, activeAuthUserId: authUserId,
      accounts: { [authUserId]: { kind: 'independent', authUserId, cloudAccountId: accountId, cloudProfileId: profileId, clientId, displayName: 'Riley', presentation: { petEnabled: false, accent: 'cobalt', theme: 'performance-dark' } } }
    }));
    localStorage.setItem(storageKey, JSON.stringify({
      version: 5, profileId: clientId, goals: { primary: 'Strength' }, weights: [], prs: {}, activeWorkout: null, restTimerEndsAt: null, customRoutines: {}, timerPreferences: { sound: true, vibration: true },
      workouts: [{ id: 'riley-only', type: 'Riley session', startedAt: '2026-08-01T10:00:00.000Z', completedAt: '2026-08-01T11:00:00.000Z', exercises: [] }]
    }));
    localStorage.setItem('big-gains-v2', JSON.stringify({ version: 5, profileId: 'jorge', workouts: [{ id: 'jorge-secret', completedAt: '2026-08-01T11:00:00.000Z', type: 'Secret', exercises: [] }], weights: [] }));
  }, { authUserId, accountId, profileId, clientId, storageKey });
  await openApp(page);

  const result = await page.evaluate(at => {
    const prepared = BigGainsUserDataExport.prepare({ state, profile: { id: PROFILE.id, displayName: ACCOUNT.displayName, presentation: PRESENTATION }, catalog: BigGainsExerciseCatalog, appVersion: 'test', exportedAt: at });
    let mismatch = '';
    try {
      BigGainsUserDataExport.prepare({ state: { ...state, profileId: 'jorge' }, profile: { id: PROFILE.id, displayName: 'Riley' }, catalog: BigGainsExerciseCatalog, appVersion: 'test', exportedAt: at });
    } catch (error) { mismatch = error.message; }
    return { prepared, mismatch, profileId: PROFILE.id };
  }, EXPORTED_AT);

  expect(result.profileId).toBe(clientId);
  expect(result.prepared.json.content).toContain('Riley session');
  expect(result.prepared.json.content).not.toContain('jorge-secret');
  expect(result.mismatch).toContain('matching profile scope');
});

test('fallback sheet downloads each file and leaves storage, cloud, and technical backup unchanged', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined });
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined });
  });
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);
  await page.locator('#openSettings').click();
  const before = await page.evaluate(() => {
    window.__exportNetworkCalls = [];
    const nativeFetch = window.fetch;
    window.fetch = (...args) => { window.__exportNetworkCalls.push(String(args[0])); return nativeFetch(...args); };
    return {
      storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
      backup: statePersistenceApi.prepareExport(state).json
    };
  });

  await expect(page.locator('#settingsPanel')).toContainText('Technical backup & restore');
  await expect(page.locator('#exportData')).toHaveText('Download technical backup');
  await page.locator('#exportMyData').click();
  await expect(page.locator('#userDataExportDialog')).toBeVisible();

  const csvEvent = page.waitForEvent('download');
  await page.locator('#downloadCompletedSets').click();
  const csvDownload = await csvEvent;
  expect(csvDownload.suggestedFilename()).toMatch(/^big-gains-jorge-\d{4}-\d{2}-\d{2}-completed-sets\.csv$/);
  const csv = await readFile(await csvDownload.path(), 'utf8');
  expect(csv).toContain('Seated Machine Chest Press');

  const jsonEvent = page.waitForEvent('download');
  await page.locator('#downloadPersonalData').click();
  const jsonDownload = await jsonEvent;
  const exported = JSON.parse(await readFile(await jsonDownload.path(), 'utf8'));
  expect(exported.format).toBe('big-gains.user-export.v1');

  const after = await page.evaluate(() => ({
    storage: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
    backup: statePersistenceApi.prepareExport(state).json,
    networkCalls: window.__exportNetworkCalls
  }));
  expect(after.storage).toEqual(before.storage);
  expect(after.backup).toBe(before.backup);
  expect(JSON.parse(after.backup).version).toBe(5);
  expect(after.networkCalls).toEqual([]);
});

test('native file share is used only when the browser confirms both files are shareable', async ({ page }) => {
  await page.addInitScript(() => {
    window.__sharedExport = null;
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: data => Array.isArray(data.files) && data.files.length === 2 });
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: async data => {
      window.__sharedExport = { names: data.files.map(file => file.name), types: data.files.map(file => file.type), title: data.title };
    } });
  });
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await page.locator('#openSettings').click();
  await page.locator('#exportMyData').click();

  await expect.poll(() => page.evaluate(() => window.__sharedExport)).not.toBeNull();
  const shared = await page.evaluate(() => window.__sharedExport);
  expect(shared.names).toHaveLength(2);
  expect(shared.names[0]).toMatch(/completed-sets\.csv$/);
  expect(shared.names[1]).toMatch(/data\.json$/);
  expect(shared.types).toEqual(['text/csv', 'application/json']);
  expect(await page.locator('#userDataExportDialog').evaluate(element => element.open)).toBe(false);
});

test('export remains available offline from the precached local app', async ({ page, context }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined });
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: undefined });
  });
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('Big Gains');
  await page.locator('#openSettings').click();
  await page.locator('#exportMyData').click();
  await expect(page.locator('#userDataExportDialog')).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#downloadCompletedSets').click();
  const download = await downloadEvent;
  expect(await readFile(await download.path(), 'utf8')).toContain('Seated Machine Chest Press');
  await context.setOffline(false);
});

test('large realistic history export completes without recursion or long blocking work', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  const result = await page.evaluate(at => {
    const definition = BigGainsExerciseCatalog.resolve('Dumbbell Bench Press');
    const workouts = Array.from({ length: 300 }, (_, workoutIndex) => ({
      id: `large-workout-${workoutIndex}`,
      type: 'Large history',
      startedAt: new Date(Date.UTC(2025, 0, 1 + workoutIndex, 12)).toISOString(),
      completedAt: new Date(Date.UTC(2025, 0, 1 + workoutIndex, 13)).toISOString(),
      durationSeconds: 3600,
      exercises: Array.from({ length: 8 }, (_, exerciseIndex) => ({
        id: definition.id,
        definitionId: definition.id,
        name: definition.name,
        equipment: definition.equipment,
        sets: Array.from({ length: 5 }, (_, setIndex) => ({ id: `s-${workoutIndex}-${exerciseIndex}-${setIndex}`, weight: 50 + setIndex, reps: 8, warmup: setIndex === 0, completed: true }))
      }))
    }));
    const started = performance.now();
    const prepared = BigGainsUserDataExport.prepare({ state: { ...state, workouts }, profile: { id: 'jorge', displayName: 'Jorge', presentation: PRESENTATION }, catalog: BigGainsExerciseCatalog, appVersion: 'test', exportedAt: at });
    return { elapsed: performance.now() - started, rows: prepared.csv.rowCount, jsonLength: prepared.json.content.length };
  }, EXPORTED_AT);

  expect(result.rows).toBe(12_000);
  expect(result.jsonLength).toBeGreaterThan(1_000_000);
  expect(result.elapsed).toBeLessThan(5_000);
});
