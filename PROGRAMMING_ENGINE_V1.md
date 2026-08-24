# Programming Engine v1 contract

- Status: **Approved normative contract; PE-1A, PE-1B, and PE-1C implemented for release review**
- Contract version: **`big-gains.programming-engine.v1` / `1.0.0`**
- Production baseline: `main` at `a3a8d2cd224af891bd5a2a54c74f3c7facfea5ad`
- Release marker: `v94-pe-1c-atomic-proposal-application` (**implementation candidate; not deployed**)
- Runtime status: **PE-1A proposal generation/display, PE-1B explicit Program-origin evidence mapping, and PE-1C explicit atomic proposal application implemented**
- Maximum authority: **Review**

This contract defines the first deterministic Big Gains Programming Engine boundary. It builds on [Program Foundation v1](PROGRAM_FOUNDATION_V1.md), [Product IA v1](PRODUCT_IA_V1.md), [Goals v1](GOALS_V1_SPEC.md), the [Exercise Knowledge Foundation](EXERCISE_KNOWLEDGE_FOUNDATION.md), and the production architecture in [ARCHITECTURE.md](ARCHITECTURE.md). The original publication unit authorized documentation only. The separately authorized PE-1A interval adds pure runtime evaluation and proposal display. PE-1B adds an explicit Program-to-Train entry and immutable workout provenance under schema v5 without a Supabase migration, History backfill, proposal application, release, or deployment.

The core rule is:

`versioned inputs -> explicit deterministic rules -> proposal | no_change | unavailable -> reason/evidence trace -> optional faithful explanation`

The engine is not an LLM decision-maker. A natural-language layer may explain a result, but may not create, alter, upgrade, or conceal the result.

## 0. Contract language, precedence, and scope

**PE1-0.1 — Normative terms.** **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative. Examples and evidence notes are informative unless a requirement incorporates them.

**PE1-0.2 — Stable requirement IDs.** `PE1-*` IDs are stable citations. Existing IDs MUST NOT be renumbered. A changed meaning receives a new ID and leaves the superseded meaning documented.

**PE1-0.3 — Safety precedence.** Exact performed facts, active-workout stability, immutable Program/Routine versions, EKF meaning, profile ownership, explicit user constraints, and Review authority take precedence over producing a proposal.

**PE1-0.4 — Documentation-only boundary.** This unit MUST change Markdown only. Train, Goals progression, Program Analyzer calculations, schema v5, Supabase/RLS, synchronization, production data, releases, and deployment MUST remain unchanged.

**PE1-0.5 — Rules engine.** Programming Engine v1 MUST be pure, deterministic, versioned decision logic. Identical normalized inputs and policy versions MUST produce a semantically identical result.

**PE1-0.6 — No black-box authority.** An LLM, free-form model, unexplained score, or generated narrative MUST NOT choose a Programming Engine result or operation.

**PE1-0.7 — Split agnosticism.** Rules MUST use stable Program, slot, Routine, exercise, Goal, and version identities plus Analyzer facts. `Push`, `Upper`, `A`, `Full Body`, and arbitrary labels carry no programming semantics.

**PE1-0.8 — Proposal-only v1.** V1 MAY analyze and propose within the allowlist in Section 8. It MUST NOT silently apply, activate, or materialize a change.

**PE1-0.9 — Conservative completeness.** `no_change` and `unavailable` are successful typed results, not failures to be hidden or converted into a proposal.

## 1. Layer ownership and engine boundary

**PE1-1.1 — Goals are destinations.** A Goal supplies an exact eligible exercise target, target value, optional deadline, lifecycle state, priority/linkage, and guidance state. A Goal MUST NOT mutate a Program or Routine.

**PE1-1.2 — Program is route structure.** An exact Program version supplies ordered slots, cadence, pinned Routine versions, Goal links, block boundary, effective metadata, and authority. It does not own performed facts.

**PE1-1.3 — Routine is reusable prescription.** An immutable Routine version supplies exact exercise membership/order and working-set/rep prescriptions. An engine change to those fields requires a proposed successor Routine version.

**PE1-1.4 — Analyzer supplies facts.** Program Analyzer supplies deterministic structural facts: exact exercise exposures and sets per cycle, spacing, muscle/movement roles, prescription distributions, linked-Goal representation, and block context.

**PE1-1.5 — Engine supplies judgments.** Programming Engine consumes valid facts and applies explicit policy. Normative coaching thresholds and proposal decisions MUST remain outside Program Analyzer.

