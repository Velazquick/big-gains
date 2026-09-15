-- Operator v2: additive telemetry/reporting only. Never update training rows.
create or replace view private.operator_sessions as
select s.profile_id,private.operator_timestamp(s.payload#>>'{data,workout,startedAt}') as started_at
from public.active_sessions s
where s.payload#>>'{data,workout,completedAt}' is null
and not exists(select 1 from public.tombstones t where t.account_id=s.account_id and t.profile_id=s.profile_id
  and t.entity_type='active_sessions' and t.entity_id=s.client_id
  and (t.version>s.version or (t.version=s.version and t.deleted_at>=s.updated_at)));
revoke all on private.operator_sessions from public,anon,authenticated;

insert into private.product_releases values ('v115-operator-reliability-v2') on conflict do nothing;
alter table private.product_events add column error_code text, add column module_id text,
 add column lifecycle text, add column error_class text, add column diagnostic_fingerprint text, add column episode_id uuid;
alter table private.product_events drop constraint product_events_event_name_check;
alter table private.product_events add constraint product_events_event_name_check check(event_name in
 ('app_open','workout_started','workout_completed','program_adopted','exercise_swapped','stale_session_recovery_shown','stale_session_resumed','stale_session_finished','stale_session_discarded','recovery_required','conflict_detected','conflict_presented','conflict_resolved','app_error'));
create index product_events_diagnostic_time on private.product_events(diagnostic_fingerprint,received_at desc) where diagnostic_fingerprint is not null;
create index product_events_episode_time on private.product_events(user_id,profile_id,episode_id,received_at desc) where episode_id is not null;
create index product_events_open_time on private.product_events(received_at,user_id) where event_name='app_open';
create function private.diagnostic_fingerprint(value text) returns text language plpgsql immutable set search_path='' as $$
declare h bigint:=2166136261; i integer;
begin for i in 1..length(value) loop h:=((h # ascii(substr(value,i,1))) * 16777619) & 4294967295; end loop;
return 'BG-'||upper(lpad(to_hex(h),8,'0')); end; $$;
revoke all on function private.diagnostic_fingerprint(text) from public,anon,authenticated;
create or replace function private.ingest_product_event(event jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); target public.profiles; event_id uuid; fp text;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null
    and deleted_at is null and not coalesce(is_anonymous,false) and (banned_until is null or banned_until<now())) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if event is null or jsonb_typeof(event)<>'object' or octet_length(event::text)>1024
    or (event - array['id','event_name','profile_client_id','release','platform','browser','mode','surface','category','training_mode','error_code','module_id','lifecycle','error_class','diagnostic_fingerprint','episode_id'])<>'{}'::jsonb
    or not (event ?& array['id','event_name','profile_client_id','release','platform','browser','mode','surface'])
    or exists(select 1 from jsonb_each(event) e where jsonb_typeof(e.value)<>'string') then
    raise exception 'Invalid event contract' using errcode='22023';
  end if;
  if event ? 'diagnostic_fingerprint' then
    if event->>'event_name'<>'app_error' or not(event ?& array['error_code','module_id','lifecycle','error_class'])
      or event->>'error_code' not in ('unknown','js_exception','unhandled_promise','resource_load','asset_load','asset_execute','sw_registration','sw_update','sw_resource','cache_unavailable','network_unavailable','application_failure')
      or event->>'module_id' not in ('public-telemetry.js','account-context.js','account-onboarding.js','alexa-contrast-v22.css','alexa-shell.js','analytics.js','app.js','appearance-model.js','appearance.css','asset-loader.js','astra-ui.css','auth-setup-loader.js','auth-setup.css','auth-setup.html','auth-setup.js','boot-render-gate.js','cloud-config.js','cloud-shadow.js','cloud-storage.js','cloud-sync.css','cloud-sync.js','controlled-migration.css','controlled-migration.js','design-v21.css','design-v21.js','exercise-catalog.js','exercise-picker.css','exercise-picker.js','goals-progression.js','goals-train-guidance.js','goals.css','goals.js','history-explorer-v75.css','icon.svg','index.html','jorge-train-v52.css','managed-profile-recovery.js','manifest.webmanifest','measurement-units.js','migration-engine.js','migration-preview.css','migration-preview.js','moss-cards-v24.css','notes.js','profile-appearance.js','profiles.css','profiles.js','program-analyzer.js','program-domain-cutover.js','program-domain-envelope.js','program-domain-recovery.js','program-domain-sync.js','program-model.js','program-origin.js','program-portability.js','program-setup.css','program-setup.js','programming-application.js','programming-engine.js','programming-review.js','progress-dashboard-v56.css','progress.js','pwa-update.css','pwa-update.js','reconciliation-control.js','retrospective-workout.css','retrospective-workout.js','routine-engine.js','routine-prescription-v58.css','runtime-interactivity-gate.js','service-worker-core.js','session-selector-v26.css','session-selector-v26.js','settings.css','shell-init.js','state-persistence.js','styles.css','supabase-client.js','supabase.js','sync-gateway.css','sync-gateway.js','timer-controller.js','timer-ready.wav','train-position.js','training-calendar.css','training-pet.css','training-pet.js','unknown','user-data-export.css','user-data-export.js','v2-shell.css','v2-shell.js','workout-controls.css','workout-controls.js','workout-mode.css','workout-mode.js','workout-session-controller.js')
      or event->>'lifecycle' not in ('unknown','startup','interactive','background','recovery')
      or event->>'error_class' not in ('unknown','Error','TypeError','SyntaxError','ReferenceError','RangeError','URIError','EvalError','AggregateError') then
      raise exception 'Invalid diagnostic contract' using errcode='22023'; end if;
    fp:=private.diagnostic_fingerprint(concat_ws('|',event->>'category',event->>'error_code',event->>'module_id',event->>'surface',event->>'lifecycle',event->>'error_class'));
    if event->>'diagnostic_fingerprint'<>fp then raise exception 'Invalid fingerprint' using errcode='22023'; end if;
  elsif event ?| array['error_code','module_id','lifecycle','error_class'] then raise exception 'Incomplete diagnostic contract' using errcode='22023'; end if;
  if event ? 'episode_id' and (event->>'event_name' not in ('conflict_detected','conflict_presented','conflict_resolved') or event->>'surface' not in ('program','recovery')) then
    raise exception 'Invalid episode contract' using errcode='22023'; end if;
  if event->>'release'='v115-operator-reliability-v2' and ((event->>'event_name'='app_error' and fp is null)
     or (event->>'event_name' in ('conflict_detected','conflict_presented','conflict_resolved') and not(event ? 'episode_id'))) then
    raise exception 'V2 identity required' using errcode='22023'; end if;
  event_id:=(event->>'id')::uuid;
  select p.* into target from public.profiles p
    where p.client_id=event->>'profile_client_id' and private.can_access_profile(p.account_id,p.id)
    limit 1;
  if target.id is null then raise exception 'Profile access denied' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('telemetry:'||actor::text,0));
  if (select count(*) from private.product_events where user_id=actor and received_at>now()-interval '1 minute')>=60
    or (select count(*) from private.product_events where user_id=actor and received_at>now()-interval '1 day')>=600 then
    raise exception 'Event limit' using errcode='54000';
  end if;
  insert into private.product_events(id,user_id,account_id,profile_id,event_name,release,platform,browser,mode,surface,category,training_mode,error_code,module_id,lifecycle,error_class,diagnostic_fingerprint,episode_id)
    values(event_id,actor,target.account_id,target.id,event->>'event_name',event->>'release',event->>'platform',event->>'browser',event->>'mode',event->>'surface',coalesce(event->>'category','none'),coalesce(event->>'training_mode','unknown'),event->>'error_code',event->>'module_id',event->>'lifecycle',event->>'error_class',fp,(event->>'episode_id')::uuid)
    on conflict(id) do nothing;
  if event->>'event_name'='app_open' then
    insert into private.product_first_opens(user_id,account_id,profile_id) values(actor,target.account_id,target.id)
      on conflict(user_id) do nothing;
  end if;
end;
$$;

-- Public arrival observations are deliberately unlinkable to an Auth identity.
create table private.visitor_events (
 session_id uuid not null,event_name text not null check(event_name in ('visit','signup_reached','signup_started')),
 received_at timestamptz not null default clock_timestamp(),
 platform text not null check(platform in ('ios','android','windows','mac','linux','other')),
 browser text not null check(browser in ('safari','chrome','edge','firefox','other')),
 mode text not null check(mode in ('browser','standalone')),
 source text not null check(source in ('direct','beta-wave-1','beta-wave-2')),
 primary key(session_id,event_name)
);
alter table private.visitor_events enable row level security;
revoke all on private.visitor_events from public,anon,authenticated;
create index visitor_events_time on private.visitor_events(received_at);
create index visitor_events_source_time on private.visitor_events(source,received_at);
create function private.ingest_visitor_event(event jsonb) returns void language plpgsql security definer set search_path='' as $$
declare first_seen timestamptz; first_visit private.visitor_events;
begin
 if event is null or jsonb_typeof(event)<>'object' or octet_length(event::text)>512
   or not(event ?& array['session_id','event_name','platform','browser','mode','source'])
   or (event-array['session_id','event_name','platform','browser','mode','source'])<>'{}'
   or exists(select 1 from jsonb_each(event) e where jsonb_typeof(e.value)<>'string') then
   raise exception 'Invalid visitor contract' using errcode='22023';end if;
 -- Bounded global acceptance budget limits storage/work; no IP identifier is stored.
 -- Not bot-proof: these are accepted observations, never unique-human counts.
 perform pg_advisory_xact_lock(115002);
 if (select count(*) from private.visitor_events where received_at>now()-interval '1 minute')>=300
 or (select count(*) from private.visitor_events where received_at>now()-interval '1 day')>=10000 then return;end if;
 select * into first_visit from private.visitor_events where session_id=(event->>'session_id')::uuid and event_name='visit';
 first_seen:=first_visit.received_at;
 if first_seen is not null and (first_visit.source<>event->>'source' or first_visit.platform<>event->>'platform' or first_visit.browser<>event->>'browser' or first_visit.mode<>event->>'mode') then raise exception 'Visitor session mismatch' using errcode='22023';end if;
 if first_seen is not null and first_seen<now()-interval '30 minutes' then return;end if;
 if first_seen is null and event->>'event_name'<>'visit' then return;end if;
 insert into private.visitor_events(session_id,event_name,platform,browser,mode,source)
 values((event->>'session_id')::uuid,event->>'event_name',event->>'platform',event->>'browser',event->>'mode',event->>'source') on conflict do nothing;
end;$$;
revoke all on function private.ingest_visitor_event(jsonb) from public;
revoke all on function private.ingest_visitor_event(jsonb) from anon,authenticated;
create function public.record_visitor_event(event jsonb) returns void language sql security definer set search_path='' as $$ select private.ingest_visitor_event(event); $$;
revoke all on function public.record_visitor_event(jsonb) from public;
grant execute on function public.record_visitor_event(jsonb) to anon,authenticated;
-- Public wrapper is the only anonymous entry point; no private schema usage grant.
-- Existing private objects remain individually revoked. Only the bounded write RPC is public.
create or replace function private.purge_product_events() returns bigint language plpgsql security definer set search_path='' as $$
declare removed bigint;begin delete from private.product_events where received_at<now()-interval '90 days';get diagnostics removed=row_count;
delete from private.visitor_events where received_at<now()-interval '30 days';return removed;end;$$;

create view private.operator_episodes as
select user_id,account_id,profile_id,episode_id,surface,
 min(received_at) as first_seen,max(received_at) as last_seen,
 count(*) filter(where event_name='conflict_presented') as presentations,
 bool_or(event_name='conflict_detected') as detected,bool_or(event_name='conflict_resolved') as resolved,
 array_agg(distinct release) as releases,array_agg(distinct platform) as platforms,array_agg(distinct platform||' / '||browser||' / '||mode) as environments
from private.product_events where episode_id is not null and received_at>=now()-interval '90 days'
group by user_id,account_id,profile_id,episode_id,surface;
revoke all on private.operator_episodes from public,anon,authenticated;
-- Keep the fully authorized v1 query for backward-compatible clients during deploy.
create function private.operator_query_v2(request jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare section text; result jsonb; since_time timestamptz; page_number integer; days integer; target uuid;
 release_filter text; platform_filter text; browser_filter text; mode_filter text; fp text; signal text; source_filter text;
 base_request jsonb; rows_json jsonb;
begin
 if not private.operator_authorized() then raise exception 'Operator access denied' using errcode='42501';end if;
 if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>1536
 or (request-array['section','search','page','days','release','platform','browser','mode','user_id','sort','health','fingerprint','signal','source','event'])<>'{}' then raise exception 'Invalid query' using errcode='22023';end if;
 section:=request->>'section';page_number:=coalesce((request->>'page')::integer,0);days:=coalesce((request->>'days')::integer,7);
 if page_number<0 or page_number>10000 or days not in (0,7,30,90) then raise exception 'Invalid window' using errcode='22023';end if;
 since_time:=case when days=0 then date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' else now()-make_interval(days=>days) end;
 release_filter:=nullif(request->>'release','');platform_filter:=nullif(request->>'platform','');browser_filter:=nullif(request->>'browser','');mode_filter:=nullif(request->>'mode','');fp:=nullif(request->>'fingerprint','');signal:=coalesce(nullif(request->>'signal',''),'all');source_filter:=nullif(request->>'source','');
 if length(coalesce(release_filter,''))>80 or (platform_filter is not null and platform_filter not in ('ios','android','windows','mac','linux','other'))
 or (browser_filter is not null and browser_filter not in ('safari','chrome','edge','firefox','other'))
 or (mode_filter is not null and mode_filter not in ('standalone','browser'))
 or (fp is not null and fp !~ '^BG-[0-9A-F]{8}$') or signal not in ('all','errors','conflicts','recovery')
 or (source_filter is not null and source_filter not in ('direct','beta-wave-1','beta-wave-2'))
 or (coalesce(request->>'event','') not in ('','app_open','workout_started','workout_completed','app_error','conflict_detected','conflict_presented','conflict_resolved','recovery_required','stale_session_recovery_shown')) then raise exception 'Invalid filter' using errcode='22023';end if;
 base_request:=jsonb_build_object('section',case when section='overview' then 'funnel' when section in ('funnel','users','detail') then section else 'overview' end,'days',greatest(days,1),'page',page_number,'search',coalesce(request->>'search',''),'sort',coalesce(request->>'sort','joined'),'health',case when request->>'health' in ('conflicts','unconfirmed') then 'all' else coalesce(request->>'health','all') end);
 if section='detail' then base_request:=base_request||jsonb_build_object('user_id',request->>'user_id');end if;
 if section in ('overview','traffic','funnel','users','detail') then result:=private.operator_query(base_request);else result:='{}';end if;
 if section in ('overview','funnel','traffic') then
   result:=result || (select jsonb_build_object('observed_people',count(distinct user_id) filter(where event_name='app_open'),
    'app_opens',count(*) filter(where event_name='app_open'),'error_people',count(distinct user_id) filter(where event_name='app_error'),
    'coverage_people',count(distinct user_id),'last_event',max(received_at)) from private.product_events where received_at>=since_time);
   result:=result || (select jsonb_build_object('new_registrations',count(*) filter(where joined>=since_time),
    'no_telemetry_people',count(*) filter(where not exists(select 1 from private.product_events e where e.user_id=p.user_id and e.received_at>=since_time)),
    'stale_people',count(*) filter(where over_six_hours>0),'unfinished_people',count(*) filter(where unfinished>0)) from private.operator_people p);
   result:=result || (select jsonb_build_object('returning_people',count(distinct e.user_id)) from private.product_events e join private.product_first_opens f using(user_id)
    where e.event_name='app_open' and e.received_at>=since_time and f.first_open_at<since_time);
   result:=result || (select jsonb_build_object('unresolved_episode_people',count(distinct user_id) filter(where not resolved),
    'unresolved_episodes',count(*) filter(where not resolved)) from private.operator_episodes);
   result:=result || (select jsonb_build_object('new_fingerprints',count(*)) from (select diagnostic_fingerprint from private.product_events where diagnostic_fingerprint is not null group by diagnostic_fingerprint having min(received_at)>=since_time) d);
   result:=result || (select jsonb_build_object('period_workouts',count(*),'workouts_per_training_person',count(*)::numeric/nullif(count(distinct p.user_id),0))
    from private.operator_workouts w join private.operator_profiles p on p.id=w.profile_id where w.completed_at>=since_time and w.completed_at<=now());
   result:=result || jsonb_build_object('daily',coalesce((select jsonb_agg(to_jsonb(d) order by day) from (
    select g.day::date as day,(select count(distinct user_id) from private.product_events e where e.event_name='app_open' and e.received_at>=greatest(g.day,since_time) and e.received_at<g.day+interval '1 day') as people,
    (select count(*) from private.product_events e where e.event_name='app_open' and e.received_at>=greatest(g.day,since_time) and e.received_at<g.day+interval '1 day') as opens,
    (select count(*) from private.operator_workouts w where w.completed_at>=greatest(g.day,since_time) and w.completed_at<g.day+interval '1 day' and w.completed_at<=now()) as workouts
    from generate_series(date_trunc('day',since_time at time zone 'UTC') at time zone 'UTC',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',interval '1 day') g(day))d),'[]'));
   result:=result || jsonb_build_object('pulse',coalesce((select jsonb_agg(to_jsonb(q) order by q.at desc) from (
    (select received_at as at,event_name as event,user_id,diagnostic_fingerprint from private.product_events order by received_at desc limit 15)
    union all (select joined,'account_created',user_id,null from private.operator_people order by joined desc limit 5)
    union all (select confirmed,'account_confirmed',user_id,null from private.operator_people where confirmed is not null order by confirmed desc limit 5)
    order by at desc limit 15)q),'[]'));
 end if;
 if section in ('overview','traffic','funnel') then
   result:=result||jsonb_build_object('traffic',coalesce((select jsonb_agg(to_jsonb(t)) from (
    select v.source,count(*) filter(where e.event_name='visit') as sessions,count(*) filter(where e.event_name='signup_reached') as signup_reached,count(*) filter(where e.event_name='signup_started') as signup_started
    from private.visitor_events v join private.visitor_events e using(session_id) where v.event_name='visit' and v.received_at>=since_time and (source_filter is null or v.source=source_filter) group by v.source)t),'[]'),
    'visitor_windows',(select jsonb_build_object('today',count(*) filter(where received_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),'days7',count(*) filter(where received_at>=now()-interval '7 days'),'days30',count(*)) from private.visitor_events where event_name='visit' and received_at>=now()-interval '30 days'),
    'visitor_environments',coalesce((select jsonb_agg(to_jsonb(t)) from (select platform,browser,mode,count(*) as sessions from private.visitor_events where event_name='visit' and received_at>=since_time group by platform,browser,mode)t),'[]'));
 end if;
 if section='users' then
   if request->>'health' in ('conflicts','unconfirmed') then
     with filtered as(select * from private.operator_people p where
       (coalesce(request->>'search','')='' or strpos(lower(p.display_name),lower(request->>'search'))>0 or strpos(lower(coalesce(p.email,'')),lower(request->>'search'))>0)
       and ((request->>'health'='unconfirmed' and confirmed is null) or (request->>'health'='conflicts' and exists(select 1 from private.operator_episodes e where e.user_id=p.user_id and not resolved)))),
     page_rows as(select * from filtered order by case when request->>'sort'='activity' then last_activity end desc nulls last,case when request->>'sort'='workouts' then workouts end desc nulls last,joined desc,user_id limit 25 offset page_number*25)
     select result||jsonb_build_object('total',(select count(*) from filtered),'users',coalesce((select jsonb_agg(to_jsonb(p)) from page_rows p),'[]')) into result;
   end if;
   result:=result||jsonb_build_object('users',coalesce((select jsonb_agg(p||jsonb_build_object('open_episodes',(select count(*) from private.operator_episodes e where e.user_id=(p->>'user_id')::uuid and not resolved))) from jsonb_array_elements(result->'users') p),'[]'));
 end if;
 if section='detail' then
   target:=(request->>'user_id')::uuid;
   result:=result||jsonb_build_object('open_episodes',(select count(*) from private.operator_episodes where user_id=target and not resolved),'latest_workout_started',(select max(at) from (
    select max(received_at) as at from private.product_events where user_id=target and event_name='workout_started'
    union all select max(started_at) from private.operator_sessions s join private.operator_profiles p on p.id=s.profile_id where p.user_id=target)t),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('started_at',s.started_at,'age_hours',extract(epoch from(now()-s.started_at))/3600,'over_six_hours',s.started_at<=now()-interval '6 hours','utc_day_rollover',(s.started_at at time zone 'UTC')::date<(now() at time zone 'UTC')::date)) from private.operator_sessions s join private.operator_profiles p on p.id=s.profile_id where p.user_id=target),'[]'),
    'episodes',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from private.operator_episodes where user_id=target order by last_seen desc limit 25)q),'[]'),
    'diagnostics',coalesce((select jsonb_agg(to_jsonb(q)) from (select diagnostic_fingerprint,count(*) as occurrences,max(received_at) as last_seen from private.product_events where user_id=target and event_name='app_error' and received_at>=since_time group by diagnostic_fingerprint order by last_seen desc limit 25)q),'[]'),
    'event_total',(select count(*) from private.product_events where user_id=target and received_at>=since_time and (coalesce(request->>'event','')='' or event_name=request->>'event')),
    'events',coalesce((select jsonb_agg(to_jsonb(q) order by received_at,id) from (select id,received_at,event_name,release,platform,browser,mode,surface,category,diagnostic_fingerprint,episode_id,lifecycle,error_code,module_id from private.product_events where user_id=target and received_at>=since_time and (coalesce(request->>'event','')='' or event_name=request->>'event') order by received_at,id limit 50 offset page_number*50)q),'[]'));
 end if;
 if section in ('reliability','diagnostic') then
   with filtered as (select * from private.product_events where received_at>=since_time
     and (release_filter is null or release=release_filter) and (platform_filter is null or platform=platform_filter)
     and (browser_filter is null or browser=browser_filter) and (mode_filter is null or mode=mode_filter)
     and (fp is null or diagnostic_fingerprint=fp)),
   errors as(select diagnostic_fingerprint,category,surface,error_code,module_id,lifecycle,error_class,count(*) as occurrences,count(distinct user_id) as people,
     min(received_at) as first_seen,max(received_at) as last_seen,array_agg(distinct release) as releases,
     array_agg(distinct platform||' / '||browser||' / '||mode) as environments
     from filtered where event_name='app_error' group by diagnostic_fingerprint,category,surface,error_code,module_id,lifecycle,error_class),
   episode_ids as(select distinct episode_id from filtered where episode_id is not null),
   episodes as(select * from private.operator_episodes where episode_id in(select episode_id from episode_ids)),
   recovery as(select event_name,count(*) as occurrences,count(distinct user_id) as people,min(received_at) as first_seen,max(received_at) as last_seen from filtered where event_name like 'stale_%' or event_name='recovery_required' group by event_name)
   select jsonb_build_object('errors',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from errors order by last_seen desc limit 25 offset case when section='diagnostic' then 0 else page_number*25 end)q),'[]'),
    'error_group_total',(select count(*) from errors),'episodes',coalesce((select jsonb_agg(to_jsonb(q)) from (select * from episodes order by last_seen desc limit 25 offset page_number*25)q),'[]'),
    'episode_total',(select count(*) from episodes),'episode_people',(select count(distinct user_id) from episodes),
    'detected_episodes',(select count(*) from episodes where detected),'resolved_episodes',(select count(*) from episodes where resolved),
    'unresolved_episodes',(select count(*) from episodes where not resolved),'presentations',(select coalesce(sum(presentations),0) from episodes),
    'legacy_conflict_presentations',(select count(*) from filtered where event_name='conflict_presented' and episode_id is null),
    'legacy_conflict_people',(select count(distinct user_id) from filtered where event_name='conflict_presented' and episode_id is null),
    'recovery',coalesce((select jsonb_agg(to_jsonb(recovery)) from recovery),'[]'),
    'observed_users',(select count(distinct user_id) from filtered),'last_event',(select max(received_at) from filtered),
    'releases',coalesce((select jsonb_agg(to_jsonb(q)) from(select release,count(distinct user_id) as people,count(*) as occurrences from filtered group by release)q),'[]'),
    'affected_users',coalesce((select jsonb_agg(to_jsonb(q)) from(select e.user_id,p.display_name,count(*) as occurrences from filtered e join private.operator_people p using(user_id) where event_name='app_error' group by e.user_id,p.display_name order by max(received_at) desc limit 25 offset page_number*25)q),'[]'),
    'affected_user_total',(select count(distinct user_id) from filtered where event_name='app_error'),
    'occurrences',coalesce((select jsonb_agg(to_jsonb(q)) from(select user_id,received_at,event_name,diagnostic_fingerprint,release,platform,browser,mode from filtered where event_name='app_error' order by received_at desc limit 50)q),'[]')) into result;
 end if;
 if section='diagnostic' then
   result:=result||jsonb_build_object('nearby',coalesce((select jsonb_agg(to_jsonb(n) order by n.received_at,n.id) from (
    select distinct e.id,e.user_id,e.received_at,e.event_name,e.diagnostic_fingerprint,e.release,e.platform,e.browser,e.mode
    from (select user_id,received_at from private.product_events where diagnostic_fingerprint=fp and received_at>=since_time
      and (release_filter is null or release=release_filter) and (platform_filter is null or platform=platform_filter)
      and (browser_filter is null or browser=browser_filter) and (mode_filter is null or mode=mode_filter)
      order by received_at desc limit 3) a
    cross join lateral(select id,user_id,received_at,event_name,diagnostic_fingerprint,release,platform,browser,mode from private.product_events e where e.user_id=a.user_id and e.received_at between a.received_at-interval '2 minutes' and a.received_at+interval '2 minutes' order by abs(extract(epoch from(e.received_at-a.received_at))),e.id limit 8)e)n),'[]'));
 end if;
 if section not in ('overview','traffic','funnel','users','detail','reliability','diagnostic') then raise exception 'Unknown section' using errcode='22023';end if;
 return result||jsonb_build_object('as_of',now(),'metric_contract','operator-v2','days',days,'page',page_number,'calendar_timezone','UTC');
end;$$;
revoke all on function private.operator_query_v2(jsonb) from public,anon;
grant execute on function private.operator_query_v2(jsonb) to authenticated;
create function public.operator_query_v2(request jsonb) returns jsonb language sql security invoker set search_path='' as $$ select private.operator_query_v2(request); $$;
revoke all on function public.operator_query_v2(jsonb) from public,anon;
grant execute on function public.operator_query_v2(jsonb) to authenticated;
