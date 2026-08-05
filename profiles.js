const PROFILE_CONFIG = {
  jorge: {
    id: 'jorge', name: 'Jorge', storageKey: bigGainsStatePersistence.storageKeyForProfile('jorge'), theme: 'performance',
    goals: { primary: 'Strength and performance' },
    weekPlan: {0:'Rest',1:'Push',2:'Pull',3:'Legs',4:'Push',5:'Pull',6:'Legs'}
  },
  alexa: {
    id: 'alexa', name: 'Alexa', storageKey: bigGainsStatePersistence.storageKeyForProfile('alexa'), theme: 'wellness',
    goals: { primary:'Weight loss', secondary:['Glute and leg growth','Back growth'], startingWeight:225, targetDate:'2026-12-20' },
    weekPlan: {0:'Rest',1:'PilatesPull',2:'LegsLowImpact',3:'Rest',4:'PilatesCardioAccessory',5:'Optional',6:'FullBody'}
  }
};
const activeProfileId = bigGainsStatePersistence.loadActiveProfileId();
const PROFILE = PROFILE_CONFIG[activeProfileId];
document.documentElement.dataset.profile = PROFILE.id;
function switchProfile(profileId) {
  if (!PROFILE_CONFIG[profileId] || profileId === PROFILE.id) return;
  bigGainsStatePersistence.saveActiveProfileId(profileId);
  location.reload();
}
