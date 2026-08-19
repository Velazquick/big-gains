(() => {
  'use strict';

  const personalizedModules = [
    window.bigGainsWorkoutMode,
    window.bigGainsViewShell,
    window.bigGainsProfileShell,
    window.trainingPet,
    window.bigGainsDirection,
    window.sessionSelector,
    window.BigGainsSync,
    window.BigGainsCloudSync,
    window.BigGainsMigrationPreview,
    window.BigGainsControlledMigration
  ];
  let initialized = false;
  let personalizedInitialized = false;

  function initializePersonalized() {
    if (personalizedInitialized) return false;
    personalizedInitialized = true;
    personalizedModules.forEach(module => module.initialize());
    return true;
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    if (window.BigGainsBootGate?.canRender()) initializePersonalized();
    else document.addEventListener('big-gains-boot-authorized', initializePersonalized, { once: true });
    window.BigGainsAccountOnboarding.initialize();
    return true;
  }

  window.BigGainsShell = Object.freeze({ initialize });
  initialize();
})();
