# Big Gains user-owned data export v1

Status: implemented in `v99-rc-user-data-export`.

## Product boundary

`Export my data` creates two private files locally from the currently loaded profile. It does not write browser state, call the cloud, delete records, or combine managed profiles. It is a portability feature for a person leaving or inspecting Big Gains, not an import or recovery format.

The existing schema-v5 technical backup and restore remains separate. That technical file retains the complete current profile document for Big Gains recovery and keeps its existing filename, serialization, validation, and import behavior.

## Delivery

One action prepares both artifacts with the same export timestamp. When the browser exposes `navigator.share`, supports `File`, and confirms both files with `navigator.canShare({ files })`, Big Gains opens the native share sheet with both files. Otherwise, a small sheet offers each file separately. Each fallback download uses an in-memory Blob and object URL; no server upload is involved.

The files are UTF-8. The CSV begins with a UTF-8 byte-order marker for spreadsheet compatibility and uses CRLF records. Names use a sanitized display-name slug and UTC export date. An email-like display name is replaced with `profile` so an email address is never placed in a filename.

## Completed sets CSV

The CSV has one row per set whose stored `completed` value is exactly `true`, inside an authoritative completed History workout with a valid `completedAt`. Completed warm-ups and working sets are both included. Incomplete set rows are not represented as performed work.

Stable order is oldest-to-newest workout completion, stored exercise order, then stored completed-set order. Exact exercise variants remain distinct through their EKF canonical identity.

Columns:

1. Workout date
2. Workout completed at
3. Workout name
4. Entry method
5. Workout note
6. Exercise order
7. Exercise
8. Canonical exercise ID
9. Set number
10. Set type
11. Measurement
12. Load entered
13. Load unit
14. Load meaning
15. Reps
16. Duration
17. Duration unit
18. Distance
19. Distance unit
20. Exercise note
21. Set note
22. Program
23. Program version
24. Program slot

Load is always the raw entered fact. Machine load is labeled `Machine-indicated load`; weighted bodyweight is labeled `Added load`; assisted movement is labeled `Assistance`; and per-hand/per-side bases remain explicit. Reps-only, duration-only, and distance work do not receive invented load or rep values. No analytics-only volume or estimated-load value replaces the entered fact.

## Curated JSON

The top-level marker is:

```json
{
  "format": "big-gains.user-export.v1",
  "version": 1
}
```

Top-level sections are `metadata`, `workouts`, `bodyweight`, `goals`, `routines`, `program`, and `preferences`.

- `metadata` contains the fixed export time, app release, and display name. It contains no email, Auth user ID, account ID, or profile UUID.
- `workouts` contains completed History only, user notes, readable exercise identity, completed raw set facts, and an optional sanitized Program relationship.
- `bodyweight` contains chronological pounds entries with their measurement timestamps.
- `goals` contains the human overview, target/status fields, attainment, and the current meaningful recommendation. Bounded engine traces and evidence-selection internals are omitted.
- `routines` contains only saved/custom routine prescriptions from the profile state.
- `program` contains Program records, immutable Program versions, immutable Routine versions, slots, cadence, review settings, Goal links, lineage, and current sequence position.
- `preferences` contains timer sound/vibration, saved exercise cues/rest choices, and current presentation choices.

Relationship identifiers are regenerated as export-local references such as `workout-1`, `goal-1`, `routine-version-2`, and `program-version-1`. Program transport envelopes and stored ownership IDs never cross the export boundary.

## Explicit exclusions

The v1 export does not contain:

- active workouts or timer runtime state;
- PR caches or other recomputable analytics output;
- cloud queues, revisions, catalogs, fingerprints, idempotency keys, tombstones, reconciliation journals, or diagnostics;
- Auth, Supabase, cloud-account, cloud-profile, managed-membership, or local profile ownership IDs;
- raw `programOrigin`, Program transport envelopes, or Program portability metadata;
- programming-engine application/decision traces; or
- onboarding product machinery.

Unknown extra schema-v5 fields are not copied opportunistically. A future user-meaningful domain requires an explicit versioned export decision.

## Determinism and empty state

For a fixed normalized profile state and fixed `exportedAt`, CSV and JSON bytes are deterministic. JSON key construction and list ordering are explicit, JSON is two-space formatted, and both files end with a newline.

An empty profile produces the full CSV header with zero rows and valid empty JSON sections. Empty domains never block export.
