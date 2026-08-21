# Big Gains Product IA / Navigation Map v1

- Status: **product IA locked; documentation/design only**
- Audited production base: `e002ebf4893054145850d4586ef11358758d6e96`
- Release marker: `v87-program-1a-canonical-routine-capture`
- Target branch: `docs/product-ia-navigation-v1`
- Related contracts: [Architecture](ARCHITECTURE.md), [Program Foundation v1](PROGRAM_FOUNDATION_V1.md), [Goals v1](GOALS_V1_SPEC.md), and [Exercise Knowledge Foundation](EXERCISE_KNOWLEDGE_FOUNDATION.md)

This document defines where Big Gains concepts belong, how users move among them, and how the current production shell can migrate without a giant rewrite. It does not authorize navigation, UI, runtime, persistence, schema, Supabase, RLS, sync, production-data, release, or deployment changes.

## 0. Contract and invariants

**IA1-0.1 — Documentation-only boundary.** This unit MUST change Markdown only. It MUST NOT alter schema v5, Supabase, RLS, synchronization, Program or Goals behavior, Train, active sessions, completed workouts, production data, assets, service-worker behavior, or deployment state.

**IA1-0.2 — Conceptual destination is not placement.** `Today`, `Plan`, `Train`, `Progress`, and `Library` define the product's top-level mental model. A conceptual destination does not automatically require an immediate persistent bottom-navigation tab.

**IA1-0.3 — Model separation.** UI simplification MUST NOT merge Goal, Program, Routine version, Exercise, Workout/session, History, or derived Progress models. Connective presentation and routing may compose them without changing ownership.

**IA1-0.4 — Source authority.** Completed Workout facts remain the source of History; Progress and future Strength Knowledge remain derived interpretation. Planning surfaces MUST NOT manufacture, rewrite, or backfill performed facts.

**IA1-0.5 — Explicit planning authority.** Programming authority remains `Off`, `Review`, and reserved future `Auto`. The UI MUST explain what each mode may propose or apply and MUST NOT duplicate this setting across Goal, Program, and Train.

**IA1-0.6 — Honest capability.** A surface MUST NOT present generation, analysis, adaptation, deload logic, or personalized intelligence before its deterministic engine and evidence boundary exist.

## 1. User-facing mental model

| Destination | User question | Concise language | Owns |
| --- | --- | --- | --- |
| **Today** | What am I doing now? | **Next action** | Next workout/current plan summary, active-session entry, immediate Goal-guided targets, current Program context, reminders and near-term actions |
| **Plan** | What am I working toward and how? | **What I am working toward and how** | Goals, active Program, setup/editor/review, Goal–Program links, priority lifts, authority, block/cycle overview |
| **Train** | Let me execute. | **Execution** | Workout preview/materialization, active session, logging, rest timer, editable Goal-guided recommendations, minimal-distraction workout mode |
| **Progress** | Is this working? | **Evidence / is it working** | History, strength trends, Goal progress, Program/block performance, muscle/exercise analytics, future Insights |
| **Library** | What can I use or build with? | **Building blocks** | Exercise Library, reusable Routines, Program templates, and other reusable saved building blocks |

**IA1-1.1 — Today is action-first.** Today MUST prioritize the next useful action and summarize, rather than edit, Goal and Program context.

**IA1-1.2 — Plan connects destination and route.** Plan MUST present Goals and Program as connected peer concepts: Goals state the destination; Program states the route. Each retains its own identity, lifecycle, rules, and detail surface.

**IA1-1.3 — Train is focused execution.** Train MUST keep setup, long-form analytics, policy configuration, and Library management outside the active-session experience while preserving an obvious return to an active session.

**IA1-1.4 — Progress is evidence-first.** Progress MUST make completed History the factual base for exercise trends, Goal trajectory, Program/block evaluation, and future Insights. It MUST NOT become another planning editor.

**IA1-1.5 — Library is reusable content.** Library MUST contain reusable/reference content, including Program templates and reusable saved building blocks. The active Program, drafts under active review/editing, and archived/inactive personal Program versions MUST live in Plan or its history/archive; Library MUST NOT become the general owner for all Program lifecycle states.

