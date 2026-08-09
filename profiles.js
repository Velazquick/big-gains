const MANAGED_PROFILE_CONFIG = {
  jorge: {
    id: 'jorge', name: 'Jorge', theme: 'performance',
    goals: { primary: 'Strength and performance' },
    weekPlan: {0:'Rest',1:'Push',2:'Pull',3:'Legs',4:'Push',5:'Pull',6:'Legs'},
    routineLabels: { Push: 'Jorge Push' },
    capabilities: { allExercises: false, restFallbackWorkout: 'Push', wellnessPresentation: false }
  },
  alexa: {
    id: 'alexa', name: 'Alexa', theme: 'wellness',
    goals: { primary:'Weight loss', secondary:['Glute and leg growth','Back growth'], startingWeight:225, targetDate:'2026-12-20' },
    weekPlan: {0:'Rest',1:'PilatesPull',2:'LegsLowImpact',3:'Rest',4:'PilatesCardioAccessory',5:'Optional',6:'FullBody'},
    capabilities: { allExercises: true, restFallbackWorkout: 'PilatesPull', wellnessPresentation: true }
  }
};
const ACCOUNT = bigGainsAccounts.registry.resolve(bigGainsStatePersistence.loadActiveProfileId());
const SZW_PROFILE_CONFIG_ID = 'independent-09034233fa064233b85018aec182764d';
const SZW_ROUTINES = {
  SzwPush1: {
    label: 'Push 1', exercises: [
      { name: 'Barbell Bench Press', workingSets: 5, targetReps: '5' },
      { name: 'Dumbbell Shoulder Press', workingSets: 3, targetReps: '6–8' },
      { name: 'Incline Dumbbell Press', workingSets: 3, targetReps: '10–12' },
      { name: 'Dumbbell Lateral Raise', workingSets: 4, targetReps: '10–12' },
      { name: 'Cable Triceps Kickback', workingSets: 4, targetReps: '10–12' }
    ]
  },
  SzwPull1: {
    label: 'Pull 1', exercises: [
      { name: 'Deadlift', workingSets: 5, targetReps: '5' },
      { name: 'Iso-Lateral Pulldown Machine', workingSets: 3, targetReps: '10–12' },
      { name: 'Seated Cable Row', workingSets: 3, targetReps: '10–12' },
      { name: 'Face Pull', workingSets: 4, targetReps: '12–15' },
      { name: 'Hammer Curl', workingSets: 4, targetReps: '10–12' },
      { name: 'Dumbbell Shrug', workingSets: 4, targetReps: '10–12' },
      { name: 'EZ-Bar Curl', workingSets: 4, targetReps: '10–12' }
    ]
  },
  SzwLegs1: {
    label: 'Legs 1', exercises: [
      { name: 'Back Squat', workingSets: 5, targetReps: '5' },
      { name: 'Romanian Deadlift', workingSets: 3, targetReps: '10–12' },
      { name: 'Leg Press', workingSets: 3, targetReps: '10–12' },
      { name: 'Calf Press on Leg Press', workingSets: 4, targetReps: 'Failure' },
      { name: 'Seated Leg Curl', workingSets: 4, targetReps: '12–15' }
    ]
  },
  SzwPush2: {
    label: 'Push 2', exercises: [
      { name: 'Iso Machine Shoulder Press', workingSets: 5, targetReps: '5' },
      { name: 'Dumbbell Bench Press', workingSets: 3, targetReps: '8–10' },
      { name: 'Dips', workingSets: 4, targetReps: '10–12' },
      { name: 'Cable Lateral Raise', workingSets: 4, targetReps: '10–12' },
      { name: 'Seated Pec Deck', workingSets: 4, targetReps: '10–12' },
      { name: 'Overhead Triceps Extension', workingSets: 4, targetReps: '10–12' }
    ]
  },
  SzwPull2: {
    label: 'Pull 2', exercises: [
      { name: 'Barbell Row', workingSets: 3, targetReps: '6–8' },
      { name: 'Pull-Up', workingSets: 3, targetReps: '8–10' },
      { name: 'Iso-Lateral Row', workingSets: 3, targetReps: '8–10' },
      { name: 'Cable Curl', workingSets: 4, targetReps: '10–12' },
      { name: 'Barbell Shrug', workingSets: 4, targetReps: '10–12' },
      { name: 'Dumbbell Curl', workingSets: 4, targetReps: '10–12' }
    ]
  },
  SzwLegs2: {
    label: 'Legs 2', exercises: [
      { name: 'Front Squat', workingSets: 5, targetReps: '5' },
      {
        name: 'Hack Squat', workingSets: 3, targetReps: '10–12',
        alternatives: ['Hack Squat', 'Bulgarian Split Squat', 'Single-Leg Press']
      },
      { name: 'Leg Extension', workingSets: 4, targetReps: '10–12' },
      { name: 'Standing Calf Raise', workingSets: 4, targetReps: '12–15' }
    ]
  }
};
const SZW_SESSION_TYPES = [
  { key: 'SzwPush1', label: 'Push 1', detail: 'Chest, shoulders, triceps', index: '01' },
  { key: 'SzwPull1', label: 'Pull 1', detail: 'Back, traps, biceps', index: '02' },
  { key: 'SzwLegs1', label: 'Legs 1', detail: 'Squat, hinge, press', index: '03' },
  { key: 'SzwPush2', label: 'Push 2', detail: 'Shoulders, chest, triceps', index: '04' },
  { key: 'SzwPull2', label: 'Pull 2', detail: 'Rows, pull-ups, arms', index: '05' },
  { key: 'SzwLegs2', label: 'Legs 2', detail: 'Front squat and quad rotation', index: '06' }
];
const genericProfile = account => ({
  id: account.profileId,
  name: account.displayName,
  theme: 'performance',
  goals: { primary: 'Strength and consistency' },
  weekPlan: {0:'Rest',1:'Push',2:'Pull',3:'Legs',4:'Push',5:'Pull',6:'FullBody'},
  routineLabels: { Push: 'Push', Pull: 'Pull — Back + Biceps', Legs: 'Legs + Core' },
  presentation: account.presentation,
  capabilities: { allExercises: true, restFallbackWorkout: 'Push', wellnessPresentation: false }
});
const independentProfile = account => account.profileConfigRef === SZW_PROFILE_CONFIG_ID ? {
  ...genericProfile(account),
  weekPlan: {0:'Rest',1:'SzwPush1',2:'SzwPull1',3:'SzwLegs1',4:'SzwPush2',5:'SzwPull2',6:'SzwLegs2'},
  routines: SZW_ROUTINES,
  libraryRoutineTypes: Object.keys(SZW_ROUTINES),
  sessionTypes: SZW_SESSION_TYPES,
  capabilities: { allExercises: true, restFallbackWorkout: 'SzwPush1', wellnessPresentation: false }
} : genericProfile(account);
const PROFILE_CONFIG = {
  ...MANAGED_PROFILE_CONFIG,
  ...Object.fromEntries(bigGainsAccounts.registry.accounts
    .filter(account => !MANAGED_PROFILE_CONFIG[account.profileConfigRef])
    .map(account => [account.profileConfigRef, independentProfile(account)]))
};
const PROFILE = PROFILE_CONFIG[ACCOUNT.profileConfigRef];
const PRESENTATION = bigGainsAccounts.presentationFor(ACCOUNT.presentation || {
  petEnabled: true,
  accent: PROFILE.id === 'alexa' ? 'rose' : 'ember',
  theme: PROFILE.id === 'alexa' ? 'wellness-light' : 'performance-dark'
});
document.documentElement.dataset.profile = PROFILE.id;
document.documentElement.dataset.profileConfig = ACCOUNT.profileConfigRef;
document.documentElement.dataset.accountMode = bigGainsAccounts.runtime.kind;
document.documentElement.dataset.accent = PRESENTATION.accent;
document.documentElement.dataset.theme = PRESENTATION.theme;
document.documentElement.dataset.petEnabled = String(PRESENTATION.petEnabled);
function switchProfile(profileId) {
  if (!bigGainsAccounts.runtime.switcherVisible) return;
  const account = bigGainsAccounts.registry.resolve(profileId);
  if (!account || account.accountId === ACCOUNT.accountId) return;
  bigGainsStatePersistence.saveActiveProfileId(account.profileId);
  location.reload();
}
