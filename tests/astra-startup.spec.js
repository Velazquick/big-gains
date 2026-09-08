import {test,expect} from '@playwright/test';
import {installLocalStorageFixture} from './fixtures/local-storage.js';
for(const accent of ['volt','rose','violet'])test(`cold start ${accent} covers real composition and disappears without delay`,async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await installLocalStorageFixture(page,'blankJorge');
 let release,requested;const gate=new Promise(r=>release=r),observed=new Promise(r=>requested=r);
 await page.route('**/program-setup.js?*',async route=>{requested();await gate;await route.continue();});
 const navigation=page.goto('/',{waitUntil:'domcontentloaded'});await observed;
 try{
  await page.evaluate(accent=>BigGainsAppearance.select(accent),accent);
  await expect(page.locator('#bootShell')).toBeVisible();await expect(page.locator('#bootLaunchMessage')).not.toBeEmpty();
  await expect(page.locator('#bootShell')).not.toContainText('VERIFIED');await expect(page.locator('#bootRetry')).toBeHidden();
  await page.screenshot({path:info.outputPath(`startup-${accent}.png`)});
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