**IA1-1.6 — Locked product mental model.** Product hierarchy and user-facing explanations MUST preserve this model: `Today = next action`, `Plan = what I am working toward and how`, `Train = execution`, `Progress = evidence / is it working`, and `Library = building blocks`. Within Plan, `Goal = destination` and `Program = route`.

## 2. Current production inventory

### 2.1 Current routes and entry points

| Current surface | Current entry | What it currently contains | IA observation |
| --- | --- | --- | --- |
| Today (`viewToday`) | Persistent tab; initial view | Session selector, planned-session start, Goals card, training companion, momentum metrics | Correct home, but it duplicates Train-start choice and Progress metrics without current Program connective context |
| Goals (`viewGoals`) | Today Goals card; explicit Back to Today | Active/past Goals, create Goal, Goal detail/actions | Standalone model is sound; discovery and cross-links are weak because Today is the only primary entrance |
| Train (`viewTrain`) | Persistent tab; Today start; Library load/add | Routine preview, active workout, timer, logging, Goal guidance | Correct execution home; pre-session selection overlaps Today and Library |
| Calendar (`viewCalendar`) | Persistent tab | Month of completed workouts, selected-day History, retrospective logging | Semantically a History explorer, not an independent product purpose |
| Progress (`viewProgress`) | Persistent tab | Exercise progress, three-session recent History, History archive entry, bodyweight | Correct evidence home, but History is split between this view, Calendar, dialogs, and completion review |
| Library (`viewLibrary`) | Persistent tab; active-workout browsing | Routine selection/loading, routine editor, quick exercise add, exercise browse, Program Setup, backup/restore, profile-specific plans | Mixes reusable content, Program planning, Train launch, and data/settings responsibilities |
| Program Setup | Card inside Library → modal flow | Canonical Routine review/capture and Program pinning | Acceptable implementation bridge for v87; no active Program destination or natural Goal/Today cross-link |
| History archive/detail | Progress preview/archive, Calendar day, workout completion | Newest-first archive and shared completed-workout detail; edit/delete | Shared detail is good; entry model is fragmented and dialog depth varies by origin |
| Routine editor | Library → modal | Exercise order, working sets, rep targets, add exercise | Correct reusable-content ownership, but exercise selection is another native select and the modal can become a nested-flow trap |
| Profile/settings | Global topbar profile switcher; Library data card; separate auth/setup shell | Profile selection, install action, JSON backup/restore, account bootstrap | Profile switching is correctly global; backup/restore is semantically misplaced and no coherent secondary Settings destination exists |

**IA1-2.1 — Existing shell fact.** Production currently exposes exactly five persistent destinations: `Today`, `Train`, `Calendar`, `Progress`, and `Library`; `Goals` is a non-persistent contextual view.

**IA1-2.2 — Bottom-nav crowding.** The current navigation is already at the practical mobile maximum. Plan MUST replace, consolidate, or remain contextual before it becomes persistent; it MUST NOT be added as a sixth peer.

**IA1-2.3 — Calendar duplication.** Calendar and Progress/History read the same completed Workout facts and open the same detail. Their current separation creates two competing answers to “where is my training history?”

**IA1-2.4 — Program orphan.** Program Setup can create canonical planning objects but production provides no primary active Program page, no Plan hub, and no visible Goal ↔ Program ↔ Today traversal.

**IA1-2.5 — Goals orphan.** Goals has a valid standalone hub but is reached primarily from one Today card and does not yet feel like the destination half of a connected planning system.

**IA1-2.6 — Library overload.** Library currently mixes reusable exercises/routines, Program setup, workout launch/add actions, profile-specific weekly presentation, and backup/restore. These are distinct browse, plan, execute, and settings jobs.

**IA1-2.7 — Exercise-selection duplication.** Quick add, full Library browse, Routine editor, Program Setup, Goals, and retrospective entry use different select/search patterns. Contextual ranking is not consistently labeled, and interaction knowledge does not transfer.

**IA1-2.8 — Start-path duplication.** Today, Train, and Library can all lead into session creation or modification. Migration MUST name Today as the default next-action launch, Train as the execution surface, and Library as a source of optional building blocks.

**IA1-2.9 — Secondary-navigation gap.** Profile selection belongs globally, while backup/restore, account, install, and future preferences need a coherent secondary utility/Settings route rather than occupying Library content hierarchy.

