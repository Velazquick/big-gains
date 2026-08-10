# Architecture

Big Gains is a static, local-first progressive web app. `index.html`, CSS, and classic browser scripts provide the complete application; there is no build step, application server, or client framework. Workout state stays in the browser unless the user exports a backup or enables the optional outbound GitHub snapshot.

## Production startup and script order

`index.html` contains the application markup and directly loads only two scripts:

1. `asset-manifest.js` defines the immutable `BIG_GAINS_ASSET_MANIFEST`.
2. `asset-loader.js` writes the manifest's revisioned styles and scripts into the document in declared order.

The production script order is:

1. `account-context.js`
2. `cloud-config.js`
3. `vendor/supabase.js`
4. `supabase-client.js`
5. `cloud-storage.js`
6. `state-persistence.js`
7. `profiles.js`
8. `analytics.js`
9. `workout-controls.js`
10. `notes.js`
11. `timer-controller.js`
12. `progress.js`
13. `retrospective-workout.js`
14. `cloud-shadow.js`
15. `managed-profile-recovery.js`
16. `app.js`
17. `workout-mode.js`
18. `v2-shell.js`
19. `alexa-shell.js`
20. `training-pet.js`
21. `design-v21.js`
22. `session-selector-v26.js`
23. `sync-gateway.js`
24. `account-onboarding.js`
25. `migration-preview.js`
26. `cloud-sync.js`
27. `migration-engine.js`
28. `controlled-migration.js`
29. `shell-init.js`

This order is a runtime contract. Persistence and hook APIs exist before `app.js` consumes them. `app.js` loads and renders the current profile before the shell modules initialize. The final script, `shell-init.js`, initializes the shell modules exactly once in this order: Workout Mode, view shell, profile shell, training pet, direction/momentum, session selector, and sync.

## APIs and ownership boundaries

| Owner | Explicit API | Responsibility |
| --- | --- | --- |
| `asset-manifest.js` | `BIG_GAINS_ASSET_MANIFEST` | Release identifier, cache names, ordered CSS and script URLs, and the complete offline core-asset list. |
| `account-context.js` | `bigGainsAccounts` | Existing on-device descriptor registry, selected profile, storage namespaces, and session-key ownership. |
| `cloud-config.js` | `__BIG_GAINS_CLOUD_CONFIG__` | Empty checked-in browser configuration. The Pages workflow may replace it in the deployment artifact using only repository variables for the project URL and publishable key. |
| `supabase-client.js` | `BigGainsSupabase` | Lazily creates the vendored browser client, owns persisted Auth sessions, requests an existing-user-only Jorge magic link, signs out, and reads the already-provisioned Jorge account/profile metadata. Phase 4D removed browser-side account/profile provisioning. |
| `cloud-storage.js` | `BigGainsCloud` | Explicit account/profile sync operations, memory and durable queue contracts, deterministic idempotency keys, local-first coordinator, acknowledgements, and conflict resolution. It contains no network transport. |
| `cloud-shadow.js` | `BigGainsCloudShadow` | Read-only local/cloud semantic reconstruction, migrated/production envelope parsing, tombstone winner selection, SHA-256 shadow checksums, and exact parity/drift reporting. |
| `cloud-sync.js` | `BigGainsCloudSync` | Phase 4F metadata catalog, asynchronous local capture, owned production transport, conditional revisions, durable retry/ACK, post-ACK comparison, and quiet Auth/shadow controls. |
| `migration-preview.js` | `BigGainsMigrationPreview` | Phase 4D read-only local inspection, owned cloud destination verification, canonical SHA-256 checksums, readiness validation, and metadata-only audit export. It has no mutation or sync API. |
| `migration-engine.js` | `BigGainsMigrationEngine` | Phase 4E strict audit parsing, deterministic target planning, insert/recover execution, metadata-only journal state, readback reconstruction, and post-migration audit generation. |
| `controlled-migration.js` | `BigGainsControlledMigration` | Authenticated file-selection gate, exact write plan, two-step confirmation, explicit first-run/resume actions, progress, and completion/audit UI. |
| `state-persistence.js` | `bigGainsStatePersistence` and the per-profile object returned by `create(...)` | Profile storage keys, load/normalize/save, legacy weight migration, backup serialization, and import validation. |
| `profiles.js` | `PROFILE_CONFIG`, `PROFILE`, `switchProfile(...)` | Profile metadata, active-profile selection, theme marker, and reload-based profile switching. Profile-key reads and writes still go through the persistence API. |
| `workout-controls.js` | `workoutControls` | Render-only active-workout controls plus exercise movement, collapse, and completion advancement. It does not persist state. |
| `notes.js` | `workoutNotes` | Exercise cue preferences, per-session notes, rest preferences, note decoration, and pure rest-duration resolution. It does not mutate timer state or start timers. |
| `timer-controller.js` | `BigGainsTimerController.create(...)` and the `workoutTimerController` instance | Rest-timer lifecycle, persisted-deadline reconciliation, stale-callback identity protection, timer DOM and controls, presets, sound/vibration, timer browser lifecycle listeners, and timer-related pet notifications. It reads replaceable state/session objects through live injected ports and persists only through the `app.js` gateway. |
| `progress.js` | `workoutProgress` | Progress calculations, dialogs, and explicit post-render decoration hooks. It reads state through the context supplied by `app.js` and does not replace app render functions. |
| `app.js` | `workoutSessionController` | Live `state` and `active` workout ownership, workout transitions, app rendering, event coordination, the recovery-aware persistence gateway, completed-history/PR calculation, backup UI, and service-worker registration. It decides when set completion starts rest but delegates the timer mutation to `workoutTimerController`. |
| `workout-mode.js` | `bigGainsWorkoutMode` | Focus-shell entry/exit, session-scoped explicit-exit memory, return-bar timing, Library departure/return, and moving the existing pet between Today and the active-workout header. It never mutates workout state. |
| Shell modules | `bigGainsViewShell`, `bigGainsProfileShell`, `trainingPet`, `bigGainsDirection`, `sessionSelector`, `BigGainsSync` | Focused UI behavior. Every `initialize()` is guarded and returns `false` after the first call. |
| `shell-init.js` | `BigGainsShell` | One deterministic initialization pass across all shell modules. |
| `service-worker-core.js` | `BigGainsServiceWorkerCore` | Testable cache and fetch runtime used by `service-worker.js`. |

