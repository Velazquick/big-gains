# Program Foundation v1

- Status: **Proposed documentation-only normative contract**
- Contract version: **1.0.0-draft**
- Production baseline: `main` at `13f127e7ddd1df3ff9a706dc1e65324f13ebba1a`
- Release marker: `v86-boot-render-profile-isolation`
- Program-1A cache marker: `v87-program-1a-canonical-routine-capture`
- Program-1B cache marker: `v89-program-1b-deterministic-analyzer`
- Program Setup UX v2 / Plan bridge cache marker: `v90-program-setup-ux-v2-plan-bridge`
- Plan navigation / History List|Calendar cache marker: `v91-plan-nav-history-list-calendar`
- PE-1A proposal/review cache marker: `v92-pe-1a-volume-neutral-exposure-redistribution` (implementation candidate; not deployed)
- PE-1B Program-origin cache marker: `v93-pe-1b-program-origin-provenance` (implementation candidate; not deployed)
- PE-1C atomic application cache marker: `v94-pe-1c-atomic-proposal-application` (implementation candidate; not deployed)
- Runtime status: **Program capture/analysis, Plan presentation, PE-1A proposal review, PE-1B Program-derived Train provenance, and PE-1C explicit atomic successor application implemented locally**

This document defines the bounded Program layer between Goals and Train. It builds on [ARCHITECTURE.md](ARCHITECTURE.md), [GOALS_V1_SPEC.md](GOALS_V1_SPEC.md), [EXERCISE_KNOWLEDGE_FOUNDATION.md](EXERCISE_KNOWLEDGE_FOUNDATION.md), and [SYNC_SEMANTICS.md](SYNC_SEMANTICS.md). The approved documentation-only [Programming Engine v1 contract](PROGRAMMING_ENGINE_V1.md) specializes the future boundary in Section 8 without changing this Foundation's ownership/version invariants. The normative [Program portability synchronization v1 contract](PROGRAM_PORTABILITY_SYNC_V1.md) defines the RC cloud/recovery target while preserving these meanings. It authorizes no runtime code, storage migration, Supabase change, release, or deployment.

Implementation tracking: PF1-0.4 records the boundary of the original documentation unit. The separately authorized Program-1A interval implements explicit canonical Routine review/capture and Program version pinning in profile-scoped schema-v5 local state. Program-1B adds a pure recomputed analyzer over an exact Program version, pinned Routine versions, EKF metadata, linked Goals, and optional explicit sequence progress. Release v90 moves setup and Analyzer presentation into a substantive Plan/Active Program experience and adds read-only Today and Goal cross-links. Release v91 promotes Plan into primary navigation. Candidate v92 adds the pure PE-1A proposal and review display. Candidate v93 adds the explicit next-Program-session materialization path and immutable workout origin required for deterministic cycle evidence. Candidate v94 adds explicit, stale-guarded, idempotent PE-1C application through one rollback-verified schema-v5 local transaction. Approval preserves the rolling position; an exact frozen predecessor-origin workout advances the successor only when that same workout completes successfully. It does not remove manual Train entry or add a schema bump, Supabase table/RLS/migration, cloud Program entity, History rewrite, automatic change, or deployment.

## 0. Contract language and precedence

**PF1-0.1 — Normative terms.** **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. Other examples and explanations are informative.

**PF1-0.2 — Stable requirement IDs.** `PF1-*` IDs are stable citations. Existing IDs MUST NOT be renumbered; a changed requirement receives a new ID and leaves the superseded meaning documented.

**PF1-0.3 — Safety precedence.** Completed workout facts, active-session stability, EKF meaning, profile ownership, and explicit user authority take precedence over producing or applying a Program change.

**PF1-0.4 — Documentation-only boundary.** This unit MUST change Markdown only. Schema v5, local state, workout-card guidance, Goals progression, Supabase, RLS, synchronization, routines, active sessions, completed history, production data, and deployment MUST remain unchanged.

## 1. Layer model

**PF1-1.1 — Goal is destination.** A Goal answers what outcome matters, including an exact strength target, priority, and optional horizon. It MUST NOT own a Program calendar, routine prescription, active session, or performed set.

**PF1-1.2 — Program is path structure.** A Program answers how training is organized across multiple planned sessions: ordered cycle, cadence, Routine-version selection, priority links, and versioned planning-policy references.

**PF1-1.3 — Routine is session prescription.** A Routine answers what one reusable session contains: ordered exercises and prescribed working-set and repetition targets. It MUST NOT own completed performance.

**PF1-1.4 — Programming Engine is a future proposer.** The Programming Engine MAY later use Goals, Program structure, constraints, and evidence to propose a new Program version. It is decision logic, not a source of performed facts, and is not implemented here.

**PF1-1.5 — Train is execution.** Train materializes today's selected prescription into an editable active-workout snapshot. Once created, that snapshot is independent of later Program, Routine, Goal, or engine changes.

**PF1-1.6 — History and interpretation are separate.** History owns performed workout facts. Progress and Insights derive interpretations. The Strength Knowledge Layer MAY later produce versioned evidence/models for the Programming Engine, but it MUST NOT manufacture or rewrite facts.

**PF1-1.7 — No ownership by implication.** A reference, label, provenance field, or derived metric MUST NOT transfer ownership between layers.

**PF1-1.8 — Split-agnostic Program contract.** Program Foundation MUST model an ordered sequence of session slots, not a hard-coded training split. Push/Pull/Legs, Anterior/Posterior, Upper/Lower, A/B, Full Body A/B/C, powerlifting-style Squat/Bench/Deadlift/secondary sessions, bro splits, and arbitrary user-defined structures MUST use the same Program, slot, Routine-version, cadence, block, Goal-link, authority, and version contracts without schema or engine redesign.

