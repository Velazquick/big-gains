(() => {
  function controlLabel(field) {
    return field === 'weight' ? 'Weight' : 'Reps';
  }

  stepper = function instrumentStepper(field, exerciseIndex, setIndex, value, step) {
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
  };

  function summaryFor(exercise) {
    const working = (exercise.sets || []).filter(set => !set.warmup);
    const completed = working.filter(set => set.completed);
    const best = completed.reduce((winner, set) => {
      if (!winner) return set;
      return estimate1RM(Number(set.weight), Number(set.reps)) > estimate1RM(Number(winner.weight), Number(winner.reps)) ? set : winner;
    }, null);
    const volume = completed.reduce((total, set) => total + Number(set.weight || 0) * Number(set.reps || 0), 0);
    return {
      complete: working.length > 0 && completed.length === working.length,
      status: working.length ? `${completed.length}/${working.length} working sets` : 'No working sets',
      best: best ? `Best ${Number(best.weight)} × ${Number(best.reps)}` : 'Tap to open and start',
      volume: `${Math.round(volume).toLocaleString('en-US')} lb volume`
    };
  }

  function openOnly(index) {
    if (!active?.exercises) return;
    active.exercises.forEach((exercise, exerciseIndex) => {
      exercise.collapsed = exerciseIndex !== index;
    });
  }

  function advanceAfterCompletion(exerciseIndex) {
    const exercise = active?.exercises?.[exerciseIndex];
    if (!exercise) return;
    const working = (exercise.sets || []).filter(set => !set.warmup);
    if (!working.length || !working.every(set => set.completed)) return;
    exercise.collapsed = true;
    const nextIndex = active.exercises.findIndex((candidate, index) => {
      if (index <= exerciseIndex) return false;
      return (candidate.sets || []).filter(set => !set.warmup).some(set => !set.completed);
    });
    if (nextIndex >= 0) openOnly(nextIndex);
    autosave();
    renderActive();
    if (nextIndex >= 0) requestAnimationFrame(() => {
      document.querySelectorAll('#activeExercises .active-exercise')[nextIndex]?.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
  }

  function setPosition(exercise, set, setIndex) {
    if (set.warmup) return 'Warm-up';
    const working = exercise.sets.filter(item => !item.warmup);
    const position = working.indexOf(set) + 1;
    return `Set ${position} of ${working.length}`;
  }

  renderActive = function renderInstrumentWorkout() {
    if (!active) return;
    const box = $('activeExercises');
    if (!active.exercises.length) {
      box.innerHTML = '<div class="empty">Choose a routine or an exercise above.</div>';
      $('finishWorkout').disabled = true;
      return;
    }

    box.innerHTML = active.exercises.map((exercise, exerciseIndex) => {
      const last = lastPerformance(exercise.name);
      const previous = last ? last.sets.map(set => `${set.weight} × ${set.reps}`).join(' · ') : 'First time logged. Establish the baseline.';
      const summary = summaryFor(exercise);
      if (exercise.collapsed === undefined) exercise.collapsed = true;
      const collapsed = Boolean(exercise.collapsed);
      const firstIncomplete = exercise.sets.findIndex(set => !set.completed);
      const currentIndex = firstIncomplete >= 0 ? firstIncomplete : Math.max(0, exercise.sets.length - 1);

      const sets = exercise.sets.map((set, setIndex) => {
        const current = setIndex === currentIndex && !set.completed;
        const upcoming = !set.completed && setIndex > currentIndex;
        const label = setPosition(exercise, set, setIndex);
        return `
          <div class="set-line ${set.completed ? 'completed' : ''} ${current ? 'is-current' : ''} ${upcoming ? 'is-upcoming' : ''}">
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
        <article class="active-exercise ${collapsed ? 'is-collapsed' : ''} ${summary.complete ? 'is-complete' : ''}">
          <div class="exercise-head" data-exercise-head="${exerciseIndex}">
            <div>
              <span class="exercise-muscle">${escapeHtml(exercise.muscle)}</span>
              <h3>${escapeHtml(exercise.name)}</h3>
              <p>${escapeHtml(exercise.equipment)} · ${escapeHtml(summary.status)}</p>
            </div>
            <div class="exercise-head-actions">
              <div class="exercise-order">
                <button type="button" data-move-exercise="up" data-index="${exerciseIndex}" ${exerciseIndex === 0 ? 'disabled' : ''} aria-label="Move ${escapeHtml(exercise.name)} up">↑</button>
                <button type="button" data-move-exercise="down" data-index="${exerciseIndex}" ${exerciseIndex === active.exercises.length - 1 ? 'disabled' : ''} aria-label="Move ${escapeHtml(exercise.name)} down">↓</button>
                <button type="button" class="exercise-toggle" data-toggle-exercise="${exerciseIndex}" aria-label="${collapsed ? 'Expand' : 'Collapse'} ${escapeHtml(exercise.name)}">${collapsed ? '+' : '−'}</button>
              </div>
              <button type="button" class="remove-exercise" data-remove-exercise="${exerciseIndex}" aria-label="Remove ${escapeHtml(exercise.name)}">✕</button>
            </div>
          </div>
          <div class="active-exercise-body">
            <div class="exercise-context"><span>Previous performance</span><strong>${escapeHtml(previous)}</strong></div>
            <div class="set-grid">${sets}</div>
            <button type="button" class="add-set" data-add-set="${exerciseIndex}">＋ Add set</button>
          </div>
          <div class="collapsed-summary">
            <div><strong>${escapeHtml(summary.status)}</strong><small>${escapeHtml(summary.best)}</small></div>
            <span>${escapeHtml(summary.volume)}</span>
          </div>
        </article>
      `;
    }).join('');

    saveState();
    $('finishWorkout').disabled = !active.exercises.some(exercise => exercise.sets.some(set => set.completed));
  };

  const activeBox = $('activeExercises');
  activeBox.addEventListener('click', event => {
    const completeButton = event.target.closest('[data-complete-set]');
    if (completeButton && active) {
      const exerciseIndex = Number(completeButton.dataset.ei);
      const setIndex = Number(completeButton.dataset.si);
      const set = active.exercises?.[exerciseIndex]?.sets?.[setIndex];
      const willComplete = set && !set.completed && Number(set.weight) > 0 && Number(set.reps) > 0;
      if (willComplete) requestAnimationFrame(() => advanceAfterCompletion(exerciseIndex));
      return;
    }

    const move = event.target.closest('[data-move-exercise]');
    if (move && active) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const from = Number(move.dataset.index);
      const to = move.dataset.moveExercise === 'up' ? from - 1 : from + 1;
      if (to >= 0 && to < active.exercises.length) {
        const [exercise] = active.exercises.splice(from, 1);
        active.exercises.splice(to, 0, exercise);
        autosave();
        renderActive();
      }
      return;
    }

    const toggle = event.target.closest('[data-toggle-exercise]');
    if (toggle && active) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const index = Number(toggle.dataset.toggleExercise);
      if (active.exercises[index].collapsed) openOnly(index);
      else active.exercises[index].collapsed = true;
      autosave();
      renderActive();
      return;
    }

    const head = event.target.closest('[data-exercise-head]');
    if (head && active && !event.target.closest('button,input,select,textarea,a')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const index = Number(head.dataset.exerciseHead);
      if (active.exercises[index].collapsed) openOnly(index);
      else active.exercises[index].collapsed = true;
      autosave();
      renderActive();
    }
  }, true);

  if (active) renderActive();
})();
