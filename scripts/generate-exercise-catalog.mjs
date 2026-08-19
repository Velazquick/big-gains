import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderCatalogRuntime } from './render-exercise-catalog.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LEGACY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GENERATED_CATALOG = 'exercise-catalog.js';
const GENERATED_LEGACY_INDEX = path.join('ekf', 'compatibility', 'legacy-exercise-ids.json');
const GENERATED_MEASUREMENT_AUDIT = path.join('ekf', 'audit', 'measurement-contracts.md');

function fail(message) {
  throw new Error(`EKF generation failed: ${message}`);
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonempty(value, field) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) fail(`${field} must be non-empty, trimmed text`);
  return value;
}

function unique(values, label) {
  const seen = new Set();
  values.forEach(value => {
    if (seen.has(value)) fail(`duplicate ${label}: ${value}`);
    seen.add(value);
  });
  return seen;
}

export function normalizeTerm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function validateReferences(references) {
  if (!isObject(references) || references.schemaVersion !== 1) fail('references.json must use schemaVersion 1');
  if (!Array.isArray(references.provenance) || !Array.isArray(references.rights)) fail('references.json must define provenance and rights arrays');
  const provenanceIds = unique(references.provenance.map((entry, index) => nonempty(entry?.id, `provenance[${index}].id`)), 'provenance ID');
  const rightsIds = unique(references.rights.map((entry, index) => nonempty(entry?.id, `rights[${index}].id`)), 'rights ID');
  references.provenance.forEach((entry, index) => {
    if (!isObject(entry)) fail(`provenance[${index}] must be an object`);
    nonempty(entry.kind, `provenance[${index}].kind`);
    nonempty(entry.sourceName, `provenance[${index}].sourceName`);
    nonempty(entry.snapshotVersion, `provenance[${index}].snapshotVersion`);
    nonempty(entry.description, `provenance[${index}].description`);
  });
  references.rights.forEach((entry, index) => {
    if (!isObject(entry)) fail(`rights[${index}] must be an object`);
    nonempty(entry.kind, `rights[${index}].kind`);
    if (entry.rightsStatus !== 'approved') fail(`rights[${index}].rightsStatus must be approved for published project-owned data`);
    nonempty(entry.description, `rights[${index}].description`);
  });
  return { provenanceIds, rightsIds };
}

function validateFamilies(source) {
  if (!isObject(source) || source.schemaVersion !== 1 || !Array.isArray(source.families)) fail('families.json must use schemaVersion 1 and define a families array');
  if (source.$schema !== '../schema/exercise-family.schema.json') fail('families.json must reference the EKF-1 family schema');
  const ids = unique(source.families.map((family, index) => {
    const id = nonempty(family?.id, `families[${index}].id`);
    if (!UUID_PATTERN.test(id)) fail(`families[${index}].id must be an opaque UUID`);
    return id;
  }), 'family canonical ID');
  unique(source.families.map((family, index) => {
    nonempty(family?.name, `families[${index}].name`);
    const legacyId = nonempty(family?.legacyId, `families[${index}].legacyId`);
    if (!LEGACY_ID_PATTERN.test(legacyId)) fail(`families[${index}].legacyId is malformed`);
    return legacyId;
  }), 'family legacy ID');
  return new Map(source.families.map(family => [family.id, family]));
}

