import { test, expect } from '@playwright/test';
import { blankState, activeWorkout, completedWorkout } from './fixtures/local-storage.js';
import { openApp, reloadApp } from './helpers/app.js';

test.use({ serviceWorkers: 'block' });

async function seed(page, age = 24) {
  await page.context().route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const workout = activeWorkout({startedAt:new Date(Date.now()-age*3600000).toISOString()});
  workout.exercises[0].sets[1].completed = true;
  await page.addInitScript(value => {
    if(localStorage.getItem('reliability-finish-seed'))return;
    localStorage.setItem('big-gains-active-profile','jorge');
    localStorage.setItem('big-gains-v2',JSON.stringify(value));
    localStorage.setItem('reliability-finish-seed','yes');
  },{...blankState('jorge'),workouts:[completedWorkout()],activeWorkout:workout});
  await openApp(page);
}

for(const patch of [{pending:1},{busy:true},{comparing:true},{capturePending:1},{reconciliationInFlight:true},{lastComparison:{parity:false}},{lastResult:{blocked:true}}]) {
  test(`local Finish remains available with outbound ${JSON.stringify(patch)}`,async({page,context})=>{
    await seed(page);
    const before=await page.evaluate(patch=>{
      const api=BigGainsCloudSync;
      const op=BigGainsCloud.createOperation({owner:{accountId:'synthetic-account',profileId:'synthetic-profile'},entityType:'workouts',entityId:'retained-pending',mutation:'upsert',version:1,updatedAt:'2026-10-22T12:00:00.000Z',payload:{id:'retained-pending'},synthetic:true});
      api.queue.enqueue(op);
      window.BigGainsCloudSync={...api,status:()=>({...api.status(),...patch})};
      renderStaleRecovery();
      return {queue:localStorage.getItem(bigGainsAccounts.runtime.cloudKeys.queue),id:active.id,set:structuredClone(active.exercises[0].sets[1]),history:structuredClone(state.workouts)};
    },patch);
    await context.setOffline(true);
    await expect(page.locator('#staleWorkoutFinish')).toBeEnabled();
    await page.locator('#staleWorkoutFinish').click();
    const after=await page.evaluate(()=>({raw:JSON.parse(localStorage.getItem(ACCOUNT.storageKey)),queue:localStorage.getItem(bigGainsAccounts.runtime.cloudKeys.queue),repeat:workoutSessionController.complete()}));
    expect(after.repeat).toBe(false);
    expect(after.raw.activeWorkout).toBeNull();
    expect(after.raw.workouts.filter(w=>w.id===before.id)).toHaveLength(1);
    expect(after.raw.workouts[0].exercises[0].sets).toEqual([before.set]);
    expect(after.raw.workouts.slice(1)).toEqual(before.history);
    expect(after.queue).toBe(before.queue);
    // Worker-blocked test: restore loopback transport for reload, while all
    // external delivery remains denied. Genuine offline shell has its own suite.
    await context.setOffline(false);
    await reloadApp(page);
    expect(await page.evaluate(()=>state.workouts.filter(w=>w.id==='active-push-1').length)).toBe(1);
    expect(await page.evaluate(()=>active)).toBeNull();
    expect(await page.evaluate(()=>localStorage.getItem(bigGainsAccounts.runtime.cloudKeys.queue))).toBe(before.queue);
  });
}

test('partial delivery and lost History ACK preserve the original retry identity and local completion',async({page})=>{
  await seed(page,0);
  expect(await page.evaluate(()=>workoutSessionController.complete())).toBe(true);
  const proof=await page.evaluate(async()=>{
    const raw=localStorage.getItem(ACCOUNT.storageKey), api=BigGainsCloudSync;
    const q=BigGainsCloud.createDurableQueue({key:'synthetic-completion-delivery'});
    const make=(entityType,mutation)=>BigGainsCloud.createOperation({owner:{accountId:'synthetic-account',profileId:'synthetic-profile'},entityType,entityId:'active-push-1',mutation,version:1,updatedAt:'2026-10-22T12:00:00.000Z',...(mutation==='upsert'?{payload:state.workouts[0]}:{})});
    const history=make('workouts','upsert'), removal=make('active_sessions','delete');
    q.enqueue(history);q.enqueue(removal);
    const delivered=new Set();let fail=true;
    const runtime=api.createSyncRuntime({durableQueue:q,isOnline:()=>true,transport:{enabled:true,async send(op){delivered.add(op.idempotencyKey);if(op.entityType==='workouts'&&fail)throw Error('Synthetic lost ACK');return {ok:true,remoteVersion:op.version};}}});
    const first=await runtime.flush();
    const retained=q.pending().map(op=>op.idempotencyKey),ack=q.acknowledgement(removal.idempotencyKey);
    fail=false;const second=await runtime.flush();
    return {first,second,historyKey:history.idempotencyKey,retained,tombstoneAcknowledged:!!ack,delivered:[...delivered],historyAck:!!q.acknowledgement(history.idempotencyKey),unchanged:localStorage.getItem(ACCOUNT.storageKey)===raw};
  });
  expect(proof.first.pending).toBe(1);expect(proof.tombstoneAcknowledged).toBe(true);
  expect(proof.retained).toEqual([proof.historyKey]);expect(proof.second.pending).toBe(0);
  expect(proof.delivered).toHaveLength(2);expect(proof.historyAck).toBe(true);expect(proof.unchanged).toBe(true);
});
