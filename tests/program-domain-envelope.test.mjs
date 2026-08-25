import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

await import('../program-model.js');
await import('../program-domain-envelope.js');

const model = globalThis.BigGainsProgramModel;
const envelopeApi = globalThis.BigGainsProgramDomainEnvelope;
const scope = Object.freeze({ accountId: 'account-envelope', profileId: 'profile-envelope' });
const catalog = Object.freeze({ canonicalIdFor: value => typeof value === 'string' ? value.trim() : null });
const clone = value => structuredClone(value);

function captureFixture({ active = true } = {}) {
  let counter = 0;
  let tick = 0;
  const createId = () => `envelope-id-${String(++counter).padStart(3, '0')}`;
  const now = () => `2026-08-25T12:${String(tick++).padStart(2, '0')}:00.000Z`;
  const approve = (capture, purposeKey, label, exercises) => model.approveRoutine({
    capture,
    ...scope,
    purposeKey,
    label,
    source: { kind: 'reviewed_rebuild', routineType: label },
    exercises,
    catalog,
    createId,
    now
  });
  let capture = model.blankCapture();
  const push = approve(capture, 'push', 'Push', [
    { exerciseId: 'exercise-bench', workingSets: 3, targetReps: '6-8', restSeconds: 180 },
    { exerciseId: 'exercise-press', workingSets: 2, targetReps: '8-10', restSeconds: null }
  ]);
  capture = push.capture;
  const pull = approve(capture, 'pull', 'Pull', [
    { exerciseId: 'exercise-row', workingSets: 4, targetReps: '8-10', restSeconds: 150 }
  ]);
  capture = pull.capture;
  const draft = model.createProgramDraft({
    capture,
    ...scope,
    purposeKey: 'canonical-program',
    name: 'Canonical Program',
    slots: [push.version, pull.version].map((version, index) => ({
      label: version.label,
      preferredCalendarAnchor: { weekday: index + 1 },
      routineId: version.routineId,
      routineVersionId: version.routineVersionId
    })),
    blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
    programmingAuthority: 'review',
    priorityGoalIds: ['goal-bench-250'],
    startsOn: '2026-08-25',
    versionNote: 'Jorge-compatible synthetic fixture',
    createId,
    now
  });
  capture = active
    ? model.activateProgram({ capture: draft.capture, ...scope, programVersionId: draft.version.programVersionId, now })
    : draft.capture;
  return { capture, createId, now, push, pull, draft };
}

async function built(options = {}) {
  const fixture = captureFixture(options);
  return { ...fixture, envelope: await envelopeApi.build({ ...scope, programCapture: fixture.capture, catalog }) };
}

async function builtWithSecondProgram() {
  const fixture = captureFixture();
  const second = model.createProgramDraft({
    capture: fixture.capture,
    ...scope,
    purposeKey: 'secondary-program',
    name: 'Secondary Program',
    slots: [fixture.pull.version, fixture.push.version].map((version, index) => ({
      slotId: `secondary-slot-${2 - index}`,
      label: version.label,
      preferredCalendarAnchor: null,
      routineId: version.routineId,
      routineVersionId: version.routineVersionId
    })),
    blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 3 },
    programmingAuthority: 'off',
    startsOn: '2026-08-25',
    versionNote: 'Second stable identity fixture',
    createId: fixture.createId,
    now: fixture.now
  });
  return {
    ...fixture,
    capture: second.capture,
    envelope: await envelopeApi.build({ ...scope, programCapture: second.capture, catalog })
  };
}

async function completionEnvelope() {
  const fixture = captureFixture();
  fixture.capture.sequenceState.nextSlotIndex = 1;
  fixture.capture.sequenceState.updatedAt = '2026-08-25T13:00:00.000Z';
  const programVersionId = fixture.capture.sequenceState.programVersionId;
  const envelope = await envelopeApi.build({
    ...scope,
    programCapture: fixture.capture,
    catalog,
    revisions: { definitions: 1, heads: 1, sequence: 2 },
    lastTransition: {
      transitionId: 'transition-workout-1',
      kind: 'completion',
      before: { programVersionId, nextSlotIndex: 0, completedCycles: 0 },
      after: { programVersionId, nextSlotIndex: 1, completedCycles: 0 },
      occurredAt: '2026-08-25T13:00:00.000Z',
      workoutId: 'workout-1'
    }
  });
  return { ...fixture, envelope };
}

