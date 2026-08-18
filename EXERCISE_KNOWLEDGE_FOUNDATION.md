# Big Gains Exercise Knowledge Foundation (EKF)

- Status: **Accepted EKF-0 normative contract**
- Contract version: **1.0.0**
- Baseline: `main` at `6fba6ba6613b8e9319963d7e998b9f2db455fbfb`
- Research basis: *Exercise Knowledge Foundation for Big Gains* (completed deep-research report)

This document defines what Big Gains means by an exercise before EKF implementation begins. It narrows the research architecture to the minimum contract Big Gains needs while preserving the local-first, schema-v5 application described by [ARCHITECTURE.md](ARCHITECTURE.md) and the completed-history and derived-data rules in [SYNC_SEMANTICS.md](SYNC_SEMANTICS.md).

## 0. Contract language and precedence

**EKF-0.1 — Normative terms.** The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative requirements. Unqualified descriptive text is informative.

**EKF-0.2 — Stable clause IDs.** Clause IDs in this document are stable citations. Later specifications, records, implementations, and tests SHOULD cite the clause they implement. Renumbering an existing clause is a breaking documentation change.

**EKF-0.3 — Safety precedence.** Identity preservation, exact entered-fact preservation, completed-history authority, rights hygiene, and explicit unavailability take precedence over catalog convenience or producing a metric.

**EKF-0.4 — EKF-0 boundary.** EKF-0 changes documentation only. It does not change runtime code, stored data, schemas, analytics results, workout cards, source data, or serving infrastructure.

## 1. Scope and non-scope

**EKF-1.1 — Knowledge boundary.** EKF defines canonical exercise identity and stable exercise semantics: classification, relationships, measurement meaning, calculation eligibility, muscle roles, and provenance.

**EKF-1.2 — Prescription boundary.** Programming intent—including routine membership, order, working-set targets, rep targets, RIR, RPE, percentage targets, tempo prescriptions, and progression rules—MUST remain outside the canonical exercise definition. Push/Pull/Legs and related programming tags are classification hints, not prescriptions.

**EKF-1.3 — Performed-fact boundary.** Performed workout facts—including entered values, units, set type, completion state, time, notes, equipment instance, bodyweight context, and any per-set semantic override—MUST remain workout/session data. EKF describes how those facts are interpreted; it MUST NOT own them.

**EKF-1.4 — Analytics boundary.** Analytics interprets performed facts using the EKF release and calculation contract applicable to the calculation. A derived result MUST identify enough semantic and formula version information to reproduce its meaning.

**EKF-1.5 — No personal data.** EKF reference data MUST NOT contain user, profile, account, workout, routine, bodyweight, PR, note, preference, or other personal data.

**EKF-1.6 — UI non-scope.** EKF-0 makes no UI change. The workout-card/input change needed to expose what a load or repetition value means is an EKF-2 dependency under EKF-13.3.

**EKF-1.7 — Implementation non-scope.** Runtime exercise semantics, analytics changes, catalog bulk ingestion, Supabase schema changes, source imports, and third-party media are outside EKF-0.

## 2. Identity and backward compatibility

**EKF-2.1 — Identity owner.** Big Gains owns every canonical exercise identity. A source record, source name, vendor ID, display name, or current Big Gains slug MUST NOT become the authority for canonical identity.

**EKF-2.2 — Opaque permanent IDs.** Every new canonical EKF entity MUST have an opaque, globally unique, immutable ID. The ID MUST NOT be derived from a name, slug, taxonomy value, source ID, or other mutable meaning. The exact encoding is an EKF-1 implementation choice, not a semantic choice.

**EKF-2.3 — Permanent legacy IDs.** Every ID currently exposed by `BigGainsExerciseCatalog` is a permanent `legacyId`. A legacy ID MUST remain resolvable, MUST map to no more than one canonical EKF entity in a release, and MUST never be reassigned to another entity.

**EKF-2.4 — Presentation is not identity.** Canonical name, display name, slug, aliases, capitalization, punctuation, and search-normalized terms are presentation/search metadata. Changing them MUST NOT change the opaque ID. A changed slug that has ever been published MUST be retained as a redirect or legacy identifier.

**EKF-2.5 — Schema-v5 preservation.** Existing schema-v5 completed workouts, active workouts, retrospective exercise-instance IDs, retrospective `definitionId` values, custom-routine strings and `exerciseId` values, PR keys, exercise-preference keys, backups, snapshots, and synchronized payloads MUST continue to resolve without rewriting their historical rows or keys merely because EKF exists.

**EKF-2.6 — Compatibility projection.** Early EKF releases MUST generate the existing `BigGainsExerciseCatalog` compatibility API. That projection MAY continue exposing the legacy slug in its public `id` field while the underlying canonical record uses an opaque EKF ID.

**EKF-2.7 — Resolution order.** Compatibility resolution MUST prefer an exact opaque ID, then an exact permanent legacy ID/redirect. Name and alias matching MAY support search or user selection but MUST NOT silently repair or rewrite persisted identity.

**EKF-2.8 — Merges and deprecations.** Deprecation MUST retain the original entity and all of its identifiers as resolvable. A confirmed merge MUST retain the losing entity as a redirect to the winner and record the decision provenance. A released opaque ID or legacy ID MUST NOT disappear.

**EKF-2.9 — No ambiguous auto-merge.** Exercises that may differ in equipment, resistance path, execution, laterality, load basis, or rep meaning MUST NOT auto-merge. Ambiguity produces separate candidates or a quarantined review state, never an identity rewrite.

**EKF-2.10 — Completed-history authority.** EKF resolution MUST respect the completed-history authority in `SYNC_SEMANTICS.md`. A knowledge release MUST NOT mutate performed facts, manufacture a historical semantic override, or cause a completed workout to be field-merged.

