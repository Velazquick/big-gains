import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const productionScriptOrder = [
  'account-context.js',
  'cloud-config.js',
  'supabase.js',
  'supabase-client.js',
  'cloud-storage.js',
  'state-persistence.js',
  'profiles.js',
  'exercise-catalog.js',
  'routine-engine.js',
  'analytics.js',
  'workout-session-controller.js',
  'workout-controls.js',
  'notes.js',
  'timer-controller.js',
  'progress.js',
  'retrospective-workout.js',
  'cloud-shadow.js',
  'managed-profile-recovery.js',
  'app.js',
  'workout-mode.js',
  'v2-shell.js',
  'alexa-shell.js',
  'training-pet.js',
  'design-v21.js',
  'session-selector-v26.js',
  'sync-gateway.js',
  'account-onboarding.js',
  'migration-preview.js',
  'cloud-sync.js',
  'migration-engine.js',
  'controlled-migration.js',
  'shell-init.js'
];

test('serves the production document with explicit hook layers loaded before the app', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const loadedOrder = await page.locator('script[data-big-gains-asset="script"]').evaluateAll(scripts =>
    scripts.map(script => new URL(script.src).pathname.split('/').pop())
  );

  expect(loadedOrder).toEqual(productionScriptOrder);
});

test('ExerciseCatalog owns an immutable static API outside app.js', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const api = await page.evaluate(() => ({
    keys: Object.keys(BigGainsExerciseCatalog),
    frozen: Object.isFrozen(BigGainsExerciseCatalog),
    compatibilitySame: BigGainsExerciseCatalog === window.bigGainsExerciseCatalog,
    exactLookup: BigGainsExerciseCatalog.getById('seated-iso-lateral-bench-press')?.name,
    aliasLookup: BigGainsExerciseCatalog.resolve('Iso-Lateral Chest Press')?.id,
    generatedId: BigGainsExerciseCatalog.idForName('45-Degree Back Extension'),
    missing: BigGainsExerciseCatalog.getById('retrospective-instance-id')
  }));

  expect(api).toEqual({
    keys: ['exercises', 'getById', 'idForName', 'loadModeFor', 'matchesSearch', 'normalizeTerm', 'resolve'],
    frozen: true,
    compatibilitySame: true,
    exactLookup: 'Seated Iso-Lateral Bench Press',
    aliasLookup: 'seated-iso-lateral-bench-press',
    generatedId: '45-degree-back-extension',
    missing: null
  });

  const catalogSource = await (await request.get('/exercise-catalog.js')).text();
  const appSource = await (await request.get('/app.js')).text();
  const selectorSource = await (await request.get('/session-selector-v26.js')).text();
  expect(catalogSource).toContain("Object.defineProperty(scope, 'BigGainsExerciseCatalog'");
  expect(catalogSource).not.toMatch(/\b(?:document|localStorage|sessionStorage|Supabase)\b/);
  expect(appSource).not.toContain('const RAW=');
  expect(appSource).not.toContain('const RAW =');
  expect(appSource).not.toContain('normalizeExerciseTerm');
  expect(appSource).not.toContain('exerciseMatchesSearch');
  expect(selectorSource).toContain('window.BigGainsExerciseCatalog');
  expect(selectorSource).not.toContain('typeof EXERCISES');
});

test('notes expose explicit hooks without replacing app globals', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  expect(await page.evaluate(() => Object.keys(window.workoutNotes))).toEqual([
    'initialize', 'renderActiveNotes', 'renderHistoryNotes', 'saveCue', 'saveRest',
    'saveSessionNote', 'resolveRestDuration'
  ]);

  const notesSource = await (await request.get('/notes.js')).text();
  expect(notesSource).not.toMatch(/\b(?:startRestTimer|openHistory)\s*=/);
  expect(notesSource).not.toContain('restTimerEndsAt');
  expect(notesSource).not.toContain('originalStartRestTimer');
  expect(notesSource).not.toContain('originalOpenHistory');

  const appSource = await (await request.get('/app.js')).text();
  expect(appSource).toContain('notesApi.resolveRestDuration');
  expect(appSource).toContain('notesApi.renderHistoryNotes');
});

