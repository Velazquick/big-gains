(() => {
  const REST_OPTIONS = [60, 90, 120, 150, 180, 240, 300];
  let lastCompletedExerciseIndex = null;
  let currentHistoryId = null;

  state.exercisePreferences = state.exercisePreferences || {};
  saveState();

  const preferenceFor = id => {
    state.exercisePreferences[id] = state.exercisePreferences[id] || {};
    return state.exercisePreferences[id];
  };

  const restLabel = seconds => seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  function noteControls(exercise, index) {
    const pref = preferenceFor(exercise.id);
    const restSeconds = Number(exercise.restSeconds || pref.restSeconds || DEFAULT_REST);
    return `<details class="exercise-notes" data-note-block="${index}">
      <summary>Notes & rest <span>${restLabel(restSeconds)}</span></summary>
      <div class="exercise-note-grid">
        <label><span>Saved setup / cue</span><textarea data-saved-cue="${index}" rows="2" placeholder="Seat 4 · handles 2 · slow negative">${escapeHtml(pref.cue || '')}</textarea><small>Follows this exercise into future workouts.</small></label>
        <label><span>Today’s note</span><textarea data-session-note="${index}" rows="2" placeholder="Form, pain, energy, machine differences…">${escapeHtml(exercise.note || '')}</textarea><small>Saved only with this workout.</small></label>
        <label class="rest-setting"><span>Rest after each set</span><select data-rest-seconds="${index}">${REST_OPTIONS.map(seconds => `<option value="${seconds}" ${seconds === restSeconds ? 'selected' : ''}>${restLabel(seconds)}</option>`).join('')}</select><small>This becomes the default for this movement.</small></label>
      </div>
    </details>`;
  }

  function decorateActiveNotes() {
    document.querySelectorAll('#activeExercises .active-exercise').forEach((card, index) => {
      if (card.dataset.notesReady === '1') return;
      const exercise = active?.exercises?.[index];
      if (!exercise) return;
      card.dataset.notesReady = '1';
      const addSet = card.querySelector('[data-add-set]');
      if (addSet) addSet.insertAdjacentHTML('beforebegin', noteControls(exercise, index));
      else card.insertAdjacentHTML('beforeend', noteControls(exercise, index));
    });
  }

  function saveCue(index, value) {
    const exercise = active?.exercises?.[index];
    if (!exercise) return;
    preferenceFor(exercise.id).cue = value.trim();
    saveState();
  }

  function saveSessionNote(index, value) {
    const exercise = active?.exercises?.[index];
    if (!exercise) return;
    exercise.note = value;
    autosave();
  }

  function saveRest(index, value) {
    const exercise = active?.exercises?.[index];
    if (!exercise) return;
    const seconds = Math.max(30, Number(value) || DEFAULT_REST);
    exercise.restSeconds = seconds;
    preferenceFor(exercise.id).restSeconds = seconds;
    saveState();
    const summary = document.querySelector(`[data-note-block="${index}"] summary span`);
    if (summary) summary.textContent = restLabel(seconds);
  }

  const originalStartRestTimer = startRestTimer;
  startRestTimer = function customExerciseRestTimer() {
    const exercise = active?.exercises?.[lastCompletedExerciseIndex];
    const pref = exercise ? preferenceFor(exercise.id) : {};
    const seconds = Number(exercise?.restSeconds || pref.restSeconds || DEFAULT_REST);
    state.restTimerEndsAt = Date.now() + seconds * 1000;
    saveState();
    runRestTimer();
    const next = document.getElementById('timerNext');
    if (next && exercise) next.textContent = `${exercise.name} · ${restLabel(seconds)} recovery.`;
    lastCompletedExerciseIndex = null;
  };

  const originalOpenHistory = openHistory;
  openHistory = function openHistoryWithNotes(id) {
    currentHistoryId = id;
    originalOpenHistory(id);
    requestAnimationFrame(decorateHistoryNotes);
  };

  function decorateHistoryNotes() {
    const workout = state.workouts.find(item => item.id === currentHistoryId);
    if (!workout) return;
    document.querySelectorAll('#historyDialogContent .history-exercise').forEach((card, index) => {
      if (card.dataset.notesReady === '1') return;
      card.dataset.notesReady = '1';
      const exercise = workout.exercises?.[index];
      if (!exercise?.note) return;
      card.insertAdjacentHTML('beforeend', `<div class="history-note"><span>Session note</span><p>${escapeHtml(exercise.note)}</p></div>`);
    });
  }

  const activeBox = document.getElementById('activeExercises');
  activeBox?.addEventListener('click', event => {
    const complete = event.target.closest('[data-complete-set]');
    if (complete) lastCompletedExerciseIndex = Number(complete.dataset.ei);
  }, true);

  activeBox?.addEventListener('input', event => {
    const cue = event.target.closest('[data-saved-cue]');
    if (cue) saveCue(Number(cue.dataset.savedCue), cue.value);
    const note = event.target.closest('[data-session-note]');
    if (note) saveSessionNote(Number(note.dataset.sessionNote), note.value);
  });

  activeBox?.addEventListener('change', event => {
    const rest = event.target.closest('[data-rest-seconds]');
    if (rest) saveRest(Number(rest.dataset.restSeconds), rest.value);
  });

  const observer = new MutationObserver(() => {
    decorateActiveNotes();
    decorateHistoryNotes();
  });
  if (activeBox) observer.observe(activeBox, { childList: true, subtree: true });
  const historyContent = document.getElementById('historyDialogContent');
  if (historyContent) observer.observe(historyContent, { childList: true, subtree: true });

  decorateActiveNotes();
})();