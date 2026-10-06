import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const telemetry=await readFile('product-telemetry.js','utf8');
const program=await readFile('program-portability.js','utf8');
const key='big-gains-operator-episodes-v2';
const flush=()=>new Promise(r=>setImmediate(r));
const memory=map=>({getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)});
// Execute the actual Program runtime and telemetry. Domain inspection outcomes,
// identity, clocks, and transport are synthetic; no external endpoints are used.
function setup({tab=new Map(),receipts=new Map(),local=new Map(),now=Date.parse('2026-10-06T14:00:00Z')}={}){
 let inspection='conflict',delivery='ok',initialized=false,sessionActor='synthetic-user',activeRequests=0,maxRequests=0;
 const attempts=[],held=[],timers=new Map();let timerId=0;
 class Clock extends Date {static now(){return now;}}
 const panel={getClientRects:()=>[{}],querySelectorAll:()=>[],addEventListener:()=>{}};
 const listeners={};const listen=(name,fn)=>{const before=listeners[name];listeners[name]=()=>{before?.();fn();};};
 const scope={sessionStorage:memory(tab),localStorage:memory(local),crypto:{randomUUID},
  location:{href:'https://synthetic.invalid/',origin:'https://synthetic.invalid'},navigator:{onLine:true,userAgent:'Synthetic Chrome'},
  document:{visibilityState:'visible',documentElement:{dataset:{}},getElementById:()=>panel,addEventListener:listen},addEventListener:listen,
  __BIG_GAINS_CLOUD_CONFIG__:{programPortability:true,programPortabilityVersion:1},
  BIG_GAINS_ASSET_MANIFEST:{release:'v119-conflict-resolution-retry',coreAssets:[]},
  bigGainsAccounts:{runtime:{authUserId:'synthetic-user',storageNamespace:'synthetic',kind:'signed-in'},matchesCloudOwner:()=>true},
  BigGainsSupabase:{configured:true,session:async()=>({user:{id:sessionActor},access_token:'synthetic-token'}),verifiedUser:async()=>({id:sessionActor}),
   readCloudAccount:async()=>({account:{id:'cloud-account'},profiles:[{id:'cloud-profile',client_id:'synthetic-profile',account_id:'cloud-account'}]}),
   getClient:()=>({rpc:(_,{event})=>{attempts.push(event);return {setHeader(){return this;},abortSignal:async signal=>{
    activeRequests++;maxRequests=Math.max(maxRequests,activeRequests);
    try{if(delivery==='reject')throw Error('synthetic failure');
     if(delivery==='error')return {data:null,error:{message:'PRIVATE failure'},status:400};
     if(delivery==='missing-ack')return {};
     if(delivery==='timeout')await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Error('synthetic timeout'))));
     if(delivery==='hold')await new Promise(r=>held.push(r));
     receipts.set(event.id,event);
     if(delivery==='lost-ack')throw Error('response lost after commit');
     return {data:null,error:null,status:204};
    }finally{activeRequests--;}
   }};}})},
  BigGainsCloud:{createDurableQueue:()=>({pending:()=>[]})},
  BigGainsProgramDomainSync:{createService:()=>({flush:async()=>({})}),isProgramDomainOperation:()=>true},
  BigGainsProgramDomainRecovery:{states:{INVALID_REMOTE:'invalid',UNSUPPORTED:'unsupported'},readRemote:async()=>({state:'valid',remote:{record:{version:1,fingerprint:'synthetic'},envelope:{synthetic:true}}})},
  BigGainsProgramDomainCutover:{createService:()=>({inspectCutover:async()=>({state:inspection})})},
  bigGainsStatePersistence:{readRawOwnedState:()=>null}
 };
 const state={workouts:[],programCapture:null},profile={id:'synthetic-profile'};
 const ctx=vm.createContext({window:scope,navigator:scope.navigator,PROFILE:profile,ACCOUNT:{accountId:'local-account'},state,active:null,
  statePersistenceApi:{storageKey:'synthetic-state',hasStoredState:()=>false},exerciseCatalog:{},
  setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),AbortController,URL,Date:Clock});
 vm.runInContext(telemetry,ctx);vm.runInContext(program,ctx);
 const runtime=scope.BigGainsProgramPortability;
 async function start(){initialized=true;runtime.initialize();await flush();await flush();assert.equal(runtime.status().status,'conflict');}
 async function converge(){inspection='converged';if(!initialized){initialized=true;runtime.initialize();await flush();await flush();}else await runtime.refresh({force:true});await flush();assert.equal(runtime.status().status,'in_sync');}
 async function retry(ms=300000){now+=ms;listeners.online();await flush();await flush();}
 async function tick(ms){now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}await flush();await flush();}
 return {scope,runtime,tab,receipts,attempts,local,state,profile,listeners,timers,start,converge,retry,tick,
  now:()=>now,advance:ms=>{now+=ms},maxRequests:()=>maxRequests,delivery:v=>{delivery=v},sessionActor:v=>{sessionActor=v},release:()=>held.splice(0).forEach(f=>f()),
  refreshTo:async value=>{inspection=value;await runtime.refresh({force:true});await flush();}};
}
const resolutions=h=>h.attempts.filter(e=>e.event_name==='conflict_resolved');
const cached=h=>JSON.parse(h.tab.get(key)||'[]');

