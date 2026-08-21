# Architecture

Big Gains is a static, local-first progressive web app. `index.html`, CSS, and classic browser scripts provide the complete application; there is no build step, application server, or client framework. Workout state stays in the browser unless the user exports a backup or enables the optional outbound GitHub snapshot.

## Production startup and script order

`index.html` contains the application markup and directly loads only two production asset scripts. A small pre-boot callback router sends only `invite` and `recovery` Auth fragments to `auth-setup.html` before application state loads:

1. `asset-manifest.js` defines the immutable `BIG_GAINS_ASSET_MANIFEST`.
2. `asset-loader.js` writes the manifest's revisioned styles and scripts into the document in declared order.

The production script order is:

1. `boot-render-gate.js`
2. `account-context.js`
3. `cloud-config.js`
4. `vendor/supabase.js`
5. `supabase-client.js`
6. `reconciliation-control.js`
7. `cloud-storage.js`
8. `program-model.js`
9. `state-persistence.js`
10. `profiles.js`
11. `exercise-catalog.js`
12. `routine-engine.js`
13. `analytics.js`
14. `goals-progression.js`
15. `goals.js`
16. `goals-train-guidance.js`
17. `workout-session-controller.js`
18. `workout-controls.js`
19. `notes.js`
20. `timer-controller.js`
21. `progress.js`
22. `retrospective-workout.js`
23. `cloud-shadow.js`
24. `managed-profile-recovery.js`
25. `app.js`
26. `program-setup.js`
27. `workout-mode.js`
28. `v2-shell.js`
29. `alexa-shell.js`
30. `training-pet.js`
31. `design-v21.js`
32. `session-selector-v26.js`
33. `sync-gateway.js`
34. `account-onboarding.js`
35. `migration-preview.js`
36. `cloud-sync.js`
37. `migration-engine.js`
38. `controlled-migration.js`
39. `shell-init.js`

This order is a runtime contract. Persistence and hook APIs exist before `app.js` consumes them. `app.js` loads and renders the current profile before the shell modules initialize. The final script, `shell-init.js`, initializes the shell modules exactly once in this order: Workout Mode, view shell, profile shell, training pet, direction/momentum, session selector, and sync.

## APIs and ownership boundaries