## 3. Target navigation model

### 3.1 Patterns evaluated

| Pattern | Persistent model | Benefits | Tradeoffs | Assessment |
| --- | --- | --- | --- | --- |
| **A. Five persistent destinations** | `Today / Plan / Train / Progress / Library`; Calendar becomes a Progress/History view | Exactly matches the mental model, keeps five-item density, makes planning discoverable, removes Calendar/History duplication | Requires a credible Plan landing before replacing Calendar and retraining current Calendar users | **Recommended target** |
| **B. Four tabs + contextual Plan** | `Today / Train / Progress / Library`; Plan entered from Today and Library/utility links | Lowest shell churn and can ship before an Active Program page exists | Planning remains easier to miss; Goals and Program can continue to feel secondary | Useful migration state, not the preferred end state |
| **C. Center Train action + four destinations** | `Today / Plan / Train / Progress / Library` with Train visually emphasized or raised | Preserves the five concepts and emphasizes the app's core action | Visual prominence can imply creation rather than navigation, complicate active-location semantics, and reduce label space | Optional visual treatment after the route model is proven |

**IA1-3.1 — Required end state.** Big Gains MUST eventually expose five persistent destinations: `Today`, `Plan`, `Train`, `Progress`, and `Library`, with Plan replacing Calendar and Calendar moving into Progress → History.

**IA1-3.2 — Safe migration state.** Production MUST retain the current `Today / Train / Calendar / Progress / Library` placement until Plan meets the minimum landing contract. It MUST NOT rename Calendar to Plan while showing only a placeholder or relocate users without an equivalent History path.

**IA1-3.3 — Plan promotion gate.** Plan MUST NOT replace Calendar until it can show at least active Goals, current or draft Program state, clear cross-links among them, and a useful next planning action. Program intelligence is not required for this minimum.

**IA1-3.4 — Train visual treatment.** A centered or emphasized Train control is a presentation option, not a different information architecture. It MUST still have a visible label, clear selected state, and stable navigation behavior.

**IA1-3.5 — No overflow for primary concepts.** Once the target shell ships, none of the five primary concepts SHOULD be hidden only inside a generic “More” menu.

### 3.2 Target route map

These paths are product-level route identities. A future implementation may use hashes or another router, but deep-link and back behavior should preserve the same hierarchy.

| Destination | Target route | Child surfaces |
| --- | --- | --- |
| Today | `/today` | Current Program/Goal summary; next session/action; active-session return |
| Plan | `/plan` | `/plan/goals`, `/plan/goals/:goalId`, `/plan/programs/new`, `/plan/programs/:programId`, `/plan/programs/:programId/versions`, `/plan/routines/:routineVersionId` |
| Train | `/train` | `/train/session/:workoutId`; focused workout mode is a presentation state of the same session |
| Progress | `/progress` | `/progress/history`, `/progress/history?view=calendar`, `/progress/workouts/:workoutId`, `/progress/exercises/:exerciseId`, future `/progress/programs/:programId` |
| Library | `/library` | `/library/exercises`, `/library/exercises/:exerciseId`, `/library/routines`, `/library/routines/:routineId`, optional `/library/program-templates` for reusable Program templates |
| Secondary utility | `/settings` | Profile/account context, backup/restore, install/app settings; not a sixth primary destination |

**IA1-3.6 — Route ownership.** Every nested route MUST select the owning primary destination: Goal and active Program routes select Plan; History, Calendar, workout detail, and analytics routes select Progress; reusable content routes select Library.

**IA1-3.7 — Stable object identity.** Detail links MUST use stable Goal, Program, Program-version, Routine-version, Exercise, or Workout identifiers rather than display labels or list positions.

**IA1-3.8 — Contextual entrances.** Today, Train, Progress, and Library MAY deep-link into another destination's canonical detail, but MUST NOT render parallel editors or create a second source of state.

## 4. Calendar and History

**IA1-4.1 — Calendar placement.** Calendar MUST become a secondary `Calendar` view within Progress → History, paired with a `List` view over the same completed Workout source. Its existence today is not a reason to preserve it as a top-level destination.

**IA1-4.2 — One History concept.** Recent sessions on Progress, the full archive, Calendar view, workout completion review, and workout detail MUST all be entrances into one History concept and one canonical Workout detail.

