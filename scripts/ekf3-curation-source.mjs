// EKF-3 human-curated source. This module is data-only and has no runtime role.
// Every measurement field is explicit by design; the generator supplies no semantic defaults.

export const EKF3_RETRIEVED_AT = '2026-08-19T02:32:25Z';

export const SOURCE_REGISTRY = [
  {
    id: 'big-gains-source-zero',
    name: 'Big Gains curated catalog',
    kind: 'project_curated',
    repository: 'Velazquick/big-gains',
    sourceLineage: 'big-gains',
    reuseClassification: 'directly_reusable_data',
    rightsPolicy: 'project_owned',
    releaseEligibility: 'approved'
  },
  {
    id: 'free-exercise-db',
    name: 'Free Exercise DB',
    kind: 'external_dataset',
    repository: 'https://github.com/yuhonas/free-exercise-db',
    sourceLineage: 'wrkout/exercises.json',
    reuseClassification: 'directly_reusable_data',
    rightsPolicy: 'Unlicense',
    releaseEligibility: 'approved_structured_data_only',
    excludedRightsSurface: 'images_and_video'
  },
  {
    id: 'wger-exercise-data',
    name: 'wger exercise data',
    kind: 'external_dataset',
    repository: 'https://github.com/wger-project/wger',
    sourceLineage: 'wger-project/wger',
    reuseClassification: 'reference_only_by_default',
    codeLicense: 'AGPL-3.0-or-later',
    rightsPolicy: 'per_entry_creative_commons',
    releaseEligibility: 'entry_specific_review_required'
  }
];

export const SOURCE_LOCK = [
  {
    id: 'free-exercise-db-b0eed061',
    sourceRegistryId: 'free-exercise-db',
    commit: 'b0eed061e1c832b3ed815fbaa4b45b3cdc14df49',
    retrievedAt: EKF3_RETRIEVED_AT,
    repositoryStatus: 'active',
    recordCount: 873,
    dataPath: 'dist/exercises.json',
    dataSha256: 'd68a817484964095e6af0be2cdcbcc2c2504168d1d190c7d5c725ce52f3ae1f4',
    licensePath: 'LICENSE.md',
    licenseExpression: 'Unlicense',
    licenseSha256: '6b0382b16279f26ff69014300541967a356a666eb0b91b422f6862f6b7dad17e',
    sourceLineage: 'wrkout/exercises.json',
    mediaIncluded: false
  },
  {
    id: 'wger-d353d3c8',
    sourceRegistryId: 'wger-exercise-data',
    commit: 'd353d3c82a474f06953c24618167cc15b37c44c6',
    retrievedAt: EKF3_RETRIEVED_AT,
    repositoryStatus: 'active',
    baseRecordCount: 872,
    translationRecordCount: 2429,
    baseDataPath: 'wger/exercises/fixtures/exercise-base-data.json',
    baseDataSha256: '3b003dd64259ef6e06fac5e6cd6fbc7a1170aafebf1ee82b69039454cfc30254',
    translationDataPath: 'wger/exercises/fixtures/translations.json',
    translationDataSha256: 'e76dc38796fa4e002855832209772535aac819043c348a88a98fe3949596c207',
    licensesPath: 'wger/core/fixtures/licenses.json',
    licensesSha256: 'edf3db0c27a00e4650bf6200753f0e02dd851439c95cc846c1aa78c0d07e2c54',
    codeLicense: 'AGPL-3.0-or-later',
    dataLicensePolicy: 'per_entry',
    mediaIncluded: false
  }
];

const noE1rm = Object.freeze({ e1rmPermitted: false, e1rmLoadBasis: null });
const enteredE1rm = Object.freeze({ e1rmPermitted: true, e1rmLoadBasis: 'entered_load' });
const combinedE1rm = Object.freeze({ e1rmPermitted: true, e1rmLoadBasis: 'combined_external_load' });

export const EKF3_FAMILIES = [
  { id: 'fbcd7a13-ac52-4817-9d0a-a6a0ac9d18a0', name: 'Plate-Loaded Row', legacyId: 'plate-loaded-row' },
  { id: '626b4423-b863-4971-9a4c-ea00398218ef', name: 'Sled Work', legacyId: 'sled-work' },
  { id: '9506ca82-ba5d-4501-a4ff-a8bec939f6c0', name: 'Wrist Curl', legacyId: 'wrist-curl' },
  { id: '1c2aed85-b8c5-4b02-a63b-25e055a225ac', name: 'Ergometer', legacyId: 'ergometer' }
];

