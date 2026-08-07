begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column('public', 'profiles', 'pet_enabled', 'profiles have a durable pet presentation flag');
select has_column('public', 'profiles', 'accent', 'profiles have an allowlisted accent token');
select has_column('public', 'profiles', 'theme', 'profiles have an allowlisted theme token');
select has_function('public', 'bootstrap_independent_account', array['text'], 'independent bootstrap RPC exists');
select is(
  (select prosecdef from pg_proc where oid = 'public.bootstrap_independent_account(text)'::regprocedure),
  false,
  'independent bootstrap is security invoker'
);
select ok(has_function_privilege('authenticated', 'public.bootstrap_independent_account(text)', 'EXECUTE'), 'authenticated may execute bootstrap');
select ok(not has_function_privilege('anon', 'public.bootstrap_independent_account(text)', 'EXECUTE'), 'anonymous may not execute bootstrap');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4g-managed@example.test', '', now(), now()),
  ('72000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4g-friend@example.test', '', now(), now());

insert into public.accounts (id, owner_user_id, display_name)
values ('71a00000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Managed account');
insert into public.profiles (id, account_id, client_id, display_name, pet_enabled, accent, theme)
values
  ('71b00000-0000-0000-0000-000000000001', '71a00000-0000-0000-0000-000000000001', 'jorge', 'Jorge', true, 'ember', 'performance-dark'),
  ('71b00000-0000-0000-0000-000000000002', '71a00000-0000-0000-0000-000000000001', 'alexa', 'Alexa', true, 'rose', 'wellness-light');

insert into public.workouts (account_id, profile_id, client_id, idempotency_key, completed_at)
values ('71a00000-0000-0000-0000-000000000001', '71b00000-0000-0000-0000-000000000001', 'managed-workout', 'managed-workout-key', now());
insert into public.routines (account_id, profile_id, client_id, idempotency_key)
values ('71a00000-0000-0000-0000-000000000001', '71b00000-0000-0000-0000-000000000001', 'managed-routine', 'managed-routine-key');
insert into public.bodyweight_entries (account_id, profile_id, client_id, idempotency_key, measured_at, weight_value)
values ('71a00000-0000-0000-0000-000000000001', '71b00000-0000-0000-0000-000000000001', 'managed-weight', 'managed-weight-key', now(), 200);
insert into public.preferences (account_id, profile_id, client_id, idempotency_key)
values ('71a00000-0000-0000-0000-000000000001', '71b00000-0000-0000-0000-000000000001', 'managed-preference', 'managed-preference-key');
insert into public.active_sessions (account_id, profile_id, client_id, idempotency_key)
values ('71a00000-0000-0000-0000-000000000001', '71b00000-0000-0000-0000-000000000001', 'managed-session', 'managed-session-key');
insert into public.sync_metadata (account_id, profile_id, client_id)
values ('71a00000-0000-0000-0000-000000000001', '71b00000-0000-0000-0000-000000000001', 'managed-sync');
insert into public.tombstones (account_id, profile_id, entity_type, entity_id, idempotency_key, version, deleted_at)
values ('71a00000-0000-0000-0000-000000000001', '71b00000-0000-0000-0000-000000000001', 'workouts', 'managed-deleted', 'managed-delete-key', 1, now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"72000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$insert into public.accounts (owner_user_id, display_name) values ('72000000-0000-0000-0000-000000000002', 'Direct account')$$,
  '42501', null, 'friend cannot bypass the intended bootstrap with a direct account insert'
);
select throws_ok(
  $$insert into public.accounts (owner_user_id, display_name) values ('71000000-0000-0000-0000-000000000001', 'Forged account')$$,
  '42501', null, 'friend cannot forge owner_user_id'
);
select lives_ok(
  $$select * from public.bootstrap_independent_account('Synthetic Friend')$$,
  'signed-in friend can run the intended bootstrap'
);
select is((select count(*) from public.accounts), 1::bigint, 'friend sees exactly one owned account after bootstrap');
select is((select count(*) from public.profiles), 1::bigint, 'friend sees exactly one owned profile after bootstrap');
select ok((select client_id like 'independent-%' from public.profiles), 'friend receives a stable non-managed client id');
select is((select pet_enabled from public.profiles), false, 'friend pet defaults off');
select is((select accent from public.profiles), 'cobalt', 'friend accent defaults to cobalt');
select is((select theme from public.profiles), 'performance-dark', 'friend theme defaults to performance dark');
select is(
  (select profile_id from public.bootstrap_independent_account('Ignored retry name')),
  (select id from public.profiles),
  'duplicate provisioning returns the same logical profile'
);
select is((select count(*) from public.accounts), 1::bigint, 'duplicate provisioning does not create another account');
select is((select count(*) from public.profiles), 1::bigint, 'duplicate provisioning does not create another profile');
select throws_ok(
  $$insert into public.profiles (account_id, client_id, display_name) select id, 'second-profile', 'Second' from public.accounts$$,
  '42501', null, 'bootstrap guard is cleared before a direct second-profile attempt'
);
select throws_ok(
  $$insert into public.profiles (account_id, client_id, display_name) values ('71a00000-0000-0000-0000-000000000001', 'attached-to-managed', 'Forged')$$,
  '42501', null, 'friend cannot attach a profile to the managed account'
);
select throws_ok(
  $$update public.profiles set accent = 'script:url()'$$,
  '23514', null, 'unknown accent values are rejected by the database'
);
select throws_ok(
  $$update public.profiles set theme = 'arbitrary-css'$$,
  '23514', null, 'unknown theme values are rejected by the database'
);
select lives_ok(
  $$update public.profiles set pet_enabled = true, accent = 'ember', theme = 'wellness-light'$$,
  'friend may change allowlisted presentation values'
);
select is((select count(*) from public.profiles), 1::bigint, 'presentation changes do not expand profile visibility');
select throws_ok(
  $$update public.accounts set owner_user_id = '71000000-0000-0000-0000-000000000001'$$,
  '23514', 'account ownership is immutable', 'account ownership remains immutable'
);
select throws_ok(
  $$update public.profiles set account_id = '71a00000-0000-0000-0000-000000000001'$$,
  '23514', 'profile ownership is immutable', 'profile ownership remains immutable'
);

