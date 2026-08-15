# Big Gains Supabase synchronization semantics

Status: proposed normative contract for Jorge review  
Contract version: 1  
Local application schema: 5

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and **OPTIONAL** in this document are to be interpreted as described by RFC 2119 and RFC 8174 when, and only when, they appear in all capitals.

This contract supersedes the synchronization semantics described narratively in the `PHASE4*` documents. Those documents remain historical records and are not modified by this contract.

## 1. Scope and non-scope

**SS-1.1 — Supabase path.** Supabase Auth, account/profile mapping, application tables, tombstones, the durable outbound queue, the accepted revision catalog, and verified cloud readback together form the only active Big Gains cross-device synchronization path.

**SS-1.2 — Local-first authority.** Big Gains MUST remain usable for starting, editing, and completing workouts while signed out, offline, or unable to reach Supabase. A cloud or Auth failure MUST NOT cause an accepted local workout mutation to fail.

**SS-1.3 — GitHub publisher.** `sync-gateway.js` is a separate legacy, outbound-only GitHub snapshot publisher. It is not Supabase synchronization, is not an authority for recovery or conflict decisions, and is outside this contract.

**SS-1.4 — Non-scope.** This contract does not define Supabase Realtime, polling, a general merge engine, CRDT behavior, native clients, third-party sync engines, remote telemetry, schema-version changes, or retirement of the GitHub publisher.

## 2. Entities and tables under contract

**SS-2.1 — Source tables.** The synchronized semantic source-table set is exactly `workouts`, `routines`, `bodyweight_entries`, `preferences`, and `active_sessions`. `tombstones` records deletion winners for those source tables. `sync_metadata` MAY hold migration or operational journal metadata but MUST NOT be treated as a training entity or change signal under this contract.

**SS-2.2 — Ownership.** Every cloud source row and tombstone MUST remain scoped by immutable `account_id` and `profile_id` values whose relationship is verified by the existing account/profile mapping and RLS boundary. A client-supplied profile identifier MUST NOT grant access.

**SS-2.3 — Logical entity.** A logical entity is uniquely identified by the tuple `(account_id, profile_id, source table, stable client ID)`. Conflict detection MUST use this tuple. Rows in other tables, profiles, or client IDs are unrelated entities even when they arrive in the same reconciliation read.

**SS-2.4 — Stable client IDs.** Client IDs MUST be deterministic or persistently stable for the lifetime of the logical entity. Completed workouts use the workout ID; custom routines use the canonical routine-name identity; bodyweight entries use the canonical measurement identity plus occurrence suffix; preferences use their singleton or exercise-scoped IDs; active sessions use the active-workout ID.

**SS-2.5 — Derived values.** Personal records, volume, estimated one-rep max, progress summaries, calendar groupings, and presentation-only state are derived values. They MUST NOT become separate synchronized source entities and MUST be recomputed from adopted schema-v5 source data.

**SS-2.6 — Affected profiles.** An affected profile is any profile whose schema-v5 document would be written by the adoption transaction. If the recovery adapter reconstructs and writes every profile in a verified managed account, every such profile is affected even when only one remote entity advanced.

## 3. Revision model

**SS-3.1 — Positive monotonic revisions.** Every source row and tombstone MUST carry a positive integer revision. A new logical entity begins at revision 1. A semantic mutation or deletion MUST create the next revision relative to the accepted winner for that entity.

**SS-3.2 — No downgrade.** A remote revision lower than the accepted catalog revision MUST NOT be adopted, acknowledged as advancement, or used as the base of a replacement operation.

**SS-3.3 — Successor identity.** A remote winner is a monotonic successor only when its revision is greater than the accepted catalog revision and its transport timestamp does not move backward. A newly observed remote entity with valid ownership, identity, revision, timestamp, and fingerprint MAY be a successor when no accepted catalog entry exists and local absence is verified.

**SS-3.4 — Equal revision.** An equal revision is acceptable only when fingerprint, tombstone state, and normalized transport timestamp are identical to the accepted catalog identity. Any equal-revision identity disagreement MUST block automatic adoption.

