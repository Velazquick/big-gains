begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'bodyweight_entries', 'bodyweight table exists');
select has_column('public', 'bodyweight_entries', 'measured_at', 'bodyweight has measured_at');
select has_column('public', 'bodyweight_entries', 'weight_value', 'bodyweight has an explicit value');
select has_column('public', 'bodyweight_entries', 'unit', 'bodyweight has an explicit unit');
select has_column('public', 'sync_metadata', 'metadata', 'sync metadata can hold a metadata-only migration journal');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4e-owner@example.test', '', now(), now()),
  ('42000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4e-friend@example.test', '', now(), now());

insert into public.accounts (id, owner_user_id, display_name) values
  ('4a000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'Phase 4E owner'),
  ('4a000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000002', 'Phase 4E friend');

insert into public.profiles (id, account_id, client_id, display_name) values
  ('4b000000-0000-0000-0000-000000000001', '4a000000-0000-0000-0000-000000000001', 'jorge', 'Synthetic Jorge'),
  ('4b000000-0000-0000-0000-000000000002', '4a000000-0000-0000-0000-000000000001', 'alexa', 'Synthetic Alexa'),
  ('4b000000-0000-0000-0000-000000000003', '4a000000-0000-0000-0000-000000000002', 'friend', 'Synthetic Friend');

insert into public.bodyweight_entries
  (account_id, profile_id, client_id, idempotency_key, measured_at, weight_value, unit)
values
  ('4a000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000001', 'jorge-weight', 'jorge-weight-key', '2026-08-01T12:00:00Z', 210.5, 'lb'),
  ('4a000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000002', 'alexa-weight', 'alexa-weight-key', '2026-08-01T12:00:00Z', 220, 'lb'),
  ('4a000000-0000-0000-0000-000000000002', '4b000000-0000-0000-0000-000000000003', 'friend-weight', 'friend-weight-key', '2026-08-01T12:00:00Z', 180, 'lb');

set local role authenticated;
select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"41000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.bodyweight_entries), 2::bigint, 'owner sees both owned profile histories');
select is((select count(*) from public.bodyweight_entries where client_id = 'friend-weight'), 0::bigint, 'owner cannot read another account history');
select throws_ok(
  $$insert into public.bodyweight_entries (account_id, profile_id, client_id, idempotency_key, measured_at, weight_value) values ('4a000000-0000-0000-0000-000000000002', '4b000000-0000-0000-0000-000000000003', 'forged', 'forged', now(), 200)$$,
  '42501',
  'new row violates row-level security policy for table "bodyweight_entries"',
  'owner cannot forge a write into another account'
);
select throws_ok(
  $$insert into public.bodyweight_entries (account_id, profile_id, client_id, idempotency_key, measured_at, weight_value) values ('4a000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000003', 'cross-profile', 'cross-profile', now(), 200)$$,
  '23503',
  null,
  'composite ownership FK rejects a profile from another account'
);
select throws_ok(
  $$update public.bodyweight_entries set account_id = '4a000000-0000-0000-0000-000000000002' where client_id = 'jorge-weight'$$,
  '23514',
  'account/profile ownership is immutable',
  'account ownership is immutable'
);
select throws_ok(
  $$update public.bodyweight_entries set profile_id = '4b000000-0000-0000-0000-000000000002' where client_id = 'jorge-weight'$$,
  '23514',
  'account/profile ownership is immutable',
  'profile ownership is immutable'
);
select results_eq(
  $$update public.bodyweight_entries set weight_value = 181 where client_id = 'friend-weight' returning 1$$,
  $$select 1 where false$$,
  'owner cannot update another account history'
);
select results_eq(
  $$delete from public.bodyweight_entries where client_id = 'friend-weight' returning 1$$,
  $$select 1 where false$$,
  'owner cannot delete another account history'
);
select throws_ok(
  $$insert into public.bodyweight_entries (account_id, profile_id, client_id, idempotency_key, measured_at, weight_value, unit) values ('4a000000-0000-0000-0000-000000000001', '4b000000-0000-0000-0000-000000000001', 'bad-unit', 'bad-unit', now(), 200, 'kg')$$,
  '23514',
  null,
  'unit contract rejects non-lb values'
);

reset role;
set local role anon;
select throws_ok($$select * from public.bodyweight_entries$$, '42501', null, 'anonymous role has no bodyweight table access');

reset role;
select is(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.bodyweight_entries'::regclass),
  true,
  'bodyweight RLS is enabled and forced'
);

select * from finish();
rollback;
