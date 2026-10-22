# Workout reliability integration

This candidate composes the reviewed workout writer/History protections (#127), CI readiness and independent Node verdicts (#128), and operation-owned Program rollback/journal recovery (#129). It keeps schema-v5 localStorage, existing Auth/RLS and transport protocols. No IndexedDB migration or training redesign is included.

The base is main `a61ddb8a44412dbe9b3714f68e47021269d493db`. The recovered integration checkpoint is `22a9b384f3f620f860f6547ed8d307fcf93010c9`. The live #128 branch used here is `bf765593cfec8b2ac15119bb23d1a31401fbfa8d`; its advertised pull head `0e77525` is older. Existing PR branches are not rewritten.

## Commit and recovery contracts

- A delayed import captures its immutable live contents, active identity, owner/lifecycle and original durable bytes before reading the file. The last synchronous owned write checks that original base. In-place saved and unsaved edits reject the import with actionable feedback. Native `localStorage.setItem` returning is the existing local commit boundary; optional presentation/capture cannot reverse it.
- Finish inserts exactly one completed identity, removes its active session and advances an eligible Program once in the same owned profile write. Failed storage keeps the workout and controls recoverable. Repeated Finish after commit does not insert another record. An existing completed identity is never silently overwritten by a conflicting active identity.
- Pending/busy outbound delivery, capture and old parity failures do not independently veto local Finish. Unknown owner/readability, retained recovery evidence, an explicit Program replacement, conflicting recovery or migration still block it. PWA update eligibility keeps its stronger idle/editor/queue/recovery requirements.
- Local completion and cloud backup are separate facts. Pending History remains pending if another entity is acknowledged. A lost ACK retains the original operation identity. No schema change or cross-entity server atomicity is claimed.
- A comparison stages catalog, parity and conflict outcomes through its last await, then checks owner/lifecycle, mutation generation, profile bytes, catalog and queue before publication. A superseded result cannot regress upsert-2/delete-3 or clear an established conflict. Historical parity alone cannot advertise a current backup.
- A queue-before-catalog interruption replays only verified contiguous owned pending revisions into derived catalog metadata. It never rekeys, deletes or acknowledges those operations. Gapped, ambiguous or mismatched evidence refuses capture and remains intact for diagnosis. Catalog candidates become live only after their durable write succeeds.
- On first authenticated reconciliation after reopening, durable profiles are rescanned against the retained catalog and pending operations. This reconstructs intent missed by a stop between profile commit and asynchronous capture. Offline local History is still authoritative; remote verification remains pending until actual acknowledgment and parity.
- Program recovery evidence remains a safety blocker across presentation refresh and reload. Normal status refresh is not evidence resolution. Existing transaction-owned rollback and retained-journal contracts remain in [TRANSACTION_OWNERSHIP_ROLLBACK.md](TRANSACTION_OWNERSHIP_ROLLBACK.md).

## Permanent acceptance coverage

The original `tests/workout-integrity.spec.js` remains byte-identical to #127. The 114 ownership/Program runtime cases remain required. New deterministic cases are in `tests/reliability-import.spec.js`, `tests/reliability-finish.spec.js`, `tests/catalog-comparison-ownership.test.mjs` and the Program runtime latch regression. They hold real file reads, hashing/comparison/session boundaries and storage faults rather than hiding overlap behind an idle condition.

The protected macOS WebKit job includes the new browser regressions. The full Chromium job runs the Node runner, synthetic PostgreSQL/security contracts and complete browser corpus. Astra and Train remain additional checks. Local Windows WebKit, mobile viewports and synthetic database proofs do not substitute for physical iPhone, installed-PWA, VoiceOver or hosted registration acceptance.

The candidate release is `v123-reliability-completion`, with separately reviewed registration artifact `20261022213558_operator_reliability_completion_release.sql`. This preparation does not apply that registration or authorize a main merge. See [the guarded rollout runbook](RELIABILITY_RELEASE_RUNBOOK.md).
