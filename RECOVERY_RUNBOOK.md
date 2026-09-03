# Big Gains canonical recovery and rebuild runbook

For the canonical **https://app.getbiggains.com/** origin, follow [CUSTOM_DOMAIN_MIGRATION.md](CUSTOM_DOMAIN_MIGRATION.md). Keep legacy root/callback Auth redirects during RC. An old GitHub Pages PWA retains separate local storage; sign in and recover cloud-backed training/preferences and the published Program graph before replacing it. Unsynced local state needs the existing backup/queue safeguards. Sender `Big Gains <no-reply@auth.getbiggains.com>` remains unchanged.

This is the authoritative maintainer path for rebuilding, verifying, deploying, and recovering Big Gains. It does not authorize production data mutation. Use synthetic or disposable fixtures for destructive, sync, RLS, and recovery tests unless a separate operation explicitly approves a named production action.

## 1. Sources of truth and safety boundary

- GitHub repository: `Velazquick/big-gains`; protected `main` is the release source.
- Production Pages URL: `https://app.getbiggains.com/`.
- Local profile documents remain schema v5 and are the immediate workout authority.
- Supabase stores private account/profile-scoped rows behind RLS. The browser receives only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`.
- GitHub Actions repository variables provide browser-safe deployment configuration. Supabase Dashboard/CLI provides hosted project linking, function secrets, migrations, and advisors.
- Never put a service-role/secret key, database password, access token, or JWT signing material in Git, generated browser files, screenshots, or this runbook.
- Never clear an outbound queue to force parity. A queue is acknowledged only after the existing guarded write and exact readback rules succeed.

## 2. Clean rebuild

Prerequisites are Git, Node.js 22 or newer, npm, and Chromium for Playwright. The repository pins its npm packages and Supabase CLI in `package-lock.json`. Docker is additionally required for a local Supabase stack.

```sh
git clone https://github.com/Velazquick/big-gains.git
cd big-gains
git fetch origin --prune
git switch main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
npm ci
npx playwright install chromium
```

Stop if the worktree is not clean, `main` is not identical to `origin/main`, or the intended release commit is not the checked-out `HEAD`.

Run the protected corpus exactly as CI does:

```sh
npm test
git diff --check
```

The known Windows EKF generated-artifact freshness warning is not a reason to regenerate or commit artifacts during unrelated work. Investigate any other failure.

For a local interactive launch:

```sh
node tests/support/static-server.cjs
```

Open `http://127.0.0.1:4173/`. Stop the server with Ctrl+C. The checked-in `cloud-config.js` is safe/default-off; local training and offline-shell checks do not need production credentials.

## 3. Deployment configuration and static shell

The only browser-safe deployment inputs are:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `BIG_GAINS_AUTOMATIC_RECONCILIATION`
- `BIG_GAINS_SELF_SERVE_SIGNUP`
- `BIG_GAINS_PROGRAM_PORTABILITY`

Repository variables are the production source for these values. `scripts/write-cloud-config.mjs` writes `cloud-config.js`, derives a configuration hash, and rotates the asset-manifest, HTML, and service-worker references together. Run it only in a disposable worktree or deployment artifact when testing a non-default configuration because those generated files are expected to change.

Verify the shell and update boundary with:

```sh
npx playwright test tests/cloud-config-generation.spec.js tests/offline.spec.js tests/startup-interactivity.spec.js
```

`asset-manifest.js` owns the release marker, deployment version, precache list, and cache names. `service-worker.js` imports the exact versioned manifest. `service-worker-core.js` installs complete core assets before publishing a cache, serves navigation from the shell cache while offline, and deletes obsolete Big Gains caches on activation. A release is invalid if the marker or generated manifest references disagree.

## 4. Supabase inventory and verification

The checked-in migration ledger is the ordered contents of `supabase/migrations/`. The checked-in Edge Functions are:

- `program-domain-write`
- `reconciliation-control`

The database verification files are the six pgTAP files in `supabase/tests/database/`. Do not manually paste migrations into the SQL editor and do not invent migration filenames.

A fresh clone intentionally has no `supabase/.temp/project-ref`. An authorized operator links the intended project without committing the link or credentials:

```sh
DO_NOT_TRACK=1 npx supabase login
DO_NOT_TRACK=1 npx supabase link --project-ref YOUR_PROJECT_REF
DO_NOT_TRACK=1 npx supabase migration list --linked
DO_NOT_TRACK=1 npx supabase functions list
DO_NOT_TRACK=1 npx supabase db advisors --linked --type security
DO_NOT_TRACK=1 npx supabase db advisors --linked --type performance
```

