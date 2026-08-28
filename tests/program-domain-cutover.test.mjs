import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = globalThis;

await import('../program-model.js');
await import('../program-origin.js');
await import('../program-domain-envelope.js');
await import('../cloud-storage.js');
await import('../program-domain-sync.js');
await import('../program-domain-recovery.js');
await import('../program-domain-cutover.js');

const model = globalThis.BigGainsProgramModel;
const envelopeApi = globalThis.BigGainsProgramDomainEnvelope;
const cloud = globalThis.BigGainsCloud;
const sync = globalThis.BigGainsProgramDomainSync;
const recovery = globalThis.BigGainsProgramDomainRecovery;
const cutover = globalThis.BigGainsProgramDomainCutover;
const owner = Object.freeze({ accountId: 'cloud-account-cutover', profileId: 'cloud-profile-cutover' });
const profileScope = Object.freeze({ accountId: 'local-account-cutover', profileId: 'client-profile-cutover' });
const catalog = Object.freeze({ canonicalIdFor: value => typeof value === 'string' ? value.trim() : null });
const clone = value => structuredClone(value);

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    value: () => value
  };
}

function captureFixture(scope = profileScope, prefix = 'base') {
  let counter = 0;
  let tick = 0;
  const createId = () => `${scope.profileId}-${prefix}-${String(++counter).padStart(3, '0')}`;
  const now = () => `2026-08-28T12:${String(tick++).padStart(2, '0')}:00.000Z`;
  const routine = model.approveRoutine({
    capture: model.blankCapture(),
    ...scope,
    purposeKey: `${prefix}-push`,
    label: `${prefix} Push`,
    source: { kind: 'reviewed_rebuild', routineType: 'Push' },
    exercises: [{ exerciseId: 'exercise-bench', workingSets: 3, targetReps: '6-8', restSeconds: 180 }],
    catalog,
    createId,
    now
  });
  const draft = model.createProgramDraft({
    capture: routine.capture,
    ...scope,
    purposeKey: `${prefix}-program`,
    name: `${prefix} Program`,
    slots: [{
      label: `${prefix} Push`,
      preferredCalendarAnchor: null,
      routineId: routine.version.routineId,
      routineVersionId: routine.version.routineVersionId
    }],
    blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
    programmingAuthority: 'review',
    startsOn: '2026-08-28',
    versionNote: `${prefix} fixture`,
    createId,
    now
  });
  return model.activateProgram({
    capture: draft.capture,
    ...scope,
    programVersionId: draft.version.programVersionId,
    now
  });
}

function changedHeads(capture, minute = 30) {
  const next = clone(capture);
  next.programs[0].updatedAt = `2026-08-28T12:${String(minute).padStart(2, '0')}:00.000Z`;
  return next;
}

function changedImmutable(capture) {
  const next = clone(capture);
  next.programVersions[0].name = 'Different immutable payload';
  return next;
}

function changedSequence(capture) {
  const next = clone(capture);
  next.sequenceState.completedCycles += 1;
  next.sequenceState.updatedAt = '2026-08-28T13:00:00.000Z';
  return next;
}

function applicationTrace(capture) {
  return {
    contract: 'big-gains.programming-application-trace.v1',
    applicationId: 'application-trace', proposalId: 'proposal', inputDigest: 'digest',
    ...profileScope,
    goalId: 'goal', exerciseId: 'exercise-bench',
    baseProgramVersionId: capture.programVersions[0].programVersionId,
    newProgramVersionId: 'future-program-version',
    routineVersionTransitions: [{
      baseRoutineVersionId: capture.routineVersions[0].routineVersionId,
      newRoutineVersionId: 'future-routine-version',
      routineId: capture.routines[0].routineId
    }],
    beforeExposureCount: 1, afterExposureCount: 2,
    totalCycleWorkingSetsBefore: 3, totalCycleWorkingSetsAfter: 3,
    allocation: [2, 1], reasonCodes: ['REPEATED_STALL'], operations: [],
    contractVersion: '1', enginePolicyVersion: '1', capabilityVersion: '1',
    appliedAt: '2026-08-28T21:00:00.000Z', disposition: 'approved',
    futureEffectiveBoundary: {
      kind: 'next_unmaterialized_session', activeWorkoutIdAtAcceptance: null,
      baseNextSlotIndex: 0, successorNextSlotIndex: 0, completedCycles: 0,
      activeProgramOriginCompletionPending: false
    }
  };
}

