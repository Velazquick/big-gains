(() => {
  const accountRegistry = window.bigGainsAccounts.registry;
  const STORAGE_KEYS = Object.freeze({
    activeProfile: window.bigGainsAccounts.activeSelectionKey,
    ...Object.fromEntries(accountRegistry.accounts.map(account => [account.profileId, account.storageKey])),
    legacy: window.bigGainsAccounts.legacyStateKey
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
  const remove = key => localStorage.removeItem(key);
  const ownedStorageKeys = new Set(Object.values(STORAGE_KEYS).filter(Boolean));

  function requireOwnedStorageKey(key) {
    if (!ownedStorageKeys.has(key)) throw new Error('Unknown Big Gains state storage key.');
    return key;
  }

  const readRawOwnedState = key => read(requireOwnedStorageKey(key));
  const writeRawOwnedState = (key, value) => write(requireOwnedStorageKey(key), value);
  const removeRawOwnedState = key => remove(requireOwnedStorageKey(key));

  function storageKeyForProfile(profileId) {
    return accountRegistry.resolve(profileId)?.storageKey || null;
  }

  function loadActiveProfileId() {
    return accountRegistry.loadActive().profileId;
  }

  function saveActiveProfileId(profileId) {
    return accountRegistry.saveActive(profileId);
  }

  function readProfileSnapshot(profileId) {
    const storageKey = storageKeyForProfile(profileId);
    if (!storageKey) return Object.freeze({ ok: false, reason: 'unknown-profile', profileId });
    let raw;
    try {
      raw = read(storageKey);
    } catch (error) {
      return Object.freeze({ ok: false, reason: 'storage-read-failed', profileId, error: error?.message || String(error) });
    }
    if (raw === null) return Object.freeze({ ok: false, reason: 'missing-local-profile', profileId });
    try {
      const value = JSON.parse(raw);
      return Object.freeze({ ok: true, profileId, storageKey, value });
    } catch {
      return Object.freeze({ ok: false, reason: 'invalid-json', profileId });
    }
  }

  function create({ account, profile, profileConfig, validWorkoutTypes, createId, slug, exerciseCatalog = null }) {
    const ownerAccount = account || accountRegistry.resolve(profile.id);
    if (!ownerAccount) throw new Error(`Unknown account for profile: ${profile.id}`);
    const storageKey = ownerAccount.storageKey;
    const workoutTypes = new Set(validWorkoutTypes);
    const normalizeProgramOrigin = value => window.BigGainsProgramOrigin?.normalize(value, {
      accountId: ownerAccount.accountId,
      profileId: profile.id
    }) || null;

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
        customRoutines: {},
        timerPreferences: { sound: true, vibration: true }
      };
    }

    function normalizeSet(value) {
      if (!isRecord(value)) return null;
      return {
        ...value,
        id: typeof value.id === 'string' && value.id ? value.id : createId(),
        weight: value.weight === '' ? '' : safeNumber(value.weight),
        reps: value.reps === '' ? '' : safeNumber(value.reps),
        ...(Object.hasOwn(value, 'distance') ? { distance: value.distance === '' ? '' : safeNumber(value.distance) } : {}),
        ...(Object.hasOwn(value, 'duration') ? { duration: value.duration === '' ? '' : safeNumber(value.duration) } : {}),
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
      const workout = {
        ...value,
        id: typeof value.id === 'string' && value.id ? value.id : createId(),
        type: value.type,
        startedAt: validDate(value.startedAt) ? value.startedAt : value.completedAt,
        completedAt: value.completedAt,
        durationSeconds: safeNumber(value.durationSeconds),
        prs: safeNumber(value.prs),
        exercises: Array.isArray(value.exercises) ? value.exercises.map(normalizeExercise).filter(Boolean) : []
      };
      if (value.entryMethod === 'retrospective') workout.entryMethod = 'retrospective';
      else delete workout.entryMethod;
      const programOrigin = normalizeProgramOrigin(value.programOrigin);
      if (programOrigin) workout.programOrigin = programOrigin;
      else delete workout.programOrigin;
      return workout;
    }

    function normalizeActiveWorkout(value) {
      if (!isRecord(value)
        || typeof value.type !== 'string'
        || !workoutTypes.has(value.type)
        || !validDate(value.startedAt)) return null;
      const workout = {
        ...value,
        id: typeof value.id === 'string' && value.id ? value.id : createId(),
        type: value.type,
        startedAt: value.startedAt,
        exercises: Array.isArray(value.exercises) ? value.exercises.map(normalizeExercise).filter(Boolean) : []
      };
      const programOrigin = normalizeProgramOrigin(value.programOrigin);
      if (programOrigin) workout.programOrigin = programOrigin;
      else delete workout.programOrigin;
      return workout;
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
        .map(([day, routine]) => {
          const seen = new Set();
          const entries = routine.map(entry => {
            if (typeof entry === 'string' && entry) return entry;
            if (!isRecord(entry) || typeof entry.exerciseId !== 'string' || !entry.exerciseId) return null;
            const workingSets = Math.min(12, Math.max(1, Math.round(safeNumber(entry.workingSets, 3))));
            const targetReps = typeof entry.targetReps === 'string' ? entry.targetReps.trim().slice(0, 20) : '';
            return { exerciseId: entry.exerciseId, workingSets, targetReps };
          }).filter(entry => {
            if (!entry) return false;
            const exerciseId = typeof entry === 'string' ? entry : entry.exerciseId;
            if (seen.has(exerciseId)) return false;
            seen.add(exerciseId);
            return true;
          });
          return [day, entries];
        }));
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
      if ('strengthGoals' in value) {
        const statuses = new Set(['active', 'paused', 'completed', 'archived']);
        const bases = new Set(['entered_load', 'combined_external_load']);
        goals.strengthGoals = Array.isArray(value.strengthGoals) ? value.strengthGoals.map(goal => {
          if (!isRecord(goal)
            || typeof goal.goalId !== 'string' || !goal.goalId
            || goal.profileId !== profile.id
            || goal.accountId !== ownerAccount.accountId
            || typeof goal.exerciseId !== 'string' || !goal.exerciseId
            || goal.metric !== 'one_rep_max'
            || !Number.isFinite(Number(goal.targetValue)) || Number(goal.targetValue) <= 0
            || goal.unit !== 'lb'
            || !bases.has(goal.targetBasis)
            || !statuses.has(goal.status)
            || !validDate(goal.createdAt)
            || !validDate(goal.updatedAt)) return null;
          const normalized = {
            goalId: goal.goalId,
            accountId: ownerAccount.accountId,
            profileId: profile.id,
            exerciseId: goal.exerciseId,
            ...(typeof goal.legacyExerciseId === 'string' && goal.legacyExerciseId ? { legacyExerciseId: goal.legacyExerciseId } : {}),
            metric: 'one_rep_max',
            targetValue: Number(goal.targetValue),
            unit: 'lb',
            targetBasis: goal.targetBasis,
            targetDate: typeof goal.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate) && validDate(goal.targetDate) ? goal.targetDate : null,
            label: typeof goal.label === 'string' ? goal.label.trim().slice(0, 80) : '',
            status: goal.status,
            guidanceEnabled: goal.status === 'active' && goal.guidanceEnabled === true,
            policy: {
              id: goal.policy?.id === 'strength_double_progression_v1' ? goal.policy.id : 'strength_double_progression_v1',
              version: 1
            },
            createdAt: goal.createdAt,
            updatedAt: goal.updatedAt
          };
          ['pausedAt', 'resumedAt', 'completedAt', 'archivedAt'].forEach(field => {
            if (validDate(goal[field])) normalized[field] = goal[field];
          });
          if (goal.attainmentState === 'achieved') normalized.attainmentState = 'achieved';
          if (isRecord(goal.attainmentEvidence)
            && typeof goal.attainmentEvidence.workoutId === 'string'
            && typeof goal.attainmentEvidence.setId === 'string') {
            normalized.attainmentEvidence = {
              workoutId: goal.attainmentEvidence.workoutId,
              setId: goal.attainmentEvidence.setId,
              ...(validDate(goal.attainmentEvidence.date) ? { date: goal.attainmentEvidence.date } : {}),
              load: safeNumber(goal.attainmentEvidence.load),
              reps: 1
            };
          }
          const progression = goal.progressionState;
          const normalizeDecision = decision => {
            if (!isRecord(decision)
              || typeof decision.decisionId !== 'string' || !decision.decisionId
              || !validDate(decision.issuedAt)
              || !validDate(decision.evidenceCutoff)
              || decision.exerciseId !== normalized.exerciseId
              || !Number.isFinite(Number(decision.enteredLoad)) || Number(decision.enteredLoad) <= 0
              || decision.unit !== normalized.unit
              || decision.loadBasis !== normalized.targetBasis
              || !Number.isInteger(Number(decision.workingSetCount))
              || Number(decision.workingSetCount) < 1 || Number(decision.workingSetCount) > 12
              || !Array.isArray(decision.repTargets)
              || decision.repTargets.length !== Number(decision.workingSetCount)
              || decision.repTargets.some(rep => !Number.isInteger(Number(rep)) || Number(rep) < 1)) return null;
            return {
              decisionId: decision.decisionId,
              issuedAt: decision.issuedAt,
              evidenceCutoff: decision.evidenceCutoff,
              exerciseId: normalized.exerciseId,
              enteredLoad: Number(decision.enteredLoad),
              unit: normalized.unit,
              loadBasis: normalized.targetBasis,
              workingSetCount: Number(decision.workingSetCount),
              repTargets: decision.repTargets.map(Number),
              ...(isRecord(decision.repRange)
                && Number.isInteger(Number(decision.repRange.min))
                && Number.isInteger(Number(decision.repRange.max))
                && Number(decision.repRange.min) > 0
                && Number(decision.repRange.min) <= Number(decision.repRange.max)
                ? { repRange: { min: Number(decision.repRange.min), max: Number(decision.repRange.max) } }
                : {}),
              decisionCode: typeof decision.decisionCode === 'string' ? decision.decisionCode : 'HOLD',
              reasonCode: typeof decision.reasonCode === 'string' ? decision.reasonCode : 'EVIDENCE_UNAVAILABLE',
              explanation: typeof decision.explanation === 'string' ? decision.explanation.slice(0, 1000) : '',
              policy: { id: 'strength_double_progression_v1', version: 1 },
              selectedExposureIds: Array.isArray(decision.selectedExposureIds) ? decision.selectedExposureIds.filter(id => typeof id === 'string' && id).slice(0, 3) : [],
              attainmentState: ['in_progress', 'estimated_reached', 'achieved'].includes(decision.attainmentState) ? decision.attainmentState : 'in_progress'
            };
          };
          const currentDecision = normalizeDecision(progression?.current);
          if (currentDecision) {
            const trace = Array.isArray(progression.trace) ? progression.trace.map(normalizeDecision).filter(Boolean).slice(0, 8) : [];
            normalized.progressionState = {
              current: currentDecision,
              trace: [currentDecision, ...trace.filter(item => item.decisionId !== currentDecision.decisionId)].slice(0, 8)
            };
          }
          return normalized;
        }).filter(Boolean) : [];
      }
      return goals;
    }

    function normalizeTimerPreferences(value) {
      return {
        sound: !isRecord(value) || value.sound !== false,
        vibration: !isRecord(value) || value.vibration !== false
      };
    }

    function normalizeState(value, profileId = profile.id) {
      const defaults = blankState(profileId);
      const saved = isRecord(value) ? value : {};
      return {
        ...defaults,
        ...saved,
        version: 5,
        profileId,
        goals: normalizeGoals(saved.goals),
        workouts: Array.isArray(saved.workouts) ? saved.workouts.map(normalizeWorkout).filter(Boolean) : [],
        weights: normalizeWeights(saved.weights),
        prs: normalizePrs(saved.prs),
        activeWorkout: normalizeActiveWorkout(saved.activeWorkout),
        customRoutines: normalizeCustomRoutines(saved.customRoutines),
        ...(Object.hasOwn(saved, 'programCapture') ? {
          programCapture: window.BigGainsProgramModel.normalizeCapture(saved.programCapture, {
            accountId: ownerAccount.accountId,
            profileId,
            catalog: exerciseCatalog
          })
        } : {}),
        timerPreferences: normalizeTimerPreferences(saved.timerPreferences),
        restTimerEndsAt: Number.isFinite(saved.restTimerEndsAt) && saved.restTimerEndsAt > 0
          ? saved.restTimerEndsAt
          : null
      };
    }

    function migrateLegacyV1(value) {
      // big-gains-v1 workout records never had a documented schema. Keep the
      // source payload untouched and import only weights that normalize cleanly.
      return normalizeState({
        ...blankState(),
        weights: isRecord(value) && Array.isArray(value.weights) ? value.weights : []
      });
    }

    function load() {
      try {
        const saved = JSON.parse(read(storageKey));
        if (saved) return normalizeState(saved);
        if (ownerAccount.legacyStateKey) {
          const legacy = JSON.parse(read(ownerAccount.legacyStateKey));
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

    function hasStoredState() {
      try { return read(storageKey) !== null; } catch { return false; }
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
      accountId: ownerAccount.accountId,
      account: ownerAccount,
      storageKey,
      blankState,
      normalizeState,
      hasStoredState,
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
    readProfileSnapshot,
    readRawOwnedState,
    writeRawOwnedState,
    removeRawOwnedState,
    loadActiveProfileId,
    saveActiveProfileId,
    create
  });
})();
