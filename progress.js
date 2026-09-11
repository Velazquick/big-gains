window.workoutProgress = (() => {
  let context = null;
  let initialized = false;
  let selectedWindowDays = 7;
  let selectedMuscle = null;
  let selectedAnatomyView = 'front';
  let selectedHistoryView = 'list';
  let historyTrigger = null;

  const MUSCLE_GROUPS = Object.freeze([
    { key: 'Chest', label: 'Chest', sources: ['Chest'] },
    { key: 'Shoulders', label: 'Shoulders', sources: ['Shoulders'] },
    { key: 'RearShoulders', label: 'Rear shoulders', sources: ['Rear Delts'] },
    { key: 'Back', label: 'Back & traps', sources: ['Back', 'Traps'] },
    { key: 'Biceps', label: 'Biceps', sources: ['Biceps'] },
    { key: 'Triceps', label: 'Triceps', sources: ['Triceps'] },
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
  const formatLoadVolume = (value, unit = null) => value === null ? '—' : units.formatWorkload(value, state(), { compact: true, unit });
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
      workloadFamily: session.workloadFamily,
      displayUnitOverride: session.displayUnitOverride
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

  function workloadFamiliesMarkup(workouts) {
    const totals = context.analytics.lifetimeWorkload(workouts, analyticsOptions());
    const rows = Object.entries(totals.families).filter(([, value]) => value.workingSetCount || value.gapCount).map(([family, value]) => {
      const label = WORKLOAD_FAMILY_META[family].label.replace('volume', 'workload');
      const amount = value.workingSetCount ? units.formatWorkload(value.total, state()) : 'Unavailable';
      const gap = value.gapCount ? ` · ${value.gapCount} set${value.gapCount === 1 ? '' : 's'} missing bodyweight${value.workingSetCount ? ' (known subtotal)' : ''}` : '';
      return `<div class="workload-family-read" data-workload-family="${family}"><strong>${amount}</strong><small>${label}${gap}</small></div>`;
    });
    return `<div class="workload-family-list">${rows.join('') || '<div class="workload-family-read"><strong>No eligible workload yet</strong><small>Completed load × rep work appears here.</small></div>'}</div>`;
  }

  function workloadChangeText(trend) {
    if (trend.change === null) return 'No previous comparable workload';
    if (trend.change === 0) return '→ Workload unchanged vs previous';
    const direction = trend.change > 0 ? '↑' : '↓';
    const signed = trend.change > 0 ? '+' : '−';
    const value = trend.percentage === null
      ? units.formatWorkload(Math.abs(trend.change), state(), { unit: trend.current.displayUnitOverride })
      : `${Math.abs(trend.percentage).toFixed(1)}%`;
    return `${direction} Workload ${signed}${value} vs previous`;
  }

  function movementSpark(trend) {
    const data = trend.sessions.slice(0, 8).reverse();
    const values = data.filter(item => item.workloadFamily === trend.current.workloadFamily && Number.isFinite(item.workload)).map(item => item.workload);
    const max = Math.max(...values, 1);
    // Discrete observations, zero-based scale, no invented interpolation across gaps.
    const marks = data.map((item, index) => {
      const x = data.length === 1 ? 48 : 5 + index * 86 / (data.length - 1);
      if (item.workloadFamily !== trend.current.workloadFamily || !Number.isFinite(item.workload)) return `<text x="${x}" y="37" text-anchor="middle" fill="currentColor">×</text>`;
      const y = 35 - item.workload / max * 28;
      return `<circle cx="${x}" cy="${y}" r="3" fill="currentColor"><title>${context.fmtDate(item.date)}: ${units.formatWorkload(item.workload, state(), { unit: trend.current.displayUnitOverride })}</title></circle>`;
    }).join('');
    return `<svg class="movement-spark" viewBox="0 0 96 40" role="img" aria-label="Last ${data.length} completed sessions, oldest to newest; dots show workload, crosses mark unavailable values"><path d="M2 38H94" stroke="currentColor" opacity=".3"/>${marks}</svg>`;
  }

  function renderTodayMovement() {
    const target = document.getElementById('todayMovementMetric');
    if (!target) return;
    const trend = context.analytics.recentWorkloadMovement(state().workouts, analyticsOptions());
    if (!trend) {
      target.innerHTML = '<div class="movement-metric"><strong class="movement-name">Recent movement</strong><small class="movement-change">Complete a movement with load × rep workload to see its trend here.</small></div>';
      return;
    }
    const current = trend.current;
    target.innerHTML = `<button type="button" class="movement-metric" data-today-progress-exercise="${context.escapeHtml(trend.exerciseId)}" aria-label="Open ${context.escapeHtml(current.exerciseName)} metrics in Progress"><strong class="movement-name">${context.escapeHtml(current.exerciseName)}</strong><strong class="movement-value">${units.formatWorkload(current.workload, state(), { unit: current.displayUnitOverride })}</strong>${movementSpark(trend)}<small class="movement-change">${workloadChangeText(trend)}</small><small class="movement-change">${WORKLOAD_FAMILY_META[current.workloadFamily].label.replace('volume', 'workload')}${current.workloadFamily === 'machine_indicated' ? ' · limited comparison' : ''} · ${context.fmtDate(current.date)}</small></button>`;
  }

  function exerciseWorkloadMarkup(exerciseId) {
    const trend = context.analytics.exerciseWorkloadTrend(state().workouts, exerciseId, analyticsOptions());
    if (!trend.current?.workloadFamily) return '';
    const format = session => session && Number.isFinite(session.workload) && session.workloadFamily === trend.current.workloadFamily
      ? units.formatWorkload(session.workload, state(), { unit: trend.current.displayUnitOverride }) : 'Unavailable';
    return `<section class="exercise-workload-read" aria-label="Exercise workload comparison"><h3>${WORKLOAD_FAMILY_META[trend.current.workloadFamily].label.replace('volume', 'workload')}</h3><div class="exercise-workload-values"><div><small>Latest · ${context.fmtDate(trend.current.date)}</small><strong>${format(trend.current)}</strong></div><div><small>${trend.previous ? `Previous · ${context.fmtDate(trend.previous.date)}` : 'Previous'}</small><strong>${trend.previous ? format(trend.previous) : 'First session'}</strong></div></div><p class="exercise-workload-change">${workloadChangeText(trend)}</p></section>`;
  }

  function workloadChart(sessions, family) {
    const meta = WORKLOAD_FAMILY_META[family];
    if (!meta) return '<div class="progress-chart-empty"><strong>No load-volume trend</strong><span>This movement’s measurement contract does not produce load × rep-event volume.</span></div>';
    const data = sessions.slice(0, 10).reverse().map(session => session.workloadFamily === family ? session : { ...session, workload: null });
    const known = data.filter(session => session.workloadFamily === family && session.workload !== null);
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
      : `<circle class="progress-dot progress-workload-dot" cx="${xFor(index)}" cy="${yFor(session.workload)}" r="5"><title>${context.fmtDate(session.date)}: ${formatLoadVolume(session.workload, sessions[0]?.displayUnitOverride)} ${meta.label.toLowerCase()}</title></circle>`).join('');
    const gapNote = data.some(session => session.workload === null)
      ? '<p class="progress-chart-gap-note">Gaps are sessions without comparable workload, not zero workload.</p>'
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

  // Counts are primary-role completed working sets, never cross-family tonnage.
  // A set contributes once per displayed region, even if two source roles match it.
  function workloadGroups() {
    return MUSCLE_GROUPS.map(group => {
      const contributors = muscleContributors(group);
      return { ...group, contributors,
        workingSets: contributors.reduce((sum, item) => sum + item.workingSets, 0),
        totalReps: contributors.reduce((sum, item) => sum + item.totalReps, 0) };
    });
  }

  function heatLevel(sets) {
    return sets >= 20 ? 4 : sets >= 10 ? 3 : sets >= 5 ? 2 : sets > 0 ? 1 : 0;
  }

  // Original vector artwork. Regions intentionally follow the catalog's broad
  // muscle roles; the silhouette does not imply finer physiological precision.
  function muscleMapSvg(groups) {
    const lookup = new Map(groups.map(group => [group.key, group]));
    const front = selectedAnatomyView === 'front';
    const pair = d => `<path d="${d}"/><path d="${d}" transform="translate(240 0) scale(-1 1)"/>`;
    const zone = (key, paths) => {
      const group = lookup.get(key);
      return `<g class="muscle-zone heat-${heatLevel(group.workingSets)}${selectedMuscle === key ? ' is-selected' : ''}" data-muscle-key="${key}" role="button" tabindex="0" aria-pressed="${selectedMuscle === key}" aria-label="${group.label}: ${group.workingSets} primary working sets">${paths}</g>`;
    };
    const shoulders = 'M77 81 C62 79 50 86 47 103 L45 121 C54 119 64 112 68 104 Z';
    const frontRegions = [
      ['Shoulders', pair(shoulders)],
      ['Chest', pair('M80 82 C91 84 106 87 117 91 L117 123 C105 133 83 132 71 119 L70 105 Z')],
      ['Biceps', pair('M46 125 C55 122 61 117 64 113 L62 145 C60 159 54 169 47 174 L38 166 Z')],
      ['Core', pair('M94 138 C101 138 111 137 117 134 L117 203 L107 220 L95 204 C91 182 87 164 88 149 Z') + pair('M78 132 L87 139 C83 162 88 193 94 209 L79 201 L71 181 Z')],
      ['Adductors', pair('M105 233 L117 246 L105 293 L98 312 L97 268 Z')],
      ['Quads', pair('M78 219 C83 216 96 218 102 225 L92 271 L94 312 C90 328 82 336 73 331 C64 310 64 274 67 252 Z')]
    ];
    const backRegions = [
      ['RearShoulders', pair(shoulders)],
      ['Back', pair('M108 64 L117 70 L117 132 C99 123 86 108 79 85 Z') + pair('M76 113 C89 133 104 139 117 141 L117 207 C98 196 82 179 77 158 Z')],
      ['Triceps', pair('M46 125 C56 122 61 117 64 113 L61 151 L48 179 L38 167 Z')],
      ['Glutes', pair('M80 207 C93 198 109 209 117 218 L117 245 C108 259 85 259 73 246 Z')],
      ['Hamstrings', pair('M72 257 C82 263 103 264 113 254 L102 310 L92 339 L77 335 C65 314 66 281 72 257 Z')],
      ['Calves', pair('M78 350 C83 346 90 347 94 352 L98 378 C97 401 90 416 85 429 L79 427 L70 385 Z')]
    ];
    const regions = front ? frontRegions : backRegions;
    return `<div class="muscle-map-wrap body-map-v2">
      <div class="progress-window-toggle anatomy-toggle" role="group" aria-label="Anatomy view">${['front', 'back'].map(view => `<button type="button" data-anatomy-view="${view}" aria-pressed="${selectedAnatomyView === view}" class="${selectedAnatomyView === view ? 'active' : ''}">${view === 'front' ? 'Front' : 'Back'}</button>`).join('')}</div>
      <div class="muscle-map-figure"><svg viewBox="0 0 240 480" role="group" aria-label="${front ? 'Front' : 'Back'} muscle map">
        <path class="body-outline" d="M120 12 C101 12 97 26 99 42 C100 54 106 60 108 64 L106 73 L78 79 C60 77 46 86 42 103 L33 149 L27 189 L16 227 C13 237 15 247 21 248 L32 231 L40 204 L54 177 L66 151 L72 179 L69 203 C58 230 61 272 65 301 L68 339 C64 358 63 382 70 408 L75 441 L62 451 C57 457 60 465 66 466 L88 464 C96 460 94 447 91 440 L99 405 L103 373 L100 342 L111 303 L120 264 L129 303 L140 342 L137 373 L141 405 L149 440 C146 447 144 460 152 464 L174 466 C180 465 183 457 178 451 L165 441 L170 408 C177 382 176 358 172 339 L175 301 C179 272 182 230 171 203 L168 179 L174 151 L186 177 L200 204 L208 231 L219 248 C225 247 227 237 224 227 L213 189 L207 149 L198 103 C194 86 180 77 162 79 L134 73 L132 64 C134 60 140 54 141 42 C143 26 139 12 120 12 Z"/>
        <path class="anatomy-line" d="M120 69 V245 M103 56 Q120 63 137 56 M70 343 Q83 338 99 344 M141 344 Q157 338 170 343"/>
        ${regions.map(([key, paths]) => zone(key, paths)).join('')}
        ${front ? '<path class="anatomy-line" d="M94 158 H146 M94 177 H146 M99 196 H141"/>' : ''}
      </svg></div>
      <p class="body-map-hint">Tap a region or choose below.</p>
      <div class="muscle-region-list" role="group" aria-label="Muscle regions">${regions.map(([key]) => { const group = lookup.get(key); return `<button type="button" data-muscle-key="${key}" aria-pressed="${selectedMuscle === key}"><span>${group.label}</span><strong>${group.workingSets}<span class="sr-only"> primary working sets</span></strong></button>`; }).join('')}</div>
      <div class="body-map-legend" aria-label="Exposure legend"><strong>Primary working sets</strong><div>${['0', '1–4', '5–9', '10–19', '20+'].map((label, level) => `<span><i class="heat-${level}" aria-hidden="true"></i>${label}</span>`).join('')}</div></div>
    </div>`;
  }

  function muscleContributors(group) {
    const sourceSet = new Set(group.sources);
    const contributors = new Map();
    workoutsInWindow().forEach(workout => list(workout.exercises).forEach(exercise => {
      const catalog = window.BigGainsExerciseCatalog;
      const definition = catalog.definitionFor(exercise);
      const primary = definition?.muscleRoles?.primary?.length ? definition.muscleRoles.primary : context.analytics.muscleNames(exercise.muscle);
      if (!primary.some(source => sourceSet.has(source))) return;
      const sets = list(exercise.sets).filter(context.analytics.isWorkingSet);
      if (!sets.length) return;
      const key = definition?.canonicalId || exercise.definitionId || exercise.id;
      if (!key) return;
      const current = contributors.get(key) || { exerciseId: definition?.id || null, name: definition?.name || exercise.name || key, workingSets: 0, totalReps: 0, lastTrained: workout.completedAt };
      current.workingSets += sets.length;
      current.totalReps += sets.reduce((sum, set) => sum + (Number(set.reps) || 0), 0);
      if (completedAt(workout) > new Date(current.lastTrained).getTime()) current.lastTrained = workout.completedAt;
      contributors.set(key, current);
    }));
    return [...contributors.values()].sort((a, b) => b.workingSets - a.workingSets || a.name.localeCompare(b.name));
  }

  function muscleDetailMarkup(groups) {
    const active = groups.find(group => group.key === selectedMuscle);
    if (!active) return '<div class="muscle-detail empty"><h3>Explore your training</h3><p>Select a muscle to see completed working sets and the exact movements behind them.</p></div>';
    const last = active.contributors.map(item => item.lastTrained).sort((a, b) => new Date(b) - new Date(a))[0];
    return `<div class="muscle-detail${active.workingSets ? '' : ' is-zero'}" data-selected-muscle="${active.key}">
      <div class="muscle-detail-head"><div><span class="label">Primary working-set exposure</span><h3>${active.label}</h3></div><strong>${active.workingSets} sets</strong></div>
      <div class="muscle-detail-metrics"><div><span>Primary working sets</span><strong>${active.workingSets}</strong></div><div><span>Reps</span><strong>${formatCompact(active.totalReps)}</strong></div></div>
      ${last ? `<p class="body-map-last">Last trained ${context.escapeHtml(context.fmtDate(last))}</p>` : `<p class="muscle-zero-state">No ${active.label.toLowerCase()} working sets in the last ${selectedWindowDays} days.</p>`}
      <div class="muscle-contributors">${active.contributors.map(item => item.exerciseId ? `<button type="button" data-progress-exercise="${context.escapeHtml(item.exerciseId)}"><span>${context.escapeHtml(item.name)}<small>View movement progress →</small></span><strong>${item.workingSets} sets</strong></button>` : `<div><span>${context.escapeHtml(item.name)}</span><strong>${item.workingSets} sets</strong></div>`).join('')}</div>
    </div>`;
  }

  function renderProgressPreview(exerciseId) {
    const { preview } = elements();
    if (!preview) return;
    const exercise = context.exercises.find(item => item.id === exerciseId || item.canonicalId === exerciseId);
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
      <div class="progress-section-head"><div><span class="label">Primary working-set exposure</span><h3>Body Map</h3><p>Stronger shading means more completed primary working sets. Secondary roles and warm-ups are excluded. This shows exposure, not growth, recovery or readiness.</p></div><span class="progress-window-caption">Last ${selectedWindowDays} days</span></div>
      <div class="muscle-workload-layout">${muscleMapSvg(groups)}<div id="progressMuscleDetail" aria-live="polite" aria-atomic="true">${muscleDetailMarkup(groups)}</div></div>
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
    const exercise = context.exercises.find(item => item.id === exerciseId || item.canonicalId === exerciseId);
    const sessions = sessionHistoryFor(exerciseId);
    if (!exercise) return;
    const historyDialog = document.getElementById('historyDialog');
    if (historyDialog?.open) context.closeHistory();

    elements().dialog.dataset.exerciseId = exercise.canonicalId || exercise.id;
    const title = document.getElementById('progressDialogTitle');
    title.innerHTML = `<button type="button" id="chooseProgressMovement" aria-expanded="false" aria-controls="progressMovementPicker">${context.escapeHtml(exercise.name)}</button>`;
    let picker = document.getElementById('progressMovementPicker');
    if (!picker) {
      picker = document.createElement('div');
      picker.id = 'progressMovementPicker';
      title.closest('.history-dialog-head').after(picker);
    }
    picker.hidden = true;
    picker.innerHTML = '<label class="search-box">Search logged movements<input id="progressMovementSearch" type="search" autocomplete="off" aria-controls="progressMovementResults"></label><div id="progressMovementResults" aria-label="Logged movements"></div><p id="progressMovementCount" role="status"></p>';
    const renderChoices = () => {
      const choices = window.BigGainsExercisePicker.filterExercises({catalog:window.BigGainsExerciseCatalog,exercises:loggedExercises(),term:document.getElementById('progressMovementSearch').value});
      document.getElementById('progressMovementResults').innerHTML = choices.map(item => `<button type="button" data-metrics-choice="${context.escapeHtml(item.canonicalId || item.id)}" aria-pressed="${(item.canonicalId || item.id) === (exercise.canonicalId || exercise.id)}">${context.escapeHtml(item.name)}</button>`).join('');
      document.getElementById('progressMovementCount').textContent = choices.length ? `${choices.length} logged movements` : 'No matching logged movements.';
    };
    document.getElementById('chooseProgressMovement').onclick = event => {
      picker.hidden = !picker.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!picker.hidden));
      if (!picker.hidden) { renderChoices(); document.getElementById('progressMovementSearch').focus(); }
    };
    document.getElementById('progressMovementSearch').oninput = renderChoices;
    picker.onclick = event => {
      const choice = event.target.closest('[data-metrics-choice]');
      if (!choice || !loggedExercises().some(item => (item.canonicalId || item.id) === choice.dataset.metricsChoice)) return;
      openExerciseProgress(choice.dataset.metricsChoice);
      document.getElementById('chooseProgressMovement').focus();
    };
    picker.onkeydown = event => {
      if (event.key !== 'Escape') return;
      event.preventDefault(); event.stopPropagation(); picker.hidden = true;
      document.getElementById('chooseProgressMovement').setAttribute('aria-expanded','false');
      document.getElementById('chooseProgressMovement').focus();
    };
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
      const totalWorkload = workloadFamily && sessions.every(session => session.workload !== null && session.workloadFamily === workloadFamily)
        ? sessions.reduce((total, session) => total + session.workload, 0)
        : null;
      const recent = sessions.slice(0, 8).map(session => {
        const sessionMeta = WORKLOAD_FAMILY_META[session.workloadFamily];
        const sessionWorkload = !sessionMeta
          ? 'No load-volume trend for this measurement contract'
          : session.workload === null
            ? `${sessionMeta.label} unavailable · no bodyweight at workout`
            : `${formatLoadVolume(session.workload)} ${sessionMeta.label.toLowerCase()}`;
        return `<article class="progress-session"><div><strong>${context.fmtDate(session.date)}</strong><small>${session.sets.length} working set${session.sets.length === 1 ? '' : 's'} · ${sessionWorkload}</small></div><div class="progress-session-meta"><strong>${context.escapeHtml(setLoadLabel(session.best))} × ${session.best.reps}</strong><small>${session.estimated1RM === null ? 'e1RM unavailable for this measurement contract or session context' : `${units.formatLoad(session.estimated1RM, state())} e1RM`}</small></div><details><summary>View ${session.sets.length} working sets</summary><ul>${session.sets.map((set, index) => `<li>Set ${index + 1}: ${context.escapeHtml(setLoadLabel(set))} × ${set.reps} reps</li>`).join('')}</ul><button type="button" class="ghost compact" data-workload-history="${context.escapeHtml(session.workoutId)}">Full workout →</button></details></article>`;
      }).join('');
      const e1rmChart = sessions.some(session => session.estimated1RM === null) ? '' : progressChart(sessions);
      const historyWorkload = workloadMeta
        ? totalWorkload === null ? `${sessions.length} sessions · workload has gaps` : `${sessions.length} sessions · ${formatLoadVolume(totalWorkload)}`
        : `${sessions.length} sessions · no load-volume family`;
      const recordQualification = workloadFamily === 'machine_indicated' ? '<p class="record-qualification">Profile-local, exact-exercise indicated load. It does not claim equivalent resistance across machines, gyms, pulleys, attachments, or calibration.</p>' : '';
      content.innerHTML = `<div class="history-summary-grid progress-summary-grid"><div><span>Best set</span><strong>${context.escapeHtml(setLoadLabel(best))} × ${Number(best.reps)}</strong></div><div><span>${context.escapeHtml(record?.recordLabel || 'Performance Record')}</span><strong>${context.escapeHtml(recordValue(record))}</strong></div><div><span>Training history</span><strong>${historyWorkload}</strong></div></div>${recordQualification}${exerciseWorkloadMarkup(exerciseId)}<div class="progress-trend-note"><strong>${latest.estimated1RM === null ? 'e1RM unavailable' : `${units.formatLoad(latest.estimated1RM, state())} latest e1RM`}</strong><span>${trendText(sessions)}</span></div>${workloadChart(sessions, workloadFamily)}${e1rmChart}<div class="progress-recent-head"><span class="label">Recent work</span><h3>Session-by-session</h3></div><div class="progress-session-list">${recent}</div>`;
    }

    const { dialog } = elements();
    if (dialog?.showModal) { if (!dialog.open) dialog.showModal(); }
    else dialog?.setAttribute('open', '');
    const shell = dialog?.querySelector('.history-dialog-shell');
    if (shell) shell.scrollTop = 0;
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
    const anatomy = event.target.closest('[data-anatomy-view]');
    if (anatomy) {
      selectedAnatomyView = anatomy.dataset.anatomyView === 'back' ? 'back' : 'front';
      selectedMuscle = null;
      renderProgressDashboard();
      document.querySelector('[data-anatomy-view="' + selectedAnatomyView + '"]')?.focus({ preventScroll: true });
      return;
    }
    const windowButton = event.target.closest('[data-progress-window]');
    if (windowButton) {
      selectedWindowDays = Number(windowButton.dataset.progressWindow) === 30 ? 30 : 7;
      selectedMuscle = null;
      renderProgressDashboard();
      document.querySelector(`[data-progress-window="${selectedWindowDays}"]`)?.focus({ preventScroll: true });
      return;
    }

    const muscle = event.target.closest('[data-muscle-key]');
    if (muscle) {
      selectedMuscle = muscle.dataset.muscleKey;
      const tag = muscle.tagName.toLowerCase();
      renderProgressDashboard();
      document.querySelector(`${tag}[data-muscle-key="${selectedMuscle}"]`)?.focus({ preventScroll: true });
      // The detail is below the anatomy on narrow screens: make the response to
      // a tap visible without forcing the user to discover it by scrolling.
      if (window.innerWidth <= 760) document.getElementById('progressMuscleDetail')?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
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

    const todayMovement = event.target.closest('[data-today-progress-exercise]');
    if (todayMovement) {
      window.bigGainsViewShell.showView('progress', { instant: true });
      openExerciseProgress(todayMovement.dataset.todayProgressExercise);
      return;
    }
    const workloadHistory = event.target.closest('[data-workload-history]');
    if (workloadHistory) {
      closeProgress();
      context.openHistory(workloadHistory.dataset.workloadHistory, 'list');
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
    if (!muscle || muscle.tagName.toLowerCase() === 'button' || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    selectedMuscle = muscle.dataset.muscleKey;
    renderProgressDashboard();
    document.querySelector(`g[data-muscle-key="${selectedMuscle}"]`)?.focus({ preventScroll: true });
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
    renderTodayMovement();
    renderCompactHistory();
    if (elements().archive?.hidden === false) {
      renderHistoryArchive();
      setHistoryView(selectedHistoryView);
    }
    decorateLibrary();
    decorateActive(activeWorkout);
  }

  return {
    workloadFamiliesMarkup,
    afterActiveRender,
    afterFullRender,
    afterLibraryRender,
    currentHistoryView,
    initialize,
    openHistory: openHistoryArchive,
    showOverview: () => closeHistoryArchive({ restoreFocus: false })
  };
})();
