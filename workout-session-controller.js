((scope) => {
  'use strict';

  function buildExercise({ definition, prescription = null, previousPerformance = null, createId }) {
    if (!definition || typeof definition.id !== 'string' || typeof createId !== 'function') {
      throw new TypeError('WorkoutSessionController exercise construction requires a catalog definition and ID generator.');
    }
    const prior = Array.isArray(previousPerformance?.workingSets) ? previousPerformance.workingSets : [];
    const working = prior[0] ? Number(prior[0].weight) || 0 : 0;
    const warmupWeight = working ? Math.round(working * .6 / 5) * 5 : 0;
    const workingSets = Number(prescription?.workingSets) || 3;
    const targetReps = typeof prescription?.targetReps === 'string' ? prescription.targetReps : '';
    const measurement = definition.measurement || null;
    const trackingModel = measurement?.trackingModel || 'load_reps';
    const usesLoad = ['load_reps', 'assistance_reps', 'load_duration', 'load_distance'].includes(trackingModel);
    const usesReps = ['load_reps', 'reps_only', 'assistance_reps'].includes(trackingModel);
    const usesDistance = ['distance_duration', 'load_distance', 'distance_only'].includes(trackingModel);
    const usesDuration = ['duration', 'distance_duration', 'load_duration'].includes(trackingModel);
    const seed = (priorSet, field, fallback = '') => {
      const value = priorSet?.[field];
      return value === '' || value == null || !Number.isFinite(Number(value)) ? fallback : Number(value);
    };
    const makeSet = (priorSet, warmup = false) => ({
      id: createId(),
      weight: usesLoad ? seed(priorSet, 'weight', warmup ? warmupWeight : working) : 0,
      reps: usesReps ? seed(priorSet, 'reps', warmup ? 10 : '') : 0,
      ...(usesDistance ? { distance: seed(priorSet, 'distance', '') } : {}),
      ...(usesDuration ? { duration: seed(priorSet, 'duration', '') } : {}),
      warmup,
      completed: false
    });
    const supportsWarmup = ['load_reps', 'assistance_reps'].includes(trackingModel);
    return {
      id: definition.id,
      name: definition.name,
      muscle: definition.muscle,
      equipment: definition.equipment,
      collapsed: true,
      ...(prescription ? {
        targetWorkingSets: workingSets,
        ...(targetReps ? { targetReps } : {})
      } : {}),
      sets: [
        ...(supportsWarmup ? [makeSet(null, true)] : []),
        ...Array.from({ length: workingSets }, (_, index) => makeSet(prior[index], false))
      ]
    };
  }

  function defaultLoadMode(exercise) {
    return exercise?.equipment === 'Bodyweight' ? 'bodyweight' : 'external';
  }

  function measurementFor(exercise, contract = null) {
    if (contract && typeof contract === 'object') return contract;
    if (typeof contract === 'string') return {
      trackingModel: 'load_reps',
      loadSemantics: { resistanceSemantics: contract === 'bodyweight' ? 'bodyweight_plus_external' : 'external' },
      ui: { loadMayBeZero: contract === 'bodyweight' }
    };
    return exercise?.measurement || {
      trackingModel: 'load_reps',
      loadSemantics: {
        resistanceSemantics: defaultLoadMode(exercise) === 'bodyweight' ? 'bodyweight_plus_external' : 'external'
      },
      ui: { loadMayBeZero: defaultLoadMode(exercise) === 'bodyweight' }
    };
  }

  // EKF-4.4/9.5: validation follows the canonical tracking model, never a per-set override.
  function isCompletableSet(exercise, set, contract = null) {
    const measurement = measurementFor(exercise, contract);
    const model = measurement?.trackingModel || 'load_reps';
    const reps = Number(set?.reps);
    const weight = Number(set?.weight);
    const distance = Number(set?.distance);
    const duration = Number(set?.duration ?? set?.durationSeconds);
    if (['load_reps', 'reps_only', 'assistance_reps'].includes(model) && (!Number.isFinite(reps) || reps <= 0)) return false;
    if (['load_reps', 'assistance_reps', 'load_duration', 'load_distance'].includes(model)) {
      if (!Number.isFinite(weight)) return false;
      const mayBeZero = measurement?.ui?.loadMayBeZero === true
        || ['bodyweight_plus_external', 'assistance'].includes(measurement?.loadSemantics?.resistanceSemantics);
      if (mayBeZero ? weight < 0 : weight <= 0) return false;
    }
    if (['distance_duration', 'load_distance', 'distance_only'].includes(model) && (!Number.isFinite(distance) || distance <= 0)) return false;
    if (['duration', 'distance_duration', 'load_duration'].includes(model) && (!Number.isFinite(duration) || duration <= 0)) return false;
    return true;
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

  function isCollapsed(exercise) {
    return exercise.collapsed !== false;
  }

  function openOnly(activeWorkout, index) {
    if (!activeWorkout?.exercises?.[index]) return false;
    activeWorkout.exercises.forEach((exercise, exerciseIndex) => {
      exercise.collapsed = exerciseIndex !== index;
    });
    activeWorkout.focusedExerciseId = activeWorkout.exercises[index].id;
    return true;
  }

  function toggleExerciseState(activeWorkout, index) {
    const exercise = activeWorkout?.exercises?.[index];
    if (!exercise) return false;
    if (!incompleteWorking(exercise)) exercise.collapsed = !isCollapsed(exercise);
    else if (isCollapsed(exercise)) openOnly(activeWorkout, index);
    else exercise.collapsed = true;
    return true;
  }

  function moveExerciseState(activeWorkout, from, direction) {
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

  function create({
    getState,
    getActiveWorkout,
    setActiveWorkout,
    getSelectedDay,
    setSelectedDay,
    routineEngine,
    exerciseCatalog,
    resolveLoadMode = defaultLoadMode,
    resolveMeasurement = exercise => exerciseCatalog?.measurementFor?.(exercise) || exercise?.measurement || null,
    metricsForSet = null,
    previousPerformance,
    estimate1RM,
    createId,
    persist,
    prepareExercise = ({ exercise }) => exercise,
    now = () => Date.now(),
    deactivateTimer = () => {},
    clearWorkoutTicker = () => {},
    setPetState = () => {},
    onRuntimeCleared = () => {},
    renderActiveSession = () => {},
    renderLoadedSession = () => {},
    renderActiveMutation = () => {},
    renderLibraryMutation = () => {},
    renderHero = () => {},
    enterWorkoutMode = () => {},
    acknowledgeTimerReady = () => {},
    startRestTimer = () => {},
    scheduleAfterCompletion = callback => callback(),
    onCompletionAdvanced = () => {},
    onCompleted = () => {},
    onDiscarded = () => {}
  }) {
    const requiredFunctions = [
      getState, getActiveWorkout, setActiveWorkout, getSelectedDay, setSelectedDay,
      previousPerformance, estimate1RM, createId, persist
    ];
    if (requiredFunctions.some(port => typeof port !== 'function')
      || !routineEngine || !exerciseCatalog || typeof exerciseCatalog.getById !== 'function') {
      throw new TypeError('WorkoutSessionController requires live state/session ports, routine and catalog APIs, analytics, IDs, and persistence.');
    }

    function makeExercise(definition, prescription = null, context = {}) {
      const exercise = buildExercise({
        definition,
        prescription,
        previousPerformance: previousPerformance(definition.id),
        createId
      });
      return prepareExercise({
        exercise,
        definition,
        prescription,
        evidenceCutoff: getActiveWorkout()?.startedAt,
        ...context
      }) || exercise;
    }

    function begin(day) {
      setSelectedDay(day);
      const next = { id: createId(), type: day, startedAt: new Date(now()).toISOString(), exercises: [] };
      setActiveWorkout(next);
      return next;
    }

    function appendRoutine(day) {
      const current = getActiveWorkout();
      if (!current) return 0;
      const before = current.exercises.length;
      routineEngine.getRoutine(day).forEach(id => {
        const definition = exerciseCatalog.getById(id);
        if (definition && !current.exercises.some(exercise => exercise.id === definition.id)) {
          current.exercises.push(makeExercise(definition, routineEngine.getPrescription(day, id), { source: 'saved_routine', day }));
        }
      });
      return current.exercises.length - before;
    }

    function persistActiveMutation() {
      persist();
      renderHero();
    }

    function focusExercise(index) {
      const current = getActiveWorkout();
      const exercise = current?.exercises?.[index];
      if (!exercise) return false;
      current.focusedExerciseId = exercise.id;
      exercise.collapsed = false;
      return true;
    }

    function clearRuntime(hideActive = true) {
      setActiveWorkout(null);
      getState().restTimerEndsAt = null;
      clearWorkoutTicker();
      deactivateTimer();
      setPetState(null);
      onRuntimeCleared({ hideActive });
    }

    function start(day = getSelectedDay(), { loadRoutine: shouldLoad = true, scroll = true } = {}) {
      if (getActiveWorkout()) return resume(scroll);
      begin(day);
      if (shouldLoad) appendRoutine(day);
      persistActiveMutation();
      renderActiveSession(scroll);
      return getActiveWorkout();
    }

    function resume(scroll = true, { enterMode = true } = {}) {
      const current = getActiveWorkout();
      if (!current) return null;
      renderActiveSession(scroll);
      if (enterMode) enterWorkoutMode();
      return current;
    }

    function replace(day = getSelectedDay(), { loadRoutine: shouldLoad = true, scroll = true } = {}) {
      if (!getActiveWorkout()) return start(day, { loadRoutine: shouldLoad, scroll });
      clearRuntime(false);
      begin(day);
      if (shouldLoad) appendRoutine(day);
      persistActiveMutation();
      renderActiveSession(scroll);
      return getActiveWorkout();
    }

    function loadRoutine(day = getSelectedDay(), { scroll = true } = {}) {
      if (!getActiveWorkout()) return start(day, { loadRoutine: true, scroll });
      appendRoutine(day);
      persistActiveMutation();
      renderLoadedSession(scroll);
      return getActiveWorkout();
    }

    function repairEmpty(session = getActiveWorkout(), { scroll = false } = {}) {
      const current = getActiveWorkout();
      if (session !== current || !session || !Array.isArray(session.exercises)
        || session.exercises.length || !routineEngine.hasRoutine(session.type)) return false;
      const added = appendRoutine(session.type);
      if (!added) return false;
      persistActiveMutation();
      renderLoadedSession(scroll);
      return true;
    }

    function addExercise(id, { scroll = true } = {}) {
      const definition = exerciseCatalog.getById(id);
      if (!definition) return getActiveWorkout();
      const created = !getActiveWorkout();
      if (created) begin(getSelectedDay());
      const current = getActiveWorkout();
      if (current.exercises.some(exercise => exercise.id === id)) return current;
      current.exercises.push(makeExercise(definition, null, { source: 'current_workout', day: current.type }));
      persistActiveMutation();
      if (created) renderActiveSession(scroll);
      else renderLoadedSession(scroll);
      return current;
    }

    function moveExercise(from, direction) {
      if (!moveExerciseState(getActiveWorkout(), from, direction)) return false;
      persistActiveMutation();
      renderActiveMutation();
      return true;
    }

    function toggleExercise(index) {
      if (!toggleExerciseState(getActiveWorkout(), index)) return false;
      persistActiveMutation();
      renderActiveMutation();
      return true;
    }

    function removeExercise(index) {
      const current = getActiveWorkout();
      if (!current?.exercises?.[index]) return false;
      current.exercises.splice(index, 1);
      persistActiveMutation();
      renderActiveMutation();
      renderLibraryMutation();
      return true;
    }

    function addSet(exerciseIndex) {
      const exercise = getActiveWorkout()?.exercises?.[exerciseIndex];
      if (!exercise) return null;
      const working = exercise.sets.filter(set => !set.warmup);
      const recent = working.at(-1);
      const valid = value => value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0;
      focusExercise(exerciseIndex);
      acknowledgeTimerReady();
      const set = {
        id: createId(),
        weight: valid(recent?.weight) ? Number(recent.weight) : '',
        reps: valid(recent?.reps) ? Number(recent.reps) : '',
        ...(Object.hasOwn(recent || {}, 'distance') ? { distance: valid(recent.distance) ? Number(recent.distance) : '' } : {}),
        ...(Object.hasOwn(recent || {}, 'duration') ? { duration: valid(recent.duration) ? Number(recent.duration) : '' } : {}),
        warmup: false,
        completed: false
      };
      exercise.sets.push(set);
      persistActiveMutation();
      renderActiveMutation();
      return set;
    }

    function updateSet(exerciseIndex, setIndex, field, value) {
      const set = getActiveWorkout()?.exercises?.[exerciseIndex]?.sets?.[setIndex];
      if (!set) return false;
      focusExercise(exerciseIndex);
      acknowledgeTimerReady();
      set[field] = value === '' ? '' : Number(value);
      persistActiveMutation();
      return true;
    }

    function adjustSet(exerciseIndex, setIndex, field, adjustment) {
      const set = getActiveWorkout()?.exercises?.[exerciseIndex]?.sets?.[setIndex];
      if (!set) return false;
      focusExercise(exerciseIndex);
      acknowledgeTimerReady();
      set[field] = Math.max(0, (Number(set[field]) || 0) + Number(adjustment));
      persistActiveMutation();
      renderActiveMutation();
      return true;
    }

    function toggleSetCompleted(exerciseIndex, setIndex) {
      const current = getActiveWorkout();
      const exercise = current?.exercises?.[exerciseIndex];
      const set = exercise?.sets?.[setIndex];
      const measurement = resolveMeasurement(exercise);
      if (!isCompletableSet(exercise, set, measurement || resolveLoadMode(exercise))) return false;
      focusExercise(exerciseIndex);
      acknowledgeTimerReady();
      const usesLoad = ['load_reps', 'assistance_reps', 'load_duration', 'load_distance'].includes(measurement?.trackingModel || 'load_reps');
      if (!set.completed && !usesLoad && (set.weight === '' || set.weight == null)) set.weight = 0;
      if (!set.completed && ['bodyweight_plus_external', 'assistance'].includes(measurement?.loadSemantics?.resistanceSemantics) && (set.weight === '' || set.weight == null)) set.weight = 0;
      set.completed = !set.completed;
      persistActiveMutation();
      renderActiveMutation();
      if (set.completed) {
        startRestTimer(exerciseIndex);
        scheduleAfterCompletion(() => {
          const live = getActiveWorkout();
          if (!live) return;
          const result = advanceAfterCompletion(live, exerciseIndex);
          if (!result.advanced) return;
          persistActiveMutation();
          renderActiveMutation();
          onCompletionAdvanced(result);
        });
      }
      return true;
    }

    function complete() {
      const current = getActiveWorkout();
      if (!current) return false;
      const completed = current.exercises
        .map(exercise => ({ ...exercise, sets: exercise.sets.filter(set => set.completed) }))
        .filter(exercise => exercise.sets.length);
      if (!completed.length) return false;
      const completedAt = new Date(now()).toISOString();
      const durationSeconds = Math.floor((now() - new Date(current.startedAt)) / 1000);
      const workout = { ...current, completedAt, durationSeconds, exercises: completed };
      const state = getState();
      let newPRs = 0;
      completed.forEach(exercise => exercise.sets.filter(set => !set.warmup).forEach(set => {
        const interpreted = typeof metricsForSet === 'function' ? metricsForSet(exercise, set) : null;
        const score = interpreted ? interpreted.estimated1RM : estimate1RM(Number(set.weight), Number(set.reps));
        if (score === null) return;
        if (score > ((state.prs[exercise.id] && state.prs[exercise.id].estimated1RM) || 0)) {
          state.prs[exercise.id] = {
            exercise: exercise.name,
            estimated1RM: score,
            weight: Number(set.weight),
            reps: Number(set.reps),
            date: completedAt,
            ...(interpreted?.formulaId ? { formulaId: interpreted.formulaId, formulaVersion: interpreted.formulaVersion, e1rmLoadBasis: interpreted.e1rm?.loadBasis } : {})
          };
          newPRs += 1;
        }
      }));
      workout.prs = newPRs;
      state.workouts.unshift(workout);
      clearRuntime();
      persist();
      onCompleted({ workout, newPRs });
      return true;
    }

    function discard() {
      if (!getActiveWorkout()) return false;
      clearRuntime();
      persist();
      onDiscarded();
      return true;
    }

    return Object.freeze({
      start,
      resume,
      replace,
      loadRoutine,
      repairEmpty,
      addExercise,
      focusExercise,
      moveExercise,
      toggleExercise,
      removeExercise,
      addSet,
      updateSet,
      adjustSet,
      toggleSetCompleted,
      complete,
      discard
    });
  }

  const api = Object.freeze({
    buildExercise,
    isCompletableSet,
    moveExercise: moveExerciseState,
    toggleExercise: toggleExerciseState,
    advanceAfterCompletion,
    create
  });
  Object.defineProperty(scope, 'BigGainsWorkoutSessionController', { value: api, enumerable: true });
  Object.defineProperty(scope, 'bigGainsWorkoutSessionController', { value: api, enumerable: true });
})(window);