test('TimerController owns the runtime behind an immutable API and read-only status snapshots', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  const api = await page.evaluate(() => {
    const status = workoutTimerController.getStatus();
    return {
      factory: Object.keys(BigGainsTimerController),
      instance: Object.keys(workoutTimerController),
      feedback: Object.keys(workoutTimerFeedback),
      frozenFactory: Object.isFrozen(BigGainsTimerController),
      frozenInstance: Object.isFrozen(workoutTimerController),
      frozenStatus: Object.isFrozen(status),
      secondInitialization: workoutTimerController.initialize(),
      statusKeys: Object.keys(status)
    };
  });

  expect(api).toEqual({
    factory: ['create'],
    instance: ['acknowledgeReady', 'deactivate', 'feedback', 'getStatus', 'initialize', 'reconcile', 'renderPreferences', 'selectPreset', 'skip', 'start'],
    feedback: ['armFromGesture', 'verifyFromGesture', 'complete', 'audioAvailable', 'vibrationAvailable', 'getSoundSessionState'],
    frozenFactory: true,
    frozenInstance: true,
    frozenStatus: true,
    secondInitialization: false,
    statusKeys: ['activeWorkoutId', 'deadline', 'feedbackPending', 'identity', 'idleSeconds', 'initialized', 'lastAnnouncedCompletionKey', 'lifecycle', 'oneShotOverrideSeconds', 'remainingSeconds', 'soundSessionState', 'tickerActive']
  });

  const controllerSource = await (await request.get('/timer-controller.js')).text();
  const appSource = await (await request.get('/app.js')).text();
  expect(controllerSource).toContain("Object.defineProperty(scope, 'BigGainsTimerController'");
  expect(controllerSource).toContain('currentState().restTimerEndsAt = null');
  expect(appSource).not.toMatch(/\b(?:timerTicker|timerRemaining|runRestTimer|renderTimer|lastAnnouncedCompletionKey)\b/);

  const livePorts = await page.evaluate(() => {
    let clock = Date.now();
    let liveState = { restTimerEndsAt: clock + 60_000, timerPreferences: { sound: true, vibration: true } };
    let liveActive = { id: 'workout-a', exercises: [] };
    const ticks = [];
    const controller = BigGainsTimerController.create({
      getState: () => liveState,
      getActiveWorkout: () => liveActive,
      persist: () => {},
      resolveRestDuration: () => 150,
      setPetState: () => {},
      getElement: () => null,
      formatTime: seconds => String(seconds),
      now: () => clock,
      scheduleInterval: callback => { ticks.push(callback); return ticks.length; },
      cancelInterval: () => {},
      scheduleTimeout: () => 1,
      cancelTimeout: () => {}
    });
    controller.reconcile();
    const timerATick = ticks[0];
    const statusA = controller.getStatus();
    liveState = { restTimerEndsAt: clock + 90_000, timerPreferences: { sound: true, vibration: true } };
    liveActive = { id: 'workout-b', exercises: [] };
    controller.reconcile();
    const statusB = controller.getStatus();
    return {
      frozenIdentity: Object.isFrozen(statusB.identity),
      staleResult: timerATick(),
      statusA,
      statusB,
      tickCount: ticks.length
    };
  });

  expect(livePorts.statusA.identity).toEqual({ activeWorkoutId: 'workout-a', exactDeadline: livePorts.statusA.deadline });
  expect(livePorts.statusB.identity).toEqual({ activeWorkoutId: 'workout-b', exactDeadline: livePorts.statusB.deadline });
  expect(livePorts.statusB.deadline).toBeGreaterThan(livePorts.statusA.deadline);
  expect(livePorts).toMatchObject({ frozenIdentity: true, staleResult: false, tickCount: 2 });

  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  const legacyV63Deadline = stored.activeWorkout && Number.isFinite(Number(stored.restTimerEndsAt)) && Number(stored.restTimerEndsAt) > 0
    ? Number(stored.restTimerEndsAt)
    : null;
  expect(legacyV63Deadline).toBe(stored.restTimerEndsAt);
  expect(stored).not.toHaveProperty('timerState');
  expect(stored).not.toHaveProperty('timerRemaining');
  expect(stored).not.toHaveProperty('timerGeneration');
});