The application uses classic scripts, so `app.js` helpers such as `state`, `active`, `todaysWorkout`, `routineFor`, `renderLibrary`, `startWorkout`, and `showActive` are shared globals consumed by the later shell scripts. They are an implemented coupling, not an additional persistence or data-ownership layer. `workoutTimerFeedback` remains a compatibility facade backed by `workoutTimerController.feedback`; new timer tests and callers use the frozen `workoutTimerController` API and its immutable `getStatus()` snapshot instead of implementation variables. New cross-module behavior should prefer the frozen APIs and explicit hooks above.

## Workout-session lifecycle

1. At startup, the current profile state is loaded and `active` is set from `state.activeWorkout`.
2. `workoutSessionController.start(...)` creates an active workout and optionally appends the selected routine. `resume(...)` re-renders an existing session. `replace(...)` clears the current runtime session before starting the selected routine. `loadRoutine(...)` appends missing routine exercises, and `repairEmpty(...)` repairs a valid active session whose exercise list is empty.
3. `addExercise(...)` can create an empty session on demand, rejects unknown exercise IDs, and prevents duplicates. New exercises use the last completed performance to seed one warm-up and three working sets.
4. Set edits, exercise order, collapse state, notes, and rest preferences update the live session through `app.js`. Timer actions mutate the current state through live controller ports and call the same `app.js` persistence gateway. Rendering alone does not write storage.
5. A set can be completed only when both weight and reps are non-zero. Completion starts the movement's rest timer. When all working sets for an exercise are complete, `workoutControls.advanceAfterCompletion(...)` collapses it and opens the next incomplete exercise.
6. `complete()` keeps only exercises with completed sets, calculates duration and new estimated-one-rep-max records, prepends the completed workout, clears the active session and timer, and saves before rendering anything that claims completion. It then creates an in-memory receipt from that saved workout and shows the focused completion screen. Done discards only the receipt and returns to Today; Review workout calls the existing history detail. Reloading cannot reconstruct the receipt or repeat the save. A workout with no completed sets cannot finish.
7. Cancel requires a second click within 2.5 seconds. `discard()` clears the active workout and rest timer without creating history.

