export function renderCatalogRuntime({ data, releaseId }) {
  return `// GENERATED FILE - DO NOT EDIT.
// Sources: ekf/curated/exercises.json, measurement-contracts.json, families.json, references.json
// Generator: scripts/generate-exercise-catalog.mjs
// EKF-2 compatibility + measurement projection: EKF-4.2 through EKF-4.20, EKF-6.3, EKF-11.1.
((scope) => {
  'use strict';

  const RELEASE_ID = ${JSON.stringify(releaseId)};
  const RECORDS = ${data};
  const idForName = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const normalizeTerm = value => String(value || '').toLowerCase().replace(/&/g, ' and ').replace(/\\bdb\\b/g, 'dumbbell').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\\s+/g, ' ');
  const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };
  const exercises = Object.freeze(RECORDS.map(record => deepFreeze({
    id: record.id,
    name: record.name,
    day: record.day,
    muscle: record.muscle,
    equipment: record.equipment,
    aliases: [...record.aliases],
    family: record.family,
    canonicalId: record.canonicalId,
    contentRevision: record.contentRevision,
    laterality: record.laterality,
    measurement: { ...record.measurement, laterality: record.laterality, analytics: record.analytics, canonicalExerciseId: record.canonicalId, contentRevision: record.contentRevision },
    analytics: record.analytics,
    muscleRoles: record.muscleRoles
  })));
  const compatibilityByCanonicalId = new Map(RECORDS.map((record, index) => [record.canonicalId, exercises[index]]));
  const canonicalIdByLegacyId = new Map(RECORDS.flatMap(record => record.legacyIds.map(legacyId => [legacyId, record.canonicalId])));
  const canonicalIdByTerm = new Map();
  RECORDS.forEach(record => [record.name, ...record.aliases].forEach(term => {
    const normalized = normalizeTerm(term);
    const existing = canonicalIdByTerm.get(normalized);
    if (existing && existing !== record.canonicalId) throw new Error(\`Ambiguous EKF compatibility term in \${RELEASE_ID}: \${term}\`);
    canonicalIdByTerm.set(normalized, record.canonicalId);
  }));

  const canonicalIdFor = value => {
    if (typeof value === 'string') return compatibilityByCanonicalId.has(value) ? value : canonicalIdByLegacyId.get(value) || null;
    if (!value || typeof value !== 'object') return null;
    return canonicalIdFor(value.definitionId) || canonicalIdFor(value.id);
  };
  const compatibilityForCanonicalId = canonicalId => compatibilityByCanonicalId.get(canonicalId) || null;
  const resolveCanonicalId = term => canonicalIdFor(term) || canonicalIdByTerm.get(normalizeTerm(term)) || null;
  const identityApi = Object.freeze({ canonicalIdFor, compatibilityForCanonicalId, resolveCanonicalId });

  const getById = id => typeof id === 'string' ? compatibilityForCanonicalId(canonicalIdFor(id)) : null;
  const resolve = term => compatibilityForCanonicalId(resolveCanonicalId(term));
  const definitionFor = value => {
    if (typeof value === 'string') return getById(value) || resolve(value);
    if (!value || typeof value !== 'object') return null;
    if (typeof value.definitionId === 'string' && value.definitionId) return getById(value.definitionId);
    if (typeof value.id === 'string' && value.id) return getById(value.id);
    return resolve(value.name);
  };
  const measurementFor = value => definitionFor(value)?.measurement || null;
  const inputFieldsFor = value => {
    const measurement = measurementFor(value);
    if (!measurement) return deepFreeze([
      { name: 'weight', label: value?.equipment === 'Bodyweight' ? 'Added weight' : 'Weight', unit: 'lb', step: 5, mayBeZero: value?.equipment === 'Bodyweight' },
      { name: 'reps', label: 'Reps', unit: '', step: 1, mayBeZero: false }
    ]);
    const fields = [];
    const model = measurement.trackingModel;
    const ui = measurement.ui || {};
    if (['load_reps', 'assistance_reps', 'load_duration', 'load_distance'].includes(model)) fields.push({ name: 'weight', label: ui.loadLabel, unit: ui.loadUnit || 'lb', step: ui.loadStep || 5, mayBeZero: ui.loadMayBeZero === true });
    if (['load_reps', 'reps_only', 'assistance_reps'].includes(model)) fields.push({ name: 'reps', label: ui.repsLabel || 'Reps', unit: '', step: 1, mayBeZero: false });
    if (['distance_duration', 'load_distance', 'distance_only'].includes(model)) fields.push({ name: 'distance', label: ui.distanceLabel || 'Distance', unit: ui.distanceUnit || '', step: ui.distanceStep || 1, mayBeZero: false });
    if (['duration', 'distance_duration', 'load_duration'].includes(model)) fields.push({ name: 'duration', label: ui.durationLabel || 'Duration', unit: ui.durationUnit || 'sec', step: ui.durationStep || 5, mayBeZero: false });
    return deepFreeze(fields);
  };
  const loadModeFor = value => {
    const resistance = measurementFor(value)?.loadSemantics?.resistanceSemantics;
    if (resistance === 'bodyweight_only' || resistance === 'bodyweight_plus_external') return 'bodyweight';
    const definition = definitionFor(value);
    const equipment = definition?.equipment || (value && typeof value === 'object' ? value.equipment : '');
    return equipment === 'Bodyweight' ? 'bodyweight' : 'external';
  };
  const matchesSearch = (exercise, term) => {
    const normalized = normalizeTerm(term);
    return !normalized || normalizeTerm([exercise.name, ...exercise.aliases, exercise.muscle, exercise.equipment].join(' ')).includes(normalized);
  };

  const api = Object.freeze({ canonicalIdFor, definitionFor, exercises, getById, idForName, inputFieldsFor, loadModeFor, matchesSearch, measurementFor, normalizeTerm, resolve });
  Object.defineProperty(scope, 'BigGainsExerciseIdentity', { configurable: false, enumerable: true, value: identityApi, writable: false });
  Object.defineProperty(scope, 'BigGainsExerciseCatalog', { configurable: false, enumerable: true, value: api, writable: false });
  Object.defineProperty(scope, 'bigGainsExerciseCatalog', { configurable: false, enumerable: true, value: api, writable: false });
})(typeof window === 'object' ? window : globalThis);
`;
}