## 3. Canonical taxonomy v1

**EKF-3.1 — Narrow controlled vocabularies.** EKF v1 uses the vocabularies in this section. A canonical record MUST use a listed value or `unknown`/`other` where provided; it MUST NOT invent near-synonyms in published records.

**EKF-3.2 — Modality.** `modality` is one of:

- `resistance` — externally loaded, bodyweight-resisted, assisted, carry, sled, or isometric resistance work;
- `cardio` — primarily cyclic conditioning work;
- `mobility` — primarily mobility/range practice;
- `other` — intentionally outside the preceding categories;
- `unknown` — not yet determined.

Modality describes the activity domain, not a prescription or muscle.

**EKF-3.3 — Programming tags.** `programmingTags` contains zero or more of `push`, `pull`, `legs`, `core`, `full_body`, `cardio`, and `other`. These tags preserve the useful Push/Pull/Legs-style taxonomy while remaining independent from anatomy, movement pattern, and routine membership. Profile-specific routine names MUST NOT become canonical EKF tags.

**EKF-3.4 — Movement patterns.** `movementPatterns` contains one or more of `horizontal_push`, `vertical_push`, `horizontal_pull`, `vertical_pull`, `squat`, `hinge`, `lunge`, `knee_extension`, `knee_flexion`, `hip_extension`, `hip_abduction`, `hip_adduction`, `elbow_flexion`, `elbow_extension`, `shoulder_abduction`, `shoulder_extension`, `scapular_elevation`, `calf_raise`, `trunk_flexion`, `trunk_extension`, `trunk_rotation`, `anti_extension`, `anti_rotation`, `locomotion`, `carry`, `cyclic`, `other`, or `unknown`. Multiple patterns MAY apply.

**EKF-3.5 — Mechanics.** `mechanics` is exactly one of `compound`, `isolation`, `cyclic`, `isometric`, `mixed`, or `unknown`. It describes movement organization and MUST NOT imply e1RM eligibility or muscle-set credit.

**EKF-3.6 — Muscle roles.** A canonical muscle assertion has a stable muscle identifier and role `primary`, `secondary`, or `stabilizer`. At least one `primary` assertion is required for an active resistance exercise unless the record is explicitly `unknown`. Role meaning is governed by Section 7.

**EKF-3.7 — Equipment roles.** An equipment assertion contains an equipment identifier and role `resistance` or `support`. `resistance` identifies equipment that supplies or carries resistance. `support` identifies setup equipment such as a bench, rack, pad, or platform. Equipment is optional only when none is needed or the record is explicitly unknown.

**EKF-3.8 — Family and variant relationships.** `familyId` is an optional stable grouping for meaningfully related exercises. `variantOf` is an optional directed link to a more general canonical exercise. Family membership and variant links aid discovery and analytics grouping; they MUST NOT collapse identity, confer equivalence, or redirect history.

**EKF-3.9 — Laterality.** `laterality` is exactly one of:

- `bilateral` — the sides act together through one coupled resistance;
- `independent_bilateral` — both sides act in the same cycle through independently loaded implements or arms;
- `unilateral` — one side performs an event at a time and a record normally represents both sides unless performed facts say otherwise;
- `alternating` — sides alternate within the recorded set;
- `asymmetric` — side roles differ or the movement is intentionally offset;
- `not_applicable` — sided execution does not apply;
- `unknown` — not yet determined.

**EKF-3.10 — Deferred anatomy detail.** Joint actions, anatomical ontology crosswalks, planes, detailed range of motion, and phase-by-phase kinematics MAY be added later. They are not required in v1 unless a specific field is necessary to disambiguate identity or measurement correctness.

## 4. Measurement contract v1

### 4.1 Tracking and entered facts

**EKF-4.1 — Tracking models.** `trackingModel` is one of `load_reps`, `reps_only`, `assistance_reps`, `duration`, `distance_duration`, `load_duration`, `load_distance`, `distance_only`, or `unknown`. A record MUST declare exactly one. A new model requires a contract revision.

**EKF-4.2 — Entered facts are exact records.** `enteredLoad`, `enteredReps`, `enteredDuration`, and `enteredDistance` mean the numeric values the person entered with their stored units and applicable performed context. These values MUST be preserved separately from every interpreted value.

**EKF-4.3 — No semantic rewrite.** Analytics MUST NOT rewrite stored workout history, replace an entered load with a multiplied load, or alter entered reps to make calculations easier. Derived values are recomputed views, not repaired performed facts.

**EKF-4.4 — Explicit input meaning.** Any future input that captures a load or repetition MUST make its canonical meaning available to the user before completion, such as “lb per dumbbell,” “lb per handle,” “reps per side,” “alternating reps total,” “assistance,” or “added load.” EKF-0 records this dependency but does not change the UI.

### 4.2 Load semantics

**EKF-4.5 — Load vocabulary.** `loadSemantics` is an object with two orthogonal fields so equipment basis is not confused with resistance interpretation:

- `loadBasis` is `total`, `per_hand`, `per_side`, `not_applicable`, or `unknown`. `total` means the entered load is the complete entered load for one event/cycle. `per_hand` means each hand-held implement. `per_side` means each independently loaded machine side or handle; `per_handle` is represented by `per_side` plus the user-facing label “per handle,” not a separate v1 basis.
- `resistanceSemantics` is `external`, `bodyweight_only`, `bodyweight_plus_external`, `assistance`, `machine_indicated`, `not_applicable`, or `unknown`. `external` is defensible external load; `bodyweight_only` has no added load and depends on an approved bodyweight model; `bodyweight_plus_external` adds entered external load to an eligible bodyweight movement; `assistance` reduces effective system resistance; and `machine_indicated` preserves an indication without claiming actual mechanical force or free-weight equivalence.

