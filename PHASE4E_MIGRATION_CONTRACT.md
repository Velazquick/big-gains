# Phase 4E controlled migration contract

Phase 4E is a user-triggered, one-time cloud copy. Local schema-version-5 state remains the source of truth. Page load, sign-in, profile switching, workout completion, queue retry, and ordinary sync never invoke this contract. The existing normal cloud transport remains synthetic-only.

## Approved Phase 4D source anchor

The production migration accepts only a user-selected `big-gains.migration-preview.v1` audit from release `v47.1-phase4d-legacy-source-preview`, source schema contract 5. It recomputes the current Phase 4D preview and requires the account mapping, profile mappings, combined checksum, per-profile checksums, every entity checksum, and every count to match exactly.

The reviewed production anchor used by tests and operator review has combined checksum `6dc40eb8e25803faa0b4892b3883cd548225262053f2b06a0b71439fdcd3d4c3`. Jorge has 7 completed workouts, 1 bodyweight entry, goals, timer preferences, and 32 exercise preferences; Alexa has goals, timer preferences, and 19 exercise preferences. This value is not a bypass or embedded production approval. The browser accepts approval only from the selected metadata-only audit and a fresh recomputation.

The Phase 4D checksum contract is unchanged. In particular, changing the final bodyweight destination does not change a source entity checksum, profile checksum, or combined checksum.

## `big-gains.migration.v1` target rows

Every payload-backed row stores this envelope in its existing `payload` JSONB column:

```json
{
  "contract": "big-gains.migration.v1",
  "version": 1,
  "profileClientId": "jorge",
  "entityType": "completedWorkout",
  "clientId": "stable-client-id",
  "data": {}
}
```

The `data` field is the in-memory source record for completed workouts, `{ "name", "exerciseIds" }` for a custom routine, the goals or timer object for those preferences, `{ "exerciseId", "preference" }` for an exercise preference, and `{ "workout", "restTimerEndsAt" }` for an active session. Notes remain inside workout/session data. PRs, progress, volume, and calendar summaries are excluded.

| Local entity | Cloud table | Stable client ID |
| --- | --- | --- |
| Completed workout | `workouts` | Exact local workout ID |
| Custom routine | `routines` | `routine:` plus SHA-256 of the canonical routine name identity |
| Bodyweight entry | `bodyweight_entries` | `bodyweight:` plus SHA-256 of canonical ISO measurement time, numeric weight, and `lb`, plus a 1-based identical-occurrence discriminator |
| Goals | `preferences` | `goals` |
| Timer preferences | `preferences` | `timer` |
| Exercise preference | `preferences` | `exercise:` plus the URI-encoded stable exercise ID |
| Active session | `active_sessions` | Exact active workout/session ID |

Bodyweight rows use explicit columns: `measured_at`, `weight_value`, and unit `lb`. The current app's bodyweight semantics are pounds. Duplicate date/value pairs receive deterministic occurrence suffixes, while same-date/different-value entries have different hashes. Source order only distinguishes otherwise identical occurrences, so retry produces the same complete ID set without a runtime timestamp.

Every row uses version 1 and a `bg-migration-v1:` idempotency key derived from the stable migration ID, profile, table, client ID, and canonical target record. The stable migration ID is `bgm-v1-` plus the approved source combined checksum. Cloud UUIDs, database timestamps, and browser runtime timestamps are excluded from target checksums.

## Gate and confirmation

The first migration is available only with browser Supabase configuration, Jorge's authenticated owner session, exactly one owned account, exactly the `jorge` and `alexa` cloud profiles from the approved audit, a fresh READY Phase 4D preview, zero rows in every application table including `bodyweight_entries`, no migration marker, and a selected audit that passes the strict metadata-only schema.

Unknown audit fields are rejected so a file containing workouts, sets, notes, cues, weights, bodyweight values, or another raw payload cannot be treated as an approval. A mismatch produces a named blocker; there is no partial or count-only approval.

After approval, the UI shows Local Jorge → Cloud Jorge and Local Alexa → Cloud Alexa counts, exact writes for every target table, one recovery-journal row, source checksum match, empty destination verification, a backup reminder, and the promise that local state remains intact. The action stays disabled until the user selects `Migrate verified data` and checks the second inline confirmation containing the exact row count.

## Journal, retry, and recovery

One `sync_metadata` row under the owned Jorge profile uses client ID `migration:<stable-migration-id>`. Its `metadata` JSON contains only the migration/source/target contracts and checksums, planned counts, account/profile mapping IDs, status, timestamps, verification metadata, and a bounded failure code. It never contains a target payload.

The journal is inserted as `pending` before application rows. Application rows are insert-only. If an insert response is lost or a unique constraint reports a retry, the client reads the row by account, profile, and client ID and accepts it only when ownership, idempotency key, and canonical target payload all match. A different row is a conflict and is never updated. A matching `pending`, `verifying`, or `failed` journal is presented as `Resume migration`; it reuses the exact same migration ID, client IDs, idempotency keys, and target checksums.

## Verification and post-migration audit

After every planned row is present, the journal moves to `verifying`. The browser reads every migration target table scoped to the authenticated account, requires exact table/profile counts with no extra rows, reconstructs canonical `big-gains.migration.v1` records, verifies ownership/profile mappings, and recomputes the target checksum tree. It then recomputes the Phase 4D local source checksum. Any count, ownership, payload, target checksum, or current-source mismatch leaves the journal `failed`; only a complete match moves it to `complete`.

The downloadable `big-gains.migration-audit.v1` artifact contains the migration ID/status/timestamps, source format/checksums/counts, target table/profile counts and checksums, account/profile mapping IDs, and verification result. It contains no workout, set, note, cue, weight, bodyweight value, or raw personal payload.

Phase 4D continues to block once application rows exist. Phase 4E uses the completed journal and post-migration audit to show `Migration complete`; it does not make the old empty-destination preview report READY.
