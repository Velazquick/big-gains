(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const safeNumber = value => value === '' ? '' : Math.max(0, Number(value) || 0);
  const clone = value => JSON.parse(JSON.stringify(value));

  function create(context) {
    let draft = null;
    let saving = false;
    let compatibilityAddId = null;
    let pendingSetRemoval = null;

    function selectedDateKey() {
      return draft?.dateKey || context.getSelectedDateKey();
    }

    function selectedDate() {
      const [year, month, day] = selectedDateKey().split('-').map(Number);
      return new Date(year, month - 1, day, 12, 0, 0, 0);
    }

    function plannedType() {
      const planned = context.profile.weekPlan[selectedDate().getDay()];
      return planned && planned !== 'Rest' && context.routineEngine.hasRoutine(planned) ? planned : 'Other';
    }

    function availableTypes() {
      const planned = Object.values(context.profile.weekPlan || {}).filter(type => type !== 'Rest' && context.routineEngine.hasRoutine(type));
      if (context.profile.libraryRoutineTypes) return context.profile.libraryRoutineTypes.filter(type => context.routineEngine.hasRoutine(type));
      const standard = ['Push', 'Pull', 'Legs', 'Core', 'FullBody', 'Cardio', 'Other'].filter(type => context.routineEngine.hasRoutine(type));
      return [...new Set([...planned, ...standard])];
    }

    function definitionFor(exercise) {
      return context.exercises.find(item => item.id === exercise.definitionId || item.name === exercise.name);
    }

    function createExercise(definition, workoutType = draft?.type) {
      const inputFields = context.inputFieldsFor?.(definition) || [{ name: 'weight' }, { name: 'reps' }];
      const uses = name => inputFields.some(field => field.name === name);
      const measurement = context.measurementFor?.(definition);
      const supportsWarmup = ['load_reps', 'assistance_reps'].includes(measurement?.trackingModel || 'load_reps');
      const blankSet = (completed = false) => ({
        id: context.createId(), weight: uses('weight') ? '' : 0, reps: uses('reps') ? '' : 0,
        ...(uses('distance') ? { distance: '' } : {}), ...(uses('duration') ? { duration: '' } : {}),
        warmup: false, completed
      });
      if (draft?.mode === 'edit') {
        return {
          id: context.createId(),
          definitionId: definition.id,
          name: definition.name,
          muscle: definition.muscle,
          equipment: definition.equipment,
          note: '',
          sets: [blankSet(true)]
        };
      }
      const prior = context.lastPerformance(definition.id)?.workingSets || [];
      const working = Number(prior[0]?.weight) || 0;
      const prescription = context.routineEngine.getPrescription(workoutType, definition.id);
      const workingSets = Number(prescription?.workingSets) || 3;
      const targetReps = typeof prescription?.targetReps === 'string' ? prescription.targetReps : '';
      const previousValue = (set, field, fallback) => set?.[field] === '' || set?.[field] == null ? fallback : Number(set[field]);
      const workingSet = (set, warmup = false) => ({
        id: context.createId(),
        weight: uses('weight') ? previousValue(set, 'weight', warmup ? (working ? Math.round(working * .6 / 5) * 5 : 0) : working || 0) : 0,
        reps: uses('reps') ? previousValue(set, 'reps', warmup ? 10 : 0) : 0,
        ...(uses('distance') ? { distance: previousValue(set, 'distance', '') } : {}),
        ...(uses('duration') ? { duration: previousValue(set, 'duration', '') } : {}),
        warmup, completed: false
      });
      return {
        id: context.createId(),
        definitionId: definition.id,
        name: definition.name,
        muscle: definition.muscle,
        equipment: definition.equipment,
        note: '',
        ...(targetReps ? { targetReps, targetWorkingSets: workingSets } : {}),
        sets: [
          ...(supportsWarmup ? [workingSet(null, true)] : []),
          ...Array.from({ length: workingSets }, (_, index) => workingSet(prior[index], false))
        ]
      };
    }

    function loadRoutine(type = draft.type) {
      draft.type = type;
      draft.exercises = context.routineEngine.getRoutine(type)
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
      const routineIds = new Set(context.routineEngine.getRoutine(draft.type));
      const used = new Set(draft.exercises.map(exercise => exercise.definitionId));
      return context.exercises
        .filter(exercise => !used.has(exercise.id))
        .filter(exercise => context.profile.capabilities.allExercises || exercise.day === draft.type || draft.type === 'Other' || routineIds.has(exercise.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    function exerciseDefinitionOptions(exercise, exerciseIndex) {
      const current = definitionFor(exercise);
      const used = new Set(draft.exercises
        .filter((_, index) => index !== exerciseIndex)
        .map(item => definitionFor(item)?.id)
        .filter(Boolean));
      const routineIds = new Set(context.routineEngine.getRoutine(draft.type));
      return context.exercises
        .filter(definition => !used.has(definition.id))
        .filter(definition => context.profile.capabilities.allExercises
          || definition.id === current?.id
          || definition.day === draft.type
          || draft.type === 'Other'
          || routineIds.has(definition.id))
        .sort((left, right) => left.name.localeCompare(right.name));
    }

    function applyDefinition(exercise, definition) {
      if (!exercise || !definition) return false;
      exercise.definitionId = definition.id;
      exercise.name = definition.name;
      exercise.muscle = definition.muscle;
      exercise.equipment = definition.equipment;
      delete exercise.targetReps;
      delete exercise.targetWorkingSets;
      return true;
    }

    function openExercisePicker(exerciseIndex = null) {
      if (!context.picker || !draft) return false;
      const current = exerciseIndex === null ? null : definitionFor(draft.exercises[exerciseIndex]);
      const allowed = exerciseIndex === null ? exerciseOptions() : exerciseDefinitionOptions(draft.exercises[exerciseIndex], exerciseIndex);
      const allowedIds = new Set(allowed.map(exercise => exercise.canonicalId));
      const suggested = allowed.filter(exercise => exercise.day === draft.type).slice(0, 10).map(exercise => exercise.canonicalId);
      return context.picker.open({
        title: exerciseIndex === null ? 'Add exercise to completed workout' : 'Replace completed-workout exercise',
        prompt: 'This keeps the existing completed-history edit boundary and changes nothing until the workout is saved.',
        currentExerciseId: current?.canonicalId,
        eligibilityPredicate: exercise => allowedIds.has(exercise.canonicalId),
        suggestionIds: suggested,
        suggestionLabel: `Suggested for ${context.workoutLabel(draft.type)}`,
        returnFocus: () => exerciseIndex === null
          ? $('retrospectiveAddExercise')
          : document.querySelector(`[data-retro-choose="${exerciseIndex}"]`),
        onSelect: canonicalId => {
          const definition = context.exercises.find(exercise => exercise.canonicalId === canonicalId);
          if (!definition) return;
          if (exerciseIndex === null) draft.exercises.push(createExercise(definition, draft.type));
          else applyDefinition(draft.exercises[exerciseIndex], definition);
          render();
        }
      });
    }

    function setLabel(exercise, set) {
      if (set.warmup) return 'Warm-up';
      return `Working set ${exercise.sets.filter(item => !item.warmup).indexOf(set) + 1}`;
    }

    function setHasEnteredData(set) {
      return set?.completed === true || ['weight', 'reps', 'distance', 'duration', 'durationSeconds']
        .some(field => set?.[field] !== '' && set?.[field] != null && Number(set[field]) !== 0);
    }

    function loadModeFor(exercise) {
      return context.loadModeFor?.(exercise) || (exercise?.equipment === 'Bodyweight' ? 'bodyweight' : 'external');
    }

    function renderExercise(exercise, exerciseIndex) {
      const loadMode = loadModeFor(exercise);
      const bodyweight = loadMode === 'bodyweight';
      const inputFields = context.inputFieldsFor?.(exercise) || [
        { name: 'weight', label: bodyweight ? 'Added weight' : 'Weight', unit: 'lb', step: 5 },
        { name: 'reps', label: 'Reps', unit: '', step: 1 }
      ];
      const fieldInput = (field, set, setIndex) => `<label><span>${context.escapeHtml(field.label)}</span><span class="retrospective-input-value"><input type="number" min="0" step="${field.step}" inputmode="decimal" data-retro-field="${field.name}" data-ei="${exerciseIndex}" data-si="${setIndex}" value="${set[field.name] ?? ''}" aria-label="${context.escapeHtml(field.label)}">${field.unit ? `<small>${context.escapeHtml(field.unit)}</small>` : ''}</span></label>`;
      const sets = exercise.sets.map((set, setIndex) => {
        const removalKey = `${exercise.id}:${set.id || setIndex}`;
        const confirming = pendingSetRemoval === removalKey;
        return `<div class="retrospective-set ${set.completed ? 'is-complete' : ''}">
        <label class="retrospective-set-kind"><span>Set type</span><select data-retro-field="setType" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Set type"><option value="warmup" ${set.warmup ? 'selected' : ''}>Warm-up</option><option value="working" ${set.warmup ? '' : 'selected'}>Working set</option></select></label>
        ${inputFields.map(field => fieldInput(field, set, setIndex)).join('')}
        <label class="retrospective-set-complete"><input type="checkbox" data-retro-field="completed" data-ei="${exerciseIndex}" data-si="${setIndex}" ${set.completed ? 'checked' : ''}><span>Performed</span></label>
        <button type="button" class="ghost compact ${confirming ? 'danger is-confirming' : ''}" data-retro-remove-set="${setIndex}" data-ei="${exerciseIndex}" aria-label="${confirming ? 'Confirm: Remove this set from this workout?' : `Remove ${context.escapeHtml(setLabel(exercise, set))}`}">${confirming ? 'Sure?' : 'Remove'}</button>
      </div>`;
      }).join('');
      const currentDefinition = definitionFor(exercise);
      const definitionEditor = draft.mode === 'edit' ? `<label class="retrospective-exercise-choice"><span>Exercise</span><button type="button" class="exercise-picker-trigger" data-retro-choose="${exerciseIndex}"><span>${context.escapeHtml(currentDefinition?.name || exercise.name)} — ${context.escapeHtml(currentDefinition?.equipment || exercise.equipment)}</span><small>Replace</small></button><select class="exercise-picker-compat" data-retro-exercise-definition="${exerciseIndex}" aria-hidden="true" tabindex="-1">${exerciseDefinitionOptions(exercise, exerciseIndex).map(definition => `<option value="${definition.id}" ${definition.id === currentDefinition?.id ? 'selected' : ''}>${context.escapeHtml(definition.name)} — ${context.escapeHtml(definition.equipment)}</option>`).join('')}</select></label>` : '';
      return `<article class="active-exercise retrospective-exercise" data-retro-exercise="${exerciseIndex}">
        <div class="exercise-head"><div><span class="exercise-muscle">${context.escapeHtml(exercise.muscle)}</span><h3>${context.escapeHtml(exercise.name)}</h3><p>${context.escapeHtml(exercise.equipment)} · ${context.escapeHtml(inputFields.map(field => field.label).join(' + '))}${bodyweight ? ' · Log only added load' : ''}${exercise.targetReps ? ` · Target ${context.escapeHtml(exercise.targetReps)}` : ''}</p></div>
        <div class="exercise-head-actions"><div class="exercise-order"><button type="button" data-retro-move="up" data-ei="${exerciseIndex}" ${exerciseIndex === 0 ? 'disabled' : ''} aria-label="Move ${context.escapeHtml(exercise.name)} up">↑</button><button type="button" data-retro-move="down" data-ei="${exerciseIndex}" ${exerciseIndex === draft.exercises.length - 1 ? 'disabled' : ''} aria-label="Move ${context.escapeHtml(exercise.name)} down">↓</button></div><button type="button" class="remove-exercise" data-retro-remove-exercise="${exerciseIndex}" aria-label="Remove ${context.escapeHtml(exercise.name)}">✕</button></div></div>
        ${definitionEditor}
        <div class="retrospective-set-list">${sets}</div>
        <label class="retrospective-note"><span>Exercise note</span><textarea rows="2" data-retro-exercise-note="${exerciseIndex}" placeholder="Form, setup, or context">${context.escapeHtml(exercise.note || '')}</textarea></label>
        <button type="button" class="add-set" data-retro-add-set="${exerciseIndex}">+ Add set</button>
      </article>`;
    }

    function render() {
      if (!draft) return;
      $('retrospectiveDate').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(selectedDate());
      $('retrospectiveLabel').textContent = draft.mode === 'edit' ? 'Completed workout' : 'Log completed workout';
      $('retrospectiveTitle').textContent = draft.mode === 'edit' ? 'Edit workout' : 'Add workout';
      $('retrospectiveSourceActions').hidden = draft.mode === 'edit';
      $('retrospectiveEvaluatePrsLabel').hidden = draft.mode === 'edit';
      $('saveRetrospectiveWorkout').textContent = draft.mode === 'edit' ? 'Save changes' : 'Save workout';
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
        mode: 'create',
        token: context.createId(),
        dateKey: context.getSelectedDateKey(),
        type,
        exercises: [],
        completionTime: '',
        durationMinutes: '',
        note: '',
        evaluatePrs: true
      };
      if (type !== 'Other') {
        draft.exercises = context.routineEngine.getRoutine(type).map(id => context.exercises.find(exercise => exercise.id === id)).filter(Boolean).map(definition => createExercise(definition, type));
      }
      saving = false;
      pendingSetRemoval = null;
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

    function openWorkout(workoutId) {
      const workout = context.getState().workouts.find(item => item.id === workoutId);
      if (!workout) return false;
      const completed = new Date(workout.completedAt);
      const completionTime = `${String(completed.getHours()).padStart(2, '0')}:${String(completed.getMinutes()).padStart(2, '0')}`;
      const durationMinutes = String(Number(workout.durationSeconds || 0) / 60);
      draft = {
        mode: 'edit',
        token: context.createId(),
        workoutId: workout.id,
        dateKey: context.localDateKey(completed),
        type: workout.type,
        exercises: clone(workout.exercises || []),
        completionTime,
        originalCompletionTime: completionTime,
        durationMinutes,
        originalDurationMinutes: durationMinutes,
        note: workout.note || '',
        evaluatePrs: true,
        originalWorkout: clone(workout)
      };
      saving = false;
      pendingSetRemoval = null;
      $('saveRetrospectiveWorkout').disabled = false;
      $('retrospectiveCompletionTime').value = completionTime;
      $('retrospectiveDuration').value = durationMinutes;
      $('retrospectiveWorkoutNote').value = draft.note;
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
      pendingSetRemoval = null;
    }

    function completedAt() {
      if (draft.mode === 'edit' && draft.completionTime === draft.originalCompletionTime) {
        return new Date(draft.originalWorkout.completedAt);
      }
      const [year, month, day] = selectedDateKey().split('-').map(Number);
      const fallback = selectedDateKey() === context.localDateKey(new Date())
        ? [new Date().getHours(), new Date().getMinutes()]
        : [12, 0];
      const parts = (draft.completionTime || '').split(':').map(Number);
      const hour = Number.isInteger(parts[0]) ? parts[0] : fallback[0];
      const minute = Number.isInteger(parts[1]) ? parts[1] : fallback[1];
      const date = new Date(year, month - 1, day, hour, minute, 0, 0);
      return context.localDateKey(date) === selectedDateKey() ? date : null;
    }

    function save() {
      if (!draft || saving) return false;
      const completedExercises = draft.exercises.map(exercise => {
        const measurement = context.measurementFor?.(exercise);
        const usesLoad = ['load_reps', 'assistance_reps', 'load_duration', 'load_distance'].includes(measurement?.trackingModel || 'load_reps');
        return {
          ...exercise,
          sets: exercise.sets.filter(set => set.completed).map(set => ({
            ...set,
            ...(!usesLoad && (set.weight === '' || set.weight == null) ? { weight: 0 } : {}),
            ...(['bodyweight_plus_external', 'assistance'].includes(measurement?.loadSemantics?.resistanceSemantics) && (set.weight === '' || set.weight == null) ? { weight: 0 } : {}),
            completed: true
          }))
        };
      }).filter(exercise => exercise.sets.length);
      const performed = completedExercises.flatMap(exercise => exercise.sets.map(set => ({ exercise, set })));
      const working = completedExercises.flatMap(exercise => exercise.sets.filter(set => !set.warmup).map(set => ({ exercise, set })));
      if (!working.length) {
        $('retrospectiveError').textContent = 'Complete at least one working set.';
        return false;
      }
      if (performed.some(({ exercise, set }) => !context.canCompleteSet(exercise, set))) {
        $('retrospectiveError').textContent = 'Each performed set needs its required values; weighted work needs positive external load, and distance/duration work needs a positive result.';
        return false;
      }
      const completion = completedAt();
      if (!completion) {
        $('retrospectiveError').textContent = 'Choose a valid completion time.';
        return false;
      }
      saving = true;
      $('saveRetrospectiveWorkout').disabled = true;
      const durationSeconds = draft.mode === 'edit' && draft.durationMinutes === draft.originalDurationMinutes
        ? Number(draft.originalWorkout.durationSeconds || 0)
        : Math.round((Number(draft.durationMinutes) || 0) * 60);
      const completedAtValue = completion.toISOString();
      const preserveStartedAt = draft.mode === 'edit'
        && completedAtValue === new Date(draft.originalWorkout.completedAt).toISOString()
        && durationSeconds === Number(draft.originalWorkout.durationSeconds || 0);
      const workout = {
        ...(draft.mode === 'edit' ? draft.originalWorkout : {}),
        id: draft.mode === 'edit' ? draft.workoutId : context.createId(),
        type: draft.type,
        ...(draft.mode === 'create' ? { entryMethod: 'retrospective' } : {}),
        startedAt: preserveStartedAt
          ? draft.originalWorkout.startedAt
          : new Date(completion.getTime() - durationSeconds * 1000).toISOString(),
        completedAt: completedAtValue,
        durationSeconds,
        note: draft.note.trim(),
        exercises: completedExercises,
        prs: 0
      };
      const previousWorkouts = context.getState().workouts;
      const previousPrs = context.getState().prs;
      let nextWorkouts;
      let nextPrs;
      if (draft.mode === 'edit') {
        nextWorkouts = previousWorkouts.map(existing => existing.id === workout.id ? workout : existing);
        const derived = context.derivePersonalRecords(nextWorkouts);
        workout.prs = Number(derived.workoutRecordCounts?.[workout.id] ?? derived.workoutPrCounts[workout.id] ?? 0);
        nextPrs = { ...derived.records };
      } else {
        nextPrs = { ...previousPrs };
      }
      if (draft.mode === 'create' && draft.evaluatePrs) {
        nextWorkouts = [workout, ...previousWorkouts];
        const derived = context.derivePersonalRecords(nextWorkouts);
        workout.prs = Number(derived.workoutRecordCounts?.[workout.id] ?? derived.workoutPrCounts[workout.id] ?? 0);
        nextPrs = { ...derived.records };
      }
      if (draft.mode === 'create' && !draft.evaluatePrs) nextWorkouts = [workout, ...previousWorkouts];
      context.getState().prs = nextPrs;
      context.getState().workouts = nextWorkouts;
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
      const mode = draft.mode;
      draft = null;
      close({ discard: false });
      if (mode === 'edit') context.afterUpdate(savedKey, workout.id);
      else context.afterSave(savedKey, workout.id);
      return true;
    }

    function initialize() {
      const dialog = $('retrospectiveDialog');
      if (!dialog || dialog.dataset.initialized === '1') return;
      dialog.dataset.initialized = '1';
      $('retrospectiveWorkoutType').addEventListener('change', event => { draft.type = event.target.value; render(); });
      $('retrospectiveLoadRoutine').addEventListener('click', () => loadRoutine());
      $('retrospectiveBlankWorkout').addEventListener('click', blankWorkout);
      $('retrospectiveExerciseSelect').addEventListener('change', event => { compatibilityAddId = event.target.value; });
      $('retrospectiveAddExercise').addEventListener('click', () => {
        if (!compatibilityAddId) return openExercisePicker();
        const definition = context.exercises.find(exercise => exercise.id === compatibilityAddId);
        compatibilityAddId = null;
        if (definition) { draft.exercises.push(createExercise(definition, draft.type)); render(); }
      });
      $('retrospectiveCompletionTime').addEventListener('input', event => { if (draft) draft.completionTime = event.target.value; });
      $('retrospectiveDuration').addEventListener('input', event => { if (draft) draft.durationMinutes = event.target.value; });
      $('retrospectiveWorkoutNote').addEventListener('input', event => { if (draft) draft.note = event.target.value; });
      $('retrospectiveEvaluatePrs').addEventListener('change', event => { if (draft) draft.evaluatePrs = event.target.checked; });
      $('retrospectiveExercises').addEventListener('change', event => {
        if (!draft || event.target.dataset.retroExerciseDefinition === undefined) return;
        const exercise = draft.exercises[Number(event.target.dataset.retroExerciseDefinition)];
        const definition = context.exercises.find(item => item.id === event.target.value);
        if (!exercise || !definition) return;
        applyDefinition(exercise, definition);
        render();
      });
      $('retrospectiveExercises').addEventListener('input', event => {
        if (!draft) return;
        const exerciseIndex = Number(event.target.dataset.ei);
        const setIndex = Number(event.target.dataset.si);
        const field = event.target.dataset.retroField;
        const set = draft.exercises[exerciseIndex]?.sets[setIndex];
        if (field === 'setType' && set) {
          set.warmup = event.target.value === 'warmup';
          render();
        } else if (field && set) set[field] = event.target.type === 'checkbox' ? event.target.checked : safeNumber(event.target.value);
        if (event.target.dataset.retroExerciseNote !== undefined) draft.exercises[Number(event.target.dataset.retroExerciseNote)].note = event.target.value;
      });
      $('retrospectiveExercises').addEventListener('click', event => {
        if (!draft) return;
        const button = event.target.closest('button');
        if (!button) return;
        if (button.dataset.retroChoose !== undefined) return openExercisePicker(Number(button.dataset.retroChoose));
        const exerciseIndex = Number(button.dataset.ei ?? button.dataset.retroAddSet ?? button.dataset.retroRemoveExercise);
        if (button.dataset.retroMove) {
          const target = button.dataset.retroMove === 'up' ? exerciseIndex - 1 : exerciseIndex + 1;
          if (target >= 0 && target < draft.exercises.length) [draft.exercises[exerciseIndex], draft.exercises[target]] = [draft.exercises[target], draft.exercises[exerciseIndex]];
        } else if (button.dataset.retroRemoveExercise !== undefined) draft.exercises.splice(exerciseIndex, 1);
        else if (button.dataset.retroRemoveSet !== undefined) {
          const setIndex = Number(button.dataset.retroRemoveSet);
          const exercise = draft.exercises[exerciseIndex];
          const set = exercise?.sets?.[setIndex];
          if (!set) return;
          const removalKey = `${exercise.id}:${set.id || setIndex}`;
          if (setHasEnteredData(set) && pendingSetRemoval !== removalKey) {
            pendingSetRemoval = removalKey;
            render();
            return;
          }
          exercise.sets.splice(setIndex, 1);
          pendingSetRemoval = null;
        }
        else if (button.dataset.retroAddSet !== undefined) {
          const exercise = draft.exercises[exerciseIndex];
          const prior = exercise.sets.filter(set => !set.warmup).at(-1);
          const fields = context.inputFieldsFor?.(exercise) || [{ name: 'weight' }, { name: 'reps' }];
          exercise.sets.push({ id: context.createId(), weight: fields.some(field => field.name === 'weight') ? safeNumber(prior?.weight ?? '') : 0, reps: fields.some(field => field.name === 'reps') ? safeNumber(prior?.reps ?? '') : 0, ...Object.fromEntries(fields.filter(field => ['distance', 'duration'].includes(field.name)).map(field => [field.name, safeNumber(prior?.[field.name] ?? '')])), warmup: false, completed: draft.mode === 'edit' });
        }
        render();
      });
      $('saveRetrospectiveWorkout').addEventListener('click', save);
      $('cancelRetrospectiveWorkout').addEventListener('click', () => close());
      dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
      dialog.addEventListener('click', event => { if (event.target === dialog) close(); });
    }

    return Object.freeze({ initialize, open, openWorkout, cancel: () => close(), getDraft: () => draft, save });
  }

  window.bigGainsRetrospective = Object.freeze({ create });
})();
