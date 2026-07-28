(() => {
  const progressSelect = document.getElementById('progressExerciseSelect');
  const progressButton = document.getElementById('openSelectedProgress');
  const progressPreview = document.getElementById('progressPreview');
  const progressDialog = document.getElementById('progressDialog');

  if (!progressSelect || !progressButton || !progressPreview || !progressDialog) return;

  const formatMonthDay = iso => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));

  function sessionHistoryFor(exerciseId) {
    const sessions = [];
    for (const workout of state.workouts) {
      const exercise = (workout.exercises || []).find(item => item.id === exerciseId || slug(item.name || '') === exerciseId);
      if (!exercise) continue;
      const sets = (exercise.sets || []).filter(set => !set.warmup && Number(set.weight) > 0 && Number(set.reps) > 0);
      if (!sets.length) continue;
      const best = sets.reduce((winner, set) => estimate1RM(Number(set.weight), Number(set.reps)) > estimate1RM(Number(winner?.weight || 0), Number(winner?.reps || 0)) ? set : winner, null);
      sessions.push({
        date: workout.completedAt,
        sets,
        best,
        estimated1RM: estimate1RM(Number(best.weight), Number(best.reps)),
        volume: sets.reduce((total, set) => total + Number(set.weight) * Number(set.reps), 0)
      });
    }
    return sessions;
  }

  function loggedExercises() {
    return EXERCISES.filter(exercise => sessionHistoryFor(exercise.id).length).sort((a, b) => a.name.localeCompare(b.name));
  }

  function bestSetAcross(sessions) {
    return sessions.flatMap(session => session.sets).reduce((winner, set) => estimate1RM(Number(set.weight), Number(set.reps)) > estimate1RM(Number(winner?.weight || 0), Number(winner?.reps || 0)) ? set : winner, null);
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
    const dots = data.map((session, index) => `<circle class="progress-dot" cx="${xFor(index)}" cy="${yFor(session.estimated1RM)}" r="5"><title>${fmtDate(session.date)}: ${session.estimated1RM} lb estimated 1RM</title></circle>`).join('');
    return `<div class="progress-chart"><div class="progress-chart-title"><strong>Estimated 1RM trend</strong><span>Last ${data.length} session${data.length === 1 ? '' : 's'}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Estimated one rep max trend">${grid}<polyline class="progress-line" points="${points}"></polyline>${dots}<text class="progress-date-label" x="${padX}" y="${height - 7}">${escapeHtml(formatMonthDay(data[0].date))}</text><text class="progress-date-label" text-anchor="end" x="${width - padX}" y="${height - 7}">${escapeHtml(formatMonthDay(data[data.length - 1].date))}</text></svg></div>`;
  }

  function renderProgressPreview(exerciseId) {
    const exercise = EXERCISES.find(item => item.id === exerciseId);
    const sessions = sessionHistoryFor(exerciseId);
    if (!exercise || !sessions.length) {
      progressPreview.className = 'progress-preview empty';
      progressPreview.textContent = 'No sessions logged for this movement yet.';
      return;
    }
    const best = bestSetAcross(sessions);
    const latest = sessions[0];
    progressPreview.className = 'progress-preview';
    progressPreview.innerHTML = `<div class="progress-preview-copy"><span class="exercise-muscle">${escapeHtml(exercise.muscle)}</span><h3>${escapeHtml(exercise.name)}</h3><p>${trendText(sessions)}</p></div><div class="progress-preview-stats"><div><span>Best set</span><strong>${Number(best.weight)} × ${Number(best.reps)}</strong></div><div><span>Best e1RM</span><strong>${estimate1RM(Number(best.weight), Number(best.reps))} lb</strong></div><div><span>Latest</span><strong>${latest.estimated1RM} lb</strong></div></div><button type="button" class="ghost compact" data-progress-exercise="${exerciseId}">Open full progress</button>`;
  }

  function renderProgressPanel() {
    const exercises = loggedExercises();
    const previous = progressSelect.value;
    if (!exercises.length) {
      progressSelect.innerHTML = '<option>No logged exercises yet</option>';
      progressSelect.disabled = true;
      progressButton.disabled = true;
      progressPreview.className = 'progress-preview empty';
      progressPreview.textContent = 'Finish a workout and your movement trends will begin here.';
      return;
    }
    progressSelect.disabled = false;
    progressButton.disabled = false;
    progressSelect.innerHTML = exercises.map(exercise => `<option value="${exercise.id}">${escapeHtml(exercise.name)}</option>`).join('');
    if (exercises.some(exercise => exercise.id === previous)) progressSelect.value = previous;
    renderProgressPreview(progressSelect.value);
  }

  function closeProgress() {
    if (progressDialog.close && progressDialog.open) progressDialog.close();
    else progressDialog.removeAttribute('open');
  }

  function openExerciseProgress(exerciseId) {
    const exercise = EXERCISES.find(item => item.id === exerciseId);
    const sessions = sessionHistoryFor(exerciseId);
    if (!exercise) return;
    const historyDialog = document.getElementById('historyDialog');
    if (historyDialog?.open && typeof closeHistory === 'function') closeHistory();

    document.getElementById('progressDialogTitle').textContent = exercise.name;
    document.getElementById('progressDialogMeta').textContent = `${exercise.muscle} · ${exercise.equipment}`;
    const content = document.getElementById('progressDialogContent');

    if (!sessions.length) {
      content.innerHTML = '<div class="empty">No completed working sets for this exercise yet.</div>';
    } else {
      const best = bestSetAcross(sessions);
      const latest = sessions[0];
      const totalVolume = sessions.reduce((total, session) => total + session.volume, 0);
      const recent = sessions.slice(0, 8).map(session => `<article class="progress-session"><div><strong>${fmtDate(session.date)}</strong><small>${session.sets.length} working set${session.sets.length === 1 ? '' : 's'} · ${Math.round(session.volume).toLocaleString('en-US')} lb volume</small></div><div class="progress-session-meta"><strong>${session.best.weight} × ${session.best.reps}</strong><small>${session.estimated1RM} lb e1RM</small></div><div class="progress-session-sets">${session.sets.map(set => `<span>${Number(set.weight)} × ${Number(set.reps)}</span>`).join('')}</div></article>`).join('');
      content.innerHTML = `<div class="history-summary-grid progress-summary-grid"><div><span>Best set</span><strong>${Number(best.weight)} lb × ${Number(best.reps)}</strong></div><div><span>Best estimated 1RM</span><strong>${estimate1RM(Number(best.weight), Number(best.reps))} lb</strong></div><div><span>Training history</span><strong>${sessions.length} sessions · ${Math.round(totalVolume).toLocaleString('en-US')} lb</strong></div></div><div class="progress-trend-note"><strong>${latest.estimated1RM} lb latest e1RM</strong><span>${trendText(sessions)}</span></div>${progressChart(sessions)}<div class="progress-recent-head"><span class="label">Recent work</span><h3>Session-by-session</h3></div><div class="progress-session-list">${recent}</div>`;
    }

    if (progressDialog.showModal) progressDialog.showModal();
    else progressDialog.setAttribute('open', '');
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

  function decorateActive() {
    document.querySelectorAll('#activeExercises .active-exercise').forEach((card, index) => {
      if (card.querySelector('[data-progress-exercise]')) return;
      const head = card.querySelector('.exercise-head');
      const remove = card.querySelector('[data-remove-exercise]');
      const exercise = active?.exercises?.[index];
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
      const name = card.querySelector('h3')?.textContent?.trim();
      if (!head || !name) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ghost compact';
      button.dataset.progressExercise = slug(name);
      button.textContent = 'Progress';
      head.appendChild(button);
    });
  }

  const originalRenderLibrary = renderLibrary;
  renderLibrary = function (...args) {
    const result = originalRenderLibrary.apply(this, args);
    decorateLibrary();
    return result;
  };

  const originalRenderActive = renderActive;
  renderActive = function (...args) {
    const result = originalRenderActive.apply(this, args);
    decorateActive();
    return result;
  };

  const originalOpenHistory = openHistory;
  openHistory = function (...args) {
    const result = originalOpenHistory.apply(this, args);
    decorateHistoryDialog();
    return result;
  };

  const originalRenderAll = renderAll;
  renderAll = function (...args) {
    const result = originalRenderAll.apply(this, args);
    renderProgressPanel();
    decorateLibrary();
    decorateActive();
    return result;
  };

  progressSelect.addEventListener('change', event => renderProgressPreview(event.target.value));
  progressButton.addEventListener('click', () => openExerciseProgress(progressSelect.value));
  document.getElementById('closeProgressDialog')?.addEventListener('click', closeProgress);
  progressDialog.addEventListener('click', event => { if (event.target === progressDialog) closeProgress(); });
  document.getElementById('cancelRoutineDialog')?.addEventListener('click', () => closeRoutineEditor());

  const mutationObserver = new MutationObserver(() => {
    decorateLibrary();
    decorateActive();
    decorateHistoryDialog();
  });
  ['exerciseLibrary', 'activeExercises', 'historyDialogContent'].forEach(id => {
    const element = document.getElementById(id);
    if (element) mutationObserver.observe(element, { childList: true, subtree: true });
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-progress-exercise]');
    if (!button) return;
    event.preventDefault();
    openExerciseProgress(button.dataset.progressExercise);
  });

  renderProgressPanel();
  decorateLibrary();
  decorateActive();
})();