**IA1-4.3 — Retrospective logging.** `Log workout` MAY remain available from a selected past/current Calendar day and History empty/action states. It is a fact-entry action, not evidence that Calendar needs primary-tab status.

**IA1-4.4 — Planning-calendar separation.** A future Program schedule view in Plan MUST represent intended/upcoming slots and cadence; Progress Calendar represents performed History. The two MUST use distinct language and MUST NOT imply a planned slot was completed.

**IA1-4.5 — Today calendar scope.** Today MAY show a near-term planned session, rest day, or reminder and link to Plan. It SHOULD NOT duplicate the full completed-workout Calendar.

**IA1-4.6 — Migration continuity.** When Calendar leaves persistent navigation, the replacement Progress surface MUST preserve month navigation, date selection, retrospective entry, and shared Workout detail before the old tab is removed.

**IA1-4.7 — History default view.** Progress → History MUST open in `List` by default and offer an explicit `List | Calendar` view control. A future implementation MAY remember the user's last selected History view; until then, entering History defaults to List.

## 5. Core object graph and connective UX

```text
Goal
  -> linked to Program
  -> Program pins Routine versions
  -> Routine versions contain canonical EKF Exercises
  -> Program/Routine materializes a Workout/session
  -> completed Workout becomes History
  -> History feeds Progress and future Strength Knowledge
```

**IA1-5.1 — Graph preservation and model separation.** The UI MUST preserve the object graph above and expose traversable links without collapsing the underlying models. Goals and Program remain separate data models even though the UI MUST expose them as one connected planning experience.

**IA1-5.2 — Goal detail support summary.** Goal detail MUST link to its supporting Program when one exists. It SHOULD show `Supported by <Program name/version>`, placement such as `Bench appears 2× per cycle`, support status, and `View Program`.

**IA1-5.3 — Program detail priority summary.** Program detail MUST show its linked/prioritized Goals and link back to each canonical Goal. It SHOULD include destination values/status and relevant cycle placements.

**IA1-5.4 — Today connective card.** When Goal or Program context exists for the next action, Today MUST surface both applicable contexts and provide deep links into the canonical Goal and Program details. It SHOULD present one coherent sentence or card, for example: `Push 1 from Jorge Program v1 · Bench target guided by Bench 250`.

**IA1-5.5 — Progress connective summary.** Progress MUST contextualize completed performance against the relevant Goal and Program/block state when compatible provenance is available, while linking to canonical Goal and Program details. It MUST distinguish unavailable context from poor performance.

**IA1-5.6 — Shared indicators.** Goal priority, support state, Program version/status, and authority mode SHOULD use the same label, icon meaning, and status vocabulary wherever they appear.

**IA1-5.7 — Missing-link honesty.** If a Goal is not supported by the active Program, the UI MUST say so without implying an error or silently editing the Program. The action may be `Review Program support` only when a real review flow exists.

**IA1-5.8 — No duplicate authority.** Goal guidance authorization remains Goal-owned for exact next-exposure guidance; Program programming authority remains Program-owned for structural proposals. A combined card may summarize both but MUST link to the one canonical control for each.

**IA1-5.9 — Provenance boundary.** Program/Goal links shown on completed History or block analytics MUST come from explicit compatible provenance. The UI MUST NOT infer a past Program version solely from a workout label or weekday.

**IA1-5.10 — History provenance links.** History and Workout detail MAY show the originating Program and pinned Routine version metadata when that provenance is available. Those links and labels MUST reflect recorded facts and MUST NOT rewrite, backfill, or guess completed-workout provenance.

## 6. Program destination and surfaces

**IA1-6.1 — Plan overview.** Plan SHOULD open with Goals and current Program as peers, followed by the next planning action: create a Goal, finish Program review, resolve unsupported priority, review a block, or view the active Program.

**IA1-6.2 — Active Program detail.** The target detail SHOULD show Program/version status, current block or rolling cycle, upcoming slots and rest days/anchors, linked Goals, authority, and session drill-down.

**IA1-6.3 — Setup/editor.** Program setup/editor SHOULD group decisions into comprehensible categories: source/build path, Goals/priorities, exercises, sets/reps/intensity, cycle/schedule, block duration/review, authority, and later engine-backed periodization/deload.