Tracking models without load use `not_applicable` for both fields. Any required unknown field makes dependent metrics unavailable.

The earlier single-label concepts map without loss: `total_external` is `{ loadBasis: total, resistanceSemantics: external }`; per-hand and per-side external loads pair their basis with `external`; and bodyweight, assistance, and machine indication pair their resistance meaning with the applicable total/per-hand/per-side basis. The two-field form is normative because one label cannot represent a per-side machine indication correctly.

**EKF-4.6 — Per-hand/per-side distinction.** `per_hand` and `per_side` MUST remain separate because they describe different equipment and comparison scopes. Consumers MUST NOT merge their PRs or histories solely because their arithmetic multiplier matches.

**EKF-4.7 — Bodyweight models.** A movement with `resistanceSemantics` of `bodyweight_only`, `bodyweight_plus_external`, or `assistance` that claims `effectiveSystemLoad` MUST declare an approved bodyweight model. V1 supports `full_system` only for curated pull-up/dip-like movements where using bodyweight as system load is an explicit approximation. Movements without an approved model use `unsupported_fraction`; their effective system load and tonnage are unavailable.

**EKF-4.8 — Bodyweight source.** `bodyweightAtPerformance` is a performed/calculation context value, not EKF reference data. It MUST be finite, positive, unit-known, associated with the workout time by a versioned resolver, and accompanied by a source/quality marker. A calculation MUST NOT silently substitute a current/latest bodyweight for an old workout and label the result exact.

**EKF-4.9 — Machine indication.** `resistanceSemantics: machine_indicated` preserves exactly what the machine displayed or what the user loaded while `loadBasis` still declares total/per-side meaning. It MUST NOT be relabeled as actual mechanical force. Comparisons are limited to the same canonical exercise and, when available, the same machine model/instance and setup. A result without that equipment context MUST be labeled limited/approximate or unavailable as required by the metric.

### 4.3 Repetition and execution semantics

**EKF-4.10 — Rep vocabulary.** `repSemantics` is one of:

- `bilateral_cycle` — entered reps count complete cycles in which both sides participate together;
- `reps_per_side` — entered reps apply to each side; when one record represents both sides, rep events equal entered reps times two;
- `total_events` — entered reps are the total number of discrete events, regardless of side;
- `alternating_total` — entered reps are total alternating single-side events, not reps per side;
- `not_applicable` — repetitions do not apply;
- `unknown` — meaning is not defensibly known.

**EKF-4.11 — Alternating dumbbell curl rule.** The canonical alternating dumbbell curl uses `laterality: alternating` and `repSemantics: alternating_total`. Entering 12 means 12 total curl events, nominally six per arm when execution is balanced. A “12 per side” convention requires a distinct canonical definition or an explicit performed semantic override; analytics MUST NOT guess.

**EKF-4.12 — One-record-both-sides rule.** `reps_per_side` assumes one stored set normally summarizes both sides. If only one side was performed, performed data MUST capture that exception before analytics may halve the event count. Absence of such context MUST NOT be inferred from load or exercise name.

### 4.4 Derived quantities

**EKF-4.13 — Names are not interchangeable.** Implementations MUST use distinct concepts rather than overloading `weight`:

- `enteredLoad` — exact gym-entered load;
- `combinedExternalLoad` — external load moved simultaneously in one event after applying the canonical load basis;
- `repEventCount` — the count of single events represented by entered reps;
- `effectiveSystemLoad` — bodyweight-adjusted system resistance for an approved bodyweight model;
- `externalLoadVolume` — external load summed across rep events;
- `effectiveSystemLoadVolume` — effective system load summed across rep events, explicitly marked as modeled;
- `indicatedLoadVolume` — machine-indicated load summed across rep events, not mechanical tonnage;
- `externalLoadDistance` / `indicatedLoadDistance` — load-distance products for carries or sleds.

Persisted schema-v5 `set.weight` remains an entered fact for compatibility. New code MAY adapt it to `enteredLoad` at the interpretation boundary; it MUST NOT treat the old field name as proof of load semantics.

**EKF-4.14 — Event factors.** For a normal two-sided record, `repEventCount` is entered reps for `bilateral_cycle`, `total_events`, or `alternating_total`, and entered reps times two for `reps_per_side`. A valid performed side-count override MAY replace two. Otherwise an unknown side count makes side-expanded metrics unavailable.

**EKF-4.15 — Load-unit factors.** `loadBasis: total` contributes one entered-load unit per event. `per_hand` or `per_side` contributes two units in a `bilateral_cycle` with bilateral/independent-bilateral execution and one unit in a unilateral or alternating event. Any other combination MUST be explicitly modeled or treated as unavailable.

**EKF-4.16 — External-load volume.** Where external semantics are defensible:

`externalLoadVolume = enteredLoad × loadUnitsPerEvent × repEventCount`

The unit is load-unit-repetitions (for example, lb-reps), conventionally displayed as load volume. It is not mechanical work, energy expenditure, or a physiological dose.

**EKF-4.17 — Machine-indicated volume.** `resistanceSemantics: machine_indicated` uses `loadBasis` and the same event arithmetic to produce `indicatedLoadVolume`; `externalLoadVolume` remains unavailable. Consumers MUST label the indicated result and MUST NOT aggregate it into free-weight external tonnage.

**EKF-4.18 — Bodyweight-plus-external.** For `resistanceSemantics: bodyweight_plus_external` with `full_system` and known bodyweight, `effectiveSystemLoad = bodyweightAtPerformance + enteredLoad`. External-load volume MAY still be reported as added-load-only volume. `effectiveSystemLoadVolume` MUST be labeled modeled and requires known bodyweight.