async function hashes(envelope, options = {}) {
  return envelopeApi.fingerprints(envelope, { ...scope, ...options });
}

function shuffleObjectKeys(value) {
  if (Array.isArray(value)) return value.map(shuffleObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).reverse().map(key => [key, shuffleObjectKeys(value[key])]));
}

async function reason(envelope, options = {}) {
  return (await envelopeApi.validate(envelope, { ...scope, ...options })).reasonCode;
}

test('empty Program domain is the exact canonical database payload', async () => {
  const envelope = await envelopeApi.build({ ...scope, programCapture: undefined });
  assert.deepEqual(envelope, {});
  assert.equal(envelopeApi.canonicalize(envelope), '{}');
  const result = await hashes(envelope);
  assert.deepEqual(result, {
    fingerprint: result.fingerprint,
    definitionsFingerprint: result.definitionsFingerprint,
    headsFingerprint: result.headsFingerprint,
    definitionsRevision: 0,
    headsRevision: 0,
    sequenceRevision: 0,
    sequenceFingerprint: result.sequenceFingerprint,
    manifest: { routines: [], routineVersions: [], programs: [], programVersions: [] }
  });
  assert.notEqual(
    result.fingerprint,
    (await envelopeApi.fingerprints(envelope, { accountId: 'another-account', profileId: scope.profileId })).fingerprint
  );
});

test('generic independent no-Program capture also maps to exact empty payload', async () => {
  const envelope = await envelopeApi.build({ ...scope, programCapture: model.blankCapture() });
  assert.deepEqual(envelope, {});
  assert.equal((await envelopeApi.validate(envelope)).ok, true);
});

test('non-empty payload exposes the fixed contract and stable component partitions', async () => {
  const { envelope } = await built();
  assert.deepEqual(Object.keys(envelope), [
    'contract', 'contractVersion', 'clientId', 'scope',
    'definitionsRevision', 'headsRevision', 'sequenceRevision',
    'definitions', 'heads', 'sequence', 'manifest'
  ]);
  assert.equal(envelope.contract, 'big-gains.program-portability-envelope.v1');
  assert.equal(envelope.contractVersion, 1);
  assert.equal(envelope.clientId, 'program-domain');
  assert.equal(envelope.definitions.routines[0].currentVersionId, undefined);
  assert.ok(envelope.heads.routines[0].currentVersionId);
  assert.equal(envelope.definitions.programs[0].status, undefined);
  assert.equal(envelope.heads.programs[0].status, 'active');
  assert.equal(envelope.sequence.lastTransition, null);
});

test('shuffled object insertion order has identical canonical JSON and fingerprints', async () => {
  const { envelope } = await built();
  const shuffled = shuffleObjectKeys(envelope);
  assert.equal(envelopeApi.canonicalize(shuffled), envelopeApi.canonicalize(envelope));
  assert.deepEqual(await hashes(shuffled), await hashes(envelope));
});

test('all stable-identity source collection traversal orders build to identical canonical bytes and fingerprints', async () => {
  const { capture, envelope } = await builtWithSecondProgram();
  const reordered = clone(capture);
  reordered.routines.reverse();
  reordered.routineVersions.reverse();
  reordered.programs.reverse();
  reordered.programVersions.reverse();
  const rebuilt = await envelopeApi.build({ ...scope, programCapture: reordered, catalog });
  assert.equal(envelopeApi.canonicalize(rebuilt), envelopeApi.canonicalize(envelope));
  assert.deepEqual(await hashes(rebuilt), await hashes(envelope));
});

test('build emits every stable-identity envelope collection in canonical order', async () => {
  const { envelope } = await builtWithSecondProgram();
  const identities = [
    [envelope.definitions.routines, value => value.routineId],
    [envelope.definitions.routineVersions, value => value.routineVersionId],
    [envelope.definitions.programs, value => value.programId],
    [envelope.definitions.programVersions, value => value.programVersionId],
    [envelope.heads.routines, value => value.routineId],
    [envelope.heads.programs, value => value.programId],
    [envelope.manifest.routines, value => value.routineId],
    [envelope.manifest.routineVersions, value => value.routineVersionId],
    [envelope.manifest.programs, value => value.programId],
    [envelope.manifest.programVersions, value => value.programVersionId]
  ];
  identities.forEach(([values, selector]) => {
    assert.deepEqual(values.map(selector), values.map(selector).toSorted());
  });
});

