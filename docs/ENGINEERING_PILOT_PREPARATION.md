# Engineering pilot preparation — October 11, 2026

## Baseline and dependency

Freshly fetched `origin/main`: `677f9a3152db9f9ecf1b52b2853e5adc1bb71833`
(PR #123, retained active-session row fix). Preparation uses an isolated clone
and `chore/engineering-pilot-preparation`; other checkouts and PR #124 are untouched.

[Train Premium Pass 01 (#124)](https://github.com/Velazquick/big-gains/pull/124)
remains open at `f0d60da6e0775d7dd1a8e9572a5700040bf7e53e`.
Its mobile, WebKit, and Train lifecycle jobs succeeded. The protected `playwright`
job failed in both Browser tests runs; deployment was skipped. The current-head
[failed run](https://github.com/Velazquick/big-gains/actions/runs/38188853796)
reports `relation "private.product_releases" does not exist` at
`tests/operator-db.test.mjs:36`, while applying the pre-Operator migration group.
That blocker predates this preparation branch; no database or migration changes
are included here. No workflow was retried, canceled, or duplicated to monitor #124.

The [main workflow](https://github.com/Velazquick/big-gains/actions/runs/38047046174)
succeeded on the baseline, including deployment. Read-only live asset inspection
reports `v119-conflict-resolution-retry`, rather than #124's candidate v120.
Production config uses `config-dfadb48839db90f2`; checked-in default-off config
uses `config-925e766c1b907250`. The deployment configuration substitution is
documented in `ARCHITECTURE.md` and `scripts/write-cloud-config.mjs`.
Asset hashes and exact inspection time belong in the accompanying handoff.

## Completed independent work

- Added concise repository `AGENTS.md` rules covering local-first/offline use,
  History authority, profile isolation, persistence/sync/recovery/Program
  provenance, session/timer ownership, position restoration, appearance,
  synthetic testing, review, protected CI, and explicit release authorization.
- Added a read-only, dependency-free `check:release` command, with regression
  cases for coordinated rotation, stale/missing/duplicate references, config
  rotation, and deliberate historical fixtures. It catches drift in entrypoint
  manifest URLs, telemetry loading, offline/startup assertions, telemetry QA,
  export QA, and revisioned/offline asset lists before expensive validation.
- Wired the check and its tests into `npm test` and both Browser tests jobs;
  updated the testing and release checklist references.
- Preserved the app shell, release marker, runtime behavior, data contracts,
  dependencies, and database state. No production release is needed for this
  repository-only preparation.

## Pass 02 continuation gate

Hold implementation until #124 is resolved and its exact merged baseline,
protected checks, release marker, and deployed asset parity are verified.
Respect the existing merge monitor; this preparation introduces no automation.
Then freshly fetch main, inspect the resulting controllers/CSS and account
appearance tokens, and capture synthetic baseline screenshots at 375px, 390px,
and desktop before changing UI.

Use Mockup Option 2's structure with Option 1's restrained finish. Evolve the
current controls: state-derived header counts (working sets exclude warmups),
truthful guidance, equipment icons with fallback, subtle surfaces/status,
editable measurement fields, explicit Swap/Reorder, existing timer actions,
and existing immediate position/focus behavior. Do not infer Pause/Reset from
the images. Preserve all six accents and light/dark rules.

Validate add/delete/complete/uncomplete, expansion, swaps/reordering, focus,
timer visibility/lifecycle, finish/reload, offline and synthetic recovery;
compare after screenshots across themes/accents and reduced motion. Run the
required local and protected suites and obtain independent review. Report
performance observations and physical iPhone/installed-PWA/VoiceOver gates
separately from browser automation. Stop at the reviewed PR: merge/deploy
requires separate authorization.

No Pass 02 implementation commit or before/after screenshots exist yet. Visual,
touch, and physical-device acceptance remain deferred under the dependency gate.
