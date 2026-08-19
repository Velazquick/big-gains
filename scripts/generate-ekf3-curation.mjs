import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BIG_GAINS_CURATED_DECISIONS,
  EKF3_ADDITIONS,
  EKF3_FAMILIES,
  EKF3_RETRIEVED_AT,
  FREE_EXERCISE_DB_DECISIONS,
  FREE_EXERCISE_DB_RECORDS,
  SOURCE_LOCK,
  SOURCE_REGISTRY,
  WGER_RECORDS
} from './ekf3-curation-source.mjs';

const DEFAULT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const OUTPUTS = {
  registry: 'ekf/source-registry.json',
  lock: 'ekf/source-lock.json',
  candidates: 'ekf/curation/ekf-3-candidates.json',
  references: 'ekf/curated/ekf-3-references.json',
  families: 'ekf/curated/ekf-3-families.json',
  exercises: 'ekf/curated/ekf-3-exercises.json',
  measurements: 'ekf/curated/ekf-3-measurement-contracts.json',
  report: 'ekf/audit/ekf-3-curation-report.md'
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TRACKING = new Set(['load_reps', 'reps_only', 'assistance_reps', 'duration', 'distance_duration', 'load_duration', 'load_distance', 'distance_only']);
const LOAD_BASIS = new Set(['total', 'per_hand', 'per_side', 'not_applicable']);
const RESISTANCE = new Set(['external', 'bodyweight_only', 'bodyweight_plus_external', 'assistance', 'machine_indicated', 'not_applicable']);
const REP_BASIS = new Set(['bilateral_cycle', 'reps_per_side', 'total_events', 'alternating_total', 'not_applicable']);
const LATERALITY = new Set(['bilateral', 'independent_bilateral', 'unilateral', 'alternating', 'asymmetric', 'not_applicable']);

function fail(message) { throw new Error(`EKF-3 curation failed: ${message}`); }
function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function requiredString(value, label) { if (typeof value !== 'string' || !value.trim()) fail(`${label} is required`); }
function unique(values, label) { const seen = new Set(); for (const value of values) { if (seen.has(value)) fail(`duplicate ${label}: ${value}`); seen.add(value); } return seen; }
function counts(values, key) { return Object.fromEntries([...values.reduce((map, value) => map.set(value[key], (map.get(value[key]) || 0) + 1), new Map())].sort(([a], [b]) => a.localeCompare(b))); }

function validateSource() {
  if (SOURCE_REGISTRY.length !== 3 || SOURCE_LOCK.length !== 2) fail('source registry/lock cardinality changed');
  if (FREE_EXERCISE_DB_RECORDS.length !== 41 || WGER_RECORDS.length !== 5 || BIG_GAINS_CURATED_DECISIONS.length !== 12) fail('review source cardinality changed');
  if (EKF3_ADDITIONS.length !== 36 || EKF3_FAMILIES.length !== 4) fail('release scope must remain 36 additions and 4 families');
  unique(EKF3_ADDITIONS.map(record => record.id), 'canonical ID');
  unique(EKF3_ADDITIONS.map(record => record.slug), 'slug');
  unique(EKF3_FAMILIES.map(record => record.id), 'family ID');
  const sourceIds = new Set(FREE_EXERCISE_DB_RECORDS.map(record => record.id));
  const acceptedExternal = EKF3_ADDITIONS.filter(record => record.sourceNativeId !== null);
  if (acceptedExternal.length !== 24) fail('exactly 24 Free Exercise DB records must be accepted');
  for (const [index, record] of EKF3_ADDITIONS.entries()) {
    const label = `addition[${index}]`;
    if (!UUID.test(record.id)) fail(`${label}.id must be an opaque UUID`);
    for (const field of ['slug', 'canonicalName', 'day', 'muscle', 'equipment', 'modality', 'mechanics', 'laterality', 'trackingModel', 'loadBasis', 'resistanceSemantics', 'repSemantics']) requiredString(record[field], `${label}.${field}`);
    for (const field of ['aliases', 'programmingTags', 'movementPatterns', 'equipmentRoles', 'primary', 'secondary', 'stabilizer']) if (!Array.isArray(record[field])) fail(`${label}.${field} must be explicit`);
    if (!record.primary.length || !record.movementPatterns.length || !record.equipmentRoles.length) fail(`${label} taxonomy is incomplete`);
    if (!TRACKING.has(record.trackingModel) || !LOAD_BASIS.has(record.loadBasis) || !RESISTANCE.has(record.resistanceSemantics) || !REP_BASIS.has(record.repSemantics) || !LATERALITY.has(record.laterality)) fail(`${label} measurement semantics are invalid`);
    if (record.bodyweightModel !== null && !['full_system', 'unsupported_fraction'].includes(record.bodyweightModel)) fail(`${label}.bodyweightModel is invalid`);
    if (!record.analytics || typeof record.analytics.e1rmPermitted !== 'boolean' || !Object.hasOwn(record.analytics, 'e1rmLoadBasis')) fail(`${label}.analytics is incomplete`);
    if (record.sourceNativeId !== null && !sourceIds.has(record.sourceNativeId)) fail(`${label} has an unresolved external source record`);
    if (JSON.stringify(record).match(/image|video|instruction/i)) fail(`${label} introduces a prohibited media/instruction field`);
  }
  const decisions = [...FREE_EXERCISE_DB_DECISIONS, ...BIG_GAINS_CURATED_DECISIONS, ...WGER_RECORDS.map(record => ({ ...record, decision: 'quarantined' }))];
  const decisionCounts = counts(decisions, 'decision');
  if (decisions.length !== 58 || decisionCounts.accepted !== 36 || decisionCounts.rejected !== 12 || decisionCounts.human_review !== 5 || decisionCounts.quarantined !== 5) fail('candidate decision totals changed');
  return { decisions, decisionCounts };
}

function provenanceId(record) { return record.sourceNativeId === null ? 'big-gains-ekf3-curation-v1' : `fedb-${record.sourceNativeId}`; }

function buildArtifacts() {
  const { decisions, decisionCounts } = validateSource();
  const freeById = new Map(FREE_EXERCISE_DB_RECORDS.map(record => [record.id, record]));
  const registry = { schemaVersion: 1, sources: SOURCE_REGISTRY };
  const lock = { schemaVersion: 1, importerVersion: 'ekf3-curation-importer-v1', retrievedAt: EKF3_RETRIEVED_AT, snapshots: SOURCE_LOCK };
  const candidates = {
    schemaVersion: 1,
    releaseId: 'ekf-3-curated-catalog-v1',
    summary: { reviewed: decisions.length, ...decisionCounts },
    candidates: decisions.map(decision => ({
      sourceRegistryId: decision.decision === 'quarantined' ? 'wger-exercise-data' : decision.sourceNativeRecordId.startsWith('big-gains:') ? 'big-gains-source-zero' : 'free-exercise-db',
      sourceSnapshotId: decision.decision === 'quarantined' ? 'wger-d353d3c8' : decision.sourceNativeRecordId.startsWith('big-gains:') ? 'ekf-2-50acb63' : 'free-exercise-db-b0eed061',
      sourceNativeRecordId: decision.sourceNativeRecordId,
      decision: decision.decision,
      canonicalId: decision.canonicalId || null,
      rightsStatus: decision.decision === 'quarantined' ? 'quarantined' : decision.sourceNativeRecordId.startsWith('big-gains:') ? 'approved_project_owned' : 'approved_unlicense',
      licenseExpression: decision.decision === 'quarantined' ? decision.licenseExpression : decision.sourceNativeRecordId.startsWith('big-gains:') ? 'LicenseRef-Big-Gains-Project-Owned' : 'Unlicense',
      sourceLineage: decision.decision === 'quarantined' ? 'wger-project/wger' : decision.sourceNativeRecordId.startsWith('big-gains:') ? 'big-gains' : 'wrkout/exercises.json',
      reviewStatus: decision.decision === 'human_review' ? 'unresolved' : 'reviewed',
      rationale: decision.rationale,
      sourceRecord: decision.decision === 'quarantined'
        ? { name: decision.name }
        : decision.sourceNativeRecordId.startsWith('big-gains:')
          ? { name: EKF3_ADDITIONS.find(record => record.id === decision.canonicalId).canonicalName }
          : (({ name, equipment, mechanic, primaryMuscles, secondaryMuscles }) => ({ name, equipment, mechanic, primaryMuscles, secondaryMuscles }))(freeById.get(decision.sourceNativeRecordId)),
      ...(!decision.sourceNativeRecordId.startsWith('big-gains:') && decision.decision !== 'quarantined' ? { sourcePayloadSha256: freeById.get(decision.sourceNativeRecordId).sourcePayloadSha256 } : {}),
      ...(decision.sourcePayloadSha256 ? { sourcePayloadSha256: decision.sourcePayloadSha256 } : {}),
      ...(decision.decision === 'quarantined' ? { attribution: decision.attribution, translationUuid: decision.translationUuid, exercisePk: decision.exercisePk, exerciseUuid: decision.exerciseUuid } : {})
    }))
  };
  const externalProvenance = EKF3_ADDITIONS.filter(record => record.sourceNativeId !== null).map(record => ({
    id: provenanceId(record), kind: 'external_structured_assertion', sourceName: 'Free Exercise DB',
    sourceRegistryId: 'free-exercise-db', sourceSnapshotId: 'free-exercise-db-b0eed061', snapshotVersion: SOURCE_LOCK[0].commit,
    sourceNativeRecordId: record.sourceNativeId, retrievedAt: EKF3_RETRIEVED_AT, importerVersion: 'ekf3-curation-importer-v1',
    assertionMethod: 'mapped', licenseExpression: 'Unlicense', attributionRequirements: 'none', rightsStatus: 'approved',
    sourceLineage: 'wrkout/exercises.json', reviewStatus: 'reviewed', confidence: 'high', sourcePayloadSha256: freeById.get(record.sourceNativeId).sourcePayloadSha256,
    description: 'Selected structured identity/taxonomy assertion; Big Gains independently curated semantics. No instructions or media copied.'
  }));
  const references = {
    schemaVersion: 1,
    provenance: [{
      id: 'big-gains-ekf3-curation-v1', kind: 'project_curation', sourceName: 'Big Gains curated catalog', sourceRegistryId: 'big-gains-source-zero',
      snapshotVersion: '50acb63e10f4380e8ef6799fe16596fbad33b95d', sourceNativeRecordId: null, retrievedAt: EKF3_RETRIEVED_AT,
      importerVersion: 'ekf3-curation-importer-v1', assertionMethod: 'curated', licenseExpression: 'LicenseRef-Big-Gains-Project-Owned',
      attributionRequirements: 'none', rightsStatus: 'approved', sourceLineage: 'big-gains', reviewStatus: 'reviewed', confidence: 'high',
      description: 'Big Gains-authored identity, compatibility, taxonomy, measurement, and programming assertions for EKF-3.'
    }, ...externalProvenance],
    rights: [
      { id: 'big-gains-project-owned-ekf3', kind: 'project_owned', rightsStatus: 'approved', licenseExpression: 'LicenseRef-Big-Gains-Project-Owned', attributionRequirements: 'none', description: 'Big Gains-authored curation and semantic assertions.' },
      { id: 'free-exercise-db-unlicense-b0eed061', kind: 'external_data', rightsStatus: 'approved', licenseExpression: 'Unlicense', attributionRequirements: 'none', sourceSnapshotId: 'free-exercise-db-b0eed061', description: 'Selected structured records from the pinned Unlicense snapshot; no instructions or media included.' }
    ]
  };
  const families = { $schema: '../schema/exercise-family.schema.json', schemaVersion: 1, families: EKF3_FAMILIES };
  const exercises = {
    $schema: '../schema/exercise-extension.schema.json', releaseId: 'ekf-3-curated-catalog-v1', schemaVersion: 1,
    exercises: EKF3_ADDITIONS.map(record => ({
      id: record.id, contentRevision: 1, canonicalName: record.canonicalName, slug: record.slug, legacyIds: [record.slug], aliases: record.aliases,
      familyId: record.familyId, variantOf: record.variantOf,
      compatibility: { legacyId: record.slug, day: record.day, muscle: record.muscle, equipment: record.equipment },
      modality: record.modality, programmingTags: record.programmingTags, movementPatterns: record.movementPatterns, mechanics: record.mechanics,
      equipment: { state: 'curated', assertions: record.equipmentRoles },
      provenanceRefs: record.sourceNativeId === null ? ['big-gains-ekf3-curation-v1'] : [provenanceId(record), 'big-gains-ekf3-curation-v1'],
      rightsRefs: record.sourceNativeId === null ? ['big-gains-project-owned-ekf3'] : ['free-exercise-db-unlicense-b0eed061', 'big-gains-project-owned-ekf3']
    }))
  };
  const measurements = {
    $schema: '../schema/measurement-contract.schema.json', schemaVersion: 1, releaseId: 'ekf-3-curated-catalog-v1',
    description: 'Explicit measurement contracts for the 36 exercises curated in EKF-3.',
    contracts: EKF3_ADDITIONS.map(record => ({
      exerciseId: record.id, legacyId: record.slug, contentRevision: 2, laterality: record.laterality,
      measurement: { trackingModel: record.trackingModel, loadSemantics: { loadBasis: record.loadBasis, resistanceSemantics: record.resistanceSemantics }, repSemantics: record.repSemantics, bodyweightModel: record.bodyweightModel, ui: record.ui },
      analytics: record.analytics, muscles: { primary: record.primary, secondary: record.secondary, stabilizer: record.stabilizer }
    }))
  };
  return { registry, lock, candidates, references, families, exercises, measurements, report: renderReport({ candidates, exercises, measurements }) };
}

function tableList(values) { return values.length ? values.join(', ') : '—'; }
function renderReport({ candidates, exercises, measurements }) {
  const contractById = new Map(measurements.contracts.map(contract => [contract.exerciseId, contract]));
  const sourceById = new Map(EKF3_ADDITIONS.map(record => [record.id, record.sourceNativeId ? `Free Exercise DB \`${record.sourceNativeId}\` + Big Gains curation` : 'Big Gains curated']));
  const rows = exercises.exercises.map(record => {
    const contract = contractById.get(record.id);
    return `| ${record.canonicalName} | \`${record.id}\` | ${tableList(record.aliases)} | ${record.familyId ? `\`${record.familyId}\`` : '—'} | ${record.compatibility.equipment} | ${tableList(record.movementPatterns)} | ${tableList(contract.muscles.primary)} / ${tableList(contract.muscles.secondary)} | \`${contract.measurement.trackingModel}\` | \`${contract.measurement.loadSemantics.loadBasis}\` | \`${contract.measurement.loadSemantics.resistanceSemantics}\` | \`${contract.measurement.repSemantics}\` | \`${contract.laterality}\` | ${contract.analytics.e1rmPermitted ? 'yes' : 'no'} | ${sourceById.get(record.id)} | approved |`;
  });
  const decisionSections = ['accepted', 'rejected', 'quarantined', 'human_review'].map(decision => {
    const records = candidates.candidates.filter(record => record.decision === decision);
    return `### ${decision === 'human_review' ? 'Duplicate/merge candidates requiring human review' : decision[0].toUpperCase() + decision.slice(1)}\n\n${records.map(record => `- \`${record.sourceNativeRecordId}\`${record.canonicalId ? ` → \`${record.canonicalId}\`` : ''} — ${record.rationale} (${record.licenseExpression}; ${record.rightsStatus})`).join('\n')}`;
  }).join('\n\n');
  const tracking = counts(measurements.contracts.map(contract => ({ value: contract.measurement.trackingModel })), 'value');
  const load = counts(measurements.contracts.map(contract => ({ value: contract.measurement.loadSemantics.loadBasis })), 'value');
  const resistance = counts(measurements.contracts.map(contract => ({ value: contract.measurement.loadSemantics.resistanceSemantics })), 'value');
  const reps = counts(measurements.contracts.map(contract => ({ value: contract.measurement.repSemantics })), 'value');
  const lateral = counts(measurements.contracts.map(contract => ({ value: contract.laterality })), 'value');
  const summaryLine = object => Object.entries(object).map(([key, value]) => `\`${key}\` ${value}`).join('; ');
  return `# EKF-3 Curated Catalog Expansion Report

Generated deterministically for \`ekf-3-curated-catalog-v1\` from the pinned curation source. This is an engineering provenance/rights audit, not legal advice.

## 1. Current 119-exercise gap analysis

The accepted EKF-2 catalog is strong in free-weight compounds and baseline cable/bodyweight work, but materially under-covers selectorized and plate-loaded isolation, unilateral machine leg work, Smith variants, glute machines, resisted trunk work, sled/erg conditioning, and forearm isolation. Search coverage also lacks common commercial-gym language for high/low plate-loaded rows, hip-thrust machines, fan bikes, and SkiErg work. EKF-3 narrows those gaps without proliferating minor grip, stance, punctuation, or angle variants.

## 2–6. Candidate review trail

- Candidate records reviewed: **${candidates.summary.reviewed}** (Free Exercise DB 41; wger 5; Big Gains-curated 12)
- Accepted: **${candidates.summary.accepted}**
- Rejected: **${candidates.summary.rejected}**
- Quarantined: **${candidates.summary.quarantined}**
- Unresolved human-review candidates: **${candidates.summary.human_review}**

${decisionSections}

## 7. Final new canonical exercises added

**36** new opaque identities are added, producing **155** distributable exercises. The accepted EKF-2 identities and legacy mappings remain unchanged.

| Canonical name | Canonical ID | Aliases | Family | Equipment | Movement | Primary / secondary muscles | Tracking | Load basis | Resistance | Rep basis | Laterality | e1RM | Source/provenance | Rights |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## 8. Source/license breakdown

- **24** released definitions map selected structured assertions from Free Exercise DB snapshot \`b0eed061e1c832b3ed815fbaa4b45b3cdc14df49\` under \`Unlicense\`; Big Gains curated the release semantics. No source instructions, images, or video are included.
- **12** released definitions are Big Gains-authored/project-owned curation.
- **5** wger candidates are reference-only and quarantined because each exact entry is \`CC-BY-SA-4.0\`. No wger data or AGPL code enters the catalog.

## 9. Measurement-contract breakdown for new records

- Tracking: ${summaryLine(tracking)}
- Load basis: ${summaryLine(load)}
- Resistance: ${summaryLine(resistance)}
- Rep basis: ${summaryLine(reps)}
- Laterality: ${summaryLine(lateral)}
- e1RM eligible: **${measurements.contracts.filter(contract => contract.analytics.e1rmPermitted).length}**; ineligible: **${measurements.contracts.filter(contract => !contract.analytics.e1rmPermitted).length}**

## 10. Existing semantic issues discovered

- \`farmer-carry\` is classified as \`laterality: asymmetric\` in accepted EKF-2 while its contract declares two load units per event. This is reported for later review and is **not changed** by EKF-3.

## Coverage outcome

Added commercial-gym coverage includes cable and dumbbell chest alternatives; machine arm/shoulder isolation; Smith overhead, row, hinge, split-squat, hip-thrust, and calf work; plate-loaded high/low rows; unilateral pulldown and leg isolation; glute-drive/kickback machines; resisted rotation; sled push/drag; fan-bike/SkiErg/battle-rope conditioning; and dumbbell wrist flexion/extension. Machine-instance tracking remains out of scope.
`;
}

