# Operator Console v1

Canonical route: `/operator/` (GitHub Pages directory routing). `/operator` redirects to it on Pages. Sign in through the normal Big Gains application using the authorized owner identity, then open this URL. There is no consumer navigation entry and no user-management controls.

## Authority and data boundary

`private.product_operators` is an administrative allowlist keyed to Auth UUID. Every query checks this table, confirmed Auth identity, ban state and the JWT's live, unexpired Auth session. User metadata, email strings, profile presentation and managed-profile selection cannot grant access. Removing the allowlist row or Auth session takes effect on the next query. The page clears data on sign-out, authorization failure, page hide and tab hide.

Public `operator_access` and `operator_query` RPCs are invokers over private functions with fixed search paths. Only the private implementations have narrowly justified definer authority. Private views/tables have no ordinary-user read grants; new tables have RLS. Existing product policies are unchanged. Queries return operational projections only, never training payloads. Emails occur only in owner-authorized person lists/details, never telemetry or charts. No service-role credential is used by browser code.

Initial owner bootstrap: an administrator inserts the verified owner Auth UUID into `private.product_operators` with role `owner`, in a transaction that asserts its existing account/profile mapping. The migration itself seeds no operator. The authoritative owner mapping is captured read-only from hosted accounts and immutable profile identities before bootstrap. No UI provisions roles. A future support mode would require separate explicit authority and audit; it is not included.

## Canonical metric contract: operator-v1

The SQL projections and RPC in `20260914150718_operator_console_v1.sql` implement these definitions. The UI formats returned values; it does not recalculate database metrics.

| Metric | Definition |
|---|---|
| Registered | Auth identities not soft-deleted or anonymous; includes people without an account/profile. |
| Confirmed | Registered identities with non-null `email_confirmed_at`. |
| Person/profile assignment | Assign each profile to its managed member when one exists, otherwise its account owner. This avoids double counting a managed profile under both member and owner. |
| Activated | Registered person with ≥1 retained authoritative completed History row on an assigned profile. |
| First/second/latest workout | Ordered completion timestamps of retained History after resolving winning tombstones. Edits, deletion, imported and retrospective History affect these values. |
| Completed workouts | `workouts` rows excluding a higher-version tombstone, or same-version tombstone with deleted_at ≥ row updated_at. Counts are not telemetry-derived. Window counts exclude future completions. |
| Active today | Distinct Auth people with a received authenticated `app_open` from UTC midnight through now. |
| Active 7D/30D | Distinct Auth people with a received authenticated app open at or after now minus 7/30 elapsed days. Boundaries inclusive. Not workout-based DAU and not continuous foreground usage. |
| Latest meaningful activity | Later of completed History timestamp and observed app-open receipt. History may be retrospective; this is not a last-login timestamp. |
| Time to first workout | Hours between registration and earliest retained completion, only if completion ≥ registration. UI reports median and eligible count. Earlier imported completions are excluded rather than clamped to zero. |
| Program user | Person with an assigned profile whose persisted Program envelope has a non-null active Program version pointer. Draft/empty graph is not active adoption. |
| Freeform observed 7D | A `workout_started` event explicitly classified freeform in the past seven days. Missing Program/provenance never implies Freeform. Program and Freeform observations may overlap. |
| Unfinished | Active-session rows without completedAt, after the same tombstone resolution. |
| Sessions ≥6 hours | Unfinished row with valid start ≤ now minus 6 hours. This is explicitly a subset, not a replacement, of the accepted stale rule: six hours OR different local day. Invalid/future starts are not classified as aged. |
| Recovery/conflict | Historical client UI observations, never a claim that a device still needs recovery. No remotely inferred live sync state. |
| Current production release | Fresh production asset manifest loaded by the separate Operator loader. |
| Observed release | Most recent received event per Auth person within 90 days. Client-reported, server-allowlisted. It does not enumerate devices or prove every device has updated. |
| Coverage | People with retained events, plus last received event. No observation means unknown. |
| Error groups | Fixed category + surface + release + coarse platform/browser. Different defects may share a group; no raw stack/message-based signature. Counts only, no fabricated error rate. |

Funnel: current raw registration/confirmation/first/second completion milestones and percent of registered. App activity is separate because it is not a nested workout conversion step. No invitation/link-delivery conversion is claimed.

Retention: first **observed** authenticated app open establishes a person’s UTC cohort day. For D1/D7/D14/D28, count another app-open observation on exactly that UTC day offset, only once the entire return day has elapsed. Show eligible, returned and returned/eligible. Cohorts starting within the past 60 elapsed days are included so every return window remains within 90-day event retention. The first-open date persists across event cleanup; legacy usage before telemetry is unknown. Account/profile deletion resets associated observations by cascade. Return absence does not prove non-use because offline/unavailable events are dropped.

