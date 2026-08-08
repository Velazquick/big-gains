# Phase 4G independent-user contract

Phase 4G makes the production PWA usable by one invited independent Auth user without making that user a member of Jorge's account. Local schema version 5 stays authoritative. There is no cloud-to-local merge, repair, restore, or cutover path.

## Runtime account shapes

`account-context.js` selects exactly one runtime shape before persistence binds:

| Shape | Expected profiles | Local selection | Cloud baseline |
| --- | --- | --- | --- |
| Managed | `jorge`, `alexa` | Existing switcher and `big-gains-active-profile` | Completed Phase 4E journal plus exact two-profile Phase 4F parity |
| Independent | One server-issued `independent-*` client ID | No switcher | Exact one-profile mapping; a newly provisioned empty destination may seed an empty outbound catalog |
| Guest | None | Neutral fresh-device shell | No cloud queue or profile ownership |

The managed compatibility values remain byte-for-byte stable: `big-gains-v2`, `big-gains-alexa-v1`, `big-gains-v1`, `big-gains-active-profile`, and the existing calendar session keys. A fresh device with none of those values opens a neutral guest shell, never a Jorge/Alexa dataset.

## Independent local namespace

After RLS-verified account discovery, the browser stores only the verified mapping needed to reopen the same local profile:

```text
storage namespace = cloud-{cloud account UUID}-{cloud profile UUID}
profile state     = big-gains-{storage namespace}-v1
queue             = big-gains-cloud-sync-queue-v1-{storage namespace}
catalog           = big-gains-cloud-shadow-catalog-v1-{storage namespace}
comparison        = big-gains-cloud-shadow-comparison-v1-{storage namespace}
calendar session  = big-gains-calendar-date-{storage namespace}
```

The namespace is stable, contains no email address, and cannot collide with either managed profile key. Signing out keeps the active local runtime and its data. Signing into another Auth user does not consume the active queue: account verification must first activate that user's cached runtime and reload, and every flush still verifies the exact Auth/account/profile mapping.

Full local multi-account switching is intentionally out of scope. The identity-selection rule is: a verified signed-in Auth account becomes the active runtime; signing out preserves that runtime; a device with existing managed keys but no cached cloud runtime remains managed; a truly fresh device is guest until an invited user signs in.

## Atomic self-provisioning

`public.bootstrap_independent_account(requested_display_name text)` is `SECURITY INVOKER`, callable only by `authenticated`, and validates `auth.uid()` explicitly. It sets a caller-bound transaction-local guard, creates one `accounts` row and one `profiles` row in one transaction, then clears the guard before returning.

Direct browser inserts into `accounts` and `profiles` fail RLS because their insert policies require that guard. The account's existing unique `owner_user_id` constraint serializes concurrent/retried calls. A retry returns the existing independent account/profile. Existing zero-profile, managed two-profile, multi-account, or other unexpected shapes block for manual review; the function never silently creates another account or attaches a profile to Jorge.

Display names are trimmed, whitespace-normalized, limited to 1–60 characters, and reject control characters. The server issues a stable `independent-*` client ID. Public signup and anonymous Auth remain disabled; the magic-link request always uses `shouldCreateUser: false`.

## Presentation schema

`profiles` stores three explicit render-only columns:

- `pet_enabled boolean`
- `accent text` constrained to `ember`, `rose`, `cobalt`, or `merlot`
- `theme text` constrained to `performance-dark`, `wellness-light`, or `slate-dark`

Independent defaults remain `false`, `cobalt`, and `performance-dark`. The optional `merlot`/`slate-dark` pair adds a wine accent on cool charcoal surfaces without changing profile semantics. Jorge remains `true`/`ember`/`performance-dark`; Alexa remains `true`/`rose`/`wellness-light`. The client repeats the allowlist and falls back to friend-safe cobalt/performance values for unknown data. It applies tokens through `data-accent`, `data-theme`, and CSS variables. With pet disabled, the pet module registers no interaction listeners and all pet homes/slots remain hidden.

No RLS policy, ownership trigger, foreign key, queue owner, or account resolver references presentation values.

## Independent shadow bootstrap

The Phase 4F checksum, fingerprint, idempotency, base-revision, ACK readback, tombstone, and conflict rules are unchanged. `cloud-shadow.js` now derives its expected profile set from the runtime account shape.

Managed mode still requires exactly Jorge and Alexa plus the completed Phase 4E journal. Independent mode requires exactly one RLS-visible profile. On the first clean onboarding only, an empty local schema-v5 profile plus an account with zero application rows creates an empty outbound catalog; local preferences then persist first, queue second, and push third. Any non-empty mismatch without an adopted catalog is drift and remains blocked. Cloud values never write local state.

## Post-deploy real friend onboarding

Do these steps only after branch review, merge, v50 deployment, and a final Jorge/Alexa in-sync check:

1. Jorge provides the friend's exact email address to the operator; do not add it to source, SQL, or browser storage.
2. In Supabase Authentication, confirm public email signup and anonymous sign-in are still disabled.
3. Explicitly create or invite one Auth user for that email. Do not create an account/profile row manually and do not add the user to Jorge's account.
4. On the friend's fresh device/browser, open the deployed PWA and request a magic link for that already-created email.
5. After sign-in, enter the display name and choose **Create private profile** once. The RPC creates one owned account and one profile with cobalt/performance-dark and the companion off.
6. Verify the shell shows only that display name, no Jorge/Alexa selector, an empty schema-v5 history, and a private-cloud card for one profile.
7. Turn the device offline, log and complete a small real workout, reload offline, and confirm it remains present.
8. Reconnect and wait for zero pending plus **In sync**. Confirm only the friend's account gained rows and Jorge/Alexa counts did not change.

## Sustained three-profile proof

Run for at least 14 days, preferably 28:

1. Record a day-zero count-only baseline for both accounts and all application/sync/tombstone tables.
2. Jorge and Alexa continue normal use and profile switching on the managed device. The friend uses only the independent device.
3. Each person completes at least three workouts across the period; include one offline start/completion/reconnect for Jorge or Alexa and one for the friend.
4. Exercise one routine edit, one bodyweight entry, one timer preference change, one active-session resume, and one intentional delete/tombstone per account shape.
5. After every test mutation, record local success first, pending count transition, eventual zero pending, and per-profile **In sync**. Do not use cloud data to repair a mismatch.
6. Sign the friend out and back in on the same device once; verify the same local namespace and state return. Attempt a wrong-account session with a synthetic fixture only and verify its prior queue is blocked.
7. Weekly, run count-only account summaries, the rollback-only pgTAP isolation suite, and security/performance advisors. Never inspect Jorge/Alexa payloads for this proof.
8. At the end, compare count deltas with the documented real actions, export separate local backups, and record every drift/outage/retry incident. Any unexplained cross-account count or drift stops the proof.

## Phase 4H recommendation

Begin Phase 4H only after the sustained proof has started and produced stable evidence. Phase 4H should add an operator-visible sync health/incident ledger and recovery rehearsal—not cloud authority or multi-device merge. Record metadata-only queue age, retry reason, last parity, account shape, and client release; add explicit export/restore disaster drills and a user-visible blocked-queue recovery path. Keep local schema v5 authoritative. Defer any cloud-to-local or multi-device reconciliation design to a later phase with its own conflict model and opt-in cutover.