**EKF-4.19 — Assistance.** For `resistanceSemantics: assistance` with `full_system` and known bodyweight, `effectiveSystemLoad = max(bodyweightAtPerformance - enteredLoad, 0)`. Assistance MUST NOT create positive `externalLoadVolume`. If bodyweight is missing, the effective load and effective volume are unavailable even though the entered assistance remains displayable.

**EKF-4.20 — Unknown means unavailable.** Unknown load, rep, side, unit, machine, or bodyweight context that is required by a formula produces an unavailable result. Analytics MUST NOT fill the gap with a universal coefficient, name heuristic, current profile value, or fabricated precision.

## 5. Calculation semantics and golden cases

**EKF-5.1 — Result quality.** Every derived metric is classified as `exact_arithmetic`, `modeled`, `limited_comparison`, or `unavailable`. `exact_arithmetic` means the arithmetic follows explicit entered and canonical semantics; it does not claim biomechanical truth.

**EKF-5.2 — Iso-lateral shoulder press.** An iso-lateral shoulder press defined with `loadBasis: per_side`, `resistanceSemantics: external`, user-labeled “per handle,” `independent_bilateral`, and `bilateral_cycle`, with 120 lb entered, 8 reps, and 3 working sets has:

- stored/displayed gym value: **120 lb per handle**;
- `combinedExternalLoad`: `120 × 2 = 240 lb` per cycle;
- `externalLoadVolume`: `120 × 2 × 8 × 3 = 5,760 lb-reps`.

The stored load MUST remain 120. This case is a required EKF golden test.

**EKF-5.3 — Bilateral dumbbell bench/press.** A dumbbell bench press defined with `loadBasis: per_hand`, `resistanceSemantics: external`, `independent_bilateral`, and `bilateral_cycle`, with 50 lb entered, 10 reps, and 3 sets has `combinedExternalLoad = 100 lb` and `externalLoadVolume = 3,000 lb-reps`; the displayed value remains **50 lb per dumbbell**. Its PR/e1RM comparison scope remains the per-dumbbell exercise convention and MUST NOT be merged with a 100 lb barbell result.

**EKF-5.4 — Single-arm cable row.** A single-arm cable row defined with `loadBasis: total`, `resistanceSemantics: machine_indicated`, `unilateral`, and `reps_per_side`, with 70 lb indicated and 10 reps per side has 20 rep events and `indicatedLoadVolume = 1,400 indicated-lb-reps`. `externalLoadVolume` and e1RM are unavailable. If only one side was performed and recorded, performed context changes the event count to 10.

**EKF-5.5 — Alternating dumbbell curl.** An alternating dumbbell curl with `loadBasis: per_hand`, `resistanceSemantics: external`, 25 lb entered, and 12 entered reps has 12 total single-arm events, `combinedExternalLoad = 25 lb` per event, and `externalLoadVolume = 300 lb-reps`. It does not silently become 12 reps per arm.

**EKF-5.6 — Unilateral leg press.** A single-leg press defined with `loadBasis: total`, `resistanceSemantics: machine_indicated`, `unilateral`, and `reps_per_side`, with 180 lb indicated and 10 reps per side has 20 events and `indicatedLoadVolume = 3,600 indicated-lb-reps`; external tonnage and e1RM are unavailable. A plate-loaded per-side machine with different load meaning is a distinct canonical variant and MUST NOT inherit this arithmetic by name.

**EKF-5.7 — Weighted pull-up/dip.** For a `loadBasis: total`, `resistanceSemantics: bodyweight_plus_external`, `full_system`, bilateral-cycle movement, 180 lb bodyweight, 25 lb added load, and 6 reps yields `effectiveSystemLoad = 205 lb`, added `externalLoadVolume = 150 lb-reps`, and modeled `effectiveSystemLoadVolume = 1,230 lb-reps`. If bodyweight is missing, effective load, effective volume, and bodyweight-basis e1RM are unavailable; the exact 25 lb added value and 150 lb-reps added-load volume remain available.

**EKF-5.8 — Assisted pull-up/dip.** For 180 lb bodyweight, 60 lb assistance, and 8 reps, `effectiveSystemLoad = 120 lb` and modeled `effectiveSystemLoadVolume = 960 lb-reps`. Assistance is not positive external tonnage. With missing bodyweight, both effective quantities are unavailable. E1RM is unavailable in both cases.

**EKF-5.9 — Push-up/bodyweight-only.** A v1 push-up uses `reps_only`, `loadBasis: not_applicable`, `resistanceSemantics: bodyweight_only`, and `unsupported_fraction`. Twenty reps supports a claim of 20 completed rep events. External-load volume, effective system load, effective-load volume, and e1RM are unavailable. EKF v1 MUST NOT invent a universal percentage-of-bodyweight coefficient.

**EKF-5.10 — Farmer carry.** A farmer carry uses `load_distance`, `loadBasis: per_hand`, and `resistanceSemantics: external`, not rep tonnage. With 60 lb per hand for 100 ft, `combinedExternalLoad = 120 lb` and `externalLoadDistance = 12,000 lb-ft`. Repetition volume and e1RM are unavailable. Duration MAY be retained as an additional performed fact but does not change the v1 load-distance metric.

**EKF-5.11 — Sled push/pull.** A sled push/pull uses `loadBasis: total` and `resistanceSemantics: machine_indicated` to record implement/plate load plus distance. With 180 lb indicated for 50 ft, `indicatedLoadDistance = 9,000 indicated-lb-ft`. This is not mechanical work or calibrated resistance: friction, surface, sled, grade, and setup materially affect force. Cross-implement/surface comparison is unavailable without calibration and performed equipment context.