**PF1-1.9 — Labels are metadata.** Session, slot, Routine, and Program labels are human-facing organizational metadata. `Push`, `Posterior`, `Workout A`, and any other label MUST NOT carry implicit biological, exercise-taxonomy, scheduling, or Programming Engine semantics.

**PF1-1.10 — Content supplies meaning.** Structural analysis and future programming logic MUST derive meaning from pinned Routine prescriptions and canonical EKF exercise identity/taxonomy, not primarily from names. An arbitrarily named session MUST remain fully analyzable when its exercise identities and prescriptions are known.

**PF1-1.11 — Explicit analysis layer.** A deterministic Program Analyzer MUST form the future boundary between Program/Routine/EKF source data and the Programming Engine. Calculated structural features are analyzer output; proposed changes are Programming Engine output.

Intended flow:

`Program + pinned Routine versions + EKF -> deterministic Program Analyzer -> derived structural features`

`Goal destination + constraints + derived features + evidence -> Programming Engine proposal -> accepted Program version -> pinned Routine versions -> Train snapshot -> completed History -> Progress/Insights evidence`

## 2. Current production implementation audit

**PF1-2.1 — Routine fact.** `routine-engine.js` exposes immutable coded/profile defaults, then gives `customRoutines[type]` precedence. Stored routines are legacy exercise-ID arrays or structured `{ exerciseId, workingSets, targetReps }` entries.

**PF1-2.2 — Editor fact.** `app.js` edits one named routine type in place inside profile-scoped schema-v5 `customRoutines`. Save affects later routine loads; reset deletes the override and reveals the coded default.

**PF1-2.3 — Train materialization fact.** `workout-session-controller.js` creates a fresh active-workout ID, routine type, start time, ordered exercise snapshots, generated set IDs, prior-performance seed values, and routine prescription metadata. The PE-1B candidate also exposes a contained explicit Program entry that copies one exact pinned Routine version and its origin; existing manual/saved-routine entry remains unchanged.

**PF1-2.4 — Active/completed isolation fact.** The active workout is persisted independently. Completion copies only completed sets into a completed workout, saves it in `state.workouts`, clears the active session, and retains no live Routine pointer. When `programOrigin` exists, completion copies that immutable snapshot exactly.

**PF1-2.5 — Goals fact.** Goals guidance reads exact completed evidence and current routine/session structure. It may prefill a compatible card or offer an explicit one-session override, but does not edit the saved Routine; its deterministic policy stops at today and the next comparable exposure.

**PF1-2.6 — History/Progress fact.** Calendar and History retain performed workout facts. A Program-derived workout may additionally retain validated `programOrigin`; legacy, manual, and retrospective workouts remain valid without it. Progress derives summaries and owns neither Routine nor Program structure.

**PF1-2.7 — Persistence/scoping fact.** Routines, Goals, exercise preferences, active sessions, and completed workouts are profile-scoped schema-v5 source data. Canonical Program capture now exists inside the local schema-v5 profile and JSON backup, but no Program cloud entity ships in the current runtime. Cloud rows remain scoped by immutable account/profile identity. [Program portability synchronization v1](PROGRAM_PORTABILITY_SYNC_V1.md) defines the future first-class cloud target; it does not change this current-runtime fact.

**PF1-2.8 — Planning gap.** `PROFILE.weekPlan` maps weekdays directly to Routine type strings. It has no stable Program/cycle-slot/Routine-version identity, effective-date boundary, missed-session semantics, block identity, change history, or workout-to-plan provenance.

PE-1B does not reinterpret that weekday path. Only the explicit active-Program action creates Program provenance; weekday/manual/saved-routine and retrospective paths never infer it.

## 3. Jorge reference-program audit

The repository proves the coded default below for managed profile `jorge`. It does not prove Jorge's current production `customRoutines`, exercise preferences, or actual training intent.

### 3.1 Coded weekly schedule

| Day | Coded session | Position | Status |
| --- | --- | ---: | --- |
| Sunday | Rest | 0 | Direct `weekPlan` mapping |
| Monday | Push (`Jorge Push`) | 1 | Scheduled |
| Tuesday | Pull (`Pull — Back + Biceps`) | 2 | Scheduled |
| Wednesday | Legs (`Legs + Core`) | 3 | Scheduled |
| Thursday | Push (`Jorge Push`) | 4 | Same Routine type as Monday |
| Friday | Pull (`Pull — Back + Biceps`) | 5 | Same Routine type as Tuesday |
| Saturday | Legs (`Legs + Core`) | 6 | Same Routine type as Wednesday |

**PF1-3.1 — Represented composition.** The coded reference is a calendar-anchored Push/Pull/Legs sequence repeated twice weekly: six training slots composed from three reusable Routine types, not six independently versioned sessions.

### 3.2 Coded scheduled routines

Every exercise defaults to three working sets and no explicit rep target. A structured `customRoutines` entry can replace those values at runtime, but no real Jorge custom-routine payload is in the repository.

