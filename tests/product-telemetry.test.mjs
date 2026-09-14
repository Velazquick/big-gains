import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile('product-telemetry.js','utf8');
function setup({online=true,throwing=false,actor='user-a'}={}) {
  const events=[],listeners={};let id=0;let current=actor;
  const scope={navigator:{onLine:online,userAgent:'Mozilla Windows Chrome Safari'},crypto:{randomUUID:()=>`event-${++id}`},bigGainsAccounts:{runtime:{authUserId:actor}},BIG_GAINS_ASSET_MANIFEST:{release:'v114-operator-console-v1'},
    BigGainsSupabase:{configured:true,session:async()=>({user:{id:current}}),getClient:()=>({rpc:(_,{event})=>{if(throwing)throw Error('offline');events.push(event);return{abortSignal:async()=>({})};}})},addEventListener:(n,fn)=>listeners[n]=fn};
  const ctx=vm.createContext({window:scope,PROFILE:{id:'person-a'},setTimeout:()=>1,clearTimeout:()=>{},AbortController,Date});vm.runInContext(source,ctx);
  return{scope,events,listeners,actor:value=>{current=value;},flush:()=>new Promise(r=>setImmediate(r))};
}
test('bounded payload drops all sensitive synthetic input before transport',async()=>{
  const h=setup();const secrets={email:'private@example.invalid',token:'Bearer SECRET',url:'https://example.invalid/?access_token=SECRET#workout',message:'weights=400 reps=6',stack:'BODYWEIGHT 200',state:{sets:[1]}};
  h.scope.BigGainsTelemetry.emit('app_error',{...secrets,category:secrets,surface:secrets.url});await h.flush();
  assert.equal(h.events.length,1);assert.equal(h.events[0].category,'unknown');assert.equal(h.events[0].surface,'app');
  assert.deepEqual(Object.keys(h.events[0]).sort(),['browser','category','event_name','id','mode','platform','profile_client_id','release','surface','training_mode'].sort());
  assert.ok(!JSON.stringify(h.events).includes('SECRET'));assert.ok(!JSON.stringify(h.events).includes('private@'));
});
test('identical errors deduplicate and unknown names are dropped',async()=>{const h=setup();for(let i=0;i<1000;i++)h.scope.BigGainsTelemetry.emit('app_error',{category:'javascript'});h.scope.BigGainsTelemetry.emit('private_workout');await h.flush();assert.equal(h.events.length,1);});
test('offline events are dropped with no queue',async()=>{const h=setup({online:false});h.scope.BigGainsTelemetry.emit('workout_completed');await h.flush();assert.equal(h.events.length,0);h.scope.navigator.onLine=true;await h.flush();assert.equal(h.events.length,0);});
test('telemetry rejection never escapes to product',async()=>{const h=setup({throwing:true});assert.equal(h.scope.BigGainsTelemetry.emit('workout_completed'),undefined);await h.flush();assert.equal(h.events.length,0);});
test('auth transition cannot send previous actor event',async()=>{const h=setup();h.actor('user-b');h.scope.BigGainsTelemetry.emit('workout_started');await h.flush();assert.equal(h.events.length,0);});
test('global errors never access sensitive error properties',async()=>{const h=setup();const raw={get message(){throw Error('must not inspect');},get stack(){throw Error('must not inspect');}};h.listeners.error({error:raw});h.listeners.unhandledrejection({reason:raw});await h.flush();assert.equal(h.events.length,2);assert.deepEqual(h.events.map(e=>e.category),['javascript','promise']);});
test('coarse environment never sends user-agent string',()=>{const h=setup();h.scope.navigator.userAgent='Mozilla iPhone Safari';const e=h.scope.BigGainsTelemetry.environment();assert.equal(e.platform,'ios');assert.equal(e.browser,'safari');assert.equal(Object.keys(e).length,3);});
test('at most ten error attempts per document across categories and surfaces',async()=>{const h=setup();for(const surface of ['app','train','program','recovery','onboarding'])for(const category of ['javascript','promise','resource','sync','program','unknown']){h.scope.BigGainsTelemetry.emit('app_error',{surface,category});await h.flush();}assert.equal(h.events.length,10);});
