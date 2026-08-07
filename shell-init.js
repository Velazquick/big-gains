(() => {
  'use strict';

  const modules = [
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

  function initialize() {
    if (initialized) return false;
    initialized = true;
    modules.forEach(module => module.initialize());
    return true;
  }

  window.BigGainsShell = Object.freeze({ initialize });
  initialize();
})();
