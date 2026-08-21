window.workoutProgress = (() => {
  let context = null;
  let initialized = false;
  let selectedWindowDays = 7;
  let selectedMuscle = null;
  let selectedHistoryView = 'list';
  let historyTrigger = null;

  const MUSCLE_GROUPS = Object.freeze([
    { key: 'Chest', label: 'Chest', sources: ['Chest'] },
    { key: 'Shoulders', label: 'Shoulders', sources: ['Shoulders', 'Rear Delts'] },
    { key: 'Back', label: 'Back', sources: ['Back', 'Traps'] },
    { key: 'Arms', label: 'Arms', sources: ['Biceps', 'Triceps'] },
    { key: 'Core', label: 'Core', sources: ['Core'] },
    { key: 'Glutes', label: 'Glutes', sources: ['Glutes'] },
    { key: 'Quads', label: 'Quads', sources: ['Quads'] },
    { key: 'Adductors', label: 'Adductors', sources: ['Adductors'] },
    { key: 'Hamstrings', label: 'Hamstrings', sources: ['Hamstrings'] },
    { key: 'Calves', label: 'Calves', sources: ['Calves'] }
  ]);

  const elements = () => ({
    panel: document.getElementById('progressPanel'),
    select: document.getElementById('progressExerciseSelect'),
    button: document.getElementById('openSelectedProgress'),
    preview: document.getElementById('progressPreview'),
    history: document.getElementById('history'),
    overview: document.getElementById('progressOverviewSurface'),
    archive: document.getElementById('historyArchiveDialog'),
    archiveList: document.getElementById('historyArchiveList'),
    listPanel: document.getElementById('historyListPanel'),
    calendarPanel: document.getElementById('historyCalendarPanel'),
    dialog: document.getElementById('progressDialog')
  });

  const list = value => Array.isArray(value) ? value : [];
  const formatMonthDay = iso => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
  const formatCompact = value => new Intl.NumberFormat('en-US', { notation: Number(value) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: Number(value) >= 10000 ? 1 : 0 }).format(Math.round(Number(value) || 0));
  const formatDuration = seconds => {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total % 3600 / 60);
    return hours ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
  };
  const completedAt = workout => new Date(workout?.completedAt || 0).getTime();
  const analyticsOptions = () => context.getAnalyticsOptions?.() || {};
  const formatVolume = (value, kind = null) => value === null ? '—' : `${formatCompact(value)} ${kind === 'indicated_load' ? 'indicated lb' : kind === 'modeled_system_load' ? 'modeled lb' : 'lb'}`;
  const workloadLabel = kind => kind === 'indicated_load' ? 'indicated workload' : kind === 'modeled_system_load' ? 'modeled system volume' : kind === 'external_load' ? 'external-load volume' : 'comparable workload';
  const formatMonthHeading = iso => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(iso)).toUpperCase();
  const formatArchiveDate = iso => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
  const formatDay = iso => new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(new Date(iso));
  const formatWeekday = iso => new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(iso)).toUpperCase();
  const setLoadLabel = set => {
    if (set?.trackingModel === 'duration') return `${Number(set.duration) || 0} sec`;
    if (set?.trackingModel === 'load_distance') return `${Number(set.weight) || 0} lb · ${Number(set.distance) || 0}`;
    if (set?.trackingModel === 'reps_only') return 'Bodyweight';
    if (set?.resistanceSemantics === 'assistance') return `${Number(set.weight) || 0} lb assistance`;
    if (set?.loadMode !== 'bodyweight') {
      const suffix = set?.loadBasis === 'per_hand' ? ' per hand' : set?.loadBasis === 'per_side' ? ' per side' : '';
      return `${Number(set?.weight) || 0} lb${suffix}`;
    }
    const added = Number(set.weight) || 0;
    return added > 0 ? `Bodyweight + ${added} lb` : 'Bodyweight';
  };

  function state() {
    return context.getState();
  }

  function completedWorkouts() {
    return list(state().workouts)
      .filter(workout => Number.isFinite(completedAt(workout)) && completedAt(workout) > 0)
      .slice()
      .sort((left, right) => completedAt(right) - completedAt(left));
  }

  function workoutsInWindow(days = selectedWindowDays) {
    const through = Date.now();
    const since = through - days * 24 * 60 * 60 * 1000;
    return completedWorkouts().filter(workout => {
      const time = completedAt(workout);
      return time > since && time <= through;
    });
  }

  function dashboardSummary(workouts) {
    return workouts.reduce((totals, workout) => {
      const summary = context.analytics.workoutSummary(workout, analyticsOptions());
      totals.sessions += 1;
      totals.workingSets += summary.workingSetCount;
      totals.volume = totals.volume === null || summary.workingSetVolume === null ? null : totals.volume + summary.workingSetVolume;
      totals.prs += summary.prCount;
      return totals;
    }, { sessions: 0, workingSets: 0, volume: 0, prs: 0 });
  }

  function sessionHistoryFor(exerciseId) {
    return context.analytics.exerciseHistory(state().workouts, exerciseId, analyticsOptions()).map(session => ({
      date: session.date,
      sets: session.workingSets,
      best: session.bestWorkingSet,
      estimated1RM: session.bestWorkingSet.estimated1RM,
      volume: session.workingSetVolume,
      volumeKind: session.workingSetVolumeKind
    }));
  }

  function loggedExercises() {
    return context.exercises.filter(exercise => sessionHistoryFor(exercise.id).length).sort((a, b) => a.name.localeCompare(b.name));
  }

  function bestSetAcross(sessions, exercise) {
    return context.analytics.bestWorkingSet(sessions.flatMap(session => session.sets), { ...analyticsOptions(), exercise });
  }

  function trendText(sessions) {
    if (sessions.some(session => session.estimated1RM === null)) return 'e1RM is unavailable for this exercise\'s measurement contract or required context.';
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

  function workloadGroups() {
    const muscleTotals = context.analytics.recentMuscleWorkload(state().workouts, { days: selectedWindowDays, ...analyticsOptions() }).muscles;
    return MUSCLE_GROUPS.map(group => {
      const totals = group.sources.reduce((sum, source) => {
        const value = muscleTotals[source] || {};
        sum.workingSets += Number(value.workingSets) || 0;
        sum.workingSetVolume = sum.workingSetVolume === null || value.workingSetVolume === null
          ? null
          : sum.workingSetVolume + (Number(value.workingSetVolume) || 0);
        sum.totalReps += Number(value.totalReps) || 0;
        return sum;
      }, { workingSets: 0, workingSetVolume: 0, totalReps: 0 });
      return { ...group, ...totals };
    });
  }

  function heatLevel(workingSets, maxSets) {
    if (!workingSets || !maxSets) return 0;
    return Math.max(1, Math.min(4, Math.ceil(workingSets / maxSets * 4)));
  }

  function muscleMapSvg(groups) {
    const lookup = new Map(groups.map(group => [group.key, group]));
    const maxSets = Math.max(0, ...groups.map(group => group.workingSets));
    const zone = (key, shape) => {
      const group = lookup.get(key) || { label: key, workingSets: 0 };
      const level = heatLevel(group.workingSets, maxSets);
      const selected = selectedMuscle === key;
      return shape.replace('CLASS', `muscle-zone heat-${level}${selected ? ' is-selected' : ''}`).replace('ATTRS', `data-muscle-key="${key}" role="button" tabindex="0" aria-pressed="${selected}" aria-label="${group.label}: ${group.workingSets} working sets"`);
    };

    return `<div class="muscle-map-wrap" aria-label="Muscle workload heatmap">
      <div class="muscle-map-figure"><span>Front</span><svg viewBox="0 0 180 360" aria-label="Front muscle map">
        <circle class="body-outline" cx="90" cy="34" r="20"></circle>
        <path class="body-outline" d="M70 57h40l18 39-12 91-10 145H74L64 187 52 96Z"></path>
        ${zone('Shoulders', '<ellipse class="CLASS" cx="55" cy="84" rx="17" ry="14" ATTRS></ellipse>')}
        ${zone('Shoulders', '<ellipse class="CLASS" cx="125" cy="84" rx="17" ry="14" ATTRS></ellipse>')}
        ${zone('Chest', '<path class="CLASS" d="M67 83h22v41H63l-4-26Z" ATTRS></path>')}
        ${zone('Chest', '<path class="CLASS" d="M91 83h22l8 15-4 26H91Z" ATTRS></path>')}
        ${zone('Arms', '<path class="CLASS" d="M43 96h14l-6 80H37Z" ATTRS></path>')}
        ${zone('Arms', '<path class="CLASS" d="M123 96h14l6 80h-14Z" ATTRS></path>')}
        ${zone('Core', '<rect class="CLASS" x="70" y="126" width="40" height="64" rx="14" ATTRS></rect>')}
        ${zone('Adductors', '<path class="CLASS" d="M81 198h10l-3 80H73Z" ATTRS></path>')}
        ${zone('Adductors', '<path class="CLASS" d="M89 198h10l8 80H92Z" ATTRS></path>')}
        ${zone('Quads', '<path class="CLASS" d="M68 194h17l-8 88H59Z" ATTRS></path>')}
        ${zone('Quads', '<path class="CLASS" d="M95 194h17l9 88h-18Z" ATTRS></path>')}
        ${zone('Calves', '<path class="CLASS" d="M62 286h16l-4 50H57Z" ATTRS></path>')}
        ${zone('Calves', '<path class="CLASS" d="M102 286h16l5 50h-17Z" ATTRS></path>')}
      </svg></div>
      <div class="muscle-map-figure"><span>Back</span><svg viewBox="0 0 180 360" aria-label="Back muscle map">
        <circle class="body-outline" cx="90" cy="34" r="20"></circle>
        <path class="body-outline" d="M70 57h40l18 39-12 91-10 145H74L64 187 52 96Z"></path>
        ${zone('Shoulders', '<ellipse class="CLASS" cx="55" cy="84" rx="17" ry="14" ATTRS></ellipse>')}
        ${zone('Shoulders', '<ellipse class="CLASS" cx="125" cy="84" rx="17" ry="14" ATTRS></ellipse>')}
        ${zone('Back', '<path class="CLASS" d="M68 78h44l9 22-12 60H71l-12-60Z" ATTRS></path>')}
        ${zone('Arms', '<path class="CLASS" d="M43 96h14l-6 80H37Z" ATTRS></path>')}
        ${zone('Arms', '<path class="CLASS" d="M123 96h14l6 80h-14Z" ATTRS></path>')}
        ${zone('Glutes', '<path class="CLASS" d="M68 162h22v40H62Z" ATTRS></path>')}
        ${zone('Glutes', '<path class="CLASS" d="M90 162h22l6 40H90Z" ATTRS></path>')}
        ${zone('Hamstrings', '<path class="CLASS" d="M66 205h20l-7 77H59Z" ATTRS></path>')}
        ${zone('Hamstrings', '<path class="CLASS" d="M94 205h20l7 77h-20Z" ATTRS></path>')}
        ${zone('Calves', '<path class="CLASS" d="M62 286h16l-4 50H57Z" ATTRS></path>')}
        ${zone('Calves', '<path class="CLASS" d="M102 286h16l5 50h-17Z" ATTRS></path>')}
      </svg></div>
    </div>`;
  }

  function muscleContributors(group) {
    if (!group) return [];
    const sourceSet = new Set(group.sources);
    const contributors = new Map();
    workoutsInWindow().forEach(workout => list(workout.exercises).forEach(exercise => {
      const exerciseMuscles = new Set(context.analytics.muscleNames(exercise.muscle));
      if (![...sourceSet].some(source => exerciseMuscles.has(source))) return;
      const summary = context.analytics.setSummary(exercise, analyticsOptions());
      if (!summary.workingSetCount) return;
      const key = exercise.definitionId || exercise.id || exercise.name;
      const current = contributors.get(key) || { name: exercise.name || key, workingSets: 0, workingSetVolume: 0 };
      current.workingSets += summary.workingSetCount;
      current.workingSetVolume = current.workingSetVolume === null || summary.workingSetVolume === null
        ? null
        : current.workingSetVolume + summary.workingSetVolume;
      contributors.set(key, current);
    }));
    return [...contributors.values()].sort((left, right) => right.workingSets - left.workingSets || right.workingSetVolume - left.workingSetVolume).slice(0, 5);
  }

  function muscleDetailMarkup(groups) {
    const requested = selectedMuscle ? groups.find(group => group.key === selectedMuscle) : null;
    const active = requested
      || groups.filter(group => group.workingSets > 0).sort((left, right) => right.workingSets - left.workingSets)[0]
      || groups[0];
    selectedMuscle = active?.key || null;
    if (!active || !active.workingSets) {
      return `<div class="muscle-detail is-zero" data-selected-muscle="${context.escapeHtml(active?.key || '')}">
        <div class="muscle-detail-head"><div><span class="label">Selected muscle</span><h3>${context.escapeHtml(active?.label || 'No workload yet')}</h3></div><strong>0 sets</strong></div>
        <div class="muscle-detail-metrics"><div><span>Volume</span><strong>0 lb</strong></div><div><span>Reps</span><strong>0</strong></div></div>
        <p class="muscle-zero-state">No ${context.escapeHtml((active?.label || 'muscle').toLowerCase())} working sets in the last ${selectedWindowDays} days.</p>
      </div>`;
    }
    const contributors = muscleContributors(active);
    return `<div class="muscle-detail" data-selected-muscle="${context.escapeHtml(active.key)}">
      <div class="muscle-detail-head"><div><span class="label">Selected muscle</span><h3>${context.escapeHtml(active.label)}</h3></div><strong>${active.workingSets} sets</strong></div>
      <div class="muscle-detail-metrics"><div><span>Volume</span><strong>${formatVolume(active.workingSetVolume)}</strong></div><div><span>Reps</span><strong>${formatCompact(active.totalReps)}</strong></div></div>
      <div class="muscle-contributors">${contributors.map(item => `<div><span>${context.escapeHtml(item.name)}</span><strong>${item.workingSets} set${item.workingSets === 1 ? '' : 's'}</strong></div>`).join('') || '<p>No contributing movements in this window.</p>'}</div>
    </div>`;
  }

  function renderProgressPreview(exerciseId) {
    const { preview } = elements();
    if (!preview) return;
    const exercise = context.exercises.find(item => item.id === exerciseId);
    const sessions = sessionHistoryFor(exerciseId);
    if (!exercise || !sessions.length) {
      preview.className = 'progress-preview empty';
      preview.textContent = 'No sessions logged for this movement yet.';
      return;
    }
    const best = bestSetAcross(sessions, exercise);
    const latest = sessions[0];
    preview.className = 'progress-preview';
    preview.innerHTML = `<div class="progress-preview-copy"><span class="exercise-muscle">${context.escapeHtml(exercise.muscle)}</span><h3>${context.escapeHtml(exercise.name)}</h3><p>${trendText(sessions)}</p></div><div class="progress-preview-stats"><div><span>Best set</span><strong>${context.escapeHtml(setLoadLabel(best))} × ${Number(best.reps)}</strong></div><div><span>Best e1RM</span><strong>${best.estimated1RM === null ? '—' : `${best.estimated1RM} lb`}</strong></div><div><span>Latest</span><strong>${latest.estimated1RM === null ? '—' : `${latest.estimated1RM} lb`}</strong></div></div>`;
  }

  function renderProgressDashboard() {
    const { panel } = elements();
    if (!panel) return;
    const workouts = workoutsInWindow();
    const summary = dashboardSummary(workouts);
    const groups = workloadGroups();
    const exercises = loggedExercises();
    const selectedExercise = exercises.some(exercise => exercise.id === panel.dataset.selectedExercise)
      ? panel.dataset.selectedExercise
      : exercises[0]?.id || '';
    panel.dataset.selectedExercise = selectedExercise;

    panel.className = 'progress-dashboard-panel';
    panel.innerHTML = `<div class="progress-dashboard-head">
      <div><span class="label">Training signal</span><h2>${selectedWindowDays}-day progress</h2><p>Derived from completed working sets. Warm-ups stay out of the math.</p></div>
      <div class="progress-window-toggle" role="group" aria-label="Progress time window">
        <button type="button" data-progress-window="7" class="${selectedWindowDays === 7 ? 'active' : ''}" aria-pressed="${selectedWindowDays === 7}">7D</button>
        <button type="button" data-progress-window="30" class="${selectedWindowDays === 30 ? 'active' : ''}" aria-pressed="${selectedWindowDays === 30}">30D</button>
      </div>
    </div>
    <div class="progress-overview-grid" aria-label="Progress overview">
      <article><span>Sessions</span><strong>${summary.sessions}</strong><small>${selectedWindowDays} day window</small></article>
      <article><span>Working sets</span><strong>${summary.workingSets}</strong><small>warm-ups excluded</small></article>
      <article><span>Volume</span><strong>${formatVolume(summary.volume)}</strong><small>moved</small></article>
      <article><span>PRs</span><strong>${summary.prs}</strong><small>strength markers</small></article>
    </div>
    <section class="progress-workload-card">
      <div class="progress-section-head"><div><span class="label">Muscle workload</span><h3>Where the work went.</h3><p>Heat is driven by completed working-set exposure, normalized to this window.</p></div><span class="progress-window-caption">Last ${selectedWindowDays} days</span></div>
      <div class="muscle-workload-layout">${muscleMapSvg(groups)}<div id="progressMuscleDetail">${muscleDetailMarkup(groups)}</div></div>
    </section>
    <section class="progress-strength-card">
      <div class="progress-section-head"><div><span class="label">Strength record</span><h3>Movement progress.</h3><p>Keep the deep chart one tap away; keep the dashboard readable.</p></div></div>
      ${exercises.length ? `<div class="progress-picker"><label class="search-box"><span>Logged movement</span><select id="progressExerciseSelect" aria-label="Choose exercise progress">${exercises.map(exercise => `<option value="${exercise.id}" ${exercise.id === selectedExercise ? 'selected' : ''}>${context.escapeHtml(exercise.name)}</option>`).join('')}</select></label><button id="openSelectedProgress" class="secondary" type="button">Open strength details</button></div><div id="progressPreview" class="progress-preview"></div>` : '<div id="progressPreview" class="progress-preview empty">Finish a workout and your movement trends will begin here.</div>'}
    </section>`;

    if (selectedExercise) renderProgressPreview(selectedExercise);
  }

  function renderCompactHistory() {
    const { history } = elements();
    if (!history) return;
    const workouts = completedWorkouts().slice(0, 3);
    if (!workouts.length) {
      history.className = 'history-list empty';
      history.textContent = 'Your completed workouts will appear here.';
      return;
    }
    history.className = 'history-list progress-recent-history';
    history.innerHTML = `${workouts.map(workout => {
      const summary = context.analytics.workoutSummary(workout, analyticsOptions());
      return `<button type="button" class="history-item progress-history-card" data-history-id="${context.escapeHtml(workout.id)}"><div class="progress-history-main"><div class="history-card-title"><strong>${context.escapeHtml(context.workoutLabel(workout.type))}</strong>${summary.prCount ? `<span class="pr-badge">${summary.prCount} PR${summary.prCount === 1 ? '' : 's'}</span>` : ''}</div><small>${formatArchiveDate(workout.completedAt)} · ${formatDuration(summary.durationSeconds)} · ${summary.workingSetCount} working set${summary.workingSetCount === 1 ? '' : 's'}</small>${workout.entryMethod === 'retrospective' ? '<span class="entered-later">Entered later</span>' : ''}</div><div class="history-meta"><strong>${formatVolume(summary.workingSetVolume,summary.workingSetVolumeKind)}</strong><small>${workloadLabel(summary.workingSetVolumeKind)}</small><span class="history-card-arrow" aria-hidden="true">→</span></div></button>`;
    }).join('')}<div class="progress-history-footer"><div><strong>Keep the full timeline close.</strong><span>Browse every completed session in List or Calendar.</span></div><button type="button" class="ghost compact" data-open-history-archive>Open History</button></div>`;
  }

  function groupedHistory() {
    const groups = [];
    completedWorkouts().forEach(workout => {
      const heading = formatMonthHeading(workout.completedAt);
      const latest = groups.at(-1);
      if (!latest || latest.heading !== heading) groups.push({ heading, workouts: [workout] });
      else latest.workouts.push(workout);
    });
    return groups;
  }

  function renderHistoryArchive() {
    const { archiveList } = elements();
    if (!archiveList) return;
    const workouts = completedWorkouts();
    const count = document.getElementById('historyArchiveCount');
    if (count) count.textContent = workouts.length
      ? `${workouts.length} completed workout${workouts.length === 1 ? '' : 's'} · newest first`
      : 'Your completed sessions will collect here.';
    if (!workouts.length) {
      archiveList.className = 'history-archive-list empty';
      archiveList.innerHTML = '<div class="history-archive-empty"><strong>No completed workouts yet.</strong><span>Finish a session or use History Calendar to log completed work.</span></div>';
      return;
    }
    archiveList.className = 'history-archive-list';
    archiveList.innerHTML = groupedHistory().map(group => `<section class="history-month-group" aria-labelledby="history-month-${group.heading.replace(/\s+/g, '-').toLowerCase()}"><div class="history-month-heading"><h3 id="history-month-${group.heading.replace(/\s+/g, '-').toLowerCase()}">${group.heading}</h3><span>${group.workouts.length} session${group.workouts.length === 1 ? '' : 's'}</span></div><div class="history-month-workouts">${group.workouts.map(workout => {
      const summary = context.analytics.workoutSummary(workout, analyticsOptions());
      const label = context.workoutLabel(workout.type);
      return `<button type="button" class="history-archive-card" data-history-id="${context.escapeHtml(workout.id)}" aria-label="Open ${context.escapeHtml(label)} from ${context.escapeHtml(formatArchiveDate(workout.completedAt))}"><span class="history-date-block"><strong>${formatDay(workout.completedAt)}</strong><span>${formatWeekday(workout.completedAt)}</span></span><span class="history-archive-card-main"><span class="history-card-title"><strong>${context.escapeHtml(label)}</strong>${workout.entryMethod === 'retrospective' ? '<span class="entered-later">Entered later</span>' : ''}${summary.prCount ? `<span class="pr-badge">${summary.prCount} PR${summary.prCount === 1 ? '' : 's'}</span>` : ''}</span><span class="history-card-date">${context.escapeHtml(formatArchiveDate(workout.completedAt))}</span><span class="history-card-metrics"><span>${formatDuration(summary.durationSeconds)}</span><span>${summary.workingSetCount} working set${summary.workingSetCount === 1 ? '' : 's'}</span><span>${formatVolume(summary.workingSetVolume)} volume</span></span></span><span class="history-card-arrow" aria-hidden="true">→</span></button>`;
    }).join('')}</div></section>`).join('');
  }

  function setHistoryView(view = 'list', { focus = false } = {}) {
    const next = view === 'calendar' ? 'calendar' : 'list';
    const { archive, listPanel, calendarPanel } = elements();
    selectedHistoryView = next;
    document.querySelectorAll('[data-history-view]').forEach(button => {
      const selected = button.dataset.historyView === next;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.classList.toggle('active', selected);
    });
    if (listPanel) listPanel.hidden = next !== 'list';
    if (calendarPanel) calendarPanel.hidden = next !== 'calendar';
    if (archive?.hidden === false && document.body.dataset.view === 'progress') document.body.dataset.route = `history-${next}`;
    if (focus) document.querySelector(`[data-history-view="${next}"]`)?.focus();
    return next;
  }

  function openHistoryArchive(view = 'list') {
    const { archive, overview } = elements();
    if (!archive) return false;
    if (archive.hidden) historyTrigger = document.activeElement;
    renderHistoryArchive();
    setHistoryView(view);
    if (overview) overview.hidden = true;
    archive.hidden = false;
    document.body.dataset.route = `history-${selectedHistoryView}`;
    jumpToTop();
    document.getElementById('historyArchiveTitle')?.focus({ preventScroll: true });
    jumpToTop();
    return true;
  }

  function closeHistoryArchive({ restoreFocus = true } = {}) {
    const { archive, overview } = elements();
    if (!archive || archive.hidden) return false;
    archive.hidden = true;
    if (overview) overview.hidden = false;
    if (document.body.dataset.view === 'progress') document.body.dataset.route = 'progress';
    jumpToTop();
    if (restoreFocus) historyTrigger?.focus?.({ preventScroll: true });
    historyTrigger = null;
    return true;
  }

  function currentHistoryView() {
    return elements().archive?.hidden === false ? selectedHistoryView : null;
  }

  function jumpToTop() {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    root.scrollTop = 0;
    document.body.scrollTop = 0;
    requestAnimationFrame(() => {
      root.scrollTop = 0;
      document.body.scrollTop = 0;
      root.style.scrollBehavior = previousBehavior;
    });
  }

  function closeProgress() {
    const { dialog } = elements();
    if (dialog?.close && dialog.open) dialog.close();
    else dialog?.removeAttribute('open');
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
      const best = bestSetAcross(sessions, exercise);
      const latest = sessions[0];
      const volumeKinds = new Set(sessions.map(session => session.volumeKind).filter(Boolean));
      const totalVolumeKind = volumeKinds.size === 1 ? [...volumeKinds][0] : volumeKinds.size > 1 ? 'mixed' : null;
      const totalVolume = sessions.some(session => session.volume === null) || totalVolumeKind === 'mixed' ? null : sessions.reduce((total, session) => total + session.volume, 0);
      const recent = sessions.slice(0, 8).map(session => `<article class="progress-session"><div><strong>${context.fmtDate(session.date)}</strong><small>${session.sets.length} working set${session.sets.length === 1 ? '' : 's'} · ${formatVolume(session.volume,session.volumeKind)} ${workloadLabel(session.volumeKind)}</small></div><div class="progress-session-meta"><strong>${context.escapeHtml(setLoadLabel(session.best))} × ${session.best.reps}</strong><small>${session.estimated1RM === null ? 'e1RM unavailable for this measurement contract' : `${session.estimated1RM} lb e1RM`}</small></div><div class="progress-session-sets">${session.sets.map(set => `<span>${context.escapeHtml(setLoadLabel(set))} × ${Number(set.reps)}</span>`).join('')}</div></article>`).join('');
      const chart = sessions.some(session => session.estimated1RM === null) ? '' : progressChart(sessions);
      content.innerHTML = `<div class="history-summary-grid progress-summary-grid"><div><span>Best set</span><strong>${context.escapeHtml(setLoadLabel(best))} × ${Number(best.reps)}</strong></div><div><span>Best estimated 1RM</span><strong>${best.estimated1RM === null ? '—' : `${best.estimated1RM} lb`}</strong></div><div><span>Training history</span><strong>${sessions.length} sessions · ${formatVolume(totalVolume,totalVolumeKind)}</strong></div></div><div class="progress-trend-note"><strong>${latest.estimated1RM === null ? 'e1RM unavailable' : `${latest.estimated1RM} lb latest e1RM`}</strong><span>${trendText(sessions)}</span></div>${chart}<div class="progress-recent-head"><span class="label">Recent work</span><h3>Session-by-session</h3></div><div class="progress-session-list">${recent}</div>`;
    }

    const { dialog } = elements();
    if (dialog?.showModal) dialog.showModal();
    else dialog?.setAttribute('open', '');
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
      button.dataset.progressExercise = exercise.definitionId || exercise.id;
      button.textContent = 'Progress';
      actions.prepend(button);
    });
  }

  function handleProgressClick(event) {
    const windowButton = event.target.closest('[data-progress-window]');
    if (windowButton) {
      selectedWindowDays = Number(windowButton.dataset.progressWindow) === 30 ? 30 : 7;
      selectedMuscle = null;
      renderProgressDashboard();
      return;
    }

    const muscle = event.target.closest('[data-muscle-key]');
    if (muscle) {
      selectedMuscle = muscle.dataset.muscleKey;
      renderProgressDashboard();
      return;
    }

    const openArchive = event.target.closest('[data-open-history-archive]');
    if (openArchive) {
      openHistoryArchive('list');
      return;
    }

    const historyView = event.target.closest('[data-history-view]');
    if (historyView) {
      setHistoryView(historyView.dataset.historyView);
      return;
    }

    const archiveWorkout = event.target.closest('#historyArchiveList [data-history-id]');
    if (archiveWorkout) {
      context.openHistory(archiveWorkout.dataset.historyId, 'list');
      return;
    }

    const progressButton = event.target.closest('[data-progress-exercise]');
    if (progressButton) {
      event.preventDefault();
      openExerciseProgress(progressButton.dataset.progressExercise);
      return;
    }

    if (event.target.closest('#openSelectedProgress')) {
      const select = document.getElementById('progressExerciseSelect');
      if (select?.value) openExerciseProgress(select.value);
    }
  }

  function handleProgressKeydown(event) {
    const historyTab = event.target.closest?.('[data-history-view]');
    if (historyTab && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = ['ArrowLeft', 'Home'].includes(event.key) ? 'list' : 'calendar';
      setHistoryView(next, { focus: true });
      return;
    }
    const muscle = event.target.closest?.('[data-muscle-key]');
    if (!muscle || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    selectedMuscle = muscle.dataset.muscleKey;
    renderProgressDashboard();
  }

  function initialize(apiContext) {
    context = apiContext;
    if (initialized) return;
    const { archive, dialog } = elements();
    if (!document.getElementById('progressPanel') || !dialog || !archive) return;

    document.addEventListener('change', event => {
      if (event.target.id !== 'progressExerciseSelect') return;
      const panel = document.getElementById('progressPanel');
      if (panel) panel.dataset.selectedExercise = event.target.value;
      renderProgressPreview(event.target.value);
    });
    document.addEventListener('click', handleProgressClick);
    document.addEventListener('keydown', handleProgressKeydown);
    document.getElementById('closeProgressDialog')?.addEventListener('click', closeProgress);
    dialog.addEventListener('click', event => { if (event.target === dialog) closeProgress(); });
    document.getElementById('closeHistoryArchive')?.addEventListener('click', closeHistoryArchive);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || archive.hidden || document.querySelector('dialog[open]')) return;
      event.preventDefault();
      closeHistoryArchive();
    });
    document.getElementById('cancelRoutineDialog')?.addEventListener('click', () => context.closeRoutineEditor());
    initialized = true;
  }

  function afterLibraryRender() {
    decorateLibrary();
  }

  function afterActiveRender({ activeWorkout }) {
    decorateActive(activeWorkout);
  }

  function afterFullRender({ activeWorkout }) {
    renderProgressDashboard();
    renderCompactHistory();
    if (elements().archive?.hidden === false) {
      renderHistoryArchive();
      setHistoryView(selectedHistoryView);
    }
    decorateLibrary();
    decorateActive(activeWorkout);
  }

  return {
    afterActiveRender,
    afterFullRender,
    afterLibraryRender,
    currentHistoryView,
    initialize,
    openHistory: openHistoryArchive,
    showOverview: () => closeHistoryArchive({ restoreFocus: false })
  };
})();