function validateDefaults(defaults, references) {
  if (!isObject(defaults)) fail('canonicalDefaults must be an object');
  const required = ['schemaVersion', 'status', 'modality', 'programmingTags', 'movementPatterns', 'mechanics', 'muscles', 'equipment', 'laterality', 'measurement', 'analytics', 'provenanceRefs', 'rightsRefs'];
  required.forEach(field => {
    if (!Object.hasOwn(defaults, field)) fail(`canonicalDefaults.${field} is required`);
  });
  if (defaults.schemaVersion !== 1 || defaults.status !== 'active') fail('canonical defaults must define active schemaVersion 1 records');
  if (defaults.modality !== 'unknown' || defaults.mechanics !== 'unknown' || defaults.laterality !== 'unknown') fail('EKF-1 semantic defaults must remain unknown until EKF-2');
  if (!Array.isArray(defaults.programmingTags) || defaults.programmingTags.length) fail('EKF-1 programmingTags must remain empty');
  if (JSON.stringify(defaults.movementPatterns) !== '["unknown"]') fail('EKF-1 movementPatterns must remain unknown');
  for (const field of ['muscles', 'equipment']) {
    if (defaults[field]?.state !== 'unknown' || !Array.isArray(defaults[field]?.assertions) || defaults[field].assertions.length) fail(`EKF-1 ${field} must remain explicitly unknown`);
  }
  const measurement = defaults.measurement;
  if (measurement?.trackingModel !== 'unknown' || measurement?.loadSemantics?.loadBasis !== 'unknown' || measurement?.loadSemantics?.resistanceSemantics !== 'unknown' || measurement?.repSemantics !== 'unknown' || measurement?.bodyweightModel !== null) fail('EKF-1 measurement semantics must remain unknown and inactive');
  if (defaults.analytics?.e1rmPermitted !== false || defaults.analytics?.e1rmLoadBasis !== null) fail('EKF-1 analytics eligibility must remain inactive');
  if (!Array.isArray(defaults.provenanceRefs) || !defaults.provenanceRefs.length) fail('canonicalDefaults.provenanceRefs must not be empty');
  if (!Array.isArray(defaults.rightsRefs) || !defaults.rightsRefs.length) fail('canonicalDefaults.rightsRefs must not be empty');
  defaults.provenanceRefs.forEach(id => {
    if (!references.provenanceIds.has(id)) fail(`unresolved provenance reference: ${id}`);
  });
  defaults.rightsRefs.forEach(id => {
    if (!references.rightsIds.has(id)) fail(`unresolved rights reference: ${id}`);
  });
}

const TRACKING_MODELS = new Set(['load_reps', 'reps_only', 'assistance_reps', 'duration', 'distance_duration', 'load_duration', 'load_distance', 'distance_only', 'unknown']);
const LOAD_BASES = new Set(['total', 'per_hand', 'per_side', 'not_applicable', 'unknown']);
const RESISTANCE_SEMANTICS = new Set(['external', 'bodyweight_only', 'bodyweight_plus_external', 'assistance', 'machine_indicated', 'not_applicable', 'unknown']);
const REP_SEMANTICS = new Set(['bilateral_cycle', 'reps_per_side', 'total_events', 'alternating_total', 'not_applicable', 'unknown']);
const LATERALITIES = new Set(['bilateral', 'independent_bilateral', 'unilateral', 'alternating', 'asymmetric', 'not_applicable', 'unknown']);
const E1RM_BASES = new Set(['entered_load', 'combined_external_load', 'effective_system_load']);