**EKF-5.12 — Plank/timed isometric.** A plank uses `duration` and `isometric`. A 60-second set yields 60 seconds of duration; rep tonnage and e1RM are unavailable. A loaded isometric MAY use `load_duration`, which remains separate from rep volume.

**EKF-5.13 — Machine-indicated resistance.** A `loadBasis: total`, `resistanceSemantics: machine_indicated` set of 150 lb for 10 bilateral cycles yields `indicatedLoadVolume = 1,500 indicated-lb-reps`. It does not yield external tonnage or e1RM. Trend comparisons are limited to the same exercise and preferably the same machine identity/setup; no cable ratio, cam, leverage, or friction normalization occurs without calibration data.

## 6. Formula eligibility

**EKF-6.1 — Estimates only.** Estimated one-repetition maximum (e1RM) is a mathematical estimate for a defined load basis. It MUST NOT be presented as measured strength, physiological truth, or comparable across incompatible exercise/load semantics.

**EKF-6.2 — V1 formula.** The default v1 formula remains rounded Epley:

`e1RM = round(e1rmLoadValue × (1 + enteredReps / 30))`

The persisted/returned result MUST identify `formulaId: epley`, `formulaVersion: 1`, the canonical exercise ID, EKF content revision, and `e1rmLoadBasis`.

**EKF-6.3 — Eligibility gate.** E1RM is available only when all of the following are true:

1. the canonical record explicitly permits e1RM;
2. the set is a completed working set;
3. entered reps are a whole number from 1 through 12;
4. the value resolved from the declared e1RM load basis is finite and positive;
5. load, repetition, laterality, unit, and comparison semantics are known;
6. the tracking model is `load_reps` or an explicitly eligible `bodyweight_plus_external` model.

Failure of any condition produces unavailable, not zero.

**EKF-6.4 — Explicit load basis.** An eligible record MUST declare `e1rmLoadBasis` as `entered_load`, `combined_external_load`, or `effective_system_load`. The basis MUST NOT be inferred at calculation time. Dumbbell exercises MAY use `entered_load` to preserve the conventional per-dumbbell PR; eligible barbell exercises normally use `combined_external_load`; eligible weighted pull-up/dip exercises use `effective_system_load`.

**EKF-6.5 — Ineligible contexts.** V1 MUST NOT calculate e1RM for carries, distance work, duration work, isometrics, reps-only work, `resistanceSemantics: assistance`, `machine_indicated`, `unknown`, unsupported bodyweight fractions, or mechanically incomparable contexts.

**EKF-6.6 — Bodyweight-plus-external.** A bodyweight-plus-external e1RM is eligible only for a curated `full_system` exercise, with known `bodyweightAtPerformance`, `e1rmLoadBasis: effective_system_load`, and all EKF-6.3 gates satisfied. The result MUST be labeled a modeled system-load estimate. Missing bodyweight makes it unavailable.

**EKF-6.7 — PR identity.** A logical PR comparison key MUST include canonical identity and the relevant measurement/load basis. Results with different semantic basis, equipment-comparison scope, formula version, or unit MUST NOT compete as one PR. A schema-v5 compatibility projection MAY retain a permanent legacy slug key when it maps unambiguously, but MUST NOT rewrite historical PR keys merely to adopt the richer logical key.

**EKF-6.8 — Deferred personalization.** RIR/%1RM individualization, velocity models, STMr-style or other personalized fitting, and learned response models are outside EKF-0 and v1 formula implementation. They belong to later Strength Knowledge work with independent evidence and validation.

## 7. Muscle workload semantics

**EKF-7.1 — Role assertions.** Canonical muscle mapping uses explicit `primary` and `secondary` role assertions. `stabilizer` MAY be retained as metadata. Each assertion MUST carry provenance under Section 8, including Big Gains-curated assertions.

**EKF-7.2 — No fractional scientific truth.** V1 MUST NOT encode or present arbitrary quantitative credit such as primary = 1.0 sets or secondary = 0.5 sets as scientific truth.

**EKF-7.3 — V1 user metrics.** User-visible v1 workload SHOULD report direct working sets for `primary` roles and secondary exposure separately. It MAY report exercise distribution. It MUST NOT combine those categories into a single pseudo-precise effective-set total.

**EKF-7.4 — Stabilizers.** Stabilizer assertions MUST NOT contribute to user-visible workload totals in v1.

**EKF-7.5 — Future weighted models.** Any future fractional, weighted, effective-set, or personalized muscle-credit model belongs in a later analytics/Strength Knowledge contract with an evidence basis, validation corpus, versioned formula, and uncertainty behavior.

## 8. Source, licensing, and provenance policy

**EKF-8.1 — Compatibility source zero.** The current Big Gains catalog is compatibility source zero. Its existing IDs and shipped metadata seed EKF compatibility, but current metadata is not automatically treated as externally validated anatomy or measurement truth.

**EKF-8.2 — Free Exercise DB.** Free Exercise DB MAY be evaluated selectively for structured text/data only after snapshot, provenance, and license review. Its media is a separate rights surface and MUST NOT enter initial ingestion unless asset-level rights are proven.

**EKF-8.3 — wger.** wger application code is AGPL and MUST NOT be copied into Big Gains. Exercise data is licensed per entry; only individually eligible entries MAY be considered, with their exact attribution and license metadata retained.

**EKF-8.4 — Reference code.** AGPL, copyleft, unknown-license, or reference-only projects such as Liftosaur MAY inform clean-room concepts. Their code, schema expression, prose, or assets MUST NOT be copied unless explicit compatible reuse is established and recorded.

**EKF-8.5 — Assertion provenance.** Every external assertion MUST retain:

- source name and immutable snapshot/version;
- source-native record ID;
- retrieval timestamp;
- transform method and transform version;
- exact license or SPDX expression when available;
- attribution requirements;
- rights status; and
- the source payload/hash reference needed for audit.

