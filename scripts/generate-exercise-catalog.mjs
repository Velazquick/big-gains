import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LEGACY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GENERATED_CATALOG = 'exercise-catalog.js';
const GENERATED_LEGACY_INDEX = path.join('ekf', 'compatibility', 'legacy-exercise-ids.json');

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

export function materializeExercises(source) {
  return source.exercises.map(record => ({ ...structuredClone(source.canonicalDefaults), ...structuredClone(record) }));
}

export function validateInputs({ exercises: source, families, references }) {
  if (!isObject(source) || !isObject(source.release) || source.release.schemaVersion !== 1 || !Array.isArray(source.exercises)) fail('exercises.json must define a schemaVersion 1 release and exercises array');
  if (source.$schema !== '../schema/exercise-identity.schema.json') fail('exercises.json must reference the EKF-1 identity schema');
  nonempty(source.release.id, 'release.id');
  nonempty(source.release.sourceBaseline, 'release.sourceBaseline');
  nonempty(source.release.description, 'release.description');
  const referenceIndexes = validateReferences(references);
  const familyById = validateFamilies(families);
  validateDefaults(source.canonicalDefaults, referenceIndexes);

  const records = materializeExercises(source);
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
    if (record.contentRevision !== 1) fail(`${label}.contentRevision must be 1 for the EKF-1 baseline`);
    const canonicalName = nonempty(record.canonicalName, `${label}.canonicalName`);
    const slug = nonempty(record.slug, `${label}.slug`);
    if (!LEGACY_ID_PATTERN.test(slug)) fail(`${label}.slug is malformed`);
    if (slugOwners.has(slug)) fail(`duplicate canonical slug: ${slug}`);
    slugOwners.set(slug, id);
    if (!Array.isArray(record.legacyIds) || !record.legacyIds.length) fail(`${label}.legacyIds must not be empty`);
    if (!Array.isArray(record.aliases)) fail(`${label}.aliases must be an array`);
    if (!isObject(record.compatibility)) fail(`${label}.compatibility is required`);
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

  return { records, familyById, canonicalIds, legacyOwners, termOwners };
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
    family: record.familyId ? validated.familyById.get(record.familyId).legacyId : null
  }));
}

