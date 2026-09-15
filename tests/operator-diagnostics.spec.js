import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const source=await readFile('product-telemetry.js','utf8');
async function setup(page){
 await page.goto('/privacy.html');await page.evaluate(()=>{
  window.PROFILE={id:'synthetic'};window.telemetryRows=[];window.bigGainsAccounts={runtime:{authUserId:'synthetic'}};
  window.BIG_GAINS_ASSET_MANIFEST={release:'v115-operator-reliability-v2',coreAssets:['./app.js','./styles.css']};
  window.BigGainsSupabase={configured:true,session:async()=>({user:{id:'synthetic'}}),getClient:()=>({rpc:(_,{event})=>{window.telemetryRows.push(event);return {abortSignal:async()=>({})}}})};
 });await page.addScriptTag({content:source});
}
test('native resource capture records allowlisted module and strips URL secrets',async({page})=>{
 await setup(page);await page.route('**/app.js?private=*',r=>r.abort());await page.evaluate(()=>{const s=document.createElement('script');s.src='./app.js?private=SECRET';document.head.append(s)});
 await expect.poll(()=>page.evaluate(()=>telemetryRows.filter(e=>e.event_name==='app_error').length)).toBe(1);
 const e=await page.evaluate(()=>telemetryRows.find(e=>e.event_name==='app_error'));expect(e.category).toBe('resource');expect(e.module_id).toBe('app.js');expect(e.error_code).toBe('resource_load');expect(e.diagnostic_fingerprint).toMatch(/^BG-[0-9A-F]{8}$/);expect(JSON.stringify(e)).not.toContain('SECRET');
});
test('absent error object is javascript unknown, not a guessed resource cause',async({page})=>{await setup(page);await page.evaluate(()=>dispatchEvent(new ErrorEvent('error',{message:'PRIVATE SECRET',error:null})));await expect.poll(()=>page.evaluate(()=>telemetryRows.filter(e=>e.event_name==='app_error').length)).toBe(1);const e=await page.evaluate(()=>telemetryRows.find(e=>e.event_name==='app_error'));expect(e.category).toBe('javascript');expect(e.error_class).toBe('unknown');expect(JSON.stringify(e)).not.toContain('PRIVATE');});
test('episode reload retains identity, resolution is once, later conflict is new',async({page})=>{
 await setup(page);await page.evaluate(()=>BigGainsTelemetry.conflict('program',{presented:true}));await expect.poll(()=>page.evaluate(()=>telemetryRows.filter(e=>e.event_name.startsWith('conflict')).length)).toBe(2);const id=await page.evaluate(()=>telemetryRows[0].episode_id);
 await page.reload();await setup(page);await page.evaluate(()=>BigGainsTelemetry.conflict('program'));expect(await page.evaluate(()=>telemetryRows.filter(e=>e.event_name==='conflict_detected').length)).toBe(0);
 await page.evaluate(()=>{BigGainsTelemetry.conflict('program',{verifiedResolved:true});BigGainsTelemetry.conflict('program',{verifiedResolved:true});});await expect.poll(()=>page.evaluate(()=>telemetryRows.filter(e=>e.event_name==='conflict_resolved').length)).toBe(1);expect(await page.evaluate(()=>telemetryRows.find(e=>e.event_name==='conflict_resolved').episode_id)).toBe(id);
 await page.evaluate(()=>BigGainsTelemetry.conflict('program'));await expect.poll(()=>page.evaluate(()=>telemetryRows.filter(e=>e.event_name==='conflict_detected').length)).toBe(1);expect(await page.evaluate(()=>telemetryRows.find(e=>e.event_name==='conflict_detected').episode_id)).not.toBe(id);
});
test('resource error around operational workout start does not carry training state',async({page})=>{await setup(page);await page.evaluate(()=>BigGainsTelemetry.emit('workout_started',{surface:'train'}));await page.route('**/missing-private.png',r=>r.abort());await page.evaluate(()=>{const image=new Image();image.src='./missing-private.png';document.body.append(image)});await expect.poll(()=>page.evaluate(()=>telemetryRows.some(e=>e.event_name==='app_error'))).toBe(true);const rows=await page.evaluate(()=>telemetryRows);expect(rows[0].event_name).toBe('workout_started');expect(rows.find(e=>e.event_name==='app_error').module_id).toBe('unknown');expect(JSON.stringify(rows)).not.toContain('missing-private');});
