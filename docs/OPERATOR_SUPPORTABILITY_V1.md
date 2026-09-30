# Operator Supportability v1 — v118

Starting main: `162894bbfe23afdb91982b663dd113fc8aa02426`. Clean clone, unchanged remote verified before implementation and before candidate preparation. Production baseline: `v117-pwa-update-safety-gate/config-dfadb48839db90f2`. Hosted migrations include Operator v1 `20260914161625` and Operator v2 `20260915235536`; repository migration filenames differ from hosted timestamps. Hosted function definition digests were read-only inspected: ingest `ec03cfbe81b8ae57dfd394ad92f2bf12`, v2 query `e95d18f25e8f0d2e8d676a58ad69d16c`. Standby PRs #106/#109/#111 are unrelated and untouched. Existing protected Browser tests → main-push Pages workflow remains the deployment path.

## Product behavior and observation boundary

Users report their experience. Operator reads bounded evidence. Existing v117 staleRecoverySafety remains unchanged: runtime/boot unknown, sync queue/capture/busy/comparison/reconciliation, current recovery/conflict/parity, managed recovery, Program portability, then controlled migration. The first unsafe dependency is `sync`, `recovery`, `program`, `migration`, or `unknown`. `none` means no dependency blocker. Finish also requires an eligible completed set; this is represented only by its permission boolean, never by set data. Unknown safety dependencies continue failing closed.

The existing one-second workout clock plus visibility/pageshow handlers recompute permissions. Observation consumes that decision without owning it. A blocked→safe change enables controls and attempts one readiness event without reload. Resume, completion, Program advancement, persistence and two-tap discard use the existing controller. Stale completion observations now run from its successful completion callback, including Finish after Resume; discard runs only after its successful discard callback. Observer exceptions are isolated. Individual state-reader exceptions produce unknown bounded fields instead of suppressing the entire observation.

## Contract and episode semantics

Events: `support_state_observed`, `stale_session_presented`, `stale_session_blocked`, `stale_session_ready`, `stale_session_resumed`, `stale_session_finished`, `stale_session_discarded`. Existing events and v1/v2 APIs remain compatible.

Strict string fields: active unfinished, stale, Finish permitted, Discard permitted, conflict presence (`yes/no/unknown`); dependency blocker; reconciliation (`idle/pending/checking/blocked/verified/unknown`); pending sync count (0–1000, capped, or unknown); fixed Program portability status; ISO parity-verification timestamp or unknown; local completion observation (`none/once/multiple/unknown`); positive bounded sequence. Existing release, profile, actor and coarse platform/browser/mode accompany the observation. Server validates exact keys, enums, consistency, timestamp and a 2 KiB maximum. No arbitrary JSON, email, queue objects, conflict objects, raw workout identity, exercises, weights, reps, notes or bodyweight enter the contract.

Random tab/profile/session episode identity is stored in sessionStorage (maximum 16 entries, reload age limit 90 days). The raw session ID is a local lookup key only and is never transmitted or hashed. Same-tab reload and foreground retain the episode and sequence; storage loss, another device/tab and duplicated tabs can produce separate or copied identities. There is no global device identification or global incident deduplication.

Availability/blocker changes emit immediately. Other changing bounded metadata is sampled at most once per minute. Stable active sessions refresh coverage every 15 minutes through the existing clock. Initial presentation has one initial availability observation. Repeated renders are silent. Existing two-in-flight, 120/document, error and server budgets apply. Failed/offline/rate-limited observations can be lost; no persistent delivery queue, training dependency or recovery retry loop is added.

## Operator evidence

User Detail displays per-profile Support / Current state, latest observation/release/environment, permissions/blocker, reconciliation, pending count, conflict presence, Program portability and latest successfully observed parity time. Persisted cloud unfinished-session presence is shown separately from device observations. Missing or older-than-30-minute device facts become Unknown/Coverage limited. Recent observations are not a live globally consistent device snapshot. User cards carry compact bounded support status.

Timeline shows detection, blocker, readiness, Resume, Finish and Discard in receipt order, with episode sequence available. A readiness event is labeled “Recovery became healthy” only when an earlier blocked sequence was actually received; initially ready sessions are not invented recoveries. Receipt ordering does not establish causality, and concurrent transport can reorder receipts. Latest state within an episode uses sequence, preventing older late arrivals from overwriting newer observations.

Completion reporting counts idempotent stale completion lifecycle observations within the random episode. One received completion says **Completion observed once**. Repeated completion observations or an explicit local multiple-completion observation are surfaced as duplicates. Cleared local unfinished state and separate cloud unfinished projection remain visible. No claim of exactly one authoritative cloud History row for that session or globally duplicate-free completion is made: no raw session identity/cloud mapping is added. Resume never implies completion; Discard never creates a completion observation.

Reliability reports affected users, blocked tab episodes, bounded blocker distribution, episodes observed ready after blocking, eventual Finish, and episodes without Finish/Discard observed. Full retained lifecycles are used for episodes with observations matching the selected period/release/environment. A median receipt time from first blocked→first subsequent ready requires three nonnegative samples; sample count is visible. Missing resolution means unknown, not proof of a stuck user. Multiple blockers may occur within one episode.

Needs attention is a dedicated paginated view: recently observed uninterrupted blocking lasting 15+ minutes (the threshold restarts after readiness), unclosed conflict episodes, 3+ observations of one diagnostic group in 24 hours, or workout start→error within 10 minutes with no same-profile resolution receipt after 15 minutes. These are review signals, not causal diagnoses. The last signal lacks session correlation and can be incomplete when telemetry is missing. No external alerting is added.

## Schema and security

Additive migration `20260930105400_operator_supportability_v1.sql` adds bounded columns/indexes, extends strict ingestion, registers v118, and adds revoked private support views plus an owner-authorized v3 query. Public v3 is security invoker; the private definer performs the existing owner/session authorization before queries and uses an empty search_path. All new private views remain inaccessible to ordinary/managed/independent users. Existing training/Auth/RLS policies are unchanged. No admin/service-role key is placed in the client. Existing retention/purge and account/profile deletion behavior apply to the same private event table.

Supabase changelog/docs reviewed. September 25 PostgreSQL minor-release changes for ltree, custom estimators, btree_gist and pgcrypto settings do not apply to this additive telemetry change. The hosted project is PostgreSQL 17.6; no database engine upgrade is part of this interval.

## Validation and production safety

Focused: 18 telemetry unit tests, 45 disposable PGlite supplemental database checks (same protected PostgreSQL harness), and 10 focused Chromium support/controller/mobile checks passed. Existing recovery/Operator checks also passed; some broader local browser cases experienced browser process/context crashes, so the unchanged protected macOS WebKit and real PostgreSQL/Chromium gate is authoritative. No local browser workaround enters source. Required checks must be green on the exact candidate before merge; no protection bypass or manual Pages artifact substitution.

All write QA uses synthetic local/disposable fixtures. Real hosted inspection is read-only. No Jorge/Sontai training data, sessions, queues, Program state or History is manually altered. The additive migration writes operational release metadata only. Deployment verification must be read-only and stop this interval afterward.