test('reordered definition stable-identity collections are rejected even with matching manifest order', async () => {
  const { envelope } = await builtWithSecondProgram();
  for (const key of ['routines', 'routineVersions', 'programs', 'programVersions']) {
    const invalid = clone(envelope);
    invalid.definitions[key].reverse();
    invalid.manifest[key].reverse();
    assert.equal(await reason(invalid), 'NONCANONICAL_VALUE', key);
  }
});

test('reordered head stable-identity collections are rejected', async () => {
  const { envelope } = await builtWithSecondProgram();
  for (const key of ['routines', 'programs']) {
    const invalid = clone(envelope);
    invalid.heads[key].reverse();
    assert.equal(await reason(invalid), 'NONCANONICAL_VALUE', key);
  }
});

test('reordered manifest stable-identity collections are rejected', async () => {
  const { envelope } = await builtWithSecondProgram();
  for (const key of ['routines', 'routineVersions', 'programs', 'programVersions']) {
    const invalid = clone(envelope);
    invalid.manifest[key].reverse();
    assert.equal(await reason(invalid), 'NONCANONICAL_VALUE', key);
  }
});

test('Routine prescription array order remains semantic', async () => {
  const { capture, envelope } = await built();
  const reordered = clone(capture);
  reordered.routineVersions[0].exercises.reverse();
  const rebuilt = await envelopeApi.build({ ...scope, programCapture: reordered, catalog });
  assert.notEqual((await hashes(rebuilt)).definitionsFingerprint, (await hashes(envelope)).definitionsFingerprint);
  assert.deepEqual(rebuilt.definitions.routineVersions[0].exercises.map(value => value.exerciseId), [
    'exercise-press', 'exercise-bench'
  ]);
});

test('Program slot array order remains semantic instead of being stable-identity sorted', async () => {
  const { capture } = await builtWithSecondProgram();
  const sourceVersion = capture.programVersions.find(value => value.slots.length === 2
    && value.slots[0].slotId.startsWith('secondary-slot-'));
  const envelope = await envelopeApi.build({ ...scope, programCapture: capture, catalog });
  const builtVersion = envelope.definitions.programVersions.find(value => value.programVersionId === sourceVersion.programVersionId);
  assert.deepEqual(builtVersion.slots.map(value => value.slotId), ['secondary-slot-2', 'secondary-slot-1']);
  assert.notDeepEqual(builtVersion.slots.map(value => value.slotId), builtVersion.slots.map(value => value.slotId).toSorted());
  assert.deepEqual(builtVersion.slots.map(value => value.sequence), [1, 2]);
});

test('definitions-only change affects definitions and aggregate only', async () => {
  const { capture, envelope } = await built();
  const changed = clone(capture);
  changed.programVersions[0].versionNote = 'Different immutable note';
  const rebuilt = await envelopeApi.build({ ...scope, programCapture: changed, catalog });
  const before = await hashes(envelope);
  const after = await hashes(rebuilt);
  assert.notEqual(after.definitionsFingerprint, before.definitionsFingerprint);
  assert.notEqual(after.fingerprint, before.fingerprint);
  assert.equal(after.headsFingerprint, before.headsFingerprint);
  assert.equal(after.sequenceFingerprint, before.sequenceFingerprint);
});

test('heads-only change affects heads and aggregate only', async () => {
  const { capture, envelope } = await built();
  const changed = clone(capture);
  changed.programs[0].updatedAt = '2026-08-25T13:00:00.000Z';
  const rebuilt = await envelopeApi.build({ ...scope, programCapture: changed, catalog });
  const before = await hashes(envelope);
  const after = await hashes(rebuilt);
  assert.notEqual(after.headsFingerprint, before.headsFingerprint);
  assert.notEqual(after.fingerprint, before.fingerprint);
  assert.equal(after.definitionsFingerprint, before.definitionsFingerprint);
  assert.equal(after.sequenceFingerprint, before.sequenceFingerprint);
});