An active workout and its absolute `restTimerEndsAt` timestamp survive reloads. `state.restTimerEndsAt` is the only persisted running-state source of truth; lifecycle, remaining seconds, callback generations, ticker handles, READY state, and feedback state exist only inside `workoutTimerController`. Timer identity is the active workout ID plus the exact deadline, so callbacks from a replaced workout or deadline cannot mutate the current timer. Visibility, pageshow, and focus all reconcile from the live state and active-workout ports. Live or background-return expiry clears the timestamp once, preserves the pet's ready state until the next meaningful set interaction, and shows the accessible READY stack for three seconds before returning to visible idle. A hidden-by-default preset tray changes the next or currently running duration without changing per-exercise defaults or deadline persistence. Sound and vibration remain independent best-effort enhancements.

Timer audio uses one persistent `HTMLAudioElement` and the repository-owned `assets/timer-ready.wav` chime. There is no separate sound-test control. The first trusted start, resume, set-completion, or rest-preset interaction calls `audio.play()` synchronously inside that gesture, temporarily lowers the element to one-percent volume, and stops/resets it as soon as `playing` fires before restoring the prior volume. A rejected or non-starting automatic arm leaves the saved Sound preference intact, remains available for retry on a later trusted workout interaction, and never blocks timer or workout persistence. Turning Sound on still performs an audible direct-gesture verification and briefly confirms success; rejection or timeout from that explicit toggle can mark sound unavailable for only the browser session. Timer completion resets and requests exactly one playback on the same verified element, deduplicates repeated requests for the same rest deadline, and never blocks the visual cue. Unsupported devices hide the vibration control while preserving the saved preference for browsers that expose `navigator.vibrate`.

iOS/WebKit commonly does not expose the Vibration API, including in installed PWAs. The near-silent arm intentionally avoids `muted` so WebKit sees an audible media start; iOS may ignore programmatic element volume, so a very short trace of the chime can still be perceptible before the immediate stop. Sound remains a best-effort enhancement: installed iOS PWAs may still suppress even direct-gesture local audio because of device silent mode, media volume, focus modes, lifecycle state, or OS/browser audio routing. The accessible READY status and visual flash are the guaranteed primary completion cue.

Starting or resuming enters Workout Mode automatically. The shell hides primary navigation and promotes the active session without changing `startedAt`. Exit stores only a profile-and-workout-ID marker in `sessionStorage`, leaves the session and absolute rest deadline untouched, and shows the persistent return bar. A reload re-enters Workout Mode unless that exact active workout was explicitly exited in the current tab session. Library browsing suspends the focus shell without creating an exit marker; exercise additions continue through `workoutSessionController`.

## State and persistence flow

The current schema version is 5. A blank profile state contains:

- `version`, `profileId`, and profile-derived `goals`
- completed `workouts` and `weights`
- `prs`
- `activeWorkout` and `restTimerEndsAt`
- `customRoutines`
- `timerPreferences`, with independent `sound` and `vibration` booleans defaulting to `true`

`notes.js` also initializes and owns the persisted `exercisePreferences` map. Normalization preserves supported extra state properties while validating workouts, active workouts, exercises, sets, weights, PRs, goals, routines, and timer values.

All current-profile reads and writes are owned by `state-persistence.js`. `app.js` owns the `saveState()` gateway: it synchronously saves the current state/session, then schedules cloud capture in a microtask. `workoutTimerController` receives that gateway as its `persist` port, so start, Skip, preset replacement, expiry, and preference changes retain the same local-first order. Pending changes are also saved on `pagehide` and when the document becomes hidden. Render functions and render hooks are storage-free. Separately, notes initialization ensures that `exercisePreferences` exists and performs one startup save.

The storage keys are:

- `big-gains-active-profile` for the selected profile ID
- `big-gains-v2` for Jorge's schema-version-5 state
- `big-gains-alexa-v1` for Alexa's schema-version-5 state
- `big-gains-v1` for the retained undocumented legacy Jorge payload

When Jorge has no current state, the persistence layer imports only valid legacy weights into a new version-5 state. It does not reconstruct undocumented legacy workouts, does not modify the legacy key/value, and persists the new Jorge state so the migration is idempotent.

## Phase 4D migration preview

