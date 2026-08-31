# Big Gains Program portability synchronization v1

- Status: **Production capability ON; corrected physical publication, convergence, and second-device recovery passed; real mutable B → A, successor, conflict, and offline physical acceptance remain open**
- Contract version: **`big-gains.program-portability-envelope.v1` / 1**
- Repository baseline: `origin/main` at `c242bfd0c033df0e102739958f1cad7b1aa0aee6`
- Runtime marker: `v97-program-portability-convergence`
- Local profile schema: **5**
- Date: 2026-08-25

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **MAY**, and **OPTIONAL** are normative when capitalized.

Implementation tracking: the hosted migration/RLS destination and hardened JWT Edge gateway are live. Rollout preflight proved zero Program rows; the first deliberate physical publication created exactly one revision-1 row and received exact readback ACK without changing History or unrelated hosted sources. Device A then displayed a false conflict because recovery compared locally retained immutable-member array order with the envelope's canonical catalog order. Rollout stopped before either conflict choice, and the capability was returned to OFF without editing the accepted row. Recovery now proves equality by rebuilding the local envelope at the remote revisions and matching the aggregate plus all three component fingerprints; a stored device with an empty local Program may also adopt a complete validated remote graph. The corrected `v97-program-portability-convergence` build passed protected CI, deployed OFF, and was then deliberately activated through the repository-controlled version-1 capability. Device A converged automatically without choosing a winner. A second signed-in browser with no local Program explicitly adopted the verified complete graph, retained it across reload, and reported exact parity. The hosted row remained revision 1, every unrelated hosted count/checksum matched preflight, and normal UI exposed no fingerprints or revisions. No honest mutable B → A transition was available after the owner had already trained, so no workout, Program successor, conflict, or offline mutation was fabricated on the live profile. Those physical gates remain required before the feature is marked RC-complete; their deterministic deployed-code coverage is green but is not presented as physical proof.

## 0. Authority and boundary

**PPS1-0.1 - Purpose.** This contract defines the first portable Program semantic domain required by [RC-2](RC2_SELF_SERVE_ONBOARDING_RECOVERY.md). A conforming implementation restores exact Program/Routine identities, immutable lineage and pins, mutable heads and sequence state, and active-workout compatibility without reconstructing Program meaning from History.

**PPS1-0.2 - Precedence.** This contract extends [Synchronization Semantics](SYNC_SEMANTICS.md), [Program Foundation v1](PROGRAM_FOUNDATION_V1.md), and [Programming Engine v1](PROGRAMMING_ENGINE_V1.md). Completed History, active-workout stability, local-first acceptance, immutable account/profile ownership, and explicit conflict choice take precedence over Program availability. Until a conforming runtime and hosted migration ship, the current five-table source set and local-only `programCapture` behavior remain factual runtime authority.

**PPS1-0.3 - Documentation-only interval.** This interval MUST change Markdown only. It MUST NOT change runtime code, local schema, tables, migrations, RLS, Supabase configuration or data, production data, Auth, queue state, deployment, or release state.

**PPS1-0.4 - Stable IDs.** `PPS1-*` clause and `PPS1-AT-*` acceptance IDs are stable citations and MUST NOT be renumbered.

**PPS1-0.5 - Normative versus informative.** Clauses are normative. Tables and examples explain those clauses unless they explicitly say otherwise. Physical column names remain implementation notes except where a clause fixes a stable semantic identity or contract.

## 1. Proven state and synchronized domain

**PPS1-1.1 - Current local aggregate.** `state.programCapture` is an optional schema-v5 `big-gains.program-capture.v1` aggregate. It is normalized, saved, imported, and backed up with its profile, but its `storageMode` is `local_only` and it is excluded from current cloud records, checksums, reconstruction, and queue capture.

**PPS1-1.2 - Stable Routine records.** `routines[]` is canonical semantic state. Each record owns stable `routineId`, immutable account/profile scope, `purposeKey`, mutable `currentVersionId`, and `createdAt`.

**PPS1-1.3 - Immutable Routine versions.** `routineVersions[]` is canonical semantic state. Each version owns `routineVersionId`, `routineId`, owner scope, monotonic `versionNumber`, predecessor, label, reviewed source provenance, ordered canonical exercise prescriptions, creation/effective time, author kind, and explicit approval.

**PPS1-1.4 - Stable Program records.** `programs[]` is canonical semantic state. Each record owns stable `programId`, owner scope, `purposeKey`, status (`draft`, `active`, `completed`, or `archived`), mutable latest/active version pointers, and creation/update times. At most one Program is active per profile.

**PPS1-1.5 - Immutable Program versions.** `programVersions[]` is canonical semantic state. Each version owns `programVersionId`, `programId`, owner scope, monotonic `versionNumber`, predecessor, name, rolling schedule/cadence, rolling duration and start, ordered stable slots, exact Routine-version pins, optional weekday anchors, block-review policy, Off/Review authority, Goal references, versioned `policyRefs`, effective-boundary metadata, creation/author metadata, and version note.

