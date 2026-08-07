# Browser testing

The Playwright harness serves the static PWA from `index.html` without rewriting it, so production scripts execute in their declared order.

The current baseline is 150 passing Chromium tests with no expected failures. See [ARCHITECTURE.md](ARCHITECTURE.md) for the runtime boundaries these tests protect and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for the required release verification.

## Install

```sh
npm ci
npx playwright install chromium
```

On Linux CI hosts, install Chromium and its system dependencies with `npx playwright install --with-deps chromium`.

## Run

```sh
npm test
npx playwright test --workers=1
```

Both modes must pass all 150 tests with no expected failures. In command-limited environments, use the deterministic `--shard=1/2` and `--shard=2/2` split for both normal and `--workers=1` runs.

V49 coverage in `tests/cloud-shadow.spec.js` verifies migration-envelope adoption without rewrites, `big-gains.shadow.v1` checksums, derived-PR exclusion, no cloud-read profile writes, exact missing/extra/tampered/wrong-profile/stale/newer drift, tombstone tie and recreation rules, local-save-before-queue behavior, signed-out offline queue survival, wrong-account refusal, production lost-ACK recovery, migrated-row transition, and affected-row verification.

## localStorage fixtures

Reusable fixtures live in `tests/fixtures/local-storage.js`:

1. Blank Jorge state
2. Blank Alexa state
3. Active workout with exercises
4. Active workout with two exercises
5. Active workout with zero exercises
6. Completed workouts
7. Malformed but parseable state
8. Legacy state

Workout-control coverage verifies the production hook order, render-only storage behavior, active-session rendering, collapse and expand, exercise ordering and removal, set editing, and completion-driven advancement.

V42 coverage verifies the real delegated chevron path, manual active-card collapse, preserved focus and edits, add-set inheritance/fresh IDs/single insertion/reload persistence, local-time date grouping, multiple workouts per day, empty days, month controls, today/selected accessibility state, shared history detail, return-bar preservation, profile isolation, and offline calendar loading.

V44 coverage in `tests/retrospective-workout.spec.js` verifies past/today eligibility and future exclusion, account-owned weekday defaults and rest-day blanks, routine/blank paths, exercise and set editing/reordering/removal, working-set validation, warm-up exclusion, optional local completion time and duration near UTC midnight, fresh IDs, notes and Entered later history reuse, PR evaluation on/off, volume/progress/calendar/history/workout-count updates, double-click exact-once save, cancel/reload safety, live-workout and return-bar preservation, Jorge/Alexa/synthetic-account isolation, backup normalization, and offline save. Existing shell and offline tests verify the module and stylesheet load once in the v44 app shell.

V45 coverage in `tests/cloud-foundation.spec.js` verifies the disabled-by-default boundary, no network transport even when placeholder configuration exists, explicit account/profile operation ownership, Jorge/Alexa/friend cloud topology, persist-before-enqueue ordering, acknowledgements, offline/disabled queue retention, stable retry idempotency, stale-remote rejection, append-only workout ties, tombstone precedence, immutable ownership, untouched version-5 backups and `big-gains.snapshot.v1`, storage-free cloud helpers, complete RLS enablement, composite owner/profile constraints, anonymous grant removal, and adversarial cross-account SQL examples.

V46 coverage in `tests/cloud-sync.spec.js` verifies queue survival across reload, queue exclusion from schema-version-5 backup data, local-persist-before-enqueue ordering, harmless remote failure, stable keys across retries, offline/reconnect recovery, lost-acknowledgement idempotency with exactly one synthetic remote row, durable acknowledgements, the hard non-synthetic transport rejection, and Jorge magic-link options with signup disabled and the exact GitHub Pages redirect.

V48 coverage in `tests/controlled-migration.spec.js` verifies strict metadata-only audit parsing, exact checksum and mapping gates, changed workout/bodyweight/preference blockers, empty-remote requirements, deterministic target payloads and collision-safe bodyweight IDs, exact planned writes, explicit confirmation, first-run verification, lost-response exact-once recovery, safe mid-run resume, conflict refusal, readback count/checksum failures, source-change failure, journal completion ordering, raw-free post-migration audits, and unchanged local storage/backups/snapshots/schema v5. `supabase/tests/database/phase4e_bodyweight_rls.test.sql` adds hosted adversarial ownership, anonymous denial, composite-FK, unit, and immutability coverage.

Notes coverage verifies the explicit notes hook API, active-session notes rendering and persistence, rest-timer start/resume/expiry messaging, history opening, and saved session-note rendering.

Progress coverage verifies the explicit progress hook API and production script order, library and active-session decoration, history decoration, full progress-panel refresh, removal of global render replacement, and render-only storage behavior.

Shell coverage verifies deterministic production script order, idempotent single initialization, one listener effect per interaction, unique production assets, static selector markup, pet behavior, Alexa shell behavior, and sync snapshot compatibility.

Workout Mode coverage verifies start/resume entry, session-safe explicit exit, elapsed return-bar behavior, Library add/return through `workoutSessionController`, calm/rest/ready/PR pet states, and independent per-profile sound and vibration preferences. Timer-feedback cases cover hidden unsupported-vibration UI, supported vibration calls, removal of the standalone sound-test control, near-silent automatic arming inside trusted workout interactions, safe retries after rejected or non-starting arms, audible Sound-toggle confirmation, session-only explicit-toggle failure state, exactly one completion playback after successful arming, no completion playback after failed arming, one persistent audio element, listener cleanup, the accessible READY fallback, and duplicate feedback prevention.

