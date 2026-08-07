# Phase 4 account roadmap

## Settled model

Supabase is the selected future authentication and private-data provider. GitHub remains source control and may remain an optional snapshot backup; it is not the user database. Big Gains remains local-first, and cloud failure must never block starting, editing, or completing a workout.

Jorge's future login owns one cloud account with two independent profiles: Jorge and Alexa. Their workouts, routines, preferences, active sessions, metadata, and tombstones remain profile-scoped. A future friend login creates a separate account with one friend-owned profile and cannot access Jorge or Alexa data.

Phase 4C connects browser-safe Auth and a synthetic-only completed-workout transport. It may create Jorge's empty account plus Jorge/Alexa profile metadata after sign-in, but it does not inspect, migrate, or upload either local profile's workout data. Local schema version 5 and every existing storage/backup/snapshot format remain unchanged.

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

No real-data migration code or automatic migration trigger belongs in Phase 4C.

## Friend onboarding

After Jorge migration and two-way sync are proven, friend signup should authenticate one new Supabase user, create one account whose `owner_user_id` is that user, and create one profile inside that account in a single controlled transaction. The UI then stores only the authenticated account/profile mapping needed by the local profile. No Jorge/Alexa profile picker or identifiers are shared with the friend. RLS—not client filtering—provides isolation.

No production friend UI belongs in Phase 4C.

## Phase 4C delivered boundary

Phase 4C deliberately implements authentication and a narrow transport adapter, not full onboarding plus migration plus friend UI:

1. The reviewed schema and hardening migrations are applied to the hosted project; all eight tables have forced RLS and 32 ownership policies.
2. The hosted 18-assertion adversarial pgTAP suite passed inside a rolled-back transaction.
3. The browser client uses only the project URL and publishable key, keeps signed-out use local, and requests existing-user-only Jorge magic links.
4. The durable on-device queue lives outside the version-5 backup object and enforces persist-first/enqueue-second ordering.
5. Completed-workout transport is hard-gated to synthetic operations and acknowledges idempotent lost-response retries.
6. The hosted two-account proof passed and cleanup returned Auth and all application tables to zero rows.
7. No pull, normal-workout upload, real-data migration, Alexa login, or friend signup is enabled.

## Exact next Phase 4C step

Configure the exact hosted production redirect, disable public/anonymous signup, create only Jorge's Auth user, and add the two browser-safe GitHub Pages repository variables. After separate review and deployment, confirm signed-out offline logging first and then test Jorge's magic link plus empty account/profile provisioning. Do not connect normal workout completion and do not upload Jorge/Alexa backups in this step.

The next separately approved sprint should be a preview-only real-data migration dry run: export fresh Jorge/Alexa backups, calculate per-profile counts and checksums without remote writes, display the proposed account/profile mapping, and require explicit approval. Friend onboarding should follow only after Jorge's two-profile account has survived recovery and migration verification.