**PPS1-1.6 - Active pointer and sequence.** `activeProgramVersionId` and `sequenceState` are canonical mutable operational state. The current sequence fields are `programId`, `programVersionId`, zero-based `nextSlotIndex`, non-negative `completedCycles`, and `updatedAt`. Section 6 adds the revision and transition identity required for safe portability.

**PPS1-1.7 - Application traces.** `applicationTraces[]` remains profile-local PE observability and retry convenience. It is not synchronized, is not part of the envelope fingerprint, and is not required for fresh-device continuity. A conforming publisher MUST exclude it without deleting it locally. Successor Program/Routine versions, their predecessor links, effective boundary, and version notes remain the authoritative result of an approved application.

**PPS1-1.8 - Transport-only fields.** `contract`, `storageMode`, publication markers, queue metadata, accepted-catalog metadata, retry counters, remote row IDs, and recovery journals describe storage or transport. They MUST NOT acquire Program meaning or enter immutable member fingerprints.

**PPS1-1.9 - Derived and transient exclusion.** Program Analyzer output, PE evaluations/proposals, performance-evidence projections, completed-cycle proof derived from History, UI selection/expansion state, labels resolved for display, diagnostics, calendar projections, and presentation caches MUST NOT be synchronized as Program authority. They MUST be recomputed from adopted canonical sources.

**PPS1-1.10 - Goal references.** `priorityGoalIds` are canonical stable references, not copied Goal payloads. A non-empty reference MUST resolve to the same recovered profile's canonical Goal domain before Program adoption; absence or cross-profile resolution blocks Program adoption without changing either source.

**PPS1-1.11 - No hard deletion in v1.** V1 supports Program lifecycle status and immutable retention, not hard deletion of Program/Routine identities or versions. The Program-domain envelope MUST NOT be tombstoned after baseline publication. A missing cataloged envelope is unverifiable drift. A later hard-delete contract must preserve completed `programOrigin` facts and define explicit tombstones.

## 2. Canonical graph and member validation

**PPS1-2.1 - Complete domain.** The synchronized Program domain is the canonical content in PPS1-1.2 through PPS1-1.6 plus the portability metadata in PPS1-2.7 and Section 6. The complete retained graph, not merely the active Program, MUST travel together.

**PPS1-2.2 - Identity uniqueness.** Routine, Routine-version, Program, Program-version, and slot IDs MUST be unique in their required scope. Duplicate identities, ambiguous heads, more than one active Program, or owner mismatch makes the envelope invalid.

**PPS1-2.3 - Pin closure.** Every Program slot MUST resolve both its `routineId` and exact `routineVersionId` inside the same envelope and profile. The resolved version's stable Routine identity MUST match the slot. No executable Program version may reference an unavailable pin.

**PPS1-2.4 - Pointer closure.** Every Routine head, Program latest/active pointer, aggregate active pointer, and sequence Program-version pointer MUST resolve within the envelope and satisfy the current status/single-active rules.

**PPS1-2.5 - Exact ordering.** Array order is semantic for Routine prescriptions and Program slots. Normalization MUST preserve order and MUST NOT sort, deduplicate, or relabel meaningful ordered content to repair a graph.

**PPS1-2.6 - Authority.** Portable authority is exactly `off` or `review`. `auto` and unknown modes MUST fail closed. Sync transports accepted state and has no authority to apply a proposal or raise authority.

**PPS1-2.7 - Member manifest.** The envelope MUST include or deterministically expose a manifest of every retained Routine identity/version and Program identity/version with its stable ID and canonical fingerprint. It MUST also expose component fingerprints and revisions for immutable definitions, mutable heads/status, and sequence state. A manifest disagreement is invalid; a consumer MUST NOT silently regenerate it from a partial payload.

**PPS1-2.8 - Empty domain.** A profile with no Program is valid. After cutover it is represented by a verified revision-1 empty Program-domain envelope, not by invented Programs/Routines and not by ambiguous row absence.

**PPS1-2.9 - Component partition.** The canonical non-empty payload partitions immutable stable-identity fields plus immutable Routine/Program versions under `definitions`; Routine current heads plus Program lifecycle/latest/active heads and the aggregate active pointer under `heads`; and current rolling position, cycle count, update time, and transition identity under `sequence`. Catalog arrays are ordered by stable identity for serialization, while ordered Routine prescriptions and Program slots retain their semantic order. Contract/version, fixed logical client ID, verified scope, component revisions, and the member manifest wrap those components and enter the aggregate fingerprint, not immutable member fingerprints.

**PPS1-2.10 - Existing-capture transition baseline.** A first revision-1 projection of an existing valid schema-v5 sequence MAY carry `lastTransition: null` because the pre-portability capture did not retain transition identity and publication MUST NOT invent History. Any sequence revision after that baseline MUST carry the complete deterministic `lastTransition` required by PPS1-6.1. This compatibility rule does not authorize a null transition for a new portable mutation or change schema-v5 persistence.

## 3. Cloud representation