**SS-3.5 — Canonical fingerprint.** A source fingerprint MUST be SHA-256 over the canonical, key-sorted representation of `contract`, contract version, profile client ID, source table, stable client ID, deletion state, and the complete semantic source payload. Array order remains meaningful.

**SS-3.6 — Included semantic data.** Semantic values stored inside the source payload, including semantic workout timestamps when present in that payload, MUST participate in the fingerprint.

**SS-3.7 — Excluded metadata.** Remote row UUIDs, account/profile UUIDs outside the verified identity tuple, revision numbers, transport `updated_at`, idempotency keys, retry counts, acknowledgement history, queue metadata, accepted-catalog metadata, comparison timestamps, recovery/adoption journals, UI state, observability counters, derived values listed in SS-2.5, and legacy GitHub snapshot metadata MUST NOT enter a source fingerprint.

**SS-3.8 — Identical mutation.** Capturing a local entity whose canonical fingerprint and tombstone state already match the accepted catalog MUST NOT manufacture a higher revision.

## 4. Authority rules

**SS-4.1 — Completed-history authority.** A completed workout MUST NOT be silently overwritten, deleted, or field-merged when the same logical workout changed both locally and remotely after their shared accepted base.

**SS-4.2 — No automatic field merge.** Big Gains MUST NOT automatically merge fields of a same-entity conflict unless a future reviewed contract proves the merge safe for every affected field. Under this contract, explicit local-versus-cloud choice is REQUIRED.

**SS-4.3 — Tombstone identity.** A tombstone is scoped to the same logical-entity tuple as its source row and carries its own positive revision, deletion timestamp, update timestamp, fingerprint, and idempotency identity.

**SS-4.4 — Winner order.** The remote winner for one logical entity is selected by higher revision, then later normalized timestamp, then tombstone on an exact revision-and-time tie. Winner selection MUST NOT authorize automatic adoption when SS-3.4 fails against the accepted catalog.

**SS-4.5 — Recreation.** A deleted entity MAY be recreated only by an explicit upsert that permits recreation, uses the winning tombstone as its verified base, and creates a strictly greater revision. Absence alone MUST NOT resurrect an entity.

**SS-4.6 — Missing remote row.** A cataloged entity that disappears remotely without a winning tombstone MUST be treated as unverifiable drift and MUST NOT be adopted as deletion.

## 5. Local-first mutation contract

**SS-5.1 — Persist before enqueue.** An accepted user mutation MUST be persisted to the existing local schema-v5 profile before its outbound operation is durably enqueued.

**SS-5.2 — Frozen operation.** A durable outbound operation MUST freeze account ID, profile ID, source table, stable client ID, mutation, revision, normalized timestamp, desired fingerprint, base revision identity, payload, recreation permission, and deterministic idempotency key.

**SS-5.3 — Ordinary transport.** Every production write, including a rebased Keep This Device operation, MUST use the normal guarded and idempotent transport. Blind upsert, revision downgrade, ownership reassignment, and transport-specific bypasses are forbidden.

**SS-5.4 — Retry identity.** Retrying an operation MUST preserve its logical entity, payload, revision, timestamp, and idempotency key. Retry metadata MAY change without changing the operation identity.

**SS-5.5 — Acknowledgement.** An operation MUST remain pending until an affected-row readback proves the exact owned remote identity, revision, timestamp, fingerprint, tombstone state, and idempotency result required by that operation.

**SS-5.6 — Queue preservation.** Reconciliation and conflict recovery MUST NOT blindly clear the queue. An operation MAY be removed or replaced only when its exact logical disposition is verified and durably persisted; unrelated operations MUST be preserved.

**SS-5.7 — Verified parity.** Verified parity means: a fresh verified account-scoped cloud read reconstructs without ownership or schema issues; every local semantic source record and winning tombstone matches its cloud counterpart under the canonical checksum contract; every affected profile checksum matches; the accepted catalog describes the same winners; and the outbound queue is verifiably empty. An empty queue alone is not parity.

## 6. Automatic adoption predicate

The **Verified Automatic Adoption Predicate** is the conjunction of SS-6.1 through SS-6.10. Automatic adoption MUST NOT begin unless every clause is true for the same candidate and every affected profile.