**IA1-6.4 — Routine/session drill-down.** Each Program slot MUST open its pinned immutable Routine version and show its canonical exercises/prescriptions without suggesting that editing changes past or active sessions.

**IA1-6.5 — Version/review surface.** Program detail SHOULD expose current version, predecessor/successor history, effective boundary, review notes, and pending proposal differences. Accepted edits create successors under the Program contract.

**IA1-6.6 — Setup migration.** Program Setup MAY remain reachable from Library during migration, but its canonical route and post-completion destination SHOULD move to Plan. Library may retain a clearly labeled shortcut until users learn the new location.

**IA1-6.7 — Program lifecycle ownership.** The active Program, drafts actively being reviewed or edited, and archived/inactive personal Program versions MUST live in Plan or its history/archive. Library owns reusable Program templates and reusable saved building blocks only; selecting one to use MUST transition into an appropriate Plan build/review flow. Library MUST NOT become a dumping ground for Program lifecycle state.

**IA1-6.8 — Capability-gated editor.** Editor categories MAY be visible as future roadmap information, but disabled or absent controls MUST NOT imply that an Analyzer/Engine currently calculates or applies them.

**IA1-6.9 — Review before activation.** Whether a Program is manually built, imported later, or engine-proposed later, the user MUST be able to review exact sessions, prescriptions, constraints, authority, and effective boundary before activation.

## 7. Shared Exercise Picker and Library strategy

**IA1-7.1 — First reusable primitive.** The first reusable UI primitive implemented under this IA MUST be one shared Exercise Picker system and result-card language. It MUST be reusable in Program Setup, Routine editor, Goals exercise selection, Library, Train add, and retrospective replacement where allowed.

**IA1-7.2 — Search first.** Opening the picker MUST place a prominent search field first; alias-aware matching MAY use EKF compatibility while every selection stores canonical EKF identity.

**IA1-7.3 — Understandable default browse.** The default state MUST show `Recent` when available, clearly labeled contextual suggestions such as `Suggested for this session/goal`, and `All exercises A–Z` with no hidden ranking. Suggestions MUST NOT invisibly alter the alphabetical list.

**IA1-7.4 — Filters.** Muscle and equipment filters MUST be available consistently. Additional movement or measurement filters MAY appear only when their language is understandable and their EKF data is reliable.

**IA1-7.5 — Distinguishing metadata.** Each result MUST show canonical name and enough equipment/measurement metadata to distinguish materially different choices, such as primary muscle, equipment, and measurement meaning (`weight per dumbbell`, machine-indicated load, bodyweight plus external load).

**IA1-7.6 — Contextual eligibility.** Each caller MAY constrain eligible results, such as Goals allowing only supported exact-exercise strength targets or Program excluding duplicates, but the search, browse, filter, result, selection, and back interaction MUST remain familiar.

**IA1-7.7 — No silent ranking.** Any contextual ranking, recommendation, exclusion, or compatibility substitution MUST be labeled or explainable. An opaque session-type sort that appears random is not acceptable.

**IA1-7.8 — Mobile presentation.** On compact screens the picker MUST use a consistent full-screen route/sheet interaction with its own heading, close/back action, focused search, and stable selection return. A wide-screen dialog is acceptable when it does not create a nested modal stack.

**IA1-7.9 — Library reuse.** Exercise Library browsing SHOULD use the same result component and filters as the picker, while adding detail/manage actions appropriate to reference content rather than creating another taxonomy.

**IA1-7.10 — Retrospective safety.** Retrospective replacement/addition may reuse the picker only within existing fact-editing permissions and MUST preserve the explicit completed-workout edit semantics, canonical identity, and confirmation behavior.

**IA1-7.11 — Build-flow deep links.** Library Exercise, Routine, and Program-template items MUST be able to deep-link into their appropriate canonical build or review flows without duplicating editors or losing the user's Library origin.

**IA1-7.12 — Documentation-unit boundary.** This unit defines the Exercise Picker v2 contract only. It MUST NOT implement the picker or make runtime, schema, persistence, Supabase, RLS, sync, or data changes.

## 8. External reference concepts

The supplied product screenshots are inspiration only. Big Gains MUST NOT copy their branding, assets, proprietary copy, or unsupported claims.

