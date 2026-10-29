import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import {webcrypto} from 'node:crypto';
import {blankState,completedWorkout} from './fixtures/local-storage.js';

// Actual persistence/queue/shadow/hash/sync modules; only remote I/O and the
// scheduler are synthetic. Pause AFTER actual comparison, preserving overlap.
async function fixture() {
  const storage=new Map(), listeners={}, timers=[];
  const descriptor={accountId:'local-account',profileId:'jorge',storageKey:'synthetic-profile',displayName:'Synthetic'};
  const owner={account:{id:'cloud-account'},authUserId:'user',profiles:{jorge:{id:'cloud-profile',account_id:'cloud-account',client_id:'jorge'}}};
  const ctx={console,crypto:webcrypto,TextEncoder,structuredClone,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},navigator:{onLine:true,locks:{request:async(n,o,cb)=>cb({name:n})}},document:{visibilityState:'visible',getElementById:()=>null,addEventListener:(event,fn)=>{listeners[event]=fn;}},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},addEventListener(){},
    bigGainsAccounts:{runtime:{kind:'independent',cloudShape:'independent',authUserId:'user',storageNamespace:'synthetic',expectedProfileIds:['jorge'],cloudKeys:{queue:'queue',catalog:'catalog',comparison:'comparison'}},registry:{accounts:[descriptor],resolve:()=>descriptor},matchesCloudOwner:()=>true,cloudProfileShape:()=> 'independent'},
    BigGainsSupabase:{configured:true,session:async()=>({user:{id:'user'}}),verifiedUser:async()=>({id:'user'}),readCloudAccount:async()=>owner,getClient:()=>({})},
    BigGainsManagedProfileRecovery:{inspectRemoteFastForward:()=>({eligible:false,reason:'no-newer-remote-revisions'}),inspectSameEntityConflict:()=>({eligible:false,reason:'synthetic'})}};
  ctx.window=ctx;vm.createContext(ctx);
  const execute=f=>vm.runInContext(fs.readFileSync(new URL(`../${f}`,import.meta.url),'utf8'),ctx,{filename:f});
  const before={...blankState('jorge'),workouts:[completedWorkout()]};
  storage.set('synthetic-profile',JSON.stringify(before));
  for(const f of ['state-persistence.js','migration-preview.js','cloud-storage.js','cloud-shadow.js'])execute(f);
  await ctx.bigGainsStatePersistence.writerReady;
  const store=ctx.bigGainsStatePersistence.create({account:descriptor,profile:{id:'jorge',goals:{}},profileConfig:{jorge:{id:'jorge',goals:{}}},validWorkoutTypes:['Push'],createId:()=> 'new-id',slug:x=>x});store.load();
  const shadow=ctx.BigGainsCloudShadow,records=await shadow.localRecords('jorge',before);
  const remote=records.map(record=>({...record,version:1,updatedAt:'2026-10-12T12:00:00.000Z',tombstone:false}));
  const cloud={ownershipIssues:[],profiles:{jorge:{current:remote,winners:new Map(remote.map(r=>[shadow.keyFor(r.table,r.clientId),r]))}}};
  storage.set('catalog',JSON.stringify(shadow.catalogFromCloud({cloud,owner})));
  let hold=false,release,entered;
  const started=new Promise(r=>entered=r),held=new Promise(r=>release=r);
  ctx.BigGainsCloudShadow={...shadow,createRepository:()=>({readAll:async()=>({journals:[]})}),reconstructCloud:async()=>cloud,compare:async args=>{const result=await shadow.compare(args);if(hold){entered();await held;}return result;}};
  execute('cloud-sync.js');const api=ctx.BigGainsCloudSync;
  await api.flush();
  return {ctx,storage,store,api,before,shadow,owner,restart(){execute('cloud-sync.js');return ctx.BigGainsCloudSync;},
    async reconcile(api){
      assert.equal(api.status().reconciliationInFlight,false);
      let complete,armed=false;
      const finished=new Promise(resolve=>complete=resolve),getElement=ctx.document.getElementById;
      // The actual reconciliation finally clears inFlight then renders. Observe
      // that terminal notification through the existing synthetic DOM port;
      // event-loop turns do not bound real native hashing work.
      ctx.document.getElementById=function(...args){
        const node=getElement.apply(this,args);
        if(armed&&args[0]==='cloudSettingsMount'&&!api.status().reconciliationInFlight)complete();
        return node;
      };
      try{
        timers.length=0;api.scheduleReconciliation('synthetic-reopen',0);timers.pop()();
        assert.equal(api.status().reconciliationInFlight,true);armed=true;
        await finished;
        assert.equal(api.status().reconciliationInFlight,false);
      }finally{ctx.document.getElementById=getElement;}
    },
    async pause(){hold=true;const result=api.compareShadow();await started;return {result,release(){hold=false;release();}};}};
}