**EKF-8.6 — Rights status.** Rights status is one of `approved`, `quarantined`, `reference_only`, `rejected`, or `unknown`. `unknown`, noncommercial-only, incompatible, or legally uncertain material MUST be quarantined/reference-only and MUST NOT publish into a production canonical release.

**EKF-8.7 — Source disagreement.** Source assertions MAY disagree. The curated canonical choice MUST retain its supporting assertion references and rationale rather than deleting competing source facts.

**EKF-8.8 — No third-party media in v1.** Third-party exercise images, video, audio, thumbnails, and derived media are outside v1.

**EKF-8.9 — Rights hygiene, not legal advice.** This policy is an engineering provenance and rights-hygiene contract, not legal advice. Legal uncertainty MUST be stated and escalated; it MUST NOT be converted into an engineering claim of permission.

## 9. Minimum canonical record v1

**EKF-9.1 — Required core.** An active canonical record MUST contain the following minimum fields. This table defines field obligations, not a runtime file format.

| Field | Requirement |
|---|---|
| `id` | Required opaque immutable EKF ID |
| `schemaVersion` | Required canonical-record schema version |
| `contentRevision` | Required monotonically increasing revision for this ID |
| `status` | Required: `draft`, `active`, `deprecated`, or `merged` |
| `canonicalName` | Required current display name |
| `slug` | Required current presentation/search slug; not identity |
| `legacyIds` | Required array, empty only for never-published new entities |
| `aliases` | Required array, possibly empty |
| `familyId` / `variantOf` | Required fields, nullable; governed by EKF-3.8 |
| `modality` | Required EKF-3.2 value |
| `programmingTags` | Required array of EKF-3.3 values |
| `movementPatterns` | Required non-empty array |
| `mechanics` | Required EKF-3.5 value |
| `muscles` | Required role assertions or explicit unknown state |
| `equipment` | Required role assertions or explicit none/unknown state |
| `laterality` | Required EKF-3.9 value |
| `measurement.trackingModel` | Required EKF-4.1 value |
| `measurement.loadSemantics` | Required `{ loadBasis, resistanceSemantics }` object governed by EKF-4.5 |
| `measurement.repSemantics` | Required when reps apply; otherwise `not_applicable` |
| `measurement.bodyweightModel` | Required for bodyweight/assistance semantics |
| `analytics` | Required eligibility object, including e1RM permission and load basis |
| `provenanceRefs` | Required assertion/review references, including source zero where applicable |
| `rightsRefs` | Required rights decisions for externally derived published content |

**EKF-9.2 — Revision semantics.** `contentRevision` changes when canonical meaning changes without creating a new identity. A change that makes historical comparisons semantically invalid SHOULD create a new canonical entity/variant rather than silently revising meaning.

**EKF-9.3 — Optional/deferred fields.** Detailed joint actions, anatomy crosswalks, planes, tempo, range of motion, instructions, cues, safety notes, contraindications, media, multilingual text, popularity, and personalized recommendations are optional/deferred and MUST NOT block EKF-1 or EKF-2.

**EKF-9.4 — No prescription leakage.** Working sets, target reps, RIR/RPE, rest duration, percentage, progression, and program-day membership MUST NOT appear in the canonical record except as non-prescriptive taxonomy under EKF-3.3.

**EKF-9.5 — Validation.** Published records MUST pass deterministic schema and cross-field validation. Examples include: `reps_only` cannot require entered load; `assistance` requires a bodyweight model; e1RM permission requires a load basis; and every legacy ID is globally unique within a release.

## 10. Source, assertion, canonical, and release model

**EKF-10.1 — Four layers.** Big Gains uses four logically separate layers:

1. **Source snapshot/raw record** — immutable captured source material plus rights metadata;
2. **Normalized source assertion** — a typed claim produced by a versioned transform without becoming canonical truth;
3. **Curated canonical entity** — the Big Gains-owned preferred identity and semantics with rationale;
4. **Immutable EKF release** — a validated set of canonical records and compatibility indexes.

**EKF-10.2 — Immutable sources and releases.** A captured source snapshot and a published release MUST be immutable. Corrections create new snapshots, assertions, revisions, or releases.

**EKF-10.3 — Curated authority.** Canonical entities MUST reference the assertions and review decisions supporting their published fields. Automated normalization MAY propose candidates but MUST NOT publish ambiguous merges or rights-uncertain assertions.

**EKF-10.4 — Release contents.** A release MUST identify its schema version, release ID/version, generation inputs, deterministic validation result, canonical records, legacy/alias indexes, and rights-coverage result.

**EKF-10.5 — Proportionate v1 infrastructure.** EKF-0 does not require Supabase serving, Ed25519 signatures, curator bots, automated source watchers, or a complex release service. These MAY be later hardening measures and MUST NOT block initial Big Gains value.

## 11. Runtime and serving direction

**EKF-11.1 — Compatibility-first runtime.** EKF initially generates or powers the existing `BigGainsExerciseCatalog` API rather than replacing the local-first runtime architecture.

**EKF-11.2 — Offline/static operation.** Exercise lookup, routine resolution, workout rendering, and history interpretation MUST remain available from the static/offline application shell in early EKF phases.

**EKF-11.3 — No mandatory Supabase dependency.** Early EKF phases MUST NOT require a live Supabase request for exercise lookup or ordinary analytics. Supabase MAY later distribute or manage reference releases, but the last accepted local artifact remains sufficient for runtime use.

**EKF-11.4 — Release artifacts.** Future production EKF data assets SHOULD be deterministic and content-addressed so a runtime can identify the exact knowledge release used. Signing and remote release pointers are optional later hardening.

