-- Bounded support observations only; no training/Auth/RLS repair or data mutation.
insert into private.product_releases values ('v118-operator-supportability-v1') on conflict do nothing;
alter table private.product_events drop constraint product_events_event_name_check;
alter table private.product_events add constraint product_events_event_name_check check(event_name in
 ('app_open','workout_started','workout_completed','program_adopted','exercise_swapped','stale_session_recovery_shown','stale_session_resumed','stale_session_finished','stale_session_discarded','recovery_required','conflict_detected','conflict_presented','conflict_resolved','app_error','support_state_observed','stale_session_presented','stale_session_blocked','stale_session_ready'));
alter table private.product_events add column support_sequence text, add column active_unfinished text, add column stale text, add column finish_permitted text, add column discard_permitted text, add column blocker text, add column reconciliation text, add column pending_sync text, add column conflict_open text, add column program_state text, add column parity_verified_at text, add column completion_observed text;
create index product_events_support_profile_time on private.product_events(profile_id,received_at desc) where support_sequence is not null;
create unique index product_events_support_sequence on private.product_events(user_id,profile_id,episode_id,support_sequence) where support_sequence is not null;
create or replace function private.ingest_product_event(event jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); target public.profiles; event_id uuid; fp text;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null
    and deleted_at is null and not coalesce(is_anonymous,false) and (banned_until is null or banned_until<now())) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if event is null or jsonb_typeof(event)<>'object' or octet_length(event::text)>2048
    or (event - array['id','event_name','profile_client_id','release','platform','browser','mode','surface','category','training_mode','error_code','module_id','lifecycle','error_class','diagnostic_fingerprint','episode_id','support_sequence','active_unfinished','stale','finish_permitted','discard_permitted','blocker','reconciliation','pending_sync','conflict_open','program_state','parity_verified_at','completion_observed'])<>'{}'::jsonb
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
  if not(event ? 'support_sequence') and event ? 'episode_id' and (event->>'event_name' not in ('conflict_detected','conflict_presented','conflict_resolved') or event->>'surface' not in ('program','recovery')) then
    raise exception 'Invalid episode contract' using errcode='22023'; end if;
  if event->>'release'='v115-operator-reliability-v2' and ((event->>'event_name'='app_error' and fp is null)
     or (event->>'event_name' in ('conflict_detected','conflict_presented','conflict_resolved') and not(event ? 'episode_id'))) then
    raise exception 'V2 identity required' using errcode='22023'; end if;
  if event ? 'support_sequence' then
    if event->>'event_name' not in ('support_state_observed','stale_session_presented','stale_session_blocked','stale_session_ready','stale_session_resumed','stale_session_finished','stale_session_discarded')
      or event->>'surface'<>'recovery' or not(event ? 'episode_id') or not(event ?& array['support_sequence','active_unfinished','stale','finish_permitted','discard_permitted','blocker','reconciliation','pending_sync','conflict_open','program_state','parity_verified_at','completion_observed'])
      or event->>'support_sequence' !~ '^[1-9][0-9]{0,8}$'
      or event->>'active_unfinished' not in ('yes','no','unknown') or event->>'stale' not in ('yes','no','unknown')
      or event->>'finish_permitted' not in ('yes','no','unknown') or event->>'discard_permitted' not in ('yes','no','unknown')
      or event->>'conflict_open' not in ('yes','no','unknown')
      or event->>'blocker' not in ('none','sync','recovery','program','migration','unknown')
      or event->>'reconciliation' not in ('idle','pending','checking','blocked','verified','unknown')
      or (event->>'pending_sync'<>'unknown' and (event->>'pending_sync' !~ '^[0-9]{1,4}$' or (event->>'pending_sync')::integer>1000))
      or event->>'program_state' not in ('off','checking','local_only','no_program','in_sync','update_available','conflict','pending','blocked','error','unknown')
      or event->>'completion_observed' not in ('none','once','multiple','unknown')
      or (event->>'parity_verified_at'<>'unknown' and (event->>'parity_verified_at' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' or private.operator_timestamp(event->>'parity_verified_at') is null or private.operator_timestamp(event->>'parity_verified_at')>now()+interval '5 minutes'))
      or (event->>'stale'='yes' and event->>'active_unfinished'<>'yes')
      or (event->>'discard_permitted'='yes' and (event->>'active_unfinished'<>'yes' or event->>'blocker'<>'none'))
      or (event->>'finish_permitted'='yes' and event->>'discard_permitted'<>'yes')
      or (event->>'event_name'='stale_session_ready' and (event->>'stale'<>'yes' or event->>'discard_permitted'<>'yes'))
      or (event->>'event_name'='stale_session_blocked' and (event->>'stale'<>'yes' or event->>'discard_permitted'<>'no' or event->>'blocker'='none'))
      or (event->>'event_name' in ('stale_session_finished','stale_session_discarded') and (event->>'active_unfinished'<>'no' or event->>'stale'<>'no'))
      or (event->>'event_name'='stale_session_finished' and event->>'completion_observed' not in ('once','multiple','unknown')) then
      raise exception 'Invalid support contract' using errcode='22023';end if;
  elsif event ?| array['support_sequence','active_unfinished','stale','finish_permitted','discard_permitted','blocker','reconciliation','pending_sync','conflict_open','program_state','parity_verified_at','completion_observed'] or event->>'event_name' in ('support_state_observed','stale_session_presented','stale_session_blocked','stale_session_ready') then
    raise exception 'Incomplete support contract' using errcode='22023';end if;
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
  insert into private.product_events(id,user_id,account_id,profile_id,event_name,release,platform,browser,mode,surface,category,training_mode,error_code,module_id,lifecycle,error_class,diagnostic_fingerprint,episode_id,support_sequence,active_unfinished,stale,finish_permitted,discard_permitted,blocker,reconciliation,pending_sync,conflict_open,program_state,parity_verified_at,completion_observed)
    values(event_id,actor,target.account_id,target.id,event->>'event_name',event->>'release',event->>'platform',event->>'browser',event->>'mode',event->>'surface',coalesce(event->>'category','none'),coalesce(event->>'training_mode','unknown'),event->>'error_code',event->>'module_id',event->>'lifecycle',event->>'error_class',fp,(event->>'episode_id')::uuid,event->>'support_sequence',event->>'active_unfinished',event->>'stale',event->>'finish_permitted',event->>'discard_permitted',event->>'blocker',event->>'reconciliation',event->>'pending_sync',event->>'conflict_open',event->>'program_state',event->>'parity_verified_at',event->>'completion_observed')
    on conflict(id) do nothing;
  if event->>'event_name'='app_open' then
    insert into private.product_first_opens(user_id,account_id,profile_id) values(actor,target.account_id,target.id)
      on conflict(user_id) do nothing;
  end if;
end;
$$;

-- Latest sequence within each tab episode, then latest receipt per profile.
-- Cross-tab observations are explicitly not a live, globally consistent device snapshot.
create view private.operator_support_latest as
select distinct on (profile_id) e.* from (
 select distinct on(user_id,profile_id,episode_id) * from private.product_events
 where support_sequence is not null
 order by user_id,profile_id,episode_id,support_sequence::integer desc
)e order by profile_id,received_at desc,id;
revoke all on private.operator_support_latest from public,anon,authenticated;

create view private.operator_support_episodes as
select user_id,profile_id,episode_id,min(received_at) as first_seen,max(received_at) as last_seen,
 min(received_at) filter(where stale='yes' and discard_permitted='no') as blocked_at,
 min(received_at) filter(where event_name='stale_session_ready' and received_at>=(select min(b.received_at) from private.product_events b where b.user_id=private.product_events.user_id and b.profile_id=private.product_events.profile_id and b.episode_id=private.product_events.episode_id and b.support_sequence is not null and b.stale='yes' and b.discard_permitted='no')) as ready_at,
 count(*) filter(where event_name='stale_session_finished') as completions,
 count(*) filter(where event_name='stale_session_discarded') as discards,
 bool_or(completion_observed='multiple') as duplicate_local,
 array_agg(distinct blocker) filter(where stale='yes' and discard_permitted='no') as blockers
from private.product_events where support_sequence is not null group by user_id,profile_id,episode_id;
revoke all on private.operator_support_episodes from public,anon,authenticated;

create view private.operator_support_people as
select p.user_id,
 exists(select 1 from private.operator_support_latest s join private.operator_profiles op on op.id=s.profile_id where op.user_id=p.user_id and s.received_at>=now()-interval '30 minutes' and s.stale='yes' and s.discard_permitted='no' and s.received_at>=now()-interval '90 days'
 and exists(select 1 from private.product_events b where b.episode_id=s.episode_id and b.profile_id=s.profile_id and b.user_id=s.user_id and b.support_sequence is not null and b.stale='yes' and b.discard_permitted='no' and b.received_at<now()-interval '15 minutes'
   and not exists(select 1 from private.product_events r where r.episode_id=b.episode_id and r.profile_id=b.profile_id and r.user_id=b.user_id and r.support_sequence is not null and r.support_sequence::integer>b.support_sequence::integer and (r.stale<>'yes' or r.discard_permitted<>'no')))) as blocked_attention,
 exists(select 1 from private.operator_episodes e where e.user_id=p.user_id and not e.resolved) as conflict_attention,
 exists(select 1 from private.product_events e where e.user_id=p.user_id and e.event_name='app_error' and e.received_at>=now()-interval '1 day' group by e.diagnostic_fingerprint,e.category having count(*)>=3) as error_attention,
 exists(select 1 from private.product_events e where e.user_id=p.user_id and e.event_name='workout_started' and e.received_at>=now()-interval '7 days' and e.received_at<now()-interval '15 minutes'
 and exists(select 1 from private.product_events d where d.user_id=p.user_id and d.profile_id=e.profile_id and d.event_name='app_error' and d.received_at between e.received_at and e.received_at+interval '10 minutes')
 and not exists(select 1 from private.product_events c where c.user_id=p.user_id and c.profile_id=e.profile_id and c.event_name in ('workout_completed','stale_session_finished','stale_session_discarded') and c.received_at>e.received_at)) as start_error_attention
from private.operator_people p;
revoke all on private.operator_support_people from public,anon,authenticated;

create function private.operator_query_v3(request jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; section text:=request->>'section'; target uuid; since_time timestamptz; page_number integer;
begin
 if not private.operator_authorized() then raise exception 'Operator access denied' using errcode='42501';end if;
 -- Reuse all existing bounded query validation and authorization.
 result:=private.operator_query_v2(case when section='attention' then request||jsonb_build_object('section','users','health','all') else request end);
 page_number:=coalesce((request->>'page')::integer,0);
 since_time:=case when coalesce((request->>'days')::integer,7)=0 then date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' else now()-make_interval(days=>coalesce((request->>'days')::integer,7)) end;
 if section='detail' then
  target:=(request->>'user_id')::uuid;
  result:=result||jsonb_build_object('support',coalesce((select jsonb_agg(jsonb_build_object(
   'profile_id',p.id,'profile_name',p.display_name,'observed_at',s.received_at,
   'coverage',case when s.received_at>=now()-interval '30 minutes' then 'recent' else 'limited' end,
   'active_unfinished',case when s.received_at>=now()-interval '30 minutes' then s.active_unfinished else 'unknown' end,
   'stale',case when s.received_at>=now()-interval '30 minutes' then s.stale else 'unknown' end,
   'finish_permitted',case when s.received_at>=now()-interval '30 minutes' then s.finish_permitted else 'unknown' end,
   'discard_permitted',case when s.received_at>=now()-interval '30 minutes' then s.discard_permitted else 'unknown' end,
   'blocker',case when s.received_at>=now()-interval '30 minutes' then s.blocker else 'unknown' end,
   'reconciliation',case when s.received_at>=now()-interval '30 minutes' then s.reconciliation else 'unknown' end,
   'pending_sync',case when s.received_at>=now()-interval '30 minutes' then s.pending_sync else 'unknown' end,
   'conflict_open',case when s.received_at>=now()-interval '30 minutes' then s.conflict_open else 'unknown' end,
   'program_state',case when s.received_at>=now()-interval '30 minutes' then s.program_state else 'unknown' end,
   'parity_verified_at',(select max(private.operator_timestamp(e.parity_verified_at)) from private.product_events e where e.profile_id=p.id and e.support_sequence is not null and e.parity_verified_at<>'unknown'),
   'persisted_unfinished',exists(select 1 from private.operator_sessions a where a.profile_id=p.id),
   'release',s.release,'platform',s.platform,'browser',s.browser,'mode',s.mode,
   'status',case when s.received_at is null or s.received_at<now()-interval '30 minutes' then 'Coverage limited'
      when s.stale='yes' and s.discard_permitted='no' then 'Needs attention'
      when s.stale='yes' and s.discard_permitted='yes' then case when exists(select 1 from private.operator_support_episodes ep where ep.profile_id=s.profile_id and ep.episode_id=s.episode_id and ep.user_id=s.user_id and ep.blocked_at is not null) then 'Recovered' else 'Stale session ready' end
      when s.event_name in ('stale_session_finished','stale_session_discarded') then 'Resolved'
      else 'No current issue observed' end)) from private.operator_profiles p left join private.operator_support_latest s on s.profile_id=p.id where p.user_id=target),'[]'),
   'support_completions',coalesce((select jsonb_agg(to_jsonb(e)) from(select episode_id,profile_id,first_seen,last_seen,completions,discards,duplicate_local,
    case when completions>1 or duplicate_local then 'Duplicate completion observed' when completions=1 then 'Completion observed once' when discards>0 then 'Workout discard observed' else 'No resolution observed' end as verification
    from private.operator_support_episodes where user_id=target and (completions>0 or discards>0) order by last_seen desc limit 25)e),'[]'));
  result:=result||jsonb_build_object('events',coalesce((select jsonb_agg(to_jsonb(e) order by received_at,id) from(
    select id,received_at,event_name,release,platform,browser,mode,surface,category,diagnostic_fingerprint,episode_id,lifecycle,error_code,module_id,
      support_sequence,stale,finish_permitted,discard_permitted,blocker,reconciliation,completion_observed,
      case when e.event_name='stale_session_ready' then exists(select 1 from private.product_events b where b.user_id=e.user_id and b.profile_id=e.profile_id and b.episode_id=e.episode_id and b.support_sequence is not null and b.support_sequence::integer<e.support_sequence::integer and b.stale='yes' and b.discard_permitted='no') else false end as automatically_ready
    from private.product_events e where user_id=target and received_at>=since_time and (coalesce(request->>'event','')='' or event_name=request->>'event') order by received_at,id limit 50 offset page_number*50)e),'[]'));
 end if;
 if section in ('overview','reliability') then
  result:=result||jsonb_build_object('support_reliability',(with chosen as(
    select ep.* from private.operator_support_episodes ep where exists(select 1 from private.product_events e where e.user_id=ep.user_id and e.profile_id=ep.profile_id and e.episode_id=ep.episode_id and e.support_sequence is not null and e.received_at>=since_time
     and (coalesce(request->>'release','')='' or e.release=request->>'release')
     and (coalesce(request->>'platform','')='' or e.platform=request->>'platform')
     and (coalesce(request->>'browser','')='' or e.browser=request->>'browser')
     and (coalesce(request->>'mode','')='' or e.mode=request->>'mode'))
  )select jsonb_build_object('affected_users',count(distinct user_id) filter(where blocked_at is not null),
   'blocked_episodes',count(*) filter(where blocked_at is not null),
   'automatically_recovered',count(*) filter(where blocked_at is not null and ready_at>=blocked_at),
   'finished',count(*) filter(where blocked_at is not null and completions>0),
   'unresolved',count(*) filter(where blocked_at is not null and completions=0 and discards=0),
   'ready_samples',count(*) filter(where ready_at>=blocked_at),
   'median_ready_seconds',case when count(*) filter(where ready_at>=blocked_at)>=3 then percentile_cont(0.5) within group(order by extract(epoch from(ready_at-blocked_at))) filter(where ready_at>=blocked_at) else null end,
   'blockers',coalesce((select jsonb_agg(to_jsonb(b)) from(select blocker,count(distinct user_id) as people,count(distinct (user_id,profile_id,episode_id)) as episodes from chosen cross join lateral unnest(blockers) as blocker group by blocker)b),'[]')) from chosen));
 end if;
 if section='users' then
  result:=result||jsonb_build_object('users',coalesce((select jsonb_agg(u||jsonb_build_object(
   'support_status',case when exists(select 1 from private.operator_support_latest s join private.operator_profiles p on p.id=s.profile_id where p.user_id=(u->>'user_id')::uuid and s.received_at>=now()-interval '30 minutes' and s.stale='yes' and s.discard_permitted='no') then 'Needs attention'
    when exists(select 1 from private.operator_support_latest s join private.operator_profiles p on p.id=s.profile_id where p.user_id=(u->>'user_id')::uuid and s.received_at>=now()-interval '30 minutes' and s.stale='yes' and s.discard_permitted='yes') then 'Stale session ready'
    when exists(select 1 from private.operator_support_episodes e join private.operator_profiles p on p.id=e.profile_id where p.user_id=(u->>'user_id')::uuid and e.last_seen>=now()-interval '30 minutes' and (e.completions>0 or e.discards>0)) then 'Resolved · session resolution observed'
    else 'Coverage limited' end,
   'support_blocker',(select s.blocker from private.operator_support_latest s join private.operator_profiles p on p.id=s.profile_id where p.user_id=(u->>'user_id')::uuid and s.received_at>=now()-interval '30 minutes' and s.stale='yes' and s.discard_permitted='no' order by s.received_at desc limit 1))) from jsonb_array_elements(result->'users') u),'[]'));
 end if;
 if section='attention' then
   result:=jsonb_build_object('total',(select count(*) from private.operator_support_people a where a.blocked_attention or a.conflict_attention or a.error_attention or a.start_error_attention),
    'metric_contract','operator-v2','as_of',now(),'page_size',25,'users',coalesce((select jsonb_agg(to_jsonb(e)) from(select p.user_id,p.display_name,p.release,p.platform,p.last_activity,
     a.blocked_attention,a.conflict_attention,a.error_attention,a.start_error_attention
     from private.operator_support_people a join private.operator_people p using(user_id) where a.blocked_attention or a.conflict_attention or a.error_attention or a.start_error_attention order by p.last_activity desc nulls last,p.user_id limit 25 offset page_number*25)e),'[]'));
 end if;
 return result;
end;$$;
revoke all on function private.operator_query_v3(jsonb) from public,anon,authenticated;
grant execute on function private.operator_query_v3(jsonb) to authenticated;
create function public.operator_query_v3(request jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.operator_query_v3(request);$$;
revoke all on function public.operator_query_v3(jsonb) from public,anon,authenticated;
grant execute on function public.operator_query_v3(jsonb) to authenticated;