test('progress exposes explicit hooks without replacing app globals', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);

  expect(await page.evaluate(() => Object.keys(window.workoutProgress))).toEqual([
    'afterActiveRender', 'afterFullRender', 'afterLibraryRender', 'initialize'
  ]);

  const progressSource = await (await request.get('/progress.js')).text();
  expect(progressSource).not.toMatch(/\b(?:renderLibrary|renderActive|openHistory|renderAll)\s*=/);
  expect(progressSource).not.toContain('originalRender');
  expect(progressSource).not.toContain('MutationObserver');

  const appSource = await (await request.get('/app.js')).text();
  expect(appSource).toContain('progressApi.afterLibraryRender');
  expect(appSource).toContain('progressApi.afterActiveRender');
  expect(appSource).not.toContain('progressApi.afterHistoryOpen');
  expect(appSource).toContain('progressApi.afterFullRender');
});

test('workout controls expose explicit hooks without replacing app globals', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  expect(await page.evaluate(() => Object.keys(window.workoutControls))).toEqual([
    'advanceAfterCompletion', 'moveExercise', 'renderActive', 'renderStepper', 'toggleExercise'
  ]);

  const source = await (await request.get('/workout-controls.js')).text();
  expect(source).not.toMatch(/\b(?:stepper|renderActive)\s*=/);

  const storageWrites = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let writes = 0;
    Storage.prototype.setItem = function (...args) {
      writes += 1;
      return original.apply(this, args);
    };
    try {
      window.renderActive();
      return writes;
    } finally {
      Storage.prototype.setItem = original;
    }
  });
  expect(storageWrites).toBe(0);
});

test('shell modules initialize once without duplicate listeners or assets', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'blankJorge', { now: '2026-08-05T12:00:00.000Z' });
  await openApp(page);

  const initialization = await page.evaluate(() => ({
    shell: window.BigGainsShell.initialize(),
    workoutMode: window.bigGainsWorkoutMode.initialize(),
    view: window.bigGainsViewShell.initialize(),
    profile: window.bigGainsProfileShell.initialize(),
    pet: window.trainingPet.initialize(),
    direction: window.bigGainsDirection.initialize(),
    selector: window.sessionSelector.initialize(),
    sync: window.BigGainsSync.initialize(),
    cloudSync: window.BigGainsCloudSync.initialize(),
    migrationPreview: window.BigGainsMigrationPreview.initialize(),
    controlledMigration: window.BigGainsControlledMigration.initialize()
  }));
  expect(initialization).toEqual({
    shell: false,
    workoutMode: false,
    view: false,
    profile: false,
    pet: false,
    direction: false,
    selector: false,
    sync: false,
    cloudSync: false,
    migrationPreview: false,
    controlledMigration: false
  });

  const viewWrites = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let writes = 0;
    Storage.prototype.setItem = function (key, ...args) {
      if (this === sessionStorage && key === 'big-gains-view') writes += 1;
      return original.call(this, key, ...args);
    };
    try {
      document.querySelector('.bottom-nav [data-view="progress"]').click();
      return writes;
    } finally {
      Storage.prototype.setItem = original;
    }
  });
  expect(viewWrites).toBe(1);

  await page.locator('.bottom-nav [data-view="today"]').click();
  await page.locator('#sessionSelectorToggle').click();
  await expect(page.locator('#sessionSelectorToggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#trainingPet').click();
  await expect(page.locator('#trainingPetMessage')).toHaveText('The iron remains suspiciously liftable.');

  expect(await page.locator('#sessionTypeSelector').count()).toBe(1);
  expect(await page.locator('#syncGatewayCard').count()).toBe(1);
  expect(await page.locator('style#syncGatewayStyles').count()).toBe(0);

  const duplicateAssets = await page.locator('[data-big-gains-asset]').evaluateAll(assets => {
    const urls = assets.map(asset => asset.href || asset.src);
    return urls.filter((url, index) => urls.indexOf(url) !== index);
  });
  expect(duplicateAssets).toEqual([]);

  const appSource = await (await request.get('/app.js')).text();
  expect(appSource).not.toContain('dataset.target');
  expect((await request.get('/active-ui.js')).status()).toBe(404);
  expect((await request.get('/full-body.js')).status()).toBe(404);
});