The migration preview is visible only when browser-safe Supabase configuration is present and Jorge has an authenticated session. It reads both local profile documents through `bigGainsStatePersistence.readProfileSnapshot(...)`; that API parses an exact copy without normalization, legacy migration, or storage writes. Remote verification uses authenticated `SELECT` queries only. It requires one account owned by the signed-in user, exactly the Jorge and Alexa profiles on that account, and account-scoped zero counts in `workouts`, `routines`, `bodyweight_entries`, `preferences`, `active_sessions`, `sync_metadata`, and `tombstones`.

Source-of-truth migration entities are completed workouts, custom routines, bodyweight entries, goal preferences, timer preferences, per-exercise preferences, and an optional active session (including its rest deadline). Workout/session notes remain embedded in their parent entity. Persisted PR entries are validated but are not migration entities because PRs, progress, volume, calendar groupings, and summaries are derived from source records.

The checksum contract is `big-gains.migration-preview.v1` with source schema version 5. Canonical serialization recursively sorts object keys, preserves array order, converts CRLF and CR text line endings to LF, and preserves meaningful `null`, `false`, `0`, and empty-string values. Non-finite numbers and non-JSON values are rejected. SHA-256 digests deterministic UTF-8 bytes through the browser Web Crypto API. Every entity checksum includes the contract, source schema version, local profile client id, entity type, and records. Profile checksums derive from their ordered entity counts and checksums; the combined account checksum derives from Jorge then Alexa. The generated preview timestamp and all cloud UUIDs are excluded from checksum inputs.

The audit export contains only version/release metadata, account/profile mapping identifiers, counts, checksums, scoped remote counts, and readiness/blocking status. It never contains workout, set, note, cue, or bodyweight payload values. Phase 4D exposes no migration action and never queues or sends local records.

## Phase 4E controlled migration

Phase 4E keeps the Phase 4D source checksum contract stable and defines a separate `big-gains.migration.v1` target. The UI requires the user-selected approved v47.1 audit, exact current source/account/profile matches, and a fresh empty-destination check immediately before its first journal write. It then requires a second inline confirmation with exact application and journal row counts. See [PHASE4E_MIGRATION_CONTRACT.md](PHASE4E_MIGRATION_CONTRACT.md) for payloads, stable client IDs, the bodyweight `lb` contract, journal/resume rules, readback checksums, and the metadata-only post-migration audit.

The migration engine is independent from `BigGainsCloudSync`. Ordinary workout completion remains local-only and the existing cloud transport still rejects non-synthetic operations. Phase 4E transforms exact local snapshots in memory and never calls persistence save, import, or normalization APIs.

## Shell initialization and UI hooks

`app.js` initializes notes, progress, and the retrospective editor, calls `renderAll()`, and then `shell-init.js` performs the one-time shell pass.

- `bigGainsWorkoutMode` owns focused-session presentation, safe explicit exit, Library departure, and the workout-in-progress return path.
- `bigGainsViewShell` owns the Today/Train/Progress/Library view and session-scoped last-view memory. Finish leaves the new completion screen in control; Done explicitly returns to Today.
- `bigGainsProfileShell` adjusts Alexa-specific labels, routine tabs, and the consistency garden.
- `trainingPet` derives its display from the active session, rest state, today's completed workout, PRs, leg-day content, and rest days. Workout Mode uses calm, attentive, and ready states with concise cues; the session completion receipt explicitly selects the existing completed-workout or PR state and moves the existing pet card into the completion layout.
- `bigGainsDirection` decorates the hero and weekly momentum from the app's state and render outputs.
- `sessionSelector` maps the compact Push/Pull/Legs/Core/Full Body/Conditioning choices to the current profile's concrete workout types and can resume or repair an active session.
- `BigGainsSync` adds the optional private snapshot controls and catch-up listeners.

The notes and progress features attach through explicit app-owned hooks:

- `workoutNotes.renderActiveNotes(...)` follows active-control rendering.
- `workoutNotes.renderHistoryNotes(...)` follows history-dialog rendering.
- Note input handlers call `saveCue(...)`, `saveSessionNote(...)`, and `saveRest(...)`. `workoutNotes.resolveRestDuration(...)` answers duration precedence without mutation; set completion calls `workoutTimerController.start(...)` through the app-owned decision point.
- `workoutProgress.afterLibraryRender(...)`, `afterActiveRender(...)`, `afterHistoryOpen(...)`, and `afterFullRender(...)` decorate only the views that `app.js` has just rendered.

