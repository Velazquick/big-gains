(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const safeNumber = value => value === '' ? '' : Math.max(0, Number(value) || 0);

  function create(context) {
    let draft = null;
    let saving = false;

    function selectedDate() {
      const [year, month, day] = context.getSelectedDateKey().split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    function plannedType() {
      const planned = context.profile.weekPlan[selectedDate().getDay()];
      return planned && planned !== 'Rest' && context.defaultRoutines[planned] ? planned : 'Other';
    }

    function availableTypes() {
      const planned = Object.values(context.profile.weekPlan || {}).filter(type => type !== 'Rest' && context.defaultRoutines[type]);
      if (context.profile.libraryRoutineTypes) return context.profile.libraryRoutineTypes.filter(type => context.defaultRoutines[type]);
      const standard = ['Push', 'Pull', 'Legs', 'Core', 'FullBody', 'Cardio', 'Other'].filter(type => context.defaultRoutines[type]);
      return [...new Set([...planned, ...standard])];
    }

    function definitionFor(exercise) {
      return context.exercises.find(item => item.id === exercise.definitionId || item.name === exercise.name);
    }

    function createExercise(definition, workoutType = draft?.type) {
      const prior = context.lastPerformance(definition.id)?.workingSets || [];
      const working = Number(prior[0]?.weight) || 0;
      const prescription = context.routinePrescription(workoutType, definition.id);
      const workingSets = Number(prescription?.workingSets) || 3;
      const targetReps = typeof prescription?.targetReps === 'string' ? prescription.targetReps : '';
      return {
        id: context.createId(),
        definitionId: definition.id,
        name: definition.name,
        muscle: definition.muscle,
        equipment: definition.equipment,
        note: '',
        ...(targetReps ? { targetReps, targetWorkingSets: workingSets } : {}),
        sets: [
          { id: context.createId(), weight: working ? Math.round(working * .6 / 5) * 5 : 0, reps: 10, warmup: true, completed: false },
          ...Array.from({ length: workingSets }, (_, index) => ({
            id: context.createId(),
            weight: Number(prior[index]?.weight) || working || 0,
            reps: Number(prior[index]?.reps) || 0,
            warmup: false,
            completed: false
          }))
        ]
      };
    }

    function loadRoutine(type = draft.type) {
      draft.type = type;
      draft.exercises = context.routineFor(type)
        .map(id => context.exercises.find(exercise => exercise.id === id))
        .filter(Boolean)
        .map(definition => createExercise(definition, type));
      render();
    }

    function blankWorkout() {
      draft.exercises = [];
      render();
    }

    function exerciseOptions() {
      const routineIds = new Set(context.routineFor(draft.type));
      const used = new Set(draft.exercises.map(exercise => exercise.definitionId));
      return context.exercises
        .filter(exercise => !used.has(exercise.id))
        .filter(exercise => context.profile.capabilities.allExercises || exercise.day === draft.type || draft.type === 'Other' || routineIds.has(exercise.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    function setLabel(exercise, set) {
      if (set.warmup) return 'Warm-up';
      return `Working set ${exercise.sets.filter(item => !item.warmup).indexOf(set) + 1}`;
    }

    function renderExercise(exercise, exerciseIndex) {
      const sets = exercise.sets.map((set, setIndex) => `<div class="retrospective-set ${set.completed ? 'is-complete' : ''}">
        <label class="retrospective-set-kind"><input type="checkbox" data-retro-field="warmup" data-ei="${exerciseIndex}" data-si="${setIndex}" ${set.warmup ? 'checked' : ''}><span>${context.escapeHtml(setLabel(exercise, set))}</span></label>
        <label><span>Weight</span><input type="number" min="0" step="5" inputmode="decimal" data-retro-field="weight" data-ei="${exerciseIndex}" data-si="${setIndex}" value="${set.weight}"></label>
        <label><span>Reps</span><input type="number" min="0" step="1" inputmode="numeric" data-retro-field="reps" data-ei="${exerciseIndex}" data-si="${setIndex}" value="${set.reps}"></label>
        <label class="retrospective-set-complete"><input type="checkbox" data-retro-field="completed" data-ei="${exerciseIndex}" data-si="${setIndex}" ${set.completed ? 'checked' : ''}><span>Performed</span></label>
        <button type="button" class="ghost compact" data-retro-remove-set="${setIndex}" data-ei="${exerciseIndex}" aria-label="Remove ${context.escapeHtml(setLabel(exercise, set))}">Remove</button>
      </div>`).join('');
      return `<article class="active-exercise retrospective-exercise" data-retro-exercise="${exerciseIndex}">
        <div class="exercise-head"><div><span class="exercise-muscle">${context.escapeHtml(exercise.muscle)}</span><h3>${context.escapeHtml(exercise.name)}</h3><p>${context.escapeHtml(exercise.equipment)}${exercise.targetReps ? ` · Target ${context.escapeHtml(exercise.targetReps)}` : ''}</p></div>
        <div class="exercise-head-actions"><div class="exercise-order"><button type="button" data-retro-move="up" data-ei="${exerciseIndex}" ${exerciseIndex === 0 ? 'disabled' : ''} aria-label="Move ${context.escapeHtml(exercise.name)} up">↑</button><button type="button" data-retro-move="down" data-ei="${exerciseIndex}" ${exerciseIndex === draft.exercises.length - 1 ? 'disabled' : ''} aria-label="Move ${context.escapeHtml(exercise.name)} down">↓</button></div><button type="button" class="remove-exercise" data-retro-remove-exercise="${exerciseIndex}" aria-label="Remove ${context.escapeHtml(exercise.name)}">✕</button></div></div>
        <div class="retrospective-set-list">${sets}</div>
        <label class="retrospective-note"><span>Exercise note</span><textarea rows="2" data-retro-exercise-note="${exerciseIndex}" placeholder="Form, setup, or context">${context.escapeHtml(exercise.note || '')}</textarea></label>
        <button type="button" class="add-set" data-retro-add-set="${exerciseIndex}">+ Add set</button>
      </article>`;
    }

    function render() {
      if (!draft) return;
      $('retrospectiveDate').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(selectedDate());
      $('retrospectiveWorkoutType').innerHTML = availableTypes().map(type => `<option value="${type}" ${type === draft.type ? 'selected' : ''}>${context.escapeHtml(context.workoutLabel(type))}</option>`).join('');
      $('retrospectiveExercises').innerHTML = draft.exercises.length ? draft.exercises.map(renderExercise).join('') : '<div class="empty">Blank workout. Add only the movements you performed.</div>';
      const options = exerciseOptions();
      $('retrospectiveExerciseSelect').innerHTML = options.map(exercise => `<option value="${exercise.id}">${context.escapeHtml(exercise.name)} — ${context.escapeHtml(exercise.equipment)}</option>`).join('');
      $('retrospectiveAddExercise').disabled = !options.length;
      $('retrospectiveError').textContent = '';
    }

    function open() {
      if (context.getSelectedDateKey() > context.localDateKey(new Date())) return false;
      const type = plannedType();
      draft = {
        token: context.createId(),
        type,
        exercises: [],
        completionTime: '',
        durationMinutes: '',
        note: '',
        evaluatePrs: true
      };
      if (type !== 'Other') {
        draft.exercises = context.routineFor(type).map(id => context.exercises.find(exercise => exercise.id === id)).filter(Boolean).map(definition => createExercise(definition, type));
      }
      saving = false;
      $('saveRetrospectiveWorkout').disabled = false;
      $('retrospectiveCompletionTime').value = '';
      $('retrospectiveDuration').value = '';
      $('retrospectiveWorkoutNote').value = '';
      $('retrospectiveEvaluatePrs').checked = true;
      render();
      const dialog = $('retrospectiveDialog');
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
      requestAnimationFrame(() => $('retrospectiveTitle').focus({ preventScroll: true }));
      return true;
    }

    function close({ discard = true } = {}) {
      const dialog = $('retrospectiveDialog');
      if (dialog.close && dialog.open) dialog.close(); else dialog.removeAttribute('open');
      if (discard) draft = null;
      saving = false;
    }

    function completedAt() {
      const [year, month, day] = context.getSelectedDateKey().split('-').map(Number);
      const fallback = context.getSelectedDateKey() === context.localDateKey(new Date())
        ? [new Date().getHours(), new Date().getMinutes()]
        : [12, 0];
      const parts = (draft.completionTime || '').split(':').map(Number);
      const hour = Number.isInteger(parts[0]) ? parts[0] : fallback[0];
      const minute = Number.isInteger(parts[1]) ? parts[1] : fallback[1];
      const date = new Date(year, month - 1, day, hour, minute, 0, 0);
      return context.localDateKey(date) === context.getSelectedDateKey() ? date : null;
    }

    function save() {
      if (!draft || saving) return false;
      const completedExercises = draft.exercises.map(exercise => ({
        ...exercise,
        sets: exercise.sets.filter(set => set.completed).map(set => ({ ...set, completed: true }))
      })).filter(exercise => exercise.sets.length);
      const working = completedExercises.flatMap(exercise => exercise.sets.filter(set => !set.warmup && context.canCompleteSet(exercise, set)));
      if (!working.length) {
        $('retrospectiveError').textContent = 'Complete at least one working set with weight and reps.';
        return false;
      }
      const completion = completedAt();
      if (!completion) {
        $('retrospectiveError').textContent = 'Choose a valid completion time.';
        return false;
      }
      saving = true;
      $('saveRetrospectiveWorkout').disabled = true;
      const durationSeconds = Math.round((Number(draft.durationMinutes) || 0) * 60);
      const workout = {
        id: context.createId(),
        type: draft.type,
        entryMethod: 'retrospective',
        startedAt: new Date(completion.getTime() - durationSeconds * 1000).toISOString(),
        completedAt: completion.toISOString(),
        durationSeconds,
        note: draft.note.trim(),
        exercises: completedExercises,
        prs: 0
      };
      const previousWorkouts = context.getState().workouts;
      const previousPrs = context.getState().prs;
      const nextPrs = { ...previousPrs };
      if (draft.evaluatePrs) {
        completedExercises.forEach(exercise => exercise.sets.filter(set => !set.warmup).forEach(set => {
          const key = exercise.definitionId || context.slug(exercise.name);
          const score = context.estimate1RM(Number(set.weight), Number(set.reps));
          const current = nextPrs[key];
          if (score > (current?.estimated1RM || 0)) {
            nextPrs[key] = { exercise: exercise.name, estimated1RM: score, weight: Number(set.weight), reps: Number(set.reps), date: workout.completedAt };
            workout.prs += 1;
          }
        }));
      }
      context.getState().prs = nextPrs;
      context.getState().workouts = [workout, ...previousWorkouts];
      try {
        context.saveState();
      } catch (error) {
        context.getState().prs = previousPrs;
        context.getState().workouts = previousWorkouts;
        saving = false;
        $('saveRetrospectiveWorkout').disabled = false;
        $('retrospectiveError').textContent = 'The workout could not be saved. Your draft is still open.';
        console.warn('Could not save retrospective workout', error);
        return false;
      }
      const savedKey = context.localDateKey(new Date(workout.completedAt));
      draft = null;
      close({ discard: false });
      context.afterSave(savedKey, workout.id);
      return true;
    }

    function initialize() {
      const dialog = $('retrospectiveDialog');
      if (!dialog || dialog.dataset.initialized === '1') return;
      dialog.dataset.initialized = '1';
      $('retrospectiveWorkoutType').addEventListener('change', event => { draft.type = event.target.value; render(); });
      $('retrospectiveLoadRoutine').addEventListener('click', () => loadRoutine());
      $('retrospectiveBlankWorkout').addEventListener('click', blankWorkout);
      $('retrospectiveAddExercise').addEventListener('click', () => {
        const definition = context.exercises.find(exercise => exercise.id === $('retrospectiveExerciseSelect').value);
        if (definition) { draft.exercises.push(createExercise(definition, draft.type)); render(); }
      });
      $('retrospectiveCompletionTime').addEventListener('input', event => { if (draft) draft.completionTime = event.target.value; });
      $('retrospectiveDuration').addEventListener('input', event => { if (draft) draft.durationMinutes = event.target.value; });
      $('retrospectiveWorkoutNote').addEventListener('input', event => { if (draft) draft.note = event.target.value; });
      $('retrospectiveEvaluatePrs').addEventListener('change', event => { if (draft) draft.evaluatePrs = event.target.checked; });
      $('retrospectiveExercises').addEventListener('input', event => {
        if (!draft) return;
        const exerciseIndex = Number(event.target.dataset.ei);
        const setIndex = Number(event.target.dataset.si);
        const field = event.target.dataset.retroField;
        if (field && draft.exercises[exerciseIndex]?.sets[setIndex]) draft.exercises[exerciseIndex].sets[setIndex][field] = event.target.type === 'checkbox' ? event.target.checked : safeNumber(event.target.value);
        if (event.target.dataset.retroExerciseNote !== undefined) draft.exercises[Number(event.target.dataset.retroExerciseNote)].note = event.target.value;
      });
      $('retrospectiveExercises').addEventListener('click', event => {
        if (!draft) return;
        const button = event.target.closest('button');
        if (!button) return;
        const exerciseIndex = Number(button.dataset.ei ?? button.dataset.retroAddSet ?? button.dataset.retroRemoveExercise);
        if (button.dataset.retroMove) {
          const target = button.dataset.retroMove === 'up' ? exerciseIndex - 1 : exerciseIndex + 1;
          if (target >= 0 && target < draft.exercises.length) [draft.exercises[exerciseIndex], draft.exercises[target]] = [draft.exercises[target], draft.exercises[exerciseIndex]];
        } else if (button.dataset.retroRemoveExercise !== undefined) draft.exercises.splice(exerciseIndex, 1);
        else if (button.dataset.retroRemoveSet !== undefined) draft.exercises[exerciseIndex].sets.splice(Number(button.dataset.retroRemoveSet), 1);
        else if (button.dataset.retroAddSet !== undefined) {
          const exercise = draft.exercises[exerciseIndex];
          const prior = exercise.sets.filter(set => !set.warmup).at(-1);
          exercise.sets.push({ id: context.createId(), weight: safeNumber(prior?.weight ?? ''), reps: safeNumber(prior?.reps ?? ''), warmup: false, completed: false });
        }
        render();
      });
      $('saveRetrospectiveWorkout').addEventListener('click', save);
      $('cancelRetrospectiveWorkout').addEventListener('click', () => close());
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    }

    return Object.freeze({ initialize, open, cancel: () => close(), getDraft: () => draft, save });
  }

  window.bigGainsRetrospective = Object.freeze({ create });
})();
