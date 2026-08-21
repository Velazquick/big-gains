# Browser testing

The Playwright harness serves the static PWA from `index.html` without rewriting it, so production scripts execute in their declared order.

The current baseline is 443 passing Chromium tests across 54 files with no expected failures. See [ARCHITECTURE.md](ARCHITECTURE.md) for the runtime boundaries these tests protect and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for the required release verification.

V91 coverage in `tests/history-plan-nav-migration.spec.js` freezes the five persistent destinations as Today, Plan, Train, Progress, and Library; verifies that Calendar is absent from persistent navigation; and keeps Plan's v90 landing as the promoted destination. It verifies Progress-owned History defaults to List, exposes the same workout through List and Calendar, returns detail to its originating view, safely resolves legacy History/Calendar deep links, preserves keyboard switching, remains profile- and schema-v5-safe, leaves active Train state untouched, and works from the installed offline shell. Existing History edit/delete, Calendar browsing, Today/Goals/Program links, Program Setup/Analyzer, Progress, Exercise Picker, EKF/catalog, storage/profile-isolation, and service-worker suites remain the compatibility contract.

V88 coverage in `tests/exercise-picker.spec.js` freezes exact canonical add/replace behavior, Program approval invalidation, duplicate exclusion, labeled suggestions, true A–Z ordering, trusted-alias search, composable muscle/equipment filters, EKF measurement labels, current-profile Recent isolation, strict strength-Goal eligibility, focus/Escape/Back behavior, offline catalog use, and the existing retrospective save authority. Existing Program-1A, Goal, Routine, Library, Train, History/Progress, profile/storage, catalog/EKF, harness, and offline suites remain the compatibility contract.

EKF-3 coverage freezes all 119 accepted EKF-2 identities and contracts, validates 36 new opaque identities and explicit measurement contracts, audits 58 candidate decisions, excludes quarantined rights and external media, verifies deterministic curation/catalog generation, and exercises new machine, unilateral, sled, erg, timed-work, alias-search, card-label, analytics, and offline behavior.

V71 coverage freezes explicit retrospective set-type selection so ordinary value/performed interactions cannot silently turn working sets into warm-ups. Canonical exercise identity now resolves bodyweight versus external-load validation: bodyweight work accepts zero added load and renders as Bodyweight or Bodyweight + load, weighted exercises still require positive external load, and pre-existing completed-workout payloads remain byte-for-byte equivalent through new logging.

V72 coverage keeps added load as the persisted bodyweight-set value while deriving effective analytics load from the current profile's latest valid bodyweight plus that added load. Missing profile bodyweight produces unavailable effective-load volume/e1RM rather than an invented value, and analytics reads never mutate completed-workout payloads.

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

Both modes must pass all 443 browser tests with no expected failures. In command-limited environments, use deterministic shards that together cover the complete collection for both normal and `--workers=1` runs.

V69 coverage in `tests/timer-reliability-visibility.spec.js` and `tests/workout-mode.spec.js` verifies that an inactive rest has no visible timer, Skip hides immediately, READY hides after its existing three-second feedback window, and the next qualifying set starts a fresh visible countdown. It also freezes the visually hidden but accessible sound-toggle status, the bottom Add Exercise action's existing Library/session-controller flow, and its separate 44px-or-larger mobile touch target. Existing timer characterization, workout/session ownership, mobile presentation, retrospective, profile isolation, local-first cloud failure, and offline suites remain the compatibility contract.

V68 coverage in `tests/thin-app-composition.spec.js` freezes the pre-extraction set-row behavior and final ownership boundary. Black-box cases cover working and warm-up weight/reps edits, exact numeric/blank normalization, working and warm-up completion, complete-to-incomplete toggles, one rest deadline per qualifying completion, no restart from ordinary edits or re-editing, local-save-before-rejected-cloud-capture ordering, notes/rest-preference isolation, previous-performance immutability, live imported state replacement, and Jorge/Alexa profile isolation. Source/API assertions verify that `WorkoutSessionController` owns set/session mutation without DOM/storage/cloud access, while `app.js` and `workoutControls` retain only DOM/rendering and compatibility adapters. Existing workout controls, session lifecycle, timer, notes, completion, routines, storage/import, cloud-shadow, recovery, profile, harness, and offline suites remain the behavioral contract.

V67 coverage in `tests/workout-session-controller.spec.js` freezes the extracted immutable factory/instance API, exact seeded and unseeded active-exercise payloads, warm-up rounding, working-set count and positional previous-performance seeding, target-rep metadata, and history immutability. Integrated cases cover start/resume/replace, timer invalidation, partial routine loading and deduplication, narrow empty-session repair, add-without-session and duplicate blocking, live same-profile state replacement, zero-work completion refusal, completed-set filtering, duration and the existing sequential Epley PR semantics, exact cloud-shadow workout payloads, discard/timer teardown, local-save-before-rejected-cloud-capture ordering, and managed-profile isolation. Session, routine, timer, completion, storage/import, cloud-shadow, profile, harness, and offline suites remain the end-to-end compatibility contract.