test('obsolete parity cannot regress upsert2 or make deletion reuse revision2',async()=>{
  const f=await fixture(),paused=await f.pause();
  const newer=structuredClone(f.before);newer.workouts[0].exercises[0].sets[0].reps=12;
  f.store.save(newer,null);await f.api.captureLocalSnapshot('jorge');
  const key=f.shadow.keyFor('workouts',newer.workouts[0].id);
  const catalog=f.storage.get('catalog'),queue=f.storage.get('queue'),profile=f.storage.get('synthetic-profile');
  assert.equal(JSON.parse(catalog).profiles.jorge.records[key].version,2);
  paused.release();const result=await paused.result;
  assert.equal(f.storage.get('catalog'),catalog);
  assert.equal(f.storage.get('queue'),queue);assert.equal(f.storage.get('synthetic-profile'),profile);
  assert.equal(result.parity,false);assert.equal(result.errorCode,'comparison-superseded');
  f.store.save({...newer,workouts:[]},null);await f.api.captureLocalSnapshot('jorge');
  const ops=f.api.queue.pending().filter(o=>o.entityType==='workouts');
  assert.deepEqual(JSON.parse(JSON.stringify(ops.map(o=>[o.mutation,o.version,o.baseRevision?.version]))),[['upsert',2,1],['delete',3,2]]);
});

for(const change of ['mutation','lifecycle','hidden','owner','durable-profile','durable-catalog','queue'])test(`comparison refuses superseded ${change} without replacing authority`,async()=>{
  const f=await fixture(),paused=await f.pause();
  if(change==='mutation')f.api.beginLocalMutation()();
  if(change==='lifecycle')f.api.setAutomaticReconciliationPaused(true);
  if(change==='hidden')f.ctx.document.visibilityState='hidden';
  if(change==='owner')f.owner.authUserId='different-user';
  if(change==='durable-profile')f.storage.set('synthetic-profile',JSON.stringify({...f.before,goals:{primary:'Newer durable fact'}}));
  if(change==='durable-catalog')f.storage.set('catalog',JSON.stringify({...JSON.parse(f.storage.get('catalog')),migrationId:'newer-generation'}));
  if(change==='queue')f.api.queue.enqueue(f.ctx.BigGainsCloud.createOperation({owner:{accountId:'cloud-account',profileId:'cloud-profile'},entityType:'workouts',entityId:'other',mutation:'upsert',version:1,updatedAt:'2026-10-22T12:00:00.000Z',payload:{id:'other'}}));
  const before=[...f.storage];paused.release();const result=await paused.result;
  assert.equal(result.parity,false);assert.equal(result.errorCode,'comparison-superseded');
  assert.deepEqual([...f.storage],before);
});

test('unchanged comparison still verifies and adopts the real remote catalog',async()=>{
  const f=await fixture(),paused=await f.pause();paused.release();const result=await paused.result;
  assert.equal(result.parity,true);assert.equal(f.api.status().lastComparison.parity,true);
  assert.equal(JSON.parse(f.storage.get('comparison')).parity,true);
  assert.equal(f.api.queue.pending().length,0);
  assert.equal(f.api.status().backupVerified,true);
});

