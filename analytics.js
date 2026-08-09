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

  function metricsForSet(set) {
    if (!set) return null;
    const weight = number(set.weight);
    const reps = number(set.reps);
    return {
      ...set,
      weight,
      reps,
      volume: weight * reps,
      estimated1RM: estimate1RM(weight, reps)
    };
  }

  function betterSet(candidate, winner) {
    if (!winner) return true;
    if (candidate.estimated1RM !== winner.estimated1RM) return candidate.estimated1RM > winner.estimated1RM;
    if (candidate.weight !== winner.weight) return candidate.weight > winner.weight;
    return candidate.reps > winner.reps;
  }

  function bestWorkingSet(source) {
    return workingSets(source).map(metricsForSet).reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null);
  }

  function setSummary(source) {
    const sets = workingSets(source).map(metricsForSet);
    return {
      workingSets: sets,
      workingSetCount: sets.length,
      workingSetVolume: sets.reduce((total, set) => total + set.volume, 0),
      totalReps: sets.reduce((total, set) => total + set.reps, 0),
      bestWorkingSet: sets.reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null)
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

  function workoutSummary(workout) {
    const exercises = list(workout?.exercises);
    const setMetrics = setSummary(exercises.flatMap(exercise => list(exercise?.sets)));
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

  function performanceDelta(current, previous) {
    const currentBest = current?.bestWorkingSet || bestWorkingSet(current);
    const previousBest = previous?.bestWorkingSet || bestWorkingSet(previous);
    if (!currentBest || !previousBest) return null;
    const weightDelta = number(currentBest.weight) - number(previousBest.weight);
    const repsDelta = number(currentBest.reps) - number(previousBest.reps);
    const estimated1RMDelta = number(currentBest.estimated1RM) - number(previousBest.estimated1RM);
    let improvement = null;
    if (weightDelta > 0 && number(currentBest.reps) >= number(previousBest.reps)) {
      improvement = { kind: 'weight', value: weightDelta, label: `+${weightDelta} lb` };
    } else if (weightDelta === 0 && repsDelta > 0) {
      improvement = { kind: 'reps', value: repsDelta, label: `+${repsDelta} rep${repsDelta === 1 ? '' : 's'}` };
    }
    return { currentBest, previousBest, weightDelta, repsDelta, estimated1RMDelta, improvement };
  }

  function exerciseHistory(workouts, exerciseId) {
    if (typeof exerciseId !== 'string' || !exerciseId) return [];
    const sessions = completedWorkouts(workouts).flatMap(workout => {
      const exercise = list(workout.exercises).find(item => canonicalExerciseId(item) === exerciseId);
      if (!exercise) return [];
      const summary = setSummary(exercise);
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
      delta: performanceDelta(session, sessions[index + 1])
    }));
  }

  function previousPerformance(workouts, exerciseId) {
    return exerciseHistory(workouts, exerciseId)[0] || null;
  }

  function exerciseTrend(workouts, exerciseId) {
    const sessions = exerciseHistory(workouts, exerciseId);
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
    target[key].workingSetVolume += summary.workingSetVolume;
    target[key].totalReps += summary.totalReps;
  }

  function muscleTotals(workouts) {
    const totals = {};
    completedWorkouts(workouts).forEach(workout => list(workout.exercises).forEach(exercise => {
      const summary = setSummary(exercise);
      if (!summary.workingSetCount) return;
      muscleNames(exercise.muscle).forEach(muscle => addTotals(totals, muscle, summary));
    }));
    return totals;
  }

  function recentMuscleWorkload(workouts, { now = Date.now(), days = 7 } = {}) {
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
      muscles: muscleTotals(recent)
    };
  }

  function muscleWorkloadWindows(workouts, { now = Date.now() } = {}) {
    return {
      sevenDay: recentMuscleWorkload(workouts, { now, days: 7 }),
      thirtyDay: recentMuscleWorkload(workouts, { now, days: 30 })
    };
  }

  function exerciseFamilyTotals(workouts, exercises) {
    const catalog = new Map(list(exercises).map(exercise => [exercise.id, exercise]));
    const totals = {};
    completedWorkouts(workouts).forEach(workout => list(workout.exercises).forEach(exercise => {
      const summary = setSummary(exercise);
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
    previousPerformance,
    recentMuscleWorkload,
    setSummary,
    workingSets,
    workoutSummary
  });
})(typeof window === 'object' ? window : globalThis);
