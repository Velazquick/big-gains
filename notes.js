(() => {
  const REST_OPTIONS = [60, 90, 120, 150, 180, 240, 300];

  const preferenceFor = (state, id, { create = true } = {}) => {
    if (create) state.exercisePreferences[id] = state.exercisePreferences[id] || {};
    return state.exercisePreferences[id] || {};
  };

  const restLabel = seconds => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  function noteControls({ exercise, index, state, defaultRest, escapeHtml }) {
    const pref = preferenceFor(state, exercise.id, { create: false });
    const restSeconds = Number(exercise.restSeconds || pref.restSeconds || defaultRest);
    return `<details class="exercise-notes" data-note-block="${index}">
      <summary>Notes & rest <span>${restLabel(restSeconds)}</span></summary>
      <div class="exercise-note-grid">
        <label><span>Saved setup / cue</span><textarea data-saved-cue="${index}" rows="2" placeholder="Seat 4 · handles 2 · slow negative">${escapeHtml(pref.cue || '')}</textarea><small>Follows this exercise into future workouts.</small></label>
        <label><span>Today’s note</span><textarea data-session-note="${index}" rows="2" placeholder="Form, pain, energy, machine differences…">${escapeHtml(exercise.note || '')}</textarea><small>Saved only with this workout.</small></label>
        <label class="rest-setting"><span>Rest after each set</span><select data-rest-seconds="${index}">${REST_OPTIONS.map(seconds => `<option value="${seconds}" ${seconds === restSeconds ? 'selected' : ''}>${restLabel(seconds)}</option>`).join('')}</select><small>This becomes the default for this movement.</small></label>
      </div>
    </details>`;
  }

  function initialize({ state, saveState }) {
    state.exercisePreferences = state.exercisePreferences || {};
    saveState();
  }

  function renderActiveNotes({ activeWorkout, box, state, defaultRest, escapeHtml }) {
    box?.querySelectorAll('.active-exercise').forEach((card, index) => {
      if (card.dataset.notesReady === '1') return;
      const exercise = activeWorkout?.exercises?.[index];
      if (!exercise) return;
      card.dataset.notesReady = '1';
      const controls = noteControls({ exercise, index, state, defaultRest, escapeHtml });
      const addSet = card.querySelector('[data-add-set]');
      if (addSet) addSet.insertAdjacentHTML('beforebegin', controls);
      else card.insertAdjacentHTML('beforeend', controls);
    });
  }

  function renderHistoryNotes({ workout, container, escapeHtml }) {
    if (!workout || !container) return;
    container.querySelectorAll('.history-exercise').forEach((card, index) => {
      if (card.dataset.notesReady === '1') return;
      card.dataset.notesReady = '1';
      const exercise = workout.exercises?.[index];
      if (!exercise?.note) return;
      card.insertAdjacentHTML('beforeend', `<div class="history-note"><span>Session note</span><p>${escapeHtml(exercise.note)}</p></div>`);
    });
  }

  function saveCue({ activeWorkout, state, index, value, saveState }) {
    const exercise = activeWorkout?.exercises?.[index];
    if (!exercise) return;
    preferenceFor(state, exercise.id).cue = value.trim();
    saveState();
  }

  function saveSessionNote({ activeWorkout, index, value, autosave }) {
    const exercise = activeWorkout?.exercises?.[index];
    if (!exercise) return;
    exercise.note = value;
    autosave();
  }

  function saveRest({ activeWorkout, state, index, value, defaultRest, saveState, summary }) {
    const exercise = activeWorkout?.exercises?.[index];
    if (!exercise) return;
    const seconds = Math.max(30, Number(value) || defaultRest);
    exercise.restSeconds = seconds;
    preferenceFor(state, exercise.id).restSeconds = seconds;
    saveState();
    if (summary) summary.textContent = restLabel(seconds);
  }

  function startRestTimer({ activeWorkout, state, exerciseIndex, defaultRest, saveState, runRestTimer, message }) {
    const exercise = activeWorkout?.exercises?.[exerciseIndex];
    const pref = exercise ? preferenceFor(state, exercise.id, { create: false }) : {};
    const seconds = Number(exercise?.restSeconds || pref.restSeconds || defaultRest);
    state.restTimerEndsAt = Date.now() + seconds * 1000;
    saveState();
    runRestTimer();
    if (message && exercise) message.textContent = `${exercise.name} · ${restLabel(seconds)} recovery.`;
  }

  window.workoutNotes = Object.freeze({
    initialize,
    renderActiveNotes,
    renderHistoryNotes,
    saveCue,
    saveRest,
    saveSessionNote,
    startRestTimer
  });
})();