test('superseded comparison never advertises current backup while capture is pending',async()=>{
  const f=await fixture();assert.equal(f.api.status().backupVerified,true);
  const nodes=new Map();const node=id=>{
    if(!nodes.has(id))nodes.set(id,{textContent:'',hidden:false,disabled:false,innerHTML:'',classList:{add(){},remove(){}},querySelectorAll:()=>[]});
    return nodes.get(id);
  };
  f.ctx.document.getElementById=node;
  const paused=await f.pause();
  const newer=structuredClone(f.before);newer.workouts[0].exercises[0].sets[0].reps=19;
  f.store.save(newer,null);const finish=f.api.beginLocalMutation();
  paused.release();await paused.result;await new Promise(r=>setImmediate(r));
  assert.equal(f.api.status().backupVerified,false);
  assert.notEqual(node('cloudShadowHeading').textContent,'In sync');
  assert.notEqual(node('cloudAuthDetail').textContent,'Your cloud backup is up to date.');
  assert.equal(f.api.queue.pending().length,0);assert.equal(f.api.status().capturePending,1);
  finish();assert.equal(f.api.status().backupVerified,false);
});

test('known conflict survives an obsolete comparison through its final session await',async()=>{
  const f=await fixture();
  f.ctx.BigGainsManagedProfileRecovery.inspectSameEntityConflict=()=>({eligible:true,reason:'remote-revision-conflict',reasons:['Known synthetic conflict']});
  const newer=structuredClone(f.before);newer.workouts[0].exercises[0].sets[0].reps=20;
  f.store.save(newer,null);await f.api.captureLocalSnapshot('jorge');await f.api.compareShadow();
  const known=f.api.status().sameEntityConflict;assert.equal(known.eligible,true);
  let enter,release;const entered=new Promise(r=>enter=r),held=new Promise(r=>release=r);
  f.ctx.BigGainsSupabase.session=async()=>{enter();await held;return {user:{id:'user'}};};
  const comparing=f.api.compareShadow();await entered;
  assert.equal(f.api.status().sameEntityConflict,known);
  const before=[...f.storage];f.api.beginLocalMutation()();release();const result=await comparing;
  assert.equal(result.errorCode,'comparison-superseded');
  assert.equal(f.api.status().sameEntityConflict,known);assert.equal(f.api.status().remoteFastForward.conflict,true);
  assert.deepEqual([...f.storage],before);
});

test('fresh reconciliation captures a durable completed workout missed before interruption',async()=>{
  const f=await fixture();const newer={...structuredClone(f.before),workouts:[completedWorkout({id:'committed-before-capture'}),...f.before.workouts]};
  f.store.save(newer,null);const raw=f.storage.get('synthetic-profile');
  const fresh=f.restart();assert.equal(fresh.queue.pending().length,0);
  await f.reconcile(fresh);
  const pending=fresh.queue.pending().filter(op=>op.entityId==='committed-before-capture');
  assert.equal(pending.length,1);assert.equal(pending[0].version,1);
  assert.equal(pending[0].payload.data.id,'committed-before-capture');
  assert.equal(f.storage.get('synthetic-profile'),raw);assert.equal(fresh.status().backupVerified,false);
});

for(const restart of [false,true])test(`queue-before-catalog interruption reuses exact original intent, restart=${restart}`,async()=>{
  const f=await fixture(),oldCatalog=f.storage.get('catalog');
  const newer=structuredClone(f.before);newer.workouts[0].exercises[0].sets[0].reps=22;f.store.save(newer,null);
  const set=f.ctx.localStorage.setItem;let fault=true;
  f.ctx.localStorage.setItem=(key,value)=>{if(key==='catalog'&&fault){fault=false;throw Error('Synthetic queue-before-catalog interruption');}return set(key,value);};
  assert.equal((await f.api.captureLocalSnapshot('jorge')).reason,'capture-failed');
  assert.equal(f.storage.get('catalog'),oldCatalog);
  const before=JSON.stringify(f.api.queue.pending()),raw=f.storage.get('synthetic-profile');
  assert.equal(f.api.queue.pending().length,1);f.ctx.localStorage.setItem=set;
  const fresh=restart?f.restart():f.api;
  assert.equal((await fresh.captureLocalSnapshot('jorge')).queued,0);
  assert.equal(JSON.stringify(fresh.queue.pending()),before);assert.equal(f.storage.get('synthetic-profile'),raw);
  const record=JSON.parse(f.storage.get('catalog')).profiles.jorge.records[f.shadow.keyFor('workouts',newer.workouts[0].id)];
  assert.equal(record.version,2);assert.equal(record.updatedAt,fresh.queue.pending()[0].updatedAt);
});