function validateMeasurements(source, exerciseSource) {
  if (!isObject(source) || source.schemaVersion !== 1 || !Array.isArray(source.contracts)) fail('measurement-contracts.json must use schemaVersion 1 and define contracts');
  if (source.$schema !== '../schema/measurement-contract.schema.json') fail('measurement-contracts.json must reference the EKF-2 measurement schema');
  nonempty(source.releaseId, 'measurement releaseId');
  nonempty(source.description, 'measurement description');
  const exerciseById = new Map(exerciseSource.exercises.map(record => [record.id, record]));
  const measurementOwners = new Map();
  source.contracts.forEach((contract, index) => {
    const label = `measurement.contracts[${index}]`;
    if (!isObject(contract)) fail(`${label} must be an object`);
    const exerciseId = nonempty(contract.exerciseId, `${label}.exerciseId`);
    if (!UUID_PATTERN.test(exerciseId)) fail(`${label}.exerciseId must be an opaque UUID`);
    if (measurementOwners.has(exerciseId)) fail(`duplicate measurement contract for ${exerciseId}`);
    const exercise = exerciseById.get(exerciseId);
    if (!exercise) fail(`measurement contract references unknown exercise ${exerciseId}`);
    if (contract.legacyId !== exercise.slug) fail(`measurement legacyId mismatch for ${exerciseId}`);
    if (contract.contentRevision !== 2) fail(`${label}.contentRevision must be 2 for EKF-2`);
    if (!LATERALITIES.has(contract.laterality) || contract.laterality === 'unknown') fail(`${label}.laterality must be explicit`);
    const measurement = contract.measurement;
    if (!isObject(measurement) || !TRACKING_MODELS.has(measurement.trackingModel) || measurement.trackingModel === 'unknown') fail(`${label}.measurement.trackingModel must be explicit`);
    if (!isObject(measurement.loadSemantics)) fail(`${label}.measurement.loadSemantics is required`);
    const { loadBasis, resistanceSemantics } = measurement.loadSemantics;
    if (!LOAD_BASES.has(loadBasis) || loadBasis === 'unknown') fail(`${label}.measurement.loadBasis must be explicit`);
    if (!RESISTANCE_SEMANTICS.has(resistanceSemantics) || resistanceSemantics === 'unknown') fail(`${label}.measurement.resistanceSemantics must be explicit`);
    if (!REP_SEMANTICS.has(measurement.repSemantics) || measurement.repSemantics === 'unknown') fail(`${label}.measurement.repSemantics must be explicit`);
    if (!isObject(measurement.ui)) fail(`${label}.measurement.ui is required`);
    const usesLoad = ['load_reps', 'assistance_reps', 'load_duration', 'load_distance'].includes(measurement.trackingModel);
    const usesReps = ['load_reps', 'reps_only', 'assistance_reps'].includes(measurement.trackingModel);
    const usesDistance = ['distance_duration', 'load_distance', 'distance_only'].includes(measurement.trackingModel);
    const usesDuration = ['duration', 'distance_duration', 'load_duration'].includes(measurement.trackingModel);
    if (usesLoad !== (loadBasis !== 'not_applicable')) fail(`${label} load basis does not match tracking model`);
    if (usesLoad && !nonempty(measurement.ui.loadLabel, `${label}.measurement.ui.loadLabel`)) fail(`${label} load label is required`);
    if (usesReps !== (measurement.repSemantics !== 'not_applicable')) fail(`${label} rep semantics do not match tracking model`);
    if (usesReps) nonempty(measurement.ui.repsLabel, `${label}.measurement.ui.repsLabel`);
    if (usesDistance) nonempty(measurement.ui.distanceLabel, `${label}.measurement.ui.distanceLabel`);
    if (usesDuration) nonempty(measurement.ui.durationLabel, `${label}.measurement.ui.durationLabel`);
    if (['bodyweight_only', 'bodyweight_plus_external', 'assistance'].includes(resistanceSemantics) && !['full_system', 'unsupported_fraction'].includes(measurement.bodyweightModel)) fail(`${label} bodyweight semantics require a bodyweight model`);
    if (!['bodyweight_only', 'bodyweight_plus_external', 'assistance'].includes(resistanceSemantics) && measurement.bodyweightModel !== null) fail(`${label} non-bodyweight semantics must not declare a bodyweight model`);
    if (!isObject(contract.analytics) || typeof contract.analytics.e1rmPermitted !== 'boolean') fail(`${label}.analytics is required`);
    if (contract.analytics.e1rmPermitted && !E1RM_BASES.has(contract.analytics.e1rmLoadBasis)) fail(`${label} permitted e1RM requires an explicit load basis`);
    if (!contract.analytics.e1rmPermitted && contract.analytics.e1rmLoadBasis !== null) fail(`${label} ineligible e1RM must have a null load basis`);
    if (contract.analytics.e1rmPermitted && !['load_reps'].includes(measurement.trackingModel)) fail(`${label} e1RM tracking model is ineligible`);
    if (contract.analytics.e1rmPermitted && ['machine_indicated', 'assistance', 'bodyweight_only', 'not_applicable'].includes(resistanceSemantics)) fail(`${label} resistance semantics are ineligible for e1RM`);
    if (!isObject(contract.muscles) || !Array.isArray(contract.muscles.primary) || !contract.muscles.primary.length || !Array.isArray(contract.muscles.secondary) || !Array.isArray(contract.muscles.stabilizer)) fail(`${label}.muscles must declare primary, secondary, and stabilizer roles`);
    measurementOwners.set(exerciseId, contract);
  });
  if (measurementOwners.size !== exerciseSource.exercises.length) {
    const missing = exerciseSource.exercises.filter(record => !measurementOwners.has(record.id)).map(record => record.slug);
    fail(`every exercise requires exactly one measurement contract; missing: ${missing.join(', ')}`);
  }
  return measurementOwners;
}

