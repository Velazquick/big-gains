# Big Gains Goals v1 specification

- Status: **Proposed documentation-only normative contract**
- Contract version: **1.0.0-draft**
- Baseline: `main` at EKF-3 merge `1a9f0a36a07b953b84e134977e983483260785f7`
- Runtime status: **Not implemented**

This document defines the first bounded strength-goal contract for Big Gains. It builds on the production architecture in [ARCHITECTURE.md](ARCHITECTURE.md), the accepted exercise and measurement semantics in [EXERCISE_KNOWLEDGE_FOUNDATION.md](EXERCISE_KNOWLEDGE_FOUNDATION.md), and the completed-history/local-first authority in [SYNC_SEMANTICS.md](SYNC_SEMANTICS.md). It does not authorize feature code, a storage migration, a Supabase change, a release, or deployment.

## 0. Contract language and precedence

**G1-0.1 — Normative terms.** The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are normative requirements. Unqualified examples and explanatory text are informative.

**G1-0.2 — Stable requirement IDs.** `G1-*` IDs are stable citations. An implementation and its tests SHOULD cite the requirements they satisfy. Existing IDs MUST NOT be renumbered; a changed requirement receives a new ID and the superseded ID remains documented.

**G1-0.3 — Safety precedence.** Exact performed facts, completed-history authority, EKF measurement meaning, explicit user authorization, and conservative unavailability take precedence over producing a recommendation or maintaining a progression streak.

**G1-0.4 — Existing-contract precedence.** If this document appears to conflict with EKF identity/measurement rules or the synchronization authority contract, EKF and `SYNC_SEMANTICS.md` win. A Goals implementation MUST resolve the conflict in design rather than weakening those contracts.

**G1-0.5 — Documentation-only boundary.** This unit MUST change documentation only. Schema v5, local storage, active/completed workout payloads, the cloud queue, Supabase tables/RLS, the 155-exercise EKF-3 catalog, service-worker assets, runtime behavior, and production deployment MUST remain unchanged.

## 1. Scope and non-scope

**G1-1.1 — Strength-first scope.** Goals v1 defines exercise-scoped maximal-strength destinations and a small deterministic policy that can recommend a future weight-and-repetition target. It is not a generic goals platform.

**G1-1.2 — Initial metric.** The only v1 goal metric is `one_rep_max`: a target one-repetition strength value for one exact exercise and its EKF-declared e1RM comparison basis. No second metric is justified for v1.

**G1-1.3 — Eligible exercises.** A v1 strength goal MAY target only an exact canonical exercise whose EKF contract permits e1RM with `entered_load` or `combined_external_load`, known compatible load/rep semantics, and the `load_reps` tracking model. Assistance, machine-indicated, reps-only, duration, distance, unsupported bodyweight, unknown, and effective-system-load goals are excluded from v1.

**G1-1.4 — Exercise scope.** A goal MUST reference one exact exercise identity. Family, variant, and alias relationships MAY help selection but MUST NOT transfer a goal, merge evidence, or substitute another movement.

**G1-1.5 — Explicit non-scope.** V1 does not define cardio, endurance, body-composition, weight-loss, hypertrophy-volume, mobility, wellness, or habit goals; personalized e1RM/response models; RIR/RPE; velocity; historical bodyweight resolution; machine-instance capture; custom exercise authoring; social features; or medical/rehabilitation recommendations.

**G1-1.6 — No calendar staircase.** A goal MUST NOT create a frozen schedule such as “add 5 lb every Monday” or infer that a target date authorizes faster loading. The next recommendation depends on completed evidence and policy rules, not elapsed week number.

## 2. Goal identity, model, and lifecycle

### 2.1 Conceptual record

**G1-2.1 — Stable goal identity.** Each goal MUST have a stable, profile-scoped ID independent of its title, target value, exercise name, or display order. Goal identity MUST NOT become exercise identity.

**G1-2.2 — Minimum conceptual model.** A future v1 implementation MUST be able to represent the following concepts without requiring them to be stored in this exact shape:

| Concept | V1 meaning |
| --- | --- |
| `goalId` | Stable profile-scoped goal identity |
| `status` | `active`, `paused`, `completed`, or `archived` |
| `exerciseId` | Exact permanent exercise identity resolvable through EKF compatibility |
| `metric` | Exactly `one_rep_max` |
| `targetValue` / `unit` | Positive target and explicit compatible unit/basis label |
| `targetDate` | Optional planning context; never automatic loading authority |
| `baselineEvidence` | References to qualifying observed sets/sessions plus a derived capacity summary and calculation metadata |
| `policy` | Versioned `strength_double_progression_v1` policy and its resolved configuration |
| `guidanceEnabled` | Separate explicit authorization to affect future Train cards |
| `progressionState` | Last issued decision, target, evidence cutoff, outcome state, and reason code needed for deterministic continuation |
| `attainmentState` | Separate `in_progress`, `estimated_reached`, or `achieved` state with the exact evidence references that justify it |
| lifecycle timestamps | Created, updated, paused, completed, and archived times as applicable |

The existing profile `goals` object and synchronized goals preference are compatibility facts, not approval of a final storage shape. This design creates no new schema or cloud entity.

**G1-2.3 — Observed versus inferred fields.** Baseline/current evidence MUST distinguish observed facts (workout, set, load, reps, time, and measurement basis) from inferred values (for example e1RM and a capacity range). A UI MUST NOT present an inferred value as a performed max.

**G1-2.4 — Versioned policy.** The policy identifier and its resolved parameters MUST be retained with each issued decision so the application can explain why it was produced after defaults change. A policy update MUST NOT reinterpret a prior decision as though it used the new rules.

