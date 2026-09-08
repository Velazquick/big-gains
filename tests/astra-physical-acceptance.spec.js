import { test, expect } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

async function instrument(page) {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => {
    window.positionTrace=[];
    const trace=(event,detail={})=>window.positionTrace.push({event,time:performance.now(),view:document.body?.dataset.view,boot:document.documentElement.dataset.bootState,y:scrollY,...detail});
    for(const name of ['scrollTo','scrollBy']) {const original=window[name].bind(window);window[name]=(...args)=>{trace(name,{args});return original(...args);};}
    const original=Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView=function(...args){trace('scrollIntoView',{id:this.id,exercise:this.dataset.exerciseId,args});return original.apply(this,args);};
    for(const name of ['visibilitychange','big-gains-boot-concealed','big-gains-boot-authorized','big-gains-runtime-state-changed'])document.addEventListener(name,()=>trace(name));
  });
}
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))));
test('blank workout gets its first stable anchor when the first exercise is added',async({page})=>{
  await instrument(page);await installLocalStorageFixture(page,'blankJorge');await openApp(page);
  await page.locator('.bottom-nav [data-view="train"]').click();await page.locator('#trainBlankStart').click();
  await expect(page.locator('#exercisePickerDialog')).toBeVisible();await page.locator('#exercisePickerSearch').fill('Incline Iso Machine Press');
  await page.locator('.exercise-picker-all [data-exercise-picker-select]').filter({hasText:'Incline Iso Machine Press'}).click();
  await expect(page.locator('#exercisePickerDialog')).toBeHidden();await frames(page);
  const card=page.locator('#activeExercises .is-active');await expect(card).toHaveAttribute('data-exercise-id','incline-iso-machine-press');
  await expect(card.locator('.set-line').first()).toBeInViewport({ratio:1});
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('big-gains-train-position')))).exerciseId)).toBe('incline-iso-machine-press');
});
test('inactive summaries surround the unchanged working card at 390px',async({page},info)=>{
  await instrument(page);await installLocalStorageFixture(page,'activeWorkoutWithTwoExercises');await openApp(page);
  await page.evaluate(()=>{
    const extra=BigGainsExerciseCatalog.exercises.filter(e=>e.measurement?.trackingModel==='load_reps'&&!active.exercises.some(a=>a.id===e.id)).slice(0,3);
    extra.forEach(e=>workoutSessionController.addExercise(e.id,{scroll:false}));
    active.exercises[0].sets.forEach(set=>{set.completed=true;});
    active.exercises.forEach(e=>{e.collapsed=true;});
    workoutSessionController.focusExercise(1);active.startedAt=new Date().toISOString();saveState();showActive(false);
  });
  const inactive=page.locator('#activeExercises .is-collapsed');await expect(inactive).toHaveCount(4);
  for(const card of await inactive.all()){
    expect((await card.boundingBox()).height).toBeLessThan(180);
    await expect(card).toHaveCSS('opacity','1');await expect(card).toHaveCSS('background-image','none');
    await expect(card.locator('.exercise-head h3')).toBeVisible();await expect(card.locator('.collapsed-summary strong')).toContainText('working sets');
    for(const button of await card.locator('button:visible').all()){
      const box=await button.boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.locator('#activeExercises').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
  await page.screenshot({path:info.outputPath('train-inactive-surrounding-390.png')});
  await page.screenshot({path:info.outputPath('train-inactive-full-390.png'),fullPage:true});
  const next=inactive.last();const id=await next.getAttribute('data-exercise-id');await next.locator('h3').click();
  await expect(page.locator('#activeExercises .is-active')).toHaveAttribute('data-exercise-id',id);
});
for(const timing of ['before','during','after']) test(`foreground survives shell concealment ${timing} initial restoration`,async({page},info)=>{
  await instrument(page);await installLocalStorageFixture(page,'activeWorkoutWithTwoExercises');await openApp(page);
  await page.getByRole('button',{name:'Expand Lat Pulldown',exact:true}).click();
  const field=page.locator('input[data-field="weight"][data-ei="1"][data-si="1"]');
  await field.fill('95');await field.blur();
  const before=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('big-gains-train-position')).map(k=>JSON.parse(localStorage.getItem(k))));
  await page.evaluate(async timing=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));
    if(timing==='before')BigGainsBootGate.beginTransition('identity-resolution');
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));
    // Same production BootGate transition used by account-onboarding's Auth callback.
    if(timing==='after')await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    if(timing!=='before')BigGainsBootGate.beginTransition('identity-resolution');
  },timing);
  await frames(page);
  await page.evaluate(()=>BigGainsBootGate.authorize('identity-resolved'));await frames(page);
  const evidence=await page.evaluate(()=>({trace:window.positionTrace,y:scrollY,bookmark:Object.keys(localStorage).filter(k=>k.startsWith('big-gains-train-position')).map(k=>JSON.parse(localStorage.getItem(k)))}));
  await info.attach('foreground-trace',{body:JSON.stringify({before,...evidence,field:await field.boundingBox()},null,2),contentType:'application/json'});
  expect(before[0].setId).toBe('lat-working-1');
  await expect(field).toBeInViewport({ratio:1});
  expect(evidence.bookmark[0].setId).toBe('lat-working-1');
  expect(await field.evaluate(e=>document.activeElement===e)).toBe(false);
  expect(evidence.trace.some(item=>item.event==='scrollBy')).toBe(true);
});
test('fresh routine entry seeds first stable set and owns final scroll',async({page},info)=>{
  await instrument(page);await installLocalStorageFixture(page,'blankJorge');await openApp(page);
  await page.locator('#quickStartSession').click();await expect(page.locator('#activePanel')).toBeVisible();await frames(page);
  await expect(page.locator('#activeExercises .is-active .set-line').first()).toBeInViewport({ratio:1});
  const bookmark=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('big-gains-train-position')))));
  expect(bookmark.exerciseId).toBe(await page.locator('#activeExercises .is-active').getAttribute('data-exercise-id'));
  expect(bookmark.setId).toBe(await page.locator('#activeExercises .is-active .set-line').first().getAttribute('data-set-id'));
  await info.attach('entry-trace',{body:JSON.stringify(await page.evaluate(()=>({trace:window.positionTrace,y:scrollY,bookmark:Object.keys(localStorage).filter(k=>k.startsWith('big-gains-train-position')),first:document.querySelector('#activeExercises [data-set-id]')?.getBoundingClientRect().toJSON()})),null,2),contentType:'application/json'});
});