export function materializeExercises(source, measurementOwners = new Map()) {
  return source.exercises.map(record => {
    const contract = measurementOwners.get(record.id);
    return {
      ...structuredClone(source.canonicalDefaults),
      ...structuredClone(record),
      ...(contract ? {
        contentRevision: contract.contentRevision,
        laterality: contract.laterality,
        measurement: structuredClone(contract.measurement),
        analytics: structuredClone(contract.analytics),
        muscles: { state: 'curated', assertions: [
          ...contract.muscles.primary.map(muscleId => ({ muscleId, role: 'primary' })),
          ...contract.muscles.secondary.map(muscleId => ({ muscleId, role: 'secondary' })),
          ...contract.muscles.stabilizer.map(muscleId => ({ muscleId, role: 'stabilizer' }))
        ] }
      } : {})
    };
  });
}

export function validateInputs({ exercises: source, families, references, measurements }) {
  if (!isObject(source) || !isObject(source.release) || source.release.schemaVersion !== 1 || !Array.isArray(source.exercises)) fail('exercises.json must define a schemaVersion 1 release and exercises array');
  if (source.$schema !== '../schema/exercise-identity.schema.json') fail('exercises.json must reference the EKF-1 identity schema');
  nonempty(source.release.id, 'release.id');
  nonempty(source.release.sourceBaseline, 'release.sourceBaseline');
  nonempty(source.release.description, 'release.description');
  const referenceIndexes = validateReferences(references);
  const familyById = validateFamilies(families);
  validateDefaults(source.canonicalDefaults, referenceIndexes);
  const sourceCanonicalIds = new Set();
  source.exercises.forEach(record => {
    if (sourceCanonicalIds.has(record.id)) fail(`duplicate canonical exercise ID: ${record.id}`);
    sourceCanonicalIds.add(record.id);
  });
  const measurementOwners = validateMeasurements(measurements, source);

  const records = materializeExercises(source, measurementOwners);
  if (!records.length) fail('at least one exercise is required');
  const canonicalIds = new Set();
  const legacyOwners = new Map();
  const slugOwners = new Map();
  const termOwners = new Map();

  function ownTerm(term, owner, label) {
    const normalized = normalizeTerm(term);
    if (!normalized) fail(`${label} for ${owner} normalizes to an empty term`);
    const existing = termOwners.get(normalized);
    if (existing && existing !== owner) fail(`ambiguous normalized term "${normalized}" belongs to both ${existing} and ${owner}`);
    termOwners.set(normalized, owner);
  }

  records.forEach((record, index) => {
    const label = `exercises[${index}]`;
    const id = nonempty(record.id, `${label}.id`);
    if (!UUID_PATTERN.test(id)) fail(`${label}.id must be an opaque UUID`);
    if (canonicalIds.has(id)) fail(`duplicate canonical exercise ID: ${id}`);
    canonicalIds.add(id);
    if (record.contentRevision !== 2) fail(`${label}.contentRevision must be 2 for EKF-2 measurement semantics`);
    const canonicalName = nonempty(record.canonicalName, `${label}.canonicalName`);
    const slug = nonempty(record.slug, `${label}.slug`);
    if (!LEGACY_ID_PATTERN.test(slug)) fail(`${label}.slug is malformed`);
    if (slugOwners.has(slug)) fail(`duplicate canonical slug: ${slug}`);
    slugOwners.set(slug, id);
    if (!Array.isArray(record.legacyIds) || !record.legacyIds.length) fail(`${label}.legacyIds must not be empty`);
    if (!Array.isArray(record.aliases)) fail(`${label}.aliases must be an array`);
    if (!isObject(record.compatibility)) fail(`${label}.compatibility is required`);
    if (!Array.isArray(record.programmingTags) || !Array.isArray(record.movementPatterns) || !record.movementPatterns.length) fail(`${label} programming and movement taxonomy must be explicit after materialization`);
    if (!isObject(record.equipment) || !Array.isArray(record.equipment.assertions)) fail(`${label}.equipment assertions are required`);
    if (!Array.isArray(record.provenanceRefs) || !record.provenanceRefs.length || !Array.isArray(record.rightsRefs) || !record.rightsRefs.length) fail(`${label} provenance and rights references are required`);
    record.provenanceRefs.forEach(reference => { if (!referenceIndexes.provenanceIds.has(reference)) fail(`unresolved provenance reference ${reference} on ${id}`); });
    record.rightsRefs.forEach(reference => { if (!referenceIndexes.rightsIds.has(reference)) fail(`unresolved rights reference ${reference} on ${id}`); });
    const legacyId = nonempty(record.compatibility.legacyId, `${label}.compatibility.legacyId`);
    if (!record.legacyIds.includes(legacyId)) fail(`${label}.compatibility.legacyId must be retained in legacyIds`);
    if (record.slug !== legacyId) fail(`${label}.slug and current compatibility legacyId must match in EKF-1`);
    record.legacyIds.forEach((value, legacyIndex) => {
      const checked = nonempty(value, `${label}.legacyIds[${legacyIndex}]`);
      if (!LEGACY_ID_PATTERN.test(checked)) fail(`${label}.legacyIds[${legacyIndex}] is malformed`);
      const existing = legacyOwners.get(checked);
      if (existing) fail(`duplicate or recycled legacy exercise ID ${checked}: ${existing} and ${id}`);
      legacyOwners.set(checked, id);
      ownTerm(checked, id, `${label}.legacyIds[${legacyIndex}]`);
    });
    const localAliases = new Set();
    record.aliases.forEach((alias, aliasIndex) => {
      const checked = nonempty(alias, `${label}.aliases[${aliasIndex}]`);
      if (localAliases.has(checked)) fail(`duplicate alias "${checked}" on ${id}`);
      localAliases.add(checked);
      ownTerm(checked, id, `${label}.aliases[${aliasIndex}]`);
    });
    ownTerm(canonicalName, id, `${label}.canonicalName`);
    for (const field of ['day', 'muscle', 'equipment']) nonempty(record.compatibility[field], `${label}.compatibility.${field}`);
    if (record.familyId !== null && !familyById.has(record.familyId)) fail(`broken family reference ${record.familyId} on ${id}`);
    if (record.variantOf !== null && typeof record.variantOf !== 'string') fail(`${label}.variantOf must be null or a canonical ID`);
  });

  records.forEach(record => {
    if (record.variantOf && !canonicalIds.has(record.variantOf)) fail(`broken variant reference ${record.variantOf} on ${record.id}`);
    if (record.variantOf === record.id) fail(`exercise ${record.id} cannot be its own variant parent`);
  });

  return { records, familyById, canonicalIds, legacyOwners, termOwners, measurementOwners };
}