**EKF-11.5 — Schema isolation.** EKF reference data MUST remain outside schema-v5 personal profile state, synchronized training entities, and their semantic fingerprints unless a later migration contract explicitly says otherwise.

## 12. Required testing and golden regression matrix

**EKF-12.1 — Test-before-behavior rule.** EKF-1 and EKF-2 MUST add tests for their affected clauses before changing production behavior. The following matrix is the minimum regression contract.

| ID | Required category and assertion |
|---|---|
| `EKF-T01` | Every current Big Gains catalog ID resolves to exactly one canonical record; every existing alias retains its current owner/search behavior unless an explicit reviewed collision is documented. |
| `EKF-T02` | EKF introduction performs zero schema-v5 historical row rewrites and preserves serialized completed workouts, active workouts, routines, PR keys, preferences, and backups in EKF-1. |
| `EKF-T03` | Retrospective instance `id` remains distinct and its legacy `definitionId` resolves canonically. |
| `EKF-T04` | Iso-lateral 120 × 2 × 8 × 3 equals 5,760 while entered/displayed load remains 120 per handle. |
| `EKF-T05` | Per-hand and per-side records remain distinct even when both use a two-unit arithmetic factor. |
| `EKF-T06` | `reps_per_side` expands side events; `alternating_total` does not. The 25 × 12 alternating-curl case equals 300, not 600. |
| `EKF-T07` | Known bodyweight enables approved modeled system load; missing bodyweight safely returns unavailable without substituting current weight. |
| `EKF-T08` | Known assistance subtracts only in an approved bodyweight model; missing bodyweight is unavailable; assistance never adds external tonnage. |
| `EKF-T09` | Push-up/bodyweight-only unsupported fraction reports reps but no tonnage/e1RM. |
| `EKF-T10` | Machine-indicated volume is labeled and excluded from free-weight tonnage/e1RM and cross-machine comparability. |
| `EKF-T11` | Farmer carry, sled, distance, duration, and plank cases do not fall through to rep tonnage or e1RM. |
| `EKF-T12` | E1RM eligibility, 1–12 rep gate, formula ID/version, load basis, and every ineligible context follow Section 6. |
| `EKF-T13` | Primary sets and secondary exposure remain separate; stabilizers and arbitrary fractional credit do not enter user-visible totals. |
| `EKF-T14` | Alias collisions and ambiguous duplicate candidates fail validation and never auto-merge. |
| `EKF-T15` | Every external published assertion has complete provenance and approved rights coverage; unknown/NC/incompatible material cannot publish. |
| `EKF-T16` | Canonical records and releases pass deterministic schema, uniqueness, referential-integrity, cross-field, and stable-generation validation. |
| `EKF-T17` | Existing History/Progress/PR/routine tests remain green through EKF-1; intended EKF-2 changes replace only assertions explicitly superseded by this contract. |

**EKF-12.2 — No false precision fixtures.** Golden fixtures MUST include unavailable and limited-comparison results, not only successful numeric results.

**EKF-12.3 — Release gate.** A release with an unresolved ID collision, dangling relationship, ambiguous auto-merge, nondeterministic output, missing required rights record, or invalid measurement combination MUST fail closed.

## 13. Phased Big Gains implementation plan

**EKF-13.1 — EKF-0: Contract.** This unit freezes identity, taxonomy, measurement semantics, calculation eligibility, muscle-role behavior, provenance policy, compatibility invariants, golden cases, and phase boundaries. It changes documentation only.

**EKF-13.2 — EKF-1: Stable identity and compatibility generation.** EKF-1 introduces opaque canonical IDs, permanent legacy resolution, the minimum record schema, deterministic validation, and generation of the existing catalog compatibility API. It MUST make no analytics behavior change and MUST rewrite no schema-v5 history.

### EKF-1 implementation shape (informative)

EKF-1 is implemented as a source-controlled, static compatibility layer. `ekf/curated/exercises.json` persists the opaque exercise IDs and legacy compatibility fields; `families.json` persists the separate opaque family IDs; and `references.json` records the honest Big Gains-curated/project-owned baseline without inventing external provenance. The EKF-1 canonical defaults materialize the required record shape while leaving deferred taxonomy, measurement, and analytics meaning explicitly unknown/inactive.

`scripts/generate-exercise-catalog.mjs` validates the source and deterministically produces both `exercise-catalog.js` and `ekf/compatibility/legacy-exercise-ids.json`. The generated browser artifact adds `BigGainsExerciseIdentity` beneath the unchanged enumerable `BigGainsExerciseCatalog` API. Current public IDs remain permanent legacy IDs, and schema-v5 workouts, active sessions, retrospective `definitionId` values, routines, PR keys, preferences, backups, and sync payloads are not rewritten. No Supabase or other network dependency is introduced. This note records the EKF-1 implementation; it does not alter the normative clauses or authorize EKF-2 behavior.

**EKF-13.3 — EKF-2: Measurement semantics and analytics correctness.** EKF-2 implements entered-versus-derived load semantics, repetition/laterality arithmetic, metric availability, e1RM eligibility/versioning, muscle-role separation, and golden regressions. It includes the minimum workout-card/input semantics needed to make future entered values explicit while preserving existing stored history. The UI shape and historical bodyweight resolver policy are product decisions to settle before this phase.

### EKF-2 implementation shape (informative)

EKF-2 activates the approved exercise-defined measurement contract. `ekf/curated/measurement-contracts.json` explicitly maps all 119 compatibility exercises to a tracking model, orthogonal load basis and resistance semantics, rep basis, laterality, bodyweight model, card labels/units, e1RM gate, and primary/secondary muscle roles. The deterministic generator rejects missing, duplicate, unknown, or cross-field-invalid contracts and produces the review table at `ekf/audit/measurement-contracts.md` alongside the offline catalog projection.