| Owner | Explicit API | Responsibility |
| --- | --- | --- |
| `asset-manifest.js` | `BIG_GAINS_ASSET_MANIFEST` | Release and generated cloud-config identifiers, cache names, ordered CSS and script URLs, and the complete offline core-asset list. |
| `account-context.js` | `bigGainsAccounts` | Existing on-device descriptor registry, selected profile, storage namespaces, and session-key ownership. |
| `cloud-config.js` | `__BIG_GAINS_CLOUD_CONFIG__` | Empty/default-off checked-in browser configuration. The Pages workflow may replace it in the deployment artifact using browser-safe Actions variables for the project URL, publishable key, and the non-secret automatic-reconciliation capability gate. Missing, false, or unexpected control values keep the capability off. |
| `supabase-client.js` | `BigGainsSupabase` | Lazily creates the vendored browser client, owns container-local persisted Auth sessions, password sign-in, generic password-reset requests, browser-only existing-user Magic Link compatibility, `getUser()` identity verification, local rejection sign-out, and the existing exact account/member/profile-shape reads. |
| `reconciliation-control.js` | `BigGainsReconciliationControl` | One-shot authenticated runtime-control port. Every `check()` invokes the dedicated Edge Function with the current user session, a four-second timeout, no-store request headers, strict revision-1 boolean validation, and fail-closed decisions. It never caches or persists an ON result. |
| `supabase/functions/reconciliation-control` | authenticated Edge Function | Reads only the exact `BIG_GAINS_AUTOMATIC_RECONCILIATION=true` environment value, returns `{ automaticReconciliation, revision: 1 }`, and marks success, preflight, and method-error responses no-store. JWT verification remains enabled and the function has no database or service-role dependency. |
| `auth-setup.html` / `auth-setup.js` | isolated page (no application global) | Consumes a one-time invite/recovery session, verifies it with `getUser()`, sets a password, then signs out only that browser session. It loads no workout, persistence, sync, recovery, or account modules and never reads training data. |
| `cloud-storage.js` | `BigGainsCloud` | Explicit account/profile sync operations, memory and durable queue contracts, deterministic idempotency keys, local-first coordinator, acknowledgements, and conflict resolution. It contains no network transport. |
| `program-model.js` | `BigGainsProgramModel` | Pure Program-1A contracts and transactions: validated local capture normalization, explicit immutable Routine approval/successors, exact Routine-version Program pinning, draft creation, single-active activation, and label-agnostic rolling sequence state. It accepts only Off/Review authority and has no DOM, Train, Goals, history, storage, or cloud access. |
| `cloud-shadow.js` | `BigGainsCloudShadow` | Read-only local/cloud semantic reconstruction, migrated/production envelope parsing, tombstone winner selection, SHA-256 shadow checksums, and exact parity/drift reporting. |
| `cloud-sync.js` | `BigGainsCloudSync` | Phase 4F metadata catalog, asynchronous local capture, owned production transport, conditional revisions, durable retry/ACK, post-ACK comparison, guarded remote-fast-forward orchestration, and quiet Auth/shadow controls. |
| `managed-profile-recovery.js` | `BigGainsManagedProfileRecovery` | Empty/recoverable-device restoration plus the guarded cross-device eligibility and atomic schema-v5 fast-forward boundary. It reuses canonical cloud reconstruction and never performs a general merge. |
| `migration-preview.js` | `BigGainsMigrationPreview` | Phase 4D read-only local inspection, owned cloud destination verification, canonical SHA-256 checksums, readiness validation, and metadata-only audit export. It has no mutation or sync API. |
| `migration-engine.js` | `BigGainsMigrationEngine` | Phase 4E strict audit parsing, deterministic target planning, insert/recover execution, metadata-only journal state, readback reconstruction, and post-migration audit generation. |
| `controlled-migration.js` | `BigGainsControlledMigration` | Authenticated file-selection gate, exact write plan, two-step confirmation, explicit first-run/resume actions, progress, and completion/audit UI. |
| `state-persistence.js` | `bigGainsStatePersistence` and the per-profile object returned by `create(...)` | Profile storage keys, load/normalize/save, legacy weight migration, backup serialization, and import validation. |
| `profiles.js` | `PROFILE_CONFIG`, `PROFILE`, `switchProfile(...)` | Profile metadata, active-profile selection, theme marker, and reload-based profile switching. Profile-key reads and writes still go through the persistence API. |
| `ekf/curated/*.json` and `scripts/generate-exercise-catalog.mjs` | Source/build-time only | EKF-1 source ownership for opaque canonical exercise/family IDs, permanent legacy IDs, compatibility metadata, and the honest project-curated baseline references. The deterministic generator validates uniqueness, aliases, required fields, relationships, references, and EKF-1's explicitly inactive semantic defaults before producing the runtime catalog and legacy index. |
| `exercise-catalog.js` | `BigGainsExerciseIdentity`, `BigGainsExerciseCatalog`, and the `bigGainsExerciseCatalog` compatibility alias | Generated static EKF-1 projection. `BigGainsExerciseIdentity` resolves exact opaque/legacy IDs and unambiguous names/aliases; the unchanged catalog API exposes the same legacy public IDs, ordering, aliases, day/muscle/equipment/family values, lookup/search behavior, and bodyweight classification as before. It has no DOM, state, persistence, profile, Supabase, or other network access. |
| `routine-engine.js` | `BigGainsRoutineEngine.create(...)` and the `workoutRoutineEngine` instance | Immutable shared/profile routine definitions plus pure routine interpretation: labels, ordering, variants, custom precedence, legacy ID arrays, structured working-set/target-rep prescriptions, and editor draft data. It resolves built-in names through `BigGainsExerciseCatalog`, reads replaceable state and variant selection through live ports, and has no DOM, persistence, cloud, or workout mutation access. |
| `workout-session-controller.js` | `BigGainsWorkoutSessionController.create(...)`, pure factory helpers, and the `workoutSessionController` instance | Active-session ownership: start/resume/replace, routine loading and repair, exercise construction/addition/removal/order/focus, set creation/edit/adjust/complete, completion advancement, workout completion, and discard. It owns the existing set validation and mutation rules, signals TimerController through an injected port only after a qualifying completion has been saved, reads replaceable state/session values through live ports, and has no DOM, storage, cloud, or profile access. |
| `workout-controls.js` | `workoutControls` | Render-only active-workout controls. Its retained movement/collapse/advancement functions are compatibility aliases to the pure `BigGainsWorkoutSessionController` helpers; it does not own or persist session mutation. |
| `notes.js` | `workoutNotes` | Exercise cue preferences, per-session notes, rest preferences, note decoration, and pure rest-duration resolution. It does not mutate timer state or start timers. |
| `timer-controller.js` | `BigGainsTimerController.create(...)` and the `workoutTimerController` instance | Rest-timer lifecycle, persisted-deadline reconciliation, stale-callback identity protection, timer DOM and controls, presets, sound/vibration, timer browser lifecycle listeners, and timer-related pet notifications. It reads replaceable state/session objects through live injected ports and persists only through the `app.js` gateway. |
| `progress.js` | `workoutProgress` | Progress calculations, dialogs, and explicit post-render decoration hooks. It reads state through the context supplied by `app.js` and does not replace app render functions. |
| `app.js` | `saveState()`, render functions, and thin workout helper adapters | Composition, rendering, and browser lifecycle: it owns the current `state`/`active` bindings, recovery-aware persistence gateway, cloud-capture scheduling, DOM lookup/event adaptation, page/view rendering, routine-editor mutation/UI, completion receipt presentation, profile/import/export lifecycle, and service-worker registration. It instantiates the domain owners and supplies timer, pet, render, analytics, persistence, scheduling, and scrolling ports without implementing workout/session rules. |
| `program-setup.js` | `BigGainsProgramSetup` | Jorge's contained Program-1A review wizard. It requires an explicit custom/default/rebuilt source choice and per-Routine approval before final Program confirmation, presents optional Goal references without mutating Goals, and persists only through `app.js`'s schema-v5 gateway. It does not select Train sessions. |
| `workout-mode.js` | `bigGainsWorkoutMode` | Focus-shell entry/exit, session-scoped explicit-exit memory, return-bar timing, Library departure/return, and moving the existing pet between Today and the active-workout header. It never mutates workout state. |
| Shell modules | `bigGainsViewShell`, `bigGainsProfileShell`, `trainingPet`, `bigGainsDirection`, `sessionSelector`, `BigGainsSync` | Focused UI behavior. Every `initialize()` is guarded and returns `false` after the first call. |
| `shell-init.js` | `BigGainsShell` | One deterministic initialization pass across all shell modules. |
| `service-worker-core.js` | `BigGainsServiceWorkerCore` | Testable cache and fetch runtime used by `service-worker.js`. |

