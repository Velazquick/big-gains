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
test('characterize foreground identity concealment against v108 runtime',async({page},info)=>{
  await instrument(page);await installLocalStorageFixture(page,'activeWorkoutWithTwoExercises');await openApp(page);
  await page.getByRole('button',{name:'Expand Lat Pulldown',exact:true}).click();
  const field=page.locator('input[data-field="weight"][data-ei="1"][data-si="1"]');
  await field.fill('95');await field.blur();
  const before=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('big-gains-train-position')).map(k=>JSON.parse(localStorage.getItem(k))));
  await page.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));
    window.scrollTo({top:0,behavior:'instant'});
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));
    // Same production BootGate transition used by account-onboarding's Auth callback.
    BigGainsBootGate.beginTransition('identity-resolution');
  });
  await frames(page);
  await page.evaluate(()=>BigGainsBootGate.authorize('identity-resolved'));await frames(page);
  const evidence=await page.evaluate(()=>({trace:window.positionTrace,y:scrollY,bookmark:Object.keys(localStorage).filter(k=>k.startsWith('big-gains-train-position')).map(k=>JSON.parse(localStorage.getItem(k)))}));
  await info.attach('foreground-trace',{body:JSON.stringify({before,...evidence,field:await field.boundingBox()},null,2),contentType:'application/json'});
  expect(before[0].setId).toBe('lat-working-1');
});
test('characterize fresh routine entry and initial bookmark against v108 runtime',async({page},info)=>{
  await instrument(page);await installLocalStorageFixture(page,'blankJorge');await openApp(page);
  await page.locator('#quickStartSession').click();await expect(page.locator('#activePanel')).toBeVisible();await frames(page);
  await info.attach('entry-trace',{body:JSON.stringify(await page.evaluate(()=>({trace:window.positionTrace,y:scrollY,bookmark:Object.keys(localStorage).filter(k=>k.startsWith('big-gains-train-position')),first:document.querySelector('#activeExercises [data-set-id]')?.getBoundingClientRect().toJSON()})),null,2),contentType:'application/json'});
});