async function assertCurrent(root, relative, expected) {
  let actual; try { actual = await readFile(path.join(root, relative), 'utf8'); } catch { fail(`${relative} is missing`); }
  if (actual !== expected) fail(`${relative} is stale; run npm run generate:ekf3-curation`);
}

export async function generate({ root = DEFAULT_ROOT, check = false } = {}) {
  const artifacts = buildArtifacts();
  const rendered = Object.fromEntries(Object.entries(OUTPUTS).map(([key, relative]) => [relative, key === 'report' ? artifacts.report : json(artifacts[key])]));
  if (check) await Promise.all(Object.entries(rendered).map(([relative, expected]) => assertCurrent(root, relative, expected)));
  else {
    await Promise.all([...new Set(Object.keys(rendered).map(relative => path.dirname(path.join(root, relative))))].map(directory => mkdir(directory, { recursive: true })));
    await Promise.all(Object.entries(rendered).map(([relative, content]) => writeFile(path.join(root, relative), content)));
  }
  return { reviewed: artifacts.candidates.summary.reviewed, accepted: artifacts.candidates.summary.accepted, added: artifacts.exercises.exercises.length };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  generate({ check }).then(result => process.stdout.write(`EKF-3 curation ${check ? 'verified' : 'generated'}: ${result.reviewed} reviewed, ${result.accepted} accepted, ${result.added} added.\n`)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