### `app.js` composition boundary

The current `app.js` responsibilities classify as follows:

- **Composition:** load the profile state, hold the replaceable `state`/`active` bindings, instantiate RoutineEngine, TimerController, WorkoutSessionController, retrospective logging, notes, and progress, and connect their live ports.
- **Rendering:** greeting, Train/Library, active workout, history/calendar, bodyweight, completion receipt, and routine-editor presentation.
- **Browser lifecycle:** DOM event adaptation, animation-frame scheduling/scrolling, profile reload, file import/export, install prompt, page visibility/pagehide saves, and service-worker registration.
- **Persistence/cloud orchestration:** the recovery-aware synchronous `saveState()` gateway followed by microtask cloud capture.
- **Explicit UI/editor behavior:** routine-draft edits/save/reset, two-tap discard confirmation, calendar selection, dialog/view orchestration, and bodyweight form submission.
- **Workout domain logic:** none beyond thin compatibility adapters and injected setter/callback ports. Exercise identity/search, routine interpretation, timer lifecycle, and active-session/set mutation are delegated to their explicit owners.

The application uses classic scripts, so `app.js` helpers such as `state`, `active`, `todaysWorkout`, `renderLibrary`, `startWorkout`, and `showActive` are shared globals consumed by later shell scripts. They are an implemented coupling, not an additional persistence or data-ownership layer. `startWorkout(...)`, `showActive(...)`, `loadRoutine(...)`, `addExercise(...)`, `finishWorkout()`, and `discardWorkout()` are thin compatibility adapters over the frozen `workoutSessionController` instance. `routineFor(...)`, `routinePrescription(...)`, and the read-only `DEFAULT_ROUTINES` binding remain minimal compatibility shims backed by `workoutRoutineEngine`; production session preview and retrospective consumers use the explicit engine API. `workoutTimerFeedback` remains a compatibility facade backed by `workoutTimerController.feedback`; new timer tests and callers use the frozen `workoutTimerController` API and its immutable `getStatus()` snapshot instead of implementation variables. `bigGainsExerciseCatalog`, `bigGainsRoutineEngine`, and `bigGainsWorkoutSessionController` remain compatibility aliases for the same frozen factories as their `BigGains...` names. New cross-module behavior should prefer the frozen APIs and explicit hooks above.

Catalog identity is data compatibility, not display normalization. Normal active-workout exercises continue storing the permanent legacy catalog ID in `exercise.id`. Retrospective exercise rows retain their fresh instance ID in `exercise.id` and store the same legacy catalog identity separately in `definitionId`; analytics and history continue to resolve those records through `definitionId || id`. `BigGainsExerciseIdentity` maps those persisted values to an opaque EKF canonical ID when canonical identity is needed, but catalog lookup never rewrites an instance ID, completed workout, active workout, routine, PR key, exercise preference, backup, or synchronized payload.

The accepted [Exercise Knowledge Foundation contract](EXERCISE_KNOWLEDGE_FOUNDATION.md) defines canonical identity, measurement, taxonomy, provenance, and compatibility rules underneath this API. EKF-1 established 119 opaque exercise IDs, permanent legacy resolution, two opaque family IDs, and deterministic compatibility generation. EKF-2 overlays one explicit measurement contract for every existing exercise and exposes it additively through the generated catalog. Train and retrospective inputs resolve those contracts by canonical/legacy identity; they never store a per-set semantics switch. `set.weight` remains the exact entered value, with optional `distance`/`duration` facts preserved in the same schema-v5 set object. `analytics.js` derives external, indicated, modeled-system, load-distance, duration, and e1RM results without rewriting source rows. Machine-indicated work is excluded from free-weight tonnage/e1RM, muscle primary and secondary roles remain separate, and required unknown context returns unavailable. The static catalog, audit, and runtime remain offline; Supabase and schema version 5 are unchanged.

## Workout-session lifecycle

