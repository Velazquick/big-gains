# Guarded reliability release runbook

Prepared for `v123-reliability-completion`. No deployment is authorized by this document or an integration PR. A main push can automatically deploy Pages. The final readiness report must bind the reviewed Git SHA, PR head, every required CI run and artifact to the same candidate before any release request.

## 1. Software and owner prerequisites

A required-check failure may be re-executed once only if evidence shows it occurred outside application code before the test body ran (e.g., native browser crash in browser.newContext). Both attempts are recorded in the PR and the release record. All other failures STOP the release. Data-integrity, import, Finish, Discard, recovery, journal, database/security and Node suites are never re-executed to clear a failure.

Before any merge, read back the `github-pages` environment: required reviewer Jorge (`Velazquick`), administrator bypass disabled, and only `main` allowed. A main push must wait for explicit owner approval before the environment job starts. Never approve a deployment during release preparation. A disposable nonproduction environment with equivalent reviewer/bypass rules may demonstrate the approval mechanism; report that proof separately from the production workflow/settings inspection and do not claim an actual main-push deployment rehearsal.

Recovery evidence must distinguish runner allocation from executed tests. At
`033149f003adcad8385bcec420a65bd0e275c12a`, Browser PR run `40367649229`
and Train run `40367649246` had no assigned runner and no executed steps;
GitHub annotated hosted ARM64 capacity/acquisition failure. The supported
`macos-15-intel` pool is the bounded capacity correction for those workflows.
It does not establish a WebKit lifecycle repair, ARM64 equivalence, physical
iPhone acceptance, or a disposition for historical native Chromium crashes.
Supplementary native-prefix diagnostics retain every failed cell and do not
replace the protected WebKit dependency or required Linux/database coverage.
Bind final outcomes and the reviewed commit in the recovery validation matrix;
keep this release on HOLD while any required check or failure disposition is
failed, cancelled or incomplete.

1. Verify freshly fetched main and the exact PR head. Rebase/merge changes, runtime corrections or release-pin changes invalidate the earlier exact-head approval and require review/checks appropriate to that change. Preserve existing PR branches and registration history.
2. Require successful Browser macOS WebKit and dependent Chromium/disposable-PostgreSQL jobs, Astra mobile/WebKit and Train lifecycle on the final PR candidate. Both protected PR and branch-push Browser workflows must terminate successfully for the same candidate SHA; verify that the tested PR merge tree equals the candidate tree. Preserve failures and their causes. A passing rerun alone cannot close an unexplained intermittent failure. A skipped deployment job is expected on this branch; a skipped required test is not a pass. No retries, forced clicks or assertion weakening may manufacture readiness.
3. Complete physical acceptance on actual supported iPhones. Record model, iOS, app/container/build and support floor; do not invent them. Test Safari and a genuinely installed Home Screen PWA separately. Include offline set logging and Finish, background/lock/reopen, process termination/restart, History/set/provenance retention, two-device sync/partial delivery, profile isolation, PWA update/failed install and VoiceOver controls. Viewport emulation and Windows/macOS WebKit receive no phone credit. If unavailable, **INCOMPLETE: do not declare production-ready**.
4. Inventory actual hosted migration/registration prerequisites read-only under owner access. Historical reports found v122 absent; that is not a current hosted verdict. Confirm `20261010102308_active_session_identity_constraint.sql`, all existing migrations required by main, `20261012200950_operator_workout_integrity_3a_release.sql`, and this candidate's new registration. Compare exact SQL and actual constraints, not names alone. No RLS/Auth/schema redesign is part of this candidate.

## 2. Preserve every relevant container before retiring old documents

The old v121 document does not honor the new writer lock. New code cannot prevent JavaScript already running in that old document from writing localStorage. A service-worker cache version also does not prove that every open document runs the new ownership code.

For each declared rollout account/profile and Safari/Home Screen/browser container:

- Stop new training edits during the controlled handoff. Inventory every active old document, tabs/windows and installed application. If the inventory or retirement cannot be established, keep rollout on HOLD.
- Capture each potentially divergent document's live draft and durable namespace before closing it. A stale old document can save during pagehide; do not assume that closing several old tabs selects the newest facts. Retain all alternatives and independently reconcile performed facts before resuming writes. Do not automatically select by timestamp.
- Obtain a verified private backup outside browser storage. Include the complete owned profile documents (History, active session, rest state, Program/provenance), general queue including acknowledgments, shadow catalog/comparison, Program queue and accepted state, managed recovery markers/automatic-adoption intent, retained Program adoption evidence and relevant namespace/account mapping. A schema-v5 UI export alone omits queue and recovery state.
- Record hashes/counts and verify a restore rehearsal in a disposable separate namespace/browser profile. Keep original IDs, payloads, versions, accepted bases and retry keys. Do not upload raw facts or credentials as Operator logs.
- Retire all old documents only after their alternatives are preserved. Reopen one document running the approved new build and verify the actual runtime release and sole writer. A second cooperating tab must refuse writes until a fresh reload after ownership is released. Never clear storage, reset sessions, force sync or delete queues/journals to obtain ownership.

