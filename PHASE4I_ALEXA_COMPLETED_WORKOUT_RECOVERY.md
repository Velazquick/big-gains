# Alexa completed-workout cloud recovery path

This is a runbook for a future, separately approved data operation. Phase 4I does not execute it.

## Contract boundary

Big Gains is local first. An already initialized managed-member device does not periodically pull cloud rows into schema v5. Cloud-to-local hydration is supported only by the Phase 4H fresh-device recovery in `managed-profile-recovery.js`.

Therefore a cloud-seeded Alexa workout can hydrate through the normal application path only when all of these conditions are true:

- the authenticated membership resolves to account `894bde58-2bb1-472d-a229-e1b0e3ae04f9`, profile `dd14f771-9453-4093-9e88-8693f8efd9fd`, and profile client ID `alexa`;
- the target device has never initialized Alexa's managed-member schema-v5 storage, recovery marker, shadow catalog, comparison, or outbound queue;
- Alexa's cloud profile has exactly one valid `goals` preference, exactly one valid `timerPreferences` preference, and at most one active session;
- the complete cloud readback contains no unexpected owner, profile, entity, duplicate, or tombstone winner;
- reconstructing every current cloud winner produces a valid schema-v5 state and the reconstructed semantic checksum equals the verified cloud checksum.

If the managed namespace is not pristine, recovery intentionally stops with `local-namespace-not-empty` or `local-namespace-not-pristine`. Do not clear or edit device storage to bypass that block. The supported path for an initialized device is to import or create the workout locally on that signed-in device and let the normal local-save, durable-queue, RLS, ACK, and readback flow upload it.

## Canonical cloud row

For a pristine-device recovery, first validate the proposed `completedWorkout` with the same schema-v5 normalization and validation used by backup/migration preview. Do not add analytics-derived fields. The stable workout ID and existing exercise IDs in that payload remain authoritative.

The future authorized insert is one `public.workouts` row with:

- `account_id`: `894bde58-2bb1-472d-a229-e1b0e3ae04f9`
- `profile_id`: `dd14f771-9453-4093-9e88-8693f8efd9fd`
- `client_id`: exactly `completedWorkout.id`
- `idempotency_key`: one stable, operation-unique value retained for retries
- `completed_at`: exactly `completedWorkout.completedAt`
- `version`: `1`, unless a verified existing winner requires an explicit later revision
- `payload`:

```json
{
  "contract": "big-gains.shadow.v1",
  "version": 1,
  "profileClientId": "alexa",
  "entityType": "completedWorkout",
  "clientId": "<same value as completedWorkout.id and row client_id>",
  "data": "<the complete canonical completedWorkout object>"
}
```

The insert must run through an authenticated, authorized operational path and remain subject to the existing `workouts_insert_accessible` RLS policy. No service-role credential belongs in client code. The row's account, profile, client ID, payload identity, completion timestamp, and idempotency value must be read back exactly before Alexa signs in on the pristine device.

## Recovery and verification

1. Re-read the account, profile, and managed membership; stop on any mismatch.
2. Re-read all Alexa cloud entities and validate the complete recoverable schema-v5 state, not only the new workout row.
3. Verify the inserted row's envelope and row identities match and there is no competing workout/tombstone winner.
4. Let Alexa sign in normally on the pristine device. Phase 4H verifies membership and performs the one-time recovery.
5. Confirm the recovery marker identifies `alexa`, the local outbound queue is zero, the workout is present once by canonical ID, and local/cloud semantic parity is true.
6. If any check blocks, preserve both sides unchanged and investigate the reported reason. Do not force a merge or overwrite.

No account, profile, membership, RLS policy, migration journal, or sync-metadata mutation is part of this workout insert.
