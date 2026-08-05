(() => {
  const STORAGE_KEYS = Object.freeze({
    activeProfile: 'big-gains-active-profile',
    alexa: 'big-gains-alexa-v1',
    jorge: 'big-gains-v2',
    legacy: 'big-gains-v1'
  });

  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const validDate = value => (typeof value === 'string' || typeof value === 'number')
    && Number.isFinite(new Date(value).getTime());
  const safeNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  };
  const read = key => localStorage.getItem(key);
  const write = (key, value) => localStorage.setItem(key, value);

  function storageKeyForProfile(profileId) {
    return STORAGE_KEYS[profileId] || null;
  }

  function loadActiveProfileId() {
    return read(STORAGE_KEYS.activeProfile) === 'alexa' ? 'alexa' : 'jorge';
  }

  function saveActiveProfileId(profileId) {
    write(STORAGE_KEYS.activeProfile, profileId);
  }

  function create({ profile, profileConfig, validWorkoutTypes, createId, slug }) {
    const storageKey = storageKeyForProfile(profile.id);
    const workoutTypes = new Set(validWorkoutTypes);

    function blankState(profileId = profile.id) {
      const owner = profileConfig[profileId] || profile;
      return {
        version: 5,
        profileId,
        goals: { ...owner.goals },
        workouts: [],
        weights: [],
        prs: {},
        activeWorkout: null,
        restTimerEndsAt: null,
        customRoutines: {}
      };
    }

    function normalizeSet(value) {
      if (!isRecord(value)) return null;
      return {
        ...value,
        id: typeof value.id === 'string' && value.id ? value.id : createId(),
        weight: value.weight === '' ? '' : safeNumber(value.weight),
        reps: value.reps === '' ? '' : safeNumber(value.reps),
        warmup: value.warmup === true,
        completed: value.completed === true
      };
    }

    function normalizeExercise(value) {
      if (!isRecord(value) || typeof value.name !== 'string' || !value.name.trim()) return null;
      return {
        ...value,
        id: typeof value.id === 'string' && value.id ? value.id : slug(value.name),
        name: value.name,
        muscle: typeof value.muscle === 'string' ? value.muscle : '',
        equipment: typeof value.equipment === 'string' ? value.equipment : '',
        sets: Array.isArray(value.sets) ? value.sets.map(normalizeSet).filter(Boolean) : [],
        collapsed: typeof value.collapsed === 'boolean' ? value.collapsed : true
      };
    }

    function normalizeWorkout(value) {
      if (!isRecord(value) || typeof value.type !== 'string' || !value.type || !validDate(value.completedAt)) return null;
      return {
        ...value,
        id: typeof value.id === 'string' && value.id ? value.id : createId(),
        type: value.type,
        startedAt: validDate(value.startedAt) ? value.startedAt : value.completedAt,
        completedAt: value.completedAt,
        durationSeconds: safeNumber(value.durationSeconds),
        prs: safeNumber(value.prs),
        exercises: Array.isArray(value.exercises) ? value.exercises.map(normalizeExercise).filter(Boolean) : []
      };
    }

    function normalizeActiveWorkout(value) {
      if (!isRecord(value)
        || typeof value.type !== 'string'
        || !workoutTypes.has(value.type)
        || !validDate(value.startedAt)) return null;
      return {
        ...value,
        id: typeof value.id === 'string' && value.id ? value.id : createId(),
        type: value.type,
        startedAt: value.startedAt,
        exercises: Array.isArray(value.exercises) ? value.exercises.map(normalizeExercise).filter(Boolean) : []
      };
    }

    function normalizeWeights(value) {
      if (!Array.isArray(value)) return [];
      return value
        .filter(entry => isRecord(entry)
          && Number.isFinite(Number(entry.weight))
          && Number(entry.weight) >= 0
          && validDate(entry.date))
        .map(entry => ({ ...entry, weight: Number(entry.weight) }));
    }

    function normalizePrs(value) {
      if (!isRecord(value)) return {};
      return Object.fromEntries(Object.entries(value)
        .filter(([, entry]) => isRecord(entry))
        .map(([id, entry]) => [id, {
          ...entry,
          exercise: typeof entry.exercise === 'string' ? entry.exercise : '',
          estimated1RM: safeNumber(entry.estimated1RM),
          weight: safeNumber(entry.weight),
          reps: safeNumber(entry.reps),
          date: validDate(entry.date) ? entry.date : null
        }]));
    }

    function normalizeCustomRoutines(value) {
      if (!isRecord(value)) return {};
      return Object.fromEntries(Object.entries(value)
        .filter(([, routine]) => Array.isArray(routine))
        .map(([day, routine]) => [day, [...new Set(routine.filter(id => typeof id === 'string' && id))]]));
    }

    function normalizeGoals(value) {
      const defaults = { ...profile.goals };
      if (!isRecord(value)) return defaults;
      const goals = { ...defaults, ...value };
      goals.primary = typeof value.primary === 'string' && value.primary ? value.primary : defaults.primary;
      if ('secondary' in value) {
        if (Array.isArray(value.secondary)) goals.secondary = value.secondary.filter(goal => typeof goal === 'string' && goal);
        else if (Array.isArray(defaults.secondary)) goals.secondary = [...defaults.secondary];
        else delete goals.secondary;
      }
      if ('startingWeight' in value) {
        if (Number.isFinite(Number(value.startingWeight)) && Number(value.startingWeight) >= 0) goals.startingWeight = Number(value.startingWeight);
        else if ('startingWeight' in defaults) goals.startingWeight = defaults.startingWeight;
        else delete goals.startingWeight;
      }
      if ('targetDate' in value) {
        if (typeof value.targetDate === 'string' && validDate(value.targetDate)) goals.targetDate = value.targetDate;
        else if ('targetDate' in defaults) goals.targetDate = defaults.targetDate;
        else delete goals.targetDate;
      }
      return goals;
    }

    function normalizeState(value, profileId = profile.id) {
      const defaults = blankState(profileId);
      const saved = isRecord(value) ? value : {};
      return {
        ...defaults,
        ...saved,
        profileId,
        goals: normalizeGoals(saved.goals),
        workouts: Array.isArray(saved.workouts) ? saved.workouts.map(normalizeWorkout).filter(Boolean) : [],
        weights: normalizeWeights(saved.weights),
        prs: normalizePrs(saved.prs),
        activeWorkout: normalizeActiveWorkout(saved.activeWorkout),
        customRoutines: normalizeCustomRoutines(saved.customRoutines),
        restTimerEndsAt: Number.isFinite(saved.restTimerEndsAt) && saved.restTimerEndsAt > 0
          ? saved.restTimerEndsAt
          : null
      };
    }

    function migrateLegacyV1(value) {
      return normalizeState({
        ...blankState(),
        weights: isRecord(value) ? value.weights || [] : [],
        workouts: []
      });
    }

    function load() {
      try {
        const saved = JSON.parse(read(storageKey));
        if (saved) return normalizeState(saved);
        if (profile.id === 'jorge') {
          const legacy = JSON.parse(read(STORAGE_KEYS.legacy));
          if (legacy) {
            const migrated = migrateLegacyV1(legacy);
            write(storageKey, JSON.stringify(migrated));
            return migrated;
          }
        }
      } catch (error) {
        console.warn('Could not load Big Gains data', error);
      }
      return blankState();
    }

    function save(value, activeWorkout = value.activeWorkout) {
      value.activeWorkout = activeWorkout;
      write(storageKey, JSON.stringify(value));
      return value;
    }

    function prepareExport(value) {
      return {
        filename: `big-gains-backup-${new Date().toISOString().slice(0, 10)}.json`,
        json: JSON.stringify(value, null, 2)
      };
    }

    function validateImport(value) {
      if (!isRecord(value) || !Array.isArray(value.workouts) || !Array.isArray(value.weights)) {
        return { ok: false, reason: 'invalid' };
      }
      if (value.profileId !== profile.id) {
        return {
          ok: false,
          reason: 'profile-mismatch',
          profileId: value.profileId,
          profileName: profileConfig[value.profileId]?.name || 'another profile'
        };
      }
      return { ok: true, state: normalizeState(value, value.profileId) };
    }

    return Object.freeze({
      profileId: profile.id,
      storageKey,
      blankState,
      normalizeState,
      load,
      save,
      prepareExport,
      validateImport,
      migrations: Object.freeze({ legacyV1: migrateLegacyV1 })
    });
  }

  window.bigGainsStatePersistence = Object.freeze({
    storageKeys: STORAGE_KEYS,
    storageKeyForProfile,
    loadActiveProfileId,
    saveActiveProfileId,
    create
  });
})();
