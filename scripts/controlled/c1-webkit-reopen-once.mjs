import {chromium,webkit,devices,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {blankState,completedWorkout,activeWorkout} from '../../tests/fixtures/local-storage.js';
import {waitForAppRuntime} from '../../tests/helpers/app.js';
const root=process.cwd(),old=path.resolve('controlled-v122'),out=path.resolve('controlled-evidence/c1-reopen-once');fs.mkdirSync(out,{recursive:true});
const engineName=process.env.DIAG_ENGINE||'webkit',engine=engineName==='webkit'?webkit:chromium;
const stable=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(stable):Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const rows=[],save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({engine:engineName,v122Commit:'4565a9d3c0be8be3898160a3134695016ec53d92',v122WorkerSha256:createHash('sha256').update(fs.readFileSync(path.join(old,'service-worker.js'))).digest('hex'),rows},null,2));
const bounded=async(label,fn,ms=30000)=>{let t;try{return await Promise.race([fn(),new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(label+' '+ms+'ms deadline')),ms)})]);}finally{clearTimeout(t)}};
const sandbox={window:{},console};vm.runInNewContext(fs.readFileSync('cloud-storage.js','utf8'),sandbox);
const jorge={...blankState('jorge'),workouts:Array.from({length:18},(_,n)=>completedWorkout({id:'synthetic-jorge-'+n}))};
const alexa={...blankState('alexa'),workouts:Array.from({length:7},(_,n)=>completedWorkout({id:'synthetic-alexa-'+n}))};
const active=activeWorkout({id:'synthetic-active',startedAt:new Date().toISOString()});active.exercises[0].sets=active.exercises[0].sets.filter(s=>!s.warmup).map(s=>({...s,completed:true}));jorge.activeWorkout=active;
const pending=[jorge,alexa].map(s=>sandbox.window.BigGainsCloud.createOperation({owner:{accountId:'synthetic-account',profileId:s.profileId},entityType:'workouts',entityId:s.workouts[0].id,mutation:'upsert',version:1,updatedAt:'2026-10-28T12:00:00.000Z',payload:s.workouts[0],synthetic:true,queuedAt:'2026-10-28T12:00:00.000Z'}));
const queue={version:1,pending,acknowledgements:[]};const seed={'big-gains-active-profile':'jorge','big-gains-v2':JSON.stringify(jorge),'big-gains-alexa-v1':JSON.stringify(alexa),'big-gains-cloud-sync-queue-v1':JSON.stringify(queue),'__controlled_seed_once':'1'};
fs.writeFileSync(path.join(out,'expected-seed.json'),JSON.stringify({seed,historyHashes:{jorge:hash(jorge.workouts),alexa:hash(alexa.workouts)},activeHash:hash(active),pendingHash:hash(pending)},null,2));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const snapshot=page=>page.evaluate(()=>({jorge:JSON.parse(localStorage.getItem('big-gains-v2')),alexa:JSON.parse(localStorage.getItem('big-gains-alexa-v1')),pending:JSON.parse(localStorage.getItem('big-gains-cloud-sync-queue-v1')).pending,runtimeAvailable:Boolean(window.BigGainsCloudSync),apiPending:window.BigGainsCloudSync?.queue?.pending?.()??null,queueRaw:JSON.parse(localStorage.getItem('big-gains-cloud-sync-queue-v1'))}));
const workerSnapshot=page=>bounded('worker snapshot',()=>page.evaluate(async()=>{
 const registrations=await navigator.serviceWorker.getRegistrations(),target=navigator.serviceWorker.controller||registrations[0]?.active;
 const activeVersion=target?await new Promise(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve({observation:'GET_VERSION deadline'})},750);channel.port1.onmessage=e=>{clearTimeout(timer);channel.port1.close();resolve(e.data)};target.postMessage({type:'GET_VERSION'},[channel.port2])}):null;
 return {controller:navigator.serviceWorker.controller?.scriptURL||null,activeVersion,registrations:registrations.map(r=>({scope:r.scope,installing:r.installing?{scriptURL:r.installing.scriptURL,state:r.installing.state}:null,waiting:r.waiting?{scriptURL:r.waiting.scriptURL,state:r.waiting.state}:null,active:r.active?{scriptURL:r.active.scriptURL,state:r.active.state}:null}))};
}),3000);
function verify(data,finished=false){
 const oldHistory=data.jorge.workouts.filter(w=>w.id!=='synthetic-active');assert.equal(hash(oldHistory),hash(jorge.workouts),'original Jorge History');assert.equal(hash(data.alexa.workouts),hash(alexa.workouts),'original Alexa History');
 if(!finished){assert.equal(hash(data.jorge.activeWorkout),hash(active),'active workout exact');assert.equal(hash(data.pending),hash(pending),'both pending operations exact');}
 else{assert.equal(data.jorge.activeWorkout,null);const added=data.jorge.workouts.filter(w=>w.id==='synthetic-active');assert.equal(added.length,1);assert.equal(data.jorge.workouts.length,19);assert.equal(hash(added[0].exercises[0].sets),hash(active.exercises[0].sets),'finished sets exact');}
}
engineCells:for(const scenario of ['initial-install'])for(let n=1;n<=1;n++){
 const row={scenario,iteration:n,result:'INCOMPLETE',events:[],stage:'fixture-preflight'},note=(event,data={})=>{row.events.push({event,epoch:Date.now(),...data});save()};rows.push(row);
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'big-gains-controlled-'));row.userDataDir=profile;
 let context,server,release,heldResolve,hold=scenario==='initial-install',held=false,servedRoot=scenario==='v122-update'?old:root;
 const gate=new Promise(r=>release=r),barrier=new Promise(r=>heldResolve=r);
 try{
  server=createServer(async(req,res)=>{const url=new URL(req.url,'http://127.0.0.1'),pathname=url.pathname==='/'?'/index.html':url.pathname;const file=path.resolve(servedRoot,'.'+pathname);
   if(!file.startsWith(servedRoot+path.sep)){res.writeHead(403).end();return;}
   if(hold&&!held&&pathname==='/service-worker-core.js'){held=true;note('core-import-held');heldResolve();await gate;}
   if(res.destroyed)return;try{const bytes=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404).end();}
  });
  await bounded('listen',()=>new Promise(r=>server.listen(0,'127.0.0.1',r)));const origin='http://127.0.0.1:'+server.address().port;
  const opts={...devices[engineName==='webkit'?'iPhone 13':'Desktop Chrome'],baseURL:origin,serviceWorkers:'allow'};delete opts.defaultBrowserType;
  const launch=async(seedOnce)=>{const c=await engine.launchPersistentContext(profile,{...opts,timeout:30000});c.setDefaultTimeout(30000);c.setDefaultNavigationTimeout(30000);await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());if(seedOnce)await c.addInitScript(values=>{if(localStorage.getItem('__controlled_seed_once'))return;for(const [key,value] of Object.entries(values))localStorage.setItem(key,value)},seed);return c;};
  context=await launch(true);let page=context.pages()[0]||await context.newPage();await page.goto(origin);await waitForAppRuntime(page);verify(await snapshot(page));note('fixture-preflight-valid',{actual:await snapshot(page)});row.stage='interrupt';
  if(scenario==='v122-update'){
   await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'&&Boolean(navigator.serviceWorker.controller)});assert.equal(await page.evaluate(()=>BIG_GAINS_ASSET_MANIFEST.release),'v122-workout-integrity-3a');note('authentic-v122-controlled');
   servedRoot=root;hold=true;await page.reload();await waitForAppRuntime(page);assert.equal(await page.evaluate(()=>BIG_GAINS_ASSET_MANIFEST.release),'v123-reliability-completion');
  }
  await bounded('worker import barrier',()=>barrier,15000);note('before-interrupt',{worker:await workerSnapshot(page)});await page.reload({waitUntil:'domcontentloaded'});release();note('interruption-reload-and-release',{worker:await workerSnapshot(page)});
  if(scenario==='initial-install')await page.waitForFunction(async()=>Boolean((await navigator.serviceWorker.getRegistration())?.active),null,{timeout:8000}).then(()=>note('initial-install-active-within-diagnostic-window'),error=>note('initial-install-no-active-within-diagnostic-window',{error:String(error)}));
  else await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return Boolean(r?.waiting)||r?.installing?.state==='installed'},null,{timeout:8000}).then(()=>note('update-reached-installed-or-waiting'),error=>note('update-not-installed-within-diagnostic-window',{error:String(error)}));
  note('before-profile-close',{state:await snapshot(page),worker:await workerSnapshot(page)});await bounded('persistent close',()=>context.close());context=null;row.stage='online-reopen';
  hold=false;context=await launch(false);page=context.pages()[0]||await context.newPage();await page.goto(origin);await waitForAppRuntime(page);verify(await snapshot(page));note('online-reopen-verified',{actual:await snapshot(page),worker:await workerSnapshot(page)});
  await page.reload();await waitForAppRuntime(page);verify(await snapshot(page));note('reload-verified');row.stage='offline-finish';
  await context.setOffline(true);await expect(page.locator('#finishWorkout')).toBeEnabled();await page.locator('#finishWorkout').click();const finished=await snapshot(page);verify(finished,true);assert.equal(hash(finished.pending),hash(pending));note('offline-finish-verified',{actual:finished});
  await context.setOffline(false);row.stage='synthetic-queue-reconciliation';
  const flushed=await page.evaluate(async()=>{
   const sent=[];const runtime=BigGainsCloudSync.createSyncRuntime({durableQueue:BigGainsCloudSync.queue,transport:{enabled:true,async send(op){sent.push(op);return {ok:true,remoteVersion:op.version}}},isOnline:()=>navigator.onLine});
   return {first:await runtime.flush(),second:await runtime.flush(),sent};
  });assert.equal(flushed.first.sent,2);assert.equal(flushed.first.pending,0);assert.equal(flushed.second.sent,0);assert.equal(hash(flushed.sent),hash(pending));note('queue-reconciliation-verified',flushed);
  await page.reload();await waitForAppRuntime(page);const after=await snapshot(page);verify(after,true);assert.equal(after.pending.length,0);assert.equal(after.queueRaw.acknowledgements.length,2);
  row.worker=await page.evaluate(async()=>({controller:Boolean(navigator.serviceWorker.controller),registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({active:r.active?.state,installing:r.installing?.state,waiting:r.waiting?.state})),pwa:bigGainsPwaUpdate.status?.()}));
  row.limitations=['Managed-owner local fixtures with real durable queue/runtime and synthetic send responses; configured account recovery and automatic completion capture are not established by this cell.','No physical iPhone or Home Screen PWA evidence.'];row.result='LOCAL_DURABILITY_AND_SEEDED_QUEUE_PASS';row.stage='complete';
 }catch(error){row.error=String(error.stack||error);row.result=row.stage==='fixture-preflight'?'INVALID_FIXTURE':'FAILED_REQUIRED_STEP';}
 finally{
  release();if(context)await bounded('cleanup context',()=>context.close()).catch(e=>{row.cleanupError=String(e);row.result='INCOMPLETE_CLEANUP'});
  if(server){server.closeAllConnections();await bounded('cleanup server',()=>new Promise(r=>server.close(r))).catch(e=>{row.serverCleanupError=String(e);row.result='INCOMPLETE_CLEANUP'});}save();
 }
 console.log(JSON.stringify({scenario,iteration:n,result:row.result,stage:row.stage,error:row.error}));
 if(row.cleanupError||row.serverCleanupError)break engineCells;
 if(row.result!=='LOCAL_DURABILITY_AND_SEEDED_QUEUE_PASS')break;
}
if(rows.length!==1||rows.some(r=>r.result!=='LOCAL_DURABILITY_AND_SEEDED_QUEUE_PASS'))process.exitCode=1;