| Concept observed | Classification | Big Gains treatment |
| --- | --- | --- |
| Goal-first Program onboarding | **Adopt conceptually now** | Start from destination and constraints, then choose `Build/review my own`; add generation only when the engine exists |
| Muscle priority/deprioritize inputs | **Adopt later** | Use as explicit engine constraints only after EKF coverage, Analyzer output, and proposal semantics are defined |
| Structure/split preferences | **Adopt conceptually now** | Present as user preferences and human labels, never hard-coded biological/program semantics |
| Deload toggle | **Adopt later** | Requires a versioned deload strategy, evidence, review, and clear authority |
| Program authority toggle | **Adopt conceptually now** | Use transparent `Off / Review / future Auto` with exact authority descriptions |
| Active Program cycle view | **Adopt conceptually now** | Establish the target Active Program surface and current/upcoming slot hierarchy |
| Per-session tabs/drill-down | **Adopt conceptually now** | Use for pinned session/Routine-version navigation when it fits mobile width and accessibility |
| Target-muscle/set/frequency summaries | **Adopt later** | Render only deterministic Program-1B Analyzer outputs with definitions and unavailable states |
| Program editor categories | **Adopt conceptually now** | Organize manual supported controls now; capability-gate later engine categories |
| Optional RIR education/input | **Adopt later** | Treat as optional evidence in Strength Knowledge, never required or magical fatigue truth |
| “Smart progression” marketing/toggle | **Reject as phrased** | Replace with named policy and explicit authority; no vague “smart” promise |
| Active-Program versus all-training analytics | **Adopt later** | Requires reliable Workout-to-Program provenance and block-aware Progress views |
| Generated Program review before activation | **Adopt conceptually now** | Keep exact review/approval as a permanent invariant; generation itself waits for the engine |
| “Based on the latest science” black-box generation | **Reject** | Show deterministic inputs, calculations, evidence, constraints, reason codes, and uncertainty instead |

**IA1-8.1 — Reference-use boundary.** Reference concepts MAY shape hierarchy and interaction, but Big Gains MUST express them with its own language, visual system, data model, and transparent authority contract.

**IA1-8.2 — Explainable generation.** A future generation status SHOULD enumerate actual resolved inputs such as Goal evidence, Program structure, frequency, muscle exposure, recovery spacing, rep distribution, and constraints, with drill-down into calculations and missing evidence.

**IA1-8.3 — No premature mode.** `Let Big Gains build it` or equivalent MUST NOT be enabled until Programming Engine output is deterministic, reviewable, versioned, and incapable of bypassing `Review` authority.

## 9. Product language and presentation patterns

**IA1-9.1 — Canonical nouns.** Use `Goal` for an outcome, `Program` for a multi-session route, `Routine` for a reusable ordered prescription, `Workout` or `session` for execution/performed facts, and `History` for completed Workouts.

**IA1-9.2 — Avoid interchangeable planning nouns.** UI copy SHOULD NOT call an active Program a routine, a Routine a Program, or a planned slot a completed Workout merely to shorten text.

**IA1-9.3 — Plan overview copy.** Plan SHOULD explain itself in one line: `Goals are where you're going. Your Program is the route.`

**IA1-9.4 — Today copy.** Today SHOULD use action language such as `Next session`, `Continue workout`, `Review Program`, or `Set a Goal`, not expose schema/version machinery unless it affects the decision.

**IA1-9.5 — Authority copy.** `Off` means Big Gains does not propose structural Program changes; `Review` means it may propose but the user approves; future `Auto` requires a separate earned-trust contract and MUST not be implied as available.

**IA1-9.6 — Cross-link labels.** Use consistent verbs: `View Goal`, `View Program`, `View Routine`, `View workout`, `View history`, and `Review proposal`. Avoid generic `Learn more` when the destination is known.

**IA1-9.7 — Status vocabulary.** Program lifecycle (`Draft`, `Active`, `Completed`, `Archived`), Goal lifecycle, support state, and authority state MUST remain visually and linguistically distinct.

## 10. Phased migration roadmap

