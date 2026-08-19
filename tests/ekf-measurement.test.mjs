import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadInputs, renderArtifacts, validateInputs } from '../scripts/generate-exercise-catalog.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));

await import('../exercise-catalog.js');
await import('../analytics.js');

const catalog = globalThis.BigGainsExerciseCatalog;
const analytics = globalThis.BigGainsAnalytics;
const completed = (weight, reps, extra = {}) => ({ id: crypto.randomUUID(), weight, reps, completed: true, warmup: false, ...extra });
const exercise = (id, sets) => ({ ...catalog.getById(id), sets });

test('EKF-T04/T05: all 155 exercises publish explicit measurement contracts and a byte-stable audit', async () => {
  const inputs = await loadInputs(repository);
  const validated = validateInputs(inputs);
  const artifacts = renderArtifacts(inputs);
  const audit = await readFile(new URL('../ekf/audit/measurement-contracts.md', import.meta.url), 'utf8');

  assert.equal(validated.records.length, 155);
  assert.equal(validated.measurementOwners.size, 155);
  assert.equal(catalog.exercises.length, 155);
  for (const definition of catalog.exercises) {
    const contract = catalog.measurementFor(definition);
    assert.ok(contract, definition.id);
    assert.notEqual(contract.trackingModel, 'unknown', definition.id);
    assert.notEqual(contract.loadSemantics.loadBasis, 'unknown', definition.id);
    assert.notEqual(contract.loadSemantics.resistanceSemantics, 'unknown', definition.id);
  }
  assert.equal(audit, artifacts.measurementAudit);
  assert.equal((audit.match(/^\| `[^`]+` \|/gm) || []).length, 155);
  assert.equal(catalog.measurementFor('dumbbell-bench-press').loadSemantics.loadBasis, 'per_hand');
  assert.equal(catalog.measurementFor('seated-iso-lateral-bench-press').loadSemantics.loadBasis, 'per_side');
});

test('EKF-T04: iso-lateral 120 per side remains 120 entered and yields 5,760 over three sets', () => {
  const source = exercise('iso-machine-shoulder-press', [completed(120, 8), completed(120, 8), completed(120, 8)]);
  const summary = analytics.setSummary(source);
  assert.equal(summary.workingSets[0].enteredLoad, 120);
  assert.equal(summary.workingSets[0].combinedIndicatedLoad, 240);
  assert.equal(summary.indicatedLoadVolume, 5760);
  assert.equal(summary.externalLoadVolume, null);
  assert.equal(source.sets[0].weight, 120);
});

test('EKF-T04/T05: dumbbell per-hand doubles bilateral load while total selectorized load does not', () => {
  const dumbbell = analytics.metricsForSet(completed(70, 10), { exercise: catalog.getById('incline-dumbbell-press') });
  const machine = analytics.metricsForSet(completed(180, 10), { exercise: catalog.getById('seated-machine-chest-press') });
  assert.deepEqual([dumbbell.enteredLoad, dumbbell.combinedExternalLoad, dumbbell.externalLoadVolume], [70, 140, 1400]);
  assert.deepEqual([machine.enteredLoad, machine.combinedIndicatedLoad, machine.indicatedLoadVolume], [180, 180, 1800]);
  assert.equal(machine.externalLoadVolume, null);
});

test('EKF-T06: unilateral per-side reps expand events; alternating total reps do not double', () => {
  const cable = analytics.metricsForSet(completed(70, 10), { exercise: catalog.getById('one-arm-cable-row') });
  const alternating = analytics.metricsForSet(completed(25, 12), { measurement: {
    trackingModel: 'load_reps', laterality: 'alternating',
    loadSemantics: { loadBasis: 'per_hand', resistanceSemantics: 'external' },
    repSemantics: 'alternating_total', bodyweightModel: null,
    analytics: { e1rmPermitted: false, e1rmLoadBasis: null }
  } });
  assert.deepEqual([cable.repEventCount, cable.indicatedLoadVolume], [20, 1400]);
  assert.deepEqual([alternating.repEventCount, alternating.combinedExternalLoad, alternating.externalLoadVolume], [12, 25, 300]);
});

test('EKF-T06/T10: unilateral leg press does not double load and remains machine-indicated', () => {
  const metrics = analytics.metricsForSet(completed(180, 10), { exercise: catalog.getById('single-leg-press') });
  assert.equal(metrics.loadUnitsPerEvent, 1);
  assert.equal(metrics.repEventCount, 20);
  assert.equal(metrics.indicatedLoadVolume, 3600);
  assert.equal(metrics.externalLoadVolume, null);
  assert.equal(metrics.estimated1RM, null);
});

test('EKF-T07/T08: bodyweight and assistance require known context without rewriting entered load', () => {
  const pullUp = catalog.getById('pull-up');
  const assisted = catalog.getById('assisted-pull-up');
  const known = analytics.metricsForSet(completed(25, 6), { exercise: pullUp, bodyweight: 180 });
  const missing = analytics.metricsForSet(completed(25, 6), { exercise: pullUp });
  const assistedKnown = analytics.metricsForSet(completed(60, 8), { exercise: assisted, bodyweight: 180 });
  const assistedMissing = analytics.metricsForSet(completed(60, 8), { exercise: assisted });
  assert.deepEqual([known.enteredLoad, known.effectiveSystemLoad, known.externalLoadVolume, known.effectiveSystemLoadVolume], [25, 205, 150, 1230]);
  assert.equal(known.estimated1RM, 246);
  assert.deepEqual([missing.enteredLoad, missing.effectiveSystemLoad, missing.effectiveSystemLoadVolume, missing.estimated1RM], [25, null, null, null]);
  assert.deepEqual([assistedKnown.effectiveSystemLoad, assistedKnown.effectiveSystemLoadVolume, assistedKnown.externalLoadVolume], [120, 960, null]);
  assert.deepEqual([assistedMissing.effectiveSystemLoad, assistedMissing.effectiveSystemLoadVolume], [null, null]);
});

test('EKF-T09/T11: push-up, carry, sled, and plank use their own eligible quantities', () => {
  const pushUp = analytics.metricsForSet(completed(0, 20), { exercise: catalog.getById('push-up'), bodyweight: 180 });
  const carry = analytics.metricsForSet(completed(60, 0, { distance: 100 }), { exercise: catalog.getById('farmer-carry') });
  const plank = analytics.metricsForSet(completed(0, 0, { duration: 60 }), { exercise: catalog.getById('plank') });
  const sled = analytics.metricsForSet(completed(180, 0, { distance: 50 }), { measurement: {
    trackingModel: 'load_distance', laterality: 'not_applicable',
    loadSemantics: { loadBasis: 'total', resistanceSemantics: 'machine_indicated' },
    repSemantics: 'not_applicable', bodyweightModel: null,
    analytics: { e1rmPermitted: false, e1rmLoadBasis: null }
  } });
  assert.deepEqual([pushUp.repEventCount, pushUp.externalLoadVolume, pushUp.effectiveSystemLoad, pushUp.estimated1RM], [20, null, null, null]);
  assert.deepEqual([carry.combinedExternalLoad, carry.externalLoadDistance, carry.externalLoadVolume, carry.estimated1RM], [120, 12000, null, null]);
  assert.deepEqual([sled.indicatedLoadDistance, sled.externalLoadDistance, sled.estimated1RM], [9000, null, null]);
  assert.deepEqual([plank.duration, plank.volume, plank.estimated1RM], [60, null, null]);
});

test('EKF-3: new machine, unilateral, sled, erg, and timed records preserve their explicit quantities', () => {
  const highRow = analytics.metricsForSet(completed(90, 8), { exercise: catalog.getById('plate-loaded-high-row') });
  const legExtension = analytics.metricsForSet(completed(70, 10), { exercise: catalog.getById('single-leg-leg-extension') });
  const sled = analytics.metricsForSet(completed(180, 0, { distance: 50 }), { exercise: catalog.getById('sled-push') });
  const bike = analytics.metricsForSet(completed(0, 0, { distance: 2.5, duration: 600 }), { exercise: catalog.getById('air-bike') });
  const ropes = analytics.metricsForSet(completed(0, 0, { duration: 45 }), { exercise: catalog.getById('battle-rope-waves') });
  assert.deepEqual([highRow.enteredLoad, highRow.combinedIndicatedLoad, highRow.indicatedLoadVolume, highRow.estimated1RM], [90, 180, 1440, null]);
  assert.deepEqual([legExtension.repEventCount, legExtension.indicatedLoadVolume, legExtension.estimated1RM], [20, 1400, null]);
  assert.deepEqual([sled.indicatedLoadDistance, sled.externalLoadDistance], [9000, null]);
  assert.deepEqual([bike.distance, bike.duration, bike.volume], [2.5, 600, null]);
  assert.deepEqual([ropes.duration, ropes.volume, ropes.estimated1RM], [45, null, null]);
});

test('EKF-T12: Epley results identify formula, release semantics, and eligibility failures', () => {
  const eligible = analytics.metricsForSet(completed(100, 10), { exercise: catalog.getById('barbell-bench-press') });
  const tooManyReps = analytics.metricsForSet(completed(100, 13), { exercise: catalog.getById('barbell-bench-press') });
  const machine = analytics.metricsForSet(completed(100, 10), { exercise: catalog.getById('machine-shoulder-press') });
  assert.equal(eligible.estimated1RM, 133);
  assert.deepEqual(eligible.e1rm, {
    value: 133,
    formulaId: 'epley',
    formulaVersion: 1,
    canonicalExerciseId: catalog.canonicalIdFor('barbell-bench-press'),
    contentRevision: 2,
    loadBasis: 'combined_external_load',
    quality: 'exact_arithmetic'
  });
  assert.equal(tooManyReps.estimated1RM, null);
  assert.equal(machine.estimated1RM, null);
});

test('EKF-T13: primary workload and secondary exposure remain separate without fractional credit', () => {
  const workout = { completedAt: '2026-08-18T12:00:00.000Z', exercises: [exercise('dips', [completed(0, 10)])] };
  const totals = analytics.muscleTotals([workout], { bodyweight: 180 });
  assert.equal(totals.primary.Chest.workingSets, 1);
  assert.equal(totals.secondary.Triceps.workingSets, 1);
  assert.equal(totals.primary.Triceps, undefined);
  assert.equal(totals.stabilizer, undefined);
});
