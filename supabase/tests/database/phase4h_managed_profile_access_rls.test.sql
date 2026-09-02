begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'profile_memberships', 'managed-profile membership table exists');
select col_is_pk('public', 'profile_memberships', array['user_id', 'profile_id'], 'membership identity is unique per user/profile');
select has_fk('public', 'profile_memberships', 'membership has foreign-key protection');
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.profile_memberships'::regclass),
  'membership RLS is enabled and forced'
);
select ok(has_table_privilege('authenticated', 'public.profile_memberships', 'SELECT'), 'authenticated users may read their membership');
select ok(not has_table_privilege('authenticated', 'public.profile_memberships', 'INSERT'), 'authenticated users cannot create memberships');
select ok(not has_table_privilege('authenticated', 'public.profile_memberships', 'UPDATE'), 'authenticated users cannot rewrite memberships');
select ok(not has_table_privilege('authenticated', 'public.profile_memberships', 'DELETE'), 'authenticated users cannot delete memberships');
select ok(not has_table_privilege('anon', 'public.profile_memberships', 'SELECT'), 'anonymous users have no membership access');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4h-owner@example.test', '', now(), now()),
  ('92000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4h-member@example.test', '', now(), now()),
  ('93000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4h-independent@example.test', '', now(), now()),
  ('94000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'phase4h-unassigned@example.test', '', now(), now());

insert into public.accounts (id, owner_user_id, display_name)
values
  ('91a00000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'Managed account'),
  ('93a00000-0000-0000-0000-000000000003', '93000000-0000-0000-0000-000000000003', 'Independent account');

insert into public.profiles (id, account_id, client_id, display_name, pet_enabled, accent, theme)
values
  ('91b00000-0000-0000-0000-000000000001', '91a00000-0000-0000-0000-000000000001', 'jorge', 'Jorge', true, 'ember', 'performance-dark'),
  ('91b00000-0000-0000-0000-000000000002', '91a00000-0000-0000-0000-000000000001', 'alexa', 'Alexa', true, 'rose', 'wellness-light'),
  ('93b00000-0000-0000-0000-000000000003', '93a00000-0000-0000-0000-000000000003', 'independent-synthetic', 'Synthetic', false, 'cobalt', 'performance-dark');

select lives_ok(
  $$insert into public.profile_memberships (user_id, account_id, profile_id)
    values ('92000000-0000-0000-0000-000000000002', '91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000002')$$,
  'first managed membership succeeds'
);
select throws_ok(
  $$insert into public.profile_memberships (user_id, account_id, profile_id)
    values ('92000000-0000-0000-0000-000000000002', '91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000001')$$,
  '23505', null, 'a second profile membership for the same Auth user is rejected'
);
select is(
  (select profile_id from public.profile_memberships where user_id = '92000000-0000-0000-0000-000000000002'),
  '91b00000-0000-0000-0000-000000000002'::uuid,
  'the rejected second membership leaves the first membership unchanged'
);

insert into public.workouts (account_id, profile_id, client_id, idempotency_key, completed_at)
values
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000001', 'jorge-workout', 'jorge-workout-key', now()),
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000002', 'alexa-workout', 'alexa-workout-key', now()),
  ('93a00000-0000-0000-0000-000000000003', '93b00000-0000-0000-0000-000000000003', 'independent-workout', 'independent-workout-key', now());
insert into public.routines (account_id, profile_id, client_id, idempotency_key)
values
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000001', 'jorge-routine', 'jorge-routine-key'),
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000002', 'alexa-routine', 'alexa-routine-key'),
  ('93a00000-0000-0000-0000-000000000003', '93b00000-0000-0000-0000-000000000003', 'independent-routine', 'independent-routine-key');
insert into public.bodyweight_entries (account_id, profile_id, client_id, idempotency_key, measured_at, weight_value)
values
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000001', 'jorge-weight', 'jorge-weight-key', now(), 200),
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000002', 'alexa-weight', 'alexa-weight-key', now(), 180),
  ('93a00000-0000-0000-0000-000000000003', '93b00000-0000-0000-0000-000000000003', 'independent-weight', 'independent-weight-key', now(), 160);
insert into public.preferences (account_id, profile_id, client_id, idempotency_key)
values
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000001', 'jorge-preference', 'jorge-preference-key'),
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000002', 'alexa-preference', 'alexa-preference-key'),
  ('93a00000-0000-0000-0000-000000000003', '93b00000-0000-0000-0000-000000000003', 'independent-preference', 'independent-preference-key');
insert into public.active_sessions (account_id, profile_id, client_id, idempotency_key)
values
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000001', 'jorge-session', 'jorge-session-key'),
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000002', 'alexa-session', 'alexa-session-key'),
  ('93a00000-0000-0000-0000-000000000003', '93b00000-0000-0000-0000-000000000003', 'independent-session', 'independent-session-key');
insert into public.sync_metadata (account_id, profile_id, client_id)
values
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000001', 'jorge-sync'),
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000002', 'alexa-sync'),
  ('93a00000-0000-0000-0000-000000000003', '93b00000-0000-0000-0000-000000000003', 'independent-sync');
insert into public.tombstones (account_id, profile_id, entity_type, entity_id, idempotency_key, version, deleted_at)
values
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000001', 'workouts', 'jorge-deleted', 'jorge-delete-key', 1, now()),
  ('91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000002', 'workouts', 'alexa-deleted', 'alexa-delete-key', 1, now()),
  ('93a00000-0000-0000-0000-000000000003', '93b00000-0000-0000-0000-000000000003', 'workouts', 'independent-deleted', 'independent-delete-key', 1, now());

select throws_ok(
  $$insert into public.profile_memberships (user_id, account_id, profile_id)
    values ('94000000-0000-0000-0000-000000000004', '93a00000-0000-0000-0000-000000000003', '91b00000-0000-0000-0000-000000000002')$$,
  '23503', null, 'membership cannot cross an account/profile boundary'
);
select throws_ok(
  $$insert into public.profile_memberships (user_id, account_id, profile_id)
    values ('91000000-0000-0000-0000-000000000001', '91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000002')$$,
  '23514', 'an account owner cannot also be a managed-profile member', 'owner and member identities are disjoint'
);
select is(
  (select owner_user_id from public.accounts where id = '91a00000-0000-0000-0000-000000000001'),
  '91000000-0000-0000-0000-000000000001'::uuid,
  'membership does not transfer managed account ownership'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.accounts), 1::bigint, 'managed owner sees only the managed account');
select is((select count(*) from public.profiles), 2::bigint, 'managed owner sees Jorge and Alexa');
select is((select count(*) from public.workouts), 2::bigint, 'managed owner sees both managed workout rows');
select is((select count(*) from public.routines), 2::bigint, 'managed owner sees both managed routine rows');
select is((select count(*) from public.bodyweight_entries), 2::bigint, 'managed owner sees both managed bodyweight rows');
select is((select count(*) from public.preferences), 2::bigint, 'managed owner sees both managed preference rows');
select is((select count(*) from public.active_sessions), 2::bigint, 'managed owner sees both managed active sessions');
select is((select count(*) from public.sync_metadata), 2::bigint, 'managed owner sees both managed sync rows');
select is((select count(*) from public.tombstones), 2::bigint, 'managed owner sees both managed tombstones');
select is((select count(*) from public.workouts where client_id = 'independent-workout'), 0::bigint, 'managed owner cannot read independent workouts');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '92000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"92000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select is((select count(*) from public.profile_memberships), 1::bigint, 'member sees exactly her own membership');
select is((select count(*) from public.accounts), 1::bigint, 'member sees the membership account for resolution');
select is((select count(*) from public.profiles), 1::bigint, 'member sees exactly one profile');
select is((select client_id from public.profiles), 'alexa', 'member profile is the existing Alexa profile');
select is((select count(*) from public.profiles where client_id = 'jorge'), 0::bigint, 'member cannot read Jorge profile metadata');
select is((select count(*) from public.workouts where client_id = 'jorge-workout'), 0::bigint, 'member cannot read Jorge workouts');
select is((select count(*) from public.routines where client_id = 'jorge-routine'), 0::bigint, 'member cannot read Jorge routines');
select is((select count(*) from public.bodyweight_entries where client_id = 'jorge-weight'), 0::bigint, 'member cannot read Jorge bodyweight');
select is((select count(*) from public.preferences where client_id = 'jorge-preference'), 0::bigint, 'member cannot read Jorge preferences');
select is((select count(*) from public.active_sessions where client_id = 'jorge-session'), 0::bigint, 'member cannot read Jorge active sessions');
select is((select count(*) from public.sync_metadata where client_id = 'jorge-sync'), 0::bigint, 'member cannot read Jorge sync metadata');
select is((select count(*) from public.tombstones where entity_id = 'jorge-deleted'), 0::bigint, 'member cannot read Jorge tombstones');
select is((select count(*) from public.workouts where client_id = 'alexa-workout'), 1::bigint, 'member can read Alexa workouts');
select is((select count(*) from public.routines where client_id = 'alexa-routine'), 1::bigint, 'member can read Alexa routines');
select is((select count(*) from public.bodyweight_entries where client_id = 'alexa-weight'), 1::bigint, 'member can read Alexa bodyweight');
select is((select count(*) from public.preferences where client_id = 'alexa-preference'), 1::bigint, 'member can read Alexa preferences');
select is((select count(*) from public.active_sessions where client_id = 'alexa-session'), 1::bigint, 'member can read Alexa active session');
select is((select count(*) from public.sync_metadata where client_id = 'alexa-sync'), 1::bigint, 'member can read Alexa sync metadata');
select is((select count(*) from public.tombstones where entity_id = 'alexa-deleted'), 1::bigint, 'member can read Alexa tombstones');

select results_eq($$update public.profiles set display_name = 'Forged Jorge' where client_id = 'jorge' returning 1$$, $$select 1 where false$$, 'member cannot update Jorge profile');
select results_eq($$update public.workouts set version = 2 where client_id = 'jorge-workout' returning 1$$, $$select 1 where false$$, 'member cannot update Jorge workouts');
select results_eq($$update public.routines set version = 2 where client_id = 'jorge-routine' returning 1$$, $$select 1 where false$$, 'member cannot update Jorge routines');
select results_eq($$update public.bodyweight_entries set version = 2 where client_id = 'jorge-weight' returning 1$$, $$select 1 where false$$, 'member cannot update Jorge bodyweight');
select results_eq($$update public.preferences set version = 2 where client_id = 'jorge-preference' returning 1$$, $$select 1 where false$$, 'member cannot update Jorge preferences');
select results_eq($$update public.active_sessions set version = 2 where client_id = 'jorge-session' returning 1$$, $$select 1 where false$$, 'member cannot update Jorge active sessions');
select results_eq($$update public.sync_metadata set version = 2 where client_id = 'jorge-sync' returning 1$$, $$select 1 where false$$, 'member cannot update Jorge sync metadata');
select results_eq($$update public.tombstones set version = 2 where entity_id = 'jorge-deleted' returning 1$$, $$select 1 where false$$, 'member cannot update Jorge tombstones');
select results_eq($$update public.accounts set display_name = 'Member takeover' returning 1$$, $$select 1 where false$$, 'member cannot update the managed account');
select throws_ok(
  $$insert into public.profiles (account_id, client_id, display_name)
    values ('91a00000-0000-0000-0000-000000000001', 'second-alexa', 'Second Alexa')$$,
  '42501', null, 'member cannot create a second profile'
);
select throws_ok(
  $$insert into public.profile_memberships (user_id, account_id, profile_id)
    values ('92000000-0000-0000-0000-000000000002', '91a00000-0000-0000-0000-000000000001', '91b00000-0000-0000-0000-000000000001')$$,
  '42501', null, 'member cannot attach herself to an arbitrary profile'
);
select throws_ok(
  $$select * from public.bootstrap_independent_account('Member escape')$$,
  'P0001', 'managed profile membership exists; independent bootstrap is unavailable',
  'independent bootstrap is blocked for a managed member'
);
select lives_ok(
  $$update public.preferences set version = 2 where client_id = 'alexa-preference'$$,
  'member may update application rows inside the exact membership profile'
);
select throws_ok(
  $$update public.profiles set client_id = 'alexa-forged' where client_id = 'alexa'$$,
  '23514', 'profile ownership is immutable', 'member cannot change the verified profile client id'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '93000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"93000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is((select count(*) from public.profiles), 1::bigint, 'independent user still sees one independent profile');
select is((select count(*) from public.workouts where client_id in ('jorge-workout', 'alexa-workout')), 0::bigint, 'independent user cannot read managed workouts');
select is((select count(*) from public.profile_memberships), 0::bigint, 'independent user cannot read managed memberships');

-- A brand-new user must still bootstrap after the managed-access SELECT policy
-- is installed. INSERT ... RETURNING checks that policy against the new row.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '94000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"94000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
select lives_ok(
  $$select * from public.bootstrap_independent_account('New independent after managed access')$$,
  'unassigned user can bootstrap with the managed-access policies installed'
);
select is((select count(*) from public.accounts), 1::bigint, 'new independent owner sees only the newly inserted account');
select is((select count(*) from public.profiles), 1::bigint, 'new independent owner sees exactly one profile');
select is((select count(*) from public.profile_memberships), 0::bigint, 'public bootstrap creates no managed membership');
select is((select count(*) from public.workouts), 0::bigint, 'new independent owner cannot see any pre-existing workouts');

reset role;
set local role anon;
select throws_ok($$select * from public.accounts$$, '42501', null, 'anonymous cannot read accounts');
select throws_ok($$select * from public.profile_memberships$$, '42501', null, 'anonymous cannot read memberships');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anonymous cannot read profiles');
select throws_ok($$select * from public.workouts$$, '42501', null, 'anonymous cannot read workouts');
select throws_ok($$select * from public.routines$$, '42501', null, 'anonymous cannot read routines');
select throws_ok($$select * from public.bodyweight_entries$$, '42501', null, 'anonymous cannot read bodyweight');
select throws_ok($$select * from public.preferences$$, '42501', null, 'anonymous cannot read preferences');
select throws_ok($$select * from public.active_sessions$$, '42501', null, 'anonymous cannot read active sessions');
select throws_ok($$select * from public.sync_metadata$$, '42501', null, 'anonymous cannot read sync metadata');
select throws_ok($$select * from public.tombstones$$, '42501', null, 'anonymous cannot read tombstones');

select * from finish();
rollback;