| Phase | Independently shippable outcome | Dependencies / gates |
| --- | --- | --- |
| **1. Product IA locked** | This approved contract and route map; no runtime change | Released v87 audit and product review |
| **2. Exercise Picker / Library UX v2** | Shared search-first picker, A–Z browse, Recent, labeled suggestions, filters, EKF identity | IA route/ownership decisions; can ship before Plan tab |
| **3. Program Setup UX v2 + Plan bridge** | Comprehensible setup/review, shared picker, contextual `/plan` landing/entry; Program begins leaving Library | Picker; current Program capture/version contract; no Analyzer required |
| **4. Canonical Program capture completion** | User-approved exact Program/Routine versions suitable for analysis | Reliable setup/picker and explicit user approval |
| **5. Program-1B Analyzer** | Deterministic exposure, frequency, spacing, prescription, Goal support, gaps/redundancy | Canonical Program + pinned Routine versions + EKF definitions |
| **6. Active Program page/editor** | Cycle/session view, Goal links, analyzer summaries, block review, version history, successor editing | Program capture; base detail can precede Analyzer, computed summaries cannot |
| **7. Programming Engine v1** | Proposal-only structural changes with reasons, diffs, evidence, and Review authority | Analyzer, Goal inputs, constraints, versioned proposal contract |
| **8. Program-driven Train** | Active Program supplies upcoming session provenance/materialization; active snapshot remains stable | Program execution/provenance contract and canonical active Program; engine generation is not required |
| **9. Strength Knowledge Layer** | Versioned personal evidence/models benchmarked against simple baselines | Sufficient trustworthy History; no authority until validation criteria are met |
| **10. Progress / Insights integration** | Goal trajectory + Program exposure + recent performance; block and active-vs-all-training views | Early cross-links can ship sooner; block analytics require provenance and Analyzer outputs |

**IA1-10.1 — Incremental migration.** Each phase SHOULD preserve working entry points until its replacement proves parity. A phase MUST NOT require a single shell, Program, History, and Library rewrite.

**IA1-10.2 — Early connective wins.** Goal ↔ Program summary cards, Today context, canonical detail links, and consistent language MAY ship before Program intelligence as long as they use real links/data and honest unavailable states.

**IA1-10.3 — Picker before broad setup rewrite.** The shared Exercise Picker MUST be the first implementation after this locked IA and MUST precede Program Setup UX v2 so setup does not embed another temporary selection pattern.

**IA1-10.4 — Analyzer before computed claims.** Muscle, set, frequency, spacing, Goal-support, and gap summaries MUST wait for deterministic Analyzer definitions and tests.

Implementation tracking: Program-1B supplies the phase-5 deterministic calculation boundary. Release `v90-program-setup-ux-v2-plan-bridge` implements phase 3 and the contained phase-6 base detail: a contextual Plan landing, Goals/Program peer summaries, Today context, Goal ↔ Program links, rolling-session and pinned-Routine drill-down, block/authority/version facts, and Analyzer reuse. Program Setup is canonical in Plan; Library retains a labeled shortcut. **Program Analyzer = deterministic structural facts, not coaching/recommendation.** The persistent shell remains `Today / Train / Calendar / Progress / Library`, so Calendar migration, Programming Engine proposals, Program-driven Train, and block-performance Progress remain deferred.

The minimum Plan promotion gate in IA1-3.3 is now satisfied: Plan shows active Goals, current or draft Program state, traversable links, and useful setup/review actions. Plan is product-substantive enough for a later Calendar-replacement interval, but that nav migration still requires the History `List | Calendar` continuity in IA1-4.6 and is intentionally not part of v90.

**IA1-10.5 — Plan cutover gate.** The bottom-nav replacement MUST NOT occur before the minimum Plan landing contract above exists. The current Calendar placement remains the safe migration state until that gate is satisfied; cutover SHOULD coincide with an Active Program surface or clear in-progress Program state.

**IA1-10.6 — Train independence.** Program-driven Train MAY ship from a manually approved Program without waiting for automated Programming Engine generation. It MUST retain immutable active-session snapshot behavior.

**IA1-10.7 — Insights dependency.** Active-Program versus all-training or block-performance analysis MUST wait for explicit reliable Program/Workout provenance; historical labels MUST not be guessed.

## 11. Accessibility and mobile constraints

**IA1-11.1 — Bottom-nav density.** Five labeled items is the practical maximum for the persistent mobile navigation. Touch targets SHOULD be at least 44 by 44 CSS pixels and remain usable with text scaling.

