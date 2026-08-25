begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'program_domains', 'program_domains table exists');
select has_function(
  'public',
  'put_program_domain_guarded',
  array[
    'uuid', 'bigint', 'timestamp with time zone', 'text', 'bigint', 'text',
    'bigint', 'text', 'bigint', 'text', 'bigint', 'timestamp with time zone',
    'jsonb', 'text', 'bigint', 'text', 'bigint', 'text', 'bigint', 'text', 'text'
  ],
  'guarded Program-domain RPC exists'
);

select has_column('public', 'program_domains', 'id', 'Program domains have a UUID row identity');
select has_column('public', 'program_domains', 'account_id', 'Program domains carry account ownership');
select has_column('public', 'program_domains', 'profile_id', 'Program domains carry profile ownership');
select has_column('public', 'program_domains', 'client_id', 'Program domains carry a stable client identity');
select has_column('public', 'program_domains', 'contract', 'Program domains carry an envelope contract');
select has_column('public', 'program_domains', 'contract_version', 'Program domains carry an envelope contract version');
select has_column('public', 'program_domains', 'payload', 'Program domains carry the canonical JSON payload');
select has_column('public', 'program_domains', 'version', 'Program domains carry an aggregate revision');
select has_column('public', 'program_domains', 'fingerprint', 'Program domains carry an aggregate fingerprint');
select has_column('public', 'program_domains', 'definitions_revision', 'Program domains carry a definitions revision');
select has_column('public', 'program_domains', 'definitions_fingerprint', 'Program domains carry a definitions fingerprint');
select has_column('public', 'program_domains', 'heads_revision', 'Program domains carry a heads/status revision');
select has_column('public', 'program_domains', 'heads_fingerprint', 'Program domains carry a heads/status fingerprint');
select has_column('public', 'program_domains', 'sequence_revision', 'Program domains carry a sequence revision');
select has_column('public', 'program_domains', 'sequence_fingerprint', 'Program domains carry a sequence fingerprint');
select has_column('public', 'program_domains', 'idempotency_key', 'Program domains carry the accepted operation identity');
select has_column('public', 'program_domains', 'base_version', 'Program domains retain the accepted aggregate base');
select has_column('public', 'program_domains', 'base_updated_at', 'Program domains retain the accepted base timestamp');
select has_column('public', 'program_domains', 'base_fingerprint', 'Program domains retain the accepted aggregate fingerprint');
select has_column('public', 'program_domains', 'base_definitions_revision', 'Program domains retain the definitions base revision');
select has_column('public', 'program_domains', 'base_heads_revision', 'Program domains retain the heads/status base revision');
select has_column('public', 'program_domains', 'base_sequence_revision', 'Program domains retain the sequence base revision');
select has_column('public', 'program_domains', 'created_at', 'Program domains carry creation time');
select has_column('public', 'program_domains', 'updated_at', 'Program domains carry normalized update time');

select col_has_check('public', 'program_domains', 'client_id', 'stable client ID is constrained');
select col_has_check('public', 'program_domains', 'payload', 'payload structure is constrained');
select col_has_check('public', 'program_domains', 'version', 'aggregate revision is constrained');
select col_has_check('public', 'program_domains', 'fingerprint', 'aggregate fingerprint is constrained');
select has_fk('public', 'program_domains', 'Program domains have an owned-profile foreign key');
select has_index('public', 'program_domains', 'program_domains_profile_key', 'one Program-domain row per profile is indexed and unique');
select has_index('public', 'program_domains', 'program_domains_profile_client_key', 'profile/client semantic identity is indexed and unique');
select has_trigger('public', 'program_domains', 'program_domains_guarded_update', 'guarded revision and immutable identity trigger exists');

