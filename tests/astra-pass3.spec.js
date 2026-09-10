import {test,expect} from '@playwright/test';
import {blankState,installLocalStorageFixture} from './fixtures/local-storage.js';
import {openApp,jorgeState} from './helpers/app.js';
const id='seated-machine-chest-press';
async function seed(page,{unit='lb',profile='jorge'}={}) {
 await installLocalStorageFixture(page,'blankJorge');
 await page.addInitScript(({unit,profile,blank})=>{
  if(localStorage.getItem('pass3-seeded'))return;
  const sets=count=>Array.from({length:count},(_,i)=>({id:`s${i}`,weight:100,reps:10,completed:true,warmup:false}));
  const workouts=[4,3].map((count,i)=>({id:`w${i}`,type:'Push',completedAt:`2026-08-0${4-i}T12:00:00Z`,durationSeconds:600,exercises:[{id:'barbell-bench-press',name:'Barbell Bench Press',sets:sets(1)},{id:'seated-machine-chest-press',name:'Seated Machine Chest Press',muscle:'Chest',equipment:'Machine',sets:sets(count)}]}));
  localStorage.setItem('big-gains-v2',JSON.stringify({...blank,workouts,unitPreferences:{contractVersion:1,weightUnit:unit}}));
  localStorage.setItem('big-gains-alexa-v1',JSON.stringify({...blank,profileId:'alexa',workouts:[],weights:[]}));
  localStorage.setItem('big-gains-active-profile',profile);localStorage.setItem('pass3-seeded','1');
 },{unit,profile,blank:blankState('jorge')});
 await openApp(page);
}
for(const width of [375,390])for(const unit of ['lb','kg'])test(`Pass 3 workload to exact exercise and History ${width} ${unit}`,async({page},info)=>{
 await page.setViewportSize({width,height:844});await seed(page,{unit});
 const before=await jorgeState(page);
 await expect(page.locator('#trainingVolume [data-workload-family="machine_indicated"] strong')).toHaveText(unit==='lb'?'7,000 lb':'3,175 kg');
 await expect(page.locator('#trainingVolume [data-workload-family="external_load"] strong')).toHaveText(unit==='lb'?'2,000 lb':'907 kg');
 const metric=page.locator('[data-today-progress-exercise]');await expect(metric).toContainText('↑ Workload +33.3% vs previous');
 await expect(metric.locator('.movement-value')).toHaveText(unit==='lb'?'4,000 lb':'1,814 kg');
 await expect(metric.locator('circle')).toHaveCount(2);
 await metric.scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`today-${width}-${unit}.png`)});
 const canonical=await metric.getAttribute('data-today-progress-exercise');await metric.click();
 await expect(page.locator('body')).toHaveAttribute('data-view','progress');await expect(page.locator('#progressDialog')).toHaveAttribute('data-exercise-id',canonical);
 await expect(page.locator('#progressDialogTitle')).toHaveText('Seated Machine Chest Press');
 const bounds=await page.locator('#progressDialog').boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThanOrEqual(844);
 await expect(page.locator('.exercise-workload-read')).toContainText('+33.3%');
 await page.screenshot({path:info.outputPath(`exercise-overview-${width}-${unit}.png`)});
 await page.locator('.progress-session details summary').first().click();await expect(page.locator('.progress-session details').first().locator('li')).toHaveCount(4);
 await page.screenshot({path:info.outputPath(`exercise-${width}-${unit}.png`)});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-workload-history]').first().click();await expect(page.locator('#historyDialog')).toBeVisible();
 await expect(page.locator('.session-workload-detail [data-workload-family]')).toHaveCount(2);
 expect((await jorgeState(page)).workouts).toEqual(before.workouts);
});
test('More owns Settings, all five nav destinations have one selected state',async({page})=>{
 await seed(page);
 await expect(page.locator('.topbar #openSettings')).toHaveCount(0);
 for(const view of ['today','plan','train','progress','more']){
  await page.locator(`.bottom-nav [data-view="${view}"]`).click();
  await expect(page.locator('.bottom-nav [aria-current="page"]')).toHaveCount(1);
  await expect(page.locator(`.bottom-nav [data-view="${view}"]`)).toHaveAttribute('aria-current','page');
  for(const resting of ['today','plan','train','progress','more'].filter(v=>v!==view))await expect(page.locator(`.bottom-nav [data-view="${resting}"]`)).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 }
 await page.locator('#openSettings').click();await expect(page.locator('#viewSettings')).toBeVisible();await expect(page.locator('.bottom-nav [data-view="more"]')).toHaveAttribute('aria-current','page');
});
test('empty profile cannot inherit another profile movement',async({page})=>{
 await seed(page,{profile:'alexa'});await expect(page.locator('[data-today-progress-exercise]')).toHaveCount(0);await expect(page.locator('#todayMovementMetric')).toContainText('Complete a movement');await expect(page.locator('#trainingVolume')).toContainText('No eligible workload yet');
});
for(const profile of ['jorge','alexa'])test(`${profile} completed sets remain distinct across all six accents`,async({page},info)=>{
 await page.setViewportSize({width:375,height:844});await installLocalStorageFixture(page,'activeWorkoutWithTwoExercises');
 if(profile==='alexa')await page.addInitScript(()=>{const source=JSON.parse(localStorage.getItem('big-gains-v2'));localStorage.setItem('big-gains-alexa-v1',JSON.stringify({...source,profileId:'alexa'}));localStorage.setItem('big-gains-active-profile','alexa');});
 await openApp(page);await page.locator('#activeExercises .set-done').nth(1).click();
 for(const accent of ['volt','cobalt','merlot','rose','violet','ember']){
  await page.evaluate(accent=>BigGainsAppearance.select(accent),accent);
  const row=page.locator('#activeExercises .set-line.completed').first();await expect(row).toBeVisible();
  const style=await row.evaluate(el=>({bg:getComputedStyle(el).backgroundColor,opacity:getComputedStyle(el).opacity,rail:getComputedStyle(el).borderInlineStartWidth,check:el.querySelector('.set-done').getAttribute('aria-pressed')}));
  expect(style.opacity).toBe('1');expect(style.rail).toBe('3px');expect(style.check).toBe('true');expect(style.bg).not.toBe('rgba(0, 0, 0, 0)');
  await page.screenshot({path:info.outputPath(`${profile}-${accent}.png`)});
 }
});

test('larger text keeps the long exercise name, workload and controls inside the phone',async({page},info)=>{
 await page.setViewportSize({width:375,height:844});await seed(page);
 await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
 await page.locator('[data-today-progress-exercise]').click();
 await expect(page.locator('.exercise-workload-read')).toContainText('4,000 lb');
 const sizes=await page.locator('#progressDialog').evaluate(el=>({scroll:el.scrollWidth,width:el.clientWidth}));expect(sizes.scroll).toBeLessThanOrEqual(sizes.width+1);
 await expect(page.locator('#closeProgressDialog')).toBeVisible();await page.screenshot({path:info.outputPath('larger-text.png')});
});
