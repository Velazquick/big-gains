-- Support observations share episode_id but are not conflict lifecycle events.
-- Replace the projection only: preserve retained receipts, columns and permissions.
create or replace view private.operator_episodes as
select user_id,account_id,profile_id,episode_id,surface,
 min(received_at) as first_seen,max(received_at) as last_seen,
 count(*) filter(where event_name='conflict_presented') as presentations,
 bool_or(event_name='conflict_detected') as detected,bool_or(event_name='conflict_resolved') as resolved,
 array_agg(distinct release) as releases,array_agg(distinct platform) as platforms,array_agg(distinct platform||' / '||browser||' / '||mode) as environments
from private.product_events
where episode_id is not null and received_at>=now()-interval '90 days'
 and event_name in ('conflict_detected','conflict_presented','conflict_resolved')
group by user_id,account_id,profile_id,episode_id,surface;
revoke all on private.operator_episodes from public,anon,authenticated;