async function remoteFor({
  capture = captureFixture(),
  version = 1,
  revisions = { definitions: 1, heads: 1, sequence: 1 },
  updatedAt = '2026-08-28T14:00:00.000Z',
  lastTransition = null,
  acceptedBase = null,
  rowOverrides = {}
} = {}) {
  const envelope = capture == null
    ? envelopeApi.empty(profileScope)
    : await envelopeApi.build({ ...profileScope, programCapture: capture, catalog, revisions, lastTransition });
  const hashes = await envelopeApi.fingerprints(envelope, { ...profileScope, revisions });
  const base = acceptedBase?.record || acceptedBase;
  const row = {
    id: 'program-domain-cutover-row',
    account_id: owner.accountId,
    profile_id: owner.profileId,
    client_id: 'program-domain',
    contract: envelopeApi.contract,
    contract_version: envelopeApi.contractVersion,
    payload: clone(envelope),
    version,
    fingerprint: hashes.fingerprint,
    definitions_revision: hashes.definitionsRevision,
    definitions_fingerprint: hashes.definitionsFingerprint,
    heads_revision: hashes.headsRevision,
    heads_fingerprint: hashes.headsFingerprint,
    sequence_revision: hashes.sequenceRevision,
    sequence_fingerprint: hashes.sequenceFingerprint,
    idempotency_key: `remote-operation-${version}-${hashes.fingerprint.slice(0, 8)}`,
    base_version: base?.version ?? null,
    base_updated_at: base?.updatedAt ?? null,
    base_fingerprint: base?.fingerprint ?? null,
    base_definitions_revision: base?.definitionsRevision ?? null,
    base_definitions_fingerprint: base?.definitionsFingerprint ?? null,
    base_heads_revision: base?.headsRevision ?? null,
    base_heads_fingerprint: base?.headsFingerprint ?? null,
    base_sequence_revision: base?.sequenceRevision ?? null,
    base_sequence_fingerprint: base?.sequenceFingerprint ?? null,
    created_at: '2026-08-28T14:00:00.000Z',
    updated_at: updatedAt,
    ...rowOverrides
  };
  const validated = await recovery.validateRemoteRow(row, { owner, scope: profileScope, envelopeApi });
  assert.equal(validated.ok, true);
  return { row, validated, envelope, hashes };
}

async function emptyRemote() {
  return remoteFor({ capture: null, revisions: { definitions: 0, heads: 0, sequence: 0 } });
}