| Routine | Order | Exercise | Sets | Target reps | Coded frequency |
| --- | ---: | --- | ---: | --- | ---: |
| Push | 1 | Seated Machine Chest Press | 3 | Unspecified | 2/week |
| Push | 2 | Incline Iso Machine Press | 3 | Unspecified | 2/week |
| Push | 3 | Iso Machine Shoulder Press | 3 | Unspecified | 2/week |
| Push | 4 | Seated Pec Deck | 3 | Unspecified | 2/week |
| Push | 5 | Triceps Pushdown | 3 | Unspecified | 2/week |
| Push | 6 | Overhead Triceps Extension | 3 | Unspecified | 2/week |
| Pull | 1 | Lat Pulldown | 3 | Unspecified | 2/week |
| Pull | 2 | Seated Cable Row | 3 | Unspecified | 2/week |
| Pull | 3 | Chest-Supported Row | 3 | Unspecified | 2/week |
| Pull | 4 | Reverse Pec Deck | 3 | Unspecified | 2/week |
| Pull | 5 | Dumbbell Curl | 3 | Unspecified | 2/week |
| Pull | 6 | Hammer Curl | 3 | Unspecified | 2/week |
| Legs | 1 | Leg Press | 3 | Unspecified | 2/week |
| Legs | 2 | Leg Extension | 3 | Unspecified | 2/week |
| Legs | 3 | Seated Leg Curl | 3 | Unspecified | 2/week |
| Legs | 4 | Romanian Deadlift | 3 | Unspecified | 2/week |
| Legs | 5 | Standing Calf Raise | 3 | Unspecified | 2/week |
| Legs | 6 | Cable Crunch | 3 | Unspecified | 2/week |
| Legs | 7 | Hanging Knee Raise | 3 | Unspecified | 2/week |

**PF1-3.2 — Frequency limit.** `2/week` is schedule math, not a recommendation or proof of completed frequency. It is derivable only while the weekday plan and resolved Routine membership remain unchanged.

**PF1-3.3 — Warm-up handling.** Warm-ups are not in the Routine prescription. At Train creation the session builder adds one warm-up for `load_reps` and `assistance_reps` exercises. With prior work it seeds about 60% of the prior first working load rounded to 5 lb and 10 reps; without prior work it seeds zero load and 10 reps. Hanging Knee Raise uses `reps_only` and receives none.

**PF1-3.4 — Rest handling.** Default rest is 150 seconds. A profile-scoped exercise preference, then an active-exercise override, can replace it. Rest is not currently a Routine- or Program-level prescription.

### 3.3 Coherence and automation hazards

| Finding | Evidence | Program/engine risk |
| --- | --- | --- |
| Real intent absent | Production `customRoutines` are user data, not repository data | Coded defaults cannot be declared canonical without confirmation/export |
| Same template used twice | Mon/Thu, Tue/Fri, Wed/Sat share one type | A change intended for one exposure would affect both |
| No explicit rep targets | Jorge defaults resolve to blank `targetReps` | Planning cannot distinguish deliberate targets from fallback behavior |
| No immutable Routine versions | Custom save replaces the named value | A Program cannot prove which prescription a slot meant |
| No Program/cycle identity | Weekdays point to strings | Missed days, rolling order, dates, and replacements are ambiguous |
| Library overlap | Full Body reuses five scheduled exercises; Core reuses Cable Crunch/Hanging Knee Raise | Treating all Library routines as Program slots double-counts frequency |
| Unscheduled templates | Core, Full Body, Cardio, Other are absent from Jorge's week | They are selectable templates, not proven Program slots |
| Retrospective preload | Calendar resolves the selected date's current weekday Routine | A later plan edit may change a past-date draft template without provenance |
| Rest is external | Rest lives in exercise preferences/active exercise | Engine-authored recovery changes lack an explicit prescription owner |
| History has only type | Workouts lack Program/Routine version provenance | Adherence to a version cannot be reconstructed reliably |

There are no duplicate identities inside one scheduled Jorge Routine; the catalog supplies one canonical identity per movement. The duplication above is membership reuse across templates, not duplicate EKF definitions.

The coded scheduled Push/Pull/Legs templates contain no conflicting set/rep prescriptions: each resolves to three working sets and an unspecified rep target. Real custom prescriptions cannot be audited from repository source. No scheduled Jorge session looks like a test artifact; `Other` is an intentional blank-workout fallback, while Core, Full Body, and Cardio are ordinary unscheduled Library templates. Test fixtures are not treated as user intent.

The existing managed/independent state paths show no known cross-profile Routine ownership defect: custom Routines are normalized and synchronized inside the bound profile. The missing safety property is Program/Routine version identity, not evidence that profile isolation is currently broken.

**PF1-3.5 — Audit conclusion.** Jorge's approved reference topology is preferred Monday-through-Saturday P/P/L/P/P/L placement with authoritative rolling P/P/L/P/P/L advancement, the same Push/Pull/Legs-Core Routine versions repeated twice per cycle, and defined blocks followed by review. Repository-coded defaults still cannot be declared his canonical live prescriptions while production custom Routines may differ.

### 3.4 User-approved Jorge topology

Jorge's intended placement is Monday Push, Tuesday Pull, Wednesday Legs/Core, Thursday Push, Friday Pull, and Saturday Legs/Core. Those weekdays are preferred anchors, not authoritative advancement rules. The actual Program state is the rolling sequence:

`Push -> Pull -> Legs/Core -> Push -> Pull -> Legs/Core -> repeat`

If a planned day is missed, the next completed session remains the next uncompleted slot in sequence. The Program does not skip, relabel, or reassign that slot solely because the weekday changed.

**PF1-3.6 — Confirmed cadence.** Jorge Program v1 MUST use a rolling ordered six-slot cycle. Monday-through-Saturday placement MUST be represented only as optional preferred calendar anchors.

**PF1-3.7 — Confirmed repeated Routines.** The two Push slots MUST pin the same approved Push Routine version, the two Pull slots MUST pin the same approved Pull Routine version, and the two Legs/Core slots MUST pin the same approved Legs/Core Routine version. Program v1 MUST NOT invent A/B variants.

**PF1-3.8 — A/B is a future change.** A future Programming Engine MAY propose A/B variations as versioned Routine and Program successors, but no A/B distinction is part of Jorge's current approved topology.

**PF1-3.9 — Defined blocks with review.** Jorge's Program MUST support defined training blocks followed by review. Foundation does not select his initial block length; that is part of the canonical Program review still to occur.

