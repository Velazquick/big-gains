-- Cache request-scoped values once per statement in the Phase 4G bootstrap
-- policies, matching the Supabase RLS init-plan performance guidance.
drop policy accounts_insert_bootstrap_only on public.accounts;
create policy accounts_insert_bootstrap_only on public.accounts for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (select current_setting('big_gains.bootstrap_user_id', true)) = (select auth.uid())::text
);

drop policy profiles_insert_bootstrap_only on public.profiles;
create policy profiles_insert_bootstrap_only on public.profiles for insert to authenticated
with check (
  (select private.owns_account(account_id))
  and (select current_setting('big_gains.bootstrap_user_id', true)) = (select auth.uid())::text
);