function hosted(initialRow = null) {
  const state = {
    row: initialRow ? clone(initialRow) : null,
    authCalls: 0,
    readCalls: 0,
    rpcCalls: 0,
    directMutations: 0,
    failRpc: false,
    lostAckOnce: false,
    beforeRpc: null
  };
  const client = {
    auth: { async getUser() {
      state.authCalls += 1;
      return { data: { user: { id: 'verified-user' } }, error: null };
    } },
    async rpc(name, args) {
      assert.equal(name, sync.rpcName);
      state.rpcCalls += 1;
      if (state.beforeRpc) {
        const hook = state.beforeRpc;
        state.beforeRpc = null;
        await hook(state);
      }
      const current = state.row;
      const currentVersion = current?.version ?? null;
      const currentFingerprint = current?.fingerprint ?? null;
      if (current && current.idempotency_key === args.operation_idempotency_key
        && current.version === args.next_version && current.fingerprint === args.next_fingerprint) {
        return { data: { ...clone(current), already_applied: true }, error: null };
      }
      if (args.expected_version !== currentVersion || args.expected_fingerprint !== currentFingerprint
        || args.expected_updated_at !== (current?.updated_at ?? null)
        || args.expected_definitions_revision !== (current?.definitions_revision ?? null)
        || args.expected_definitions_fingerprint !== (current?.definitions_fingerprint ?? null)
        || args.expected_heads_revision !== (current?.heads_revision ?? null)
        || args.expected_heads_fingerprint !== (current?.heads_fingerprint ?? null)
        || args.expected_sequence_revision !== (current?.sequence_revision ?? null)
        || args.expected_sequence_fingerprint !== (current?.sequence_fingerprint ?? null)) {
        return { data: null, error: { code: 'P0001', message: 'accepted base changed' } };
      }
      if (state.failRpc) return { data: null, error: { code: '500', message: 'temporary outage' } };
      state.row = {
        id: current?.id || 'program-domain-cutover-row',
        account_id: owner.accountId,
        profile_id: owner.profileId,
        client_id: 'program-domain',
        contract: envelopeApi.contract,
        contract_version: envelopeApi.contractVersion,
        payload: clone(args.next_payload),
        version: args.next_version,
        fingerprint: args.next_fingerprint,
        definitions_revision: args.next_definitions_revision,
        definitions_fingerprint: args.next_definitions_fingerprint,
        heads_revision: args.next_heads_revision,
        heads_fingerprint: args.next_heads_fingerprint,
        sequence_revision: args.next_sequence_revision,
        sequence_fingerprint: args.next_sequence_fingerprint,
        idempotency_key: args.operation_idempotency_key,
        base_version: args.expected_version,
        base_updated_at: args.expected_updated_at,
        base_fingerprint: args.expected_fingerprint,
        base_definitions_revision: args.expected_definitions_revision,
        base_definitions_fingerprint: args.expected_definitions_fingerprint,
        base_heads_revision: args.expected_heads_revision,
        base_heads_fingerprint: args.expected_heads_fingerprint,
        base_sequence_revision: args.expected_sequence_revision,
        base_sequence_fingerprint: args.expected_sequence_fingerprint,
        created_at: current?.created_at || args.next_updated_at,
        updated_at: args.next_updated_at
      };
      if (state.lostAckOnce) {
        state.lostAckOnce = false;
        return { data: null, error: { code: '500', message: 'response lost' } };
      }
      return { data: clone(state.row), error: null };
    },
    from(table) {
      assert.equal(table, 'program_domains');
      return {
        select() {
          state.readCalls += 1;
          const chain = {
            eq() { return chain; },
            async maybeSingle() { return { data: clone(state.row), error: null }; }
          };
          return chain;
        },
        insert() { state.directMutations += 1; throw new Error('direct insert forbidden'); },
        update() { state.directMutations += 1; throw new Error('direct update forbidden'); },
        delete() { state.directMutations += 1; throw new Error('direct delete forbidden'); }
      };
    }
  };
  return { state, client };
}

function rig({ enabled = true, row = null, durable = true } = {}) {
  const host = hosted(row);
  const storage = memoryStorage();
  const queue = durable ? cloud.createDurableQueue({ storage, key: 'cutover-test-queue' }) : cloud.createMemoryQueue();
  const syncService = sync.createService({
    queue,
    client: host.client,
    enabled: true,
    envelopeApi,
    cloudApi: cloud,
    now: () => '2026-08-28T15:00:00.000Z'
  });
  const service = cutover.createService({
    enabled,
    client: host.client,
    queue,
    syncService,
    envelopeApi,
    programModel: model,
    recoveryApi: recovery,
    syncApi: sync,
    catalog,
    now: () => '2026-08-28T15:00:00.000Z'
  });
  return { host, storage, queue, syncService, service };
}

function input(localProgramCapture, extra = {}) {
  return {
    owner,
    scope: profileScope,
    localProgramCapture,
    availableGoalIds: [],
    initialized: true,
    ...extra
  };
}

function profileStore(capture, behavior = {}) {
  const initial = {
    version: 5,
    profileId: profileScope.profileId,
    goals: {},
    workouts: [{ id: 'history-1', programOrigin: { programVersionId: 'historical-version' } }],
    activeWorkout: null,
    restTimerEndsAt: null,
    programCapture: clone(capture),
    unrelated: { preserved: true }
  };
  let raw = JSON.stringify(initial);
  let writes = 0;
  let mismatchReads = behavior.readbackMismatch ? 1 : 0;
  return {
    initial,
    async readRaw() {
      if (writes > 0 && mismatchReads > 0) {
        mismatchReads -= 1;
        return `${raw} `;
      }
      return raw;
    },
    async writeRaw(next) { writes += 1; raw = next; },
    async removeRaw() { raw = null; },
    raw: () => raw,
    writes: () => writes
  };
}

