# Phase 4F cloud-shadow and cutover-readiness contract

Release: `v49-phase4f-shadow-sync-readiness`

The original Phase 4F release keeps schema-v5 browser state authoritative while maintaining a continuously verifiable, one-way Supabase shadow. Release `v73-cross-device-remote-fast-forward` adds the narrow initialized-device exception documented below. Release `v74-history-v2-workout-management` allows verified higher workout revisions and tombstones through that same exception; it does not add automatic pull or a general merge engine. Release `v75-progress-v2-history-explorer-detail` is presentation-only and leaves every queue, revision, tombstone, and fast-forward rule in this contract unchanged.

## Runtime order

```text
local schema-v5 save
  -> asynchronous semantic capture
  -> durable owned operation
  -> UI control returns independently
  -> authenticated/account-mapped push
  -> affected-row readback ACK
  -> account-scoped shadow comparison
```

Cloud configuration, Auth, queue, comparison, and retry failures cannot prevent the local save. `app.js` schedules capture in a microtask only after `state-persistence.js` has written the existing profile key.

## `big-gains.shadow.v1`

The canonical record fingerprint is SHA-256 over:

```json
{
  "contract": "big-gains.shadow.v1",
  "version": 1,
  "profileClientId": "jorge|alexa",
  "table": "workouts|routines|bodyweight_entries|preferences|active_sessions",
  "clientId": "stable logical id",
  "deleted": false,
  "data": "local semantic source record"
}
```

Object keys are sorted by the existing Phase 4D canonicalizer. Array order is meaningful. Per-table checksums hash sorted `{clientId,data}` records; each profile checksum hashes the five per-table summaries. Jorge and Alexa are reported independently.

Source mappings:

| Local source | Cloud table/client ID |
| --- | --- |
| completed workout | `workouts` / workout ID |
| custom routine | `routines` / SHA-256 of routine name, matching Phase 4E |
| bodyweight | `bodyweight_entries` / timestamp+value+unit hash with occurrence suffix, matching Phase 4E |
| goals | `preferences` / `goals` |
| timer settings | `preferences` / `timer` |
| exercise cue/rest | `preferences` / `exercise:<encoded exercise id>` |
| active workout + rest deadline | `active_sessions` / active workout ID |

`prs`, volume, progress, and calendar groupings are derived values. They are never separate shadow source records and are recomputed locally from source workouts.

Cloud reconstruction accepts the existing `big-gains.migration.v1` envelope and the new `big-gains.shadow.v1` envelope. Reconstruction itself remains read-only. Missing, extra, mismatched, unknown-contract, wrong-profile, stale-version, newer-version, and tombstone conflicts become explicit comparison reasons.

## Release v73/v74 guarded remote fast-forward

A fresh comparison may classify newer cloud rows as **Changes from another device** only when all of these checks pass:

- the current session and fresh account/profile mapping match the runtime and catalog exactly;
- the durable local outbound queue is verifiably empty;
- every current local semantic fingerprint still matches the catalog, including absence for cataloged tombstones;
- every remote winner is either the exact fingerprint/tombstone/timestamp identity at the catalog revision or a higher revision;
- at least one remote winner is a new or higher revision;
- cloud reconstruction returns no ownership issue and reconstructs schema-v5 data at exact semantic parity.

The user must choose **Update this device**. `managed-profile-recovery.js` reconstructs canonical schema-v5 state, rechecks the local payload and queue after reconstruction, and atomically persists the profile state, remote catalog, and parity comparison with rollback on failure. A fresh comparison runs before reload. The queue is not cleared or rewritten. V74 treats a completed-workout edit or tombstone exactly like another higher monotonic revision; reconstruction validates the resulting schema-v5 history and derived records before adoption. If local data also changed, an expected cloud row disappears without a tombstone, or an equal revision changes fingerprint/identity, the update remains blocked as a real conflict.

## Production operations

Operations use `big-gains.sync-op.v1` in the existing durable `big-gains-cloud-sync-queue-v1` document. An operation freezes account ID, profile ID, table, stable client ID, mutation, version, timestamp, desired fingerprint, prior revision, payload, and recreation intent.

The stable retry key remains:

```text
bg-sync-v1:<account>:<profile>:<table>:<client-id>:<mutation>:<version>:<updated-at>
```

It is created once, persisted, and never derived from the Phase 4E migration ID. A retry can ACK only an exact owned remote identity/version/timestamp/fingerprint/idempotency match. A same-ID row with any other identity or payload is a conflict.