1. At startup, `app.js` loads the current profile state, sets `active` from `state.activeWorkout`, and creates `workoutSessionController` with live getter/setter ports. Setting an active workout updates both bindings to the same object; importing or otherwise replacing state is immediately visible through the getters.
2. `workoutSessionController.start(...)` creates an active workout and optionally appends the selected routine. `resume(...)` uses and presents the existing object without creating a session. `replace(...)` invalidates the prior timer/runtime before creating a fresh session. `loadRoutine(...)` appends only missing routine exercises, and `repairEmpty(...)` repairs only the current valid session when its exercise list is empty. Routine IDs and prescriptions come from the live `workoutRoutineEngine` read contract.
3. `addExercise(...)` can create a session on demand, rejects unknown exercise IDs, and prevents duplicates. The pure `BigGainsWorkoutSessionController.buildExercise(...)` helper combines the catalog definition and optional engine prescription with exercise-ID-specific previous performance, injected fresh set IDs, EKF-compatible warm-up/working-set generation, and target-rep metadata. Input fields come from the canonical tracking model; routine prescriptions still own only set count/rep targets. It neither mutates prior history nor persists/renders. RoutineEngine still never creates or mutates a workout.
4. DOM handlers in `app.js` translate set/exercise actions into `workoutSessionController` calls. The controller owns numeric/blank normalization, stepper adjustment, Add Set inheritance, exercise order/focus/collapse/removal, and completed toggles against the current live active object. Each accepted mutation calls the injected synchronous persistence gateway before any rendering callback. Notes and per-exercise rest preferences remain with `workoutNotes`; their DOM adaptation remains in `app.js`. Rendering alone does not write storage.
5. Set completion validation follows the selected exercise's EKF tracking model: load/reps, reps-only, assistance/reps, duration, distance/duration, load/duration, load/distance, or distance-only. No curated card offers a semantic override. Warm-up rows intentionally use the same canonical completion path as working rows. A qualifying incomplete-to-complete toggle is saved first and then signals `workoutTimerController.start(...)` exactly once through an injected port. Ordinary edits and complete-to-incomplete toggles do not start rest. After the existing animation-frame boundary, the controller collapses a fully completed exercise and focuses the next incomplete movement. TimerController alone owns `restTimerEndsAt`, intervals, feedback, sound, vibration, and timer rendering.
6. `complete()` keeps only exercises with completed sets and evaluates rounded Epley v1 only through the EKF eligibility/basis gate, then calculates duration, prepends the completed workout exactly once, clears the active session/timer, and calls the injected local persistence gateway before the completion-presentation callback. Formula ID/version and basis are additive derived PR metadata; machine indication, carries, sleds, timed/isometric, assistance, reps-only, and unsupported contexts cannot create an e1RM. `app.js` then creates its in-memory receipt from that saved workout and shows the focused completion screen. Done discards only the receipt and returns to Today; Review workout calls the existing history detail. Reloading cannot reconstruct the receipt or repeat the save. A workout with no completed sets cannot finish.
7. Cancel requires a second click within 2.5 seconds. `discard()` clears the active workout and rest timer without creating history.

An active workout and its absolute `restTimerEndsAt` timestamp survive reloads. `state.restTimerEndsAt` is the only persisted running-state source of truth; lifecycle, remaining seconds, callback generations, ticker handles, READY state, and feedback state exist only inside `workoutTimerController`. Timer identity is the active workout ID plus the exact deadline, so callbacks from a replaced workout or deadline cannot mutate the current timer. Visibility, pageshow, and focus all reconcile from the live state and active-workout ports. Live or background-return expiry clears the timestamp once, preserves the pet's ready state until the next meaningful set interaction, and shows the accessible READY stack for three seconds before hiding the idle timer. Skip also clears and hides the timer immediately; the next qualifying set starts a fresh visible countdown. A hidden-by-default preset tray changes a currently running duration without changing per-exercise defaults or deadline persistence. Sound and vibration remain independent best-effort enhancements, with toggle results announced through a visually hidden live status region so feedback copy cannot change the timer layout.

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
- optional `programCapture`, created only after Program review begins and validated as a `big-gains.program-capture.v1` local-only catalog
- `timerPreferences`, with independent `sound` and `vibration` booleans defaulting to `true`

`notes.js` also initializes and owns the persisted `exercisePreferences` map. Normalization preserves supported extra state properties while validating workouts, active workouts, exercises, sets, weights, PRs, goals, routines, and timer values.

`customRoutines` remains schema-version-5 data in its two existing forms: legacy arrays of canonical exercise-ID strings and structured entries shaped as `{ exerciseId, workingSets, targetReps }`. `workoutRoutineEngine` interprets both through one read contract but never normalizes, rewrites, saves, deletes, or resets stored values. `app.js` still owns explicit editor save/delete/reset mutations. A custom routine affects future loads only; active and completed workouts remain independent records.

### Goals v1 design boundary

The [Goals v1 specification](GOALS_V1_SPEC.md) defines an exercise-scoped strength-goal and progression-policy boundary. Goals-1A implements the destination model, lifecycle, standalone hub, Today entry, and profile-scoped persistence through the existing schema-v5 `goals` preference and singleton cloud-shadow identity. Guidance remains authorization-only in 1A and has no Train effect.

The proposed boundary separates `estimated_reached` (eligible fresh e1RM evidence at/above target) from `achieved` (an eligible completed single at/above target for the exact exercise). It uses recent observed comparable work before e1RM-derived calibration, preserves the routine's working-set count, defaults generic strength work to a versioned `4–6` rep heuristic, and limits deterministic double progression to today and the next comparable exposure. A future Programming/Strength Planning layer may own longer-horizon blocks, phases, intensity objectives, or deload strategy only through a separate versioned authority boundary.

The current five-destination shell remains unchanged. A contextual strength-goal summary card on Today opens the standalone Goals hub; no sixth persistent bottom-navigation destination is added. The view-shell boundary can promote Goals into primary navigation later without changing the goal model. Goals remains destination-first (`Where am I going?`) while Progress remains evidence-first (`How am I doing?`).

The documentation-only [Product IA / Navigation Map v1](PRODUCT_IA_V1.md) defines the target product model without changing this released shell: `Today / Plan / Train / Progress / Library`, with Goals and Program connected under Plan and completed-workout Calendar consolidated into Progress/History. Conceptual destination and persistent-tab placement remain separate during migration. Goal, Program, Routine version, Workout/History, and derived Progress ownership remain unchanged.

