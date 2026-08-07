# Phase 4 account roadmap

## Settled model

Supabase is the selected future authentication and private-data provider. GitHub remains source control and may remain an optional snapshot backup; it is not the user database. Big Gains remains local-first, and cloud failure must never block starting, editing, or completing a workout.

Jorge's future login owns one cloud account with two independent profiles: Jorge and Alexa. Their workouts, routines, preferences, active sessions, metadata, and tombstones remain profile-scoped. A future friend login creates a separate account with one friend-owned profile and cannot access Jorge or Alexa data.

Phase 4B does not create any of those remote records. It adds the SQL/RLS design, disabled client boundary, queue/idempotency contracts, conflict rules, migration plan, and tests only. Local schema version 5 and every existing storage/backup/snapshot format remain unchanged.

## Future migration of existing data

Migration must be explicit, visible, reversible, and safe to retry:

1. Export and retain separate version-5 backups for local Jorge and local Alexa before authentication or remote writes.
2. Authenticate Jorge with Supabase Auth and verify the expected user ID/session.
3. Create exactly one Jorge cloud `accounts` row owned by that Auth user, using a deterministic migration marker.
4. Create Jorge and Alexa cloud `profiles` rows under that same account, retaining stable client profile IDs.
5. Transform and upload each profile's workouts, routines, preferences, and current active session with both ownership IDs. Do not delete or rewrite either local state.
6. Compare local and remote entity counts plus deterministic checksums per profile/entity type. Any mismatch stops completion and reports the exact category.
7. Write profile-scoped `sync_metadata` only after every verification passes, marking the migration version and completion time.
8. Keep both local copies as the immediate source of truth and as rollback material.
9. Permit retry. Reuse the same account/profile/client IDs and idempotency keys so unique constraints turn repeats into acknowledgements rather than duplicates.

No migration code or automatic migration trigger belongs in Phase 4B.

## Friend onboarding

After Jorge migration and two-way sync are proven, friend signup should authenticate one new Supabase user, create one account whose `owner_user_id` is that user, and create one profile inside that account in a single controlled transaction. The UI then stores only the authenticated account/profile mapping needed by the local profile. No Jorge/Alexa profile picker or identifiers are shared with the friend. RLS—not client filtering—provides isolation.

No production friend UI belongs in Phase 4B.

## Exact Phase 4C recommendation

Phase 4C should implement authentication and a narrow transport adapter, not full onboarding plus migration plus friend UI in one swing:

1. Reproduce the migration and pgTAP RLS suite against a local Supabase stack.
2. Create and link one hosted free Supabase project, apply the reviewed migration, and rerun adversarial tests before any personal data upload.
3. Add Supabase Auth for Jorge only and a browser client built from project URL plus publishable key.
4. Add a durable on-device queue outside the version-5 backup object, then wire local saves to persist-first/enqueue-second.
5. Implement push and acknowledgement for one synthetic profile/entity at a time, starting with completed workouts; require conditional version checks and idempotent retry.
6. Prove pull/conflict/tombstone behavior using synthetic accounts before touching Jorge or Alexa data.
7. Build a preview-only migration dry run with counts/checksums. Actual Jorge/Alexa upload should be a later, separately approved step.

Friend onboarding should follow in Phase 4D after Jorge's two-profile account has survived offline, retry, conflict, and recovery testing.
