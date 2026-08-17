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

- [ ] The normal suite passes all 109 current tests with no expected failures, retries, focused tests, or skipped regression coverage.
- [ ] The single-worker suite passes all 109 current tests.
- [ ] Any intentional test-count change is explained by added or removed coverage, not by a silent skip.
- [ ] GitHub Actions is green on the pushed commit. Inspect the uploaded Playwright report if local and CI behavior differ.

## Asset-manifest release update

V42 release `v42-training-calendar-controls` adds accessible exercise-card controls, inherited working-set addition, and the local-time training calendar. The preceding `v41-phase3-completion-experience` release is the cache-migration source; schema version 5 and the iOS WAV chime are unchanged.

For any production app-shell change:

- [ ] Update the `release` value in `asset-manifest.js` to a new, unique, descriptive release ID.
- [ ] Add, remove, or reorder CSS and scripts only in the manifest's `styles` and `scripts` arrays. Preserve the dependency order documented in [ARCHITECTURE.md](ARCHITECTURE.md).
- [ ] Confirm each production CSS and script appears exactly once and every required offline asset is present in `coreAssets`; `cloud-config.js` alone uses the generated config-content version rather than the release version.
- [ ] The generated, revisioned `asset-manifest.js` URL is the only production URL written directly into `index.html`, `auth-setup.html`, or `service-worker.js`; all application assets remain shared through the manifest.
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
- [ ] On timer-feedback changes, verify unsupported browsers hide vibration without overwriting the saved preference; verify automatic arming occurs inside a trusted workout gesture, failed arms retain the preference and retry safely, turning Sound on audibly confirms or reports rejection/timeout, completion chimes once only after successful arming, and the visible READY fallback always works. Remember that installed iOS PWAs may ignore the temporary one-percent arm volume, omit vibration, or suppress the local audio asset because of silent mode, lifecycle state, or OS routing.
- [ ] On workout-completion changes, verify persistence precedes the receipt, warmups are excluded from working-set count and volume, the active session/timer/focus/pet rest state clear once, Done and reload do not duplicate workouts or PRs, Review reuses history detail, and sync catch-up still publishes once after save.
- [ ] On calendar changes, verify local-time grouping near midnight, multiple workouts on one date, profile isolation, session-only selection, existing history-detail reuse, active-workout return navigation, and offline shell availability.
- [ ] On retrospective logging changes, verify future dates remain unavailable; planned/rest defaults are account-driven; drafts never mutate live sessions or timers; save is transactional and exact-once; warmups stay out of working volume; PR evaluation honors its toggle; local completion timestamps remain on the selected day; cancel/reload never save; and optional metadata survives backup and snapshot output.
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
# v43 Phase 4 account foundation

- Confirm `account-context.js` loads before persistence and profiles exactly once.
- Confirm Jorge and Alexa retain their existing storage keys, selected-account value, backup shape, sync paths, and offline behavior.
- Confirm account resolution or rendering alone performs no ownership-storage writes.
- Run the synthetic third-account isolation and cross-account import tests.
- Confirm no authentication, backend SDK, credentials, network account calls, cloud sync, or friend-facing account UI was added.
- Run `npm test` and `npx playwright test --workers=1` with no skips or expected failures.

# v44 Calendar retrospective workouts

- Confirm `retrospective-workout.js` and its stylesheet appear once in the manifest and offline cache under `v44-calendar-retrospective-workouts`.
- Confirm an active live workout, return bar, rest deadline, pet state, timer preferences, and iOS WAV audio behavior are unchanged while a retrospective draft opens, cancels, reloads, or saves.
- Confirm Jorge, Alexa, and a synthetic third account retain isolated version-5 state, and invalid `entryMethod` values normalize away.
- Confirm Calendar, History detail, Progress, workout counts, working-set volume, backup/import, and `big-gains.snapshot.v1` consume the saved completed workout through their existing paths.
- Run `npm test` and `npx playwright test --workers=1` with all 91 tests passing and no skips or expected failures.

# v45 Phase 4B cloud foundation

