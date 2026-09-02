# RC-2 self-serve Auth readiness

Status reviewed: 2026-09-02. Public signup is enabled. The disposable account completed confirmed password sign-in, independent bootstrap, welcome, Train now, reload, sign-out/sign-in, and isolation verification. The initial callback lookup error and test-harness retries are recorded below; this was not an uninterrupted first-attempt pass.

## Current hosted state

- Supabase project: `oogvndghbigxjkthzkdy` (`Big Gains`)
- Hosted public signup: enabled (`disable_signup: false`) after the independent-bootstrap repair passed hosted verification
- Hosted email auto-confirm: disabled (`mailer_autoconfirm: false`), so confirmation is required
- Email/password provider: enabled; anonymous sign-ins remain disabled
- Canonical GitHub repository variable: `BIG_GAINS_SELF_SERVE_SIGNUP=true`; the existing green-main Pages workflow generates and versions the browser configuration
- Production runtime: `v103-rc-hardening-pass-1`; deployed configuration: `config-4e7a818766c78b60`, with `selfServeSignup: true`, automatic reconciliation enabled, and Program portability enabled at version 1
- Production Site URL and signup callback: `https://velazquick.github.io/big-gains/`
- Allowed redirects: the exact app root and `https://velazquick.github.io/big-gains/auth-setup.html`. The exact recovery path was added during activation; no wildcard was introduced.
- Custom SMTP enabled: `smtp.resend.com`, port `465`, username `resend` (lowercase), sender `Big Gains <no-reply@auth.getbiggains.com>`; credentials remain outside the repository and browser assets
- Resend domain `auth.getbiggains.com`: verified, including DKIM and sending/SPF records; DMARC publishes `v=DMARC1; p=none;`
- Confirm-signup template: **Confirm your email address**, with concise copy using `{{ .ConfirmationURL }}`. Recovery uses the isolated production `auth-setup.html` page. Templates were left unchanged.

## Delivery verification

The September 2 recovery email was accepted by Resend's SMTP path with HTTP 200 and recorded as delivered. The owner physically confirmed Gmail receipt and arrival at the Big Gains Private Access password setup screen. Initial Gmail placement was Spam. Authentication is verified; initial spam placement is tracked as a new-domain reputation issue, without claiming reliable inbox placement.

The disposable signup confirmation was accepted through custom SMTP with HTTP 200 at 20:07 UTC and recorded as delivered by Resend. Its sender was `Big Gains <no-reply@auth.getbiggains.com>`. The delivered link used Supabase `/auth/v1/verify`, `type=signup`, and the exact production app-root redirect. Opening that actual link returned HTTP 303, confirmed the intended identity, and passed fresh Auth `/user` checks. Recipient-side Yahoo Inbox versus Spam placement has not yet been reported by the owner; provider delivery is proven, but folder placement is not claimed.

Disposable recovery messages and the focused existing-user Magic Link recheck were also recorded as delivered. The recovery link returned to the exact production `auth-setup.html`, verified the identity, completed a password update, cleared its temporary session, and supported subsequent password sign-in. No existing user's password was changed.

## Disposable stranger verification

The pre-activation hosted database tests exposed an existing bootstrap failure: `accounts_select_accessible` used a STABLE helper that looks the proposed account up before `INSERT ... RETURNING` can see it. The repair reads `owner_user_id` directly from the proposed row and retains the existing managed-access helper. The caller-bound INSERT guard, security-invoker RPC, membership privileges, and profile policies are unchanged. This preserves the owner/member access set while allowing atomic creation to return its new owner row. See PostgreSQL's [RETURNING policy requirements](https://www.postgresql.org/docs/17/sql-createpolicy.html).

