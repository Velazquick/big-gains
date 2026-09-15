import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import pg from 'pg';
import {verifyOperatorV2} from './helpers/operator-v2-db.js';

// This harness creates a fresh database. It refuses remote hosts.
const port = Number(process.env.OPERATOR_TEST_PG_PORT || 55432);
const config = { host: '127.0.0.1', port, user: 'postgres', password: process.env.PGPASSWORD, database: 'postgres' };
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
test('Operator database security and analytics contract on disposable PostgreSQL', async t => {
  const admin = new pg.Client(config); await admin.connect();
  const db = `operator_test_${Date.now()}`;
  await admin.query(`create database ${db}`);
  const client = new pg.Client({ ...config, database: db }); await client.connect();
  try {
    await client.query(`
      do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
      create schema auth;
      create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz,is_anonymous boolean default false);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema auth to authenticated,anon,service_role;
      create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin return; end$$;
    `);
    const paths = (await readdir('supabase/migrations')).filter(p=>p.endsWith('.sql')).sort();
    for (const path of paths.filter(p=>!p.includes('operator_'))) await client.query(await readFile(`supabase/migrations/${path}`,'utf8'));
    const policiesBefore = (await client.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows;
    for (const path of paths.filter(p=>p.includes('operator_'))) await client.query(await readFile(`supabase/migrations/${path}`,'utf8'));
    await t.test('existing RLS policies unchanged',async()=>assert.deepEqual((await client.query("select * from pg_policies where schemaname='public' order by tablename,policyname")).rows,policiesBefore));
    const as = async (user, role='authenticated') => {
      await client.query('reset role');
      await client.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user?uuid(user):'',JSON.stringify({session_id:uuid(900+(user||0))})]);
      await client.query(`set role ${role}`);
    };
    const rpc = async request => (await client.query('select public.operator_query($1) as result',[request])).rows[0].result;
    const denied = async fn => assert.rejects(fn, e=>['42501','22023','23514','22P02','23503','54000'].includes(e.code));
    await t.test('signed out cannot read access or query',async()=>{await as(null,'anon');await denied(()=>rpc({section:'overview'}));await denied(()=>client.query('select public.operator_access()'));});
    await client.query('reset role');
    for(let n=1;n<=4;n++) await client.query('insert into auth.users(id,email,created_at,email_confirmed_at) values($1,$2,now()-interval \'40 days\',$3)',[uuid(n),`person${n}@example.invalid`,n<4?new Date():null]);
    for(let n=1;n<=3;n++) await client.query('insert into auth.sessions(id,user_id) values($1,$2)',[uuid(900+n),uuid(n)]);
    await client.query("insert into private.product_operators(user_id,role) values($1,'owner')",[uuid(1)]);
    await as(1);
    await t.test('owner empty product dataset',async()=>{const r=await rpc({section:'overview'});assert.equal(r.registered,4);assert.equal(r.confirmed,3);assert.equal(r.activated,0);assert.equal(r.workouts_7d,0);});
    await client.query('reset role');
    for (const n of [1,2]) {
      await client.query('insert into public.accounts(id,owner_user_id,display_name) values($1,$2,$3)',[uuid(100+n),uuid(n),`Account ${n}`]);
      await client.query('insert into public.profiles(id,account_id,client_id,display_name) values($1,$2,$3,$4)',[uuid(200+n),uuid(100+n),`person-${n}`,`Person ${n}`]);
    }
    await client.query("insert into public.profiles(id,account_id,client_id,display_name) values($1,$2,'managed','Managed person')",[uuid(203),uuid(101)]);
    await client.query('insert into public.profile_memberships(user_id,account_id,profile_id) values($1,$2,$3)',[uuid(3),uuid(101),uuid(203)]);
    for (const n of [2,3,4]) await t.test(`non-operator ${n} cannot query/enumerate/escalate`,async()=>{
      await as(n); assert.equal((await client.query('select public.operator_access() as ok')).rows[0].ok,false);
      for(const section of ['overview','users','detail','funnel','reliability']) await denied(()=>rpc({section,user_id:uuid(1)}));
      for(const table of ['private.product_events','private.product_operators','private.operator_people','private.operator_profiles']) await denied(()=>client.query(`select * from ${table}`));
      await denied(()=>client.query("insert into private.product_operators(user_id,role) values($1,'owner')",[uuid(n)]));
    });
    await t.test('ordinary user RLS still isolates profiles',async()=>{await as(2);assert.deepEqual((await client.query('select id from public.profiles')).rows.map(r=>r.id),[uuid(202)]);});
    await t.test('managed member RLS still excludes owner profile',async()=>{await as(3);assert.deepEqual((await client.query('select id from public.profiles')).rows.map(r=>r.id),[uuid(203)]);});
    const event = (id, extra={}) => ({id:uuid(id),event_name:'app_open',profile_client_id:'person-2',release:'v114-operator-console-v1',platform:'windows',browser:'chrome',mode:'browser',surface:'app',...extra});
    const ingest = e => client.query('select public.record_product_event($1)',[e]);
    await as(2);
    await t.test('insert is write only and idempotent',async()=>{await ingest(event(501));await ingest(event(501));await denied(()=>client.query('select * from private.product_events'));});
    await t.test('forged profile and identity rejected',async()=>{await denied(()=>ingest(event(502,{profile_client_id:'person-1'})));await denied(()=>ingest(event(502,{user_id:uuid(1)})));await denied(()=>ingest(event(502,{account_id:uuid(101)})));});
    await t.test('malformed, oversized, arbitrary metadata and sensitive errors rejected',async()=>{
      for(const e of [null,[],{},event(502,{event_name:'anything'}),event(502,{surface:'private-notes'}),event(502,{category:'a@example.invalid Bearer SECRET workout={reps:99}'}),event(502,{message:'secret'}),event(502,{metadata:{sets:[1]}}),event(502,{release:'x'.repeat(2000)}),event(502,{platform:{}})]) await denied(()=>ingest(e));
    });
    await client.query('reset role');
    for (const [n,days,profile] of [[1,10,201],[2,1,201],[3,8,202],[4,2,203]]) {
      await client.query("insert into public.workouts(account_id,profile_id,client_id,idempotency_key,completed_at,payload) values($1,$2,$3,$3,now()-make_interval(days=>$4),$5)",
        [uuid(profile===202?102:101),uuid(profile),`workout-${n}`,days,{data:{programOrigin:n===2?{contract:'big-gains.program-origin.v1'}:null,notes:'PRIVATE SECRET',exercises:[{weight:400,reps:2}]}}]);
    }
    await client.query("insert into public.active_sessions(account_id,profile_id,client_id,idempotency_key,payload) values($1,$2,'active','active',jsonb_build_object('contract','big-gains.cloud-shadow.v1','entityType','activeSession','data',jsonb_build_object('workout',jsonb_build_object('startedAt',now()-interval '7 hours'))))",[uuid(102),uuid(202)]);
    await as(1);
    await t.test('activation counts, managed isolation, dates and counts',async()=>{
      const r=await rpc({section:'overview'});assert.equal(r.activated,3);assert.equal(r.two_workouts,1);assert.equal(r.four_workouts,0);assert.equal(r.workouts_7d,2);assert.equal(r.workouts_30d,4);assert.equal(r.over_six_hours,1);assert.equal(r.active_7d,1);assert.equal(r.telemetry_users_90d,1);assert.equal(r.time_to_first_eligible,3);
      const d=await rpc({section:'detail',user_id:uuid(1)});assert.equal(d.workouts,2);assert.ok(d.first_workout<d.second_workout);assert.ok(!JSON.stringify(d).includes('PRIVATE SECRET'));
    });
    await t.test('literal search, pagination and sorting',async()=>{
      assert.equal((await rpc({section:'users',search:'person2@'})).total,1);
      assert.equal((await rpc({section:'users',search:'%'})).total,0);
      assert.equal((await rpc({section:'users',page:1})).users.length,0);
      assert.equal((await rpc({section:'users',sort:'workouts'})).users[0].workouts,2);
      assert.equal((await rpc({section:'users',health:'stale'})).total,1);
    });
    await t.test('winning tombstone excludes completed History',async()=>{
      await client.query('reset role');await client.query("insert into public.tombstones(account_id,profile_id,entity_type,entity_id,idempotency_key,version,deleted_at) values($1,$2,'workouts','workout-3','deleted',2,now())",[uuid(102),uuid(202)]);
      await as(1);assert.equal((await rpc({section:'overview'})).activated,2);
    });
    await t.test('session revocation fails closed',async()=>{
      await client.query('reset role');await client.query('delete from auth.sessions where user_id=$1',[uuid(1)]);await as(1);await denied(()=>rpc({section:'users'}));
      await client.query('reset role');await client.query('insert into auth.sessions(id,user_id) values($1,$2)',[uuid(901),uuid(1)]);
    });
    await t.test('exact inclusive 7D/30D boundaries, releases, errors and recovery',async()=>{
      await client.query('reset role');await client.query('begin');
      try {
        await client.query("insert into private.product_releases values('v113-synthetic-older')");
        for(const [id,user,profile,age,name,release,category] of [[601,3,203,'7 days','app_open','v114-operator-console-v1','none'],[602,1,201,'7 days 0.001 seconds','app_open','v113-synthetic-older','none'],[603,1,201,'30 days','app_error','v113-synthetic-older','javascript'],[604,3,203,'2 days','conflict_presented','v114-operator-console-v1','none']]){
          await client.query("insert into private.product_events(id,user_id,account_id,profile_id,received_at,event_name,release,platform,browser,mode,surface,category) values($1,$2,$3,$4,now()-$5::interval,$6,$7,'ios','safari','browser','app',$8)",[uuid(id),uuid(user),uuid(user===2?102:101),uuid(profile),age,name,release,category]);
        }
        await as(1);let r=await rpc({section:'overview'});assert.equal(r.active_7d,2);assert.equal(r.active_30d,3);assert.equal(r.releases.length,2);
        r=await rpc({section:'reliability',days:30});assert.equal(r.errors[0].events,1);assert.equal(r.recovery[0].events,1);
        assert.equal((await rpc({section:'reliability',days:7})).errors.length,0);
        assert.equal((await rpc({section:'reliability',days:30,platform:'windows'})).errors.length,0);
      } finally {await client.query('rollback');}
    });
    await t.test('retention exact UTC days and mature denominators',async()=>{
      await client.query('reset role');await client.query('begin');
      try {
        await client.query("update private.product_first_opens set first_open_at=(date_trunc('day',now() at time zone 'UTC')-interval '35 days') at time zone 'UTC' where user_id=$1",[uuid(2)]);
        for(const [id,days] of [[610,34],[611,28],[612,21],[613,7]])await client.query("insert into private.product_events(id,user_id,account_id,profile_id,received_at,event_name,release,platform,browser,mode,surface) values($1,$2,$3,$4,(date_trunc('day',now() at time zone 'UTC')-make_interval(days=>$5)) at time zone 'UTC','app_open','v114-operator-console-v1','windows','chrome','browser','app')",[uuid(id),uuid(2),uuid(102),uuid(202),days]);
        await as(1);const r=await rpc({section:'funnel'});assert.deepEqual(r.retention.map(v=>[v.day,v.eligible,v.returned]),[[1,1,1],[7,1,1],[14,1,1],[28,1,1]]);
      }finally{await client.query('rollback');}
    });
    await t.test('500+ people use bounded pages with stable search and sort',async()=>{
      await client.query('reset role');await client.query('begin');
      try {
        await client.query("insert into auth.users(id,email) select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'scale'||i||'@example.invalid' from generate_series(1,501)i");
        await as(1);const r=await rpc({section:'users'});assert.equal(r.total,505);assert.equal(r.users.length,25);
        const last=await rpc({section:'users',page:20});assert.equal(last.users.length,5);
        assert.equal((await rpc({section:'users',search:'scale501@'})).users.length,1);
        assert.equal(new Set([...r.users,...(await rpc({section:'users',page:1})).users].map(p=>p.user_id)).size,50);
      }finally{await client.query('rollback');}
    });
    await t.test('persisted Program versus explicit Freeform and unknown use',async()=>{
      await client.query('reset role');await client.query('begin');
      try {
        await client.query("insert into public.program_domains(account_id,profile_id,payload,version,fingerprint,definitions_revision,definitions_fingerprint,heads_revision,heads_fingerprint,sequence_revision,sequence_fingerprint,idempotency_key,updated_at) values($1,$2,'{\"heads\":{\"activeProgramVersionId\":\"synthetic-active\"}}',1,repeat('a',64),1,repeat('a',64),1,repeat('a',64),1,repeat('a',64),'synthetic-program',now())",[uuid(101),uuid(201)]);
        await as(2);await ingest(event(680,{event_name:'workout_started',training_mode:'freeform'}));await as(1);
        const r=await rpc({section:'overview'});assert.equal(r.program_users,1);assert.equal(r.freeform_observed_7d,1);
        assert.equal((await rpc({section:'detail',user_id:uuid(3)})).freeform_observed,false);
      }finally{await client.query('rollback');}
    });
    await t.test('server ingestion rate limit',async()=>{
      await client.query('reset role');await client.query('begin');
      try{await as(2);for(let i=0;i<59;i++)await ingest(event(700+i));await denied(()=>ingest(event(800)));}finally{await client.query('rollback');}
    });
    await t.test('retention purge leaves cohort date and current events',async()=>{
      await client.query('reset role');await client.query('begin');
      try{await client.query("update private.product_events set received_at=now()-interval '91 days'");assert.equal(Number((await client.query('select private.purge_product_events() as n')).rows[0].n),1);assert.equal((await client.query('select count(*)::int as n from private.product_first_opens')).rows[0].n,1);}finally{await client.query('rollback');}
    });
    await verifyOperatorV2({test:(name,fn)=>t.test(name,fn),client,as,uuid});
    await t.test('account deletion cascades telemetry',async()=>{
      await client.query('reset role');await client.query('delete from public.accounts where id=$1',[uuid(102)]);
      assert.equal((await client.query('select count(*)::int as n from private.product_events where user_id=$1',[uuid(2)])).rows[0].n,0);
    });
  } finally { await client.end();await admin.query(`drop database ${db}`);await admin.end(); }
});
