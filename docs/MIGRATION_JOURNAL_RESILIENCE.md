# Migration journal resilience and guarded integration

This focused change preserves migration completion evidence when two clients
resume the same approved plan. It is based on main
`a61ddb8a44412dbe9b3714f68e47021269d493db`; the independently reproduced defect
also exists at PR 130 head `732973ee4409f6586e928baab39b14599cd6d789`.
No workout History loss was demonstrated. This change does not modify PR 130,
rotate its release, apply hosted SQL, or authorize merge/deployment.

## Exposure before correction

The approved audit validator accepts the retained
`v47.1-phase4d-legacy-source-preview` contract only
(`migration-engine.js`, `SUPPORTED_AUDIT_RELEASES` and `validateApprovedAudit`).
The current preview export includes the running release and a seventh remote
count, bodyweight; it is rejected by that pipeline. The comparator alone does
not validate those fields. A retained valid legacy audit remains usable if its
source checksums and account/Jorge/Alexa mappings match the current local preview.
There is no audit expiry or requirement for the running release to equal the
old audit release.

Changed current local source blocks an old approval. A separate stale device,
retained matching snapshot, or an already prepared/in-flight migration can still
address the earlier journal. The normal controller UI initializes for
managed-owner runtimes, not independent/member accounts. The engine's public
JavaScript API is not an authorization boundary; RLS remains the owner boundary.
The old controller and engine check journal identity but do not refuse complete
status, including after insert-conflict recovery. Hiding the migration controls
does not prevent an in-flight writer from later overwriting the journal.

## Client transitions

Every verifying, complete and failed transition now includes account/row ID,
the observed prior version and exact eligible prior status in the same PATCH.
Successful transitions advance exactly one version. A zero-row result is
`journal-transition-superseded`; it cannot be replaced by an unconditional retry.
Failure-marker transport uncertainty is reported separately while retaining the
original migration rejection. Controller and engine refuse an already complete
journal before target-row execution, including a complete row discovered after
an insert conflict.

With both clients pre-reading v7, A's verifying v8 can supersede B immediately;
this is a safe outcome. In the complementary ordering, B freshly reads A's v8,
advances through verifying v9 to complete v10, and A's stale failure cannot
change the completed row. The regression compares its complete serialized
database bytes before and after A's actual attempt.

## Database guard and older clients

No installed-client retirement was proven. A client-only fix therefore cannot
provide the supported mixed-client guarantee. The new migration
`20261029010230_migration_journal_resilience.sql` adds an invoker trigger limited
to recognized migration-journal metadata and the `migration:` client prefix.
It preserves identity, makes completed rows immutable, and requires exact
successor version/status/acknowledgment transitions. Both OLD and NEW scope are
checked so relabeling cannot escape the guard. Other sync metadata, RLS policies,
owner/profile constraints and grants remain unchanged. No existing rows are
rewritten or removed.

Frozen legacy engine tests prove that an unguarded stale failure is rejected
while ordinary genuine failure and successful resume remain possible. The
server guard protects the journal; it does not prevent an old engine's target
insert-or-verify attempts before that engine reaches its verifying PATCH. Early
refusal is guaranteed by updated controller/engine code, not retrofitted into
installed JavaScript by the trigger. Uploads are not a new account-wide
transaction.

The migration has only been applied to disposable databases. Hosted protection
is incomplete until separately authorized application and readback verify the
function/trigger, role behavior and journal invariants. Do not infer hosted state
from checked-in SQL or a green client test.

## Regression validation

`npm run test:migration-journal` requires a loopback PostgreSQL service and a
local real PostgREST executable (`MIGRATION_JOURNAL_POSTGREST`). It fails rather
than silently skipping when unavailable. `OPERATOR_TEST_PG_PORT` selects the
loopback port; `PGPASSWORD` is the disposable service credential.
`MIGRATION_JOURNAL_EVIDENCE_DIR` saves schema hashes, actual requests/results,
full journal bytes and all public-table checksums. The isolated database is
retained; no application cleanup or History/queue deletion runs.

The permanent suite covers both race orderings, one-winner completion,
genuine failure/resume, controller/engine/insert-conflict complete refusal,
failure-recording uncertainty, actual frozen legacy writers, real other-owner
and anonymous RLS, guard scope/relabeling, and managed-owner comparison consumers.
The SDK's existing read retry policy is retained; test-runner retries remain zero.
The new focused workflow downloads a digest-pinned real PostgREST binary and
uses PostgreSQL 17, then runs the existing database security/telemetry contracts.
Existing protected workflows and assertions are unchanged.

## Integration and deployment hold

The focused fix is independent of PR 130's runtime changes and can be reviewed
as its own PR. **It cannot safely be merged under the current deployment setup
without an explicit, verified deployment hold.** The existing Browser workflow
calls Pages on a successful push to main. Read-only configuration inspection
found a main-only Pages branch policy and no required-reviewer rule; this is not
a manual approval gate. A non-main branch or pull-request event cannot enter the
existing deploy condition. No environment or workflow setting was changed here.

Use this sequence, stopping at every required owner gate:

1. Complete exact-head independent review and all required CI for the focused
   PR. Failed, skipped or incomplete protected work is not acceptance.
2. Before any main merge, obtain separate authorization to establish and read
   back a reliable deployment hold: for example, a protected Pages environment
   with required approval, or an explicitly paused deployment path. Do not rely
   on an intended CI failure to prevent deployment.
3. Obtain separate authorization for hosted schema application. Verify the exact
   guard migration, unchanged RLS/ownership, retained journals and backups, and
   legacy-writer rejection using authorized disposable identities/readback.
   This task performs none of those hosted operations.
4. Under that hold, integrate the reviewed fix independently or first compose it
   with PR 130 in an isolated checkout. Preserve the old PR branch until its
   owner authorizes a guarded integration; do not force-push it. The source
   changes are compatible at the audited heads, but that is not combined-head
   acceptance.
5. Rerun Migration journal resilience, Browser/WebKit and its dependent database,
   Node/Chromium checks, Astra and Train on the exact combined head, including
   PR 127–129 integrity/import/Finish/Discard/recovery regressions. Keep original
   assertions and zero test retries. Resolve every material review finding.
6. Before release, use a fresh release/cache identifier and immutable release
   registration through the repository's normal release process. This focused
   branch deliberately retains main's existing identifier because it is not
   deployment authorization. A merge alone cannot update installed cached code;
   the server guard covers retained writers while a separately verified client
   rollout proceeds. Recheck PR 130's device, backup, hosted-schema, old-writer,
   native/download and rollback gates rather than clearing them with this fix.
7. Only a separately authorized deployment may release the hold. Verify served
   exact-SHA assets, registration and schema parity, retained History/journals/
   queues, and monitoring afterward. No merge, hosted migration, registration or
   deployment is authorized by the implementation PR.
