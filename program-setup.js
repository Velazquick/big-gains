(() => {
  'use strict';

  const model = window.BigGainsProgramModel;
  const ROUTINES = Object.freeze([
    { purposeKey: 'push', routineType: 'Push', defaultLabel: 'Push' },
    { purposeKey: 'pull', routineType: 'Pull', defaultLabel: 'Pull' },
    { purposeKey: 'legs-core', routineType: 'Legs', defaultLabel: 'Legs/Core' }
  ]);
  const SLOT_PATTERN = Object.freeze([0, 1, 2, 0, 1, 2]);
  const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
  let wizard = null;
  let initialized = false;
  let dialogRenderFrame = null;

  const el = id => document.getElementById(id);
  const canonicalId = value => exerciseCatalog.canonicalIdFor(value);
  const todayKey = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const repText = entry => entry?.repTarget?.text ?? entry?.targetReps ?? '';
  const copyEntries = entries => entries.map(entry => ({
    exerciseId: canonicalId(entry.exerciseId),
    workingSets: Number(entry.workingSets) || 3,
    targetReps: repText(entry),
    restSeconds: entry.restSeconds ?? null
  })).filter(entry => entry.exerciseId);

  function capture() {
    return model.normalizeCapture(state.programCapture, {
      accountId: ACCOUNT.accountId,
      profileId: PROFILE.id,
      catalog: exerciseCatalog
    });
  }

  function customCandidate(routineType) {
    const source = state.customRoutines?.[routineType];
    if (!Array.isArray(source) || !source.length) return null;
    const seen = new Set();
    const entries = source.map(item => {
      const exerciseId = canonicalId(typeof item === 'string' ? item : item.exerciseId);
      if (!exerciseId || !exerciseCatalog.getById(exerciseId) || seen.has(exerciseId)) return null;
      seen.add(exerciseId);
      return {
        exerciseId,
        workingSets: typeof item === 'object' ? Number(item.workingSets) || 3 : 3,
        targetReps: typeof item === 'object' ? String(item.targetReps || '') : '',
        restSeconds: null
      };
    });
    return entries.every(Boolean) ? entries : null;
  }

  function defaultCandidate(routineType) {
    return routineEngine.getEntries(routineType).map(item => {
      const definition = exerciseCatalog.resolve(item.name);
      return definition ? {
        exerciseId: definition.canonicalId,
        workingSets: Number(item.workingSets) || 3,
        targetReps: typeof item.targetReps === 'string' ? item.targetReps : '',
        restSeconds: null
      } : null;
    }).filter(Boolean);
  }

  function currentRoutineVersion(programCapture, purposeKey) {
    const routine = programCapture.routines.find(item => item.purposeKey === purposeKey);
    return routine ? programCapture.routineVersions.find(item => item.routineVersionId === routine.currentVersionId) || null : null;
  }

  function buildWizard() {
    const stored = capture();
    const routines = ROUTINES.map(config => {
      const custom = customCandidate(config.routineType);
      const defaults = defaultCandidate(config.routineType);
      const approved = currentRoutineVersion(stored, config.purposeKey);
      return {
        ...config,
        custom,
        defaults,
        label: approved?.label || config.defaultLabel,
        sourceKind: approved ? 'reviewed_rebuild' : null,
        entries: approved ? copyEntries(approved.exercises) : copyEntries(custom || defaults),
        approvedVersionId: approved?.routineVersionId || null,
        basedOnRoutineVersionId: approved?.routineVersionId || null,
        notice: approved ? `Approved canonical version ${approved.versionNumber} loaded for review.`
          : custom ? 'An existing custom routine is available as a candidate. Choose its source explicitly before approval.'
            : 'No valid custom routine was found. Coded defaults are shown only as a review candidate.'
      };
    });
    const activeProgram = stored.programVersions.find(version => version.programVersionId === stored.activeProgramVersionId) || null;
    return {
      step: 0,
      routines,
      program: {
        name: activeProgram?.name || 'Jorge Program v1',
        preferredAnchors: activeProgram ? activeProgram.slots.some(slot => slot.preferredCalendarAnchor) : true,
        boundaryKind: activeProgram?.blockReviewPolicy?.boundaryKind || 'completed_cycles',
        boundaryValue: activeProgram?.blockReviewPolicy?.boundaryValue || '',
        programmingAuthority: activeProgram?.programmingAuthority || 'off',
        priorityGoalIds: [...(activeProgram?.priorityGoalIds || [])],
        startsOn: activeProgram?.duration?.startsOn || todayKey(),
        activate: true,
        versionNote: activeProgram ? 'Reviewed successor Program version' : 'Initial explicitly reviewed canonical Program'
      },
      completed: null,
      error: ''
    };
  }

  function markDirty(routine) {
    routine.approvedVersionId = null;
    routine.notice = 'Changes need explicit approval as a new immutable Routine version.';
  }

  function goalForExercise(exerciseId) {
    return (state.goals?.strengthGoals || []).find(goal => goal.status === 'active'
      && canonicalId(goal.exerciseId) === exerciseId) || null;
  }

  function renderRoutineStep(routine, index) {
    const sourceLabels = {
      existing_custom: 'Existing custom routine',
      coded_default: 'Coded default reference',
      reviewed_rebuild: 'Reviewed rebuild / approved canonical'
    };
    const rows = routine.entries.map((entry, entryIndex) => {
      const definition = exerciseCatalog.getById(entry.exerciseId);
      const goal = goalForExercise(entry.exerciseId);
      return `<article class="program-exercise-row" data-program-exercise="${entryIndex}">
        <header><span class="program-order">${entryIndex + 1}</span><div><strong>${escapeHtml(definition?.name || 'Unknown exercise')}</strong><small>${escapeHtml(definition?.muscle || '')} · EKF ${escapeHtml(entry.exerciseId)}</small>${goal ? `<span class="program-goal-chip">Goal priority reference · ${escapeHtml(String(goal.targetValue))} ${escapeHtml(goal.unit)}</span>` : ''}</div><div class="program-row-actions"><button type="button" data-program-move="up" data-index="${entryIndex}" ${entryIndex === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button type="button" data-program-move="down" data-index="${entryIndex}" ${entryIndex === routine.entries.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button><button type="button" data-program-remove="${entryIndex}" aria-label="Remove exercise">×</button></div></header>
        <div class="program-exercise-fields"><label><span>Exercise</span><button type="button" class="exercise-picker-trigger" data-program-replace="${entryIndex}"><span>${escapeHtml(definition?.name || 'Unknown exercise')} — ${escapeHtml(definition?.equipment || '')}</span><small>Replace</small></button></label><label><span>Working sets</span><input data-program-field="workingSets" data-index="${entryIndex}" type="number" min="1" max="12" step="1" inputmode="numeric" value="${entry.workingSets}"></label><label><span>Rep target / range</span><input data-program-field="targetReps" data-index="${entryIndex}" type="text" maxlength="40" list="targetRepPresets" placeholder="8–10" value="${escapeHtml(entry.targetReps)}"></label><label><span>Rest seconds <small>(capture only)</small></span><input data-program-field="restSeconds" data-index="${entryIndex}" type="number" min="1" max="900" step="5" inputmode="numeric" placeholder="Exercise preference" value="${entry.restSeconds ?? ''}"></label></div>
      </article>`;
    }).join('');
    const used = new Set(routine.entries.map(entry => entry.exerciseId));
    const available = [...exerciseCatalog.exercises].filter(exercise => !used.has(exercise.canonicalId));
    return `<section class="program-step" aria-labelledby="programStepTitle">
      <div class="program-step-heading"><span class="label">Routine ${index + 1} of 3</span><h2 id="programStepTitle">Review ${escapeHtml(routine.defaultLabel)}</h2><p>${escapeHtml(routine.notice)}</p></div>
      <fieldset class="program-source-choices"><legend>Choose the source deliberately</legend>
        ${Object.entries(sourceLabels).map(([kind, label]) => `<label class="program-source-choice ${kind === 'existing_custom' && !routine.custom ? 'is-unavailable' : ''}"><input type="radio" name="programRoutineSource" value="${kind}" ${routine.sourceKind === kind ? 'checked' : ''} ${kind === 'existing_custom' && !routine.custom ? 'disabled' : ''}><span><strong>${label}</strong><small>${kind === 'existing_custom' ? (routine.custom ? `${routine.custom.length} validated movements from this profile` : 'No safely identifiable custom routine') : kind === 'coded_default' ? 'Reference only until you approve this version' : 'Build or revise deliberately from the reviewed draft'}</small></span></label>`).join('')}
      </fieldset>
      <label class="program-routine-name"><span>Routine name</span><input id="programRoutineName" type="text" maxlength="80" value="${escapeHtml(routine.label)}"></label>
      <div class="program-exercise-list">${rows || '<div class="empty">Add at least one exercise before approval.</div>'}</div>
      <div class="program-add-exercise"><button type="button" class="secondary wide" data-program-add ${available.length ? '' : 'disabled'}>Choose exercise to add</button></div>
      <p class="program-rest-note">Routine rest is captured as versioned metadata. Train and the timer still use the existing exercise preference → 150-second behavior in Program-1A.</p>
      <button type="button" class="primary wide" data-program-approve-routine>${routine.approvedVersionId ? 'Approved — continue with this version' : `Approve immutable ${escapeHtml(routine.defaultLabel)} version`}</button>
      <p class="program-source-summary">Current source: ${routine.sourceKind ? escapeHtml(sourceLabels[routine.sourceKind]) : 'Not chosen — approval is blocked'}</p>
    </section>`;
  }

  function blockValueControl(program) {
    if (program.boundaryKind === 'date') return `<label><span>Review date</span><input id="programBoundaryValue" type="date" value="${escapeHtml(String(program.boundaryValue || ''))}"></label>`;
    return `<label><span>${program.boundaryKind === 'weeks' ? 'Weeks' : 'Completed cycles'}</span><input id="programBoundaryValue" type="number" min="1" max="520" step="1" inputmode="numeric" value="${escapeHtml(String(program.boundaryValue || ''))}" placeholder="Choose a boundary"></label>`;
  }

  function activeGoals() {
    return (state.goals?.strengthGoals || []).filter(goal => goal.status === 'active');
  }

  function renderProgramStep() {
    const stored = capture();
    const approved = wizard.routines.map(routine => stored.routineVersions.find(version => version.routineVersionId === routine.approvedVersionId));
    const slots = SLOT_PATTERN.map((routineIndex, slotIndex) => {
      const routine = approved[routineIndex];
      return `<li><span>${slotIndex + 1}</span><div><strong>${escapeHtml(routine?.label || 'Approval required')}</strong><small>Pins Routine v${routine?.versionNumber || '—'} · ${escapeHtml(routine?.routineVersionId || '')}</small></div>${wizard.program.preferredAnchors ? `<em>${WEEKDAYS[slotIndex + 1]}</em>` : ''}</li>`;
    }).join('');
    const goals = activeGoals();
    return `<section class="program-step program-composition" aria-labelledby="programStepTitle">
      <div class="program-step-heading"><span class="label">Program review</span><h2 id="programStepTitle">Pin the rolling six-slot sequence</h2><p>Sequence position is authoritative. Weekdays are optional preferred anchors only.</p></div>
      <label><span>Program name</span><input id="programName" type="text" maxlength="100" value="${escapeHtml(wizard.program.name)}"></label>
      <ol class="program-slot-list">${slots}</ol>
      <label class="program-toggle"><input id="programPreferredAnchors" type="checkbox" ${wizard.program.preferredAnchors ? 'checked' : ''}><span><strong>Prefer Monday–Saturday placement</strong><small>Missing a preferred day never skips the rolling sequence.</small></span></label>
      <div class="program-config-grid"><label><span>Block review boundary</span><select id="programBoundaryKind"><option value="completed_cycles" ${wizard.program.boundaryKind === 'completed_cycles' ? 'selected' : ''}>Completed cycles</option><option value="weeks" ${wizard.program.boundaryKind === 'weeks' ? 'selected' : ''}>Weeks</option><option value="date" ${wizard.program.boundaryKind === 'date' ? 'selected' : ''}>Explicit date</option></select></label>${blockValueControl(wizard.program)}<label><span>Starts on</span><input id="programStartsOn" type="date" value="${escapeHtml(wizard.program.startsOn)}"></label><label><span>Programming authority</span><select id="programAuthority"><option value="off" ${wizard.program.programmingAuthority === 'off' ? 'selected' : ''}>Off</option><option value="review" ${wizard.program.programmingAuthority === 'review' ? 'selected' : ''}>Review only</option></select></label></div>
      <section class="program-goal-links"><span class="label">Goal links · reference only</span>${goals.length ? goals.map(goal => { const definition = exerciseCatalog.getById(goal.exerciseId); return `<label><input type="checkbox" data-program-goal-id="${escapeHtml(goal.goalId)}" ${wizard.program.priorityGoalIds.includes(goal.goalId) ? 'checked' : ''}><span><strong>${escapeHtml(definition?.name || goal.exerciseId)}</strong><small>${escapeHtml(String(goal.targetValue))} ${escapeHtml(goal.unit)} · does not change Goals or Train</small></span></label>`; }).join('') : '<p>No active strength Goals to link.</p>'}</section>
      <label class="program-toggle"><input id="programActivate" type="checkbox" ${wizard.program.activate ? 'checked' : ''}><span><strong>Activate after creating the reviewed draft</strong><small>Activation records the next unmaterialized session boundary. Train execution wiring is deferred.</small></span></label>
      <label><span>Version note</span><input id="programVersionNote" type="text" maxlength="300" value="${escapeHtml(wizard.program.versionNote)}"></label>
      <div class="program-safety-note"><strong>Before confirmation</strong><p>This creates local schema-v5 Program/Routine records only. It does not alter the current workout, completed history, saved custom routines, Goals, or Train selection.</p></div>
      <button type="button" class="primary wide" data-program-confirm>Create Program version with explicit confirmation</button>
    </section>`;
  }

  function renderCompleted() {
    const result = wizard.completed;
    return `<section class="program-step program-complete"><span class="label">Program v${result.versionNumber}</span><h2>Canonical capture saved.</h2><p>${result.active ? 'The Program is active for future selection, with Train wiring intentionally deferred.' : 'The Program remains a reviewable draft with no Train authority.'}</p><dl><div><dt>Program version</dt><dd>${escapeHtml(result.programVersionId)}</dd></div><div><dt>Storage</dt><dd>Local schema v5 + JSON backup</dd></div><div><dt>Cloud sync</dt><dd>Not available in Program-1A</dd></div></dl><button type="button" class="primary wide" data-program-close>Done</button></section>`;
  }

  function renderDialog() {
    if (!wizard) return;
    const content = el('programSetupContent');
    const progress = el('programSetupProgress');
    if (!content || !progress) return;
    progress.innerHTML = ['Push', 'Pull', 'Legs/Core', 'Program'].map((label, index) => `<span class="${wizard.step === index ? 'is-current' : wizard.step > index ? 'is-complete' : ''}">${index + 1}<small>${label}</small></span>`).join('');
    content.innerHTML = wizard.completed ? renderCompleted()
      : wizard.step < ROUTINES.length ? renderRoutineStep(wizard.routines[wizard.step], wizard.step)
        : renderProgramStep();
    el('programSetupError').textContent = wizard.error || '';
    el('programSetupBack').hidden = Boolean(wizard.completed) || wizard.step === 0;
    el('programSetupNext').hidden = Boolean(wizard.completed) || wizard.step >= ROUTINES.length;
    if (!wizard.completed && wizard.step < ROUTINES.length) {
      el('programSetupNext').disabled = !wizard.routines[wizard.step].approvedVersionId;
      el('programSetupNext').textContent = wizard.step === ROUTINES.length - 1 ? 'Review Program' : 'Next routine';
    }
  }

  function scheduleDialogRender() {
    if (dialogRenderFrame !== null) return;
    dialogRenderFrame = requestAnimationFrame(() => {
      dialogRenderFrame = null;
      if (wizard) renderDialog();
    });
  }

  function chooseSource(kind) {
    const routine = wizard.routines[wizard.step];
    if (!routine || !model.routineSourceKinds.includes(kind) || (kind === 'existing_custom' && !routine.custom)) return;
    routine.sourceKind = kind;
    if (kind === 'existing_custom') routine.entries = copyEntries(routine.custom);
    if (kind === 'coded_default') routine.entries = copyEntries(routine.defaults);
    if (kind === 'reviewed_rebuild' && !routine.entries.length) routine.entries = copyEntries(routine.defaults);
    markDirty(routine);
    routine.notice = kind === 'coded_default'
      ? 'Defaults remain non-canonical until you inspect and approve this immutable version.'
      : kind === 'existing_custom'
        ? 'The profile custom routine is copied into a new version; the source routine will not be mutated.'
        : 'This draft is treated as a newly reviewed rebuild.';
    scheduleDialogRender();
  }

  function approveCurrentRoutine() {
    const routine = wizard.routines[wizard.step];
    wizard.error = '';
    try {
      const result = model.approveRoutine({
        capture: state.programCapture,
        accountId: ACCOUNT.accountId,
        profileId: PROFILE.id,
        purposeKey: routine.purposeKey,
        label: routine.label,
        source: {
          kind: routine.sourceKind,
          routineType: routine.routineType,
          ...(routine.basedOnRoutineVersionId ? { basedOnRoutineVersionId: routine.basedOnRoutineVersionId } : {})
        },
        exercises: routine.entries,
        catalog: exerciseCatalog,
        createId: uid
      });
      state.programCapture = result.capture;
      saveState();
      routine.approvedVersionId = result.version.routineVersionId;
      routine.basedOnRoutineVersionId = result.version.routineVersionId;
      routine.notice = `${result.created ? 'Created' : 'Confirmed'} immutable canonical Routine version ${result.version.versionNumber}.`;
      render();
    } catch (error) {
      wizard.error = error.message;
    }
    renderDialog();
  }

  function createProgram() {
    wizard.error = '';
    try {
      const stored = capture();
      const versions = wizard.routines.map(routine => stored.routineVersions.find(version => version.routineVersionId === routine.approvedVersionId));
      if (versions.some(version => !version)) throw new Error('Approve all three Routine versions before creating the Program.');
      const slots = SLOT_PATTERN.map((routineIndex, slotIndex) => ({
        label: versions[routineIndex].label,
        preferredCalendarAnchor: wizard.program.preferredAnchors ? { weekday: slotIndex + 1 } : null,
        routineId: versions[routineIndex].routineId,
        routineVersionId: versions[routineIndex].routineVersionId
      }));
      const draft = model.createProgramDraft({
        capture: stored,
        accountId: ACCOUNT.accountId,
        profileId: PROFILE.id,
        purposeKey: 'canonical-program',
        name: wizard.program.name,
        slots,
        blockReviewPolicy: { boundaryKind: wizard.program.boundaryKind, boundaryValue: wizard.program.boundaryValue },
        programmingAuthority: wizard.program.programmingAuthority,
        priorityGoalIds: wizard.program.priorityGoalIds,
        startsOn: wizard.program.startsOn,
        activeWorkoutId: active?.id || null,
        versionNote: wizard.program.versionNote,
        createId: uid
      });
      state.programCapture = wizard.program.activate
        ? model.activateProgram({
          capture: draft.capture,
          accountId: ACCOUNT.accountId,
          profileId: PROFILE.id,
          programVersionId: draft.version.programVersionId
        })
        : draft.capture;
      saveState();
      wizard.completed = {
        programVersionId: draft.version.programVersionId,
        versionNumber: draft.version.versionNumber,
        active: wizard.program.activate
      };
      render();
    } catch (error) {
      wizard.error = error.message;
    }
    renderDialog();
  }

  function updateRoutineField(target) {
    const routine = wizard.routines[wizard.step];
    const index = Number(target.dataset.index);
    const entry = routine?.entries[index];
    if (!entry) return;
    const field = target.dataset.programField;
    if (field === 'exerciseId') entry.exerciseId = target.value;
    if (field === 'workingSets') entry.workingSets = Math.min(12, Math.max(1, Math.round(Number(target.value) || 3)));
    if (field === 'targetReps') entry.targetReps = target.value.trim().slice(0, 40);
    if (field === 'restSeconds') entry.restSeconds = target.value === '' ? null : Math.min(900, Math.max(1, Math.round(Number(target.value) || 150)));
    markDirty(routine);
  }

  function openExercisePicker(index = null) {
    const routine = wizard?.routines[wizard.step];
    const picker = window.bigGainsExercisePicker;
    if (!routine || !picker) return false;
    const excludedExerciseIds = routine.entries
      .filter((_, itemIndex) => itemIndex !== index)
      .map(entry => entry.exerciseId);
    const suggestionIds = exerciseCatalog.exercises
      .filter(exercise => exercise.day === routine.routineType)
      .slice()
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, 10)
      .map(exercise => exercise.canonicalId);
    return picker.open({
      title: index === null ? `Add exercise to ${routine.label}` : `Replace exercise in ${routine.label}`,
      prompt: 'Choose the exact canonical EKF exercise. This draft will require approval as a new immutable Routine version.',
      currentExerciseId: index === null ? null : routine.entries[index]?.exerciseId,
      excludedExerciseIds,
      suggestionIds,
      suggestionLabel: `Suggested for ${routine.defaultLabel}`,
      returnFocus: () => index === null
        ? el('programSetupContent')?.querySelector('[data-program-add]')
        : el('programSetupContent')?.querySelector(`[data-program-replace="${index}"]`),
      onSelect: canonicalExerciseId => {
        if (index === null) routine.entries.push({ exerciseId: canonicalExerciseId, workingSets: 3, targetReps: '8–10', restSeconds: null });
        else if (routine.entries[index]) routine.entries[index].exerciseId = canonicalExerciseId;
        markDirty(routine);
        renderDialog();
      }
    });
  }

  function onContentInput(event) {
    const target = event.target;
    if (target.id === 'programRoutineName') {
      const routine = wizard.routines[wizard.step];
      routine.label = target.value.slice(0, 80);
      markDirty(routine);
    } else if (target.dataset.programField) updateRoutineField(target);
    else if (target.id === 'programName') wizard.program.name = target.value.slice(0, 100);
    else if (target.id === 'programBoundaryValue') wizard.program.boundaryValue = target.value;
    else if (target.id === 'programStartsOn') wizard.program.startsOn = target.value;
    else if (target.id === 'programVersionNote') wizard.program.versionNote = target.value.slice(0, 300);
  }

  function onContentChange(event) {
    const target = event.target;
    if (target.name === 'programRoutineSource') return chooseSource(target.value);
    if (target.dataset.programField) {
      updateRoutineField(target);
      scheduleDialogRender();
      return;
    }
    if (target.id === 'programPreferredAnchors') wizard.program.preferredAnchors = target.checked;
    if (target.id === 'programBoundaryKind') {
      wizard.program.boundaryKind = target.value;
      wizard.program.boundaryValue = '';
    }
    if (target.id === 'programAuthority') wizard.program.programmingAuthority = target.value;
    if (target.id === 'programActivate') wizard.program.activate = target.checked;
    if (target.dataset.programGoalId) {
      const id = target.dataset.programGoalId;
      wizard.program.priorityGoalIds = target.checked
        ? [...new Set([...wizard.program.priorityGoalIds, id])]
        : wizard.program.priorityGoalIds.filter(goalId => goalId !== id);
    }
    scheduleDialogRender();
  }

  function onContentClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    const routine = wizard.routines[wizard.step];
    if (button.dataset.programReplace !== undefined) return openExercisePicker(Number(button.dataset.programReplace));
    if (button.dataset.programMove) {
      const index = Number(button.dataset.index);
      const next = button.dataset.programMove === 'up' ? index - 1 : index + 1;
      if (routine?.entries[index] && routine.entries[next]) {
        [routine.entries[index], routine.entries[next]] = [routine.entries[next], routine.entries[index]];
        markDirty(routine);
      }
      renderDialog();
      return;
    }
    if (button.dataset.programRemove !== undefined) {
      routine?.entries.splice(Number(button.dataset.programRemove), 1);
      markDirty(routine);
      renderDialog();
      return;
    }
    if (button.dataset.programAdd !== undefined) {
      return openExercisePicker();
    }
    if (button.dataset.programApproveRoutine !== undefined) return approveCurrentRoutine();
    if (button.dataset.programConfirm !== undefined) return createProgram();
    if (button.dataset.programClose !== undefined) return close();
  }

  function open() {
    wizard = buildWizard();
    renderDialog();
    const dialog = el('programSetupDialog');
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
    requestAnimationFrame(() => el('programSetupTitle')?.focus({ preventScroll: true }));
  }

  function close() {
    const dialog = el('programSetupDialog');
    if (dialog.close) dialog.close();
    else dialog.removeAttribute('open');
    if (dialogRenderFrame !== null) cancelAnimationFrame(dialogRenderFrame);
    dialogRenderFrame = null;
    wizard = null;
  }

  const countLabel = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;
  const weekdayLabel = weekday => WEEKDAYS[weekday] || 'Unknown day';
  const repLabel = target => target.kind === 'unavailable' ? 'Rep target unavailable'
    : target.min === target.max ? `${target.min} reps` : `${target.min}–${target.max} reps`;
  const restLabel = target => target.restSeconds == null ? 'Rest unavailable' : `${target.restSeconds} sec rest`;
  const spacingLabel = distances => !Array.isArray(distances) || !distances.length
    ? 'Not repeated in this cycle'
    : distances.every(distance => distance === distances[0])
      ? `${distances[0]} ${distances[0] === 1 ? 'session' : 'sessions'} apart`
      : `${distances.join(' / ')} sessions apart`;

  function analyzerList(items, emptyCopy, markup) {
    return items.length ? `<ul class="program-analyzer-list">${items.map(markup).join('')}</ul>` : `<p class="program-analyzer-empty">${escapeHtml(emptyCopy)}</p>`;
  }

  function renderAnalyzer(stored, programVersion, programRecord) {
    const panel = el('programAnalyzerPanel');
    const content = el('programAnalyzerContent');
    if (!panel || !content) return;
    if (!programVersion || !window.BigGainsProgramAnalyzer) {
      panel.hidden = true;
      content.innerHTML = '';
      return;
    }
    const analysis = window.BigGainsProgramAnalyzer.analyze({
      programVersion,
      routineVersions: stored.routineVersions,
      catalog: exerciseCatalog,
      goals: state.goals?.strengthGoals || [],
      options: {
        programStatus: programRecord?.status || 'draft',
        sequenceState: stored.sequenceState
      }
    });
    panel.hidden = false;
    el('programAnalyzerStatus').textContent = `Program v${programVersion.versionNumber} · recomputed locally`;
    if (analysis.status !== 'available') {
      content.innerHTML = `<div class="program-analyzer-error"><strong>Analysis unavailable</strong><p>The Program structure did not pass deterministic validation.</p>${analyzerList(analysis.errors, 'No error details are available.', item => `<li><code>${escapeHtml(item.code)}</code><small>${escapeHtml(item.path)}</small></li>`)}</div>`;
      return;
    }
    const topology = analysis.topology;
    const calendarCopy = topology.preferredCalendar.availability === 'reliable'
      ? topology.preferredCalendar.anchors.map(anchor => `${anchor.position} · ${weekdayLabel(anchor.weekday)}`).join(' · ')
      : topology.preferredCalendar.availability === 'unavailable' ? 'No preferred calendar anchors' : 'Preferred anchors are partial or unavailable';
    const goalMarkup = item => `<li class="program-analyzer-goal" data-program-goal-state="${escapeHtml(item.representation)}"><div><strong>${escapeHtml(item.name || 'Linked Goal unavailable')}</strong><span>${item.representation === 'represented' ? `${countLabel(item.exposuresPerCycle, 'exposure')} / cycle · ${countLabel(item.workingSetsPerCycle, 'working set')}` : item.representation === 'not_represented' ? 'Not represented in this Program' : item.representation === 'inactive_goal' ? 'Goal is not active' : 'Goal reference unavailable'}</span>${item.representation === 'represented' ? `<small>${escapeHtml(spacingLabel(item.slotDistances))}</small>` : ''}</div>${item.lifecycle !== 'unavailable' ? `<button type="button" class="ghost compact" data-program-open-goal="${escapeHtml(item.goalId)}">Open Goal</button>` : ''}</li>`;
    const repTargets = analysis.prescriptionSummary.repTargets.map(target => `<li><strong>${escapeHtml(repLabel(target))}</strong><span>${countLabel(target.exposures, 'exposure')} · ${countLabel(target.workingSets, 'working set')}</span></li>`).join('');
    const restTargets = analysis.prescriptionSummary.restSeconds.map(target => `<li><strong>${escapeHtml(restLabel(target))}</strong><span>${countLabel(target.exposures, 'exposure')} · ${countLabel(target.workingSets, 'working set')}</span></li>`).join('');
    const progress = analysis.blockContext.progress;
    const boundary = analysis.blockContext.definition;
    const boundaryLabel = boundary.boundaryKind === 'completed_cycles' ? `${boundary.boundaryValue} completed cycles`
      : boundary.boundaryKind === 'weeks' ? `${boundary.boundaryValue} weeks` : `Review on ${boundary.boundaryValue}`;
    content.innerHTML = `<div class="program-analyzer-grid">
      <section class="program-analyzer-section" aria-labelledby="programAnalyzerStructure"><h3 id="programAnalyzerStructure">Program structure</h3><dl class="program-analyzer-facts"><div><dt>Cycle</dt><dd>${countLabel(topology.totalSlotsPerCycle, 'slot')}</dd></div><div><dt>Pinned routines</dt><dd>${topology.uniqueRoutineVersionsUsed} unique</dd></div><div><dt>Cadence</dt><dd>Rolling after each completed session</dd></div></dl><ol class="program-analyzer-sequence">${topology.rollingSequence.map(slot => `<li><span>${slot.position}</span><strong>${escapeHtml(slot.label)}</strong><small>Routine ${escapeHtml(slot.routineVersionId)}</small></li>`).join('')}</ol><p class="program-analyzer-context"><strong>Preferred calendar</strong><span>${escapeHtml(calendarCopy)}</span></p></section>
      <section class="program-analyzer-section" aria-labelledby="programAnalyzerExercises"><h3 id="programAnalyzerExercises">Exercise exposure</h3>${analyzerList(analysis.exerciseExposure, 'No exercises are represented.', item => `<li><strong>${escapeHtml(item.name)}</strong><span>${countLabel(item.exposuresPerCycle, 'exposure')} / cycle · ${countLabel(item.workingSetsPerCycle, 'working set')}</span><small>Slots ${item.slots.map(slot => slot.position).join(', ')} · ${escapeHtml(item.repTargets.map(repLabel).join(' · '))}</small></li>`)}</section>
      <section class="program-analyzer-section" aria-labelledby="programAnalyzerGoals"><h3 id="programAnalyzerGoals">Goal support</h3>${analyzerList(analysis.goalExposure, 'No active linked Goals for this Program version.', goalMarkup)}</section>
      <section class="program-analyzer-section" aria-labelledby="programAnalyzerMuscles"><h3 id="programAnalyzerMuscles">Muscle exposure</h3><h4>Primary role sets</h4>${analyzerList(analysis.muscleExposure.primary, 'Primary taxonomy unavailable.', item => `<li><strong>${escapeHtml(item.name)}</strong><span>${countLabel(item.workingSets, 'primary set')} / cycle</span><small>${item.slotsExposed} of ${topology.totalSlotsPerCycle} slots · ${escapeHtml(item.contributingExercises.map(exercise => exercise.name).join(', '))}</small></li>`)}<h4>Secondary role sets</h4>${analyzerList(analysis.muscleExposure.secondary, 'No secondary roles are captured.', item => `<li><strong>${escapeHtml(item.name)}</strong><span>${countLabel(item.workingSets, 'secondary set')} / cycle</span><small>${item.slotsExposed} of ${topology.totalSlotsPerCycle} slots · ${escapeHtml(item.contributingExercises.map(exercise => exercise.name).join(', '))}</small></li>`)}${analysis.muscleExposure.unknown.length ? `<p class="program-analyzer-context"><strong>Unknown muscle taxonomy</strong><span>${escapeHtml(analysis.muscleExposure.unknown.map(item => item.name).join(', '))}</span></p>` : ''}<h4>Movement patterns</h4>${analyzerList(analysis.movementExposure, 'Movement taxonomy unavailable.', item => `<li><strong>${escapeHtml(item.name === 'unknown' ? 'Unknown pattern' : item.name)}</strong><span>${countLabel(item.workingSets, 'set')} / cycle</span><small>${escapeHtml(item.contributingExercises.map(exercise => exercise.name).join(', '))}</small></li>`)}</section>
      <section class="program-analyzer-section" aria-labelledby="programAnalyzerPrescription"><h3 id="programAnalyzerPrescription">Rep / prescription summary</h3><p class="program-analyzer-context"><strong>Raw normalized targets</strong><span>No physiological categories are inferred.</span></p><div class="program-analyzer-prescriptions"><div><h4>Rep targets</h4><ul class="program-analyzer-list">${repTargets}</ul></div><div><h4>Rest prescriptions</h4><ul class="program-analyzer-list">${restTargets}</ul></div></div></section>
      <section class="program-analyzer-section" aria-labelledby="programAnalyzerSpacing"><h3 id="programAnalyzerSpacing">Session spacing</h3>${analyzerList(analysis.sessionSpacing, 'No exercise spacing is available.', item => `<li><strong>${escapeHtml(item.name)} spacing</strong><span>${escapeHtml(spacingLabel(item.slotDistances))}</span><small>Rolling positions ${item.slotPositions.join(', ')}${item.nominalCalendarDayGaps ? ` · nominal day gaps ${item.nominalCalendarDayGaps.join(', ')}` : ''}</small></li>`)}</section>
      <section class="program-analyzer-section" aria-labelledby="programAnalyzerBlock"><h3 id="programAnalyzerBlock">Block context</h3><dl class="program-analyzer-facts"><div><dt>Review boundary</dt><dd>${escapeHtml(boundaryLabel)}</dd></div><div><dt>Starts on</dt><dd>${escapeHtml(analysis.blockContext.versionStart.startsOn)}</dd></div><div><dt>Program state</dt><dd>${escapeHtml(analysis.blockContext.programStatus)}</dd></div>${progress.availability === 'available' ? `<div><dt>Completed cycles</dt><dd>${progress.completedCycles}</dd></div><div><dt>Next slot</dt><dd>${progress.nextSlotPosition} of ${topology.totalSlotsPerCycle}</dd></div><div><dt>Slots remaining</dt><dd>${progress.remainingSlotsInCurrentCycle} this cycle</dd></div>` : '<div><dt>Current progress</dt><dd>Explicit sequence progress unavailable</dd></div>'}</dl></section>
    </div>`;
  }

  function openGoalReference(goalId) {
    if (!goalId || !window.bigGainsViewShell?.showView) return false;
    window.bigGainsViewShell.showView('goals', { workout: false });
    requestAnimationFrame(() => {
      const card = document.querySelector(`.goal-card[data-goal-id="${CSS.escape(goalId)}"]`);
      if (!card) return;
      card.classList.add('is-program-linked');
      card.setAttribute('tabindex', '-1');
      card.scrollIntoView({ block: 'start', behavior: 'smooth' });
      card.focus({ preventScroll: true });
      window.setTimeout(() => card.classList.remove('is-program-linked'), 1800);
    });
    return true;
  }

  function render() {
    const panel = el('programSetupPanel');
    if (!panel) return false;
    const supported = PROFILE.id === 'jorge' && ROUTINES.every(config => routineEngine.hasRoutine(config.routineType));
    panel.hidden = !supported;
    if (!supported) return false;
    const stored = capture();
    const activeVersion = stored.programVersions.find(version => version.programVersionId === stored.activeProgramVersionId) || null;
    const latestProgram = stored.programs.find(program => program.purposeKey === 'canonical-program');
    const latestVersion = latestProgram ? stored.programVersions.find(version => version.programVersionId === latestProgram.latestVersionId) : null;
    el('programSetupHeadline').textContent = activeVersion?.name || latestVersion?.name || 'Capture your canonical Program v1';
    el('programSetupDetail').textContent = activeVersion
      ? `Active Program v${activeVersion.versionNumber} · next sequence slot ${Number(stored.sequenceState?.nextSlotIndex || 0) + 1} · Train wiring deferred`
      : latestVersion ? `Draft Program v${latestVersion.versionNumber} · review or activate when ready`
        : 'Review Push, Pull, and Legs/Core before anything becomes canonical.';
    el('programSetupStatus').textContent = `${stored.routineVersions.length} Routine version${stored.routineVersions.length === 1 ? '' : 's'} · local-only`;
    const analyzedVersion = activeVersion || latestVersion;
    const analyzedProgram = analyzedVersion ? stored.programs.find(program => program.programId === analyzedVersion.programId) || latestProgram : null;
    renderAnalyzer(stored, analyzedVersion, analyzedProgram);
    return true;
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    el('openProgramSetup')?.addEventListener('click', open);
    el('closeProgramSetup')?.addEventListener('click', close);
    el('programSetupBack')?.addEventListener('click', () => {
      if (!wizard || wizard.step <= 0) return;
      wizard.step -= 1;
      wizard.error = '';
      renderDialog();
    });
    el('programSetupNext')?.addEventListener('click', () => {
      if (!wizard || wizard.step >= ROUTINES.length || !wizard.routines[wizard.step].approvedVersionId) return;
      wizard.step += 1;
      wizard.error = '';
      renderDialog();
    });
    el('programSetupContent')?.addEventListener('input', onContentInput);
    el('programSetupContent')?.addEventListener('change', onContentChange);
    el('programSetupContent')?.addEventListener('click', onContentClick);
    el('programAnalyzerPanel')?.addEventListener('click', event => {
      const button = event.target.closest('[data-program-open-goal]');
      if (button) openGoalReference(button.dataset.programOpenGoal);
    });
    el('programSetupDialog')?.addEventListener('click', event => {
      if (event.target === el('programSetupDialog')) close();
    });
    document.addEventListener('big-gains-boot-authorized', render);
    document.addEventListener('big-gains-goals-changed', render);
    if (!window.BigGainsBootGate || window.BigGainsBootGate.canRender()) render();
    return true;
  }

  window.BigGainsProgramSetup = Object.freeze({ initialize, render, open, close });
  initialize();
})();