**PF1-3.10 — Canonical prescription remains unresolved.** Repository-coded defaults remain audit evidence only. They MUST NOT be declared Jorge's canonical live Program Routines unless repository evidence proves they match production custom Routines or Jorge explicitly approves them.

## 4. Program v1 identity and data contract

This is a conceptual domain contract, not approval of a storage shape or migration.

**PF1-4.1 — Stable Program identity.** A Program MUST have a stable opaque `programId` independent of name, schedule, current version, dates, Goal links, and Routine names.

**PF1-4.2 — Immutable ownership.** A Program MUST carry immutable `accountId` and `profileId` ownership compatible with the existing boundary. Cross-profile references MUST fail closed.

**PF1-4.3 — Program lifecycle.** A Program MUST distinguish `draft`, `active`, `completed`, and `archived`. At most one Program MAY be active per profile; replacement supersedes it for future selection without deletion.

**PF1-4.4 — Immutable Program versions.** Every accepted structural change MUST create a new immutable `programVersionId` with monotonic version number, creation time, author kind, predecessor, and version note. Versions MUST NOT be edited in place.

**PF1-4.5 — Ordered cycle.** A Program version MUST contain ordered stable cycle-slot IDs. Each slot identifies sequence, pinned Routine version, optional weekday anchor, and optional label. Reuse of one Routine version in multiple slots MUST be explicit.

**PF1-4.6 — Schedule mode.** A version MUST declare `calendar_week` or `rolling_cycle`. Catch-up, skip, and advancement behavior MUST NOT be inferred from labels.

**PF1-4.7 — Duration.** A Program MUST declare `rolling` or `finite`, a start date, and optional end date. A finite Program requires an end condition; rolling MUST NOT imply a promised completion date.

**PF1-4.8 — Pinned references.** A slot MUST reference immutable `routineVersionId`, not a mutable name. Display MAY resolve stable Routine identity/name, but executable prescription comes from the pinned version.

**PF1-4.9 — Program-owned fields.** Program owns cycle order, slot cadence/anchors, Routine-version selection, duration, activation/effective boundary, priority Goal links, and versioned frequency/volume/intensity policy references. It MUST NOT duplicate performed sets.

**PF1-4.10 — Routine-owned fields.** A Routine version owns ordered exercise identities and reusable session prescriptions, including working-set count and rep target/range. Future explicit rest or warm-up prescriptions belong to Routine unless a separate policy contract says otherwise.

**PF1-4.11 — Policy references.** Program or Routine versions MAY hold versioned progression-policy references and resolved configuration. These are planning input, not completed results, and do not overwrite the Goals next-exposure trace.

**PF1-4.12 — Fact exclusion.** Actual load, reps, completed/skipped sets, notes, observations, timestamps, duration, and PR outcomes MUST live in active/completed workouts, never Program or Routine versions.

**PF1-4.13 — Generic Program composition.** Every Program version MUST express the same generic elements: ordered session slots; an exact pinned Routine version per slot; cadence policy; optional preferred calendar anchors; block-boundary/review policy; Goal/priority links; programming-authority state; and version/effective-boundary metadata.

**PF1-4.14 — Sequence authority.** In `rolling_cycle` mode, current sequence position is authoritative. Preferred calendar anchors MUST NOT advance, skip, or reinterpret the sequence.

**PF1-4.15 — Optional anchors.** A preferred calendar anchor MAY aid organization, display, reminders, and planning. It MUST remain nullable metadata and MUST NOT be required for an arbitrary Program topology.

**PF1-4.16 — Cadence independence.** A cadence policy MUST define how a Program advances independently of slot labels. A missed preferred date MUST be resolved by the cadence policy rather than inferred from weekday or Routine name.

**PF1-4.17 — Block boundary policy.** A Program version MUST support a review boundary expressed by a supported deterministic condition, including N weeks, N completed cycles, or an explicit end date. Foundation MUST NOT hard-code one universal block length.

**PF1-4.18 — Block review behavior.** Reaching a block boundary MUST trigger review or an explicit continuation/successor decision. It MUST NOT silently authorize an engine rewrite, invalidate completed sessions, or require the Program identity to change.

**PF1-4.19 — Authority state.** A Program version MUST carry an explicit Programming Engine authority state compatible with `off`, `review`, and a reserved future `auto` value. V1 runtime implementation, when authorized separately, MUST reject authority above `review`.

**PF1-4.20 — Version-effective metadata.** A Program version MUST identify its predecessor and future effective boundary so topology, pinned-Routine, cadence, block, Goal-link, or authority changes cannot be mistaken for edits to already-materialized sessions.

### 4.1 Conceptual shape

```json
{
  "programId": "opaque-stable-id",
  "accountId": "immutable-owner",
  "profileId": "immutable-profile",
  "name": "Jorge PPL",
  "status": "active",
  "currentVersionId": "program-version-id",
  "version": {
    "programVersionId": "program-version-id",
    "versionNumber": 1,
    "predecessorVersionId": null,
    "cadencePolicy": "rolling_cycle",
    "durationMode": "rolling",
    "startsOn": "YYYY-MM-DD",
    "endsOn": null,
    "blockReviewPolicy": {
      "boundaryKind": "completed_cycles",
      "boundaryValue": "N"
    },
    "programmingAuthority": "review",
    "slots": [
      {
        "slotId": "stable-slot-id",
        "sequence": 1,
        "label": "user-facing label only",
        "preferredCalendarAnchor": { "weekday": 1 },
        "routineId": "stable-routine-id",
        "routineVersionId": "immutable-routine-version-id"
      }
    ],
    "priorityGoalIds": [],
    "policyRefs": [],
    "createdAt": "ISO-8601",
    "createdBy": "user",
    "versionNote": "Initial confirmed program"
  }
}
```

## 5. Program versus Routine authority

