(() => {
  'use strict';

  const body = document.body;
  const activePanel = document.getElementById('activePanel');
  const returnBar = document.getElementById('workoutReturnBar');
  const returnType = document.getElementById('workoutReturnType');
  const returnElapsed = document.getElementById('workoutReturnElapsed');
  const pet = document.getElementById('trainingPetCard');
  const petHome = document.getElementById('trainingPetHome');
  const petSlot = document.getElementById('workoutPetSlot');
  const completionPetSlot = document.getElementById('completionPetSlot');
  const exitStorageKey = 'big-gains-workout-mode-exit';
  let initialized = false;
  let elapsedTicker = null;

  function session() {
    return typeof active !== 'undefined' && active ? active : null;
  }

  function exitMarker() {
    try { return sessionStorage.getItem(exitStorageKey); } catch { return null; }
  }

  function markerFor(workout) {
    return workout ? `${PROFILE.id}:${workout.id}` : '';
  }

  function wasExplicitlyExited(workout = session()) {
    return Boolean(workout) && exitMarker() === markerFor(workout);
  }

  function setExplicitExit(workout) {
    try { sessionStorage.setItem(exitStorageKey, markerFor(workout)); } catch {}
  }

  function clearExplicitExit(workout = session()) {
    if (!workout || !wasExplicitlyExited(workout)) return;
    try { sessionStorage.removeItem(exitStorageKey); } catch {}
  }

  function formatElapsed(workout) {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(workout.startedAt).getTime()) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    return hours
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  }

  function movePet(inWorkoutMode) {
    const target = body.classList.contains('workout-completion-open') ? completionPetSlot : (inWorkoutMode ? petSlot : petHome);
    if (pet && target && pet.parentElement !== target) target.appendChild(pet);
  }

  function renderReturnBar() {
    const workout = session();
    const visible = Boolean(workout) && !body.classList.contains('workout-mode');
    returnBar?.classList.toggle('hidden', !visible);
    if (!visible) return;
    if (returnType) returnType.textContent = typeof displayWorkout === 'function' ? displayWorkout(workout.type) : workout.type;
    if (returnElapsed) returnElapsed.textContent = formatElapsed(workout);
  }

  function enter({ clearExit = true, showView = true } = {}) {
    const workout = session();
    if (!workout) return false;
    if (clearExit) clearExplicitExit(workout);
    body.classList.add('workout-mode');
    body.classList.add('workout-focus');
    movePet(true);
    renderReturnBar();
    if (typeof window.trainingPet?.render === 'function') window.trainingPet.render(true);
    if (showView && body.dataset.view !== 'train') {
      window.bigGainsViewShell?.showView('train', { instant: true, workout: false });
    }
    return true;
  }

  function suspend() {
    body.classList.remove('workout-mode');
    body.classList.remove('workout-focus');
    movePet(false);
    renderReturnBar();
    if (typeof window.trainingPet?.render === 'function') window.trainingPet.render(true);
  }

  function exit() {
    const workout = session();
    if (!workout) return false;
    setExplicitExit(workout);
    suspend();
    window.bigGainsViewShell?.showView('today', { workout: false });
    return true;
  }

  function browse() {
    if (!session()) return false;
    suspend();
    window.bigGainsViewShell?.showView('library', { workout: false });
    window.setTimeout(() => document.getElementById('workoutPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    return true;
  }

  function returnToWorkout() {
    if (!session()) return false;
    clearExplicitExit();
    window.bigGainsViewShell?.showView('train', { workout: false });
    enter({ clearExit: false, showView: false });
    return true;
  }

  function sync() {
    const workout = session();
    if (!workout) {
      if (body.classList.contains('workout-mode') || body.classList.contains('workout-focus')) suspend();
      else movePet(false);
      returnBar?.classList.add('hidden');
      return;
    }
    if (body.dataset.view === 'train' && !wasExplicitlyExited(workout)) enter({ clearExit: false, showView: false });
    else renderReturnBar();
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    document.getElementById('exitWorkoutMode')?.addEventListener('click', exit);
    document.getElementById('browseWorkoutLibrary')?.addEventListener('click', browse);
    document.getElementById('returnToWorkout')?.addEventListener('click', returnToWorkout);
    if (activePanel) new MutationObserver(sync).observe(activePanel, { attributes: true, attributeFilter: ['class'] });
    elapsedTicker = window.setInterval(renderReturnBar, 1000);
    const workout = session();
    if (workout && !wasExplicitlyExited(workout)) enter({ clearExit: false, showView: false });
    else renderReturnBar();
    return true;
  }

  window.bigGainsWorkoutMode = Object.freeze({
    initialize,
    enter,
    exit,
    browse,
    suspend,
    sync,
    returnToWorkout,
    wasExplicitlyExited,
    isActive: () => body.classList.contains('workout-mode')
  });
})();