## Telemetry contract and failure policy

Events: `app_open`, `workout_started`, `workout_completed`, `program_adopted`, `exercise_swapped`, `stale_session_recovery_shown`, `stale_session_resumed`, `stale_session_finished`, `stale_session_discarded`, `recovery_required`, `conflict_presented`, `app_error`.

`app_open` is attempted on initial visible load and visible returns separated by at least 15 minutes. It is not a heartbeat. Start/complete and Swap hooks run after local persistence. Program adoption means successful activation through the setup flow. Existing durable account/confirmation state supplies onboarding milestones; signup/installation/invitation events are omitted.

Client fields: random event UUID, event enum, selected profile client identifier, allowlisted release, platform (`ios/android/windows/mac/linux/other`), browser (`safari/chrome/edge/firefox/other`), display mode (`standalone/browser`), surface (`app/train/program/recovery/onboarding`), error category (`none/javascript/promise/resource/sync/program/unknown`) and training mode (`unknown/program/freeform`). No client timestamp or arbitrary metadata. The server supplies Auth UUID, validates profile access, derives profile/account UUIDs and assigns receipt time. The selected profile string is resolved, not persisted in the event.

All event fields must be strings; unknown keys, names, enum values and payloads >1,024 serialized bytes are rejected. Release names must be registered in `private.product_releases` before deploying a future release. The same event UUID is idempotent; the RPC returns no event data. Ordinary users cannot enumerate telemetry.

The client discards messages, stacks, error objects, user agents and URLs instead of attempting risky text redaction. It sends fixed categories only. An email, token, workout object or Authorization header cannot enter a string metadata field because there is none. Synthetic sensitive-input tests prove this property.

No persistent queue or retries. Offline/unavailable events drop quietly. Two maximum in-flight requests; four-second request abort; ≤120 attempted events and ≤10 error events per document; identical actor/profile/event/surface/category deduplicated for 60 seconds with at most 64 in-memory keys. Database serializes ingestion per Auth identity and limits to 60 events/minute and 600/day. Training never awaits telemetry. The telemetry script loads asynchronously, outside required boot/precache assets; failure to fetch it does not block startup or offline training.

## Retention and deletion

Raw events are deleted after 90 days by `private.purge_product_events`, scheduled daily at 03:17 UTC with pg_cron (`big-gains-telemetry-retention`). Cleanup timing permits up to roughly one extra day before physical removal; queries exclude expired events. First-open cohort date and its associated identity links remain until account/profile/Auth deletion. All event and first-open foreign keys cascade. No delete-account UI or backup-retention guarantee is added here. Existing product backups remain a separate concern.

Plain PostgreSQL test installations without pg_cron skip scheduler installation; migration/query/purge semantics are still exercised. Hosted verification must prove the scheduled job exists and is active. Monitor cron execution as part of operations.

Deletion caveat: cascades apply when database records are physically deleted. An administrative Auth soft-delete does not remove those records or immediately cascade events; its events age out under the raw-event policy. No existing self-service account-deletion flow was found. Soft-deleted and banned identities cannot ingest events or use Operator. Restoring backups follows the existing product process and is not covered by an immediate-erasure guarantee.

Supabase references: [database function permissions](https://supabase.com/docs/guides/database/functions) and [scheduled cleanup](https://supabase.com/docs/guides/cron/quickstart).

## Performance and release gate

Users: server-side literal substring search, three sort choices, operational filters, stable UUID tie-break and 25-row pages. Detail events: latest 50 in a bounded window. Reliability: 1–90 days, release/platform filters, bounded 100-group tables. No workout histories enter the browser. Event time, user/time, profile/time, release/time and name/time indexes support bounded reads; workload completion index supports profile aggregation. Overview derives totals on demand rather than storing competing dashboard totals.

The protected Browser tests job runs the new disposable PostgreSQL security/analytics contract and telemetry unit tests before the existing product corpus. Browser coverage includes denied routes, partial-data failure, desktop/mobile layout, long identifiers, search/pagination/detail/funnel/reliability, empty states, and broken telemetry during online/offline Train and Finish. A fresh database is created for each database test and dropped afterward. No production training fixtures are created or modified.

Operator v2 candidates, not implemented: finer fixed error signatures, explicit consented audited support mode, mature cohort trends, query performance monitoring and additional least-privilege roles. No impersonation or destructive controls.