for(const fault of ['gap','ambiguous','same-fingerprint-sibling','bad-fingerprint'])test(`pending catalog recovery refuses ${fault} without rewriting evidence`,async()=>{
  const f=await fixture(),key=f.shadow.keyFor('workouts',f.before.workouts[0].id),base=JSON.parse(f.storage.get('catalog')).profiles.jorge.records[key];
  const data=structuredClone(base.data);data.exercises[0].sets[0].reps=25;
  const fingerprint=await f.shadow.fingerprint('jorge','workouts',base.clientId,data,false);
  const create=(version,fp,stamp='2026-10-22T12:00:00.000Z')=>f.ctx.BigGainsCloud.createOperation({owner:{accountId:'cloud-account',profileId:'cloud-profile'},entityType:'workouts',entityId:base.clientId,mutation:'upsert',version,updatedAt:stamp,payload:f.shadow.envelopeFor({profileClientId:'jorge',entityType:base.entityType,clientId:base.clientId,data}),payloadFingerprint:fp,baseRevision:{version:version-1,updatedAt:base.updatedAt,fingerprint:base.fingerprint,tombstone:false}});
  f.api.queue.enqueue(create(fault==='gap'?3:2,fault==='bad-fingerprint'?'invalid-fingerprint':fingerprint));
  if(fault==='ambiguous')f.api.queue.enqueue(create(2,'conflicting-fingerprint','2026-10-22T12:00:01.000Z'));
  if(fault==='same-fingerprint-sibling')f.api.queue.enqueue(create(2,fingerprint,'2026-10-22T12:00:01.000Z'));
  const before=[...f.storage];const result=await f.api.captureLocalSnapshot('jorge');
  assert.equal(result.reason,'capture-failed');assert.deepEqual([...f.storage],before);
});

test('transient startup read refusal keeps the missed-capture obligation for the next reconciliation',async()=>{
  const f=await fixture();f.store.save({...f.before,workouts:[completedWorkout({id:'interrupted-finalization'}),...f.before.workouts]},null);
  const original=f.ctx.bigGainsStatePersistence;let reads=0;
  f.ctx.bigGainsStatePersistence={...original,readProfileSnapshot(id){reads+=1;if(reads===1)return {ok:false,reason:'storage-read-failed'};return original.readProfileSnapshot(id);}};
  const fresh=f.restart();await f.reconcile(fresh);
  assert.equal(fresh.queue.pending().length,0);assert.equal(fresh.status().lastResult.reason,'startup-capture-failed');
  assert.equal(reads,1);
  await f.reconcile(fresh);
  assert.equal(fresh.queue.pending().filter(op=>op.entityId==='interrupted-finalization').length,1);
  assert.equal(JSON.parse(f.storage.get('synthetic-profile')).workouts[0].id,'interrupted-finalization');
});

for(const entry of ['reconciliation','direct-flush'])test(`ordinary refused capture is recovered by ${entry} after successful startup`,async()=>{
  const f=await fixture();await f.reconcile(f.api);assert.equal(f.api.queue.pending().length,0);
  f.store.save({...f.before,workouts:[completedWorkout({id:'ordinary-missed-capture'}),...f.before.workouts]},null);
  const raw=f.storage.get('synthetic-profile'),original=f.ctx.bigGainsStatePersistence;let refuse=true;
  f.ctx.bigGainsStatePersistence={...original,readProfileSnapshot(id){if(refuse){refuse=false;return {ok:false,reason:'storage-read-failed'};}return original.readProfileSnapshot(id);}};
  assert.equal((await f.api.captureLocalSnapshot('jorge')).reason,'storage-read-failed');
  assert.equal(f.api.queue.pending().length,0);
  if(entry==='reconciliation')await f.reconcile(f.api);else await f.api.flush();
  assert.equal(f.api.queue.pending().filter(op=>op.entityId==='ordinary-missed-capture').length,1);
  assert.equal(f.storage.get('synthetic-profile'),raw);assert.equal(f.api.status().backupVerified,false);
});