**PPS1-3.1 - Selected architecture.** V1 MUST use one first-class, versioned Program-domain envelope row per profile in a new semantic source table named `program_domains`. Its stable logical client ID is `program-domain`. Preference JSON and custom-routine rows MUST NOT carry this envelope.

**PPS1-3.2 - Selection rationale.** One envelope matches the existing whole-profile `programCapture` transaction, preserves exact IDs, makes every Program version and Routine pin visible atomically, gives fresh-device recovery one graph candidate, avoids multi-row partial graphs, and minimizes migration and queue dependency risk. Per-version rows were rejected for v1 because they require a second transactional manifest and can expose pins before definitions; preferences were rejected because they erase domain ownership and conflict semantics.

**PPS1-3.3 - Physical boundary.** A later hosted migration MUST add the profile-scoped `program_domains` source table distinct from `preferences`. The semantic row carries immutable account/profile ownership, stable client ID, envelope contract/version, positive aggregate revision, normalized update time, canonical payload, canonical aggregate fingerprint, idempotency identity, and the exact accepted base required for guarded replacement.

**PPS1-3.4 - Atomic visibility.** One accepted row revision contains the entire visible Program graph, member manifest, mutable heads/status, and sequence state. A Program successor and every new Routine version it pins MUST appear in the same envelope revision. A consumer MUST NOT adopt payload fragments or a manifest from a different revision.

**PPS1-3.5 - Internal immutability.** Transporting one mutable row does not make historical members mutable. Server/client validation MUST compare the accepted base envelope with the candidate and reject removal or in-place change of an existing immutable version. New immutable members are append-only; mutable heads/status and sequence may change only under their specific clauses.

**PPS1-3.6 - Fingerprints.** The aggregate fingerprint MUST be SHA-256 over the canonical key-sorted representation of envelope contract/version, verified profile client ID, stable logical client ID, complete synchronized semantic payload, component revisions, and member manifest. Array order remains meaningful. Transport metadata listed in PPS1-1.8 and local application traces MUST be excluded.

**PPS1-3.7 - Current local compatibility.** Publication MUST accept a validated `big-gains.program-capture.v1` source with `storageMode: local_only`, preserve every semantic ID and value, and project it into the envelope without treating `storageMode` as semantic data. Publication status MUST be tracked separately. A later runtime MAY add a backwards-compatible portable marker, but MUST NOT rewrite identities or require local schema 6 merely to publish.

**PPS1-3.8 - Exact serializer empty.** The canonical serializer payload for a verified no-Program profile is exactly `{}`. Its aggregate fingerprint is still scope-specific: the fingerprint input deterministically supplies the supported contract/version, verified account/profile scope, fixed `program-domain` client ID, three zero component revisions, and an empty member manifest outside the stored payload. Component fingerprints remain the canonical hashes of empty definitions, empty heads, and null sequence. A transport adapter MUST NOT wrap or rewrite the stored `{}` payload.

## 4. Revision and conflict model

**PPS1-4.1 - Aggregate revision.** The envelope is one logical sync entity `(account_id, profile_id, program_domains, program-domain)`. It begins at revision 1 and each semantic mutation creates exactly the next positive aggregate revision from the accepted winner.

**PPS1-4.2 - Component revisions.** The non-empty canonical payload carries monotonic non-negative definitions, heads, and sequence revision values, mirrored exactly by the `program_domains` row columns. The exact empty payload carries no fields and uses three zero row revisions under PPS1-3.8. A component revision increments only when that component changes. The aggregate revision increments when any component changes. Component fingerprints prove which semantic boundary changed; they do not replace aggregate compare-and-swap.

**PPS1-4.3 - No downgrade or blind overwrite.** A lower remote aggregate or component revision MUST NOT be adopted. A write MUST name the exact accepted aggregate revision, timestamp, fingerprint, and component bases. Blind upsert and last-write-wins are forbidden.

**PPS1-4.4 - Equal revision.** Equal aggregate revision is acceptable only when normalized timestamp, aggregate fingerprint, component revisions/fingerprints, and complete manifest are identical. Any disagreement at an equal revision is corruption/conflict and blocks automatic adoption and acknowledgement.

**PPS1-4.5 - Conflict granularity.** Transport conflict is whole-envelope because only one row is visible. Resolution analysis MUST distinguish immutable definitions, mutable heads/status, and mutable sequence. It MAY perform only the proved reconciliations in Section 9; it MUST NOT offer arbitrary field-level merge.

**PPS1-4.6 - Local-first.** A Program create/edit/approval/activation or sequence transition MUST commit to the canonical local schema-v5 profile before its frozen envelope operation is durably enqueued. Network failure MUST NOT undo the local mutation or block local workout logging.

**PPS1-4.7 - Queue preservation and ACK.** Retry preserves the complete operation identity and idempotency key. The operation remains pending until affected-row readback proves the exact owned aggregate revision, timestamp, aggregate/component fingerprints, manifest, and idempotency result. Reconciliation MUST NOT blindly clear or replace unrelated queue operations.

## 5. Immutability and lineage

