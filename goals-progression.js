((scope) => {
  'use strict';

  const POLICY = Object.freeze({ id: 'strength_double_progression_v1', version: 1 });
  const POLICY_REP_RANGE = Object.freeze({ min: 4, max: 6 });
  const EVIDENCE_LOOKBACK_DAYS = 42;
  const EVIDENCE_LIMIT = 3;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const ELIGIBLE_E1RM_BASES = new Set(['entered_load', 'combined_external_load']);

  const STATUS = Object.freeze({
    AVAILABLE: 'available',
    UNAVAILABLE: 'unavailable',
    CONFLICT: 'conflict'
  });

  const DECISION = Object.freeze({
    HOLD_LOAD_BUILD_REPS: 'HOLD_LOAD_BUILD_REPS',
    INCREASE_LOAD: 'INCREASE_LOAD',
    HOLD: 'HOLD',
    DECREASE_LOAD: 'DECREASE_LOAD',
    UNAVAILABLE: 'UNAVAILABLE',
    CONFLICT: 'CONFLICT'
  });

  const REASON = Object.freeze({
    BUILD_STRENGTH_VOLUME: 'BUILD_STRENGTH_VOLUME',
    ADD_REPS: 'ADD_REPS',
    ADD_LOAD_RESET_REPS: 'ADD_LOAD_RESET_REPS',
    HOLD_PARTIAL: 'HOLD_PARTIAL',
    ADJUST_REPEATED_MISS: 'ADJUST_REPEATED_MISS',
    USER_OVERRIDE_REVIEW: 'USER_OVERRIDE_REVIEW',
    GUIDANCE_DISABLED: 'GUIDANCE_DISABLED',
    GOAL_NOT_ACTIVE: 'GOAL_NOT_ACTIVE',
    ACHIEVED: 'ACHIEVED',
    POLICY_UNSUPPORTED: 'POLICY_UNSUPPORTED',
    IDENTITY_INELIGIBLE: 'IDENTITY_INELIGIBLE',
    MEASUREMENT_INCOMPATIBLE: 'MEASUREMENT_INCOMPATIBLE',
    ROUTINE_CONFLICT: 'ROUTINE_CONFLICT',
    ROUTINE_STRUCTURE_REQUIRED: 'ROUTINE_STRUCTURE_REQUIRED',
    LOADABILITY_UNAVAILABLE: 'LOADABILITY_UNAVAILABLE',
    STALE_EVIDENCE: 'STALE_EVIDENCE',
    ESTABLISH_BASELINE: 'ESTABLISH_BASELINE',
    EVIDENCE_UNAVAILABLE: 'EVIDENCE_UNAVAILABLE'
  });

  const ATTAINMENT = Object.freeze({
    IN_PROGRESS: 'in_progress',
    ESTIMATED_REACHED: 'estimated_reached',
    ACHIEVED: 'achieved'
  });

  const OBJECTIVE = Object.freeze({
    ESTABLISH_BASELINE: 'establish_baseline',
    BUILD_STRENGTH_VOLUME: 'build_strength_volume',
    EARN_NEXT_LOAD: 'earn_next_load',
    ADJUST_AND_REBUILD: 'adjust_and_rebuild'
  });

  const EXCLUDED = Object.freeze({
    AFTER_CUTOFF: 'AFTER_CUTOFF',
    BEFORE_LOOKBACK: 'BEFORE_LOOKBACK',
    DUPLICATE_EXPOSURE: 'DUPLICATE_EXPOSURE',
    DUPLICATE_CONFLICT: 'DUPLICATE_CONFLICT',
    EXERCISE_MISMATCH: 'EXERCISE_MISMATCH',
    INVALID_TIMESTAMP: 'INVALID_TIMESTAMP',
    MEASUREMENT_MISMATCH: 'MEASUREMENT_MISMATCH',
    SCOPE_MISMATCH: 'SCOPE_MISMATCH',
    STRUCTURE_INCOMPATIBLE: 'STRUCTURE_INCOMPATIBLE'
  });

  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const list = value => Array.isArray(value) ? value : [];
  const finite = value => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const positive = value => {
    const parsed = finite(value);
    return parsed !== null && parsed > 0 ? parsed : null;
  };
  const wholePositive = value => {
    const parsed = positive(value);
    return parsed !== null && Number.isInteger(parsed) ? parsed : null;
  };
  const timestamp = value => {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  };
  const normalizeNumber = value => Number(Number(value).toFixed(8));
  const sameNumber = (left, right) => Math.abs(Number(left) - Number(right)) < 1e-8;

  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freeze);
    return Object.freeze(value);
  }

  function parseRepRange(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') {
      const exact = wholePositive(value);
      return exact === null ? undefined : { min: exact, max: exact };
    }
    if (isRecord(value)) {
      const min = wholePositive(value.min);
      const max = wholePositive(value.max);
      return min === null || max === null || min > max ? undefined : { min, max };
    }
    const normalized = String(value).trim().replace(/[–—]/g, '-');
    if (!normalized) return null;
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(normalized);
    if (!match) return undefined;
    const min = wholePositive(match[1]);
    const max = wholePositive(match[2] || match[1]);
    return min === null || max === null || min > max ? undefined : { min, max };
  }

  function intersectRanges(left, right) {
    const min = Math.max(left.min, right.min);
    const max = Math.min(left.max, right.max);
    return min <= max ? { min, max } : null;
  }

  function normalizeRoutine(routine, policyRange, exerciseId) {
    if (!isRecord(routine)) {
      return { ok: false, reasonCode: REASON.ROUTINE_STRUCTURE_REQUIRED, explanation: 'A compatible working-set structure is required; Goals never invents a set count.' };
    }
    if (routine.exerciseId && routine.exerciseId !== exerciseId) {
      return { ok: false, conflict: true, reasonCode: REASON.ROUTINE_CONFLICT, explanation: 'The routine exercise identity does not match this exact strength goal.' };
    }
    const workingSetCount = wholePositive(routine.workingSetCount);
    if (workingSetCount === null || workingSetCount > 12) {
      return { ok: false, reasonCode: REASON.ROUTINE_STRUCTURE_REQUIRED, explanation: 'A valid routine or current-workout working-set count is required; Goals never invents sets.' };
    }
    const explicitInput = routine.repRange ?? routine.targetReps;
    const explicitRange = parseRepRange(explicitInput);
    if (explicitRange === undefined) {
      return { ok: false, conflict: true, reasonCode: REASON.ROUTINE_CONFLICT, explanation: 'The routine rep prescription cannot be represented as a compatible whole-rep range.' };
    }
    const effectiveRange = intersectRanges(explicitRange || POLICY_REP_RANGE, policyRange);
    if (!effectiveRange) {
      return { ok: false, conflict: true, reasonCode: REASON.ROUTINE_CONFLICT, explanation: `The routine rep range ${explicitRange.min}–${explicitRange.max} does not overlap the policy range ${policyRange.min}–${policyRange.max}.` };
    }
    return {
      ok: true,
      value: {
        source: typeof routine.source === 'string' && routine.source ? routine.source : 'resolved_structure',
        workingSetCount,
        requestedRepRange: explicitRange,
        effectiveRepRange: effectiveRange,
        usedDefaultRepRange: explicitRange === null
      }
    };
  }

  function normalizeLoadability(input, measurement) {
    const source = isRecord(input.loadability) ? input.loadability : {};
    const increment = positive(source.increment ?? input.loadIncrement ?? measurement?.ui?.loadStep);
    const suppliedLoads = list(source.validLoads).map(positive).filter(value => value !== null);
    const validLoads = [...new Set(suppliedLoads)].sort((left, right) => left - right);
    if (increment === null && validLoads.length < 2) return null;
    return { increment, validLoads };
  }

  function nextLoad(current, direction, loadability) {
    const validLoads = loadability.validLoads;
    const increment = loadability.increment;
    if (validLoads.length) {
      if (direction > 0) {
        const ceiling = increment === null ? Infinity : normalizeNumber(current + increment);
        const candidates = validLoads.filter(load => load > current && load <= ceiling);
        return candidates.length ? (increment === null ? candidates[0] : candidates[candidates.length - 1]) : null;
      }
      const floor = increment === null ? Infinity : normalizeNumber(current - increment);
      const candidates = validLoads.filter(load => load < current && load <= floor);
      return candidates.length ? candidates[candidates.length - 1] : null;
    }
    const raw = normalizeNumber(current + direction * increment);
    if (raw <= 0) return null;
    const rounded = normalizeNumber(Math.floor((raw + 1e-9) / increment) * increment);
    return rounded > 0 && (direction > 0 ? rounded > current : rounded < current) ? rounded : null;
  }

  function successfulTransition(current, routine, loadability) {
    const atTop = current.repTargets.every(rep => rep === routine.effectiveRepRange.max);
    if (atTop) {
      const advanced = nextLoad(current.enteredLoad, 1, loadability);
      if (advanced === null) return null;
      return {
        enteredLoad: advanced,
        repTargets: Array(routine.workingSetCount).fill(routine.effectiveRepRange.min),
        decisionCode: DECISION.INCREASE_LOAD,
        reasonCode: REASON.ADD_LOAD_RESET_REPS,
        objective: OBJECTIVE.EARN_NEXT_LOAD,
        explanation: `All comparable working sets completed ${routine.effectiveRepRange.max} reps. Advance one valid load increment and reset to ${routine.effectiveRepRange.min} reps.`
      };
    }
    return {
      enteredLoad: current.enteredLoad,
      repTargets: current.repTargets.map(rep => Math.min(rep + 1, routine.effectiveRepRange.max)),
      decisionCode: DECISION.HOLD_LOAD_BUILD_REPS,
      reasonCode: REASON.ADD_REPS,
      objective: OBJECTIVE.BUILD_STRENGTH_VOLUME,
      explanation: 'All comparable working sets completed the issued rep target. Keep the demonstrated load and add one rep per set.'
    };
  }

  function projectionInputs(input) {
    const recommendation = input?.recommendation;
    const workingSetCount = wholePositive(recommendation?.workingSetCount);
    const enteredLoadValue = positive(recommendation?.enteredLoad);
    const repRange = parseRepRange(recommendation?.repRange ?? POLICY_REP_RANGE);
    const repTargets = list(recommendation?.repTargets).map(wholePositive);
    const loadability = normalizeLoadability(input || {}, { ui: { loadStep: input?.loadIncrement } });
    if (workingSetCount === null || enteredLoadValue === null || !repRange || repRange === undefined || !loadability
      || repTargets.length !== workingSetCount
      || repTargets.some(rep => rep === null || rep < repRange.min || rep > repRange.max)) return null;
    return {
      current: { enteredLoad: enteredLoadValue, repTargets },
      routine: { workingSetCount, effectiveRepRange: repRange },
      loadability
    };
  }

  function projectTrajectory(input = {}) {
    const normalized = projectionInputs(input);
    if (!normalized) return freeze({ status: 'unavailable', current: null, steps: [], condition: null, conditional: true });
    const stepCount = Math.min(3, Math.max(2, wholePositive(input.stepCount) || 3));
    const steps = [];
    let current = normalized.current;
    for (let index = 0; index < stepCount; index += 1) {
      const next = successfulTransition(current, normalized.routine, normalized.loadability);
      if (!next) break;
      steps.push({
        sequence: index + 1,
        enteredLoad: next.enteredLoad,
        repTargets: [...next.repTargets],
        workingSetCount: normalized.routine.workingSetCount,
        decisionCode: next.decisionCode,
        reasonCode: next.reasonCode,
        condition: `If all ${normalized.routine.workingSetCount} working sets complete the current rep target.`
      });
      current = { enteredLoad: next.enteredLoad, repTargets: [...next.repTargets] };
    }
    const max = normalized.routine.effectiveRepRange.max;
    return freeze({
      status: steps.length ? 'available' : 'unavailable',
      current: {
        enteredLoad: normalized.current.enteredLoad,
        repTargets: [...normalized.current.repTargets],
        workingSetCount: normalized.routine.workingSetCount,
        repRange: { ...normalized.routine.effectiveRepRange }
      },
      steps,
      condition: `Complete all ${normalized.routine.workingSetCount} sets at ${max} reps to earn the next load step.`,
      conditional: true
    });
  }

  function exposuresToLoadSteps(normalized, loadSteps) {
    let current = normalized.current;
    let advancedLoads = 0;
    let exposures = 0;
    const limit = Math.max(12, loadSteps * (normalized.routine.effectiveRepRange.max - normalized.routine.effectiveRepRange.min + 2));
    while (advancedLoads < loadSteps && exposures < limit) {
      const next = successfulTransition(current, normalized.routine, normalized.loadability);
      if (!next) return null;
      exposures += 1;
      if (next.enteredLoad > current.enteredLoad) advancedLoads += 1;
      current = { enteredLoad: next.enteredLoad, repTargets: [...next.repTargets] };
    }
    return advancedLoads === loadSteps ? exposures : null;
  }

  function deadlineOutlook(input = {}) {
    if (!input.targetDate) {
      return freeze({ status: 'no_deadline', label: 'No deadline', explanation: 'No target date is set.', requiredExposures: null, availableExposures: null, prescriptionChanged: false });
    }
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input.targetDate));
    const cutoffMs = timestamp(input.evidenceCutoff);
    if (!dateMatch || cutoffMs === null) {
      return freeze({ status: 'unclear', label: 'Unclear', explanation: 'The target date or evidence cutoff is not valid enough for deterministic schedule math.', requiredExposures: null, availableExposures: null, prescriptionChanged: false });
    }
    const deadlineEndMs = Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]) + 1) - 1;
    const targetValue = positive(input.targetValue);
    const currentEstimate = positive(input.currentEstimate);
    const cadence = positive(input.exposuresPerWeek);
    const normalized = projectionInputs(input);
    if (targetValue !== null && currentEstimate !== null && currentEstimate >= targetValue) {
      return freeze({ status: 'on_pace', label: 'On pace', explanation: 'Current eligible estimated strength is already at or above the destination; a completed target single is still required for achievement.', requiredExposures: 0, availableExposures: cadence === null ? null : Math.max(0, Math.floor(((deadlineEndMs - cutoffMs) / DAY_MS) * cadence / 7)), prescriptionChanged: false });
    }
    if (targetValue === null || currentEstimate === null || cadence === null || !normalized) {
      const reason = cadence === null
        ? 'Saved routine frequency for this exact exercise is unknown, so Big Gains will not invent a weekly cadence.'
        : 'Current exact-exercise strength context is not complete enough for deterministic deadline math.';
      return freeze({ status: 'unclear', label: 'Unclear', explanation: reason, requiredExposures: null, availableExposures: null, prescriptionChanged: false });
    }
    const increment = normalized.loadability.increment;
    if (increment === null) {
      return freeze({ status: 'unclear', label: 'Unclear', explanation: 'A uniform valid load increment is required for transparent deadline math.', requiredExposures: null, availableExposures: null, prescriptionChanged: false });
    }
    const loadSteps = Math.ceil(Math.max(0, targetValue - currentEstimate) / increment);
    const requiredExposures = exposuresToLoadSteps(normalized, loadSteps);
    const availableExposures = Math.max(0, Math.floor(((deadlineEndMs - cutoffMs) / DAY_MS) * cadence / 7));
    if (requiredExposures === null) {
      return freeze({ status: 'unclear', label: 'Unclear', explanation: 'The current load sequence cannot be projected safely through the target gap.', requiredExposures: null, availableExposures, prescriptionChanged: false });
    }
    if (availableExposures < requiredExposures) {
      return freeze({
        status: 'aggressive',
        label: 'Aggressive',
        explanation: `The current deterministic path needs at least ${requiredExposures} successful conditional exposure${requiredExposures === 1 ? '' : 's'}, while the saved routine provides about ${availableExposures} before the target date. Faster-than-current progress would be required.`,
        requiredExposures,
        availableExposures,
        prescriptionChanged: false
      });
    }
    return freeze({
      status: 'on_pace',
      label: 'On pace',
      explanation: `The current deterministic path needs at least ${requiredExposures} successful conditional exposure${requiredExposures === 1 ? '' : 's'} and the saved routine provides about ${availableExposures}. This is schedule math, not a promise.`,
      requiredExposures,
      availableExposures,
      prescriptionChanged: false
    });
  }

  function validateGoalAndMeasurement(input) {
    const goal = input.goal;
    const measurement = input.measurement;
    if (!isRecord(goal)) return { reasonCode: REASON.IDENTITY_INELIGIBLE, explanation: 'An exact strength goal is required.' };
    if (goal.status !== 'active') return { reasonCode: REASON.GOAL_NOT_ACTIVE, explanation: `Goal guidance is unavailable while the goal is ${String(goal.status || 'not active')}.` };
    if (goal.guidanceEnabled !== true) return { reasonCode: REASON.GUIDANCE_DISABLED, explanation: 'Goal guidance is off, so no progression recommendation is available.' };
    if (goal.attainmentState === ATTAINMENT.ACHIEVED) return { reasonCode: REASON.ACHIEVED, explanation: 'The goal is already achieved, so no further progression recommendation is available.' };
    if (goal.metric !== 'one_rep_max' || positive(goal.targetValue) === null) {
      return { reasonCode: REASON.IDENTITY_INELIGIBLE, explanation: 'Goals v1 requires a positive one-repetition-max destination.' };
    }
    if (!isRecord(goal.policy) || goal.policy.id !== POLICY.id || Number(goal.policy.version) !== POLICY.version) {
      return { reasonCode: REASON.POLICY_UNSUPPORTED, explanation: 'The goal policy is not supported by this progression engine version.' };
    }
    if (!isRecord(measurement) || !goal.exerciseId || measurement.canonicalExerciseId !== goal.exerciseId) {
      return { reasonCode: REASON.IDENTITY_INELIGIBLE, explanation: 'The goal and EKF contract must share one exact canonical exercise identity.' };
    }
    const analytics = measurement.analytics || {};
    if (measurement.trackingModel !== 'load_reps'
      || measurement.loadSemantics?.resistanceSemantics !== 'external'
      || analytics.e1rmPermitted !== true
      || !ELIGIBLE_E1RM_BASES.has(analytics.e1rmLoadBasis)
      || analytics.e1rmLoadBasis !== goal.targetBasis) {
      return { reasonCode: REASON.MEASUREMENT_INCOMPATIBLE, explanation: 'The EKF measurement contract is not eligible for this exact strength-goal basis.' };
    }
    const unit = typeof goal.unit === 'string' ? goal.unit : '';
    const measurementUnit = typeof measurement.ui?.loadUnit === 'string' ? measurement.ui.loadUnit : '';
    if (!unit || !measurementUnit || unit !== measurementUnit) {
      return { reasonCode: REASON.MEASUREMENT_INCOMPATIBLE, explanation: 'The goal unit and EKF entered-load unit are missing or incompatible.' };
    }
    return null;
  }

  function exposureId(exposure, index) {
    const id = exposure?.exposureId ?? exposure?.workoutId;
    return typeof id === 'string' && id ? id : `missing:${index}`;
  }

  function evidenceSets(exposure) {
    return list(exposure?.sets ?? exposure?.workingSets);
  }

  function scopeMatches(goal, exposure) {
    if (goal.accountId && exposure.accountId && goal.accountId !== exposure.accountId) return false;
    if (goal.profileId && exposure.profileId && goal.profileId !== exposure.profileId) return false;
    return true;
  }

  function exposureMeaningMatches(goal, measurement, exposure) {
    return exposure.exerciseId === goal.exerciseId
      && exposure.unit === goal.unit
      && exposure.loadBasis === goal.targetBasis
      && exposure.contentRevision === measurement.contentRevision;
  }

  function enteredLoad(set) {
    return positive(set?.enteredLoad);
  }

  function basisLoad(set, basis) {
    if (basis === 'entered_load') return positive(set?.enteredLoad);
    if (basis === 'combined_external_load') return positive(set?.combinedExternalLoad);
    return null;
  }

  function completedWorkingSets(exposure) {
    return evidenceSets(exposure).filter(set => isRecord(set) && set.completed === true && set.warmup !== true);
  }

  function observedSet(set) {
    return {
      setId: typeof set.setId === 'string' ? set.setId : (typeof set.id === 'string' ? set.id : null),
      enteredLoad: enteredLoad(set),
      reps: wholePositive(set.reps),
      estimated1RM: finite(set.estimated1RM)
    };
  }

  function e1rmEvidence(set, goal, measurement) {
    const e1rm = set?.e1rm;
    const reps = wholePositive(set?.reps);
    const load = basisLoad(set, goal.targetBasis);
    if (!isRecord(e1rm) || reps === null || reps > 12 || load === null) return null;
    if (e1rm.formulaId !== 'epley' || Number(e1rm.formulaVersion) !== 1
      || e1rm.loadBasis !== goal.targetBasis
      || e1rm.canonicalExerciseId !== goal.exerciseId
      || e1rm.contentRevision !== measurement.contentRevision
      || positive(e1rm.value) === null) return null;
    return {
      setId: typeof set.setId === 'string' ? set.setId : (typeof set.id === 'string' ? set.id : null),
      value: Number(e1rm.value),
      formulaId: 'epley',
      formulaVersion: 1,
      loadBasis: e1rm.loadBasis
    };
  }

  function comparableStructure(exposure, routine) {
    const sets = completedWorkingSets(exposure);
    if (sets.length !== routine.workingSetCount) return false;
    const loads = sets.map(enteredLoad);
    const reps = sets.map(set => wholePositive(set.reps));
    return loads.every(load => load !== null && sameNumber(load, loads[0]))
      && reps.every(rep => rep !== null && rep >= routine.effectiveRepRange.min && rep <= routine.effectiveRepRange.max);
  }

  function duplicateSignature(exposure) {
    return JSON.stringify({
      completedAt: exposure.completedAt,
      exerciseId: exposure.exerciseId,
      unit: exposure.unit,
      loadBasis: exposure.loadBasis,
      contentRevision: exposure.contentRevision,
      sets: evidenceSets(exposure).map(set => ({
        id: set?.setId ?? set?.id ?? null,
        completed: set?.completed === true,
        warmup: set?.warmup === true,
        enteredLoad: finite(set?.enteredLoad),
        combinedExternalLoad: finite(set?.combinedExternalLoad),
        reps: finite(set?.reps),
        e1rm: set?.e1rm || null
      }))
    });
  }

  function normalizeEvidence(input, goal, measurement, routine, cutoffMs) {
    const since = cutoffMs - EVIDENCE_LOOKBACK_DAYS * DAY_MS;
    const excluded = [];
    const allCompatible = [];
    const ids = new Map();
    let duplicateConflict = false;

    list(input.evidence).forEach((exposure, index) => {
      const id = exposureId(exposure, index);
      const completedAtMs = timestamp(exposure?.completedAt);
      const exclude = reasonCode => excluded.push({ exposureId: id, reasonCode });
      if (completedAtMs === null) return exclude(EXCLUDED.INVALID_TIMESTAMP);
      if (completedAtMs > cutoffMs) return exclude(EXCLUDED.AFTER_CUTOFF);
      if (!scopeMatches(goal, exposure)) return exclude(EXCLUDED.SCOPE_MISMATCH);
      if (exposure?.exerciseId !== goal.exerciseId) return exclude(EXCLUDED.EXERCISE_MISMATCH);
      if (!exposureMeaningMatches(goal, measurement, exposure)) return exclude(EXCLUDED.MEASUREMENT_MISMATCH);

      const signature = duplicateSignature(exposure);
      if (ids.has(id)) {
        if (ids.get(id) !== signature) {
          duplicateConflict = true;
          exclude(EXCLUDED.DUPLICATE_CONFLICT);
        } else {
          exclude(EXCLUDED.DUPLICATE_EXPOSURE);
        }
        return;
      }
      ids.set(id, signature);
      allCompatible.push({ id, completedAtMs, exposure });
    });

    allCompatible.sort((left, right) => right.completedAtMs - left.completedAtMs || left.id.localeCompare(right.id));
    const recentEligible = [];
    allCompatible.forEach(item => {
      if (item.completedAtMs <= since) {
        excluded.push({ exposureId: item.id, reasonCode: EXCLUDED.BEFORE_LOOKBACK });
      } else {
        recentEligible.push(item);
      }
    });
    const selected = recentEligible.slice(0, EVIDENCE_LIMIT);
    recentEligible.slice(EVIDENCE_LIMIT).forEach(item => excluded.push({ exposureId: item.id, reasonCode: 'BEYOND_RECENT_LIMIT' }));

    const observations = selected.map(({ id, exposure }) => ({
      exposureId: id,
      workoutId: typeof exposure.workoutId === 'string' ? exposure.workoutId : null,
      completedAt: new Date(timestamp(exposure.completedAt)).toISOString(),
      progressionComparable: comparableStructure(exposure, routine),
      sets: completedWorkingSets(exposure).map(observedSet),
      e1rm: completedWorkingSets(exposure).map(set => e1rmEvidence(set, goal, measurement)).filter(Boolean)
    }));

    return {
      allCompatible,
      duplicateConflict,
      excluded: excluded.sort((left, right) => left.exposureId.localeCompare(right.exposureId) || left.reasonCode.localeCompare(right.reasonCode)),
      recentEligible,
      selected,
      summary: {
        cutoff: new Date(cutoffMs).toISOString(),
        lookbackDays: EVIDENCE_LOOKBACK_DAYS,
        limit: EVIDENCE_LIMIT,
        selectedExposureIds: selected.map(item => item.id),
        exposureCount: selected.length,
        confidence: selected.length >= 3 ? 'standard' : selected.length === 2 ? 'limited' : selected.length === 1 ? 'single_exposure' : 'none',
        observations,
        excluded: excluded.sort((left, right) => left.exposureId.localeCompare(right.exposureId) || left.reasonCode.localeCompare(right.reasonCode))
      }
    };
  }

  function attainmentFrom(evidence, goal, measurement, cutoffMs) {
    const compatibleThroughCutoff = evidence.allCompatible.filter(item => item.completedAtMs <= cutoffMs);
    for (const item of compatibleThroughCutoff) {
      for (const set of completedWorkingSets(item.exposure)) {
        if (wholePositive(set.reps) === 1 && basisLoad(set, goal.targetBasis) >= Number(goal.targetValue)) {
          return {
            status: ATTAINMENT.ACHIEVED,
            evidenceRefs: [{ exposureId: item.id, setId: set.setId ?? set.id ?? null }],
            bestEstimate: null,
            explanation: 'An eligible completed target single was recorded for the exact exercise and measurement basis.'
          };
        }
      }
    }

    let best = null;
    evidence.selected.forEach(item => completedWorkingSets(item.exposure).forEach(set => {
      const candidate = e1rmEvidence(set, goal, measurement);
      if (candidate && (!best || candidate.value > best.value)) best = { ...candidate, exposureId: item.id };
    }));
    if (best && best.value >= Number(goal.targetValue)) {
      return {
        status: ATTAINMENT.ESTIMATED_REACHED,
        evidenceRefs: [{ exposureId: best.exposureId, setId: best.setId }],
        bestEstimate: best,
        explanation: 'Eligible Epley v1 evidence is at or above the destination, but no qualifying target single was logged.'
      };
    }
    return {
      status: ATTAINMENT.IN_PROGRESS,
      evidenceRefs: [],
      bestEstimate: best,
      explanation: best ? 'Eligible Epley v1 evidence remains supporting context only.' : 'No eligible Epley v1 estimate is available in the selected evidence.'
    };
  }

  function normalizePriorDecision(priorDecision, goal, routine) {
    if (priorDecision === null || priorDecision === undefined) return { ok: true, value: null };
    if (!isRecord(priorDecision)
      || priorDecision.exerciseId !== goal.exerciseId
      || priorDecision.unit !== goal.unit
      || priorDecision.loadBasis !== goal.targetBasis) {
      return { ok: false, reasonCode: REASON.EVIDENCE_UNAVAILABLE, explanation: 'The prior decision does not share the goal identity, unit, and measurement basis.' };
    }
    const load = positive(priorDecision.enteredLoad);
    const workingSetCount = wholePositive(priorDecision.workingSetCount);
    const targets = list(priorDecision.repTargets).map(wholePositive);
    const uniform = wholePositive(priorDecision.targetReps);
    const repTargets = targets.length ? targets : (uniform === null || workingSetCount === null ? [] : Array(workingSetCount).fill(uniform));
    const issuedAtMs = timestamp(priorDecision.issuedAt);
    if (load === null || workingSetCount !== routine.workingSetCount || repTargets.length !== workingSetCount
      || repTargets.some(rep => rep === null || rep < routine.effectiveRepRange.min || rep > routine.effectiveRepRange.max)
      || (priorDecision.issuedAt !== undefined && issuedAtMs === null)) {
      return { ok: false, reasonCode: REASON.ROUTINE_CONFLICT, conflict: true, explanation: 'The prior target no longer fits the authoritative routine structure and rep range.' };
    }
    return {
      ok: true,
      value: {
        decisionId: typeof priorDecision.decisionId === 'string' ? priorDecision.decisionId : null,
        exerciseId: priorDecision.exerciseId,
        enteredLoad: load,
        unit: priorDecision.unit,
        loadBasis: priorDecision.loadBasis,
        workingSetCount,
        repTargets,
        issuedAt: issuedAtMs === null ? null : new Date(issuedAtMs).toISOString(),
        issuedAtMs
      }
    };
  }

  function outcomeFor(exposureItem, prior, routine) {
    const allSets = evidenceSets(exposureItem.exposure);
    const working = completedWorkingSets(exposureItem.exposure);
    const completedLoads = working.map(enteredLoad);
    const completedReps = working.map(set => wholePositive(set.reps));
    const afterDecision = prior.issuedAtMs === null || exposureItem.completedAtMs > prior.issuedAtMs;
    if (!afterDecision) return { kind: 'before_prior_decision', exposureId: exposureItem.id };
    if (working.length > prior.workingSetCount
      || completedLoads.some(load => load === null || !sameNumber(load, prior.enteredLoad))
      || completedReps.some(rep => rep === null)) {
      return { kind: 'user_override', exposureId: exposureItem.id };
    }
    if (working.length < prior.workingSetCount) {
      return { kind: 'partial', exposureId: exposureItem.id, completedWorkingSetCount: working.length, recordedSetCount: allSets.length };
    }
    const success = completedReps.every((rep, index) => rep >= prior.repTargets[index]);
    if (success) return { kind: 'success', exposureId: exposureItem.id };
    const belowLowerBound = completedReps.filter(rep => rep < routine.effectiveRepRange.min).length;
    if (belowLowerBound > prior.workingSetCount / 2) {
      return { kind: 'clear_miss', exposureId: exposureItem.id, belowLowerBound };
    }
    return { kind: 'partial', exposureId: exposureItem.id, completedWorkingSetCount: working.length, recordedSetCount: allSets.length };
  }

  function classifyPriorOutcomes(evidence, prior, routine) {
    return evidence.recentEligible
      .filter(item => item.completedAtMs > (prior.issuedAtMs ?? -Infinity))
      .map(item => outcomeFor(item, prior, routine));
  }

  function stableBaseline(selected, routine) {
    const structurallyCompatible = selected.filter(item => comparableStructure(item.exposure, routine));
    if (!structurallyCompatible.length) return null;
    const observations = structurallyCompatible.map(item => {
      const sets = completedWorkingSets(item.exposure);
      const loads = sets.map(enteredLoad);
      const reps = sets.map(set => wholePositive(set.reps));
      return { item, load: loads[0], reps };
    });
    const anchor = observations[0];
    if (observations.length > 1 && !observations.slice(1).some(observation => sameNumber(observation.load, anchor.load))) return null;
    const targetReps = Math.max(routine.effectiveRepRange.min, Math.min(...anchor.reps));
    return { exposureId: anchor.item.id, enteredLoad: anchor.load, targetReps };
  }

  function recommendation({ goal, routine, load, reps, decisionCode, reasonCode, objective, explanation, evidence, attainment, priorOutcome }) {
    const repTargets = Array.isArray(reps) ? [...reps] : Array(routine.workingSetCount).fill(reps);
    return freeze({
      status: STATUS.AVAILABLE,
      decisionCode,
      reasonCode,
      explanation,
      recommendation: {
        exerciseId: goal.exerciseId,
        enteredLoad: normalizeNumber(load),
        unit: goal.unit,
        loadBasis: goal.targetBasis,
        workingSetCount: routine.workingSetCount,
        repRange: { ...routine.effectiveRepRange },
        repTargets,
        policy: { ...POLICY },
        objective
      },
      evidence: { ...evidence.summary, priorOutcome },
      routine,
      attainment,
      conflict: null
    });
  }

  function unavailable({ goal, reasonCode, explanation, evidence = null, routine = null, attainment = null, conflict = false }) {
    return freeze({
      status: conflict ? STATUS.CONFLICT : STATUS.UNAVAILABLE,
      decisionCode: conflict ? DECISION.CONFLICT : DECISION.UNAVAILABLE,
      reasonCode,
      explanation,
      recommendation: null,
      evidence: evidence?.summary || null,
      routine,
      attainment: attainment || {
        status: goal?.attainmentState === ATTAINMENT.ACHIEVED ? ATTAINMENT.ACHIEVED
          : goal?.attainmentState === ATTAINMENT.ESTIMATED_REACHED ? ATTAINMENT.ESTIMATED_REACHED
            : ATTAINMENT.IN_PROGRESS,
        evidenceRefs: [],
        bestEstimate: null,
        explanation: 'Attainment was not recomputed because an earlier resolver gate failed.'
      },
      conflict: conflict ? { reasonCode, explanation, routinePreserved: true } : null
    });
  }

  function resolve(input = {}) {
    const gate = validateGoalAndMeasurement(input);
    if (gate) return unavailable({ goal: input.goal, ...gate });
    const goal = input.goal;
    const measurement = input.measurement;
    const configuredRange = parseRepRange(input.policyConfig?.repRange ?? goal.policy.repRange ?? POLICY_REP_RANGE);
    if (configuredRange === undefined) {
      return unavailable({ goal, reasonCode: REASON.POLICY_UNSUPPORTED, explanation: 'The configured policy rep range is invalid.' });
    }
    const routineResult = normalizeRoutine(input.routine, configuredRange, goal.exerciseId);
    if (!routineResult.ok) return unavailable({ goal, ...routineResult });
    const routine = routineResult.value;
    const loadability = normalizeLoadability(input, measurement);
    if (!loadability) {
      return unavailable({ goal, routine, reasonCode: REASON.LOADABILITY_UNAVAILABLE, explanation: 'A positive supported load increment or explicit loadable sequence is required.' });
    }
    const cutoffMs = timestamp(input.evidenceCutoff);
    if (cutoffMs === null) {
      return unavailable({ goal, routine, reasonCode: REASON.EVIDENCE_UNAVAILABLE, explanation: 'A valid deterministic evidence cutoff is required.' });
    }
    const evidence = normalizeEvidence(input, goal, measurement, routine, cutoffMs);
    if (evidence.duplicateConflict) {
      return unavailable({ goal, routine, evidence, reasonCode: REASON.EVIDENCE_UNAVAILABLE, explanation: 'Conflicting duplicate records prevent a deterministic evidence decision.' });
    }
    const attainment = attainmentFrom(evidence, goal, measurement, cutoffMs);
    if (attainment.status === ATTAINMENT.ACHIEVED) {
      return unavailable({ goal, routine, evidence, attainment, reasonCode: REASON.ACHIEVED, explanation: 'The exact target single is already achieved, so this engine will not prescribe further work toward it.' });
    }
    const priorResult = normalizePriorDecision(input.priorDecision, goal, routine);
    if (!priorResult.ok) return unavailable({ goal, routine, evidence, attainment, ...priorResult });
    const prior = priorResult.value;

    if (prior) {
      const outcomes = classifyPriorOutcomes(evidence, prior, routine);
      const current = outcomes[0];
      if (!current) {
        const hasOldCompatibleEvidence = evidence.allCompatible.some(item => item.completedAtMs <= cutoffMs - EVIDENCE_LOOKBACK_DAYS * DAY_MS);
        return unavailable({
          goal, routine, evidence, attainment,
          reasonCode: hasOldCompatibleEvidence ? REASON.STALE_EVIDENCE : REASON.ESTABLISH_BASELINE,
          explanation: hasOldCompatibleEvidence ? 'Comparable evidence is older than the 42-day decision window.' : 'Log a comparable exposure after the prior decision before progressing it.'
        });
      }
      if (current.kind === 'user_override') {
        return recommendation({
          goal, routine, load: prior.enteredLoad, reps: prior.repTargets,
          decisionCode: DECISION.HOLD, reasonCode: REASON.USER_OVERRIDE_REVIEW,
          objective: OBJECTIVE.BUILD_STRENGTH_VOLUME,
          explanation: 'The latest completed performance used a materially different load or set structure. Hold the issued target unless a baseline is explicitly adopted.',
          evidence, attainment, priorOutcome: current
        });
      }
      if (current.kind === 'success') {
        const next = successfulTransition(prior, routine, loadability);
        if (!next) {
          if (prior.repTargets.every(rep => rep === routine.effectiveRepRange.max)) {
            return unavailable({ goal, routine, evidence, attainment, reasonCode: REASON.LOADABILITY_UNAVAILABLE, explanation: 'The top of the rep range was completed, but no higher valid one-step load is available.' });
          }
          return unavailable({ goal, routine, evidence, attainment, reasonCode: REASON.EVIDENCE_UNAVAILABLE, explanation: 'A successful progression transition could not be projected safely.' });
        }
        return recommendation({
          goal, routine, load: next.enteredLoad, reps: next.repTargets,
          decisionCode: next.decisionCode, reasonCode: next.reasonCode,
          objective: next.objective, explanation: next.explanation,
          evidence, attainment, priorOutcome: current
        });
      }
      if (current.kind === 'clear_miss' && outcomes[1]?.kind === 'clear_miss') {
        const adjusted = nextLoad(prior.enteredLoad, -1, loadability);
        if (adjusted === null) {
          return unavailable({ goal, routine, evidence, attainment, reasonCode: REASON.LOADABILITY_UNAVAILABLE, explanation: 'Repeated comparable misses occurred, but no lower valid one-step load is available.' });
        }
        return recommendation({
          goal, routine, load: adjusted, reps: routine.effectiveRepRange.min,
          decisionCode: DECISION.DECREASE_LOAD, reasonCode: REASON.ADJUST_REPEATED_MISS,
          objective: OBJECTIVE.ADJUST_AND_REBUILD,
          explanation: 'Two consecutive complete comparable attempts had more than half of working sets below the lower rep bound. Reduce one valid load step and rebuild.',
          evidence, attainment, priorOutcome: { ...current, consecutiveClearMisses: 2, precedingExposureId: outcomes[1].exposureId }
        });
      }
      return recommendation({
        goal, routine, load: prior.enteredLoad, reps: prior.repTargets,
        decisionCode: DECISION.HOLD, reasonCode: REASON.HOLD_PARTIAL,
        objective: OBJECTIVE.BUILD_STRENGTH_VOLUME,
        explanation: 'The latest comparable attempt was incomplete or did not satisfy the issued target. Hold the same load and reps; one miss does not trigger regression.',
        evidence, attainment, priorOutcome: current
      });
    }

    if (!evidence.selected.length) {
      const stale = evidence.allCompatible.some(item => item.completedAtMs <= cutoffMs - EVIDENCE_LOOKBACK_DAYS * DAY_MS);
      return unavailable({
        goal, routine, evidence, attainment,
        reasonCode: stale ? REASON.STALE_EVIDENCE : REASON.ESTABLISH_BASELINE,
        explanation: stale ? 'Comparable evidence is older than the 42-day decision window; establish a fresh baseline.' : 'Log or explicitly adopt a comparable working-set baseline first.'
      });
    }
    const baseline = stableBaseline(evidence.selected, routine);
    if (!baseline) {
      return unavailable({ goal, routine, evidence, attainment, reasonCode: REASON.ESTABLISH_BASELINE, explanation: 'Recent evidence does not demonstrate one stable, compatible working-load anchor.' });
    }
    return recommendation({
      goal, routine, load: baseline.enteredLoad, reps: baseline.targetReps,
      decisionCode: DECISION.HOLD_LOAD_BUILD_REPS, reasonCode: REASON.BUILD_STRENGTH_VOLUME,
      objective: OBJECTIVE.BUILD_STRENGTH_VOLUME,
      explanation: `Hold the demonstrated working load and build within ${routine.effectiveRepRange.min}–${routine.effectiveRepRange.max}. Complete the prescribed sets at the top of the range before adding load.`,
      evidence, attainment, priorOutcome: null
    });
  }

  const api = freeze({
    deadlineOutlook,
    projectTrajectory,
    resolve,
    policy: POLICY,
    constants: {
      attainment: ATTAINMENT,
      decisions: DECISION,
      evidenceLimit: EVIDENCE_LIMIT,
      evidenceLookbackDays: EVIDENCE_LOOKBACK_DAYS,
      objectives: OBJECTIVE,
      policyRepRange: POLICY_REP_RANGE,
      reasons: REASON,
      statuses: STATUS
    }
  });

  Object.defineProperty(scope, 'BigGainsGoalsProgression', {
    configurable: false,
    enumerable: true,
    value: api,
    writable: false
  });
})(typeof window === 'object' ? window : globalThis);