test('sequence-only change affects sequence and aggregate only', async () => {
  const { capture, envelope } = await built();
  const changed = clone(capture);
  changed.sequenceState.nextSlotIndex = 1;
  changed.sequenceState.updatedAt = '2026-08-25T13:00:00.000Z';
  const rebuilt = await envelopeApi.build({ ...scope, programCapture: changed, catalog });
  const before = await hashes(envelope);
  const after = await hashes(rebuilt);
  assert.notEqual(after.sequenceFingerprint, before.sequenceFingerprint);
  assert.notEqual(after.fingerprint, before.fingerprint);
  assert.equal(after.definitionsFingerprint, before.definitionsFingerprint);
  assert.equal(after.headsFingerprint, before.headsFingerprint);
});

test('adding immutable members changes definitions and aggregate', async () => {
  const fixture = captureFixture();
  const beforeEnvelope = await envelopeApi.build({ ...scope, programCapture: fixture.capture, catalog });
  const addition = model.approveRoutine({
    capture: fixture.capture,
    ...scope,
    purposeKey: 'legs',
    label: 'Legs',
    source: { kind: 'reviewed_rebuild', routineType: 'Legs' },
    exercises: [{ exerciseId: 'exercise-squat', workingSets: 5, targetReps: '5' }],
    catalog,
    createId: fixture.createId,
    now: fixture.now
  });
  const afterEnvelope = await envelopeApi.build({ ...scope, programCapture: addition.capture, catalog });
  assert.notEqual((await hashes(afterEnvelope)).definitionsFingerprint, (await hashes(beforeEnvelope)).definitionsFingerprint);
  assert.notEqual((await hashes(afterEnvelope)).fingerprint, (await hashes(beforeEnvelope)).fingerprint);
});

test('every exact Routine-version pin resolves', async () => {
  const { envelope } = await built();
  assert.equal((await envelopeApi.validate(envelope, scope)).ok, true);
  const pins = envelope.definitions.programVersions.flatMap(value => value.slots.map(slot => slot.routineVersionId));
  assert.ok(pins.every(pin => envelope.definitions.routineVersions.some(value => value.routineVersionId === pin)));
});

test('missing Routine version is rejected as an unresolved pin', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.definitions.programVersions[0].slots[0].routineVersionId = 'missing-routine-version';
  assert.equal(await reason(invalid), 'UNRESOLVED_PIN');
});

test('duplicate Program version identity is rejected', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.definitions.programVersions.push(clone(invalid.definitions.programVersions[0]));
  assert.equal(await reason(invalid), 'DUPLICATE_IDENTITY');
});

test('duplicate Routine version identity is rejected', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.definitions.routineVersions.push(clone(invalid.definitions.routineVersions[0]));
  assert.equal(await reason(invalid), 'DUPLICATE_IDENTITY');
});

test('broken Program predecessor is rejected', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.definitions.programVersions[0].predecessorProgramVersionId = 'missing-predecessor';
  assert.equal(await reason(invalid), 'INVALID_LINEAGE');
});

test('cyclic Routine lineage is rejected', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  const first = invalid.definitions.routineVersions[0];
  const second = invalid.definitions.routineVersions[1];
  first.predecessorRoutineVersionId = second.routineVersionId;
  first.versionNumber = 2;
  second.predecessorRoutineVersionId = first.routineVersionId;
  second.versionNumber = 3;
  assert.equal(await reason(invalid), 'INVALID_LINEAGE');
});

test('invalid aggregate active pointer is rejected', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.heads.activeProgramVersionId = 'missing-program-version';
  assert.equal(await reason(invalid), 'INVALID_POINTER');
});

test('invalid next slot index is rejected', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.sequence.nextSlotIndex = invalid.definitions.programVersions[0].slots.length;
  assert.equal(await reason(invalid), 'INVALID_SEQUENCE');
});

test('negative completed-cycle count is rejected', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.sequence.completedCycles = -1;
  assert.equal(await reason(invalid), 'INVALID_SEQUENCE');
});

test('negative component revision is rejected', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.sequenceRevision = -1;
  assert.equal(await reason(invalid), 'INVALID_REVISION');
});

test('legacy sequence baseline may omit transition only at sequence revision one', async () => {
  const { envelope } = await built();
  assert.equal(envelope.sequenceRevision, 1);
  assert.equal(envelope.sequence.lastTransition, null);
  assert.equal((await envelopeApi.validate(envelope, scope)).ok, true);
  const invalid = clone(envelope);
  invalid.sequenceRevision = 2;
  assert.equal(await reason(invalid), 'INVALID_SEQUENCE');
});

