# RC-2 self-serve Auth readiness

Status reviewed: 2026-09-02. Final stranger-flow verification is in progress; activation is not yet declared complete.

## Current hosted state

- Supabase project: `oogvndghbigxjkthzkdy` (`Big Gains`)
- Hosted public signup: temporarily closed (`disable_signup: true`) while the independent-bootstrap repair is reviewed
- Hosted email auto-confirm: disabled (`mailer_autoconfirm: false`), so confirmation is required
- Email/password provider: enabled; anonymous sign-ins remain disabled
- Canonical GitHub repository variable: `BIG_GAINS_SELF_SERVE_SIGNUP=false` during repair; the existing green-main Pages workflow generates and versions the browser configuration
- Production Site URL and signup callback: `https://velazquick.github.io/big-gains/`
- Allowed redirects: the exact app root and `https://velazquick.github.io/big-gains/auth-setup.html`. The exact recovery path was added during activation; no wildcard was introduced.
- Custom SMTP enabled: `smtp.resend.com`, port `465`, username `resend` (lowercase), sender `Big Gains <no-reply@auth.getbiggains.com>`; credentials remain outside the repository and browser assets
- Resend domain `auth.getbiggains.com`: verified, including DKIM and sending/SPF records; DMARC publishes `v=DMARC1; p=none;`
- Confirm-signup template: **Confirm your email address**, with concise copy using `{{ .ConfirmationURL }}`. Recovery uses the isolated production `auth-setup.html` page. Templates were left unchanged.

## Delivery verification

The September 2 recovery email was accepted by Resend's SMTP path with HTTP 200 and recorded as delivered. The owner physically confirmed Gmail receipt and arrival at the Big Gains Private Access password setup screen. Initial Gmail placement was Spam. Authentication is verified; initial spam placement is tracked as a new-domain reputation issue, without claiming reliable inbox placement.

## Disposable stranger verification

The pre-activation hosted database tests exposed an existing bootstrap failure: `accounts_select_accessible` used a STABLE helper that looks the proposed account up before `INSERT ... RETURNING` can see it. The repair reads `owner_user_id` directly from the proposed row and retains the existing managed-access helper. The caller-bound INSERT guard, security-invoker RPC, membership privileges, and profile policies are unchanged. This preserves the owner/member access set while allowing atomic creation to return its new owner row. See PostgreSQL's [RETURNING policy requirements](https://www.postgresql.org/docs/17/sql-createpolicy.html).

Migration `20260902192013_rc_signup_account_returning.sql` and the managed-access bootstrap regression travel through the protected PR. The original independent pgTAP suite failed before the repair and passed all 47 checks with the repair inside a rolled-back hosted transaction. The expanded managed suite passed all 76 checks, including new independent bootstrap after managed policies are installed. All 12 preflight data counts and checksums remained unchanged after rollback. Local Docker was unavailable, so no local database test success is claimed.

The operator authorized a previously unused mailbox for a disposable profile labeled **RC Signup Test 2026-09-02**. No real-user credentials are used and the test must not fabricate completed training History.

Pending: public Create account, unconfirmed identity without application rows, delivered confirmation and exact redirect, one independent bootstrap, welcome/Train now, reload/password sign-in, cross-account RLS, final advisors, and data reconciliation. No reviewed cloud account-removal procedure was found; retain the isolated test identity and report its exact deltas instead of manually deleting around RLS.

## Abuse and password hardening

The existing hosted limits are unchanged: 30 emails/hour, 60 seconds between emails to the same user, 30 sign-in/signup requests per five minutes per IP, 30 verification requests per five minutes per IP, and 150 refreshes per five minutes per IP. Email links expire after 3600 seconds. The application requires an 8-character minimum password.

CAPTCHA remains off for the tiny RC cohort as authorized. Reconsider it if abuse or delivery-limit pressure appears.

The preflight Security Advisor reports only leaked-password protection. The organization is on Supabase Free; the Dashboard identifies Pro or higher as required. It remains disabled and plan-gated. Performance Advisor is clear, including Program warning 0029.

## Preserved boundaries

Signup creates only an Auth identity. A verified session must separately call the existing `bootstrap_independent_account` RPC, which remains the sole atomic creator of one independent account and one independent profile. No public surface creates or joins managed profiles. Invites, password recovery, existing-user-only Magic Link, managed membership, SZW behavior, local-first training, Program portability, and RLS policies are unchanged.

All 11 application tables have RLS enabled and forced. Normal authenticated users cannot insert, update, or delete managed memberships. Anonymous callers cannot execute bootstrap; the bootstrap RPC remains security invoker. Local profile schema remains v5.

Safari/Home Screen guidance remains intact: open the newest confirmation link in Safari, then return to the separate Home Screen app and sign in with the password. Desktop automation does not replace physical iOS storage-container verification.

## Deployment and rollback

Activation starts from exact main `5b30396dd1255ba725b7296026b173cdf559cbc9`, runtime `v103-rc-hardening-pass-1`, and a clean checkout. Initial deployed config was `config-439256697ce1957f` with signup off. The initial activation rerun was cancelled and Pages skipped when the bootstrap regression was found; both signup gates were returned to OFF before any disposable identity was created. The repair uses a canonical migration and protected PR. Pages continues to require its green `playwright` job. No out-of-band page edits, protection changes, or Edge Function changes are used.

To close signup again, disable hosted public signup and set the repository variable to `false`, then rebuild through the same green-main Pages path and verify the new config marker. Keep email confirmation, SMTP, and existing-account access intact. Do not delete users, clear queues, or alter RLS as part of rollback.
