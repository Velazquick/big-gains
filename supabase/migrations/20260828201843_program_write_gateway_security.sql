-- Program Portability Sync v1 write-gateway hardening.
-- The capability remains dormant. This migration creates no rows and moves the
-- privileged write gate out of the exposed Data API schema.

create or replace function private.put_program_domain_guarded(
  caller_user_id uuid,
  target_profile_id uuid,
  expected_version bigint,
  expected_updated_at timestamptz,
  expected_fingerprint text,
  expected_definitions_revision bigint,
  expected_definitions_fingerprint text,
  expected_heads_revision bigint,
  expected_heads_fingerprint text,
  expected_sequence_revision bigint,
  expected_sequence_fingerprint text,
  next_version bigint,
  next_updated_at timestamptz,
  next_payload jsonb,
  next_fingerprint text,
  next_definitions_revision bigint,
  next_definitions_fingerprint text,
  next_heads_revision bigint,
  next_heads_fingerprint text,
  next_sequence_revision bigint,
  next_sequence_fingerprint text,
  operation_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_account_id uuid;
  accepted public.program_domains%rowtype;
begin
  if caller_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select profile.account_id into target_account_id
  from public.profiles profile
  where profile.id = target_profile_id;

  if target_account_id is null
    or not (
      exists (
        select 1
        from public.accounts account
        where account.id = target_account_id
          and account.owner_user_id = caller_user_id
      )
      or exists (
        select 1
        from public.profile_memberships membership
        where membership.user_id = caller_user_id
          and membership.account_id = target_account_id
          and membership.profile_id = target_profile_id
          and membership.access_kind = 'managed-member'
      )
    ) then
    raise exception 'program domain profile access denied' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_profile_id::text, 1)
  );

  select domain.* into accepted
  from public.program_domains domain
  where domain.account_id = target_account_id
    and domain.profile_id = target_profile_id
  for update;

  if not found then
    if expected_version is not null
      or expected_updated_at is not null
      or expected_fingerprint is not null
      or expected_definitions_revision is not null
      or expected_definitions_fingerprint is not null
      or expected_heads_revision is not null
      or expected_heads_fingerprint is not null
      or expected_sequence_revision is not null
      or expected_sequence_fingerprint is not null then
      raise exception 'initial program domain write must not name an accepted base' using errcode = '23514';
    end if;
    if next_version <> 1 then
      raise exception 'initial program domain revision must be one' using errcode = '23514';
    end if;

    insert into public.program_domains (
      account_id,
      profile_id,
      payload,
      version,
      fingerprint,
      definitions_revision,
      definitions_fingerprint,
      heads_revision,
      heads_fingerprint,
      sequence_revision,
      sequence_fingerprint,
      idempotency_key,
      updated_at
    ) values (
      target_account_id,
      target_profile_id,
      next_payload,
      next_version,
      next_fingerprint,
      next_definitions_revision,
      next_definitions_fingerprint,
      next_heads_revision,
      next_heads_fingerprint,
      next_sequence_revision,
      next_sequence_fingerprint,
      operation_idempotency_key,
      next_updated_at
    )
    returning * into accepted;

    return pg_catalog.jsonb_build_object(
      'accepted_id', accepted.id,
      'accepted_version', accepted.version,
      'already_applied', false
    );
  end if;

  if next_version < accepted.version then
    raise exception 'program domain revision downgrade is forbidden' using errcode = '23514';
  end if;

  if next_version = accepted.version then
    if next_updated_at is not distinct from accepted.updated_at
      and next_payload is not distinct from accepted.payload
      and next_fingerprint is not distinct from accepted.fingerprint
      and next_definitions_revision is not distinct from accepted.definitions_revision
      and next_definitions_fingerprint is not distinct from accepted.definitions_fingerprint
      and next_heads_revision is not distinct from accepted.heads_revision
      and next_heads_fingerprint is not distinct from accepted.heads_fingerprint
      and next_sequence_revision is not distinct from accepted.sequence_revision
      and next_sequence_fingerprint is not distinct from accepted.sequence_fingerprint
      and operation_idempotency_key is not distinct from accepted.idempotency_key
      and expected_version is not distinct from accepted.base_version
      and expected_updated_at is not distinct from accepted.base_updated_at
      and expected_fingerprint is not distinct from accepted.base_fingerprint
      and expected_definitions_revision is not distinct from accepted.base_definitions_revision
      and expected_definitions_fingerprint is not distinct from accepted.base_definitions_fingerprint
      and expected_heads_revision is not distinct from accepted.base_heads_revision
      and expected_heads_fingerprint is not distinct from accepted.base_heads_fingerprint
      and expected_sequence_revision is not distinct from accepted.base_sequence_revision
      and expected_sequence_fingerprint is not distinct from accepted.base_sequence_fingerprint then
      return pg_catalog.jsonb_build_object(
        'accepted_id', accepted.id,
        'accepted_version', accepted.version,
        'already_applied', true
      );
    end if;
    raise exception 'program domain equal revision differs from the accepted identity' using errcode = '23514';
  end if;

  if next_version <> accepted.version + 1 then
    raise exception 'program domain revision must advance exactly once' using errcode = '23514';
  end if;

  if expected_version is distinct from accepted.version
    or expected_updated_at is distinct from accepted.updated_at
    or expected_fingerprint is distinct from accepted.fingerprint
    or expected_definitions_revision is distinct from accepted.definitions_revision
    or expected_definitions_fingerprint is distinct from accepted.definitions_fingerprint
    or expected_heads_revision is distinct from accepted.heads_revision
    or expected_heads_fingerprint is distinct from accepted.heads_fingerprint
    or expected_sequence_revision is distinct from accepted.sequence_revision
    or expected_sequence_fingerprint is distinct from accepted.sequence_fingerprint then
    raise exception 'program domain accepted base is stale' using errcode = 'P0001';
  end if;

  update public.program_domains
  set payload = next_payload,
      version = next_version,
      fingerprint = next_fingerprint,
      definitions_revision = next_definitions_revision,
      definitions_fingerprint = next_definitions_fingerprint,
      heads_revision = next_heads_revision,
      heads_fingerprint = next_heads_fingerprint,
      sequence_revision = next_sequence_revision,
      sequence_fingerprint = next_sequence_fingerprint,
      idempotency_key = operation_idempotency_key,
      base_version = expected_version,
      base_updated_at = expected_updated_at,
      base_fingerprint = expected_fingerprint,
      base_definitions_revision = expected_definitions_revision,
      base_definitions_fingerprint = expected_definitions_fingerprint,
      base_heads_revision = expected_heads_revision,
      base_heads_fingerprint = expected_heads_fingerprint,
      base_sequence_revision = expected_sequence_revision,
      base_sequence_fingerprint = expected_sequence_fingerprint,
      updated_at = next_updated_at
  where id = accepted.id
  returning * into accepted;

  return pg_catalog.jsonb_build_object(
    'accepted_id', accepted.id,
    'accepted_version', accepted.version,
    'already_applied', false
  );
end;
$$;

comment on function private.put_program_domain_guarded(
  uuid, uuid, bigint, timestamptz, text, bigint, text, bigint, text, bigint, text,
  bigint, timestamptz, jsonb, text, bigint, text, bigint, text, bigint, text, text
) is
  'Privileged Program-domain write gate. Caller identity is verified by the authenticated Edge gateway and independently checked against the target account/profile here.';

grant usage on schema private to service_role;
revoke all on function private.put_program_domain_guarded(
  uuid, uuid, bigint, timestamptz, text, bigint, text, bigint, text, bigint, text,
  bigint, timestamptz, jsonb, text, bigint, text, bigint, text, bigint, text, text
) from public, anon, authenticated, service_role;
grant execute on function private.put_program_domain_guarded(
  uuid, uuid, bigint, timestamptz, text, bigint, text, bigint, text, bigint, text,
  bigint, timestamptz, jsonb, text, bigint, text, bigint, text, bigint, text, text
) to service_role;

drop function public.put_program_domain_guarded(
  uuid, bigint, timestamptz, text, bigint, text, bigint, text, bigint, text,
  bigint, timestamptz, jsonb, text, bigint, text, bigint, text, bigint, text, text
);