**IA1-11.2 — Visible location.** Persistent navigation MUST expose the current destination with more than color alone, preserve readable labels, and use appropriate current-location semantics such as `aria-current`.

**IA1-11.3 — Thumb reach.** Primary frequent actions such as `Start`, `Continue workout`, picker confirmation, and active-session return SHOULD remain within comfortable lower-screen reach without covering content or system safe areas.

**IA1-11.4 — Full-screen complex flows.** Exercise Picker, Program setup/editor, History explorer, and dense detail flows SHOULD use full-screen routes/sheets on narrow screens. Simple confirmations may use dialogs.

**IA1-11.5 — No nested modal stacks.** Opening a picker, Routine, Goal, Program, Workout detail, or retrospective editor from another modal MUST transition to a route/sheet or replace the current layer; it MUST NOT stack focus traps.

**IA1-11.6 — Active-session access.** An active-session return bar/action MUST remain available from every non-workout destination. Navigation, back, reload, or opening Library MUST NOT discard or rematerialize the active Workout.

**IA1-11.7 — Focus lifecycle.** Route and sheet transitions MUST set focus on a meaningful heading or first field, restore focus to the invoking control when appropriate, and announce validation/status without forcing viewport jumps.

**IA1-11.8 — Motion and orientation.** Navigation and full-screen transitions SHOULD respect reduced-motion preferences and remain usable in narrow portrait layouts without requiring horizontal scrolling of primary labels.

## 12. Deep links, back behavior, and state

**IA1-12.1 — Browser back.** Back MUST reverse the user's navigation path: detail to its originating list/context, picker to its invoking editor, and child Plan/Progress/Library routes to their parent destination.

**IA1-12.2 — Canonical fallback.** A deep-linked detail with no in-app origin MUST back to its canonical parent: Goal/Program to Plan, Workout/History to Progress, and reusable Exercise/Routine/Program template to Library.

**IA1-12.3 — Cross-destination back.** Cross-destination links MUST preserve the prior user location in history and MUST NOT create modal-stack traps. `View Program` from Goal detail and `View Goal` from Program detail MUST NOT use bespoke hard-coded `Back to Today` behavior.

**IA1-12.4 — Ephemeral presentation state.** Search queries, selected History view, open accordion state, and picker filters MAY be session/URL presentation state. They MUST NOT become synchronized domain records unless separately specified.

**IA1-12.5 — Invalid or unavailable objects.** Missing, archived, incompatible, or inaccessible linked objects MUST resolve to a safe explanation and canonical parent action, never a blank modal or cross-profile fallback.

**IA1-12.6 — Profile boundary.** Deep links MUST resolve only within the verified active account/profile context and fail closed before rendering private detail from another profile.

## 13. Locked product decisions

1. **Plan promotion:** Plan will replace Calendar only after the minimum landing gate in the target navigation contract is met. Until then, the current Calendar tab is the safe migration state.
2. **History view:** Progress remains the evidence destination; entering History opens List by default and exposes `List | Calendar`. Remembering the user's last view is a future presentation enhancement.
3. **Program ownership:** Plan owns active, actively edited/reviewed draft, and archived/inactive personal Program state. Library owns reusable Program templates and reusable saved building blocks.
4. **Connective tissue:** Goal, Program, Today, Progress, History/Workout detail, and Library build/review routes must expose the normative links in Sections 5, 7, and 12 while retaining separate domain models and factual ownership.

## 14. Documentation validation contract

**IA1-14.1 — Markdown scope validation.** The final diff MUST contain only `.md` files.

**IA1-14.2 — Requirement identity validation.** Every `IA1-*` requirement identifier MUST be unique, and the final report MUST state the distinct requirement count.

**IA1-14.3 — Link validation.** Every local Markdown link added or modified by this unit MUST resolve from its containing file.

**IA1-14.4 — Diff validation.** `git diff --check` MUST pass with no whitespace errors.

**IA1-14.5 — Publication boundary.** After validation, this documentation-only unit MUST be committed and pushed to `docs/product-ia-navigation-v1`, then stop. It MUST NOT open a PR, merge, deploy, mutate production, or begin Exercise Picker implementation.
