-- Program Portability Sync v1, Slice 1.
-- This creates the dormant cloud source boundary only. No rows are backfilled
-- and no browser runtime is wired to this table or RPC in this migration.

create table public.program_domains (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  profile_id uuid not null,
  client_id text not null default 'program-domain'
    constraint program_domains_client_id_check check (client_id = 'program-domain'),
  contract text not null default 'big-gains.program-portability-envelope.v1'
    constraint program_domains_contract_check
      check (contract = 'big-gains.program-portability-envelope.v1'),
  contract_version smallint not null default 1
    constraint program_domains_contract_version_check check (contract_version = 1),
  payload jsonb not null
    constraint program_domains_payload_object_check check (jsonb_typeof(payload) = 'object'),
  version bigint not null
    constraint program_domains_version_check check (version > 0),
  fingerprint text not null
    constraint program_domains_fingerprint_check check (fingerprint ~ '^[0-9a-f]{64}$'),
  definitions_revision bigint not null
    constraint program_domains_definitions_revision_check check (definitions_revision >= 0),
  definitions_fingerprint text not null
    constraint program_domains_definitions_fingerprint_check
      check (definitions_fingerprint ~ '^[0-9a-f]{64}$'),
  heads_revision bigint not null
    constraint program_domains_heads_revision_check check (heads_revision >= 0),
  heads_fingerprint text not null
    constraint program_domains_heads_fingerprint_check
      check (heads_fingerprint ~ '^[0-9a-f]{64}$'),
  sequence_revision bigint not null
    constraint program_domains_sequence_revision_check check (sequence_revision >= 0),
  sequence_fingerprint text not null
    constraint program_domains_sequence_fingerprint_check
      check (sequence_fingerprint ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null
    constraint program_domains_idempotency_key_check check (length(trim(idempotency_key)) > 0),
  base_version bigint,
  base_updated_at timestamptz,
  base_fingerprint text,
  base_definitions_revision bigint,
  base_definitions_fingerprint text,
  base_heads_revision bigint,
  base_heads_fingerprint text,
  base_sequence_revision bigint,
  base_sequence_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null,
  constraint program_domains_owned_profile_fk foreign key (account_id, profile_id)
    references public.profiles(account_id, id) on delete cascade,
  constraint program_domains_profile_key unique (account_id, profile_id),
  constraint program_domains_profile_client_key unique (account_id, profile_id, client_id),
  constraint program_domains_idempotency_key unique (account_id, idempotency_key),
  constraint program_domains_base_shape_check check (
    (
      version = 1
      and base_version is null
      and base_updated_at is null
      and base_fingerprint is null
      and base_definitions_revision is null
      and base_definitions_fingerprint is null
      and base_heads_revision is null
      and base_heads_fingerprint is null
      and base_sequence_revision is null
      and base_sequence_fingerprint is null
    )
    or
    (
      version > 1
      and base_version is not null
      and base_version = version - 1
      and base_updated_at is not null
      and base_fingerprint is not null
      and base_fingerprint ~ '^[0-9a-f]{64}$'
      and base_definitions_revision is not null
      and base_definitions_revision >= 0
      and base_definitions_fingerprint is not null
      and base_definitions_fingerprint ~ '^[0-9a-f]{64}$'
      and base_heads_revision is not null
      and base_heads_revision >= 0
      and base_heads_fingerprint is not null
      and base_heads_fingerprint ~ '^[0-9a-f]{64}$'
      and base_sequence_revision is not null
      and base_sequence_revision >= 0
      and base_sequence_fingerprint is not null
      and base_sequence_fingerprint ~ '^[0-9a-f]{64}$'
    )
  ),
  constraint program_domains_empty_payload_check check (
    (
      payload = '{}'::jsonb
      and definitions_revision = 0
      and heads_revision = 0
      and sequence_revision = 0
    )
    or
    (
      payload <> '{}'::jsonb
      and (definitions_revision > 0 or heads_revision > 0 or sequence_revision > 0)
    )
  )
);

comment on table public.program_domains is
  'One guarded whole-graph Program portability envelope per profile. Slice 1 creates no rows and has no runtime consumer.';
comment on column public.program_domains.payload is
  'Canonical Program semantic payload. The database owns object/non-null and explicit-empty shape; the runtime validator owns the complete envelope schema and graph invariants.';
comment on constraint program_domains_empty_payload_check on public.program_domains is
  'The database-level explicit no-Program representation is an empty JSON object with all three component revisions at zero.';

create or replace function private.enforce_program_domain_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.account_id is distinct from old.account_id
    or new.profile_id is distinct from old.profile_id
    or new.client_id is distinct from old.client_id
    or new.contract is distinct from old.contract
    or new.contract_version is distinct from old.contract_version
    or new.created_at is distinct from old.created_at then
    raise exception 'program domain identity is immutable' using errcode = '23514';
  end if;

  if new.version < old.version then
    raise exception 'program domain revision downgrade is forbidden' using errcode = '23514';
  end if;

  if new.version = old.version then
    if new is not distinct from old then
      return old;
    end if;
    raise exception 'program domain equal revision differs from the accepted identity' using errcode = '23514';
  end if;

  if new.version <> old.version + 1 then
    raise exception 'program domain revision must advance exactly once' using errcode = '23514';
  end if;

  if new.base_version is distinct from old.version
    or new.base_updated_at is distinct from old.updated_at
    or new.base_fingerprint is distinct from old.fingerprint
    or new.base_definitions_revision is distinct from old.definitions_revision
    or new.base_definitions_fingerprint is distinct from old.definitions_fingerprint
    or new.base_heads_revision is distinct from old.heads_revision
    or new.base_heads_fingerprint is distinct from old.heads_fingerprint
    or new.base_sequence_revision is distinct from old.sequence_revision
    or new.base_sequence_fingerprint is distinct from old.sequence_fingerprint then
    raise exception 'program domain accepted base is stale' using errcode = 'P0001';
  end if;

  if new.updated_at < old.updated_at then
    raise exception 'program domain update time cannot move backward' using errcode = '23514';
  end if;
  if new.fingerprint = old.fingerprint then
    raise exception 'program domain successor fingerprint must change' using errcode = '23514';
  end if;
  if new.idempotency_key = old.idempotency_key then
    raise exception 'program domain successor must use a new operation identity' using errcode = '23514';
  end if;

  if not (
    (new.definitions_revision = old.definitions_revision
      and new.definitions_fingerprint = old.definitions_fingerprint)
    or
    (new.definitions_revision = old.definitions_revision + 1
      and new.definitions_fingerprint <> old.definitions_fingerprint)
  ) then
    raise exception 'program domain definitions component is not a valid successor' using errcode = '23514';
  end if;

  if not (
    (new.heads_revision = old.heads_revision
      and new.heads_fingerprint = old.heads_fingerprint)
    or
    (new.heads_revision = old.heads_revision + 1
      and new.heads_fingerprint <> old.heads_fingerprint)
  ) then
    raise exception 'program domain heads component is not a valid successor' using errcode = '23514';
  end if;

  if not (
    (new.sequence_revision = old.sequence_revision
      and new.sequence_fingerprint = old.sequence_fingerprint)
    or
    (new.sequence_revision = old.sequence_revision + 1
      and new.sequence_fingerprint <> old.sequence_fingerprint)
  ) then
    raise exception 'program domain sequence component is not a valid successor' using errcode = '23514';
  end if;

  if new.definitions_revision = old.definitions_revision
    and new.heads_revision = old.heads_revision
    and new.sequence_revision = old.sequence_revision then
    raise exception 'program domain successor must advance a component revision' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_program_domain_update() from public, anon, authenticated, service_role;

create trigger program_domains_guarded_update
before update on public.program_domains
for each row execute function private.enforce_program_domain_update();

alter table public.program_domains enable row level security;
alter table public.program_domains force row level security;

create policy program_domains_select_accessible
on public.program_domains for select to authenticated
using ((select private.can_access_profile(account_id, profile_id)));

revoke all on table public.program_domains from public, anon, authenticated;
grant select on table public.program_domains to authenticated;
grant select, insert, update on table public.program_domains to service_role;

create or replace function public.put_program_domain_guarded(
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
returns public.program_domains
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  target_account_id uuid;
  accepted public.program_domains%rowtype;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select profile.account_id into target_account_id
  from public.profiles profile
  where profile.id = target_profile_id;

  if target_account_id is null
    or not (select private.can_access_profile(target_account_id, target_profile_id)) then
    raise exception 'program domain profile access denied' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_profile_id::text, 1));

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

    return accepted;
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
      return accepted;
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

  return accepted;
end;
$$;

revoke all on function public.put_program_domain_guarded(
  uuid, bigint, timestamptz, text, bigint, text, bigint, text, bigint, text,
  bigint, timestamptz, jsonb, text, bigint, text, bigint, text, bigint, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.put_program_domain_guarded(
  uuid, bigint, timestamptz, text, bigint, text, bigint, text, bigint, text,
  bigint, timestamptz, jsonb, text, bigint, text, bigint, text, bigint, text, text
) to authenticated;
