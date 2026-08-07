-- Phase 4E controlled migration support.
-- Bodyweight is longitudinal source data measured in pounds (lb), not a preference.

create table public.bodyweight_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  profile_id uuid not null,
  client_id text not null check (length(trim(client_id)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  measured_at timestamptz not null,
  weight_value numeric(10, 3) not null check (weight_value >= 0),
  unit text not null default 'lb' check (unit = 'lb'),
  version bigint not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bodyweight_entries_owned_profile_fk foreign key (account_id, profile_id)
    references public.profiles(account_id, id) on delete cascade,
  unique (account_id, profile_id, client_id),
  unique (account_id, idempotency_key)
);

comment on column public.bodyweight_entries.weight_value is
  'Bodyweight measured in pounds; the Phase 4E source and target unit contract is lb.';

alter table public.sync_metadata
  add column metadata jsonb not null default '{}'::jsonb
  check (jsonb_typeof(metadata) = 'object');

create trigger bodyweight_entries_immutable_owner before update on public.bodyweight_entries
for each row execute function private.prevent_scoped_owner_change();

alter table public.bodyweight_entries enable row level security;
alter table public.bodyweight_entries force row level security;

create policy bodyweight_entries_select_owned on public.bodyweight_entries for select to authenticated
using ((select private.owns_account(account_id)));
create policy bodyweight_entries_insert_owned on public.bodyweight_entries for insert to authenticated
with check ((select private.owns_account(account_id)));
create policy bodyweight_entries_update_owned on public.bodyweight_entries for update to authenticated
using ((select private.owns_account(account_id)))
with check ((select private.owns_account(account_id)));
create policy bodyweight_entries_delete_owned on public.bodyweight_entries for delete to authenticated
using ((select private.owns_account(account_id)));

revoke all on table public.bodyweight_entries from public, anon;
grant select, insert, update, delete on table public.bodyweight_entries to authenticated;
