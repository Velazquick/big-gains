# big-gains

Big Gains is a static, local-first strength-training PWA with the existing managed Jorge/Alexa account plus invited, one-profile independent accounts, JSON backup and restore, one-way private cloud shadows, and a tested offline app shell.

Timer completion always uses the visual and accessible READY cue as its primary feedback. A short repository-owned chime is a best-effort enhancement after the persistent audio element is armed by a trusted workout interaction; installed iOS PWAs may still suppress audio because of device or WebKit policy.

Finishing a workout saves it first, clears the live session once, and then shows a focused, session-only completion summary with duration, completed exercises and working sets, working-set volume, and PR count. Done returns to Today; Review workout reuses the existing history detail.

Expanded exercise cards use an accessible chevron that can keep even the focused exercise manually collapsed until the user reopens it or automatic completion advances focus. “+ Add set” appends one working set seeded from the latest valid working-set values. The Calendar groups completed history by the browser's local calendar date and opens the same workout detail used by Progress; its month and date selection are session-only.

Past and current Calendar dates can also open a focused retrospective editor. It preloads the selected profile's planned weekday routine (or a blank workout on rest days), remains independent from any live workout, and saves an ordinary completed workout with the optional `entryMethod: "retrospective"` marker. Completed working sets flow through Calendar, History, Progress, volume, workout counts, backups, and optional PR evaluation without a second database or history path.

## Project documentation

- [Architecture](ARCHITECTURE.md) — production load order, module boundaries, state and workout lifecycles, profile isolation, backup and sync behavior, offline assets, and CI
- [Release checklist](RELEASE_CHECKLIST.md) — the required checks for production, storage, backup, and service-worker changes
- [Browser testing](TESTING.md) — local commands, fixtures, coverage, and known limits
- [Phase 4 account roadmap](PHASE4_ACCOUNT_ROADMAP.md) — cloud ownership, conflict rules, migration, and friend onboarding
- [Phase 4E migration contract](PHASE4E_MIGRATION_CONTRACT.md) — approved-audit gate, deterministic target rows, recovery journal, readback verification, and post-migration audit
- [Phase 4F shadow-sync contract](PHASE4F_SHADOW_SYNC_CONTRACT.md) — read-only reconstruction, one-way local-first queue, migrated-row adoption, tombstones, drift, and Phase 4G handoff
- [Phase 4G independent-user contract](PHASE4G_INDEPENDENT_USER_CONTRACT.md) — runtime account shapes, bootstrap-only provisioning, presentation tokens, isolated local namespaces, post-deploy onboarding, and sustained proof
- [Supabase setup for Phase 4C](SUPABASE_SETUP.md) — hosted project, Auth redirect, CLI migration, RLS verification, and Pages configuration

The browser suite covers the full local-first app plus the Phase 4D fingerprint, Phase 4E controlled migration, Phase 4F shadow boundary, and Phase 4G independent-user runtime.

## Phase 4G: invited independent user

Release `v50-phase4g-independent-user` adds a neutral fresh-device shell, first-sign-in provisioning for an already-created Auth user, one isolated schema-v5 profile, constrained cobalt/performance presentation with the pet disabled, and an account-scoped Phase 4F shadow queue. Public signup remains disabled and the browser contains no privileged key.

Jorge and Alexa retain their original keys, switcher, presentation, migration baseline, and two-profile parity requirement. An independent profile uses a stable namespace derived from its verified cloud account/profile UUIDs. The database—not client filtering—prevents either account from reading or mutating the other.

Release `v51-szw-presentation-library` adds render-only `merlot` and `slate-dark` presentation tokens plus normalized exercise aliases. It expands the shared canonical library only for genuinely missing movements; existing exercise IDs, routines, schema-v5 records, and Jorge/Alexa presentation remain unchanged.

Release `v52-jorge-train-ui-refresh` gives Jorge's Train preview and active workout a mobile-first performance hierarchy. The refresh is render-only, scoped to the existing `ember` + `performance-dark` presentation tokens, and leaves workout, timer, storage, schema-v5, ownership, and cloud behavior unchanged.

## Phase 4F: verified one-way cloud shadow

Release `v49-phase4f-shadow-sync-readiness` reconstructs Jorge and Alexa from account-scoped Supabase rows, computes deterministic `big-gains.shadow.v1` checksums, adopts the completed Phase 4E migration without rewriting it, and quietly pushes later local source mutations through the durable queue. Every push verifies ownership, base revision, exact idempotency, and affected-row readback before ACK; a full comparison follows.

Local schema version 5 remains authoritative. The UI never waits for cloud work, cloud reads never write profile storage, and cloud values never restore, repair, normalize, or merge local state. Deletions use versioned tombstones and drift is reported without automatic correction.

## Storage compatibility

Current profile state and backups use schema version 5. When Jorge has no current state, valid weight entries from an existing undocumented `big-gains-v1` payload are normalized into the current Jorge profile. The original legacy key/value is left untouched.

Legacy workout records are not imported into schema version 5 because their historical shape was never defined as a supported schema. Those records are retained only inside the untouched `big-gains-v1` payload.
## Phase 4E: controlled real-data migration

Release `v48-phase4e-controlled-migration` adds a separate, user-triggered cloud-copy boundary. It accepts only the selected approved Phase 4D metadata audit plus a fresh exact local checksum and empty-destination verification. It shows exact per-profile/table writes, requires a second inline confirmation, inserts deterministic idempotent rows, resumes matching partial runs, verifies complete account-scoped readback checksums, and exports a metadata-only completion audit. Bodyweight history has a dedicated forced-RLS `bodyweight_entries` table with an explicit pounds (`lb`) contract.

The release does not execute a migration automatically. Local schema version 5, storage keys, backups, snapshots, and ordinary workout behavior remain unchanged; normal cloud sync remains synthetic-only.

## Phase 4C: Jorge auth and synthetic completed-workout sync

Big Gains now ships a browser-safe Supabase client, Jorge-only magic-link sign-in, a durable outbound queue, and a completed-workout transport. The transport has a hard synthetic-only gate: normal Jorge and Alexa workout completion still uses only the existing local schema-version-5 path and cannot enter the cloud queue in this release.

The future cloud model gives Jorge one authenticated account containing separate Jorge and Alexa profiles. A future friend receives a different account containing only the friend's profile. Every profile-scoped cloud row carries both `account_id` and `profile_id`; knowing or guessing a profile ID cannot grant access.

The queue lives at `big-gains-cloud-sync-queue-v1`, outside both profile state objects, JSON backups, and `big-gains.snapshot.v1`. A synthetic mutation persists its explicit proof record locally before enqueue, retries with the same idempotency key, and acknowledges only after Supabase accepts or identifies the same remote row. Signed-out and unconfigured use stays fully local and makes no cloud request.

The existing local contract remains unchanged: schema version 5, Jorge and Alexa storage keys, JSON backups, `big-gains.snapshot.v1`, offline logging, Workout Mode, Calendar, retrospective workouts, timers, PRs, notes, progress, and the pet all use their current paths. Cloud failure must never block workout logging. GitHub is source control plus optional snapshot backup; Supabase is private Auth and user-data storage.