**PF1-5.1 — Stable Routine identity.** A Routine MUST have stable `routineId`; each accepted prescription revision MUST create immutable `routineVersionId` and retain its predecessor.

**PF1-5.2 — No live mutable reference.** Program v1 SHOULD pin Routine versions. A mutable live reference is rejected because it would silently change multiple slots and erase an accepted Program version's meaning.

**PF1-5.3 — Editing an unreferenced Routine.** Editing creates a new Routine version but needs no Program version when no active/draft Program references it.

**PF1-5.4 — Editing a referenced Routine.** Editing MUST show every affected slot, create a new Routine version, and create a draft Program version that explicitly replaces selected references. Saving Routine alone MUST NOT mutate active Program.

**PF1-5.5 — Shared-slot clarity.** When one Routine version appears in multiple slots, the user MUST choose all or selected occurrences. Distinct prescriptions require distinct pinned versions even with similar labels.

**PF1-5.6 — Future inheritance.** Only sessions materialized after a new Program version's effective boundary inherit it. Existing active workouts retain snapshots.

**PF1-5.7 — Active protection.** Train MUST copy resolved prescription and future provenance when creating the active workout. It MUST NOT query a changed Program/Routine to rewrite that workout.

**PF1-5.8 — History protection.** Completion saves the performed snapshot. Program/Routine edit, replacement, archival, rollback, or proposal MUST NOT rewrite completed workouts or derived evidence.

**PF1-5.9 — Pinning is mandatory.** Superseding the weaker recommendation in PF1-5.2, every executable Program slot MUST pin an exact immutable Routine version. Editing a Routine creates a successor Routine version; selecting it for an active Program requires a successor Program version effective only for future, unmaterialized sessions.

**PF1-5.10 — Layered rest ownership.** When rest is resolved for a prescribed exercise, precedence MUST be: explicit Routine-version rest prescription; otherwise the profile-scoped exercise rest preference; otherwise the global 150-second default. Program MUST NOT silently override this ordering.

**PF1-5.11 — Rest snapshot.** Train MUST snapshot the resolved rest target into the created active session/exercise. Later Routine edits, exercise-preference edits, Program changes, or default changes MUST NOT silently change that active target mid-session; an explicit active-session user override remains local to that session unless separately saved as a preference or successor prescription.

**PF1-5.13 — Program-origin snapshot.** Program-derived materialization MUST record one namespaced `big-gains.program-origin.v1` object containing exact account/profile, Program/Program-version, Routine/Routine-version, slot ID, zero-based slot index, one-based cycle number, and materialization time. It MUST contain no mutable analysis values or natural-language identity.

**PF1-5.14 — Completion advancement.** Materialization reserves and snapshots the current `nextSlotIndex` without advancing it. Successful completion advances exactly once under `advanceOn: completed_session`; failed save, discard, resume, reload, repeated start, elapsed weekdays, and preferred calendar anchors do not advance it.

**PF1-5.15 — Completed-cycle proof.** A completed cycle is derived only when completed compatible origin-bearing History covers every pinned slot of the exact Program version for one cycle number. A merely materialized, abandoned, partial, deleted, legacy, or cross-version sequence does not prove a cycle.

**PF1-5.16 — No provenance backfill.** Existing or retrospectively created workouts without explicit Program origin MUST remain unproven. History editing preserves an existing origin and MUST NOT fabricate or relink it from labels, weekdays, exercise lists, or naming conventions.

**PF1-5.12 — Rest implementation boundary.** PF1-5.10 and PF1-5.11 define ownership for later implementation only. Foundation MUST NOT alter the current timer, preference, active-session, or persistence behavior.

## 6. Lifecycle and change semantics

**PF1-6.1 — Draft before activation.** New or changed Program versions MUST be reviewable drafts. Drafts have no Train authority.

**PF1-6.2 — Effective boundary.** Activation MUST record a boundary no earlier than the next unmaterialized session. It MUST NOT splice changes into active Train.

**PF1-6.3 — Replacement.** Replacing an active Program creates/activates a separate identity/version and completes or archives the prior Program for future selection. It MUST NOT delete prior versions.

**PF1-6.4 — Archival.** Archival removes ordinary active selection while retaining identity, versions, notes, Goal links, and proposal history. Archived Programs MUST NOT materialize sessions.

**PF1-6.5 — User overrides.** Users MAY edit active Train freely. A one-session override affects only that workout unless the user separately accepts a Routine/Program change.

**PF1-6.6 — Reviewable diff.** Structural changes MUST show base version, changed slots/routines/policies, effective boundary, author, and reason before acceptance.

**PF1-6.7 — Rollback.** Rollback MUST create a successor Program version whose future structure matches a selected prior version. It MUST NOT mutate old state or undo facts.

**PF1-6.8 — Provenance without dependence.** Future workouts MAY retain `programId`, `programVersionId`, `cycleSlotId`, `routineId`, and `routineVersionId`. Legacy workouts without them remain valid and MUST NOT be backfilled by guesswork.

**PF1-6.9 — Retrospective protection.** Past-workout logging MUST save what the user reports. A planned template MUST identify its Program version/date rule and allow correction; plan data never becomes fact automatically.

**PF1-6.10 — Block continuity.** A block is a versioned planning/review interval within a Program, not a performed-workout fact. Beginning a successor block MAY retain the same Program identity while creating the Program/Routine successors required by accepted changes.

**PF1-6.11 — Multiple boundary forms.** Week-count, completed-cycle-count, and explicit-date boundaries MUST share one lifecycle contract. Calendar time and completed training are distinct inputs; an implementation MUST NOT pretend they are equivalent when missed sessions occur.

**PF1-6.12 — Review is not auto-acceptance.** A block review MAY conclude with no change, continued current structure, or an accepted successor. Merely reaching the boundary MUST NOT apply a proposal.