test('verified convergence resolves exact episode on explicit void-RPC HTTP acknowledgment',async()=>{
 const h=setup();await h.start();const id=h.attempts[0].episode_id;await h.converge();
 assert.equal(resolutions(h)[0].episode_id,id);assert.equal(cached(h).length,0);
 assert.deepEqual(h.state,{workouts:[],programCapture:null});assert.equal(h.runtime.updateSafety(),true);
});
for(const failure of ['offline','reject','error','missing-ack'])test(`${failure}: persist exact identity, retry after backoff, retire only on acknowledgment`,async()=>{
 const h=setup();await h.start();
 if(failure==='offline')h.scope.navigator.onLine=false;else h.delivery(failure);
 await h.converge();const pending=cached(h)[0].resolution;assert.ok(pending);assert.equal(h.runtime.updateSafety(),true);
 h.scope.navigator.onLine=true;h.delivery('ok');await h.retry();
 assert.equal(resolutions(h).at(-1).id,pending.id);assert.equal(cached(h).length,0);
 assert.deepEqual(h.state,{workouts:[],programCapture:null});assert.ok(!JSON.stringify(h.tab.get(key)).includes('PRIVATE'));
});
test('transport saturation consumes no retry attempt and pumps when ordinary telemetry frees slots',async()=>{
 const h=setup();await h.start();h.delivery('hold');h.scope.BigGainsTelemetry.emit('workout_started');h.scope.BigGainsTelemetry.emit('workout_completed');await flush();
 await h.converge();assert.equal(cached(h)[0].resolution.attempts,0);assert.equal(resolutions(h).length,0);
 h.delivery('ok');h.release();await flush();await flush();assert.equal(cached(h).length,0);assert.ok(h.maxRequests()<=2);
});
test('timed-out resolution stays pending and does not hold Program safety or block retry',async()=>{
 const h=setup();await h.start();h.delivery('timeout');await h.converge();assert.equal(h.runtime.updateSafety(),true);
 await h.tick(4000);assert.equal(cached(h)[0].resolution.attempts,1);assert.equal(resolutions(h).length,1);
 h.delivery('ok');await h.tick(1000);assert.equal(cached(h).length,0);
});
test('120 attempts per document remain a hard limit; reload supplies a fresh transport budget',async()=>{
 const h=setup();await h.start();for(let n=0;n<118;n++){h.advance(60001);h.scope.BigGainsTelemetry.emit('workout_started');await flush();}
 assert.equal(h.attempts.length,120);await h.converge();assert.equal(resolutions(h).length,0);assert.equal(cached(h)[0].resolution.attempts,0);
 await h.retry();assert.equal(h.attempts.length,120);
 const r=setup({tab:h.tab,now:h.now()});await r.converge();assert.equal(resolutions(r).length,1);assert.equal(cached(r).length,0);
});
test('failed acknowledgment across reload uses fixed event, release, environment and episode',async()=>{
 const h=setup();await h.start();h.delivery('reject');await h.converge();const original=resolutions(h)[0];
 const r=setup({tab:h.tab,receipts:h.receipts,local:h.local,now:h.now()+5000});
 r.scope.BIG_GAINS_ASSET_MANIFEST.release='v120-synthetic-later';r.scope.navigator.userAgent='Mozilla iPhone Safari';
 await r.converge();assert.equal(JSON.stringify(resolutions(r)[0]),JSON.stringify(original));assert.equal(cached(r).length,0);
});
test('commit followed by response loss retries same event UUID without another retained receipt',async()=>{
 const h=setup();await h.start();h.delivery('lost-ack');await h.converge();const original=resolutions(h)[0];assert.ok(cached(h)[0].resolution);
 h.delivery('ok');await h.retry();assert.equal(resolutions(h).length,2);assert.deepEqual(resolutions(h)[1],original);
 assert.equal([...h.receipts.values()].filter(e=>e.event_name==='conflict_resolved').length,1);assert.equal(cached(h).length,0);
});
test('backoff timer, online, foreground and pageshow obey persistent cap; hidden/pagehide pause',async()=>{
 const h=setup();await h.start();h.delivery('reject');await h.converge();assert.equal(resolutions(h).length,1);
 await h.retry(4999);assert.equal(resolutions(h).length,1);await h.tick(1);assert.equal(resolutions(h).length,2);
 h.scope.document.visibilityState='hidden';await h.retry();assert.equal(resolutions(h).length,2);
 h.scope.document.visibilityState='visible';h.listeners.visibilitychange();await flush();assert.equal(resolutions(h).length,3);
 h.listeners.pagehide();await h.retry();assert.equal(resolutions(h).length,3);
 h.listeners.pageshow();await flush();assert.equal(resolutions(h).length,4);
 for(let n=0;n<10;n++)await h.retry();assert.equal(resolutions(h).length,8);assert.equal(cached(h)[0].resolution.attempts,8);
 const r=setup({tab:h.tab,now:h.now()+300000});await r.converge();assert.equal(resolutions(r).length,0);
});
test('pending resolution expires at 24h; existing episode retention remains bounded at 90d',async()=>{
 const h=setup();await h.start();h.delivery('reject');await h.converge();await h.retry(86400000);
 assert.equal(resolutions(h).length,1);assert.equal(cached(h).length,1);
 await h.retry(90*86400000);assert.equal(resolutions(h).length,1);assert.equal(cached(h).length,0);
});
test('actor, session and selected-profile changes cannot replay or retire another identity',async()=>{
 const h=setup();await h.start();h.delivery('reject');await h.converge();const event=resolutions(h)[0];h.delivery('ok');
 h.scope.bigGainsAccounts.runtime.authUserId='other-actor';h.sessionActor('other-actor');await h.retry();assert.equal(resolutions(h).length,1);
 h.scope.bigGainsAccounts.runtime.authUserId='synthetic-user';h.sessionActor('other-actor');await h.retry();assert.equal(resolutions(h).length,1);
 h.sessionActor('synthetic-user');h.profile.id='other-profile';await h.retry();assert.equal(resolutions(h).length,1);
 h.profile.id='synthetic-profile';await h.retry();assert.deepEqual(resolutions(h).at(-1),event);assert.equal(cached(h).length,0);
});
test('repeated missing or mismatched sessions consume no receipt attempts or document budget',async()=>{
 const h=setup();await h.start();h.sessionActor(null);await h.converge();
 for(let n=0;n<10;n++)await h.retry();
 h.sessionActor('other-actor');for(let n=0;n<10;n++)await h.retry();
 assert.equal(resolutions(h).length,0);assert.equal(cached(h)[0].resolution.attempts,0);
 h.sessionActor('synthetic-user');await h.retry();assert.equal(resolutions(h).length,1);assert.equal(cached(h).length,0);
 for(let n=0;n<117;n++){h.advance(60001);h.scope.BigGainsTelemetry.emit('workout_started');await flush();}
 assert.equal(h.attempts.length,120);
});
test('late session result after deadline cannot start a request or spend a receipt attempt',async()=>{
 const h=setup();await h.start();let resolveSession;h.scope.BigGainsSupabase.session=()=>new Promise(r=>{resolveSession=r;});
 await h.converge();await h.tick(4000);resolveSession({user:{id:'synthetic-user'},access_token:'synthetic-token'});await flush();
 assert.equal(resolutions(h).length,0);assert.equal(cached(h)[0].resolution.attempts,0);assert.equal(h.runtime.updateSafety(),true);
 h.scope.BigGainsSupabase.session=async()=>({user:{id:'synthetic-user'},access_token:'synthetic-token'});await h.retry();assert.equal(cached(h).length,0);
});
test('actual SDK request authorization stays bound to the session validated before a shared-client actor switch',async()=>{
 const h=setup();await h.start();let sdkActor='synthetic-user',authReads=0;const submitted=[];
 const client=createClient('https://synthetic.invalid','synthetic-publishable-key',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(_url,options)=>{
  submitted.push({authorization:new Headers(options.headers).get('Authorization'),event:JSON.parse(options.body).event});
  return new Response(null,{status:204});
 }}});
 client.auth.getSession=async()=>{authReads++;return {data:{session:{user:{id:sdkActor},access_token:sdkActor==='synthetic-user'?'synthetic-token-A':'synthetic-token-B'}},error:null};};
 h.scope.BigGainsSupabase.session=async()=>{const result=await client.auth.getSession();sdkActor='other-actor';return result.data.session;};
 h.scope.BigGainsSupabase.getClient=()=>client;
 await h.converge();assert.ok(authReads>=2);assert.equal(submitted.length,1);
 assert.equal(submitted[0].authorization,'Bearer synthetic-token-A');assert.equal(submitted[0].event.profile_client_id,'synthetic-profile');
 assert.equal(cached(h).length,0);assert.ok(!h.tab.get(key).includes('synthetic-token'));
 await client.auth.stopAutoRefresh();
});
test('identity transition while resolution request is in flight keeps pending entry',async()=>{
 const h=setup();await h.start();h.delivery('hold');await h.converge();h.scope.bigGainsAccounts.runtime.authUserId='other-actor';
 h.delivery('ok');h.release();await flush();assert.equal(cached(h).length,1);
 h.scope.bigGainsAccounts.runtime.authUserId='synthetic-user';await h.retry();assert.equal(cached(h).length,0);
});
test('new conflict after convergence uses new episode while old resolution awaits acknowledgment',async()=>{
 const h=setup();await h.start();h.delivery('reject');await h.converge();const old=cached(h)[0];await h.refreshTo('conflict');
 assert.equal(cached(h).length,2);const newId=cached(h)[1].id;assert.notEqual(newId,old.id);
 h.delivery('ok');await h.retry();assert.equal(cached(h).length,1);assert.equal(cached(h)[0].id,newId);
});
test('late acknowledgment closes only its old episode after a genuinely new conflict starts',async()=>{
 const h=setup();await h.start();h.delivery('hold');await h.converge();const old=cached(h)[0].id;
 await h.refreshTo('conflict');const next=cached(h).find(e=>!e.resolution).id;assert.notEqual(next,old);
 h.delivery('ok');h.release();await flush();await flush();assert.equal(cached(h).length,1);assert.equal(cached(h)[0].id,next);
});
test('pending/blocked and independent tabs never invent historical resolution',async()=>{
 const h=setup();await h.start();const entry=cached(h)[0];for(const s of ['pending','blocked'])await h.refreshTo(s);
 assert.deepEqual(cached(h)[0],entry);assert.equal(resolutions(h).length,0);
 const other=setup({receipts:h.receipts,local:h.local});await other.converge();assert.equal(resolutions(other).length,0);assert.equal(cached(h).length,1);
});
test('storage errors stay isolated; reloaded entries strip extra private fields and cap at 16',async()=>{
 const h=setup();await h.start();h.scope.sessionStorage.setItem=()=>{throw Error('quota');};h.delivery('reject');await h.converge();h.delivery('ok');await h.retry();assert.equal(resolutions(h).length,2);
 const p=setup();await p.start();p.delivery('reject');await p.converge();const e=cached(p)[0];e.PRIVATE='SECRET';e.resolution.PRIVATE='SECRET';
 const tab=new Map([[key,JSON.stringify(Array.from({length:20},()=>e))]]);const r=setup({tab,now:p.now()+1});r.delivery('reject');await r.converge();
 assert.equal(cached(r).length,16);assert.ok(!tab.get(key).includes('SECRET'));assert.ok(!JSON.stringify(r.attempts).includes('SECRET'));
});
