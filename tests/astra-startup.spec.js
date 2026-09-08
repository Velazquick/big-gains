import {writeFile} from 'node:fs/promises';
import {test,expect} from '@playwright/test';
import {installLocalStorageFixture} from './fixtures/local-storage.js';
for(const profile of ['jorge','alexa'])for(const accent of ['volt','rose','violet'])test(`cold start ${profile} ${accent} covers real composition and disappears without delay`,async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await installLocalStorageFixture(page,profile==='alexa'?'blankAlexa':'blankJorge');
 let release,requested;const gate=new Promise(r=>release=r),observed=new Promise(r=>requested=r);
 await page.route('**/program-setup.js?*',async route=>{requested();await gate;await route.continue();});
 const navigation=page.goto('/',{waitUntil:'domcontentloaded'});await observed;
 try{
  await page.waitForFunction(()=>Boolean(window.BigGainsAppearance));
  await page.evaluate(accent=>BigGainsAppearance.select(accent),accent);
  await expect(page.locator('#bootShell')).toBeVisible();await expect(page.locator('#bootLaunchMessage')).not.toBeEmpty();
  const contrast=await page.evaluate(()=>{
   const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
   const bg=luminance(getComputedStyle(document.querySelector('.boot-shell-card')).backgroundColor);
   return ['bootLaunchMessage','bootShellDetail'].map(id=>{const fg=luminance(getComputedStyle(document.getElementById(id)).color);return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05);});
  });
  for(const ratio of contrast)expect(ratio).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator('#bootShell')).not.toContainText('VERIFIED');await expect(page.locator('#bootRetry')).toBeHidden();
  // A screenshot during deliberately parser-blocked navigation can wait on
  // WebKit's navigation completion. Keep its real readiness assertions; capture
  // Chromium's actual painted startup directly without waiting for navigation.
  if(info.project.name==='chromium'){
   const session=await page.context().newCDPSession(page);
   const shot=await session.send('Page.captureScreenshot',{format:'png'});
   await writeFile(info.outputPath(`startup-${profile}-${accent}.png`),Buffer.from(shot.data,'base64'));
   await session.detach();
  }
 }finally{release();}await navigation;
 await expect(page.locator('html')).toHaveAttribute('data-runtime-state','interactive');await expect(page.locator('#bootShell')).toBeHidden();await expect(page.locator('#bootLaunchMessage')).toHaveCount(0);
 const message=await page.evaluate(()=>localStorage.getItem('big-gains-launch-message-v1'));
 await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('pageshow'));});
 await expect(page.locator('#bootShell')).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('big-gains-launch-message-v1'))).toBe(message);
});
test('failed composition keeps genuine recovery and retry without decorative readiness',async({page})=>{
 await installLocalStorageFixture(page,'blankJorge');await page.route('**/program-setup.js?*',route=>route.abort());await page.goto('/');
 await expect(page.locator('#bootShell')).toBeVisible();await expect(page.locator('#bootRetry')).toBeVisible();await expect(page.locator('#bootShellDetail')).toContainText('could not finish starting');await expect(page.locator('#bootLaunchMessage')).toHaveCount(0);
});