The future boundary keeps six responsibilities separate: goal destination, deterministic progression policy, saved routine structure, today's editable Train recommendation, completed workout facts, and derived Progress evidence. Routine membership/set/rep structure remains authoritative for automatic card construction; an enabled and eligible goal may only overlay a compatible recommendation. It may never silently mutate a routine, an active session, or completed history. EKF measurement/e1RM gates, local-first persistence, schema v5, the existing goals preference identity, profile/RLS isolation, and conservative unavailability remain authoritative.

### Program Foundation v1 and Program-1A boundary

The [Program Foundation v1 specification](PROGRAM_FOUNDATION_V1.md) inserts an explicit multi-session organization layer between Goals and Train. Program-1A implements only deliberate review, local capture, immutable Routine versioning, exact Program pinning, draft/activation state, and stable rolling position. Goal remains the portable exact-exercise destination; Program owns a split-agnostic ordered sequence of slots, optional preferred calendar anchors, block/review policy, Goal links, authority state, and pinned immutable Routine versions; Routine owns one reusable ordered exercise/set/rep/rest prescription; Train continues to materialize from the existing saved-routine path; History retains performed facts; and Progress/Insights derive interpretations.

Program and Routine edits are future-session-only. Editing a referenced Routine creates a new Routine version plus a draft Program version that explicitly selects affected slots. Once Train creates an active workout, later Program, Routine, Goal, or engine changes cannot rewrite it. Completed workouts remain valid without future provenance fields and must never be backfilled by guesswork.

Program labels such as Push, Posterior, or Workout A are human metadata, not engine semantics. A deterministic Program Analyzer derives exercise/set exposure, supported EKF taxonomy summaries, prescription distributions, Goal-lift placement, spacing, redundancy, and gaps from exact pinned content. The future Programming Engine consumes those versioned features plus Goals, constraints, completed evidence, and Strength Knowledge outputs to produce `no_change`, `unavailable`, or a topology-agnostic typed proposal.

Programming authority is explicit: `off` grants no apply authority; `review` is the v1 maximum; and `auto` is rejected and reserved for a later trust contract. Program-1A implements no Analyzer, proposal engine, automatic mutation, A/B generation, periodization, deload, substitution, or Train selection. Activation records an effective boundary at the next unmaterialized session and initializes stable rolling position, but execution wiring is intentionally deferred.

`state.programCapture` remains inside the current profile's schema-v5 document and JSON backup. It stores stable Routine/Program identities separately from immutable versions. Routine versions carry exact opaque EKF exercise identities, ordered prescriptions, source provenance, optional capture-only rest seconds, approval time, and predecessor linkage. Program versions carry generic ordered slot labels, exact Routine-version pins, rolling cadence, optional weekday anchors, block review policy, Goal ID references, Off/Review authority, predecessor/effective metadata, and a version note. Activation archives any other active Program for that profile and creates one explicit `sequenceState`; it does not mutate active or completed workouts.

There is no semantically correct Program destination in the existing Supabase schema. `programCapture` is therefore allowed by local migration validation but excluded from the frozen migration/cloud record set, checksums, recovery reconstruction, and outbound queue. A guarded remote training-data fast-forward or explicit same-entity resolution carries forward the already validated local-only capture while replacing cloud-backed records, preventing unrelated Program loss without claiming cloud parity. Cross-device Program sync and fresh-device Program recovery require a later explicit cloud-schema/RLS/migration decision. Existing custom routines, Goals, Train, and cloud rows are unchanged.

All current-profile reads and writes are owned by `state-persistence.js`. `app.js` owns the `saveState()` gateway: it synchronously saves the current state/session, then schedules cloud capture in a microtask. Both `workoutSessionController` and `workoutTimerController` receive that gateway as their `persist` port, so session transactions and timer start/Skip/preset/expiry/preference changes retain the same local-first order. Controller presentation callbacks run only after persistence returns. Pending changes are also saved on `pagehide` and when the document becomes hidden. Render functions and render hooks are storage-free. Separately, notes initialization ensures that `exercisePreferences` exists and performs one startup save.

The storage keys are:

- `big-gains-active-profile` for the selected profile ID
- `big-gains-v2` for Jorge's schema-version-5 state
- `big-gains-alexa-v1` for Alexa's schema-version-5 state
- `big-gains-v1` for the retained undocumented legacy Jorge payload

When Jorge has no current state, the persistence layer imports only valid legacy weights into a new version-5 state. It does not reconstruct undocumented legacy workouts, does not modify the legacy key/value, and persists the new Jorge state so the migration is idempotent.

## Phase 4D migration preview

The migration preview is visible only when browser-safe Supabase configuration is present and Jorge has an authenticated session. It reads both local profile documents through `bigGainsStatePersistence.readProfileSnapshot(...)`; that API parses an exact copy without normalization, legacy migration, or storage writes. Remote verification uses authenticated `SELECT` queries only. It requires one account owned by the signed-in user, exactly the Jorge and Alexa profiles on that account, and account-scoped zero counts in `workouts`, `routines`, `bodyweight_entries`, `preferences`, `active_sessions`, `sync_metadata`, and `tombstones`.

Source-of-truth migration entities are completed workouts, custom routines, bodyweight entries, goal preferences, timer preferences, per-exercise preferences, and an optional active session (including its rest deadline). Workout/session notes remain embedded in their parent entity. Persisted PR entries are validated but are not migration entities because PRs, progress, volume, calendar groupings, and summaries are derived from source records. Program-1A `programCapture` is also excluded because this interval adds no cloud Program entity.