function runtimeRecords(validated) {
  return validated.records.map(record => ({
    canonicalId: record.id,
    legacyIds: [...record.legacyIds],
    id: record.compatibility.legacyId,
    name: record.canonicalName,
    day: record.compatibility.day,
    muscle: record.compatibility.muscle,
    equipment: record.compatibility.equipment,
    aliases: [...record.aliases],
    family: record.familyId ? validated.familyById.get(record.familyId).legacyId : null,
    variantOf: record.variantOf,
    contentRevision: record.contentRevision,
    modality: record.modality,
    programmingTags: [...record.programmingTags],
    movementPatterns: [...record.movementPatterns],
    mechanics: record.mechanics,
    equipmentRoles: record.equipment.assertions.map(assertion => ({ ...assertion })),
    provenanceRefs: [...record.provenanceRefs],
    rightsRefs: [...record.rightsRefs],
    laterality: record.laterality,
    measurement: structuredClone(record.measurement),
    analytics: structuredClone(record.analytics),
    muscleRoles: {
      primary: record.muscles.assertions.filter(assertion => assertion.role === 'primary').map(assertion => assertion.muscleId),
      secondary: record.muscles.assertions.filter(assertion => assertion.role === 'secondary').map(assertion => assertion.muscleId),
      stabilizer: record.muscles.assertions.filter(assertion => assertion.role === 'stabilizer').map(assertion => assertion.muscleId)
    }
  }));
}