- Confirm `cloud-storage.js` appears once, immediately after `account-context.js`, and is cached under `v45-phase4b-cloud-foundation`.
- Confirm the production cloud singleton is disabled with and without placeholder configuration, has no Supabase SDK or `fetch` transport, registers no online listener, and performs no browser-storage writes.
- Confirm schema version 5, Jorge/Alexa keys, profile switching, backups, imports, `big-gains.snapshot.v1`, optional GitHub snapshots, and every workout feature remain byte/behavior compatible.
- Confirm queued operations require explicit account/profile ownership, preserve idempotency keys across retries, persist locally before enqueue, and acknowledge remote versions only after a successful synthetic transport response.
- Confirm stale remote versions/timestamps cannot overwrite newer local state, append-only workout ties retain local state, tombstones win exact ties, and ownership changes throw.
- Review every cloud table for explicit ownership, composite account/profile foreign keys, RLS enable/force statements, authenticated-only ownership policies, revoked anonymous/public grants, immutable ownership triggers, completed-workout uniqueness, and one-active-session-per-profile uniqueness.
- Inspect the pgTAP adversarial cases for Jorge/Alexa same-account access, friend isolation, cross-account read/write/update/delete denial, forged profile-pair denial, immutable profile ownership, and anonymous denial.
- Confirm `.env.example` contains only the browser-safe Supabase values and the non-secret default-off automatic-reconciliation control, real environment files are ignored, and no privileged credential exists anywhere in browser code.
- Confirm no live Supabase project was created/linked, no database migration was applied, and no local data was uploaded.
- Run `npm test` and `npx playwright test --workers=1` with all 104 tests passing and no skips or expected failures.

# v46 Phase 4C auth and synthetic sync

- Confirm the pinned Supabase UMD client, `cloud-config.js`, `supabase-client.js`, `cloud-storage.js`, `cloud-sync.js`, and `cloud-sync.css` each appear once in the `v46-phase4c-auth-synthetic-sync` app shell and offline cache.
- Confirm the checked-in config is empty/default-off, Pages uses browser-safe Actions variables only (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the non-secret default-off automatic-reconciliation control), and no database password, access token, secret key, or service-role key is committed or exposed to the browser.
- Confirm signed-out and unconfigured use remains local, schema version 5 is unchanged, rendering does not write the queue, and existing backups/snapshots exclude the queue.
- Confirm Jorge magic links use `shouldCreateUser: false`, the exact production redirect, and a hosted project with public signup disabled. Do not create Alexa Auth or friend signup.
- Confirm ordinary Jorge/Alexa workout completion cannot reach the cloud transport; only explicit synthetic operations are accepted.
- Confirm the durable queue survives reload, records explicit account/profile ownership, retries with the same idempotency key, retains failed operations, acknowledges successful duplicates, and produces one remote row after a lost acknowledgement.
- Apply the reviewed migration through the pinned CLI, verify the hosted migration ledger, run the rolled-back pgTAP RLS suite, and retain only test output—not synthetic rows.
- Recheck cross-account/profile denial, anonymous denial, immutable ownership, composite foreign keys, and uniqueness constraints against hosted Postgres.
- Run `npm test` and `npx playwright test --workers=1` with all 109 tests passing and no skips or expected failures.
- Confirm no real Jorge or Alexa record was read for migration, enqueued, uploaded, changed, or deleted.

# v48 Phase 4E controlled migration