Migration `20260902192013_rc_signup_account_returning.sql` and the managed-access bootstrap regression merged through [PR #100](https://github.com/Velazquick/big-gains/pull/100), exact reviewed head `d9ac3dff43c2b907dfe4f7a8dabe4459d0a59f18`, producing main `401a8a014537a544c68db4c05199b3b37c5c8f6e`. Supabase recorded the same canonical SQL as migration `20260902195055`, name `rc_signup_account_returning`.

The original independent pgTAP suite failed before the repair. After the canonical migration was applied, the independent suite passed all 47 checks and the expanded managed suite passed all 76 checks, including independent bootstrap after managed policies are installed. Test transactions rolled back, and all 12 preflight data counts and checksums matched exactly. Local Docker was unavailable, so no local database test success is claimed.

Both protected PR/branch browser checks passed all 521 browser tests plus the 201 Program checks. One initial branch run timed out on an unchanged timer visibility test; the PR run passed it, three focused repetitions passed, and the full unchanged-head branch retry passed. No check was bypassed and no protection was changed.

The same timer-test timeout recurred during the readiness follow-up. Its setup raced the existing 100 ms discard-to-Today navigation: a direct controller start does not select Train. The test now waits for the completed discard navigation and explicitly selects Train for its replacement-workout setup. Product code and all stale-timer assertions are unchanged; this fixes the repeated CI setup race rather than retrying it indefinitely.

The operator authorized a previously unused mailbox for a disposable profile labeled **RC Signup Test 2026-09-02**. No real-user credentials are used and the test must not fabricate completed training History.

The isolated browser began with no Auth storage. Production Create account was visible; signup returned HTTP 200 with an unconfirmed identity and no session. A hosted query proved **zero application accounts, profiles, or memberships before confirmation**. Confirmation changed only the Auth identity; another hosted query proved all three application counts remained zero before bootstrap.

One call to `bootstrap_independent_account` returned HTTP 200 and created exactly one account and one independent profile. The display name is **RC Signup Test 2026-09-02**. Defaults were performance-dark, cobalt, and companion off; no managed selector appeared and no Goal or Program was required. Welcome appeared, Train now opened the exercise picker for a blank workout, reload retained the profile and hid welcome, and sign-out/password sign-in retained the same account and profile without a second bootstrap or welcome.

The real test JWT could read only its own rows across all 11 application tables and no membership. Read-only authenticated-role probes using each of the three existing users' claims returned zero test-account rows across all 11 tables. Existing managed membership mutation privileges remain denied. Today, Plan, Train, Progress, Library, History, Settings, and service-worker control passed the final browser smoke. History reported no completed workouts. The completed continuation had no console or page errors.

The first signup callback's account GET returned one HTTP 401 after successful Auth verification, while its membership GET returned 200. The test stopped before profile creation; it did not retain its generated password. Normal recovery was used only for this disposable identity to continue with a known test password. One recovery-harness attempt clicked before the form's verified-ready state and was corrected without a product change. Subsequent password sign-ins and account reads passed. A fresh email-link callback recheck returned 200 for every account/profile/data request and restored the draft workout; that harness timed out waiting for Settings because Workout Mode correctly hid it. These observations do not establish the cause of the initial 401, and the initial callback must not be described as error-free. If the callback stops, password sign-in is the primary supported continuation; investigate any recurrence.

No reviewed cloud account-removal procedure was found. The isolated RC identity, profile, preferences, and draft are retained. No manual SQL cleanup was used and no completed training History was fabricated.

## Data reconciliation

| Table | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Auth users | 3 | 4 | +1 |
| accounts | 2 | 3 | +1 |
| profiles | 3 | 4 | +1 |
| profile_memberships | 1 | 1 | 0 |
| workouts | 58 | 58 | 0 |
| routines | 1 | 1 | 0 |
| preferences | 77 | 80 | +3 |
| active_sessions | 3 | 4 | +1 |
| tombstones | 5 | 5 | 0 |
| bodyweight_entries | 7 | 7 | 0 |
| program_domains | 1 | 1 | 0 |
| sync_metadata | 1 | 1 | 0 |

After excluding only the disposable Auth user and its account-scoped rows, every baseline count and full-row checksum matched exactly. Checksums use MD5 over sorted per-row MD5 hashes of `to_jsonb(row)::text` in a repeatable-read snapshot. The three test preferences are onboarding, generic goals, and timer defaults. The one active-session row is the normal uncompleted Train now draft; it is not History. These test-owned default/draft additions are explicit deltas beyond the initially anticipated onboarding-only preference allowance. All pre-existing Auth, account, profile, membership, workout, Program, and other data hashes are unchanged.

## Abuse and password hardening

The existing hosted limits are unchanged: 30 emails/hour, 60 seconds between emails to the same user, 30 sign-in/signup requests per five minutes per IP, 30 verification requests per five minutes per IP, and 150 refreshes per five minutes per IP. Email links expire after 3600 seconds. The application requires an 8-character minimum password.

CAPTCHA remains off for the tiny RC cohort as authorized. Reconsider it if abuse or delivery-limit pressure appears.

Preflight and post-activation Security Advisor report only [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The organization is on Supabase Free; the Dashboard identifies Pro or higher as required. It remains disabled and plan-gated. Post-activation Performance Advisor is clear, including Program warning 0029. No new signup- or SMTP-attributable advisory appeared.

## Preserved boundaries

Signup creates only an Auth identity. A verified session must separately call the existing `bootstrap_independent_account` RPC, which remains the sole atomic creator of one independent account and one independent profile. No public surface creates or joins managed profiles. Invites, password recovery, existing-user-only Magic Link, managed membership, SZW behavior, local-first training, and Program portability are unchanged. The account SELECT policy repair described above preserves the owner/member access boundary; all profile policies remain unchanged.

All 11 application tables have RLS enabled and forced. Normal authenticated users cannot insert, update, or delete managed memberships. Anonymous callers cannot execute bootstrap; the bootstrap RPC remains security invoker. Local profile schema remains v5.

Safari/Home Screen guidance remains intact: open the newest confirmation link in Safari, then return to the separate Home Screen app and sign in with the password. Desktop automation does not replace physical iOS storage-container verification.

## Deployment and rollback

Activation starts from exact main `5b30396dd1255ba725b7296026b173cdf559cbc9`, runtime `v103-rc-hardening-pass-1`, and a clean checkout. Initial deployed config was `config-439256697ce1957f` with signup off. The initial activation rerun was cancelled and Pages skipped when the bootstrap regression was found; both signup gates were returned to OFF before any disposable identity was created. The repair uses a canonical migration and protected PR. Pages continues to require its green `playwright` job. No out-of-band page edits, protection changes, or Edge Function changes are used.

[Main run 33675735337](https://github.com/Velazquick/big-gains/actions/runs/33675735337) passed the full protected corpus on `401a8a014537a544c68db4c05199b3b37c5c8f6e`. Its first deployment captured the old flag before the variable update. The existing Pages job was rerun against the same green commit after the flag was saved. Duplicate deployment archives blocked attempt 2; both archives were preserved locally and only those generated duplicates were removed, retaining the browser test report. Attempt 3 deployed the enabled configuration successfully. The later temporary hosted signup pause during callback diagnosis was lifted after password/bootstrap/isolation checks and the fresh callback recheck. Final public Auth settings and all production asset references were verified again.

To close signup again, disable hosted public signup and set the repository variable to `false`, then rebuild through the same green-main Pages path and verify the new config marker. Keep email confirmation, SMTP, and existing-account access intact. Do not delete users, clear queues, or alter RLS as part of rollback.
