# Supabase setup for Phase 4C–4G

Phase 4C uses the existing private Supabase project, but it must never receive real Jorge or Alexa workout data. The only hosted write proof in this phase is ephemeral synthetic data. Big Gains remains usable while signed out, offline, or when Supabase is unavailable.

Phase 4E adds the reviewed `bodyweight_entries` table and metadata-only migration journal support. Development and hosted verification still use synthetic identities and payloads only. The real Jorge/Alexa migration is a separate manual action after review and deployment.

Phase 4G adds the production path for an invited independent user but does not create the real friend's Auth user during implementation. The browser calls only the `SECURITY INVOKER` `bootstrap_independent_account(text)` RPC after an already-created Auth user signs in. Direct browser inserts into `accounts` and `profiles` are RLS-blocked outside that transaction.

## 1. Browser-safe values

Copy only these two values from Project Settings → API:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

The browser must never receive a secret key, legacy service-role key, JWT signing secret, database password, or Supabase access token. Do not paste those values into chat, Git, local storage, screenshots, or `cloud-config.js`.

For deployment, add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` as GitHub Actions repository variables. The Pages workflow generates `cloud-config.js` only in the deployment artifact. If either variable is absent, the checked-in empty config is deployed and the app remains local-only.

## 2. Auth and iOS Home Screen setup

In Supabase Dashboard → Authentication:

1. Create or invite only the intended Auth user. Do not create application account/profile/membership rows as part of Auth setup.
2. Disable new-user signup and keep anonymous sign-in disabled. Browser Magic Link compatibility also sends `shouldCreateUser: false`.
3. Set Site URL to exactly `https://velazquick.github.io/big-gains/`.
4. Add both `https://velazquick.github.io/big-gains/` and `https://velazquick.github.io/big-gains/auth-setup.html` to Redirect URLs. Keep `http://127.0.0.1:4173/` only for local Auth testing.
5. For every future trusted invitation call, set `redirectTo` to exactly `https://velazquick.github.io/big-gains/auth-setup.html`. This option belongs only in trusted operator/server tooling; never put an Admin or service-role key in Big Gains. A Dashboard invitation that lands on the configured root is compatibility-routed to the isolated setup page before the app starts.
6. The user opens the one-time invitation in Safari, sets a password on `auth-setup.html`, closes that page, then signs in once inside the Home Screen app. A generic **Set or reset password** request uses the same page and a resend cooldown.

This flow uses Supabase's supported invitation/recovery links and default hosted email. It does not require editing `{{ .Token }}`, customizing a hosted template, configuring custom SMTP, or upgrading the project. Magic Link is retained only for Safari/browser compatibility because Safari and an installed iOS Home Screen app do not share the same Auth storage.

After Jorge signs in, the browser idempotently creates or reuses one empty account plus two empty profile rows (`jorge` and `alexa`). That metadata contains no local workout, routine, preference, note, PR, timer, active-session, backup, or snapshot data.

## 3. Hosted schema status

The Big Gains hosted project records all three reviewed migrations:

- `20260807000000_phase4b_cloud_foundation.sql`
- `20260807120000_phase4c_harden_rls_event_trigger.sql`
- `20260807175037_phase4e_bodyweight_entries.sql`

The hosted migration ledger records all three changes. All nine application tables have forced RLS and all 36 ownership policies are present. The post-Phase-4E performance advisor reported no findings. The security advisor reported only the project-level leaked-password-protection warning; no table, RLS, function, or index finding was introduced by the DDL. Do not reapply these files manually in SQL Editor.

For a future environment or an operator recheck, the repository pins the Supabase CLI. Link only the intended project. If CLI authentication or the database password is required, enter it directly in the CLI's secure prompt or a short-lived operator-controlled environment; never pass it as a visible command argument or commit it.

```sh
DO_NOT_TRACK=1 npx supabase login
DO_NOT_TRACK=1 npx supabase link --project-ref YOUR_PROJECT_REF
DO_NOT_TRACK=1 npx supabase db push --linked
DO_NOT_TRACK=1 npx supabase migration list --linked
```

After the Phase 4E DDL, run both database tests and the security/performance advisors. The Phase 4E pgTAP transaction creates only fixed synthetic identities and rolls everything back.

```sh
DO_NOT_TRACK=1 npx supabase test db --linked supabase/tests/database/phase4b_rls.test.sql
DO_NOT_TRACK=1 npx supabase test db --linked supabase/tests/database/phase4e_bodyweight_rls.test.sql
DO_NOT_TRACK=1 npx supabase db advisors --linked --type security
DO_NOT_TRACK=1 npx supabase db advisors --linked --type performance
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
5. After this branch is separately reviewed and deployed, verify signed-out local/offline logging first, then complete the invitation/password setup and sign in once from the Home Screen app. Confirm that only the intended existing account/profile metadata is resolved.

Do not connect ordinary workout completion or upload a backup during these checks.

## Pre-data checklist

- All nine public tables have RLS enabled and forced.
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

## Phase 4G post-deploy friend step

After review, merge, v50 deployment, and a final managed two-profile **In sync** check:

1. Obtain the friend's exact email from Jorge at that time.
2. Reconfirm public email signup and anonymous sign-in are disabled.
3. Explicitly create or invite that one Auth user in Supabase Authentication. Do not create application rows manually.
4. Send the invitation with `redirectTo` set to the deployed `auth-setup.html`. The friend sets a password in Safari, then signs into the fresh Home Screen app and selects **Create private profile**.
5. Verify exactly one new account and one `independent-*` profile exist, with `pet_enabled=false`, `accent='cobalt'`, and `theme='performance-dark'`.
6. Run the offline/reconnect/in-sync smoke proof in `PHASE4G_INDEPENDENT_USER_CONTRACT.md`, then begin the sustained proof. Do not add the friend to Jorge's account and do not enable cloud pull.
