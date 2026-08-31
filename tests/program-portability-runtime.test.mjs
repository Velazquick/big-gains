import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

await import('../program-portability.js');

const runtime = globalThis.BigGainsProgramPortability;

function sequence(programVersionId, nextSlotIndex, completedCycles, updatedAt, lastTransition = null) {
  return { programId: 'program-1', programVersionId, nextSlotIndex, completedCycles, updatedAt, lastTransition };
}

function capture(programVersionId, nextSlotIndex, completedCycles, updatedAt, predecessorProgramVersionId = null) {
  return {
    sequenceState: { programId: 'program-1', programVersionId, nextSlotIndex, completedCycles, updatedAt },
    programVersions: [{
      programId: 'program-1', programVersionId, predecessorProgramVersionId,
      slots: [{ slotId: 'slot-1' }, { slotId: 'slot-2' }]
    }]
  };
}

test('capability is exact, versioned, and fail-closed', () => {
  assert.deepEqual(runtime.capability({}), { enabled: false, version: null, reason: 'capability-disabled' });
  assert.deepEqual(runtime.capability({ programPortability: true }), { enabled: false, version: null, reason: 'capability-disabled' });
  assert.deepEqual(runtime.capability({ programPortability: true, programPortabilityVersion: 2 }), { enabled: false, version: null, reason: 'capability-disabled' });
  assert.deepEqual(runtime.capability({ programPortability: true, programPortabilityVersion: 1 }), { enabled: true, version: 1, reason: null });
});

test('unchanged sequence preserves the accepted transition identity', () => {
  const accepted = {
    transitionId: 'accepted-transition', kind: 'completion', occurredAt: '2036-08-10T12:00:00.000Z', workoutId: 'workout-0',
    before: { programVersionId: 'program-v1', nextSlotIndex: 0, completedCycles: 0 },
    after: { programVersionId: 'program-v1', nextSlotIndex: 1, completedCycles: 0 }
  };
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: sequence('program-v1', 1, 0, '2036-08-10T12:00:00.000Z', accepted) },
    afterCapture: capture('program-v1', 1, 0, '2036-08-10T12:00:00.000Z')
  });
  assert.equal(result.ok, true);
  assert.equal(result.changed, false);
  assert.deepEqual(result.lastTransition, accepted);
});

test('activation transition is derived only from the exact initial position', () => {
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: null },
    afterCapture: capture('program-v1', 0, 0, '2036-08-10T12:00:00.000Z')
  });
  assert.equal(result.ok, true);
  assert.equal(result.lastTransition.kind, 'activation');
  assert.equal(result.lastTransition.before.programVersionId, null);
  assert.equal(result.lastTransition.workoutId, null);
});

test('successor carry transition requires immutable predecessor lineage and unchanged position', () => {
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: sequence('program-v1', 1, 2, '2036-08-09T12:00:00.000Z') },
    afterCapture: capture('program-v2', 1, 2, '2036-08-10T12:00:00.000Z', 'program-v1')
  });
  assert.equal(result.ok, true);
  assert.equal(result.lastTransition.kind, 'successor_carry');
  assert.equal(result.lastTransition.before.programVersionId, 'program-v1');
  assert.equal(result.lastTransition.after.programVersionId, 'program-v2');
});

test('completion transition requires the exact frozen Program-origin workout', () => {
  const occurredAt = '2036-08-10T12:00:00.000Z';
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: sequence('program-v1', 1, 2, '2036-08-09T12:00:00.000Z') },
    afterCapture: capture('program-v1', 0, 3, occurredAt),
    workouts: [{
      id: 'workout-1', completedAt: occurredAt,
      programOrigin: { programVersionId: 'program-v1', slotIndex: 1, cycleNumber: 3 }
    }]
  });
  assert.equal(result.ok, true);
  assert.equal(result.lastTransition.kind, 'completion');
  assert.equal(result.lastTransition.workoutId, 'workout-1');
});

test('unprovable sequence movement stops without inventing a transition', () => {
  const result = runtime.deriveTransition({
    beforeEnvelope: { sequence: sequence('program-v1', 0, 0, '2036-08-09T12:00:00.000Z') },
    afterCapture: capture('program-v1', 1, 0, '2036-08-10T12:00:00.000Z'),
    workouts: []
  });
  assert.deepEqual(result, { ok: false, changed: true, reasonCode: 'PROGRAM_TRANSITION_UNPROVABLE' });
});

test('queued revisions are strictly newer than their accepted base without rewriting transition time', () => {
  assert.equal(runtime.operationTimestamp('2036-08-10T12:00:00.000Z', {
    changed: true,
    lastTransition: { occurredAt: '2036-08-10T12:00:01.000Z' }
  }, Date.parse('2036-08-10T12:00:02.000Z')), '2036-08-10T12:00:01.000Z');
  assert.equal(runtime.operationTimestamp('2036-08-10T12:00:00.000Z', {
    changed: false,
    lastTransition: null
  }, Date.parse('2036-08-10T11:59:59.000Z')), '2036-08-10T12:00:00.001Z');
});

test('runtime assets and deployment config are attached without exposing fingerprints in ordinary UI copy', async () => {
  const [manifest, workflow, configWriter, html, source] = await Promise.all([
    readFile(new URL('../asset-manifest.js', import.meta.url), 'utf8'),
    readFile(new URL('../.github/workflows/deploy-pages.yml', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/write-cloud-config.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../program-portability.js', import.meta.url), 'utf8')
  ]);
  for (const asset of ['program-domain-envelope.js', 'program-domain-sync.js', 'program-domain-recovery.js', 'program-domain-cutover.js', 'program-portability.js']) {
    assert.match(manifest, new RegExp(asset.replace('.', '\\.')));
    assert.match(workflow, new RegExp(asset.replace('.', '\\.')));
  }
  assert.match(configWriter, /BIG_GAINS_PROGRAM_PORTABILITY/);
  assert.match(configWriter, /programPortabilityVersion/);
  assert.match(html, /id="programPortabilityStatus"/);
  assert.doesNotMatch(source, /Revision [${}]/);
  assert.doesNotMatch(source, /Fingerprint [${}]/);
});
