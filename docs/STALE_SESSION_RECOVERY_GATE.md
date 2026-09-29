# Stale-session recovery validation on PR #119

Baseline main: 7c82efeed667d22f29b3a71d1c4ee13119c0234f.
Original PR #119 head: fbfb93d10f28c4796844f6983664841832315ad3.
Production before this interval: v116-strength-history-correctness-config-dfadb48839db90f2.
Read-only HTTP GETs match exact main Git blobs for app.js, cloud-sync.js, pwa-update.js, service-worker-core.js, managed-profile-recovery.js, program-portability.js and controlled-migration.js. Clean clone; only PR #119 continued. Other open PRs: #106, #109, #111; standby rollback branches remain untouched.

## Evidence and root cause

The physical report establishes a previous-day Push 1 with Resume enabled, Finish and Discard disabled, and the pending sync/recovery guard message. No connected Sontai device snapshot or bounded operational report was available. The exact device blocker remains UNPROVEN; do not equate synthetic reproduction with physical diagnosis.

In main's cloud-sync.js reconcileCurrentPage, a fresh compareShadow can set lastComparison.parity=true and clear current conflict state while leaving an older lastResult.blocked/conflict object unchanged. staleRecoveryWritable in app.js and safety in pwa-update.js both read that historical object. The two new consumer assertions fail with main's cloud-sync.js and pass with the existing PR correction. No competing sync fix was added.

The existing PR correction requires a fresh comparison object, verified parity, empty queue, no capture/comparison, stable mutation generation, current lifecycle generation, and the identical prior result object. Existing race tests ensure no newer failure, concurrent mutation, queued work, failed parity or lifecycle supersession is superseded.

## Added behavior

staleRecoverySafety returns an allowlisted first-blocker category, retaining every existing unsafe condition. Malformed sync counters/flags and missing or malformed migration state now explicitly fail closed as unknown rather than being treated as idle. Advanced diagnostics -> Stale workout safety shows No stale session, Recovery safe, or Recovery blocked: sync/recovery/program/migration/unknown. No messages, IDs, timestamps, training contents, credentials or free-form owner reasons are emitted. Normal user copy remains unchanged.

The existing one-second workout clock and resume/visibility handlers recompute eligibility. Tests observe recovery without manually refreshing the card. Completion, deliberate two-tap discard and Resume retain their existing controller. PWA Update now still blocks on an active workout even after sync recovery; only explicit Finish/Discard followed by otherwise idle safety permits activation.

## Regression coverage

Utility recovery: normal, next-day and multi-day Finish; exact completed set preservation; one History entry; repeat completion refuses duplication; real Program advances once only on Finish; Resume leaves capture and session intact; confirmed Discard; no automatic completion; offline Resume and offline unsafe blocking; telemetry exceptions do not block completion.

All sync pending/busy/comparing/capture/reconciliation, same-entity conflict, fast-forward conflict, historical blocked/conflict, parity mismatch, managed recovery, Program and migration states remain blocked. Exceptions and missing migration produce bounded unknown. Synthetic real cloud-sync owner recovery re-enables Finish/Discard, preserving sentinel durable queue and recovery journal bytes. A real waiting service worker banner separately observes the same recovered sync state and enables Update now only while idle. No production QA writes.

Focused unit and browser checks precede the unchanged protected Browser tests workflow on the exact final candidate. Required playwright depends on successful Apple WebKit; main push must rerun the gate before Pages deployment. No protection bypass, forced merge, manual deployment artifact, schema/Auth/RLS or training-state changes.

## Sontai acceptance after verified deployment

1. Reopen the same installed app. Do not create another workout, remove the session, clear storage/queues, or reinstall.
2. Allow normal sync/recovery to settle. Keep the existing Push 1 intact. If an older cached shell is still running, close the app normally and reopen to allow normal client-free worker activation; do not force activation or force reload.
3. In Settings -> Support -> Advanced diagnostics, verify v117-pwa-update-safety-gate and Stale workout safety. If still blocked, report only the app version and bounded code. Preserve the session; do not bypass the guard.
4. When Recovery safe and Finish now is enabled, finish the existing Push 1 through the normal completion control exactly once.
5. Verify one completed History entry for that existing session, its completed set data, and no duplicate session. Resume should remain available until completion. Device acceptance remains pending until Sontai confirms these observations.

## Parked follow-up

Separate P1 correctness/UX investigation: Bench sets reportedly prefilled from Strength Goal suggested numbers rather than last performed values. Not investigated or implemented in this interval.

Final focused validation: 35 Node PWA checks and 81 Chromium browser checks passed (utility recovery, PWA update, cloud sync and offline). Baseline historical blocked/conflict checks: 2 expected failures with main's sync owner. Full protected results must be verified before merge.
