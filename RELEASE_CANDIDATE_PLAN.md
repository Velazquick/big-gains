# Big Gains Release Candidate Plan

- Status: **Canonical RC execution plan**
- Audit baseline: `origin/main` at `8ce0a52cf7441921533d957559ef7f4df1847e92`
- Runtime marker: `v97-program-portability-convergence`
- Local profile schema: **5**
- Audit date: 2026-08-24

RC-2 signup, first-run, first-success, and full recovery behavior is governed by the [RC-2 self-serve onboarding and recovery contract](RC2_SELF_SERVE_ONBOARDING_RECOVERY.md). That contract records the newer `b5ffd908952b875e79c24c9b36525a88b092a5d6` documentation baseline without rewriting this plan's 2026-08-24 audit snapshot.

Implementation update: `v100-rc-train-history-correctness` implements R5's two-family derived record taxonomy and exact source-set attribution, plus active and retrospective warm-up/working-set removal without changing prescriptions. Protected CI, exact-head merge, and Pages verification remain the release gates for this interval.

Implementation update: `v101-rc-settings-units` implements the release-facing Settings pass without changing the five-destination product model. The profile-scoped lb/kg preference is a presentation/input boundary over canonical-pound schema-v5 facts; an absent preference remains the backward-compatible pound default, and toggling never rewrites History. Cloud, backup, and support actions move into secondary Settings while engineering-heavy details remain available only under Advanced diagnostics. Appearance is omitted until it has a generic profile-safe contract.

Implementation update: `v102-rc-active-workout-units` adds an active-session-only lb/kg override with precedence over the profile default. The override is validated as additive active-workout UI metadata, can ride the existing active-session JSON payload, and is explicitly omitted from completed History. Toggling rerenders canonical values without rewriting them; input converts once back to pounds. Completion, discard, and the next workout end the override lifetime without changing Settings, Program/Routine prescriptions, progression, analytics, records, schema, Auth, or hosted data.

This plan supersedes calendar-driven external-test targets. Big Gains reaches release candidate when it is the product the owner intends to hand to people and the gates below are proved. It is not a promise of zero bugs.

## 1. RC product standard

Big Gains is release-candidate complete when a person who did not build it can create an account, understand the product's core nouns, begin and finish training, understand the result, recover from ordinary failure, move to a new device, and take their meaningful data with them without founder narration.

The release standard is:

1. **Self-serve:** no operator-created invitation, phone call, FaceTime, secret URL, or founder explanation is required for ordinary signup, first profile creation, first workout, password recovery, reinstall, or new-device use.
2. **Operationally boring:** boot, Train, completion, resume, Program start/resume, History, editing, sync, and updates work through ordinary use without drama.
3. **Trustworthy:** performed facts are not silently lost or rewritten; destructive actions are explicit; conflicts fail closed; recovery is credible; and a user can leave with useful data.
4. **Understandable:** Goal is the destination, Program is the route, Train is execution, History is performed fact, Progress is interpretation, and Library is reusable training material. The UI explains this where a new user needs it.
5. **Honest:** unavailable evidence, limited comparisons, offline state, sync state, and recovery boundaries are stated plainly. Big Gains does not manufacture certainty or hide a meaningful portability gap.
6. **Contained:** broader intelligence, Trajectory, Strength Knowledge, Auto programming, social, and native work do not enter RC unless a proved RC dependency changes this plan.

## 2. Audited shipped state

The audited baseline is a static, local-first PWA with a tested offline shell and five primary destinations: Today, Plan, Train, Progress, and Library. It currently ships:

- Goals v1.1, exact-exercise next-exposure guidance, and the normative [Goals contract](GOALS_V1_SPEC.md);
- a 155-exercise EKF catalog with opaque identity and explicit measurement semantics under the [Exercise Knowledge Foundation](EXERCISE_KNOWLEDGE_FOUNDATION.md);
- immutable Program/Routine capture, a deterministic factual Analyzer, a substantive Plan surface, explicit Program-origin workouts, and Review-only PE-1A/1B/1C under [Program Foundation](PROGRAM_FOUNDATION_V1.md) and the [Programming Engine contract](PROGRAMMING_ENGINE_V1.md);
- Train, active-workout persistence/resume, completion receipts, History List/Calendar/detail, retrospective creation, and completed-workout edit/delete;
- schema-v5 full-state JSON backup/restore for the current profile;
- password sign-in, browser-only Magic Link compatibility, invited independent-user bootstrap, managed-member access, offline cached identity, guarded fresh-device cloud recovery, outbound sync, explicit remote fast-forward, same-entity conflict choices, and runtime-controlled automatic reconciliation under [sync semantics](SYNC_SEMANTICS.md);
- v95's separate identity and runtime-interactivity gates, so a normal shell is not intentionally exposed before required composition is interactive;
- green Browser tests on the baseline: **464 passed** in the latest `main` workflow; and
- a green automatic GitHub Pages deployment of the baseline. Production exposes the v95 marker, has cloud configuration, and has the static automatic-reconciliation capability enabled. The authenticated runtime switch was not independently queried in this read-only audit.