`workout-controls.js`, `notes.js`, `timer-controller.js`, and `progress.js` do not monkey-patch or replace app globals.

## Asset and service-worker lifecycle

`asset-manifest.js` is the single asset inventory. Release `v64-timer-controller-extraction` adds `timer-controller.js` ahead of `app.js` while retaining `assets/timer-ready.wav` in the deterministic precache. The manifest applies the release query parameter to every production CSS and application script, rejects duplicate core assets, and supplies the same immutable manifest to the page loader and service worker. `index.html`, the loader, manifest, service-worker core, web manifest, icon, local chime, and all revisioned CSS and scripts form the precached app shell.

Workout-card focus is live-session metadata, not schema migration. `focusedExerciseId` prefers the last interacted exercise while it has incomplete working sets, then falls back to the first incomplete exercise. A manual collapse is authoritative and does not clear focus or session data; automatic advancement opens the next incomplete exercise. Upcoming cards remain collapsed and subdued, while completed cards recede but can be expanded for review. Added sets are ordinary incomplete working sets with fresh IDs and values copied only from the latest valid working set.

Calendar month/date selection lives only in `sessionStorage`, namespaced by profile. Completed workouts remain the sole data source. Local `Date` components—not UTC string slicing—form grouping keys, so the calendar follows the browser's local timezone. Calendar workout buttons call the existing history-detail renderer and add no new saved or synchronized fields.

`retrospective-workout.js` owns one in-memory draft and never reads or writes `activeWorkout`, rest timers, Workout Mode, pet state, or timer feedback. The selected local date is parsed into local year/month/day components; optional time is applied with the local `Date` constructor and checked against the original local date key before save. Empty time defaults to local noon for past dates and the current local time for today. Save filters to performed sets, requires a valid completed working set, prepares PR changes on a copied map, then writes one normal completed workout and the PR map through the account-bound persistence API. A failed persistence write restores the previous arrays/maps and leaves the draft open. Successful save closes without the live completion receipt and renders the selected Calendar day.

Retrospective exercise and set records receive fresh IDs; `definitionId` retains the canonical exercise identity for PR lookup while name-based Progress compatibility remains intact. `entryMethod: "retrospective"` is optional, normalized only for that recognized value, preserved by version-5 backups and the existing snapshot payload, and rendered as restrained “Entered later” text by Calendar and the shared History detail. Older workouts remain unchanged.

`app.js` registers `service-worker.js` on window load with `updateViaCache: 'none'`. The worker imports the unrevisioned asset manifest and service-worker core.

- Install opens the release-specific shell cache and waits for every required asset fetch and cache write. A missing asset or failed write fails installation.
- Activate deletes caches owned by the Big Gains shell/runtime prefixes, plus named legacy caches, except for the current shell and runtime cache. Unrelated origin caches are preserved. The worker then claims clients.
- Navigations are network-first with cached `index.html` fallback.
- Same-origin GET assets are network-first. Revisioned scripts and styles refresh the shell cache; non-core runtime requests refresh the release-specific runtime cache. On network failure, the current shell and then runtime cache are checked.
- Cross-origin and non-GET requests are not intercepted.

There is no `skipWaiting()` call or custom update prompt. A newly installed worker therefore follows the browser's normal waiting/activation lifecycle.

## Profile isolation, backup, and import

Jorge and Alexa load from different storage keys. Switching profiles writes only the active-profile selector and reloads the page; the new app instance creates a persistence API bound to the selected profile. State normalization always assigns the bound `profileId` and its profile defaults.

Export downloads the current in-memory state as formatted JSON named `big-gains-backup-YYYY-MM-DD.json`. Import requires an object with `workouts` and `weights` arrays and an exact `profileId` match. A valid import is normalized, saved to that profile's existing version-5 key, and rendered. An invalid or cross-profile import changes neither profile. Backups can include an active workout, timer, preferences, routines, and other current state because export serializes the full state object.

## Optional sync behavior

Sync is outbound snapshot publishing, not two-way state synchronization.