**PE1-1.6 — Timescale separation.** Exposure Progression Policy (currently implemented as `BigGainsGoalsProgression`) owns load/rep recommendations inside the current Routine structure. Structural Adaptation Policy (currently implemented as `BigGainsProgrammingEngine`) owns only higher-horizon, versioned Program/Routine route-change proposals. Goal supplies intent and guidance authorization; the [Programming bounded-domain doctrine](ARCHITECTURE.md#programming-bounded-domain) owns both adaptive decision timescales conceptually. Runtime names are adopted on touch.

**PE1-1.7 — Train executes snapshots.** Train owns the editable active-workout snapshot. A proposal or accepted successor MUST NOT rewrite an already-created active workout.

**PE1-1.8 — History owns performed facts.** Completed History is immutable to Programming Engine. Existing explicit History edit/delete tools remain the only fact-correction authority.

**PE1-1.9 — Strength Knowledge is parked.** Future Strength Knowledge MAY provide versioned estimated-response or prediction outputs through the input boundary in Section 2, but no such model is implemented or required by PE v1.

**PE1-1.10 — Explanation is downstream.** Explanation generation receives only the typed engine result and its trace. It MUST NOT introduce an operation, reason, confidence claim, causal diagnosis, or expected effect absent from that result.

**PE1-1.11 — Pure analysis.** Engine evaluation MUST perform no persistence, storage, network, DOM, synchronization, activation, version creation, or workout mutation side effect.

**PE1-1.12 — Separate application transaction.** Proposal application is a later, explicit user-authorized transaction with its own stale-base check. Analysis success does not imply application success.

## 2. Versioned input layers

Each input layer is independently attributable and versioned. The engine MUST fail closed when a required layer is absent, stale, ambiguous, cross-profile, or incompatible.

**PE1-2.1 — Evaluation envelope.** Every evaluation MUST identify contract version, engine policy version, profile scope, deterministic evaluation ID/input digest, evidence cutoff, and evaluation time.

**PE1-2.2 — Goal layer.** Goal input MUST identify exact `goalId`, canonical `exerciseId`, metric/basis/unit, target value, optional deadline, lifecycle/attainment state, Program linkage, priority, and guidance-policy linkage where available.

**PE1-2.3 — Goal eligibility.** Only an active, exact-exercise Goal with compatible EKF meaning may drive a Goal-specific structural judgment. A deadline or Goal alone is never sufficient evidence for a change.

**PE1-2.4 — Guidance distinction.** `guidanceEnabled` controls Goals next-exposure intervention. It MUST be recorded for precedence/explanation but MUST NOT silently grant Program mutation authority or invalidate an otherwise user-requested Program review.

**PE1-2.5 — Program layer.** Program input MUST identify exact immutable base `programVersionId`, Program identity/status, profile owner, ordered slot identities, cadence, pinned `routineVersionId` values, Goal links, block boundary/progress, authority, and future-effective rules.

**PE1-2.6 — Complete Routine pins.** Every executable base slot MUST resolve to its exact immutable, same-profile Routine version. A mutable, missing, or mismatched pin makes dependent rules unavailable.

**PE1-2.7 — Analyzer layer.** Analyzer input MUST include `big-gains.program-analysis.v1` (or an explicitly compatible successor), its analyzer version/input digest, exact base version IDs, availability/errors, and the factual groups used by the rule.

**PE1-2.8 — Analyzer freshness.** Analyzer facts MUST be recomputed from or prove an exact digest match with the base Program, pinned Routine versions, EKF snapshot, and Goal identities. A mismatched digest is stale input, not evidence.

**PE1-2.9 — Performance layer.** Performance input MUST contain completed workouts only, exact exercise identity, completed working-set facts, comparable-outcome classifications, eligible existing e1RM/trend facts, timestamps, evidence references, and explicit inclusion/exclusion reasons.

**PE1-2.10 — Comparable evidence.** Program-level evidence MUST preserve the Goals v1 identity, basis, unit, working-set, and eligibility gates. Another exercise, warm-up, incomplete set, incompatible basis, inferred label match, or current-session set is not comparable evidence.

**PE1-2.11 — Provenance gate.** Block/cycle performance MAY be used only when deterministically mapped through recorded compatible Program/Routine/slot provenance. Legacy workout names or weekdays MUST NOT be used to guess provenance.

**PE1-2.17 — PE-1B provenance shape.** A proven Program-derived active or completed workout records `big-gains.program-origin.v1` with exact account/profile, Program and Program-version, Routine and Routine-version, slot identity, zero-based slot index, one-based monotonic cycle number, and materialization timestamp. The origin contains no mutable analysis or completed-cycle flag.

**PE1-2.18 — Completed-cycle derivation.** A cycle is proven complete only when completed History contains compatible explicit origins for every pinned slot of that exact Program version and cycle number. Materialization, calendar time, weekday anchors, labels, partial cycles, deleted records, wrong-version records, and legacy workouts do not prove completion.

**PE1-2.12 — Constraint layer.** Constraints MAY include available training frequency or rolling cadence, explicit preferred Program structure, and reliably represented equipment availability. Each constraint MUST identify source, value, version/time, and whether it is hard or preferred.

**PE1-2.13 — No invented constraints.** Absent equipment, schedule, spacing, or structure preferences MUST remain unknown. Labels, missed days, or exercise history MUST NOT silently manufacture them.

**PE1-2.14 — Future model layer.** A future Strength Knowledge input MUST identify model name/version, feature contract, training/evaluation data boundary, benchmark result, calibration/uncertainty semantics, output, and evidence cutoff.

**PE1-2.15 — No-model v1 behavior.** Every PE v1 decision family MUST work without a Strength Knowledge model. Missing future-model input MUST NOT lower a result from otherwise justified `proposal` or `no_change` unless a later separately versioned rule explicitly requires that model.

**PE1-2.16 — Cross-profile rejection.** Any input reference outside the immutable account/profile scope makes the entire evaluation `unavailable` with `PROFILE_SCOPE_MISMATCH`.

## 3. Pure result contract

**PE1-3.1 — Result union.** The engine MUST return exactly one status: `no_change`, `proposal`, or `unavailable`.

**PE1-3.2 — Stable envelope.** Every result MUST include contract version, engine policy version, evaluation ID/input digest, profile scope, evaluated/evidence-cutoff times, base Program version, base Routine-version pins, status, primary reason code, ordered reason trace, evidence summary/references, availability semantics, stale-base guard, explanation payload, approval requirements, and future-effective boundary semantics.

**PE1-3.3 — Proposal fields.** `proposal` MUST additionally include stable proposal ID, allowlisted `proposalType`, exact target scope, ordered typed operations, exact before/after diff, expected conservative effect, invariant checklist, and proposed successor graph.

**PE1-3.4 — No-change fields.** `no_change` MUST include the rule that justifies retaining the current Program and any future review trigger. It MUST have no operations or proposed successor graph.

**PE1-3.5 — Unavailable fields.** `unavailable` MUST identify the failed gate, missing/incompatible inputs, and a factual resolution action when one exists. It MUST have no operations or implied change direction.

**PE1-3.6 — Base identity.** `baseProgramVersionId` and the complete ordered `baseRoutineVersionIds` pin set MUST be exact immutable identities, never names or current-version aliases.

**PE1-3.7 — Target scope.** A target MUST use stable IDs and distinguish Program, slot, Routine occurrence, Routine version, exercise prescription, Goal, or block. A display label is insufficient.

**PE1-3.8 — Typed operations.** Each operation MUST have a stable operation type, exact target/precondition, exact deterministic parameters, before/after values, successor-version effect, reason-code references, and invariant assertions.

**PE1-3.9 — Evidence references.** Evidence refs MUST point to immutable or content-addressed source facts/derived facts and record their role. A prose summary alone is not evidence.

**PE1-3.10 — Confidence restraint.** PE v1 MUST NOT emit probabilities, percentages, or labels such as `90% confident`. Deterministic availability is `available` or `unavailable`; evidence sufficiency is described by satisfied named gates and counts.

**PE1-3.11 — Expected effect restraint.** Expected effect MUST use conservative planning language such as `distributes the same Bench sets across two cycle positions`. It MUST NOT promise strength gain, deadline attainment, recovery, injury prevention, or optimality.

**PE1-3.12 — Explanation payload.** The payload MUST contain a concise summary, affected Goal, exact change, why, evidence-used bullets, expected-effect statement, exact diff labels, caveats, and reason-code references derived from the typed result.

**PE1-3.13 — Explanation validation.** A later renderer MAY rephrase the payload, but every factual clause MUST trace to a result field. Unsupported explanation text is invalid and MUST fall back to deterministic template copy.

**PE1-3.14 — Approval requirement.** Every proposal MUST state `userApprovalRequired: true` and `authorityCeiling: review`.

**PE1-3.15 — Effective boundary.** Every proposal MUST state `next_unmaterialized_session_or_later`; a specific later block/date/cycle boundary MAY further restrict it.

**PE1-3.16 — Stale guard.** The guard MUST contain expected base Program ID/version, complete expected Routine pin set, relevant Goal/policy versions, Analyzer digest, and evidence cutoff/digest.

**PE1-3.17 — No hidden state.** A result MUST be reproducible from the recorded normalized input envelope and policy package. Wall-clock time may influence only explicit deadline/freshness rules through the recorded evaluation time.

**PE1-3.18 — Schema evolution.** A later result contract MUST version additive/changed semantics and define compatibility. Unknown operation types or reason semantics MUST fail closed.

Conceptual shape (not a storage authorization):

```json
{
  "contractVersion": "big-gains.programming-engine.v1",
  "enginePolicyVersion": "pe-strength-rules.v1",
  "evaluationId": "opaque-id",
  "inputDigest": "content-digest",
  "profileScope": { "accountId": "...", "profileId": "..." },
  "evidenceCutoff": "ISO-8601",
  "status": "proposal | no_change | unavailable",
  "proposalType": "allowlisted-type-or-null",
  "baseProgramVersionId": "immutable-id",
  "baseRoutineVersionIds": ["immutable-id"],
  "targetScope": { "goalId": "...", "exerciseId": "...", "slotIds": [] },
  "operations": [],
  "reasonCodes": [],
  "evidence": { "facts": [], "refs": [], "excluded": [] },
  "availability": { "state": "available | unavailable", "failedGates": [] },
  "staleBaseGuard": { "expectedVersionIds": [], "inputDigest": "..." },
  "explanation": { "summary": "...", "why": [], "caveats": [] },
  "approval": { "userApprovalRequired": true, "authorityCeiling": "review" },
  "effectiveBoundary": "next_unmaterialized_session_or_later"
}
```

## 4. Authority and first-class outcomes

**PE1-4.1 — Off.** With Program authority `off`, the engine MAY return factual `unavailable`/`no_change` analysis for a user-invoked review if the product later permits it, but MUST NOT create an actionable proposal or apply anything.

**PE1-4.2 — Review.** With authority `review`, the engine MAY emit an allowlisted proposal. Explicit user approval of a non-stale proposal is required before successor versions are created.

**PE1-4.3 — Auto excluded.** `auto` is future-only. PE v1 MUST reject it as executable authority and MUST NOT expose a control that implies it works.

**PE1-4.4 — No-change meaning.** `no_change` means an explicit evaluated rule justifies retaining the current Program from the available evidence. It does not mean the Program is universally optimal or that no future change will be justified.

**PE1-4.5 — Unavailable meaning.** `unavailable` means the engine cannot justify a programming judgment under the required gates. `INSUFFICIENT_COMPARABLE_EVIDENCE` is a common unavailable reason, not poor performance.

**PE1-4.6 — No forced proposal.** Goal existence, target distance, deadline pressure, a block boundary, one failed workout, or an Analyzer fact alone MUST NOT force a proposal.

**PE1-4.7 — Deadline treatment.** Deadline pressure MAY produce deterministic feasibility/outlook context if the underlying Goals contract supports it. It MUST NOT raise loads, sets, frequency, change magnitude, or proposal priority automatically.

**PE1-4.8 — Later/reject semantics.** `Reject` and `Later` record proposal disposition only. Neither changes Program/Routine/Goal/History facts. A later view MUST revalidate staleness.

**PE1-4.9 — No proposal synthesis from unavailable.** The UI or explanation layer MUST NOT translate unavailable evidence into `consider changing X` unless that text is explicitly non-engine educational content and visually separated from the result.

**PE1-4.10 — One decision result.** If multiple eligible rules conflict, deterministic precedence in Section 7 MUST resolve one bounded proposal or return `unavailable`; the engine MUST NOT emit a menu of contradictory prescriptions as one decision.

## 5. Evidence-backed principles and product-policy boundary

Literature constrains safe policy; it does not supply an individualized prescription or Big Gains threshold.

**PE1-5.1 — Literature role.** Evidence MAY justify broad guardrails and candidate operation families. It MUST NOT be represented as validating a specific user's exact set count, frequency, rep range, stall count, change magnitude, or deadline path.

**PE1-5.2 — Higher-load principle.** For 1RM strength, broad research favors higher-load practice compared with lower-load work, while many prescriptions improve strength. PE v1 MAY preserve a strength-specific higher-load bias through an explicit policy range; it MUST NOT infer one universally optimal percentage or rep scheme.

**PE1-5.3 — Periodization principle.** Volume-equated periodized training shows a small overall 1RM advantage over non-periodized training, with limited evidence for one universally superior form. This permits reviewed long-horizon change, not an automatic calendar phase generator.

**PE1-5.4 — Frequency principle.** Frequency findings are sensitive to volume and population. When volume is equated, older meta-analysis found no clear independent frequency effect, while newer dose-response modeling suggests a strength association with diminishing returns. PE v1 therefore treats frequency as a way to distribute exact work/practice under constraints, not as a universal `more is better` rule.

**PE1-5.5 — Volume principle.** Weekly set volume is associated with strength and hypertrophy gains, with uncertainty, population differences, and diminishing returns. Research does not establish a personalized universal minimum/maximum for an exact Big Gains user.

**PE1-5.6 — Muscle-volume restraint.** Analyzer muscle-role set summaries MUST NOT be converted into `too low`, `too high`, or an exact muscle-set prescription in PE v1. Exact-exercise facts and explicit product gates take precedence.

**PE1-5.7 — Autoregulation principle.** Autoregulated and fixed prescriptions can both improve 1RM; reviews vary on the size/consistency of any advantage. Goals' conservative completed-performance progression is compatible with this uncertainty, but PE v1 MUST NOT invent uncaptured RPE, RIR, velocity, or readiness signals.

**PE1-5.8 — Fatigue restraint.** Missed targets and declining performance may have many causes. Without validated captured signals, PE v1 MUST NOT diagnose fatigue, overreaching, recovery status, pain, technique, motivation, sleep, or injury.

**PE1-5.9 — Deload evidence limit.** Direct deload evidence is limited and protocol-specific; a one-week cessation trial did not show a strength benefit, and other reduced-training protocols do not establish a personalized trigger. Automatic deload generation is parked.

**PE1-5.10 — Product heuristics must be named.** Comparable-exposure counts, completed-cycle minimums, policy rep ranges, change caps, and rule precedence are Big Gains product heuristics. They MUST be versioned, reviewable, visible in the trace, and never attributed to a paper as exact constants.

**PE1-5.11 — No pseudo-precision.** The engine MUST NOT turn group-level effect sizes or dose-response curves into individual predicted pounds, dates, optimal sets, or probability of Goal completion.

**PE1-5.12 — Policy registry.** Every numeric threshold or allowlisted range used at runtime MUST be defined in a named, immutable engine policy package rather than scattered conditional logic.

## 6. Comparable evidence, healthy progress, and stall

**PE1-6.1 — Higher horizon.** A Program-level change requires more evidence than a next-exposure hold or adjustment. One exposure, one Goals clear miss, or one incomplete workout is never a Program stall.

**PE1-6.2 — Comparable exposure.** A comparable exposure is a completed exact-exercise working-set series with compatible identity/basis/unit and a deterministic outcome against the issued or explicitly adopted target under the Goals policy.

**PE1-6.3 — Progress event.** A comparable exposure records progress when it earns a valid Goals transition such as `ADD_REPS` or `ADD_LOAD_RESET_REPS`, or improves an eligible predeclared Program-level metric without changing comparison structure.

**PE1-6.4 — Healthy rule.** When recent comparable evidence contains a valid progress event under the current Program and no hard structural/constraint violation exists, the result MUST be `no_change` with `PROGRESSION_HEALTHY_NO_CHANGE`.

**PE1-6.5 — Failed restoration prerequisite.** A stall-dependent Program proposal MUST NOT fire until Goals next-exposure handling has had the policy-defined opportunity to hold/adjust and then test restoration under comparable conditions.

**PE1-6.6 — Stall definition.** `REPEATED_STALL` requires all of: an exact Goal exercise; no progress event across the configured consecutive comparable-exposure window; the configured minimum completed Program cycles; satisfaction of PE1-6.5; stable comparison structure or explicit normalization; and no disqualifier.

**PE1-6.7 — No trend-only stall.** A flat or declining e1RM trend alone MUST NOT establish stall. It may summarize context only when its eligibility/formula/basis are unchanged.

**PE1-6.8 — Deadline independence.** The stall window MUST count comparable exposures/cycles, not elapsed deadline weeks. Missed calendar time does not manufacture failed attempts.

**PE1-6.9 — Interrupted evidence.** Incomplete, skipped, materially overridden, retrospectively ambiguous, or non-provenanced attempts remain valid History facts but do not advance the consecutive comparable stall count.

**PE1-6.10 — Structural change resets comparison.** A material exercise prescription, Routine, Program, measurement, or adopted-baseline change starts a new comparable window unless the policy explicitly proves comparability.

**PE1-6.11 — Superseded unresolved-settings gate.** The original draft left `stallComparableExposureCount`, `minimumCompletedCycles`, and `postGoalsAdjustmentComparableOpportunities` unresolved. PE1-6.16 supersedes that draft gate; stall-dependent rules are no longer unavailable merely because those three constants awaited approval.

**PE1-6.12 — Superseded candidate threshold.** The original draft recommended **4 consecutive comparable exposures with no progress event**, spanning at least **2 completed cycles**, after the Goals repeated-miss adjustment received at least **2 comparable opportunities** to restore progression. PE1-6.16 now adopts that candidate as normative v1 policy; this requirement remains only as decision history.

**PE1-6.13 — Change cooldown.** After an accepted Program/Routine successor changes the exact exercise route, another stall-dependent proposal for that exercise MUST wait for a fresh complete threshold window under the successor.

**PE1-6.14 — Multiple Goals.** When two Goals compete for the same slot/set/frequency resource and no explicit priority resolves them, the engine MUST return `unavailable` with `GOAL_PRIORITY_CONFLICT`.

**PE1-6.15 — Block mapping.** Completed-cycle/block thresholds MAY be evaluated only with deterministic Program provenance. Otherwise the engine may use exposure evidence for non-block context but MUST return unavailable for rules requiring completed-cycle proof.

**PE1-6.16 — Normative v1 stall threshold.** A stall-dependent PE v1 rule MAY treat `REPEATED_STALL` as satisfied only when all other PE1-6.6 gates hold and the evidence proves: **4 consecutive comparable exposures without a progress event**; those exposures represent at least **2 completed Program cycles**; and at least **2 of those comparable opportunities occurred after Goals repeated-miss/local-adjustment logic had already had a chance to restore progression**. These constants MUST be declared in the immutable engine policy package as `stallComparableExposureCount: 4`, `minimumCompletedCycles: 2`, and `postGoalsAdjustmentComparableOpportunities: 2`.

**PE1-6.17 — Exact comparability boundary.** A PE v1 comparable exposure MUST reuse the existing Goals/History exact exercise identity, basis, unit, working-set, issued/adopted-target, completion, and eligibility semantics. A related exercise, exercise variant, label alias, movement-family match, or inferred substitute MUST NOT enter the comparable window for the Goal exercise.

**PE1-6.18 — Local progression first.** Goals next-exposure logic retains first authority for immediate load/rep holds and adjustments inside the current Program. Programming Engine MUST NOT react to one bad workout, a first miss, or ordinary next-exposure friction; it may evaluate a longer-horizon structural change only after PE1-6.16 is fully satisfied.

**PE1-6.19 — Post-adjustment opportunity accounting.** A post-adjustment opportunity counts only when the Goals repeated-miss/local adjustment was issued or explicitly adopted before that later exact comparable exposure. The adjustment exposure itself and earlier exposures MUST NOT be relabeled as post-adjustment opportunities.

## 7. Decision families and precedence

Rules evaluate in the following order: safety/input validity; stale/scope/identity gates; hard constraint repair; healthy progress; evidence sufficiency/stall; allowlist eligibility; bounded proposal construction.

**PE1-7.1 — Safety-first stop.** Profile mismatch, stale base, missing pins, malformed Analyzer output, incompatible evidence identity, or active proposal conflict stops later proposal rules.

**PE1-7.2 — Goal not represented.** If an eligible linked Goal exercise is absent from the exact Program, PE v1 MUST return `unavailable` with `GOAL_NOT_REPRESENTED`. With zero existing Program sets, adding the exercise cannot satisfy v1's volume-neutral redistribution rule; the engine MUST NOT invent a starting prescription.

**PE1-7.3 — Under-support is relative.** `GOAL_EXPOSURE_LOW_RELATIVE_TO_USER_CONSTRAINT` MAY fire only against an explicit user/Program minimum requirement or an approved policy invariant. Analyzer exposure count alone does not establish low support.

**PE1-7.4 — Healthy progression wins.** Healthy exact-lift progression returns `no_change` even when the deadline is aggressive, unless a hard user constraint or invalid structure requires review.

**PE1-7.5 — One bad workout.** A single failed, partial, interrupted, or overridden workout returns `no_change` with `SINGLE_EXPOSURE_NO_PROGRAM_CHANGE` when inputs otherwise remain valid.

**PE1-7.6 — Repeated stall.** A satisfied PE1-6.6 stall MAY enter an allowlisted small-change rule. Stall alone does not choose volume, rep range, or frequency; the proposal-specific preconditions must identify the smallest justified operation.

**PE1-7.7 — Volume judgment.** PE v1 MAY propose only the narrow exact-exercise volume increase in Section 8. It MUST NOT diagnose globally low/high muscle volume or propose volume reduction from performance decline.

**PE1-7.8 — Rep-range judgment.** PE v1 MAY align an exact Goal exercise to an already approved compatible policy range when a demonstrated policy/Routine incompatibility or repeated stall rule calls for it. It MUST NOT invent an intensity phase or arbitrary new range.

**PE1-7.9 — Frequency/spacing judgment.** Frequency change MUST preserve exact-exercise sets per cycle in v1 and serve explicit distribution/practice or constraint repair. Spacing reordering requires an explicit spacing constraint; Analyzer spacing facts alone are descriptive.

**PE1-7.10 — Block review.** At a deterministic block boundary, healthy evidence yields `no_change` with `BLOCK_REVIEW_CONTINUE`. A successor proposal is permitted only when another decision family independently justifies an allowlisted change.

**PE1-7.11 — No empty successor.** `continue unchanged` is `no_change` in PE v1. The engine MUST NOT create an identical successor Program version merely to mark a review.

**PE1-7.12 — Smallest change.** When more than one proposal could satisfy the same rule, v1 MUST prefer the operation that changes the fewest exact prescriptions/slots and preserves cycle volume/topology, subject to deterministic tie-breaking. If still tied, return `unavailable` for user choice.

**PE1-7.13 — Goals precedence.** The Programming Engine MUST NOT react to a normal Goals `HOLD_PARTIAL` or first `ADJUST_REPEATED_MISS` by rewriting the Program. It waits for the Program-level gates in Section 6.

**PE1-7.14 — No deadline escalation.** A nearer deadline MAY change feasibility copy but MUST NOT break PE1-7.12, shorten stall thresholds, or increase the change cap.

**PE1-7.15 — Deterministic ties.** Stable identity ordering may select among semantically identical evidence references, but MUST NOT choose among materially different Program changes.

**PE1-7.16 — Long-horizon precedence.** Immediate load/rep progression inside the current Program belongs to Goals; PE v1 evaluates structural Program/Routine changes only after the applicable Program evidence and PE1-6.16 stall threshold are satisfied. Deadline distance or aggressiveness alone never forces a Program change. Healthy progression MUST return `no_change` even when the Goal remains distant or its deadline is aggressive.

**PE1-7.17 — Goal-policy range scope.** PE v1 MAY reference the active linked Goal's approved `4–6` strength-policy range only for that exact Goal exercise, only while the Goal is active and explicitly linked/relevant to the evaluated Program, and only in a PE slice that enables the corresponding proposal type. It MUST NOT apply that range to another exercise or to the Program as a whole. PE-1A does not enable rep-range changes.

## 8. V1 proposal allowlist

The allowlist is intentionally narrower than the future operation classes in Program Foundation.

| Proposal type | V1 status | Exact bounded meaning |
| --- | --- | --- |
| `increase_exact_exercise_working_sets` | Allowed in PE v1 contract | Add exactly one working set per cycle to one exact Goal exercise through one Routine successor |
| `align_exact_exercise_rep_range` | Allowed in PE v1 contract | Replace one exact Goal exercise prescription with that active linked Goal's already approved compatible policy range |
| `redistribute_exact_exercise_exposure` | Allowed in PE v1 contract | Add/remove one exact exercise exposure while preserving its total working sets per cycle |
| `create_routine_variant_for_typed_change` | Allowed only as auxiliary | Copy a repeated Routine version only when necessary so one selected slot can receive another independently justified allowlisted exact change |
| `reorder_slots_for_explicit_spacing_constraint` | Allowed in PE v1 contract | Reorder existing slots only to satisfy a recorded explicit spacing constraint |
| `begin_successor_block_with_changes` | Allowed only as wrapper | Package independently justified allowlisted changes at an approved future block boundary |
| unrestricted exercise substitution | Parked | No PE v1 substitution operation |
| performance-inferred volume reduction | Parked | No fatigue/high-volume diagnosis from current evidence |
| automatic deload/recovery block | Parked | Evidence and captured-signal contract insufficient |
| unrestricted topology/split generation | Parked | No free-form Program generator |
| Auto application | Parked | Review is the PE v1 authority ceiling; no automatic application |

### 8.1 Increase exact-exercise working sets

**PE1-8.1 — Required evidence.** This proposal requires an eligible exact Goal, exact Program/Routine/Analyzer facts, PE1-6.6 repeated stall, satisfied Goals-restoration prerequisite, deterministic block/cycle mapping, and no recent change cooldown.

**PE1-8.2 — Hard preconditions.** The exercise must already exist in the Program; the target occurrence and Routine prescription must be exact; Review authority must be on; and the approved policy must contain the `+1 set/cycle` cap.

**PE1-8.3 — Disqualifiers.** Missing provenance, healthy progression, ambiguous shared-Routine scope, explicit frequency/volume constraint violation, incompatible rep prescription, insufficient evidence, or any competing Goal resource conflict disqualifies the proposal.

**PE1-8.4 — Exact operation.** Create one successor Routine version adding one working set to the exact exercise in one selected cycle occurrence, and create one successor Program version pinning it. Total exact-exercise working sets increase by exactly one per cycle.

**PE1-8.5 — Unchanged invariants.** Exercise identity, load guidance, rep range, other exercises, slot order, cadence, Goal, active workout, and History remain unchanged.

**PE1-8.6 — Reason and stale behavior.** The trace uses `REPEATED_STALL` and `VOLUME_INCREASE_PROPOSED`. Any base Program/Routine/Goal/evidence digest change returns `STALE_BASE` and requires recomputation.

### 8.2 Align exact-exercise rep range

**PE1-8.7 — Required evidence.** This proposal requires an exact Goal policy with an approved compatible rep range, exact current Routine prescription, and either a deterministic Goal-guidance compatibility failure or PE1-6.6 repeated stall under a materially different range.

**PE1-8.8 — Hard preconditions.** The destination range MUST already be named in a versioned approved policy; EKF identity/basis must support the Goal; and the change must affect one exact exercise prescription only.

**PE1-8.9 — Disqualifiers.** Healthy progression, unspecified destination range, model-generated range, request for doubles/singles/phase cycling, or lack of a comparable baseline disqualifies the proposal.

**PE1-8.10 — Exact operation.** Create a successor Routine version replacing the exact exercise's rep target/range with the approved policy range, then create a successor Program version pinning it.

**PE1-8.11 — Unchanged invariants.** Exercise identity/order, working-set count, other prescriptions, Program topology/cadence, Goal target, active workout, and History remain unchanged.

**PE1-8.12 — Reason and stale behavior.** The trace uses `ROUTINE_GOAL_POLICY_INCOMPATIBLE` or `REPEATED_STALL` plus `REP_RANGE_ALIGNMENT_PROPOSED`. Any guarded input change invalidates the proposal.

### 8.3 Redistribute exact-exercise exposure

**PE1-8.13 — Required evidence.** This proposal requires an exact Goal exercise already represented in the Program, exact per-cycle exposure/set facts, available slot capacity under explicit training-frequency constraints, deterministic spacing facts, exact source prescription, and either explicit under-support or PE1-6.6 stall.

**PE1-8.14 — Hard preconditions.** The operation MUST change exposure count by exactly one per cycle and preserve the exercise's total working sets per cycle. Adding an exposure requires at least two existing sets to redistribute and a compatible destination Routine.

**PE1-8.15 — Disqualifiers.** The operation is unavailable when it would add total cycle volume, remove the exercise, exceed available training frequency, violate hard spacing/equipment constraints, duplicate the exercise inside one Routine, or require substitution/removal of another exercise.

**PE1-8.16 — Exact operation.** Create successor Routine version(s) that move one or more existing exact-exercise working sets between cycle occurrences, then create a successor Program version pinning them. The before/after diff MUST prove equal total sets per cycle.

**PE1-8.17 — Unchanged invariants.** Exact exercise identity, total sets per cycle, per-set rep range/load policy unless separately allowlisted, other exercises, cadence, Goal, active workout, and History remain unchanged.

**PE1-8.18 — Reason and stale behavior.** A proposal trace uses `GOAL_EXPOSURE_LOW_RELATIVE_TO_USER_CONSTRAINT` or `REPEATED_STALL`, plus `FREQUENCY_REDISTRIBUTION_PROPOSED`. An absent Goal exercise instead returns `unavailable` with `GOAL_NOT_REPRESENTED` under PE1-7.2. Guard mismatch invalidates the entire compound proposal.

### 8.4 Create Routine variant for a typed change

**PE1-8.19 — Auxiliary-only rule.** A/B creation MUST NOT be a standalone physiological judgment. It is permitted only when one immutable Routine version is pinned by multiple slots and another allowlisted operation must affect selected occurrence(s), not every shared occurrence.

**PE1-8.20 — Exact operation.** Copy the base Routine version into one successor Routine identity/version, preserve every field, apply only the companion allowlisted diff, and repin only the named Program slot(s) in the successor Program.

**PE1-8.21 — Naming restraint.** `A`/`B` labels are optional display metadata. Identity and operation semantics MUST NOT depend on those labels.

**PE1-8.22 — Disqualifiers and invariants.** A free-form variation, exercise substitution, unrelated prescription change, or copied mutable reference is disallowed. Unselected slots, active workout, and History remain unchanged; stale-base behavior follows the companion operation.

**PE1-8.32 — Necessity, not aesthetics.** A Routine variant is permitted only when it is the minimum auxiliary operation necessary to represent an independently justified typed Program change. For example, an exact Bench exposure redistribution may create `Push A` / `Push B` when one repeated Push Routine would otherwise duplicate Bench identically in both occurrences. `Create Push A/B for variety`, cleanliness, sophistication, or split preference without an independently justified companion change is forbidden.

### 8.5 Reorder slots for explicit spacing

**PE1-8.23 — Required evidence.** This proposal requires exact rolling/calendar slot order, Analyzer spacing facts, and a recorded hard user constraint expressed in deterministic intervening-session or calendar-time terms.

**PE1-8.24 — Hard preconditions.** A deterministic reorder of existing slots must satisfy the explicit constraint without changing slot membership, Routine pins, cycle length, or authoritative rolling advancement semantics.

**PE1-8.25 — Disqualifiers.** No proposal is allowed from a generic recovery intuition, session labels, muscle-role summary alone, unknown calendar cadence, or a reorder that creates another hard-constraint violation.

**PE1-8.26 — Exact operation.** Create a successor Program version with an explicit permutation of existing stable slot IDs. No Routine successor is created.

**PE1-8.27 — Reason and stale behavior.** The trace uses `EXPLICIT_SPACING_CONSTRAINT_VIOLATED` and `SPACING_REORDER_PROPOSED`. Any slot/Routine/cadence/constraint change invalidates the proposal.

### 8.6 Begin successor block with changes

**PE1-8.28 — Wrapper-only rule.** A reached block boundary permits packaging but does not justify a change. Every contained operation MUST independently satisfy its proposal rules.

**PE1-8.29 — Exact operation.** The proposal identifies the next block boundary and successor Program/Routine graph, with changes effective no earlier than that boundary and the next unmaterialized session.

**PE1-8.30 — Healthy boundary.** Healthy progress at the boundary returns `no_change` with `BLOCK_REVIEW_CONTINUE`; it does not create an identical successor.

**PE1-8.31 — Compound cap.** V1 MAY combine the auxiliary Routine-variant or successor-block wrapper with exactly one primary proposal family. It MUST NOT stack volume, rep-range, frequency, and spacing changes into one intervention.

### 8.7 PE-1A first runtime implementation slice

The full Section 8 allowlist is the approved PE v1 contract boundary. Capability package `PE-1A` is deliberately narrower so its first structural hypothesis can be observed before later PE v1 families are enabled.

**PE1-8.33 — PE-1A scope.** PE-1A MUST implement only `redistribute_exact_exercise_exposure` for one exact active linked Goal exercise, plus `create_routine_variant_for_typed_change` when that auxiliary operation is necessary to express the redistribution.

**PE1-8.34 — PE-1A exclusions.** PE-1A MUST NOT implement total cycle working-set increases or decreases, rep-range changes, slot reordering, unrestricted successor-block changes, exercise substitution, deloads, free-form topology generation, or Auto authority. Those operations remain either later capability-gated PE v1 families or explicitly parked work.

**PE1-8.35 — PE-1A change cap.** One proposal may change at most one exact linked Goal exercise; its exposure count delta MUST have absolute value `1` per Program cycle; its total exact-exercise working sets per cycle MUST be identical before and after; and it MUST contain one primary structural hypothesis. An auxiliary Routine variant needed to express that one redistribution is not a second primary change. Unrelated or compound Program changes are forbidden: one hypothesis, one structural change, then observe.

**PE1-8.36 — Safe-representation failure.** If the exact volume-neutral redistribution cannot be represented safely under PE1-8.35 while preserving every invariant and satisfying a deterministic destination/allocation rule, PE-1A MUST return `unavailable` rather than add volume, widen scope, substitute an exercise, or bundle another change.

**PE1-8.37 — PE-1A Review ceiling.** Every PE-1A proposal MUST state `userApprovalRequired: true` and `authorityCeiling: review`. No successor Routine or Program version may be created until the user explicitly approves a non-stale proposal. PE-1A MUST NOT implement Auto.

**PE1-8.38 — Deterministic set-allocation contract.** Before PE-1A can emit a redistribution proposal, its immutable capability policy MUST define a deterministic integer-set allocation method that maps the unchanged total cycle working sets to the exact post-change occurrences, including stable tie-breaking and preservation of per-set prescription semantics. A proposal MUST NOT hard-code or improvise a split outside that policy; if the method is absent, the result is `unavailable`.

**PE1-8.39 — Uneven totals.** The PE-1A allocation policy MUST explicitly define whether and how an uneven total is distributed across occurrences, including which stable occurrence receives any remainder. Until that method is approved, an uneven allocation is `unavailable`; the engine MUST NOT round, add, or remove a working set.

**PE1-8.40 — Exposure-direction capability.** The full PE v1 redistribution cap permits an exposure delta of `+1` or `-1`, but the PE-1A capability package MUST explicitly declare enabled directions. Until the initial reduction rule and its evidence trigger are approved, PE-1A enables only the canonical `+1` stalled-exercise experiment; a `-1` request is `unavailable` rather than inferred from poor performance.

## 9. Stable reason-code families

**PE1-9.1 — Codes are semantic API.** Reason-code meaning is stable within the contract version. Copy may improve without changing the code's rule meaning.

| Family | Stable reason codes |
| --- | --- |
| Input/safety | `PROFILE_SCOPE_MISMATCH`, `INVALID_BASE_PROGRAM`, `MISSING_ROUTINE_PIN`, `ANALYZER_UNAVAILABLE`, `ANALYZER_STALE`, `STALE_BASE` |
| Evidence | `INSUFFICIENT_COMPARABLE_EVIDENCE`, `INCOMPATIBLE_EVIDENCE_IDENTITY`, `BLOCK_PROVENANCE_UNAVAILABLE`, `GOAL_PRIORITY_CONFLICT` |
| Goal/structure | `GOAL_NOT_REPRESENTED`, `GOAL_EXPOSURE_LOW_RELATIVE_TO_USER_CONSTRAINT`, `ROUTINE_GOAL_POLICY_INCOMPATIBLE`, `EXPLICIT_SPACING_CONSTRAINT_VIOLATED` |
| No change | `PROGRESSION_HEALTHY_NO_CHANGE`, `SINGLE_EXPOSURE_NO_PROGRAM_CHANGE`, `BLOCK_REVIEW_CONTINUE`, `DEADLINE_DOES_NOT_CHANGE_PRESCRIPTION` |
| Stall | `REPEATED_STALL`, `GOALS_RESTORATION_NOT_YET_TESTED`, `CHANGE_COOLDOWN_ACTIVE` |
| Proposal | `VOLUME_INCREASE_PROPOSED`, `REP_RANGE_ALIGNMENT_PROPOSED`, `FREQUENCY_REDISTRIBUTION_PROPOSED`, `ROUTINE_VARIANT_REQUIRED`, `SPACING_REORDER_PROPOSED`, `SUCCESSOR_BLOCK_PROPOSED` |
| Parked | `EXERCISE_SUBSTITUTION_OUT_OF_SCOPE`, `VOLUME_REDUCTION_EVIDENCE_UNAVAILABLE`, `DELOAD_OUT_OF_SCOPE`, `AUTO_AUTHORITY_OUT_OF_SCOPE` |

**PE1-9.2 — Ordered trace.** Every result MUST provide an ordered trace of evaluated gates, facts used, rule outcomes, exclusions, and terminal reason. The primary code is not a substitute for the trace.

**PE1-9.3 — No-change trace.** `no_change` MUST identify positive justification, not merely `no rule fired`.

**PE1-9.4 — Unavailable trace.** `unavailable` MUST distinguish missing data, incompatible data, unapproved product policy, out-of-scope operation, and staleness.

**PE1-9.5 — Proposal trace.** Each operation MUST reference the terminal proposal code and the antecedent Goal/constraint/stall codes that justified it.

**PE1-9.6 — Evidence exclusions.** Excluded workouts/sets MAY be summarized, but the reason each was excluded must be reproducible and inspectable.

**PE1-9.7 — PE-1A experimental trace.** Every PE-1A proposal MUST retain the exact Goal exercise and Goal ID; base Program and complete Routine-version IDs; pre-change and post-change exposure counts; total exact-exercise cycle sets before and after; stall evidence references; the Goals local-adjustment event and post-adjustment opportunity references; primary and antecedent reason codes; exact typed operations; policy/capability versions; and approval/stale guard fields. The before/after cycle-set values MUST match.

**PE1-9.8 — Disposition and outcome linkage.** When a later authorized UI/application unit exists, it SHOULD retain the proposal's approved, rejected, or later disposition and SHOULD link any later measured outcome window to the immutable proposal and accepted successor identities without rewriting the original trace or performed History.

**PE1-9.9 — Trace is not a model.** The PE-1A trace is groundwork for deterministic before/after feedback-loop analysis. It MUST NOT create, train, imply, or grant authority to a Strength Knowledge model.

## 10. Proposal review and version application

**PE1-10.1 — Analyze immutable base.** The engine analyzes one immutable Program version, its complete pinned Routine versions, exact Analyzer result, eligible Goals, constraints, and cutoff-bounded evidence.

**PE1-10.2 — Show exact review.** Plan shows the result, affected Goal, exact before/after diff, why, evidence used/excluded, conservative expected effect, caveats, authority, version identities, and effective boundary.

**PE1-10.3 — User disposition.** The user may `Approve`, `Reject`, or `Later`. Only `Approve` proceeds to application.

**PE1-10.4 — Recheck stale base.** Approval MUST atomically compare every stale-guard field with current source state. Any mismatch returns `STALE_BASE`; no partial successor may be created.

**PE1-10.5 — Create Routine successors first.** Approval creates every exact immutable Routine successor required by typed operations, retaining predecessor, author kind, proposal ID, and version note.

**PE1-10.6 — Create Program successor.** Approval then creates one immutable Program successor that pins the new Routine versions/slot order, retains unchanged pins, records predecessor/proposal/reason metadata, and remains reviewable before activation when required by Program Foundation.

**PE1-10.7 — Future-only effect.** The successor becomes effective only for future unmaterialized sessions at the approved boundary. The active workout remains frozen.

**PE1-10.8 — History protection.** Completed workouts and their derived interpretation remain untouched. Proposal/application metadata MUST NOT be inserted into past workouts by guesswork.

**PE1-10.9 — Atomicity.** Application creates the complete successor graph or none of it. A half-created Routine/Program successor state is invalid.

**PE1-10.10 — Rejection retention.** Rejection MAY retain proposal ID, base IDs, reason trace, disposition time, and optional user note without changing planning or performed facts.

**PE1-10.11 — Rollback.** Rollback selects/copies prior accepted structure into another future-effective successor. It never mutates old versions or rewrites sessions/history.

**PE1-10.12 — Recompute after edit.** Any user Program/Routine/Goal/constraint edit after proposal evaluation requires recomputation; manual silent rebasing is forbidden.

**PE1-10.13 — Successors require a real diff.** A successor Program or Routine version represents a real approved structural or prescription change. A block review that retains the current structure is `no_change`, continues the current Program version, and MUST NOT mint an empty-diff successor.

Flow:

`immutable base -> deterministic result -> Plan diff/reason -> Approve | Reject | Later -> stale check -> Routine successor(s) -> Program successor -> future unmaterialized sessions`

## 11. Plan proposal UI contract

**PE1-11.1 — Placement.** Programming review belongs in Plan on the canonical Program/version surface, not Train, Progress, History, or Library.

**PE1-11.2 — Required summary.** A proposal card MUST show proposal type, affected Goal/exercise, what changes, why now, exact before/after prescription, evidence window, and future-effective boundary.

**PE1-11.3 — Required detail.** Expanded review MUST show base/successor Program and Routine identities, all operations, reason trace, included/excluded evidence, constraints, policy versions, invariant checklist, and stale warning.

**PE1-11.4 — Conservative effect copy.** UI copy MUST state the structural effect, not promise adaptation. Example: `Bench remains 6 sets per cycle, distributed across two exposures instead of one.`

**PE1-11.5 — Actions.** The primary actions are `Approve`, `Reject`, and `Later`. Approval copy MUST say that successor versions affect future sessions only.

**PE1-11.6 — Stale state.** A stale proposal disables approval and presents `Program changed — recompute this review`; it MUST NOT offer blind apply.

**PE1-11.7 — No motivational filler.** Proposal copy SHOULD avoid vague coaching language such as `optimize`, `smarter`, `crush your goal`, or `your body needs`. It should name exact facts and limits.

**PE1-11.8 — No-change UI.** `no_change` SHOULD show the positive reason, evidence window, and next review trigger without manufacturing a successor or approval action.

**PE1-11.9 — Unavailable UI.** `unavailable` SHOULD show the failed gate and concrete evidence/setup action when available, without implying that a change is probably needed.

## 12. Future model separation

**PE1-12.1 — Versioning.** A future Strength Knowledge model must be versioned independently from the engine rule package and Analyzer.

**PE1-12.2 — Baselines.** A future model must be benchmarked out of sample against simple declared baselines relevant to its prediction before it may influence a proposal.

**PE1-12.3 — Hard-rule precedence.** Model output MUST NOT override identity, ownership, evidence eligibility, immutable-version, active-workout, History, authority, change-cap, or stale-base rules.

**PE1-12.4 — Influence disclosure.** If a future model influences a proposal, the trace/explanation MUST identify model/version, exact output, benchmark context, rule use, and uncertainty semantics.

**PE1-12.5 — No narrative model authority.** A language model may render faithful prose after the decision, but it is not a Strength Knowledge predictor and cannot satisfy PE1-12.2.

**PE1-12.6 — Fallback.** A model-dependent rule must define a deterministic no-model fallback of `no_change` or `unavailable`; it must never silently substitute an LLM opinion.

## 13. Worked deterministic examples

### Example 1 — Bench supported twice and progression healthy

Inputs: active Bench Goal `250 lb`; exact Bench appears in two cycle slots; Analyzer reports the exact exposure/set/spacing facts; recent comparable Goals outcomes include a valid rep or load progression event; no hard constraint is violated.

Result: `no_change`. Primary reason `PROGRESSION_HEALTHY_NO_CHANGE`. The explanation states that the current Program supports two Bench exposures and completed evidence is progressing under the existing next-exposure policy. No operation or approval action exists.

### Example 2 — Repeated Bench stall with one exposure

Inputs: active exact Bench Press Goal `250 lb`, explicitly linked to the evaluated Program; an eligible topology with one exact Bench exposure per cycle; exact total Bench cycle working sets known; **4 consecutive exact comparable Bench exposures without progress spanning at least 2 completed Program cycles**; at least **2 of those opportunities occurred after Goals repeated-miss/local adjustment had a chance to restore progression**; current Bench prescription has at least two working sets; and an existing compatible destination Routine/slot satisfies all constraints.

Result: PE-1A emits one Review-only `redistribute_exact_exercise_exposure` proposal for exact Bench Press. The proposal changes Bench from one to two exposures per cycle (`+1`), redistributes the **same** known total Bench working sets across those positions, and changes neither rep range nor total volume nor exercise identity. If a repeated Routine cannot express distinct selected occurrences, the proposal may add the minimum auxiliary Routine variant and `ROUTINE_VARIANT_REQUIRED`; it may not create A/B for variety. Reasons include `REPEATED_STALL` and `FREQUENCY_REDISTRIBUTION_PROPOSED`. Exact set splits are intentionally not shown: PE1-8.38 requires the PE-1A implementation contract to supply the deterministic allocation method, and the result is `unavailable` until it does.

Canonical explanation payload concept: `Bench progression remained stalled across four comparable exposures, two Program cycles, and two post-adjustment opportunities. The current Program exposes Bench once per cycle. Proposal: redistribute the same Bench working-set volume across two exposures. Total cycle Bench volume remains unchanged. Approval required.`

### Example 3 — Aggressive deadline, healthy progress

Inputs: active Bench Goal `250 lb` with a near deadline; current exact Program support is valid; recent comparable evidence includes progress.

Result: `no_change` with `PROGRESSION_HEALTHY_NO_CHANGE` and `DEADLINE_DOES_NOT_CHANGE_PRESCRIPTION`. A separate deterministic Goal outlook may state feasibility context, but the engine does not increase sets, loads, frequency, or magnitude.

### Example 4 — Goal exercise absent

Inputs: eligible Goal exercise absent from the Program.

Result: `unavailable` with `GOAL_NOT_REPRESENTED`. Because the Program contains zero existing sets for that exercise, PE v1 cannot add an exposure while preserving exact-exercise cycle volume. The engine does not invent a starting prescription or substitute a related exercise. A later user-authored Program review may establish the initial prescription, after which PE v1 can evaluate it.

### Example 5 — One bad workout

Inputs: the last Bench exposure is a clear miss, partial, interruption, or override; no longer-horizon stall threshold is met.

Result: `no_change` with `SINGLE_EXPOSURE_NO_PROGRAM_CHANGE`. Goals next-exposure logic handles hold/adjustment. Programming Engine does not rewrite the Program.

### Example 6 — Healthy block boundary

Inputs: deterministic block boundary reached; current Program valid; comparable progression healthy; no hard constraint violation.

Result: `no_change` with `BLOCK_REVIEW_CONTINUE`. The current immutable Program version remains active; PE v1 does not create an identical successor solely to record continuation.

### Example 7 — Stale proposal

Inputs: a valid Bench proposal was emitted from Program v3/Routine pins A3+B2; the user edits or activates a different Program/Routine/Goal/constraint state before approval.

Result at approval: `unavailable`/application rejection with `STALE_BASE`. No successor is created. Plan asks to recompute from the new base.

## 14. Explicitly parked work

**PE1-14.1 — Exercise substitution.** PE v1 has no unrestricted or narrow substitution rule. EKF similarity/taxonomy and equipment data do not by themselves prove an individualized substitute.

**PE1-14.2 — Deload.** PE v1 has no automatic deload, recovery-week, cessation, or reduced-load block generator.

**PE1-14.3 — Volume decrease.** PE v1 does not infer excessive volume or propose set reduction from missed targets, e1RM trend, adherence, or Analyzer set counts.

**PE1-14.4 — Free-form generation.** PE v1 does not create a Program from scratch, choose a named split, add arbitrary exercises, or optimize topology.

**PE1-14.5 — New signals.** RPE/RIR, velocity, pain, readiness, sleep, soreness, nutrition, technique, medical/rehabilitation, and injury-risk inference remain outside this contract.

**PE1-14.6 — Infrastructure.** This contract authorizes no schema v6, local-storage key, Supabase table/column, RLS policy, queue/sync entity, production-data inspection, or deployment.

**PE1-14.7 — Existing behavior frozen.** Goals progression, Program Analyzer math, Train materialization, routine editing, History tools, Progress calculations, e1RM formula, profile isolation, backup, and cloud behavior remain unchanged.

## 15. PE-1A implementation decisions and remaining boundary

The stall constants, auxiliary A/B authority, full v1 allowlist, narrower PE-1A scope, block-continuation behavior, change caps, Review ceiling, exact-Goal `4–6` scoping rule, and the following allocation rules are approved and implemented in the immutable `pe-1a-volume-neutral-exposure-redistribution.v1.0.0` capability package:

1. **OQ-PE1-7 resolved — Deterministic set allocation.** For `S` total cycle sets and `E` post-change exposures, `base = floor(S / E)` and `remainder = S mod E`. Allocation follows authoritative rolling Program position.
2. **OQ-PE1-8 resolved — Uneven total handling.** The earliest `remainder` positions receive `base + 1`; all later positions receive `base`. This is a deterministic tie-breaker only. `6 → 3+3`, `7 → 4+3`, `5 → 3+2`, and `8 → 4+4`. Any result below the existing Routine minimum is `unavailable`.
3. **OQ-PE1-9 remains parked — Exposure reduction.** PE-1A enables only `+1`. A `-1` request is typed `unavailable`; no reduction trigger exists.

`BigGainsProgrammingEngine.evaluate({ programVersion, routineVersions, programAnalysis, goals, performanceEvidence, goalProgressionEvidence, catalog, options? })` is pure, deterministic, DOM-free, network-free, and persistence-free. It returns a deeply immutable `no_change | proposal | unavailable` result with policy/capability versions, deterministic digest/ID, exact version pins, Goal/exercise scope, reason trace, evidence references, stall/cycle/post-adjustment gate detail, stale guard, allocation, typed operations, successor diff payload, approval boundary, and downstream explanation payload. `checkStaleBase(...)` provides the same exact Program/Routine/Goal guard for a later application transaction.

Plan renders the result on the canonical Program surface. Eligible evidence shows the complete proposal and `Approve / Reject / Later`. PE-1C enables Approve only for the supported PE-1A proposal when a preliminary freshness pass succeeds and no application is running. Approval uses an inline final confirmation; Reject and Later remain view-local and persist no facts.

PE-1B adds one explicit `Start next Program session` path from Today/Plan. It materializes the exact pinned Routine, snapshots `programOrigin`, and commits rolling advancement only with successful workout completion. `slotIndex` is zero-based; `cycleNumber` is one-based. Repeated starts/resume do not advance, missed weekdays do not skip, and wrap increments `completedCycles` once. Completion copies origin unchanged. The evidence adapter derives completed-cycle proof from the full compatible origin-bearing History sequence. Existing manual and retrospective workouts remain valid but have no origin; no label, weekday, exercise list, or legacy record is provenance-backfilled. Real proposals remain unavailable until enough newly proven evidence exists.

## 15.1 PE-1C atomic application implementation

`BigGainsProgrammingEngineApplication.plan(...)` is the pure validation/construction boundary. `apply(...)` re-reads the authoritative schema-v5 profile document immediately before commit, recomputes PE-1A through a validation port, and requires the exact same proposal ID and input digest. It supports only `redistribute_exact_exercise_exposure` plus its necessary `create_routine_variant_for_typed_change` companion. Unknown status, type, contract, policy, capability, operation, profile scope, topology, Goal identity/lifecycle/linkage, active Program/version, complete Routine pin set, current Routine head, exposure/set assumption, successor graph, Analyzer/evidence digest, or sequence state fails closed as `stale`/`STALE_BASE` or `unavailable`; application never fuzzy-repairs or recalculates a different diff.

All successor Routine versions and the successor Program version are constructed and normalized in memory first. Existing immutable versions remain in capture. Stable Routine and Program identities are preserved except for the proposal-authorized auxiliary Routine identity; versions are monotonic, predecessor-linked, explicitly user-approved, and repin only the two typed target slots. Rep targets, total exact-exercise cycle sets, slot order, rolling cadence, optional weekday anchors, Goal links, block policy, and Review authority remain unchanged.

The current schema-v5 profile document is the single local transaction boundary. PE-1C snapshots its exact raw value, writes the complete successor capture once, re-reads and validates it, and restores the exact raw snapshot if the write throws or readback differs. No Routine successor is independently persisted. A successful trace is additive inside local-only `programCapture.applicationTraces`; it records proposal/digest, exact Goal/exercise, base/new Program and Routine versions, before/after exposure and set counts, allocation, exact typed operations, reason/version metadata, approval time, disposition, and the future-effective boundary. Program capture remains outside cloud entities and Supabase.

With no active Program workout, the successor carries forward the base logical `nextSlotIndex` and completed-cycle count. Approval does not advance either value. With an exact active base-Program workout, the successor retains that same pending position and records the frozen workout ID at its effective boundary. Successful completion of that exact predecessor-origin workout advances the successor once; final-slot completion wraps and increments the completed-cycle count once. Discard leaves the slot pending, and a mismatched or duplicate completion cannot advance it. The active workout and its `programOrigin` never change. Manual active workouts carry no Program completion forward. Thus the successor is authoritative only for future unmaterialized sessions without repeats or skips while preserving completion-only cadence.

Application identity is deterministic from the proposal input digest. A confirmed retry finds the approved trace and returns `applied` with `ALREADY_APPLIED` and `idempotent: true` instead of creating another successor. A failed transaction that verified rollback retains no trace/successor and can be retried safely. PE-1C adds no proposal intelligence, `-1` direction, rep-range or total-volume change, substitution, deload, Auto authority, History rewrite, schema bump, Supabase change, or Strength Knowledge behavior.

## 16. Research notes and sources (informative)

These sources support broad constraints, not Big Gains constants:

- Higher-load prescriptions rank highly for 1RM strength, while many resistance-training prescriptions improve strength: [Currier et al., 2023, PMID 37414459](https://pubmed.ncbi.nlm.nih.gov/37414459/) and [Carvalho et al., 2022, PMID 35015560](https://pubmed.ncbi.nlm.nih.gov/35015560/).
- Periodized volume-equated training has a small overall 1RM advantage over non-periodized training, without establishing one universal periodization form: [Moesgaard et al., 2022, PMID 35044672](https://pubmed.ncbi.nlm.nih.gov/35044672/).
- Frequency effects are uncertain when volume is equated, and newer dose-response analysis suggests diminishing returns and important direct/indirect-set distinctions: [Grgic et al., 2018, PMID 29470825](https://pubmed.ncbi.nlm.nih.gov/29470825/) and [Pelland et al., 2026, PMID 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/).
- Weekly set volume has a dose-response association with strength, but effect sizes and useful doses vary by population and training status: [Ralston et al., 2017, PMID 28755103](https://pubmed.ncbi.nlm.nih.gov/28755103/) and [Pelland et al., 2026, PMID 41343037](https://pubmed.ncbi.nlm.nih.gov/41343037/).
- Reviews of autoregulation versus standardized loading differ in their pooled conclusions and include limited heterogeneous samples, supporting explicit observed-performance rules rather than a claim of universal superiority: [Hickmott et al., 2022, PMCID PMC8762534](https://pmc.ncbi.nlm.nih.gov/articles/PMC8762534/) and [Zhang et al., 2021, PMID 33776802](https://pubmed.ncbi.nlm.nih.gov/33776802/).
- Direct deload evidence remains sparse and protocol-specific. One randomized trial of a one-week cessation deload found no strength advantage and greater strength improvement with continuous training: [Coleman et al., 2024, PMID 38274324](https://pubmed.ncbi.nlm.nih.gov/38274324/).

The approved stall threshold, change caps, policy range use, result precedence, and allowlist are transparent Big Gains product heuristics. The cited literature did not validate those exact constants.

## Appendix A — Documentation-unit validation

The documentation unit is complete only when:

- every changed file is Markdown;
- `git diff --check` passes;
- all `PE1-*` requirement IDs are unique;
- all local Markdown links resolve;
- no runtime, schema, Supabase/RLS, synchronization, or production-data file changes;
- no PR, merge, release, or deployment; and
- only genuine consequential implementation decisions remain visible to the user.
