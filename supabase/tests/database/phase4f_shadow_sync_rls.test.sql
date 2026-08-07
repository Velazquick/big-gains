begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

select col_has_check('public', 'tombstones', 'entity_type', 'tombstone entity types are constrained');
select has_index('public', 'tombstones', 'tombstones_shadow_revision_idx', 'shadow revision lookup is indexed');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('51000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4f-owner@example.test', '', now(), now()),
  ('52000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4f-friend@example.test', '', now(), now());

insert into public.accounts (id, owner_user_id, display_name) values
  ('5a000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'Phase 4F owner'),
  ('5a000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', 'Phase 4F friend');

insert into public.profiles (id, account_id, client_id, display_name) values
  ('5b000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001', 'jorge', 'Synthetic Jorge'),
  ('5b000000-0000-0000-0000-000000000002', '5a000000-0000-0000-0000-000000000001', 'alexa', 'Synthetic Alexa'),
  ('5b000000-0000-0000-0000-000000000003', '5a000000-0000-0000-0000-000000000002', 'friend', 'Synthetic Friend');

insert into public.tombstones
  (account_id, profile_id, entity_type, entity_id, idempotency_key, version, deleted_at)
values
  ('5a000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000001', 'bodyweight_entries', 'weight-1', 'owner-weight-delete', 2, now()),
  ('5a000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000002', 'routines', 'routine-1', 'owner-routine-delete', 2, now()),
  ('5a000000-0000-0000-0000-000000000002', '5b000000-0000-0000-0000-000000000003', 'workouts', 'friend-workout', 'friend-delete', 2, now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"51000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.tombstones), 2::bigint, 'owner reads Jorge and Alexa tombstones only');
select is((select count(*) from public.tombstones where entity_type = 'bodyweight_entries'), 1::bigint, 'bodyweight tombstones are accepted');
select is((select count(*) from public.tombstones where entity_id = 'friend-workout'), 0::bigint, 'cross-account tombstones are invisible');
select throws_ok(
  $$insert into public.tombstones (account_id, profile_id, entity_type, entity_id, idempotency_key, version, deleted_at) values ('5a000000-0000-0000-0000-000000000002', '5b000000-0000-0000-0000-000000000003', 'workouts', 'forged', 'forged', 1, now())$$,
  '42501', 'new row violates row-level security policy for table "tombstones"',
  'owner cannot forge a tombstone into another account'
);
select throws_ok(
  $$insert into public.tombstones (account_id, profile_id, entity_type, entity_id, idempotency_key, version, deleted_at) values ('5a000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000003', 'workouts', 'cross-profile', 'cross-profile', 1, now())$$,
  '23503', null, 'composite ownership FK rejects a foreign profile'
);
select throws_ok(
  $$update public.tombstones set profile_id = '5b000000-0000-0000-0000-000000000002' where entity_id = 'weight-1'$$,
  '23514', 'account/profile ownership is immutable', 'tombstone profile ownership is immutable'
);
select results_eq(
  $$update public.tombstones set version = 3 where entity_id = 'friend-workout' returning 1$$,
  $$select 1 where false$$, 'owner cannot update another account tombstone'
);
select results_eq(
  $$delete from public.tombstones where entity_id = 'friend-workout' returning 1$$,
  $$select 1 where false$$, 'owner cannot delete another account tombstone'
);
select throws_ok(
  $$insert into public.tombstones (account_id, profile_id, entity_type, entity_id, idempotency_key, version, deleted_at) values ('5a000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000001', 'unknown', 'bad-type', 'bad-type', 1, now())$$,
  '23514', null, 'unknown tombstone entity type is rejected'
);

reset role;
set local role anon;
select throws_ok($$select * from public.tombstones$$, '42501', null, 'anonymous role has no tombstone access');

reset role;
select is(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.tombstones'::regclass),
  true, 'tombstone RLS remains enabled and forced'
);

select * from finish();
rollback;
