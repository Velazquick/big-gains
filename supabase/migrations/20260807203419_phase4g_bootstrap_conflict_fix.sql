-- Hosted repair for the Phase 4G bootstrap conflict target. The original
-- migration is also corrected so fresh databases never need the repair.
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
