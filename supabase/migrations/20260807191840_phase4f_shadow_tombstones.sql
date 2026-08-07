-- Phase 4F one-way shadow-sync deletion contract.
-- Source rows remain available for audit; the highest revision wins, with a
-- tombstone winning an exact version/timestamp tie. A later intentional
-- recreation must use a strictly greater version.

alter table public.tombstones
  drop constraint tombstones_entity_type_check;

alter table public.tombstones
  add constraint tombstones_entity_type_check
  check (entity_type in ('workouts', 'routines', 'bodyweight_entries', 'preferences', 'active_sessions'));

create index tombstones_shadow_revision_idx
  on public.tombstones (account_id, profile_id, entity_type, entity_id, version desc, updated_at desc);

comment on table public.tombstones is
  'Phase 4F deletion markers. Highest version/updated_at wins; tombstone wins an exact tie; recreation requires a later version.';
