import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { chooseSession, openApp } from './helpers/app.js';

test('selector and pet behavior survives explicit shell initialization', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  await chooseSession(page, 'Core');
  await expect(page.locator('#sessionPlanChip')).toContainText(/Plan|Today|Recovery/);
  await expect(page.locator('#trainingPet')).toHaveAttribute('data-state', /idle|sleeping/);
  await expect(page.locator('#trainingPetCard')).toHaveAttribute('data-profile', 'jorge');
});

test('Alexa shell and sync snapshot retain their profile behavior', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankAlexa');
  await openApp(page);

  await expect(page.locator('.bottom-nav [data-view="library"]')).toHaveText('Garden');
  await expect(page.locator('#gardenPanel')).toContainText('Consistency garden');
  await expect(page.locator('#trainingPetCard')).toHaveAttribute('data-profile', 'alexa');

  const sync = await page.evaluate(() => ({
    destination: window.BigGainsSync.destination,
    snapshot: window.BigGainsSync.buildSnapshot()
  }));
  expect(sync.destination.path).toBe('big-gains/profiles/alexa/snapshot.json');
  expect(sync.snapshot.schema).toBe('big-gains.snapshot.v1');
  expect(sync.snapshot.profile).toMatchObject({ id: 'alexa', name: 'Alexa' });
  expect(sync.snapshot.summary.completedWorkouts).toBe(0);
});
