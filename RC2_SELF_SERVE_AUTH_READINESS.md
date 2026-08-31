# RC-2 self-serve Auth readiness

Status reviewed: 2026-08-31

## Current hosted state

- Supabase project: `oogvndghbigxjkthzkdy` (`Big Gains`)
- Hosted public signup: disabled (`disable_signup: true`)
- Hosted email auto-confirm: disabled (`mailer_autoconfirm: false`), so confirmation is required
- Email/password provider: enabled for existing and invited users
- Production application capability: fail-closed and disabled unless `BIG_GAINS_SELF_SERVE_SIGNUP=true` is deliberately set
- Redirect destination: `https://velazquick.github.io/big-gains/`; local validation also allows `http://127.0.0.1:4173/`

## Activation blocker

No approved custom SMTP credentials or reviewed Send Email Hook configuration were available through the connected project tooling or environment. Supabase's demonstration mailer is not acceptable for public release. Therefore public signup must remain disabled in hosted Auth and the deployment capability must remain false.

Activation requires, in order:

1. Configure custom SMTP or a reviewed Send Email Hook with an approved sender/domain.
2. Prove delivery, confirmation-link expiry/replay behavior, and the production redirect without creating an unauthorized production test user.
3. Review production Auth email rate limits and delivery-provider suppression/bounce handling.
4. Enable hosted email signup while retaining confirmation requirements.
5. Set `BIG_GAINS_SELF_SERVE_SIGNUP=true` only after the canonical code deployment is green.
6. Verify a disposable, explicitly authorized end-to-end account and then re-check account/profile counts and RLS isolation.

## Abuse and password hardening

The checked-in Auth contract uses an 8-character minimum and a 60-second resend/reset interval. Hosted Auth supplies sign-in/signup and verification rate limits. CAPTCHA remains off while public signup is off; it can be added if abuse signals justify the friction and an approved provider is available.

The hosted security advisor reports only leaked-password protection. The organization is on Supabase Free, while breached-password checking is available on Pro and above. It is therefore plan-gated, not presented as enabled, and must be reconsidered if the project is upgraded before public activation.

## Preserved boundaries

Signup creates only an Auth identity. A verified session must separately call the existing `bootstrap_independent_account` RPC, which remains the sole atomic creator of one independent account and one independent profile. No public surface creates or joins managed profiles. Invites, password recovery, existing-user-only Magic Link, managed membership, SZW behavior, local-first training, Program portability, and RLS policies are unchanged.
