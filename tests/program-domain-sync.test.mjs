import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.window = globalThis;
globalThis.__BIG_GAINS_CLOUD_CONFIG__ = {};

await import('../program-model.js');
await import('../program-domain-envelope.js');
await import('../cloud-storage.js');
await import('../program-domain-sync.js');

const model = globalThis.BigGainsProgramModel;
const envelopeApi = globalThis.BigGainsProgramDomainEnvelope;
const cloud = globalThis.BigGainsCloud;
const sync = globalThis.BigGainsProgramDomainSync;
const defaultScope = Object.freeze({ accountId: 'account-program-sync', profileId: 'profile-program-sync' });
const catalog = Object.freeze({ canonicalIdFor: value => typeof value === 'string' ? value.trim() : null });
const clone = value => structuredClone(value);

function memoryStorage(initial = null) {
  let stored = initial;
  return {
    getItem: () => stored,
    setItem: (_key, value) => { stored = value; },
    value: () => stored
  };
}

function captureFixture(scope = defaultScope) {
  let counter = 0;
  let tick = 0;
  const createId = () => `${scope.profileId}-id-${String(++counter).padStart(3, '0')}`;
  const now = () => `2026-08-25T12:${String(tick++).padStart(2, '0')}:00.000Z`;
  const approved = model.approveRoutine({
    capture: model.blankCapture(),
    ...scope,
    purposeKey: 'push',
    label: 'Push',
    source: { kind: 'reviewed_rebuild', routineType: 'Push' },
    exercises: [
      { exerciseId: 'exercise-bench', workingSets: 3, targetReps: '6-8', restSeconds: 180 }
    ],
    catalog,
    createId,
    now
  });
  const draft = model.createProgramDraft({
    capture: approved.capture,
    ...scope,
    purposeKey: 'program',
    name: 'Portable Program',
    slots: [{
      label: approved.version.label,
      preferredCalendarAnchor: null,
      routineId: approved.version.routineId,
      routineVersionId: approved.version.routineVersionId
    }],
    blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
    programmingAuthority: 'review',
    startsOn: '2026-08-25',
    versionNote: 'Program transport fixture',
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

function changedHeads(capture, minute = 20) {
  const next = clone(capture);
  next.programs[0].updatedAt = `2026-08-25T12:${String(minute).padStart(2, '0')}:00.000Z`;
  return next;
}

function changedDefinitions(capture) {
  const next = clone(capture);
  next.routineVersions[0].label = `${next.routineVersions[0].label} reviewed`;
  return next;
}

function completedSequence(capture) {
  const next = clone(capture);
  const programVersionId = next.sequenceState.programVersionId;
  next.sequenceState.nextSlotIndex = 0;
  next.sequenceState.completedCycles = 1;
  next.sequenceState.updatedAt = '2026-08-25T13:00:00.000Z';
  return {
    capture: next,
    lastTransition: {
      transitionId: 'transition-workout-program-sync',
      kind: 'completion',
      before: { programVersionId, nextSlotIndex: 0, completedCycles: 0 },
      after: { programVersionId, nextSlotIndex: 0, completedCycles: 1 },
      occurredAt: '2026-08-25T13:00:00.000Z',
      workoutId: 'workout-program-sync'
    }
  };
}

async function enqueue({
  capture = captureFixture(),
  scope = defaultScope,
  queue = cloud.createMemoryQueue(),
  acceptedBase = null,
  lastTransition = null,
  updatedAt = '2026-08-25T14:00:00.000Z'
} = {}) {
  return sync.enqueueProgramDomain({
    ...scope,
    programCapture: capture,
    acceptedBase,
    lastTransition,
    updatedAt,
    queue,
    catalog,
    envelopeApi,
    cloudApi: cloud
  });
}

function baseFields(base) {
  return {
    base_version: base?.version ?? null,
    base_updated_at: base?.updatedAt ?? null,
    base_fingerprint: base?.fingerprint ?? null,
    base_definitions_revision: base?.definitionsRevision ?? null,
    base_definitions_fingerprint: base?.definitionsFingerprint ?? null,
    base_heads_revision: base?.headsRevision ?? null,
    base_heads_fingerprint: base?.headsFingerprint ?? null,
    base_sequence_revision: base?.sequenceRevision ?? null,
    base_sequence_fingerprint: base?.sequenceFingerprint ?? null
  };
}

function rowFor(operation, overrides = {}) {
  const base = operation.programDomain.acceptedBase;
  return {
    id: `row-${operation.owner.profileId}`,
    account_id: operation.owner.accountId,
    profile_id: operation.owner.profileId,
    client_id: 'program-domain',
    contract: envelopeApi.contract,
    contract_version: envelopeApi.contractVersion,
    payload: clone(operation.payload),
    version: operation.version,
    fingerprint: operation.payloadFingerprint,
    definitions_revision: operation.programDomain.definitionsRevision,
    definitions_fingerprint: operation.programDomain.definitionsFingerprint,
    heads_revision: operation.programDomain.headsRevision,
    heads_fingerprint: operation.programDomain.headsFingerprint,
    sequence_revision: operation.programDomain.sequenceRevision,
    sequence_fingerprint: operation.programDomain.sequenceFingerprint,
    idempotency_key: operation.idempotencyKey,
    ...baseFields(base),
    created_at: '2026-08-25T14:00:00.000Z',
    updated_at: operation.updatedAt,
    ...overrides
  };
}

function clientFor(operation, {
  row = rowFor(operation),
  rpcError = null,
  rpcThrows = null,
  readError = null,
  alreadyApplied = false,
  authenticated = true
} = {}) {
  const calls = { rpc: [], reads: [], mutations: [] };
  const client = {
    auth: {
      async getUser() {
        return authenticated
          ? { data: { user: { id: 'auth-user' } }, error: null }
          : { data: { user: null }, error: { code: '401' } };
      }
    },
    async rpc(name, args) {
      calls.rpc.push({ name, args: clone(args) });
      if (rpcThrows) throw rpcThrows;
      return rpcError
        ? { data: null, error: rpcError }
        : { data: { ...clone(row), ...(alreadyApplied ? { already_applied: true } : {}) }, error: null };
    },
    from(table) {
      calls.reads.push({ table, filters: {} });
      const call = calls.reads.at(-1);
      return {
        select(columns) {
          call.columns = columns;
          const chain = {
            eq(name, value) { call.filters[name] = value; return chain; },
            async maybeSingle() { return { data: readError ? null : clone(row), error: readError }; }
          };
          return chain;
        },
        insert() { calls.mutations.push('insert'); throw new Error('direct mutation forbidden'); },
        update() { calls.mutations.push('update'); throw new Error('direct mutation forbidden'); },
        delete() { calls.mutations.push('delete'); throw new Error('direct mutation forbidden'); }
      };
    }
  };
  return { client, calls };
}

async function firstOperation(options = {}) {
  const queued = await enqueue(options);
  assert.equal(queued.ok, true);
  assert.equal(queued.enqueued, true);
  return queued.operation;
}

async function successor({ queue = cloud.createMemoryQueue(), capture = captureFixture(), mutate = changedHeads } = {}) {
  const first = await firstOperation({ queue, capture, updatedAt: '2026-08-25T14:00:00.000Z' });
  const secondCapture = mutate(capture);
  const second = await enqueue({
    queue,
    capture: secondCapture,
    acceptedBase: sync.baseFromOperation(first),
    updatedAt: '2026-08-25T14:01:00.000Z'
  });
  assert.equal(second.ok, true);
  assert.equal(second.enqueued, true);
  return { queue, capture, first, second: second.operation, secondCapture };
}

test('1 canonical non-empty envelope enqueues with exact frozen bytes and fingerprints', async () => {
  const operation = await firstOperation();
  assert.equal(operation.entityType, 'program_domains');
  assert.equal(operation.entityId, 'program-domain');
  assert.equal(operation.programDomain.payloadCanonical, envelopeApi.canonicalize(operation.payload));
  const hashes = await envelopeApi.fingerprints(operation.payload, defaultScope);
  assert.equal(operation.payloadFingerprint, hashes.fingerprint);
  assert.equal(operation.programDomain.definitionsFingerprint, hashes.definitionsFingerprint);
  assert.equal(Object.isFrozen(operation.programDomain), true);
  assert.equal(Object.isFrozen(operation.payload), true);
});

test('2 exact empty envelope remains an exact empty object through the durable operation', async () => {
  const operation = await firstOperation({ capture: null });
  assert.deepEqual(operation.payload, {});
  assert.equal(operation.programDomain.payloadCanonical, '{}');
  assert.deepEqual([
    operation.programDomain.definitionsRevision,
    operation.programDomain.headsRevision,
    operation.programDomain.sequenceRevision
  ], [0, 0, 0]);
  assert.deepEqual(sync.rpcArguments(operation).next_payload, {});
});

test('3 source capture mutation after enqueue cannot change the frozen operation', async () => {
  const capture = captureFixture();
  const operation = await firstOperation({ capture });
  const bytes = operation.programDomain.payloadCanonical;
  capture.programVersions[0].name = 'mutated after enqueue';
  capture.routines.length = 0;
  assert.equal(operation.programDomain.payloadCanonical, bytes);
  assert.notEqual(operation.payload.definitions.programVersions[0].name, 'mutated after enqueue');
});

test('4 replay uses the frozen payload and accepted base rather than current Program state', async () => {
  const flow = await successor();
  const frozen = sync.rpcArguments(flow.second);
  flow.secondCapture.programs[0].updatedAt = '2026-08-25T23:59:00.000Z';
  const { client, calls } = clientFor(flow.second);
  const transport = sync.createTransport({ client, enabled: true, envelopeApi });
  assert.equal((await transport.send(flow.second)).ok, true);
  assert.deepEqual(calls.rpc[0].args, frozen);
  assert.equal(calls.rpc[0].args.expected_fingerprint, sync.baseFromOperation(flow.first).fingerprint);
});

test('5 invalid serializer state does not enqueue', async () => {
  const queue = cloud.createMemoryQueue();
  const capture = captureFixture();
  capture.routines[0].accountId = 'wrong-account';
  const queued = await enqueue({ queue, capture });
  assert.deepEqual(queued, { ok: false, enqueued: false, reasonCode: sync.reasonCodes.SERIALIZATION_FAILED });
  assert.equal(queue.pending().length, 0);
});

test('6 first publication uses revision one and the null creation base sentinel', async () => {
  const operation = await firstOperation();
  assert.equal(operation.version, 1);
  assert.equal(operation.baseRevision, null);
  assert.equal(operation.programDomain.acceptedBase, null);
  const args = sync.rpcArguments(operation);
  assert.equal(args.expected_version, null);
  assert.equal(args.next_version, 1);
});

test('7 the next publication increments the aggregate revision exactly once', async () => {
  const flow = await successor();
  assert.equal(flow.second.version, flow.first.version + 1);
  assert.equal(flow.second.programDomain.acceptedBase.version, flow.first.version);
});

test('8 a definitions-only change increments definitions and aggregate while preserving heads and sequence', async () => {
  const flow = await successor({ mutate: changedDefinitions });
  assert.equal(flow.second.version, 2);
  assert.equal(flow.second.programDomain.definitionsRevision, flow.first.programDomain.definitionsRevision + 1);
  assert.equal(flow.second.programDomain.headsRevision, flow.first.programDomain.headsRevision);
  assert.equal(flow.second.programDomain.sequenceRevision, flow.first.programDomain.sequenceRevision);
});

test('9 a heads-only change increments heads and aggregate', async () => {
  const flow = await successor();
  assert.equal(flow.second.version, 2);
  assert.equal(flow.second.programDomain.definitionsRevision, flow.first.programDomain.definitionsRevision);
  assert.equal(flow.second.programDomain.headsRevision, flow.first.programDomain.headsRevision + 1);
  assert.equal(flow.second.programDomain.sequenceRevision, flow.first.programDomain.sequenceRevision);
});

test('10 a sequence-only change increments sequence and aggregate', async () => {
  const queue = cloud.createMemoryQueue();
  const capture = captureFixture();
  const first = await firstOperation({ queue, capture });
  const completion = completedSequence(capture);
  const next = await enqueue({
    queue,
    capture: completion.capture,
    lastTransition: completion.lastTransition,
    acceptedBase: sync.baseFromOperation(first),
    updatedAt: '2026-08-25T14:01:00.000Z'
  });
  assert.equal(next.ok, true);
  assert.equal(next.operation.version, 2);
  assert.equal(next.operation.programDomain.definitionsRevision, first.programDomain.definitionsRevision);
  assert.equal(next.operation.programDomain.headsRevision, first.programDomain.headsRevision);
  assert.equal(next.operation.programDomain.sequenceRevision, first.programDomain.sequenceRevision + 1);
});

test('11 no semantic change creates no meaningless successor operation', async () => {
  const queue = cloud.createMemoryQueue();
  const capture = captureFixture();
  const first = await firstOperation({ queue, capture });
  const next = await enqueue({ queue, capture, acceptedBase: sync.baseFromOperation(first) });
  assert.deepEqual(next, { ok: true, enqueued: false, noOp: true, reasonCode: null, operation: null });
  assert.equal(queue.pending().length, 1);
});

test('12 guarded RPC receives every exact frozen accepted-base field', async () => {
  const flow = await successor();
  const { client, calls } = clientFor(flow.second);
  const response = await sync.createTransport({ client, enabled: true, envelopeApi }).send(flow.second);
  assert.equal(response.ok, true);
  assert.equal(calls.rpc[0].name, 'put_program_domain_guarded');
  assert.deepEqual(calls.rpc[0].args, sync.rpcArguments(flow.second));
});

test('13 Program transport never uses a direct table mutation path', async () => {
  const operation = await firstOperation();
  const { client, calls } = clientFor(operation);
  assert.equal((await sync.createTransport({ client, enabled: true, envelopeApi }).send(operation)).ok, true);
  assert.deepEqual(calls.mutations, []);
  assert.equal(calls.rpc.length, 1);
  assert.equal(calls.reads.length, 1);
});

test('14 stale-base rejection retains the operation', async () => {
  const queue = cloud.createMemoryQueue();
  const operation = await firstOperation({ queue });
  const { client } = clientFor(operation, { rpcError: { code: 'P0001', message: 'program domain accepted base is stale' } });
  const runtime = sync.createQueueRuntime({ queue, transport: sync.createTransport({ client, enabled: true, envelopeApi }) });
  const outcome = await runtime.flush();
  assert.equal(outcome.reasonCode, sync.reasonCodes.STALE_BASE);
  assert.equal(queue.pending().length, 1);
  assert.equal(queue.pending()[0].attempts, 1);
});

test('15 transient network failure is retryable and retains the operation', async () => {
  const queue = cloud.createMemoryQueue();
  const operation = await firstOperation({ queue });
  const { client } = clientFor(operation, { rpcThrows: new Error('synthetic outage') });
  const outcome = await sync.createQueueRuntime({
    queue,
    transport: sync.createTransport({ client, enabled: true, envelopeApi })
  }).flush();
  assert.equal(outcome.reasonCode, sync.reasonCodes.TRANSIENT_FAILURE);
  assert.equal(outcome.failures[0].blocked, false);
  assert.equal(queue.pending().length, 1);
});

test('16 authentication rejection retains and blocks the operation', async () => {
  const queue = cloud.createMemoryQueue();
  const operation = await firstOperation({ queue });
  const { client, calls } = clientFor(operation, { authenticated: false });
  const outcome = await sync.createQueueRuntime({
    queue,
    transport: sync.createTransport({ client, enabled: true, envelopeApi })
  }).flush();
  assert.equal(outcome.reasonCode, sync.reasonCodes.AUTH_REJECTED);
  assert.equal(outcome.failures[0].blocked, true);
  assert.equal(calls.rpc.length, 0);
  assert.equal(queue.pending().length, 1);
});

test('17 exact idempotent replay is a success candidate but still performs readback', async () => {
  const operation = await firstOperation();
  const { client, calls } = clientFor(operation, { alreadyApplied: true });
  const response = await sync.createTransport({ client, enabled: true, envelopeApi }).send(operation);
  assert.equal(response.ok, true);
  assert.equal(response.disposition, 'already-applied');
  assert.equal(calls.rpc.length, 1);
  assert.equal(calls.reads.length, 1);
});

test('18 exact readback ACKs and removes the operation', async () => {
  const queue = cloud.createMemoryQueue();
  const operation = await firstOperation({ queue });
  const { client } = clientFor(operation);
  const outcome = await sync.createQueueRuntime({
    queue,
    transport: sync.createTransport({ client, enabled: true, envelopeApi })
  }).flush();
  assert.deepEqual({ ok: outcome.ok, sent: outcome.sent, pending: outcome.pending }, { ok: true, sent: 1, pending: 0 });
  assert.equal(queue.acknowledgement(operation.idempotencyKey).remoteVersion, 1);
});

test('19 missing readback never ACKs', async () => {
  const queue = cloud.createMemoryQueue();
  const operation = await firstOperation({ queue });
  const fixture = clientFor(operation);
  fixture.client.from = table => ({ select: () => {
    const chain = { eq: () => chain, async maybeSingle() { return { data: null, error: null }; } };
    fixture.calls.reads.push({ table });
    return chain;
  } });
  const outcome = await sync.createQueueRuntime({
    queue,
    transport: sync.createTransport({ client: fixture.client, enabled: true, envelopeApi })
  }).flush();
  assert.equal(outcome.reasonCode, sync.reasonCodes.READBACK_MISSING);
  assert.equal(queue.pending().length, 1);
});

async function mismatchOutcome(overrides) {
  const queue = cloud.createMemoryQueue();
  const operation = await firstOperation({ queue });
  const { client } = clientFor(operation, { row: rowFor(operation, overrides) });
  const outcome = await sync.createQueueRuntime({
    queue,
    transport: sync.createTransport({ client, enabled: true, envelopeApi })
  }).flush();
  return { outcome, queue, operation };
}

test('20 aggregate revision mismatch never ACKs', async () => {
  const { outcome, queue } = await mismatchOutcome({ version: 2 });
  assert.equal(outcome.reasonCode, sync.reasonCodes.READBACK_MISMATCH);
  assert.equal(queue.pending().length, 1);
});

test('21 component revision mismatch never ACKs', async () => {
  const { outcome, queue } = await mismatchOutcome({ definitions_revision: 9 });
  assert.equal(outcome.reasonCode, sync.reasonCodes.READBACK_MISMATCH);
  assert.equal(queue.pending().length, 1);
});

test('22 aggregate fingerprint mismatch never ACKs', async () => {
  const { outcome, queue } = await mismatchOutcome({ fingerprint: 'a'.repeat(64) });
  assert.equal(outcome.reasonCode, sync.reasonCodes.READBACK_MISMATCH);
  assert.equal(queue.pending().length, 1);
});

test('23 component fingerprint mismatch never ACKs', async () => {
  const { outcome, queue } = await mismatchOutcome({ heads_fingerprint: 'b'.repeat(64) });
  assert.equal(outcome.reasonCode, sync.reasonCodes.READBACK_MISMATCH);
  assert.equal(queue.pending().length, 1);
});

test('24 payload and fingerprint disagreement never ACKs', async () => {
  const operation = await firstOperation();
  const payload = clone(operation.payload);
  payload.heads.programs[0].updatedAt = '2026-08-25T22:00:00.000Z';
  const queue = cloud.createMemoryQueue();
  queue.enqueue(operation);
  const { client } = clientFor(operation, { row: rowFor(operation, { payload }) });
  const outcome = await sync.createQueueRuntime({
    queue,
    transport: sync.createTransport({ client, enabled: true, envelopeApi })
  }).flush();
  assert.equal(outcome.reasonCode, sync.reasonCodes.READBACK_MISMATCH);
  assert.equal(queue.pending().length, 1);
});

test('25 equal revision with a different fingerprint never ACKs', async () => {
  const { outcome, queue, operation } = await mismatchOutcome({ version: 1, fingerprint: 'c'.repeat(64) });
  assert.equal(operation.version, 1);
  assert.equal(outcome.reasonCode, sync.reasonCodes.READBACK_MISMATCH);
  assert.equal(queue.pending().length, 1);
});

test('26 idempotent replay plus exact readback ACKs exactly once', async () => {
  const queue = cloud.createMemoryQueue();
  const operation = await firstOperation({ queue });
  const { client, calls } = clientFor(operation, { alreadyApplied: true });
  const runtime = sync.createQueueRuntime({ queue, transport: sync.createTransport({ client, enabled: true, envelopeApi }) });
  assert.equal((await runtime.flush()).sent, 1);
  assert.equal((await runtime.flush()).sent, 0);
  assert.equal(calls.rpc.length, 1);
  assert.equal(queue.acknowledgement(operation.idempotencyKey).reason, null);
});

test('27 operation N+1 waits behind unresolved N for the same profile', async () => {
  const flow = await successor();
  const calls = [];
  const runtime = sync.createQueueRuntime({
    queue: flow.queue,
    transport: {
      enabled: true,
      async send(operation) {
        calls.push(operation.version);
        return operation.version === 1
          ? { ok: false, blocked: false, reasonCode: sync.reasonCodes.TRANSIENT_FAILURE }
          : { ok: true, remoteVersion: operation.version };
      }
    }
  });
  const outcome = await runtime.flush();
  assert.deepEqual(calls, [1]);
  assert.equal(outcome.deferred, 1);
  assert.equal(flow.queue.pending().length, 2);
});

test('28 a stale N blocks dependent N+1', async () => {
  const flow = await successor();
  const calls = [];
  const outcome = await sync.createQueueRuntime({
    queue: flow.queue,
    transport: {
      enabled: true,
      async send(operation) {
        calls.push(operation.version);
        return { ok: false, blocked: true, reasonCode: sync.reasonCodes.STALE_BASE };
      }
    }
  }).flush();
  assert.deepEqual(calls, [1]);
  assert.equal(outcome.reasonCode, sync.reasonCodes.STALE_BASE);
  assert.equal(outcome.deferred, 1);
});

test('29 ACKed N permits N+1 in exact revision order', async () => {
  const flow = await successor();
  const calls = [];
  const outcome = await sync.createQueueRuntime({
    queue: flow.queue,
    transport: {
      enabled: true,
      async send(operation) { calls.push(operation.version); return { ok: true, remoteVersion: operation.version }; }
    }
  }).flush();
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual({ sent: outcome.sent, pending: outcome.pending }, { sent: 2, pending: 0 });
});

test('30 different profiles remain independent when one profile is blocked', async () => {
  const queue = cloud.createMemoryQueue();
  const profileA = { accountId: 'account-shared', profileId: 'profile-a' };
  const profileB = { accountId: 'account-shared', profileId: 'profile-b' };
  await firstOperation({ queue, scope: profileA, capture: captureFixture(profileA) });
  await firstOperation({ queue, scope: profileB, capture: captureFixture(profileB) });
  const calls = [];
  const outcome = await sync.createQueueRuntime({
    queue,
    transport: {
      enabled: true,
      async send(operation) {
        calls.push(operation.owner.profileId);
        return operation.owner.profileId === 'profile-a'
          ? { ok: false, blocked: true, reasonCode: sync.reasonCodes.STALE_BASE }
          : { ok: true, remoteVersion: operation.version };
      }
    }
  }).flush();
  assert.deepEqual(calls, ['profile-a', 'profile-b']);
  assert.equal(outcome.sent, 1);
  assert.equal(queue.pending()[0].owner.profileId, 'profile-a');
});

test('31 unsupported Program schema leaves an unrelated existing queue operational', async () => {
  const programQueue = cloud.createMemoryQueue();
  await firstOperation({ queue: programQueue });
  const disabled = sync.createQueueRuntime({
    queue: programQueue,
    transport: sync.createTransport({ client: null, enabled: false, envelopeApi })
  });
  assert.equal((await disabled.flush()).reasonCode, sync.reasonCodes.UNSUPPORTED);
  const ordinaryQueue = cloud.createMemoryQueue();
  const workout = cloud.createOperation({
    owner: { accountId: 'account', profileId: 'profile' },
    entityType: 'workouts', entityId: 'workout', mutation: 'upsert', version: 1,
    updatedAt: '2026-08-25T14:00:00.000Z', payload: { completedAt: '2026-08-25T14:00:00.000Z' }
  });
  ordinaryQueue.enqueue(workout);
  const coordinator = cloud.createLocalFirstCoordinator({
    owner: workout.owner,
    persistLocal: async () => {},
    queue: ordinaryQueue,
    transport: { enabled: true, async send() { return { ok: true, remoteVersion: 1 }; } }
  });
  assert.equal((await coordinator.syncQuietly({ online: true })).sent, 1);
  assert.equal(programQueue.pending().length, 1);
});

test('32 disabled Program transport makes no cloud calls', async () => {
  const queue = cloud.createMemoryQueue();
  await firstOperation({ queue });
  let calls = 0;
  const client = { rpc() { calls += 1; }, from() { calls += 1; }, auth: { getUser() { calls += 1; } } };
  const outcome = await sync.createQueueRuntime({
    queue,
    transport: sync.createTransport({ client, enabled: false, envelopeApi })
  }).flush();
  assert.equal(outcome.disabled, true);
  assert.equal(calls, 0);
  assert.equal(queue.pending().length, 1);
});

test('33 production startup remains untouched because the Program transport module is runtime-unattached', async () => {
  const [documentSource, workerSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../service-worker.js', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(documentSource, /program-domain-sync\.js/);
  assert.doesNotMatch(workerSource, /program-domain-sync\.js/);
});

test('34 durable queue format reloads old operations and the new frozen variant without a version upgrade', async () => {
  const storage = memoryStorage();
  const queue = cloud.createDurableQueue({ storage, key: 'program-domain-format-proof' });
  const ordinary = cloud.createOperation({
    owner: { accountId: 'account', profileId: 'profile' },
    entityType: 'preferences', entityId: 'goals', mutation: 'upsert', version: 1,
    updatedAt: '2026-08-25T14:00:00.000Z', payload: { goal: 'stable' }
  });
  queue.enqueue(ordinary);
  const program = await firstOperation({ queue });
  const restored = cloud.createDurableQueue({ storage, key: 'program-domain-format-proof' });
  assert.equal(JSON.parse(storage.value()).version, 1);
  assert.deepEqual(restored.pending().map(operation => operation.entityType), ['preferences', 'program_domains']);
  const restoredProgram = restored.pending().find(operation => operation.idempotencyKey === program.idempotencyKey);
  assert.equal(restoredProgram.programDomain.payloadCanonical, program.programDomain.payloadCanonical);
  assert.equal(Object.isFrozen(restoredProgram.programDomain), true);
});

test('35 existing queue reconciliation remains isolated from Program-domain operations', async () => {
  const source = await readFile(new URL('../cloud-sync.js', import.meta.url), 'utf8');
  assert.match(source, /if \(operation\.entityType === 'program_domains'\)/);
  assert.match(source, /program-domain-dedicated-transport-required/);
  assert.match(source, /!shadow\.tables\.includes\(operation\?\.entityType\)/);
});
