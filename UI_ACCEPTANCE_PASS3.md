# UI acceptance Pass 3

Starting main: `7eba0c907f77cb9c756f614248901e891dd89c7a` (PR #110). Production manifest observed: `v109-train-position-summaries-config-dfadb48839db90f2`. A clean isolated worktree was created from freshly fetched origin/main. Production is GitHub Pages; the existing protected Browser tests → deployment workflow remains authoritative.

## Correctness and presentation

The old Today Lifetime Volume applied `totalAnalyticsVolume` to whole-workout `workingSetVolume`. The accepted analytics contract returns null for mixed resistance families or unknown modeled workload. That null poisoned the entire lifetime read. Even separate single-family workouts could previously be summed across incompatible families. The new Lifetime workload projection reuses `workloadWindow` over completed History, keeping external, machine-indicated and modeled system load separate. Missing modeled bodyweight is an explicit gap/known subtotal. Unknown/reps-only/duration/distance movements remain excluded. No calculation or Record policy changed.

The new exercise comparison uses existing `exerciseHistory` working-set values. Only adjacent completed exact-exercise sessions with the same family and finite values compare. No gaps are skipped. A zero previous value has an absolute difference but no percentage. First history and unavailable data use neutral copy. Workload changes do not become Performance Records or training advice.

Today selects the last eligible catalog movement in the newest completed workout (stored exercise order breaks ties), requiring a known workload. It uses the canonical ID to open that exact exercise in Progress. The compact trend shows discrete real observations, with gaps, on a zero-based scale; no smoothing or predictions. Profile-level units are used unless the latest exercise carries its existing display override. Exercise Progress presents latest/previous workload, a recent trend and disclosed working sets with a link to the original History workout. Records and e1RM remain separate.

Completion receipts and History detail show family-separated session workload. No session-level percentage is added: the accepted domain does not provide a general comparable-workout predicate, and matching a routine name alone would not establish comparability.

Navigation keeps all five equal destinations and accent only on the selected destination. More owns the sole Settings action; the functioning profile selector remains a contextual switch, not a Settings shortcut. Settings deep links, More section routes, and Appearance sync on Settings entry remain intact. Completed rows receive a restrained semantic success tint/rail and checkmark with explicit pressed state. Current-row dominance and v109 position ownership are unchanged.

## Validation boundary

Hand-calculated fixtures cover sets, load, reps, combined changes, decline, flat, first/empty, zero baseline, mixed families, missing historical bodyweight, exact identity and unchanged Record results. Rendered acceptance covers 375 and 390×844, lb/kg, exact Today → Progress → History routing, empty profile isolation, all six accents in both existing presentations, completed-state semantics and larger text. Existing navigation, History, units, Records, Program, recovery, offline and v109 regression suites remain required. The new mobile spec is also included in the supplementary macOS WebKit workflow; protected full checks are unchanged.

Native iPhone/PWA one-handed comfort, VoiceOver experience, OS app switching/lock-unlock, keyboard return and subjective pale-success strength still require physical acceptance. Browser simulation is not physical-device proof. Production training data is never used or mutated for QA. No Supabase schema, RLS, Auth, configuration, sync, account, persistence or backup changes are part of this pass.
