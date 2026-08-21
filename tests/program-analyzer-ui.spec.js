import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';
import { createProgramFixture } from './helpers/program.js';

test('mobile Program Analyzer renders recomputed structural facts and opens linked Goal detail without mutation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const { goalId } = await createProgramFixture(page, { name: 'Analyzer UI Program' });
  await page.evaluate(() => BigGainsProgramSetup.openProgramAnalyzer());

  const panel = page.locator('#programAnalyzerPanel');
  await expect(panel).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'plan');
  await expect(panel).toContainText('Program structure');
  await expect(panel).toContainText('Exercise exposure');
  await expect(panel).toContainText('Goal support');
  await expect(panel).toContainText('Muscle exposure');
  await expect(panel).toContainText('Rep / prescription summary');
  await expect(panel).toContainText('Session spacing');
  await expect(panel).toContainText('Block context');
  await expect(panel).toContainText('Barbell Bench Press');
  await expect(panel).toContainText('2 exposures / cycle · 6 working sets');
  await expect(panel).toContainText('3 sessions apart');
  await expect(panel).toContainText('Chest');
  await expect(panel).toContainText('6 primary sets / cycle');
  await expect(panel).toContainText('Raw normalized targets');
  await expect(panel).not.toContainText(/too much|too little|optimal|imbalanced/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const before = await readStoredJson(page, STORAGE_KEYS.jorge);
  await panel.locator(`[data-program-open-goal="${goalId}"]`).click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'goals');
  await expect(page.locator(`.goal-card[data-goal-id="${goalId}"]`)).toBeVisible();
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after.programCapture).toEqual(before.programCapture);
  expect(after.goals).toEqual(before.goals);
  expect(after.activeWorkout).toEqual(before.activeWorkout);
  expect(after.workouts).toEqual(before.workouts);
});
