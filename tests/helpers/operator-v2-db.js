import assert from 'node:assert/strict';
export async function verifyOperatorV2({test,client,as,uuid}) {
 const q=(sql,args=[])=>client.query(sql,args),rpc=async request=>(await q('select public.operator_query_v2($1) as r',[request])).rows[0].r;
 async function check(name,fn){await test(name,async()=>{await q('reset role');await q('begin');try{await fn();}finally{await q('rollback');}});}
 async function denied(fn){await q('savepoint denied');try{await assert.rejects(fn);}finally{await q('rollback to savepoint denied');}}
 const event=(id,extra={})=>({id:uuid(id),event_name:'app_error',profile_client_id:'person-2',release:'v115-operator-reliability-v2',platform:'ios',browser:'safari',mode:'standalone',surface:'app',category:'resource',training_mode:'unknown',error_code:'resource_load',module_id:'app.js',lifecycle:'startup',error_class:'unknown',...extra});
 const ingest=async e=>q('select public.record_product_event($1)',[e]);
 async function signed(e){await q('reset role');e.diagnostic_fingerprint=(await q("select private.diagnostic_fingerprint(concat_ws('|',$1::text,$2::text,$3::text,$4::text,$5::text,$6::text)) as fp",[e.category,e.error_code,e.module_id,e.surface,e.lifecycle,e.error_class])).rows[0].fp;await as(2);return e;}
 await check('v2 canonical nested session start, completion, six hours, rollover and tombstone',async()=>{
  await q("update public.active_sessions set payload=jsonb_build_object('contract','big-gains.cloud-shadow.v1','entityType','activeSession','data',jsonb_build_object('workout',jsonb_build_object('startedAt',now()-interval '2 days'))) where account_id=$1 and profile_id=$2",[uuid(102),uuid(202)]);
  await as(1);let d=await rpc({section:'detail',user_id:uuid(2)});assert.equal(d.unfinished,1);assert.equal(d.over_six_hours,1);assert.ok(d.sessions.some(s=>s.utc_day_rollover===true));assert.ok(d.sessions.every(s=>s.started_at));
  await q('reset role');await q("update public.active_sessions set payload=jsonb_set(payload,'{data,workout,completedAt}',to_jsonb(now()::text)) where client_id='active'");await as(1);d=await rpc({section:'detail',user_id:uuid(2)});assert.equal(d.unfinished,0);
  await q('reset role');await q("update public.active_sessions set payload=payload #- '{data,workout,completedAt}' where client_id='active'");await q("insert into public.tombstones(account_id,profile_id,entity_type,entity_id,idempotency_key,version,deleted_at) values($1,$2,'active_sessions','active','v2-delete',2,now())",[uuid(102),uuid(202)]);await as(1);d=await rpc({section:'detail',user_id:uuid(2)});assert.equal(d.unfinished,0);
 });
 for(const n of [null,2,3,4])await check(`v2 authorization rejects identity ${n}`,async()=>{await as(n,n===null?'anon':'authenticated');for(const section of ['overview','traffic','detail','reliability','diagnostic'])await denied(()=>rpc({section,user_id:uuid(1)}));});
 await check('v2 valid diagnostic, SQL/client fingerprint parity, group users and timeline',async()=>{
  const e=await signed(event(9001));let h=2166136261;for(const c of [e.category,e.error_code,e.module_id,e.surface,e.lifecycle,e.error_class].join('|'))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;assert.equal(e.diagnostic_fingerprint,'BG-'+h.toString(16).padStart(8,'0').toUpperCase());
  await ingest(e);await ingest({...e,id:uuid(9002)});await as(1);const r=await rpc({section:'diagnostic',fingerprint:e.diagnostic_fingerprint});assert.equal(r.errors[0].occurrences,2);assert.equal(r.errors[0].people,1);assert.equal(r.affected_users[0].user_id,uuid(2));const d=await rpc({section:'detail',user_id:uuid(2)});assert.equal(d.events.filter(v=>v.diagnostic_fingerprint===e.diagnostic_fingerprint).length,2);assert.ok(d.events.every((v,i,a)=>!i||v.received_at>=a[i-1].received_at));
 });
 await check('v2 rejects arbitrary diagnostics, forged identities and telemetry reads',async()=>{
  const e=await signed(event(9010));for(const extra of [{message:'PRIVATE'},{url:'https://private.invalid/?token=SECRET'},{stack:'PRIVATE'},{module_id:'https://private.invalid'},{error_code:'PRIVATE'},{error_class:'PRIVATE'},{lifecycle:'PRIVATE'},{diagnostic_fingerprint:'BG-00000000'},{user_id:uuid(1)},{profile_client_id:'person-1'}])await denied(()=>ingest({...e,...extra}));await denied(()=>q('select * from private.product_events'));
 });
 await check('v2 conflict episodes distinguish presentations and verified resolution; legacy remains unknown',async()=>{
  await as(2);const e={id:uuid(9020),event_name:'conflict_detected',profile_client_id:'person-2',release:'v115-operator-reliability-v2',platform:'ios',browser:'safari',mode:'standalone',surface:'program',category:'none',episode_id:uuid(9990)};
  await ingest(e);await ingest({...e,id:uuid(9021),event_name:'conflict_presented'});await ingest({...e,id:uuid(9022),event_name:'conflict_presented'});await as(1);let r=await rpc({section:'reliability'});assert.equal(r.episode_total,1);assert.equal(r.presentations,2);assert.equal(r.unresolved_episodes,1);await as(2);await ingest({...e,id:uuid(9023),event_name:'conflict_resolved'});await as(1);r=await rpc({section:'reliability'});assert.equal(r.resolved_episodes,1);assert.equal(r.unresolved_episodes,0);
  await as(2);const legacy={...e,id:uuid(9024),event_name:'conflict_presented',release:'v114-operator-console-v1'};delete legacy.episode_id;await ingest(legacy);await as(1);r=await rpc({section:'reliability'});assert.equal(r.legacy_conflict_presentations,1);assert.equal(r.episode_total,1);
 });
 await check('v2 repeated app opens keep distinct users and returning definitions separate',async()=>{
  await as(2);for(const id of [9030,9031])await ingest({id:uuid(id),event_name:'app_open',profile_client_id:'person-2',release:'v115-operator-reliability-v2',platform:'ios',browser:'safari',mode:'browser',surface:'app'});
  await as(1);for(const days of [0,7,30]){const r=await rpc({section:'overview',days});assert.equal(r.observed_people,1);assert.equal(r.app_opens,3);assert.equal(r.returning_people,0);assert.equal(r.no_telemetry_people,3);}
  await q('reset role');await q("update private.product_first_opens set first_open_at=now()-interval '60 days' where user_id=$1",[uuid(2)]);await as(1);assert.equal((await rpc({section:'overview'})).returning_people,1);
 });
 await check('v2 visitor path bounded, anonymous write-only, no Auth identity or campaign conversion',async()=>{
  await as(null,'anon');const visit={session_id:uuid(9040),event_name:'visit',platform:'ios',browser:'safari',mode:'browser',source:'beta-wave-1'};
  const record=v=>q('select public.record_visitor_event($1)',[v]);await record(visit);await record(visit);await record({...visit,event_name:'signup_reached'});await record({...visit,event_name:'signup_started'});
  for(const extra of [{email:'PRIVATE'},{user_id:uuid(1)},{source:'https://private.invalid'},{event_name:'private'},{payload:{private:true}}])await denied(()=>record({...visit,...extra}));await denied(()=>q('select * from private.visitor_events'));
  await as(1);const r=await rpc({section:'traffic'});assert.equal(r.traffic[0].sessions,1);assert.equal(r.traffic[0].signup_started,1);assert.equal(r.visitor_windows.days7,1);
  await q('reset role');await q("update private.visitor_events set received_at=now()-interval '8 days' where event_name='visit'");await as(1);const outside=await rpc({section:'traffic',days:7});assert.equal(outside.traffic.length,0,'signup stages use the same arrival-session cohort as their denominator');
 });
 await check('v2 bounded pagination and filters reject arbitrary queries',async()=>{
  await as(1);assert.equal((await rpc({section:'users',search:'person2@'})).users.length,1);for(const extra of [{days:365},{platform:'PRIVATE'},{mode:'PRIVATE'},{fingerprint:'SECRET'},{sql:'select *'},{page:-1},{event:'PRIVATE'}])await denied(()=>rpc({section:'reliability',...extra}));
 });
}
