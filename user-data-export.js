((scope) => {
  'use strict';

  const FORMAT = 'big-gains.user-export.v1';
  const VERSION = 1;
  const CSV_HEADERS = Object.freeze([
    'Workout date',
    'Workout completed at',
    'Workout name',
    'Entry method',
    'Workout note',
    'Exercise order',
    'Exercise',
    'Canonical exercise ID',
    'Set number',
    'Set type',
    'Measurement',
    'Load entered',
    'Load unit',
    'Load meaning',
    'Reps',
    'Duration',
    'Duration unit',
    'Distance',
    'Distance unit',
    'Exercise note',
    'Set note',
    'Program',
    'Program version',
    'Program slot'
  ]);
  const TRACKING_LABELS = Object.freeze({
    load_reps: 'Load + reps',
    reps_only: 'Reps only',
    assistance_reps: 'Assistance + reps',
    duration: 'Duration',
    distance_duration: 'Distance + duration',
    load_duration: 'Load + duration',
    load_distance: 'Load + distance',
    distance_only: 'Distance'
  });
  const RESISTANCE_LABELS = Object.freeze({
    external: 'External load',
    machine_indicated: 'Machine-indicated load',
    bodyweight_plus_external: 'Added load',
    assistance: 'Assistance',
    bodyweight_only: 'Bodyweight',
    not_applicable: 'Not applicable',
    unknown: 'Entered load'
  });
  const BASIS_LABELS = Object.freeze({
    total: 'total',
    per_hand: 'per hand',
    per_side: 'per side',
    unknown: 'basis not specified'
  });
  const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  const list = value => Array.isArray(value) ? value : [];
  const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const text = value => typeof value === 'string' ? value : '';
  const cleanText = value => text(value).trim();
  const finite = value => Number.isFinite(Number(value));
  const validDate = value => Number.isFinite(Date.parse(value));
  const iso = value => validDate(value) ? new Date(value).toISOString() : null;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const compareText = (left, right) => {
    const first = String(left || '');
    const second = String(right || '');
    return first < second ? -1 : first > second ? 1 : 0;
  };
  const byChronology = (dateField, idField) => (left, right) => {
    const time = Date.parse(left?.[dateField]) - Date.parse(right?.[dateField]);
    return time || compareText(left?.[idField], right?.[idField]);
  };
  const fieldFor = (measurement, name) => inputFields(measurement).find(field => field.name === name) || null;

  function inputFields(measurement) {
    const model = measurement?.trackingModel || 'load_reps';
    const ui = measurement?.ui || {};
    const fields = [];
    if (['load_reps', 'assistance_reps', 'load_duration', 'load_distance'].includes(model)) {
      fields.push({ name: 'weight', unit: ui.loadUnit || 'lb' });
    }
    if (['load_reps', 'reps_only', 'assistance_reps'].includes(model)) fields.push({ name: 'reps', unit: '' });
    if (['distance_duration', 'load_distance', 'distance_only'].includes(model)) fields.push({ name: 'distance', unit: ui.distanceUnit || '' });
    if (['duration', 'distance_duration', 'load_duration'].includes(model)) fields.push({ name: 'duration', unit: ui.durationUnit || 'sec' });
    return fields;
  }

  function safeName(displayName) {
    const source = cleanText(displayName);
    if (!source || source.includes('@')) return 'profile';
    const slug = source.normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    return slug || 'profile';
  }

  function csvCell(value) {
    const string = value == null ? '' : String(value);
    return /[",\r\n]/.test(string) ? `"${string.replace(/"/g, '""')}"` : string;
  }

  function catalogDefinition(catalog, exercise) {
    return catalog?.definitionFor?.(exercise) || null;
  }

  function identity(catalog, exercise) {
    const definition = catalogDefinition(catalog, exercise);
    return {
      canonicalExerciseId: definition?.canonicalId || catalog?.canonicalIdFor?.(exercise) || null,
      exerciseName: definition?.name || cleanText(exercise?.name) || 'Unnamed exercise',
      equipment: definition?.equipment || cleanText(exercise?.equipment) || null,
      measurement: definition?.measurement || catalog?.measurementFor?.(exercise) || null
    };
  }

  function loadMeaning(measurement) {
    const semantics = measurement?.loadSemantics || {};
    const resistance = RESISTANCE_LABELS[semantics.resistanceSemantics] || 'Entered load';
    if (semantics.resistanceSemantics === 'bodyweight_only' || semantics.resistanceSemantics === 'not_applicable') return resistance;
    const basis = BASIS_LABELS[semantics.loadBasis] || cleanText(semantics.loadBasis).replace(/_/g, ' ') || 'basis not specified';
    return `${resistance} — ${basis}`;
  }

  function completedWorkouts(state) {
    return list(state?.workouts)
      .filter(workout => record(workout) && validDate(workout.completedAt))
      .slice()
      .sort(byChronology('completedAt', 'id'));
  }

  function workoutName(workout, workoutLabel) {
    const stored = cleanText(workout?.type) || 'Workout';
    if (typeof workoutLabel !== 'function') return stored;
    try { return cleanText(workoutLabel(stored)) || stored; } catch { return stored; }
  }

  function completedSets(exercise) {
    return list(exercise?.sets).filter(set => record(set) && set.completed === true);
  }

  function refMap(values, idField, prefix) {
    return new Map(values.map((value, index) => [cleanText(value?.[idField]), `${prefix}-${index + 1}`]).filter(([id]) => id));
  }

  function buildReferences(workouts, goals, capture) {
    const workoutRefs = refMap(workouts, 'id', 'workout');
    const setRefs = new Map();
    workouts.forEach(workout => {
      let ordinal = 0;
      list(workout.exercises).forEach(exercise => completedSets(exercise).forEach(set => {
        ordinal += 1;
        if (cleanText(set.id)) setRefs.set(cleanText(set.id), `${workoutRefs.get(cleanText(workout.id)) || 'workout'}-set-${ordinal}`);
      }));
    });
    const orderedGoals = list(goals).slice().sort(byChronology('createdAt', 'goalId'));
    const routines = list(capture?.routines).slice().sort(byChronology('createdAt', 'routineId'));
    const routineVersions = list(capture?.routineVersions).slice().sort((left, right) =>
      compareText(left?.routineId, right?.routineId) || Number(left?.versionNumber || 0) - Number(right?.versionNumber || 0) || compareText(left?.routineVersionId, right?.routineVersionId));
    const programs = list(capture?.programs).slice().sort(byChronology('createdAt', 'programId'));
    const programVersions = list(capture?.programVersions).slice().sort((left, right) =>
      compareText(left?.programId, right?.programId) || Number(left?.versionNumber || 0) - Number(right?.versionNumber || 0) || compareText(left?.programVersionId, right?.programVersionId));
    return {
      workoutRefs,
      setRefs,
      orderedGoals,
      routines,
      routineVersions,
      programs,
      programVersions,
      goalRefs: refMap(orderedGoals, 'goalId', 'goal'),
      routineRefs: refMap(routines, 'routineId', 'routine'),
      routineVersionRefs: refMap(routineVersions, 'routineVersionId', 'routine-version'),
      programRefs: refMap(programs, 'programId', 'program'),
      programVersionRefs: refMap(programVersions, 'programVersionId', 'program-version')
    };
  }

  function programContext(workout, refs) {
    const origin = record(workout?.programOrigin) ? workout.programOrigin : null;
    if (!origin) return null;
    const version = refs.programVersions.find(item => item.programVersionId === origin.programVersionId);
    const program = refs.programs.find(item => item.programId === origin.programId);
    const slot = version?.slots?.[Number(origin.slotIndex)];
    if (!version || !program || !slot || slot.slotId !== origin.slotId) return null;
    return {
      programRef: refs.programRefs.get(program.programId) || null,
      programVersionRef: refs.programVersionRefs.get(version.programVersionId) || null,
      name: version.name,
      version: version.versionNumber,
      slot: slot.label,
      slotNumber: Number(origin.slotIndex) + 1,
      cycleNumber: finite(origin.cycleNumber) ? Number(origin.cycleNumber) : null
    };
  }

  function workoutRows(workouts, catalog, refs, workoutLabel) {
    const rows = [];
    workouts.forEach(workout => {
      const program = programContext(workout, refs);
      list(workout.exercises).forEach((exercise, exerciseIndex) => {
        const resolved = identity(catalog, exercise);
        const measurement = resolved.measurement || {};
        const fields = inputFields(measurement);
        const has = name => fields.some(field => field.name === name);
        const loadUnit = fieldFor(measurement, 'weight')?.unit || '';
        const durationUnit = fieldFor(measurement, 'duration')?.unit || '';
        const distanceUnit = fieldFor(measurement, 'distance')?.unit || '';
        let completedOrdinal = 0;
        completedSets(exercise).forEach(set => {
          completedOrdinal += 1;
          rows.push([
            new Date(workout.completedAt).toISOString().slice(0, 10),
            new Date(workout.completedAt).toISOString(),
            workoutName(workout, workoutLabel),
            workout.entryMethod === 'retrospective' ? 'Entered later' : 'Logged live',
            text(workout.note),
            exerciseIndex + 1,
            resolved.exerciseName,
            resolved.canonicalExerciseId,
            completedOrdinal,
            set.warmup === true ? 'Warm-up' : 'Working',
            TRACKING_LABELS[measurement.trackingModel] || cleanText(measurement.trackingModel).replace(/_/g, ' ') || 'Load + reps',
            has('weight') && finite(set.weight) ? Number(set.weight) : '',
            has('weight') ? loadUnit : '',
            has('weight') ? loadMeaning(measurement) : '',
            has('reps') && finite(set.reps) ? Number(set.reps) : '',
            has('duration') && finite(set.duration ?? set.durationSeconds) ? Number(set.duration ?? set.durationSeconds) : '',
            has('duration') ? durationUnit : '',
            has('distance') && finite(set.distance) ? Number(set.distance) : '',
            has('distance') ? distanceUnit : '',
            text(exercise.note),
            text(set.note),
            program?.name || '',
            program?.version || '',
            program?.slot || ''
          ]);
        });
      });
    });
    return rows;
  }

  function setJson(set, exercise, catalog, refs, workoutRef, ordinal) {
    const resolved = identity(catalog, exercise);
    const measurement = resolved.measurement || {};
    const fields = inputFields(measurement);
    const has = name => fields.some(field => field.name === name);
    const result = {
      setRef: refs.setRefs.get(cleanText(set.id)) || `${workoutRef}-set-${ordinal}`,
      setNumber: ordinal,
      setType: set.warmup === true ? 'warmup' : 'working',
      measurement: {
        trackingModel: measurement.trackingModel || 'load_reps',
        loadMeaning: has('weight') ? loadMeaning(measurement) : null,
        repSemantics: measurement.repSemantics || null,
        laterality: measurement.laterality || null
      },
      entered: {
        load: has('weight') && finite(set.weight) ? Number(set.weight) : null,
        loadUnit: has('weight') ? fieldFor(measurement, 'weight')?.unit || 'lb' : null,
        reps: has('reps') && finite(set.reps) ? Number(set.reps) : null,
        duration: has('duration') && finite(set.duration ?? set.durationSeconds) ? Number(set.duration ?? set.durationSeconds) : null,
        durationUnit: has('duration') ? fieldFor(measurement, 'duration')?.unit || 'sec' : null,
        distance: has('distance') && finite(set.distance) ? Number(set.distance) : null,
        distanceUnit: has('distance') ? fieldFor(measurement, 'distance')?.unit || null : null
      }
    };
    if (cleanText(set.note)) result.note = text(set.note);
    return result;
  }

  function workoutsJson(workouts, catalog, refs, workoutLabel) {
    return workouts.map(workout => {
      const workoutRef = refs.workoutRefs.get(cleanText(workout.id)) || 'workout';
      let setOrdinal = 0;
      const result = {
        workoutRef,
        name: workoutName(workout, workoutLabel),
        startedAt: iso(workout.startedAt),
        completedAt: iso(workout.completedAt),
        durationSeconds: finite(workout.durationSeconds) ? Number(workout.durationSeconds) : null,
        entryMethod: workout.entryMethod === 'retrospective' ? 'retrospective' : 'live',
        note: text(workout.note),
        exercises: list(workout.exercises).map((exercise, index) => {
          const resolved = identity(catalog, exercise);
          const sets = completedSets(exercise).map(set => {
            setOrdinal += 1;
            return setJson(set, exercise, catalog, refs, workoutRef, setOrdinal);
          });
          return {
            exerciseNumber: index + 1,
            exercise: {
              canonicalExerciseId: resolved.canonicalExerciseId,
              name: resolved.exerciseName,
              equipment: resolved.equipment
            },
            note: text(exercise.note),
            sets
          };
        })
      };
      const program = programContext(workout, refs);
      if (program) result.program = program;
      return result;
    });
  }

  function bodyweightJson(state) {
    return list(state?.weights)
      .filter(entry => record(entry) && validDate(entry.date) && finite(entry.weight))
      .slice()
      .sort(byChronology('date', 'id'))
      .map(entry => ({ measuredAt: iso(entry.date), weight: Number(entry.weight), unit: 'lb' }));
  }

  function goalsJson(state, catalog, refs) {
    const source = record(state?.goals) ? state.goals : {};
    return {
      overview: {
        primary: cleanText(source.primary) || null,
        secondary: list(source.secondary).filter(value => cleanText(value)).map(cleanText),
        startingWeight: finite(source.startingWeight) ? Number(source.startingWeight) : null,
        startingWeightUnit: finite(source.startingWeight) ? 'lb' : null,
        targetDate: /^\d{4}-\d{2}-\d{2}$/.test(source.targetDate || '') ? source.targetDate : null
      },
      strengthGoals: refs.orderedGoals.map(goal => {
        const definition = catalog?.getById?.(goal.exerciseId) || catalog?.definitionFor?.({ id: goal.legacyExerciseId, name: goal.label });
        const current = record(goal.progressionState?.current) ? goal.progressionState.current : null;
        const result = {
          goalRef: refs.goalRefs.get(goal.goalId),
          exercise: {
            canonicalExerciseId: definition?.canonicalId || cleanText(goal.exerciseId) || null,
            name: definition?.name || cleanText(goal.label) || 'Exercise'
          },
          target: {
            metric: goal.metric === 'one_rep_max' ? 'one rep max' : cleanText(goal.metric).replace(/_/g, ' '),
            value: finite(goal.targetValue) ? Number(goal.targetValue) : null,
            unit: cleanText(goal.unit) || null,
            loadBasis: cleanText(goal.targetBasis).replace(/_/g, ' ') || null,
            date: goal.targetDate || null
          },
          label: cleanText(goal.label) || null,
          status: cleanText(goal.status) || null,
          guidanceEnabled: goal.guidanceEnabled === true,
          attainment: goal.attainmentState || 'in_progress',
          createdAt: iso(goal.createdAt),
          updatedAt: iso(goal.updatedAt)
        };
        if (current) {
          result.currentRecommendation = {
            issuedAt: iso(current.issuedAt),
            evidenceCutoff: iso(current.evidenceCutoff),
            enteredLoad: finite(current.enteredLoad) ? Number(current.enteredLoad) : null,
            unit: cleanText(current.unit) || null,
            loadBasis: cleanText(current.loadBasis).replace(/_/g, ' ') || null,
            workingSetCount: finite(current.workingSetCount) ? Number(current.workingSetCount) : null,
            repTargets: list(current.repTargets).filter(finite).map(Number),
            decision: cleanText(current.decisionCode).toLowerCase().replace(/_/g, ' ') || null,
            reason: cleanText(current.reasonCode).toLowerCase().replace(/_/g, ' ') || null,
            explanation: text(current.explanation),
            attainment: current.attainmentState || 'in_progress'
          };
        }
        if (record(goal.attainmentEvidence)) {
          result.attainmentEvidence = {
            workoutRef: refs.workoutRefs.get(cleanText(goal.attainmentEvidence.workoutId)) || null,
            setRef: refs.setRefs.get(cleanText(goal.attainmentEvidence.setId)) || null,
            date: iso(goal.attainmentEvidence.date),
            load: finite(goal.attainmentEvidence.load) ? Number(goal.attainmentEvidence.load) : null,
            reps: finite(goal.attainmentEvidence.reps) ? Number(goal.attainmentEvidence.reps) : 1
          };
        }
        return result;
      })
    };
  }

  function prescriptionJson(entry, catalog) {
    const definition = catalog?.getById?.(entry.exerciseId) || catalog?.definitionFor?.({ id: entry.exerciseId });
    return {
      exercise: {
        canonicalExerciseId: definition?.canonicalId || cleanText(entry.exerciseId) || null,
        name: definition?.name || cleanText(entry.exerciseId) || 'Exercise'
      },
      workingSets: finite(entry.workingSets) ? Number(entry.workingSets) : null,
      repTarget: cleanText(entry.repTarget?.text ?? entry.targetReps) || null,
      restSeconds: finite(entry.restSeconds) ? Number(entry.restSeconds) : null
    };
  }

  function routinesJson(state, catalog) {
    if (!record(state?.customRoutines)) return [];
    return Object.entries(state.customRoutines)
      .sort(([left], [right]) => compareText(left, right))
      .map(([name, entries]) => ({
        name,
        prescriptions: list(entries).map(entry => {
          const source = typeof entry === 'string' ? { exerciseId: entry } : entry;
          return prescriptionJson(source, catalog);
        })
      }));
  }

  function programJson(capture, catalog, refs) {
    const versionsByProgram = new Map(refs.programVersions.map(version => [version.programVersionId, version]));
    const activeVersion = versionsByProgram.get(capture?.activeProgramVersionId);
    return {
      programs: refs.programs.map(program => ({
        programRef: refs.programRefs.get(program.programId),
        purpose: cleanText(program.purposeKey).replace(/-/g, ' ') || null,
        status: program.status,
        latestVersionRef: refs.programVersionRefs.get(program.latestVersionId) || null,
        activeVersionRef: refs.programVersionRefs.get(program.activeVersionId) || null,
        createdAt: iso(program.createdAt),
        updatedAt: iso(program.updatedAt)
      })),
      versions: refs.programVersions.map(version => ({
        programVersionRef: refs.programVersionRefs.get(version.programVersionId),
        programRef: refs.programRefs.get(version.programId) || null,
        versionNumber: Number(version.versionNumber),
        predecessorVersionRef: refs.programVersionRefs.get(version.predecessorProgramVersionId) || null,
        name: version.name,
        status: refs.programs.find(program => program.activeVersionId === version.programVersionId)?.status || 'immutable history',
        schedule: {
          kind: 'rolling cycle',
          advanceOn: 'completed session',
          startsOn: version.duration?.startsOn || null
        },
        slots: list(version.slots).map((slot, index) => ({
          slotNumber: index + 1,
          label: slot.label,
          preferredWeekday: Number.isInteger(slot.preferredCalendarAnchor?.weekday) ? WEEKDAYS[slot.preferredCalendarAnchor.weekday] : null,
          routineRef: refs.routineRefs.get(slot.routineId) || null,
          routineVersionRef: refs.routineVersionRefs.get(slot.routineVersionId) || null
        })),
        review: version.blockReviewPolicy ? {
          after: cleanText(version.blockReviewPolicy.boundaryKind).replace(/_/g, ' '),
          value: version.blockReviewPolicy.boundaryValue,
          action: 'review required'
        } : null,
        programmingAuthority: version.programmingAuthority === 'review' ? 'Review proposals only' : 'Off',
        priorityGoalRefs: list(version.priorityGoalIds).map(id => refs.goalRefs.get(id)).filter(Boolean),
        createdAt: iso(version.createdAt),
        versionNote: text(version.versionNote)
      })),
      routineVersions: refs.routineVersions.map(version => ({
        routineVersionRef: refs.routineVersionRefs.get(version.routineVersionId),
        routineRef: refs.routineRefs.get(version.routineId) || null,
        versionNumber: Number(version.versionNumber),
        predecessorVersionRef: refs.routineVersionRefs.get(version.predecessorRoutineVersionId) || null,
        label: version.label,
        source: cleanText(version.source?.kind).replace(/_/g, ' ') || null,
        prescriptions: list(version.exercises).map(entry => prescriptionJson(entry, catalog)),
        createdAt: iso(version.createdAt),
        effectiveAt: iso(version.effectiveAt),
        approvedAt: iso(version.approval?.approvedAt)
      })),
      currentPosition: activeVersion && record(capture?.sequenceState) ? {
        programRef: refs.programRefs.get(activeVersion.programId) || null,
        programVersionRef: refs.programVersionRefs.get(activeVersion.programVersionId) || null,
        nextSlotNumber: Number(capture.sequenceState.nextSlotIndex) + 1,
        nextSlotLabel: activeVersion.slots?.[Number(capture.sequenceState.nextSlotIndex)]?.label || null,
        completedCycles: Number(capture.sequenceState.completedCycles || 0),
        updatedAt: iso(capture.sequenceState.updatedAt)
      } : null
    };
  }

  function preferencesJson(state, catalog, presentation) {
    const exercises = record(state?.exercisePreferences)
      ? Object.entries(state.exercisePreferences).sort(([left], [right]) => compareText(left, right)).map(([id, value]) => {
        const definition = catalog?.getById?.(id) || catalog?.resolve?.(id);
        return {
          exercise: {
            canonicalExerciseId: definition?.canonicalId || catalog?.canonicalIdFor?.(id) || null,
            name: definition?.name || id
          },
          cue: text(value?.cue),
          restSeconds: finite(value?.restSeconds) ? Number(value.restSeconds) : null
        };
      }) : [];
    return {
      timer: {
        sound: state?.timerPreferences?.sound !== false,
        vibration: state?.timerPreferences?.vibration !== false
      },
      exercises,
      presentation: {
        theme: cleanText(presentation?.theme) || null,
        accent: cleanText(presentation?.accent) || null,
        companionEnabled: presentation?.petEnabled === true
      }
    };
  }

  function prepare({ state, profile, catalog, appVersion, workoutLabel = null, exportedAt = new Date().toISOString() } = {}) {
    if (!record(state) || !record(profile) || !cleanText(profile.id) || state.profileId !== profile.id) {
      throw new Error('User export requires the loaded current profile and matching profile scope.');
    }
    const at = iso(exportedAt);
    if (!at) throw new Error('User export requires a valid export time.');
    const workouts = completedWorkouts(state);
    const strengthGoals = list(state.goals?.strengthGoals);
    const capture = record(state.programCapture) ? state.programCapture : {};
    const refs = buildReferences(workouts, strengthGoals, capture);
    const csvRows = workoutRows(workouts, catalog, refs, workoutLabel);
    const csv = `\uFEFF${[CSV_HEADERS, ...csvRows].map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
    const data = {
      format: FORMAT,
      version: VERSION,
      metadata: {
        exportedAt: at,
        appVersion: cleanText(appVersion) || 'unknown',
        displayName: cleanText(profile.displayName) || 'Big Gains user'
      },
      workouts: workoutsJson(workouts, catalog, refs, workoutLabel),
      bodyweight: bodyweightJson(state),
      goals: goalsJson(state, catalog, refs),
      routines: routinesJson(state, catalog),
      program: programJson(capture, catalog, refs),
      preferences: preferencesJson(state, catalog, profile.presentation)
    };
    const date = at.slice(0, 10);
    const name = safeName(profile.displayName);
    return Object.freeze({
      format: FORMAT,
      exportedAt: at,
      csv: Object.freeze({ filename: `big-gains-${name}-${date}-completed-sets.csv`, type: 'text/csv', content: csv, rowCount: csvRows.length }),
      json: Object.freeze({ filename: `big-gains-${name}-${date}-data.json`, type: 'application/json', content: `${JSON.stringify(data, null, 2)}\n`, data })
    });
  }

  function filesFor(prepared) {
    if (typeof File !== 'function') return [];
    return [
      new File([prepared.csv.content], prepared.csv.filename, { type: prepared.csv.type, lastModified: Date.parse(prepared.exportedAt) }),
      new File([prepared.json.content], prepared.json.filename, { type: prepared.json.type, lastModified: Date.parse(prepared.exportedAt) })
    ];
  }

  function canShareFiles(prepared, navigatorApi = scope.navigator) {
    if (!navigatorApi || typeof navigatorApi.share !== 'function' || typeof navigatorApi.canShare !== 'function') return false;
    const files = filesFor(prepared);
    if (files.length !== 2) return false;
    try { return navigatorApi.canShare({ files }) === true; } catch { return false; }
  }

  async function share(prepared, navigatorApi = scope.navigator) {
    const files = filesFor(prepared);
    if (!canShareFiles(prepared, navigatorApi)) return { ok: false, reason: 'unsupported' };
    try {
      await navigatorApi.share({ files, title: 'My Big Gains data', text: 'My completed training history and personal Big Gains data.' });
      return { ok: true, method: 'share' };
    } catch (error) {
      if (error?.name === 'AbortError') return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'share-failed' };
    }
  }

  function download(file, documentApi = scope.document, urlApi = scope.URL) {
    if (!file?.content || !file?.filename || !documentApi?.createElement || !urlApi?.createObjectURL) return false;
    const blob = new Blob([file.content], { type: file.type });
    const url = urlApi.createObjectURL(blob);
    const anchor = documentApi.createElement('a');
    anchor.href = url;
    anchor.download = file.filename;
    anchor.rel = 'noopener';
    anchor.hidden = true;
    documentApi.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    scope.setTimeout(() => urlApi.revokeObjectURL(url), 1000);
    return true;
  }

  Object.defineProperty(scope, 'BigGainsUserDataExport', {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ FORMAT, VERSION, CSV_HEADERS, canShareFiles, download, prepare, share }),
    writable: false
  });
})(typeof window === 'object' ? window : globalThis);
