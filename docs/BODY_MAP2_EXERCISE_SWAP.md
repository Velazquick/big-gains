# Body Map 2.0 and contextual exercise swap

Release: `v112-body-map-exercise-swap`.

## Recovery and baseline

The interrupted September 10 run used `feature/body-map2-exercise-swap` at
`c7099a709c033e90b70eb132cf249489ce01b36c` in the September 10 Work checkout.
Its task log attributes the modified files to that run. There were no feature
commits, remote feature branch, feature PR, or feature CI results to reuse.
There were 21 modified paths, 11 with substantive diff content; generator writes
accounted for the other working-tree status entries. The complete binary diff
was preserved outside the checkout before continuation. No reset or competing
branch was used. An inventory of 72 existing checkout roots found this feature
branch only in the interrupted run's checkout.

Fetched main remained the same commit. Protected Browser tests run 34531216411
passed. Production deployment 6381668303 successfully deployed that commit and
served `v111-exercise-metrics-session-recovery`, config `config-dfadb48839db90f2`.
The three existing open draft PRs were unrelated standby/recovery work.

Recovered work: compact picker/Browse all scaffold, active-session swap
controller and card action, Routine draft swap entry, discovery scope fix, and
an incomplete muscle-region split. Continued work: complete vector anatomy,
data/detail interactions, Appearance and accessibility, verified swap metadata,
safety/position/unit refinements, regression coverage and release delivery.

The initial family edits were not retained in the legacy identity contract:
the unchanged EKF-2 compatibility test proved those fields are frozen. Additive
`swapFamily`/`swapFamilyVersion` metadata now lives in
`ekf/curated/swap-families.mjs` and is generated into the catalog. No baseline
fixture or measurement contract was relaxed.

## Exposure contract

Progress owns the map, following the existing overview and workload sections.
The selected 7D or 30D window is `(now - days × 24 hours, now]`, based exclusively
on valid completed History timestamps. Future, unfinished and out-of-window
workouts are excluded. There is no smoothing, prediction or calendar rounding.

A qualifying working set is the accepted analytics predicate:
`completed === true && warmup !== true`. Count each such set once per displayed
region matched by a catalog primary muscle role. If two primary roles map to one
displayed region, do not count that set twice. Preserve the existing explicit
legacy muscle-label fallback when a historical exercise lacks a catalog role.
Secondary/stabilizer roles are not painted or weighted. Counts across regions
are not additive unique-workout totals. Reps are contextual, not workload.

Fixed display buckets: 0, 1–4, 5–9, 10–19 and 20+ sets. Positive shades mix the
current Appearance accent with the shared surface at 22%, 42%, 68% and 100%.
These are display bins, not training targets or physiological thresholds.
No growth, fatigue, recovery, readiness, injury or training recommendation is
inferred. Cross-family workload and Performance Records/e1RM are unchanged.

The original front/back vector artwork follows the available broad role model:
Chest, Shoulders, Rear shoulders, Back & traps, Biceps, Triceps, Core, Glutes,
Quads, Adductors, Hamstrings, Calves. The catalog cannot honestly distinguish
lateral deltoid exposure from all other shoulder work, so the UI says Shoulders.
Unmapped silhouette areas remain neutral. No legacy categorical palette remains.

Selecting a region shows its set count, reps, last qualifying date within the
window, and every contributing exercise. Contributors resolve through exact
catalog definition/canonical identity; similar names never merge variants.
Known exercises link to the existing exact-exercise Progress dialog. Unknown
historical IDs stay text-only. The panel is brought into view after a mobile tap.

Region names, numeric counts, pressed states, a labeled legend, dashed selection
outlines, keyboard operation and equivalent 44px region buttons provide meaning
beyond color. View/window/selection state is disposable UI state, not a new store.
All six accents use existing Appearance tokens in light and dark profiles.
Progress History headings and region labels wrap at larger text sizes without
forcing horizontal page scrolling. The compact swap sheet sizes to its content;
Browse all expands into the existing full picker.

## Swap contract

Closest alternatives require explicit shared family membership, a shared primary
role and the same tracking model. Prefer known matching movement patterns, then
different equipment, then deterministic catalog name/ID ordering. Existing
owner eligibility and exact-ID exclusions run before ranking and again before
selection. Same muscle alone never qualifies. Unknown families show an honest
empty state and Browse all exercises. No runtime model or recommendation engine.

The additive v1 membership covers Dumbbell/Cable/Machine Lateral Raise and the
two distinct Hanging Raise variants. Existing accepted exercise families remain
available as a fallback. Family membership conveys discovery equivalence only;
it never authorizes copying loads, combining metrics or merging identities.

Active swap replaces only that live workout's slot. It preserves session ID,
Program origin, source Program and Routine versions, target set count/rep text,
slot unit override and timer state. It creates fresh set IDs and empty loads;
completed/entered sets and exercise-specific guidance do not transfer. The pure
builder avoids changing Goal guidance or source prescriptions during a swap.
The replacement's measurement model controls its fields. Session persistence
uses the existing local/sync boundary. Completion remains the existing contract.

Entered/completed data uses the existing two-tap exercise-removal safeguard.
Untouched numeric templates can conservatively require confirmation under that
same rule. Truly empty sets do not. A changed account/workout/slot/set snapshot
invalidates an open picker's callback. Duplicate canonical exercises are rejected.
The existing stale-session write gate is respected. Cancel restores the origin;
successful swap updates the existing position anchor to the replacement slot.

Routine swap changes only the in-memory draft. Explicit Save is the only saved
Routine boundary. Program, retrospective and Goal pickers keep their existing
owners and eligibility rules. Browse all reuses the single-selection picker.

## Hanging Knee Raise and Library

The catalog already contained `hanging-knee-raise`, canonical ID
`689831d2-1b33-4f27-b768-6d07bb760318`. It is reps-only, Bodyweight, primary Core.
Hanging Leg Raise is a different canonical ID; no alias was added or merged.

The defect was day/routine discovery scoping: a Legs-tagged exercise could be
hidden when the current session/day was Push. Explicit Library search now searches
the complete catalog and the Library/active-workout add picker offers the full
catalog. Non-search Library browsing retains its existing day presentation.
Equipment/muscle filters, aliases, dense shared rows and Added states are reused.

## Validation and physical acceptance

`tests/body-map-swap.spec.js` covers exact windows, neutral/primary counts,
canonical drill-in, profile isolation, all accents in both themes, mobile layout,
keyboard regions, deterministic ranking/exclusions, Hanging Knee Raise discovery,
offline/session persistence, entered-set safety, Program materialization, Routine
draft ownership and empty-set/duplicate behavior. The protected WebKit job also
runs this suite. Catalog compatibility tests are included in protected CI.

Existing v109/v110 position, v111 recovery, units, History/Records, Program,
offline/PWA and account suites remain release gates. Local synthetic fixtures
are the only training-data writes used for QA. Production verification is read-only.
No schema, RLS, Auth or production configuration changes are part of this release.

Physical iPhone/Home Screen and VoiceOver acceptance is still required: confirm
region tapping, reading order, rotor/navigation, larger text, compact swap,
keyboard dismissal, canceled/successful return position and update-to-offline
behavior. Automated WebKit and screenshots do not substitute for that evidence.
