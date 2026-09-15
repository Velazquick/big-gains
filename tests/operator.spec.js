import {test,expect} from '@playwright/test';
import {installLocalStorageFixture} from './fixtures/local-storage.js';
import {openApp} from './helpers/app.js';

const person={user_id:'00000000-0000-4000-8000-000000000001',display_name:'A very long synthetic profile name for layout review',email:'long.synthetic.account.identifier@example.invalid',joined:'2026-08-01T10:00:00Z',confirmed:'2026-08-01T11:00:00Z',first_workout:'2026-08-02T10:00:00Z',second_workout:'2026-08-05T10:00:00Z',last_activity:'2026-09-14T10:00:00Z',workouts:8,program_active:true,unfinished:1,over_six_hours:1,recent_errors:2,recent_recovery:0,release:'v115-operator-reliability-v2',platform:'ios',browser:'safari',mode:'standalone',last_event:'2026-09-14T10:00:00Z',freeform_observed:false};
const overview={registered:505,confirmed:361,activated:294,two_workouts:230,four_workouts:160,active_today:24,active_7d:126,active_30d:240,workouts_today:18,workouts_7d:200,workouts_30d:600,unfinished:6,over_six_hours:2,errors_7d:4,recovery_events_7d:2,telemetry_users_90d:300,last_event:'2026-09-14T10:00:00Z',median_hours_to_first:24,time_to_first_eligible:290,program_users:180,freeform_observed_7d:56,releases:[{release:'v115-operator-reliability-v2',users:280},{release:'v113-synthetic-older',users:20}],retention:[1,7,14,28].map(day=>({day,eligible:200,returned:100}))};
async function mock(page,{access=true,failure=false,empty=false,signals=false,episodeTotal=0}={}) {
  await page.route('**/cloud-config.js?*',route=>route.fulfill({contentType:'text/javascript',body:"window.__BIG_GAINS_CLOUD_CONFIG__={supabaseUrl:'https://synthetic.invalid',supabasePublishableKey:'synthetic-public-key'};"}));
  await page.route('**/vendor/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient(){return {auth:{onAuthStateChange(fn){window.operatorAuthListener=fn;}},rpc(name,args){window.operatorRequests ||= [];window.operatorRequests.push({name,args});const request=args?.request||{};let data=${JSON.stringify(overview)};if(name==='operator_access')data=window.operatorAllowed ?? ${access};else if(request.section==='users')data={total:${empty?0:51},page:request.page,page_size:25,users:${empty?'[]':`Array.from({length:request.page===2?1:25},(_,i)=>({...${JSON.stringify(person)},display_name:(${JSON.stringify(person.display_name)})+' '+(request.page*25+i)}))`}};else if(request.section==='detail')data={...${JSON.stringify(person)},events:${signals?JSON.stringify([{received_at:'2026-09-14T23:08:48Z',event_name:'app_open'},{received_at:'2026-09-14T23:08:55Z',event_name:'workout_started'},{received_at:'2026-09-14T23:09:25Z',event_name:'app_error',diagnostic_fingerprint:'BG-A1234567'}]):'[]'},event_total:${signals?3:0},profiles:[]};else if(['reliability','diagnostic'].includes(request.section))data={errors:${signals?JSON.stringify([{diagnostic_fingerprint:'BG-A1234567',error_code:'resource_load',surface:'app',lifecycle:'startup',people:1,occurrences:2,first_seen:'2026-09-14T23:09:25Z',last_seen:'2026-09-14T23:09:25Z',releases:['v115-operator-reliability-v2'],environments:['ios / safari / standalone']}]):'[]'},error_group_total:${signals?1:0},episode_total:${episodeTotal},affected_users:[{user_id:'00000000-0000-4000-8000-000000000001',display_name:'Synthetic person',occurrences:2}],affected_user_total:1,recovery:[],releases:[],observed_users:0,last_event:null};if(name!=='operator_access')data={...data,as_of:'2026-09-14T12:00:00Z',metric_contract:'operator-v2'};const result=${failure}&&name!=='operator_access'?{data:{secret:'PRIVILEGED PARTIAL'},error:{code:'42501'}}:{data,error:null};const p=Promise.resolve(result);p.abortSignal=()=>p;return p;}}}};` }));
}
for(const identity of ['signed-out','ordinary','independent','managed-member'])test(`${identity} direct Operator route fails closed`,async({page})=>{
  await mock(page,{access:false});await page.goto('/operator/');await expect(page.locator('#gate')).toContainText('Operator access is unavailable');await expect(page.locator('#console')).toBeHidden();
  expect(await page.evaluate(()=>window.operatorRequests.filter(r=>r.name==='operator_query_v2').length)).toBe(0);
});
test('authorization failure clears all privileged partial data',async({page})=>{await mock(page,{failure:true});await page.goto('/operator/');await expect(page.locator('#console')).toBeHidden();await expect(page.locator('body')).not.toContainText('PRIVILEGED PARTIAL');});
for(const width of [1440,390])test(`owner Operator overview, pagination, detail and funnel at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:960});await mock(page);await page.goto('/operator/');await expect(page.locator('#content')).toContainText('505');
  await page.screenshot({path:info.outputPath(`overview-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Users',exact:true}).click();await expect(page.locator(width<=600?'.user-card':'.desktop-users tbody tr')).toHaveCount(25);
  await page.locator('#filterPanel').evaluate(e=>e.open=true);await page.locator('#search').fill('synthetic');await page.getByRole('button',{name:'Apply',exact:true}).click();
  expect(await page.evaluate(()=>window.operatorRequests.at(-1).args.request.search)).toBe('synthetic');
  await page.locator('#next').click();await expect(page.locator('#pageInfo')).toHaveText('26–50 of 51');
  await page.screenshot({path:info.outputPath(`users-${width}.png`),fullPage:true});
  await page.locator(width<=600?'.user-card .person':'.desktop-users .person').first().click();await expect(page.locator('#content')).toContainText('No private sets');
  await page.getByRole('button',{name:'Funnel',exact:true}).click();await expect(page.locator('#content')).toContainText('D28');
  await page.getByRole('button',{name:'Reliability',exact:true}).click();await expect(page.locator('#content')).toContainText('No matching observations');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>window.operatorAuthListener('SIGNED_OUT'));await expect(page.locator('#console')).toBeHidden();await expect(page.locator('#content')).toBeEmpty();
});
test('Auth user change immediately clears previous operator results',async({page})=>{
  await mock(page);await page.goto('/operator/');await expect(page.locator('#content')).toContainText('505');
  await page.evaluate(()=>{
    // Model a rejected authorization check for the newly signed-in person.
    window.operatorAllowed=false;
    window.operatorAuthListener('SIGNED_IN');
    window.__operatorCleared= document.getElementById('content').children.length===0 && document.getElementById('console').hidden;
  });
  expect(await page.evaluate(()=>window.__operatorCleared)).toBe(true);
  await expect(page.locator('#gate')).toContainText('Operator access is unavailable');
  await expect(page.locator('#console')).toBeHidden();await expect(page.locator('#content')).toBeEmpty();
});
test('empty users table and pagination are honest',async({page})=>{await mock(page,{empty:true});await page.goto('/operator/');await page.getByRole('button',{name:'Users',exact:true}).click();await expect(page.locator('#content')).toContainText('No matching observations');await expect(page.locator('#next')).toBeDisabled();await expect(page.locator('#pageInfo')).toHaveText('0–0 of 0');});
for(const offline of [false,true])test(`telemetry completely fails: Train and Finish persist${offline?' offline':''}`,async({page,context})=>{
  await installLocalStorageFixture(page,'blankJorge');await openApp(page);await expect(page.locator('html')).toHaveAttribute('data-runtime-state','interactive');await page.waitForFunction(()=>window.BigGainsTelemetry);
  await page.evaluate(()=>{window.BigGainsTelemetry={emit(){throw Error('Telemetry unavailable');}};});
  if(offline)await context.setOffline(true);
  await page.locator('#quickStartSession').click();
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
  expect(await page.evaluate(()=>Boolean(active))).toBe(true);
  await page.evaluate(()=>{workoutSessionController.updateSet(0,0,'weight',45);workoutSessionController.updateSet(0,0,'reps',8);workoutSessionController.toggleSetCompleted(0,0);});
  await page.locator('#finishWorkout').click();
  const result=await page.evaluate(()=>({active:state.activeWorkout,workouts:state.workouts.length,stored:JSON.parse(localStorage.getItem(ACCOUNT.storageKey)).workouts.length}));
  expect(result.active).toBeNull();expect(result.workouts).toBe(1);expect(result.stored).toBe(1);
  await expect(page.getByRole('link',{name:'Operator',exact:true})).toHaveCount(0);
});

