# Operator v2 — v115

Starting main: a2897217bdfdd488d2757cae80db756bdbb1d433. Production inspected September 15, 2026: v114-operator-console-v1 / config-dfadb48839db90f2. Starting hosted migration: 20260914161625. Evidence: Big-Gains-Reliability-Investigation-2026-09-15.md. No attempt is made to retrospectively diagnose the legacy resource/app event or equate legacy presentation counts to conflicts.

## Reporting correctness

Operator projects `active_sessions.payload.data.workout.startedAt` and `.completedAt`. Winning tombstones exclude rows. A completed-shaped session is excluded. Invalid/missing starts remain unknown. Six-hour age and UTC day rollover are reported independently; the consumer app's local-day recovery rule is unchanged. User data is never repaired by Operator.

## Diagnostic contract

Authenticated v115 errors add only enumerated error_code, module_id, lifecycle and error_class, plus server-verified diagnostic_fingerprint. Existing release/environment/surface fields remain bounded. Module IDs are exact application manifest filenames; unknown/external resource paths map to unknown. Query strings, raw URLs, error messages, stacks and arbitrary exception properties are never persisted or fingerprinted. Error name is matched to a fixed class allowlist.

Fingerprint: FNV-1a 32-bit, uppercase BG-xxxxxxxx, over category|code|module|surface|lifecycle|class. Server recomputes it. It is a diagnostic grouping hint, not a globally unique incident identity or a security digest. SQL also groups the complete bounded tuple, retaining classification if a hash collision occurs. Release and environment are excluded so one group can be compared across releases/platforms. First/last are within the selected filter; “new” means first observed within retained history, not proven introduction by that release.

Capture distinguishes actual resource-target error events, window JavaScript errors (including null error objects), unhandled promises, bounded asset-loader failures, service-worker registration/update failures and worker resource failures without cache fallback. Worker notices target only the requesting client. A worker resource failure does not distinguish network loss from every possible cache/network cause. Unknown stays unknown. Early asset-loader failures can be sampled once identity is available; other unauthenticated/early errors can be missed.

## Conflict lifecycle

An episode is one continuous observed unresolved interval per authenticated actor, profile and channel (program/recovery) **in a tab**. Random opaque UUID assignment happens once on first conflict observation; later renders look up that deterministic lifecycle key. No training payload or revision contents are hashed. CHECKING, refresh, retry and foreground changes do not close it. A visible presentation is sampled at most once per minute, separately from detection. These are sampled presentation observations, not an exact count of user-visible openings.

Session storage holds at most 16 entries, with a 90-day maximum lifetime on reload. Same-tab reload preserves identity. Storage loss, tab/browser closure, eviction or another device/tab may create another episode; browser tab duplication may copy session storage. Therefore these identities cannot deduplicate global underlying product conflicts. Independent tabs/devices are not identified. A new conflict after verified resolution creates a new identity. Concurrent causes on the same channel during one unresolved interval are not asserted to be separate conflicts.

Resolution is attempted only after Program remote inspection verifies convergence or recovery readback parity with an empty pending queue. Telemetry exceptions cannot change those decisions. Missing resolution telemetry means current state is unknown, not proof that a person is stuck. Legacy conflict_presented events have unknown episode counts. Existing conflict UI, resolution choices and product synchronization rules are unchanged.

## Traffic, activity and denominators

Public pre-signin arrivals use a separate anonymous Supabase client without persisted Auth. A random tab session expires after 30 minutes. Only visit, signup_reached and signup_started are accepted, once each per session. Campaign stages are grouped by the arrival-session date so percentages share one session cohort. Visit must arrive first. Public observations are not linked to accounts and do not establish unique humans, first-time visitors, cross-device return or campaign-to-account conversion. Known signed-in visitors are excluded. Only direct/beta-wave-1/beta-wave-2 are accepted campaign IDs; no referrer or arbitrary query is sent.

The public write-only RPC validates exact keys, fixed enums and a 512-byte bound. Global advisory-lock-protected budgets accept at most 300 events/minute and 10,000/day, with 30-day retention. This bounds accepted storage, not hostile request volume; an attacker can consume the budget. It is not bot-proof and under/overcounting is explicitly disclosed. There is no public read capability and no anonymous private-schema grant. Client drops offline/in-flight/rate-limited events, has six attempts per document, one request in flight and a three-second timeout. No persistent delivery queue or retry loop exists.

Authenticated observed people are distinct Auth users with qualifying app_open receipts. App opens include initial visible load and visible returns after 15 minutes, not every foreground or page view. Returning observed means first observed open precedes the selected period. Missing telemetry remains unknown. Daily buckets and Today use UTC; 7D/30D are elapsed windows, with partial first/last UTC days. Registered/confirmed counts use account facts; activated/second/fourth completion use retained authoritative History. Percentages explicitly use people or sessions, never mixed denominators. Retention D1/D7/D14/D28 uses exact UTC return days after first observed app open, mature days only, with raw eligible/returned counts. It is not an activation-based retention cohort.

## Operator and security

Overview includes activity trend, release adoption, reliability people counts, mature retention and recent pulse. Traffic keeps anonymous sessions separate. Users retains server pagination/search (25), adds narrow-screen cards and compact filters. Detail separates account facts from chronological telemetry receipts (50/page), correct unfinished-session state, episodes and diagnostic links. Reliability groups diagnostics and lifecycle episodes, keeps legacy limitations visible, and offers affected-user/timeline drill-through with bounded nearby events. Back navigation preserves in-memory filters. Human timestamps use browser local timezone with UTC ISO tooltips; storage remains UTC.

All reads still call server owner authorization first. Profile selection cannot grant Operator authority. Existing v1 RPCs remain compatible during rollout. No admin secret is shipped. Direct telemetry reads/writes remain revoked, RLS is unchanged, and forged profile identity is rejected. Product telemetry is bounded to two requests in flight, 120 attempts/document, ten error attempts/document, four-second timeout and per-key throttling. Telemetry is optional and never awaited by training/recovery.

## Scale and validation

Date/fingerprint, actor/profile/episode/time, app-open/time and public source/time indexes support bounded retained data. Responses use 25-row group/person/episode pages, 50-event timelines, 15 pulse entries and at most 24 nearby observations. No full History/telemetry download occurs in the browser. Server projections remain suitable for the intended hundreds-to-low-thousands scale; this is not a warehouse.

Synthetic fixtures cover real nested envelopes, completion/tombstone/6h/UTC rollover, owner/ordinary/independent/managed authorization, fingerprint privacy/parity/grouping, conflict reload/dedup/resolution, public fixed contract and write-only access, distinct app opens, timeline drill-through, local time, mobile layout and telemetry-outage Train/Finish including offline. WebKit cases are part of the existing protected macOS job. Worker attribution is explicitly tested. Disposable PostgreSQL 17 is required in protected CI; local PGlite rehearsal is supplemental.

Deployment: review exact migration and candidate head, require protected gates, apply additive migration via the normal migration tool, then merge without bypass and allow guarded Pages deployment. Retain v1 API for old clients. Verify hosted schema and deployed marker/assets read-only. No production synthetic events, training writes, session finishing/discarding or conflict resolution are allowed. Rollback is client rollback; do not destructively remove retained telemetry columns/tables.
