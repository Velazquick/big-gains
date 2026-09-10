((scope) => {
  'use strict';

  const DEFAULT_RECENT_LIMIT = 8;
  const alphaCompare = (left, right) => left.name.localeCompare(right.name, 'en', { numeric: true, sensitivity: 'base' })
    || left.canonicalId.localeCompare(right.canonicalId);
  const list = value => Array.isArray(value) ? value : [];
  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
  const canonicalIdFor = (catalog, value) => catalog?.canonicalIdFor?.(value) || null;
  const canonicalSet = (catalog, values) => new Set(list(values).map(value => canonicalIdFor(catalog, value)).filter(Boolean));

  function sortExercises(exercises) {
    return list(exercises).slice().sort(alphaCompare);
  }

  function matchesSearch(catalog, exercise, term) {
    const normalized = catalog.normalizeTerm(term);
    if (!normalized) return true;
    return normalized.split(' ').filter(Boolean).every(token => catalog.matchesSearch(exercise, token));
  }

  function filterExercises({
    catalog,
    exercises = catalog?.exercises,
    term = '',
    muscle = 'all',
    equipment = 'all',
    excludedExerciseIds = [],
    eligibilityPredicate = null
  } = {}) {
    if (!catalog) return [];
    const excluded = canonicalSet(catalog, excludedExerciseIds);
    return sortExercises(list(exercises).filter(exercise => {
      const canonicalId = canonicalIdFor(catalog, exercise.canonicalId || exercise.id);
      return canonicalId
        && !excluded.has(canonicalId)
        && (!eligibilityPredicate || eligibilityPredicate(exercise))
        && (muscle === 'all' || exercise.muscle === muscle)
        && (equipment === 'all' || exercise.equipment === equipment)
        && matchesSearch(catalog, exercise, term);
    }));
  }

  function closestAlternatives({
    catalog,
    currentExerciseId,
    exercises = catalog?.exercises,
    excludedExerciseIds = [],
    eligibilityPredicate = null,
    limit = 8
  } = {}) {
    const current = catalog?.getById?.(currentExerciseId);
    if (!current?.canonicalId) return [];
    const currentPatterns = new Set(list(current.movementPatterns).filter(pattern => pattern && pattern !== 'unknown'));
    const currentPrimary = new Set(list(current.muscleRoles?.primary));
    const trackingModel = current.measurement?.trackingModel || null;
    const candidates = filterExercises({
      catalog,
      exercises,
      excludedExerciseIds: [current.canonicalId, ...list(excludedExerciseIds)],
      eligibilityPredicate
    }).flatMap(exercise => {
      if (!trackingModel || exercise.measurement?.trackingModel !== trackingModel) return [];
      const family = current.swapFamily || current.family;
      const sameFamily = Boolean(family && (exercise.swapFamily || exercise.family) === family);
      const samePrimary = list(exercise.muscleRoles?.primary).some(muscle => currentPrimary.has(muscle));
      const samePattern = list(exercise.movementPatterns).some(pattern => currentPatterns.has(pattern));
      if (!sameFamily || !samePrimary) return [];
      return [{ exercise, rank: samePattern ? 0 : 1 }];
    });
    return candidates.sort((left, right) => left.rank - right.rank
      || Number(left.exercise.equipment === current.equipment) - Number(right.exercise.equipment === current.equipment)
      || alphaCompare(left.exercise, right.exercise))
      .slice(0, Math.max(0, Number(limit) || 0))
      .map(item => item.exercise);
  }

  function measurementLabel(exercise) {
    const measurement = exercise?.measurement || {};
    const ui = measurement.ui || {};
    const resistance = measurement.loadSemantics?.resistanceSemantics;
    if (resistance === 'bodyweight_plus_external') return 'Bodyweight + added load';
    if (resistance === 'assistance') return ui.loadLabel || 'Assistance weight';
    if (ui.loadLabel) return ui.loadLabel;
    if (measurement.trackingModel === 'duration') return ui.durationLabel || 'Duration';
    if (measurement.trackingModel === 'distance_only') return ui.distanceLabel || 'Distance';
    if (measurement.trackingModel === 'distance_duration') return 'Distance + duration';
    if (measurement.trackingModel === 'reps_only' && resistance === 'bodyweight_only') return 'Bodyweight reps';
    return ui.repsLabel || '';
  }

  function resultMarkup(exercise, {
    selected = false,
    mode = 'picker',
    actionLabel = 'Add',
    added = false
  } = {}) {
    const canonicalId = exercise.canonicalId;
    const semantics = measurementLabel(exercise);
    const metadata = [exercise.muscle, exercise.equipment, semantics].filter(Boolean);
    const content = `<div class="exercise-result-copy"><h3>${escapeHtml(exercise.name)}</h3><p>${metadata.map(escapeHtml).join(' <span aria-hidden="true">·</span> ')}</p></div>`;
    if (mode === 'library') {
      return `<article class="exercise-card exercise-result-row ${added ? 'added' : ''}" data-exercise-canonical-id="${escapeHtml(canonicalId)}">${content}<button type="button" class="add-exercise primary compact" data-add="${escapeHtml(exercise.id)}">${escapeHtml(added ? 'Added' : actionLabel)}</button></article>`;
    }
    return `<button type="button" class="exercise-picker-result ${selected ? 'is-current' : ''}" data-exercise-picker-select="${escapeHtml(canonicalId)}" ${selected ? 'aria-current="true"' : ''}>${content}<span class="exercise-picker-result-state" aria-hidden="true">${selected ? 'Current' : 'Choose'}</span></button>`;
  }

  function recentExerciseIds({ state, profileId, catalog, limit = DEFAULT_RECENT_LIMIT } = {}) {
    if (!state || !profileId || state.profileId !== profileId || !catalog) return [];
    const events = [];
    const addWorkout = (workout, timestamp, sourceOrder) => {
      list(workout?.exercises).forEach((exercise, exerciseOrder) => {
        const definition = catalog.definitionFor(exercise);
        if (!definition?.canonicalId) return;
        events.push({
          canonicalId: definition.canonicalId,
          timestamp: Number.isFinite(new Date(timestamp).getTime()) ? new Date(timestamp).getTime() : 0,
          sourceOrder,
          exerciseOrder
        });
      });
    };
    if (state.activeWorkout) addWorkout(state.activeWorkout, state.activeWorkout.startedAt, -1);
    list(state.workouts).forEach((workout, index) => addWorkout(workout, workout.completedAt || workout.startedAt, index));
    events.sort((left, right) => right.timestamp - left.timestamp
      || left.sourceOrder - right.sourceOrder
      || left.exerciseOrder - right.exerciseOrder
      || left.canonicalId.localeCompare(right.canonicalId));
    const seen = new Set();
    const recent = [];
    for (const event of events) {
      if (seen.has(event.canonicalId)) continue;
      seen.add(event.canonicalId);
      recent.push(event.canonicalId);
      if (recent.length >= limit) break;
    }
    return recent;
  }

  function create({ catalog, getState, getProfileId, getElement = id => document.getElementById(id) } = {}) {
    if (!catalog) throw new Error('Exercise Picker requires the local EKF catalog.');
    const dialog = getElement('exercisePickerDialog');
    const search = getElement('exercisePickerSearch');
    const muscle = getElement('exercisePickerMuscle');
    const equipment = getElement('exercisePickerEquipment');
    const results = getElement('exercisePickerResults');
    const title = getElement('exercisePickerTitle');
    const prompt = getElement('exercisePickerPrompt');
    if (!dialog || !search || !muscle || !equipment || !results || !title || !prompt) {
      throw new Error('Exercise Picker presentation is missing.');
    }

    let active = null;
    let ownerDialog = null;
    let returnFocus = null;
    let historyPushed = false;
    let ignoreNextPop = false;
    let previousScrollRestoration = null;
    function releaseHistoryScroll() {
      // Popstate precedes the browser's persisted-scroll step. Restore the
      // caller's policy in the following task, after this owned traversal.
      setTimeout(() => {
        if (active || previousScrollRestoration === null) return;
        try { history.scrollRestoration = previousScrollRestoration; } catch {}
        previousScrollRestoration = null;
      }, 0);
    }

    const resolveIds = values => list(values).map(value => canonicalIdFor(catalog, value)).filter(Boolean);
    const eligibleBase = () => filterExercises({
      catalog,
      excludedExerciseIds: active?.excludedExerciseIds,
      eligibilityPredicate: active?.eligibilityPredicate
    });
    const currentFilters = () => ({ term: search.value, muscle: muscle.value, equipment: equipment.value });
    const filteredAll = () => filterExercises({
      catalog,
      excludedExerciseIds: active?.excludedExerciseIds,
      eligibilityPredicate: active?.eligibilityPredicate,
      ...currentFilters()
    });
    const byCanonicalId = new Map(catalog.exercises.map(exercise => [exercise.canonicalId, exercise]));

    function sectionMarkup(label, exercises, className = '') {
      if (!exercises.length) return '';
      return `<section class="exercise-picker-section ${className}"><div class="exercise-picker-section-head"><h3>${escapeHtml(label)}</h3><span>${exercises.length}</span></div><div class="exercise-picker-list">${exercises.map(exercise => resultMarkup(exercise, { selected: exercise.canonicalId === active.currentExerciseId })).join('')}</div></section>`;
    }

    function filteredOrderedIds(ids, allById) {
      return resolveIds(ids).map(id => allById.get(id)).filter(Boolean);
    }

    function render() {
      if (!active) return;
      const all = filteredAll();
      const allById = new Map(all.map(exercise => [exercise.canonicalId, exercise]));
      const recent = filteredOrderedIds(active.recentExerciseIds, allById);
      const suggested = filteredOrderedIds(active.suggestionIds, allById);
      const compact = !active.browseAll;
      const compactEmpty = '<div class="exercise-picker-empty"><strong>No close alternatives yet.</strong><p>Browse all exercises to choose a replacement.</p></div>';
      results.innerHTML = compact
        ? [sectionMarkup(active.suggestionLabel, suggested, 'exercise-picker-suggested') || compactEmpty,
          '<button type="button" class="secondary exercise-picker-browse-all" data-exercise-picker-browse>Browse all exercises</button>'].join('')
        : [sectionMarkup('Recent', recent, 'exercise-picker-recent'),
          sectionMarkup(active.suggestionLabel, suggested, 'exercise-picker-suggested'),
          sectionMarkup('All exercises A–Z', all, 'exercise-picker-all') || '<div class="exercise-picker-empty"><strong>No matching exercises.</strong><p>Clear a filter or try another exact name, alias, muscle, or equipment term.</p></div>'].join('');
      getElement('exercisePickerControls').hidden = compact;
      results.scrollTop = 0;
      getElement('exercisePickerClearFilters').hidden = !search.value && muscle.value === 'all' && equipment.value === 'all';
    }

    function fillFilters() {
      const base = eligibleBase();
      const optionMarkup = values => ['<option value="all">All</option>', ...values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)].join('');
      muscle.innerHTML = optionMarkup([...new Set(base.map(exercise => exercise.muscle).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
      equipment.innerHTML = optionMarkup([...new Set(base.map(exercise => exercise.equipment).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
    }

    function restoreOwner() {
      const focusTarget = returnFocus;
      if (ownerDialog && ownerDialog.isConnected && !ownerDialog.open) {
        if (ownerDialog.showModal) ownerDialog.showModal();
        else ownerDialog.setAttribute('open', '');
      }
      setTimeout(() => {
        const target = typeof focusTarget === 'function' ? focusTarget() : focusTarget;
        target?.focus?.({ preventScroll: true });
      }, 50);
      ownerDialog = null;
      returnFocus = null;
    }

    function close({ selectedId = null, fromHistory = false } = {}) {
      if (!active) return false;
      const closing = active;
      active = null;
      if (dialog.open && dialog.close) dialog.close();
      else dialog.removeAttribute('open');
      if (historyPushed && !fromHistory) {
        ignoreNextPop = true;
        history.back();
      }
      if (!historyPushed || fromHistory) releaseHistoryScroll();
      historyPushed = false;
      if (selectedId) closing.onSelect?.(selectedId);
      else closing.onCancel?.();
      restoreOwner();
      return true;
    }

    function open(options = {}) {
      if (active) return false;
      const eligibilityPredicate = typeof options.eligibilityPredicate === 'function'
        ? options.eligibilityPredicate
        : (typeof options.filter === 'function' ? options.filter : null);
      const excludedExerciseIds = resolveIds(options.excludedExerciseIds);
      const state = getState?.();
      const profileId = options.profileId || getProfileId?.();
      active = {
        eligibilityPredicate,
        excludedExerciseIds,
        currentExerciseId: canonicalIdFor(catalog, options.currentExerciseId),
        suggestionIds: resolveIds(options.suggestionIds),
        suggestionLabel: options.suggestionLabel || 'Suggested',
        browseAll: options.browseAllInitially !== false,
        recentExerciseIds: options.recentExerciseIds === false
          ? []
          : resolveIds(options.recentExerciseIds || recentExerciseIds({ state, profileId, catalog })),
        onSelect: options.onSelect,
        onCancel: options.onCancel
      };
      ownerDialog = [...document.querySelectorAll('dialog[open]')].find(candidate => candidate !== dialog) || null;
      returnFocus = options.returnFocus || document.activeElement;
      if (ownerDialog) {
        if (ownerDialog.close) ownerDialog.close();
        else ownerDialog.removeAttribute('open');
      }
      title.textContent = options.title || 'Choose an exercise';
      prompt.textContent = options.prompt || 'Search the local exercise catalog, then choose the exact movement you mean.';
      search.value = '';
      fillFilters();
      muscle.value = 'all';
      equipment.value = 'all';
      render();
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
      try {
        if (previousScrollRestoration === null) previousScrollRestoration = history.scrollRestoration;
        history.scrollRestoration = 'manual';
        history.pushState({ bigGainsExercisePicker: true }, '');
        historyPushed = true;
      } catch {
        historyPushed = false;
      }
      requestAnimationFrame(() => (active?.browseAll ? search : results.querySelector('[data-exercise-picker-select], [data-exercise-picker-browse]'))?.focus({ preventScroll: true }));
      return true;
    }

    search.addEventListener('input', render);
    muscle.addEventListener('change', render);
    equipment.addEventListener('change', render);
    getElement('exercisePickerClearFilters').addEventListener('click', () => {
      search.value = '';
      muscle.value = 'all';
      equipment.value = 'all';
      render();
      search.focus();
    });
    getElement('closeExercisePicker').addEventListener('click', () => close());
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('click', event => {
      if (event.target === dialog) return close();
      const browse = event.target.closest('[data-exercise-picker-browse]');
      if (browse && active) {
        active.browseAll = true;
        render();
        search.focus({ preventScroll: true });
        return;
      }
      const choice = event.target.closest('[data-exercise-picker-select]');
      if (!choice || !active) return;
      const selectedId = canonicalIdFor(catalog, choice.dataset.exercisePickerSelect);
      if (!selectedId || !filteredAll().some(exercise => exercise.canonicalId === selectedId)) return;
      close({ selectedId });
    });
    scope.addEventListener?.('popstate', () => {
      if (ignoreNextPop) {
        ignoreNextPop = false;
        releaseHistoryScroll();
        return;
      }
      if (active) close({ fromHistory: true });
    });

    return Object.freeze({ cancel: () => close(), isOpen: () => Boolean(active), open, render });
  }

  Object.defineProperty(scope, 'BigGainsExercisePicker', {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ closestAlternatives, create, filterExercises, matchesSearch, measurementLabel, recentExerciseIds, resultMarkup, sortExercises }),
    writable: false
  });
})(typeof window === 'object' ? window : globalThis);
