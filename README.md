# big-gains

Big Gains is a static, local-first strength-training PWA with the existing managed Jorge/Alexa account plus invited, one-profile independent accounts, JSON backup and restore, one-way private cloud shadows, and a tested offline app shell.

Release `v85-goals-v1-1-observation-fixes` adds post-release Goals refinements: confirmed past-goal deletion, trusted EKF canonicalization for supported historical exact-exercise identity shapes, reason-specific baseline diagnostics, and conditional trajectory/deadline explainability. The v1 next-exposure policy is unchanged: deadlines never accelerate today's load, reps, or set count, and related exercise loads never become exact evidence. Safe recommendations remain editable and retain a bounded decision trace in the existing schema-v5 `preferences/goals` record. Saved routines keep structural authority; workouts, completed history, analytics formulas, Supabase schema/RLS, and queue behavior remain unchanged. See `GOALS_V1_1_OBSERVATION_FIXES.md` for the contained v1.1 boundary.

Timer completion always uses the visual and accessible READY cue as its primary feedback. A short repository-owned chime is a best-effort enhancement after the persistent audio element is armed by a trusted workout interaction; installed iOS PWAs may still suppress audio because of device or WebKit policy.

Finishing a workout saves it first, clears the live session once, and then shows a focused, session-only completion summary with duration, completed exercises and working sets, working-set volume, and PR count. Done returns to Today; Review workout reuses the existing history detail.

Expanded exercise cards use an accessible chevron that can keep even the focused exercise manually collapsed until the user reopens it or automatic completion advances focus. “+ Add set” appends one working set seeded from the latest valid working-set values. The Calendar groups completed history by the browser's local calendar date and opens the same workout detail used by Progress; its month and date selection are session-only.

Past and current Calendar dates can also open a focused retrospective editor. It preloads the selected profile's planned weekday routine (or a blank workout on rest days), remains independent from any live workout, and saves an ordinary completed workout with the optional `entryMethod: "retrospective"` marker. Completed working sets flow through Calendar, History, Progress, volume, workout counts, backups, and optional PR evaluation without a second database or history path.

Release `v76-history-explorer-detail-polish` completes the first History V2 product slice. Progress keeps a compact three-session Recent Training preview, while View History opens a newest-first archive grouped by local month/year. The shared completed-workout detail uses a compact four-metric summary, a dedicated PR callout when earned, and narrow-screen set rows that keep canonical load/bodyweight semantics separate from aligned reps. History cards have full-card interaction feedback and quieter exercise ordering labels. The v74 Edit/Delete flows, IDs, payloads, schema-v5 storage, tombstones, queue revisions, fast-forward behavior, and Jorge/Alexa profile isolation remain unchanged, with no parallel history store or persisted presentation state.

## Project documentation

- [Architecture](ARCHITECTURE.md) — production load order, module boundaries, state and workout lifecycles, profile isolation, backup and sync behavior, offline assets, and CI
- [Goals v1 specification](GOALS_V1_SPEC.md) — normative exact-exercise 1RM lifecycle, estimated-versus-achieved semantics, conservative next-exposure policy, routine/Train authority, evidence notes, navigation decision, and implementation acceptance criteria
- [Release checklist](RELEASE_CHECKLIST.md) — the required checks for production, storage, backup, and service-worker changes
- [Browser testing](TESTING.md) — local commands, fixtures, coverage, and known limits
- [Phase 4 account roadmap](PHASE4_ACCOUNT_ROADMAP.md) — cloud ownership, conflict rules, migration, and friend onboarding
- [Phase 4E migration contract](PHASE4E_MIGRATION_CONTRACT.md) — approved-audit gate, deterministic target rows, recovery journal, readback verification, and post-migration audit
- [Phase 4F shadow-sync contract](PHASE4F_SHADOW_SYNC_CONTRACT.md) — read-only reconstruction, one-way local-first queue, migrated-row adoption, tombstones, drift, and Phase 4G handoff
- [Phase 4G independent-user contract](PHASE4G_INDEPENDENT_USER_CONTRACT.md) — runtime account shapes, bootstrap-only provisioning, presentation tokens, isolated local namespaces, post-deploy onboarding, and sustained proof
- [Phase 4H managed-profile access contract](PHASE4H_MANAGED_PROFILE_ACCESS_CONTRACT.md) — explicit membership, exact-profile RLS, isolated member runtime, and guarded empty-device recovery
- [Supabase setup for Phase 4C](SUPABASE_SETUP.md) — hosted project, Auth redirect, CLI migration, RLS verification, and Pages configuration

The browser suite covers the full local-first app plus the Phase 4D fingerprint, Phase 4E controlled migration, Phase 4F shadow boundary, Phase 4G independent-user runtime, and Phase 4H managed-profile recovery.

## Phase 4H: managed-profile member

Release `v53-phase4h-managed-profile-access` adds an administrative membership from a separate Auth user to one existing managed profile. Account ownership stays with Jorge; a verified Alexa member resolves only the existing Alexa profile with no switcher and an Auth/account/profile-derived storage namespace. The browser cannot create memberships or convert a managed member into an independent account.

