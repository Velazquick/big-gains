(() => {
  const sessionDomain = window.BigGainsWorkoutSessionController;
  let expandedAdjustment = null;
  const adjustmentKey = (workoutId, exerciseId, setId) => JSON.stringify([workoutId, exerciseId, setId]);
  function toggleAdjustments(workoutId, exerciseId, setId) {
    const key = adjustmentKey(workoutId, exerciseId, setId);
    expandedAdjustment = expandedAdjustment === key ? null : key;
  }

  function controlLabel(field, { loadMode = 'external', label = null } = {}) {
    if (label) return label;
    if (field === 'weight') return loadMode === 'bodyweight' ? 'Added weight' : 'Weight';
    if (field === 'duration') return 'Duration';
    if (field === 'distance') return 'Distance';
    return 'Reps';
  }

  function renderStepper(field, exerciseIndex, setIndex, value, step, options = {}) {
    const safeValue = value === '' ? '' : Number(value);
    const label = controlLabel(field, options);
    const unit = options.unit ? `<span class="stepper-unit">${options.unit}</span>` : '';
    const className = `stepper ${field}-stepper`;
    return `
      <div class="${className}">
        <span class="stepper-label">${options.compact ? controlLabel(field) : label}${options.compact ? ` ${unit}` : ''}</span>
        <div class="stepper-control">
          ${options.compact ? '' : `<button type="button" data-adjust="-${options.adjustStep ?? step}" data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Decrease ${label}">−</button>`}
          <div class="stepper-value">
            <input data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" type="number" min="0" step="${step}" inputmode="decimal" value="${safeValue}" placeholder="${options.mayBeZero ? '0' : '—'}" aria-label="${label}${options.compact && options.unit ? ` (${options.unit})` : ''}">
            ${options.compact ? '' : unit}
          </div>
          ${options.compact ? '' : `<button type="button" data-adjust="${options.adjustStep ?? step}" data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Increase ${label}">+</button>`}
        </div>
      </div>
    `;
  }

  function summaryFor(exercise, estimate1RM, summarize = null, formatLoad = value => String(Number(value)), formatWorkload = (value, kind) => `${Math.round(value).toLocaleString('en-US')} ${kind === 'indicated_load' ? 'indicated lb' : 'lb volume'}`) {
    const working = (exercise.sets || []).filter(set => !set.warmup);
    const completed = working.filter(set => set.completed);
    const best = completed.reduce((winner, set) => {
      if (!winner) return set;
      return estimate1RM(Number(set.weight), Number(set.reps)) > estimate1RM(Number(winner.weight), Number(winner.reps)) ? set : winner;
    }, null);
    const semantic = typeof summarize === 'function' ? summarize(exercise) : null;
    const volume = semantic?.workingSetVolume ?? completed.reduce((total, set) => total + Number(set.weight || 0) * Number(set.reps || 0), 0);
    const volumeLabel = semantic?.workingSetVolume === null ? 'Workload unavailable' : formatWorkload(volume, semantic?.workingSetVolumeKind);
    return {
      complete: working.length > 0 && completed.length === working.length,
      completed: completed.length,
      total: working.length,
      progress: working.length ? `Set ${Math.min(completed.length + 1, working.length)} of ${working.length}` : 'No working sets',
      status: working.length ? `${completed.length}/${working.length} working sets` : 'No working sets',
      best: best ? `Best ${formatLoad(best.weight)} × ${Number(best.reps)}` : 'Tap to open and start',
      volume: volumeLabel
    };
  }

  function isCollapsed(exercise) {
    return exercise.collapsed !== false;
  }

  function incompleteWorking(exercise) {
    return (exercise?.sets || []).filter(set => !set.warmup).some(set => !set.completed);
  }

  function activeIndexForRender(activeWorkout) {
    const preferred = activeWorkout.exercises.findIndex(exercise => exercise.id === activeWorkout.focusedExerciseId && incompleteWorking(exercise));
    return preferred >= 0 ? preferred : activeWorkout.exercises.findIndex(incompleteWorking);
  }

  function setPosition(exercise, set) {
    if (set.warmup) return 'Warm-up';
    const working = exercise.sets.filter(item => !item.warmup);
    const position = working.indexOf(set) + 1;
    return `Set ${position} of ${working.length}`;
  }

  function renderActive({ activeWorkout, box, finishButton, lastPerformance, performanceDelta, estimate1RM, escapeHtml, stepper, loadModeFor = exercise => exercise?.equipment === 'Bodyweight' ? 'bodyweight' : 'external', inputFieldsFor = () => null, setSummaryFor = null, formatLoad = value => String(Number(value)), formatWorkload = null, guidanceMarkupFor = () => '', unitFor = () => 'lb', supportsWarmup = () => false }) {
    if (!activeWorkout) return;
    if (!activeWorkout.exercises.length) {
      box.innerHTML = '<div class="empty">Choose a routine or an exercise above.</div>';
      finishButton.disabled = true;
      return;
    }

    const activeIndex = activeIndexForRender(activeWorkout);
    const explicitOpen = activeWorkout.exercises.map((exercise,index) => exercise.collapsed === false ? index : -1).filter(index => index >= 0);
    const persistedFocus = activeWorkout.focusedExerciseId === activeWorkout.exercises[activeIndex]?.id;
    const expandedIndex = explicitOpen.includes(activeIndex) ? activeIndex : (explicitOpen[0] ?? (persistedFocus ? -1 : activeIndex));

    box.innerHTML = activeWorkout.exercises.map((exercise, exerciseIndex) => {
      const loadMode = loadModeFor(exercise);
      const inputFields = inputFieldsFor(exercise) || [
        { name: 'weight', label: loadMode === 'bodyweight' ? 'Added weight' : 'Weight', unit: 'lb', step: 5, mayBeZero: loadMode === 'bodyweight' },
        { name: 'reps', label: 'Reps', unit: '', step: 1, mayBeZero: false }
      ];
      const exerciseLoad = value => formatLoad(value, exercise);
      const exerciseWorkload = formatWorkload ? (value, kind) => formatWorkload(value, kind, exercise) : undefined;
      const unit = unitFor(exercise);
      const unitChoice = inputFields.some(field => field.name === 'weight')
        ? `<div class="active-exercise-unit-choice" role="group" aria-label="${escapeHtml(exercise.name)} weight unit">${['lb', 'kg'].map(choice => `<button type="button" data-exercise-unit="${choice}" data-ei="${exerciseIndex}" aria-pressed="${choice === unit}" aria-label="${choice === 'lb' ? 'Pounds' : 'Kilograms'}${choice === unit ? ' selected' : ''}"><span aria-hidden="true" class="unit-selected-mark">${choice === unit ? '✓' : ''}</span>${choice}</button>`).join('')}</div>`
        : '';
      const last = lastPerformance(exercise.id);
      const previous = last ? `${exerciseLoad(last.bestWorkingSet.weight)} × ${last.bestWorkingSet.reps}` : 'First time logged';
      const previousSets = last?.workingSets?.length > 1
        ? last.workingSets.map(set => `${exerciseLoad(set.weight)} × ${set.reps}`).join(' · ')
        : '';
      const improvement = performanceDelta(exercise, last)?.improvement || null;
      const summary = summaryFor(exercise, estimate1RM, setSummaryFor, exerciseLoad, exerciseWorkload);
      const collapsed = exerciseIndex !== expandedIndex;
      const isActive = !collapsed;
      const exerciseState = summary.complete ? 'completed' : isActive ? 'current' : 'upcoming';
      const firstIncomplete = exercise.sets.findIndex(set => !set.completed);
      const currentIndex = firstIncomplete >= 0 ? firstIncomplete : Math.max(0, exercise.sets.length - 1);

      const renderSet = (set, setIndex) => {
        const current = setIndex === currentIndex && !set.completed;
        const upcoming = !set.completed && setIndex > currentIndex;
        const setState = set.completed ? 'completed' : current ? 'current' : 'upcoming';
        const label = setPosition(exercise, set);
        const adjustmentOpen = expandedAdjustment === adjustmentKey(activeWorkout.id, exercise.id, set.id);
        const adjustmentId = `set-adjustments-${exerciseIndex}-${setIndex}`;
        return `
          <div class="set-line compact-set ${set.completed ? 'completed' : ''} ${current ? 'is-current' : ''} ${upcoming ? 'is-upcoming' : ''}" data-set-state="${setState}" data-set-id="${escapeHtml(set.id || '')}">
            <div class="set-row-meta sr-only">
              <span>${set.completed ? 'Logged' : current ? 'Current set' : 'Up next'}</span>
              <strong>${label}</strong>
            </div>
            <span class="set-number">${set.warmup ? 'W' : exercise.sets.filter(item => !item.warmup).indexOf(set) + 1}</span>
            ${inputFields.map(field => stepper(field.name, exerciseIndex, setIndex, set[field.name] ?? '', field.step, { ...field, loadMode, compact: true })).join('')}
            <button type="button" class="set-done" data-complete-set="1" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="${set.completed ? 'Mark set incomplete' : `Complete ${label}`}">
              <span class="set-done-icon">✓</span>
              <span class="set-done-text">${set.completed ? 'Done' : 'Complete'}</span>
            </button>
            <button type="button" class="set-adjustment-toggle" data-set-adjustments="${setIndex}" data-ei="${exerciseIndex}" aria-expanded="${adjustmentOpen}" aria-controls="${adjustmentId}" aria-label="Adjust ${label}">±</button>
            <button type="button" class="set-remove" data-remove-set="1" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Remove ${label}"><span aria-hidden="true">✕</span></button>
            <div class="set-adjustments" id="${adjustmentId}" ${adjustmentOpen ? '' : 'hidden'}>
              ${inputFields.map(field => `<div><span>${escapeHtml(field.label || controlLabel(field.name))}</span><button type="button" data-adjust="-${field.step}" data-field="${field.name}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Decrease ${escapeHtml(field.label || controlLabel(field.name))}">−</button><button type="button" data-adjust="${field.step}" data-field="${field.name}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Increase ${escapeHtml(field.label || controlLabel(field.name))}">+</button></div>`).join('')}
            </div>
          </div>
        `;
      };
      const warmups = exercise.sets.map((set,index) => set.warmup ? renderSet(set,index) : '').join('');
      const workingSets = exercise.sets.map((set,index) => !set.warmup ? renderSet(set,index) : '').join('');

      return `
        <article class="active-exercise ${collapsed ? 'is-collapsed' : ''} ${summary.complete ? 'is-complete' : ''} ${isActive ? 'is-active' : 'is-upcoming'}" data-exercise-state="${exerciseState}" data-exercise-id="${escapeHtml(exercise.id)}" aria-current="${isActive ? 'step' : 'false'}">
          <div class="exercise-head" data-exercise-head="${exerciseIndex}">
            <div>
              <div class="exercise-kickers"><span class="exercise-state-label">${exerciseState === 'current' ? 'Current' : exerciseState === 'completed' ? 'Completed' : 'Up next'}</span><span class="exercise-muscle">${escapeHtml(exercise.muscle)}</span></div>
              <h3>${escapeHtml(exercise.name)}</h3>
              <p>${escapeHtml(exercise.equipment)}${inputFields.find(field => field.name === 'weight')?.label ? ` · ${escapeHtml(inputFields.find(field => field.name === 'weight').label)}` : ''} · ${escapeHtml(summary.complete ? `${summary.completed} of ${summary.total} complete` : summary.progress)}</p>
            </div>
            <div class="exercise-head-actions">
                <button type="button" class="exercise-toggle" data-toggle-exercise="${exerciseIndex}" aria-expanded="${!collapsed}" aria-controls="exercise-body-${exerciseIndex}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(exercise.name)}"><span class="exercise-toggle-chevron" aria-hidden="true">⌄</span></button>
            </div>
          </div>
          ${unitChoice}
          <div class="active-exercise-body" id="exercise-body-${exerciseIndex}">
            ${guidanceMarkupFor(exercise)}
            <div class="exercise-context"><span>Last</span><strong data-previous-performance="${escapeHtml(exercise.id)}">${escapeHtml(previous)}</strong>${exercise.targetReps ? `<em class="exercise-target" data-target-reps="${escapeHtml(exercise.targetReps)}">Target ${escapeHtml(exercise.targetReps)}</em>` : ''}${improvement ? `<em class="exercise-delta" data-improvement-delta="${escapeHtml(improvement.kind)}">${escapeHtml(improvement.label)}</em>` : ''}${previousSets ? `<small>${escapeHtml(previousSets)}</small>` : ''}</div>
            ${supportsWarmup(exercise) || warmups ? `<section class="set-section" aria-label="Warmup"><div class="set-section-heading"><h4>Warmup</h4>${supportsWarmup(exercise) ? `<button type="button" data-add-warmup="${exerciseIndex}" aria-label="Add warmup set to ${escapeHtml(exercise.name)}">+</button>` : ''}</div><div class="set-grid">${warmups}</div></section>` : ''}
            <section class="set-section" aria-label="Working sets"><div class="set-section-heading"><h4>Working sets</h4></div><div class="set-grid">${workingSets}</div></section>
            <button type="button" class="add-set" data-add-set="${exerciseIndex}">+ Add working set</button>
            <details class="exercise-management"><summary>Exercise options</summary><div class="exercise-order">
                <button type="button" data-move-exercise="up" data-index="${exerciseIndex}" ${exerciseIndex === 0 ? 'disabled' : ''} aria-label="Move ${escapeHtml(exercise.name)} up">↑</button>
                <button type="button" data-move-exercise="down" data-index="${exerciseIndex}" ${exerciseIndex === activeWorkout.exercises.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeHtml(exercise.name)} down">↓</button>
              </div>
              <button type="button" class="remove-exercise" data-remove-exercise="${exerciseIndex}" aria-label="Remove ${escapeHtml(exercise.name)}">✕</button></details>
          </div>
          <div class="collapsed-summary">
            <div><strong>${escapeHtml(summary.status)}</strong><small>${escapeHtml(summary.best)}</small></div>
            <span>${summary.complete ? 'Complete' : 'Open →'}<small>${escapeHtml(summary.volume)}</small></span>
          </div>
        </article>
      `;
    }).join('');

    finishButton.disabled = !activeWorkout.exercises.some(exercise => exercise.sets.some(set => set.completed));
  }

  window.workoutControls = Object.freeze({
    advanceAfterCompletion: sessionDomain.advanceAfterCompletion,
    moveExercise: sessionDomain.moveExercise,
    renderActive,
    renderStepper,
    toggleAdjustments,
    toggleExercise: sessionDomain.toggleExercise
  });
})();