- Confirm `migration-preview.js`, `migration-engine.js`, `controlled-migration.js`, and both migration stylesheets appear once in the `v48-phase4e-controlled-migration` shell and offline cache.
- Confirm the v47.1 approved Phase 4D combined/profile/entity checksums and counts still match; the new bodyweight destination must not alter the source checksum contract.
- Review `big-gains.migration.v1` payloads, deterministic client IDs, duplicate bodyweight occurrence IDs, stable migration/idempotency keys, exact table counts, and metadata-only journal/audit shapes.
- Confirm no action appears until browser config, Jorge Auth, owner/profile mapping, READY preview, empty application tables, no unexpected marker, and the selected approved audit all match.
- Confirm the first write still requires the explicit migration button plus the second exact-count checkbox; page load, Auth, profile switching, workout completion, online events, and normal sync never execute migration.
- Review `bodyweight_entries` for explicit `lb` semantics, composite ownership FK, immutable ownership trigger, unique migration identities, enabled/forced RLS, owner-only authenticated policies, and revoked anonymous/public grants.
- Exercise first run, lost response, mid-run resume, mismatched row conflict, readback count/checksum failures, source change during upload, complete-only-after-verification journal behavior, and metadata-only post-migration audit.
- Verify local storage bytes, schema version 5, backup/import, `big-gains.snapshot.v1`, signed-out/offline logging, and the synthetic-only normal transport remain unchanged.
- Run both hosted pgTAP files with synthetic identities inside rollback transactions; confirm cleanup returns every application table to the pre-test count and rerun security/performance advisors.
- Run the complete Playwright suite in normal and single-worker/safe-sharded modes with no skips or expected failures.
- Before the real migration, make a fresh backup, load the approved audit, inspect exact counts, and stop on any blocker. Never use a service-role key or execute from an unreviewed deployment.

# v49 Phase 4F shadow-sync readiness

- Confirm `cloud-shadow.js` loads after `migration-preview.js` and before `cloud-sync.js`, appears once in the `v49-phase4f-shadow-sync-readiness` shell, and is precached for offline reload.
- Confirm local schema version 5, deployed storage keys, backup/import, `big-gains.snapshot.v1`, Phase 4E migration rows, journal, and audit formats are unchanged.
- Confirm every normal mutation saves locally before asynchronous capture and remains usable signed out, offline, during outage, and with a blocked queue.
- Review `big-gains.shadow.v1` source mappings and SHA-256 inputs; derived PR/progress/volume/calendar values must not become cloud source records.
- Confirm initial adoption requires the completed Phase 4E journal plus exact Jorge/Alexa parity and does not rewrite migrated application rows.
- Confirm all production operations freeze owned identity, stable retry key, desired fingerprint, monotonic version/timestamp, and exact base revision; wrong account/profile or mismatched payload blocks.
- Confirm insert/update/delete ACK only after affected-row readback and full parity is checked even when the queue is empty.
- Confirm tombstones include bodyweight, win exact ties, remain account/profile scoped, retain the old source row, and require an explicit strictly later recreation.
- Run the Phase 4F rolled-back hosted RLS proof, confirm synthetic cleanup, compare production counts before/after, and run security/performance advisors.
- Run all 150 Playwright tests in normal and single-worker safe-sharded modes with no skips or expected failures.
- After deployment, require baseline **In sync** for Jorge and Alexa before making one safe timer-preference mutation; wait for zero pending and **In sync** again after reload.
- Do not open friend signup, enable a cloud pull, restore local state, merge a second device, or make cloud authoritative.

# v50 Phase 4G independent user

- Confirm the branch is based on the v49/Phase 4F merge and the managed keys, switcher, presentation, schema v5, backups, snapshots, migration journal, queue key, and two-profile parity rules are unchanged.
- Confirm a truly fresh device renders a neutral guest shell and invited-user sign-in, not Jorge/Alexa data or identifiers.
- Review the security-invoker bootstrap, transaction-local RLS guard, one-account uniqueness, one-profile retry reuse, unexpected-shape blockers, display-name validation, and anonymous/public execution revokes.
- Confirm presentation columns are constrained, render-only, absent from every RLS/ownership decision, and preserve Jorge/Alexa appearance.
- Confirm independent state, calendar session, queue, catalog, and comparison keys derive from the verified cloud account/profile UUID pair and never collide with managed keys.
- Confirm the independent shell has one identity, generic routine labels, no Alexa sections, no pet initialization, cobalt accent, performance-dark theme, and all five app views.
- Exercise fresh invited-session onboarding, offline local completion, reconnect push, one-profile parity, sign-out/reload persistence, wrong-session queue denial, lost ACK recovery, and tombstone/recreation rules using synthetic identities only.
- Run the 43-assertion rollback-only hosted pgTAP suite, both advisors, and production count-only summaries before and after. Do not read Jorge/Alexa payloads.
- Run complete normal and single-worker Playwright suites with no skips or expected failures.
- Do not create the real friend Auth user until post-deploy manual onboarding. Do not open a PR, merge, or delete the feature branch as part of the implementation handoff.