select is(
  (select relrowsecurity and relforcerowsecurity
   from pg_class where oid = 'public.program_domains'::regclass),
  true,
  'Program-domain RLS is enabled and forced'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'program_domains'),
  1::bigint,
  'Program domains add exactly one read policy because writes use the guarded RPC'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public' and tablename <> 'program_domains'),
  37::bigint,
  'existing public RLS policy inventory is unchanged'
);
select is(
  (select count(*) from pg_policies where schemaname = 'public'),
  38::bigint,
  'public RLS policy inventory increases only by the Program-domain read policy'
);

select is(
  (select prosecdef from pg_proc where oid = 'public.put_program_domain_guarded(uuid,bigint,timestamptz,text,bigint,text,bigint,text,bigint,text,bigint,timestamptz,jsonb,text,bigint,text,bigint,text,bigint,text,text)'::regprocedure),
  true,
  'guarded Program-domain RPC is security definer'
);
select ok(
  pg_get_functiondef('public.put_program_domain_guarded(uuid,bigint,timestamptz,text,bigint,text,bigint,text,bigint,text,bigint,timestamptz,jsonb,text,bigint,text,bigint,text,bigint,text,text)'::regprocedure)
    like '%SET search_path TO ''''%',
  'guarded Program-domain RPC fixes an empty search path'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.put_program_domain_guarded(uuid,bigint,timestamptz,text,bigint,text,bigint,text,bigint,text,bigint,timestamptz,jsonb,text,bigint,text,bigint,text,bigint,text,text)',
    'EXECUTE'
  ),
  'authenticated may execute the guarded Program-domain RPC'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.put_program_domain_guarded(uuid,bigint,timestamptz,text,bigint,text,bigint,text,bigint,text,bigint,timestamptz,jsonb,text,bigint,text,bigint,text,bigint,text,text)',
    'EXECUTE'
  ),
  'anonymous may not execute the guarded Program-domain RPC'
);
select ok(has_table_privilege('authenticated', 'public.program_domains', 'SELECT'), 'authenticated may read RLS-visible Program domains');
select ok(not has_table_privilege('authenticated', 'public.program_domains', 'INSERT'), 'authenticated has no direct Program-domain insert privilege');
select ok(not has_table_privilege('authenticated', 'public.program_domains', 'UPDATE'), 'authenticated has no direct Program-domain update privilege');
select ok(not has_table_privilege('authenticated', 'public.program_domains', 'DELETE'), 'authenticated has no Program-domain delete privilege');
select ok(not has_table_privilege('anon', 'public.program_domains', 'SELECT'), 'anonymous has no Program-domain table privilege');
select ok(has_table_privilege('service_role', 'public.program_domains', 'SELECT,INSERT,UPDATE'), 'service role retains standard non-delete administrative access');
select ok(not has_table_privilege('service_role', 'public.program_domains', 'DELETE'), 'v1 does not grant service-role hard deletion');

select is((select count(*) from public.program_domains), 0::bigint, 'migration creates no Program-domain rows or backfill');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
values
  ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pps-managed-owner@example.test', '', now(), now()),
  ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pps-managed-member@example.test', '', now(), now()),
  ('a3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pps-independent-one@example.test', '', now(), now()),
  ('a4000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pps-independent-two@example.test', '', now(), now()),
  ('a5000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pps-constraint-owner@example.test', '', now(), now());

insert into public.accounts (id, owner_user_id, display_name)
values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'PPS managed account'),
  ('b3000000-0000-0000-0000-000000000003', 'a3000000-0000-0000-0000-000000000003', 'PPS independent one'),
  ('b4000000-0000-0000-0000-000000000004', 'a4000000-0000-0000-0000-000000000004', 'PPS independent two'),
  ('b5000000-0000-0000-0000-000000000005', 'a5000000-0000-0000-0000-000000000005', 'PPS constraint account');

insert into public.profiles (id, account_id, client_id, display_name)
values
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'jorge', 'Jorge'),
  ('c2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'alexa', 'Alexa'),
  ('c3000000-0000-0000-0000-000000000003', 'b3000000-0000-0000-0000-000000000003', 'independent-one', 'Independent One'),
  ('c4000000-0000-0000-0000-000000000004', 'b4000000-0000-0000-0000-000000000004', 'independent-two', 'Independent Two'),
  ('c5000000-0000-0000-0000-000000000005', 'b5000000-0000-0000-0000-000000000005', 'constraint-profile', 'Constraint Profile');

insert into public.profile_memberships (user_id, account_id, profile_id)
values ('a2000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002');

create function pg_temp.call_program_domain(target_profile uuid, accepted_base jsonb, candidate jsonb)
returns public.program_domains
language sql
set search_path = ''
as $$
  select public.put_program_domain_guarded(
    target_profile,
    (accepted_base ->> 'version')::bigint,
    (accepted_base ->> 'updatedAt')::timestamptz,
    accepted_base ->> 'fingerprint',
    (accepted_base ->> 'definitionsRevision')::bigint,
    accepted_base ->> 'definitionsFingerprint',
    (accepted_base ->> 'headsRevision')::bigint,
    accepted_base ->> 'headsFingerprint',
    (accepted_base ->> 'sequenceRevision')::bigint,
    accepted_base ->> 'sequenceFingerprint',
    (candidate ->> 'version')::bigint,
    (candidate ->> 'updatedAt')::timestamptz,
    candidate -> 'payload',
    candidate ->> 'fingerprint',
    (candidate ->> 'definitionsRevision')::bigint,
    candidate ->> 'definitionsFingerprint',
    (candidate ->> 'headsRevision')::bigint,
    candidate ->> 'headsFingerprint',
    (candidate ->> 'sequenceRevision')::bigint,
    candidate ->> 'sequenceFingerprint',
    candidate ->> 'idempotencyKey'
  );
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a3000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"a3000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select lives_ok(
  $test$select pg_temp.call_program_domain(
    'c3000000-0000-0000-0000-000000000003',
    'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:00:00Z', 'payload', '{}'::jsonb,
      'fingerprint', repeat('a', 64),
      'definitionsRevision', 0, 'definitionsFingerprint', repeat('b', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64),
      'idempotencyKey', 'pps-independent-empty-v1'
    )
  )$test$,
  'independent owner can publish the valid explicit empty envelope through the guarded path'
);
select is((select payload from public.program_domains), '{}'::jsonb, 'explicit empty envelope stores the canonical database empty payload');
select is((select client_id from public.program_domains), 'program-domain', 'guarded write fixes the stable Program-domain client ID');
select is((select version from public.program_domains), 1::bigint, 'explicit empty envelope begins at revision one');
select is((select count(*) from public.program_domains), 1::bigint, 'independent owner reads exactly the owned Program domain');

select lives_ok(
  $test$select pg_temp.call_program_domain(
    'c3000000-0000-0000-0000-000000000003',
    'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:00:00Z', 'payload', '{}'::jsonb,
      'fingerprint', repeat('a', 64),
      'definitionsRevision', 0, 'definitionsFingerprint', repeat('b', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64),
      'idempotencyKey', 'pps-independent-empty-v1'
    )
  )$test$,
  'exact initial-write retry is idempotently accepted'
);
select is((select count(*) from public.program_domains), 1::bigint, 'idempotent retry does not duplicate the Program-domain row');

select throws_ok(
  $test$select pg_temp.call_program_domain(
    'c3000000-0000-0000-0000-000000000003',
    'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:00:00Z', 'payload', jsonb_build_object('unexpected', true),
      'fingerprint', repeat('e', 64),
      'definitionsRevision', 1, 'definitionsFingerprint', repeat('f', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64),
      'idempotencyKey', 'pps-equal-different'
    )
  )$test$,
  '23514', 'program domain equal revision differs from the accepted identity',
  'equal revision with differing payload or fingerprints is rejected'
);

select throws_ok(
  $test$select pg_temp.call_program_domain(
    'c3000000-0000-0000-0000-000000000003',
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:00:00Z', 'fingerprint', repeat('9', 64),
      'definitionsRevision', 0, 'definitionsFingerprint', repeat('b', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64)
    ),
    jsonb_build_object(
      'version', 2, 'updatedAt', '2026-08-25T14:01:00Z', 'payload', jsonb_build_object('routines', jsonb_build_array()),
      'fingerprint', repeat('e', 64),
      'definitionsRevision', 1, 'definitionsFingerprint', repeat('f', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64),
      'idempotencyKey', 'pps-independent-v2-stale'
    )
  )$test$,
  'P0001', 'program domain accepted base is stale',
  'stale guarded aggregate base is rejected'
);

select lives_ok(
  $test$select pg_temp.call_program_domain(
    'c3000000-0000-0000-0000-000000000003',
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:00:00Z', 'fingerprint', repeat('a', 64),
      'definitionsRevision', 0, 'definitionsFingerprint', repeat('b', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64)
    ),
    jsonb_build_object(
      'version', 2, 'updatedAt', '2026-08-25T14:01:00Z', 'payload', jsonb_build_object('routines', jsonb_build_array()),
      'fingerprint', repeat('e', 64),
      'definitionsRevision', 1, 'definitionsFingerprint', repeat('f', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64),
      'idempotencyKey', 'pps-independent-v2'
    )
  )$test$,
  'exact guarded successor is accepted'
);
select is((select version from public.program_domains), 2::bigint, 'guarded successor advances the aggregate revision exactly once');
select is((select base_version from public.program_domains), 1::bigint, 'guarded successor retains its accepted aggregate base');

select throws_ok(
  $test$select pg_temp.call_program_domain(
    'c3000000-0000-0000-0000-000000000003',
    'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:00:00Z', 'payload', '{}'::jsonb,
      'fingerprint', repeat('a', 64),
      'definitionsRevision', 0, 'definitionsFingerprint', repeat('b', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64),
      'idempotencyKey', 'pps-downgrade'
    )
  )$test$,
  '23514', 'program domain revision downgrade is forbidden',
  'revision downgrade is rejected'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a4000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"a4000000-0000-0000-0000-000000000004","role":"authenticated"}', true);

select throws_ok(
  $test$select pg_temp.call_program_domain(
    'c4000000-0000-0000-0000-000000000004',
    'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:00:00Z', 'payload', '[]'::jsonb,
      'fingerprint', repeat('a', 64),
      'definitionsRevision', 0, 'definitionsFingerprint', repeat('b', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64),
      'idempotencyKey', 'pps-malformed-array'
    )
  )$test$,
  '23514', null,
  'non-object envelope payload is rejected at the database boundary'
);
select throws_ok(
  $test$select pg_temp.call_program_domain(
    'c4000000-0000-0000-0000-000000000004',
    'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:00:00Z',
      'fingerprint', repeat('a', 64),
      'definitionsRevision', 0, 'definitionsFingerprint', repeat('b', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64),
      'idempotencyKey', 'pps-null-payload'
    )
  )$test$,
  '23502', null,
  'null envelope payload is rejected at the database boundary'
);
select throws_ok(
  $test$select pg_temp.call_program_domain(
    'c4000000-0000-0000-0000-000000000004',
    'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:00:00Z', 'payload', '{}'::jsonb,
      'fingerprint', repeat('a', 64),
      'definitionsRevision', 1, 'definitionsFingerprint', repeat('b', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('c', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('d', 64),
      'idempotencyKey', 'pps-inconsistent-empty'
    )
  )$test$,
  '23514', null,
  'explicit empty payload cannot claim non-empty component revisions'
);

select lives_ok(
  $test$select pg_temp.call_program_domain(
    'c4000000-0000-0000-0000-000000000004',
    'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:02:00Z', 'payload', '{}'::jsonb,
      'fingerprint', repeat('1', 64),
      'definitionsRevision', 0, 'definitionsFingerprint', repeat('2', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('3', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('4', 64),
      'idempotencyKey', 'pps-independent-two-empty-v1'
    )
  )$test$,
  'second independent owner can write only the owned Program domain'
);
select is((select count(*) from public.program_domains), 1::bigint, 'second independent owner reads only the owned Program domain');
select is((select count(*) from public.program_domains where profile_id = 'c3000000-0000-0000-0000-000000000003'), 0::bigint, 'independent owner cannot read another independent Program domain');
select throws_ok(
  $test$select pg_temp.call_program_domain(
    'c3000000-0000-0000-0000-000000000003', 'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:03:00Z', 'payload', '{}'::jsonb,
      'fingerprint', repeat('1', 64), 'definitionsRevision', 0, 'definitionsFingerprint', repeat('2', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('3', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('4', 64),
      'idempotencyKey', 'pps-independent-cross-write'
    )
  )$test$,
  '42501', 'program domain profile access denied',
  'independent owner cannot write another independent Program domain'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $test$select pg_temp.call_program_domain(
    'c1000000-0000-0000-0000-000000000001', 'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:04:00Z', 'payload', '{}'::jsonb,
      'fingerprint', repeat('1', 64), 'definitionsRevision', 0, 'definitionsFingerprint', repeat('2', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('3', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('4', 64),
      'idempotencyKey', 'pps-jorge-empty-v1'
    )
  )$test$,
  'managed account owner can write the Jorge Program domain'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a2000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $test$select pg_temp.call_program_domain(
    'c2000000-0000-0000-0000-000000000002', 'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:05:00Z', 'payload', '{}'::jsonb,
      'fingerprint', repeat('5', 64), 'definitionsRevision', 0, 'definitionsFingerprint', repeat('6', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('7', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('8', 64),
      'idempotencyKey', 'pps-alexa-empty-v1'
    )
  )$test$,
  'managed member can write the exact Alexa Program domain'
);
select is((select count(*) from public.program_domains), 1::bigint, 'managed member reads exactly one Program domain');
select is((select profile_id from public.program_domains), 'c2000000-0000-0000-0000-000000000002'::uuid, 'managed member reads only the exact Alexa profile');
select throws_ok(
  $test$select pg_temp.call_program_domain(
    'c1000000-0000-0000-0000-000000000001', 'null'::jsonb,
    jsonb_build_object(
      'version', 1, 'updatedAt', '2026-08-25T14:06:00Z', 'payload', '{}'::jsonb,
      'fingerprint', repeat('5', 64), 'definitionsRevision', 0, 'definitionsFingerprint', repeat('6', 64),
      'headsRevision', 0, 'headsFingerprint', repeat('7', 64),
      'sequenceRevision', 0, 'sequenceFingerprint', repeat('8', 64),
      'idempotencyKey', 'pps-alexa-cross-profile'
    )
  )$test$,
  '42501', 'program domain profile access denied',
  'managed member cannot write the Jorge Program domain'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is((select count(*) from public.program_domains), 2::bigint, 'managed owner reads both Jorge and Alexa Program domains');
select is((select count(*) from public.program_domains where profile_id in ('c1000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002')), 2::bigint, 'managed owner visibility is limited to the managed account profiles');
select is((select count(*) from public.program_domains where profile_id in ('c3000000-0000-0000-0000-000000000003', 'c4000000-0000-0000-0000-000000000004')), 0::bigint, 'managed owner cannot read independent Program domains');

select throws_ok(
  $$insert into public.program_domains (
      account_id, profile_id, payload, version, fingerprint,
      definitions_revision, definitions_fingerprint, heads_revision, heads_fingerprint,
      sequence_revision, sequence_fingerprint, idempotency_key, updated_at
    ) values (
      'b1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '{}', 1, repeat('1', 64),
      0, repeat('2', 64), 0, repeat('3', 64), 0, repeat('4', 64), 'pps-direct-write', now()
    )$$,
  '42501', null,
  'authenticated cannot bypass the guarded RPC with direct insert'
);
select throws_ok(
  $$update public.program_domains set version = 9$$,
  '42501', null,
  'authenticated cannot bypass the guarded RPC with direct update'
);

reset role;
select throws_ok(
  $$insert into public.program_domains (
      account_id, profile_id, client_id, payload, version, fingerprint,
      definitions_revision, definitions_fingerprint, heads_revision, heads_fingerprint,
      sequence_revision, sequence_fingerprint, idempotency_key, updated_at
    ) values (
      'b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000005', 'wrong-domain', '{}', 1, repeat('1', 64),
      0, repeat('2', 64), 0, repeat('3', 64), 0, repeat('4', 64), 'pps-wrong-client', now()
    )$$,
  '23514', null,
  'stable client ID cannot name another semantic type'
);
select throws_ok(
  $$insert into public.program_domains (
      account_id, profile_id, payload, version, fingerprint,
      definitions_revision, definitions_fingerprint, heads_revision, heads_fingerprint,
      sequence_revision, sequence_fingerprint, idempotency_key, updated_at
    ) values (
      'b5000000-0000-0000-0000-000000000005', 'c5000000-0000-0000-0000-000000000005', '{}', 2, repeat('1', 64),
      0, repeat('2', 64), 0, repeat('3', 64), 0, repeat('4', 64), 'pps-missing-base', now()
    )$$,
  '23514', null,
  'a later revision cannot be inserted without complete accepted-base metadata'
);
select throws_ok(
  $$insert into public.program_domains (
      account_id, profile_id, payload, version, fingerprint,
      definitions_revision, definitions_fingerprint, heads_revision, heads_fingerprint,
      sequence_revision, sequence_fingerprint, idempotency_key, updated_at
    ) values (
      'b5000000-0000-0000-0000-000000000005', 'c3000000-0000-0000-0000-000000000003', '{}', 1, repeat('1', 64),
      0, repeat('2', 64), 0, repeat('3', 64), 0, repeat('4', 64), 'pps-cross-account-profile', now()
    )$$,
  '23503', null,
  'composite foreign key rejects an account/profile ownership mismatch'
);
select throws_ok(
  $$insert into public.program_domains (
      account_id, profile_id, payload, version, fingerprint,
      definitions_revision, definitions_fingerprint, heads_revision, heads_fingerprint,
      sequence_revision, sequence_fingerprint, idempotency_key, updated_at
    ) values (
      'b3000000-0000-0000-0000-000000000003', 'c3000000-0000-0000-0000-000000000003', '{}', 1, repeat('1', 64),
      0, repeat('2', 64), 0, repeat('3', 64), 0, repeat('4', 64), 'pps-duplicate-profile', now()
    )$$,
  '23505', null,
  'database enforces one Program-domain row per profile'
);
select throws_ok(
  $$update public.program_domains set client_id = 'other-domain' where profile_id = 'c3000000-0000-0000-0000-000000000003'$$,
  '23514', 'program domain identity is immutable',
  'stable Program-domain client ID is immutable'
);
select throws_ok(
  $$update public.program_domains set version = 1 where profile_id = 'c3000000-0000-0000-0000-000000000003'$$,
  '23514', 'program domain revision downgrade is forbidden',
  'database trigger rejects direct revision downgrade even for an administrative writer'
);

set local role anon;
select throws_ok($$select * from public.program_domains$$, '42501', null, 'anonymous cannot read Program domains');
select throws_ok(
  $test$select public.put_program_domain_guarded(
    'c5000000-0000-0000-0000-000000000005',
    null, null, null, null, null, null, null, null, null,
    1, now(), '{}'::jsonb, repeat('1', 64), 0, repeat('2', 64), 0, repeat('3', 64), 0, repeat('4', 64), 'pps-anon'
  )$test$,
  '42501', null,
  'anonymous cannot execute guarded Program-domain writes'
);

select * from finish();
rollback;