**PPS1-5.1 - Immutable committed versions.** A Routine or Program version is immutable once committed locally. Sync, migration, recovery, conflict resolution, rollback, and PE application MUST NOT rewrite it in place.

**PPS1-5.2 - Equal ID, unequal payload.** Equal `routineVersionId` or `programVersionId` with unequal canonical immutable fingerprint is corruption/conflict, not drift and not mergeable. The graph MUST remain blocked for explicit recovery.

**PPS1-5.3 - Program lineage.** A first Program version has version number 1 and null predecessor. Each successor has version number exactly predecessor plus one, names an available predecessor with the same `programId`, and cannot create a cycle or fork silently.

**PPS1-5.4 - Routine lineage.** A first Routine version normally has version number 1 and null predecessor; a successor normally increments by one and retains `routineId`. The existing PE auxiliary-variant exception MAY create a new Routine identity/version 1 linked to the exact source Routine version only when its typed approved application and `source.basedOnRoutineVersionId` prove that edge. No other cross-Routine predecessor is valid.

**PPS1-5.5 - Head monotonicity.** A Routine current head and Program latest/active head may move only to a valid retained successor or through an explicit lifecycle action allowed by Program Foundation. Rollback creates a new successor; it never points backward as though history had not occurred.

**PPS1-5.6 - Completeness proof.** Fresh recovery MUST validate every retained predecessor chain to an allowed root, every head to its identity, every pin to an available immutable Routine version, and every member fingerprint before Program state becomes visible.

**PPS1-5.7 - History origin isolation.** Completed-workout `programOrigin` is never rewritten to match a recovered, current, or chosen Program graph. Missing lineage blocks Program detail; it does not authorize changing the fact.

## 6. Sequence state

**PPS1-6.1 - Canonical fields.** Portable sequence state contains the current fields in PPS1-1.6 plus positive `sequenceRevision` and `lastTransition`. `lastTransition` contains a deterministic transition ID, kind (`activation`, `successor_carry`, or `completion`), exact before/after Program version, slot index and completed-cycle values, time, and completion workout ID when applicable.

**PPS1-6.2 - Activation.** Activation binds sequence to the activated Program version at slot 0/cycle 0 unless an existing reviewed successor-carry rule applies. Activation records a transition but is not workout completion.

**PPS1-6.3 - Completion-only advancement.** Materialization reserves the current slot without advancing. Only successful local persistence of a completed workout whose exact frozen origin matches the accepted sequence base advances the sequence.

**PPS1-6.4 - Wrap.** Completion increments `nextSlotIndex` by one. Completion of the final slot wraps it to 0 and increments `completedCycles` exactly once. Other completions do not increment the counter.

**PPS1-6.5 - Non-advancement.** Discard, reload, resume, repeated start, failed completion save, partial workout, elapsed date, missed preferred weekday, recovery read, proposal review, and approval itself MUST NOT advance sequence.

**PPS1-6.6 - Idempotence.** A completion transition ID is deterministic from the completed workout ID and exact origin/base sequence. Replay of the same transition is acknowledgement, not another advance. A different workout ID claiming the same Program/version/slot/cycle base is not the same transition.

**PPS1-6.7 - Stale write.** A sequence write must name its exact `sequenceRevision`, position, cycles, Program version, and last-transition base. If the accepted remote base differs, the write is stale and MUST NOT advance or rebase automatically except for exact transition replay.

**PPS1-6.8 - Concurrent completion.** Two distinct completion transitions from the same base require an explicit sequence conflict decision. Both completed workouts remain History facts. Exactly one transition counts for sequence; resolving the conflict MUST NOT advance twice or rewrite either origin.

**PPS1-6.9 - Successor carry.** Approval of a Program successor carries the logical next slot and completed-cycle count into the successor and records `successor_carry`; it never advances. If an exact frozen predecessor workout was active at approval, only its later successful completion may advance the successor once under PPS1-7.5.

## 7. Active workout interaction

**PPS1-7.1 - Frozen snapshot.** A Program-origin active workout keeps the exact Program, Program-version, Routine, Routine-version, slot, cycle, owner, and materialization provenance it captured. Later successors, recovery, and conflict resolution MUST NOT mutate it.

**PPS1-7.2 - Dependency availability.** An active Program-origin workout is recoverable only when the adopted envelope contains and validates its referenced Program/Routine versions and slot. Missing definitions produce an explicit recovery block; History or labels MUST NOT backfill them.

**PPS1-7.3 - Fresh-device ordering.** Fresh-device reconstruction MUST first validate the Program envelope, then validate the active session against that graph and sequence, then build one profile candidate. Neither domain becomes visible locally until the complete candidate commits through the crash-consistent adoption transaction.

**PPS1-7.4 - Initialized-device adoption.** Existing [Synchronization Semantics](SYNC_SEMANTICS.md) active-workout and rest-timer deferral remains in force. An initialized device with an active workout MUST defer remote Program-envelope adoption until post-local-parity; the implementation MUST NOT decide that a graph change is harmless ad hoc.