test('01 capability disabled performs no Program cloud call or mutation', async () => {
  const value = rig({ enabled: false });
  const inspected = await value.service.inspectCutover(input(captureFixture()));
  const published = await value.service.publishLegacy(input(captureFixture()));
  assert.equal(inspected.state, 'unsupported');
  assert.equal(published.reasonCode, cutover.reasonCodes.CAPABILITY_DISABLED);
  assert.deepEqual([value.host.state.authCalls, value.host.state.readCalls, value.host.state.rpcCalls, value.queue.pending().length], [0, 0, 0, 0]);
});

test('02 remote absent plus meaningful local is legacy unpublished', async () => {
  const value = rig();
  const inspected = await value.service.inspectCutover(input(captureFixture()));
  assert.equal(inspected.state, 'unpublished_local');
  assert.equal(inspected.actions[0].label, 'Publish this Program to cloud');
});

test('03 remote absent plus no Program is explicit empty unpublished', async () => {
  const value = rig();
  const inspected = await value.service.inspectCutover(input(null));
  assert.equal(inspected.state, 'unpublished_empty');
});

test('04 meaningful first publication freezes revision 1 with canonical component evidence', async () => {
  const value = rig();
  const capture = captureFixture();
  const outcome = await value.service.publishLegacy(input(capture, { deferTransport: true }));
  const operation = value.queue.pending()[0];
  assert.equal(outcome.status, 'pending');
  assert.equal(operation.version, 1);
  assert.equal(operation.programDomain.acceptedBase, null);
  assert.deepEqual([operation.programDomain.definitionsRevision, operation.programDomain.headsRevision, operation.programDomain.sequenceRevision], [1, 1, 1]);
  assert.equal(Object.isFrozen(operation), true);
  assert.equal(Object.isFrozen(operation.payload), true);
  assert.deepEqual(operation.programDomain.envelopeScope, profileScope);
});

test('05 empty first publication preserves exact payload and zero component revisions', async () => {
  const value = rig();
  await value.service.publishLegacy(input(null, { deferTransport: true }));
  const operation = value.queue.pending()[0];
  assert.deepEqual(operation.payload, {});
  assert.deepEqual([operation.programDomain.definitionsRevision, operation.programDomain.headsRevision, operation.programDomain.sequenceRevision], [0, 0, 0]);
});

test('06 first publication rechecks remote absence immediately before enqueue', async () => {
  const value = rig();
  const capture = captureFixture();
  const inspected = await value.service.inspectCutover(input(capture));
  const reads = value.host.state.readCalls;
  await value.service.publishLegacy(input(capture, { inspection: inspected, deferTransport: true }));
  assert.ok(value.host.state.readCalls > reads);
});

test('07 remote appearance between inspect and publish is stale and creates no operation', async () => {
  const remote = await emptyRemote();
  const value = rig();
  const capture = captureFixture();
  const inspected = await value.service.inspectCutover(input(capture));
  value.host.state.row = clone(remote.row);
  const outcome = await value.service.publishLegacy(input(capture, { inspection: inspected }));
  assert.equal(outcome.status, 'stale');
  assert.equal(outcome.reasonCode, cutover.reasonCodes.REMOTE_APPEARED);
  assert.equal(value.queue.pending().length, 0);
  assert.equal(value.host.state.rpcCalls, 0);
});

test('08 first publication failure preserves local state and leaves the durable operation pending', async () => {
  const value = rig();
  const capture = captureFixture();
  const localBefore = JSON.stringify(capture);
  value.host.state.failRpc = true;
  const outcome = await value.service.publishLegacy(input(capture));
  assert.equal(outcome.status, 'pending');
  assert.equal(JSON.stringify(capture), localBefore);
  assert.equal(value.queue.pending().length, 1);
  assert.ok(value.storage.value().includes(value.queue.pending()[0].idempotencyKey));
});

test('09 lost acknowledgement retries the exact operation and ACKs once after exact readback', async () => {
  const value = rig();
  value.host.state.lostAckOnce = true;
  const first = await value.service.publishLegacy(input(captureFixture()));
  const operation = value.queue.pending()[0];
  assert.equal(first.status, 'pending');
  const second = await value.service.flushPending();
  assert.equal(second.ok, true);
  assert.equal(value.queue.pending().length, 0);
  assert.equal(value.queue.acknowledgement(operation.idempotencyKey).remoteVersion, 1);
  assert.equal(value.host.state.row.idempotency_key, operation.idempotencyKey);
});