### 2.2 Lifecycle

**G1-2.5 — Create.** Creating a goal requires an eligible exercise, metric, positive target value, and explicit unit/basis presentation. A timeframe is optional. Guidance MUST default to off and require a separate user action.

**G1-2.6 — Edit.** Target value, optional date, label, and policy configuration MAY be edited. Changing the target exercise or metric MUST archive the old goal and create a new goal identity so prior evidence and explanations keep their original meaning.

**G1-2.7 — Pause.** Pausing a goal MUST stop tracking prompts and all Train intervention. It MUST turn effective guidance off. Resuming returns the goal to `active` but MUST NOT silently restore Train authority; guidance must be enabled again explicitly.

**G1-2.8 — Guidance toggle.** `guidanceEnabled` is independent from goal status. Disabling it MUST leave the active goal and its evidence visible while preventing goal-derived prefills or recommendations. Enabling it affects only future eligible card construction unless the user explicitly applies a recommendation to the current session.

**G1-2.9 — Complete.** Completing a goal MUST retain its target, evidence summary, decision history, attainment state, and completion time, turn guidance off, and stop future recommendations. Completion MUST follow G1-2.13 through G1-2.16; an e1RM at/above target alone MUST NOT produce `achieved`.

**G1-2.10 — Archive.** Archiving removes a goal from the default overview and prevents guidance while preserving its record. Archived goals MAY be viewed in a compact history and MUST NOT affect Train.

**G1-2.11 — Remove.** The ordinary v1 “Remove” action MUST be non-destructive archive for any saved goal. An unsaved draft MAY be discarded. Hard-deleting saved goal history is outside v1 and MUST never delete or rewrite workouts, sets, PRs, or analytics.

**G1-2.12 — Concurrent identity rule.** At most one non-archived goal for the same exercise and metric may have guidance enabled. If invalid or legacy state produces more than one candidate, the resolver MUST fail closed for that card and require user choice; it MUST NOT arbitrate silently.

### 2.3 Attainment semantics

**G1-2.13 — Estimated reached.** An active goal enters `estimated_reached` when eligible recent performance evidence produces an e1RM at or above the target under EKF e1RM eligibility plus the v1 freshness and evidence-confidence rules in Section 8. This state describes inferred evidence, not a performed maximum.

**G1-2.14 — Achieved.** A goal enters `achieved` only when the user logs an eligible completed one-repetition working set at or above the target entered load for the exact goal exercise and compatible EKF measurement basis. No external verification workflow is required; the completed workout record is the authoritative fact source.

**G1-2.15 — No inferred promotion.** `estimated_reached` MUST NOT silently promote to `achieved`, manufacture a completed single, or imply that the target load was performed. The UI MUST keep the labels visually and linguistically distinct.

**G1-2.16 — Achievement transition.** When G1-2.14 is satisfied, the system MAY transition the goal to `achieved` from either `in_progress` or `estimated_reached`, retaining the qualifying completed-set reference. `achieved` takes precedence when the same evidence set also satisfies `estimated_reached`. The goal lifecycle may then complete according to G1-2.9; an inferred estimate is never substituted for that set reference.

## 3. Six separate responsibilities

**G1-3.1 — Goal is destination.** A goal answers “what outcome matters?” For example: Barbell Bench Press one-repetition strength target of 250 lb. It does not contain a frozen workout calendar.

**G1-3.2 — Progression policy is decision logic.** The progression policy answers “given the destination and evidence, what is the smallest justified next training step?” It owns decision rules and explanations but does not own exercise semantics or completed facts.

**G1-3.3 — Program/routine is planned structure.** A routine owns exercise membership, order, planned working-set count, and its saved rep target/range. A goal MUST NOT silently edit that structure.

**G1-3.4 — Train card is today.** A Train card is a session snapshot containing editable recommended values for today. It is neither the goal nor the saved routine, and a later goal edit MUST NOT rewrite an already-started session.

**G1-3.5 — Completed workout is fact.** A completed workout records what the user actually marked performed. Recommendation fields are never allowed to replace the entered load/reps or manufacture completed sets.

**G1-3.6 — Analytics/Progress is interpretation.** Analytics and Progress derive comparable history, e1RM evidence, and goal progress from completed facts through EKF. Derived interpretation MAY inform the next policy decision but MUST remain reproducible and non-authoritative over history.

## 4. Authority and precedence

**G1-4.1 — Precedence order.** For one workout card, authority is ordered as follows: (1) user edits and performed facts; (2) the already-created active-session snapshot; (3) saved routine structure; (4) an eligible goal-guidance overlay; (5) ordinary previous-performance seeding. A lower layer MUST NOT overwrite a higher layer silently.

**G1-4.2 — Exercise membership.** Goal guidance MUST NOT add its exercise to a routine, reorder a routine, or start a workout. It can act only when the user adds the exact exercise or the routine already includes it.

**G1-4.3 — Routine structure.** A saved routine's working-set count and rep target/range remain authoritative for automatic card construction. Goal policy MUST operate within their intersection with the policy's supported range.

**G1-4.4 — Compatible overlay.** When routine and policy constraints overlap, goal guidance MAY prefill exact working load/reps within that overlap and MUST preserve the routine's set count. An exact routine target such as `5` is an intersection of one value; after success, the next eligible action is load progression rather than a rep target outside `5`.

**G1-4.5 — Missing routine detail (superseded).** The earlier draft allowed Goals to supply a missing set count. G1-4.10 supersedes that permission: Goals v1 never invents working sets when Train is running from a saved routine.

