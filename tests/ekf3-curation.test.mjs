import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { generate as checkCuration } from '../scripts/generate-ekf3-curation.mjs';
import { loadInputs, validateInputs } from '../scripts/generate-exercise-catalog.mjs';

const repository = fileURLToPath(new URL('../', import.meta.url));
const readJson = async relative => JSON.parse(await readFile(new URL(`../${relative}`, import.meta.url), 'utf8'));

await import('../exercise-catalog.js');
const catalog = globalThis.BigGainsExerciseCatalog;

test('EKF-3: all accepted EKF-2 identities, aliases, mappings, and measurement contracts remain byte-equivalent data', async () => {
  const [baseline, inputs] = await Promise.all([readJson('ekf/compatibility/ekf-2-baseline.json'), loadInputs(repository)]);
  assert.equal(baseline.sourceCommit, '50acb63e10f4380e8ef6799fe16596fbad33b95d');
  assert.equal(baseline.records.length, 119);
  const contracts = new Map(inputs.measurements.contracts.map(contract => [contract.exerciseId, contract]));
  for (const expected of baseline.records) {
    const actual = inputs.exercises.exercises.find(record => record.id === expected.canonicalId);
    assert.ok(actual, expected.canonicalId);
    assert.deepEqual({
      canonicalId: actual.id,
      legacyIds: actual.legacyIds,
      canonicalName: actual.canonicalName,
      aliases: actual.aliases,
      slug: actual.slug,
      familyId: actual.familyId,
      variantOf: actual.variantOf,
      measurementContract: contracts.get(actual.id)
    }, expected);
  }
});

test('EKF-3: curation is deterministic and decision counts remain explicit', async () => {
  assert.deepEqual(await checkCuration({ root: repository, check: true }), { reviewed: 58, accepted: 36, added: 36 });
  const candidates = await readJson('ekf/curation/ekf-3-candidates.json');
  assert.deepEqual(candidates.summary, { reviewed: 58, accepted: 36, rejected: 12, human_review: 5, quarantined: 5 });
  assert.equal(candidates.candidates.length, 58);
  assert.equal(candidates.candidates.filter(record => record.decision === 'human_review').length, 5);
});

test('EKF-3: external provenance and rights are complete while quarantine and media stay outside release artifacts', async () => {
  const [references, candidates, additions, sourceLock] = await Promise.all([
    readJson('ekf/curated/ekf-3-references.json'),
    readJson('ekf/curation/ekf-3-candidates.json'),
    readJson('ekf/curated/ekf-3-exercises.json'),
    readJson('ekf/source-lock.json')
  ]);
  const external = references.provenance.filter(record => record.kind === 'external_structured_assertion');
  assert.equal(external.length, 24);
  for (const record of external) {
    for (const field of ['sourceRegistryId', 'sourceSnapshotId', 'sourceNativeRecordId', 'retrievedAt', 'importerVersion', 'assertionMethod', 'licenseExpression', 'attributionRequirements', 'rightsStatus', 'sourceLineage', 'reviewStatus', 'confidence', 'sourcePayloadSha256']) assert.ok(record[field], `${record.id}.${field}`);
    assert.equal(record.licenseExpression, 'Unlicense');
    assert.equal(record.rightsStatus, 'approved');
  }
  assert.equal(sourceLock.snapshots.find(record => record.sourceRegistryId === 'free-exercise-db').commit, 'b0eed061e1c832b3ed815fbaa4b45b3cdc14df49');
  const releasedText = JSON.stringify({ references, additions });
  for (const record of candidates.candidates.filter(record => record.decision === 'quarantined')) {
    assert.equal(record.licenseExpression, 'CC-BY-SA-4.0');
    assert.equal(record.rightsStatus, 'quarantined');
    assert.equal(releasedText.includes(record.sourceNativeRecordId), false);
  }
  assert.equal(/"(?:image|video|instructions?)"\s*:/i.test(releasedText), false);
});

test('EKF-3: every new opaque identity has complete semantics and valid family/variant references', async () => {
  const inputs = await loadInputs(repository);
  const validated = validateInputs(inputs);
  const newRecords = validated.records.slice(119);
  assert.equal(newRecords.length, 36);
  assert.equal(new Set(newRecords.map(record => record.id)).size, 36);
  for (const record of newRecords) {
    assert.match(record.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(record.measurement.trackingModel, 'unknown');
    assert.notEqual(record.measurement.loadSemantics.loadBasis, 'unknown');
    assert.notEqual(record.measurement.loadSemantics.resistanceSemantics, 'unknown');
    assert.notEqual(record.measurement.repSemantics, 'unknown');
    assert.notEqual(record.laterality, 'unknown');
    assert.ok(record.muscles.assertions.some(assertion => assertion.role === 'primary'));
    assert.ok(record.equipment.assertions.length);
    assert.ok(record.provenanceRefs.length);
    assert.ok(record.rightsRefs.length);
  }
});

test('EKF-3: common gym-language aliases resolve and cards expose exercise-aware fields', () => {
  assert.equal(catalog.resolve('hammer strength high row').id, 'plate-loaded-high-row');
  assert.equal(catalog.resolve('hip thrust machine').id, 'glute-drive-machine');
  assert.equal(catalog.resolve('assault bike').id, 'air-bike');
  assert.equal(catalog.resolve('single arm cable pulldown').id, 'single-arm-lat-pulldown');
  assert.deepEqual(catalog.inputFieldsFor('plate-loaded-high-row').map(field => field.label), ['Weight per side', 'Reps']);
  assert.deepEqual(catalog.inputFieldsFor('single-leg-leg-extension').map(field => field.label), ['Machine weight', 'Reps per side']);
  assert.deepEqual(catalog.inputFieldsFor('sled-push').map(field => field.label), ['Sled load', 'Distance']);
  assert.deepEqual(catalog.inputFieldsFor('air-bike').map(field => field.label), ['Distance', 'Duration']);
  assert.deepEqual(catalog.inputFieldsFor('battle-rope-waves').map(field => field.label), ['Duration']);
});

test('EKF-3: ambiguous candidates are not silently merged into canonical identities', async () => {
  const candidates = await readJson('ekf/curation/ekf-3-candidates.json');
  const unresolved = candidates.candidates.filter(record => record.decision === 'human_review');
  assert.equal(unresolved.every(record => record.canonicalId === null && record.reviewStatus === 'unresolved'), true);
  assert.equal(catalog.resolve('Leverage Iso Row'), null);
  assert.equal(catalog.resolve('Smith Machine Stiff-Legged Deadlift'), null);
});