The checksum contract is `big-gains.migration-preview.v1` with source schema version 5. Canonical serialization recursively sorts object keys, preserves array order, converts CRLF and CR text line endings to LF, and preserves meaningful `null`, `false`, `0`, and empty-string values. Non-finite numbers and non-JSON values are rejected. SHA-256 digests deterministic UTF-8 bytes through the browser Web Crypto API. Every entity checksum includes the contract, source schema version, local profile client id, entity type, and records. Profile checksums derive from their ordered entity counts and checksums; the combined account checksum derives from Jorge then Alexa. The generated preview timestamp and all cloud UUIDs are excluded from checksum inputs.

The audit export contains only version/release metadata, account/profile mapping identifiers, counts, checksums, scoped remote counts, and readiness/blocking status. It never contains workout, set, note, cue, or bodyweight payload values. Phase 4D exposes no migration action and never queues or sends local records.

## Phase 4E controlled migration

Phase 4E keeps the Phase 4D source checksum contract stable and defines a separate `big-gains.migration.v1` target. The UI requires the user-selected approved v47.1 audit, exact current source/account/profile matches, and a fresh empty-destination check immediately before its first journal write. It then requires a second inline confirmation with exact application and journal row counts. See [PHASE4E_MIGRATION_CONTRACT.md](PHASE4E_MIGRATION_CONTRACT.md) for payloads, stable client IDs, the bodyweight `lb` contract, journal/resume rules, readback checksums, and the metadata-only post-migration audit.

The migration engine is independent from `BigGainsCloudSync`. Ordinary workout completion remains local-only and the existing cloud transport still rejects non-synthetic operations. Phase 4E transforms exact local snapshots in memory and never calls persistence save, import, or normalization APIs.

## Shell initialization and UI hooks

`app.js` initializes notes, progress, and the retrospective editor, calls `renderAll()`, and then `shell-init.js` performs the one-time shell pass.

- `bigGainsWorkoutMode` owns focused-session presentation, safe explicit exit, Library departure, and the workout-in-progress return path.
- `bigGainsViewShell` owns the Today/Goals/Train/Calendar/Progress/Library view and session-scoped last-view memory. Goals is a contextual destination reached from Today rather than a sixth bottom-navigation item. Finish leaves the new completion screen in control; Done explicitly returns to Today.
- `bigGainsProfileShell` adjusts Alexa-specific labels, routine tabs, and the consistency garden.
- `trainingPet` derives its display from the active session, rest state, today's completed workout, PRs, leg-day content, and rest days. Workout Mode uses calm, attentive, and ready states with concise cues; the session completion receipt explicitly selects the existing completed-workout or PR state and moves the existing pet card into the completion layout.
- `bigGainsDirection` decorates the hero and weekly momentum from the app's state and render outputs.
- `sessionSelector` maps the compact Push/Pull/Legs/Core/Full Body/Conditioning choices to the current profile's concrete workout types and can resume or repair an active session.
- `BigGainsSync` adds the optional private snapshot controls and catch-up listeners.

The notes and progress features attach through explicit app-owned hooks:

- `workoutNotes.renderActiveNotes(...)` follows active-control rendering.
- `workoutNotes.renderHistoryNotes(...)` follows history-dialog rendering.
- Note input handlers call `saveCue(...)`, `saveSessionNote(...)`, and `saveRest(...)`. `workoutNotes.resolveRestDuration(...)` answers duration precedence without mutation; `workoutSessionController` signals `workoutTimerController.start(...)` through the timer port supplied by `app.js` after local set-completion persistence.
- `workoutProgress.afterLibraryRender(...)`, `afterActiveRender(...)`, and `afterFullRender(...)` decorate only the views that `app.js` has just rendered. The full-render hook derives the Progress dashboard, capped Recent Training list, and month-grouped History Explorer from canonical analytics. Completed-workout detail stays app-owned and intentionally exposes no per-exercise drill-down.
- `sessionSelector` and `bigGainsRetrospective` read routine order and prescriptions through `workoutRoutineEngine`; neither owns routine defaults or custom-routine persistence.

`exercise-catalog.js`, `goals.js`, `routine-engine.js`, `workout-controls.js`, `notes.js`, `timer-controller.js`, and `progress.js` do not monkey-patch or replace app globals.

## Goals-1A local-first model and entry

`goals.js` owns the Goals-1A model/controller and renders one standalone Goals hub plus the compact Today entry card. The bottom navigation remains exactly five destinations. Goal creation selects only exact opaque EKF identities whose contracts use `load_reps`, external resistance, and an e1RM comparison basis of `entered_load` or `combined_external_load`; incompatible machine-indicated, assistance, effective-system-load, duration, distance, reps-only, and unknown records are excluded.

Source goal records live in the existing profile-bound schema-v5 `state.goals.strengthGoals` namespace. Each record carries stable goal, account, profile, canonical exercise, compatibility exercise, metric, target value/unit/basis, optional date/label, lifecycle, guidance authorization, policy reference, and timestamps. `state-persistence.js` validates those fields against the bound account/profile and preserves the existing version-5 envelope and backup path. The existing singleton `preferences/goals` shadow remains the only cloud source identity, so Goals-1A introduces no local-storage key, table, migration, RLS policy, queue, or second sync path.