- `sync-gateway.js` owns its separate `big-gains-sync-gateway-v1` local-storage key for the fine-grained GitHub token, last sync time, and latest published workout ID per profile.
- A token is tested against `Velazquick/firstcut-validator` and requires Contents read/write access. It remains on the device and is not included in a snapshot.
- Each profile publishes to `big-gains-data` at `big-gains/profiles/<profileId>/snapshot.json` through the GitHub Contents API.
- Snapshot schema `big-gains.snapshot.v1` includes summary data, up to 120 completed workouts (including optional retrospective metadata), up to 200 weights, and all PRs. Active workouts, retrospective drafts, rest timers, custom routines, exercise preferences, timer feedback preferences, and the token are excluded.
- Publishing occurs on connect or manual request and catches up after workout completion, reconnection, page show, or return to a visible tab when the latest workout ID differs. The completion receipt is shown only after the local save and does not delay or invoke a second publication path. One 409 conflict is retried with a refreshed file SHA.
- Forgetting the token clears the local credential but does not delete an existing remote snapshot. The app does not read snapshots back, merge remote changes, or sync live sets.

## Testing and CI

The Playwright harness serves the repository as static files, so tests exercise `index.html` and the production manifest order without a test-only application bundle. Phase 3 adds regressions for timer hold/dismissal, background return, presets, reduced motion, hierarchy, progress, prior performance, manual focus, and fallback focus with no skips or expected failures.

Local verification:

```sh
npm ci
npx playwright install chromium
npm test
npx playwright test --workers=1
```

The suite covers startup and explicit APIs, workout lifecycle and controls, notes, progress, routines, profile shells, storage normalization and isolation, backups and imports, legacy migration, cache installation and replacement, and offline reload. `.github/workflows/browser-tests.yml` runs on pushes, pull requests, and manual dispatch with Node.js 22, installs Chromium and Linux dependencies, runs `npm test` with one CI worker, and retains the HTML report artifact for seven days.

The automated target is Chromium. See [TESTING.md](TESTING.md) for the exact coverage boundaries.
# Phase 4A account foundation

`account-context.js` is the single local identity and ownership boundary. It selects a managed-owner Jorge/Alexa runtime, a one-profile managed-member runtime, a one-profile independent runtime, or a neutral fresh-device guest runtime before persistence binds. An account descriptor contains a stable `accountId`, persisted `profileId`, display name, storage namespace/key, presentation tokens, and `profileConfigRef`. `profiles.js` resolves presentation/training configuration from the active runtime, while `state-persistence.js` owns state normalization, migration, backup validation, and reads/writes for that profile.

The deployed compatibility contract is unchanged: Jorge uses `big-gains-v2`, Alexa uses `big-gains-alexa-v1`, active selection uses `big-gains-active-profile` with `jorge`/`alexa` values, and calendar session state retains `big-gains-calendar-date-jorge` / `big-gains-calendar-date-alexa`. Resolving an account is read-only. The registry can accept another descriptor without changing persistence internals or workout schema version 5.

Profile-specific behavior intentionally remains configuration-driven: weekly plans, goals, theme, wellness copy/presentation, exercise-library breadth, and the rest-day fallback workout. Alexa-only garden markup is still selected by `data-profile-only` because it is presentation, not ownership. Existing sync snapshot paths and profile payloads remain profile-compatible by design.

GitHub is source control and an optional snapshot-backup destination. It is not the future user database.

## Phase 4C cloud boundary

With empty checked-in configuration, no Supabase client is created and no cloud request occurs. With deployment configuration, signed-out local use remains available. Magic links are existing-user-only (`shouldCreateUser:false`), so the app never opens public registration.

The future ownership model is intentionally different from the compatibility-only local descriptors:

```text
Jorge auth user -> Jorge account -> Jorge profile
                               \-> Alexa profile

friend auth user -> friend account -> friend profile
```

The deployed Jorge account is discovered as exactly two profiles with client IDs `jorge` and `alexa`. An exact `profile_memberships` row resolves a separate Auth user to one existing managed profile without changing the owner, and a unique `user_id` constraint prevents that Auth identity from receiving a second managed profile. A signed-in user with neither an account nor membership sees the Phase 4G independent onboarding action; its security-invoker RPC atomically creates one owned account and one server-issued independent profile. Any owner/member overlap, mismatch, or other account/profile shape blocks.