## 7. Goals interaction

**PF1-7.1 — Goal input.** An active Goal MAY expose destination, exercise identity, priority, optional horizon, attainment, guidance authorization, and evidence references to planning.

**PF1-7.2 — No direct mutation.** Goals MUST NOT create, activate, edit, reorder, or archive a Program/Routine. A Goal change may prompt review but cannot apply it.

**PF1-7.3 — Priority is not prescription.** A 250 lb bench Goal may mark bench priority; it does not determine frequency, sets, reps, intensity block, substitution, or deload.

**PF1-7.4 — Program owns organization.** Program and pinned Routine versions decide where priority work appears and how sessions are structured, subject to user acceptance.

**PF1-7.5 — Current progression remains.** The implemented `BigGainsGoalsProgression` policy continues to resolve today's local step against current session/Routine structure. Under the canonical [Programming bounded-domain doctrine](ARCHITECTURE.md#programming-bounded-domain), that implementation is conceptually the Exposure Progression Policy; Goal supplies intent and guidance authorization but does not own prescription logic. This is adopt-on-touch naming, not a runtime change.

**PF1-7.6 — Conflict fails closed.** If Goal guidance and pinned Routine conflict, existing routine/Train behavior remains authoritative. Foundation MUST NOT silently edit either source.

**PF1-7.7 — Goal portability.** Goal identity and lifecycle MUST attach to an exact exercise/strength outcome, such as `Bench Press -> 250 lb`, not to Program, slot, Routine, weekday, or session label.

**PF1-7.8 — Topology changes preserve Goals.** Changing from PPL to Upper/Lower, Anterior/Posterior, A/B, or any other topology MUST NOT recreate, relabel, complete, or invalidate an otherwise compatible Goal. The accepted successor Program and pinned Routines decide where the goal exercise appears.

**PF1-7.9 — Placement is planning.** A goal-exercise placement or frequency change is a versioned Program/Routine planning decision. It MUST NOT mutate Goal identity or completed evidence.

## 8. Future Program Analyzer and Programming Engine extension boundary

### 8.1 Deterministic Program Analyzer

**PF1-8.10 — Analyzer inputs.** The Program Analyzer MUST consume an exact Program version, all pinned Routine versions, canonical EKF exercise identities and available taxonomies, cadence data, and relevant Goal exercise identities. It MUST NOT infer Program meaning from slot or Routine labels.

**PF1-8.11 — Deterministic calculation.** Analyzer output MUST be reproducible structural calculation, not LLM inference. Identical versioned inputs and analyzer version MUST produce identical derived features.

**PF1-8.12 — Exercise exposure.** The analyzer SHOULD derive exact exercise occurrences and working sets per cycle, including repeated use of one Routine version across multiple slots.

**PF1-8.13 — Taxonomy summaries.** Where EKF supports canonical movement, muscle, and exercise-role mappings, the analyzer SHOULD derive exposure and approximate muscle-role volume summaries. It MUST expose taxonomy/model limits and MUST NOT present invented fractional-set precision as observed fact.

**PF1-8.14 — Prescription distribution.** The analyzer SHOULD derive rep-range distribution and other explicitly prescribed structural distributions without treating unspecified prescriptions as known values.

**PF1-8.15 — Placement and spacing.** The analyzer SHOULD derive Goal-lift frequency/placement and recovery spacing in intervening sessions. When cadence dates are deterministically known, it MAY also derive calendar-time spacing and MUST distinguish that estimate from session spacing.

**PF1-8.16 — Redundancy and gaps.** The analyzer SHOULD identify duplicate/redundant exercise exposure and gaps in priority-lift placement using canonical exercise identity and declared taxonomy, not label heuristics.

**PF1-8.17 — Analysis boundary.** Analyzer output is derived, versioned, non-authoritative input to the Programming Engine. It MUST NOT persist a Program change, mutate a Routine, reinterpret History, or claim that a structural feature is a personalized recommendation.

Program-1B implementation: `BigGainsProgramAnalyzer.analyze({ programVersion, routineVersions, catalog, goals?, options? })` returns the immutable `big-gains.program-analysis.v1` result contract. It validates scope, exact version pins, canonical EKF identity, slot order, cadence, prescriptions, anchors, and supported Program metadata before returning any metrics. Available results separate topology, exact exercise exposure, linked-Goal representation, primary/secondary/unknown muscle roles, movement patterns including an unknown bucket, raw normalized rep/rest distributions, rolling and nominal-calendar spacing, factual volume topology, and block context. Malformed structural inputs return typed errors with all metric groups unavailable. The result is recomputed from local source state and is never persisted as Program authority.

**Program Analyzer = deterministic structural facts, not coaching/recommendation.** Program-1B does not classify any exposure as too high, too low, imbalanced, optimal, or otherwise prescriptive; it does not create a proposal or successor version.

### 8.2 Programming Engine proposals

The documentation-only [Programming Engine v1 contract](PROGRAMMING_ENGINE_V1.md) is the normative specialization of this subsection for the first rules-based proposal unit. Where the Foundation lists broader future operation classes, the PE v1 allowlist is intentionally narrower; parked Foundation operations remain unauthorized.

**PF1-8.1 — Pure proposal API.** The future engine MUST accept immutable profile-scoped inputs and return a proposal. Analysis MUST NOT persist, activate, or mutate Program, Routine, Goal, workout, or history.

**PF1-8.2 — Versioned inputs.** Input MUST identify engine/policy version, analyzer output/version, base Program version, pinned Routine versions, eligible Goals, constraints, evidence cutoff, and evidence/model versions.

**PF1-8.3 — Evidence boundary.** Evidence MUST reference observed completed facts, deterministic analyzer features, or versioned Strength Knowledge outputs. Missing, stale, ambiguous, or incompatible evidence MUST yield explicit unavailable/no-change, not invented rationale.