Current evidence is derived read-only from completed exact-exercise history through `analytics.js` and EKF. It is not copied into a parallel analytics store. Estimated target reach remains distinct from an achieved completed target single; completing a goal retains only the qualifying evidence reference needed by the lifecycle contract. Create/edit/pause/resume/complete/archive and the guidance toggle persist locally before returning control. Guidance defaults off, is forced off by pause/resume/complete/archive as applicable, and has no effect on routines, active workouts, Train inputs, or recommendation behavior in Goals-1A. Progression resolution remains parked for Goals-1B/1C.

## Asset and service-worker lifecycle

Release `v87-program-1a-canonical-routine-capture` adds `program-model.js`, `program-setup.js`, and `program-setup.css` to the revisioned offline shell while retaining the v86 startup authority gate and the same cloud-config content revision.

`asset-manifest.js` is the single asset inventory. Release `v86-boot-render-profile-isolation` keeps the full personalized shell hidden and inert until the startup authority gate accepts a verified account/profile mapping, the established offline recovery proof, or a safe local-only runtime. The neutral resolver initializes before profile-bound shell modules; a successful authorization performs the first complete render while concealed and reveals it only after that render. Auth and managed-profile transitions re-enter the same gate synchronously without clearing persisted schema-v5 training state. Minimal inline critical styling makes the neutral boot shell the only paintable source markup until revisioned CSS and initialization are ready. `scripts/write-cloud-config.mjs` hashes the exact generated `cloud-config.js` bytes with SHA-256, writes the first 16 hexadecimal characters as `cloudConfigVersion`, and updates the deployment artifact's manifest marker. The manifest applies that deterministic version only to `cloud-config.js`, applies the release version to other production assets, and includes both identifiers in shell/runtime cache names. It also exposes a combined `deploymentVersion`; the generator writes that revisioned manifest URL into both HTML entry points and `service-worker.js`, and the manifest precaches its own matching URL. Identical rollback content therefore returns to the same safe URL, while any generated config change rotates the browser config reference, manifest entry point, worker source, and offline caches without a manual release bump. The manifest rejects duplicate core assets and supplies the same immutable inventory to both page loaders and the service worker. `index.html`, `auth-setup.html`, both loaders, the manifest, service-worker core, web manifest, icon, local chime, and all revisioned CSS and scripts form the precached app shell.

Workout-card focus is live-session metadata, not schema migration. `focusedExerciseId` prefers the last interacted exercise while it has incomplete working sets, then falls back to the first incomplete exercise. A manual collapse is authoritative and does not clear focus or session data; automatic advancement opens the next incomplete exercise. Upcoming cards remain collapsed and subdued, while completed cards recede but can be expanded for review. Added sets are ordinary incomplete working sets with fresh IDs and values copied only from the latest valid working set.

Calendar month/date selection lives only in `sessionStorage`, namespaced by profile. Completed workouts remain the sole data source. Local `Date` components—not UTC string slicing—form grouping keys, so the calendar follows the browser's local timezone. Calendar workout buttons call the existing history-detail renderer and add no new saved or synchronized fields.

Progress remains the history landing page. Recent Training caps itself at three canonical summaries; View History opens a presentation-only archive that sorts completed workouts newest-first and groups them by the browser's local month/year. The only archive destination is the shared completed-workout detail, so the maximum depth is Progress → History → Workout Detail. The archive and detail never write filters, selection, presentation state, analytics, or replacement workout payloads.

`retrospective-workout.js` owns one in-memory draft and never reads or writes `activeWorkout`, rest timers, Workout Mode, pet state, or timer feedback. Create mode parses the selected local date into local year/month/day components; optional time is applied with the local `Date` constructor and checked against the original local date key before save. Edit mode clones one exact completed workout into the same form, hides internal identity and ownership, and preserves its workout/exercise/set IDs, original timestamps, optional retrospective marker, notes, and array order unless a visible field or ordering control changes them. Every performed set uses `workout-session-controller.js` completion validation, so bodyweight records store only added load while external-load sets require a positive weight. A failed persistence write restores the previous arrays/maps and leaves the draft open.

An edit replaces the matching workout array entry by stable ID and recomputes the schema-v5 derived `prs` map from corrected history through `analytics.js`; unrelated completed workout objects are not mutated. Deletion is initiated only from the same History detail, requires explicit inline confirmation, removes only the selected workout, and recomputes the same derived map before local persistence. The ordinary post-save semantic capture sees the stable workout fingerprint change as an upsert revision or its absence as a tombstone revision. Cloud failure remains asynchronous and cannot roll back a successful local edit/delete.

Retrospective exercise and set records receive fresh IDs; `definitionId` retains the canonical exercise identity for PR lookup while name-based Progress compatibility remains intact. `entryMethod: "retrospective"` is optional, normalized only for that recognized value, preserved by version-5 backups and the existing snapshot payload, and rendered as restrained “Entered later” text by Calendar and the shared History detail. Older workouts remain unchanged.

`app.js` registers `service-worker.js` on window load with `updateViaCache: 'none'`. The worker imports the unrevisioned asset manifest and service-worker core.

- Install opens the release-specific shell cache and waits for every required asset fetch and cache write. A missing asset or failed write fails installation.
- Activate deletes caches owned by the Big Gains shell/runtime prefixes, plus named legacy caches, except for the current shell and runtime cache. Unrelated origin caches are preserved. The worker then claims clients.
- Navigations are network-first. The isolated setup path falls back to cached `auth-setup.html`; other navigations fall back to cached `index.html`.
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

