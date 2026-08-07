-- Phase 4B only: private cloud schema and authorization boundary.
-- This migration is intentionally not linked to or applied against a live project.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) > 0),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  client_id text not null check (length(trim(client_id)) > 0),
  display_name text not null check (length(trim(display_name)) > 0),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, id),
  unique (account_id, client_id)
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  profile_id uuid not null,
  client_id text not null check (length(trim(client_id)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  completed_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_owned_profile_fk foreign key (account_id, profile_id)
    references public.profiles(account_id, id) on delete cascade,
  unique (account_id, profile_id, client_id),
  unique (account_id, idempotency_key)
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  profile_id uuid not null,
  client_id text not null check (length(trim(client_id)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routines_owned_profile_fk foreign key (account_id, profile_id)
    references public.profiles(account_id, id) on delete cascade,
  unique (account_id, profile_id, client_id),
  unique (account_id, idempotency_key)
);

create table public.preferences (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  profile_id uuid not null,
  client_id text not null check (length(trim(client_id)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint preferences_owned_profile_fk foreign key (account_id, profile_id)
    references public.profiles(account_id, id) on delete cascade,
  unique (account_id, profile_id, client_id),
  unique (account_id, idempotency_key)
);

create table public.active_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  profile_id uuid not null,
  client_id text not null check (length(trim(client_id)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint active_sessions_owned_profile_fk foreign key (account_id, profile_id)
    references public.profiles(account_id, id) on delete cascade,
  unique (account_id, profile_id),
  unique (account_id, profile_id, client_id),
  unique (account_id, idempotency_key)
);

create table public.sync_metadata (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  profile_id uuid not null,
  client_id text not null check (length(trim(client_id)) > 0),
  last_pulled_at timestamptz,
  last_acknowledged_version bigint not null default 0 check (last_acknowledged_version >= 0),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_metadata_owned_profile_fk foreign key (account_id, profile_id)
    references public.profiles(account_id, id) on delete cascade,
  unique (account_id, profile_id, client_id)
);

create table public.tombstones (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  profile_id uuid not null,
  entity_type text not null check (entity_type in ('workouts', 'routines', 'preferences', 'active_sessions')),
  entity_id text not null check (length(trim(entity_id)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  version bigint not null check (version > 0),
  deleted_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tombstones_owned_profile_fk foreign key (account_id, profile_id)
    references public.profiles(account_id, id) on delete cascade,
  unique (account_id, profile_id, entity_type, entity_id),
  unique (account_id, idempotency_key)
);

create or replace function private.owns_account(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.accounts
    where id = target_account_id
      and owner_user_id = (select auth.uid())
  );
$$;

revoke all on function private.owns_account(uuid) from public, anon;
grant execute on function private.owns_account(uuid) to authenticated;

create or replace function private.prevent_account_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'account ownership is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_profile_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.account_id is distinct from old.account_id then
    raise exception 'profile ownership is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function private.prevent_scoped_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.account_id is distinct from old.account_id
    or new.profile_id is distinct from old.profile_id then
    raise exception 'account/profile ownership is immutable' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_account_owner_change() from public, anon, authenticated;
revoke all on function private.prevent_profile_owner_change() from public, anon, authenticated;
revoke all on function private.prevent_scoped_owner_change() from public, anon, authenticated;

create trigger accounts_immutable_owner before update on public.accounts
for each row execute function private.prevent_account_owner_change();
create trigger profiles_immutable_owner before update on public.profiles
for each row execute function private.prevent_profile_owner_change();
create trigger workouts_immutable_owner before update on public.workouts
for each row execute function private.prevent_scoped_owner_change();
create trigger routines_immutable_owner before update on public.routines
for each row execute function private.prevent_scoped_owner_change();
create trigger preferences_immutable_owner before update on public.preferences
for each row execute function private.prevent_scoped_owner_change();
create trigger active_sessions_immutable_owner before update on public.active_sessions
for each row execute function private.prevent_scoped_owner_change();
create trigger sync_metadata_immutable_owner before update on public.sync_metadata
for each row execute function private.prevent_scoped_owner_change();
create trigger tombstones_immutable_owner before update on public.tombstones
for each row execute function private.prevent_scoped_owner_change();

alter table public.accounts enable row level security;
alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.routines enable row level security;
alter table public.preferences enable row level security;
alter table public.active_sessions enable row level security;
alter table public.sync_metadata enable row level security;
alter table public.tombstones enable row level security;

alter table public.accounts force row level security;
alter table public.profiles force row level security;
alter table public.workouts force row level security;
alter table public.routines force row level security;
alter table public.preferences force row level security;
alter table public.active_sessions force row level security;
alter table public.sync_metadata force row level security;
alter table public.tombstones force row level security;

create policy accounts_select_own on public.accounts for select to authenticated
using (owner_user_id = (select auth.uid()));
create policy accounts_insert_own on public.accounts for insert to authenticated
with check (owner_user_id = (select auth.uid()));
create policy accounts_update_own on public.accounts for update to authenticated
using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy accounts_delete_own on public.accounts for delete to authenticated
using (owner_user_id = (select auth.uid()));

create policy profiles_select_owned on public.profiles for select to authenticated
using ((select private.owns_account(account_id)));
create policy profiles_insert_owned on public.profiles for insert to authenticated
with check ((select private.owns_account(account_id)));
create policy profiles_update_owned on public.profiles for update to authenticated
using ((select private.owns_account(account_id))) with check ((select private.owns_account(account_id)));
create policy profiles_delete_owned on public.profiles for delete to authenticated
using ((select private.owns_account(account_id)));

do $policies$
declare
  table_name text;
begin
  foreach table_name in array array['workouts', 'routines', 'preferences', 'active_sessions', 'sync_metadata', 'tombstones']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.owns_account(account_id)))', table_name || '_select_owned', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.owns_account(account_id)))', table_name || '_insert_owned', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.owns_account(account_id))) with check ((select private.owns_account(account_id)))', table_name || '_update_owned', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.owns_account(account_id)))', table_name || '_delete_owned', table_name);
  end loop;
end;
$policies$;

revoke all on table public.accounts, public.profiles, public.workouts, public.routines,
  public.preferences, public.active_sessions, public.sync_metadata, public.tombstones from public, anon;
grant select, insert, update, delete on table public.accounts, public.profiles, public.workouts,
  public.routines, public.preferences, public.active_sessions, public.sync_metadata, public.tombstones to authenticated;
