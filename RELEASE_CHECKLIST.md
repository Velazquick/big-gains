# Release checklist

Use this checklist for every production change. Documentation-only changes that do not alter files in the app shell do not require an asset-manifest release update, but they still require the branch, review, and test checks.

## Branch and pull request

- [ ] Start from a freshly fetched `origin/main` with a clean working tree.
- [ ] Create a focused branch whose name describes the change.
- [ ] Keep unrelated changes out of the branch and review the complete diff before committing.
- [ ] Confirm whether the diff changes production HTML, CSS, JavaScript, icons, the web manifest, asset loading, storage, sync, or service-worker behavior.
- [ ] Run both required local suites and record the results in the pull request.
- [ ] Push the branch, open a pull request against `main`, and wait for the Browser tests workflow to pass.
- [ ] Confirm the pull request contains no unexpected generated Playwright reports, test results, downloads, or local data.

## Required tests

From a clean dependency install when dependencies or the environment changed:

```sh
npm ci
npx playwright install chromium
```

Run both suites:

```sh
npm test
npx playwright test --workers=1
```

- [ ] The normal suite passes all 58 current tests with no expected failures, retries, focused tests, or skipped regression coverage.
- [ ] The single-worker suite passes all 58 current tests.
- [ ] Any intentional test-count change is explained by added or removed coverage, not by a silent skip.
- [ ] GitHub Actions is green on the pushed commit. Inspect the uploaded Playwright report if local and CI behavior differ.

## Asset-manifest release update

For any production app-shell change:

- [ ] Update the `release` value in `asset-manifest.js` to a new, unique, descriptive release ID.
- [ ] Add, remove, or reorder CSS and scripts only in the manifest's `styles` and `scripts` arrays. Preserve the dependency order documented in [ARCHITECTURE.md](ARCHITECTURE.md).
- [ ] Confirm each production CSS and script appears exactly once and every required offline asset is present in `coreAssets`.
- [ ] Do not add revisioned production URLs directly to `index.html` or `service-worker.js`; both consumers share the manifest.
- [ ] Update `CURRENT_CACHE`, `PREVIOUS_CACHE`, and the expected manifest release in `tests/offline.spec.js`.
- [ ] Add a `legacyCacheNames` entry only when retiring a cache name outside the currently owned shell/runtime prefixes. Ordinary prior releases under those prefixes are already removed during activation.
- [ ] Do not bump the release for repository-only documentation or test changes that are not shipped in the app shell.

## Service-worker and offline safety

- [ ] Treat changes to `asset-manifest.js`, `asset-loader.js`, `service-worker.js`, `service-worker-core.js`, `index.html`, or any core asset as offline-lifecycle changes.
- [ ] Verify first install precaches the complete current shell and fails visibly if a required fetch or cache write fails.
- [ ] Verify activation removes the previous Big Gains caches and preserves unrelated origin caches.
- [ ] Verify a reload succeeds after the browser is taken offline.
- [ ] Confirm navigation fallback still resolves to cached `index.html` and same-origin assets still use the intended network-first/cache-fallback path.
- [ ] Consider the browser's normal waiting-worker behavior before release. If activation behavior changes, add explicit tests and user-facing update handling rather than assuming immediate takeover.
- [ ] Manually exercise install/update behavior when a change depends on native install prompts, OS-managed update timing, or a browser outside Chromium; those paths are not covered by CI.

## Storage and schema safety

- [ ] Keep schema version 5 unless the persisted shape requires a deliberate schema change.
- [ ] Route profile-state reads and writes through `state-persistence.js`; do not add direct profile-key access to `app.js`, `profiles.js`, renderers, or shell modules.
- [ ] Keep render and decoration hooks free of storage writes except for an intentional, tested initialization step.
- [ ] If the schema changes, define normalization defaults and an idempotent migration before changing the version. Preserve source data unless a destructive migration is explicitly designed and reviewed.
- [ ] Verify malformed but parseable state recovers safely and invalid records cannot break startup.
- [ ] Verify `pagehide` and hidden-page persistence still capture pending active-session changes.
- [ ] Verify Jorge and Alexa remain isolated across state, workouts, weights, routines, preferences, active sessions, and timers.
- [ ] On timer-feedback changes, verify unsupported browsers label vibration unavailable without overwriting the saved preference; verify Sound unlock, confirmation, Test Sound, one completion chime, and the visible ready fallback on a real device. Remember that iOS/WebKit may omit vibration and silent mode or OS routing may suppress sound.
- [ ] Preserve the current legacy policy: import only valid `big-gains-v1` weights when Jorge has no current state, do not reconstruct undocumented workouts, and leave the original payload byte-for-byte untouched.

## Backup and sync compatibility

- [ ] Export a current profile backup and restore it into the same profile without schema or data loss.
- [ ] Verify invalid JSON, invalid shapes, and cross-profile imports are rejected before either profile is modified.
- [ ] If state fields change, decide whether full-state JSON backups need normalization, migration, or compatibility tests.
- [ ] If completed workout, weight, PR, or profile fields change, verify `big-gains.snapshot.v1` consumers remain compatible or version the snapshot schema deliberately.
- [ ] Confirm sync still excludes the token and local/live-only data: active workouts, rest timers, custom routines, exercise preferences, and timer feedback preferences.
- [ ] Verify both profile snapshot paths and catch-up behavior when sync code changes. Remember that sync is outbound-only and overwrites the current profile snapshot; it does not merge or restore state.

## Merge and cleanup

- [ ] Reconfirm the merge commit or squash commit is the exact green commit reviewed in the pull request.
- [ ] Merge only after required Actions checks pass and unresolved review comments are addressed.
- [ ] Smoke-check the deployed app if the repository's hosting workflow is available, including one online load and one offline reload after service-worker control.
- [ ] Delete the merged remote branch and remove or repurpose the local branch.
- [ ] Fetch and prune, then confirm local `main` matches `origin/main`.
- [ ] Record any follow-up work for browser-specific PWA behavior, deployment, rollback, or manual checks that are not represented in this repository.