**PF1-8.4 — Typed operations.** A proposal MAY contain topology-agnostic typed future operations. Each MUST identify exact versions superseded.

Supported future operation classes MAY include:

- replace the pinned Routine version for a session slot;
- adjust a Routine prescription through a successor Routine version;
- add, remove, or reorder a session slot;
- change session exposure frequency or cycle topology;
- create an A/B variation;
- change rep-range prescription, working-set volume, or rest prescription;
- insert a recovery/deload session or block; or
- begin a successor block.

**PF1-8.5 — Routine-producing operations.** Changes to exercise membership/order, set count, rep target/range, rest prescription, or another explicit session prescription MUST produce proposed Routine versions and a proposed Program version that pins them; no hidden Program-only overrides.

**PF1-8.6 — Explainability.** Every operation MUST carry reason code, plain rationale, evidence refs, policy/model versions, expected planning effect, uncertainty/unavailability, and respected constraints.

**PF1-8.7 — User authority.** Foundation permits proposal and explicit acceptance only. Later auto-apply requires a separate contract, profile opt-in, bounded operation classes, revocation, and the same audit trail.

**PF1-8.8 — Staleness.** Apply MUST compare proposal base versions with current versions. A stale proposal MUST be regenerated or manually rebased, never silently applied.

**PF1-8.9 — Result contract.** Output MUST be `no_change`, `unavailable`, or `proposal`, with deterministic reason codes. A satisfactory explanation without typed result and evidence trace is invalid.

**PF1-8.18 — Topology neutrality.** Engine operations MUST target stable Program, slot, Routine, exercise, Goal, and version identities. There MUST NOT be PPL-specific commands or behavior that require redesign for Anterior/Posterior, Upper/Lower, A/B, or arbitrary labels.

**PF1-8.19 — Common operation safety.** Every proposed or later auto-applied operation MUST be versioned, explainable, future-session effective only, stale-base guarded, user-reviewable, active-session safe, and completed-history safe.

### 8.3 Authority model

**PF1-8.20 — Off.** With authority `off`, no engine proposal is applied. Whether analysis or proposal surfaces are computed, hidden, or unavailable is a product-presentation decision, but `off` grants no mutation authority.

**PF1-8.21 — Review.** With authority `review`, the engine MAY produce deterministic, explainable proposed Program/Routine changes. The user MUST explicitly approve a non-stale proposal before it can affect future sessions.

**PF1-8.22 — V1 maximum.** `review` is the highest authority permitted by a v1 implementation. `auto` is reserved and MUST remain unavailable for selection or execution until a later trust/authority contract is approved.

**PF1-8.23 — Future Auto boundary.** A later `auto` mode MAY apply only an explicit, narrowly bounded allowlist of future-session operations and MUST provide a reason trace plus undo/review through versioned successors. It MUST remain optional and revocable.

**PF1-8.24 — Absolute Auto prohibitions.** Auto MUST NEVER rewrite completed history; mutate an already-created active workout behind the user; silently change account, profile, or identity scope; or perform unconstrained exercise substitutions or block rewrites.

```text
deriveProgramFeatures({
  analyzerVersion,
  baseProgramVersion,
  pinnedRoutineVersions,
  ekfSnapshot,
  cadenceContext,
  goalExerciseIds
}) -> deterministic structural features | unavailable

analyzeProgramProposal({
  contractVersion,
  profileScope,
  baseProgramVersion,
  pinnedRoutineVersions,
  analyzerFeatures,
  activeGoals,
  userConstraints,
  completedEvidenceRefs,
  strengthKnowledgeSnapshot,
  evidenceCutoff
}) -> no_change | unavailable | proposal

applyAcceptedProposal({ proposalId, expectedBaseVersionIds, acceptedBy, effectiveBoundary })
  -> new immutable Routine version(s) + new immutable Program version
```

Apply is a separate user-authorized transaction, not an analysis side effect.

## 9. Program Foundation UI concept

**PF1-9.1 — Overview.** The minimum future surface SHOULD show active name/status, dates, schedule mode, current version, next slot, priority lifts with linked Goals, and concise version note.

**PF1-9.2 — Schedule.** One flat weekly/cycle view SHOULD show ordered session cards with Routine/version, major exercises, set/rep summary, and next/planned state; avoid nested settings.

**PF1-9.3 — Session detail.** A card MAY open Routine-version detail with ordered prescription/provenance. Editing MUST follow PF1-5.4 and PF1-5.5.

**PF1-9.4 — Change review.** A compact history SHOULD show Program versions/proposal diffs, proposer, reasons, acceptance/rejection, effective boundary, and rollback.

**PF1-9.5 — Phase display.** A block/phase label MAY appear only when supported by accepted versioned policy. V1 MUST NOT invent phase semantics to populate UI.

**PF1-9.6 — Authority control.** A future Program card/detail surface MAY expose the `off`/`review`/future-`auto` authority control directly. It MUST show the current authority and consequences clearly; v1 MUST offer no setting above `review`.

**PF1-9.7 — Sequence and anchors.** A rolling Program surface MUST distinguish authoritative next sequence position from preferred weekday placement so a missed day does not appear to skip or invalidate a session.

**PF1-9.8 — Block review.** The surface SHOULD show the active block boundary, progress toward it using the declared boundary kind, and the pending/completed review state without implying that review automatically changes the Program.

Implementation tracking: v90 implements PF1-9.1–PF1-9.3 and PF1-9.6–PF1-9.8 as presentation over existing Program-1A/1B data. The Active Program detail shows version/status, a rolling sequence with preferred weekday language, approved Routine drill-down, linked Goals, block boundary, authority, version note/effective boundary, analysis highlights, and the full Analyzer. PE-1C adds the latest approved proposal diff and deterministic application trace on the active successor surface. A broader multi-version archive/rollback UI remains deferred.