# v53 Phase 4H managed-profile access

- Confirm the migration is reviewed but not applied as part of the implementation handoff; do not create Alexa's real Auth user or membership during development.
- Verify account ownership remains Jorge, the membership composite foreign key cannot cross accounts, owner/member overlap is rejected, and browser roles cannot mutate memberships.
- Run the rollback-only Phase 4H pgTAP proof and confirm owner/member/independent/anonymous behavior across all application tables plus managed-member bootstrap denial.
- Confirm the four browser runtime kinds remain explicit; Alexa member has one existing profile, no selector, verified rose/wellness presentation, and a noncolliding Auth/account/profile namespace.
- Exercise clean recovery, malformed ownership blocking, non-empty namespace blocking, exact schema-v5 parity, tombstones, zero pending adoption, a later outbound edit, offline reload, Jorge owner regression, SZW independent regression, and v50.1 queue reconciliation.
- Run all 176 Playwright tests in normal and single-worker modes with no skips or expected failures.
- After review and deployment, provision through Auth Dashboard plus exactly one trusted membership insert; send the invitation with `redirectTo` set to `https://velazquick.github.io/big-gains/auth-setup.html`, and verify count-only that no application rows changed before Alexa opens it. She sets a password in Safari, then signs into the Home Screen app once.

# v70 iOS Home Screen Auth persistence

- Confirm `auth-setup.html`, `auth-setup-loader.js`, `auth-setup.css`, and `auth-setup.js` are revisioned/precached and offline navigation never falls back to the training app document.
- Confirm password sign-in is primary in standalone and Safari, while existing-user-only Magic Link appears only as browser compatibility.
- Confirm password-reset responses remain generic, invitation/reset requests are cooldown-protected, and both target the isolated setup page.
- Confirm every application session passes matching `getUser()` verification before the unchanged owner/member/profile-shape checks; mismatch and unexpected shape use local-scope sign-out without touching schema-v5 state.
- Confirm future trusted invitations specify `redirectTo: https://velazquick.github.io/big-gains/auth-setup.html`; do not add Admin/service-role credentials to browser code.
- Confirm the default hosted invitation/recovery templates work without `{{ .Token }}`, custom SMTP, or a plan upgrade.
- Confirm Safari and Home Screen storage remain isolated, the Home Screen session persists after its own one-time password sign-in, and all managed-owner/member/independent recovery tests remain green.

# Automatic reconciliation deployment control

- Confirm `BIG_GAINS_AUTOMATIC_RECONCILIATION` is an Actions repository or `github-pages` environment **variable**, never a secret, and that the Pages workflow passes it only to `scripts/write-cloud-config.mjs`.
- Confirm missing, `false`, and unexpected values generate `automaticReconciliation: false`; only case-normalized `true` generates `true`; and checked-in `cloud-config.js` remains default-off.
- Confirm OFF → ON changes the generated `cloud-config.js` URL and shell/runtime cache names, and rollback to identical OFF content deterministically restores the original OFF URL. No manual release-string bump may be required for a variable-only deployment.
- For the plumbing release, leave the production variable missing or `false`. Do not combine the code merge with enablement.
- Deploy the merged release with the flag off and complete the ordinary online/offline and manual remote-change smoke checks before any separately authorized enablement.
- To enable later, set the variable to `true`, run Pages again, and complete the non-destructive automatic-reconciliation smoke check.
- To roll back, set the variable to `false` or delete it, run Pages again, wait for success, reload devices online, and verify manual handling is restored. Use the device-local emergency pause for immediate containment while deployment completes.
