begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select has_table('public', 'accounts', 'accounts table exists');
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'workouts', 'workouts table exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jorge@example.test', '', now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'friend@example.test', '', now(), now());

insert into public.accounts (id, owner_user_id, display_name) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Jorge account'),
  ('a0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Friend account');

insert into public.profiles (id, account_id, client_id, display_name) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'jorge', 'Jorge'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'alexa', 'Alexa'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'friend', 'Friend');

insert into public.workouts (account_id, profile_id, client_id, idempotency_key, completed_at, payload) values
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'jorge-workout', 'jorge-idempotency', now(), '{}'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'alexa-workout', 'alexa-idempotency', now(), '{}'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'friend-workout', 'friend-idempotency', now(), '{}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.accounts), 1::bigint, 'Jorge sees only his account');
select is((select count(*) from public.profiles), 2::bigint, 'Jorge sees both Jorge and Alexa profiles');
select is((select count(*) from public.workouts), 2::bigint, 'Jorge sees both profiles under his account');
select is((select count(*) from public.workouts where client_id = 'friend-workout'), 0::bigint, 'friend workout is invisible to Jorge');
select throws_ok(
  $$insert into public.workouts (account_id, profile_id, client_id, idempotency_key, completed_at) values ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000003', 'forged', 'forged-1', now())$$,
  '42501',
  'new row violates row-level security policy for table "workouts"',
  'Jorge cannot insert into the friend account'
);
select is((with affected as (update public.workouts set version = 2 where client_id = 'friend-workout' returning 1) select count(*) from affected), 0::bigint, 'Jorge cannot update the friend workout');
select is((with affected as (delete from public.workouts where client_id = 'friend-workout' returning 1) select count(*) from affected), 0::bigint, 'Jorge cannot delete the friend workout');
select throws_ok(
  $$insert into public.workouts (account_id, profile_id, client_id, idempotency_key, completed_at) values ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'profile-forgery', 'forged-2', now())$$,
  '23503',
  null,
  'a profile id from another account cannot be paired with Jorge account ownership'
);
select throws_ok(
  $$update public.profiles set account_id = 'a0000000-0000-0000-0000-000000000002' where client_id = 'alexa'$$,
  '23514',
  'profile ownership is immutable',
  'Alexa ownership cannot be reassigned by a normal update'
);

reset role;
set local role anon;
select throws_ok($$select * from public.accounts$$, '42501', null, 'anonymous users have no table access');

select * from finish();
rollback;
