import { test, expect } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';
for (const width of [375,390]) test(`Astra readable inactive work and controls at ${width}px`, async ({page})=>{
  await page.setViewportSize({width,height:844});
  await installLocalStorageFixture(page,'activeWorkoutWithTwoExercises');await openApp(page);
  const quiet=page.locator('#activeExercises .active-exercise').nth(1);
  await expect(quiet).toHaveCSS('opacity','1');await expect(quiet).toHaveCSS('filter','none');
  await page.locator('[data-complete-set][data-ei="0"][data-si="1"]').click();
  const targets=page.locator('.active-exercise:not(.is-collapsed) .set-line.completed :is(.set-done,.set-remove,input,button[data-adjust])');
  for(const target of await targets.all()){
    if(!await target.isVisible())continue;
    const box=await target.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
  }
});
