import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const productionScriptOrder = [
  'profiles.js?v=18',
  'app.js?v=18',
  'full-body.js?v=17',
  'progress.js?v=12',
  'notes.js?v=12',
  'workout-controls.js?v=21',
  'v2-shell.js?v=18',
  'alexa-shell.js?v=18',
  'training-pet.js?v=20',
  'design-v21.js?v=21'
];

test('serves the production document with its declared script order unchanged', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const loadedOrder = await page.locator('body > script[src]').evaluateAll(scripts =>
    scripts.map(script => script.getAttribute('src'))
  );

  expect(loadedOrder).toEqual(productionScriptOrder);
});