**PPS1-7.5 - Frozen predecessor completion.** Completing a frozen predecessor workout after successor approval advances the successor exactly once only when the successor directly names that predecessor, the effective boundary names that exact workout, the carried sequence still matches its slot/cycle, and the origin still matches the predecessor pin. Otherwise it does not advance.

**PPS1-7.6 - Program-before-consumer.** A Program-origin active-session or completed-workout cloud operation MUST depend on an acknowledged envelope revision containing every referenced immutable definition. Offline use continues locally; transport waits rather than publish an orphaning consumer.

## 8. Fresh-device recovery

**PPS1-8.1 - Exact promise.** Recovery restores the complete current Program-domain envelope: exact stable identities, all retained immutable versions and lineage, exact pins and order, status/heads, active pointer, Goal references, cadence/anchors, duration/start, block/review configuration, Review/Off authority, effective metadata, and sequence state.

**PPS1-8.2 - No reconstruction from History.** Recovery MUST NOT infer, synthesize, or backfill a Program, Routine version, pin, sequence position, cycle count, lineage edge, or active pointer from completed workouts, `programOrigin`, custom routines, Goals, weekdays, or labels.

**PPS1-8.3 - Orphans.** Recovery MUST NOT silently drop an orphaned reference or unavailable member. Malformed, duplicate, incomplete, cyclic, cross-profile, unsupported, manifest-mismatched, or orphaned graph state produces **Recovery stopped safely** and preserves all local and cloud data.

**PPS1-8.4 - Owner scope.** The Auth user, account, profile UUID, profile client ID, envelope owner fields, active-session origin, Goal references, accepted catalog, and RLS-visible mapping MUST all match the verified runtime shape. A client-supplied ID grants no access.

**PPS1-8.5 - Pristine prerequisite.** Automatic fresh-device recovery requires the existing pristine/recoverable schema-v5 namespace rules, a verifiably empty queue, no unresolved adoption journal, no conflicting recovery marker/catalog, and a freshly verified owner/profile mapping. It MUST NOT overwrite meaningful local Program or other training state.

**PPS1-8.6 - Non-pristine state.** A non-pristine device uses guarded fast-forward or explicit conflict recovery. It MUST preserve the local profile, Program capture, queue, and cloud until a safe result is proved; there is no whole-profile last-writer choice.

**PPS1-8.7 - Empty baseline.** After Program cutover, fresh recovery requires either a valid empty envelope or a valid meaningful envelope. Uncataloged row absence is allowed only before that profile's explicit cutover and MUST NOT be called full RC recovery.

**PPS1-8.8 - Candidate commit.** Cloud-backed training records, profile presentation, Program envelope, active session, accepted catalog, comparison, and recovery marker MUST be validated as one candidate and committed with the existing all-or-recoverable adoption-journal ordering. Program parity MUST NOT become current before the profile document containing the complete capture is retained and read back.

**PPS1-8.9 - Honest recency.** Only an envelope with verified cloud parity is recoverable elsewhere. Pending device-only Program mutations remain safe locally and visible as pending, not falsely advertised as restored.

## 9. Reconciliation

**PPS1-9.1 - Safety predicate.** Program reconciliation inherits fresh owner verification, fresh final local/remote reads, queue integrity, accepted-base identity, lifecycle generation, crash-consistent commit, no downgrade, no equal-revision disagreement, and post-commit parity from Synchronization Semantics.

| Case | Normative result |
| --- | --- |
| **PPS1-9.2 - Remote-only advancement.** Local envelope/catalog match, queue is empty, no active/rest/in-flight block, and remote is a complete monotonic successor. | Automatically fast-forward the entire verified envelope and catalog. |
| **PPS1-9.3 - Local-only advancement.** Remote still equals the accepted base. | Keep local immediately, retain/send the frozen queued envelope operation, and claim parity only after exact ACK/readback. |
| **PPS1-9.4 - Identical revision/payload.** Aggregate identity and all component/member identities match. | Treat as parity/idempotent acknowledgement; do not mint a revision. |
| **PPS1-9.5 - Equal revision disagreement.** Any timestamp, fingerprint, component, or immutable-member disagreement exists. | Block as corruption/conflict; never choose by time. |
| **PPS1-9.6 - Concurrent sequence changes.** Distinct transitions share a base or one transition is stale. | Exact same transition replay is idempotent; otherwise require explicit sequence resolution under PPS1-6.8. |
| **PPS1-9.7 - Concurrent successor creation.** Both sides create different successors from the same Program or Routine head. | Require explicit graph conflict resolution; do not create a synthetic merged successor. |
| **PPS1-9.8 - Unrelated immutable additions.** Both sides share an exact accepted base; additions use disjoint IDs/fingerprints, have complete independent lineage/pins, and neither side changed heads/status/sequence that depend on the other addition. | MAY form a deterministic union and submit it as a new guarded envelope revision through ordinary transport. Any failed proof requires explicit conflict. |
| **PPS1-9.9 - Newer remote sequence only.** Definitions and heads are identical, remote sequence is a valid monotonic transition, local matches catalog, and queue/lifecycle are clear. | Fast-forward the whole envelope; component evidence identifies the sequence-only change. |
| **PPS1-9.10 - Active workout present.** The initialized local profile has active workout or unresolved rest state. | Defer adoption under PPS1-7.4; preserve queue and both candidates. |

