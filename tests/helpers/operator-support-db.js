import assert from 'node:assert/strict';
export async function verifyOperatorSupport({test,client,as,uuid}){
 const q=(sql,args=[])=>client.query(sql,args),rpc=async request=>(await q('select public.operator_query_v3($1) as r',[request])).rows[0].r;
 async function check(name,fn){await test(name,async()=>{await q('reset role');await q('begin');try{await fn();}finally{await q('rollback');}});}
 async function denied(fn){await q('savepoint denied');try{await assert.rejects(fn);}finally{await q('rollback to savepoint denied');}}
 const event=(id,extra={})=>({id:uuid(id),event_name:'stale_session_blocked',profile_client_id:'person-2',release:'v118-operator-supportability-v1',platform:'ios',browser:'safari',mode:'standalone',surface:'recovery',category:'none',training_mode:'unknown',episode_id:uuid(9700),support_sequence:String(id-9400),active_unfinished:'yes',stale:'yes',finish_permitted:'no',discard_permitted:'no',blocker:'recovery',reconciliation:'blocked',pending_sync:'0',conflict_open:'yes',program_state:'in_sync',parity_verified_at:'unknown',completion_observed:'none',...extra});
 const ingest=e=>q('select public.record_product_event($1)',[e]);
 for(const n of [null,2,3,4])await check(`support owner-only reads reject ${n}`,async()=>{await as(n,n===null?'anon':'authenticated');for(const section of ['detail','reliability','attention'])await denied(()=>rpc({section,user_id:uuid(2)}));for(const table of ['private.operator_support_latest','private.operator_support_episodes','private.operator_support_people'])await denied(()=>q(`select * from ${table}`));});
 await check('support missing/expired coverage remains unknown',async()=>{
  await as(1);let r=await rpc({section:'detail',user_id:uuid(2)});assert.equal(r.support[0].finish_permitted,'unknown');assert.equal(r.support[0].status,'Coverage limited');
  await as(2);await ingest(event(9401));await q('reset role');await q("update private.product_events set received_at=now()-interval '31 minutes' where id=$1",[uuid(9401)]);await as(1);r=await rpc({section:'detail',user_id:uuid(2)});assert.equal(r.support[0].stale,'unknown');assert.equal(r.support[0].blocker,'unknown');
 });
 await check('support strict bounded fields, identity and privacy',async()=>{
  await as(2);for(const extra of [{email:'PRIVATE'},{payload:{private:true}},{blocker:'PRIVATE'},{pending_sync:'-1'},{pending_sync:'1001'},{program_state:'PRIVATE'},{parity_verified_at:'PRIVATE'},{profile_client_id:'person-1'},{support_sequence:'-1'},{finish_permitted:'yes'},{active_unfinished:'no'},{stale:'no'}])await denied(()=>ingest(event(9401,extra)));
  const incomplete=event(9401);delete incomplete.blocker;await denied(()=>ingest(incomplete));
 });
 await check('support blocked→ready→finish sequence, aggregation, attention and completion uncertainty',async()=>{
  await as(2);await ingest(event(9401));await q('reset role');await q("update private.product_events set received_at=now()-interval '20 minutes' where id=$1",[uuid(9401)]);await as(1);
  let d=await rpc({section:'detail',user_id:uuid(2)});assert.equal(d.support[0].status,'Needs attention');assert.equal(d.support[0].blocker,'recovery');assert.equal((await rpc({section:'attention'})).users.some(p=>p.blocked_attention),true);
  await as(2);await ingest(event(9402,{event_name:'stale_session_ready',finish_permitted:'yes',discard_permitted:'yes',blocker:'none',reconciliation:'verified',conflict_open:'no',parity_verified_at:new Date().toISOString()}));await as(1);d=await rpc({section:'detail',user_id:uuid(2)});assert.equal(d.support[0].status,'Recovered');assert.equal(d.support[0].finish_permitted,'yes');assert.ok(d.support[0].parity_verified_at);
  let r=await rpc({section:'reliability'});assert.equal(r.support_reliability.affected_users,1);assert.equal(r.support_reliability.automatically_recovered,1);assert.equal(r.support_reliability.median_ready_seconds,null);assert.equal(r.support_reliability.blockers[0].blocker,'recovery');
  assert.equal((await rpc({section:'reliability',platform:'windows'})).support_reliability.affected_users,0);
  await as(2);await ingest(event(9403,{event_name:'stale_session_finished',active_unfinished:'no',stale:'no',blocker:'none',conflict_open:'no',reconciliation:'verified',completion_observed:'once'}));await ingest(event(9403,{event_name:'stale_session_finished',active_unfinished:'no',stale:'no',blocker:'none',conflict_open:'no',reconciliation:'verified',completion_observed:'once'}));
  await as(1);d=await rpc({section:'detail',user_id:uuid(2)});assert.equal(d.support[0].active_unfinished,'no');assert.equal(d.support_completions[0].verification,'Completion observed once');assert.equal(d.support_completions[0].completions,1);r=await rpc({section:'reliability'});assert.equal(r.support_reliability.finished,1);assert.equal(r.support_reliability.unresolved,0);
  const events=d.events.filter(e=>e.support_sequence);assert.deepEqual(events.map(e=>e.event_name),['stale_session_blocked','stale_session_ready','stale_session_finished']);assert.equal(events[1].automatically_ready,true);assert.ok(events.every((e,i,a)=>!i||e.received_at>=a[i-1].received_at));assert.ok(!JSON.stringify(d.support).includes('sets'));
 });
 await check('support discard resolves without completion; sequence defeats receipt reordering',async()=>{
  await as(2);await ingest(event(9402,{event_name:'stale_session_discarded',active_unfinished:'no',stale:'no',blocker:'none'}));await ingest(event(9401));await as(1);const d=await rpc({section:'detail',user_id:uuid(2)});assert.equal(d.support[0].active_unfinished,'no');assert.equal(d.support_completions[0].completions,0);assert.equal(d.support_completions[0].discards,1);
 });
 await check('support three mature blocked→ready samples enable median without inflating people',async()=>{
  await as(2);for(let n=1;n<=3;n++){
   await ingest(event(9450+n*2,{episode_id:uuid(9800+n),support_sequence:'1'}));
   await ingest(event(9451+n*2,{episode_id:uuid(9800+n),support_sequence:'2',event_name:'stale_session_ready',finish_permitted:'yes',discard_permitted:'yes',blocker:'none'}));
  }
  await as(1);const r=(await rpc({section:'reliability'})).support_reliability;assert.equal(r.affected_users,1);assert.equal(r.blocked_episodes,3);assert.equal(r.ready_samples,3);assert.ok(r.median_ready_seconds>=0);
 });
 await check('support local duplicate observation cannot be labeled completion once',async()=>{
  await as(2);await ingest(event(9470,{event_name:'stale_session_finished',active_unfinished:'no',stale:'no',blocker:'none',completion_observed:'multiple'}));await as(1);
  assert.equal((await rpc({section:'detail',user_id:uuid(2)})).support_completions[0].verification,'Duplicate completion observed');
 });

}
