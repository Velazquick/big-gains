# Big Gains Performance Records v1

- Status: **Normative documentation-first contract**
- Contract version: **1.0.0**
- Baseline: `origin/main` at `8aa4a359061658c695dce4eddfad791cbb078c15`
- Runtime marker at baseline: `v95-mobile-startup-interactivity`
- Local application schema at baseline: **5**

This contract defines Performance Records as a product interpretation of authoritative completed History. It builds on the [Exercise Knowledge Foundation](EXERCISE_KNOWLEDGE_FOUNDATION.md), the completed-history and derived-data rules in [synchronization semantics](SYNC_SEMANTICS.md), and the [Programming bounded-domain doctrine](ARCHITECTURE.md#programming-bounded-domain).

## 0. Language, precedence, and scope

**REC1-0.1 — Normative terms.** The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. Unqualified examples and explanations are informative.

**REC1-0.2 — Stable clause IDs.** `REC1-*` IDs are stable citations. Existing IDs MUST NOT be renumbered; a changed requirement receives a new ID.

**REC1-0.3 — Authority precedence.** Exact completed History, canonical EKF identity, the applicable measurement contract, profile isolation, and explicit unavailability take precedence over producing a record or a user-facing claim.

**REC1-0.4 — Documentation-only boundary.** This slice defines semantics only. It MUST NOT implement detection, persistence, event storage, UI, migration, backfill, schema, synchronization, Supabase, or production-data changes. It MUST NOT change EKF measurement contracts, e1RM eligibility, bodyweight interpretation, Goals behavior, Program behavior, or Programming policy.

## 1. Core model and v1 taxonomy

**REC1-1.1 — Performance Record.** A **Performance Record** is the umbrella product concept for a newly best observed completed performance under one explicit record type and its comparability contract. UI MAY use “PR” as the umbrella abbreviation only when it can identify or explain the specific record type.

**REC1-1.2 — Intentionally narrow v1.** Performance Records v1 defines exactly two record types:

1. **e1RM Record**;
2. **Indicated Load Record**.

A numeric stored field MUST NOT create a record type by implication.

**REC1-1.3 — Record type owns meaning.** Each record type MUST define eligibility, observed value, comparison boundary, ordering, quality/limitations, and presentation meaning. Values from different record types MUST NOT compete as one record.

**REC1-1.4 — Profile scope.** Every Performance Record is scoped to one profile. Records from different profiles or accounts MUST NOT compete or be combined.

## 2. Record Event, Current Record State, and count

**REC1-2.1 — Record Event.** A **Record Event** is one specific completed working set or performance that strictly exceeds the comparable record state immediately before it in historical order. It is an event at that historical moment, not merely the best value currently known.

**REC1-2.2 — Minimum attribution.** A Record Event MUST be attributable to the profile, completed workout identity, canonical exercise identity, record type, source set/performance identity or stable source locator, observed value(s) required by the type, and a timestamp/order sufficient to prove that the value was newly best at that moment. This is a semantic requirement, not a storage schema.

**REC1-2.3 — Current Record State.** **Current Record State** is the best known comparable value for one profile, canonical exercise, and record type after interpreting current authoritative completed History, including accepted edits and deletions. It is derived state and is not interchangeable with a Record Event.

**REC1-2.4 — Sequential events.** Multiple qualifying sets in one workout MAY establish sequential Record Events when each is strictly greater than the state immediately before that set. Multiple exercises and record types MAY independently establish events in the same workout.

**REC1-2.5 — Workout record count.** A workout’s record count means the number of Record Events attributed to that workout under the active contract, not the number of distinct exercises or exercise/type pairs. Therefore two sequential improvements by the same exercise/type count as two events. Existing stored `workout.prs` counts remain historical e1RM-only behavior until a separately authorized implementation changes the active contract; v1 performs no backfill.

**REC1-2.6 — Answerable attribution.** A conforming future implementation MUST be able to answer “what was the PR?” with the record type, exercise, source performance, and observed record value. A vague count or latest state alone is insufficient event attribution.

## 3. e1RM Record

**REC1-3.1 — Existing semantics preserved.** An **e1RM Record** is a strictly higher eligible rounded Epley v1 estimate for the exact canonical exercise under the compatible EKF e1RM basis and comparison scope. It is the Performance Records name for the current runtime PR concept; this contract does not broaden or recalculate it.

**REC1-3.2 — Eligibility.** The source MUST be a completed working set. Warm-ups are excluded. The exercise and set MUST satisfy every EKF-6 eligibility gate, including explicit e1RM permission, whole entered reps from 1 through 12, a finite positive value at the declared e1RM load basis, and known compatible measurement semantics.

**REC1-3.3 — Calculation.** The observed value is:

`round(e1rmLoadValue × (1 + enteredReps / 30))`

The formula is `epley` version 1 and uses only the EKF-declared `entered_load`, `combined_external_load`, or `effective_system_load` basis. Equal rounded values are not new records.

**REC1-3.4 — Comparison key.** Comparable e1RM values MUST share profile, exact canonical exercise identity, relevant measurement/load basis, equipment-comparison scope, formula version, and unit. A schema-v5 legacy PR key MAY remain as an unambiguous compatibility projection; it does not weaken the logical comparison key or authorize a history rewrite.

**REC1-3.5 — Bodyweight behavior.** Eligible bodyweight-plus-external records retain the EKF `full_system` and `effective_system_load` rules exactly. Missing defensible bodyweight-at-performance context makes the estimate unavailable. The estimate and any resulting record MUST remain labeled modeled system-load evidence rather than measured strength.

**REC1-3.6 — Ineligible contexts.** Machine-indicated resistance, assistance, carries, sleds, duration, distance, isometrics, reps-only work, unsupported bodyweight fractions, unknown semantics, and other EKF-ineligible contexts MUST NOT establish an e1RM Record. An Indicated Load Record MUST NOT make an exercise e1RM-eligible.

## 4. Indicated Load Record

**REC1-4.1 — Definition.** An **Indicated Load Record** is the highest exact entered load Big Gains has recorded for one profile and exact canonical exercise under a compatible load-bearing, machine-indicated measurement contract. Its user-facing short form MAY be “Load PR” when the indicated/limited meaning is available to explain.

**REC1-4.2 — Eligibility.** The source MUST be a completed working set. Warm-ups are excluded. The applicable EKF contract MUST use `trackingModel: load_reps` with `resistanceSemantics: machine_indicated`, a known load basis, and a stable user-facing stored load value and unit. Reps, duration, distance, volume, or another numeric field do not become the record value merely because they are present. Machine-indicated load/distance or load/duration performances require a future record-type contract and are not Indicated Load Records in v1.

**REC1-4.3 — Observed value.** The record compares the exact stored/entered machine indication and its declared load basis, not `indicatedLoadVolume`, a multiplied combined load, external force, or e1RM. For example, a `per_side` exercise compares the entered per-side indication as labeled; it does not silently double it.

**REC1-4.4 — Strict improvement.** A source establishes an Indicated Load Record only when its entered indicated load is strictly greater than the prior comparable best. Equal-best is not a new record.

**REC1-4.5 — Compatible comparison.** Comparable values MUST share profile, exact canonical exercise identity, machine-indicated resistance meaning, tracking model, load basis, stored unit, and any available performed equipment/setup context required by EKF. A change in meaning or unit MUST fail closed rather than compete as one record.

**REC1-4.6 — V1 limited comparability.** Schema-v5 completed sets do not generally preserve machine model/instance, gym, pulley ratio, attachment, calibration, or setup provenance. Without that context, v1 can prove only: “the highest indicated/stored load Big Gains has recorded for this exact exercise in this profile under the available measurement context.” The result MUST be classified and presented as a limited comparison.

**REC1-4.7 — Prohibited claims.** An Indicated Load Record MUST NOT be described as true external resistance, calibrated force, cross-machine or cross-gym equivalence, physiological strength equivalence, or valid e1RM evidence. Big Gains MUST NOT normalize cable ratios, cams, leverage, friction, attachments, or stack calibration without a separate measurement/equipment-provenance contract.

## 5. Identity and measurement authority

**REC1-5.1 — Exact canonical boundary.** Exact opaque EKF canonical exercise identity is the default record boundary. Permanent legacy IDs, redirects, aliases, and retrospective `definitionId` values MAY resolve to that identity through EKF compatibility rules; presentation names MUST NOT become comparison identity.

**REC1-5.2 — Variants remain separate.** Family membership, movement similarity, aliases, and `variantOf` relationships MUST NOT merge record histories. Distinct canonical variants MUST NOT cross-contaminate unless a future explicit equivalence contract defines a safe comparison.

**REC1-5.3 — Measurement authority.** Record eligibility and observed-value meaning are governed by the exercise’s EKF measurement contract. The record system MUST NOT reinterpret raw schema-v5 fields independently, infer eligibility from a field name, or add a per-set semantic override.

**REC1-5.4 — Contract evolution.** A future measurement-contract change MUST preserve reproducible historical meaning or declare affected comparisons unavailable. It MUST NOT silently place incompatible historical values into one record state.

## 6. BEST and user-facing language

**REC1-6.1 — BEST is within-workout.** `BEST` means the best eligible/comparable set selected within one workout under the presentation’s declared rule. It does not by itself assert that the set exceeded all prior History.

**REC1-6.2 — BEST is not a Record Event.** A set MAY be `BEST` within its workout without being a Record Event. UI MUST NOT use `BEST` as a synonym for `PR` unless the same set is also a proven Record Event.

**REC1-6.3 — Type-specific presentation.** A PR presentation MUST make its type and observed value discoverable, for example “Bench Press — e1RM PR: …” or “Triceps Pushdown — Load PR: 87.5 lb.” Exact final copy and surfaces are outside this contract.

**REC1-6.4 — Honest qualification.** Machine-indicated record presentation MUST expose its indicated, profile-local, exact-exercise, limited-comparison meaning. Qualification MUST be understandable user language, not only hidden implementation metadata.

## 7. History and retrospective operations

**REC1-7.1 — Authoritative source.** Completed History remains the authoritative performed-fact source. Records are derived interpretations and MUST NOT rewrite History, manufacture missing context, or create guessed performances.

**REC1-7.2 — Normal completion.** Ordinary completed-workout creation evaluates eligible source performances in their stored workout/set order against the record state immediately before each performance under the active contract.

**REC1-7.3 — Edit and delete.** An accepted retrospective edit or delete MUST recompute affected Record Events and Current Record State from current authoritative completed History. Editing or deleting an earlier record-setting workout MAY change later historical event interpretation and current state; derived records are not immutable facts independent of History.

**REC1-7.4 — Retrospective create toggle.** Current retrospective create defaults to evaluation enabled and explicitly permits the user to disable evaluation. When disabled, that create action saves the completed workout normally, attributes no new events during that action, and leaves current record state unchanged at that time.

**REC1-7.5 — Current opt-out limit.** The schema-v5 workout does not persist a durable record-evaluation opt-out. Therefore the current disable choice is action-scoped: a later full History recomputation cannot prove the earlier choice and may reinterpret that workout. V1 MUST NOT claim a durable exclusion that existing data cannot prove. Any durable opt-out representation requires a separate implementation/storage contract.

**REC1-7.6 — Retrospective historical order.** When retrospective evaluation is enabled, event attribution requires interpretation in historical order rather than treating the date of entry as the date of performance. Missing order sufficient to prove a historical event yields unavailable attribution; current state MAY still be derived when its comparison is defensible.

## 8. Progress and Programming boundary

**REC1-8.1 — Evidence, not prescription.** Performance Records are Progress/analysis interpretations of completed evidence. They own no Goal, Program, Routine, Train, Exposure Progression Policy, Structural Adaptation Policy, or proposal-application authority.

**REC1-8.2 — Explicit evidence contracts.** A consumer MAY use a record only through an explicit versioned evidence contract that names the record type, identity, measurement basis, comparability, quality, and required context. The umbrella label “PR” is not sufficient evidence typing.

**REC1-8.3 — No silent Programming use.** An Indicated Load Record MUST NOT become e1RM progression evidence, Goal strength-attainment evidence, Exposure Progression Policy input, Structural Adaptation Policy input, or evidence of physiological adaptation unless a future Programming contract explicitly accepts that record type and its limitations.

**REC1-8.4 — Existing Goals semantics preserved.** Current exact-exercise Goals and their e1RM/target-single evidence rules remain unchanged. This contract does not make machine-indicated exercises eligible for strength Goals or progression.

## 9. Compatibility and implementation boundary

**REC1-9.1 — No rewrite or schema change.** This documentation slice changes no schema. It rewrites no completed workout, set, PR key, count, current `prs` map, backup, snapshot, synchronized payload, Supabase row, or production data.

**REC1-9.2 — Historical behavior remains valid.** Existing runtime “PR” behavior and stored counts remain valid historical e1RM Record behavior under the narrower pre-v1 active contract. V1 does not retroactively relabel machine work as e1RM evidence or invent missing Record Events.

**REC1-9.3 — Future implementation separate.** A future implementation may require derived event representation, deterministic recomputation, or richer attribution, but this contract does not choose a schema or persistence strategy. Implementation requires a separately authorized Explore → Prove → Decide → Build → Verify interval.

**REC1-9.4 — Backfill separate.** Historical Record Event backfill, if desired, requires a separate migration/recomputation contract. It MUST NOT invent missing equipment context, source identity, ordering, measurement meaning, or a retrospective opt-out.

**REC1-9.5 — Synchronization boundary.** Performance Records remain derived values under SS-2.5. They MUST NOT become independent synchronized source entities; adopted schema-v5 source data remains the recomputation authority unless a future versioned synchronization contract explicitly changes that rule.

## 10. Examples (informative)

**REC1-X1 — Bench and Pushdown.** Bench Press at 215 lb × 5 on an e1RM-eligible exact exercise yields rounded Epley `251 lb`. It establishes an e1RM Record only if `251 lb` strictly exceeds the prior comparable rounded e1RM. Triceps Pushdown at 87.5 lb × N uses canonical ID `b5c59616-d4b2-4d93-bd9e-1f0e52e537c6`, legacy ID `triceps-pushdown`, total stack load plus reps, and `machine_indicated` resistance. It cannot establish an e1RM Record, but it may establish an Indicated Load Record if 87.5 lb strictly exceeds the prior comparable exact-exercise/profile indication and the set is otherwise eligible.

**REC1-X2 — Variant isolation.** Rope Pushdown is canonical exercise `5e43ab5e-a78d-4fff-8213-d1a37458d219`. Its values do not compete with Triceps Pushdown records merely because both are related pushdown movements.

**REC1-X3 — Sequential count.** If one eligible exercise has two working sets that raise its record state from 200 to 205 and then 210 in stored order, the workout has two Record Events and a record count of two. A later equal 210 is not another event.

## 11. Parked work

**REC1-11.1 — Equipment provenance.** Optional machine model/instance, gym, attachment, setup, calibration, and configuration provenance for stronger indicated-load comparability is parked.

**REC1-11.2 — Additional record families.** Reps-at-load, repetition, duration, distance, pace, volume, workload, density, and arbitrary “best” records are parked. Each requires its own measurement, comparison, ordering, quality, and presentation contract before implementation.

**REC1-11.3 — Delivery questions.** Historical event backfill strategy, derived-event representation, durable retrospective-evaluation opt-out, exact UI surfaces/copy, and record explanations are parked for separately authorized implementation/product work. None weakens the two v1 record definitions.