**G1-4.6 — Conflict behavior.** If the routine and policy have no valid overlap, the goal MUST NOT prefill load or reps. The card retains ordinary routine/previous-performance behavior and shows `ROUTINE_CONFLICT` with a concise explanation. The saved routine remains unchanged.

**G1-4.7 — Explicit adoption only.** A user MAY explicitly apply a goal target to the current workout or explicitly update a saved routine in a separately labeled action. Applying to one workout MUST NOT mutate the routine; updating a routine MUST use the routine editor's ordinary local-first mutation path and MUST NOT alter the goal or history.

**G1-4.8 — Snapshot boundary.** A recommendation is resolved once when the exercise card is constructed, using evidence completed before the session/evidence cutoff. Current-session sets MUST NOT cause unrevealed mid-workout target changes.

**G1-4.9 — Manual edits win.** Editing a prefilled field makes the user's value authoritative for that set. Re-render, resume, goal sync, or policy evaluation MUST NOT restore the old recommendation over that edit.

**G1-4.10 — No invented routine sets.** When Train is running from a saved routine, the routine remains authoritative for the number of working sets. Goals MAY apply a compatible rep/load target to those sets, but MUST NOT supply, append, or remove working sets. If the saved routine has no safe compatible set structure, guidance fails closed and requires routine review.

**G1-4.11 — Use for today.** On a representable routine conflict, `Use for today` MAY explicitly apply the goal-guided target to the current workout snapshot only. It MUST preserve performed facts, MUST NOT mutate the saved routine, and MUST remain subject to existing workout editing rules.

**G1-4.12 — Review routine.** `Review routine` MUST show and explain the proposed persistent prescription change before any save. Saving requires an explicit user action through the routine editor's ordinary local-first path; Goals MUST NOT automatically mutate the routine.

**G1-4.13 — Unsafe conflict.** If either conflict action cannot be represented safely in the existing workout/routine structure, the resolver MUST fail closed and offer no goal-derived mutation.

## 5. Workout-card modes

**G1-5.1 — No goal.** With no active goal for the exercise, Train MUST behave as it does today: routine target and previous-performance seeding may display, but no goal badge, goal reason, goal-derived value, or implied progression appears.

**G1-5.2 — Goal tracked, guidance off.** Train MAY show a restrained `Goal tracked · Guidance off` link/status, but MUST NOT show a goal-derived workout target, progression instruction, success threshold, or goal prefill. Goals and Progress MAY show destination and evidence.

**G1-5.3 — Goal guidance on and eligible.** Train MAY prefill the resolved weight/reps, label it as a recommendation, show the applicable set target, and display one concise reason plus an expandable evidence explanation. All fields remain editable.

**G1-5.4 — Guidance on but blocked.** When evidence, EKF eligibility, identity, unit/basis, policy state, or routine compatibility is missing/invalid, Train MUST use ordinary non-goal behavior and show a blocked reason. It MUST NOT emit a zero, guess, stale recommendation, or fallback weekly increase.

**G1-5.5 — Card explanation.** An eligible guided card MUST answer both “what today?” and “why today?” Example messages include `Build strength-specific volume`, `Complete 5/5/5/5 to earn the next load`, `Hold this target; last attempt was partial`, and `Add 5 lb; the top of the rep range was completed`.

## 6. Inspectable reasoning pipeline

**G1-6.1 — Required inputs.** The resolver requires the goal destination; exact exercise and EKF measurement contract; guidance/status; routine constraints; policy version/configuration/state; eligible recent completed evidence; previous issued target and outcome when present; unit and supported load increment; and the session evidence cutoff.

**G1-6.2 — Decision order.** The resolver MUST evaluate in this order: authorization/status; exact identity and metric eligibility; measurement/unit compatibility; routine-policy compatibility; evidence sufficiency; prior-target outcome; current objective; bounded progression action; card snapshot; explanation. A failure at an earlier gate stops later inference.

**G1-6.3 — Deterministic output.** Identical normalized inputs and the same policy version/configuration MUST produce the same output. The output MUST contain either `recommendation` or `unavailable`, never an unexplained partial target.

**G1-6.4 — Recommendation shape.** A recommendation MUST identify exercise, target working sets, per-set or uniform target reps, entered-load target and displayed basis/unit, policy and reason code, evidence references/cutoff, routine constraints used, prior decision/outcome, and a human-readable explanation.

**G1-6.5 — Conservative failure.** Unknown, stale, incompatible, ambiguous, or insufficient required input returns `unavailable`; it MUST NOT be converted to zero, a guessed percent, a name-based exercise substitution, or a target-date-driven increase.

**G1-6.6 — One-step bound.** One evaluation MAY advance at most one policy action: add reps, add one supported load increment and reset reps, hold, or reduce one supported load increment after the repeated-miss rule. It MUST NOT stack missed calendar increments or leap several steps to “catch up.”

**G1-6.7 — Explainability detail.** The expanded explanation MUST expose the observed sessions/sets used, inferred e1RM values and formula/basis when used, the prior recommendation, actual outcome classification, routine-policy intersection, and exact rule that fired. It MUST label illustrative/inferred values.

**G1-6.8 — Stable decision and attainment codes.** V1 uses the following decision/attainment vocabulary; copy may improve without changing code meaning:

