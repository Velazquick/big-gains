# Supabase setup for Phase 4C

Phase 4C uses the existing private Supabase project, but it must never receive real Jorge or Alexa workout data. The only hosted write proof in this phase is ephemeral synthetic data. Big Gains remains usable while signed out, offline, or when Supabase is unavailable.

## 1. Browser-safe values

Copy only these two values from Project Settings → API:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The browser must never receive a secret key, legacy service-role key, JWT signing secret, database password, or Supabase access token. Do not paste those values into chat, Git, local storage, screenshots, or `cloud-config.js`.

For deployment, add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as GitHub Actions repository variables. The Pages workflow generates `cloud-config.js` only in the deployment artifact. If either variable is absent, the checked-in empty config is deployed and the app remains local-only.

## 2. Jorge-only Auth

In Supabase Dashboard → Authentication:

1. Create one Auth user for Jorge. Do not create an Alexa user.
2. Disable new-user signup. The client also sends `shouldCreateUser: false`, so an unknown email cannot self-register.
3. Set Site URL to exactly `https://velazquick.github.io/big-gains/`.
4. Add `https://velazquick.github.io/big-gains/` to Redirect URLs. Keep `http://127.0.0.1:4173/` only when local Auth testing is needed.
5. Keep anonymous sign-in disabled. Do not enable friend signup.

After Jorge signs in, the browser idempotently creates or reuses one empty account plus two empty profile rows (`jorge` and `alexa`). That metadata contains no local workout, routine, preference, note, PR, timer, active-session, backup, or snapshot data.

## 3. Hosted schema status

Phase 4C applied both checked-in migrations to the Big Gains hosted project:

- `20260807000000_phase4b_cloud_foundation.sql`
- `20260807120000_phase4c_harden_rls_event_trigger.sql`

The hosted migration ledger records both changes. All eight application tables have forced RLS, all 32 ownership policies are present, and the post-migration Supabase security and performance advisors reported no findings. Do not reapply either file manually in SQL Editor.

For a future environment or an operator recheck, the repository pins the Supabase CLI. Link only the intended project. If CLI authentication or the database password is required, enter it directly in the CLI's secure prompt or a short-lived operator-controlled environment; never pass it as a visible command argument or commit it.

```sh
DO_NOT_TRACK=1 npx supabase login
DO_NOT_TRACK=1 npx supabase link --project-ref YOUR_PROJECT_REF
DO_NOT_TRACK=1 npx supabase db push --linked
DO_NOT_TRACK=1 npx supabase migration list --linked
```

`db push` compares the checked-in files with the hosted ledger and makes retry status visible.

## 4. Verify RLS with synthetic rows

The checked-in pgTAP file was run against hosted Postgres and all 18 assertions passed. Its transaction rolled back, and a follow-up query confirmed zero Auth users and zero rows in every application table. To repeat that verification against the linked project:

```sh
DO_NOT_TRACK=1 npx supabase test db --linked supabase/tests/database/phase4b_rls.test.sql
```

The test opens a transaction, creates fixed `.test` Auth identities plus synthetic accounts/profiles/workouts, assumes Jorge/friend/anonymous roles, proves cross-account read/write/update/delete and forged profile pairing fail in both account directions, and rolls the entire transaction back. Verify all 18 assertions pass and that the synthetic UUIDs are absent afterward.

## 5. Synthetic completed-workout proof

The hosted proof completed successfully with two ephemeral Auth identities. The synthetic Jorge identity owned one account with Jorge and Alexa profiles; the synthetic friend owned a different account and one profile. Cross-account reads returned no rows, a forged friend write failed, and a lost-acknowledgement retry recovered exactly one remote workout with the unchanged idempotency key. Cleanup deleted both temporary users and all cascading rows; the hosted project is empty again.

The production transport accepts only operations with `synthetic: true`. The proof sequence is:

1. Persist one explicit synthetic proof workout locally.
2. Enqueue it at `big-gains-cloud-sync-queue-v1` with account and profile ownership.
3. Verify the offline flush sends nothing.
4. Reconnect and simulate or observe an uncertain acknowledgement.
5. Retry with the unchanged idempotency key.
6. Verify one hosted `workouts` row exists and the queue contains a durable acknowledgement.
7. Delete the synthetic hosted row and proof account/profile if ephemeral identities were used.

Normal workout completion has no call to this API. Do not import a backup or select an existing Jorge/Alexa workout for the proof.

## 6. Jorge's remaining manual setup

1. In Authentication → URL Configuration, set the Site URL and allowed production redirect to exactly `https://velazquick.github.io/big-gains/`.
2. In Authentication settings, disable public email signup and anonymous sign-in.
3. Create exactly one Auth user for Jorge. Do not create Alexa or friend users.
4. Add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as GitHub Actions repository variables, not values embedded in source files.
5. After this branch is separately reviewed and deployed, verify signed-out local/offline logging first, then request Jorge's magic link and confirm that only the empty account plus Jorge/Alexa profile metadata is created.

Do not connect ordinary workout completion or upload a backup during these checks.

## Pre-data checklist

- All eight public tables have RLS enabled and forced.
- `anon` and `public` have no table grants.
- Every profile-owned row carries both `account_id` and `profile_id`.
- Composite foreign keys reject cross-account profile pairing.
- Account/profile ownership triggers reject reassignment.
- Workout client IDs and idempotency keys are unique at the documented scopes.
- The browser bundle contains only the URL and publishable key.
- Signed-out, blocked-Supabase, and offline workout logging still succeeds locally.
- The schema-version-5 backup and `big-gains.snapshot.v1` formats are unchanged.
- No real Jorge or Alexa row has been enqueued or uploaded.

## Division of responsibility

- GitHub: source control, review history, releases, and optional `big-gains.snapshot.v1` backup publishing.
- Supabase Auth/Postgres: private identity and account-owned cloud rows protected by RLS.
- The device: immediate workout source of truth plus a separate durable outbound queue.

Cloud failure must never block workout logging.