test('10 a second identical legacy device converges without another revision', async () => {
  const capture = captureFixture();
  const remote = await remoteFor({ capture });
  const value = rig({ row: remote.row });
  const inspected = await value.service.inspectCutover(input(clone(capture)));
  assert.equal(inspected.state, 'converged');
  assert.equal(value.queue.pending().length, 0);
  assert.equal(value.host.state.rpcCalls, 0);
});

test('11 identical definitions and heads with a different sequence is a sequence conflict', async () => {
  const capture = captureFixture();
  const remote = await remoteFor({ capture });
  const value = rig({ row: remote.row });
  const inspected = await value.service.inspectCutover(input(changedSequence(capture)));
  assert.equal(inspected.state, 'conflict');
  assert.equal(inspected.conflictKind, 'sequence');
});

test('12 explicit remote empty plus meaningful local requires a choice', async () => {
  const remote = await emptyRemote();
  const value = rig({ row: remote.row });
  const inspected = await value.service.inspectCutover(input(captureFixture()));
  assert.equal(inspected.state, 'conflict');
  assert.equal(inspected.conflictKind, 'remote_empty_local_meaningful');
  assert.deepEqual(inspected.actions.map(action => action.label), ['Use cloud Program', 'Use this device Program']);
});

test('13 divergent meaningful graphs require a choice and expose no silent default', async () => {
  const remote = await remoteFor({ capture: captureFixture(profileScope, 'cloud') });
  const value = rig({ row: remote.row });
  const inspected = await value.service.inspectCutover(input(captureFixture(profileScope, 'device')));
  assert.equal(inspected.state, 'conflict');
  assert.equal(inspected.actionRequired, true);
  assert.equal(inspected.actions.some(action => action.default === true), false);
});

test('14 Use cloud re-reads and revalidates the frozen decision snapshot', async () => {
  const cloudCapture = captureFixture();
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const local = changedHeads(cloudCapture);
  const store = profileStore(local);
  const inspected = await value.service.inspectCutover(input(local));
  const reads = value.host.state.readCalls;
  await value.service.resolveConflict('keep_cloud', inspected.snapshot, input(local, store));
  assert.ok(value.host.state.readCalls > reads);
});

test('15 Use cloud rejects a stale snapshot without local mutation', async () => {
  const cloudCapture = captureFixture();
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const local = changedHeads(cloudCapture);
  const store = profileStore(local);
  const inspected = await value.service.inspectCutover(input(local));
  const newer = await remoteFor({ capture: changedHeads(cloudCapture, 45), updatedAt: '2026-08-28T14:30:00.000Z' });
  value.host.state.row = clone(newer.row);
  const before = store.raw();
  const outcome = await value.service.resolveConflict('keep_cloud', inspected.snapshot, input(local, store));
  assert.equal(outcome.status, 'stale');
  assert.equal(outcome.message, cutover.copy.stale);
  assert.equal(store.raw(), before);
});

test('16 Use cloud atomically adopts the exact remote Program graph', async () => {
  const cloudCapture = captureFixture();
  const local = changedHeads(cloudCapture);
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const store = profileStore(local);
  const inspected = await value.service.inspectCutover(input(local));
  const outcome = await value.service.resolveConflict('keep_cloud', inspected.snapshot, input(local, store));
  assert.equal(outcome.ok, true);
  assert.deepEqual(JSON.parse(store.raw()).programCapture.programs, cloudCapture.programs);
});

test('17 Use cloud readback failure restores the exact previous raw profile', async () => {
  const cloudCapture = captureFixture();
  const local = changedHeads(cloudCapture);
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const store = profileStore(local, { readbackMismatch: true });
  const before = store.raw();
  const inspected = await value.service.inspectCutover(input(local));
  const outcome = await value.service.resolveConflict('keep_cloud', inspected.snapshot, input(local, store));
  assert.equal(outcome.ok, false);
  assert.equal(outcome.rolledBack, true);
  assert.equal(store.raw(), before);
});

