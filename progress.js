window.workoutProgress = (() => {
  let context = null;
  let initialized = false;

  const elements = () => ({
    select: document.getElementById('progressExerciseSelect'),
    button: document.getElementById('openSelectedProgress'),
    preview: document.getElementById('progressPreview'),
    dialog: document.getElementById('progressDialog')
  });

  const formatMonthDay = iso => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));

  function sessionHistoryFor(exerciseId) {
    return context.analytics.exerciseHistory(context.getState().workouts, exerciseId).map(session => ({
      date: session.date,
      sets: session.workingSets,
      best: session.bestWorkingSet,
      estimated1RM: session.bestWorkingSet.estimated1RM,
      volume: session.workingSetVolume
    }));
  }

  function loggedExercises() {
    return context.exercises.filter(exercise => sessionHistoryFor(exercise.id).length).sort((a, b) => a.name.localeCompare(b.name));
  }

  function bestSetAcross(sessions) {
    return context.analytics.bestWorkingSet(sessions.flatMap(session => session.sets));
  }

  function trendText(sessions) {
    if (sessions.length < 2) return 'One logged session — the trend starts here.';
    const latest = sessions[0].estimated1RM;
    const first = sessions[sessions.length - 1].estimated1RM;
    const change = latest - first;
    if (!change) return 'Estimated strength is holding steady.';
    const percent = first ? Math.round(Math.abs(change) / first * 100) : 0;
    return `${change > 0 ? '+' : '−'}${Math.abs(change)} lb estimated strength${percent ? ` (${percent}%)` : ''} since the first log.`;
  }

  function progressChart(sessions) {
    const data = sessions.slice(0, 10).reverse();
    const width = 620;
    const height = 230;
    const padX = 46;
    const padY = 34;
    const values = data.map(session => session.estimated1RM);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const spread = Math.max(10, rawMax - rawMin);
    const min = Math.max(0, rawMin - spread * 0.18);
    const max = rawMax + spread * 0.18;
    const xFor = index => data.length === 1 ? width / 2 : padX + index * ((width - padX * 2) / (data.length - 1));
    const yFor = value => height - padY - ((value - min) / Math.max(1, max - min)) * (height - padY * 2);
    const points = data.map((session, index) => `${xFor(index).toFixed(1)},${yFor(session.estimated1RM).toFixed(1)}`).join(' ');
    const grid = [0, 0.5, 1].map(ratio => {
      const value = min + (max - min) * ratio;
      const y = yFor(value);
      return `<line class="progress-grid-line" x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}"></line><text class="progress-axis-label" x="6" y="${y + 4}">${Math.round(value)}</text>`;
    }).join('');
    const dots = data.map((session, index) => `<circle class="progress-dot" cx="${xFor(index)}" cy="${yFor(session.estimated1RM)}" r="5"><title>${context.fmtDate(session.date)}: ${session.estimated1RM} lb estimated 1RM</title></circle>`).join('');
    return `<div class="progress-chart"><div class="progress-chart-title"><strong>Estimated 1RM trend</strong><span>Last ${data.length} session${data.length === 1 ? '' : 's'}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Estimated one rep max trend">${grid}<polyline class="progress-line" points="${points}"></polyline>${dots}<text class="progress-date-label" x="${padX}" y="${height - 7}">${context.escapeHtml(formatMonthDay(data[0].date))}</text><text class="progress-date-label" text-anchor="end" x="${width - padX}" y="${height - 7}">${context.escapeHtml(formatMonthDay(data[data.length - 1].date))}</text></svg></div>`;
  }

  function renderProgressPreview(exerciseId) {
    const { preview } = elements();
    const exercise = context.exercises.find(item => item.id === exerciseId);
    const sessions = sessionHistoryFor(exerciseId);
    if (!exercise || !sessions.length) {
      preview.className = 'progress-preview empty';
      preview.textContent = 'No sessions logged for this movement yet.';
      return;
    }
    const best = bestSetAcross(sessions);
    const latest = sessions[0];
    preview.className = 'progress-preview';
    preview.innerHTML = `<div class="progress-preview-copy"><span class="exercise-muscle">${context.escapeHtml(exercise.muscle)}</span><h3>${context.escapeHtml(exercise.name)}</h3><p>${trendText(sessions)}</p></div><div class="progress-preview-stats"><div><span>Best set</span><strong>${Number(best.weight)} × ${Number(best.reps)}</strong></div><div><span>Best e1RM</span><strong>${best.estimated1RM} lb</strong></div><div><span>Latest</span><strong>${latest.estimated1RM} lb</strong></div></div><button type="button" class="ghost compact" data-progress-exercise="${exerciseId}">Open full progress</button>`;
  }

  function renderProgressPanel() {
    const { select, button, preview } = elements();
    const exercises = loggedExercises();
    const previous = select.value;
    if (!exercises.length) {
      select.innerHTML = '<option>No logged exercises yet</option>';
      select.disabled = true;
      button.disabled = true;
      preview.className = 'progress-preview empty';
      preview.textContent = 'Finish a workout and your movement trends will begin here.';
      return;
    }
    select.disabled = false;
    button.disabled = false;
    select.innerHTML = exercises.map(exercise => `<option value="${exercise.id}">${context.escapeHtml(exercise.name)}</option>`).join('');
    if (exercises.some(exercise => exercise.id === previous)) select.value = previous;
    renderProgressPreview(select.value);
  }

  function closeProgress() {
    const { dialog } = elements();
    if (dialog.close && dialog.open) dialog.close();
    else dialog.removeAttribute('open');
  }

  function openExerciseProgress(exerciseId) {
    const exercise = context.exercises.find(item => item.id === exerciseId);
    const sessions = sessionHistoryFor(exerciseId);
    if (!exercise) return;
    const historyDialog = document.getElementById('historyDialog');
    if (historyDialog?.open) context.closeHistory();

    document.getElementById('progressDialogTitle').textContent = exercise.name;
    document.getElementById('progressDialogMeta').textContent = `${exercise.muscle} · ${exercise.equipment}`;
    const content = document.getElementById('progressDialogContent');

    if (!sessions.length) {
      content.innerHTML = '<div class="empty">No completed working sets for this exercise yet.</div>';
    } else {
      const best = bestSetAcross(sessions);
      const latest = sessions[0];
      const totalVolume = sessions.reduce((total, session) => total + session.volume, 0);
      const recent = sessions.slice(0, 8).map(session => `<article class="progress-session"><div><strong>${context.fmtDate(session.date)}</strong><small>${session.sets.length} working set${session.sets.length === 1 ? '' : 's'} · ${Math.round(session.volume).toLocaleString('en-US')} lb volume</small></div><div class="progress-session-meta"><strong>${session.best.weight} × ${session.best.reps}</strong><small>${session.estimated1RM} lb e1RM</small></div><div class="progress-session-sets">${session.sets.map(set => `<span>${Number(set.weight)} × ${Number(set.reps)}</span>`).join('')}</div></article>`).join('');
      content.innerHTML = `<div class="history-summary-grid progress-summary-grid"><div><span>Best set</span><strong>${Number(best.weight)} lb × ${Number(best.reps)}</strong></div><div><span>Best estimated 1RM</span><strong>${best.estimated1RM} lb</strong></div><div><span>Training history</span><strong>${sessions.length} sessions · ${Math.round(totalVolume).toLocaleString('en-US')} lb</strong></div></div><div class="progress-trend-note"><strong>${latest.estimated1RM} lb latest e1RM</strong><span>${trendText(sessions)}</span></div>${progressChart(sessions)}<div class="progress-recent-head"><span class="label">Recent work</span><h3>Session-by-session</h3></div><div class="progress-session-list">${recent}</div>`;
    }

    const { dialog } = elements();
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function decorateLibrary() {
    document.querySelectorAll('#exerciseLibrary .exercise-card').forEach(card => {
      if (card.querySelector('[data-progress-exercise]')) return;
      const addButton = card.querySelector('[data-add]');
      if (!addButton) return;
      let actions = addButton.parentElement;
      if (!actions.classList.contains('exercise-card-actions')) {
        actions = document.createElement('div');
        actions.className = 'exercise-card-actions';
        addButton.replaceWith(actions);
        actions.appendChild(addButton);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ghost compact';
      button.dataset.progressExercise = addButton.dataset.add;
      button.textContent = 'Progress';
      actions.prepend(button);
    });
  }

  function decorateActive(activeWorkout) {
    document.querySelectorAll('#activeExercises .active-exercise').forEach((card, index) => {
      if (card.querySelector('[data-progress-exercise]')) return;
      const head = card.querySelector('.exercise-head');
      const remove = card.querySelector('[data-remove-exercise]');
      const exercise = activeWorkout?.exercises?.[index];
      if (!head || !remove || !exercise) return;
      let actions = remove.parentElement;
      if (!actions.classList.contains('exercise-head-actions')) {
        actions = document.createElement('div');
        actions.className = 'exercise-head-actions';
        remove.replaceWith(actions);
        actions.appendChild(remove);
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ghost compact';
      button.dataset.progressExercise = exercise.id;
      button.textContent = 'Progress';
      actions.prepend(button);
    });
  }

  function decorateHistoryDialog() {
    document.querySelectorAll('#historyDialog .history-exercise').forEach(card => {
      if (card.querySelector('[data-progress-exercise]')) return;
      const head = card.querySelector('.history-exercise-head');
      const exerciseId = card.dataset.exerciseId;
      if (!head || !exerciseId) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ghost compact';
      button.dataset.progressExercise = exerciseId;
      button.textContent = 'Progress';
      head.appendChild(button);
    });
  }

  function initialize(apiContext) {
    context = apiContext;
    if (initialized) return;
    const { select, button, dialog } = elements();
    if (!select || !button || !document.getElementById('progressPreview') || !dialog) return;

    select.addEventListener('change', event => renderProgressPreview(event.target.value));
    button.addEventListener('click', () => openExerciseProgress(select.value));
    document.getElementById('closeProgressDialog')?.addEventListener('click', closeProgress);
    dialog.addEventListener('click', event => { if (event.target === dialog) closeProgress(); });
    document.getElementById('cancelRoutineDialog')?.addEventListener('click', () => context.closeRoutineEditor());
    document.addEventListener('click', event => {
      const progressButton = event.target.closest('[data-progress-exercise]');
      if (!progressButton) return;
      event.preventDefault();
      openExerciseProgress(progressButton.dataset.progressExercise);
    });
    initialized = true;
  }

  function afterLibraryRender() {
    decorateLibrary();
  }

  function afterActiveRender({ activeWorkout }) {
    decorateActive(activeWorkout);
  }

  function afterHistoryOpen() {
    decorateHistoryDialog();
  }

  function afterFullRender({ activeWorkout }) {
    renderProgressPanel();
    decorateLibrary();
    decorateActive(activeWorkout);
  }

  return {
    afterActiveRender,
    afterFullRender,
    afterHistoryOpen,
    afterLibraryRender,
    initialize
  };
})();