test('later sequence revision requires and validates an exact completion transition', async () => {
  const { envelope } = await completionEnvelope();
  assert.equal((await envelopeApi.validate(envelope, scope)).ok, true);
  assert.equal(envelope.sequenceRevision, 2);
  assert.equal(envelope.sequence.lastTransition.kind, 'completion');
});

test('completion transition rejects null prior slot and cycle positions', async () => {
  const { envelope } = await completionEnvelope();
  for (const key of ['nextSlotIndex', 'completedCycles']) {
    const invalid = clone(envelope);
    invalid.sequence.lastTransition.before[key] = null;
    assert.equal(await reason(invalid), 'INVALID_SEQUENCE', key);
  }
});

test('completion transition rejects malformed numeric position types without coercion', async () => {
  const malformedValues = ['0', false, true, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, undefined];
  const locations = [
    ['before', (value, field, malformed) => { value.sequence.lastTransition.before[field] = malformed; }],
    ['after', (value, field, malformed) => { value.sequence.lastTransition.after[field] = malformed; }],
    ['current', (value, field, malformed) => { value.sequence[field] = malformed; }]
  ];
  for (const [location, assign] of locations) {
    for (const field of ['nextSlotIndex', 'completedCycles']) {
      for (const malformed of malformedValues) {
        const { envelope } = await completionEnvelope();
        const invalid = clone(envelope);
        assign(invalid, field, malformed);
        assert.equal(await reason(invalid), 'INVALID_SEQUENCE', `${location}.${field}: ${String(malformed)}`);
      }
    }
  }
});

test('unsupported Program authority is rejected', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.definitions.programVersions[0].programmingAuthority = 'auto';
  assert.equal(await reason(invalid), 'UNSUPPORTED_AUTHORITY');
});

test('Program Analyzer output is not serialized', async () => {
  const { capture } = captureFixture();
  capture.programAnalyzer = { status: 'derived', score: 100 };
  const envelope = await envelopeApi.build({ ...scope, programCapture: capture, catalog });
  assert.doesNotMatch(envelopeApi.canonicalize(envelope), /programAnalyzer|derived|score/);
});

test('PE proposal is not serialized', async () => {
  const { capture } = captureFixture();
  capture.programmingProposal = { proposalId: 'proposal-local-only' };
  const envelope = await envelopeApi.build({ ...scope, programCapture: capture, catalog });
  assert.doesNotMatch(envelopeApi.canonicalize(envelope), /proposal-local-only|programmingProposal/);
});

test('application traces remain excluded from synchronized payload', async () => {
  const { capture } = captureFixture();
  capture.applicationTraces = [{ applicationId: 'trace-local-only' }];
  const envelope = await envelopeApi.build({ ...scope, programCapture: capture, catalog });
  assert.doesNotMatch(envelopeApi.canonicalize(envelope), /applicationTraces|trace-local-only/);
});

test('validator rejects prohibited derived or local-only fields in an envelope', async () => {
  const { envelope } = await built();
  for (const key of ['programAnalyzer', 'programmingProposal', 'applicationTraces']) {
    const invalid = clone(envelope);
    invalid[key] = {};
    assert.equal(await reason(invalid), 'MALFORMED_PAYLOAD');
  }
});

test('Jorge-compatible synthetic Program fixture is deterministic', async () => {
  const first = await built();
  const second = await built();
  assert.equal(envelopeApi.canonicalize(first.envelope), envelopeApi.canonicalize(second.envelope));
  assert.deepEqual(await hashes(first.envelope), await hashes(second.envelope));
});

test('all aggregate, component, and member fingerprints are lowercase SHA-256 hex', async () => {
  const { envelope } = await built();
  const result = await hashes(envelope);
  const all = [
    result.fingerprint,
    result.definitionsFingerprint,
    result.headsFingerprint,
    result.sequenceFingerprint,
    ...Object.values(result.manifest).flat().map(value => value.fingerprint)
  ];
  assert.ok(all.length > 4);
  assert.ok(all.every(value => /^[0-9a-f]{64}$/.test(value)));
});

test('reload-equivalent source clones produce identical bytes and fingerprints', async () => {
  const { capture } = captureFixture();
  const first = await envelopeApi.build({ ...scope, programCapture: capture, catalog });
  const second = await envelopeApi.build({ ...scope, programCapture: JSON.parse(JSON.stringify(capture)), catalog });
  assert.equal(envelopeApi.canonicalize(first), envelopeApi.canonicalize(second));
  assert.deepEqual(await hashes(first), await hashes(second));
});