V66 coverage in `tests/routine-engine.spec.js` freezes the full shared Jorge/Alexa routine identity and order, SZW variant interpretation, legacy ID-array and structured-prescription reads, custom precedence, reset fallback, read-time immutability, and live same-profile state replacement. Existing routine editor, standard/SZW routine, session-controller, retrospective, catalog, storage/import, cloud-shadow, profile-isolation, harness, and offline specs verify that active/completed records and schema-v5/cloud representations remain unchanged. Harness and offline coverage enforce `routine-engine.js` after `exercise-catalog.js` and before `app.js`, plus the immutable factory/instance boundary without DOM, persistence, or cloud access.

V65 coverage in `tests/exercise-catalog.spec.js` freezes all 119 ordered v64 canonical exercise IDs plus a full metadata fingerprint covering names, day/category, muscle, equipment, aliases, and family. It verifies every name and alias resolves and searches to its existing owner, exact shorthand/search result ordering, unchanged ID generation, Jorge day filtering, Alexa and SZW full-library visibility, all six SZW routine lookups, and retrospective `definitionId || id` identity without instance-ID normalization. Harness coverage verifies the frozen `BigGainsExerciseCatalog` API, the identical `bigGainsExerciseCatalog` compatibility alias, the absence of DOM/persistence/cloud access, and production load order. Existing Phase 4I analytics, routine/editor, retrospective, profile, and offline specs remain the integration contract.

V64 coverage retains the 18 black-box tests in `tests/timer-controller-characterization.spec.js` for stale workout/deadline callbacks, double Skip, exact duration precedence, one-shot consumption, local-first cloud-failure behavior, profile isolation, lifecycle-event equivalence, READY teardown, and schema-v5/cloud-shadow shape. Harness coverage verifies the immutable `BigGainsTimerController.create(...)` and `workoutTimerController` APIs, live replaceable state/session ports, a frozen status snapshot without browser handles, idempotent initialization, v63 deadline rollback compatibility, and production load order. Existing timer tests use `reconcile()` and `getStatus()` rather than directly reading or mutating ticker, remaining-time, render, generation, or completion-key globals.

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

V46 coverage in `tests/cloud-sync.spec.js` verifies queue survival across reload, queue exclusion from schema-version-5 backup data, local-persist-before-enqueue ordering, harmless remote failure, stable keys across retries, offline/reconnect recovery, lost-acknowledgement idempotency with exactly one synthetic remote row, durable acknowledgements, the hard non-synthetic transport rejection, and existing-user magic-link options with signup disabled and the exact GitHub Pages redirect.

V70 coverage in `tests/ios-home-screen-auth.spec.js` verifies password-first standalone sign-in, persisted container-local sessions, a fresh matching `getUser()` identity gate, local-scope rejection before account reads, unchanged profile-shape blocking, generic password reset with cooldown under provider failure, browser-only existing-user Magic Link compatibility, the isolated invitation/recovery password-setup page, legacy root callback routing, and explicit Safari/Home Screen storage isolation. Existing Phase 4G/4H and v60/v61 recovery fixtures now answer the same verified-user gate before exercising their unchanged account/member/profile contracts.

V50 coverage in `tests/phase4g-independent-user.spec.js` verifies the independent one-profile shell, no managed selector/identifier leakage, pet-off initialization, cobalt/performance tokens, generic routines, cloud-UUID local/queue/catalog namespaces, local-first offline workout capture, reload persistence, one-profile shadow parity, a fresh invited-session onboarding flow, one RPC call, and isolated empty schema-v5 initialization. `supabase/tests/database/phase4g_independent_account_rls.test.sql` adds 43 rollback-only hosted assertions for bootstrap-only creation, retry reuse, presentation constraints, bidirectional account isolation, immutable ownership, known-UUID forgery denial, and anonymous denial.

V48 coverage in `tests/controlled-migration.spec.js` verifies strict metadata-only audit parsing, exact checksum and mapping gates, changed workout/bodyweight/preference blockers, empty-remote requirements, deterministic target payloads and collision-safe bodyweight IDs, exact planned writes, explicit confirmation, first-run verification, lost-response exact-once recovery, safe mid-run resume, conflict refusal, readback count/checksum failures, source-change failure, journal completion ordering, raw-free post-migration audits, and unchanged local storage/backups/snapshots/schema v5. `supabase/tests/database/phase4e_bodyweight_rls.test.sql` adds hosted adversarial ownership, anonymous denial, composite-FK, unit, and immutability coverage.

