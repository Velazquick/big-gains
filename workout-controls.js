(() => {
  function controlLabel(field) {
    return field === 'weight' ? 'Weight · lb' : 'Reps';
  }

  stepper = function polishedStepper(field, exerciseIndex, setIndex, value, step) {
    const safeValue = value === '' ? '' : Number(value);
    const label = controlLabel(field);
    const className = field === 'reps' ? 'stepper reps-stepper' : 'stepper weight-stepper';
    return `
      <div class="${className}">
        <span class="stepper-label">${label}</span>
        <button type="button" data-adjust="-${step}" data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Decrease ${label}">−</button>
        <input data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" type="number" min="0" step="${step}" inputmode="decimal" value="${safeValue}" placeholder="—" aria-label="${label}">
        <button type="button" data-adjust="${step}" data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Increase ${label}">+</button>
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

  renderActive = function renderPolishedActiveWorkout() {
    if (!active) return;
    const box = $('activeExercises');
    if (!active.exercises.length) {
      box.innerHTML = '<div class="empty">Choose a routine or an exercise above.</div>';
      $('finishWorkout').disabled = true;
      return;
    }

    box.innerHTML = active.exercises.map((exercise, exerciseIndex) => {
      const last = lastPerformance(exercise.name);
      const previous = last ? `Last: ${last.sets.map(set => `${set.weight} × ${set.reps}`).join(' · ')}` : 'First time logged.';
      const summary = summaryFor(exercise);
      if (exercise.collapsed === undefined) exercise.collapsed = true;
      const collapsed = Boolean(exercise.collapsed);
      const sets = exercise.sets.map((set, setIndex) => `
        <div class="set-line ${set.completed ? 'completed' : ''}">
          <span class="set-number">${set.warmup ? 'W' : setIndex}</span>
          ${stepper('weight', exerciseIndex, setIndex, set.weight, 5)}
          ${stepper('reps', exerciseIndex, setIndex, set.reps, 1)}
          <button type="button" class="set-done" data-complete-set="1" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="${set.completed ? 'Mark set incomplete' : 'Complete set'}">✓</button>
        </div>
      `).join('');

      return `
        <article class="active-exercise ${collapsed ? 'is-collapsed' : ''} ${summary.complete ? 'is-complete' : ''}">
          <div class="exercise-head" data-exercise-head="${exerciseIndex}">
            <div>
              <span class="exercise-muscle">${escapeHtml(exercise.muscle)}</span>
              <h3>${escapeHtml(exercise.name)}</h3>
              <p>${escapeHtml(exercise.equipment)}</p>
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
            <div class="previous-note">${escapeHtml(previous)}</div>
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

  if (active) renderActive();
})();