Cloud remains non-authoritative except for guarded recovery and the release-v73 remote fast-forward. Recovery may adopt exact cloud-shadow state only into a verified recoverable namespace. A previously synchronized device may explicitly adopt newer changes from the same account/profile only when its queue is empty, its local payload still matches its current catalog, and every remote revision is a monotonic successor. Existing or concurrently edited local state is never overwritten or generally merged.

## Phase 4G: invited independent user

Release `v50-phase4g-independent-user` adds a neutral fresh-device shell, first-sign-in provisioning for an already-created Auth user, one isolated schema-v5 profile, constrained cobalt/performance presentation with the pet disabled, and an account-scoped Phase 4F shadow queue. Public signup remains disabled and the browser contains no privileged key.

Jorge and Alexa retain their original keys, switcher, presentation, migration baseline, and two-profile parity requirement. An independent profile uses a stable namespace derived from its verified cloud account/profile UUIDs. The database—not client filtering—prevents either account from reading or mutating the other.

Release `v51-szw-presentation-library` adds render-only `merlot` and `slate-dark` presentation tokens plus normalized exercise aliases. It expands the shared canonical library only for genuinely missing movements; existing exercise IDs, routines, schema-v5 records, and Jorge/Alexa presentation remain unchanged.

Release `v52-jorge-train-ui-refresh` gives Jorge's Train preview and active workout a mobile-first performance hierarchy. The refresh is render-only, scoped to the existing `ember` + `performance-dark` presentation tokens, and leaves workout, timer, storage, schema-v5, ownership, and cloud behavior unchanged.

## Phase 4F: verified cloud shadow

Release `v49-phase4f-shadow-sync-readiness` reconstructs Jorge and Alexa from account-scoped Supabase rows, computes deterministic `big-gains.shadow.v1` checksums, adopts the completed Phase 4E migration without rewriting it, and quietly pushes later local source mutations through the durable queue. Every push verifies ownership, base revision, exact idempotency, and affected-row readback before ACK; a full comparison follows.

Release `v73-cross-device-remote-fast-forward` adds one explicit cross-device adoption path without changing schema version 5, Auth, RLS, queue ownership, or write conflict rules. Release v74 permits that same guarded path to adopt a higher completed-workout payload revision or tombstone. A fresh comparison that proves a verified same-owner remote fast-forward shows **Changes from another device — Update this device**. The existing recovery adapter reconstructs and validates canonical schema-v5 state, persists it with the new catalog atomically, and reloads only after a fresh parity comparison. Any pending queue, local/catalog mismatch, non-monotonic revision, or equal-revision fingerprint mismatch remains blocked as drift or a real sync conflict.

## Storage compatibility

Current profile state and backups use schema version 5. When Jorge has no current state, valid weight entries from an existing undocumented `big-gains-v1` payload are normalized into the current Jorge profile. The original legacy key/value is left untouched.

Legacy workout records are not imported into schema version 5 because their historical shape was never defined as a supported schema. Those records are retained only inside the untouched `big-gains-v1` payload.
## Phase 4E: controlled real-data migration

Release `v48-phase4e-controlled-migration` adds a separate, user-triggered cloud-copy boundary. It accepts only the selected approved Phase 4D metadata audit plus a fresh exact local checksum and empty-destination verification. It shows exact per-profile/table writes, requires a second inline confirmation, inserts deterministic idempotent rows, resumes matching partial runs, verifies complete account-scoped readback checksums, and exports a metadata-only completion audit. Bodyweight history has a dedicated forced-RLS `bodyweight_entries` table with an explicit pounds (`lb`) contract.

The release does not execute a migration automatically. Local schema version 5, storage keys, backups, snapshots, and ordinary workout behavior remain unchanged; normal cloud sync remains synthetic-only.

## Phase 4C: Jorge auth and synthetic completed-workout sync

Big Gains ships a browser-safe Supabase client with password sign-in for both Safari and the storage-isolated iOS Home Screen app. One-time invitation/recovery links open an isolated password-setup page; Magic Link remains existing-user-only browser compatibility. Every accepted session is verified with `getUser()` before the unchanged owner/member/profile-shape gates run. Cloud or Auth failure never blocks the local schema-version-5 workout path.

The future cloud model gives Jorge one authenticated account containing separate Jorge and Alexa profiles. A future friend receives a different account containing only the friend's profile. Every profile-scoped cloud row carries both `account_id` and `profile_id`; knowing or guessing a profile ID cannot grant access.

The queue lives at `big-gains-cloud-sync-queue-v1`, outside both profile state objects, JSON backups, and `big-gains.snapshot.v1`. A synthetic mutation persists its explicit proof record locally before enqueue, retries with the same idempotency key, and acknowledges only after Supabase accepts or identifies the same remote row. Signed-out and unconfigured use stays fully local and makes no cloud request.

The existing local contract remains unchanged: schema version 5, Jorge and Alexa storage keys, JSON backups, `big-gains.snapshot.v1`, offline logging, Workout Mode, Calendar, retrospective workouts, timers, PRs, notes, progress, and the pet all use their current paths. Cloud failure must never block workout logging. GitHub is source control plus optional snapshot backup; Supabase is private Auth and user-data storage.
