((scope) => {
  'use strict';

  const STANDARD_LIBRARY_TYPES = Object.freeze(['Push', 'Pull', 'Legs', 'Core', 'FullBody', 'Cardio', 'Other']);

  function freezeValue(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(freezeValue);
    return Object.freeze(value);
  }

  function copyEntry(entry) {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return entry;
    return {
      ...entry,
      ...(Array.isArray(entry.alternatives) ? { alternatives: [...entry.alternatives] } : {})
    };
  }

  function copyRoutine(routine) {
    return {
      ...routine,
      exercises: Array.isArray(routine?.exercises) ? routine.exercises.map(copyEntry) : []
    };
  }

  function sharedDefaults(profile) {
    return {
      Push: { label: profile.routineLabels?.Push || 'Push', exercises: ['Seated Machine Chest Press', 'Incline Iso Machine Press', 'Iso Machine Shoulder Press', 'Seated Pec Deck', 'Triceps Pushdown', 'Overhead Triceps Extension'] },
      Pull: { label: profile.routineLabels?.Pull || 'Pull — Back + Biceps', exercises: ['Lat Pulldown', 'Seated Cable Row', 'Chest-Supported Row', 'Reverse Pec Deck', 'Dumbbell Curl', 'Hammer Curl'] },
      Legs: { label: profile.routineLabels?.Legs || 'Legs + Core', exercises: ['Leg Press', 'Leg Extension', 'Seated Leg Curl', 'Romanian Deadlift', 'Standing Calf Raise', 'Cable Crunch', 'Hanging Knee Raise'] },
      Core: { label: 'Core', exercises: ['Cable Crunch', 'Hanging Knee Raise', 'Hanging Leg Raise', 'Ab Wheel Rollout', 'Plank', 'Side Plank', 'Pallof Press', 'Machine Crunch', 'Russian Twist', 'Dead Bug'] },
      Cardio: { label: 'Conditioning', exercises: ['Treadmill Run'] },
      FullBody: { label: 'Full Body', exercises: ['Seated Machine Chest Press', 'Dumbbell Shoulder Press', 'Lat Pulldown', 'Triceps Pushdown', 'Dumbbell Lateral Raise', 'Hack Squat', 'Leg Extension', 'Standing Calf Raise'] },
      Other: { label: 'Blank workout', exercises: [] },
      PilatesPull: { label: 'Pilates + Pull', exercises: ['Lat Pulldown', 'Seated Cable Row', 'Chest-Supported Row', 'Face Pull', 'Dumbbell Curl'] },
      LegsLowImpact: { label: 'Legs + Low-Impact Class', exercises: ['Hip Thrust', 'Romanian Deadlift', 'Bulgarian Split Squat', 'Leg Press', 'Seated Leg Curl', 'Hip Abductor'] },
      PilatesCardioAccessory: { label: 'Pilates + Cardio + Accessories', exercises: ['Incline Walk', 'Dumbbell Lateral Raise', 'Face Pull', 'Cable Pull-Through', 'Pallof Press'] },
      Optional: { label: 'Optional Movement', exercises: ['Incline Walk', 'Glute Bridge', 'Face Pull', 'Dead Bug'] }
    };
  }

  function create({ profile, exerciseCatalog, getState, getVariantSelections = () => ({}) }) {
    if (!profile || !exerciseCatalog || typeof exerciseCatalog.idForName !== 'function' || typeof getState !== 'function') {
      throw new TypeError('RoutineEngine requires profile, ExerciseCatalog, and a live state getter.');
    }

    const shared = sharedDefaults(profile);
    const defaults = profile.routines
      ? { ...Object.fromEntries(Object.entries(profile.routines).map(([type, routine]) => [type, copyRoutine(routine)])), Other: copyRoutine(shared.Other) }
      : Object.fromEntries(Object.entries(shared).map(([type, routine]) => [type, copyRoutine(routine)]));
    const defaultRoutines = freezeValue(defaults);
    const libraryRoutineTypes = Object.freeze([...(profile.libraryRoutineTypes || STANDARD_LIBRARY_TYPES)]);

    function customFor(type) {
      return getState()?.customRoutines?.[type];
    }

    function entryId(entry) {
      return typeof entry === 'string' ? entry : entry?.exerciseId;
    }

    function getEntries(type, { allAlternatives = false } = {}) {
      const entries = defaultRoutines[type]?.exercises || [];
      const selections = getVariantSelections() || {};
      return entries.flatMap(entry => {
        if (typeof entry === 'string') return [{ name: entry }];
        if (!entry?.alternatives?.length) return [{ ...entry }];
        if (allAlternatives) return entry.alternatives.map(name => ({ ...entry, name, alternatives: undefined }));
        const name = entry.alternatives.includes(selections[type]) ? selections[type] : entry.name;
        return [{ ...entry, name, alternatives: undefined }];
      });
    }

    function getRoutine(type) {
      const custom = customFor(type);
      const entries = Array.isArray(custom)
        ? custom
        : getEntries(type).map(entry => exerciseCatalog.idForName(entry.name));
      return entries.map(entryId).filter(id => typeof id === 'string' && id);
    }

    function getPrescription(type, exerciseId) {
      const custom = customFor(type);
      const customEntry = Array.isArray(custom) ? custom.find(entry => entryId(entry) === exerciseId) : null;
      if (customEntry && typeof customEntry === 'object') {
        return {
          workingSets: Number(customEntry.workingSets) || 3,
          targetReps: typeof customEntry.targetReps === 'string' ? customEntry.targetReps : ''
        };
      }
      const entry = getEntries(type, { allAlternatives: true })
        .find(item => exerciseCatalog.idForName(item.name) === exerciseId);
      return entry && (entry.workingSets !== undefined || entry.targetReps !== undefined)
        ? { workingSets: Number(entry.workingSets) || 3, targetReps: typeof entry.targetReps === 'string' ? entry.targetReps : '' }
        : null;
    }

    function getDraft(type) {
      const custom = customFor(type);
      const source = Array.isArray(custom) ? custom : getRoutine(type);
      return source.map(entry => {
        const exerciseId = entryId(entry);
        if (!exerciseId) return null;
        if (entry && typeof entry === 'object') {
          return {
            exerciseId,
            workingSets: Math.min(12, Math.max(1, Math.round(Number(entry.workingSets) || 3))),
            targetReps: typeof entry.targetReps === 'string' ? entry.targetReps : ''
          };
        }
        const prescription = getPrescription(type, exerciseId);
        return {
          exerciseId,
          workingSets: Number(prescription?.workingSets) || 3,
          targetReps: typeof prescription?.targetReps === 'string' ? prescription.targetReps : ''
        };
      }).filter(Boolean);
    }

    function getVariant(type) {
      const entry = (defaultRoutines[type]?.exercises || [])
        .find(item => typeof item === 'object' && item?.alternatives?.length);
      if (!entry) return null;
      const selections = getVariantSelections() || {};
      const selectedName = entry.alternatives.includes(selections[type]) ? selections[type] : entry.name;
      return {
        choices: entry.alternatives.map(name => ({ id: exerciseCatalog.idForName(name), name })),
        selectedId: exerciseCatalog.idForName(selectedName)
      };
    }

    function resolveVariantSelection(type, exerciseId) {
      return getVariant(type)?.choices.find(choice => choice.id === exerciseId)?.name || null;
    }

    function getLabel(type) {
      return `${defaultRoutines[type]?.label || type}${customFor(type) ? ' · Custom' : ''}`;
    }

    function hasRoutine(type) {
      return Boolean(defaultRoutines[type]);
    }

    return Object.freeze({
      defaultRoutines,
      libraryRoutineTypes,
      getDraft,
      getEntries,
      getLabel,
      getPrescription,
      getRoutine,
      getVariant,
      hasRoutine,
      resolveVariantSelection
    });
  }

  const api = Object.freeze({ create });
  Object.defineProperty(scope, 'BigGainsRoutineEngine', { value: api, enumerable: true });
  Object.defineProperty(scope, 'bigGainsRoutineEngine', { value: api, enumerable: true });
})(window);