## 10. Safety, non-scope, and acceptance boundary

**PF1-10.1 — No history mutation.** Program work MUST NOT rewrite, normalize, merge, delete, or backfill completed workouts, exercises, sets, notes, timestamps, PR keys, retrospective identity, or derived evidence.

**PF1-10.2 — No current-session mutation.** Program/engine changes MUST NOT silently change active workout, sets, Goal guidance snapshot, notes, rest deadline, or timer state.

**PF1-10.3 — No infrastructure authorization.** This contract authorizes no schema v6, local-storage key, Supabase table/column, RLS policy, sync entity, migration, queue change, production-data access, or deployment.

**PF1-10.4 — No engine implementation.** There is no long-horizon algorithm, block generator, optimizer, automatic deload, substitution engine, or Program persistence here.

**PF1-10.5 — No personalized response model.** There is no Strength Knowledge response fitting, new e1RM model, readiness/fatigue diagnosis, completion probability, or claim of optimality.

**PF1-10.6 — Excluded domains.** RIR/RPE, velocity, cardio/endurance planning, rehabilitation, nutrition, social/feed, and native-app changes are outside v1.

**PF1-10.7 — Existing behavior frozen.** Workout guidance, Goals progression, routine editor, warm-up, rest/timer, schema v5, profile isolation, RLS, sync, History, Progress, and production data remain unchanged.

## 11. Acceptance criteria for a later implementation

**PF1-11.1 — Identity tests.** Test stable Program/Routine identities, immutable monotonic versions, exact profile isolation, single-active semantics, and stale-base rejection.

**PF1-11.2 — Authority tests.** Prove Routine edits create versions, shared slots require scope choice, drafts lack Train authority, and accepted changes affect only later sessions.

**PF1-11.3 — Protection tests.** Prove active/completed fact stability across edits, replacement, archival, rejection, activation, and rollback.

**PF1-11.4 — Proposal tests.** Cover deterministic typed diffs, evidence/reason trace, unavailable/no-change, rejection, acceptance, stale proposals, and rollback as a new version.

**PF1-11.5 — Compatibility tests.** Legacy workouts without provenance, schema-v5 routines/Goals, backups, offline Train, managed/independent profiles, retrospective logging, History, Progress, and sync safety remain compatible.

**PF1-11.6 — Split-agnostic tests.** Prove the same Program contract handles PPL, Anterior/Posterior, Upper/Lower, A/B, Full Body A/B/C, powerlifting-style sessions, bro splits, and arbitrary labels without label-derived semantics or schema changes.

**PF1-11.7 — Cadence/block tests.** Prove rolling advancement ignores missed preferred anchors, repeated slots may pin the same Routine version, and week/cycle/date block boundaries produce review without automatic mutation.

**PF1-11.8 — Analyzer tests.** Prove deterministic exercise/set exposure, supported taxonomy summaries, rep-range distribution, Goal-lift placement, spacing, redundancy/gaps, explicit unavailability, and no fake precision from identical versioned inputs.

**PF1-11.9 — Rest tests.** Prove Routine-prescribed rest wins over exercise preference, preference wins over 150 seconds, and the resolved target remains stable after active-session creation.

**PF1-11.10 — Authority tests.** Prove `off` cannot apply, `review` requires explicit approval, v1 rejects `auto`, and all future Auto prohibitions remain invariant under any later authority extension.

## 12. Open user decisions

One consequential user decision remains unresolved and cannot be proven from the repository:

1. **OQ-PF1-1 — Canonical current routines and prescriptions:** Which exact Push, Pull, and Legs/Core Routines represent Jorge's canonical Program v1: production custom Routines, coded defaults, or a newly reviewed rebuild? A reviewed production export or direct prescription review is required for canonical exercise identity, order, working sets, rep targets/ranges, and any explicit rest prescriptions.

The following decisions are resolved: rolling sequence with preferred calendar anchors; repeated shared Push/Pull/Legs-Core Routine versions rather than A/B; defined blocks followed by review with the initial boundary chosen later; Routine > exercise preference > 150-second rest precedence; mandatory immutable Routine-version pinning; and `review` as the maximum v1 Programming Engine authority with `auto` parked for a later optional trust phase.

Until OQ-PF1-1 is answered, the coded Jorge set is an audit reference only and MUST NOT be treated as an approved real Program prescription.

## Appendix A — Repository evidence map

| Concern | Current source |
| --- | --- |
| Managed schedule/defaults | `profiles.js` |
| Routine resolution/prescriptions | `routine-engine.js` |
| Routine editor persistence | `app.js` |
| Active construction/completion | `workout-session-controller.js` |
| Profile schema-v5 normalization | `state-persistence.js` |
| Goals/next-exposure boundary | `goals.js`, `goals-progression.js`, `goals-train-guidance.js` |
| Rest defaults/preferences | `notes.js`, `timer-controller.js`, `app.js` |
| Retrospective preload | `retrospective-workout.js` |
| History interpretation | `analytics.js`, `progress.js`, `app.js` |
| Ownership/sync authority | `account-context.js`, `cloud-shadow.js`, `SYNC_SEMANTICS.md` |
| Program-1A local model/review | `program-model.js`, `program-setup.js`, `program-setup.css` |
| Program-1A normalization/backup | `state-persistence.js` |

## Appendix B — Documentation-unit validation

Complete only when the diff is Markdown-only, `git diff --check` passes, requirement IDs are unique, all local Markdown links resolve, and no runtime/schema/Supabase/RLS/sync/data file changed. This documentation unit may be committed and pushed when explicitly authorized; it MUST NOT open a PR, merge, release, deploy, seed Program data, or begin runtime implementation.
