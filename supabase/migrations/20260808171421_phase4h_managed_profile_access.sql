-- Phase 4H managed-profile membership and least-privilege profile access.
-- Memberships are provisioned only by an administrative database role. They
-- never transfer account ownership and authenticated clients receive SELECT
-- privilege only on the membership table.

create table public.profile_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  profile_id uuid not null,
  access_kind text not null default 'managed-member'
    check (access_kind = 'managed-member'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_memberships_pkey primary key (user_id, profile_id),
  constraint profile_memberships_user_id_key unique (user_id),
  constraint profile_memberships_owned_profile_fk foreign key (account_id, profile_id)
    references public.profiles(account_id, id) on delete cascade
);

create index profile_memberships_account_profile_idx
  on public.profile_memberships (account_id, profile_id);

comment on table public.profile_memberships is
  'Administrative mapping from an Auth user to one existing managed profile. Does not confer account ownership.';

create or replace function private.prevent_membership_identity_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.account_id is distinct from old.account_id
    or new.profile_id is distinct from old.profile_id
    or new.access_kind is distinct from old.access_kind then
    raise exception 'profile membership identity is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_membership_owner_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  if exists (
    select 1 from public.accounts where owner_user_id = new.user_id
  ) then
    raise exception 'an account owner cannot also be a managed-profile member' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_account_member_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.owner_user_id::text, 0));
  if exists (
    select 1 from public.profile_memberships where user_id = new.owner_user_id
  ) then
    raise exception 'a managed-profile member cannot own an account' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_membership_identity_change() from public, anon, authenticated;
revoke all on function private.prevent_membership_owner_overlap() from public, anon, authenticated;
revoke all on function private.prevent_account_member_overlap() from public, anon, authenticated;

create trigger profile_memberships_immutable_identity
before update on public.profile_memberships
for each row execute function private.prevent_membership_identity_change();

create trigger profile_memberships_disjoint_from_owners
before insert or update on public.profile_memberships
for each row execute function private.prevent_membership_owner_overlap();

create trigger accounts_disjoint_from_members
before insert on public.accounts
for each row execute function private.prevent_account_member_overlap();

-- A profile client id participates in the verified runtime shape and cannot be
-- changed after membership has been provisioned.
create or replace function private.prevent_profile_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.account_id is distinct from old.account_id
    or new.client_id is distinct from old.client_id then
    raise exception 'profile ownership is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.has_profile_membership(target_account_id uuid, target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_memberships membership
    where membership.user_id = (select auth.uid())
      and membership.account_id = target_account_id
      and membership.profile_id = target_profile_id
      and membership.access_kind = 'managed-member'
  );
$$;

create or replace function private.can_access_profile(target_account_id uuid, target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.owns_account(target_account_id))
    or (select private.has_profile_membership(target_account_id, target_profile_id));
$$;

create or replace function private.can_access_account(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.owns_account(target_account_id))
    or exists (
      select 1
      from public.profile_memberships membership
      where membership.user_id = (select auth.uid())
        and membership.account_id = target_account_id
        and membership.access_kind = 'managed-member'
    );
$$;

revoke all on function private.has_profile_membership(uuid, uuid) from public, anon;
revoke all on function private.can_access_profile(uuid, uuid) from public, anon;
revoke all on function private.can_access_account(uuid) from public, anon;
grant execute on function private.has_profile_membership(uuid, uuid) to authenticated;
grant execute on function private.can_access_profile(uuid, uuid) to authenticated;
grant execute on function private.can_access_account(uuid) to authenticated;

alter table public.profile_memberships enable row level security;
alter table public.profile_memberships force row level security;

create policy profile_memberships_select_self
on public.profile_memberships for select to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.profile_memberships from public, anon, authenticated;
grant select on table public.profile_memberships to authenticated;

drop policy accounts_select_own on public.accounts;
create policy accounts_select_accessible on public.accounts for select to authenticated
using ((select private.can_access_account(id)));

drop policy profiles_select_owned on public.profiles;
create policy profiles_select_accessible on public.profiles for select to authenticated
using ((select private.can_access_profile(account_id, id)));

drop policy profiles_update_owned on public.profiles;
create policy profiles_update_accessible on public.profiles for update to authenticated
using ((select private.can_access_profile(account_id, id)))
with check ((select private.can_access_profile(account_id, id)));