test('reconciliation completion waits for held native hashing and preserves missed capture',async()=>{
  const f=await fixture();
  f.store.save({...f.before,workouts:[completedWorkout({id:'held-native-capture'}),...f.before.workouts]},null);
  const raw=f.storage.get('synthetic-profile');
  let enter,release,settled=false;
  const entered=new Promise(resolve=>enter=resolve),held=new Promise(resolve=>release=resolve);
  f.ctx.crypto={subtle:{async digest(...args){enter();await held;return webcrypto.subtle.digest(...args);}}};
  const completion=f.reconcile(f.api).then(()=>{settled=true;return null;},error=>{settled=true;return error;});
  let whileHeld;
  try {
    await entered;
    // Advance beyond the former helper's event-loop-turn budget while the real
    // hash is explicitly held. Turns cannot prove native work has completed.
    for(let turn=0;turn<1100;turn++)await new Promise(resolve=>setImmediate(resolve));
    whileHeld={settled,inFlight:f.api.status().reconciliationInFlight};
    assert.equal(f.api.queue.pending().length,0);assert.equal(f.storage.get('synthetic-profile'),raw);
  } finally {release();}
  const error=await completion;
  assert.equal(whileHeld.inFlight,true);
  assert.equal(whileHeld.settled,false,'the helper must await actual completion, not count event-loop turns');
  if(error)throw error;
  assert.equal(f.api.queue.pending().filter(op=>op.entityId==='held-native-capture').length,1);
  assert.equal(f.storage.get('synthetic-profile'),raw);assert.equal(f.api.status().backupVerified,false);
});

for(const mode of ['older-delete','missing-delete','equal-fingerprint-mismatch','equal-deletion-mismatch','exact-delete'])test(`pure tombstone comparison preserves upsert2/delete3 with ${mode}`,async()=>{
  const f=await fixture(),changed=structuredClone(f.before),id=changed.workouts[0].id,key=f.shadow.keyFor('workouts',id);
  changed.workouts[0].exercises[0].sets[0].reps=31;f.store.save(changed,null);await f.api.captureLocalSnapshot('jorge');
  f.store.save({...changed,workouts:[]},null);await f.api.captureLocalSnapshot('jorge');
  const before=JSON.parse(f.storage.get('catalog')).profiles.jorge.records[key],queue=f.storage.get('queue');
  assert.equal(before.version,3);assert.equal(before.tombstone,true);
  const cloud=await f.ctx.BigGainsCloudShadow.reconstructCloud();cloud.profiles.jorge.current=cloud.profiles.jorge.current.filter(record=>record.clientId!==id);
  cloud.profiles.jorge.winners.set(key,{...before,...(mode==='older-delete'?{version:2}:mode==='equal-fingerprint-mismatch'?{fingerprint:'wrong-fingerprint'}:mode==='equal-deletion-mismatch'?{tombstone:false}:{})});
  if(mode==='missing-delete')cloud.profiles.jorge.winners.delete(key);
  const result=await f.api.compareShadow();
  assert.equal(result.parity,mode==='exact-delete');
  assert.equal(JSON.parse(f.storage.get('catalog')).profiles.jorge.records[key].version,3);
  assert.equal(f.storage.get('queue'),queue);
  assert.deepEqual(JSON.parse(JSON.stringify(f.api.queue.pending().filter(op=>op.entityType==='workouts').map(op=>[op.mutation,op.version]))),[['upsert',2],['delete',3]]);
});