| Code | Meaning | Example concise message |
| --- | --- | --- |
| `ESTABLISH_BASELINE` | Valid starting evidence is not yet sufficient | `Log a comparable baseline first` |
| `BUILD_STRENGTH_VOLUME` | Initial/continuing target uses demonstrated load inside the strength rep band | `Build strength-specific volume` |
| `ADD_REPS` | All target sets succeeded below the top of the effective rep range | `Add one rep per set` |
| `ADD_LOAD_RESET_REPS` | All target sets reached the top of the effective rep range | `Add 5 lb and rebuild reps` |
| `HOLD_PARTIAL` | Comparable attempt was incomplete/partial but not a repeated clear miss | `Hold this target` |
| `ADJUST_REPEATED_MISS` | Two comparable clear misses justify one load decrement | `Reduce one step and rebuild` |
| `USER_OVERRIDE_REVIEW` | Actual performance was valid but not comparable to the issued target | `Your change is evidence; review the baseline` |
| `ROUTINE_CONFLICT` | Routine and policy targets do not overlap | `Goal target conflicts with this routine` |
| `EVIDENCE_UNAVAILABLE` | EKF/identity/unit/evidence gate failed | `A valid comparable baseline is required` |
| `ESTIMATED_REACHED` | Eligible fresh e1RM evidence is at/above the destination without a qualifying performed single | `Estimated target reached · No target single logged` |
| `ACHIEVED` | An eligible completed single at/above target exists for the exact exercise | `Target achieved · Completed single recorded` |

**G1-6.9 — Message integrity.** A reason message MUST describe the rule actually used. It MUST NOT claim recovery, fatigue, readiness, technique quality, or physiological adaptation without corresponding captured evidence.

**G1-6.10 — Decision trace retention.** The goal domain SHOULD retain a bounded decision trace sufficient to explain current progression and prior goal history. It MUST NOT embed that trace by rewriting completed workout facts or create an unbounded event platform in v1.

## 7. Initial policy: deterministic strength double progression

**G1-7.1 — One next-exposure policy family.** V1 supports one policy family, `strength_double_progression_v1`, for resolving today and the next comparable exposure. Custom policies, AI-generated plans, and program-level periodization are outside v1.

**G1-7.2 — Effective target.** The policy receives an effective working-set count from the compatible current workout or saved-routine structure and resolves an inclusive strength rep range after applying Section 4 precedence. It then issues one uniform entered-load target and a rep target for each existing working set; it does not invent the count.

**G1-7.3 — Current objective.** The policy objective is one of `establish_baseline`, `build_strength_volume`, `earn_next_load`, or `adjust_and_rebuild`. The objective is derived from destination gap/context, evidence sufficiency, and prior outcome; it is not selected by week number.

**G1-7.4 — Starting target.** A first recommendation MUST prefer the most recent stable observed comparable working load in or near the effective rep range. It MUST NOT increase merely because the distant goal is higher or infer an untried heavier load from e1RM alone. The anchor must satisfy Section 8 and, when a saved routine is active, must fit its authoritative set structure.

**G1-7.5 — Success classification.** A comparable success requires the recommended number of completed working sets at the recommended load, with every set meeting or exceeding its recommended reps under the same exercise/basis. Extra reps above target are evidence but do not authorize more than one next action.

**G1-7.6 — Add reps.** After comparable success below the top of the effective rep range, the next target keeps load and set count and adds one rep to each target set, capped at the range maximum. The reason is `ADD_REPS`.

**G1-7.7 — Add load.** After comparable success at the top of the effective rep range, the next target adds exactly one supported load increment, preserves set count, and resets reps to the effective range minimum. The reason is `ADD_LOAD_RESET_REPS`.

**G1-7.8 — Hold.** A partial, incomplete, or otherwise ambiguous comparable attempt repeats the same target. One missed set, fewer logged sets, or an interrupted workout MUST NOT cause an automatic regression. The reason is `HOLD_PARTIAL`.

**G1-7.9 — Clear miss and adjustment.** A clear miss requires a complete comparable attempt at the recommended load in which more than half of the prescribed working sets finish below the effective lower rep bound. Only two consecutive clear misses at the same target justify reducing one supported load increment and rebuilding from the lower rep bound. The reason is `ADJUST_REPEATED_MISS`.

**G1-7.10 — User deviation.** A session performed at a materially different load, set count, or rep scheme is valid evidence but not a comparable policy outcome. V1 MUST hold the existing target and surface `USER_OVERRIDE_REVIEW` until the user explicitly adopts a new baseline or a later comparable attempt resolves the target.

**G1-7.11 — No v1 volume reduction or deload inference.** V1 does not automatically remove working sets, prescribe a deload, or diagnose fatigue. Those decisions require signals and program authority not present in the current data. The v1 regression action is limited to one load decrement under G1-7.9.

**G1-7.12 — No automatic phase shift.** V1 uses one configured strength rep range and MUST NOT automatically switch into doubles/singles or another intensity phase. A later strength-specific phase model may use capacity proximity and repeated evidence, never calendar position, but belongs to a separate reviewed extension.

**G1-7.13 — Generic rep-range default.** When a new 1RM goal needs a generic strength-oriented working range and no compatible explicit routine range exists, v1 uses `4–6` reps. This is a product default informed by evidence favoring higher loads (commonly defined in the cited reviews as at least 80% 1RM or seven or fewer reps) for 1RM strength; it is not a universal physiological law or an instruction to override a routine.

**G1-7.14 — Set-count boundary.** Goals v1 defines no generic working-set count. It operates on a compatible user-created/current workout structure or the saved routine's existing working sets; otherwise it returns unavailable and asks the user to establish or review the routine baseline.

**G1-7.15 — Load increment and rounding.** A recommended load MUST be rounded to an exercise/equipment increment that can actually be loaded. When an exact calculated or converted target falls between valid increments, v1 MUST prefer the conservative/downward increment unless that would violate an already-demonstrated exact observed anchor.

