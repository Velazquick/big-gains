import { expect, test } from '@playwright/test';
import { blankState, completedWorkout, installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const names = ['volt','cobalt','merlot','rose','violet','ember'];
const title = name => name[0].toUpperCase() + name.slice(1);
async function setup(page, profile = 'jorge') {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ profile, jorge, alexa }) => {
    if (localStorage.getItem('appearance-seeded')) return;
    localStorage.clear();
    localStorage.setItem('big-gains-active-profile', profile);
    localStorage.setItem('big-gains-v2', JSON.stringify(jorge));
    localStorage.setItem('big-gains-alexa-v1', JSON.stringify(alexa));
    localStorage.setItem('appearance-seeded','1');
  }, { profile, jorge: { ...blankState('jorge'), workouts: [completedWorkout()] }, alexa: blankState('alexa') });
  await openApp(page);
}
async function choose(page, name) {
  await page.locator('#openSettings').click();
  await page.locator(`#accentChoice label:has(input[value="${name}"])`).click();
}
function contrast(a,b) {
  const luminance = hex => {
    const rgb = hex.startsWith('#') ? hex.slice(1).match(/../g).map(v=>parseInt(v,16)) : hex.match(/[\d.]+/g).slice(0,3).map(Number);
    return rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  };
  const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

test('legacy defaults, invalid input, no default materialization, pet and theme remain intact', async ({page}) => {
  await setup(page);
  expect(await page.evaluate(()=>BigGainsAppearance.current())).toEqual({accent:'ember',version:0});
  expect(await page.evaluate(()=>BigGainsAppearanceModel.resolve(BigGainsAppearance.current()))).toBe('volt');
  expect(await page.evaluate(()=>localStorage.getItem(BigGainsAppearance.storageKey))).toBeNull();
  expect(await page.evaluate(()=>BigGainsAppearance.select('custom-hex'))).toBe(false);
  expect(await page.evaluate(()=>BigGainsAppearanceModel.resolve({accent:'garbage',version:1}))).toBe('cobalt');
  await expect(page.locator('html')).toHaveAttribute('data-pet-enabled','true');
  await expect(page.locator('html')).toHaveAttribute('data-theme','performance-dark');
});

for (const profile of ['jorge','alexa']) for (const name of names) {
  test(`${profile} ${name}: immediate selection, readable tokens, mobile surfaces and unchanged behavior`, async ({page},info) => {
    await setup(page,profile);
    const before = await page.evaluate(()=>({theme:document.documentElement.dataset.theme,pet:document.documentElement.dataset.petEnabled,
      danger:getComputedStyle(document.documentElement).getPropertyValue('--danger'),amber:getComputedStyle(document.documentElement).getPropertyValue('--amber'),
      state:JSON.stringify(state),trainStyle:document.documentElement.dataset.trainPresentation}));
    await choose(page,name);
    await expect(page.getByRole('radio',{name:title(name),exact:true})).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-accent',name);
    await expect(page.locator(`input[value="${name}"]+span em`)).toBeVisible();
    const values = await page.evaluate(()=>{
      const css=getComputedStyle(document.documentElement);
      return {primary:css.getPropertyValue('--accent-primary').trim(),ink:css.getPropertyValue('--accent').trim(),on:css.getPropertyValue('--on-accent').trim(),bg:css.getPropertyValue('--panel3').trim(),
        theme:document.documentElement.dataset.theme,pet:document.documentElement.dataset.petEnabled,danger:css.getPropertyValue('--danger'),amber:css.getPropertyValue('--amber'),state:JSON.stringify(state),trainStyle:document.documentElement.dataset.trainPresentation,
        overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
    });
    for(const key of Object.keys(before)) expect(values[key],key).toBe(before[key]);
    expect(contrast(values.primary,values.on)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(values.ink,values.bg)).toBeGreaterThanOrEqual(4.5);
    expect(values.overflow).toBeLessThanOrEqual(0);
    await page.locator('#accentChoice').evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
    await page.screenshot({path:info.outputPath(`${profile}-${name}-settings.png`),animations:'disabled'});
    await page.locator('.bottom-nav [data-view="train"]').click();
    await expect(page.locator('#viewTrain')).toBeVisible();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:info.outputPath(`${profile}-${name}-train.png`),animations:'disabled'});
    await page.locator('.bottom-nav [data-view="progress"]').click();
    await expect(page.locator('#viewProgress')).toBeVisible();
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:info.outputPath(`${profile}-${name}-progress.png`),animations:'disabled'});
    for(const view of ['plan','library','today']) {
      await page.locator(`.bottom-nav [data-view="${view}"]`).click();
      await expect(page.locator(`#view${title(view)}`)).toBeVisible();
    }
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-accent',name);
    await page.locator('#quickStartSession').click();
    await expect(page.locator('#activePanel')).toBeVisible();
    const activeControl=page.locator('#activeExercises .set-done').first();
    await expect(activeControl).toBeVisible();
    const button=await page.locator('#finishWorkout').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color}));
    expect(contrast(button.bg,button.color)).toBeGreaterThanOrEqual(4.5);
  });
}