export function renderCatalog(validated, release) {
  const data = JSON.stringify(runtimeRecords(validated), null, 2);
  return renderCatalogRuntime({ data, releaseId: release.id });
}

export function renderLegacyIndex(validated, release) {
  const index = {
    schemaVersion: 1,
    releaseId: release.id,
    generatedFrom: ['ekf/curated/exercises.json', 'ekf/curated/ekf-3-exercises.json', 'ekf/curated/measurement-contracts.json', 'ekf/curated/ekf-3-measurement-contracts.json', 'ekf/curated/families.json', 'ekf/curated/ekf-3-families.json', 'ekf/curated/references.json', 'ekf/curated/ekf-3-references.json'],
    entries: validated.records.flatMap(record => record.legacyIds.map(legacyId => ({ legacyId, canonicalId: record.id })))
  };
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function renderMeasurementAudit(validated, release) {
  const rows = validated.records.map(record => {
    const measurement = record.measurement;
    const fields = Object.entries(measurement.ui)
      .filter(([key]) => key.endsWith('Label'))
      .map(([, value]) => value)
      .join(' + ');
    const roles = record.muscles.assertions
      .filter(assertion => assertion.role !== 'stabilizer')
      .map(assertion => `${assertion.muscleId} (${assertion.role})`)
      .join(', ');
    return `| \`${record.compatibility.legacyId}\` | ${record.canonicalName} | \`${measurement.trackingModel}\` | \`${measurement.loadSemantics.loadBasis}\` | \`${measurement.loadSemantics.resistanceSemantics}\` | \`${measurement.repSemantics}\` | \`${record.laterality}\` | ${fields} | ${record.analytics.e1rmPermitted ? `yes (\`${record.analytics.e1rmLoadBasis}\`)` : 'no'} | ${roles} |`;
  });
  const unknown = validated.records.filter(record => JSON.stringify({ measurement: record.measurement, laterality: record.laterality }).includes('unknown'));
  return `# EKF Measurement Contract Audit\n\nGenerated deterministically from the curated EKF sources for release \`${release.id}\`. Stored workout values remain entered facts; this table describes runtime interpretation only (EKF-4.2, EKF-4.3, EKF-4.13).\n\n- Exercises: **${validated.records.length}**\n- Explicit contracts: **${validated.measurementOwners.size}**\n- Unknown/unresolved contracts: **${unknown.length}**\n\n| Legacy ID | Exercise | Tracking | Load basis | Resistance | Reps | Laterality | Card inputs | e1RM | Muscle roles |\n|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

export function renderArtifacts(inputs) {
  const validated = validateInputs(inputs);
  return {
    catalog: renderCatalog(validated, inputs.exercises.release),
    legacyIndex: renderLegacyIndex(validated, inputs.exercises.release),
    measurementAudit: renderMeasurementAudit(validated, inputs.exercises.release),
    validated
  };
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

export async function loadInputs(root = DEFAULT_ROOT) {
  const [baseExercises, additions, baseFamilies, addedFamilies, baseReferences, addedReferences, baseMeasurements, addedMeasurements] = await Promise.all([
    readJson(root, path.join('ekf', 'curated', 'exercises.json')),
    readJson(root, path.join('ekf', 'curated', 'ekf-3-exercises.json')),
    readJson(root, path.join('ekf', 'curated', 'families.json')),
    readJson(root, path.join('ekf', 'curated', 'ekf-3-families.json')),
    readJson(root, path.join('ekf', 'curated', 'references.json')),
    readJson(root, path.join('ekf', 'curated', 'ekf-3-references.json')),
    readJson(root, path.join('ekf', 'curated', 'measurement-contracts.json')),
    readJson(root, path.join('ekf', 'curated', 'ekf-3-measurement-contracts.json'))
  ]);
  const exercises = {
    ...baseExercises,
    release: {
      id: 'ekf-3-curated-catalog-v1',
      schemaVersion: 1,
      sourceBaseline: 'ekf-2@50acb63e10f4380e8ef6799fe16596fbad33b95d',
      description: 'Stable EKF-2 catalog plus the curated, provenance-tracked EKF-3 commercial-gym expansion.'
    },
    exercises: [...baseExercises.exercises, ...additions.exercises]
  };
  const families = { ...baseFamilies, families: [...baseFamilies.families, ...addedFamilies.families] };
  const references = { schemaVersion: 1, provenance: [...baseReferences.provenance, ...addedReferences.provenance], rights: [...baseReferences.rights, ...addedReferences.rights] };
  const measurements = { ...baseMeasurements, releaseId: exercises.release.id, description: 'Explicit exercise-defined measurement contracts for the 155-entry EKF-3 compatibility catalog.', contracts: [...baseMeasurements.contracts, ...addedMeasurements.contracts] };
  return { exercises, families, references, measurements };
}

async function assertCurrent(root, relativePath, expected) {
  let actual;
  try {
    actual = await readFile(path.join(root, relativePath), 'utf8');
  } catch {
    fail(`${relativePath} is missing; run npm run generate:exercise-catalog`);
  }
  if (actual !== expected) fail(`${relativePath} is stale; run npm run generate:exercise-catalog`);
}

export async function generate({ root = DEFAULT_ROOT, check = false } = {}) {
  const inputs = await loadInputs(root);
  const artifacts = renderArtifacts(inputs);
  if (check) {
    await Promise.all([
      assertCurrent(root, GENERATED_CATALOG, artifacts.catalog),
      assertCurrent(root, GENERATED_LEGACY_INDEX, artifacts.legacyIndex),
      assertCurrent(root, GENERATED_MEASUREMENT_AUDIT, artifacts.measurementAudit)
    ]);
  } else {
    await mkdir(path.join(root, 'ekf', 'compatibility'), { recursive: true });
    await mkdir(path.join(root, 'ekf', 'audit'), { recursive: true });
    await Promise.all([
      writeFile(path.join(root, GENERATED_CATALOG), artifacts.catalog),
      writeFile(path.join(root, GENERATED_LEGACY_INDEX), artifacts.legacyIndex),
      writeFile(path.join(root, GENERATED_MEASUREMENT_AUDIT), artifacts.measurementAudit)
    ]);
  }
  return { exerciseCount: artifacts.validated.records.length, legacyIdCount: artifacts.validated.legacyOwners.size };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const check = process.argv.slice(2).includes('--check');
  generate({ check })
    .then(result => process.stdout.write(`EKF catalog ${check ? 'verified' : 'generated'}: ${result.exerciseCount} exercises, ${result.legacyIdCount} legacy IDs.\n`))
    .catch(error => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
