import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const productionScriptOrder = [
  'profiles.js?v=18',
  'workout-controls.js?v=22',
  'notes.js?v=13',
  'progress.js?v=13',
  'app.js?v=22',
  'full-body.js?v=17',
  'v2-shell.js?v=18',
  'alexa-shell.js?v=18',
  'training-pet.js?v=20',
  'design-v21.js?v=21'
];

test('serves the production document with explicit hook layers loaded before the app', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const loadedOrder = await page.locator('body > script[src]').evaluateAll(scripts =>
    scripts.map(script => script.getAttribute('src'))
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

  const notesSource = await (await request.get('/notes.js?v=13')).text();
  expect(notesSource).not.toMatch(/\b(?:startRestTimer|openHistory)\s*=/);
  expect(notesSource).not.toContain('originalStartRestTimer');
  expect(notesSource).not.toContain('originalOpenHistory');

  const appSource = await (await request.get('/app.js?v=22')).text();
  expect(appSource).toContain('notesApi.startRestTimer');
  expect(appSource).toContain('notesApi.renderHistoryNotes');
});

test('progress exposes explicit hooks without replacing app globals', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);

  expect(await page.evaluate(() => Object.keys(window.workoutProgress))).toEqual([
    'afterActiveRender', 'afterFullRender', 'afterHistoryOpen', 'afterLibraryRender', 'initialize'
  ]);

  const progressSource = await (await request.get('/progress.js?v=13')).text();
  expect(progressSource).not.toMatch(/\b(?:renderLibrary|renderActive|openHistory|renderAll)\s*=/);
  expect(progressSource).not.toContain('originalRender');
  expect(progressSource).not.toContain('MutationObserver');

  const appSource = await (await request.get('/app.js?v=22')).text();
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

  const source = await (await request.get('/workout-controls.js?v=22')).text();
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
