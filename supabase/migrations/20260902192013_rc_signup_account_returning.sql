-- INSERT ... RETURNING must satisfy SELECT RLS for the proposed account row.
-- The existing STABLE ownership helper queries public.accounts and cannot see
-- that row in the inserting statement's snapshot. Read ownership directly from
-- the proposed row, while retaining the existing managed-membership path.
-- INSERT remains restricted to the caller-bound atomic bootstrap guard.
alter policy accounts_select_accessible on public.accounts
using (
  owner_user_id = (select auth.uid())
  or (select private.can_access_account(id))
);
