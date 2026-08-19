((scope) => {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const list = value => Array.isArray(value) ? value : [];
  const number = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };
  const positive = value => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const timestamp = value => {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  };
  const catalog = () => scope.BigGainsExerciseCatalog || scope.bigGainsExerciseCatalog || null;

  const profileBodyweight = weights => {
    const entry = list(weights).find(item => positive(item?.weight) !== null);
    return entry ? Number(entry.weight) : null;
  };
  const bodyweightFrom = options => positive(options?.bodyweight);

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

  function definitionFor(exercise) {
    return catalog()?.definitionFor?.(exercise) || null;
  }

  function fallbackMeasurement(exercise, options = {}) {
    return {
      trackingModel: 'load_reps',
      loadSemantics: { loadBasis: 'unknown', resistanceSemantics: 'unknown' },
      repSemantics: 'unknown',
      laterality: 'not_applicable',
      bodyweightModel: null,
      analytics: { e1rmPermitted: false, e1rmLoadBasis: null },
      contentRevision: null,
      canonicalExerciseId: null
    };
  }

  function measurementFor(exercise, options = {}) {
    if (options.measurement) return options.measurement;
    const supplied = typeof options.measurementFor === 'function' ? options.measurementFor(exercise) : null;
    if (supplied) return supplied;
    return definitionFor(exercise)?.measurement || fallbackMeasurement(exercise, options);
  }

  function loadModeFor(exercise, options = {}) {
    const resistance = measurementFor(exercise, options)?.loadSemantics?.resistanceSemantics;
    return ['bodyweight_only', 'bodyweight_plus_external'].includes(resistance) ? 'bodyweight' : 'external';
  }

  function repEventCount(measurement, enteredReps, set) {
    if (['not_applicable', 'unknown'].includes(measurement.repSemantics)) return null;
    if (measurement.repSemantics !== 'reps_per_side') return enteredReps;
    return enteredReps * (positive(set?.sideCount) || 2);
  }

  function loadUnitsPerEvent(measurement) {
    const explicit = positive(measurement.loadUnitsPerEvent);
    if (explicit !== null) return explicit;
    const basis = measurement.loadSemantics?.loadBasis;
    if (basis === 'total') return 1;
    if (!['per_hand', 'per_side'].includes(basis)) return null;
    if (measurement.repSemantics === 'bilateral_cycle' && ['bilateral', 'independent_bilateral'].includes(measurement.laterality)) return 2;
    if (['unilateral', 'alternating'].includes(measurement.laterality)) return 1;
    return null;
  }

  function e1rmFor({ measurement, set, enteredLoad, enteredReps, combinedExternalLoad, effectiveSystemLoad }) {
    const rule = measurement.analytics || {};
    if (!rule.e1rmPermitted || !isWorkingSet(set) || !Number.isInteger(enteredReps) || enteredReps < 1 || enteredReps > 12) return null;
    const values = { entered_load: enteredLoad, combined_external_load: combinedExternalLoad, effective_system_load: effectiveSystemLoad };
    const value = values[rule.e1rmLoadBasis];
    if (!Number.isFinite(value) || value <= 0) return null;
    return {
      value: estimate1RM(value, enteredReps), formulaId: 'epley', formulaVersion: 1,
      canonicalExerciseId: measurement.canonicalExerciseId || null,
      contentRevision: measurement.contentRevision ?? null,
      loadBasis: rule.e1rmLoadBasis,
      quality: rule.e1rmLoadBasis === 'effective_system_load' ? 'modeled' : 'exact_arithmetic'
    };
  }

  // EKF-4.2/4.3/4.13: interpret entered schema-v5 facts without mutating them.
  function metricsForSet(set, options = {}) {
    if (!set) return null;
    const exercise = options.exercise || null;
    const measurement = measurementFor(exercise, options);
    const enteredLoad = number(set.weight);
    const enteredReps = number(set.reps);
    const duration = number(set.duration ?? set.durationSeconds);
    const distance = number(set.distance);
    const events = repEventCount(measurement, enteredReps, set);
    const loadUnits = loadUnitsPerEvent(measurement);
    const resistance = measurement.loadSemantics?.resistanceSemantics;
    const model = measurement.trackingModel;
    const hasLoad = ['load_reps', 'assistance_reps', 'load_duration', 'load_distance'].includes(model);
    const combined = hasLoad && loadUnits !== null ? enteredLoad * loadUnits : null;
    const combinedExternalLoad = ['external', 'bodyweight_plus_external'].includes(resistance) ? combined : null;
    const combinedIndicatedLoad = resistance === 'machine_indicated' ? combined : null;
    const bodyweight = bodyweightFrom(options);
    const effectiveSystemLoad = measurement.bodyweightModel === 'full_system' && bodyweight !== null
      ? resistance === 'bodyweight_plus_external' ? bodyweight + enteredLoad
        : resistance === 'assistance' ? Math.max(bodyweight - enteredLoad, 0)
          : resistance === 'bodyweight_only' ? bodyweight : null
      : null;
    const repVolumeEligible = ['load_reps', 'assistance_reps'].includes(model) && events !== null;
    const externalLoadVolume = repVolumeEligible && ['external', 'bodyweight_plus_external'].includes(resistance) && loadUnits !== null ? enteredLoad * loadUnits * events : null;
    const indicatedLoadVolume = repVolumeEligible && resistance === 'machine_indicated' && loadUnits !== null ? enteredLoad * loadUnits * events : null;
    const effectiveSystemLoadVolume = repVolumeEligible && effectiveSystemLoad !== null ? effectiveSystemLoad * events : null;
    const externalLoadDistance = model === 'load_distance' && resistance === 'external' && combinedExternalLoad !== null ? combinedExternalLoad * distance : null;
    const indicatedLoadDistance = model === 'load_distance' && resistance === 'machine_indicated' && combinedIndicatedLoad !== null ? combinedIndicatedLoad * distance : null;
    const e1rm = e1rmFor({ measurement, set, enteredLoad, enteredReps, combinedExternalLoad, effectiveSystemLoad });
    const requiresBodyweightContext = ['bodyweight_plus_external', 'assistance'].includes(resistance);
    const volumeKind = resistance === 'machine_indicated' && indicatedLoadVolume !== null ? 'indicated_load'
      : requiresBodyweightContext ? (effectiveSystemLoadVolume !== null ? 'modeled_system_load' : null)
        : externalLoadVolume !== null ? 'external_load' : null;
    const volume = volumeKind === 'indicated_load' ? indicatedLoadVolume
      : volumeKind === 'modeled_system_load' ? effectiveSystemLoadVolume
        : volumeKind === 'external_load' ? externalLoadVolume : null;
    const effectiveLoad = requiresBodyweightContext
      ? effectiveSystemLoad
      : effectiveSystemLoad ?? combinedExternalLoad ?? combinedIndicatedLoad ?? (hasLoad ? enteredLoad : null);
    return {
      ...set, weight: enteredLoad, reps: enteredReps, enteredLoad, enteredReps, duration, distance,
      trackingModel: model, loadMode: loadModeFor(exercise, { ...options, measurement }),
      loadBasis: measurement.loadSemantics?.loadBasis, resistanceSemantics: resistance,
      repSemantics: measurement.repSemantics, laterality: measurement.laterality,
      repEventCount: events, loadUnitsPerEvent: loadUnits,
      combinedExternalLoad, combinedIndicatedLoad, effectiveSystemLoad, effectiveLoad,
      externalLoadVolume, indicatedLoadVolume, effectiveSystemLoadVolume,
      externalLoadDistance, indicatedLoadDistance, volume, volumeKind,
      estimated1RM: e1rm?.value ?? null, e1rm,
      formulaId: e1rm?.formulaId ?? null, formulaVersion: e1rm?.formulaVersion ?? null
    };
  }

  function betterSet(candidate, winner) {
    if (!winner) return true;
    const candidateHasEstimate = candidate.estimated1RM !== null && Number.isFinite(Number(candidate.estimated1RM));
    const winnerHasEstimate = winner.estimated1RM !== null && Number.isFinite(Number(winner.estimated1RM));
    if (candidateHasEstimate !== winnerHasEstimate) return candidateHasEstimate;
    if (candidateHasEstimate && candidate.estimated1RM !== winner.estimated1RM) return candidate.estimated1RM > winner.estimated1RM;
    const candidateLoad = candidate.effectiveLoad === null ? candidate.weight : candidate.effectiveLoad;
    const winnerLoad = winner.effectiveLoad === null ? winner.weight : winner.effectiveLoad;
    if (candidateLoad !== winnerLoad) return candidateLoad > winnerLoad;
    return candidate.reps > winner.reps;
  }

  function bestWorkingSet(source, options = {}) {
    const exercise = Array.isArray(source) ? options.exercise : source;
    return workingSets(source).map(set => metricsForSet(set, { ...options, exercise })).reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null);
  }

  const sumMetric = (sets, key) => {
    const values = sets.map(set => set[key]).filter(value => value !== null && Number.isFinite(Number(value)));
    return values.length ? values.reduce((total, value) => total + Number(value), 0) : null;
  };

  function setSummary(source, options = {}) {
    const exercise = Array.isArray(source) ? options.exercise : source;
    const sets = workingSets(source).map(set => metricsForSet(set, { ...options, exercise }));
    const kinds = new Set(sets.map(set => set.volumeKind).filter(Boolean));
    const volumeKnown = sets.length > 0 && sets.every(set => set.volume !== null) && kinds.size <= 1;
    return {
      workingSets: sets, workingSetCount: sets.length,
      workingSetVolume: volumeKnown ? sets.reduce((total, set) => total + set.volume, 0) : null,
      workingSetVolumeKind: kinds.size === 1 ? [...kinds][0] : kinds.size > 1 ? 'mixed' : null,
      externalLoadVolume: sumMetric(sets, 'externalLoadVolume'), indicatedLoadVolume: sumMetric(sets, 'indicatedLoadVolume'),
      effectiveSystemLoadVolume: sumMetric(sets, 'effectiveSystemLoadVolume'), externalLoadDistance: sumMetric(sets, 'externalLoadDistance'),
      indicatedLoadDistance: sumMetric(sets, 'indicatedLoadDistance'), duration: sumMetric(sets, 'duration'), distance: sumMetric(sets, 'distance'),
      totalReps: sets.reduce((total, set) => total + set.reps, 0),
      bestWorkingSet: sets.reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null),
      loadMode: loadModeFor(exercise, options), effectiveLoadKnown: volumeKnown
    };
  }

  function durationSeconds(workout) {
    const stored = Number(workout?.durationSeconds);
    if (Number.isFinite(stored) && stored >= 0) return Math.round(stored);
    const started = timestamp(workout?.startedAt);
    const completed = timestamp(workout?.completedAt);
    return started !== null && completed !== null && completed >= started ? Math.round((completed - started) / 1000) : 0;
  }

  function workoutSummary(workout, options = {}) {
    const exercises = list(workout?.exercises);
    const exerciseSummaries = exercises.map(exercise => setSummary(exercise, options));
    const working = exerciseSummaries.flatMap(summary => summary.workingSets);
    const kinds = new Set(exerciseSummaries.map(summary => summary.workingSetVolumeKind).filter(Boolean));
    const volumeKnown = exerciseSummaries.filter(summary => summary.workingSetCount).every(summary => summary.workingSetVolume !== null) && kinds.size <= 1;
    return {
      workingSets: working, workingSetCount: working.length,
      workingSetVolume: volumeKnown ? exerciseSummaries.reduce((total, summary) => total + (summary.workingSetVolume || 0), 0) : null,
      workingSetVolumeKind: kinds.size === 1 ? [...kinds][0] : kinds.size > 1 ? 'mixed' : null,
      externalLoadVolume: sumMetric(working, 'externalLoadVolume'), indicatedLoadVolume: sumMetric(working, 'indicatedLoadVolume'),
      effectiveSystemLoadVolume: sumMetric(working, 'effectiveSystemLoadVolume'), externalLoadDistance: sumMetric(working, 'externalLoadDistance'),
      indicatedLoadDistance: sumMetric(working, 'indicatedLoadDistance'), totalReps: working.reduce((total, set) => total + set.reps, 0),
      bestWorkingSet: working.reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null),
      effectiveLoadKnown: volumeKnown, durationSeconds: durationSeconds(workout), prCount: Math.round(number(workout?.prs)),
      exerciseCount: exercises.filter(exercise => workingSets(exercise).length > 0).length
    };
  }

  function completedWorkouts(workouts) {
    return list(workouts).filter(workout => timestamp(workout?.completedAt) !== null).slice().sort((left, right) => timestamp(right.completedAt) - timestamp(left.completedAt));
  }

  function canonicalExerciseId(exercise) {
    return definitionFor(exercise)?.id || (typeof exercise?.definitionId === 'string' && exercise.definitionId ? exercise.definitionId : exercise?.id);
  }

  function derivePersonalRecords(workouts, options = {}) {
    const records = {};
    const workoutPrCounts = {};
    completedWorkouts(workouts).reverse().forEach(workout => {
      let prCount = 0;
      list(workout.exercises).forEach(exercise => {
        const exerciseId = canonicalExerciseId(exercise);
        if (!exerciseId) return;
        workingSets(exercise).forEach(set => {
          const metrics = metricsForSet(set, { ...options, exercise });
          if (metrics.estimated1RM === null || metrics.estimated1RM <= number(records[exerciseId]?.estimated1RM)) return;
          records[exerciseId] = {
            exercise: exercise.name || '', estimated1RM: metrics.estimated1RM, weight: metrics.weight, reps: metrics.reps,
            date: workout.completedAt, formulaId: metrics.formulaId, formulaVersion: metrics.formulaVersion,
            e1rmLoadBasis: metrics.e1rm?.loadBasis,
            ...(metrics.effectiveLoad !== metrics.weight ? { effectiveLoad: metrics.effectiveLoad } : {})
          };
          prCount += 1;
        });
      });
      workoutPrCounts[workout.id] = prCount;
    });
    return Object.freeze({ records: Object.freeze(records), workoutPrCounts: Object.freeze(workoutPrCounts) });
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
    if (weightDelta > 0 && number(currentBest.reps) >= number(previousBest.reps)) improvement = { kind: 'weight', value: weightDelta, label: `+${weightDelta} lb` };
    else if (weightDelta === 0 && repsDelta > 0) improvement = { kind: 'reps', value: repsDelta, label: `+${repsDelta} rep${repsDelta === 1 ? '' : 's'}` };
    return { currentBest, previousBest, weightDelta, repsDelta, estimated1RMDelta, improvement };
  }

  function exerciseHistory(workouts, exerciseId, options = {}) {
    if (typeof exerciseId !== 'string' || !exerciseId) return [];
    const requested = catalog()?.getById?.(exerciseId)?.id || exerciseId;
    const sessions = completedWorkouts(workouts).flatMap(workout => {
      const exercise = list(workout.exercises).find(item => canonicalExerciseId(item) === requested);
      if (!exercise) return [];
      const summary = setSummary(exercise, options);
      if (!summary.workingSetCount) return [];
      return [{ workoutId: workout.id, date: workout.completedAt, exerciseId: requested, exerciseName: exercise.name || '', muscle: exercise.muscle || '', equipment: exercise.equipment || '', ...summary }];
    });
    return sessions.map((session, index) => ({ ...session, delta: performanceDelta(session, sessions[index + 1], options) }));
  }

  function previousPerformance(workouts, exerciseId, options = {}) { return exerciseHistory(workouts, exerciseId, options)[0] || null; }

  function exerciseTrend(workouts, exerciseId, options = {}) {
    const sessions = exerciseHistory(workouts, exerciseId, options);
    const best = sessions.flatMap(session => session.workingSets).reduce((winner, candidate) => betterSet(candidate, winner) ? candidate : winner, null);
    return {
      exerciseId, sessions, latest: sessions[0] || null, previous: sessions[1] || null, bestWorkingSet: best,
      points: sessions.slice().reverse().map(session => ({ workoutId: session.workoutId, date: session.date, weight: session.bestWorkingSet.weight, reps: session.bestWorkingSet.reps, estimated1RM: session.bestWorkingSet.estimated1RM, workingSetVolume: session.workingSetVolume, totalReps: session.totalReps }))
    };
  }

  function muscleNames(value) {
    return String(value || '').split(/\s*(?:\/|,|&)\s*/).map(name => name.trim()).filter(Boolean);
  }

  function addTotals(target, key, summary) {
    if (!target[key]) {
      target[key] = { workingSets: 0, workingSetVolume: 0, totalReps: 0 };
      Object.defineProperty(target[key], '_volumeKind', { value: null, writable: true });
    }
    const totals = target[key];
    const incomingKind = summary.workingSetVolumeKind || null;
    const incompatibleKinds = totals._volumeKind && incomingKind && totals._volumeKind !== incomingKind;
    totals.workingSets += summary.workingSetCount;
    totals.workingSetVolume = totals.workingSetVolume === null || summary.workingSetVolume === null || incompatibleKinds
      ? null
      : totals.workingSetVolume + summary.workingSetVolume;
    totals.totalReps += summary.totalReps;
    totals._volumeKind = incompatibleKinds ? 'mixed' : totals._volumeKind || incomingKind;
  }

  function muscleTotals(workouts, options = {}) {
    const primary = {};
    const secondary = {};
    completedWorkouts(workouts).forEach(workout => list(workout.exercises).forEach(exercise => {
      const summary = setSummary(exercise, options);
      if (!summary.workingSetCount) return;
      const roles = definitionFor(exercise)?.muscleRoles;
      const primaryNames = roles?.primary?.length ? roles.primary : muscleNames(exercise.muscle);
      primaryNames.forEach(muscle => addTotals(primary, muscle, summary));
      list(roles?.secondary).forEach(muscle => addTotals(secondary, muscle, summary));
    }));
    return { ...primary, primary, secondary };
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
    const totals = muscleTotals(recent, options);
    return { days: safeDays, since: new Date(since).toISOString(), through: new Date(safeThrough).toISOString(), workoutCount: recent.length, muscles: totals.primary, secondaryMuscles: totals.secondary };
  }

  function muscleWorkloadWindows(workouts, { now = Date.now(), ...options } = {}) {
    return { sevenDay: recentMuscleWorkload(workouts, { now, days: 7, ...options }), thirtyDay: recentMuscleWorkload(workouts, { now, days: 30, ...options }) };
  }

  function exerciseFamilyTotals(workouts, exercises, options = {}) {
    const definitions = new Map(list(exercises).map(exercise => [exercise.id, exercise]));
    const totals = {};
    completedWorkouts(workouts).forEach(workout => list(workout.exercises).forEach(exercise => {
      const summary = setSummary(exercise, options);
      if (!summary.workingSetCount) return;
      const exerciseId = canonicalExerciseId(exercise);
      addTotals(totals, definitions.get(exerciseId)?.family || exerciseId, summary);
    }));
    return totals;
  }

  scope.BigGainsAnalytics = Object.freeze({
    bestWorkingSet, derivePersonalRecords, durationSeconds, estimate1RM, exerciseFamilyTotals,
    exerciseHistory, exerciseTrend, isWorkingSet, measurementFor, metricsForSet, muscleNames,
    muscleTotals, muscleWorkloadWindows, performanceDelta, profileBodyweight, previousPerformance,
    recentMuscleWorkload, setSummary, workingSets, workoutSummary
  });
})(typeof window === 'object' ? window : globalThis);