test('JSON round-trip preserves validation, canonical bytes, and fingerprints', async () => {
  const { envelope } = await built();
  const roundTrip = JSON.parse(envelopeApi.canonicalize(envelope));
  assert.equal((await envelopeApi.validate(roundTrip, scope)).ok, true);
  assert.equal(envelopeApi.canonicalize(roundTrip), envelopeApi.canonicalize(envelope));
  assert.deepEqual(await hashes(roundTrip), await hashes(envelope));
});

test('legacy-compatible normalized values serialize without mutating source', async () => {
  const { capture } = captureFixture();
  const legacy = clone(capture);
  legacy.routineVersions[0].versionNumber = '1';
  legacy.routineVersions[0].exercises[0].workingSets = '3';
  legacy.routineVersions[0].createdAt = legacy.routineVersions[0].createdAt.replace('.000Z', 'Z');
  legacy.sequenceState.nextSlotIndex = '0';
  legacy.sequenceState.completedCycles = '0';
  const before = JSON.stringify(legacy);
  const envelope = await envelopeApi.build({ ...scope, programCapture: legacy, catalog });
  assert.equal((await envelopeApi.validate(envelope, scope)).ok, true);
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(envelope.definitions.routineVersions[0].versionNumber, 1);
  assert.equal(envelope.sequence.nextSlotIndex, 0);
});

test('ordinary build leaves canonical source deep-equal', async () => {
  const { capture } = captureFixture();
  const before = clone(capture);
  await envelopeApi.build({ ...scope, programCapture: capture, catalog });
  assert.deepEqual(capture, before);
});

test('non-finite semantic numeric data is rejected', async () => {
  const { capture } = captureFixture();
  capture.routineVersions[0].versionNumber = Number.POSITIVE_INFINITY;
  await assert.rejects(
    envelopeApi.build({ ...scope, programCapture: capture, catalog }),
    error => error.reasonCode === 'NONCANONICAL_VALUE'
  );
});

test('undefined and function values in semantic fields are rejected', async () => {
  for (const invalidValue of [undefined, () => true]) {
    const { capture } = captureFixture();
    capture.programVersions[0].versionNote = invalidValue;
    await assert.rejects(
      envelopeApi.build({ ...scope, programCapture: capture, catalog }),
      error => error.reasonCode === 'NONCANONICAL_VALUE'
    );
  }
});

test('account/profile mismatch inputs fail closed', async () => {
  const { capture } = captureFixture();
  await assert.rejects(
    envelopeApi.build({ accountId: 'different-account', profileId: scope.profileId, programCapture: capture, catalog }),
    error => error.reasonCode === 'PROFILE_SCOPE_MISMATCH'
  );
  const envelope = await envelopeApi.build({ ...scope, programCapture: capture, catalog });
  assert.equal((await envelopeApi.validate(envelope, { ...scope, profileId: 'different-profile' })).reasonCode, 'PROFILE_SCOPE_MISMATCH');
});

test('manifest disagreement fails validation rather than being silently regenerated', async () => {
  const { envelope } = await built();
  const invalid = clone(envelope);
  invalid.manifest.programVersions[0].fingerprint = '0'.repeat(64);
  assert.equal(await reason(invalid), 'MANIFEST_MISMATCH');
});

test('canonicalizer rejects undefined, functions, sparse arrays, prototypes, and nonfinite numbers', () => {
  for (const invalid of [undefined, () => true, Number.NaN, Number.POSITIVE_INFINITY, new Date(), Object.create({ inherited: true })]) {
    assert.throws(() => envelopeApi.canonicalize(invalid), error => error.reasonCode === 'NONCANONICAL_VALUE');
  }
  const sparse = [];
  sparse[1] = 'value';
  assert.throws(() => envelopeApi.canonicalize(sparse), error => error.reasonCode === 'NONCANONICAL_VALUE');
});

test('pure module owns no DOM, network, storage, queue, cloud, or Supabase behavior', async () => {
  const source = await readFile(new URL('../program-domain-envelope.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bdocument\b|localStorage|sessionStorage|indexedDB|XMLHttpRequest|\bfetch\s*\(|\bsupabase\b|enqueue|put_program_domain_guarded/i);
});
