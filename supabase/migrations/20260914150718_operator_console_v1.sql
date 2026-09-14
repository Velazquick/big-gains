-- Additive Operator v1. No product rows or existing product RLS are changed.
create table private.product_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'owner'),
  granted_at timestamptz not null default now()
);
alter table private.product_operators enable row level security;
revoke all on private.product_operators from public, anon, authenticated;

create function private.operator_authorized() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.product_operators o join auth.users u on u.id=o.user_id
    where o.user_id=auth.uid() and o.role='owner' and u.email_confirmed_at is not null
      and u.deleted_at is null and not coalesce(u.is_anonymous,false)
      and (u.banned_until is null or u.banned_until < now())
      and exists (select 1 from auth.sessions s where s.user_id=u.id
        and s.id::text=auth.jwt()->>'session_id'
        and (s.not_after is null or s.not_after > now()))
  );
$$;
revoke all on function private.operator_authorized() from public, anon;
grant execute on function private.operator_authorized() to authenticated;
create function public.operator_access() returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.operator_authorized();
$$;
revoke all on function public.operator_access() from public, anon;
grant execute on function public.operator_access() to authenticated;

create table private.product_releases (
  release text primary key check (length(release) between 1 and 80)
);
insert into private.product_releases values ('v114-operator-console-v1');
alter table private.product_releases enable row level security;
revoke all on private.product_releases from public, anon, authenticated;

create table private.product_events (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  received_at timestamptz not null default clock_timestamp(),
  event_name text not null check (event_name in ('app_open','workout_started','workout_completed','program_adopted','exercise_swapped','stale_session_recovery_shown','stale_session_resumed','stale_session_finished','stale_session_discarded','recovery_required','conflict_presented','app_error')),
  release text not null references private.product_releases(release),
  platform text not null check(platform in ('ios','android','windows','mac','linux','other')),
  browser text not null check(browser in ('safari','chrome','edge','firefox','other')),
  mode text not null check(mode in ('standalone','browser')),
  surface text not null check(surface in ('app','train','program','recovery','onboarding')),
  category text not null default 'none' check(category in ('none','javascript','promise','resource','sync','program','unknown')),
  training_mode text not null default 'unknown' check(training_mode in ('unknown','program','freeform')),
  check(event_name='app_error' or category='none')
);
alter table private.product_events enable row level security;
revoke all on private.product_events from public, anon, authenticated;
create index product_events_name_time on private.product_events(event_name,received_at desc);
create index product_events_user_time on private.product_events(user_id,received_at desc);
create index product_events_account_time on private.product_events(account_id,received_at desc);
create index product_events_profile_time on private.product_events(profile_id,received_at desc);
create index product_events_release_time on private.product_events(release,received_at desc);
create index product_events_time on private.product_events(received_at);
create table private.product_first_opens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  first_open_at timestamptz not null default clock_timestamp()
);
alter table private.product_first_opens enable row level security;
revoke all on private.product_first_opens from public,anon,authenticated;
create index product_first_opens_account on private.product_first_opens(account_id);
create index product_first_opens_profile on private.product_first_opens(profile_id);
create index operator_workouts_profile_completion on public.workouts(profile_id,completed_at);

create function private.ingest_product_event(event jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); target public.profiles; event_id uuid;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor and email_confirmed_at is not null
    and deleted_at is null and not coalesce(is_anonymous,false) and (banned_until is null or banned_until<now())) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if event is null or jsonb_typeof(event)<>'object' or octet_length(event::text)>1024
    or (event - array['id','event_name','profile_client_id','release','platform','browser','mode','surface','category','training_mode'])<>'{}'::jsonb
    or not (event ?& array['id','event_name','profile_client_id','release','platform','browser','mode','surface'])
    or exists(select 1 from jsonb_each(event) e where jsonb_typeof(e.value)<>'string') then
    raise exception 'Invalid event contract' using errcode='22023';
  end if;
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
  insert into private.product_events(id,user_id,account_id,profile_id,event_name,release,platform,browser,mode,surface,category,training_mode)
    values(event_id,actor,target.account_id,target.id,event->>'event_name',event->>'release',event->>'platform',event->>'browser',event->>'mode',event->>'surface',coalesce(event->>'category','none'),coalesce(event->>'training_mode','unknown'))
    on conflict(id) do nothing;
  if event->>'event_name'='app_open' then
    insert into private.product_first_opens(user_id,account_id,profile_id) values(actor,target.account_id,target.id)
      on conflict(user_id) do nothing;
  end if;