test.describe('v2 local-time and drill-through',()=>{
 test.use({timezoneId:'America/New_York'});
 test('diagnostic to affected person to chronological timeline and back',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mock(page,{signals:true});await page.goto('/operator/');await page.getByRole('button',{name:'Reliability',exact:true}).click();await page.locator('[data-fingerprint]').first().click();await expect(page.locator('#content')).toContainText('Affected people');await page.getByRole('button',{name:'Synthetic person',exact:true}).click();
  const events=await page.locator('.timeline').last().locator('strong').allTextContents();expect(events).toEqual(['App open','Workout started','App error']);const time=page.locator('time[datetime="2026-09-14T23:09:25.000Z"]');await expect(time).toContainText('7:09:25');await expect(time).toHaveAttribute('title',/2026-09-14T23:09:25.000Z.*UTC/);await expect(page.locator('#notice')).toContainText('America/New_York');await page.locator('#backUsers').click();await expect(page.locator('#content')).toContainText('Affected people');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
});

test('reliability pagination follows the selected signal only',async({page})=>{
 await mock(page,{signals:true,episodeTotal:80});await page.goto('/operator/');await page.getByRole('button',{name:'Reliability',exact:true}).click();
 for(const [signal,total,hidden] of [['errors','1–1 of 1',false],['conflicts','1–25 of 80',false],['recovery','',true]]){
  await page.locator('#filterPanel').evaluate(e=>e.open=true);await page.locator('#signalFilter').selectOption(signal);await page.getByRole('button',{name:'Apply',exact:true}).click();
  if(hidden)await expect(page.locator('#pagination')).toBeHidden();else await expect(page.locator('#pageInfo')).toHaveText(total);
 }
});