**PPS1-9.11 - Explicit choices.** A genuine envelope conflict MUST show the affected Program/sequence boundary, local and cloud bases, consequences, and explicit safe choices. Keep Cloud and Keep This Device semantics inherit SS-10.4 and SS-10.5, but an implementation MUST refuse either choice when it would remove immutable referenced lineage, orphan an active/completed origin, or count two sequence transitions.

**PPS1-9.12 - No blind clear.** Resolving one Program conflict disposes only the exact conflicting envelope operation after readback. Unrelated workout, preference, active-session, or Program operations remain queued until individually verified.

## 10. Queue and transport ordering

**PPS1-10.1 - Atomic successor graph.** New Routine versions and the new Program version that pins them are one envelope mutation and one queue operation. No consumer can observe the Program successor without its pins because partial envelope payloads are invalid.

**PPS1-10.2 - Dependency scheduler.** Queue flush MUST honor semantic dependencies even when durable operations were captured separately. A dependent operation remains pending when its prerequisite fails, is conflicted, or lacks exact ACK.

**PPS1-10.3 - New active session.** The envelope revision containing the Program/Routine origin is sent and acknowledged before the Program-origin active-session upsert. This ordering never blocks local session creation or editing.

**PPS1-10.4 - Completion publication.** For a Program-origin completion, transport order is: ensure referenced envelope definitions are acknowledged; upsert and read back the completed workout; publish and read back the envelope sequence transition; then publish the active-session deletion/tombstone. A recovery read during an intermediate state MUST detect the active/completed duplicate or sequence/evidence mismatch and block rather than adopt partial continuity.

**PPS1-10.5 - Sequence without completion.** Activation and successor-carry transitions may publish in their atomic envelope revision without a completed-workout dependency because they do not claim completion or advance position.

**PPS1-10.6 - Application trace.** Application traces have no cloud operation or transport ordering. The accepted successor graph and effective metadata travel in the envelope.

**PPS1-10.7 - Retry.** Replaying an acknowledged successor envelope MUST NOT duplicate immutable versions. Replaying an acknowledged completion transition MUST NOT advance twice. Exact operation and transition IDs turn lost responses into readback acknowledgement.

**PPS1-10.8 - Alternative storage prohibition.** If implementation evidence later requires multiple Program rows, a reviewed successor contract MUST provide a transactional generation/manifest published last and invisible partial generations. V1 MUST NOT silently substitute per-version writes for the selected envelope.

## 11. History authority

**PPS1-11.1 - Performed facts.** Completed workouts, sets, notes, timestamps, retrospective markers, and recorded `programOrigin` remain authoritative History facts. Program sync MUST NOT overwrite, merge, normalize, or relink them.

**PPS1-11.2 - History edits.** Existing explicit History edit behavior preserves an existing valid `programOrigin` unless a separately reviewed provenance-correction contract provides an explicit user action. Retrospective creation and legacy workouts MUST NOT receive inferred origin.

**PPS1-11.3 - History deletion.** Deleting a workout creates its ordinary History tombstone and may change derived analysis/cycle proof. It MUST NOT delete, rewrite, roll back, or advance immutable Program definitions or canonical sequence state without a separate explicit Program action.

**PPS1-11.4 - No fabricated evidence.** Graph recovery MUST NOT fabricate a completed workout or completion event to justify sequence state. History recovery MUST NOT fabricate a Program graph to explain origin.

## 12. Programming Engine interaction

**PPS1-12.1 - Review only.** Programming authority remains Off/Review; Auto is unavailable. Sync does not evaluate, approve, apply, reject, or rebase PE proposals.

**PPS1-12.2 - Local application authority.** Explicit approval validates staleness and constructs the complete Routine/Program successor graph locally first. The application service has no independent decision authority. Only the resulting canonical envelope mutation is transported.

**PPS1-12.3 - Stale semantics.** Proposal/application IDs, base pins, Goal scope, evidence cutoff, and stale guards retain the Programming Engine contract. Remote synchronization MUST NOT recompute a PE decision or make a stale proposal current.

**PPS1-12.4 - Observability exclusion.** Decision traces, experimental traces, analyzer output, proposal payloads, rejected/later dispositions, and `applicationTraces` are not authoritative Program sync data in v1. They MAY remain local or enter a later separately governed observability system, but continuity MUST derive from canonical graph/result state.

## 13. Existing-profile migration

**PPS1-13.1 - Explicit cutover.** Each profile has an explicit Program-domain cutover state: `not_started`, `publishing`, `verified`, or `conflict`. Full Program portability is promised only at `verified`. Cutover metadata is not Program semantics and MUST NOT enter the envelope fingerprint.