**G1-7.16 — Long-horizon boundary.** Double progression is not a complete model from current strength to a distant 1RM destination. V1 answers `today → next comparable exposure` with add reps, add one load increment plus rep reset, hold, or conservative adjustment. It MUST NOT claim that repeating these steps alone maps the full route to the destination.

**G1-7.17 — Future Programming/Strength Planning authority.** A separately reviewed, versioned Programming/Strength Planning layer MAY later alter rep ranges, intensity objectives, blocks/phases, or deload strategy across longer horizons. Goals v1 MUST expose a policy/decision extension boundary for that layer while preserving routine authority, completed facts, attainment semantics, and the prohibition on a calendar staircase.

## 8. Current-capacity evidence

**G1-8.1 — Facts first.** Eligible completed working sets from the exact exercise are the primary evidence. Warm-ups, incomplete sets, current-session sets, another exercise/family, and rewritten/normalized loads MUST NOT enter the decision.

**G1-8.2 — EKF gate.** E1RM evidence is eligible only through EKF-6: completed working set, 1–12 whole reps, positive declared load basis, known compatible semantics, explicitly permitted exercise, and reproducible formula metadata. Failure means unavailable, not zero.

**G1-8.3 — Comparison scope.** Evidence must share canonical exercise identity, unit, e1RM load basis, compatible EKF content meaning, and formula version. Per-hand, per-side, combined external, machine-indicated, and effective-system values MUST NOT be mixed.

**G1-8.4 — Recent evidence set.** V1 uses the last three comparable eligible exposures within a maximum 42-day lookback and retains the exact included/excluded reasons. `Three within 42 days` is a product freshness/sufficiency heuristic, not a physiology claim or permission to rewrite older completed history.

**G1-8.5 — No single-estimate truth.** One e1RM MUST NOT be called current true capacity. Goal detail SHOULD present an evidence range/trend or multiple recent estimates, with the latest observed set alongside them.

**G1-8.6 — Decision role of e1RM.** In v1, e1RM supports destination-gap context, capacity sanity checks, and `estimated_reached`. It MAY help calibrate current capacity but MUST NOT independently trigger a working-load increase. Double-progression actions are earned by completed comparable target sets, not by an e1RM fluctuation alone.

**G1-8.7 — Observed anchor.** The working-load anchor MUST identify the actual comparable set series that demonstrated it. A best single set does not by itself prove the ability to complete the policy's full working-set target.

**G1-8.8 — Baseline insufficiency.** If no recent evidence demonstrates a safe starting target for the effective set/rep structure, guidance MUST return `ESTABLISH_BASELINE` and no goal-derived prefill. The user may log ordinary work or explicitly set/adopt a baseline.

**G1-8.9 — Evidence edits/deletes.** When retrospective history is edited or deleted, derived capacity and future decisions MUST recompute from the corrected source facts. Prior recommendation traces MAY retain that they used the former evidence, but MUST be visibly stale and MUST NOT rewrite the corrected history.

**G1-8.10 — No new model.** V1 MUST reuse the existing rounded Epley v1 evidence exposed by canonical analytics. It MUST NOT introduce a personalized e1RM estimator, hidden readiness score, or learned response model.

**G1-8.11 — Fewer than three exposures.** When fewer than three eligible comparable exposures exist inside 42 days, the resolver MAY use the available evidence conservatively if it still demonstrates an unambiguous compatible working-load anchor. It MUST disclose the smaller evidence set and MUST NOT manufacture sufficiency from an e1RM estimate.

**G1-8.12 — Sparse or ambiguous evidence.** When the available evidence is too sparse, stale, internally inconsistent, or structurally incompatible to justify a prescription, guidance MUST fail closed with `ESTABLISH_BASELINE` and ask the user to establish or explicitly confirm a baseline.

**G1-8.13 — Stable working-load preference.** If recent eligible sets already demonstrate stable work in or near the compatible target range, calibration MUST begin from that observed load rather than increasing it because the target 1RM is distant. A single exceptional set MAY inform the sanity check but does not replace comparable set-series evidence.

## 9. Illustrative bench-press walkthrough: why this load, these reps, today

The following numbers illustrate the policy mechanics. Assume:

- exact exercise: Barbell Bench Press;
- destination: 250 lb one-repetition strength;
- guidance: enabled;
- compatible routine: 4 working sets in a 4–6 rep range;
- supported load increment: 5 lb;
- the last three comparable eligible exposures fall within 42 days and contain stable working sets around 190 lb;
- all numbers are illustrative policy mechanics, not medical advice, physiological guarantees, or promises of reaching 250 lb.

**G1-9.1 — Example A: hold the observed load and build reps.** Suppose the routine already defines four working sets and recent comparable work is approximately `190 × 5` across that structure. The next target is `190 lb × 5 reps × 4 sets`, reason `BUILD_STRENGTH_VOLUME`. Goals holds 190 because it is the stable observed working load and asks the user to accumulate the top of the compatible `4–6` range before any increase. The distant 250 lb destination does not authorize an immediate jump.

The card can say:

> 190 lb × 5 × 4 — Hold the demonstrated working load and build within 4–6. Complete the target across the routine's four working sets; reaching 6/6/6/6 earns one load step next time.

**G1-9.2 — Example B: earn one increment and reset reps.** If the user completes `190 × 6/6/6/6` with acceptable comparable performance, every routine-prescribed set reached the top of the range. The next comparable exposure is `195 × 4/4/4/4`, reason `ADD_LOAD_RESET_REPS`: one valid 5 lb increment is earned, and reps reset to the lower bound. It does not skip to 200 or add a missed calendar step.

