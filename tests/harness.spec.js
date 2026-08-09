import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const productionScriptOrder = [
  'account-context.js',
  'cloud-config.js',
  'supabase.js',
  'supabase-client.js',
  'cloud-storage.js',
  'state-persistence.js',
  'profiles.js',
  'analytics.js',
  'workout-controls.js',
  'notes.js',
  'progress.js',
  'retrospective-workout.js',
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
  'cloud-shadow.js',
  'managed-profile-recovery.js',
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

test('notes expose explicit hooks without replacing app globals', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  expect(await page.evaluate(() => Object.keys(window.workoutNotes))).toEqual([
    'initialize', 'renderActiveNotes', 'renderHistoryNotes', 'saveCue', 'saveRest',
    'saveSessionNote', 'startRestTimer'
  ]);

  const notesSource = await (await request.get('/notes.js')).text();
  expect(notesSource).not.toMatch(/\b(?:startRestTimer|openHistory)\s*=/);
  expect(notesSource).not.toContain('originalStartRestTimer');
  expect(notesSource).not.toContain('originalOpenHistory');

  const appSource = await (await request.get('/app.js')).text();
  expect(appSource).toContain('notesApi.startRestTimer');
  expect(appSource).toContain('notesApi.renderHistoryNotes');
});

test('progress exposes explicit hooks without replacing app globals', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);

  expect(await page.evaluate(() => Object.keys(window.workoutProgress))).toEqual([
    'afterActiveRender', 'afterFullRender', 'afterHistoryOpen', 'afterLibraryRender', 'initialize'
  ]);

  const progressSource = await (await request.get('/progress.js')).text();
  expect(progressSource).not.toMatch(/\b(?:renderLibrary|renderActive|openHistory|renderAll)\s*=/);
  expect(progressSource).not.toContain('originalRender');
  expect(progressSource).not.toContain('MutationObserver');

  const appSource = await (await request.get('/app.js')).text();
  expect(appSource).toContain('progressApi.afterLibraryRender');
  expect(appSource).toContain('progressApi.afterActiveRender');
  expect(appSource).toContain('progressApi.afterHistoryOpen');
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
