# Browser testing

The Playwright harness serves the static PWA from `index.html` without rewriting it, so production scripts execute in their declared order.

The current baseline is 58 passing Chromium tests with no expected failures: the stabilized 49-test suite plus nine Stage 2 regressions. See [ARCHITECTURE.md](ARCHITECTURE.md) for the runtime boundaries these tests protect and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) for the required release verification.

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

Both commands must pass all 58 tests with no expected failures.

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

Notes coverage verifies the explicit notes hook API, active-session notes rendering and persistence, rest-timer start/resume/expiry messaging, history opening, and saved session-note rendering.

Progress coverage verifies the explicit progress hook API and production script order, library and active-session decoration, history decoration, full progress-panel refresh, removal of global render replacement, and render-only storage behavior.

Shell coverage verifies deterministic production script order, idempotent single initialization, one listener effect per interaction, unique production assets, static selector markup, pet behavior, Alexa shell behavior, and sync snapshot compatibility.

Workout Mode coverage verifies start/resume entry, session-safe explicit exit, elapsed return-bar behavior, Library add/return through `workoutSessionController`, calm/rest/ready/PR pet states, and independent per-profile sound and vibration preferences. Timer-feedback cases cover unsupported-vibration UI, supported vibration calls, Sound-toggle unlock and confirmation, Test Sound, suspended-context resume, one two-note completion chime, blocked-audio safety, the accessible ready fallback, and duplicate feedback prevention.

## Cache and update coverage

Offline coverage verifies a complete first install, deterministic manifest revisions, unique core assets, migration from the previous Big Gains cache, preservation of unrelated origin caches, awaited precache and runtime writes, visible cache-write failures, ordinary offline reload, and active-session reload directly into Workout Mode.

## Legacy migration policy

The undocumented `big-gains-v1` payload is treated as a retained source record, not as a complete import format. Valid legacy weight entries are normalized into Jorge's schema-version-5 state. Legacy workout records are not reconstructed because no supported workout schema exists for that payload; they remain available only in the original, untouched `big-gains-v1` key/value. Regression coverage verifies that invalid weights are rejected, the original payload is preserved byte-for-byte, and repeated loads do not duplicate migrated weights.

## Cross-profile import behavior

The suite verifies that importing an Alexa backup while Jorge is active is rejected with a profile-specific message and leaves both profiles' stored data unchanged.

## State and persistence API coverage

Storage coverage verifies load/normalize/save round trips, profile-key ownership and isolation, backup export/import compatibility, malformed-state recovery, pagehide and hidden-page saves, and render-only behavior. Runtime instrumentation also verifies that profile state reads and writes originate in `state-persistence.js`, with no direct `localStorage` access left in `app.js` or `profiles.js`.

## Not covered

The harness runs Chromium only. It does not validate Safari or Firefox service-worker lifecycle differences, native PWA install prompts, OS-managed update timing, physical vibration hardware, browser background-timer throttling, device silent mode, OS audio routing, or the full real-time 2:30 rest-timer expiry. iOS/WebKit may not expose `navigator.vibrate`, including in installed PWAs, and silent mode or OS routing can suppress Web Audio even after a successful unlock. The harness does cover capability-aware vibration UI, gesture-owned Web Audio preparation and scheduling, blocked-audio safety, Chromium service-worker installation and cache replacement, and offline Workout Mode reload.