**G1-9.3 — Example C: hold or adjust after misses.** If the first complete comparable attempt at `195 × 4/4/3/3` is partial, the next target remains `195 × 4/4/4/4`, reason `HOLD_PARTIAL`. If two consecutive complete comparable attempts at the same target satisfy G1-7.9's clear-miss definition, the next target may conservatively return one load step to `190 × 4/4/4/4`, reason `ADJUST_REPEATED_MISS`. One miss, an interrupted workout, or a new week never triggers an automatic increase or regression.

**G1-9.4 — Example D: estimate crosses 250 without a target single.** Later, suppose an eligible fresh set such as `215 × 5` yields rounded Epley v1 e1RM evidence of about 251 lb, while no eligible completed `250 × 1` exists. The attainment state becomes `estimated_reached`, not `achieved`. The UI must say that the estimate crossed the destination and that no 250 lb single was logged.

**G1-9.5 — Example E: completed target single.** If the user completes and logs an eligible `250 × 1` working set for the exact Barbell Bench Press measurement basis, the completed workout fact satisfies G1-2.14 and the attainment state becomes `achieved`. No external verification step is required.

**G1-9.6 — Override branch.** If the user instead performs a materially different load or rep scheme, those values remain valid performed facts and evidence. V1 does not silently reinterpret the policy state or rebase mid-workout; after completion it MAY show `USER_OVERRIDE_REVIEW` with `Update future progression from this performance?` as an explicit action.

**G1-9.7 — Explanation integrity.** Every example explanation MUST identify the observed evidence, the routine structure that supplied set authority, the `4–6` product default or compatible explicit range, the exact progression rule, and any inferred e1RM separately from performed facts.

## 10. Overrides, logging, and local-first behavior

**G1-10.1 — Recommendations are editable.** Every recommended load and rep value is an editable prefill. A user MAY perform more, less, different work, skip sets, add sets, or remove the exercise under existing workout rules.

**G1-10.2 — Actual performance only.** Completing a set stores the actual displayed/entered values under the exercise's EKF measurement meaning. The recommendation MUST NOT be copied over an edited value or stored as though performed.

**G1-10.3 — Deviations are evidence.** A deviation is neither an error nor a failed workout. The policy classifies whether it is comparable; all valid completed facts remain available to history/analytics regardless of that classification.

**G1-10.4 — Local-first mutation.** Goal create/edit/pause/complete/archive/toggle and any explicit recommendation application MUST persist locally before any outbound capture, return control without depending on Auth/cloud availability, and remain isolated to the active profile.

**G1-10.5 — No new sync path.** A future implementation SHOULD extend the existing goal-preference source boundary if it can do so compatibly; it MUST NOT create a second queue, bypass the existing goals preference identity, weaken RLS, or synchronize derived e1RM/Progress as independent source entities.

**G1-10.6 — Explicit rebasing only.** V1 MUST NOT silently rebase future progression from a user deviation. Actual performance remains unchanged and may inform evidence; adopting it as the future progression baseline requires an explicit user action.

**G1-10.7 — Post-completion offer.** After workout completion, the system MAY offer `Update future progression from this performance?` when the deviation is materially relevant. Declining or ignoring the offer preserves the current goal path; accepting records an explicit new baseline decision without rewriting the completed workout.

**G1-10.8 — No mid-workout rewrite.** A deviation during the current workout MUST NOT trigger hidden rebasing, rewrite the current goal path, or replace the already-created card snapshot. Any review occurs after completion or through an explicit user-initiated action.

## 11. Goals information architecture

**G1-11.1 — Contained page model.** V1 has one Goals overview and one goal-detail view (page, sheet, or dialog), with no nested strategy/settings hierarchy. The exact primary-navigation entry is an open UI decision in Section 15.

**G1-11.2 — Overview.** The overview shows active strength goals first: exercise, destination, observed/inferred progress label, status, optional date, guidance state, and next/blocked reason. It also provides `Create strength goal` and one collapsed `Past goals` area for completed/archived goals.

**G1-11.3 — Goal detail.** Detail contains destination and metric basis, status/lifecycle actions, the separate `Use this goal to guide workouts` control, current observed and inferred evidence, current policy/objective, next target or blocked reason, expanded “Why this target?” trace, optional timeframe, and edit/archive actions.

**G1-11.4 — Train card.** Train shows only what is needed now: recommended set/load/reps, an editable treatment, one reason sentence, the earning/hold rule, and a link/expander for evidence. Policy configuration, lifecycle history, and long analytics do not belong on the card.

**G1-11.5 — Progress relationship.** Progress remains evidence-first. It MAY show the destination line and link to goal detail on the exact exercise, but MUST NOT become a second goal editor or recompute a separate goal state.

**G1-11.6 — Empty and blocked states.** Empty Goals invites one strength goal without implying Train control. Blocked states name the missing action: select eligible exercise, log/adopt baseline, resolve routine conflict, correct unit/identity, or re-enable guidance.

### 11.1 Navigation design comparison (final choice open)

The current shell has exactly five bottom destinations: `Today`, `Train`, `Calendar`, `Progress`, and `Library`. Goals answers **“Where am I going?”** while Progress answers **“How am I doing?”** They should cross-link, but Goals MUST remain a destination/planning concept rather than a subsection silently buried inside Progress. A sixth cramped bottom-navigation item is not the default.