do $policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'workouts', 'routines', 'bodyweight_entries', 'preferences',
    'active_sessions', 'sync_metadata', 'tombstones'
  ]
  loop
    execute format('drop policy %I on public.%I', table_name || '_select_owned', table_name);
    execute format('drop policy %I on public.%I', table_name || '_insert_owned', table_name);
    execute format('drop policy %I on public.%I', table_name || '_update_owned', table_name);
    execute format('drop policy %I on public.%I', table_name || '_delete_owned', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.can_access_profile(account_id, profile_id)))',
      table_name || '_select_accessible', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select private.can_access_profile(account_id, profile_id)))',
      table_name || '_insert_accessible', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select private.can_access_profile(account_id, profile_id))) with check ((select private.can_access_profile(account_id, profile_id)))',
      table_name || '_update_accessible', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select private.can_access_profile(account_id, profile_id)))',
      table_name || '_delete_accessible', table_name
    );
  end loop;
end;
$policies$;

-- Managed members must never enter independent-account provisioning. The
-- advisory lock and the owner/member disjointness triggers close the race with
-- an administrative membership insert.
create or replace function public.bootstrap_independent_account(requested_display_name text)
returns table (
  account_id uuid,
  owner_user_id uuid,
  account_display_name text,
  profile_id uuid,
  client_id text,
  profile_display_name text,
  pet_enabled boolean,
  accent text,
  theme text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  clean_name text := regexp_replace(trim(requested_display_name), '[[:space:]]+', ' ', 'g');
  owned_account public.accounts%rowtype;
  owned_profile public.profiles%rowtype;
  owned_profile_count bigint;
  created_account boolean := false;
begin
  if caller_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if clean_name is null or length(clean_name) not between 1 and 60 or clean_name ~ '[[:cntrl:]]' then
    raise exception 'display name must contain 1 to 60 normal characters' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(caller_id::text, 0));
  if exists (
    select 1
    from public.profile_memberships membership
    where membership.user_id = caller_id
  ) then
    raise exception 'managed profile membership exists; independent bootstrap is unavailable' using errcode = 'P0001';
  end if;

  perform set_config('big_gains.bootstrap_user_id', caller_id::text, true);

  select a.* into owned_account
  from public.accounts a
  where a.owner_user_id = caller_id
  for update;

  if not found then
    insert into public.accounts (owner_user_id, display_name)
    values (caller_id, clean_name)
    on conflict on constraint accounts_owner_user_id_key do nothing
    returning * into owned_account;
    created_account := found;

    if not created_account then
      select a.* into strict owned_account
      from public.accounts a
      where a.owner_user_id = caller_id
      for update;
    end if;
  end if;

  select count(*) into owned_profile_count
  from public.profiles p
  where p.account_id = owned_account.id;

  if owned_profile_count = 0 then
    if not created_account then
      raise exception 'existing account has no profile; manual review required' using errcode = 'P0001';
    end if;
    insert into public.profiles (
      account_id, client_id, display_name, pet_enabled, accent, theme
    ) values (
      owned_account.id,
      'independent-' || replace(gen_random_uuid()::text, '-', ''),
      clean_name,
      false,
      'cobalt',
      'performance-dark'
    )
    returning * into owned_profile;
  elsif owned_profile_count = 1 then
    select p.* into strict owned_profile
    from public.profiles p
    where p.account_id = owned_account.id;
    if owned_profile.client_id not like 'independent-%' then
      raise exception 'existing profile is not an independent profile; manual review required' using errcode = 'P0001';
    end if;
  else
    raise exception 'existing account has % profiles; manual review required', owned_profile_count using errcode = 'P0001';
  end if;

  perform set_config('big_gains.bootstrap_user_id', '', true);

  return query select
    owned_account.id,
    owned_account.owner_user_id,
    owned_account.display_name,
    owned_profile.id,
    owned_profile.client_id,
    owned_profile.display_name,
    owned_profile.pet_enabled,
    owned_profile.accent,
    owned_profile.theme;
end;
$$;

revoke all on function public.bootstrap_independent_account(text) from public, anon;
grant execute on function public.bootstrap_independent_account(text) to authenticated;