With empty checked-in configuration, no Supabase client is created and no cloud request occurs. With deployment configuration, signed-out local use remains available. Password sign-in is primary in Safari and the installed Home Screen app. A session is not accepted as identity proof until a fresh `getUser()` response matches its user ID; account ownership, managed membership, and exact profile shape are then checked unchanged. A rejected identity or shape is signed out with local scope, so a separate Safari/Home Screen storage container is not affected. Magic Link remains an existing-user-only (`shouldCreateUser:false`) Safari/browser compatibility action and is not offered in standalone mode.

Supabase Auth persistence is intentionally per browser storage container. Safari cannot transfer its local session into an iOS Home Screen web app. `auth-setup.html` therefore turns the one-time invited/recovery browser session into a password and clears that setup session locally. The user then signs into the Home Screen app once; Supabase refresh-token persistence keeps that container signed in. Generic password-reset requests target the same setup page, are cooldown-protected, and do not disclose whether an email exists. No customized hosted email template or custom SMTP server is required.

The future ownership model is intentionally different from the compatibility-only local descriptors:

```text
Jorge auth user -> Jorge account -> Jorge profile
                               \-> Alexa profile

friend auth user -> friend account -> friend profile
```

The deployed Jorge account is discovered as exactly two profiles with client IDs `jorge` and `alexa`. An exact `profile_memberships` row resolves a separate Auth user to one existing managed profile without changing the owner, and a unique `user_id` constraint prevents that Auth identity from receiving a second managed profile. A signed-in user with neither an account nor membership sees the Phase 4G independent onboarding action; its security-invoker RPC atomically creates one owned account and one server-issued independent profile. Any owner/member overlap, mismatch, or other account/profile shape blocks.

The SQL migrations define `accounts`, `profiles`, `workouts`, `routines`, `bodyweight_entries`, `preferences`, `active_sessions`, `sync_metadata`, and `tombstones`. All profile data carries the pair `(account_id, profile_id)`, and composite foreign keys prove that the profile belongs to that account. Ownership columns are immutable after creation. Completed workouts and bodyweight entries have unique account/profile/client IDs and account-scoped idempotency keys. Active sessions are unique per account/profile. `sync_metadata.metadata` stores only migration journal metadata.

RLS is enabled and forced on every table. The browser-facing `authenticated` role receives application-table operations, but profile-scoped policies require either account ownership or an exact `(auth.uid(), account_id, profile_id)` membership. Members may read their containing account only for runtime resolution and cannot update it. Membership mutation remains administrative-only. Anonymous/public table grants are revoked. A profile UUID alone is insufficient because authorization always proves the account/profile relationship with a composite key.

Automatic adoption has three independent layers. The generated Pages flag is a static capability gate: it decides whether a build may attempt automation, but it is not an operational authority. When an already-eligible remote fast-forward is about to call the adopter, `cloud-sync.js` asks `reconciliation-control.js` for a fresh authenticated Edge Function decision. Only an exact revision-1 boolean `true` continues; signed-out state, timeout, network or HTTP failure, malformed data, missing or unexpected values, and unknown revisions all stop automatic adoption. The existing device-local pause is checked independently before the request and again at commit. The final commit still requires the unchanged lifecycle, queue, ownership, concurrent-edit, active-session, fingerprint, and monotonic-revision guards.

The runtime result is request-scoped and never stored in local storage, Cache Storage, or a reusable in-memory ON cache. The Edge Function response and request carry no-store directives, the call is cross-origin and POST, and the service worker ignores it. A runtime-control outage leaves cloud comparison, diagnostics, manual guarded adoption, outbound retry, and local-first workout logging available. `BigGainsCloudSync.status().automaticDecision` exposes only metadata categories (`capability-off`, `runtime-off`, `runtime-unavailable`, `device-paused`, or `guard-blocked`) plus a non-secret detail and contract revision.

Phase 4H adds one narrowly scoped empty/recoverable-device cloud-to-local exception. `managed-profile-recovery.js` requires exact fresh account/profile verification, valid shadow winners, schema-v5 validation, and canonical re-serialization parity before writing state. It then adopts remote revisions into the separate catalog with an empty queue and writes a completion marker last. Release v73 reuses that adapter for an explicit fast-forward on an initialized device only when its local payload still exactly matches its current catalog and every remote winner is an equal fingerprint-identical revision or a monotonic successor. Concurrent local edits, ownership drift, malformed records, and unsupported schema still stop without overwrite or merge. See [PHASE4H_MANAGED_PROFILE_ACCESS_CONTRACT.md](PHASE4H_MANAGED_PROFILE_ACCESS_CONTRACT.md).

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

`cloud-shadow.js` remains a read-only semantic adapter over local schema-v5 snapshots and account-scoped Supabase rows. `cloud-sync.js` owns the separate metadata catalog, durable outbound operations, authenticated owner verification, production transport, ACK readback, retry, comparison, and quiet Library card. Its only initialized-device cloud-to-local action delegates to `managed-profile-recovery.js` after the remote-fast-forward guard proves an empty queue, unchanged local/catalog payload, exact identity mapping, and monotonic remote revisions. It is not a general merge path.

The mutation boundary remains `saveState()` in `app.js`: profile storage writes synchronously, then shadow capture is scheduled in a microtask. Cloud source records use stable local logical IDs. Derived PR, progress, volume, and calendar values are excluded. See `PHASE4F_SHADOW_SYNC_CONTRACT.md` for the frozen checksum, operation, adoption, conflict, and tombstone rules.
