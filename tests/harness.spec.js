import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const productionScriptOrder = [
  'profiles.js?v=18',
  'workout-controls.js?v=22',
  'app.js?v=20',
  'full-body.js?v=17',
  'progress.js?v=12',
  'notes.js?v=12',
  'v2-shell.js?v=18',
  'alexa-shell.js?v=18',
  'training-pet.js?v=20',
  'design-v21.js?v=21'
];

test('serves the production document with workout controls loaded before the app', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const loadedOrder = await page.locator('body > script[src]').evaluateAll(scripts =>
    scripts.map(script => script.getAttribute('src'))
  );

  expect(loadedOrder).toEqual(productionScriptOrder);
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
