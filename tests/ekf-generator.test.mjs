import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadInputs, renderArtifacts, validateInputs } from '../scripts/generate-exercise-catalog.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const clone = value => structuredClone(value);

await import('../exercise-catalog.js');

test('EKF-T01: every legacy ID, canonical ID, name, and alias resolves to one owner', async () => {
  const inputs = await loadInputs(repository);
  const validated = validateInputs(inputs);
  const identity = globalThis.BigGainsExerciseIdentity;
  const catalog = globalThis.BigGainsExerciseCatalog;

  assert.equal(validated.records.length, 155);
  assert.equal(validated.legacyOwners.size, 155);
  assert.equal(new Set(validated.records.map(record => record.id)).size, 155);
  for (const record of validated.records) {
    assert.equal(identity.canonicalIdFor(record.compatibility.legacyId), record.id);
    assert.equal(identity.canonicalIdFor(record.id), record.id);
    assert.equal(identity.compatibilityForCanonicalId(record.id)?.id, record.compatibility.legacyId);
    for (const term of [record.canonicalName, ...record.aliases]) {
      assert.equal(identity.resolveCanonicalId(term), record.id, term);
      assert.equal(catalog.resolve(term)?.id, record.compatibility.legacyId, term);
    }
  }
});

test('EKF-T02/T03: identity lookup accepts persisted definitionId without rewriting instance identity', () => {
  const identity = globalThis.BigGainsExerciseIdentity;
  const historical = { id: 'retrospective-instance-id', definitionId: 'barbell-bench-press', name: 'Historical name' };
  const before = JSON.stringify(historical);
  const canonicalId = identity.canonicalIdFor(historical);

  assert.match(canonicalId, /^[0-9a-f-]{36}$/);
  assert.equal(identity.compatibilityForCanonicalId(canonicalId)?.id, 'barbell-bench-press');
  assert.equal(JSON.stringify(historical), before);
});

test('EKF-T16: generation is byte-stable and checked-in artifacts are current', async () => {
  const inputs = await loadInputs(repository);
  const first = renderArtifacts(inputs);
  const second = renderArtifacts(clone(inputs));
  const [catalog, legacyIndex] = await Promise.all([
    readFile(path.join(repository, 'exercise-catalog.js'), 'utf8'),
    readFile(path.join(repository, 'ekf', 'compatibility', 'legacy-exercise-ids.json'), 'utf8')
  ]);

  assert.equal(first.catalog, second.catalog);
  assert.equal(first.legacyIndex, second.legacyIndex);
  assert.equal(catalog, first.catalog);
  assert.equal(legacyIndex, first.legacyIndex);
});

test('EKF-2.4: changing a display name does not change canonical or legacy identity', async () => {
  const inputs = await loadInputs(repository);
  const changed = clone(inputs);
  const original = changed.exercises.exercises[0];
  const canonicalId = original.id;
  const legacyIds = [...original.legacyIds];
  original.canonicalName = 'Renamed Compatibility Press';

  const artifacts = renderArtifacts(changed);
  assert.equal(artifacts.validated.records[0].id, canonicalId);
  assert.deepEqual(artifacts.validated.records[0].legacyIds, legacyIds);
  assert.match(artifacts.catalog, /"name": "Renamed Compatibility Press"/);
});

test('EKF-T14/T16: invalid identities, aliases, references, and required fields fail closed', async t => {
  const baseline = await loadInputs(repository);
  const invalidCases = [
    ['duplicate canonical IDs', input => { input.exercises.exercises[1].id = input.exercises.exercises[0].id; }, /duplicate canonical exercise ID/],
    ['duplicate legacy IDs', input => { input.exercises.exercises[1].legacyIds.push(input.exercises.exercises[0].legacyIds[0]); }, /duplicate or recycled legacy exercise ID/],
    ['broken family references', input => { input.exercises.exercises[0].familyId = '00000000-0000-4000-8000-000000000000'; }, /broken family reference/],
    ['broken variant references', input => { input.exercises.exercises[0].variantOf = '00000000-0000-4000-8000-000000000000'; }, /broken variant reference/],
    ['malformed aliases', input => { input.exercises.exercises[0].aliases.push(''); }, /aliases\[0\] must be non-empty/],
    ['ambiguous aliases', input => { input.exercises.exercises[1].aliases.push(input.exercises.exercises[0].canonicalName); }, /ambiguous normalized term/],
    ['unresolved required compatibility fields', input => { delete input.exercises.exercises[0].compatibility.equipment; }, /compatibility\.equipment must be non-empty/]
  ];

  for (const [name, mutate, expected] of invalidCases) {
    await t.test(name, () => {
      const input = clone(baseline);
      mutate(input);
      assert.throws(() => renderArtifacts(input), expected);
    });
  }
});

test('EKF-T12/T16: missing, duplicate, unknown, and cross-field-invalid measurement contracts fail closed', async t => {
  const baseline = await loadInputs(repository);
  const invalidCases = [
    ['missing contract', input => { input.measurements.contracts.pop(); }, /every exercise requires exactly one measurement contract/],
    ['duplicate contract', input => { input.measurements.contracts.push(clone(input.measurements.contracts[0])); }, /duplicate measurement contract/],
    ['unknown tracking model', input => { input.measurements.contracts[0].measurement.trackingModel = 'unknown'; }, /trackingModel must be explicit/],
    ['load basis mismatch', input => { input.measurements.contracts[0].measurement.loadSemantics.loadBasis = 'not_applicable'; }, /load basis does not match tracking model/],
    ['machine e1RM', input => { input.measurements.contracts[0].analytics = { e1rmPermitted: true, e1rmLoadBasis: 'entered_load' }; }, /resistance semantics are ineligible for e1RM/]
  ];
  for (const [name, mutate, expected] of invalidCases) await t.test(name, () => {
    const input = clone(baseline);
    mutate(input);
    assert.throws(() => renderArtifacts(input), expected);
  });
});

test('EKF-13.2/13.3: identity defaults stay inactive while the EKF-2 overlay owns measurement semantics', async () => {
  const inputs = await loadInputs(repository);
  const defaults = inputs.exercises.canonicalDefaults;

  assert.equal(defaults.measurement.trackingModel, 'unknown');
  assert.deepEqual(defaults.measurement.loadSemantics, { loadBasis: 'unknown', resistanceSemantics: 'unknown' });
  assert.equal(defaults.measurement.repSemantics, 'unknown');
  assert.deepEqual(defaults.analytics, { e1rmPermitted: false, e1rmLoadBasis: null });
});