**SS-6.1 — No active workout.** No affected profile has a non-null active workout. Leaving Workout Mode without completing or discarding the workout does not satisfy this clause.

**SS-6.2 — No running or unresolved rest timer.** No affected profile has a non-null rest-timer deadline. Timer reconciliation MAY clear an expired deadline through its ordinary lifecycle before this predicate is evaluated; adoption MUST NOT clear or ignore the deadline itself. The stale-deadline rule is defined by SS-9.7.

**SS-6.3 — Local mutation quiescence.** No affected profile has a scheduled, pending, or in-flight local persistence, semantic capture, queue replacement, queue acknowledgement, flush, recovery, conflict-resolution, or adoption operation. The coordinator MUST be able to prove this state; absence of an exposed signal is not proof.

**SS-6.4 — Empty verifiable queue.** The durable outbound queue parses under its current contract, belongs entirely to the verified runtime, and contains zero pending operations. Missing, malformed, wrong-owner, or partially persisted queue state fails this clause.

**SS-6.5 — Local/catalog identity.** Every current local semantic record exactly matches its accepted catalog fingerprint, and every cataloged tombstone corresponds to local absence. A new local record, changed fingerprint, locally missing live record, or locally recreated tombstone fails this clause.

**SS-6.6 — Verified account/profile identity.** A fresh verified Auth user and account read exactly match the runtime, accepted catalog, RLS-visible account, and complete profile mapping. Managed-owner, managed-member, and independent runtime-shape invariants remain unchanged.

**SS-6.7 — Monotonic remote advancement.** Every remote winner is either a valid newly observed entity, the exact accepted revision identity, or a monotonic successor under SS-3.3. At least one remote winner is new or higher. A downgrade, missing row without tombstone, backward timestamp, malformed identity, or ownership issue fails this clause.

**SS-6.8 — Equal-revision parity.** Every remote winner at the accepted catalog revision is fingerprint-, tombstone-, and timestamp-identical under SS-3.4.

**SS-6.9 — Fresh clean readback.** The candidate is built only from a fresh account-scoped remote read performed during the current reconciliation run. The remote rows reconstruct valid schema-v5 source data at exact semantic parity with the candidate, with no unsupported entity, duplicate singleton, deterministic-ID mismatch, ownership issue, malformed payload, or unsupported contract.

**SS-6.10 — No same-entity conflict.** No pending, scheduled, in-flight, or otherwise proven local mutation targets a logical entity whose remote winner advanced differently from the local mutation's accepted base. Any genuine same-entity conflict fails this clause even when unrelated remote entities are safe successors.

**SS-6.11 — Predicate result.** Failure of any SS-6 clause MUST leave all current local profile data, queue state, and cloud data unchanged except for permitted device-local observability metadata.

## 7. Time-of-check/time-of-use rule

**SS-7.1 — Advisory trigger check.** A predicate evaluated when initialization, sign-in, `online`, `pageshow`, or visible `visibilitychange` fires is advisory only and MUST NOT authorize a commit.

**SS-7.2 — Fresh final remote read.** Immediately before commit, the coordinator MUST obtain and reconstruct a new verified account-scoped remote read rather than reuse the trigger-time candidate or cached shadow state.

**SS-7.3 — Fresh final local check.** Immediately before commit, the coordinator MUST re-read every affected local profile, the accepted catalog, the durable queue, active-workout and rest-timer state, and the local-mutation quiescence signal.

**SS-7.4 — Complete re-evaluation.** The coordinator MUST re-evaluate SS-6.1 through SS-6.10 using the fresh final local and remote state. Any changed generation, identity, revision, fingerprint, queue value, lifecycle state, or persistence state MUST abort the adoption without commit.

**SS-7.5 — Background generation.** A reconciliation run MUST carry a lifecycle generation. If the page is backgrounded, restored, or superseded before commit, that generation MUST be invalidated or freshly revalidated under SS-7.2 through SS-7.4; a stale generation MUST NOT commit on resume.

## 8. Adoption commit rule

**SS-8.1 — Reuse canonical reconstruction.** Adoption MUST use the existing canonical schema-v5 recovery adapter and MUST NOT introduce a parallel reconstruction, normalization, history, or persistence path.

