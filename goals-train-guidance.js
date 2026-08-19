((scope) => {
  'use strict';

  const REASON_PRESENTATION = Object.freeze({
    BUILD_STRENGTH_VOLUME: { chip: 'Starting point', title: 'Using your recent working load' },
    ADD_REPS: { chip: 'Build reps', title: 'Keep the load and add reps' },
    ADD_LOAD_RESET_REPS: { chip: 'Add load', title: 'Move up one load step' },
    HOLD_PARTIAL: { chip: 'Hold', title: 'Repeat this target' },
    ADJUST_REPEATED_MISS: { chip: 'Adjust', title: 'Reduce one step and rebuild' },
    USER_OVERRIDE_REVIEW: { chip: 'Review', title: 'Your performance differed from the target' },
    GUIDANCE_DISABLED: { chip: 'Tracking only', title: 'Goal guidance is off' },
    GOAL_NOT_ACTIVE: { chip: 'Inactive', title: 'This goal is not active' },
    ACHIEVED: { chip: 'Achieved', title: 'The completed goal no longer prescribes work' },
    POLICY_UNSUPPORTED: { chip: 'Unavailable', title: 'This progression policy is not supported' },
    IDENTITY_INELIGIBLE: { chip: 'Unavailable', title: 'The exact exercise identity is unavailable' },
    MEASUREMENT_INCOMPATIBLE: { chip: 'Unavailable', title: 'The exercise measurement is not compatible' },
    ROUTINE_CONFLICT: { chip: 'Routine conflict', title: 'Review this routine prescription' },
    ROUTINE_STRUCTURE_REQUIRED: { chip: 'Unavailable', title: 'A safe working-set structure is required' },
    LOADABILITY_UNAVAILABLE: { chip: 'Unavailable', title: 'A supported load step is required' },
    STALE_EVIDENCE: { chip: 'Needs baseline', title: 'Recent evidence is too old' },
    ESTABLISH_BASELINE: { chip: 'Needs baseline', title: 'Establish a current working-load baseline' },
    EVIDENCE_UNAVAILABLE: { chip: 'Unavailable', title: 'Evidence could not be resolved safely' },
    MULTIPLE_GUIDED_GOALS: { chip: 'Needs review', title: 'Choose one guided goal for this exercise' }
  });

  const list = value => Array.isArray(value) ? value : [];
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const freeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  };

  function displayLoad(load, measurement) {
    const basis = measurement?.loadSemantics?.loadBasis;
    const unit = measurement?.ui?.loadUnit || 'lb';
    const suffix = basis === 'per_hand' ? ' per hand' : basis === 'per_side' ? ' per side' : '';
    return `${Number(load).toLocaleString('en-US')} ${unit}${suffix}`;
  }

  function displayGoalTarget(goal, measurement) {
    const loadBasis = measurement?.loadSemantics?.loadBasis;
    const suffix = goal?.targetBasis === 'combined_external_load' ? ' total'
      : loadBasis === 'per_hand' ? ' per hand'
        : loadBasis === 'per_side' ? ' per side' : '';
    return `${Number(goal?.targetValue).toLocaleString('en-US')} ${goal?.unit || 'lb'}${suffix}`;
  }

  function buildEvidence({ workouts, definition, measurement, goal, analytics, analyticsOptions }) {
    return list(workouts).flatMap(workout => {
      if (!workout?.completedAt) return [];
      const performed = list(workout.exercises).find(exercise => (
        definition.canonicalId === (exercise?.definitionId || exercise?.canonicalId)
        || definition.canonicalId === exercise?.id
        || definition.id === exercise?.id
      ));
      if (!performed) return [];
      return [{
        exposureId: workout.id,
        workoutId: workout.id,
        accountId: workout.accountId || goal.accountId,
        profileId: workout.profileId || goal.profileId,
        completedAt: workout.completedAt,
        exerciseId: definition.canonicalId,
        unit: measurement.ui?.loadUnit || goal.unit,
        loadBasis: goal.targetBasis,
        contentRevision: measurement.contentRevision,
        sets: list(performed.sets).map(set => {
          const metrics = analytics.metricsForSet(set, { ...analyticsOptions(), exercise: performed, measurement });
          return {
            setId: set.id,
            enteredLoad: metrics?.enteredLoad,
            combinedExternalLoad: metrics?.combinedExternalLoad,
            reps: metrics?.reps,
            estimated1RM: metrics?.estimated1RM,
            e1rm: metrics?.e1rm || null,
            warmup: set.warmup === true,
            completed: set.completed === true
          };
        })
      }];
    });
  }

  function normalizePrior(goal) {
    const candidate = goal?.progressionState?.current;
    return isRecord(candidate) ? candidate : null;
  }

  function create({ account, profile, catalog, analytics, analyticsOptions, getState, createId }) {
    const engine = scope.BigGainsGoalsProgression;
    if (!account || !profile || !catalog || !analytics || !engine
      || typeof analyticsOptions !== 'function' || typeof getState !== 'function' || typeof createId !== 'function') {
      throw new TypeError('Goals Train guidance requires account, profile, EKF, analytics, state, IDs, and the Goals progression engine.');
    }

    function matchingGoals(definition) {
      return list(getState()?.goals?.strengthGoals).filter(goal => (
        goal?.accountId === account.accountId
        && goal?.profileId === profile.id
        && goal?.exerciseId === definition.canonicalId
        && goal?.metric === 'one_rep_max'
        && goal?.status === 'active'
        && goal?.guidanceEnabled === true
      ));
    }

    function snapshotForResult({ result, goal, definition, measurement, cutoff }) {
      const recommendation = result.recommendation ? {
        ...result.recommendation,
        repRange: { ...result.recommendation.repRange },
        repTargets: [...result.recommendation.repTargets],
        policy: { ...result.recommendation.policy }
      } : null;
      return freeze({
        version: 1,
        goalId: goal.goalId,
        exerciseId: definition.canonicalId,
        exerciseName: definition.name,
        targetValue: goal.targetValue,
        targetUnit: goal.unit,
        targetBasis: goal.targetBasis,
        evidenceCutoff: cutoff,
        status: result.status,
        decisionCode: result.decisionCode,
        reasonCode: result.reasonCode,
        explanation: result.explanation,
        recommendation,
        routine: result.routine ? { ...result.routine } : null,
        evidence: result.evidence ? { ...result.evidence } : null,
        attainment: result.attainment ? { ...result.attainment } : null,
        conflict: result.conflict ? { ...result.conflict, safeRecommendation: null } : null,
        display: {
          goal: displayGoalTarget(goal, measurement),
          load: recommendation ? displayLoad(recommendation.enteredLoad, measurement) : null,
          loadLabel: measurement.ui?.loadLabel || 'Weight'
        }
      });
    }

    function duplicateSnapshot(goals, definition, cutoff) {
      return freeze({
        version: 1,
        goalId: null,
        exerciseId: definition.canonicalId,
        exerciseName: definition.name,
        targetValue: null,
        targetUnit: 'lb',
        targetBasis: null,
        evidenceCutoff: cutoff,
        status: 'unavailable',
        decisionCode: 'UNAVAILABLE',
        reasonCode: 'MULTIPLE_GUIDED_GOALS',
        explanation: `${goals.length} active guided goals match this exact exercise. Choose one before Train can apply a target.`,
        recommendation: null,
        routine: null,
        evidence: null,
        attainment: null,
        conflict: null,
        display: { goal: null, load: null, loadLabel: null }
      });
    }

    function retainDecision(goal, snapshot) {
      const recommendation = snapshot.recommendation;
      if (!recommendation) return;
      const issued = {
        decisionId: createId(),
        issuedAt: snapshot.evidenceCutoff,
        evidenceCutoff: snapshot.evidenceCutoff,
        exerciseId: snapshot.exerciseId,
        enteredLoad: recommendation.enteredLoad,
        unit: recommendation.unit,
        loadBasis: recommendation.loadBasis,
        workingSetCount: recommendation.workingSetCount,
        repTargets: [...recommendation.repTargets],
        decisionCode: snapshot.decisionCode,
        reasonCode: snapshot.reasonCode,
        explanation: snapshot.explanation,
        policy: { ...recommendation.policy },
        selectedExposureIds: [...list(snapshot.evidence?.selectedExposureIds)],
        attainmentState: snapshot.attainment?.status || 'in_progress'
      };
      const previousCurrent = normalizePrior(goal);
      const previous = [previousCurrent, ...list(goal.progressionState?.trace)].filter(Boolean);
      goal.progressionState = {
        current: issued,
        trace: [issued, ...previous.filter(item => item?.decisionId !== issued.decisionId)].slice(0, 8)
      };
      goal.updatedAt = snapshot.evidenceCutoff;
    }

    function prepareExercise({ exercise, definition, prescription, evidenceCutoff, source = 'current_workout' }) {
      const goals = matchingGoals(definition);
      if (!goals.length) return exercise;
      const cutoff = new Date(evidenceCutoff).toISOString();
      if (goals.length > 1) {
        exercise.goalGuidance = duplicateSnapshot(goals, definition, cutoff);
        return exercise;
      }
      const goal = goals[0];
      const measurement = catalog.measurementFor(definition);
      const workingSetCount = list(exercise.sets).filter(set => set.warmup !== true).length;
      const routine = {
        exerciseId: definition.canonicalId,
        workingSetCount,
        targetReps: typeof prescription?.targetReps === 'string' ? prescription.targetReps : '',
        source
      };
      const evidence = buildEvidence({
        workouts: getState().workouts,
        definition,
        measurement,
        goal,
        analytics,
        analyticsOptions
      });
      const result = engine.resolve({
        goal,
        measurement,
        routine,
        evidence,
        priorDecision: normalizePrior(goal),
        evidenceCutoff: cutoff,
        loadability: { increment: measurement?.ui?.loadStep }
      });
      const snapshot = snapshotForResult({ result, goal, definition, measurement, cutoff });
      exercise.goalGuidance = snapshot;
      if (snapshot.status !== 'available' || !snapshot.recommendation) return exercise;

      const workingSets = exercise.sets.filter(set => set.warmup !== true);
      workingSets.forEach((set, index) => {
        set.weight = snapshot.recommendation.enteredLoad;
        set.reps = snapshot.recommendation.repTargets[index];
      });
      exercise.targetWorkingSets = snapshot.recommendation.workingSetCount;
      const uniqueTargets = [...new Set(snapshot.recommendation.repTargets)];
      exercise.targetReps = uniqueTargets.length === 1 ? String(uniqueTargets[0]) : snapshot.recommendation.repTargets.join('/');
      retainDecision(goal, snapshot);
      return exercise;
    }

    function presentationFor(snapshot) {
      const base = REASON_PRESENTATION[snapshot?.reasonCode] || { chip: 'Goal guidance', title: 'Goal target review' };
      const baseline = snapshot?.status === 'available'
        && snapshot?.reasonCode === 'BUILD_STRENGTH_VOLUME'
        && snapshot?.evidence?.priorOutcome == null;
      return {
        ...base,
        ...(baseline ? { chip: 'Starting point', title: 'Using your recent working load' } : {})
      };
    }

    function render(exercise, escapeHtml) {
      const snapshot = exercise?.goalGuidance;
      if (!snapshot) return '';
      const copy = presentationFor(snapshot);
      const goal = snapshot.display?.goal ? `${snapshot.exerciseName} ${snapshot.display.goal}` : snapshot.exerciseName;
      if (snapshot.status === 'available' && snapshot.recommendation) {
        const reps = snapshot.recommendation.repTargets;
        const repText = [...new Set(reps)].length === 1 ? reps[0] : reps.join('/');
        const attainment = snapshot.attainment?.status === 'estimated_reached'
          ? '<p class="goal-guidance-attainment">Estimated target reached · a completed target single is still required.</p>'
          : '';
        return `<section class="goal-train-guidance" data-goal-guidance-status="available" data-goal-reason="${escapeHtml(snapshot.reasonCode)}">
          <div class="goal-train-heading"><span>Strength goal · ${escapeHtml(goal)}</span><em>${escapeHtml(copy.chip)}</em></div>
          <strong class="goal-train-target">Today: ${escapeHtml(snapshot.display.load)} × ${escapeHtml(repText)} · ${snapshot.recommendation.workingSetCount} set${snapshot.recommendation.workingSetCount === 1 ? '' : 's'}</strong>
          <small>${escapeHtml(snapshot.display.loadLabel)} · editable starting target</small>
          ${attainment}
          <details><summary>Why this target?</summary><strong>${escapeHtml(copy.title)}</strong><p>${escapeHtml(snapshot.explanation)}</p></details>
        </section>`;
      }
      if (snapshot.status === 'conflict') {
        const canUseToday = Boolean(snapshot.conflict?.safeRecommendation);
        return `<section class="goal-train-guidance is-blocked" data-goal-guidance-status="conflict" data-goal-reason="${escapeHtml(snapshot.reasonCode)}">
          <div class="goal-train-heading"><span>Strength goal · ${escapeHtml(goal)}</span><em>${escapeHtml(copy.chip)}</em></div>
          <strong>${escapeHtml(copy.title)}</strong><p>${escapeHtml(snapshot.explanation)}</p>
          <div class="goal-train-actions"><button type="button" class="ghost compact" data-goal-use-today ${canUseToday ? '' : 'disabled title="No safe one-workout target is available"'}>Use for today</button><button type="button" class="secondary compact" data-goal-review-routine>Review routine</button></div>
        </section>`;
      }
      return `<section class="goal-train-guidance is-blocked" data-goal-guidance-status="unavailable" data-goal-reason="${escapeHtml(snapshot.reasonCode)}">
        <div class="goal-train-heading"><span>Strength goal · ${escapeHtml(goal)}</span><em>${escapeHtml(copy.chip)}</em></div>
        <strong>${escapeHtml(copy.title)}</strong><p>${escapeHtml(snapshot.explanation)}</p><small>Your routine values remain available.</small>
      </section>`;
    }

    function useForToday(exercise) {
      const safe = exercise?.goalGuidance?.conflict?.safeRecommendation;
      if (!safe) return false;
      const working = list(exercise.sets).filter(set => set.warmup !== true);
      if (working.length !== safe.workingSetCount || list(safe.repTargets).length !== working.length) return false;
      working.forEach((set, index) => {
        set.weight = safe.enteredLoad;
        set.reps = safe.repTargets[index];
      });
      exercise.goalGuidance = freeze({ ...exercise.goalGuidance, status: 'available', recommendation: { ...safe }, conflict: null });
      return true;
    }

    return Object.freeze({ prepareExercise, presentationFor, render, useForToday });
  }

  Object.defineProperty(scope, 'BigGainsGoalsTrainGuidance', {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ create, reasonPresentation: REASON_PRESENTATION }),
    writable: false
  });
})(typeof window === 'object' ? window : globalThis);
