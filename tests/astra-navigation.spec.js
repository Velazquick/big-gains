import {test,expect} from '@playwright/test';
import {installLocalStorageFixture} from './fixtures/local-storage.js';
import {openApp,jorgeState,openLibraryFromMore} from './helpers/app.js';
for(const width of [375,390])test(`Training First navigation and routine priority at ${width}`,async({page},info)=>{
 await page.setViewportSize({width,height:844});await installLocalStorageFixture(page,'blankJorge');await openApp(page);
 await expect(page.locator('.bottom-nav button')).toHaveText(['Today','Plan','Train','Progress','More']);
 await expect(page.locator('.bottom-nav [data-view="train"]')).toHaveCSS('background-color','rgb(216, 255, 62)');
 await expect(page.locator('.today-stage')).toHaveAttribute('data-priority','routine');
 await expect(page.locator('.today-stage > :first-child')).toHaveAttribute('id','sessionTypeSelector');
 await page.screenshot({path:info.outputPath(`today-${width}.png`)});
 const before=await jorgeState(page);await page.locator('.bottom-nav [data-view="train"]').click();expect((await jorgeState(page)).activeWorkout).toEqual(before.activeWorkout);
 await openLibraryFromMore(page);await expect(page.locator('.bottom-nav [data-view="more"]')).toHaveAttribute('aria-current','page');
 await page.locator('.bottom-nav [data-view="progress"]').click();await page.locator('[data-open-history-archive]').first().click();await expect(page.locator('#historyListPanel')).toBeVisible();
 for(const route of ['calendar','history','library','settings']){await page.evaluate(route=>bigGainsViewShell.showView(route),route);await expect(page.locator('body')).toHaveAttribute('data-view',['history','calendar'].includes(route)?'progress':route);}
 expect((await jorgeState(page)).workouts).toEqual(before.workouts);
});
test('Today prioritizes the existing active workout',async({page})=>{
 await installLocalStorageFixture(page,'activeWorkoutWithTwoExercises');await openApp(page);await page.locator('#exitWorkoutMode').click();await page.locator('.bottom-nav [data-view="today"]').click();
 await expect(page.locator('.today-stage')).toHaveAttribute('data-priority','resume');await expect(page.locator('#quickStartSession')).toHaveText('Resume');
 const before=(await jorgeState(page)).activeWorkout;await page.locator('#quickStartSession').click();expect((await jorgeState(page)).activeWorkout.id).toBe(before.id);
});