test('keyboard radio selection and managed profile isolation survive offline reload', async ({page,context}) => {
  await setup(page);
  await page.locator('#openSettings').click();
  const radio=page.getByRole('radio',{name:'Volt',exact:true});
  await radio.focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio',{name:'Cobalt',exact:true})).toBeChecked();
  await choose(page,'violet');
  await page.locator('#profileSelect').selectOption('alexa');
  await expect(page.locator('html')).toHaveAttribute('data-profile','alexa');
  await expect(page.locator('html')).toHaveAttribute('data-accent','rose');
  await choose(page,'ember');
  await page.locator('#profileSelect').selectOption('jorge');
  await expect(page.locator('html')).toHaveAttribute('data-accent','violet');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(r=>navigator.serviceWorker.addEventListener('controllerchange',r,{once:true}));});
  await context.setOffline(true); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-accent','violet');
});

test('local save failure does not apply an unsaved preference', async ({page}) => {
  await setup(page);
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key===BigGainsAppearance.storageKey)throw new DOMException('Quota','QuotaExceededError');return original.call(this,key,value);};});
  await choose(page,'violet');
  await expect(page.locator('html')).toHaveAttribute('data-accent','ember');
  await expect(page.locator('#accentStatus')).toContainText('could not save');
});

test('all palettes distinguish foregrounds on every supported panel', async ({page}) => {
  await setup(page);
  const palettes=await page.evaluate(()=>BigGainsAppearanceModel.palettes);
  for(const [name,palette]of Object.entries(palettes))for(const mode of ['dark','light']){
    const p=palette[mode];expect(contrast(p.primary,p.on),`${name} ${mode} CTA`).toBeGreaterThanOrEqual(4.5);
    for(const panel of mode==='dark'?['#080a0d','#11151b','#171c23','#0c0f13','#181d24']:['#fff9fb','#fffefd','#f8e8f1','#fff4f8'])expect(contrast(p.ink,panel),`${name} ${mode} ink`).toBeGreaterThanOrEqual(4.5);
  }
});

test('Program current-step accents follow each palette while validation errors stay semantic', async ({page}) => {
  await setup(page);
  await page.locator('.bottom-nav [data-view="plan"]').click();
  await page.locator('[data-plan-setup]').first().click();
  await expect(page.locator('.program-setup-progress .is-current')).toBeVisible();
  for(const name of names){
    const result=await page.evaluate(name=>{
      BigGainsAppearance.select(name);
      const current=document.querySelector('.program-setup-progress .is-current');
      const error=document.querySelector('.program-setup-error');
      return {color:getComputedStyle(current).color,ink:BigGainsAppearanceModel.tokens(name).ink,error:error?getComputedStyle(error).color:null};
    },name);
    expect(contrast(result.color,'#0d1116')).toBeGreaterThanOrEqual(4.5);
    expect(contrast(result.color,result.ink)).toBeCloseTo(1,6);
    if(result.error)expect(result.error).toBe('rgb(255, 156, 150)');
  }
});