test('18 Use this device re-reads the remote snapshot before enqueue', async () => {
  const remote = await emptyRemote();
  const value = rig({ row: remote.row });
  const local = captureFixture();
  const inspected = await value.service.inspectCutover(input(local));
  const reads = value.host.state.readCalls;
  await value.service.resolveConflict('keep_device', inspected.snapshot, input(local));
  assert.ok(value.host.state.readCalls > reads);
});

test('19 Use this device builds revision 2 against the exact remote empty base', async () => {
  const remote = await emptyRemote();
  const value = rig({ row: remote.row });
  const local = captureFixture();
  const inspected = await value.service.inspectCutover(input(local));
  const outcome = await value.service.resolveConflict('keep_device', inspected.snapshot, input(local));
  assert.equal(outcome.ok, true);
  assert.equal(value.host.state.row.version, 2);
  assert.equal(value.host.state.row.base_fingerprint, remote.validated.record.fingerprint);
  assert.equal(value.host.state.directMutations, 0);
});

test('20 Use this device increments only the changed heads component', async () => {
  const cloudCapture = captureFixture();
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const local = changedHeads(cloudCapture);
  const inspected = await value.service.inspectCutover(input(local));
  const outcome = await value.service.resolveConflict('keep_device', inspected.snapshot, input(local));
  assert.equal(outcome.ok, true);
  assert.deepEqual([value.host.state.row.definitions_revision, value.host.state.row.heads_revision, value.host.state.row.sequence_revision], [1, 2, 1]);
});

test('21 Use this device transport failure leaves local unchanged and its exact operation pending', async () => {
  const remote = await emptyRemote();
  const value = rig({ row: remote.row });
  value.host.state.failRpc = true;
  const local = captureFixture();
  const before = JSON.stringify(local);
  const inspected = await value.service.inspectCutover(input(local));
  const outcome = await value.service.resolveConflict('keep_device', inspected.snapshot, input(local));
  assert.equal(outcome.status, 'pending');
  assert.equal(outcome.localMutation, false);
  assert.equal(JSON.stringify(local), before);
  assert.equal(value.queue.pending().length, 1);
});

test('22 a stale guarded write retains its frozen base and does not auto-refresh', async () => {
  const remote = await emptyRemote();
  const value = rig({ row: remote.row });
  const local = captureFixture();
  const inspected = await value.service.inspectCutover(input(local));
  const competing = await remoteFor({ capture: null, version: 1, revisions: { definitions: 0, heads: 0, sequence: 0 }, updatedAt: '2026-08-28T14:01:00.000Z', rowOverrides: { idempotency_key: 'competing-write' } });
  value.host.state.beforeRpc = state => { state.row = clone(competing.row); };
  const outcome = await value.service.resolveConflict('keep_device', inspected.snapshot, input(local));
  const pending = value.queue.pending()[0];
  assert.equal(outcome.status, 'pending');
  assert.equal(pending.version, 2);
  assert.equal(pending.programDomain.acceptedBase.fingerprint, remote.validated.record.fingerprint);
  assert.equal(pending.programDomain.acceptedBase.updatedAt, remote.validated.record.updatedAt);
  assert.notEqual(pending.programDomain.acceptedBase.updatedAt, competing.validated.record.updatedAt);
});

test('23 equal immutable identity with unequal payload is non-mergeable', async () => {
  const cloudCapture = captureFixture();
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const local = changedImmutable(cloudCapture);
  const inspected = await value.service.inspectCutover(input(local));
  const outcome = await value.service.resolveConflict('keep_device', inspected.snapshot, input(local));
  assert.equal(outcome.reasonCode, cutover.reasonCodes.IMMUTABLE_IDENTITY_CONFLICT);
  assert.equal(value.host.state.rpcCalls, 0);
});

test('24 distinct sequence states are not auto-merged or arithmetically combined', async () => {
  const cloudCapture = captureFixture();
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const local = changedSequence(cloudCapture);
  const inspected = await value.service.inspectCutover(input(local));
  const outcome = await value.service.resolveConflict('keep_device', inspected.snapshot, input(local));
  assert.equal(outcome.reasonCode, cutover.reasonCodes.SEQUENCE_NOT_MERGEABLE);
  assert.equal(value.host.state.row.sequence_revision, 1);
});