Important current limits:

- public registration is deliberately disabled; an operator must invite or create each Auth user before the otherwise idempotent independent-profile bootstrap can run;
- there is no first-run welcome or guided route after profile creation;
- the current **Export JSON** control emits the entire technical schema-v5 profile document. It is a valid backup, but it is not a curated, human-meaningful portability artifact and has no CSV companion;
- `programCapture`, including the active Program and immutable Routine versions, is local-only and omitted from cloud reconstruction and outbound sync;
- current runtime PR behavior is e1RM-only, `workout.prs` is a vague count, and `BEST` is within-workout presentation. The normative [Performance Records v1](PERFORMANCE_RECORDS_V1.md) contract is not implemented;
- a general operations/full-stack rebuild runbook is not present in this repository or discoverable in the owner's GitHub code. [Phase 4I](PHASE4I_ALEXA_COMPLETED_WORKOUT_RECOVERY.md) is a specific future data-operation runbook, not proof of full-stack recovery;
- GitHub `main` has no branch protection or ruleset. Browser tests and Pages deployment start independently on a push to `main`, so deployment is not gated on the test result;
- the release checklist still hard-codes an obsolete 109-test count even though the current workflow reports 464;
- the latest workflows are green but warn that `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`, `actions/configure-pages@v5`, and `actions/deploy-pages@v4` target deprecated Node 20 action runtimes and are being forced onto Node 24;
- there are no open PRs and two open issues: [#41 timer stuck / Skip unresponsive](https://github.com/Velazquick/big-gains/issues/41) and [#16 timer dismissal/duration controls](https://github.com/Velazquick/big-gains/issues/16). Issue #16 is partly superseded by shipped READY auto-dismiss/presets; its remaining slider proposal is not a core-flow blocker.

## 3. RC inventory and classification

Every consolidated item appears exactly once below. Relative sizes compare implementation slices, not calendar duration. “Touch” identifies likely review boundaries; it does not authorize those changes.

### A. RC REQUIRED — 15 items

| ID | Item and why required | Evidence/source | Dependencies | Size | Docs/contract state | Touch | Risk if deferred |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | **Self-serve account creation and auth recovery.** Replace operator-only invitation as the ordinary path; retain safe password reset and explain browser versus installed-PWA behavior. | Current `account-onboarding.js`, [Phase 4G](PHASE4G_INDEPENDENT_USER_CONTRACT.md), explicit no-handholding standard | Auth threat review; email/redirect decision | L | Invited-user contract done; public-signup contract not done | Supabase Auth configuration and security; schema/RLS change not expected | A stranger cannot begin without founder/operator work. |
| R2 | **First-run welcome and guided first success.** Introduce Big Gains, create the first profile, explain core nouns, and offer a direct first-workout path with optional Goal/Program setup. | Dogfooding request for intro; live surface has no post-profile first run | R1; product copy; R13 | L | IA language exists; onboarding contract absent | Local state/presentation; may add a versioned onboarding preference | Users land in a capable but unexplained app and require narration. |
| R3 | **Reinstall/new-device onboarding and recovery contract.** Make sign-in, restore, local-only limits, offline behavior, and retry paths one coherent user journey. | Fresh-device recovery contracts; auth/PWA split; trust standard | R1, R6, R9, R10 | L | Low-level contracts exist; end-to-end user contract absent | Auth, recovery, sync, security; no schema decision yet | “Sign in” may restore only part of what the user believes is theirs. |
| R4 | **User-portable export v1.** Ship curated JSON plus human-readable completed-set CSV while preserving technical backup/restore separately. | Original Gate 0; current raw full-state export; data-ownership decision below | Stable user-facing field map | M | Scope decided here; delivery contract still needed | Local files only; no schema/Supabase/sync required | User trust and exit rights remain weak as stored value grows. |
| R5 | **Performance Records v1 runtime and attribution.** Implement e1RM Record and Indicated Load Record, answer “what was the PR?”, and recompute correctly after History edits/deletes. | Pushdown dogfooding finding; current semantic/presentation gap; normative contract | Explore persistence/derived-event shape; History order | L | Normative contract complete | Prefer derived History; persistence may change; no independent sync entity or Supabase source table | Current “PR” can be incomplete, vague, or misleading for common machine work. |
| R6 | **Program portability and fresh-device recovery closure.** Complete the remaining physical production proof for the implemented [Program portability synchronization v1 contract](PROGRAM_PORTABILITY_SYNC_V1.md) so the active Program and approved Routine versions survive device loss/change. | v97 and hardened gateway live; capability ON; physical Device A publication/convergence and Device B whole-graph adoption/reload parity passed with one unchanged revision-1 row | Honest mutable B → A transition; successor/conflict/offline physical proof; R3; R12 | S | Normative contract/runtime/hosted implementation complete; production acceptance partially passed, not RC-complete | Physical proof only; no schema/Auth change expected | An unproved real mutation or recovery edge could still violate Program continuity despite green deterministic coverage. |
| R7 | **Critical-flow reliability closure.** Prove boot, auth persistence, offline launch, active resume, Program start/resume, completion, History edit/delete, and timer operation; reproduce/fix or close #41 with evidence. | v95 production incident; open #41; 464-test baseline | R9; representative devices/accounts | M | Component contracts/tests strong; RC matrix below is new | Runtime; no schema expected unless defect proves otherwise | A known or untriaged blocker can make the training path non-operational. |
| R8 | **Cross-device, queue, and conflict integrity gate.** Rehearse fast-forward, automatic/manual reconciliation, conflict choices, pending-queue recovery, active-workout deferral, and post-local-parity retry. | Production incidents and [sync semantics](SYNC_SEMANTICS.md) | R6, R10, authenticated test identities | L | Normative contract and broad tests exist; RC rehearsal open | Supabase/sync/security; schema change not expected | Silent loss, stuck queues, or wrong conflict choices destroy trust. |
| R9 | **Physical Safari/iOS PWA and update matrix.** Manually verify invitation/signup redirect, password sign-in in installed context, offline reload, waiting-worker/update behavior, background/foreground resume, and current-device recovery. | [Testing limits](TESTING.md); iOS storage separation; v95 incident | R1, R3, R7; real devices | M | Automated contracts exist; physical proof incomplete | Runtime/service worker/Auth configuration | Chromium CI cannot prove the primary mobile deployment behavior. |
| R10 | **User-visible support diagnostics and degraded states.** Expose non-secret release/readiness, account shape, offline state, queue age/count/reason, last parity, and safe retry/support copy; never expose payloads or identifiers. | v95 diagnosability lesson; SS observability; 500-user support standard | Privacy/security review; R7/R8 | M | Sync metadata vocabulary exists; support artifact contract absent | Runtime/instrumentation/security; no schema required | Remote failures become founder calls with insufficient evidence. |
| R11 | **Destructive/edit safety audit.** Verify workout/Goal/Routine/Program deletion or discard scope, confirmations, rollback-on-failure, sync tombstones, record recomputation, and cancel behavior. | Existing confirmation code/tests; trust prerequisite | R5, R8 | S | Most behavior implemented; consolidated audit open | Runtime/sync; no schema expected | A rare destructive edge can erase or misstate user data. |
| R12 | **Canonical recovery runbook and full rebuild/restore drill.** Locate or recreate the general runbook in an authoritative location and prove a clean rebuild plus user-data recovery without relying on memory. | Original Gate 0; historical claim not evidenced in current repo; Phase 4I is narrower | R4, R6, production inventory/operator records | M | Specific recovery docs exist; general canonical proof absent | Operations/deployment; may exercise Supabase read-only verification but authorizes no mutation here | Recovery credibility depends on founder memory and unproved documents. |
| R13 | **Comprehension, empty-state, error-state, and accessibility pass.** Make Goal/Program/Train/Progress/History/Library relationships, empty states, PR language, back behavior, focus, and recovery actions understandable. | Live first-use audit; [Product IA](PRODUCT_IA_V1.md); dogfooding presentation requests | R2, R5; cold-trial script | M | IA and accessibility contracts strong; RC acceptance not run | Presentation only unless a discovered defect crosses a domain boundary | Users can reach features but misunderstand what they mean or where to recover. |
| R14 | **Release governance guardrails.** Protect `main`, require Browser tests before merge, gate Pages deployment on the accepted green commit, remove stale test-count assumptions, retain marker/cache discipline, and record smoke/rollback evidence. | No branch protection/ruleset; independent test/deploy workflows; stale checklist | Repository settings and workflow design | M | [Release checklist](RELEASE_CHECKLIST.md) exists but needs current governance | GitHub settings/workflows/config only | An untested direct push can deploy even while CI fails. |
| R15 | **RC stabilization and cold-user readiness gate.** Complete the no-critical-defect soak, then run two silent first-use trials and close blocking findings before release. | No formal cold-user trial; Sontai is meaningful outside use but not cold use | R1–R14; trial participants | M | Protocol defined below | No schema/Supabase by itself | Release would still measure founder assistance or broken software instead of comprehension. |

### B. RC DESIRABLE — 8 items

| ID | Item and why desirable, not blocking | Evidence/source | Dependencies | Size | Docs/contract state | Touch | Risk if deferred |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D1 | **PE decision/counterfactual observability.** Record `proposal`, `no_change`, `unavailable`, gate deficits, and approve/reject/later so PE-1A can be evaluated without expanding it. Review-only authority and fail-closed behavior keep this non-blocking. | [Programming doctrine](ARCHITECTURE.md#programming-bounded-domain); current traces cover successful application only | Stable privacy/retention rule; R10 pattern | M | Conceptual contract done; storage/retention contract open | Local Program capture/instrumentation; sync/security review if exported | PE remains hard to validate and tune, but core training remains safe. |
| D2 | **Minimal aggregate learning metrics.** WAU, workouts/week, 30-day return, and a small onboarding funnel are useful after privacy, consent, and purpose are explicit; they do not prove RC safety. | Original Block 0; no current telemetry | R1/R2 event definitions; privacy decision | M | Original metric names exist only in historical planning | Instrumentation; Supabase/schema/security only if server-side | Early retention learning is slower; no direct data-loss or comprehension blocker. |
| D3 | **Timer duration-slider remainder of #16.** Presets and READY dismissal already cover the main need; a slider improves gym speed but is not required for a coherent first release. | Open issue #16; shipped timer contract | R7 must first close correctness | M | Product idea documented in issue | Runtime only | Minor friction; presets and existing controls remain usable. |
| D4 | **Program multi-version archive/rollback UI.** Useful for advanced Program review but current immutable successors and active detail preserve correctness. | [Program Foundation](PROGRAM_FOUNDATION_V1.md) deferred UI | R6 portability first | M | Domain contract done; UI contract partial | Local Program model/presentation; portability implications | Power users cannot inspect/restore lineage conveniently. |
| D5 | **Broader Program-driven Train selection.** Current explicit next-slot start is sufficient; broader replacement of manual Train can wait. | [Product IA phase 8](PRODUCT_IA_V1.md#10-phased-migration-roadmap) | Stable RC Train evidence | L | Boundary documented | Runtime/Program; no schema expected | Some duplicate entry paths and mental-model friction remain. |
| D6 | **Program/block-aware Progress and richer evidence-backed insights.** Useful but not necessary for safe tracking, and must not pull Trajectory or speculative policy forward. | Product IA phase 10; dogfooding desire for better projection/information | R5 attribution; reliable provenance | L | Dependencies/negative boundaries documented | Analytics/presentation; no source schema expected | Progress is less explanatory but remains factual and usable. |
| D7 | **Presentation continuity polish.** Remember History List/Calendar preference, deepen safe links/back behavior, and refine non-blocking navigation details. | [Product IA](PRODUCT_IA_V1.md); current session-only view state | R13 baseline comprehension | S | IA contract done | Presentation only | Repeat-use friction remains, without blocking first success. |
| D8 | **Richer Library/Progress teaching content.** Add optional explanations, examples, and contextual tips after the minimum self-serve flow is proved. | Live empty-state audit and daily-use presentation requests | R2/R13; cold-user evidence | M | No separate contract | Presentation/content only | Users may learn more slowly, but minimum onboarding remains complete. |

### C. POST-RELEASE — 9 items

| ID | Item and why post-release | Evidence/source | Dependencies | Size | Docs/contract state | Touch | Risk if deferred |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P1 | **Trajectory Outlook implementation.** It is read-only and architecturally bounded, but no proved RC need requires forecasting against a deadline. | Programming doctrine; prior discussion | Longitudinal evidence and separate contract | XL | Safety constraints only; feature deliberately unspecified | Analytics/Programming; possible new derived data | No RC safety risk; users lack a future outlook. |
| P2 | **Personalized Strength Knowledge/response modeling.** Population priors, individualized response, fatigue/readiness, and model fitting need evidence Big Gains does not yet have. | [EKF later work](EXERCISE_KNOWLEDGE_FOUNDATION.md); PE boundary | Sustained trustworthy History and validation baseline | XL | Negative boundary done; model contract absent | Data science, privacy, likely schema/security | No RC risk; personalization remains deterministic/rule-based. |
| P3 | **Expanded structural policy families.** Exposure `-1`, total-volume changes, rep-range changes, slot reordering, block changes, substitution, and deload require independent evidence and contracts. | [PE parked work](PROGRAMMING_ENGINE_V1.md#14-explicitly-parked-work) | D1 evidence and post-release outcomes | XL | Explicitly parked | Programming/runtime; persistence implications | Current PE remains intentionally narrow. |
| P4 | **Auto authority and free-form Program generation.** Review is the earned trust ceiling for RC; Auto would materially change risk and user authority. | Program/PE contracts | Proven Review outcomes and separate trust contract | XL | Explicitly prohibited/parked | Programming, security, persistence, possibly schema/sync | No RC risk; users continue approving every structural change. |
| P5 | **Broader record families and equipment provenance.** Machine instance/setup, reps-at-load, duration, distance, pace, volume, density, backfill, and durable retrospective opt-out exceed the narrow v1 correction. | [Performance Records parked work](PERFORMANCE_RECORDS_V1.md#11-parked-work) | R5 production evidence | XL | Parked semantics listed; contracts absent | History/analytics; possible schema/sync | Narrow RC records remain honest but incomplete for other performance types. |
| P6 | **Custom-exercise subsystem and deeper EKF content.** Custom measurement UX, anatomy crosswalks, instructions/media, remote/signing infrastructure, and calibrated equipment models do not block the curated 155-exercise product. | [EKF](EXERCISE_KNOWLEDGE_FOUNDATION.md) | Proven catalog gaps and rights review | XL | Explicitly deferred | EKF/runtime; potential remote infrastructure | Uncommon exercises need workarounds; core catalog remains usable. |
| P7 | **Social/activity feed.** Network features should follow trustworthy records, identity, onboarding, and real user demand. | Historical roadmap | Released RC and explicit social contract | XL | Product idea only | New privacy, moderation, schema, Supabase, security | No initial-product risk. |
| P8 | **Native evolution.** HealthKit, Watch, widgets, notifications, Live Activities, and a native client follow proof of the web product. | Historical roadmap | Stable web contracts and demand | XL | Direction only | New platform/client/infrastructure | No initial-product risk. |
| P9 | **Full local multi-account switching.** Verified runtime switching is deliberately outside the independent-user contract and is not needed for one-person accounts. | [Phase 4G](PHASE4G_INDEPENDENT_USER_CONTRACT.md) | Real multi-account need and new isolation contract | L | Explicitly out of scope | Auth/local namespace/security | Edge-case convenience only. |

Inventory total: **32 consolidated items** — 15 RC required, 8 RC desirable, and 9 post-release. Categories represented are access/onboarding, product comprehension, training/records, portability/recovery, reliability/sync, instrumentation, release governance, programming/knowledge, presentation, platform, and social expansion.

## 4. Exact signup and first-run release standard

The RC account journey must satisfy all of the following:

1. A clean browser or installed PWA shows a neutral Big Gains welcome. It exposes no managed-person identity or seeded private content before verified ownership.
2. **Create account** is an ordinary user path. The user supplies email and password, completes at most one understandable email verification hop, and returns to the correct browser/PWA instructions. Ordinary signup requires no Supabase Dashboard action.
3. Existing users can sign in with password. Magic Link may remain a clearly labeled browser convenience, but the product must explain that Safari and the installed iOS PWA have separate Auth storage and lead the user to password sign-in in the installed app.
4. Password setup/reset is generic, cooldown-protected, returns to a safe page, and gives a recovery action for expired, reused, malformed, offline, or wrong-context links.
5. The existing security-invoker bootstrap creates exactly one account and one private profile idempotently. Retry cannot create duplicates; unexpected shapes fail closed with an actionable explanation.
6. First profile creation asks only for user-meaningful information. Internal presentation tokens, account shapes, RLS, and storage namespaces are not onboarding concepts.
7. The welcome explains in plain language: **Goal = where you are going; Program = the route; Train = today's work; Progress/History = what happened; Library = reusable exercises and routines.**
8. A user may start a safe first workout without first designing a complete Program. The guided route may offer Goal and Program setup, but it must distinguish optional setup from the shortest path to training.
9. The first-workout path explains working sets, completion, rest timer, saving, and where the finished workout appears. It does not require the founder to explain a hidden gesture or noun.
10. Empty Plan, Train, Progress, History, and Library states each have one clear next action and one sentence explaining the destination.
11. Offline, Auth outage, email failure, bootstrap failure, recovery block, and existing-local-data states preserve data and show a safe retry or support path.
12. Reinstall/new-device use states exactly what will be restored. At RC, completed History, bodyweight, Goals, user-created Routines, meaningful preferences, and the current Program must be recoverable through the approved cloud or explicit restore path.
13. The flow is keyboard/screen-reader usable, respects focus and reduced motion, and works at supported mobile text sizes.

## 5. Export and data ownership decision

**Decision: user-portable export v1 is RC REQUIRED.** It is a separate product artifact from the existing full-state backup/restore.

Implementation status: shipped in source as `v99-rc-user-data-export`; protected CI, merge, and production verification remain the release gate for this interval. The normative field and privacy contract is [User-owned data export v1](USER_DATA_EXPORT_V1.md).

Use the ten-minute scope:

- portable JSON contains completed workouts and sets, workout/exercise notes that belong to those records, bodyweight history, Goals, user-created Routines, the user-meaningful current Program/training structure, and meaningful preferences such as units and timer choices;
- a human-readable CSV contains one row per completed set with workout date/time, workout name/type, exercise name and canonical identity, set order/type, entered load/unit, reps, duration/distance when applicable, and any user-authored note that can be represented safely;
- the UI explains the difference between **Portable export** and **Backup/restore**;
- export is profile-scoped, works offline, names the profile and export time, and excludes secrets;
- internal machinery is out of scope: `programOrigin`, PE/application/decision traces, sync revisions/catalogs/queues, idempotency keys, reconciliation journals, diagnostics, release metadata beyond a format version, and cloud ownership identifiers; and
- no analytics warehouse, new database, generalized data platform, or cross-service export is part of this slice.

Acceptance: the JSON is documented and readable, the CSV opens correctly in a normal spreadsheet, fixtures prove all in-scope domains, profile isolation is preserved, and the existing technical backup still round-trips the full schema-v5 profile including local Program data.

## 6. Performance Records and PE observability decisions

### Performance Records v1

**Classification: RC REQUIRED (R5).** The contract arose from daily use exposing a semantic gap: a machine-indicated Pushdown best can be a meaningful record while remaining correctly ineligible for e1RM. Current vague count/`BEST` behavior cannot answer what happened. A product centered on tracking progress is materially incomplete and potentially misleading without the narrow v1 implementation.

The implementation remains narrow: two record families only, exact canonical identity, honest limited comparison, event attribution, current state, History edit/delete recomputation, and no independent synchronized record source. Additional record families and equipment provenance remain P5.

### PE observability

**Classification: RC DESIRABLE (D1).** PE-1A is live and should be treated as an experiment, but it is narrow, Review-only, user-approved, and fails closed. Missing complete evaluation logging weakens learning; it does not prevent safe core training or self-serve use. Implement it after required trust/reliability work if it stays bounded. It must not become a pretext to tune thresholds or expand intelligence before release.

## 7. Reliability and trust gate

The gate is evidence, not a claim that a test file exists.

| Critical path | RC proof |
| --- | --- |
| Boot/interactivity | Online, slow-required-asset, optional-module failure, required-module failure, cached offline reload, and update all produce either an interactive shell or explicit neutral recovery—never a normal-looking dead shell. |
| Auth/session | New signup, password sign-in, browser Magic Link, installed-PWA sign-in, reset, expiry, wrong identity, sign-out/reload, and offline cached identity preserve isolation and give actionable recovery. |
| Offline launch | A previously initialized user can open, start/resume, edit, and complete local training without cloud availability; queued work remains durable. |
| Active workout resume | Reload, background/foreground, browser close/reopen, navigation, timer state, and an app update preserve one exact active snapshot or fail visibly without duplication. |
| Program start/resume | The exact next pinned Routine materializes once; repeated start resumes; discard does not advance; completion advances exactly once; later Program successors do not rewrite the active workout. |
| Completion | Persist precedes receipt; reload/Done/Review do not duplicate; History, analytics, records, Program sequence, and outbound capture agree. |
| History edit/delete/create | Stable identity, confirmations, rollback on persistence failure, tombstone behavior, record recomputation, chronological ordering, and profile isolation all hold. |
| Cross-device | Safe fast-forward, automatic/manual adoption, conflict choices, queue-empty requirement, concurrent edit, remote tombstone, active-session deferral, and post-local-parity retry match [sync semantics](SYNC_SEMANTICS.md). |
| Fresh device | Verified identity restores every promised RC domain, including Program under R6, without overwriting non-pristine local data. Partial or malformed recovery stops safely. |
| Queue integrity | Persist-first/enqueue-second, idempotent retry, exact ACK readback, queue age/reason visibility, and no blind clear are proved under outage and lost response. |
| Local recovery | Invalid JSON/state, quota/write failure, interrupted adoption journal, and technical backup import preserve the last proven state or expose a specific recovery path. |
| Service worker/update | Install, waiting worker, activation, prior-cache cleanup, offline navigation, manifest/config versioning, and rollback are manually smoke-tested on the supported mobile PWA. |
| Timer | #41 is reproduced and fixed or closed with current-version/device evidence; Skip, expiry, reload, background/foreground, and stale callbacks stay coherent. |

Trust acceptance additionally requires:

- no known Sev-1 app-access/data-loss/cross-account defect and no known Sev-2 defect in signup, Train, completion, Program, History mutation, export, or recovery;
- R4 portable export fixtures plus same-profile technical backup/restore proof;
- R11 destructive-action evidence and clear conflict consequences;
- R12 full rebuild/restore drill recorded from a clean environment;
- no secret, token, email, private identifier, or workout payload in diagnostics;
- explicit support for minor known bugs: track them, provide a workaround when necessary, and do not describe the RC as bug-free.

## 8. Minimum instrumentation and friction learning

RC requires diagnostics, not analytics theater:

1. A user-initiated support view/report may expose release marker, runtime readiness result, account **shape** (not IDs), offline/online state, service-worker state, queue pending count and age, stable retry/block category, last parity time/status, and whether automatic reconciliation is statically/runtime/device enabled.
2. It must exclude workout/set payloads, Goals, notes, names, email, account/profile UUIDs, tokens, keys, sync fingerprints, and raw error stacks by default.
3. Cold trials use a simple friction log: task, exact question asked, hesitation/wrong turn, recovery behavior, intervention required, severity, and follow-up disposition. The observer records every urge to explain and does not narrate until safety or abandonment requires it.
4. WAU, workouts/week, 30-day return, and a small onboarding funnel are D2, not RC gates. Add them only with a stated purpose, minimal event vocabulary, retention period, access boundary, and privacy disclosure. Do not build dashboards, cohort machinery, A/B testing, or speculative telemetry for RC.

## 9. Release governance gate

Before the RC stabilization build:

1. Protect `main` with a ruleset or branch protection. Require the Browser tests check and disallow ordinary direct pushes.
2. Ensure Pages deploys only the accepted commit after Browser tests pass. A push that fails tests must not become production merely because static validation passed.
3. Keep documentation-only changes exempt from asset-marker bumps, but require runtime releases to use a unique marker and coherent manifest/config/cache rotation.
4. Replace hard-coded test counts in the checklist with either the current count maintained on change or a no-skip/no-focused-test invariant.
5. Update the Node-targeting Actions majors or pin reviewed Node-24-capable revisions. The warning is governance debt, not by itself a current blocker because the baseline runs successfully on the forced Node 24 runtime.
6. Record the accepted commit, required check, Pages deployment, online/offline/PWA smoke result, production marker, and rollback point for every RC runtime release.
7. Keep schema/Supabase/RLS/data operations in separately reviewed intervals with before/after evidence. This plan authorizes none.

## 10. Original-roadmap reconciliation

Two historical roadmaps were in use: a gated validation roadmap and a longer product/architecture spine. They should not be conflated.

### Gated roadmap

- **Original Block 0:** operations/recovery runbook; one-click full-history JSON export; Core/Adapter/Presentation/Mixed audit; retention instrumentation for WAU, workouts/week, and 30-day return; then Gate 0.
- **Original Gate 0:** a fresh person/device cannot destroy data, can take data and leave, and the stack can be rebuilt/recovered from the documented procedure.
- **Original Block 1:** Goals v1; formal Sontai interview; two weeks of owner use; flowing instrumentation; friction cleanup; then Gate 1.
- **Original Gate 1:** prove the built product can be used and understood outside the founder's mental model before broadening access.
- **Original Block 2:** open the product to roughly 10–20 unrelated users.
- **Later blocks:** post-evidence product and intelligence expansion. The repository does not contain canonical numbered definitions for every later block; historical review described Program/PE/knowledge-scale work as equivalent to Blocks 3–4. This plan does not invent missing titles.

### Longer product spine

The parallel roadmap ordered sync reliability, EKF, analytics correctness, rebuilding the real Program, Programming Engine, personalized Strength Knowledge, Goals, Progress/History, Insights, onboarding/reliability polish, social, and native evolution.

### What actually shipped early

- Sync/reconciliation, EKF-1/2/3, corrected analytics semantics, Goals v1/v1.1, History V2, shared Exercise Picker, canonical Program capture, Program Analyzer, Plan/nav migration, Program-origin Train, and PE-1A/1B/1C all shipped before the validation gates formally closed.
- Goals delivered the core of Block 1. Daily use then exposed legitimate product needs that the original gate order had underestimated.
- Sontai supplied meaningful real outside testing of independent-user and cross-device behavior, but not the formal interview or silent cold-first-use evidence.
- v95 fixed a real app-wide startup/interactivity defect and proved that a green architecture can still fail Gate 0 operationally on a physical device.
- The Programming bounded-domain doctrine and Performance Records v1 contract are now better product/architecture foundations than the original roadmap contained.

### What remains genuinely open

- Gate 0's user-meaningful exit artifact and formal full rebuild/restore proof;
- the self-serve signup/first-run standard the old roadmap placed too late;
- Program portability across fresh devices;
- Performance Records runtime correctness/attribution;
- complete RC reliability and physical mobile/PWA proof;
- a silent cold-user trial and evidence-backed friction closure.

The old Core/Adapter/Presentation/Mixed inventory is substantially superseded by the current ownership tables and bounded-domain rules in [Architecture](ARCHITECTURE.md); it is not a separate RC build item. R14 should confirm those boundaries are used in review. The old retention metrics are D2. The formal Sontai interview remains useful outside evidence, but R15's two silent cold-user trials are the stronger release gate and the interview is not an additional blocker.

### Gates retained versus superseded assumptions

Retain the substance of Gate 0: data safety, data exit, recovery, and rebuild proof. Retain the substance of Gate 1: somebody outside the builders must operate and understand the app without narration.

Supersede these assumptions:

- **A date is not readiness.** Release and cold trials follow the evidence gate, not an arbitrary Saturday.
- **Cold users should measure comprehension, not known breakage.** Prove access/data/core reliability first, then observe first use.
- **Daily-use needs are evidence.** Goals, Program, History, EKF, presentation, and Performance Records are not dismissed merely because they arrived after the first roadmap.
- **Onboarding is not late polish.** It is RC product functionality and moves ahead of broader access.
- **Retention metrics are not a safety prerequisite.** Diagnostics and a friction log are required; aggregate retention metrics are desirable once privacy and purpose are defined.
- **Architecture completion is not the finish line.** Architecture work proceeds only when it removes an RC dependency; broader intelligence remains post-release.

## 11. Cold-user readiness gate

The RC may enter silent cold-user trials only when:

1. R1–R14 acceptance evidence is recorded, with no known critical defect in access, data integrity, core training, export, or recovery.
2. A clean user can create an account and reach a first workout without operator setup or founder narration.
3. Train → complete → History → view → edit works; Program setup → start → resume → complete works; export works; and new-device restore proves the advertised scope.
4. The release has completed an operationally boring soak: at least seven consecutive days of ordinary owner use and at least ten completed workouts across two physical devices and at least two production account shapes, with no Sev-1/Sev-2 surprise. This is evidence volume, not a release date.
5. Online load, controlled offline reload, update, Auth recovery, cross-device adoption/conflict, and backup/restore smoke checks pass on the exact candidate marker.
6. Two people who did not learn Big Gains from its builders receive only the instructions the product itself provides. The observer does not coach. Every question, hesitation, wrong turn, recovery attempt, and intervention is logged.
7. A trial passes when each person can independently create/access a profile, explain the five core concepts sufficiently to navigate, start and complete a workout, find and understand History, identify how to edit, find export, and explain what happens on a new device. Safety-critical confusion blocks; cosmetic preference does not.
8. Trial findings are triaged as critical/blocking, high-friction, or minor. Critical/blocking findings are fixed and the affected task is re-run. High-friction findings require an explicit release decision. Minor known bugs may ship tracked.

The first two cold users are the final RC comprehension gate, not a market-demand study. Broader release follows the post-trial fixes and a repeat of affected smoke checks.

## 12. Recommended execution order

1. **Install release guardrails:** R14 first because it is small and protects every following runtime slice from an untested automatic deployment.
2. **Lock the self-serve/recovery data contract:** Explore and decide R1, R2, R3, and R6 together. This is the highest-risk dependency because Auth, first run, and Program portability determine whether schema/Supabase/RLS/sync work is required.
3. **Build self-serve access and first success:** implement R1/R2 against the locked contract, including failure recovery and the shortest first-workout path.
4. **Ship the trust primitive:** implement R4 without turning it into a platform. Preserve technical backup/restore.
5. **Close the known product-semantic gap:** implement R5 exactly to the normative Performance Records contract; keep additional record families parked.
6. **Close portability and recovery:** implement the chosen R6 path, integrate it into R3, and complete R12's clean rebuild/restore drill.
7. **Harden and prove core operation:** execute R7–R11 and the physical R9 matrix. Fix only proved failures; close or update stale issues with evidence.
8. **Finish self-serve presentation:** complete R13 using the actual first-run surface, then add R10's bounded support diagnostics.
9. **Optional bounded observability:** implement D1 only if required work is green and the slice remains instrumentation-only. D2 is not a reason to delay RC.
10. **RC stabilization sweep:** run all automated suites, the single-worker suite required by the release checklist, link/diff validation, exact-marker smoke checks, and the operationally boring soak.
11. **Silent cold-user trials:** run R15, let the evidence reorder the remaining RC fixes, and repeat affected tasks.
12. **Release:** only after the cold-user gate and post-trial blocking fixes pass. Start post-release work from the evidence collected, not from the most architecturally interesting parked item.

## 13. Validation boundary for this plan

This documentation interval changes only `RELEASE_CANDIDATE_PLAN.md`. It does not authorize or perform runtime, generated asset, schema, migration, RLS, sync, Supabase, repository-setting, production-data, user-data, PR, merge, deployment, or release changes.

Before handoff:

- all local Markdown links in this file must resolve;
- `git diff --check` must pass;
- the diff must contain only this Markdown file;
- the branch must be pushed and its remote SHA verified; and
- implementation must stop until separately authorized.
