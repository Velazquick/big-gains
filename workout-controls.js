(() => {
  function controlLabel(field) {
    return field === 'weight' ? 'Weight' : 'Reps';
  }

  function renderStepper(field, exerciseIndex, setIndex, value, step) {
    const safeValue = value === '' ? '' : Number(value);
    const label = controlLabel(field);
    const unit = field === 'weight' ? '<span class="stepper-unit">lb</span>' : '';
    const className = field === 'reps' ? 'stepper reps-stepper' : 'stepper weight-stepper';
    return `
      <div class="${className}">
        <span class="stepper-label">${label}</span>
        <div class="stepper-control">
          <button type="button" data-adjust="-${step}" data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Decrease ${label}">−</button>
          <div class="stepper-value">
            <input data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" type="number" min="0" step="${step}" inputmode="decimal" value="${safeValue}" placeholder="—" aria-label="${label}">
            ${unit}
          </div>
          <button type="button" data-adjust="${step}" data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Increase ${label}">+</button>
        </div>
      </div>
    `;
  }

  function summaryFor(exercise, estimate1RM) {
    const working = (exercise.sets || []).filter(set => !set.warmup);
    const completed = working.filter(set => set.completed);
    const best = completed.reduce((winner, set) => {
      if (!winner) return set;
      return estimate1RM(Number(set.weight), Number(set.reps)) > estimate1RM(Number(winner.weight), Number(winner.reps)) ? set : winner;
    }, null);
    const volume = completed.reduce((total, set) => total + Number(set.weight || 0) * Number(set.reps || 0), 0);
    return {
      complete: working.length > 0 && completed.length === working.length,
      completed: completed.length,
      total: working.length,
      progress: working.length ? `Set ${Math.min(completed.length + 1, working.length)} of ${working.length}` : 'No working sets',
      status: working.length ? `${completed.length}/${working.length} working sets` : 'No working sets',
      best: best ? `Best ${Number(best.weight)} × ${Number(best.reps)}` : 'Tap to open and start',
      volume: `${Math.round(volume).toLocaleString('en-US')} lb volume`
    };
  }

  function isCollapsed(exercise) {
    return exercise.collapsed !== false;
  }

  function incompleteWorking(exercise) {
    return (exercise?.sets || []).filter(set => !set.warmup).some(set => !set.completed);
  }

  function resolveActiveIndex(activeWorkout) {
    const preferred = activeWorkout.exercises.findIndex(exercise => exercise.id === activeWorkout.focusedExerciseId && incompleteWorking(exercise));
    const index = preferred >= 0 ? preferred : activeWorkout.exercises.findIndex(incompleteWorking);
    const focusChanged = index >= 0 && activeWorkout.focusedExerciseId !== activeWorkout.exercises[index].id;
    activeWorkout.focusedExerciseId = index >= 0 ? activeWorkout.exercises[index].id : null;
    if (focusChanged) activeWorkout.exercises[index].collapsed = false;
    return index;
  }

  function openOnly(activeWorkout, index) {
    if (!activeWorkout?.exercises?.[index]) return false;
    activeWorkout.exercises.forEach((exercise, exerciseIndex) => {
      exercise.collapsed = exerciseIndex !== index;
    });
    activeWorkout.focusedExerciseId = activeWorkout.exercises[index].id;
    return true;
  }

  function toggleExercise(activeWorkout, index) {
    const exercise = activeWorkout?.exercises?.[index];
    if (!exercise) return false;
    if (!incompleteWorking(exercise)) exercise.collapsed = !isCollapsed(exercise);
    else if (isCollapsed(exercise)) openOnly(activeWorkout, index);
    else exercise.collapsed = true;
    return true;
  }

  function moveExercise(activeWorkout, from, direction) {
    if (!activeWorkout?.exercises) return false;
    const to = direction === 'up' ? from - 1 : from + 1;
    if (from < 0 || from >= activeWorkout.exercises.length || to < 0 || to >= activeWorkout.exercises.length) return false;
    const [exercise] = activeWorkout.exercises.splice(from, 1);
    activeWorkout.exercises.splice(to, 0, exercise);
    return true;
  }

  function advanceAfterCompletion(activeWorkout, exerciseIndex) {
    const exercise = activeWorkout?.exercises?.[exerciseIndex];
    if (!exercise) return { advanced: false, nextIndex: -1 };
    const working = (exercise.sets || []).filter(set => !set.warmup);
    if (!working.length || !working.every(set => set.completed)) return { advanced: false, nextIndex: -1 };
    exercise.collapsed = true;
    activeWorkout.focusedExerciseId = null;
    const nextIndex = resolveActiveIndex(activeWorkout);
    return { advanced: true, nextIndex };
  }

  function setPosition(exercise, set) {
    if (set.warmup) return 'Warm-up';
    const working = exercise.sets.filter(item => !item.warmup);
    const position = working.indexOf(set) + 1;
    return `Set ${position} of ${working.length}`;
  }

  function renderActive({ activeWorkout, box, finishButton, lastPerformance, estimate1RM, escapeHtml, stepper }) {
    if (!activeWorkout) return;
    if (!activeWorkout.exercises.length) {
      box.innerHTML = '<div class="empty">Choose a routine or an exercise above.</div>';
      finishButton.disabled = true;
      return;
    }

    const activeIndex = resolveActiveIndex(activeWorkout);

    box.innerHTML = activeWorkout.exercises.map((exercise, exerciseIndex) => {
      const last = lastPerformance(exercise.name);
      const previous = last ? last.sets.map(set => `${set.weight} × ${set.reps}`).join(' · ') : 'First time logged';
      const summary = summaryFor(exercise, estimate1RM);
      const collapsed = isCollapsed(exercise);
      const isActive = exerciseIndex === activeIndex;
      const exerciseState = summary.complete ? 'completed' : isActive ? 'current' : 'upcoming';
      const firstIncomplete = exercise.sets.findIndex(set => !set.completed);
      const currentIndex = firstIncomplete >= 0 ? firstIncomplete : Math.max(0, exercise.sets.length - 1);

      const sets = exercise.sets.map((set, setIndex) => {
        const current = setIndex === currentIndex && !set.completed;
        const upcoming = !set.completed && setIndex > currentIndex;
        const setState = set.completed ? 'completed' : current ? 'current' : 'upcoming';
        const label = setPosition(exercise, set);
        return `
          <div class="set-line ${set.completed ? 'completed' : ''} ${current ? 'is-current' : ''} ${upcoming ? 'is-upcoming' : ''}" data-set-state="${setState}">
            <div class="set-row-meta">
              <span>${set.completed ? 'Logged' : current ? 'Current set' : 'Up next'}</span>
              <strong>${label}</strong>
            </div>
            <span class="set-number">${set.warmup ? 'W' : exercise.sets.filter(item => !item.warmup).indexOf(set) + 1}</span>
            ${stepper('weight', exerciseIndex, setIndex, set.weight, 5)}
            ${stepper('reps', exerciseIndex, setIndex, set.reps, 1)}
            <button type="button" class="set-done" data-complete-set="1" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="${set.completed ? 'Mark set incomplete' : `Complete ${label}`}">
              <span class="set-done-icon">✓</span>
              <span class="set-done-text">${set.completed ? 'Done' : 'Complete'}</span>
            </button>
          </div>
        `;
      }).join('');

      return `
        <article class="active-exercise ${collapsed ? 'is-collapsed' : ''} ${summary.complete ? 'is-complete' : ''} ${isActive ? 'is-active' : 'is-upcoming'}" data-exercise-state="${exerciseState}" aria-current="${isActive ? 'step' : 'false'}">
          <div class="exercise-head" data-exercise-head="${exerciseIndex}">
            <div>
              <div class="exercise-kickers"><span class="exercise-state-label">${exerciseState === 'current' ? 'Current' : exerciseState === 'completed' ? 'Completed' : 'Up next'}</span><span class="exercise-muscle">${escapeHtml(exercise.muscle)}</span></div>
              <h3>${escapeHtml(exercise.name)}</h3>
              <p>${escapeHtml(exercise.equipment)} · ${escapeHtml(summary.complete ? `${summary.completed} of ${summary.total} complete` : summary.progress)}</p>
            </div>
            <div class="exercise-head-actions">
              <div class="exercise-order">
                <button type="button" data-move-exercise="up" data-index="${exerciseIndex}" ${exerciseIndex === 0 ? 'disabled' : ''} aria-label="Move ${escapeHtml(exercise.name)} up">↑</button>
                <button type="button" data-move-exercise="down" data-index="${exerciseIndex}" ${exerciseIndex === activeWorkout.exercises.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeHtml(exercise.name)} down">↓</button>
                <button type="button" class="exercise-toggle" data-toggle-exercise="${exerciseIndex}" aria-expanded="${!collapsed}" aria-controls="exercise-body-${exerciseIndex}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(exercise.name)}"><span class="exercise-toggle-chevron" aria-hidden="true">⌄</span></button>
              </div>
              <button type="button" class="remove-exercise" data-remove-exercise="${exerciseIndex}" aria-label="Remove ${escapeHtml(exercise.name)}">✕</button>
            </div>
          </div>
          <div class="active-exercise-body" id="exercise-body-${exerciseIndex}">
            <div class="exercise-context"><span>Last</span><strong>${escapeHtml(previous)}</strong></div>
            <div class="set-grid">${sets}</div>
            <button type="button" class="add-set" data-add-set="${exerciseIndex}">+ Add set</button>
          </div>
          <div class="collapsed-summary">
            <div><strong>${escapeHtml(summary.status)}</strong><small>${escapeHtml(summary.best)}</small></div>
            <span>${escapeHtml(summary.volume)}</span>
          </div>
        </article>
      `;
    }).join('');

    finishButton.disabled = !activeWorkout.exercises.some(exercise => exercise.sets.some(set => set.completed));
  }

  window.workoutControls = Object.freeze({
    advanceAfterCompletion,
    moveExercise,
    renderActive,
    renderStepper,
    toggleExercise
  });
})();
