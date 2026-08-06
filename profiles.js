const PROFILE_CONFIG = {
  jorge: {
    id: 'jorge', name: 'Jorge', theme: 'performance',
    goals: { primary: 'Strength and performance' },
    weekPlan: {0:'Rest',1:'Push',2:'Pull',3:'Legs',4:'Push',5:'Pull',6:'Legs'},
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
const PROFILE = PROFILE_CONFIG[ACCOUNT.profileConfigRef];
document.documentElement.dataset.profile = PROFILE.id;
function switchProfile(profileId) {
  const account = bigGainsAccounts.registry.resolve(profileId);
  if (!account || account.accountId === ACCOUNT.accountId) return;
  bigGainsStatePersistence.saveActiveProfileId(account.profileId);
  location.reload();
}