export function renderCatalog(validated, release) {
  const data = JSON.stringify(runtimeRecords(validated), null, 2);
  return `// GENERATED FILE - DO NOT EDIT.\n// Sources: ekf/curated/exercises.json, families.json, references.json\n// Generator: scripts/generate-exercise-catalog.mjs\n// EKF-1 compatibility projection: EKF-2.2, EKF-2.3, EKF-2.6, EKF-2.7, EKF-11.1.\n((scope) => {\n  'use strict';\n\n  const RELEASE_ID = ${JSON.stringify(release.id)};\n  const RECORDS = ${data};\n  const idForName = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');\n  const normalizeTerm = value => String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/\\bdb\\b/g, 'dumbbell').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\\s+/g, ' ');\n  const exercises = Object.freeze(RECORDS.map(record => Object.freeze({\n    id: record.id,\n    name: record.name,\n    day: record.day,\n    muscle: record.muscle,\n    equipment: record.equipment,\n    aliases: Object.freeze([...record.aliases]),\n    family: record.family\n  })));\n  const compatibilityByCanonicalId = new Map(RECORDS.map((record, index) => [record.canonicalId, exercises[index]]));\n  const canonicalIdByLegacyId = new Map(RECORDS.flatMap(record => record.legacyIds.map(legacyId => [legacyId, record.canonicalId])));\n  const canonicalIdByTerm = new Map();\n  RECORDS.forEach(record => [record.name, ...record.aliases].forEach(term => {\n    const normalized = normalizeTerm(term);\n    const existing = canonicalIdByTerm.get(normalized);\n    if (existing && existing !== record.canonicalId) throw new Error(\`Ambiguous EKF compatibility term in \${RELEASE_ID}: \${term}\`);\n    canonicalIdByTerm.set(normalized, record.canonicalId);\n  }));\n\n  const canonicalIdFor = value => {\n    if (typeof value === 'string') return compatibilityByCanonicalId.has(value) ? value : canonicalIdByLegacyId.get(value) || null;\n    if (!value || typeof value !== 'object') return null;\n    return canonicalIdFor(value.definitionId) || canonicalIdFor(value.id);\n  };\n  const compatibilityForCanonicalId = canonicalId => compatibilityByCanonicalId.get(canonicalId) || null;\n  const resolveCanonicalId = term => canonicalIdFor(term) || canonicalIdByTerm.get(normalizeTerm(term)) || null;\n  const identityApi = Object.freeze({ canonicalIdFor, compatibilityForCanonicalId, resolveCanonicalId });\n\n  const getById = id => typeof id === 'string' ? compatibilityForCanonicalId(canonicalIdFor(id)) : null;\n  const resolve = term => compatibilityForCanonicalId(resolveCanonicalId(term));\n  const definitionFor = value => {\n    if (typeof value === 'string') return getById(value) || resolve(value);\n    if (!value || typeof value !== 'object') return null;\n    return getById(value.definitionId) || getById(value.id) || resolve(value.name);\n  };\n  const loadModeFor = value => {\n    const definition = definitionFor(value);\n    const equipment = definition?.equipment || (value && typeof value === 'object' ? value.equipment : '');\n    return equipment === 'Bodyweight' ? 'bodyweight' : 'external';\n  };\n  const matchesSearch = (exercise, term) => {\n    const normalized = normalizeTerm(term);\n    return !normalized || normalizeTerm([exercise.name, ...exercise.aliases, exercise.muscle, exercise.equipment].join(' ')).includes(normalized);\n  };\n\n  const api = Object.freeze({ exercises, getById, idForName, loadModeFor, matchesSearch, normalizeTerm, resolve });\n  Object.defineProperty(scope, 'BigGainsExerciseIdentity', {\n    configurable: false,\n    enumerable: true,\n    value: identityApi,\n    writable: false\n  });\n  Object.defineProperty(scope, 'BigGainsExerciseCatalog', {\n    configurable: false,\n    enumerable: true,\n    value: api,\n    writable: false\n  });\n  Object.defineProperty(scope, 'bigGainsExerciseCatalog', {\n    configurable: false,\n    enumerable: true,\n    value: api,\n    writable: false\n  });\n})(typeof window === 'object' ? window : globalThis);\n`;
}

export function renderLegacyIndex(validated, release) {
  const index = {
    schemaVersion: 1,
    releaseId: release.id,
    generatedFrom: ['ekf/curated/exercises.json', 'ekf/curated/families.json', 'ekf/curated/references.json'],
    entries: validated.records.flatMap(record => record.legacyIds.map(legacyId => ({ legacyId, canonicalId: record.id })))
  };
  return `${JSON.stringify(index, null, 2)}\n`;
}

export function renderArtifacts(inputs) {
  const validated = validateInputs(inputs);
  return {
    catalog: renderCatalog(validated, inputs.exercises.release),
    legacyIndex: renderLegacyIndex(validated, inputs.exercises.release),
    validated
  };
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

export async function loadInputs(root = DEFAULT_ROOT) {
  const [exercises, families, references] = await Promise.all([
    readJson(root, path.join('ekf', 'curated', 'exercises.json')),
    readJson(root, path.join('ekf', 'curated', 'families.json')),
    readJson(root, path.join('ekf', 'curated', 'references.json'))
  ]);
  return { exercises, families, references };
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
      assertCurrent(root, GENERATED_LEGACY_INDEX, artifacts.legacyIndex)
    ]);
  } else {
    await mkdir(path.join(root, 'ekf', 'compatibility'), { recursive: true });
    await Promise.all([
      writeFile(path.join(root, GENERATED_CATALOG), artifacts.catalog),
      writeFile(path.join(root, GENERATED_LEGACY_INDEX), artifacts.legacyIndex)
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
