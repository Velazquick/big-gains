# Phase 4 account roadmap

## Settled model

Supabase is the selected future authentication and private-data provider. GitHub remains source control and may remain an optional snapshot backup; it is not the user database. Big Gains remains local-first, and cloud failure must never block starting, editing, or completing a workout.

Jorge's login owns one cloud account with two independent profiles: Jorge and Alexa. Their workouts, routines, bodyweight history, preferences, active sessions, metadata, and tombstones remain profile-scoped. A future friend login creates a separate account with one friend-owned profile and cannot access Jorge or Alexa data.

Phase 4C connects browser-safe Auth and a synthetic-only completed-workout transport. It may create Jorge's empty account plus Jorge/Alexa profile metadata after sign-in, but it does not inspect, migrate, or upload either local profile's workout data. Local schema version 5 and every existing storage/backup/snapshot format remain unchanged.

## Future migration of existing data

Migration must be explicit, visible, reversible, and safe to retry:

1. Export and retain separate version-5 backups for local Jorge and local Alexa before authentication or remote writes.
2. Authenticate Jorge with Supabase Auth and verify the expected user ID/session.
3. Create exactly one Jorge cloud `accounts` row owned by that Auth user, using a deterministic migration marker.
4. Create Jorge and Alexa cloud `profiles` rows under that same account, retaining stable client profile IDs.
5. Transform and upload each profile's workouts, routines, bodyweight entries, preferences, and current active session with both ownership IDs. Do not delete or rewrite either local state.
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

1. The reviewed schema and hardening migrations are applied to the hosted project; all nine tables have forced RLS and 36 ownership policies.
2. The hosted 18-assertion adversarial pgTAP suite passed inside a rolled-back transaction.
3. The browser client uses only the project URL and publishable key, keeps signed-out use local, and requests existing-user-only Jorge magic links.
4. The durable on-device queue lives outside the version-5 backup object and enforces persist-first/enqueue-second ordering.
5. Completed-workout transport is hard-gated to synthetic operations and acknowledges idempotent lost-response retries.
6. The hosted two-account proof passed and cleanup returned Auth and all application tables to zero rows.
7. No pull, normal-workout upload, real-data migration, Alexa login, or friend signup is enabled.

## Exact next Phase 4C step

Configure the exact hosted production redirect, disable public/anonymous signup, create only Jorge's Auth user, and add the two browser-safe GitHub Pages repository variables. After separate review and deployment, confirm signed-out offline logging first and then test Jorge's magic link plus empty account/profile provisioning. Do not connect normal workout completion and do not upload Jorge/Alexa backups in this step.

The next separately approved sprint should be a preview-only real-data migration dry run: export fresh Jorge/Alexa backups, calculate per-profile counts and checksums without remote writes, display the proposed account/profile mapping, and require explicit approval. Friend onboarding should follow only after Jorge's two-profile account has survived recovery and migration verification.

## Phase 4F delivered boundary

Phase 4F adopts the completed Phase 4E rows as a read-only baseline, reconstructs both profiles under `big-gains.shadow.v1`, and enables production local-to-cloud source mutations only after the Auth/account/profile mapping and migration journal are verified. Local schema version 5 stays authoritative; ACK requires an exact affected-row readback and is followed by parity comparison. Offline, signed-out, wrong-account, outage, conflict, and drift paths never block or modify local training data.

Tombstones now include bodyweight entities, win exact revision ties, and require an explicit strictly later recreation. The browser does not pull, restore, repair, normalize, or merge from Supabase. Phase 4F does not create a friend user.

## Exact Phase 4G step

Create one independent friend Auth user, one friend-owned account, and one profile under that account. Add allowlisted profile presentation configuration so the friend can use a different accent/theme with the pet disabled. Keep authorization based only on the account owner's Auth UUID and the existing RLS ownership chain; presentation values never grant access. Run sustained Jorge/Alexa and friend usage with account-scoped queues and shadow comparisons before considering multi-device merge or cloud authority.

## Phase 4G delivered boundary

Phase 4G implements the production path without creating the real friend Auth user. A fresh device is neutral; an already-created Auth user with no account can invoke one security-invoker, RLS-guarded, idempotent account/profile bootstrap. The resulting independent runtime has one profile, no managed selector, a cloud-UUID local namespace, a separate queue/catalog, generic training defaults, cobalt/performance presentation, and no pet. Jorge/Alexa compatibility keys and two-profile baseline rules are unchanged.

## Exact Phase 4H step

After sustained multi-user proof begins, add a metadata-only sync health and incident ledger plus explicit recovery rehearsals. Expose queue age, retry category, last parity, runtime shape, and client release without storing workout payloads. Add user-guided export/restore and blocked-queue recovery drills. Do not add cloud-to-local merge, automatic repair, multi-device reconciliation, or cloud authority in Phase 4H.
