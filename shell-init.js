(() => {
  'use strict';

  const requiredModules = [
    ['program-plan', () => window.BigGainsProgramSetup],
    ['workout-mode', () => window.bigGainsWorkoutMode],
    ['view-shell', () => window.bigGainsViewShell],
    ['profile-shell', () => window.bigGainsProfileShell],
    ['session-selector', () => window.sessionSelector]
  ];
  const optionalModules = [
    ['training-pet', () => window.trainingPet],
    ['direction', () => window.bigGainsDirection],
    ['sync-gateway', () => window.BigGainsSync],
    ['cloud-sync', () => window.BigGainsCloudSync],
    ['program-portability', () => window.BigGainsProgramPortability],
    ['migration-preview', () => window.BigGainsMigrationPreview],
    ['controlled-migration', () => window.BigGainsControlledMigration]
  ];
  let initialized = false;
  let personalizedInitialized = false;
  let failure = null;

  function initializeModule(name, resolve) {
    const module = resolve();
    if (!module || typeof module.initialize !== 'function') {
      const error = new Error(`Required startup module is unavailable: ${name}.`);
      error.code = 'required-module-missing';
      error.component = name;
      throw error;
    }
    try {
      module.initialize();
    } catch (cause) {
      const error = new Error(`Required startup module failed: ${name}.`);
      error.code = 'required-module-init-failed';
      error.component = name;
      error.cause = cause;
      throw error;
    }
  }

  function initializePersonalized() {
    if (personalizedInitialized) return false;
    const gate = window.BigGainsRuntimeGate;
    gate?.begin('shell-composition');
    try {
      const assetFailure = window.BigGainsAssetStatus?.status?.().requiredFailures?.[0];
      if (assetFailure) {
        const error = new Error('A required startup asset failed.');
        error.code = assetFailure.code;
        error.component = assetFailure.component;
        throw error;
      }
      if (window.BigGainsAppRuntime?.initialized !== true) {
        const error = new Error('The app composition root did not finish.');
        error.code = 'app-composition-incomplete';
        error.component = 'app-runtime';
        throw error;
      }
      requiredModules.forEach(([name, resolve]) => initializeModule(name, resolve));
      optionalModules.forEach(([name, resolve]) => {
        const module = resolve();
        if (!module || typeof module.initialize !== 'function') {
          gate?.degrade(name, 'optional-module-missing');
          return;
        }
        try { module.initialize(); }
        catch { gate?.degrade(name, 'optional-module-init-failed'); }
      });
      personalizedInitialized = true;
      window.BigGainsAssetStatus?.complete?.();
      gate?.markInteractive('core-shell-initialized');
      return true;
    } catch (error) {
      failure = Object.freeze({
        code: error?.code || 'runtime-initialization-failed',
        component: error?.component || 'shell-composition'
      });
      window.BigGainsAssetStatus?.complete?.();
      gate?.fail(failure.code, failure.component);
      return false;
    }
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    if (window.BigGainsBootGate?.canRender()) initializePersonalized();
    else document.addEventListener('big-gains-boot-authorized', initializePersonalized, { once: true });
    try {
      initializeModule('account-onboarding', () => window.BigGainsAccountOnboarding);
    } catch (error) {
      failure = Object.freeze({ code: error.code, component: error.component });
      window.BigGainsAssetStatus?.complete?.();
      window.BigGainsRuntimeGate?.fail(failure.code, failure.component);
    }
    return true;
  }

  window.BigGainsShell = Object.freeze({
    initialize,
    status: () => Object.freeze({ initialized, personalizedInitialized, failure })
  });
  initialize();
})();
