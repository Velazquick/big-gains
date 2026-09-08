import { openLibraryFromMore } from './helpers/app.js';
import {test,expect} from '@playwright/test';
import {installLocalStorageFixture} from './fixtures/local-storage.js';
import {openApp,jorgeState} from './helpers/app.js';
test('direct picker preserves originating exercise, timing and canonical identities on add and cancel',async({page})=>{
  await page.setViewportSize({width:390,height:844});await installLocalStorageFixture(page,'activeWorkoutWithTwoExercises');await openApp(page);
  await page.getByRole('button',{name:'Expand Lat Pulldown',exact:true}).click();
  const field=page.locator('input[data-field="weight"][data-ei="1"][data-si="1"]');await field.fill('95');await field.blur();
  const before=(await jorgeState(page)).activeWorkout;
  await page.locator('#browseWorkoutLibrary').click();await expect(page.locator('body')).toHaveAttribute('data-view','train');
  await expect(page.locator('#exercisePickerDialog')).toBeVisible();await page.locator('#exercisePickerSearch').fill('Incline Iso Machine Press');
  await page.locator('.exercise-picker-all [data-exercise-picker-select]').filter({hasText:'Incline Iso Machine Press'}).click();
  await expect(page.locator('#exercisePickerDialog')).toBeHidden();
  const after=(await jorgeState(page)).activeWorkout;expect(after.id).toBe(before.id);expect(after.startedAt).toBe(before.startedAt);expect(after.exercises.slice(0,2)).toEqual(before.exercises);expect(after.exercises.at(-1).id).toBe('incline-iso-machine-press');
  await expect(field).toBeInViewport();expect(await field.evaluate(e=>document.activeElement===e)).toBe(false);
  await page.locator('#browseWorkoutLibrary').click();await page.locator('#closeExercisePicker').click();await expect(field).toBeInViewport();expect((await jorgeState(page)).activeWorkout).toEqual(after);
});
for(const [profile,accent] of [['jorge','volt'],['alexa','rose'],['jorge','violet']])test(`inventory and picker ${profile} ${accent}`,async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await installLocalStorageFixture(page,profile==='alexa'?'blankAlexa':'blankJorge');await openApp(page);
  await page.evaluate(accent=>BigGainsAppearance.select(accent),accent);
  await openLibraryFromMore(page);await expect(page.locator('#exerciseSearch')).toBeVisible();
  await page.screenshot({path:info.outputPath(`library-${profile}-${accent}.png`)});
  await page.getByRole('button',{name:'Saved routines',exact:true}).click();await expect(page.locator('#routineSelect')).toBeInViewport();
  await page.locator('#addSelectedExercise').click();await expect(page.locator('#exercisePickerDialog')).toBeVisible();
  const rows=page.locator('.exercise-picker-all .exercise-picker-result');expect(await rows.count()).toBeGreaterThan(0);
  for(const row of (await rows.all()).slice(0,3)){const box=await row.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);}
  await page.screenshot({path:info.outputPath(`picker-${profile}-${accent}.png`)});await page.locator('#closeExercisePicker').click();
});
test('a picker opened for an older workout cannot add into its replacement',async({page})=>{
  await installLocalStorageFixture(page,'activeWorkoutWithTwoExercises');await openApp(page);await page.locator('#browseWorkoutLibrary').click();
  await page.locator('#exercisePickerSearch').fill('Incline Iso Machine Press');
  const replacement=await page.evaluate(()=>workoutSessionController.replace('Pull',{loadRoutine:false,scroll:false}).id);
  await page.locator('.exercise-picker-all [data-exercise-picker-select]').filter({hasText:'Incline Iso Machine Press'}).click();
  const workout=(await jorgeState(page)).activeWorkout;expect(workout.id).toBe(replacement);expect(workout.exercises).toEqual([]);
});
