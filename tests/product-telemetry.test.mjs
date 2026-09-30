import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile('product-telemetry.js','utf8');
function setup({online=true,throwing=false,actor='user-a',storage=new Map()}={}) {
  const events=[],listeners={};let id=0;let current=actor;let now=1700000000000;
  const listen=(n,fn)=>{const previous=listeners[n];listeners[n]=(...args)=>{previous?.(...args);fn(...args);};};
  class Clock extends Date {static now(){return now;}}
  const scope={sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},location:{href:'https://synthetic.invalid/',origin:'https://synthetic.invalid'},navigator:{onLine:online,userAgent:'Mozilla Windows Chrome Safari'},crypto:{randomUUID:()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`},bigGainsAccounts:{runtime:{authUserId:actor}},BIG_GAINS_ASSET_MANIFEST:{release:'v115-operator-reliability-v2',coreAssets:['./app.js','./styles.css']},
    BigGainsSupabase:{configured:true,session:async()=>({user:{id:current}}),getClient:()=>({rpc:(_,{event})=>{if(throwing)throw Error('offline');events.push(event);return{abortSignal:async()=>({})};}})},document:{visibilityState:'visible',documentElement:{dataset:{}},addEventListener:listen},addEventListener:listen};
  const ctx=vm.createContext({window:scope,PROFILE:{id:'person-a'},setTimeout:()=>1,clearTimeout:()=>{},AbortController,URL,Date:Clock});vm.runInContext(source,ctx);
  return{scope,events,listeners,advance:ms=>{now+=ms;},actor:value=>{current=value;},flush:()=>new Promise(r=>setImmediate(r))};
}
test('bounded payload drops all sensitive synthetic input before transport',async()=>{
  const h=setup();const secrets={email:'private@example.invalid',token:'Bearer SECRET',url:'https://example.invalid/?access_token=SECRET#workout',message:'weights=400 reps=6',stack:'BODYWEIGHT 200',state:{sets:[1]}};
  h.scope.BigGainsTelemetry.emit('app_error',{...secrets,category:secrets,surface:secrets.url});await h.flush();
  assert.equal(h.events.length,1);assert.equal(h.events[0].category,'unknown');assert.equal(h.events[0].surface,'app');
  assert.deepEqual(Object.keys(h.events[0]).sort(),['browser','category','event_name','id','mode','platform','profile_client_id','release','surface','training_mode','error_code','module_id','lifecycle','error_class','diagnostic_fingerprint'].sort());
  assert.ok(!JSON.stringify(h.events).includes('SECRET'));assert.ok(!JSON.stringify(h.events).includes('private@'));
});
test('identical errors deduplicate and unknown names are dropped',async()=>{const h=setup();for(let i=0;i<1000;i++)h.scope.BigGainsTelemetry.emit('app_error',{category:'javascript'});h.scope.BigGainsTelemetry.emit('private_workout');await h.flush();assert.equal(h.events.length,1);});
test('offline events are dropped with no queue',async()=>{const h=setup({online:false});h.scope.BigGainsTelemetry.emit('workout_completed');await h.flush();assert.equal(h.events.length,0);h.scope.navigator.onLine=true;await h.flush();assert.equal(h.events.length,0);});
test('telemetry rejection never escapes to product',async()=>{const h=setup({throwing:true});assert.equal(h.scope.BigGainsTelemetry.emit('workout_completed'),undefined);await h.flush();assert.equal(h.events.length,0);});
test('auth transition cannot send previous actor event',async()=>{const h=setup();h.actor('user-b');h.scope.BigGainsTelemetry.emit('workout_started');await h.flush();assert.equal(h.events.length,0);});
test('global errors never access sensitive error properties',async()=>{const h=setup();const raw={get message(){throw Error('must not inspect');},get stack(){throw Error('must not inspect');}};h.listeners.error({error:raw});h.listeners.unhandledrejection({reason:raw});await h.flush();assert.equal(h.events.length,2);assert.deepEqual(h.events.map(e=>e.category),['javascript','promise']);});
test('coarse environment never sends user-agent string',()=>{const h=setup();h.scope.navigator.userAgent='Mozilla iPhone Safari';const e=h.scope.BigGainsTelemetry.environment();assert.equal(e.platform,'ios');assert.equal(e.browser,'safari');assert.equal(Object.keys(e).length,3);});
test('at most ten error attempts per document across categories and surfaces',async()=>{const h=setup();for(const surface of ['app','train','program','recovery','onboarding'])for(const category of ['javascript','promise','resource','sync','program','unknown']){h.scope.BigGainsTelemetry.emit('app_error',{surface,category});await h.flush();}assert.equal(h.events.length,10);});

test('back-forward return resumes before recording one new app open',async()=>{
  const h=setup();h.listeners.pageshow();await h.flush();assert.equal(h.events.length,1);
  h.listeners.pagehide();h.advance(16*60_000);h.listeners.visibilitychange();await h.flush();assert.equal(h.events.length,1);
  h.listeners.pageshow();await h.flush();assert.equal(h.events.length,2);assert.ok(h.events.every(e=>e.event_name==='app_open'));
  h.listeners.pageshow();h.listeners.visibilitychange();await h.flush();assert.equal(h.events.length,2);
});

test('resource mapping admits exact owned modules only',()=>{const h=setup();assert.equal(h.scope.BigGainsTelemetry.resourceId('https://synthetic.invalid/app.js?token=SECRET'),'app.js');for(const url of ['https://other.invalid/app.js','https://synthetic.invalid/private-note.js'])assert.equal(h.scope.BigGainsTelemetry.resourceId(url),'unknown');});
test('bounded diagnostics and stable distinct fingerprints',()=>{const api=setup().scope.BigGainsTelemetry;const d=api.diagnostic({error_code:'private SECRET',module_id:'https://secret.invalid',error_class:'private',lifecycle:'private'});assert.deepEqual(JSON.parse(JSON.stringify(d)),{error_code:'unknown',module_id:'unknown',lifecycle:'unknown',error_class:'unknown'});const a={category:'resource',surface:'app',...api.diagnostic({error_code:'resource_load',module_id:'app.js'})};assert.equal(api.fingerprint(a),api.fingerprint({...a}));assert.notEqual(api.fingerprint(a),api.fingerprint({...a,module_id:'styles.css'}));});
test('resource capture distinguishes element failure from absent error object',async()=>{const h=setup();h.listeners.error({target:{tagName:'SCRIPT',src:'https://synthetic.invalid/app.js?SECRET'}});await h.flush();h.advance(61000);h.listeners.error({error:null});await h.flush();assert.equal(h.events[0].error_code,'resource_load');assert.equal(h.events[0].module_id,'app.js');assert.equal(h.events[1].category,'javascript');assert.ok(!JSON.stringify(h.events).includes('SECRET'));});
test('continuous conflict survives render foreground retry and reload then resolves once',async()=>{const storage=new Map();const h=setup({storage});const api=h.scope.BigGainsTelemetry;api.conflict('program',{presented:true});await h.flush();const id=h.events[0].episode_id;for(let i=0;i<100;i++)api.conflict('program',{presented:true});await h.flush();assert.deepEqual(h.events.map(e=>e.event_name),['conflict_detected','conflict_presented']);h.advance(61000);api.conflict('program',{presented:true});await h.flush();assert.equal(h.events.at(-1).episode_id,id);const reload=setup({storage});reload.advance(122000);reload.scope.BigGainsTelemetry.conflict('program',{presented:true});await reload.flush();assert.equal(reload.events.length,1);assert.equal(reload.events[0].episode_id,id);api.conflict('program',{verifiedResolved:true});api.conflict('program',{verifiedResolved:true});await h.flush();assert.equal(h.events.filter(e=>e.event_name==='conflict_resolved').length,1);h.advance(61000);api.conflict('program');await h.flush();assert.notEqual(h.events.at(-1).episode_id,id);});
test('conflict telemetry storage failure is isolated',()=>{const h=setup();h.scope.sessionStorage.setItem=()=>{throw Error('quota')};assert.doesNotThrow(()=>h.scope.BigGainsTelemetry.conflict('program'));});

const readySupport={active_unfinished:true,stale:true,finish_permitted:true,discard_permitted:true,blocker:'none',pending_sync:0,reconciliation:'verified',conflict_open:false,program_state:'in_sync',completion_observed:'none'};
test('support healthy presentation, transitions and render/foreground/reload dedup',async()=>{
 const storage=new Map(),h=setup({storage}),api=h.scope.BigGainsTelemetry;
 api.support(readySupport,{sessionKey:'PRIVATE-workout',presented:true});await h.flush();
 assert.deepEqual(h.events.map(e=>e.event_name),['stale_session_presented','stale_session_ready']);
 const episode=h.events[0].episode_id;
 for(let i=0;i<100;i++)api.support(readySupport,{sessionKey:'PRIVATE-workout',presented:true});
 h.listeners.visibilitychange();await h.flush();assert.equal(h.events.filter(e=>e.support_sequence).length,2);
 const reload=setup({storage});reload.scope.BigGainsTelemetry.support(readySupport,{sessionKey:'PRIVATE-workout',presented:true});await reload.flush();assert.equal(reload.events.length,0);
 assert.ok(!JSON.stringify(h.events).includes('PRIVATE-workout'));
 for(const blocker of ['sync','recovery','program','migration','unknown']){
  const blocked={...readySupport,finish_permitted:false,discard_permitted:false,blocker};
  api.support(blocked,{sessionKey:'PRIVATE-workout',presented:true});await h.flush();
  api.support(readySupport,{sessionKey:'PRIVATE-workout',presented:true});await h.flush();
 }
 assert.equal(h.events.filter(e=>e.event_name==='stale_session_blocked').length,5);
 assert.equal(h.events.filter(e=>e.event_name==='stale_session_ready').length,6);
 assert.ok(h.events.filter(e=>e.support_sequence).every(e=>e.episode_id===episode));
});
test('support actions only after explicit action; Resume cannot imply completion',async()=>{
 const h=setup(),api=h.scope.BigGainsTelemetry;
 api.support(readySupport,{sessionKey:'s',presented:true});await h.flush();
 api.support(readySupport,{sessionKey:'s',action:'resume'});await h.flush();
 assert.equal(h.events.filter(e=>e.event_name==='stale_session_resumed').length,1);
 assert.equal(h.events.filter(e=>e.event_name==='stale_session_finished').length,0);
 const finished={...readySupport,active_unfinished:false,stale:false,finish_permitted:false,discard_permitted:false,completion_observed:'once'};
 api.support(finished,{sessionKey:'s',action:'finish'});await h.flush();api.support(finished,{sessionKey:'s',action:'finish'});await h.flush();
 assert.equal(h.events.filter(e=>e.event_name==='stale_session_finished').length,1);
 api.support({...finished,completion_observed:'none'},{sessionKey:'s2',action:'discard'});await h.flush();
 assert.equal(h.events.filter(e=>e.event_name==='stale_session_discarded').length,1);
});
test('support bounded privacy, unavailable telemetry and storage failures',async()=>{
 const h=setup({throwing:true});h.scope.sessionStorage.setItem=()=>{throw Error('quota')};
 assert.doesNotThrow(()=>h.scope.BigGainsTelemetry.support({...readySupport,queue:{PRIVATE:1},blocker:'PRIVATE',program_state:'PRIVATE',parity_verified_at:'PRIVATE'},{sessionKey:'PRIVATE',presented:true}));await h.flush();
 const bounded=h.scope.BigGainsTelemetry.supportSnapshot({queue:{PRIVATE:1},blocker:'PRIVATE',program_state:'PRIVATE',pending_sync:-1});
 assert.ok(!JSON.stringify(bounded).includes('PRIVATE'));assert.equal(bounded.pending_sync,'unknown');assert.equal(bounded.blocker,'unknown');
 const off=setup({online:false});off.scope.BigGainsTelemetry.support(readySupport,{sessionKey:'s',presented:true});await off.flush();assert.equal(off.events.length,0);
});

test('draining sync counts do not create a blocked-event storm; heartbeat is bounded',async()=>{
 const h=setup(),api=h.scope.BigGainsTelemetry,blocked={...readySupport,finish_permitted:false,discard_permitted:false,blocker:'sync',pending_sync:100};
 api.support(blocked,{sessionKey:'s',presented:true});await h.flush();
 for(let n=99;n>0;n--){api.support({...blocked,pending_sync:n},{sessionKey:'s',presented:true});await h.flush();}
 assert.equal(h.events.length,2);h.advance(60001);api.support({...blocked,pending_sync:1},{sessionKey:'s',presented:true});await h.flush();assert.equal(h.events.at(-1).event_name,'support_state_observed');assert.equal(h.events.length,3);
 h.advance(15*60000);api.support({...blocked,pending_sync:1},{sessionKey:'s',presented:true});await h.flush();assert.equal(h.events.length,4);
});
