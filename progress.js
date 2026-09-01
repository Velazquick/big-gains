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
  const units = window.BigGainsUnits;
  const WORKLOAD_FAMILY_META = Object.freeze({
    external_load: { label: 'External-load volume' },
    machine_indicated: { label: 'Machine-indicated volume' },
    modeled_system_load: { label: 'Modeled system-load volume' }
  });
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
  const formatLoadVolume = value => value === null ? '—' : units.formatWorkload(value, state(), { compact: true });
  const formatVolume = (value, kind = null) => value === null ? '—' : units.formatWorkload(value, state(), { kind, compact: true });
  const workloadLabel = kind => kind === 'indicated_load' ? 'indicated workload' : kind === 'modeled_system_load' ? 'modeled system volume' : kind === 'external_load' ? 'external-load volume' : 'comparable workload';
  const formatMonthHeading = iso => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(iso)).toUpperCase();
  const formatArchiveDate = iso => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso));
  const formatDay = iso => new Intl.DateTimeFormat('en-US', { day: '2-digit' }).format(new Date(iso));
  const formatWeekday = iso => new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(iso)).toUpperCase();
  const setLoadLabel = set => {
    if (set?.trackingModel === 'duration') return `${Number(set.duration) || 0} sec`;
    if (set?.trackingModel === 'load_distance') return `${units.formatLoad(Number(set.weight) || 0, state())} · ${Number(set.distance) || 0}`;
    if (set?.trackingModel === 'reps_only') return 'Bodyweight';
    if (set?.resistanceSemantics === 'assistance') return `${units.formatLoad(Number(set.weight) || 0, state())} assistance`;
    if (set?.loadMode !== 'bodyweight') {
      const suffix = set?.loadBasis === 'per_hand' ? ' per hand' : set?.loadBasis === 'per_side' ? ' per side' : '';
      return units.formatLoad(Number(set?.weight) || 0, state(), { suffix });
    }
    const added = Number(set.weight) || 0;
    return added > 0 ? `Bodyweight + ${units.formatLoad(added, state())}` : 'Bodyweight';
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
    const derived = context.analytics.derivePerformanceRecords(state().workouts, analyticsOptions());
    return workouts.reduce((totals, workout) => {
      const summary = context.analytics.workoutSummary(workout, analyticsOptions());
      totals.sessions += 1;
      totals.workingSets += summary.workingSetCount;
      totals.records += Number(derived.workoutRecordCounts?.[workout.id] || 0);
      return totals;
    }, { sessions: 0, workingSets: 0, records: 0 });
  }

  function sessionHistoryFor(exerciseId) {
    return context.analytics.exerciseHistory(state().workouts, exerciseId, analyticsOptions()).map(session => ({
      workoutId: session.workoutId,
      date: session.date,
      sets: session.workingSets,
      best: session.bestWorkingSet,
      estimated1RM: session.bestWorkingSet.estimated1RM,
      volume: session.workingSetVolume,
      volumeKind: session.workingSetVolumeKind,
      workload: session.workload,
      workloadFamily: session.workloadFamily
    }));
  }

  function currentRecordFor(exercise) {
    const exerciseId = exercise?.canonicalId || exercise?.id;
    const states = context.analytics.derivePerformanceRecords(state().workouts, analyticsOptions()).currentRecordStates?.[exerciseId] || {};
    return states.e1rm || states.indicatedLoad || null;
  }

  function recordValue(record) {
    return record ? units.formatLoad(record.observedValue, state()) : '—';
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
    return `${change > 0 ? '+' : '−'}${units.formatLoad(Math.abs(change), state())} estimated strength${percent ? ` (${percent}%)` : ''} since the first log.`;
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
      return `<line class="progress-grid-line" x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}"></line><text class="progress-axis-label" x="6" y="${y + 4}">${units.formatLoad(value, state())}</text>`;
    }).join('');
    const dots = data.map((session, index) => `<circle class="progress-dot" cx="${xFor(index)}" cy="${yFor(session.estimated1RM)}" r="5"><title>${context.fmtDate(session.date)}: ${units.formatLoad(session.estimated1RM, state())} estimated 1RM</title></circle>`).join('');
    return `<div class="progress-chart"><div class="progress-chart-title"><strong>Estimated 1RM trend</strong><span>Last ${data.length} session${data.length === 1 ? '' : 's'}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Estimated one rep max trend">${grid}<polyline class="progress-line" points="${points}"></polyline>${dots}<text class="progress-date-label" x="${padX}" y="${height - 7}">${context.escapeHtml(formatMonthDay(data[0].date))}</text><text class="progress-date-label" text-anchor="end" x="${width - padX}" y="${height - 7}">${context.escapeHtml(formatMonthDay(data[data.length - 1].date))}</text></svg></div>`;
  }

  function workloadChart(sessions, family) {
    const meta = WORKLOAD_FAMILY_META[family];
    if (!meta) return '<div class="progress-chart-empty"><strong>No load-volume trend</strong><span>This movement’s measurement contract does not produce load × rep-event volume.</span></div>';
    const data = sessions.slice(0, 10).reverse();
    const known = data.filter(session => session.workload !== null);
    if (!known.length) {
      const detail = family === 'modeled_system_load'
        ? 'No bodyweight was logged on or before these workout dates, so modeled workload is unavailable.'
        : 'No comparable workload is available for these sessions.';
      return `<div class="progress-chart-empty"><strong>${meta.label} unavailable</strong><span>${detail}</span></div>`;
    }
    const width = 620;
    const height = 230;
    const padX = 46;
    const padY = 34;
    const values = known.map(session => session.workload);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const spread = Math.max(100, rawMax - rawMin);
    const min = Math.max(0, rawMin - spread * 0.18);
    const max = rawMax + spread * 0.18;
    const xFor = index => data.length === 1 ? width / 2 : padX + index * ((width - padX * 2) / (data.length - 1));
    const yFor = value => height - padY - ((value - min) / Math.max(1, max - min)) * (height - padY * 2);
    const grid = [0, 0.5, 1].map(ratio => {
      const value = min + (max - min) * ratio;
      const y = yFor(value);
      return `<line class="progress-grid-line" x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}"></line><text class="progress-axis-label" x="6" y="${y + 4}">${units.formatWorkload(value, state(), { compact: true })}</text>`;
    }).join('');
    const segments = [];
    let segment = [];
    data.forEach((session, index) => {
      if (session.workload === null) {
        if (segment.length) segments.push(segment);
        segment = [];
      } else segment.push(`${xFor(index).toFixed(1)},${yFor(session.workload).toFixed(1)}`);
    });
    if (segment.length) segments.push(segment);
    const lines = segments.map(points => points.length > 1
      ? `<polyline class="progress-line progress-workload-line" points="${points.join(' ')}"></polyline>`
      : '').join('');
    const dots = data.map((session, index) => session.workload === null
      ? `<line class="progress-gap-marker" x1="${xFor(index)}" y1="${padY}" x2="${xFor(index)}" y2="${height - padY}"><title>${context.fmtDate(session.date)}: workload unavailable</title></line>`
      : `<circle class="progress-dot progress-workload-dot" cx="${xFor(index)}" cy="${yFor(session.workload)}" r="5"><title>${context.fmtDate(session.date)}: ${formatLoadVolume(session.workload)} ${meta.label.toLowerCase()}</title></circle>`).join('');
    const gapNote = data.some(session => session.workload === null)
      ? '<p class="progress-chart-gap-note">Gaps are sessions with unavailable modeled bodyweight, not zero workload.</p>'
      : '';
    return `<div class="progress-chart progress-workload-chart"><div class="progress-chart-title"><strong>${meta.label} trend</strong><span>Last ${data.length} session${data.length === 1 ? '' : 's'}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${meta.label} session trend">${grid}${lines}${dots}<text class="progress-date-label" x="${padX}" y="${height - 7}">${context.escapeHtml(formatMonthDay(data[0].date))}</text><text class="progress-date-label" text-anchor="end" x="${width - padX}" y="${height - 7}">${context.escapeHtml(formatMonthDay(data[data.length - 1].date))}</text></svg>${gapNote}</div>`;
  }

  function workloadComparison(current, previous) {
    if (current.gapCount || previous.gapCount) return 'Comparison unavailable · modeled bodyweight gaps';
    if (previous.total > 0) {
      const delta = current.total - previous.total;
      const percent = Math.round(Math.abs(delta) / previous.total * 100);
      return `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatLoadVolume(Math.abs(delta))} · ${delta > 0 ? '+' : delta < 0 ? '−' : ''}${percent}% vs prior`;
    }
    return current.total > 0 ? 'New in this window' : 'No prior comparable workload';
  }

  function trainingWorkloadMarkup() {
    const windows = context.analytics.trainingWorkloadWindows(state().workouts, {
      days: selectedWindowDays, ...analyticsOptions()
    });
    const rows = Object.entries(WORKLOAD_FAMILY_META).flatMap(([family, meta]) => {
      const snapshots = windows.families[family];
      const present = snapshots.current.workingSetCount || snapshots.current.gapCount
        || snapshots.previous.workingSetCount || snapshots.previous.gapCount;
      if (!present) return [];
      const unavailable = snapshots.current.gapCount && !snapshots.current.workingSetCount;
      const gapCopy = snapshots.current.gapSessionCount
        ? `${snapshots.current.gapSessionCount} session${snapshots.current.gapSessionCount === 1 ? '' : 's'} unavailable · no prior bodyweight`
        : `${snapshots.current.workingSetCount} working set${snapshots.current.workingSetCount === 1 ? '' : 's'} · ${snapshots.current.sessionCount} session${snapshots.current.sessionCount === 1 ? '' : 's'}`;
      const currentValue = unavailable ? 'Unavailable' : snapshots.current.gapCount
        ? `${formatLoadVolume(snapshots.current.total)} known`
        : formatLoadVolume(snapshots.current.total);
      return [`<div class="training-workload-row" data-workload-family="${family}"><div><strong>${meta.label}</strong><small>${gapCopy}</small></div><div class="training-workload-value"><strong>${currentValue}</strong><small>${workloadComparison(snapshots.current, snapshots.previous)}</small></div></div>`];
    });
    return `<section class="progress-training-workload-card" aria-labelledby="trainingWorkloadTitle">
      <div class="progress-section-head"><div><span class="label">Training workload</span><h3 id="trainingWorkloadTitle">Training workload · Last ${selectedWindowDays} days</h3><p>Load × rep events from completed working sets. Resistance types are kept separate and do not estimate training stimulus.</p></div><span class="progress-window-caption">vs prior ${selectedWindowDays} days</span></div>
      <div class="training-workload-list">${rows.join('') || '<div class="training-workload-empty"><strong>No load-volume workload in this window.</strong><span>Reps-only, duration, and distance work stay outside these load-volume families.</span></div>'}</div>
    </section>`;
  }

  function workloadGroups() {
    const muscleTotals = context.analytics.recentMuscleWorkload(state().workouts, { days: selectedWindowDays, ...analyticsOptions() }).muscles;
    return MUSCLE_GROUPS.map(group => {
      const totals = group.sources.reduce((sum, source) => {
        const value = muscleTotals[source] || {};
        sum.workingSets += Number(value.workingSets) || 0;
        sum.totalReps += Number(value.totalReps) || 0;
        return sum;
      }, { workingSets: 0, totalReps: 0 });
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

    return `<div class="muscle-map-wrap" aria-label="Working-set exposure map">
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
      const definition = context.exercises.find(item => item.id === (exercise.definitionId || exercise.id));
      const exerciseMuscles = new Set(definition?.muscleRoles?.primary?.length
        ? definition.muscleRoles.primary
        : context.analytics.muscleNames(exercise.muscle));
      if (![...sourceSet].some(source => exerciseMuscles.has(source))) return;
      const summary = context.analytics.setSummary(exercise, analyticsOptions());
      if (!summary.workingSetCount) return;
      const key = exercise.definitionId || exercise.id || exercise.name;
      const current = contributors.get(key) || { name: exercise.name || key, workingSets: 0 };
      current.workingSets += summary.workingSetCount;
      contributors.set(key, current);
    }));
    return [...contributors.values()].sort((left, right) => right.workingSets - left.workingSets || left.name.localeCompare(right.name)).slice(0, 5);
  }

  function muscleDetailMarkup(groups) {
    const requested = selectedMuscle ? groups.find(group => group.key === selectedMuscle) : null;
    const active = requested
      || groups.filter(group => group.workingSets > 0).sort((left, right) => right.workingSets - left.workingSets)[0]
      || groups[0];
    selectedMuscle = active?.key || null;
    if (!active || !active.workingSets) {
      return `<div class="muscle-detail is-zero" data-selected-muscle="${context.escapeHtml(active?.key || '')}">
        <div class="muscle-detail-head"><div><span class="label">Primary working-set exposure</span><h3>${context.escapeHtml(active?.label || 'No exposure yet')}</h3></div><strong>0 sets</strong></div>
        <div class="muscle-detail-metrics"><div><span>Primary working sets</span><strong>0</strong></div><div><span>Reps</span><strong>0</strong></div></div>
        <p class="muscle-zero-state">No ${context.escapeHtml((active?.label || 'muscle').toLowerCase())} working sets in the last ${selectedWindowDays} days.</p>
      </div>`;
    }
    const contributors = muscleContributors(active);
    return `<div class="muscle-detail" data-selected-muscle="${context.escapeHtml(active.key)}">
      <div class="muscle-detail-head"><div><span class="label">Primary working-set exposure</span><h3>${context.escapeHtml(active.label)}</h3></div><strong>${active.workingSets} sets</strong></div>
      <div class="muscle-detail-metrics"><div><span>Primary working sets</span><strong>${active.workingSets}</strong></div><div><span>Reps</span><strong>${formatCompact(active.totalReps)}</strong></div></div>
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
    const record = currentRecordFor(exercise);
    const recordNote = record?.recordType === 'indicated_load' ? '<small class="record-qualification">Highest indicated load recorded for this exact exercise in this profile; machine setups may differ.</small>' : '';
    preview.className = 'progress-preview';
    preview.innerHTML = `<div class="progress-preview-copy"><span class="exercise-muscle">${context.escapeHtml(exercise.muscle)}</span><h3>${context.escapeHtml(exercise.name)}</h3><p>${trendText(sessions)}</p>${recordNote}</div><div class="progress-preview-stats"><div><span>Best set</span><strong>${context.escapeHtml(setLoadLabel(best))} × ${Number(best.reps)}</strong></div><div><span>${context.escapeHtml(record?.recordLabel || 'Performance Record')}</span><strong>${context.escapeHtml(recordValue(record))}</strong></div><div><span>Latest e1RM</span><strong>${latest.estimated1RM === null ? '—' : units.formatLoad(latest.estimated1RM, state())}</strong></div></div>`;
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
      <article><span>Records</span><strong>${summary.records}</strong><small>typed record events</small></article>
    </div>
    ${trainingWorkloadMarkup()}
    <section class="progress-workload-card">
      <div class="progress-section-head"><div><span class="label">Working-set exposure</span><h3>Primary working-set exposure.</h3><p>Heat reflects primary-role working-set counts, normalized to this window. It does not partition load or estimate muscle stimulus.</p></div><span class="progress-window-caption">Last ${selectedWindowDays} days</span></div>
      <div class="muscle-workload-layout">${muscleMapSvg(groups)}<div id="progressMuscleDetail">${muscleDetailMarkup(groups)}</div></div>
    </section>
    <section class="progress-strength-card">
      <div class="progress-section-head"><div><span class="label">Movement record</span><h3>Movement progress.</h3><p>Strength and workload trends stay isolated to the exact exercise.</p></div></div>
      ${exercises.length ? `<div class="progress-picker"><label class="search-box"><span>Logged movement</span><select id="progressExerciseSelect" aria-label="Choose exercise progress">${exercises.map(exercise => `<option value="${exercise.id}" ${exercise.id === selectedExercise ? 'selected' : ''}>${context.escapeHtml(exercise.name)}</option>`).join('')}</select></label><button id="openSelectedProgress" class="secondary" type="button">Open movement details</button></div><div id="progressPreview" class="progress-preview"></div>` : '<div id="progressPreview" class="progress-preview empty">Finish a workout and your movement trends will begin here.</div>'}
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
    const recordCounts = context.analytics.derivePerformanceRecords(state().workouts, analyticsOptions()).workoutRecordCounts;
    history.innerHTML = `${workouts.map(workout => {
      const summary = context.analytics.workoutSummary(workout, analyticsOptions());
      const recordCount = Number(recordCounts[workout.id] || 0);
      return `<button type="button" class="history-item progress-history-card" data-history-id="${context.escapeHtml(workout.id)}"><div class="progress-history-main"><div class="history-card-title"><strong>${context.escapeHtml(context.workoutLabel(workout.type))}</strong>${recordCount ? `<span class="pr-badge">${recordCount} record${recordCount === 1 ? '' : 's'}</span>` : ''}</div><small>${formatArchiveDate(workout.completedAt)} · ${formatDuration(summary.durationSeconds)} · ${summary.workingSetCount} working set${summary.workingSetCount === 1 ? '' : 's'}</small>${workout.entryMethod === 'retrospective' ? '<span class="entered-later">Entered later</span>' : ''}</div><div class="history-meta"><strong>${formatVolume(summary.workingSetVolume,summary.workingSetVolumeKind)}</strong><small>${workloadLabel(summary.workingSetVolumeKind)}</small><span class="history-card-arrow" aria-hidden="true">→</span></div></button>`;
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
    const recordCounts = context.analytics.derivePerformanceRecords(state().workouts, analyticsOptions()).workoutRecordCounts;
    archiveList.innerHTML = groupedHistory().map(group => `<section class="history-month-group" aria-labelledby="history-month-${group.heading.replace(/\s+/g, '-').toLowerCase()}"><div class="history-month-heading"><h3 id="history-month-${group.heading.replace(/\s+/g, '-').toLowerCase()}">${group.heading}</h3><span>${group.workouts.length} session${group.workouts.length === 1 ? '' : 's'}</span></div><div class="history-month-workouts">${group.workouts.map(workout => {
      const summary = context.analytics.workoutSummary(workout, analyticsOptions());
      const label = context.workoutLabel(workout.type);
      const recordCount = Number(recordCounts[workout.id] || 0);
      return `<button type="button" class="history-archive-card" data-history-id="${context.escapeHtml(workout.id)}" aria-label="Open ${context.escapeHtml(label)} from ${context.escapeHtml(formatArchiveDate(workout.completedAt))}"><span class="history-date-block"><strong>${formatDay(workout.completedAt)}</strong><span>${formatWeekday(workout.completedAt)}</span></span><span class="history-archive-card-main"><span class="history-card-title"><strong>${context.escapeHtml(label)}</strong>${workout.entryMethod === 'retrospective' ? '<span class="entered-later">Entered later</span>' : ''}${recordCount ? `<span class="pr-badge">${recordCount} record${recordCount === 1 ? '' : 's'}</span>` : ''}</span><span class="history-card-date">${context.escapeHtml(formatArchiveDate(workout.completedAt))}</span><span class="history-card-metrics"><span>${formatDuration(summary.durationSeconds)}</span><span>${summary.workingSetCount} working set${summary.workingSetCount === 1 ? '' : 's'}</span><span>${formatVolume(summary.workingSetVolume)} volume</span></span></span><span class="history-card-arrow" aria-hidden="true">→</span></button>`;
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
      const record = currentRecordFor(exercise);
      const workloadFamily = sessions.find(session => session.workloadFamily)?.workloadFamily || null;
      const workloadMeta = WORKLOAD_FAMILY_META[workloadFamily];
      const totalWorkload = workloadFamily && sessions.every(session => session.workload !== null)
        ? sessions.reduce((total, session) => total + session.workload, 0)
        : null;
      const recent = sessions.slice(0, 8).map(session => {
        const sessionWorkload = !workloadMeta
          ? 'No load-volume trend for this measurement contract'
          : session.workload === null
            ? `${workloadMeta.label} unavailable · no bodyweight at workout`
            : `${formatLoadVolume(session.workload)} ${workloadMeta.label.toLowerCase()}`;
        return `<article class="progress-session"><div><strong>${context.fmtDate(session.date)}</strong><small>${session.sets.length} working set${session.sets.length === 1 ? '' : 's'} · ${sessionWorkload}</small></div><div class="progress-session-meta"><strong>${context.escapeHtml(setLoadLabel(session.best))} × ${session.best.reps}</strong><small>${session.estimated1RM === null ? 'e1RM unavailable for this measurement contract or session context' : `${units.formatLoad(session.estimated1RM, state())} e1RM`}</small></div><div class="progress-session-sets">${session.sets.map(set => `<span>${context.escapeHtml(setLoadLabel(set))} × ${Number(set.reps)}</span>`).join('')}</div></article>`;
      }).join('');
      const e1rmChart = sessions.some(session => session.estimated1RM === null) ? '' : progressChart(sessions);
      const historyWorkload = workloadMeta
        ? totalWorkload === null ? `${sessions.length} sessions · workload has gaps` : `${sessions.length} sessions · ${formatLoadVolume(totalWorkload)}`
        : `${sessions.length} sessions · no load-volume family`;
      const recordQualification = record?.recordType === 'indicated_load' ? '<p class="record-qualification">Profile-local, exact-exercise indicated load. It does not claim equivalent resistance across machines, gyms, pulleys, attachments, or calibration.</p>' : '';
      content.innerHTML = `<div class="history-summary-grid progress-summary-grid"><div><span>Best set</span><strong>${context.escapeHtml(setLoadLabel(best))} × ${Number(best.reps)}</strong></div><div><span>${context.escapeHtml(record?.recordLabel || 'Performance Record')}</span><strong>${context.escapeHtml(recordValue(record))}</strong></div><div><span>Training history</span><strong>${historyWorkload}</strong></div></div>${recordQualification}<div class="progress-trend-note"><strong>${latest.estimated1RM === null ? 'e1RM unavailable' : `${units.formatLoad(latest.estimated1RM, state())} latest e1RM`}</strong><span>${trendText(sessions)}</span></div>${e1rmChart}${workloadChart(sessions, workloadFamily)}<div class="progress-recent-head"><span class="label">Recent work</span><h3>Session-by-session</h3></div><div class="progress-session-list">${recent}</div>`;
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