The data path has three deliberately separate phases: (1) the exact gym-entered schema-v5 facts such as `set.weight`, reps, optional distance, and optional duration; (2) the canonical EKF interpretation selected by exercise identity; and (3) runtime-derived combined external load, machine-indicated workload, modeled effective system load, load-distance, duration, and eligible Epley v1 estimates. Neither analytics nor rendering rewrites historical or future entered load. Missing context yields unavailable rather than inferred values under EKF-4.20.

Standard curated exercise semantics are read-only and not set-overridable. Train and retrospective cards derive their compact fields, labels, units, validation, History wording, and analytics interpretation from the selected canonical exercise. A machine with different load meaning requires the correct canonical definition/variant. Custom-exercise measurement-contract UX remains deferred rather than creating a new custom-exercise subsystem.

EKF-2 does not select a historical bodyweight-at-performance resolver and does not add machine model/instance capture. It preserves the current explicit-bodyweight calculation input and missing-bodyweight fail-safe; those remaining product decisions stay governed by EKF-14.12 and EKF-14.13.

**EKF-13.4 — EKF-3: Curated catalog expansion.** EKF-3 evaluates allowed source records, creates provenance-complete assertions, performs human-reviewed deduplication, and expands the catalog only through validated releases. Bulk import and third-party media remain prohibited by default.

**EKF-13.5 — Later work.** Anatomy ontology crosswalks, joint actions, richer instructions, stronger release/signing infrastructure, remote distribution, calibrated equipment models, personalized strength modeling, advanced programming, and a broader Strength Knowledge layer follow only when their own contracts and evidence exist.

**EKF-13.6 — Approval boundary.** Completion of EKF-0 does not authorize EKF-1 implementation. Each phase requires separate approval.

## 14. Decision log

### 14.1 Approved decisions

**EKF-14.1 — Knowledge layer.** EKF is a knowledge layer, not merely a larger exercise catalog.

**EKF-14.2 — Canonical ownership.** Big Gains owns canonical exercise identity; source identities never replace it.

**EKF-14.3 — Entered versus interpreted.** Exact gym-entered values remain separate from combined, effective, indicated, or otherwise interpreted loads.

**EKF-14.4 — Honest muscle semantics.** V1 does not manufacture fractional muscle-set precision.

**EKF-14.5 — Conservative rights policy.** External content requires assertion-level provenance and rights review; uncertain content is quarantined/reference-only.

**EKF-14.6 — No third-party media.** Third-party exercise media is outside v1.

**EKF-14.7 — Compatibility mandate.** Existing IDs, schema-v5 history, routines, PR identity, retrospective identity, backups, preferences, and completed-history authority remain resolvable without destructive migration.

**EKF-14.8 — Contract first.** EKF-0 freezes semantics before implementation.

**EKF-14.9 — Workout-card dependency.** Workout cards eventually expose measurement meaning, but EKF-0 does not change them.

**EKF-14.10 — V1 defaults frozen here.** Load basis and resistance interpretation are orthogonal; per-hand and per-side remain distinct; per-handle uses per-side basis with a handle label; alternating dumbbell-curl reps mean total events; push-up tonnage is unavailable without an approved model; machine-indicated loads do not produce free-weight tonnage or e1RM; and Epley v1 uses an explicit basis with a 1–12 rep eligibility gate.

**EKF-14.11 — Workout-card control shape.** Measurement meaning is read-only from the selected canonical exercise for standard curated EKF records. Workout cards MUST derive fields, labels, validation, and analytics interpretation from that contract and MUST NOT expose a per-set semantic override. A materially different machine/load meaning requires the correct canonical exercise or variant.

### 14.2 Remaining product decisions (not EKF-2 blockers)

**EKF-14.12 — Historical bodyweight resolver.** Before EKF-2 exposes historical system-load metrics, the product must choose a versioned bodyweight-at-performance policy (for example, strict contemporaneous-only versus nearest qualifying prior measurement labeled approximate). The safe default is unavailable when no defensible time-associated value exists.

**EKF-14.13 — Machine identity capture.** Before offering machine-specific trend comparisons, the product must decide whether to capture an optional machine model/instance/setup identifier. The safe default is limited comparison with no cross-machine normalization.

No remaining decision prevents acceptance of EKF-0 or the identity-only scope of EKF-1.

## Appendix A — Inspected implementation baseline (informative)

The EKF-0 contract is grounded in the following observed baseline behavior:

- `exercise-catalog.js` derives current IDs from display names and exposes immutable name/day/muscle/equipment/alias/family records plus a two-mode `bodyweight`/`external` resolver.
- `analytics.js` treats completed non-warmup sets as working sets, derives ordinary volume from effective load times reps, adds current supplied bodyweight for Bodyweight equipment, uses rounded Epley, resolves retrospective identity through `definitionId || id`, splits slash-delimited muscles, and credits every listed muscle the full set/volume/reps.
- `workout-session-controller.js` and `state-persistence.js` store schema-v5 set facts as `weight`, `reps`, `warmup`, and `completed`; external work requires positive load while Bodyweight work permits zero added load.
- `retrospective-workout.js` preserves fresh exercise instance IDs and stores catalog identity in `definitionId`; edit replaces one stable completed-workout ID and recomputes derived PRs.
- `routine-engine.js` keeps prescription in legacy exercise-ID arrays or `{ exerciseId, workingSets, targetReps }` entries, outside catalog definitions.
- Progress, History, PR, catalog, retrospective, routine, storage, and sync tests already protect the compatibility surface summarized in EKF-12.

These observations explain the required migration boundary; they do not bless the current compressed semantics as EKF v1 behavior.