This is an explicit rollout prerequisite, not an automated guarantee for unknown old clients. Broader deployment without an enforceable retirement/admission plan remains blocked; a future server protocol or storage migration requires separate authorization.

## 3. Hosted registration order — separate authorization required

1. Owner authorizes the specific reviewed migration/registration operation after software, backup, old-document and device gates pass. Verify project identity and migration ledger without reading training payloads. Obtain the established recovery/backup proof.
2. Use the pinned Supabase CLI `2.112.0`; inspect the installed command's `--help` before execution. Compare local/hosted migration lists and dry-run output. Do not run an unrestricted `db push` that would apply unrelated pending migrations. Do not repair migration history merely to bypass a mismatch.
3. If any main prerequisite is missing, stop for separate review of exactly that SQL. This release does not authorize silently applying a schema, grant, RLS or Auth change.
4. Under the separately approved execution procedure, apply only the approved missing prerequisites, then the immutable v122 registration, then `20261022213558_operator_reliability_completion_release.sql`. Both registrations insert into `private.product_releases` with conflict-safe semantics. The original v122 file remains unchanged. Do not remove historical registrations to roll back.
5. Independently read back the hosted migration ledger, both release identifiers and required constraint definitions. Repository SQL and a successful CLI exit do not establish hosted installation. Record metadata-only evidence and exact timestamps. No hosted query or installation is implied by preparing this candidate.

## 4. Authorized merge and automatic deployment

1. Obtain explicit authorization naming the exact reviewed candidate SHA and acknowledging the main deployment trigger. A PR approval alone is not this authorization. Select a merge method only after checking that the resulting tree and release artifacts equal the reviewed candidate and that provenance/registration checks still pass; do not assume a squash is equivalent without verification.
2. Preserve the tested release artifacts and browser-safe deployment configuration digest. Keep existing feature flags unchanged; do not combine reliability release with signup, Program portability or automatic-reconciliation enablement.
3. The Browser workflow deploys only on a successful push to `refs/heads/main`. Its deploy job checks out `github.sha`, reruns release consistency, generates browser-safe cloud configuration from approved Actions variables, validates/upload the static artifact, and deploys Pages. Confirm the successful deployment's SHA/environment and URL directly.
4. Fetch the public production document, manifest, service worker and required assets after deployment. Verify `v123-reliability-completion`, the expected deployment/config digest, script order, cache identities and byte parity with the tested artifact. Permit only the documented generated cloud-config substitutions; inspect the actual generated deployment manifest/worker pins. A merged SHA or an HTTP 200 alone is insufficient.
5. On the declared containers, verify a real worker update/waiting/activation sequence, no activation during an active workout/editor/queue conflict, failed-install retention of the working shell, and online-to-offline reopen. Use the normal update/reopen flow. Do not unregister workers or clear caches containing the only usable shell.

## 5. Acceptance and Operator visibility

Use a designated synthetic account for release smoke tests under separate production-test authorization. Owner acceptance of real profiles must be non-destructive: compare retained performed IDs/counts/set facts/provenance, current active/rest state and original pending identities before/after the handoff. Do not create real training records as an incidental test.

Track local completion and verified backup separately. One History record and active removal in the owned local document prove local completion. A session tombstone ACK does not prove remote History. Zero pending operations does not prove current parity. An interrupted capture remains unverified until reconstructed and delivered. Operator support fields, current backup verification, pending counts, blocked capture/recovery codes and bounded diagnostic fingerprints help diagnose failures; they are not authority to alter user data. Telemetry outages must not block local Finish.

Halt rollout on missing/changed performed facts, duplicate completion identity, profile crossover, stale overwrite, unsupported owned rollback, false verified backup, an unknown recovery journal or old writer still active. Retain all evidence. Pause automatic adoption/dispatch using existing supported controls when appropriate; preserve local training where ownership remains provable. Do not turn a data-protection refusal into a successful test by deleting its cause.

## 6. Rollback and forward recovery

Before any new writes, an approved rollback may redeploy a tested compatible protection build, after exact artifact review and the same update/old-document procedure. The deployed v121 build lacks these protections and is not a safe automatic fallback.

After new local or remote writes, preserve the current schema-v5 documents, all newer History/edits/Program sequence changes, queues, accepted revisions, ACKs and recovery evidence. Prefer a forward correction or compatible code rollback on the current data. Never restore an older whole-profile snapshot over a newer record or replace current queues with an earlier export. Never delete remote History, tombstones or release registrations to match old code.

For interrupted queue/catalog capture, the candidate may fold only the exact verified contiguous pending chain and then recapture current durable facts. Gaps, competing revisions or fingerprint disagreement retain all evidence and require a reviewed recovery decision; no automatic rekey or timestamp winner is supplied. An already delivered request may have lost its ACK, so reconcile its original identity before any replay. For unknown journal ownership, keep every before/candidate/current alternative; restore only a revision the recovery transaction still owns.

If authority cannot be established or the only recent facts are missing, stop replacing writes, preserve surviving copies and use explicit reviewed recovery. Do not promise that software can reconstruct data without a surviving record. No production rollback, data restore or migration execution is authorized by this runbook.
