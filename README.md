# big-gains

Big Gains is a static, local-first strength-training PWA with isolated Jorge and Alexa profiles, JSON backup and restore, optional outbound workout snapshots, and a tested offline app shell.

Timer completion always uses the visual and accessible READY cue as its primary feedback. A short repository-owned chime is a best-effort enhancement after the persistent audio element is armed by a trusted workout interaction; installed iOS PWAs may still suppress audio because of device or WebKit policy.

Finishing a workout saves it first, clears the live session once, and then shows a focused, session-only completion summary with duration, completed exercises and working sets, working-set volume, and PR count. Done returns to Today; Review workout reuses the existing history detail.

Expanded exercise cards use an accessible chevron that can keep even the focused exercise manually collapsed until the user reopens it or automatic completion advances focus. “+ Add set” appends one working set seeded from the latest valid working-set values. The Calendar groups completed history by the browser's local calendar date and opens the same workout detail used by Progress; its month and date selection are session-only.

Past and current Calendar dates can also open a focused retrospective editor. It preloads the selected profile's planned weekday routine (or a blank workout on rest days), remains independent from any live workout, and saves an ordinary completed workout with the optional `entryMethod: "retrospective"` marker. Completed working sets flow through Calendar, History, Progress, volume, workout counts, backups, and optional PR evaluation without a second database or history path.

## Project documentation

- [Architecture](ARCHITECTURE.md) — production load order, module boundaries, state and workout lifecycles, profile isolation, backup and sync behavior, offline assets, and CI
- [Release checklist](RELEASE_CHECKLIST.md) — the required checks for production, storage, backup, and service-worker changes
- [Browser testing](TESTING.md) — local commands, fixtures, coverage, and known limits
- [Phase 4 account roadmap](PHASE4_ACCOUNT_ROADMAP.md) — cloud ownership, conflict rules, migration, and friend onboarding
- [Supabase setup for Phase 4C](SUPABASE_SETUP.md) — hosted project, Auth redirect, CLI migration, RLS verification, and Pages configuration

The stabilized browser-test baseline is 109 passing tests in Chromium with no expected failures.

## Storage compatibility

Current profile state and backups use schema version 5. When Jorge has no current state, valid weight entries from an existing undocumented `big-gains-v1` payload are normalized into the current Jorge profile. The original legacy key/value is left untouched.

Legacy workout records are not imported into schema version 5 because their historical shape was never defined as a supported schema. Those records are retained only inside the untouched `big-gains-v1` payload.
## Phase 4C: Jorge auth and synthetic completed-workout sync

Big Gains now ships a browser-safe Supabase client, Jorge-only magic-link sign-in, a durable outbound queue, and a completed-workout transport. The transport has a hard synthetic-only gate: normal Jorge and Alexa workout completion still uses only the existing local schema-version-5 path and cannot enter the cloud queue in this release.

The future cloud model gives Jorge one authenticated account containing separate Jorge and Alexa profiles. A future friend receives a different account containing only the friend's profile. Every profile-scoped cloud row carries both `account_id` and `profile_id`; knowing or guessing a profile ID cannot grant access.

The queue lives at `big-gains-cloud-sync-queue-v1`, outside both profile state objects, JSON backups, and `big-gains.snapshot.v1`. A synthetic mutation persists its explicit proof record locally before enqueue, retries with the same idempotency key, and acknowledges only after Supabase accepts or identifies the same remote row. Signed-out and unconfigured use stays fully local and makes no cloud request.

The existing local contract remains unchanged: schema version 5, Jorge and Alexa storage keys, JSON backups, `big-gains.snapshot.v1`, offline logging, Workout Mode, Calendar, retrospective workouts, timers, PRs, notes, progress, and the pet all use their current paths. Cloud failure must never block workout logging. GitHub is source control plus optional snapshot backup; Supabase is private Auth and user-data storage.