Notes coverage verifies the explicit notes hook API, active-session notes rendering and persistence, pure rest-duration resolution, timer start/resume/expiry messaging through TimerController, history opening, and saved session-note rendering.

Progress coverage verifies the explicit progress hook API and production script order, library and active-session decoration, history decoration, full progress-panel refresh, removal of global render replacement, and render-only storage behavior.

Shell coverage verifies deterministic production script order, idempotent single initialization, one listener effect per interaction, unique production assets, static selector markup, pet behavior, Alexa shell behavior, and sync snapshot compatibility.

Workout Mode coverage verifies start/resume entry, session-safe explicit exit, elapsed return-bar behavior, Library add/return through `workoutSessionController`, calm/rest/ready/PR pet states, and independent per-profile sound and vibration preferences. Timer-feedback cases cover hidden unsupported-vibration UI, supported vibration calls, removal of the standalone sound-test control, near-silent automatic arming inside trusted workout interactions, safe retries after rejected or non-starting arms, audible Sound-toggle confirmation, session-only explicit-toggle failure state, exactly one completion playback after successful arming, no completion playback after failed arming, one persistent audio element, listener cleanup, the accessible READY fallback, and duplicate feedback prevention.

Phase 3 Sprint 1 coverage in `tests/phase3-workout-hierarchy.spec.js` verifies the three-second READY hold and dismissal, background-return deduplication, reduced motion, hidden preset tray, absolute preset deadlines, active/upcoming/completed card states, honest prior performance, live set progress, manual focus/review, automatic fallback, pet-ready persistence, and session-data preservation. This implements the regression reference for issue #16 without changing the iOS audio fixture or schema version 5.

Phase 3 Sprint 2 coverage in `tests/phase3-completion-experience.spec.js` verifies save-before-display ordering, accurate saved-workout duration/exercise/working-set/volume/PR summaries, warmup exclusion, exactly-once completion and PR persistence, Done navigation, history-detail reuse, reload safety, sync catch-up while the receipt remains visible, pet completion states, reduced motion, heading focus, removal of the standalone sound-test control, trusted-interaction arming, safe retry, one completion chime, and unique audio/listener cleanup. The receipt remains session-only and schema version 5 is unchanged.

## Cache and update coverage

Offline coverage verifies a complete first install, deterministic manifest revisions, unique core assets, migration from the previous Big Gains cache, preservation of unrelated origin caches, awaited precache and runtime writes, visible cache-write failures, ordinary offline reload, active-session reload directly into Workout Mode, isolated `auth-setup.html` fallback, and offline loading of `exercise-catalog.js`, `routine-engine.js`, `workout-session-controller.js`, `timer-controller.js`, and the repository-owned WAV chime.

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

## Runtime reconciliation control coverage

`tests/runtime-reconciliation-control.spec.js` covers the one-shot authenticated port: exact revision-1 boolean parsing, default/malformed/stale fail-closed behavior, 401/403, network failure, timeout, signed-out handling, request no-store headers, repeated fresh checks, Edge Function default-OFF/JWT/no-store configuration, and local-first persistence during a control outage. `tests/cross-device-remote-fast-forward.spec.js` supplies the integration proof for static capability OFF, runtime OFF/ON, device pause, authenticated failures, manual recovery, and unchanged active-session, queue, ownership, concurrent-edit, history, tombstone, fingerprint, and revision guards. `tests/offline.spec.js` proves the control module is revisioned in the shell while cross-origin function requests bypass every service-worker cache path.

## Phase 4H managed-member coverage

`tests/phase4h-managed-profile-access.spec.js` uses synthetic Auth/account/profile UUIDs and intercepted browser-safe Supabase requests. It proves exact membership resolution, single-profile rose/wellness presentation, no selector, full schema-v5 reconstruction, tombstone exclusion, zero-queue catalog adoption, offline reload, normal later outbound mutation, no overwrite of a non-empty namespace, malformed membership blocking, and unchanged Jorge managed-owner behavior. Existing Phase 4G tests retain the independent SZW-style isolation contract; the Phase 4F queue-reconciliation suite retains the v50.1 obsolete-operation regression.

`supabase/tests/database/phase4h_managed_profile_access_rls.test.sql` is rollback-only. It creates synthetic owner, member, independent, and unassigned identities and checks that the first managed membership succeeds, a second profile for the same Auth user fails without disturbing the first, exact-profile visibility and writes across every application table, owner/member disjointness, membership immutability, profile-creation denial, independent-bootstrap denial for members, cross-account isolation in both directions, and anonymous denial. Run it only after the Phase 4H migration exists in the target database.