The SQL migrations define `accounts`, `profiles`, `workouts`, `routines`, `bodyweight_entries`, `preferences`, `active_sessions`, `sync_metadata`, and `tombstones`. All profile data carries the pair `(account_id, profile_id)`, and composite foreign keys prove that the profile belongs to that account. Ownership columns are immutable after creation. Completed workouts and bodyweight entries have unique account/profile/client IDs and account-scoped idempotency keys. Active sessions are unique per account/profile. `sync_metadata.metadata` stores only migration journal metadata.

RLS is enabled and forced on every table. The browser-facing `authenticated` role receives application-table operations, but profile-scoped policies require either account ownership or an exact `(auth.uid(), account_id, profile_id)` membership. Members may read their containing account only for runtime resolution and cannot update it. Membership mutation remains administrative-only. Anonymous/public table grants are revoked. A profile UUID alone is insufficient because authorization always proves the account/profile relationship with a composite key.

Phase 4H adds one narrowly scoped cloud-to-local exception for an authenticated managed member. `managed-profile-recovery.js` requires a pristine deterministic namespace, exact fresh membership/account/profile readback, valid shadow winners, schema-v5 validation, and canonical re-serialization parity before writing state. It then adopts remote revisions into the separate catalog with an empty queue and writes a completion marker last. Existing local state, any initialized recovery metadata, ownership drift, malformed records, or unsupported schema stops recovery without overwrite or merge. See [PHASE4H_MANAGED_PROFILE_ACCESS_CONTRACT.md](PHASE4H_MANAGED_PROFILE_ACCESS_CONTRACT.md).

### Local-first mutation contract

The future adapter sequence is fixed before transport exists:

1. Build an owned, versioned operation with a stable entity ID.
2. Persist the user mutation locally and wait for that write to succeed.
3. Enqueue the sync operation with explicit account/profile ownership and a deterministic idempotency key.
4. Return control to the workout UI; remote availability is irrelevant to success.
5. When online, send pending operations quietly and retry failures with the same idempotency key.
6. After remote acceptance, remove the pending operation and retain its acknowledged remote version.

The durable queue serializes `{ version, pending, acknowledgements }` at the managed compatibility key `big-gains-cloud-sync-queue-v1` or an independent account/profile UUID-derived key. It validates each restored operation and its deterministic key, deduplicates pending and acknowledged keys, caps acknowledgement history, and writes only on enqueue/retry/acknowledgement—not during rendering. The synthetic proof API waits for its supplied local persistence function before enqueue. Network errors increment attempt metadata and leave both the proof record and queue entry intact.

Phase 4C is push-only. There is no remote pull or merge path, so remote state cannot overwrite local state. A retry after an uncertain response inserts once or treats the existing row as success only when account, profile, client ID, and idempotency key match. A different existing key is a conflict, never an overwrite.

### Conflict contract

| Case | Rule |
| --- | --- |
| Completed workout creation | Append-only by default. Stable workout `client_id` plus the operation idempotency key gives exact-once remote insertion. |
| Completed workout edit | Same entity ID only; higher `version` wins, then later `updatedAt`. Equal revisions keep local state. |
| Active session | At most one row per profile. Higher version wins, then later `updatedAt`. It never crosses profile ownership. |
| Delete | Create a tombstone instead of relying on absence. Newer version/time wins; a tombstone wins an exact tie so deleted data is not resurrected. |
| Stale remote data | Never overwrites a newer local version or timestamp. |
| Ownership | `accountId` and `profileId` cannot change after creation except through a future controlled migration with elevated, non-browser tooling. |
| Retry | Increment attempt metadata only; preserve the original idempotency key and entity identity. |

Transport must use conditional version updates in Phase 4C, not blind upserts. The database uniqueness constraints are the final duplicate barrier for completed workouts and idempotent retries.
# Phase 4F cloud shadow

`cloud-shadow.js` is a read-only semantic adapter over local schema-v5 snapshots and account-scoped Supabase rows. `cloud-sync.js` owns the separate metadata catalog, durable outbound operations, authenticated owner verification, production transport, ACK readback, retry, comparison, and quiet Library card. Neither module has a cloud-to-local write path.

The mutation boundary remains `saveState()` in `app.js`: profile storage writes synchronously, then shadow capture is scheduled in a microtask. Cloud source records use stable local logical IDs. Derived PR, progress, volume, and calendar values are excluded. See `PHASE4F_SHADOW_SYNC_CONTRACT.md` for the frozen checksum, operation, adoption, conflict, and tombstone rules.
