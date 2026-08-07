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
const PROFILE_CONFIG = {
  ...MANAGED_PROFILE_CONFIG,
  ...Object.fromEntries(bigGainsAccounts.registry.accounts
    .filter(account => !MANAGED_PROFILE_CONFIG[account.profileConfigRef])
    .map(account => [account.profileConfigRef, genericProfile(account)]))
};
const PROFILE = PROFILE_CONFIG[ACCOUNT.profileConfigRef];
const PRESENTATION = bigGainsAccounts.presentationFor(ACCOUNT.presentation || {
  petEnabled: true,
  accent: PROFILE.id === 'alexa' ? 'rose' : 'ember',
  theme: PROFILE.id === 'alexa' ? 'wellness-light' : 'performance-dark'
});
document.documentElement.dataset.profile = PROFILE.id;
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
