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
  let startRouterInstalled = false;

  function enterTrain() {
    if (window.bigGainsViewShell?.showView) {
      window.bigGainsViewShell.showView('train', { workout: true });
      return;
    }
    document.querySelector('.bottom-nav [data-view="train"]')?.click();
  }

  function revealActiveWorkout() {
    enterTrain();
    window.setTimeout(() => {
      try {
        if (typeof showActive === 'function') showActive(true);
      } catch (error) {
        console.warn('Could not render the active workout after start', error);
      }
    }, 0);
  }

  function hasActiveWorkout() {
    return typeof active !== 'undefined' && Boolean(active);
  }

  function startManualWorkout(button) {
    if (hasActiveWorkout()) {
      revealActiveWorkout();
      return active;
    }

    const previewType = document.getElementById('trainPreview')?.dataset.workoutType;
    const plannedType = typeof todaysWorkout === 'function' ? todaysWorkout() : null;
    const fallbackType = typeof selectedDay !== 'undefined' ? selectedDay : null;
    const workoutType = button.id === 'startWorkout'
      ? (plannedType && plannedType !== 'Rest' ? plannedType : null)
      : (previewType || fallbackType || (plannedType !== 'Rest' ? plannedType : null));

    if (!workoutType || workoutType === 'Rest' || typeof startWorkout !== 'function') {
      throw new Error('Workout start is unavailable for the selected session.');
    }

    const session = startWorkout(workoutType, true);
    if (!session && !hasActiveWorkout()) throw new Error('Workout session did not start.');
    revealActiveWorkout();
    return session || active;
  }

  function startProgramWorkout() {
    if (hasActiveWorkout()) {
      revealActiveWorkout();
      return active;
    }
    if (typeof window.BigGainsProgramSetup?.startNextProgramSession !== 'function') {
      throw new Error('Program session start is unavailable.');
    }

    const session = window.BigGainsProgramSetup.startNextProgramSession();
    if (!session && !hasActiveWorkout()) throw new Error('Program session did not start.');
    revealActiveWorkout();
    return session || active;
  }

  function reportStartFailure(error) {
    console.warn('Big Gains workout start failed', error);
    const heroNote = document.getElementById('heroNote');
    if (heroNote) heroNote.textContent = 'Could not start the workout. Try once more.';
  }

  function installStartRouter() {
    if (startRouterInstalled) return;
    startRouterInstalled = true;
    document.addEventListener('click', event => {
      const button = event.target.closest?.('#startWorkout, #quickStartSession, #trainPreviewStart, [data-start-program-session]');
      if (!button || button.disabled) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      try {
        if (button.matches('[data-start-program-session]')) startProgramWorkout();
        else startManualWorkout(button);
      } catch (error) {
        // The session controller persists before rendering. If rendering was the only
        // failure, keep the valid active session and route the user into Train.
        if (hasActiveWorkout()) {
          revealActiveWorkout();
          return;
        }
        reportStartFailure(error);
      }
    }, true);
  }

  function initializePersonalized() {
    if (personalizedInitialized) return false;
    personalizedInitialized = true;
    installStartRouter();
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