| Option | Concrete entry pattern | Advantages | Tradeoffs |
| --- | --- | --- | --- |
| **A — Today launch into a full Goals hub (recommended for review)** | A visible Goals card/shortcut on Today opens the complete Goals overview; exact-exercise Progress and guided Train cards deep-link to the same goal detail. | Preserves five bottom destinations; keeps destination-setting near the daily home surface; maintains Goals as its own contained hub and Progress as evidence. | Discoverability depends on a strong Today treatment; users may expect a persistent primary-tab entry. |
| **B — Reframe Library as Plan** | Rename/restructure `Library` as a `Plan` destination with peer entries for Goals and Routines/Library, each opening its own overview. | Creates a durable planning home without six tabs; makes Goals and routine/program structure visibly related but separate. | Larger information-architecture change; risks confusing existing Library habits and requires careful routine-authority copy. |
| **C — Primary-navigation utility launcher** | Add a clearly labeled Goals entry to a top-level utility/profile/overflow launcher while retaining contextual links from Today, Train, and Progress. | Minimal bottom-nav disruption and clear conceptual separation from Progress. | Lowest persistent visibility; adds a navigation layer and may make goal creation feel secondary. |

**G1-11.7 — Navigation recommendation status.** Option A is the recommended direction for user review because it preserves the current five-destination shell and gives Goals a full hub without conflating it with Progress. This is a design recommendation only; the final navigation choice remains OPEN and no runtime implementation is authorized.

**G1-11.8 — Cross-link consistency.** Regardless of the chosen entry, Today, Train, and exact-exercise Progress MAY link to the same canonical goal detail. Those links MUST NOT create separate goal state, editors, or attainment calculations.

## 12. Safety and invariants

**G1-12.1 — No history rewrite.** Goals MUST NOT rewrite, backfill, normalize, delete, or field-merge completed workouts, sets, PR keys, retrospective identities, notes, or timestamps.

**G1-12.2 — No hidden authority.** No goal may affect Train unless it is active, guidance is explicitly enabled, and every resolver gate passes. Profile default goal copy such as `Strength and performance` is not authorization.

**G1-12.3 — No invalid recommendation.** Required missing/invalid evidence, unknown EKF semantics, incompatible basis/unit, ambiguous identity, or multiple applicable guided goals MUST yield no goal recommendation.

**G1-12.4 — No infrastructure changes.** Goals v1 design requires no schema version change, migration, Supabase access/mutation, RLS change, durable-queue change, service-worker release change, or deployment.

**G1-12.5 — Profile isolation.** A goal and every decision/evidence reference are scoped to exactly one profile. Evidence from Jorge, Alexa, an independent account, another local namespace, or another account MUST NOT cross that boundary.

**G1-12.6 — Optional timeframe safety.** A target date is context only. Passing it MUST NOT archive, fail, regress, accelerate, or complete a goal. The UI MAY invite the user to edit the date or target.

**G1-12.7 — Unsupported claims.** Copy MUST describe product policy and observed evidence, not promise that a prescription will cause the target, claim optimality, or diagnose readiness/injury/fatigue.

## 13. Parked extension points

**G1-13.1 — Explicitly parked work.** The following require separate contracts and are not v1 acceptance criteria: personalized e1RM/response fitting; RIR/RPE or velocity-aware autoregulation; movement-family goals; historical bodyweight/effective-system goals; machine-instance comparison; deload intelligence; program-level periodization/intensity phases; policy-generated routine rewrites; and arbitration among multiple goals competing for session/program resources.

**G1-13.2 — Extension boundary.** Future work MAY add new metrics, policies, phases, or scopes only with versioned semantics, evidence/uncertainty behavior, migration compatibility, and explicit authority rules. It MUST preserve exact goal, exercise, workout, policy-history, and attainment meaning.

**G1-13.3 — Programming handoff.** The Goals resolver SHOULD expose normalized destination, observed evidence references, current attainment state, routine constraints, and prior decision trace through a versioned boundary that a future Programming/Strength Planning layer can consume. That layer must return an explicit versioned objective/constraint proposal; it does not gain authority to rewrite workouts, routines, or history.

**G1-13.4 — Long-horizon honesty.** Until that separate layer exists, Goals UI and explanations MUST NOT present double progression as a complete long-range program, forecast a guaranteed date, invent future phases, or claim a deterministic path from 190 lb working sets to a 250 lb single.

## 14. Acceptance criteria for a future implementation unit

**G1-14.1 — Contract tests.** A future implementation MUST include deterministic unit tests for every resolver branch/reason code, routine intersection/conflict and both safe actions, authorization mode, `4–6` fallback, no invented set count, three-exposure/42-day evidence selection, insufficient evidence, exact exercise/basis filtering, explicit override rebasing, conservative load rounding, one-step bound, and repeated-miss behavior.

**G1-14.2 — Integration tests.** Browser coverage MUST prove all three card modes; editable prefills; routine preservation; active-session snapshot stability; ordinary behavior when blocked; local-first save failure handling; reload; offline use; profile isolation; and no completed-history rewrite.

**G1-14.3 — Evidence tests.** Tests MUST cover EKF e1RM eligibility/ineligibility, 1–12 rep gating, formula/basis display, warm-up/incomplete exclusion, one-estimate caution, retrospective edit/delete recomputation, and exact evidence cutoff.

**G1-14.4 — Lifecycle tests.** Tests MUST cover create with guidance off, edit, exercise-change archive/new identity, pause/resume without restored authority, explicit guidance toggle, `estimated_reached` without achievement, achieved from an exact eligible completed single, no silent state promotion, archive/remove semantics, and invalid duplicate guided goals failing closed.

**G1-14.5 — Compatibility tests.** Schema remains v5; current goal defaults and backups normalize; existing routines, active workouts, completed workouts, History, Progress, PRs, cloud goals preference, queue semantics, recovery, RLS, and independent-user isolation remain compatible.

