(() => {
  'use strict';

  const pet = document.getElementById('trainingPet');
  const card = document.getElementById('trainingPetCard');
  const stateLabel = document.getElementById('trainingPetState');
  const message = document.getElementById('trainingPetMessage');
  if (!pet || !card || !stateLabel || !message) return;

  const sameLocalDay = value => {
    if (!value) return false;
    const date = new Date(value);
    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  };
  const latestToday = () => (state?.workouts || []).find(workout => sameLocalDay(workout.completedAt));
  const isLegDay = workout => /leg|lower/i.test(workout?.type || '') || (workout?.exercises || []).filter(exercise => /quad|hamstring|glute|calf|leg/i.test(`${exercise.muscle || ''} ${exercise.name || ''}`)).length >= 3;
  const currentProfile = () => (window.PROFILE || PROFILE)?.id || 'jorge';

  const definitions = {
    idle: { label: 'Standing by', messages: ['Small creature. Serious commitment to the bit.','The iron remains suspiciously liftable.','No pressure. I merely believe in progressive overload.'] },
    active: { label: 'Workout mode', messages: ['I am spotting emotionally.','Rest timer has been inspected. Carry on.','Clean reps. Tiny witness.','The set counts even if nobody posts it.'] },
    sleeping: { label: 'Recovery mode', messages: ['Rest is training with the lights off.','No streak lost. The creature is simply horizontal.','Muscles loading… please do not unplug.'] },
    complete: { label: 'Work logged', messages: ['One more brick laid.','The database remembers. Excellent work.','Workout secured. Go be a person again.'] },
    pr: { label: 'PR detected', messages: ['New number. Same menace.','That record was load-bearing.','Personal record acquired. Creature impressed.'] },
    exhausted: { label: 'Leg day survived', messages: ['Stairs are now an advanced movement.','Leg day complete. Walking privileges pending.','The legs have submitted a formal complaint.'] }
  };

  let currentState = '';
  let messageIndex = 0;
  let pokeTimer;
  let initialized = false;

  function resolveState() {
    const workout = latestToday();
    if (active || state?.activeWorkout) return 'active';
    if (workout && isLegDay(workout)) return 'exhausted';
    if (workout?.prs > 0) return 'pr';
    if (workout) return 'complete';
    if (typeof todaysWorkout === 'function' && todaysWorkout() === 'Rest') return 'sleeping';
    return 'idle';
  }

  function render(forceMessage = false) {
    card.dataset.profile = currentProfile();
    const nextState = resolveState();
    if (nextState !== currentState) {
      currentState = nextState;
      messageIndex = 0;
      forceMessage = true;
    }
    const definition = definitions[currentState];
    pet.dataset.state = currentState;
    pet.setAttribute('aria-label', `${definition.label}. Tap for another message.`);
    stateLabel.textContent = definition.label;
    if (forceMessage) message.textContent = definition.messages[messageIndex];
  }

  function poke() {
    const definition = definitions[currentState];
    messageIndex = (messageIndex + 1) % definition.messages.length;
    message.textContent = definition.messages[messageIndex];
    pet.classList.remove('is-poked');
    void pet.offsetWidth;
    pet.classList.add('is-poked');
    clearTimeout(pokeTimer);
    pokeTimer = setTimeout(() => pet.classList.remove('is-poked'), 600);
    if (navigator.vibrate && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(18);
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    pet.addEventListener('click', poke);
    ['startWorkout','finishWorkout','cancelWorkout'].forEach(id => document.getElementById(id)?.addEventListener('click', () => setTimeout(() => render(true), 80)));
    document.getElementById('profileSelect')?.addEventListener('change', () => setTimeout(() => render(true), 0));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) render(true); });
    window.addEventListener('storage', () => render(true));
    setInterval(() => render(false), 4000);
    render(true);
    return true;
  }

  window.trainingPet = Object.freeze({ initialize, render });
})();