export const EKF3_ADDITIONS = [
  {
    id: '6b4b0288-3909-4184-ac21-64d4ff6f2c8d', slug: 'cable-chest-press', canonicalName: 'Cable Chest Press',
    aliases: ['Standing Cable Chest Press'], familyId: null, variantOf: null,
    day: 'Push', muscle: 'Chest', equipment: 'Cable', modality: 'resistance', programmingTags: ['push'],
    movementPatterns: ['horizontal_push'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'cable_machine', role: 'resistance' }],
    sourceNativeId: 'Cable_Chest_Press',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Stack weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Chest'], secondary: ['Shoulders', 'Triceps'], stabilizer: []
  },
  {
    id: '2735823a-2a0c-453a-97b3-1c1143f73df4', slug: 'dumbbell-chest-fly', canonicalName: 'Dumbbell Chest Fly',
    aliases: ['Dumbbell Fly', 'Dumbbell Flyes', 'Flat Dumbbell Fly'], familyId: null, variantOf: null,
    day: 'Push', muscle: 'Chest', equipment: 'Dumbbell', modality: 'resistance', programmingTags: ['push'],
    movementPatterns: ['horizontal_push'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'dumbbell', role: 'resistance' }, { equipmentId: 'bench', role: 'support' }],
    sourceNativeId: 'Dumbbell_Flyes',
    laterality: 'independent_bilateral', trackingModel: 'load_reps', loadBasis: 'per_hand', resistanceSemantics: 'external', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Weight per dumbbell', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Chest'], secondary: [], stabilizer: ['Shoulders']
  },
  {
    id: '7bd126a3-ae15-40c7-9022-c86db7164bbc', slug: 'dumbbell-pullover', canonicalName: 'Dumbbell Pullover',
    aliases: ['Bent-Arm Dumbbell Pullover', 'DB Pullover'], familyId: null, variantOf: null,
    day: 'Pull', muscle: 'Back / Chest', equipment: 'Dumbbell', modality: 'resistance', programmingTags: ['pull'],
    movementPatterns: ['shoulder_extension'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'dumbbell', role: 'resistance' }, { equipmentId: 'bench', role: 'support' }],
    sourceNativeId: 'Bent-Arm_Dumbbell_Pullover',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'external', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Dumbbell weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Back'], secondary: ['Chest'], stabilizer: ['Triceps']
  },
  {
    id: 'c24045d6-7940-4d41-9235-613e9dbbb03e', slug: 'dumbbell-floor-press', canonicalName: 'Dumbbell Floor Press',
    aliases: ['DB Floor Press'], familyId: null, variantOf: null,
    day: 'Push', muscle: 'Chest / Triceps', equipment: 'Dumbbell', modality: 'resistance', programmingTags: ['push'],
    movementPatterns: ['horizontal_push', 'elbow_extension'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'dumbbell', role: 'resistance' }],
    sourceNativeId: 'Dumbbell_Floor_Press',
    laterality: 'independent_bilateral', trackingModel: 'load_reps', loadBasis: 'per_hand', resistanceSemantics: 'external', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Weight per dumbbell', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: enteredE1rm,
    primary: ['Triceps'], secondary: ['Chest', 'Shoulders'], stabilizer: []
  },
  {
    id: '7d32114f-b311-4779-ab6c-66a1d853f218', slug: 'dip-machine', canonicalName: 'Dip Machine',
    aliases: ['Seated Dip Machine', 'Machine Dip', 'Triceps Dip Machine'], familyId: null, variantOf: null,
    day: 'Push', muscle: 'Triceps / Chest', equipment: 'Machine', modality: 'resistance', programmingTags: ['push'],
    movementPatterns: ['elbow_extension', 'horizontal_push'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'selectorized_dip_machine', role: 'resistance' }],
    sourceNativeId: 'Dip_Machine',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Triceps'], secondary: ['Chest', 'Shoulders'], stabilizer: []
  },
  {
    id: '7f3b7f8c-5e83-40f4-a292-3e4a520c144a', slug: 'machine-biceps-curl', canonicalName: 'Machine Biceps Curl',
    aliases: ['Biceps Curl Machine', 'Machine Bicep Curl'], familyId: null, variantOf: null,
    day: 'Pull', muscle: 'Biceps', equipment: 'Machine', modality: 'resistance', programmingTags: ['pull'],
    movementPatterns: ['elbow_flexion'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'selectorized_curl_machine', role: 'resistance' }],
    sourceNativeId: 'Machine_Bicep_Curl',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Biceps'], secondary: [], stabilizer: ['Forearms']
  },
  {
    id: 'df2db845-a0db-4e72-8a4c-17c8d82fd856', slug: 'machine-triceps-extension', canonicalName: 'Machine Triceps Extension',
    aliases: ['Triceps Extension Machine'], familyId: null, variantOf: null,
    day: 'Push', muscle: 'Triceps', equipment: 'Machine', modality: 'resistance', programmingTags: ['push'],
    movementPatterns: ['elbow_extension'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'selectorized_triceps_machine', role: 'resistance' }],
    sourceNativeId: 'Machine_Triceps_Extension',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Triceps'], secondary: [], stabilizer: []
  },
  {
    id: 'fbfcb0b8-7e32-4149-89a9-01d5222e3dd8', slug: 'dumbbell-front-raise', canonicalName: 'Dumbbell Front Raise',
    aliases: ['DB Front Raise', 'Front Dumbbell Raise'], familyId: null, variantOf: null,
    day: 'Push', muscle: 'Shoulders', equipment: 'Dumbbell', modality: 'resistance', programmingTags: ['push'],
    movementPatterns: ['other'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'dumbbell', role: 'resistance' }],
    sourceNativeId: 'Front_Dumbbell_Raise',
    laterality: 'independent_bilateral', trackingModel: 'load_reps', loadBasis: 'per_hand', resistanceSemantics: 'external', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Weight per dumbbell', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Shoulders'], secondary: [], stabilizer: []
  },
  {
    id: 'c23dead5-dc07-4397-9695-8e46bfc7c5c5', slug: 'machine-lateral-raise', canonicalName: 'Machine Lateral Raise',
    aliases: ['Lateral Raise Machine', 'Selectorized Lateral Raise'], familyId: null, variantOf: null,
    day: 'Push', muscle: 'Shoulders', equipment: 'Machine', modality: 'resistance', programmingTags: ['push'],
    movementPatterns: ['shoulder_abduction'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'selectorized_lateral_raise_machine', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'independent_bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Shoulders'], secondary: [], stabilizer: []
  },
  {
    id: '356aade0-1c4c-4859-80c3-aaf0d70b65e3', slug: 'smith-machine-overhead-press', canonicalName: 'Smith Machine Overhead Press',
    aliases: ['Smith Machine Shoulder Press', 'Smith Shoulder Press'], familyId: null, variantOf: '766bfd3e-b8c4-4b8e-aba6-1af3e1431aec',
    day: 'Push', muscle: 'Shoulders', equipment: 'Smith Machine', modality: 'resistance', programmingTags: ['push'],
    movementPatterns: ['vertical_push'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'smith_machine', role: 'resistance' }, { equipmentId: 'bench', role: 'support' }],
    sourceNativeId: 'Smith_Machine_Overhead_Shoulder_Press',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Smith machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Shoulders'], secondary: ['Triceps'], stabilizer: []
  },
  {
    id: '4f5681be-74cb-4cab-b104-9773299f6073', slug: 'plate-loaded-high-row', canonicalName: 'Plate-Loaded High Row',
    aliases: ['Leverage High Row', 'Iso-Lateral High Row', 'Hammer Strength High Row'], familyId: 'fbcd7a13-ac52-4817-9d0a-a6a0ac9d18a0', variantOf: null,
    day: 'Pull', muscle: 'Back', equipment: 'Machine', modality: 'resistance', programmingTags: ['pull'],
    movementPatterns: ['horizontal_pull'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'plate_loaded_row_machine', role: 'resistance' }],
    sourceNativeId: 'Leverage_High_Row',
    laterality: 'independent_bilateral', trackingModel: 'load_reps', loadBasis: 'per_side', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Weight per side', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Back'], secondary: ['Biceps'], stabilizer: []
  },
  {
    id: 'e6b99d0a-18e6-46a6-aae3-a5e9badd341b', slug: 'plate-loaded-low-row', canonicalName: 'Plate-Loaded Low Row',
    aliases: ['Leverage Low Row', 'Iso-Lateral Low Row', 'Hammer Strength Low Row'], familyId: 'fbcd7a13-ac52-4817-9d0a-a6a0ac9d18a0', variantOf: null,
    day: 'Pull', muscle: 'Back', equipment: 'Machine', modality: 'resistance', programmingTags: ['pull'],
    movementPatterns: ['horizontal_pull'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'plate_loaded_row_machine', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'independent_bilateral', trackingModel: 'load_reps', loadBasis: 'per_side', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Weight per side', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Back'], secondary: ['Biceps'], stabilizer: []
  },
  {
    id: '7fbd6433-c9f1-4311-8b55-4803aefc9933', slug: 'single-arm-lat-pulldown', canonicalName: 'Single-Arm Lat Pulldown',
    aliases: ['One-Arm Lat Pulldown', 'One Arm Lat Pulldown', 'Single Arm Cable Pulldown'], familyId: '8eb3cd5b-f84d-49d9-99f6-209b88954353', variantOf: 'a1c6ea43-5c0f-4c82-ab3e-c984fcb16306',
    day: 'Pull', muscle: 'Back', equipment: 'Cable', modality: 'resistance', programmingTags: ['pull'],
    movementPatterns: ['vertical_pull'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'cable_machine', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'unilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'reps_per_side', bodyweightModel: null,
    ui: { loadLabel: 'Stack weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps per side' }, analytics: noE1rm,
    primary: ['Back'], secondary: ['Biceps'], stabilizer: []
  },
  {
    id: 'be95b20e-588f-4b5d-a44c-4df806e79798', slug: 'inverted-row', canonicalName: 'Inverted Row',
    aliases: ['Body Row', 'Australian Pull-Up'], familyId: null, variantOf: null,
    day: 'Pull', muscle: 'Back', equipment: 'Bodyweight', modality: 'resistance', programmingTags: ['pull'],
    movementPatterns: ['horizontal_pull'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'rack_or_bar', role: 'support' }],
    sourceNativeId: 'Inverted_Row',
    laterality: 'bilateral', trackingModel: 'reps_only', loadBasis: 'not_applicable', resistanceSemantics: 'bodyweight_only', repSemantics: 'bilateral_cycle', bodyweightModel: 'unsupported_fraction',
    ui: { repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Back'], secondary: ['Biceps'], stabilizer: ['Core']
  },
  {
    id: '67e2fc5b-f97b-42b6-b064-af388b135115', slug: 'smith-machine-bent-over-row', canonicalName: 'Smith Machine Bent-Over Row',
    aliases: ['Smith Machine Row', 'Smith Row'], familyId: null, variantOf: 'e5185176-05a3-4704-97fd-accb0ae5c3e7',
    day: 'Pull', muscle: 'Back', equipment: 'Smith Machine', modality: 'resistance', programmingTags: ['pull'],
    movementPatterns: ['horizontal_pull'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'smith_machine', role: 'resistance' }],
    sourceNativeId: 'Smith_Machine_Bent_Over_Row',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Smith machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Back'], secondary: ['Biceps'], stabilizer: ['Core']
  },
  {
    id: 'e31d21c2-7861-4ac1-b127-b619f7d291f0', slug: 'standing-leg-curl', canonicalName: 'Standing Leg Curl',
    aliases: ['Single-Leg Standing Curl', 'Standing Hamstring Curl'], familyId: null, variantOf: null,
    day: 'Legs', muscle: 'Hamstrings', equipment: 'Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['knee_flexion'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'standing_leg_curl_machine', role: 'resistance' }],
    sourceNativeId: 'Standing_Leg_Curl',
    laterality: 'unilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'reps_per_side', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps per side' }, analytics: noE1rm,
    primary: ['Hamstrings'], secondary: [], stabilizer: []
  },
  {
    id: 'c4da1857-3f99-4655-87f0-699402e50e03', slug: 'single-leg-leg-extension', canonicalName: 'Single-Leg Leg Extension',
    aliases: ['Unilateral Leg Extension', 'One-Leg Leg Extension'], familyId: null, variantOf: 'c22da607-8530-4bee-ac23-65f58bb682fe',
    day: 'Legs', muscle: 'Quads', equipment: 'Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['knee_extension'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'selectorized_leg_extension', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'unilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'reps_per_side', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps per side' }, analytics: noE1rm,
    primary: ['Quads'], secondary: [], stabilizer: []
  },
  {
    id: '7561911b-4087-47a1-83f5-9fe1def2093b', slug: 'single-leg-seated-leg-curl', canonicalName: 'Single-Leg Seated Leg Curl',
    aliases: ['Unilateral Seated Leg Curl', 'One-Leg Seated Curl'], familyId: null, variantOf: '70427367-59ce-47bf-a86d-f65a7a033543',
    day: 'Legs', muscle: 'Hamstrings', equipment: 'Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['knee_flexion'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'selectorized_seated_leg_curl', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'unilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'reps_per_side', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps per side' }, analytics: noE1rm,
    primary: ['Hamstrings'], secondary: [], stabilizer: []
  },
  {
    id: '27803211-c8f0-4210-9857-4fc4aeab039d', slug: 'glute-ham-raise', canonicalName: 'Glute-Ham Raise',
    aliases: ['GHR', 'Glute Ham Developer Raise'], familyId: null, variantOf: null,
    day: 'Legs', muscle: 'Hamstrings / Glutes', equipment: 'Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['knee_flexion', 'hip_extension'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'glute_ham_developer', role: 'support' }],
    sourceNativeId: 'Glute_Ham_Raise',
    laterality: 'bilateral', trackingModel: 'reps_only', loadBasis: 'not_applicable', resistanceSemantics: 'bodyweight_only', repSemantics: 'bilateral_cycle', bodyweightModel: 'unsupported_fraction',
    ui: { repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Hamstrings'], secondary: ['Glutes', 'Calves'], stabilizer: ['Core']
  },
  {
    id: '292eccd2-d34e-4b91-9e99-b655fee2bc01', slug: 'good-morning', canonicalName: 'Good Morning',
    aliases: ['Barbell Good Morning'], familyId: null, variantOf: null,
    day: 'Legs', muscle: 'Hamstrings / Glutes', equipment: 'Barbell', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['hinge'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'barbell', role: 'resistance' }, { equipmentId: 'rack', role: 'support' }],
    sourceNativeId: 'Good_Morning',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'external', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Total weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Hamstrings'], secondary: ['Glutes'], stabilizer: ['Core']
  },
  {
    id: '3b1944c8-b9dc-48a0-85e8-98a41ddf7cef', slug: 'sumo-deadlift', canonicalName: 'Sumo Deadlift',
    aliases: ['Wide-Stance Deadlift'], familyId: null, variantOf: null,
    day: 'Other', muscle: 'Full Body', equipment: 'Barbell', modality: 'resistance', programmingTags: ['full_body'],
    movementPatterns: ['hinge'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'barbell', role: 'resistance' }],
    sourceNativeId: 'Sumo_Deadlift',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'external', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Total weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: combinedE1rm,
    primary: ['Hamstrings', 'Glutes'], secondary: ['Quads', 'Back'], stabilizer: ['Core', 'Forearms']
  },
  {
    id: '873d7ad1-7c25-41e9-a80c-821bdcd0bc2e', slug: 'smith-machine-romanian-deadlift', canonicalName: 'Smith Machine Romanian Deadlift',
    aliases: ['Smith Machine RDL', 'Smith RDL'], familyId: null, variantOf: '643ae68e-7243-4357-ac98-6ce1fb9703b7',
    day: 'Legs', muscle: 'Hamstrings / Glutes', equipment: 'Smith Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['hinge'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'smith_machine', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Smith machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Hamstrings'], secondary: ['Glutes'], stabilizer: ['Core']
  },
  {
    id: 'a8b31e87-3f30-4ea8-89ba-db6f9e5a872c', slug: 'smith-machine-split-squat', canonicalName: 'Smith Machine Split Squat',
    aliases: ['Smith Split Squat'], familyId: null, variantOf: null,
    day: 'Legs', muscle: 'Quads / Glutes', equipment: 'Smith Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['lunge'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'smith_machine', role: 'resistance' }],
    sourceNativeId: 'Smith_Single-Leg_Split_Squat',
    laterality: 'unilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'reps_per_side', bodyweightModel: null,
    ui: { loadLabel: 'Smith machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps per side' }, analytics: noE1rm,
    primary: ['Quads'], secondary: ['Glutes', 'Hamstrings'], stabilizer: ['Calves']
  },
  {
    id: 'd1c6bd5a-f193-4207-9e03-9a311d0813bc', slug: 'smith-machine-hip-thrust', canonicalName: 'Smith Machine Hip Thrust',
    aliases: ['Smith Hip Thrust'], familyId: null, variantOf: '7492bccf-54b4-430b-a6b9-bb7d567952a1',
    day: 'Legs', muscle: 'Glutes', equipment: 'Smith Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['hip_extension'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'smith_machine', role: 'resistance' }, { equipmentId: 'bench', role: 'support' }],
    sourceNativeId: null,
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Smith machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Glutes'], secondary: ['Hamstrings'], stabilizer: ['Core']
  },
  {
    id: '796289cd-eac0-4ec3-b569-4f5731a74eb0', slug: 'glute-drive-machine', canonicalName: 'Glute Drive Machine',
    aliases: ['Hip Thrust Machine', 'Machine Hip Thrust'], familyId: null, variantOf: '7492bccf-54b4-430b-a6b9-bb7d567952a1',
    day: 'Legs', muscle: 'Glutes', equipment: 'Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['hip_extension'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'glute_drive_machine', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Glutes'], secondary: ['Hamstrings'], stabilizer: ['Core']
  },
  {
    id: 'b4eea2ad-81e8-4a93-9bfc-563884204cd4', slug: 'machine-glute-kickback', canonicalName: 'Machine Glute Kickback',
    aliases: ['Glute Kickback Machine', 'Machine Hip Extension'], familyId: null, variantOf: '7e0cb04c-b637-46b0-a97b-bbf11fc693e4',
    day: 'Legs', muscle: 'Glutes', equipment: 'Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['hip_extension'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'glute_kickback_machine', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'unilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'reps_per_side', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps per side' }, analytics: noE1rm,
    primary: ['Glutes'], secondary: ['Hamstrings'], stabilizer: []
  },
  {
    id: 'c056e322-1298-4fd3-a934-02266e6133b4', slug: 'smith-machine-calf-raise', canonicalName: 'Smith Machine Calf Raise',
    aliases: ['Smith Calf Raise'], familyId: '10fb6ea4-b91c-40fa-936b-125dd8c4141d', variantOf: '2a7b9098-26cd-4222-8ade-38d4e49baecc',
    day: 'Legs', muscle: 'Calves', equipment: 'Smith Machine', modality: 'resistance', programmingTags: ['legs'],
    movementPatterns: ['calf_raise'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'smith_machine', role: 'resistance' }, { equipmentId: 'calf_block', role: 'support' }],
    sourceNativeId: 'Smith_Machine_Calf_Raise',
    laterality: 'bilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Smith machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Calves'], secondary: [], stabilizer: []
  },
  {
    id: '18b80e62-4a20-4275-b87d-d1a4f4344df4', slug: 'cable-wood-chop', canonicalName: 'Cable Wood Chop',
    aliases: ['Standing Cable Wood Chop', 'Cable Woodchop'], familyId: null, variantOf: null,
    day: 'Legs', muscle: 'Core', equipment: 'Cable', modality: 'resistance', programmingTags: ['core'],
    movementPatterns: ['trunk_rotation'], mechanics: 'compound', equipmentRoles: [{ equipmentId: 'cable_machine', role: 'resistance' }],
    sourceNativeId: 'Standing_Cable_Wood_Chop',
    laterality: 'asymmetric', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'reps_per_side', bodyweightModel: null,
    ui: { loadLabel: 'Stack weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps per side' }, analytics: noE1rm,
    primary: ['Core'], secondary: ['Shoulders'], stabilizer: []
  },
  {
    id: '9b0f4524-f54d-4b20-88ce-bea81b7707ef', slug: 'rotary-torso-machine', canonicalName: 'Rotary Torso Machine',
    aliases: ['Torso Rotation Machine', 'Machine Torso Rotation'], familyId: null, variantOf: null,
    day: 'Legs', muscle: 'Core', equipment: 'Machine', modality: 'resistance', programmingTags: ['core'],
    movementPatterns: ['trunk_rotation'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'rotary_torso_machine', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'unilateral', trackingModel: 'load_reps', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'reps_per_side', bodyweightModel: null,
    ui: { loadLabel: 'Machine weight', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps per side' }, analytics: noE1rm,
    primary: ['Core'], secondary: [], stabilizer: []
  },
  {
    id: 'fa1606ef-97f4-42cc-97e2-c52636755dad', slug: 'sled-push', canonicalName: 'Sled Push',
    aliases: ['Prowler Push'], familyId: '626b4423-b863-4971-9a4c-ea00398218ef', variantOf: null,
    day: 'Other', muscle: 'Full Body', equipment: 'Sled', modality: 'resistance', programmingTags: ['full_body'],
    movementPatterns: ['locomotion'], mechanics: 'mixed', equipmentRoles: [{ equipmentId: 'weighted_sled', role: 'resistance' }],
    sourceNativeId: 'Sled_Push',
    laterality: 'not_applicable', trackingModel: 'load_distance', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'not_applicable', bodyweightModel: null,
    ui: { loadLabel: 'Sled load', loadUnit: 'lb', loadStep: 5, distanceLabel: 'Distance', distanceUnit: 'ft', distanceStep: 5 }, analytics: noE1rm,
    primary: ['Full Body'], secondary: [], stabilizer: []
  },
  {
    id: '03b856c5-c1e1-49b5-80a7-c567199909b6', slug: 'backward-sled-drag', canonicalName: 'Backward Sled Drag',
    aliases: ['Backward Drag', 'Reverse Sled Drag'], familyId: '626b4423-b863-4971-9a4c-ea00398218ef', variantOf: null,
    day: 'Other', muscle: 'Quads', equipment: 'Sled', modality: 'resistance', programmingTags: ['legs', 'full_body'],
    movementPatterns: ['locomotion'], mechanics: 'mixed', equipmentRoles: [{ equipmentId: 'weighted_sled', role: 'resistance' }],
    sourceNativeId: 'Backward_Drag',
    laterality: 'not_applicable', trackingModel: 'load_distance', loadBasis: 'total', resistanceSemantics: 'machine_indicated', repSemantics: 'not_applicable', bodyweightModel: null,
    ui: { loadLabel: 'Sled load', loadUnit: 'lb', loadStep: 5, distanceLabel: 'Distance', distanceUnit: 'ft', distanceStep: 5 }, analytics: noE1rm,
    primary: ['Quads'], secondary: ['Glutes', 'Hamstrings'], stabilizer: ['Core']
  },
  {
    id: '63ce5b42-a77d-4e17-8fde-992e99646d82', slug: 'air-bike', canonicalName: 'Air Bike',
    aliases: ['Assault Bike', 'Fan Bike'], familyId: '1c2aed85-b8c5-4b02-a63b-25e055a225ac', variantOf: null,
    day: 'Cardio', muscle: 'Cardio', equipment: 'Bike', modality: 'cardio', programmingTags: ['cardio', 'full_body'],
    movementPatterns: ['cyclic'], mechanics: 'cyclic', equipmentRoles: [{ equipmentId: 'air_bike', role: 'resistance' }],
    sourceNativeId: 'Air_Bike',
    laterality: 'not_applicable', trackingModel: 'distance_duration', loadBasis: 'not_applicable', resistanceSemantics: 'not_applicable', repSemantics: 'not_applicable', bodyweightModel: null,
    ui: { distanceLabel: 'Distance', distanceUnit: 'mi', distanceStep: 0.1, durationLabel: 'Duration', durationUnit: 'sec', durationStep: 5 }, analytics: noE1rm,
    primary: ['Cardio'], secondary: [], stabilizer: []
  },
  {
    id: '38ed2c6d-9ff2-4bb5-9b08-108d9443cac6', slug: 'ski-erg', canonicalName: 'Ski Erg',
    aliases: ['SkiErg', 'Ski Ergometer'], familyId: '1c2aed85-b8c5-4b02-a63b-25e055a225ac', variantOf: null,
    day: 'Cardio', muscle: 'Cardio', equipment: 'Machine', modality: 'cardio', programmingTags: ['cardio', 'full_body'],
    movementPatterns: ['cyclic'], mechanics: 'cyclic', equipmentRoles: [{ equipmentId: 'ski_ergometer', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'not_applicable', trackingModel: 'distance_duration', loadBasis: 'not_applicable', resistanceSemantics: 'not_applicable', repSemantics: 'not_applicable', bodyweightModel: null,
    ui: { distanceLabel: 'Distance', distanceUnit: 'm', distanceStep: 50, durationLabel: 'Duration', durationUnit: 'sec', durationStep: 5 }, analytics: noE1rm,
    primary: ['Cardio'], secondary: [], stabilizer: []
  },
  {
    id: '872759cb-cc58-4fc9-ba84-9eb784d6c542', slug: 'battle-rope-waves', canonicalName: 'Battle Rope Waves',
    aliases: ['Battle Ropes', 'Rope Waves'], familyId: null, variantOf: null,
    day: 'Cardio', muscle: 'Full Body', equipment: 'Battle Rope', modality: 'cardio', programmingTags: ['cardio', 'full_body'],
    movementPatterns: ['other'], mechanics: 'cyclic', equipmentRoles: [{ equipmentId: 'battle_rope', role: 'resistance' }],
    sourceNativeId: null,
    laterality: 'not_applicable', trackingModel: 'duration', loadBasis: 'not_applicable', resistanceSemantics: 'not_applicable', repSemantics: 'not_applicable', bodyweightModel: null,
    ui: { durationLabel: 'Duration', durationUnit: 'sec', durationStep: 5 }, analytics: noE1rm,
    primary: ['Full Body'], secondary: [], stabilizer: []
  },
  {
    id: 'b078a32f-81ee-4455-ac88-e0eb75291840', slug: 'dumbbell-wrist-curl', canonicalName: 'Dumbbell Wrist Curl',
    aliases: ['Palms-Up Dumbbell Wrist Curl', 'DB Wrist Curl'], familyId: '9506ca82-ba5d-4501-a4ff-a8bec939f6c0', variantOf: null,
    day: 'Pull', muscle: 'Forearms', equipment: 'Dumbbell', modality: 'resistance', programmingTags: ['pull'],
    movementPatterns: ['other'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'dumbbell', role: 'resistance' }, { equipmentId: 'bench', role: 'support' }],
    sourceNativeId: 'Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench',
    laterality: 'independent_bilateral', trackingModel: 'load_reps', loadBasis: 'per_hand', resistanceSemantics: 'external', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Weight per dumbbell', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Forearms'], secondary: [], stabilizer: []
  },
  {
    id: 'b5f7b82a-5463-4621-80ad-d869f50c0c86', slug: 'dumbbell-reverse-wrist-curl', canonicalName: 'Dumbbell Reverse Wrist Curl',
    aliases: ['Palms-Down Dumbbell Wrist Curl', 'DB Reverse Wrist Curl'], familyId: '9506ca82-ba5d-4501-a4ff-a8bec939f6c0', variantOf: null,
    day: 'Pull', muscle: 'Forearms', equipment: 'Dumbbell', modality: 'resistance', programmingTags: ['pull'],
    movementPatterns: ['other'], mechanics: 'isolation', equipmentRoles: [{ equipmentId: 'dumbbell', role: 'resistance' }, { equipmentId: 'bench', role: 'support' }],
    sourceNativeId: 'Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench',
    laterality: 'independent_bilateral', trackingModel: 'load_reps', loadBasis: 'per_hand', resistanceSemantics: 'external', repSemantics: 'bilateral_cycle', bodyweightModel: null,
    ui: { loadLabel: 'Weight per dumbbell', loadUnit: 'lb', loadStep: 5, repsLabel: 'Reps' }, analytics: noE1rm,
    primary: ['Forearms'], secondary: [], stabilizer: []
  }
];

// Only the structured fields reviewed for candidate selection are retained. Instructions and
// media paths are deliberately excluded. sourcePayloadSha256 binds each selection to its full
// record in the pinned upstream snapshot.
export const FREE_EXERCISE_DB_RECORDS = [
  ['Cable_Chest_Press', 'Cable Chest Press', 'cable', 'compound', ['chest'], ['shoulders', 'triceps'], '0e2f000895d541f64617167b9ebc4a8b8628546bb518273a556c674322386642'],
  ['Dumbbell_Flyes', 'Dumbbell Flyes', 'dumbbell', 'isolation', ['chest'], [], 'ce44a78a87a3391f3f74be8293aa19f9743a5dffd472cddbea1d1f0e0959fc0d'],
  ['Bent-Arm_Dumbbell_Pullover', 'Bent-Arm Dumbbell Pullover', 'dumbbell', 'compound', ['chest'], ['lats', 'shoulders', 'triceps'], 'b38009623b2d72bb74da83a9ded571950c9ce543726daefb8efb7cb5f0ec6406'],
  ['Dumbbell_Floor_Press', 'Dumbbell Floor Press', 'dumbbell', 'compound', ['triceps'], ['chest', 'shoulders'], '19cacfceeb4583205a5ee6af045cb9a33997e278c515fb7b13539fd2376c583c'],
  ['Dip_Machine', 'Dip Machine', 'machine', 'compound', ['triceps'], ['chest', 'shoulders'], '7239b44d1936c546278b581022a2df743121de9547e70e2cb1d3c731312ab6b4'],
  ['Machine_Bicep_Curl', 'Machine Bicep Curl', 'machine', 'isolation', ['biceps'], [], '9af8a9e7f407c524ae2ed830859a464ad2d3e34260030cfa2219b1e278c4bb1c'],
  ['Machine_Triceps_Extension', 'Machine Triceps Extension', 'machine', 'isolation', ['triceps'], [], 'd626d585d6df65a5e706416756b8dabb4ee1880f22df98f6ff40845f354151f1'],
  ['Front_Dumbbell_Raise', 'Front Dumbbell Raise', 'dumbbell', 'isolation', ['shoulders'], [], '168435a7e35dc7827468a4cdd2241231ecf5cf4d4c1373ceab19d83f7198a124'],
  ['Smith_Machine_Overhead_Shoulder_Press', 'Smith Machine Overhead Shoulder Press', 'machine', 'compound', ['shoulders'], ['triceps'], '658072a5f3aaf0a970e37a2020523f6f826de6700a36111fe140cc479d867595'],
  ['Leverage_High_Row', 'Leverage High Row', 'machine', 'compound', ['middle back'], ['lats'], '239a99c7847b8672739423c02fd83235c47002965acf28f764a62f02d1b0c957'],
  ['Inverted_Row', 'Inverted Row', null, 'compound', ['middle back'], ['lats'], '4a6f77ef6dfebe7b51fbee727626f0fb168fa116caeb2b60e5af3f7bb44db02c'],
  ['Smith_Machine_Bent_Over_Row', 'Smith Machine Bent Over Row', 'machine', 'compound', ['middle back'], ['biceps', 'lats', 'shoulders'], 'bb99ef4cef7a168eaca65d6d9f1bd085c49a0f6eab081413ff2295a0d99ea6f0'],
  ['Standing_Leg_Curl', 'Standing Leg Curl', 'machine', 'isolation', ['hamstrings'], [], '48bd127978f6929081fe89fe921a0b1e07d6fbed56b4b1dca858a4983e564aa0'],
  ['Glute_Ham_Raise', 'Glute Ham Raise', 'machine', 'compound', ['hamstrings'], ['calves', 'glutes'], '495be4d36c66a3d6d9d49b03951e3de49e01ff8f339e0b66c3c7d5b02bbb2487'],
  ['Good_Morning', 'Good Morning', 'barbell', 'compound', ['hamstrings'], ['abdominals', 'glutes', 'lower back'], '4e0fc5435018f3b449d897b3c531bd7b8a5d72c16617bb62156dfc31a872bc6a'],
  ['Sumo_Deadlift', 'Sumo Deadlift', 'barbell', 'compound', ['hamstrings'], ['adductors', 'forearms', 'glutes', 'lower back', 'middle back', 'quadriceps', 'traps'], 'e11c64fe150e755d7f6d618f265dfefa0bcdc0a37b6723c67064b07d5b97d874'],
  ['Smith_Single-Leg_Split_Squat', 'Smith Single-Leg Split Squat', 'machine', 'compound', ['quadriceps'], ['calves', 'glutes', 'hamstrings'], '325270fcd4ea63735bd86494a9ba0a0e01c435208fe89fdeb3bccb06700815e2'],
  ['Smith_Machine_Calf_Raise', 'Smith Machine Calf Raise', 'machine', 'isolation', ['calves'], [], 'd9ed2dcd33d1ba205c7a9f7d3a77d77a5c8b775234437f7cd76464042132b6c7'],
  ['Standing_Cable_Wood_Chop', 'Standing Cable Wood Chop', 'cable', 'compound', ['abdominals'], ['shoulders'], '378df5889b5906d7234b0566ec462e3b557adbda2a48f24e43cbbb0b146142af'],
  ['Sled_Push', 'Sled Push', 'other', 'compound', ['quadriceps'], ['calves', 'chest', 'glutes', 'hamstrings', 'triceps'], 'ae1930938aa568e7c6e32905af20b704195e5fa1f0093964155bfa5c609f5697'],
  ['Backward_Drag', 'Backward Drag', 'other', 'compound', ['quadriceps'], ['calves', 'forearms', 'glutes', 'hamstrings', 'lower back'], '5a24fb8edd97dcf3ad27f63db553723b6a50be14f92dbc98873bc0e7de3593e4'],
  ['Air_Bike', 'Air Bike', 'body only', 'compound', ['abdominals'], [], '647007853d07d23a2ab8b0b2a7e23a2a58644a6b077330863e3943fc0a41b0e8'],
  ['Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench', 'Palms-Up Dumbbell Wrist Curl Over A Bench', 'dumbbell', 'isolation', ['forearms'], [], 'd29f182f4d68bf3327f5508a0abccaf42af63e818722b4086cbc0f9d09eab87e'],
  ['Palms-Down_Dumbbell_Wrist_Curl_Over_A_Bench', 'Palms-Down Dumbbell Wrist Curl Over A Bench', 'dumbbell', 'isolation', ['forearms'], [], '782d083586c9d870ea550381fab612f167750ebb9f29523999d3ac1eecac2547'],
  ['Machine_Bench_Press', 'Machine Bench Press', 'machine', 'compound', ['chest'], ['shoulders', 'triceps'], '6120aca484352a96ccb41d4ecb6cd178ac7e3247d466cbacf8da9c83d72572e6'],
  ['Leverage_Chest_Press', 'Leverage Chest Press', 'machine', 'compound', ['chest'], ['shoulders', 'triceps'], '7329678699e328900a4b761a892a5213848c0139bdbfd18f1bde22683c27f899'],
  ['Leverage_Incline_Chest_Press', 'Leverage Incline Chest Press', 'machine', 'compound', ['chest'], ['shoulders', 'triceps'], 'f7d125c6b921eee6025fbec1c34194e5a34b8c395ac97e51fea9c07d5985b471'],
  ['Machine_Preacher_Curls', 'Machine Preacher Curls', 'machine', 'isolation', ['biceps'], [], '15b572a52f6fa00c8e16b23f71c691b117d4a7b6517902872342c134881281a3'],
  ['Reverse_Machine_Flyes', 'Reverse Machine Flyes', 'machine', 'isolation', ['shoulders'], [], '13d5e0628996e790d3d72f70eda94a6677a44615907c950fc0073148768c82a8'],
  ['Calf_Press_On_The_Leg_Press_Machine', 'Calf Press On The Leg Press Machine', 'machine', 'isolation', ['calves'], [], '620099cddf16e6a1d9e7e5a4a138ea9d442b33602f7ec1216d108e69334ff112'],
  ['Ab_Crunch_Machine', 'Ab Crunch Machine', 'machine', 'isolation', ['abdominals'], [], 'c265fb99c0f399132f25e10d2817d32f314d7d50da6e4195c98bf01830b2cd3d'],
  ['Farmers_Walk', "Farmer's Walk", 'other', 'compound', ['forearms'], ['abdominals', 'glutes', 'hamstrings', 'lower back', 'quadriceps', 'traps'], '228428682e1acbc3f9babc2a224077196e90ce1352921f33da9ffedd58e4a726'],
  ['Decline_Smith_Press', 'Decline Smith Press', 'machine', 'compound', ['chest'], ['shoulders', 'triceps'], '845c0cd7c94592aa371f7f3b1c370e06750de3b07033e42099aeff96fe584d42'],
  ['Standing_Cable_Chest_Press', 'Standing Cable Chest Press', 'cable', 'compound', ['chest'], ['shoulders', 'triceps'], '70cd9c340d09f8fc84c5e919c12ba99f768ccace21307088e2fd9f779e696667'],
  ['Natural_Glute_Ham_Raise', 'Natural Glute Ham Raise', 'body only', 'compound', ['hamstrings'], ['calves', 'glutes', 'lower back'], '99a4e7f3041fb0df54d59aa30f179a1ad68fea3d9248dc9f27737939258c4340'],
  ['Machine_Shoulder_Military_Press', 'Machine Shoulder (Military) Press', 'machine', 'compound', ['shoulders'], ['triceps'], '1649f2d2a2831ef22836b2393bf473cc56ede4f686ee131dffccb44ae87e3602'],
  ['Leverage_Iso_Row', 'Leverage Iso Row', 'machine', 'compound', ['lats'], ['biceps', 'middle back'], '3e4591705581f89fb0f8a17c98db5dbad2d748439550f2e478a9110045d22e4b'],
  ['Straight-Arm_Dumbbell_Pullover', 'Straight-Arm Dumbbell Pullover', 'dumbbell', 'compound', ['chest'], ['lats', 'shoulders', 'triceps'], '03c4125874ae8e75ee9f0d753061a874c10169d528dd789e7cc756b28fd0317f'],
  ['Donkey_Calf_Raises', 'Donkey Calf Raises', 'other', 'isolation', ['calves'], [], '69a865acaad7f65a8a3fd0bbf5dc23773a8c0f06b87b8cac9a4c0b4bbceff161'],
  ['Leverage_Decline_Chest_Press', 'Leverage Decline Chest Press', 'machine', 'compound', ['chest'], ['shoulders', 'triceps'], '2632c1c3f3040c425cca34d3a3d97c1b47565da74685f1fa3576f2be4edfdc99'],
  ['Smith_Machine_Stiff-Legged_Deadlift', 'Smith Machine Stiff-Legged Deadlift', 'machine', 'compound', ['hamstrings'], ['glutes', 'lower back'], '6d236b0f73eb179b4b931e647cc921f2b1178b7bf782608dea3481c7938a14e1']
].map(([id, name, equipment, mechanic, primaryMuscles, secondaryMuscles, sourcePayloadSha256]) => ({
  id, name, equipment, mechanic, primaryMuscles, secondaryMuscles, sourcePayloadSha256
}));

const rejectedReasons = {
  Machine_Bench_Press: 'Duplicates the released selectorized Seated Machine Chest Press identity.',
  Leverage_Chest_Press: 'Machine coupling and load basis are unclear against two existing chest-press identities.',
  Leverage_Incline_Chest_Press: 'Does not add a defensible identity beyond the released incline iso-machine press.',
  Machine_Preacher_Curls: 'Duplicates the released Machine Preacher Curl.',
  Reverse_Machine_Flyes: 'Duplicates the released Reverse Pec Deck.',
  Calf_Press_On_The_Leg_Press_Machine: 'Duplicates the released Calf Press on Leg Press.',
  Ab_Crunch_Machine: 'Duplicates the released Machine Crunch.',
  Farmers_Walk: 'Duplicates the released Farmer Carry.',
  Decline_Smith_Press: 'Narrow angle variant did not clear the EKF-3 useful-coverage threshold.',
  Standing_Cable_Chest_Press: 'Captured as an alias of Cable Chest Press instead of a second canonical identity.',
  Natural_Glute_Ham_Raise: 'Overlaps the released Nordic Hamstring Curl and adds no machine identity.',
  Machine_Shoulder_Military_Press: 'Duplicates the released Machine Shoulder Press.'
};

const reviewReasons = {
  Leverage_Iso_Row: 'May duplicate the released Iso-Lateral Row; source does not prove handle path or load basis.',
  'Straight-Arm_Dumbbell_Pullover': 'Elbow configuration may justify a separate identity from the accepted bent-arm pullover.',
  Donkey_Calf_Raises: 'Source equipment is other, leaving bodyweight, partner-loaded, and machine variants unresolved.',
  Leverage_Decline_Chest_Press: 'Potentially useful, but coupling and per-side versus total load semantics are not proven.',
  'Smith_Machine_Stiff-Legged_Deadlift': 'Must not be auto-merged with the curated Smith Romanian deadlift; knee and hip semantics may differ.'
};

export const FREE_EXERCISE_DB_DECISIONS = FREE_EXERCISE_DB_RECORDS.map(record => {
  const target = EKF3_ADDITIONS.find(addition => addition.sourceNativeId === record.id);
  if (target) return { sourceNativeRecordId: record.id, decision: 'accepted', canonicalId: target.id, rationale: 'Useful coverage gap; source assertion mapped and Big Gains semantics curated independently.' };
  if (rejectedReasons[record.id]) return { sourceNativeRecordId: record.id, decision: 'rejected', canonicalId: null, rationale: rejectedReasons[record.id] };
  return { sourceNativeRecordId: record.id, decision: 'human_review', canonicalId: null, rationale: reviewReasons[record.id] };
});

export const WGER_RECORDS = [
  ['translation:2387', 'f07d4a46-2ece-4d2f-9319-cc23f4086320', 1424, 'e68f6d51-fe02-4175-b277-dec0c1521f36', 'Biceps Curl Machine', 'hpmbala@gmail.com', '775fd60a25df3a5199b88a42b7f6f246b2aee81d1beb2c9d5fb073332e2c9446'],
  ['translation:2079', '22319024-a420-4a24-849d-759c4ae79bf8', 1116, '3393db0b-98b7-4d53-a0d4-985f97875295', "Dumbbell farmer's carry", 'philip', 'ede922e0813b07b8223933b985b46a9060fe41e6e367f660026ef63413e4a117'],
  ['translation:2159', '121f6364-0901-4e90-9895-b3937b348fb4', 1200, 'f5252fbe-1e00-4b8d-8781-2e56d6a5250f', 'Tibialis raises', 'cynomops', '5280e6f2ead84c0cb7fad55d5a1ce26f0882edf8b58244f33de47a9986545893'],
  ['translation:2109', '00a01320-1382-4f36-aa1e-d603a180c0e6', 1132, 'ab872d04-ca20-4341-b3c9-76763b25ef42', 'Extensión de gluteo en máquina', 'Franpol', 'e58e667b02960629a82957828a6272482438fbe502997268276b01a6f62e3675'],
  ['translation:2338', 'a449c082-6e26-44fe-a2bf-506ad7753005', 1372, '3dd0db1c-450a-46d1-ad46-d7854bdc26ed', 'Triceps Dips (Assisted)', 'matpn', '32120c66c9362cea321b1879c2aa8913b2ce4f7ed982ce2f9b35ec58e1504c9c']
].map(([sourceNativeRecordId, translationUuid, exercisePk, exerciseUuid, name, attribution, sourcePayloadSha256]) => ({
  sourceNativeRecordId, translationUuid, exercisePk, exerciseUuid, name, attribution,
  licenseExpression: 'CC-BY-SA-4.0', rightsStatus: 'quarantined', sourcePayloadSha256,
  rationale: 'Exact entry is ShareAlike; EKF-3 policy does not admit BY-SA data into the distributable catalog.'
}));

export const BIG_GAINS_CURATED_DECISIONS = EKF3_ADDITIONS
  .filter(addition => addition.sourceNativeId === null)
  .map(addition => ({
    sourceNativeRecordId: `big-gains:${addition.slug}`,
    decision: 'accepted', canonicalId: addition.id,
    rationale: 'Big Gains-curated definition fills a verified commercial-gym gap without importing third-party expression.'
  }));