reset role;
insert into public.workouts (account_id, profile_id, client_id, idempotency_key, completed_at)
select a.id, p.id, 'friend-workout', 'friend-workout-key', now()
from public.accounts a join public.profiles p on p.account_id = a.id
where a.owner_user_id = '72000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '72000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"72000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is((select count(*) from public.workouts where client_id = 'managed-workout'), 0::bigint, 'friend cannot select managed workouts');
select is((select count(*) from public.routines where client_id = 'managed-routine'), 0::bigint, 'friend cannot select managed routines');
select is((select count(*) from public.bodyweight_entries where client_id = 'managed-weight'), 0::bigint, 'friend cannot select managed bodyweight');
select is((select count(*) from public.preferences where client_id = 'managed-preference'), 0::bigint, 'friend cannot select managed preferences');
select is((select count(*) from public.active_sessions where client_id = 'managed-session'), 0::bigint, 'friend cannot select managed active sessions');
select is((select count(*) from public.sync_metadata where client_id = 'managed-sync'), 0::bigint, 'friend cannot select managed sync rows');
select is((select count(*) from public.tombstones where entity_id = 'managed-deleted'), 0::bigint, 'friend cannot select managed tombstones');
select results_eq(
  $$update public.preferences set version = 2 where client_id = 'managed-preference' returning 1$$,
  $$select 1 where false$$,
  'friend cannot update managed application rows'
);
select results_eq(
  $$delete from public.tombstones where entity_id = 'managed-deleted' returning 1$$,
  $$select 1 where false$$,
  'friend cannot delete managed tombstones'
);
select throws_ok(
  $$insert into public.sync_metadata (account_id, profile_id, client_id) values ('71a00000-0000-0000-0000-000000000001', '71b00000-0000-0000-0000-000000000001', 'friend-forged-sync')$$,
  '42501', null, 'friend cannot insert a managed sync row even with known UUIDs'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok(
  $$select * from public.bootstrap_independent_account('Managed owner')$$,
  'P0001', null, 'managed Jorge/Alexa account never enters independent bootstrap'
);
select is((select count(*) from public.profiles), 2::bigint, 'managed owner still sees exactly Jorge and Alexa');
select is((select count(*) from public.workouts where client_id = 'friend-workout'), 0::bigint, 'managed owner cannot select friend workouts');
select results_eq(
  $$insert into public.workouts (account_id, profile_id, client_id, idempotency_key, completed_at)
    select a.id, p.id, 'managed-forged-friend', 'managed-forged-friend-key', now()
    from public.accounts a join public.profiles p on p.account_id = a.id
    where a.owner_user_id = '72000000-0000-0000-0000-000000000002' returning 1$$,
  $$select 1 where false$$,
  'managed owner cannot insert friend application rows'
);

reset role;
set local role anon;
select throws_ok($$select * from public.accounts$$, '42501', null, 'anonymous cannot read accounts');
select throws_ok(
  $$select * from public.bootstrap_independent_account('Anonymous')$$,
  '42501', null, 'anonymous cannot execute independent bootstrap'
);

select * from finish();
rollback;