test('25 a pending Program operation blocks publication and conflict action', async () => {
  const value = rig();
  const local = captureFixture();
  await value.service.publishLegacy(input(local, { deferTransport: true }));
  const second = await value.service.publishLegacy(input(local));
  assert.equal(second.reasonCode, cutover.reasonCodes.QUEUE_PENDING);
  assert.equal(value.queue.pending().length, 1);
});

test('26 active workout and unresolved rest each block actions before transport', async () => {
  const local = captureFixture();
  const active = rig();
  const activeResult = await active.service.publishLegacy(input(local, { activeWorkout: { id: 'active' } }));
  const resting = rig();
  const restResult = await resting.service.publishLegacy(input(local, { restTimerEndsAt: Date.now() + 60_000 }));
  assert.equal(activeResult.reasonCode, cutover.reasonCodes.ACTIVE_SESSION_PRESENT);
  assert.equal(restResult.reasonCode, cutover.reasonCodes.REST_STATE_PRESENT);
  assert.deepEqual([active.host.state.readCalls, resting.host.state.readCalls], [0, 0]);
});

test('27 completed History is deep-equal before and after cloud adoption', async () => {
  const cloudCapture = captureFixture();
  const local = changedHeads(cloudCapture);
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const store = profileStore(local);
  const history = clone(store.initial.workouts);
  const inspected = await value.service.inspectCutover(input(local));
  await value.service.resolveConflict('keep_cloud', inspected.snapshot, input(local, store));
  assert.deepEqual(JSON.parse(store.raw()).workouts, history);
});

test('28 completed programOrigin is deep-equal before and after cloud adoption', async () => {
  const cloudCapture = captureFixture();
  const local = changedHeads(cloudCapture);
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const store = profileStore(local);
  const origin = clone(store.initial.workouts[0].programOrigin);
  const inspected = await value.service.inspectCutover(input(local));
  await value.service.resolveConflict('keep_cloud', inspected.snapshot, input(local, store));
  assert.deepEqual(JSON.parse(store.raw()).workouts[0].programOrigin, origin);
});

test('29 local PE application traces survive cloud adoption', async () => {
  const cloudCapture = captureFixture();
  const local = changedHeads(cloudCapture);
  local.applicationTraces = [applicationTrace(local)];
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const store = profileStore(local);
  const inspected = await value.service.inspectCutover(input(local));
  await value.service.resolveConflict('keep_cloud', inspected.snapshot, input(local, store));
  assert.deepEqual(JSON.parse(store.raw()).programCapture.applicationTraces, local.applicationTraces);
});

test('30 resolving Program conflict never clears an unrelated queue operation', async () => {
  const cloudCapture = captureFixture();
  const remote = await remoteFor({ capture: cloudCapture });
  const value = rig({ row: remote.row });
  const unrelated = cloud.createOperation({
    owner, entityType: 'preferences', entityId: 'goals', mutation: 'upsert', version: 1,
    updatedAt: '2026-08-28T14:00:00.000Z', payload: { goals: [] }
  });
  value.queue.enqueue(unrelated);
  const local = changedHeads(cloudCapture);
  const store = profileStore(local);
  const inspected = await value.service.inspectCutover(input(local));
  await value.service.resolveConflict('keep_cloud', inspected.snapshot, input(local, store));
  assert.deepEqual(value.queue.pending().map(operation => operation.idempotencyKey), [unrelated.idempotencyKey]);
});

test('31 profile/account ownership mismatch is rejected before adoption', async () => {
  const remote = await remoteFor();
  remote.row.profile_id = 'another-cloud-profile';
  const value = rig({ row: remote.row });
  const inspected = await value.service.inspectCutover(input(captureFixture()));
  assert.equal(inspected.state, 'invalid');
  assert.equal(value.host.state.rpcCalls, 0);
});

test('32 managed Jorge and Alexa Program queue scopes remain isolated', async () => {
  const remote = await remoteFor();
  const value = rig({ row: remote.row });
  const alexa = cloud.createOperation({
    owner: { accountId: owner.accountId, profileId: 'alexa-profile' },
    entityType: 'preferences', entityId: 'goals', mutation: 'upsert', version: 1,
    updatedAt: '2026-08-28T14:00:00.000Z', payload: { goals: [] }
  });
  value.queue.enqueue(alexa);
  const inspected = await value.service.inspectCutover(input(captureFixture()));
  assert.equal(inspected.state, 'converged');
  assert.equal(value.queue.pending()[0].owner.profileId, 'alexa-profile');
});