**G1-14.6 — UX acceptance.** In usability review, a user must be able to answer: what is my destination, is guidance controlling this card, what should I do now, why was it chosen, what earns the next change, and what happens if I do something else.

**G1-14.7 — Release boundary.** Passing implementation tests does not authorize a PR, merge, Supabase mutation, release, or deployment. Those remain separately approved actions.

## 15. Decisions and open product questions

### 15.1 Decisions fixed by this draft

- V1 is exact-exercise, strength-only, and `one_rep_max` only.
- Guidance is a separate opt-in and defaults off.
- Routine structure wins automatic precedence; conflict fails closed and never edits the routine.
- Goals never invents a working-set count for a saved routine; safe conflicts may offer explicit `Use for today` and `Review routine` actions.
- The initial policy is deterministic double progression with add reps, add one load step/reset reps, hold, and repeated-miss load adjustment.
- Double progression resolves today and the next comparable exposure; it is not the complete long-horizon route to a distant 1RM goal.
- Automated volume reduction, deloads, and intensity-phase shifts are excluded from v1.
- E1RM is supporting evidence, not true capacity and not the direct progression trigger.
- Eligible fresh e1RM evidence at/above target produces `estimated_reached`; only an eligible completed single at/above target on the exact exercise produces `achieved`.
- The generic strength range is `4–6`; the evidence-selection heuristic is the last three comparable eligible exposures within 42 days; both are versioned product heuristics rather than universal physiology claims.
- Starting load prefers recent stable observed comparable work, and non-loadable targets round conservatively/downward to a valid equipment increment.
- User-entered performance remains authoritative and deviations remain valid evidence.
- Override rebasing is explicit and post-completion; there is no hidden mid-workout rebase.
- Saved-goal removal is non-destructive archive in v1.
- A future Programming/Strength Planning layer may own longer-horizon blocks, phases, intensity objectives, or deload strategy through a versioned extension boundary.

### 15.2 Remaining open product question

**OQ-5 — Where does Goals enter navigation?** The existing app has five primary destinations: Today, Train, Calendar, Progress, and Library. Review Options A–C in Section 11.1. Option A (a visible Today launch into a full Goals hub, with contextual deep links) is recommended, but the final choice remains open. Goals must remain conceptually distinct from Progress, and a sixth cramped bottom destination is not the default.

OQ-1 through OQ-4 are resolved by this revision. OQ-5 does not block review of the architecture, safety, attainment, or progression-policy contract, but it does block freezing the primary navigation implementation.

## 16. Evidence notes and references (informative)

The evidence below supports broad strength-prescription principles, not the exact Big Gains policy constants:

- Currier et al. found that all studied resistance-training prescriptions improved strength versus no exercise and that higher-load prescriptions (reported as greater than 80% 1RM in the abstract and grouped at or above 80% in the network) maximized strength gains. This supports a strength-specific higher-load bias, not one mandatory percentage or set/rep scheme. [Currier et al., 2023, PMID 37414459](https://pubmed.ncbi.nlm.nih.gov/37414459/).
- Carvalho et al. found superior dynamic-strength gains from higher loads when volume load was matched; their high-load category was at least 80% 1RM or seven or fewer reps. This informs the `4–6` product default without proving that `4–6` is universally optimal. [Carvalho et al., 2022, PMID 35015560](https://pubmed.ncbi.nlm.nih.gov/35015560/).
- Moesgaard et al. reported a small overall 1RM advantage for periodized versus non-periodized volume-equated training, with context-dependent findings across periodization comparisons and no basis for treating one exact scheme as universally superior. This supports the need for a future long-horizon Programming/Strength Planning boundary; it does not justify inventing a universal phase scheme in Goals v1. [Moesgaard et al., 2022, PMID 35044672](https://pubmed.ncbi.nlm.nih.gov/35044672/).
- Hickmott et al. found similar 1RM improvements between autoregulated and standardized load prescription in resistance-trained participants, while Zhang et al. reported an advantage for autoregulation in a smaller athlete-focused literature. Together, the mixed evidence supports using observed performance and conservative explicit rules rather than pretending one fixed percentage is always correct day to day. [Hickmott et al., 2022, DOI 10.1186/s40798-021-00404-9](https://doi.org/10.1186/s40798-021-00404-9); [Zhang et al., 2021, PMID 33776802](https://pubmed.ncbi.nlm.nih.gov/33776802/).

The `4–6` generic range, the last `3` comparable exposures within `42` days, conservative/downward increment rounding, and the exact double-progression/repeated-miss rules are transparent v1 product heuristics. They are not claims that the cited literature validated those exact constants, and they must remain versioned, explainable, and reviewable.

## Appendix A — Repository mapping (informative)

- `state-persistence.js` currently normalizes a profile-derived `goals` preference inside schema v5 and preserves supported extra fields.
- `cloud-shadow.js` and the sync contracts treat goals as the singleton `preferences/goals` source record; derived PR/e1RM/Progress values are not independent source entities.
- `routine-engine.js` owns saved exercise order, working-set count, and rep targets without workout mutation.
- `workout-session-controller.js` constructs Train exercises from routine prescription plus exact prior performance and persists actual completed sets.
- `workout-controls.js` renders editable active-card inputs, routine targets, and prior-performance context.
- `analytics.js` interprets completed working sets through EKF and exposes exact exercise history, previous performance, and rounded Epley v1 only when eligible.
- `progress.js` presents derived exercise history/e1RM evidence and does not own source workout data.
- `retrospective-workout.js` can add/edit completed facts and recomputes derived PRs without a parallel history store.