end;
$$;
revoke all on function private.ingest_product_event(jsonb) from public,anon;
grant execute on function private.ingest_product_event(jsonb) to authenticated;
create function public.record_product_event(event jsonb) returns void
language sql security invoker set search_path = '' as $$ select private.ingest_product_event(event); $$;
revoke all on function public.record_product_event(jsonb) from public,anon;
grant execute on function public.record_product_event(jsonb) to authenticated;

-- Internal projections never return a workout payload. Tombstones win exact ties.
create view private.operator_workouts as
select w.profile_id,w.completed_at,
  case when w.payload#>>'{data,programOrigin,contract}'='big-gains.program-origin.v1' then 'program' else 'unknown' end as training_mode
from public.workouts w
where not exists(select 1 from public.tombstones t where t.account_id=w.account_id and t.profile_id=w.profile_id
  and t.entity_type='workouts' and t.entity_id=w.client_id
  and (t.version>w.version or (t.version=w.version and t.deleted_at>=w.updated_at)));

create function private.operator_timestamp(value text) returns timestamptz
language plpgsql immutable set search_path = '' as $$
begin return value::timestamptz; exception when others then return null; end;
$$;
revoke all on function private.operator_timestamp(text) from public,anon,authenticated;

create view private.operator_sessions as
select s.profile_id,private.operator_timestamp(s.payload#>>'{data,startedAt}') as started_at
from public.active_sessions s
where s.payload#>>'{data,completedAt}' is null
and not exists(select 1 from public.tombstones t where t.account_id=s.account_id and t.profile_id=s.profile_id
  and t.entity_type='active_sessions' and t.entity_id=s.client_id
  and (t.version>s.version or (t.version=s.version and t.deleted_at>=s.updated_at)));

-- Assign each profile once for person-level funnel counts: member if assigned,
-- otherwise its owner. Do not double-count a managed profile under two people.
create view private.operator_profiles as
select p.id,p.account_id,coalesce(m.user_id,a.owner_user_id) as user_id,p.display_name,p.created_at,
  d.payload#>>'{heads,activeProgramVersionId}' is not null as program_active
from public.profiles p join public.accounts a on a.id=p.account_id
left join public.profile_memberships m on m.profile_id=p.id
left join public.program_domains d on d.profile_id=p.id;

create view private.operator_people as
select u.id as user_id,u.email,u.created_at as joined,u.email_confirmed_at as confirmed,
  coalesce(p.display_name,'Profile not created') as display_name,
  coalesce(w.workouts,0) as workouts,w.first_workout,w.second_workout,w.last_workout,
  greatest(w.last_workout,e.last_open) as last_activity,
  coalesce(p.program_active,false) as program_active,
  coalesce(s.unfinished,0) as unfinished,coalesce(s.over_six_hours,0) as over_six_hours,
  e.last_open,r.release,r.platform,r.browser,r.mode,r.received_at as last_event,
  coalesce(f.errors,0) as recent_errors,coalesce(f.recovery,0) as recent_recovery,
  coalesce(f.freeform,false) as freeform_observed
from auth.users u
left join lateral(select string_agg(p.display_name,' / ' order by p.created_at) as display_name,bool_or(p.program_active) as program_active
  from private.operator_profiles p where p.user_id=u.id) p on true
left join lateral(select count(*) as workouts,min(w.completed_at) as first_workout,
  (array_agg(w.completed_at order by w.completed_at))[2] as second_workout,max(w.completed_at) as last_workout
  from private.operator_workouts w join private.operator_profiles p on p.id=w.profile_id where p.user_id=u.id) w on true
left join lateral(select count(*) as unfinished,count(*) filter(where s.started_at<=now()-interval '6 hours') as over_six_hours
  from private.operator_sessions s join private.operator_profiles p on p.id=s.profile_id where p.user_id=u.id) s on true
left join lateral(select max(received_at) as last_open from private.product_events where user_id=u.id and event_name='app_open' and received_at>=now()-interval '90 days') e on true
left join lateral(select release,platform,browser,mode,received_at from private.product_events where user_id=u.id and received_at>=now()-interval '90 days' order by received_at desc,id limit 1) r on true
left join lateral(select count(*) filter(where event_name='app_error') as errors,
  count(*) filter(where event_name in ('recovery_required','conflict_presented')) as recovery,
  bool_or(event_name='workout_started' and training_mode='freeform') as freeform
  from private.product_events where user_id=u.id and received_at>=now()-interval '7 days') f on true
where u.deleted_at is null and not coalesce(u.is_anonymous,false);
revoke all on private.operator_workouts,private.operator_sessions,private.operator_profiles,private.operator_people from public,anon,authenticated;

create function private.operator_query(request jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare section text; result jsonb; search_text text; page_number integer; page_size integer:=25;
  since_time timestamptz; release_filter text; platform_filter text; target_user uuid; sort_by text; health_filter text;
begin
  if not private.operator_authorized() then raise exception 'Operator access denied' using errcode='42501'; end if;
  if request is null or jsonb_typeof(request)<>'object' or octet_length(request::text)>1024
    or (request-array['section','search','page','days','release','platform','user_id','sort','health'])<>'{}'::jsonb then
    raise exception 'Invalid query' using errcode='22023'; end if;
  section:=request->>'section'; search_text:=coalesce(request->>'search','');
  page_number:=coalesce((request->>'page')::integer,0);
  if page_number<0 or page_number>10000 or length(search_text)>100 then raise exception 'Invalid page/search'; end if;
  since_time:=now()-make_interval(days=>least(90,greatest(1,coalesce((request->>'days')::integer,7))));
  release_filter:=nullif(request->>'release',''); platform_filter:=nullif(request->>'platform','');
  sort_by:=coalesce(request->>'sort','joined'); health_filter:=coalesce(request->>'health','all');
  if sort_by not in ('joined','activity','workouts') or health_filter not in ('all','errors','stale','inactive') then raise exception 'Invalid filter'; end if;
  if section in ('overview','funnel') then
    select jsonb_build_object('registered',count(*),'confirmed',count(*) filter(where confirmed is not null),
      'activated',count(*) filter(where workouts>0),'two_workouts',count(*) filter(where workouts>=2),'four_workouts',count(*) filter(where workouts>=4),
      'active_today',count(*) filter(where last_open>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC'),
      'active_7d',count(*) filter(where last_open>=now()-interval '7 days'),'active_30d',count(*) filter(where last_open>=now()-interval '30 days'),
      'program_users',count(*) filter(where program_active),'freeform_observed_7d',count(*) filter(where freeform_observed),
      'over_six_hours',coalesce(sum(over_six_hours),0),'unfinished',coalesce(sum(unfinished),0),
      'telemetry_users_90d',count(*) filter(where last_event is not null),'last_event',max(last_event),
      'median_hours_to_first',percentile_cont(0.5) within group(order by extract(epoch from (first_workout-joined))/3600) filter(where first_workout>=joined),
      'time_to_first_eligible',count(*) filter(where first_workout>=joined),
      'errors_7d',coalesce(sum(recent_errors),0),'recovery_events_7d',coalesce(sum(recent_recovery),0)) into result
      from private.operator_people;
    result:=result || (select jsonb_build_object('workouts_today',count(*) filter(where completed_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC' and completed_at<=now()),
      'workouts_7d',count(*) filter(where completed_at>=now()-interval '7 days' and completed_at<=now()),
      'workouts_30d',count(*) filter(where completed_at>=now()-interval '30 days' and completed_at<=now())) from private.operator_workouts);
    result:=result || jsonb_build_object('releases',coalesce((select jsonb_agg(to_jsonb(r)) from
      (select release,count(*) as users from private.operator_people where release is not null group by release order by users desc) r),'[]'::jsonb));
    if section='funnel' then
      result:=result || jsonb_build_object('retention',coalesce((
        with first_opens as(select user_id,first_open_at as first_open from private.product_first_opens where first_open_at>=now()-interval '60 days'),
        cohorts as(select f.user_id,(f.first_open at time zone 'UTC')::date as cohort_day from first_opens f)
        select jsonb_agg(to_jsonb(r)) from (
          select d.day,count(c.user_id) filter(where c.cohort_day+d.day<(now() at time zone 'UTC')::date) as eligible,
            count(c.user_id) filter(where c.cohort_day+d.day<(now() at time zone 'UTC')::date and exists(
              select 1 from private.product_events e where e.user_id=c.user_id and e.event_name='app_open'
              and e.received_at>=(c.cohort_day+d.day)::timestamp at time zone 'UTC'
              and e.received_at<(c.cohort_day+d.day+1)::timestamp at time zone 'UTC')) as returned
          from (values(1),(7),(14),(28)) d(day) left join cohorts c on true group by d.day order by d.day
        ) r),'[]'::jsonb));
    end if;
  elsif section='users' then
    with filtered as(select * from private.operator_people p where
      (search_text='' or strpos(lower(p.display_name),lower(search_text))>0 or strpos(lower(coalesce(p.email,'')),lower(search_text))>0)
      and (health_filter='all' or (health_filter='errors' and recent_errors>0) or (health_filter='stale' and over_six_hours>0) or (health_filter='inactive' and workouts=0))),
    page as(select * from filtered order by
      case when sort_by='activity' then last_activity end desc nulls last,
      case when sort_by='workouts' then workouts end desc nulls last,joined desc,user_id limit page_size offset page_number*page_size)
    select jsonb_build_object('total',(select count(*) from filtered),'page',page_number,'page_size',page_size,
      'users',coalesce((select jsonb_agg(to_jsonb(p)) from page p),'[]'::jsonb)) into result;
  elsif section='detail' then
    target_user:=(request->>'user_id')::uuid;
    result:=(select to_jsonb(p) from private.operator_people p where user_id=target_user);
    if result is null then return jsonb_build_object('not_found',true); end if;
    result:=result || jsonb_build_object('profiles',coalesce((select jsonb_agg(to_jsonb(p)) from private.operator_profiles p where user_id=target_user),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(to_jsonb(e)) from(select received_at,event_name,release,platform,browser,mode,surface,category from private.product_events
      where user_id=target_user and received_at>=since_time order by received_at desc,id limit 50)e),'[]'::jsonb));
  elsif section='reliability' then
    with filtered as(select * from private.product_events where received_at>=since_time
      and (release_filter is null or release=release_filter) and (platform_filter is null or platform=platform_filter)),
    errors as(select release,platform,browser,surface,category,count(*) as events,count(distinct user_id) as users,max(received_at) as latest
      from filtered where event_name='app_error' group by release,platform,browser,surface,category order by events desc limit 100),
    recovery as(select event_name,count(*) as events,count(distinct user_id) as users from filtered
      where event_name in ('stale_session_recovery_shown','stale_session_resumed','stale_session_finished','stale_session_discarded','recovery_required','conflict_presented') group by event_name),
    releases as(select release,count(*) as events,count(distinct user_id) as users,max(received_at) as latest from filtered group by release order by latest desc limit 100)
    select jsonb_build_object('errors',coalesce((select jsonb_agg(to_jsonb(e)) from errors e),'[]'::jsonb),
      'recovery',coalesce((select jsonb_agg(to_jsonb(r)) from recovery r),'[]'::jsonb),
      'releases',coalesce((select jsonb_agg(to_jsonb(r)) from releases r),'[]'::jsonb),
      'observed_users',(select count(distinct user_id) from filtered),'last_event',(select max(received_at) from filtered)) into result;
  else raise exception 'Unknown section' using errcode='22023'; end if;
  return result || jsonb_build_object('as_of',now(),'metric_contract','operator-v1');
end;
$$;
revoke all on function private.operator_query(jsonb) from public,anon;
grant execute on function private.operator_query(jsonb) to authenticated;
create function public.operator_query(request jsonb) returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.operator_query(request); $$;
revoke all on function public.operator_query(jsonb) from public,anon;
grant execute on function public.operator_query(jsonb) to authenticated;

-- Never purge in a consumer request. Account/profile/Auth deletion cascades.
create function private.purge_product_events() returns bigint
language plpgsql security definer set search_path = '' as $$
declare removed bigint;
begin delete from private.product_events where received_at<now()-interval '90 days';
get diagnostics removed=row_count; return removed; end;
$$;
revoke all on function private.purge_product_events() from public,anon,authenticated;

-- Supabase provides pg_cron; the disposable plain PostgreSQL harness may not.
-- The production release gate must verify this job exists after migration.
do $$ begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('big-gains-telemetry-retention','17 3 * * *','select private.purge_product_events()');
  end if;
end $$;
