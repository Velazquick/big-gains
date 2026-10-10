# Active-session identity constraint correction

Baseline: main `a7b3f53a48ca33255c6a11df69f1af76522e711d`, production
`v119-conflict-resolution-retry`. This is a database-only correction; no client
cache/release change is required. Installed v119 already retries its durable queue
on reopen/foreground/online and validates exact transport readback before ACK.

## Failure and evidence

The shadow contract identifies an active session by account, profile and workout
client ID. Finish/discard captures a tombstone while preserving its source row.
The original database also imposed `unique(account_id, profile_id)`, which counts
retained tombstoned rows and rejects all later workout identities with 23505.
No transport retry can satisfy that physical singleton. A stale workout refuses
Finish/Discard while these operations remain pending. Resume opens the existing
workout but deliberately does not bypass that recovery gate.

The disposable regression reproduces a retained source row with a winning
tombstone and a new local session whose queued insert cannot succeed. This proves
the schema defect; it does not establish any physical device's complete queue or
the fate of its recorded sets. Do not infer recoverability or data loss from
missing cloud session rows or missing telemetry receipts. No real-user telemetry,
identities, session timestamps, training data or credentials belong in this
public regression package.

## Correction and boundaries

Migration `20261010102308_active_session_identity_constraint.sql` drops only the
profile-wide physical singleton, with a five-second lock timeout. The existing
per-session identity unique constraint, idempotency unique constraint, ownership
foreign key, RLS, grants, source rows, History, timestamps and tombstones remain.
Do not delete a source row or queue, manually complete/discard a workout, or
rewrite the old payload to make an insert fit the old singleton.

Multiple physical identities are expected with tombstones. Multiple genuinely
live identities remain a conflict: `schemaV5FromCloud` continues rejecting more
than one live active session instead of selecting/overwriting one. This migration
does not promise server-side serialization of simultaneous new workouts across
devices; cross-device ambiguity continues to fail closed through the existing
recovery contract.

## Verification and rollout

The disposable full-schema database harness seeds a retained source, winning
tombstone and completed History. It proves the exact old 23505, applies the
migration, compares all rows/RLS/grants, inserts the next session, tests per-ID
and idempotency uniqueness and wrong-owner denial. It rolls back all fixture
data and then allows the normal migration loop to apply the correction.

The browser regression runs the actual production transport and durable queue
against a synthetic constraint-respecting store. It reproduces the blocked stale
Finish, verifies Resume leaves sets intact, removes the constraint, retries and
ACKs the original operation, and finishes through the real controller once with
the exact completed set. Database enforcement is separately proved by SQL, not
claimed from that browser store.

Before hosted rollout, require green protected checks on the exact candidate.
Record read-only aggregate counts/checksums, RLS/grants and constraints for the
affected tables. Apply only this migration, then verify its absence/presence
checks and unchanged data/authorization. Production QA remains read-only. Queue
drain and physical-device acceptance require actual subsequent app activity;
do not fabricate writes to obtain a green result.

Rollback is conditional: restoring the singleton is possible only while every
profile still has at most one physical row. After natural new-session writes,
blind restoration fails and reintroduces the original bug. Never delete retained
rows to enable rollback; use a reviewed forward correction. An app rollback
does not undo the database migration.
