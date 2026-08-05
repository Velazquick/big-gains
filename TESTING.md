# Browser testing

The Playwright harness serves the static PWA from `index.html` without rewriting it, so production scripts execute in their declared order.

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

The expected baseline is green with the legacy migration test reported as the only expected failure.

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

## Cache and update coverage

Offline coverage verifies a complete first install, deterministic manifest revisions, unique core assets, migration from the previous Big Gains cache, preservation of unrelated origin caches, awaited precache and runtime writes, visible cache-write failures, and offline reload.

## Known expected failure

- Legacy migration preserves weights but discards legacy workouts. The test accepts only the exact known defect or a migration that preserves both; other outcomes remain unexpected.

The test uses Playwright's expected-failure annotation. If the defect is fixed as expected, it becomes an unexpected pass so the annotation must be removed.

## Cross-profile import behavior

The suite verifies that importing an Alexa backup while Jorge is active is rejected with a profile-specific message and leaves both profiles' stored data unchanged.

## State and persistence API coverage

Storage coverage verifies load/normalize/save round trips, profile-key ownership and isolation, backup export/import compatibility, malformed-state recovery, pagehide and hidden-page saves, and render-only behavior. Runtime instrumentation also verifies that profile state reads and writes originate in `state-persistence.js`, with no direct `localStorage` access left in `app.js` or `profiles.js`.

## Not covered

The harness runs Chromium only. It does not validate Safari or Firefox service-worker lifecycle differences, native PWA install prompts, OS-managed update timing, vibration, browser background-timer throttling, or the full real-time 2:30 rest-timer expiry. It does cover rest-timer activation and persistence, Chromium service-worker installation and cache replacement, and an offline reload.
