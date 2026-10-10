-- Session identity is (account_id, profile_id, client_id), like the other
-- shadow entities. Completed/discarded sessions retain their physical source
-- rows behind winning tombstones; a profile-wide physical singleton therefore
-- rejects the next workout with 23505 and leaves its durable queue blocked.
-- Keep the per-identity unique key, idempotency key, FK and RLS unchanged.
-- No rows, payloads, revisions, timestamps or tombstones are changed here.
set local lock_timeout = '5s';
alter table public.active_sessions
  drop constraint active_sessions_account_id_profile_id_key;
