import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.window = globalThis;

await import('../program-model.js');
await import('../program-origin.js');
await import('../program-domain-envelope.js');
await import('../cloud-storage.js');
await import('../program-domain-sync.js');
await import('../program-domain-recovery.js');

const model = globalThis.BigGainsProgramModel;
const originApi = globalThis.BigGainsProgramOrigin;
const envelopeApi = globalThis.BigGainsProgramDomainEnvelope;
const cloud = globalThis.BigGainsCloud;
const sync = globalThis.BigGainsProgramDomainSync;
const recovery = globalThis.BigGainsProgramDomainRecovery;
const owner = Object.freeze({ accountId: 'cloud-account-program-recovery', profileId: 'cloud-profile-program-recovery' });
const profileScope = Object.freeze({ accountId: 'local-account-program-recovery', profileId: 'client-profile-program-recovery' });
const catalog = Object.freeze({ canonicalIdFor: value => typeof value === 'string' ? value.trim() : null });
const clone = value => structuredClone(value);

function captureFixture(scope = profileScope) {
  let counter = 0;
  let tick = 0;
  const createId = () => `${scope.profileId}-id-${String(++counter).padStart(3, '0')}`;
  const now = () => `2026-08-28T12:${String(tick++).padStart(2, '0')}:00.000Z`;
  const routine = model.approveRoutine({
    capture: model.blankCapture(),
    ...scope,
    purposeKey: 'push',
    label: 'Push',
    source: { kind: 'reviewed_rebuild', routineType: 'Push' },
    exercises: [{ exerciseId: 'exercise-bench', workingSets: 3, targetReps: '6-8', restSeconds: 180 }],
    catalog,
    createId,
    now
  });
  const draft = model.createProgramDraft({
    capture: routine.capture,
    ...scope,
    purposeKey: 'program',
    name: 'Recovery Program',
    slots: [{
      label: 'Push',
      preferredCalendarAnchor: null,
      routineId: routine.version.routineId,
      routineVersionId: routine.version.routineVersionId
    }],
    blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
    programmingAuthority: 'review',
    startsOn: '2026-08-28',
    versionNote: 'Recovery fixture',
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
  next.programs[0].updatedAt = `2026-08-28T12:${String(minute).padStart(2, '0')}:00.000Z`;
  return next;
}

function divergentLocal(capture) {
  const next = clone(capture);
  next.programVersions[0].name = 'This Device Program';
  next.programVersions[0].versionNote = 'Local-only divergence';
  return next;
}

function successorCapture(capture, activeWorkoutId) {
  const next = clone(capture);
  const base = next.programVersions[0];
  const successor = {
    ...clone(base),
    programVersionId: `${base.programVersionId}-successor`,
    versionNumber: 2,
    predecessorProgramVersionId: base.programVersionId,
    name: 'Recovery Program successor',
    effectiveBoundary: { kind: 'next_unmaterialized_session', activeWorkoutIdAtAcceptance: activeWorkoutId },
    createdAt: '2026-08-28T20:01:00.000Z',
    versionNote: 'Approved successor'
  };
  next.programVersions.push(successor);
  next.programs[0].latestVersionId = successor.programVersionId;
  next.programs[0].activeVersionId = successor.programVersionId;
  next.programs[0].updatedAt = successor.createdAt;
  next.activeProgramVersionId = successor.programVersionId;
  next.sequenceState = {
    ...next.sequenceState,
    programVersionId: successor.programVersionId,
    updatedAt: successor.createdAt
  };
  return next;
}

async function remoteFor({
  capture = captureFixture(),
  version = 1,
  revisions = { definitions: 1, heads: 1, sequence: 1 },
  updatedAt = `2026-08-28T14:0${version - 1}:00.000Z`,
  lastTransition = null,
  acceptedBase = null,
  rowOverrides = {}
} = {}) {
  const envelope = await envelopeApi.build({
    ...profileScope,
    programCapture: capture,
    catalog,
    revisions,
    lastTransition
  });
  const hashes = await envelopeApi.fingerprints(envelope, { ...profileScope, revisions });
  const base = acceptedBase?.record || acceptedBase;
  const row = {
    id: 'program-domain-row',
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
    idempotency_key: `program-domain-operation-${version}`,
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
  return { row, validated, envelope, hashes };
}

async function emptyRemote() {
  const revisions = { definitions: 0, heads: 0, sequence: 0 };
  const envelope = envelopeApi.empty(profileScope);
  const hashes = await envelopeApi.fingerprints(envelope, { ...profileScope, revisions });
  const row = {
    id: 'program-domain-empty-row',
    account_id: owner.accountId,
    profile_id: owner.profileId,
    client_id: 'program-domain',
    contract: envelopeApi.contract,
    contract_version: envelopeApi.contractVersion,
    payload: {},
    version: 1,
    fingerprint: hashes.fingerprint,
    definitions_revision: 0,
    definitions_fingerprint: hashes.definitionsFingerprint,
    heads_revision: 0,
    heads_fingerprint: hashes.headsFingerprint,
    sequence_revision: 0,
    sequence_fingerprint: hashes.sequenceFingerprint,
    idempotency_key: 'program-domain-empty-operation',
    base_version: null,
    base_updated_at: null,
    base_fingerprint: null,
    base_definitions_revision: null,
    base_definitions_fingerprint: null,
    base_heads_revision: null,
    base_heads_fingerprint: null,
    base_sequence_revision: null,
    base_sequence_fingerprint: null,
    created_at: '2026-08-28T14:00:00.000Z',
    updated_at: '2026-08-28T14:00:00.000Z'
  };
  return { row, validated: await recovery.validateRemoteRow(row, { owner, scope: profileScope, envelopeApi }) };
}

function readResult(validated) {
  return { state: 'remote_available', reasonCode: null, remote: validated };
}

async function classify(input = {}) {
  return recovery.classify({
    capabilityAvailable: true,
    owner,
    scope: profileScope,
    envelopeApi,
    programModel: model,
    catalog,
    availableGoalIds: [],
    ...input
  });
}

function clientFor({ row = null, error = null, authenticated = true } = {}) {
  const calls = { auth: 0, reads: 0, filters: {} };
  return {
    calls,
    client: {
      auth: { async getUser() {
        calls.auth += 1;
        return authenticated ? { data: { user: { id: 'auth-user' } }, error: null }
          : { data: { user: null }, error: { code: '401' } };
      } },
      from(table) {
        assert.equal(table, 'program_domains');
        calls.reads += 1;
        return { select() {
          const chain = {
            eq(name, value) { calls.filters[name] = value; return chain; },
            async maybeSingle() { return { data: error ? null : clone(row), error }; }
          };
          return chain;
        } };
      }
    }
  };
}

function memoryProfile(initial, behavior = {}) {
  let raw = initial;
  let writes = 0;
  let removes = 0;
  return {
    async readRaw() { return raw; },
    async writeRaw(value) {
      writes += 1;
      if (behavior.throwOnWrite === writes) throw new Error('synthetic write failure');
      raw = behavior.corruptOnWrite === writes ? `${value}corrupt` : value;
    },
    async removeRaw() { removes += 1; raw = null; },
    raw: () => raw,
    writes: () => writes,
    removes: () => removes
  };
}

test('1 unsupported capability leaves runtime untouched and makes no remote call', async () => {
  const { client, calls } = clientFor();
  const read = await recovery.readRemote({ client, enabled: false, owner, scope: profileScope });
  assert.equal(read.state, recovery.states.UNSUPPORTED);
  assert.equal(calls.auth, 0);
  assert.equal(calls.reads, 0);
});

test('2 missing remote row remains distinct remote_absent', async () => {
  const { client } = clientFor({ row: null });
  const read = await recovery.readRemote({ client, enabled: true, owner, scope: profileScope });
  assert.equal(read.state, recovery.states.REMOTE_ABSENT);
  assert.equal((await classify({ remoteRead: read, localProgramCapture: null })).state, recovery.states.REMOTE_ABSENT);
});

test('3 explicit empty payload is a valid remote envelope', async () => {
  const remote = await emptyRemote();
  assert.equal(remote.validated.ok, true);
  assert.deepEqual(remote.validated.envelope, {});
});

test('4 exact local and remote state classifies exact', async () => {
  const capture = captureFixture();
  const remote = await remoteFor({ capture });
  const inspected = await classify({ remoteRead: readResult(remote.validated), localProgramCapture: capture });
  assert.equal(inspected.state, recovery.states.EXACT);
});

test('5 valid remote-only advancement classifies safe from an accepted base', async () => {
  const baseCapture = captureFixture();
  const base = await remoteFor({ capture: baseCapture });
  const successor = await remoteFor({
    capture: changedHeads(baseCapture),
    version: 2,
    revisions: { definitions: 1, heads: 2, sequence: 1 },
    acceptedBase: base.validated
  });
  const inspected = await classify({
    remoteRead: readResult(successor.validated),
    acceptedRemote: base.validated,
    localProgramCapture: baseCapture
  });
  assert.equal(inspected.state, recovery.states.REMOTE_FAST_FORWARD_SAFE);
});

test('6 invalid remote envelope is rejected', async () => {
  const remote = await remoteFor();
  remote.row.payload.contract = 'wrong-contract';
  const validated = await recovery.validateRemoteRow(remote.row, { owner, scope: profileScope, envelopeApi });
  assert.equal(validated.ok, false);
});

test('7 unresolved Routine pin blocks remote validation', async () => {
  const remote = await remoteFor();
  remote.row.payload.definitions.routineVersions = [];
  const validated = await recovery.validateRemoteRow(remote.row, { owner, scope: profileScope, envelopeApi });
  assert.equal(validated.ok, false);
  assert.equal(validated.reasonCode, envelopeApi.errorCodes.UNRESOLVED_PIN);
});

test('8 equal revision with a different fingerprint is invalid', async () => {
  const base = await remoteFor();
  const changed = await remoteFor({ capture: changedHeads(captureFixture()) });
  const inspected = await classify({
    remoteRead: readResult(changed.validated),
    acceptedRemote: base.validated,
    localProgramCapture: captureFixture()
  });
  assert.equal(inspected.state, recovery.states.INVALID_REMOTE);
  assert.equal(inspected.reasonCode, recovery.reasonCodes.EQUAL_REVISION_DISAGREEMENT);
});

test('9 remote revision downgrade is invalid', async () => {
  const accepted = await remoteFor({ version: 2, rowOverrides: { base_version: 1 } });
  // Supply a structurally valid accepted identity without relying on its intentionally abbreviated fixture base.
  const acceptedIdentity = { ...accepted.validated, record: { ...accepted.validated.record, version: 2 } };
  const remote = await remoteFor();
  const inspected = await classify({ remoteRead: readResult(remote.validated), acceptedRemote: acceptedIdentity, localProgramCapture: captureFixture() });
  assert.equal(inspected.state, recovery.states.INVALID_REMOTE);
  assert.equal(inspected.reasonCode, recovery.reasonCodes.REMOTE_REVISION_DOWNGRADE);
});

test('10 meaningful local and remote divergence requires an explicit conflict decision', async () => {
  const remote = await remoteFor();
  const inspected = await classify({ remoteRead: readResult(remote.validated), localProgramCapture: divergentLocal(captureFixture()) });
  assert.equal(inspected.state, recovery.states.DIVERGENT_CONFLICT);
  assert.equal(inspected.message, 'This Program changed on both devices.');
  assert.deepEqual(inspected.decisions.map(value => value.supported), [true, true]);
  assert.deepEqual(inspected.decisions.map(value => value.label), ['Use cloud Program', 'Use this device Program']);
});

test('11 pending local Program operation blocks adoption', async () => {
  const baseCapture = captureFixture();
  const localCapture = changedHeads(baseCapture);
  const remote = await remoteFor({ capture: baseCapture });
  const local = await remoteFor({
    capture: localCapture,
    version: 2,
    revisions: { definitions: 1, heads: 2, sequence: 1 },
    acceptedBase: remote.validated,
    updatedAt: '2026-08-28T15:00:00.000Z'
  });
  const operation = cloud.createOperation({
    owner,
    entityType: 'program_domains',
    entityId: 'program-domain',
    mutation: 'upsert',
    version: 2,
    updatedAt: '2026-08-28T15:00:00.000Z',
    payload: local.envelope,
    payloadFingerprint: local.hashes.fingerprint,
    baseRevision: { version: 1, updatedAt: remote.validated.record.updatedAt, fingerprint: remote.validated.record.fingerprint },
    programDomain: {
      clientId: 'program-domain',
      payloadCanonical: envelopeApi.canonicalize(local.envelope),
      definitionsRevision: 1,
      definitionsFingerprint: local.hashes.definitionsFingerprint,
      headsRevision: 2,
      headsFingerprint: local.hashes.headsFingerprint,
      sequenceRevision: 1,
      sequenceFingerprint: local.hashes.sequenceFingerprint,
      manifest: local.hashes.manifest,
      acceptedBase: recovery.validateRemoteRow ? {
        accountId: owner.accountId,
        profileId: owner.profileId,
        clientId: 'program-domain',
        ...Object.fromEntries(Object.entries(remote.validated.record).filter(([key]) => [
          'version', 'updatedAt', 'fingerprint', 'definitionsRevision', 'definitionsFingerprint',
          'headsRevision', 'headsFingerprint', 'sequenceRevision', 'sequenceFingerprint'
        ].includes(key)))
      } : null,
      predecessorIdempotencyKey: null
    }
  });
  const inspected = await classify({
    remoteRead: readResult(remote.validated),
    localProgramCapture: localCapture,
    operations: [operation]
  });
  assert.equal(inspected.state, recovery.states.LOCAL_AHEAD_PENDING);
  assert.equal(inspected.canAdopt, false);
});

test('12 active workout blocks initialized-device adoption', async () => {
  const remote = await remoteFor();
  const inspected = await classify({
    remoteRead: readResult(remote.validated),
    localProgramCapture: null,
    pristine: true,
    activeWorkout: { id: 'active-workout' },
    initialized: true
  });
  assert.equal(inspected.state, recovery.states.BLOCKED_ACTIVE_SESSION);
});

test('13 unresolved rest state blocks initialized-device adoption', async () => {
  const remote = await remoteFor();
  const inspected = await classify({
    remoteRead: readResult(remote.validated),
    localProgramCapture: null,
    pristine: true,
    restTimerEndsAt: Date.now() + 60_000,
    initialized: true
  });
  assert.equal(inspected.state, recovery.states.BLOCKED_ACTIVE_SESSION);
  assert.equal(inspected.reasonCode, recovery.reasonCodes.REST_STATE_PRESENT);
});

test('14 pristine fresh device can adopt a complete graph', async () => {
  const remote = await remoteFor();
  const inspected = await classify({ remoteRead: readResult(remote.validated), localProgramCapture: null, pristine: true, freshDevice: true });
  assert.equal(inspected.state, recovery.states.REMOTE_FAST_FORWARD_SAFE);
});

test('15 fresh-device reconstruction preserves exact Program and Routine identities and sequence', async () => {
  const capture = captureFixture();
  const remote = await remoteFor({ capture });
  const restored = recovery.captureFromEnvelope(remote.envelope);
  assert.deepEqual(restored.routines.map(value => value.routineId), capture.routines.map(value => value.routineId));
  assert.deepEqual(restored.routineVersions.map(value => value.routineVersionId), capture.routineVersions.map(value => value.routineVersionId));
  assert.deepEqual(restored.programVersions[0].slots, capture.programVersions[0].slots);
  assert.deepEqual(restored.sequenceState, capture.sequenceState);
});

test('16 Program-origin active session validates only after its graph is available', async () => {
  const capture = captureFixture();
  const materialized = originApi.materializeNext({
    capture,
    ...profileScope,
    catalog,
    materializedAt: '2026-08-28T16:00:00.000Z'
  });
  const remote = await remoteFor({ capture });
  const inspected = await classify({
    remoteRead: readResult(remote.validated),
    localProgramCapture: null,
    pristine: true,
    freshDevice: true,
    activeWorkout: { id: 'active', programOrigin: materialized.programOrigin }
  });
  assert.equal(inspected.state, recovery.states.REMOTE_FAST_FORWARD_SAFE);
  assert.equal(recovery.validateActiveOrigin({ programOrigin: materialized.programOrigin }, {}, { owner, scope: profileScope }).ok, false);
});

test('17 persistence failure restores the exact prior profile bytes', async () => {
  const capture = captureFixture();
  const base = await remoteFor({ capture });
  const successor = await remoteFor({
    capture: changedHeads(capture), version: 2,
    revisions: { definitions: 1, heads: 2, sequence: 1 }, acceptedBase: base.validated
  });
  const inspected = await classify({ remoteRead: readResult(successor.validated), acceptedRemote: base.validated, localProgramCapture: capture });
  const initial = JSON.stringify({ version: 5, profileId: profileScope.profileId, workouts: [{ id: 'history' }], programCapture: capture });
  const memory = memoryProfile(initial, { throwOnWrite: 1 });
  const adopted = await recovery.adopt({
    classification: inspected, remote: successor.validated, ...memory,
    owner, scope: profileScope, envelopeApi, programModel: model, catalog
  });
  assert.equal(adopted.ok, false);
  assert.equal(memory.raw(), initial);
});

test('18 local readback mismatch restores the exact prior profile bytes', async () => {
  const remote = await remoteFor();
  const inspected = await classify({ remoteRead: readResult(remote.validated), localProgramCapture: null, pristine: true, freshDevice: true });
  const initial = JSON.stringify({ version: 5, profileId: profileScope.profileId, workouts: [] });
  const memory = memoryProfile(initial, { corruptOnWrite: 1 });
  const adopted = await recovery.adopt({
    classification: inspected, remote: remote.validated, ...memory,
    owner, scope: profileScope, envelopeApi, programModel: model, catalog, freshDevice: true
  });
  assert.equal(adopted.ok, false);
  assert.equal(adopted.reasonCode, recovery.reasonCodes.ADOPTION_READBACK_MISMATCH);
  assert.equal(adopted.rolledBack, true);
  assert.equal(memory.raw(), initial);
});

test('19 explicit remote empty restores no Program on a pristine device', async () => {
  const remote = await emptyRemote();
  const inspected = await classify({ remoteRead: readResult(remote.validated), localProgramCapture: null, pristine: true, freshDevice: true });
  const memory = memoryProfile(null);
  const candidate = { version: 5, profileId: profileScope.profileId, workouts: [], programCapture: model.blankCapture() };
  const adopted = await recovery.adopt({
    classification: inspected, remote: remote.validated, ...memory,
    candidateProfile: candidate, owner, scope: profileScope,
    envelopeApi, programModel: model, catalog, freshDevice: true, initialized: false
  });
  assert.equal(adopted.ok, true);
  assert.equal(Object.hasOwn(JSON.parse(memory.raw()), 'programCapture'), false);
});

test('20 remote absence never erases a legacy local Program', async () => {
  const inspected = await classify({
    remoteRead: { state: recovery.states.REMOTE_ABSENT, remote: null },
    localProgramCapture: captureFixture()
  });
  assert.equal(inspected.state, recovery.states.LEGACY_UNPUBLISHED_LOCAL);
});

test('21 meaningful legacy local plus no remote is classified legacy_unpublished_local', async () => {
  const inspected = await classify({ remoteRead: { state: recovery.states.REMOTE_ABSENT }, localProgramCapture: captureFixture() });
  assert.equal(inspected.legacyKind, 'meaningful_program');
});

test('22 no-Program legacy state remains separately identified', async () => {
  const inspected = await classify({ remoteRead: { state: recovery.states.REMOTE_ABSENT }, localProgramCapture: model.blankCapture() });
  assert.equal(inspected.state, recovery.states.REMOTE_ABSENT);
  assert.equal(inspected.legacyKind, 'no_program');
});

test('23 adoption preserves History and programOrigin bytes without inference', async () => {
  const remote = await remoteFor();
  const inspected = await classify({ remoteRead: readResult(remote.validated), localProgramCapture: null, pristine: true, freshDevice: true });
  const origin = { contract: 'big-gains.program-origin.v1', legacy: true, exact: 'unchanged' };
  const workout = { id: 'history', programOrigin: clone(origin) };
  const memory = memoryProfile(JSON.stringify({ version: 5, profileId: profileScope.profileId, workouts: [workout] }));
  const adopted = await recovery.adopt({
    classification: inspected, remote: remote.validated, ...memory,
    owner, scope: profileScope, envelopeApi, programModel: model, catalog, freshDevice: true
  });
  assert.equal(adopted.ok, true);
  assert.deepEqual(JSON.parse(memory.raw()).workouts[0].programOrigin, origin);
});

test('24 adoption does not acknowledge or clear any queue operation', async () => {
  const remote = await remoteFor();
  const inspected = await classify({ remoteRead: readResult(remote.validated), localProgramCapture: null, pristine: true, freshDevice: true });
  const ordinary = cloud.createOperation({
    owner, entityType: 'preferences', entityId: 'goals', mutation: 'upsert', version: 1,
    updatedAt: '2026-08-28T17:00:00.000Z', payload: { value: 'unchanged' }
  });
  const operations = [ordinary];
  const memory = memoryProfile(JSON.stringify({ version: 5, profileId: profileScope.profileId, workouts: [] }));
  const adopted = await recovery.adopt({
    classification: inspected, remote: remote.validated, ...memory,
    getOperations: () => operations, owner, scope: profileScope,
    envelopeApi, programModel: model, catalog, freshDevice: true
  });
  assert.equal(adopted.ok, true);
  assert.deepEqual(operations, [ordinary]);
});

test('25 physical owner and semantic profile scope are both enforced', async () => {
  const remote = await remoteFor();
  const wrongOwner = await recovery.validateRemoteRow(remote.row, {
    owner: { ...owner, profileId: 'other-cloud-profile' }, scope: profileScope, envelopeApi
  });
  const wrongScope = await recovery.validateRemoteRow(remote.row, {
    owner, scope: { ...profileScope, profileId: 'other-client-profile' }, envelopeApi
  });
  assert.equal(wrongOwner.ok, false);
  assert.equal(wrongScope.ok, false);
});

test('26 managed Jorge and Alexa remote rows remain isolated', async () => {
  const remote = await remoteFor();
  const alexa = await recovery.validateRemoteRow(remote.row, {
    owner: { accountId: owner.accountId, profileId: 'alexa-cloud-profile' },
    scope: { accountId: 'local-alexa', profileId: 'alexa' },
    envelopeApi
  });
  assert.equal(alexa.ok, false);
});

test('27 independent user cannot validate another user remote row', async () => {
  const remote = await remoteFor();
  const other = await recovery.validateRemoteRow(remote.row, {
    owner: { accountId: 'other-account', profileId: 'other-profile' },
    scope: { accountId: 'cloud:other-account', profileId: 'other-client' },
    envelopeApi
  });
  assert.equal(other.ok, false);
});

test('28 offline and current startup remain unchanged while capability is unavailable', async () => {
  const read = await recovery.readRemote({ enabled: false, client: null, owner, scope: profileScope });
  assert.equal(read.state, recovery.states.UNSUPPORTED);
  const [documentSource, workerSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../service-worker.js', import.meta.url), 'utf8')
  ]);
  assert.doesNotMatch(documentSource, /program-domain-recovery\.js/);
  assert.doesNotMatch(workerSource, /program-domain-recovery\.js/);
});

test('29 repeated classification is stable and idempotent', async () => {
  const remote = await remoteFor();
  const input = { remoteRead: readResult(remote.validated), localProgramCapture: captureFixture() };
  const first = await classify(input);
  const second = await classify(clone(input));
  assert.deepEqual(second, first);
});

test('30 unrelated cloud-domain operations do not block Program adoption', async () => {
  const remote = await remoteFor();
  const ordinary = cloud.createOperation({
    owner, entityType: 'workouts', entityId: 'workout', mutation: 'upsert', version: 1,
    updatedAt: '2026-08-28T18:00:00.000Z', payload: { completedAt: '2026-08-28T18:00:00.000Z' }
  });
  const inspected = await classify({
    remoteRead: readResult(remote.validated), localProgramCapture: null,
    pristine: true, freshDevice: true, operations: [ordinary]
  });
  assert.equal(inspected.state, recovery.states.REMOTE_FAST_FORWARD_SAFE);
});

test('31 unresolved Goal reference blocks adoption without mutating Goals', async () => {
  const capture = captureFixture();
  capture.programVersions[0].priorityGoalIds = ['goal-bench'];
  const remote = await remoteFor({ capture });
  const inspected = await recovery.classify({
    capabilityAvailable: true, remoteRead: readResult(remote.validated),
    localProgramCapture: null, pristine: true, freshDevice: true,
    owner, scope: profileScope, envelopeApi, programModel: model, catalog,
    availableGoalIds: []
  });
  assert.equal(inspected.state, recovery.states.INVALID_REMOTE);
  assert.equal(inspected.reasonCode, recovery.reasonCodes.UNRESOLVED_GOAL_REFERENCE);
});

test('32 immutable member removal in a remote successor is rejected', async () => {
  const firstCapture = captureFixture();
  const first = await remoteFor({ capture: firstCapture });
  const otherCapture = captureFixture({ accountId: profileScope.accountId, profileId: profileScope.profileId });
  otherCapture.routineVersions[0].label = 'Changed immutable member';
  const second = await remoteFor({
    capture: otherCapture,
    version: 2,
    revisions: { definitions: 2, heads: 1, sequence: 1 },
    acceptedBase: first.validated
  });
  const inspected = await classify({
    remoteRead: readResult(second.validated), acceptedRemote: first.validated,
    localProgramCapture: firstCapture
  });
  assert.equal(inspected.state, recovery.states.INVALID_REMOTE);
  assert.equal(inspected.reasonCode, recovery.reasonCodes.IMMUTABLE_LINEAGE_DIVERGED);
});

test('33 active workout remains byte-identical through fresh-device graph adoption', async () => {
  const capture = captureFixture();
  const materialized = originApi.materializeNext({ capture, ...profileScope, catalog, materializedAt: '2026-08-28T19:00:00.000Z' });
  const activeWorkout = { id: 'active', exercises: [{ id: 'exact' }], programOrigin: materialized.programOrigin };
  const remote = await remoteFor({ capture });
  const inspected = await classify({
    remoteRead: readResult(remote.validated), localProgramCapture: null,
    pristine: true, freshDevice: true, activeWorkout
  });
  const memory = memoryProfile(null);
  const adopted = await recovery.adopt({
    classification: inspected, remote: remote.validated, ...memory,
    candidateProfile: { version: 5, profileId: profileScope.profileId, workouts: [], activeWorkout },
    owner, scope: profileScope, envelopeApi, programModel: model, catalog,
    freshDevice: true, initialized: false
  });
  assert.equal(adopted.ok, true);
  assert.deepEqual(JSON.parse(memory.raw()).activeWorkout, activeWorkout);
});

test('34 frozen predecessor provenance resolves when the retained predecessor graph is present', async () => {
  const capture = captureFixture();
  const materialized = originApi.materializeNext({ capture, ...profileScope, catalog, materializedAt: '2026-08-28T20:00:00.000Z' });
  const remote = await remoteFor({ capture });
  assert.equal(recovery.validateActiveOrigin({ programOrigin: materialized.programOrigin }, remote.envelope, { owner, scope: profileScope }).ok, true);
});

test('35 remote read applies exact owner filters and only asks for one row', async () => {
  const remote = await remoteFor();
  const { client, calls } = clientFor({ row: remote.row });
  const read = await recovery.readRemote({ client, enabled: true, owner, scope: profileScope, envelopeApi });
  assert.equal(read.state, 'remote_available');
  assert.deepEqual(calls.filters, {
    account_id: owner.accountId,
    profile_id: owner.profileId,
    client_id: 'program-domain'
  });
});

test('36 a frozen predecessor active workout is preserved while the complete successor graph is adopted', async () => {
  const baseCapture = captureFixture();
  const activeWorkoutId = 'active-frozen-predecessor';
  const materialized = originApi.materializeNext({
    capture: baseCapture,
    ...profileScope,
    catalog,
    materializedAt: '2026-08-28T20:00:00.000Z'
  });
  const activeWorkout = {
    id: activeWorkoutId,
    exercises: [{ id: 'frozen-exercise', sets: [] }],
    programOrigin: materialized.programOrigin
  };
  const base = await remoteFor({ capture: baseCapture });
  const successor = successorCapture(baseCapture, activeWorkoutId);
  const successorVersion = successor.programVersions.at(-1);
  const lastTransition = {
    transitionId: 'successor-carry-recovery',
    kind: 'successor_carry',
    before: {
      programVersionId: baseCapture.sequenceState.programVersionId,
      nextSlotIndex: baseCapture.sequenceState.nextSlotIndex,
      completedCycles: baseCapture.sequenceState.completedCycles
    },
    after: {
      programVersionId: successorVersion.programVersionId,
      nextSlotIndex: successor.sequenceState.nextSlotIndex,
      completedCycles: successor.sequenceState.completedCycles
    },
    occurredAt: successor.sequenceState.updatedAt,
    workoutId: null
  };
  const remote = await remoteFor({
    capture: successor,
    version: 2,
    revisions: { definitions: 2, heads: 2, sequence: 2 },
    acceptedBase: base.validated,
    updatedAt: '2026-08-28T20:01:00.000Z',
    lastTransition
  });
  assert.equal(remote.validated.ok, true);
  const inspected = await classify({
    remoteRead: readResult(remote.validated),
    localProgramCapture: null,
    pristine: true,
    freshDevice: true,
    activeWorkout
  });
  assert.equal(inspected.state, recovery.states.REMOTE_FAST_FORWARD_SAFE);
  const memory = memoryProfile(null);
  const adopted = await recovery.adopt({
    classification: inspected,
    remote: remote.validated,
    ...memory,
    candidateProfile: { version: 5, profileId: profileScope.profileId, workouts: [], activeWorkout },
    owner,
    scope: profileScope,
    envelopeApi,
    programModel: model,
    catalog,
    freshDevice: true,
    initialized: false
  });
  assert.equal(adopted.ok, true);
  const stored = JSON.parse(memory.raw());
  assert.deepEqual(stored.activeWorkout, activeWorkout);
  assert.equal(stored.programCapture.activeProgramVersionId, successorVersion.programVersionId);
  assert.ok(stored.programCapture.programVersions.some(value => value.programVersionId === materialized.programOrigin.programVersionId));
});

test('37 signed-out remote read fails closed before querying Program data', async () => {
  const { client, calls } = clientFor({ authenticated: false });
  const read = await recovery.readRemote({ client, enabled: true, owner, scope: profileScope, envelopeApi });
  assert.equal(read.state, recovery.states.INVALID_REMOTE);
  assert.equal(read.reasonCode, recovery.reasonCodes.AUTH_REJECTED);
  assert.equal(calls.reads, 0);
});

test('38 missing hosted table fails back to unsupported capability', async () => {
  const { client } = clientFor({ error: { code: '42P01', message: 'relation does not exist' } });
  const read = await recovery.readRemote({ client, enabled: true, owner, scope: profileScope, envelopeApi });
  assert.equal(read.state, recovery.states.UNSUPPORTED);
});

test('39 local profile change after classification prevents adoption before any write', async () => {
  const remote = await remoteFor();
  const inspected = await classify({ remoteRead: readResult(remote.validated), localProgramCapture: null, pristine: true, freshDevice: true });
  const initial = JSON.stringify({ version: 5, profileId: profileScope.profileId, workouts: [] });
  const changed = JSON.stringify({ version: 5, profileId: profileScope.profileId, workouts: [{ id: 'concurrent' }] });
  const memory = memoryProfile(changed);
  const adopted = await recovery.adopt({
    classification: inspected,
    remote: remote.validated,
    ...memory,
    candidateProfile: JSON.parse(initial),
    owner,
    scope: profileScope,
    envelopeApi,
    programModel: model,
    catalog,
    freshDevice: true,
    initialized: false
  });
  assert.equal(adopted.ok, false);
  assert.equal(adopted.reasonCode, recovery.reasonCodes.ADOPTION_STATE_CHANGED);
  assert.equal(memory.writes(), 0);
  assert.equal(memory.raw(), changed);
});

test('40 local-only PE application trace survives a safe remote fast-forward', async () => {
  const baseCapture = captureFixture();
  const trace = {
    contract: 'big-gains.programming-application-trace.v1',
    applicationId: 'application-trace', proposalId: 'proposal', inputDigest: 'digest',
    ...profileScope,
    goalId: 'goal', exerciseId: 'exercise-bench',
    baseProgramVersionId: baseCapture.programVersions[0].programVersionId,
    newProgramVersionId: 'future-program-version',
    routineVersionTransitions: [{
      baseRoutineVersionId: baseCapture.routineVersions[0].routineVersionId,
      newRoutineVersionId: 'future-routine-version',
      routineId: baseCapture.routines[0].routineId
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
  baseCapture.applicationTraces = [trace];
  const accepted = await remoteFor({ capture: baseCapture });
  const successorCaptureValue = changedHeads(baseCapture, 22);
  const remote = await remoteFor({
    capture: successorCaptureValue,
    version: 2,
    revisions: { definitions: 1, heads: 2, sequence: 1 },
    acceptedBase: accepted.validated,
    updatedAt: '2026-08-28T21:01:00.000Z'
  });
  const inspected = await classify({
    remoteRead: readResult(remote.validated),
    acceptedRemote: accepted.validated,
    localProgramCapture: baseCapture
  });
  const memory = memoryProfile(JSON.stringify({
    version: 5,
    profileId: profileScope.profileId,
    workouts: [],
    programCapture: baseCapture
  }));
  const adopted = await recovery.adopt({
    classification: inspected,
    remote: remote.validated,
    ...memory,
    owner,
    scope: profileScope,
    envelopeApi,
    programModel: model,
    catalog
  });
  assert.equal(adopted.ok, true);
  assert.deepEqual(JSON.parse(memory.raw()).programCapture.applicationTraces, [model.normalizeCapture(baseCapture, { ...profileScope, catalog }).applicationTraces[0]]);
});

test('41 unresolved fresh-device active origin blocks the complete candidate', async () => {
  const remote = await remoteFor();
  const capture = captureFixture();
  const materialized = originApi.materializeNext({ capture, ...profileScope, catalog, materializedAt: '2026-08-28T22:00:00.000Z' });
  const broken = clone(materialized.programOrigin);
  broken.routineVersionId = 'missing-routine-version';
  const inspected = await classify({
    remoteRead: readResult(remote.validated),
    localProgramCapture: null,
    pristine: true,
    freshDevice: true,
    activeWorkout: { id: 'active', programOrigin: broken }
  });
  assert.equal(inspected.state, recovery.states.INVALID_REMOTE);
  assert.equal(inspected.reasonCode, recovery.reasonCodes.ACTIVE_ORIGIN_UNRESOLVED);
});