**PPS1-13.2 - One-device publication.** A validated meaningful legacy `programCapture` with no remote envelope publishes revision 1 preserving every semantic ID, value, fingerprint, head, and sequence position. Exact readback and local-envelope projection parity are REQUIRED before marking verified. Retry is idempotent.

**PPS1-13.3 - No-Program publication.** A validated profile with no meaningful Program graph publishes the explicit empty revision-1 envelope. This records verified absence and MUST NOT invent Program, Routine, Goal, History, or sequence data.

**PPS1-13.4 - Identical legacy devices.** If another device's validated legacy capture projects to the exact verified envelope fingerprint, it adopts the catalog/verified marker without uploading a new revision.

**PPS1-13.5 - One meaningful and one empty.** A meaningful verified envelope may safely replace a provably untouched legacy-empty local capture through guarded adoption. A meaningful local capture may publish over an uncutover empty cloud only through the explicit revision-1 publication rule, not by treating absence as an accepted base.

**PPS1-13.6 - Two meaningful legacy graphs.** Unequal meaningful legacy captures on different devices have no shared synchronized base and MUST NOT silently select a winner or auto-merge. Cutover enters `conflict`, preserves both local/cloud candidates and all queues, offers export/backup, and requires an explicit reviewed choice. Publishing the device choice creates a guarded higher envelope revision; choosing cloud does not delete the unchosen local copy until its disposition/export is confirmed.

**PPS1-13.7 - Managed isolation.** Jorge and Alexa cut over independently under the same managed account and exact existing profile IDs. A verified envelope or conflict for one profile MUST NOT authorize reading, publishing, or choosing the other profile's graph. Managed members remain limited to their exact membership.

**PPS1-13.8 - Independent compatibility.** Existing independent and Sontai/SZW-compatible profiles use the same profile-scoped algorithm and retain their exact client IDs, storage namespaces, Programs, and presentation. Account recreation and invented migration data are forbidden.

**PPS1-13.9 - Failure safety.** A failed write, lost response, malformed local capture, ownership mismatch, incomplete graph, or readback mismatch leaves local training usable, preserves the exact local capture and queue, and does not mark portability verified.

Implementation note: `BigGainsProgramDomainCutover.createService(...)` is the dormant orchestration API for this section. `inspectCutover(...)` performs a fresh verified read/classification, `publishLegacy(...)` rechecks true row absence before freezing revision 1, and `resolveConflict(...)` revalidates a deterministic owner/scope plus local/remote fingerprint snapshot before either explicit choice. `Use cloud Program` delegates to the Slice 3 rollback-safe adoption transaction. `Use this device Program` retains compatible immutable remote members, changes only proved component revisions, and uses the guarded transport; it refuses equal-ID immutable disagreement, invalid/forked lineage, an empty-device erasure of a meaningful graph, or a sequence change lacking a contract-valid transition. Transport failure leaves the local profile unchanged and the exact operation pending. This implementation note does not enable or load the API in production.

## 14. Schema and RLS boundary

**PPS1-14.1 - Hosted change required later.** The selected architecture requires a later reviewed hosted schema/RLS migration and sync-adapter extension. This contract contains no SQL and authorizes no hosted mutation.

**PPS1-14.2 - Ownership.** Every envelope row is scoped by immutable `account_id` and `profile_id` with the existing composite account/profile relationship. The payload's profile client ID must match the verified profile row. Ownership is immutable after creation.

**PPS1-14.3 - RLS.** Forced RLS and grants MUST permit only the account owner or an exact managed membership authorized for that `(account_id, profile_id)`. Anonymous access and client-ID-only access remain denied. Members cannot use Program writes to change account, profile, membership, or another profile.

**PPS1-14.4 - Constraints.** The hosted boundary MUST enforce one stable Program-domain row per profile, positive monotonic aggregate revision, stable client ID, supported contract, immutable owner, guarded accepted-base replacement, and idempotency uniqueness. Client and server validation MUST enforce internal immutable member identity/fingerprint and lineage rules before acceptance.

**PPS1-14.5 - Minimal audit metadata.** Creation/update time, aggregate revision, canonical fingerprint, idempotency key, and accepted-base identity are permitted. Remote UUIDs, retry counters, device identifiers, application traces, Analyzer output, and user-entered History do not become Program audit metadata.

**PPS1-14.6 - Write authority path.** The browser MUST NOT execute a privileged database function directly. A write MUST pass through the JWT-required `program-domain-write` Edge Function, which derives the caller UUID only from a verified token and passes the exact frozen operation fields plus that server-derived identity to `private.put_program_domain_guarded`. The private fixed-empty-search-path definer independently proves the caller against the target account/profile, retains every revision, accepted-base, idempotency, ownership, and locking guard, and is executable by neither `anon` nor `authenticated`. ACK still requires an exact ordinary `authenticated` RLS readback.

## 15. RC acceptance scenarios