test('33 an independent profile cannot reuse another profile decision snapshot', async () => {
  const remote = await emptyRemote();
  const value = rig({ row: remote.row });
  const local = captureFixture();
  const inspected = await value.service.inspectCutover(input(local));
  const other = { owner: { accountId: owner.accountId, profileId: 'other-profile' }, scope: profileScope, localProgramCapture: local };
  const outcome = await value.service.resolveConflict('keep_device', inspected.snapshot, other);
  assert.equal(outcome.status, 'stale');
  assert.equal(value.host.state.rpcCalls, 0);
});

test('34 a no-Program profile publishes and remains a valid exact empty profile', async () => {
  const value = rig();
  const published = await value.service.publishLegacy(input(null));
  const inspected = await value.service.inspectCutover(input(null));
  assert.equal(published.ok, true);
  assert.equal(inspected.state, 'converged');
  assert.deepEqual(value.host.state.row.payload, {});
});

test('35 repeated inspect is deterministic and mutation-free', async () => {
  const remote = await emptyRemote();
  const value = rig({ row: remote.row });
  const local = captureFixture();
  const first = await value.service.inspectCutover(input(local));
  const second = await value.service.inspectCutover(input(local));
  assert.deepEqual(first, second);
  assert.equal(value.host.state.rpcCalls, 0);
  assert.equal(value.queue.pending().length, 0);
});

test('36 malformed remote blocks safely', async () => {
  const remote = await remoteFor();
  remote.row.payload = { malformed: true };
  const value = rig({ row: remote.row });
  const inspected = await value.service.inspectCutover(input(captureFixture()));
  assert.equal(inspected.state, 'invalid');
});

test('37 a missing Routine pin blocks safely', async () => {
  const remote = await remoteFor();
  remote.row.payload.definitions.programVersions[0].slots[0].routineVersionId = 'missing-pin';
  const value = rig({ row: remote.row });
  const inspected = await value.service.inspectCutover(input(captureFixture()));
  assert.equal(inspected.state, 'invalid');
  assert.equal(value.host.state.rpcCalls, 0);
});

test('38 exact remote/local state is a no-op with no action', async () => {
  const capture = captureFixture();
  const remote = await remoteFor({ capture });
  const value = rig({ row: remote.row });
  const inspected = await value.service.inspectCutover(input(capture));
  assert.deepEqual([inspected.state, inspected.actionRequired, inspected.actions.length], ['converged', false, 0]);
});

test('39 a remote aggregate downgrade blocks cutover', async () => {
  const capture = captureFixture();
  const remote = await remoteFor({ capture });
  const accepted = { ...remote.validated, record: { ...remote.validated.record, version: 2 } };
  const value = rig({ row: remote.row });
  const inspected = await value.service.inspectCutover(input(capture, { acceptedRemote: accepted }));
  assert.equal(inspected.state, 'invalid');
  assert.equal(inspected.reasonCode, recovery.reasonCodes.REMOTE_REVISION_DOWNGRADE);
});

test('40 unsupported hosted schema leaves the current local app state unaffected', async () => {
  const value = rig();
  value.host.client.from = () => ({ select() {
    const chain = { eq() { return chain; }, async maybeSingle() {
      return { data: null, error: { code: 'PGRST205', message: 'table absent' } };
    } };
    return chain;
  } });
  const local = captureFixture();
  const before = JSON.stringify(local);
  const inspected = await value.service.inspectCutover(input(local));
  assert.equal(inspected.state, 'unsupported');
  assert.equal(JSON.stringify(local), before);
  assert.equal(value.queue.pending().length, 0);
});

test('41 normal user copy contains no revisions, fingerprints, or raw identifiers', () => {
  assert.deepEqual(cutover.copy, {
    keepCloud: 'Use cloud Program',
    keepDevice: 'Use this device Program',
    publish: 'Publish this Program to cloud',
    stale: 'Your Program changed before this choice was applied. Review the latest version.'
  });
  assert.equal(Object.values(cutover.copy).some(value => /revision|fingerprint|\bid\b/i.test(value)), false);
});

test('42 the cutover module is not loaded by production HTML', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.equal(html.includes('program-domain-cutover.js'), false);
});