Compare the hosted migration list and function list with the repository before any deploy. A missing, extra, or reordered migration is a stop condition. Advisor findings require review; do not suppress them to complete a release.

With Docker running, start the local stack and execute the database tests before a schema or RLS change:

```sh
npx supabase start
npx supabase test db --local
npx supabase db advisors --local --type security
npx supabase db advisors --local --type performance
```

Edge Function deployment is not part of an ordinary static release. If a reviewed change requires it, first compare the hosted inventory, preserve JWT verification, deploy only the named function, and rerun its focused transport/security tests. `SUPABASE_SETUP.md` contains the current runtime-control and Program gateway procedure.

## 5. User-data and fresh-device recovery

Never use production History for a drill. Use the browser fixtures or a disposable Auth identity.

1. Keep the source device intact until the target reaches verified parity.
2. On an empty target container, sign in with the expected account. Safari and an installed iOS Home Screen app are separate Auth/local-storage containers.
3. Verify the account and profile identity returned by `getUser()` and the account/profile shape gate.
4. Allow fresh-device recovery only over an exact blank startup artifact. Any meaningful local state, active workout, rest deadline, pending queue, owner mismatch, malformed record, or same-entity conflict must block automatic replacement.
5. Confirm completed workouts, routines, preferences, bodyweight, Goals, active session, and tombstones reconstruct into schema v5 with exact readback parity.
6. Do not delete the source device or clear either queue until the target reports parity.

The deterministic proof is:

```sh
npx playwright test tests/fresh-device-recovery.spec.js tests/cross-device-remote-fast-forward.spec.js tests/cloud-queue-reconciliation.spec.js
```

For a user-held schema-v5 technical backup, switch to the matching profile before restore, use Settings → Support → Advanced diagnostics → Restore technical backup, and verify the preview/profile identity before confirming overwrite. Keep the original backup until the restored profile has been opened, reloaded, and exported again.

## 6. Program recovery

Program portability is a complete graph operation, not a collection of independent row guesses.

1. Verify `BIG_GAINS_PROGRAM_PORTABILITY` is enabled in the deployed configuration and the authenticated `program-domain-write` gateway is present.
2. Read the remote Program envelope for the verified account/profile only.
3. Validate every immutable Routine/Program member, predecessor, pin, active pointer, sequence position, component revision, and fingerprint before adoption.
4. Block adoption for a pending Program predecessor, active-workout incompatibility, unresolved rest state, stale accepted base, missing lineage, or local/remote divergence.
5. Persist the complete candidate atomically, perform local readback validation, then run an exact remote/local comparison. On persistence or readback failure, restore the exact prior profile bytes.
6. Preserve History and every `programOrigin`; recovery must never infer, rewrite, or orphan them.

Run:

```sh
npm run test:program-domain
npm run test:program-domain-edge
npm run test:program-domain-transport
npm run test:program-domain-recovery
npm run test:program-domain-cutover
npm run test:program-portability-runtime
```

## 7. PR, merge, Pages, smoke, and rollback

1. Work on one topic branch and open a pull request.
2. Confirm the PR head SHA is the exact commit reviewed locally.
3. Wait for the required `playwright` check on that SHA.
4. Merge only after the required check is green and conversations are resolved.
5. Confirm the resulting `main` SHA and wait for the push workflow. Pages runs only as the `deploy-pages` job that needs the green `playwright` job.
6. Confirm GitHub Pages reports `built` and that the deployed release marker equals the merged release.
7. Run read-only production smoke: HTTPS, HTML/manifest/service-worker availability, startup interactivity, primary navigation, Settings, and release/config identity. Do not create, edit, complete, delete, import, reconcile, or otherwise mutate real production user data.

If smoke fails, stop user mutation, preserve the failing commit and evidence, and revert through a new protected PR to the last known-green release. Do not force-push `main`, bypass the required check, hand-edit Pages, or clear user queues/caches as a substitute for a release fix.

## 8. RC Hardening Pass 1 drill record

On 2026-09-01, a fresh clone at `84b889d02b64ca4ef3cb866191e4f4b7920c5187` proved clean checkout, `npm ci` on Node 24, root JavaScript syntax, the Program domain/recovery/transport suites, repository migration and function inventory, GitHub branch protection, the gated Pages workflow, and the production Pages configuration. The host did not have the Docker engine running and the fresh clone intentionally had no Supabase project link, so local pgTAP/advisor execution and hosted-ledger comparison were not claimed. Physical Safari/Home Screen proof also remains a device-only gate; Chromium automation is not its substitute.
