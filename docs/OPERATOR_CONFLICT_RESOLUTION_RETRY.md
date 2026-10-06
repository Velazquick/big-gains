# Conflict resolution receipt retry

When verified Program convergence or recovery parity closes a tab's conflict,
Operator should receive the resolution even if its first telemetry submission fails.
The previous client removed the episode immediately after attempting delivery.
An offline, rejected, errored or saturated attempt could therefore leave retained
conflict attention after successful convergence. This is an observation gap, not
evidence that training or convergence failed.

## Invariant and bounds

Convergence, update safety and workout operation never await telemetry. A verified
resolution retains the exact episode and a fixed event UUID until the existing
`record_product_event` void RPC returns an explicit 2xx HTTP response with
`error: null`. Server insertion is already idempotent by event UUID. A committed
receipt with a lost response can be retried without adding another receipt.

Pending resolution uses the existing telemetry-only sessionStorage cache, capped
at 16 tab-local entries and the existing 90-day episode retention. It stores only
the current owner's/profile's identifiers, coarse release/environment, random
event UUID and bounded attempt/timing metadata. It contains no workout payload,
session key, token, email, diagnostic message or raw URL. Loaded entries are
validated and rebuilt from an allowlist. Training and sync storage are untouched.

Each resolution gets at most eight submission attempts within 24 hours of verified
resolution, with 5/10/20/40/80/160/300-second backoff. Attempts and next-eligible
time survive same-tab reload. Offline, hidden, pagehide, wrong actor/profile or
full transport capacity defer delivery; they do not reset bounds. The existing
two-in-flight and 120-attempts-per-document budgets also apply. Saturation before
submission consumes no resolution attempt. Missing/mismatched sessions also
consume no receipt attempt or document budget and defer the next identity check
for one minute. A four-second deadline bounds session lookup plus RPC; a late
session result cannot start a request after that deadline.

Online, foreground, pageshow, startup, retry timers and ordinary telemetry-slot
completion reconsider eligible delivery. Session identity is verified before RPC;
actor/profile changes prevent another identity's receipt from being sent or retired.
The single RPC's Authorization header is bound to that validated session, so a
shared SDK session change cannot substitute another actor's token between
validation and request dispatch. The token exists only transiently in that
request; it is never retained in receipt metadata, storage or diagnostics.
Automatic retries require the original profile to be selected. No account-wide
or historical episode closure is performed.

Attempt/age exhaustion retains the pending identity but stops retries; normal
90-day retention/capacity eviction can still remove it. Storage denial/loss,
independent tabs, browser termination and unavailable future foreground activity
remain coverage limits. Resolution is not guaranteed. A genuinely new conflict
after convergence gets a new episode while the old receipt remains pending.

## Release and validation

`v119-conflict-resolution-retry` rotates the shell/cache identity. Its local
release-registration migration inserts one allowlisted release only; it changes
no user records, ingestion contract, authorization, RLS or private projections.
The reviewed release must be registered before any later authorized deployment.
This draft does not authorize applying the migration, merging or deploying.

Regression coverage includes explicit acknowledgment, offline, RPC rejection and
error, missing acknowledgment, timeout, saturation, document budget, reload,
lost-response idempotency, actor/profile transitions, backoff/attempt/age bounds,
pending/blocked Program states, recurrence, cache privacy/capacity/storage failure,
native reload/tab isolation and disposable PostgreSQL receipt/History invariants.

The integrated Node fixture executes actual Program runtime and telemetry but
supplies synthetic domain-inspection outcomes. Existing domain-cutover tests cover
the domain contract separately. No test touches real hosted records or queues.

This does not explain or close the previously observed nine real-user episodes.
They remain historical unresolved observations with limited coverage. PR #121's
conflict-only projection remains unchanged. Receipt-order support reporting and
initial telemetry-slot saturation remain separate investigations.
