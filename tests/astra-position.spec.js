import { test, expect } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp, jorgeState } from './helpers/app.js';
const field=page=>page.locator('input[data-field="weight"][data-ei="1"][data-si="1"]');
async function setup(page){
  await page.setViewportSize({width:390,height:844});
  await installLocalStorageFixture(page,'activeWorkoutWithTwoExercises');await openApp(page);
  await page.getByRole('button',{name:'Expand Lat Pulldown',exact:true}).click();await field(page).fill('95');await field(page).blur();
}
async function visibility(page,value){await page.evaluate(value=>{
  Object.defineProperty(document,'visibilityState',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));
},value);}
async function settled(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));}
test('eligible foreground restores an ID target once without keyboard or training mutation',async({page})=>{
  await setup(page);const before=(await jorgeState(page)).activeWorkout;
  await visibility(page,'hidden');await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await visibility(page,'visible');await settled(page);
  const row=field(page).locator('..').locator('..').locator('..');
  const box=await row.boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y).toBeLessThan(844);
  expect(await field(page).evaluate(e=>document.activeElement===e)).toBe(false);
  expect((await jorgeState(page)).activeWorkout).toEqual(before);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await visibility(page,'visible');await settled(page);expect(await page.evaluate(()=>scrollY)).toBe(0);
});
test('deliberate navigation wins and explicit Resume requests the bookmark',async({page})=>{
  await setup(page);await page.locator('#exitWorkoutMode').click();
  await page.locator('.bottom-nav [data-view="progress"]').click();await visibility(page,'hidden');await visibility(page,'visible');await settled(page);
  await expect(page.locator('body')).toHaveAttribute('data-view','progress');
  await page.locator('#returnToWorkout').click();await settled(page);await expect(page.locator('body')).toHaveAttribute('data-view','train');
  expect((await field(page).boundingBox()).y).toBeLessThan(844);
});
test('cold document restores locally scoped identity and storage is outside workout payload',async({page})=>{
  await setup(page);const before=(await jorgeState(page)).activeWorkout;await visibility(page,'hidden');await page.reload();await expect(field(page)).toBeVisible();await settled(page);
  expect((await field(page).boundingBox()).y).toBeLessThan(844);expect((await jorgeState(page)).activeWorkout).toEqual(before);
  const bookmarks=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('big-gains-train-position-v1:')).map(key=>JSON.parse(localStorage.getItem(key))));
  expect(bookmarks).toHaveLength(1);expect(bookmarks[0].exerciseId).toBe('lat-pulldown');expect(bookmarks[0].setId).toBe('lat-working-1');
});

test('unavailable presentation storage cannot prevent canonical set edits',async({page})=>{
  await page.addInitScript(()=>{const save=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('big-gains-train-position-v1:'))throw new DOMException('Unavailable','QuotaExceededError');return save.call(this,key,value);};});
  await setup(page);await visibility(page,'hidden');await visibility(page,'visible');await settled(page);
  expect((await jorgeState(page)).activeWorkout.exercises[1].sets[1].weight).toBe(95);
});
test('profile switch never borrows the previous owner bookmark',async({page})=>{
  await setup(page);await page.locator('#exitWorkoutMode').click();await page.locator('#profileSelect').selectOption('alexa');
  await expect(page.locator('html')).toHaveAttribute('data-profile','alexa');await visibility(page,'hidden');await visibility(page,'visible');await settled(page);
  await expect(page.locator('#activePanel')).toBeHidden();
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('big-gains-train-position-v1:')&&key.includes('alexa')))).toEqual([]);
});