**SS-8.2 — Crash-consistent transaction.** Because browser `localStorage` has no multi-key transaction, “atomic adoption” under this contract means a crash-consistent, all-or-recoverable transaction. Before the first profile or catalog write, the coordinator MUST durably record an adoption intent sufficient to distinguish and verify the complete old and candidate document sets.

**SS-8.3 — Commit visibility order.** Candidate profile documents MUST be written and read back before the accepted catalog and parity comparison become current. The accepted catalog MUST NOT describe a candidate profile set that has not been completely retained and verified. Ordinary save and sync work MUST remain suppressed while an adoption intent is unresolved.

**SS-8.4 — Successful completion.** After every candidate profile, catalog, and comparison document is retained and validated, the coordinator MUST run post-commit semantic parity verification. The adoption intent MAY be cleared only after that verification succeeds.

**SS-8.5 — Caught failure.** A caught persistence or verification failure MUST restore the complete pre-adoption document set and original queue state. Rollback itself MUST be read back and verified. Failure to verify rollback MUST surface an ordinary actionable state and MUST suppress further automatic adoption.

**SS-8.6 — Suspension or termination.** On startup or resume, an unresolved adoption intent MUST be detected before ordinary profile save, capture, flush, or adoption. The coordinator MUST deterministically finish only when the complete candidate set and fresh remote state still satisfy this contract; otherwise it MUST restore the complete verified pre-adoption set. It MUST NOT expose a partially adopted catalog as current.

**SS-8.7 — Cloud immutability.** Automatic adoption is cloud-to-local. It MUST NOT write, delete, repair, normalize, or downgrade hosted rows.

## 9. Deferral and retry

**SS-9.1 — Deferral.** A temporary local condition that can become safe without choosing a data winner defers adoption. Active workout, unresolved rest deadline, in-flight local work, an online flush that can reach parity, background lifecycle transition, or another reconciliation run are deferrals.

**SS-9.2 — Rejection.** Unverified identity, malformed or wrong-owner state, catalog mismatch, non-monotonic remote history, equal-revision disagreement, missing row without tombstone, reconstruction failure, failed readback, unresolved adoption journal, or genuine same-entity conflict rejects automatic adoption.

**SS-9.3 — No busy retry loop.** Deferral and rejection MUST NOT create an unbounded immediate retry loop. Lifecycle events MUST pass through one debounced, single-flight scheduler.

**SS-9.4 — Named post-workout retry trigger.** Adoption deferred by an active workout MAY retry only on **post-local-parity**: the workout is completed or discarded, its resulting local capture and outbound operations have finished, a fresh comparison proves verified parity for those local changes, and SS-6.1 through SS-6.4 are true. Exiting Workout Mode alone MUST NOT emit post-local-parity.

**SS-9.5 — Other retry triggers.** Initialization, successful sign-in, `online`, `pageshow`, and transition to visible MAY schedule a fresh reconciliation. Manual Recheck or Retry MAY schedule the same guarded path. None bypasses SS-6 or SS-7.

**SS-9.6 — Ordinary stale-state visibility.** Within five seconds after a deferral or rejection is detected, the ordinary status surface MUST show one concise state: updating, updates waiting until the workout ends, retry needed, or decision needed. Technical reasons, checksums, queue depth, and recovery controls MAY remain in Advanced. A detected stale state MUST NOT remain visually “In sync.”

**SS-9.7 — Rest-timer staleness bound.** A non-null rest deadline blocks adoption. An expired deadline MAY be reconciled and cleared only by the existing timer lifecycle. If it remains stored more than five minutes after its deadline, automatic adoption MUST reject with an actionable timer-state verification failure rather than silently ignore or clear it.

**SS-9.8 — Deferred data preservation.** Deferral or rejection MUST preserve all local profile data and every queue operation. It MUST NOT change the cloud.

## 10. Conflict rules

**SS-10.1 — Genuine same-entity conflict.** A genuine same-entity conflict exists when a verified local mutation still exactly represents current local data and its accepted base, while the winning remote revision for the same logical entity has monotonically advanced from that base to different semantic content or tombstone state.

