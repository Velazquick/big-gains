((scope) => {
  'use strict';

  const CONTRACT = 'big-gains.program-analysis.v1';
  const UNKNOWN = 'unknown';
  const VALID_AUTHORITIES = new Set(['off', 'review']);
  const VALID_STATUSES = new Set(['draft', 'active', 'completed', 'archived']);
  const VALID_BOUNDARIES = new Set(['completed_cycles', 'weeks', 'date']);
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' ? value.trim() : '';
  const positiveInteger = (value, maximum = Number.MAX_SAFE_INTEGER) => Number.isInteger(Number(value))
    && Number(value) > 0 && Number(value) <= maximum;
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const deepFreeze = value => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };
  const orderedUnique = values => [...new Set(values)];
  const compareText = (left, right) => String(left).localeCompare(String(right), 'en', { sensitivity: 'base' });
  const byNameThenId = (left, right) => compareText(left.name, right.name) || compareText(left.exerciseId, right.exerciseId);
  const error = (code, path, details = null) => details == null ? { code, path } : { code, path, details };

  function unavailable(programVersion, errors) {
    return deepFreeze({
      contract: CONTRACT,
      status: 'unavailable',
      programVersionId: text(programVersion?.programVersionId) || null,
      errors,
      notices: [],
      program: null,
      topology: null,
      exerciseExposure: null,
      goalExposure: null,
      muscleExposure: null,
      movementExposure: null,
      prescriptionSummary: null,
      sessionSpacing: null,
      volumeTopology: null,
      blockContext: null
    });
  }

  function normalizeRepTarget(value) {
    const sourceText = text(isRecord(value) ? value.text : value).slice(0, 40);
    if (isRecord(value) && value.kind === 'exact' && positiveInteger(value.value)) {
      const rep = Number(value.value);
      return { kind: 'exact', text: sourceText || String(rep), min: rep, max: rep };
    }
    if (isRecord(value) && value.kind === 'range' && positiveInteger(value.min)
      && positiveInteger(value.max) && Number(value.min) <= Number(value.max)) {
      return { kind: 'range', text: sourceText || `${Number(value.min)}–${Number(value.max)}`, min: Number(value.min), max: Number(value.max) };
    }
    const exact = sourceText.match(/^(\d+)$/);
    if (exact && positiveInteger(exact[1])) {
      const rep = Number(exact[1]);
      return { kind: 'exact', text: sourceText, min: rep, max: rep };
    }
    const range = sourceText.match(/^(\d+)\s*[-\u2013\u2014]\s*(\d+)$/);
    if (range && positiveInteger(range[1]) && positiveInteger(range[2]) && Number(range[1]) <= Number(range[2])) {
      return { kind: 'range', text: sourceText, min: Number(range[1]), max: Number(range[2]) };
    }
    return { kind: 'unavailable', text: sourceText || null, min: null, max: null };
  }

  function validate({ programVersion, routineVersions, catalog, goals, options }) {
    const errors = [];
    if (!isRecord(programVersion)) return [error('PROGRAM_VERSION_REQUIRED', 'programVersion')];
    const accountId = text(programVersion.accountId);
    const profileId = text(programVersion.profileId);
    if (!text(programVersion.programVersionId)) errors.push(error('PROGRAM_VERSION_ID_REQUIRED', 'programVersion.programVersionId'));
    if (!text(programVersion.programId)) errors.push(error('PROGRAM_ID_REQUIRED', 'programVersion.programId'));
    if (!positiveInteger(programVersion.versionNumber) || !text(programVersion.name)) errors.push(error('PROGRAM_VERSION_METADATA_INVALID', 'programVersion'));
    if (!accountId || !profileId) errors.push(error('PROGRAM_SCOPE_REQUIRED', 'programVersion'));
    if (programVersion.scheduleMode !== 'rolling_cycle'
      || programVersion.cadencePolicy?.kind !== 'rolling_cycle'
      || programVersion.cadencePolicy?.advanceOn !== 'completed_session') {
      errors.push(error('CADENCE_POLICY_UNKNOWN', 'programVersion.cadencePolicy'));
    }
    if (!VALID_AUTHORITIES.has(programVersion.programmingAuthority)) {
      errors.push(error('PROGRAM_AUTHORITY_INVALID', 'programVersion.programmingAuthority'));
    }
    if (!isRecord(programVersion.duration) || programVersion.duration.mode !== 'rolling'
      || !/^\d{4}-\d{2}-\d{2}$/.test(text(programVersion.duration.startsOn))
      || !validDate(programVersion.duration.startsOn) || programVersion.duration.endsOn != null) {
      errors.push(error('PROGRAM_DURATION_INVALID', 'programVersion.duration'));
    }
    if (!validDate(programVersion.createdAt)
      || programVersion.effectiveBoundary?.kind !== 'next_unmaterialized_session') {
      errors.push(error('PROGRAM_START_METADATA_INVALID', 'programVersion'));
    }
    const boundary = programVersion.blockReviewPolicy;
    if (!isRecord(boundary) || !VALID_BOUNDARIES.has(boundary.boundaryKind)
      || boundary.onBoundary !== 'review_required'
      || (boundary.boundaryKind === 'date'
        ? !/^\d{4}-\d{2}-\d{2}$/.test(text(boundary.boundaryValue)) || !validDate(boundary.boundaryValue)
        : !positiveInteger(boundary.boundaryValue, 520))) {
      errors.push(error('BLOCK_REVIEW_POLICY_INVALID', 'programVersion.blockReviewPolicy'));
    }
    if (!Array.isArray(programVersion.slots) || !programVersion.slots.length) {
      errors.push(error('PROGRAM_SLOTS_REQUIRED', 'programVersion.slots'));
    }
    if (!Array.isArray(routineVersions)) errors.push(error('ROUTINE_VERSIONS_REQUIRED', 'routineVersions'));
    if (!catalog || typeof catalog.canonicalIdFor !== 'function' || typeof catalog.getById !== 'function') {
      errors.push(error('CATALOG_REQUIRED', 'catalog'));
    }
    if (errors.length) return errors;

    const versionIds = new Set();
    const versionById = new Map();
    routineVersions.forEach((version, versionIndex) => {
      const path = `routineVersions[${versionIndex}]`;
      if (!isRecord(version)) {
        errors.push(error('ROUTINE_VERSION_MALFORMED', path));
        return;
      }
      const versionId = text(version.routineVersionId);
      if (!versionId) errors.push(error('ROUTINE_VERSION_ID_REQUIRED', `${path}.routineVersionId`));
      else if (versionIds.has(versionId)) errors.push(error('DUPLICATE_ROUTINE_VERSION_ID', `${path}.routineVersionId`, versionId));
      else {
        versionIds.add(versionId);
        versionById.set(versionId, version);
      }
      if (!text(version.routineId)) errors.push(error('ROUTINE_ID_REQUIRED', `${path}.routineId`));
      if (version.accountId !== accountId || version.profileId !== profileId) {
        errors.push(error('ROUTINE_SCOPE_MISMATCH', path, versionId || null));
      }
      if (!Array.isArray(version.exercises) || !version.exercises.length) {
        errors.push(error('ROUTINE_EXERCISES_REQUIRED', `${path}.exercises`, versionId || null));
        return;
      }
      const exerciseIds = new Set();
      version.exercises.forEach((prescription, prescriptionIndex) => {
        const exercisePath = `${path}.exercises[${prescriptionIndex}]`;
        if (!isRecord(prescription)) {
          errors.push(error('ROUTINE_PRESCRIPTION_MALFORMED', exercisePath));
          return;
        }
        const exerciseId = text(prescription.exerciseId);
        const canonicalId = catalog.canonicalIdFor(exerciseId);
        if (!exerciseId || canonicalId !== exerciseId || !catalog.getById(exerciseId)) {
          errors.push(error('EXERCISE_IDENTITY_UNRESOLVED', `${exercisePath}.exerciseId`, exerciseId || null));
        } else if (exerciseIds.has(exerciseId)) {
          errors.push(error('DUPLICATE_EXERCISE_IN_ROUTINE', `${exercisePath}.exerciseId`, exerciseId));
        } else exerciseIds.add(exerciseId);
        if (!positiveInteger(prescription.workingSets, 12)) {
          errors.push(error('WORKING_SETS_INVALID', `${exercisePath}.workingSets`, prescription.workingSets ?? null));
        }
        if (prescription.restSeconds != null && !positiveInteger(prescription.restSeconds, 900)) {
          errors.push(error('REST_PRESCRIPTION_INVALID', `${exercisePath}.restSeconds`, prescription.restSeconds));
        }
      });
    });

    const slotIds = new Set();
    programVersion.slots.forEach((slot, slotIndex) => {
      const path = `programVersion.slots[${slotIndex}]`;
      if (!isRecord(slot)) {
        errors.push(error('PROGRAM_SLOT_MALFORMED', path));
        return;
      }
      if (!text(slot.slotId)) errors.push(error('SLOT_ID_REQUIRED', `${path}.slotId`));
      else if (slotIds.has(slot.slotId)) errors.push(error('DUPLICATE_SLOT_ID', `${path}.slotId`, slot.slotId));
      else slotIds.add(slot.slotId);
      if (Number(slot.sequence) !== slotIndex + 1) errors.push(error('SLOT_SEQUENCE_INVALID', `${path}.sequence`, slot.sequence ?? null));
      if (!text(slot.label)) errors.push(error('SLOT_LABEL_REQUIRED', `${path}.label`));
      const routineVersion = versionById.get(text(slot.routineVersionId));
      if (!routineVersion) errors.push(error('PINNED_ROUTINE_VERSION_NOT_FOUND', `${path}.routineVersionId`, text(slot.routineVersionId) || null));
      else if (text(slot.routineId) !== text(routineVersion.routineId)) {
        errors.push(error('PINNED_ROUTINE_ID_MISMATCH', `${path}.routineId`, text(slot.routineId) || null));
      }
      if (slot.preferredCalendarAnchor != null
        && (!isRecord(slot.preferredCalendarAnchor)
          || !Number.isInteger(Number(slot.preferredCalendarAnchor.weekday))
          || Number(slot.preferredCalendarAnchor.weekday) < 0
          || Number(slot.preferredCalendarAnchor.weekday) > 6)) {
        errors.push(error('CALENDAR_ANCHOR_INVALID', `${path}.preferredCalendarAnchor`));
      }
    });

    if (!Array.isArray(programVersion.priorityGoalIds)) errors.push(error('PROGRAM_GOAL_REFERENCES_INVALID', 'programVersion.priorityGoalIds'));
    const goalIds = Array.isArray(programVersion.priorityGoalIds) ? programVersion.priorityGoalIds.map(text).filter(Boolean) : [];
    if (new Set(goalIds).size !== goalIds.length) errors.push(error('DUPLICATE_GOAL_REFERENCE', 'programVersion.priorityGoalIds'));
    const suppliedGoals = (Array.isArray(goals) ? goals : []).filter(isRecord);
    const suppliedGoalIds = suppliedGoals.map(goal => text(goal.goalId)).filter(Boolean);
    if (new Set(suppliedGoalIds).size !== suppliedGoalIds.length) errors.push(error('DUPLICATE_GOAL_ID', 'goals'));
    const goalById = new Map(suppliedGoals.map(goal => [text(goal.goalId), goal]));
    goalIds.forEach((goalId, index) => {
      const goal = goalById.get(goalId);
      if (goal && (goal.accountId !== accountId || goal.profileId !== profileId)) {
        errors.push(error('GOAL_SCOPE_MISMATCH', `goals[${index}]`, goalId));
      }
      if (goal && goal.status === 'active'
        && (catalog.canonicalIdFor(goal.exerciseId) !== goal.exerciseId || !catalog.getById(goal.exerciseId))) {
        errors.push(error('GOAL_EXERCISE_IDENTITY_UNRESOLVED', `goals[${index}].exerciseId`, text(goal.exerciseId) || null));
      }
    });
    if (options?.programStatus != null && !VALID_STATUSES.has(options.programStatus)) {
      errors.push(error('PROGRAM_STATUS_INVALID', 'options.programStatus', options.programStatus));
    }
    return errors;
  }

  function spacingForPositions(positions, slotCount) {
    if (!positions.length) return [];
    if (positions.length === 1) return [slotCount];
    return positions.map((position, index) => {
      const next = positions[(index + 1) % positions.length];
      return next > position ? next - position : slotCount - position + next;
    });
  }

  function calendarContext(slots) {
    const anchors = slots.map(slot => slot.preferredCalendarAnchor == null ? null : Number(slot.preferredCalendarAnchor.weekday));
    const presentCount = anchors.filter(anchor => anchor != null).length;
    const allPresent = presentCount === slots.length;
    const forwardGaps = allPresent ? anchors.map((weekday, index) => {
      const next = anchors[(index + 1) % anchors.length];
      return (next - weekday + 7) % 7;
    }) : [];
    const reliable = allPresent && forwardGaps.every(gap => gap > 0);
    return {
      availability: presentCount === 0 ? 'unavailable' : reliable ? 'reliable' : 'partial_or_unreliable',
      anchors: slots.map((slot, index) => ({ slotId: slot.slotId, position: index + 1, weekday: anchors[index] })),
      nominalForwardDayGaps: reliable ? forwardGaps : null
    };
  }

  function nominalDaySpacing(positions, slots, calendar) {
    if (calendar.availability !== 'reliable' || !positions.length) return null;
    if (positions.length === 1) return [calendar.nominalForwardDayGaps.reduce((sum, value) => sum + value, 0)];
    return positions.map((position, index) => {
      const next = positions[(index + 1) % positions.length];
      let cursor = position - 1;
      let days = 0;
      while (cursor !== next - 1) {
        days += calendar.nominalForwardDayGaps[cursor];
        cursor = (cursor + 1) % slots.length;
      }
      return days;
    });
  }

  function aggregateCategory(map, key, exercise, occurrence) {
    if (!map.has(key)) map.set(key, { name: key, workingSets: 0, exerciseExposures: 0, slotIds: new Set(), exercises: new Map() });
    const bucket = map.get(key);
    bucket.workingSets += occurrence.workingSets;
    bucket.exerciseExposures += 1;
    bucket.slotIds.add(occurrence.slotId);
    const contribution = bucket.exercises.get(exercise.exerciseId) || { exerciseId: exercise.exerciseId, name: exercise.name, workingSets: 0, exposures: 0 };
    contribution.workingSets += occurrence.workingSets;
    contribution.exposures += 1;
    bucket.exercises.set(exercise.exerciseId, contribution);
  }

  function finalizeCategories(map) {
    return [...map.values()].sort((left, right) => compareText(left.name, right.name)).map(bucket => ({
      name: bucket.name,
      workingSets: bucket.workingSets,
      exerciseExposures: bucket.exerciseExposures,
      slotsExposed: bucket.slotIds.size,
      contributingExercises: [...bucket.exercises.values()].sort(byNameThenId)
    }));
  }

  function analyze(input = {}) {
    const { programVersion, routineVersions = [], catalog, goals = [], options = {} } = input;
    const errors = validate({ programVersion, routineVersions, catalog, goals, options });
    if (errors.length) return unavailable(programVersion, errors);

    const slots = programVersion.slots;
    const slotCount = slots.length;
    const versionById = new Map(routineVersions.map(version => [version.routineVersionId, version]));
    const calendar = calendarContext(slots);
    const exerciseMap = new Map();
    const routineSlotCounts = new Map();

    slots.forEach((slot, slotIndex) => {
      const routine = versionById.get(slot.routineVersionId);
      routineSlotCounts.set(slot.routineVersionId, (routineSlotCounts.get(slot.routineVersionId) || 0) + 1);
      routine.exercises.forEach(prescription => {
        const definition = catalog.getById(prescription.exerciseId);
        if (!exerciseMap.has(prescription.exerciseId)) {
          exerciseMap.set(prescription.exerciseId, {
            exerciseId: prescription.exerciseId,
            name: definition.name,
            definition,
            exposures: [],
            routineVersionIds: new Set(),
            workingSets: 0
          });
        }
        const exercise = exerciseMap.get(prescription.exerciseId);
        const repTarget = normalizeRepTarget(prescription.repTarget ?? prescription.targetReps);
        const occurrence = {
          slotId: slot.slotId,
          position: slotIndex + 1,
          label: slot.label,
          routineId: slot.routineId,
          routineVersionId: slot.routineVersionId,
          workingSets: Number(prescription.workingSets),
          repTarget,
          restSeconds: prescription.restSeconds == null ? null : Number(prescription.restSeconds)
        };
        exercise.exposures.push(occurrence);
        exercise.routineVersionIds.add(slot.routineVersionId);
        exercise.workingSets += occurrence.workingSets;
      });
    });

    const notices = [];
    const exerciseExposure = [...exerciseMap.values()].sort(byNameThenId).map(exercise => {
      const positions = exercise.exposures.map(exposure => exposure.position);
      const primaryRoles = Array.isArray(exercise.definition.muscleRoles?.primary) ? exercise.definition.muscleRoles.primary.filter(text) : null;
      const secondaryRoles = Array.isArray(exercise.definition.muscleRoles?.secondary) ? exercise.definition.muscleRoles.secondary.filter(text) : null;
      const movementPatterns = Array.isArray(exercise.definition.movementPatterns)
        ? exercise.definition.movementPatterns.map(text).filter(pattern => pattern && pattern !== UNKNOWN) : [];
      if (!primaryRoles || !secondaryRoles) notices.push({ code: 'MUSCLE_TAXONOMY_UNKNOWN', exerciseId: exercise.exerciseId });
      if (!movementPatterns.length) notices.push({ code: 'MOVEMENT_TAXONOMY_UNKNOWN', exerciseId: exercise.exerciseId });
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        exposuresPerCycle: exercise.exposures.length,
        workingSetsPerCycle: exercise.workingSets,
        slots: exercise.exposures,
        routineVersionIds: [...exercise.routineVersionIds],
        repTargets: aggregatePrescription(exercise.exposures, 'repTarget'),
        restPrescriptions: aggregatePrescription(exercise.exposures, 'restSeconds'),
        slotDistances: spacingForPositions(positions, slotCount),
        nominalCalendarDayGaps: nominalDaySpacing(positions, slots, calendar)
      };
    });

    const primaryMuscles = new Map();
    const secondaryMuscles = new Map();
    const movementPatterns = new Map();
    const unknownMuscles = new Map();
    exerciseMap.forEach(exercise => {
      const primary = Array.isArray(exercise.definition.muscleRoles?.primary) ? exercise.definition.muscleRoles.primary.filter(text) : null;
      const secondary = Array.isArray(exercise.definition.muscleRoles?.secondary) ? exercise.definition.muscleRoles.secondary.filter(text) : null;
      const patterns = Array.isArray(exercise.definition.movementPatterns)
        ? exercise.definition.movementPatterns.map(text).filter(pattern => pattern && pattern !== UNKNOWN) : [];
      exercise.exposures.forEach(occurrence => {
        (primary || []).forEach(muscle => aggregateCategory(primaryMuscles, muscle, exercise, occurrence));
        (secondary || []).forEach(muscle => aggregateCategory(secondaryMuscles, muscle, exercise, occurrence));
        patterns.forEach(pattern => aggregateCategory(movementPatterns, pattern, exercise, occurrence));
        if (!patterns.length) aggregateCategory(movementPatterns, UNKNOWN, exercise, occurrence);
        if (!primary || !secondary) {
          const current = unknownMuscles.get(exercise.exerciseId) || {
            exerciseId: exercise.exerciseId,
            name: exercise.name,
            workingSets: 0,
            exposures: 0,
            missingRoles: []
          };
          current.workingSets += occurrence.workingSets;
          current.exposures += 1;
          current.missingRoles = orderedUnique([
            ...current.missingRoles,
            ...(!primary ? ['primary'] : []),
            ...(!secondary ? ['secondary'] : [])
          ]);
          unknownMuscles.set(exercise.exerciseId, current);
        }
      });
    });

    const goalById = new Map((Array.isArray(goals) ? goals : []).filter(isRecord).map(goal => [text(goal.goalId), goal]));
    const goalExposure = (programVersion.priorityGoalIds || []).map(goalId => {
      const goal = goalById.get(goalId);
      if (!goal) return { goalId, lifecycle: 'unavailable', exerciseId: null, name: null, representation: 'unknown', exposuresPerCycle: null, workingSetsPerCycle: null, slotPositions: [], slotDistances: null, nominalCalendarDayGaps: null };
      const exerciseId = catalog.canonicalIdFor(goal.exerciseId);
      const definition = exerciseId ? catalog.getById(exerciseId) : null;
      if (goal.status !== 'active') return { goalId, lifecycle: goal.status || 'unknown', exerciseId, name: definition?.name || null, representation: 'inactive_goal', exposuresPerCycle: null, workingSetsPerCycle: null, slotPositions: [], slotDistances: null, nominalCalendarDayGaps: null };
      const exposure = exerciseMap.get(exerciseId);
      if (!exposure) return { goalId, lifecycle: 'active', exerciseId, name: definition?.name || null, representation: 'not_represented', exposuresPerCycle: 0, workingSetsPerCycle: 0, slotPositions: [], slotDistances: [], nominalCalendarDayGaps: null };
      const positions = exposure.exposures.map(item => item.position);
      return {
        goalId,
        lifecycle: 'active',
        exerciseId,
        name: exposure.name,
        representation: 'represented',
        exposuresPerCycle: exposure.exposures.length,
        workingSetsPerCycle: exposure.workingSets,
        slotPositions: positions,
        slotDistances: spacingForPositions(positions, slotCount),
        nominalCalendarDayGaps: nominalDaySpacing(positions, slots, calendar)
      };
    });

    const repTargets = aggregateAllPrescriptions(exerciseExposure, 'repTargets');
    const restTargets = aggregateAllPrescriptions(exerciseExposure, 'restPrescriptions');
    const primaryFinal = finalizeCategories(primaryMuscles);
    const secondaryFinal = finalizeCategories(secondaryMuscles);
    const movementFinal = finalizeCategories(movementPatterns);
    const repeatedRoutines = [...routineSlotCounts.entries()].filter(([, count]) => count > 1).map(([routineVersionId, slotCountUsed]) => ({
      routineVersionId,
      label: versionById.get(routineVersionId).label,
      slotCount: slotCountUsed
    }));
    const sequenceState = blockProgress(programVersion, options, slotCount);
    const result = {
      contract: CONTRACT,
      status: 'available',
      programVersionId: programVersion.programVersionId,
      errors: [],
      notices: notices.sort((left, right) => compareText(left.code, right.code) || compareText(left.exerciseId, right.exerciseId)),
      program: {
        programId: programVersion.programId,
        programVersionId: programVersion.programVersionId,
        versionNumber: Number(programVersion.versionNumber),
        name: programVersion.name
      },
      topology: {
        cadencePolicy: { kind: 'rolling_cycle', advanceOn: 'completed_session' },
        totalSlotsPerCycle: slotCount,
        uniqueRoutineVersionsUsed: routineSlotCounts.size,
        routineSlotCounts: [...routineSlotCounts.entries()].map(([routineVersionId, count]) => ({ routineVersionId, label: versionById.get(routineVersionId).label, count })),
        rollingSequence: slots.map((slot, index) => ({ slotId: slot.slotId, position: index + 1, label: slot.label, routineVersionId: slot.routineVersionId })),
        preferredCalendar: calendar
      },
      exerciseExposure,
      goalExposure,
      muscleExposure: {
        primary: primaryFinal,
        secondary: secondaryFinal,
        unknown: [...unknownMuscles.values()].sort(byNameThenId)
      },
      movementExposure: movementFinal,
      prescriptionSummary: {
        repTargets,
        restSeconds: restTargets,
        categories: 'raw_normalized_ranges_only'
      },
      sessionSpacing: exerciseExposure.map(exercise => ({
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        exposuresPerCycle: exercise.exposuresPerCycle,
        slotPositions: exercise.slots.map(slot => slot.position),
        slotDistances: exercise.slotDistances,
        nominalCalendarDayGaps: exercise.nominalCalendarDayGaps
      })),
      volumeTopology: {
        repeatedExactExercises: exerciseExposure.filter(exercise => exercise.exposuresPerCycle > 1).map(exercise => ({ exerciseId: exercise.exerciseId, name: exercise.name, exposuresPerCycle: exercise.exposuresPerCycle })),
        singleExposureExercises: exerciseExposure.filter(exercise => exercise.exposuresPerCycle === 1).map(exercise => ({ exerciseId: exercise.exerciseId, name: exercise.name })),
        repeatedRoutineVersions: repeatedRoutines,
        primaryMuscleSlotCoverage: primaryFinal.map(muscle => ({ name: muscle.name, exposedSlots: muscle.slotsExposed, totalSlots: slotCount }))
      },
      blockContext: {
        programStatus: options.programStatus || 'unknown',
        definition: {
          boundaryKind: programVersion.blockReviewPolicy.boundaryKind,
          boundaryValue: programVersion.blockReviewPolicy.boundaryValue,
          onBoundary: 'review_required'
        },
        versionStart: {
          startsOn: programVersion.duration.startsOn,
          createdAt: programVersion.createdAt || null,
          effectiveBoundary: {
            kind: programVersion.effectiveBoundary?.kind || null,
            activeWorkoutIdAtAcceptance: programVersion.effectiveBoundary?.activeWorkoutIdAtAcceptance || null
          }
        },
        progress: sequenceState
      }
    };
    return deepFreeze(result);
  }

  function aggregatePrescription(exposures, field) {
    const buckets = new Map();
    exposures.forEach(exposure => {
      const value = exposure[field];
      const key = field === 'repTarget'
        ? `${value.kind}:${value.min ?? ''}:${value.max ?? ''}:${value.text ?? ''}`
        : value == null ? 'unavailable' : String(value);
      if (!buckets.has(key)) buckets.set(key, field === 'repTarget'
        ? { ...value, exposures: 0, workingSets: 0 }
        : { restSeconds: value, exposures: 0, workingSets: 0 });
      const bucket = buckets.get(key);
      bucket.exposures += 1;
      bucket.workingSets += exposure.workingSets;
    });
    return [...buckets.values()].sort((left, right) => {
      const leftValue = field === 'repTarget' ? left.min ?? Number.MAX_SAFE_INTEGER : left.restSeconds ?? Number.MAX_SAFE_INTEGER;
      const rightValue = field === 'repTarget' ? right.min ?? Number.MAX_SAFE_INTEGER : right.restSeconds ?? Number.MAX_SAFE_INTEGER;
      return leftValue - rightValue || compareText(left.text || '', right.text || '');
    });
  }

  function aggregateAllPrescriptions(exercises, field) {
    const buckets = new Map();
    exercises.forEach(exercise => exercise[field].forEach(target => {
      const key = field === 'repTargets'
        ? `${target.kind}:${target.min ?? ''}:${target.max ?? ''}:${target.text ?? ''}`
        : target.restSeconds == null ? 'unavailable' : String(target.restSeconds);
      if (!buckets.has(key)) buckets.set(key, { ...target, exercises: 0, exposures: 0, workingSets: 0 });
      const bucket = buckets.get(key);
      bucket.exercises += 1;
      bucket.exposures += target.exposures;
      bucket.workingSets += target.workingSets;
    }));
    return [...buckets.values()].sort((left, right) => {
      const leftValue = field === 'repTargets' ? left.min ?? Number.MAX_SAFE_INTEGER : left.restSeconds ?? Number.MAX_SAFE_INTEGER;
      const rightValue = field === 'repTargets' ? right.min ?? Number.MAX_SAFE_INTEGER : right.restSeconds ?? Number.MAX_SAFE_INTEGER;
      return leftValue - rightValue || compareText(left.text || '', right.text || '');
    });
  }

  function blockProgress(programVersion, options, slotCount) {
    const sequence = options.sequenceState;
    if (options.programStatus !== 'active' || !isRecord(sequence)
      || sequence.programId !== programVersion.programId
      || sequence.programVersionId !== programVersion.programVersionId
      || !Number.isInteger(Number(sequence.nextSlotIndex))
      || Number(sequence.nextSlotIndex) < 0 || Number(sequence.nextSlotIndex) >= slotCount
      || !Number.isInteger(Number(sequence.completedCycles)) || Number(sequence.completedCycles) < 0) {
      return { availability: 'unavailable', reasonCode: 'EXPLICIT_SEQUENCE_PROGRESS_UNAVAILABLE' };
    }
    const completedCycles = Number(sequence.completedCycles);
    const nextSlotIndex = Number(sequence.nextSlotIndex);
    const progress = {
      availability: 'available',
      completedCycles,
      nextSlotPosition: nextSlotIndex + 1,
      completedSlotsInCurrentCycle: nextSlotIndex,
      remainingSlotsInCurrentCycle: slotCount - nextSlotIndex,
      updatedAt: validDate(sequence.updatedAt) ? new Date(sequence.updatedAt).toISOString() : null,
      boundaryProgress: null
    };
    if (programVersion.blockReviewPolicy.boundaryKind === 'completed_cycles') {
      const boundaryValue = Number(programVersion.blockReviewPolicy.boundaryValue);
      progress.boundaryProgress = {
        completed: completedCycles,
        remaining: Math.max(0, boundaryValue - completedCycles),
        reached: completedCycles >= boundaryValue
      };
    }
    return progress;
  }

  const api = Object.freeze({ analyze, contract: CONTRACT });
  Object.defineProperty(scope, 'BigGainsProgramAnalyzer', { configurable: false, enumerable: true, value: api, writable: false });
})(typeof window === 'object' ? window : globalThis);
