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
        { id: createId(), weight: warmupWeight, reps: 10, warmup: true, completed: false },
        ...Array.from({ length: workingSets }, (_, index) => ({
          id: createId(),
          weight: prior[index] ? Number(prior[index].weight) || working : working,
          reps: prior[index] ? Number(prior[index].reps) || '' : '',
          warmup: false,
          completed: false
        }))
      ]
    };
  }

  function create({
    getState,
    getActiveWorkout,
    setActiveWorkout,
    getSelectedDay,
    setSelectedDay,
    routineEngine,
    exerciseCatalog,
    previousPerformance,
    estimate1RM,
    createId,
    persist,
    now = () => Date.now(),
    deactivateTimer = () => {},
    clearWorkoutTicker = () => {},
    setPetState = () => {},
    onRuntimeCleared = () => {},
    renderActiveSession = () => {},
    renderLoadedSession = () => {},
    renderHero = () => {},
    enterWorkoutMode = () => {},
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

    function makeExercise(definition, prescription = null) {
      return buildExercise({
        definition,
        prescription,
        previousPerformance: previousPerformance(definition.id),
        createId
      });
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
          current.exercises.push(makeExercise(definition, routineEngine.getPrescription(day, id)));
        }
      });
      return current.exercises.length - before;
    }

    function persistActiveMutation() {
      persist();
      renderHero();
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
      current.exercises.push(makeExercise(definition));
      persistActiveMutation();
      if (created) renderActiveSession(scroll);
      else renderLoadedSession(scroll);
      return current;
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
        const score = estimate1RM(Number(set.weight), Number(set.reps));
        if (score > ((state.prs[exercise.id] && state.prs[exercise.id].estimated1RM) || 0)) {
          state.prs[exercise.id] = {
            exercise: exercise.name,
            estimated1RM: score,
            weight: Number(set.weight),
            reps: Number(set.reps),
            date: completedAt
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

    return Object.freeze({ start, resume, replace, loadRoutine, repairEmpty, addExercise, complete, discard });
  }

  const api = Object.freeze({ buildExercise, create });
  Object.defineProperty(scope, 'BigGainsWorkoutSessionController', { value: api, enumerable: true });
  Object.defineProperty(scope, 'bigGainsWorkoutSessionController', { value: api, enumerable: true });
})(window);
