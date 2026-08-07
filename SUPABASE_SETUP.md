# Supabase setup for Phase 4C

Nothing in Phase 4B needs a Supabase account, project, URL, key, CLI login, database connection, or data upload. Keep the placeholders in `.env.example` empty.

## What Jorge will create

1. Create one Supabase project on the free plan in the closest practical US region. Save the database password in a password manager; do not put it in this repository.
2. In Auth settings, choose the initial Jorge sign-in method and configure the deployed Big Gains site URL plus exact redirect URLs. Keep public friend signup disabled until friend onboarding is intentionally released.
3. From the project's Connect/API settings, copy only the Project URL and Publishable key into an untracked local environment file or the deployment provider's environment settings:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Do not place a secret key, database password, JWT signing secret, or legacy service-role credential in browser code, Git, localStorage, screenshots, or support messages. The browser needs only the URL and publishable key; authenticated user JWTs plus RLS authorize rows.

4. Install a pinned Supabase CLI dev dependency and use a local Docker-compatible runtime. Run the repository migration and database tests locally first:

```sh
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase db lint --level error
```

5. Review the generated diff, link the CLI to the one intended hosted project, and apply the checked-in migration with the CLI. Do not paste edited one-off table definitions into the dashboard.
6. Rerun the adversarial RLS cases against the hosted schema using synthetic users/rows only. Confirm anonymous access fails, cross-account reads return nothing, cross-account writes fail, forged account/profile pairs fail, and Jorge's synthetic account can access two owned profiles.
7. Create Jorge's Auth login through the Phase 4C application flow. The application should create one owned account row and two profiles (`jorge`, `alexa`) in a controlled, idempotent transaction. Do not manually upload existing workout JSON.

## Pre-data checklist

Before any real migration, confirm all eight tables have RLS enabled, anonymous/public grants are absent, the browser bundle contains no privileged key, account/profile ownership triggers exist, completed-workout uniqueness exists, the active-session one-per-profile constraint exists, and local logging still works with the device offline and with Supabase blocked.

Then export fresh Jorge and Alexa backups and run a preview-only migration that reports counts and checksums without writing. Actual upload requires a separate approval after those numbers match.

## Division of responsibility

- GitHub: application source, review history, releases, and optional `big-gains.snapshot.v1` backup publishing.
- Supabase Auth: login identity and sessions.
- Supabase Postgres: private account/profile data protected by grants, composite ownership constraints, and RLS.
- The device: immediate source of truth for workout logging and the durable outbound queue.

If Supabase is offline, slow, misconfigured, rate-limited, or unavailable, Big Gains saves locally and continues. Sync is background catch-up, never a prerequisite for training.