**SS-10.2 — Entity isolation.** Safe remote advancement of unrelated logical entities MUST NOT turn one same-entity conflict into profile-wide corruption. Unrelated advancement MAY be reconstructed and retained as part of the selected resolution only after its own identity, monotonicity, and semantic parity are verified.

**SS-10.3 — Explicit decision.** A genuine same-entity conflict MUST show concise entity-specific local-versus-cloud information and explicit Keep Cloud and Keep This Device controls. Technical detail MAY be expandable. No timeout, default button, lifecycle trigger, or feature flag may choose automatically.

**SS-10.4 — Keep Cloud.** Keep Cloud MUST remove or acknowledge only the exact conflicting local operation after re-verifying the current remote winner, adopt that verified winner, preserve unrelated queue operations, safely fast-forward verified unrelated remote advancement, and finish at verified semantic parity. It MUST NOT clear the queue generally.

**SS-10.5 — Keep This Device.** Keep This Device MUST preserve the queued local semantic payload exactly, use the verified current remote winner as the new base, create revision `max(remote revision, queued revision) + 1` with a non-backward normalized timestamp, and send the replacement through the ordinary guarded/idempotent transport. It MUST NOT claim parity until affected-row readback verifies the replacement and remaining remote advancement is reconciled.

**SS-10.6 — Resolution TOCTOU.** Both choices MUST re-verify identity, local payload, queue identity, remote winner, unrelated advancement, and reconstruction immediately before changing local or queue state. A change during resolution MUST preserve the original local data and pending operation and require a new decision.

**SS-10.7 — Resolution result.** A successful conflict resolution MUST preserve completed-history authority, unrelated remote additions, revision monotonicity, account/profile isolation, schema v5, and an empty queue only when every operation has an individually verified disposition.

## 11. Observability

**SS-11.1 — Required counters.** Each device MUST maintain separate non-negative counters for successful automatic adoptions, explicit same-entity conflicts shown, automatic-adoption deferrals caused by an active workout, and automatic-adoption rejections caused by failed verification.

**SS-11.2 — Local metadata only.** Counters MUST be stored in a dedicated device-local metadata document outside schema-v5 profile state, the durable outbound queue, the accepted catalog, comparison checksums, recovery/adoption journals, every synchronized table, and every fingerprint input.

**SS-11.3 — No training data.** Counter records MUST NOT contain workout payloads, entity IDs, exercise names, loads, repetitions, bodyweight values, notes, account/profile UUIDs, Auth identifiers, or user-entered content.

**SS-11.4 — No remote telemetry.** Counters MUST NOT be transmitted to Supabase, GitHub, or another remote service under this contract.

**SS-11.5 — Counting boundary.** A successful automatic adoption increments only after SS-8.4. A conflict increments once per distinct surfaced conflict decision, not once per render. An active-workout deferral increments once per reconciliation generation that newly enters that deferral state. A verification rejection increments once per reconciliation generation that newly enters a rejected state. Rendering, reload, or repeated display of the same stored event MUST NOT increment a counter.

**SS-11.6 — Checksum independence.** Creating, incrementing, resetting, or removing observability metadata MUST NOT change a source fingerprint, table checksum, profile checksum, queue operation identity, or accepted-catalog identity.

## 12. Open questions for review

**SS-12.1 — Feature-flag source.** Task 2 requires a runtime-readable rollout flag that defaults off, a Jorge/Sontai dogfood enablement path, and a persistent per-device emergency pause that takes precedence. Review must select the exact deploy-time configuration field and exact device-local keys before implementation.

**SS-12.2 — Adoption-journal representation.** Task 2 must select and test the device-local adoption-intent format, storage key, old/candidate document proofs, and startup recovery entry point required by SS-8.2 through SS-8.6. The journal MUST remain outside schema-v5 profile state and synchronized fingerprints.

**SS-12.3 — User-facing copy.** Review must approve the concise ordinary status copy required by SS-9.6 and the passive successful-adoption message. Technical detail remains in Advanced.

**SS-12.4 — Review gate.** Task 2 MUST NOT begin until Jorge approves this document and resolves SS-12.1 through SS-12.3. Approval of this document does not authorize a production deployment, Supabase mutation, GitHub snapshot retirement, PR, merge, or release.
