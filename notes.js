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

  const style = document.createElement('style');
  style.textContent = `
    .active-exercise{transition:border-color .18s ease,background .18s ease}
    .active-exercise.collapsed{padding-bottom:0}
    .active-exercise .exercise-head{cursor:pointer}
    .exercise-order-actions{display:flex;gap:6px;align-items:center}
    .exercise-order-actions button,.exercise-collapse-button{width:36px;height:36px;border-radius:10px;background:var(--panel2);color:var(--text);border:1px solid var(--line);padding:0;font-size:1rem}
    .exercise-order-actions button:disabled{opacity:.28}
    .exercise-collapse-button{color:var(--accent);font-size:.92rem}
    .exercise-collapse-summary{display:none;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin:0 -1px;padding:12px 14px;border-top:1px solid var(--line);background:var(--panel2);border-radius:0 0 15px 15px}
    .exercise-collapse-summary strong{display:block;font-size:.9rem}
    .exercise-collapse-summary small{color:var(--muted)}
    .exercise-collapse-summary span{color:var(--accent);font-size:.76rem;font-weight:800;text-align:right}
    .active-exercise.collapsed .exercise-collapse-summary{display:grid}
    .active-exercise.collapsed > :not(.exercise-head):not(.exercise-collapse-summary){display:none!important}
    .active-exercise.collapsed .exercise-head{margin-bottom:0}
    .active-exercise.collapsed .exercise-head p{display:none}
    .active-exercise.finished-card{border-color:rgba(216,255,62,.36)}
    @media(max-width:560px){
      .exercise-order-actions{flex-wrap:wrap;justify-content:flex-end}
      .exercise-order-actions button,.exercise-collapse-button{width:34px;height:34px}
      .exercise-collapse-summary{grid-template-columns:1fr}
      .exercise-collapse-summary span{text-align:left}
    }
  `;
  document.head.appendChild(style);

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

  function exerciseSummary(exercise) {
    const completed = (exercise.sets || []).filter(set => set.completed && !set.warmup);
    const allWorking = (exercise.sets || []).filter(set => !set.warmup);
    const best = completed.reduce((winner, set) => {
      if (!winner) return set;
      const currentScore = Number(set.weight || 0) * (1 + Number(set.reps || 0) / 30);
      const winnerScore = Number(winner.weight || 0) * (1 + Number(winner.reps || 0) / 30);
      return currentScore > winnerScore ? set : winner;
    }, null);
    const volume = completed.reduce((sum, set) => sum + Number(set.weight || 0) * Number(set.reps || 0), 0);
    const status = allWorking.length && completed.length === allWorking.length ? 'Complete' : `${completed.length}/${allWorking.length} working sets`;
    return {
      status,
      best: best ? `Best ${best.weight} × ${best.reps}` : 'No completed working sets',
      volume: volume ? `${Math.round(volume).toLocaleString('en-US')} lb` : '0 lb'
    };
  }

  function reorderExercise(fromIndex, toIndex) {
    if (!active?.exercises || toIndex < 0 || toIndex >= active.exercises.length || fromIndex === toIndex) return;
    const [exercise] = active.exercises.splice(fromIndex, 1);
    active.exercises.splice(toIndex, 0, exercise);
    autosave();
    renderActive();
  }

  function toggleExercise(index, force) {
    const exercise = active?.exercises?.[index];
    if (!exercise) return;
    exercise.collapsed = typeof force === 'boolean' ? force : !exercise.collapsed;
    autosave();
    decorateActiveNotes();
  }

  function decorateActiveNotes() {
    document.querySelectorAll('#activeExercises .active-exercise').forEach((card, index) => {
      const exercise = active?.exercises?.[index];
      if (!exercise) return;

      const workingSets = (exercise.sets || []).filter(set => !set.warmup);
      const isFinished = workingSets.length > 0 && workingSets.every(set => set.completed);
      if (isFinished && exercise.collapsed === undefined) {
        exercise.collapsed = true;
        saveState();
      }

      card.classList.toggle('collapsed', Boolean(exercise.collapsed));
      card.classList.toggle('finished-card', isFinished);

      if (card.dataset.notesReady !== '1') {
        card.dataset.notesReady = '1';
        const addSet = card.querySelector('[data-add-set]');
        if (addSet) addSet.insertAdjacentHTML('beforebegin', noteControls(exercise, index));
        else card.insertAdjacentHTML('beforeend', noteControls(exercise, index));
      }

      const head = card.querySelector('.exercise-head');
      if (head && !head.querySelector('.exercise-order-actions')) {
        const existingActions = head.querySelector('.exercise-head-actions');
        const controls = document.createElement('div');
        controls.className = 'exercise-order-actions';
        controls.innerHTML = `
          <button type="button" data-move-exercise="up" data-exercise-index="${index}" aria-label="Move ${escapeHtml(exercise.name)} up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-move-exercise="down" data-exercise-index="${index}" aria-label="Move ${escapeHtml(exercise.name)} down" ${index === active.exercises.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="exercise-collapse-button" data-toggle-exercise="${index}" aria-label="${exercise.collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(exercise.name)}">${exercise.collapsed ? '＋' : '−'}</button>
        `;
        if (existingActions) existingActions.prepend(controls);
        else head.appendChild(controls);
      } else if (head) {
        const up = head.querySelector('[data-move-exercise="up"]');
        const down = head.querySelector('[data-move-exercise="down"]');
        const toggle = head.querySelector('[data-toggle-exercise]');
        if (up) { up.dataset.exerciseIndex = index; up.disabled = index === 0; }
        if (down) { down.dataset.exerciseIndex = index; down.disabled = index === active.exercises.length - 1; }
        if (toggle) { toggle.dataset.toggleExercise = index; toggle.textContent = exercise.collapsed ? '＋' : '−'; }
      }

      let summary = card.querySelector('.exercise-collapse-summary');
      if (!summary) {
        summary = document.createElement('div');
        summary.className = 'exercise-collapse-summary';
        card.appendChild(summary);
      }
      const stats = exerciseSummary(exercise);
      summary.innerHTML = `<div><strong>${escapeHtml(stats.status)}</strong><small>${escapeHtml(stats.best)}</small></div><span>${escapeHtml(stats.volume)} volume</span>`;
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
    const move = event.target.closest('[data-move-exercise]');
    if (move) {
      event.preventDefault();
      event.stopPropagation();
      const index = Number(move.dataset.exerciseIndex);
      reorderExercise(index, move.dataset.moveExercise === 'up' ? index - 1 : index + 1);
      return;
    }

    const toggle = event.target.closest('[data-toggle-exercise]');
    if (toggle) {
      event.preventDefault();
      event.stopPropagation();
      toggleExercise(Number(toggle.dataset.toggleExercise));
      return;
    }

    const head = event.target.closest('.exercise-head');
    if (head && !event.target.closest('button,input,select,textarea,a')) {
      const card = head.closest('.active-exercise');
      const index = [...activeBox.querySelectorAll('.active-exercise')].indexOf(card);
      if (index >= 0) toggleExercise(index);
      return;
    }

    const complete = event.target.closest('[data-complete-set]');
    if (complete) {
      lastCompletedExerciseIndex = Number(complete.dataset.ei);
      const exerciseIndex = lastCompletedExerciseIndex;
      requestAnimationFrame(() => {
        const exercise = active?.exercises?.[exerciseIndex];
        const working = (exercise?.sets || []).filter(set => !set.warmup);
        if (working.length && working.every(set => set.completed)) toggleExercise(exerciseIndex, true);
      });
    }
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