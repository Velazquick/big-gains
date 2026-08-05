import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const productionScriptOrder = [
  'state-persistence.js',
  'profiles.js',
  'workout-controls.js',
  'notes.js',
  'progress.js',
  'app.js',
  'full-body.js',
  'v2-shell.js',
  'alexa-shell.js',
  'training-pet.js',
  'design-v21.js',
  'session-selector-v26.js',
  'sync-gateway.js'
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
