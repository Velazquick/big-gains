const PROFILE_CONFIG = {
  jorge: {
    id: 'jorge', name: 'Jorge', storageKey: 'big-gains-v2', theme: 'performance',
    goals: { primary: 'Strength and performance' },
    weekPlan: {0:'Rest',1:'Push',2:'Pull',3:'Legs',4:'Push',5:'Pull',6:'Legs'}
  },
  alexa: {
    id: 'alexa', name: 'Alexa', storageKey: 'big-gains-alexa-v1', theme: 'wellness',
    goals: { primary:'Weight loss', secondary:['Glute and leg growth','Back growth'], startingWeight:225, targetDate:'2026-12-20' },
    weekPlan: {0:'Rest',1:'PilatesPull',2:'LegsLowImpact',3:'Rest',4:'PilatesCardioAccessory',5:'Optional',6:'FullBody'}
  }
};
const ACTIVE_PROFILE_KEY = 'big-gains-active-profile';
const activeProfileId = localStorage.getItem(ACTIVE_PROFILE_KEY) === 'alexa' ? 'alexa' : 'jorge';
const PROFILE = PROFILE_CONFIG[activeProfileId];
document.documentElement.dataset.profile = PROFILE.id;
function switchProfile(profileId) {
  if (!PROFILE_CONFIG[profileId] || profileId === PROFILE.id) return;
  localStorage.setItem(ACTIVE_PROFILE_KEY, profileId);
  location.reload();
}
