# PWA update safety investigation — v117

Baseline: clean origin/main `7c82efeed667d22f29b3a71d1c4ee13119c0234f`.
Production investigated: `v116-strength-history-correctness-config-dfadb48839db90f2`.
Read-only GETs confirmed exact Git-blob equality for pwa-update.js, service-worker-core.js, app.js, cloud-sync.js, managed-profile-recovery.js, program-portability.js, and profile-appearance.js. HTML, manifest and worker wrapper matched exactly after the documented deployment config substitution (local config-925e766c1b907250 → production config-dfadb48839db90f2). Windows checkout CRLF differences were excluded by comparing Git blobs.

## Proven defects and limits

1. A recovery-blocked reconciliation can later perform a successful comparison with parity=true, zero pending changes and no current conflict, but return success without assigning lastResult. The updater correctly reads lastResult.blocked/conflict and therefore remains blocked by historical evidence. The regression executes the real cloud-sync owner with synthetic boundaries; it failed on the baseline and passes with the fix. A second case produces a real historical lastResult.conflict via a synthetic pending queue and verifies recovery.
2. The updater treated an open but hidden dialog as an editor and considered visibility:hidden changed inputs visible. Browser reproduction failed on the baseline. Visibility now checks hidden ancestors, layout rectangles and computed visibility. Off-screen visible fields still block; actual dialogs and selected hidden restore files still block.

Neither reproduction establishes Jorge's exact physical-device blocker. That requires the installed shell's diagnostics or a device observation. The release makes legitimate blockers observable and fixes these proven false positives without bypassing guards.

## Ownership and fail-closed audit

| Gate | Authority and stale-state handling |
| --- | --- |
| Startup | Runtime canInteract, initialized and degraded modules. Unready/degraded remains startup; exceptions remain unknown. |
| Local workout/rest/storage | App runtime inspects the current session, timer and all known profile snapshots. Timer lifecycle clears completed deadlines. Invalid saved state remains storage; no deadline or other profile is cleared by the updater. |
| Editors and inputs | Visible dialogs, changed text/number/password fields, textarea and contenteditable protect unsaved work. Visibility includes off-screen layouts, excludes hidden ancestors and CSS-hidden elements. Visible sign-in drafts remain protected; hidden sign-in fields do not. Checkbox/radio preferences save immediately and retain their existing handling. |
| File restore | Selected files block even when the styled input is hidden. The existing restore writer clears the input in finally after success/failure/cancelled profile validation. No updater mutation. |
| Sync work | pending, busy, comparing, capturePending, reconciliationInFlight are current state. Capture release is idempotent; asynchronous work uses finally. Missing/malformed fields now fail closed as unknown. |
| Historical sync outcome | Only current, newly completed successful reconciliation may replace blocked/conflict with verified-parity. Requires a new comparison object, parity=true, no compare in progress, empty queue, no pending capture, unchanged mutation generation, current page lifecycle and the identical historical result object. A newer failure reported during readback is never superseded. Cached parity, comparison failure, lifecycle supersession, queued work or concurrent mutations cannot clear the guard. |
| Current conflicts / parity | sameEntityConflict and remoteFastForward are recomputed on comparison; successful comparison clears them. lastComparison.parity=false persists until a fresh successful readback. Failed readback remains unsafe even offline; historical timestamps alone are never treated as proof of recovery. |
| Managed recovery | recoveryInFlight clears in finally. Adoption journal and startup rollback failure remain authoritative commit-protection state. Manually deleting a journal is not recovery. The updater does not clear or retry it. |
| Program | busy and updateCaptures clear in finally; queue and currentSnapshot status govern safety. Refresh/resolution recomputes status; unresolved errors/conflicts/pending remain blocked. UPDATE_AVAILABLE is already an accepted safe non-mutating state. No reset. |
| Appearance | busy clears in finally, conflict clears only through existing resolution/verified synchronization, pending is durable. The updater independently validates the saved envelope so the appearance reader's tolerant fallback cannot hide malformed state. |
| Migration | Current busy flag is reported as migration; unavailable/malformed dependency is unknown. |
| Durable queues | Exact cloud-sync/program queue namespaces including profile suffixes are scanned, across profiles. Valid empty version-1 pending arrays permit update; nonempty arrays block queue; invalid JSON/shape fails closed unknown. Related appearance envelopes validate accepted/pending values. Unrelated keys are never parsed. No acknowledgement, removal or rewrite. |

## Bounded diagnostic rule and reevaluation

Settings → Support → Advanced diagnostics → Update safety displays `Update safe`, `Update applying`, or `Update blocked: <reason>`. No state values, credentials, record IDs, messages or input contents are exposed.

The first blocker wins in this order: startup; local workout/rest/storage; editor; sync; sync conflict/parity/recovery; managed recovery; Program; Appearance; migration; durable records sorted by key. Malformed dependencies/exceptions are unknown. Local reasons are allowlisted. Within durable records, lexical key order makes selection deterministic.

The existing visible-page 1-second refresh recomputes safety, not cached presentation. Focus, pageshow, online and visible visibilitychange also recompute via check, including its throttled path. Queue drain, sync/recovery completion, Program/Appearance completion and editor closure are observed without new events, reload, or reopening the banner. A hidden page reevaluates on resume. Update approval and controllerchange retain fresh guards, one-shot approval, multi-client refusal and at-most-once reload. No service-worker lifecycle behavior changed.

## Validation and release

Before implementation: original 20 Chromium PWA tests passed; the new stale recovery and hidden UI regressions failed for their expected reasons. Focused validation covers real waiting-worker lifecycle, same-banner transitions, diagnostics, restore inputs, durable records, current safety owners, unknown dependencies, offline caches, sync and remote recovery. The protected Browser tests workflow remains unchanged and authoritative; use its exact tested candidate and protected main deployment. Register only the new release string with scripts/register-pwa-safety-release.sql in the existing telemetry allowlist (operational metadata, not schema/Auth/RLS or training state).

## Existing iPhone Home Screen acceptance (physical proof remains open)

1. Open the same installed Home Screen app. Finish any workout/rest, save or close meaningful editors and allow normal sync/recovery to settle.
2. If the banner covers Support, tap Later to hide it temporarily. In Settings → Support → Advanced diagnostics, use Check for app update to bring it back. Record App version, Installed worker version and Update safety. If disabled, resolve only the indicated underlying state through its existing UI; do not clear queues/conflicts/recovery/storage.
3. Confirm Update now enables automatically with the banner still visible. Tap once, verify v117-pwa-update-safety-gate (or the offered newer release), then confirm the same profile, Program, Goals, History and session state are intact.
4. New diagnostics cannot retrofit JavaScript already running in an older cached shell. If the old shell remains stuck after normal recovery, fully close Big Gains only after saving work and let the waiting worker activate naturally on the next normal Home Screen open. Do not force reload, uninstall or clear storage. If diagnostics still show unknown/storage/recovery, retain that state and report the code; do not bypass it.
5. Once v117 is installed, an additional waiting release is needed to physically verify its entire new safe/unsafe-to-safe update cycle. Synthetic browsers prove that cycle now; deployment alone does not prove it on Jorge's iPhone.

No production user/training state, active session, Program, Goals, History, queue, conflict or recovery state was mutated for QA. No schema/Auth/RLS changes.