New entities begin at version 1. Changes increment the locally cataloged version. An update requires the remote current winner to match the operation's frozen base version, timestamp, fingerprint, and tombstone state. Ownership fields are immutable. A stale or newer remote revision blocks; no remote value can overwrite local data.

## Phase 4E adoption

Initial adoption requires all of the following:

- the signed-in Auth user owns exactly one account;
- that account has the verified `jorge` and `alexa` profile mapping;
- the complete `big-gains.migration-journal.v1` / `big-gains.migration.v1` baseline exists;
- both local profiles exactly match the reconstructed account-scoped cloud state.

The browser then stores a metadata-only shadow catalog containing stable IDs, versions, timestamps, fingerprints, ownership mapping, and the migration ID. It does not rewrite the 63 application rows. The first later mutation advances only its affected migrated row into a `big-gains.shadow.v1` envelope while preserving table, account, profile, and logical client ID.

## Tombstones

A tombstone is scoped by `account_id`, `profile_id`, entity table, and stable client ID. It has its own stable operation key, positive version, `deleted_at`, and `updated_at`.

Winner order is version, then timestamp, then tombstone on an exact tie. Deletion leaves the old source row available for audit but makes the tombstone the current winner. Recreation is accepted only when local behavior produces an explicit upsert with `allowRecreation=true`, a strictly greater version, and a base revision matching the winning tombstone. The tombstone remains as history; the later source version wins. This prevents an old device from silently resurrecting content.

The Phase 4F migration extends the tombstone type constraint to `bodyweight_entries` and adds an account/profile/entity/revision index. Forced RLS and immutable-ownership triggers remain the security boundary.

## Queue and state surface

- Signed out or offline: local save succeeds; an already adopted device can retain owned pending operations but cannot send.
- Wrong Auth account or profile mapping: the entire flush blocks before application-table access.
- Outage or lost response: retry keeps the same key; exact remote state becomes an ACK rather than a duplicate.
- ACK: requires affected-row readback. Empty queue does not imply parity until comparison succeeds.
- Verified remote-only advancement: offer **Changes from another device — Update this device**; never adopt automatically.
- Concurrent local/remote advancement: classify as a sync conflict and leave local data unchanged.
- Other drift: local data is unchanged and no automatic repair runs.

The Library card shows `IN SYNC`, `LOCAL CHANGES PENDING`, `CLOUD BEHIND / RETRYING`, `Changes from another device`, `SYNC CONFLICT`, `DRIFT DETECTED`, `SIGNED OUT`, or `OFFLINE`, with the remote update action visible only for a currently eligible fast-forward.

## Real-device cutover-readiness smoke test

1. Deploy `v49-phase4f-shadow-sync-readiness` and open the installed app online.
2. Sign in as Jorge. Do not edit anything yet.
3. Open Library and wait for **Cloud shadow — In sync** with Jorge and Alexa both **In sync**, zero pending changes, and a recent comparison time.
4. Switch between Jorge and Alexa and confirm the same two-profile result; do not accept any state that reports drift.
5. Return to Jorge and use one safe mutation: change the timer **Vibration** preference once.
6. Confirm the UI changes immediately, then observe **Local changes pending** or **Cloud is catching up** without losing normal navigation.
7. Wait for zero pending changes and **In sync**.
8. Reload the app. Confirm the preference is still local and the shadow returns to **In sync**.
9. Toggle Vibration back only if that was the original desired setting, and wait for **In sync** again.

Do not test restore, a second device, or a friend account in Phase 4F.

## Phase 4G recommendation

Create the friend as an independent Supabase Auth user with a new `accounts` row owned by that Auth UUID and one `profiles` row under that new account. Never add the friend profile to Jorge's account and never authorize by client-supplied presentation metadata.

Add profile-level presentation configuration, preferably a constrained `presentation jsonb` or explicit columns, for values such as `{ "petEnabled": false, "accent": "cobalt", "theme": "performance-dark" }`. RLS continues to authorize solely through `account_id -> accounts.owner_user_id = auth.uid()`; presentation values affect rendering only. Use an allowlisted client parser and database checks for supported theme/accent values. Jorge and Alexa keep their current presentation defaults; the friend's pet is off and accent/theme differs without changing ownership or isolation.

Phase 4G should run the same local-first queue and shadow comparison for two independent accounts over a sustained period before enabling any cloud-to-local authority or multi-device merge.
