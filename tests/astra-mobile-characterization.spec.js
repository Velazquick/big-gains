import { test, expect } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp, jorgeState } from './helpers/app.js';

for (const width of [375, 390]) test(`Astra ${width}px: record session layout and return paths without cloud data`, async ({ page, context }, testInfo) => {
  await page.setViewportSize({ width, height: 844 });
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await page.addInitScript(() => {
    window.__astraScrollEvidence = [];
    const record = (kind, options) => window.__astraScrollEvidence.push({ kind, options, stack: new Error().stack?.split('\n').slice(1,5) });
    const scrollTo = window.scrollTo.bind(window);
    window.scrollTo = (...args) => { record('window.scrollTo', args); return scrollTo(...args); };
    const scrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (...args) { record(`scrollIntoView:${this.id || this.className}`, args); return scrollIntoView.apply(this,args); };
  });
  await openApp(page);
  await expect(page.locator('#activeExercises .active-exercise')).toHaveCount(2);
  await page.getByRole('button', { name: 'Expand Lat Pulldown', exact: true }).click();
  const input=page.locator('input[data-field="weight"][data-ei="1"][data-si="1"]');
  await input.fill('95');
  await input.blur();
  const before=await jorgeState(page);
  const geometry=await input.boundingBox();
  await testInfo.attach(`train-${width}`,{body:await page.screenshot(),contentType:'image/png'});
  const other=await context.newPage();
  await other.goto('about:blank');await other.bringToFront();await page.bringToFront();await other.close();
  const retained=await input.boundingBox();
  expect((await jorgeState(page)).activeWorkout.exercises).toEqual(before.activeWorkout.exercises);
  const scrollCalls=await page.evaluate(()=>window.__astraScrollEvidence);
  await page.reload();await expect(page.locator('#activeExercises .active-exercise')).toHaveCount(2);
  expect((await jorgeState(page)).activeWorkout.exercises).toEqual(before.activeWorkout.exercises);
  await testInfo.attach('lifecycle-evidence',{body:JSON.stringify({width,geometry,retained,reloaded:await input.boundingBox(),scrollCalls},null,2),contentType:'application/json'});
});