1. **PPS1-AT-01 - Fresh device:** create a Program on device A, reach verified parity, and recover the exact envelope on pristine device B.
2. **PPS1-AT-02 - Pins:** immutable Routine versions, ordered Program slots, and exact pins are byte-semantically preserved.
3. **PPS1-AT-03 - Sequence:** next slot, completed cycles, transition identity, and sequence revision are preserved.
4. **PPS1-AT-04 - A to B:** complete the next Program workout on A; B safely fast-forwards once after verified publication.
5. **PPS1-AT-05 - B to A:** complete the next Program workout on B; A safely fast-forwards once after verified publication.
6. **PPS1-AT-06 - Concurrent sequence:** distinct completions from one sequence base block automatic choice, preserve both History facts, and advance canonical sequence only once after resolution.
7. **PPS1-AT-07 - PE successor:** approve a PE successor on A; B receives the exact predecessor-linked successor graph without remote recomputation.
8. **PPS1-AT-08 - Frozen predecessor:** a predecessor-origin active workout survives successor approval and cross-device recovery unchanged, then advances the compatible successor exactly once.
9. **PPS1-AT-09 - Active dependencies:** active workout recovery succeeds only with every referenced Program/Routine definition present.
10. **PPS1-AT-10 - Missing pin:** a missing referenced Routine version blocks Program/profile recovery explicitly and preserves all data.
11. **PPS1-AT-11 - Equal revision corruption:** equal aggregate revision plus unequal immutable payload/fingerprint blocks adoption and ACK.
12. **PPS1-AT-12 - Remote immutable addition:** a complete remote-only immutable addition fast-forwards when local state is clean and all references validate.
13. **PPS1-AT-13 - Legacy once:** one meaningful local-only capture publishes exactly once; retry and a second identical device do not mint another revision.
14. **PPS1-AT-14 - Legacy conflict:** two unequal meaningful legacy graphs never silently overwrite or merge and remain exportable before choice.
15. **PPS1-AT-15 - No Program:** an empty verified envelope recovers as a valid no-Program profile.
16. **PPS1-AT-16 - History origin:** every completed `programOrigin` remains unchanged through publication, recovery, conflict, edit, and successor adoption.
17. **PPS1-AT-17 - Independent isolation:** an independent profile cannot select, read, insert, update, or infer another profile's envelope.
18. **PPS1-AT-18 - Managed isolation:** Jorge/Alexa owner and managed-member access retain exact per-profile isolation.
19. **PPS1-AT-19 - Offline edits:** Program edits persist locally first and produce durable dependency-ordered operations after connectivity returns.
20. **PPS1-AT-20 - Cloud failure:** failed Program cloud writes never block local workout start, edit, completion, History, or backup.
21. **PPS1-AT-21 - Full RC recovery:** a pristine device reconstructs all RC-promised cloud domains and the complete Program candidate before claiming parity.
22. **PPS1-AT-22 - History independence:** History edit/delete changes only its existing authority/derived evidence and never rewrites Program graph state.
23. **PPS1-AT-23 - No partial successor:** a Program successor is never visible without every newly pinned Routine version.
24. **PPS1-AT-24 - Retry safety:** queue replay and lost-response retry duplicate neither immutable versions nor sequence advancement.

## 16. Non-scope

**PPS1-16.1 - Excluded product work.** Program generation, Auto programming, Trajectory, new PE policy families, Strength Knowledge expansion, social/shared Programs, multi-user collaborative Programs, and new onboarding/runtime UI are outside this contract.

**PPS1-16.2 - Excluded reconciliation.** Arbitrary field-level auto-merge, CRDTs, last-write-wins Program graphs, retrospective History provenance inference, and repair by relabeling are outside v1.

**PPS1-16.3 - Excluded implementation.** Runtime capture, schema migration, SQL, RLS policy code, Supabase mutation, production-data publication, cutover execution, PR, merge, deployment, and release remain separately authorized work.

## Appendix A - Current evidence map (informative)

| Concern | Current authority |
| --- | --- |
| Program/Routine capture and normalization | `program-model.js`, `state-persistence.js` |
| Program-origin snapshot and completion advancement | `program-origin.js`, `workout-session-controller.js` |
| PE successor application and local trace | `programming-application.js` |
| Current source/fingerprint/reconstruction set | `cloud-shadow.js`, `cloud-sync.js` |
| Queue operation and ACK identity | `cloud-storage.js` |
| Fresh recovery, fast-forward, conflict, adoption journal | `managed-profile-recovery.js` |
| Account/profile shapes and namespaces | `account-context.js`, `profiles.js` |
| RLS and ownership assumptions | `PHASE4G_INDEPENDENT_USER_CONTRACT.md`, `PHASE4H_MANAGED_PROFILE_ACCESS_CONTRACT.md`, `SUPABASE_SETUP.md` |

## Appendix B - Documentation-unit validation

This unit is complete only when all touched files are Markdown, local Markdown links and explicit local anchors resolve, all `PPS1-*` IDs are unique, no current-runtime claim is presented as already implemented, `git diff --check` passes, the branch commit is pushed, and the exact remote SHA is verified. Work stops after verification; Program portability implementation remains a separate interval.
