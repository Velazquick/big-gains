-- Keep Supabase's automatic RLS event trigger internal to database DDL execution.
-- It is not an application RPC and must not be callable by browser roles.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
