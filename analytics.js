((scope) => {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const list = value => Array.isArray(value) ? value : [];
  const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const timestamp = value => {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  };
  const profileBodyweight = weights => {
    const entry = list(weights).find(item => {
      const weight = Number(item?.weight);
      return Number.isFinite(weight) && weight > 0;
    });
    return entry ? Number(entry.weight) : null;
  };
  const bodyweightFrom = options => {
    const weight = Number(options?.bodyweight);
    return Number.isFinite(weight) && weight > 0 ? weight : null;
  };
  const loadModeFor = (exercise, options) => {
    const resolved = typeof options?.loadModeFor === 'function' ? options.loadModeFor(exercise) : null;
    if (resolved === 'bodyweight' || resolved === 'external') return resolved;
    return exercise?.equipment === 'Bodyweight' ? 'bodyweight' : 'external';
  };

  function estimate1RM(weight, reps) {
    const safeWeight = number(weight);
    const safeReps = number(reps);
    return safeReps > 0 ? Math.round(safeWeight * (1 + safeReps / 30)) : 0;
  }

  function isWorkingSet(set) {
    return Boolean(set) && typeof set === 'object' && set.completed === true && set.warmup !== true;
  }

  function workingSets(source) {
    const sets = Array.isArray(source) ? source : source?.sets;
    return list(sets).filter(isWorkingSet);
  }

  function metricsForSet(set, options = {}) {
    if (!set) return null;
    const weight = number(set.weight);
    const reps = number(set.reps);
    const loadMode = options.loadMode || set.loadMode || 'external';
    const bodyweight = loadMode === 'bodyweight' ? bodyweightFrom(options) : null;
    const effectiveLoad = loadMode === 'bodyweight' ? (bodyweight === null ? null : bodyweight + weight) : weight;
    return {
      ...set,
      weight,
      reps,
      loadMode,
      effectiveLoad,
      volume: effectiveLoad === null ? null : effectiveLoad * reps,
      estimated1RM: effectiveLoad === null ? null : estimate1RM(effectiveLoad, reps)
    };
  }

  function betterSet(candidate, winner) {
    if (!winner) return true;
    const candidateEstimate = Number(candidate.estimated1RM);
    const winnerEstimate = Number(winner.estimated1RM);
    const candidateHasEstimate = candidate.estimated1RM !== null && Number.isFinite(candidateEstimate);
    const winnerHasEstimate = winner.estimated1RM !== null && Number.isFinite(winnerEstimate);
    if (candidateHasEstimate !== winnerHasEstimate) return candidateHasEstimate;
    if (candidateHasEstimate && candidateEstimate !== winnerEstimate) return candidateEstimate > winnerEstimate;
    const candidateLoad = candidate.effectiveLoad === null ? candidate.weight : candidate.effectiveLoad;
    const winnerLoad = winner.effectiveLoad === null ? winner.weight : winner.effectiveLoad;
    if (candidateLoad !== winnerLoad) return candidateLoad > winnerLoad;
    return candidate.reps > winner.reps;
  }

  function bestWorkingSet(source, options = {}) {
    const exercise = Array.isArray(source) ? options.exercise : source;
    const metricsOptions = { ...options, loadMode: loadModeFor(exercise, options) };
    return workingSets(source).map(set => metricsForSet(set, metricsOptions)).reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null);
  }

  function setSummary(source, options = {}) {
    const exercise = Array.isArray(source) ? options.exercise : source;
    const loadMode = loadModeFor(exercise, options);
    const sets = workingSets(source).map(set => metricsForSet(set, { ...options, loadMode }));
    const volumeKnown = sets.every(set => set.volume !== null);
    return {
      workingSets: sets,
      workingSetCount: sets.length,
      workingSetVolume: volumeKnown ? sets.reduce((total, set) => total + set.volume, 0) : null,
      totalReps: sets.reduce((total, set) => total + set.reps, 0),
      bestWorkingSet: sets.reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null),
      loadMode,
      effectiveLoadKnown: volumeKnown
    };
  }

  function durationSeconds(workout) {
    const stored = Number(workout?.durationSeconds);
    if (Number.isFinite(stored) && stored >= 0) return Math.round(stored);
    const started = timestamp(workout?.startedAt);
    const completed = timestamp(workout?.completedAt);
    return started !== null && completed !== null && completed >= started
      ? Math.round((completed - started) / 1000)
      : 0;
  }

  function workoutSummary(workout, options = {}) {
    const exercises = list(workout?.exercises);
    const exerciseSummaries = exercises.map(exercise => setSummary(exercise, options));
    const working = exerciseSummaries.flatMap(summary => summary.workingSets);
    const volumeKnown = exerciseSummaries.every(summary => summary.effectiveLoadKnown);
    const setMetrics = {
      workingSets: working,
      workingSetCount: working.length,
      workingSetVolume: volumeKnown ? exerciseSummaries.reduce((total, summary) => total + summary.workingSetVolume, 0) : null,
      totalReps: working.reduce((total, set) => total + set.reps, 0),
      bestWorkingSet: working.reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null),
      effectiveLoadKnown: volumeKnown
    };
    return {
      ...setMetrics,
      durationSeconds: durationSeconds(workout),
      prCount: Math.round(number(workout?.prs)),
      exerciseCount: exercises.filter(exercise => workingSets(exercise).length > 0).length
    };
  }

  function completedWorkouts(workouts) {
    return list(workouts)
      .filter(workout => timestamp(workout?.completedAt) !== null)
      .slice()
      .sort((left, right) => timestamp(right.completedAt) - timestamp(left.completedAt));
  }

  function canonicalExerciseId(exercise) {
    return typeof exercise?.definitionId === 'string' && exercise.definitionId
      ? exercise.definitionId
      : exercise?.id;
  }

  function performanceDelta(current, previous, options = {}) {
    const currentBest = current?.bestWorkingSet || bestWorkingSet(current, options);
    const previousBest = previous?.bestWorkingSet || bestWorkingSet(previous, options);
    if (!currentBest || !previousBest) return null;
    const weightDelta = number(currentBest.weight) - number(previousBest.weight);
    const repsDelta = number(currentBest.reps) - number(previousBest.reps);
    const estimatesKnown = currentBest.estimated1RM !== null && previousBest.estimated1RM !== null;
    const estimated1RMDelta = estimatesKnown ? number(currentBest.estimated1RM) - number(previousBest.estimated1RM) : null;
    let improvement = null;
    if (weightDelta > 0 && number(currentBest.reps) >= number(previousBest.reps)) {
      improvement = { kind: 'weight', value: weightDelta, label: `+${weightDelta} lb` };
    } else if (weightDelta === 0 && repsDelta > 0) {
      improvement = { kind: 'reps', value: repsDelta, label: `+${repsDelta} rep${repsDelta === 1 ? '' : 's'}` };
    }
    return { currentBest, previousBest, weightDelta, repsDelta, estimated1RMDelta, improvement };
  }

  function exerciseHistory(workouts, exerciseId, options = {}) {
    if (typeof exerciseId !== 'string' || !exerciseId) return [];
    const sessions = completedWorkouts(workouts).flatMap(workout => {
      const exercise = list(workout.exercises).find(item => canonicalExerciseId(item) === exerciseId);
      if (!exercise) return [];
      const summary = setSummary(exercise, options);
      if (!summary.workingSetCount) return [];
      return [{
        workoutId: workout.id,
        date: workout.completedAt,
        exerciseId,
        exerciseName: exercise.name || '',
        muscle: exercise.muscle || '',
        equipment: exercise.equipment || '',
        ...summary
      }];
    });
    return sessions.map((session, index) => ({
      ...session,
      delta: performanceDelta(session, sessions[index + 1], options)
    }));
  }

  function previousPerformance(workouts, exerciseId, options = {}) {
    return exerciseHistory(workouts, exerciseId, options)[0] || null;
  }

  function exerciseTrend(workouts, exerciseId, options = {}) {
    const sessions = exerciseHistory(workouts, exerciseId, options);
    const best = sessions.flatMap(session => session.workingSets)
      .reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null);
    return {
      exerciseId,
      sessions,
      latest: sessions[0] || null,
      previous: sessions[1] || null,
      bestWorkingSet: best,
      points: sessions.slice().reverse().map(session => ({
        workoutId: session.workoutId,
        date: session.date,
        weight: session.bestWorkingSet.weight,
        reps: session.bestWorkingSet.reps,
        estimated1RM: session.bestWorkingSet.estimated1RM,
        workingSetVolume: session.workingSetVolume,
        totalReps: session.totalReps
      }))
    };
  }

  function muscleNames(value) {
    return String(value || '')
      .split(/\s*(?:\/|,|&)\s*/)
      .map(name => name.trim())
      .filter(Boolean);
  }

  function addTotals(target, key, summary) {
    if (!target[key]) target[key] = { workingSets: 0, workingSetVolume: 0, totalReps: 0 };
    target[key].workingSets += summary.workingSetCount;
    target[key].workingSetVolume = target[key].workingSetVolume === null || summary.workingSetVolume === null
      ? null
      : target[key].workingSetVolume + summary.workingSetVolume;
    target[key].totalReps += summary.totalReps;
  }

  function muscleTotals(workouts, options = {}) {
    const totals = {};
    completedWorkouts(workouts).forEach(workout => list(workout.exercises).forEach(exercise => {
      const summary = setSummary(exercise, options);
      if (!summary.workingSetCount) return;
      muscleNames(exercise.muscle).forEach(muscle => addTotals(totals, muscle, summary));
    }));
    return totals;
  }

  function recentMuscleWorkload(workouts, { now = Date.now(), days = 7, ...options } = {}) {
    const through = timestamp(now);
    const safeThrough = through === null ? Date.now() : through;
    const safeDays = Math.max(1, Math.round(number(days) || 1));
    const since = safeThrough - safeDays * DAY_MS;
    const recent = completedWorkouts(workouts).filter(workout => {
      const completedAt = timestamp(workout.completedAt);
      return completedAt > since && completedAt <= safeThrough;
    });
    return {
      days: safeDays,
      since: new Date(since).toISOString(),
      through: new Date(safeThrough).toISOString(),
      workoutCount: recent.length,
      muscles: muscleTotals(recent, options)
    };
  }

  function muscleWorkloadWindows(workouts, { now = Date.now(), ...options } = {}) {
    return {
      sevenDay: recentMuscleWorkload(workouts, { now, days: 7, ...options }),
      thirtyDay: recentMuscleWorkload(workouts, { now, days: 30, ...options })
    };
  }

  function exerciseFamilyTotals(workouts, exercises, options = {}) {
    const catalog = new Map(list(exercises).map(exercise => [exercise.id, exercise]));
    const totals = {};
    completedWorkouts(workouts).forEach(workout => list(workout.exercises).forEach(exercise => {
      const summary = setSummary(exercise, options);
      if (!summary.workingSetCount) return;
      const exerciseId = canonicalExerciseId(exercise);
      const definition = catalog.get(exerciseId);
      addTotals(totals, definition?.family || exerciseId, summary);
    }));
    return totals;
  }

  scope.BigGainsAnalytics = Object.freeze({
    bestWorkingSet,
    durationSeconds,
    estimate1RM,
    exerciseFamilyTotals,
    exerciseHistory,
    exerciseTrend,
    isWorkingSet,
    muscleNames,
    muscleTotals,
    muscleWorkloadWindows,
    performanceDelta,
    profileBodyweight,
    previousPerformance,
    recentMuscleWorkload,
    setSummary,
    workingSets,
    workoutSummary
  });
})(typeof window === 'object' ? window : globalThis);