Phase 3 Sprint 1 coverage in `tests/phase3-workout-hierarchy.spec.js` verifies the three-second READY hold and dismissal, background-return deduplication, reduced motion, hidden preset tray, absolute preset deadlines, active/upcoming/completed card states, honest prior performance, live set progress, manual focus/review, automatic fallback, pet-ready persistence, and session-data preservation. This implements the regression reference for issue #16 without changing the iOS audio fixture or schema version 5.

Phase 3 Sprint 2 coverage in `tests/phase3-completion-experience.spec.js` verifies save-before-display ordering, accurate saved-workout duration/exercise/working-set/volume/PR summaries, warmup exclusion, exactly-once completion and PR persistence, Done navigation, history-detail reuse, reload safety, sync catch-up while the receipt remains visible, pet completion states, reduced motion, heading focus, removal of the standalone sound-test control, trusted-interaction arming, safe retry, one completion chime, and unique audio/listener cleanup. The receipt remains session-only and schema version 5 is unchanged.

## Cache and update coverage

Offline coverage verifies a complete first install, deterministic manifest revisions, unique core assets, migration from the previous Big Gains cache, preservation of unrelated origin caches, awaited precache and runtime writes, visible cache-write failures, ordinary offline reload, active-session reload directly into Workout Mode, and offline loading of the repository-owned WAV chime.

## Legacy migration policy

The undocumented `big-gains-v1` payload is treated as a retained source record, not as a complete import format. Valid legacy weight entries are normalized into Jorge's schema-version-5 state. Legacy workout records are not reconstructed because no supported workout schema exists for that payload; they remain available only in the original, untouched `big-gains-v1` key/value. Regression coverage verifies that invalid weights are rejected, the original payload is preserved byte-for-byte, and repeated loads do not duplicate migrated weights.

## Cross-profile import behavior

The suite verifies that importing an Alexa backup while Jorge is active is rejected with a profile-specific message and leaves both profiles' stored data unchanged.

## State and persistence API coverage

Storage coverage verifies load/normalize/save round trips, profile-key ownership and isolation, backup export/import compatibility, malformed-state recovery, pagehide and hidden-page saves, and render-only behavior. Runtime instrumentation also verifies that profile state reads and writes originate in `state-persistence.js`, with no direct `localStorage` access left in `app.js` or `profiles.js`.

## Not covered

The harness runs Chromium only. It does not validate Safari or Firefox service-worker lifecycle differences, native PWA install prompts, OS-managed update timing, physical vibration hardware, browser background-timer throttling, device silent mode, OS audio routing, whether iOS ignores the temporary one-percent element volume, or the full real-time 2:30 rest-timer expiry. iOS/WebKit may not expose `navigator.vibrate`, including in installed PWAs, and installed iOS PWAs may still suppress the local WAV after a successful trusted-interaction arm. The harness does cover hidden unsupported-vibration UI, trusted-click `HTMLAudioElement` arming and Sound-toggle verification, rejected and non-starting playback safety, Chromium service-worker installation and cache replacement, the guaranteed visual READY fallback, and offline Workout Mode plus sound-asset loading.
# Phase 4A account coverage

`tests/account-context.spec.js` verifies deterministic Jorge/Alexa descriptor mapping, read-only resolution, selection persistence, and a test-only third account. The synthetic account proves isolated storage, state version 5 normalization/save/load, timer preferences, active workout and routines, backup round trips, cross-account rejection, and calendar session namespacing without production navigation changes. Existing storage, workout, notes, progress, calendar, sync, shell-idempotence, migration, and offline tests remain the regression contract.

Release validation remains:

```text
npm test
npx playwright test --workers=1
```

## Phase 4C database coverage

The normal Playwright runs inspect the checked-in migration and adversarial pgTAP file but do not start Docker or connect to Supabase. This keeps Phase 4B fully offline and credential-free.

The Supabase CLI is pinned as a dev dependency. A Docker-compatible runtime is still required for the optional local stack:

```sh
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase db lint --level error
```

`supabase/tests/database/phase4b_rls.test.sql` creates synthetic Jorge and friend Auth identities inside a rolled-back transaction. It proves Jorge sees the Jorge and Alexa profiles under his own account, cannot see/write/update/delete friend data, cannot attach a foreign profile ID to his account, cannot reassign profile ownership, and receives no anonymous table access. It never uses real user data.

After the CLI is securely linked to the intended hosted project, run the same rolled-back test against hosted Postgres:

```sh
DO_NOT_TRACK=1 npx supabase migration list --linked
DO_NOT_TRACK=1 npx supabase test db --linked supabase/tests/database/phase4b_rls.test.sql
```

Do not pass a database password on the command line. Enter it only in the CLI's secure prompt or a short-lived environment controlled by the operator. Hosted tests must use only the checked-in synthetic UUIDs/emails and must finish with `rollback`.

Phase 4C hosted verification passed all 18 pgTAP assertions. A separate publishable-key proof authenticated two ephemeral users, rejected cross-account reads and writes, recovered one completed workout after an idempotent retry, and then deleted both users. Follow-up verification found zero Auth users, zero application rows, eight forced-RLS tables, and 32 ownership policies.
