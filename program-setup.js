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
  const SETUP_STEPS = Object.freeze(['Push', 'Pull', 'Legs/Core', 'Cycle', 'Goals', 'Boundary', 'Authority', 'Activate']);
  let wizard = null;
  let initialized = false;
  let dialogRenderFrame = null;
  let detailReturnView = 'plan';
  let pendingGoalReturn = null;

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
        notice: approved ? `Approved Routine version ${approved.versionNumber} is loaded for review.`
          : custom ? 'Your saved routine is available as a starting candidate. It stays separate until you approve this future version.'
            : 'A built-in routine is shown only as a starting candidate. It is not part of your Program until you approve it.'
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
    routine.notice = 'Review these changes, then approve a new future Routine version. Past and active workouts will not change.';
  }

  function goalForExercise(exerciseId) {
    return (state.goals?.strengthGoals || []).find(goal => goal.status === 'active'
      && canonicalId(goal.exerciseId) === exerciseId) || null;
  }

  function renderRoutineStep(routine, index) {
    const sourceLabels = {
      existing_custom: 'Your saved routine',
      coded_default: 'Built-in starting routine',
      reviewed_rebuild: 'Build or revise this session'
    };
    const rows = routine.entries.map((entry, entryIndex) => {
      const definition = exerciseCatalog.getById(entry.exerciseId);
      const goal = goalForExercise(entry.exerciseId);
      return `<article class="program-exercise-row" data-program-exercise="${entryIndex}">
        <header><span class="program-order">${entryIndex + 1}</span><div><strong>${escapeHtml(definition?.name || 'Unknown exercise')}</strong><small>${escapeHtml([definition?.muscle, definition?.equipment].filter(Boolean).join(' · '))}</small>${goal ? `<span class="program-goal-chip">Supports ${escapeHtml(definition?.name || 'this')} Goal · ${escapeHtml(String(goal.targetValue))} ${escapeHtml(goal.unit)}</span>` : ''}</div><div class="program-row-actions"><button type="button" data-program-move="up" data-index="${entryIndex}" ${entryIndex === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button type="button" data-program-move="down" data-index="${entryIndex}" ${entryIndex === routine.entries.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button><button type="button" data-program-remove="${entryIndex}" aria-label="Remove exercise">×</button></div></header>
        <div class="program-exercise-fields"><label><span>Exercise</span><button type="button" class="exercise-picker-trigger" data-program-replace="${entryIndex}"><span>${escapeHtml(definition?.name || 'Unknown exercise')} — ${escapeHtml(definition?.equipment || '')}</span><small>Replace</small></button></label><label><span>Working sets</span><input data-program-field="workingSets" data-index="${entryIndex}" type="number" min="1" max="12" step="1" inputmode="numeric" value="${entry.workingSets}"></label><label><span>Rep target / range</span><input data-program-field="targetReps" data-index="${entryIndex}" type="text" maxlength="40" list="targetRepPresets" placeholder="8–10" value="${escapeHtml(entry.targetReps)}"></label><label><span>Rest seconds <small>(capture only)</small></span><input data-program-field="restSeconds" data-index="${entryIndex}" type="number" min="1" max="900" step="5" inputmode="numeric" placeholder="Exercise preference" value="${entry.restSeconds ?? ''}"></label></div>
      </article>`;
    }).join('');
    const used = new Set(routine.entries.map(entry => entry.exerciseId));
    const available = [...exerciseCatalog.exercises].filter(exercise => !used.has(exercise.canonicalId));
    return `<section class="program-step" aria-labelledby="programStepTitle">
      <div class="program-step-heading"><span class="label">Session ${index + 1} of 3</span><h2 id="programStepTitle">Build and approve ${escapeHtml(routine.defaultLabel)}</h2><p>${escapeHtml(routine.notice)}</p></div>
      <div class="program-canonical-explainer"><strong>Starting candidate → approved Routine version</strong><p>Choosing a source only fills this review. Approval creates an immutable version for future Program slots; it never rewrites History or an active workout.</p></div>
      <fieldset class="program-source-choices"><legend>Choose where to start</legend>
        ${Object.entries(sourceLabels).map(([kind, label]) => `<label class="program-source-choice ${kind === 'existing_custom' && !routine.custom ? 'is-unavailable' : ''}"><input type="radio" name="programRoutineSource" value="${kind}" ${routine.sourceKind === kind ? 'checked' : ''} ${kind === 'existing_custom' && !routine.custom ? 'disabled' : ''}><span><strong>${label}</strong><small>${kind === 'existing_custom' ? (routine.custom ? `${routine.custom.length} validated movements from this profile` : 'No safely identifiable custom routine') : kind === 'coded_default' ? 'Reference only until you approve this version' : 'Build or revise deliberately from the reviewed draft'}</small></span></label>`).join('')}
      </fieldset>
      <label class="program-routine-name"><span>Routine name</span><input id="programRoutineName" type="text" maxlength="80" value="${escapeHtml(routine.label)}"></label>
      <div class="program-exercise-list">${rows || '<div class="empty">Add at least one exercise before approval.</div>'}</div>
      <div class="program-add-exercise"><button type="button" class="secondary wide" data-program-add ${available.length ? '' : 'disabled'}>Choose exercise to add</button></div>
      <details class="program-technical-details"><summary>Prescription details</summary><p>Rest is stored with this Routine version for future use. Train and the timer keep their current behavior in this release.</p></details>
      <button type="button" class="primary wide" data-program-approve-routine>${routine.approvedVersionId ? 'Approved — continue with this version' : `Approve ${escapeHtml(routine.defaultLabel)} for future Program slots`}</button>
      <p class="program-source-summary">Starting point: ${routine.sourceKind ? escapeHtml(sourceLabels[routine.sourceKind]) : 'Not chosen — approval is blocked'}</p>
    </section>`;
  }

  function blockValueControl(program) {
    if (program.boundaryKind === 'date') return `<label><span>Review date</span><input id="programBoundaryValue" type="date" value="${escapeHtml(String(program.boundaryValue || ''))}"></label>`;
    return `<label><span>${program.boundaryKind === 'weeks' ? 'Weeks' : 'Completed cycles'}</span><input id="programBoundaryValue" type="number" min="1" max="520" step="1" inputmode="numeric" value="${escapeHtml(String(program.boundaryValue || ''))}" placeholder="Choose a boundary"></label>`;
  }

  function activeGoals() {
    return (state.goals?.strengthGoals || []).filter(goal => goal.status === 'active');
  }

  function approvedRoutineVersions() {
    const stored = capture();
    return wizard.routines.map(routine => stored.routineVersions.find(version => version.routineVersionId === routine.approvedVersionId));
  }

  function programSlotsMarkup() {
    const approved = approvedRoutineVersions();
    return SLOT_PATTERN.map((routineIndex, slotIndex) => {
      const routine = approved[routineIndex];
      return `<li><span>${slotIndex + 1}</span><div><strong>${escapeHtml(routine?.label || 'Approval required')}</strong><small>Approved Routine version ${routine?.versionNumber || '—'}</small></div>${wizard.program.preferredAnchors ? `<em>${WEEKDAYS[slotIndex + 1]} preference</em>` : ''}</li>`;
    }).join('');
  }

  function renderCycleStep() {
    const slots = programSlotsMarkup();
    return `<section class="program-step program-composition" aria-labelledby="programStepTitle">
      <div class="program-step-heading"><span class="label">Whole Program cycle</span><h2 id="programStepTitle">Review the rolling sequence</h2><p>The numbered order is the route. Preferred weekdays are helpful placement cues, never calendar locks.</p></div>
      <label><span>Program name</span><input id="programName" type="text" maxlength="100" value="${escapeHtml(wizard.program.name)}"></label>
      <ol class="program-slot-list program-slot-list-rolling">${slots}</ol>
      <p class="program-rolling-note"><strong>After slot 6, the route rolls back to slot 1.</strong> A missed preferred day does not skip a session or change Train.</p>
      <label class="program-toggle"><input id="programPreferredAnchors" type="checkbox" ${wizard.program.preferredAnchors ? 'checked' : ''}><span><strong>Show Monday–Saturday preferences</strong><small>Preferences describe a comfortable rhythm. They do not reserve dates or mark sessions complete.</small></span></label>
    </section>`;
  }

  function renderGoalsStep() {
    const goals = activeGoals();
    return `<section class="program-step" aria-labelledby="programStepTitle">
      <div class="program-step-heading"><span class="label">Goals and priorities</span><h2 id="programStepTitle">Connect destinations to this route</h2><p>Linking a Goal lets Plan show factual support. It does not edit the Goal or authorize Train changes.</p></div>
      <section class="program-goal-links"><span class="label">Active Goals</span>${goals.length ? goals.map(goal => { const definition = exerciseCatalog.getById(goal.exerciseId); return `<label><input type="checkbox" data-program-goal-id="${escapeHtml(goal.goalId)}" ${wizard.program.priorityGoalIds.includes(goal.goalId) ? 'checked' : ''}><span><strong>${escapeHtml(definition?.name || 'Strength Goal')}</strong><small>Target ${escapeHtml(String(goal.targetValue))} ${escapeHtml(goal.unit)} · reference only</small></span></label>`; }).join('') : '<div class="program-empty-choice"><strong>No active Goals yet.</strong><p>You can still create and activate a Program. Add Goals later without changing this Routine content.</p></div>'}</section>
    </section>`;
  }

  function renderBoundaryStep() {
    return `<section class="program-step" aria-labelledby="programStepTitle">
      <div class="program-step-heading"><span class="label">Review boundary</span><h2 id="programStepTitle">Choose when to pause and review</h2><p>This is a reminder to assess the block—not an automatic end date or a trigger for Program changes.</p></div>
      <div class="program-config-grid"><label><span>Review after</span><select id="programBoundaryKind"><option value="completed_cycles" ${wizard.program.boundaryKind === 'completed_cycles' ? 'selected' : ''}>A number of completed cycles</option><option value="weeks" ${wizard.program.boundaryKind === 'weeks' ? 'selected' : ''}>A number of weeks</option><option value="date" ${wizard.program.boundaryKind === 'date' ? 'selected' : ''}>A specific date</option></select></label>${blockValueControl(wizard.program)}<label><span>Program starts on</span><input id="programStartsOn" type="date" value="${escapeHtml(wizard.program.startsOn)}"></label></div>
      <label><span>Review note</span><input id="programVersionNote" type="text" maxlength="300" value="${escapeHtml(wizard.program.versionNote)}" placeholder="Why this version is being created"></label>
      <div class="program-safety-note"><strong>A boundary starts a conversation.</strong><p>Nothing is proposed or changed automatically when the boundary is reached.</p></div>
    </section>`;
  }

  function renderAuthorityStep() {
    return `<section class="program-step" aria-labelledby="programStepTitle">
      <div class="program-step-heading"><span class="label">Programming authority</span><h2 id="programStepTitle">Choose how future suggestions may appear</h2><p>This release has no recommendation engine. Off and Review produce the same read-only Program facts.</p></div>
      <fieldset class="program-source-choices"><legend>Authority for future programming support</legend>
        <label class="program-source-choice"><input type="radio" name="programAuthorityChoice" value="off" ${wizard.program.programmingAuthority === 'off' ? 'checked' : ''}><span><strong>Off</strong><small>No programming proposals. You review and create every future version yourself.</small></span></label>
        <label class="program-source-choice"><input type="radio" name="programAuthorityChoice" value="review" ${wizard.program.programmingAuthority === 'review' ? 'checked' : ''}><span><strong>Review</strong><small>A future engine may show proposals for your approval. It still cannot apply them automatically.</small></span></label>
      </fieldset>
      <p class="program-source-summary">Automatic authority is not available.</p>
    </section>`;
  }

  function boundarySummary(program) {
    if (program.boundaryKind === 'date') return `Review on ${program.boundaryValue || 'a date you choose'}`;
    const unit = program.boundaryKind === 'weeks' ? 'week' : 'completed cycle';
    const value = Number(program.boundaryValue) || 0;
    return `Review after ${value || '—'} ${unit}${value === 1 ? '' : 's'}`;
  }

  function renderActivationStep() {
    const linkedGoals = activeGoals().filter(goal => wizard.program.priorityGoalIds.includes(goal.goalId));
    return `<section class="program-step program-composition" aria-labelledby="programStepTitle">
      <div class="program-step-heading"><span class="label">Final review</span><h2 id="programStepTitle">Create the next Program version</h2><p>Confirm the route, priorities, review boundary, authority, and future-only effective boundary.</p></div>
      <dl class="program-review-facts"><div><dt>Program</dt><dd>${escapeHtml(wizard.program.name)}</dd></div><div><dt>Rolling route</dt><dd>6 slots · ${approvedRoutineVersions().length} approved Routine versions</dd></div><div><dt>Linked Goals</dt><dd>${linkedGoals.length || 'None'}</dd></div><div><dt>Block review</dt><dd>${escapeHtml(boundarySummary(wizard.program))}</dd></div><div><dt>Authority</dt><dd>${wizard.program.programmingAuthority === 'review' ? 'Review' : 'Off'}</dd></div></dl>
      <label class="program-toggle"><input id="programActivate" type="checkbox" ${wizard.program.activate ? 'checked' : ''}><span><strong>Make this the active Program</strong><small>Activation begins at the next unmaterialized session. It does not alter the active workout, Train selection, saved routines, Goals, or History.</small></span></label>
      <div class="program-safety-note"><strong>Future-only versioning</strong><p>Approved Routine versions stay immutable. This Program pins those exact versions; later edits create successors and never rewrite prior records.</p></div>
      <details class="program-technical-details"><summary>Storage and technical boundary</summary><p>Program data remains profile-scoped, schema-v5 local state plus JSON backup. Cloud Program sync is not part of this release.</p></details>
      <button type="button" class="primary wide" data-program-confirm>Create ${wizard.program.activate ? 'and activate' : 'draft'} Program version</button>
    </section>`;
  }

  function renderProgramStep() {
    if (wizard.step === 3) return renderCycleStep();
    if (wizard.step === 4) return renderGoalsStep();
    if (wizard.step === 5) return renderBoundaryStep();
    if (wizard.step === 6) return renderAuthorityStep();
    return renderActivationStep();
  }

  function renderCompleted() {
    const result = wizard.completed;
    return `<section class="program-step program-complete"><span class="label">Program version ${result.versionNumber}</span><h2>Your training route is saved.</h2><p>${result.active ? 'This is now the active Program and can be started explicitly from Today or Plan. Existing manual Train entry remains available.' : 'This remains a draft you can continue reviewing in Plan.'}</p><dl><div><dt>Status</dt><dd>${result.active ? 'Active' : 'Draft'}</dd></div><div><dt>Effective boundary</dt><dd>Next unmaterialized session</dd></div><div><dt>Storage</dt><dd>This profile · local + JSON backup</dd></div></dl><details class="program-technical-details"><summary>Version details</summary><p>${escapeHtml(result.programVersionId)}</p></details><button type="button" class="primary wide" data-program-close>View Program in Plan</button></section>`;
  }

  function setupStepCanContinue() {
    if (!wizard || wizard.completed) return false;
    if (wizard.step < ROUTINES.length) return Boolean(wizard.routines[wizard.step].approvedVersionId);
    if (wizard.step === 3) return Boolean(wizard.program.name.trim());
    if (wizard.step === 5) return Boolean(wizard.program.startsOn && wizard.program.boundaryValue);
    return wizard.step < SETUP_STEPS.length - 1;
  }

  function renderDialog() {
    if (!wizard) return;
    const content = el('programSetupContent');
    const progress = el('programSetupProgress');
    if (!content || !progress) return;
    progress.innerHTML = SETUP_STEPS.map((label, index) => `<span class="${wizard.step === index ? 'is-current' : wizard.step > index ? 'is-complete' : ''}">${index + 1}<small>${label}</small></span>`).join('');
    content.innerHTML = wizard.completed ? renderCompleted()
      : wizard.step < ROUTINES.length ? renderRoutineStep(wizard.routines[wizard.step], wizard.step)
        : renderProgramStep();
    el('programSetupError').textContent = wizard.error || '';
    el('programSetupBack').hidden = Boolean(wizard.completed) || wizard.step === 0;
    el('programSetupNext').hidden = Boolean(wizard.completed) || wizard.step >= SETUP_STEPS.length - 1;
    if (!wizard.completed && wizard.step < SETUP_STEPS.length - 1) {
      el('programSetupNext').disabled = !setupStepCanContinue();
      el('programSetupNext').textContent = wizard.step < 2 ? 'Next session' : wizard.step === 2 ? 'Review whole cycle' : 'Continue';
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
      routine.notice = `${result.created ? 'Created' : 'Confirmed'} approved future Routine version ${result.version.versionNumber}.`;
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
      window.bigGainsGoals?.render();
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
      prompt: 'Choose the exact exercise you mean. This draft will require approval as a new future Routine version.',
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
    if (el('programSetupNext') && !el('programSetupNext').hidden) el('programSetupNext').disabled = !setupStepCanContinue();
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
    if (target.name === 'programAuthorityChoice') wizard.program.programmingAuthority = target.value;
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
    if (button.dataset.programClose !== undefined) {
      close();
      return openProgramDetail({ returnView: 'plan' });
    }
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

  function currentProgramContext() {
    const stored = capture();
    const activeVersion = stored.programVersions.find(version => version.programVersionId === stored.activeProgramVersionId) || null;
    const activeProgram = activeVersion ? stored.programs.find(program => program.programId === activeVersion.programId) || null : null;
    const latestProgram = activeProgram
      || stored.programs.find(program => program.purposeKey === 'canonical-program' && program.status === 'draft')
      || stored.programs.find(program => program.purposeKey === 'canonical-program')
      || stored.programs.at(-1)
      || null;
    const latestVersion = latestProgram
      ? stored.programVersions.find(version => version.programVersionId === latestProgram.latestVersionId) || null
      : null;
    return {
      stored,
      programRecord: activeProgram || latestProgram,
      programVersion: activeVersion || latestVersion,
      status: activeVersion ? 'active' : latestVersion ? 'draft' : 'empty'
    };
  }

  function startNextProgramSession() {
    if (active) {
      window.workoutSessionController?.resume(true);
      window.bigGainsViewShell?.showView('train');
      return active;
    }
    try {
      const materialization = window.BigGainsProgramOrigin.materializeNext({
        capture: state.programCapture,
        accountId: ACCOUNT.accountId,
        profileId: PROFILE.id,
        catalog: exerciseCatalog,
        materializedAt: new Date().toISOString()
      });
      const session = window.workoutSessionController.startProgram(materialization, { scroll: true });
      render();
      window.bigGainsViewShell?.showView('train');
      return session;
    } catch (error) {
      console.warn('Could not materialize the next Program session', error);
      return null;
    }
  }

  function analyzeContext(context = currentProgramContext()) {
    if (!context.programVersion || !window.BigGainsProgramAnalyzer) return null;
    return window.BigGainsProgramAnalyzer.analyze({
      programVersion: context.programVersion,
      routineVersions: context.stored.routineVersions,
      catalog: exerciseCatalog,
      goals: state.goals?.strengthGoals || [],
      options: {
        programStatus: context.programRecord?.status || context.status,
        sequenceState: context.stored.sequenceState
      }
    });
  }

  function goalName(goal) {
    return exerciseCatalog.getById(canonicalId(goal?.exerciseId))?.name || goal?.label || 'Strength Goal';
  }

  function goalTarget(goal) {
    return `${goalName(goal)} · target ${Number(goal?.targetValue) || '—'} ${goal?.unit || ''}`.trim();
  }

  function linkedGoalFacts(analysis, goalId) {
    const fact = analysis?.status === 'available' ? analysis.goalExposure.find(item => item.goalId === goalId) : null;
    if (!fact) return 'Linked priority · support facts unavailable';
    if (fact.representation === 'represented') return `${countLabel(fact.exposuresPerCycle, 'exposure')} per cycle · ${countLabel(fact.workingSetsPerCycle, 'working set')}`;
    if (fact.representation === 'not_represented') return 'Linked priority · not represented in this Program';
    return 'Linked priority · support currently unavailable';
  }

  function planGoalMarkup(goal, context, analysis) {
    const linked = Boolean(context.programVersion?.priorityGoalIds?.includes(goal.goalId));
    return `<article class="plan-goal-card" data-plan-goal-id="${escapeHtml(goal.goalId)}"><div><span class="plan-status ${linked ? 'is-linked' : ''}">${linked ? 'Linked priority' : 'Active Goal'}</span><strong>${escapeHtml(goalTarget(goal))}</strong><small>${linked ? escapeHtml(linkedGoalFacts(analysis, goal.goalId)) : context.programVersion ? 'Not linked to the current Program' : 'Ready to connect when you build a Program'}</small></div><button type="button" class="ghost compact" data-plan-open-goal="${escapeHtml(goal.goalId)}">View Goal</button></article>`;
  }

  function analysisHighlights(analysis) {
    if (!analysis || analysis.status !== 'available') return '<p class="plan-muted">Program facts are unavailable until the exact approved versions pass validation.</p>';
    const exercises = analysis.exerciseExposure.slice(0, 3).map(item => `<li><strong>${escapeHtml(item.name)}</strong><span>${countLabel(item.exposuresPerCycle, 'exposure')} · ${countLabel(item.workingSetsPerCycle, 'working set')} per cycle</span></li>`).join('');
    return `<dl class="plan-highlight-facts"><div><dt>Rolling cycle</dt><dd>${countLabel(analysis.topology.totalSlotsPerCycle, 'session')}</dd></div><div><dt>Exercises</dt><dd>${countLabel(analysis.exerciseExposure.length, 'exercise')}</dd></div><div><dt>Linked priorities</dt><dd>${analysis.goalExposure.filter(item => item.lifecycle === 'active').length}</dd></div></dl><ul class="plan-highlight-list">${exercises}</ul>`;
  }

  function renderPlanOverview() {
    const overview = el('planOverview');
    if (!overview) return;
    const context = currentProgramContext();
    const analysis = analyzeContext(context);
    const goals = activeGoals();
    const goalSection = `<section class="panel plan-peer-card" aria-labelledby="planGoalsTitle"><div class="plan-card-head"><div><span class="label">Goals · destination</span><h2 id="planGoalsTitle">Active priorities</h2><p>${goals.length ? 'What you are working toward.' : 'Define a destination when you are ready.'}</p></div><button type="button" class="ghost compact" data-plan-goals>${goals.length ? 'View all Goals' : 'Create a Goal'}</button></div><div class="plan-goal-list">${goals.length ? goals.map(goal => planGoalMarkup(goal, context, analysis)).join('') : '<div class="plan-empty"><strong>No active Goals.</strong><p>A Program can still organize your training route. Goals remain separate and can be linked later.</p></div>'}</div></section>`;
    const programSection = context.programVersion
      ? `<section class="panel plan-peer-card plan-program-card" aria-labelledby="planProgramCardTitle"><div class="plan-card-head"><div><span class="label">Program · route</span><h2 id="planProgramCardTitle">${escapeHtml(context.programVersion.name)}</h2><p>Version ${context.programVersion.versionNumber} · ${context.status === 'active' ? 'Active' : 'Draft'} · ${context.programVersion.slots.length}-session rolling cycle</p></div><span class="plan-status ${context.status === 'active' ? 'is-active' : ''}">${context.status === 'active' ? 'Active' : 'Draft'}</span></div><div class="plan-program-summary"><p><strong>${escapeHtml(boundarySummary({ boundaryKind: context.programVersion.blockReviewPolicy.boundaryKind, boundaryValue: context.programVersion.blockReviewPolicy.boundaryValue }))}</strong><span>Authority ${context.programVersion.programmingAuthority === 'review' ? 'Review' : 'Off'} · local to this profile</span></p><div class="plan-action-row"><button type="button" class="primary" data-plan-program>Review Program</button><button type="button" class="secondary" data-plan-analysis>View Program analysis</button><button type="button" class="ghost compact" data-plan-setup>Continue setup</button></div></div></section>`
      : `<section class="panel plan-peer-card plan-program-card" aria-labelledby="planProgramCardTitle"><div class="plan-card-head"><div><span class="label">Program · route</span><h2 id="planProgramCardTitle">Organize your training route</h2><p>A Program connects approved sessions into a rolling route that can support your Goals.</p></div></div><div class="plan-empty"><strong>No Program yet.</strong><p>Start with plain-language session reviews, then approve the whole cycle before anything becomes active.</p><button type="button" class="primary" data-plan-setup>Start Program setup</button></div></section>`;
    const highlights = context.programVersion ? `<section class="panel plan-highlights" aria-labelledby="planHighlightsTitle"><div class="plan-card-head"><div><span class="label">Read-only facts</span><h2 id="planHighlightsTitle">Current Program highlights</h2><p>Recomputed from the exact approved Routine versions.</p></div><button type="button" class="ghost compact" data-plan-analysis>Full analysis</button></div>${analysisHighlights(analysis)}</section>` : '';
    overview.innerHTML = `<div class="plan-peer-grid">${goalSection}${programSection}</div>${highlights}`;
  }

  function routineDetailMarkup(version) {
    if (!version) return '<p class="plan-muted">Approved Routine details unavailable.</p>';
    const exercises = version.exercises.map(item => {
      const definition = exerciseCatalog.getById(item.exerciseId);
      return `<li><strong>${escapeHtml(definition?.name || 'Unknown exercise')}</strong><span>${countLabel(item.workingSets, 'working set')} · ${escapeHtml(repText(item) || 'rep target unavailable')}</span></li>`;
    }).join('');
    return `<ul class="plan-routine-exercises">${exercises}</ul><p class="plan-muted">Approved Routine version ${version.versionNumber} · future Program pin</p>`;
  }

  function renderProgramDetail() {
    const context = currentProgramContext();
    const detail = el('planProgramDetail');
    const content = el('planProgramContent');
    if (!detail || !content || !context.programVersion) return false;
    const version = context.programVersion;
    const analysis = analyzeContext(context);
    const programmingReview = window.BigGainsProgrammingReview?.evaluateCurrent({
      programVersion: version,
      routineVersions: context.stored.routineVersions,
      programAnalysis: analysis,
      goals: state.goals?.strengthGoals || [],
      workouts: state.workouts || [],
      catalog: exerciseCatalog,
      programStatus: context.programRecord?.status || context.status
    }) || null;
    const programmingReviewSection = window.BigGainsProgrammingReview?.markup(programmingReview, escapeHtml) || '';
    const linkedGoals = activeGoals().filter(goal => version.priorityGoalIds.includes(goal.goalId));
    const sequence = version.slots.map((slot, index) => {
      const routine = context.stored.routineVersions.find(item => item.routineVersionId === slot.routineVersionId);
      const next = context.status === 'active' && Number(context.stored.sequenceState?.nextSlotIndex) === index;
      const preference = slot.preferredCalendarAnchor ? `${weekdayLabel(slot.preferredCalendarAnchor.weekday)} preference` : 'No weekday preference';
      return `<li class="plan-cycle-slot ${next ? 'is-next' : ''}"><span>${index + 1}</span><details><summary><div><strong>${escapeHtml(slot.label)}</strong><small>${next ? 'Next rolling session · ' : ''}${escapeHtml(preference)}</small></div><em>Routine v${routine?.versionNumber || '—'}</em></summary>${routineDetailMarkup(routine)}</details></li>`;
    }).join('');
    const goals = linkedGoals.length
      ? linkedGoals.map(goal => `<article class="plan-goal-card"><div><strong>${escapeHtml(goalTarget(goal))}</strong><small>${escapeHtml(linkedGoalFacts(analysis, goal.goalId))}</small></div><button type="button" class="ghost compact" data-plan-open-goal="${escapeHtml(goal.goalId)}">View Goal</button></article>`).join('')
      : '<div class="plan-empty compact"><strong>No linked priorities.</strong><p>This Program can exist without Goals. Viewing it does not create or infer any links.</p></div>';
    el('planProgramTitle').textContent = version.name;
    el('planProgramEyebrow').textContent = context.status === 'active' ? 'Active Program' : 'Draft Program';
    el('planProgramSubtitle').textContent = `Version ${version.versionNumber} · ${context.status === 'active' ? 'Active' : 'Draft'} · rolling cycle`;
    content.innerHTML = `<section class="panel plan-program-hero"><div class="plan-program-identity"><div><span class="plan-status ${context.status === 'active' ? 'is-active' : ''}">${context.status === 'active' ? 'Active Program' : 'Draft Program'}</span><h3>${escapeHtml(version.name)}</h3><p>Version ${version.versionNumber} · ${version.slots.length} rolling sessions · Authority ${version.programmingAuthority === 'review' ? 'Review' : 'Off'}</p></div><div class="plan-action-row">${context.status === 'active' ? `<button type="button" class="primary" data-start-program-session>${active ? 'Resume workout' : 'Start next Program session'}</button>` : ''}<button type="button" class="secondary" data-plan-setup>Review or create successor</button><button type="button" class="primary" data-plan-analysis>View full analysis</button></div></div>${analysisHighlights(analysis)}</section>
      ${programmingReviewSection}
      <section class="panel plan-detail-section"><div class="plan-card-head"><div><span class="label">Rolling cycle</span><h3>Session route</h3><p>Open a session to inspect its pinned, immutable Routine prescription.</p></div></div><ol class="plan-cycle-list">${sequence}</ol></section>
      <section class="panel plan-detail-section"><div class="plan-card-head"><div><span class="label">Linked Goals</span><h3>Priority destinations</h3></div></div><div class="plan-goal-list">${goals}</div></section>
      <section class="plan-detail-grid"><article class="panel plan-detail-section"><span class="label">Block review</span><h3>${escapeHtml(boundarySummary({ boundaryKind: version.blockReviewPolicy.boundaryKind, boundaryValue: version.blockReviewPolicy.boundaryValue }))}</h3><p>This boundary prompts review only. No automatic change occurs.</p></article><article class="panel plan-detail-section"><span class="label">Authority</span><h3>${version.programmingAuthority === 'review' ? 'Review' : 'Off'}</h3><p>${version.programmingAuthority === 'review' ? 'Future proposals would still require approval.' : 'No programming proposals are authorized.'}</p></article></section>
      <section class="panel plan-version-info"><div><span class="label">Version and review information</span><h3>Future-only from ${escapeHtml(version.duration.startsOn)}</h3><p>${escapeHtml(version.versionNote || 'No review note.')}</p></div><details><summary>Technical version details</summary><dl><div><dt>Created</dt><dd>${escapeHtml(version.createdAt)}</dd></div><div><dt>Effective boundary</dt><dd>Next unmaterialized session</dd></div><div><dt>Program version ID</dt><dd>${escapeHtml(version.programVersionId)}</dd></div>${version.predecessorProgramVersionId ? `<div><dt>Predecessor</dt><dd>${escapeHtml(version.predecessorProgramVersionId)}</dd></div>` : ''}</dl></details></section>`;
    return true;
  }

  function renderTodayPlan() {
    const card = el('todayPlanCard');
    if (!card) return;
    const context = currentProgramContext();
    if (!context.programVersion) {
      card.hidden = PROFILE.id !== 'jorge';
      if (!card.hidden) {
        el('todayPlanHeadline').textContent = 'Build your training route';
        el('todayPlanDetail').textContent = 'Plan connects your Goals to a reviewed rolling Program.';
        el('todayPlanMeta').innerHTML = '<span>No Program yet</span>';
        el('todayPlanActions').innerHTML = '<button type="button" class="primary compact" data-today-plan>Open Plan</button>';
      }
      return;
    }
    const version = context.programVersion;
    const nextIndex = context.status === 'active' && Number.isInteger(Number(context.stored.sequenceState?.nextSlotIndex)) ? Number(context.stored.sequenceState.nextSlotIndex) : null;
    const nextSlot = nextIndex === null ? null : version.slots[nextIndex];
    const linked = activeGoals().filter(goal => version.priorityGoalIds.includes(goal.goalId));
    card.hidden = false;
    el('todayPlanHeadline').textContent = `${version.name} · v${version.versionNumber}`;
    el('todayPlanDetail').textContent = nextSlot ? `Next in the rolling route: ${nextSlot.label}.` : `${context.status === 'active' ? 'Active' : 'Draft'} Program context is ready in Plan.`;
    el('todayPlanMeta').innerHTML = `<span>${context.status === 'active' ? 'Active Program' : 'Draft Program'}</span>${linked[0] ? `<span>${escapeHtml(goalName(linked[0]))} priority</span>` : '<span>No linked Goal priority</span>'}`;
    el('todayPlanActions').innerHTML = `${context.status === 'active' ? `<button type="button" class="primary compact" data-start-program-session>${active ? 'Resume workout' : 'Start next Program session'}</button>` : ''}<button type="button" class="secondary compact" data-today-plan>Open Plan</button><button type="button" class="ghost compact" data-today-program>View Program</button>${linked[0] ? `<button type="button" class="ghost compact" data-today-goal="${escapeHtml(linked[0].goalId)}">View Goal</button>` : ''}`;
  }

  function analyzerList(items, emptyCopy, markup) {
    return items.length ? `<ul class="program-analyzer-list">${items.map(markup).join('')}</ul>` : `<p class="program-analyzer-empty">${escapeHtml(emptyCopy)}</p>`;
  }

  function renderAnalyzer(stored, programVersion, programRecord, visible = false) {
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
    panel.hidden = !visible;
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

  function openGoalReference(goalId, returnSurface = 'program') {
    if (!goalId || !window.bigGainsViewShell?.showView) return false;
    pendingGoalReturn = returnSurface;
    const back = el('goalsBackToday');
    if (back) back.textContent = returnSurface === 'program' ? 'Back to Program' : returnSurface === 'plan' ? 'Back to Plan' : 'Back to Today';
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

  function openPlan() {
    detailReturnView = 'plan';
    pendingGoalReturn = null;
    el('planOverview').hidden = false;
    el('planProgramDetail').hidden = true;
    el('programAnalyzerPanel').hidden = true;
    renderPlanOverview();
    window.bigGainsViewShell?.showView('plan', { workout: false });
    requestAnimationFrame(() => el('viewPlan')?.querySelector('h2')?.focus?.({ preventScroll: true }));
    return true;
  }

  function openProgramDetail({ returnView = 'plan', showAnalysis = false } = {}) {
    const context = currentProgramContext();
    if (!context.programVersion) return openPlan();
    detailReturnView = returnView;
    pendingGoalReturn = null;
    renderProgramDetail();
    el('planOverview').hidden = true;
    el('planProgramDetail').hidden = false;
    renderAnalyzer(context.stored, context.programVersion, context.programRecord, showAnalysis);
    window.bigGainsViewShell?.showView('plan', { workout: false });
    requestAnimationFrame(() => (showAnalysis ? el('programAnalyzerTitle') : el('planProgramTitle'))?.focus({ preventScroll: true }));
    return true;
  }

  function openProgramAnalyzer(returnView = detailReturnView) {
    return openProgramDetail({ returnView, showAnalysis: true });
  }

  function closeProgramAnalyzer() {
    const panel = el('programAnalyzerPanel');
    if (!panel) return false;
    panel.hidden = true;
    el('planProgramTitle')?.focus({ preventScroll: true });
    return true;
  }

  function backFromProgram() {
    if (detailReturnView === 'goals') {
      window.bigGainsViewShell?.showView('goals', { workout: false });
      return true;
    }
    if (detailReturnView === 'today') {
      window.bigGainsViewShell?.showView('today', { workout: false });
      return true;
    }
    return openPlan();
  }

  function returnFromGoal() {
    const destination = pendingGoalReturn;
    if (!destination) return false;
    pendingGoalReturn = null;
    if (el('goalsBackToday')) el('goalsBackToday').textContent = 'Back to Today';
    if (destination === 'program') return openProgramDetail({ returnView: 'plan' });
    if (destination === 'plan') return openPlan();
    if (destination === 'today') {
      window.bigGainsViewShell?.showView('today', { workout: false });
      return true;
    }
    return false;
  }

  function goalSupportMarkup(goal) {
    const context = currentProgramContext();
    if (!goal || !context.programVersion?.priorityGoalIds?.includes(goal.goalId)) return '';
    const analysis = analyzeContext(context);
    return `<section class="goal-program-support"><span class="label">Supported by Program</span><strong>${escapeHtml(context.programVersion.name)} · v${context.programVersion.versionNumber}</strong><p>${escapeHtml(linkedGoalFacts(analysis, goal.goalId))}</p><button type="button" class="ghost compact" data-goal-view-program="${escapeHtml(context.programVersion.programId)}">View Program</button></section>`;
  }

  function handlePlanClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.programmingDisposition) {
      return window.BigGainsProgrammingReview?.recordDisposition(
        button.closest('[data-programming-review-status]'),
        button.dataset.programmingDisposition
      );
    }
    if (button.dataset.planSetup !== undefined) return open();
    if (button.dataset.planProgram !== undefined) return openProgramDetail({ returnView: 'plan' });
    if (button.dataset.planAnalysis !== undefined) return openProgramAnalyzer(el('planProgramDetail')?.hidden ? 'plan' : detailReturnView);
    if (button.dataset.planGoals !== undefined) {
      pendingGoalReturn = 'plan';
      if (el('goalsBackToday')) el('goalsBackToday').textContent = 'Back to Plan';
      return window.bigGainsViewShell?.showView('goals', { workout: false });
    }
    if (button.dataset.planOpenGoal) {
      const fromDetail = !el('planProgramDetail')?.hidden;
      return openGoalReference(button.dataset.planOpenGoal, fromDetail ? 'program' : 'plan');
    }
    if (button.dataset.startProgramSession !== undefined) return startNextProgramSession();
    if (button.dataset.todayPlan !== undefined) return openPlan();
    if (button.dataset.todayProgram !== undefined) return openProgramDetail({ returnView: 'today' });
    if (button.dataset.todayGoal) return openGoalReference(button.dataset.todayGoal, 'today');
  }

  function render() {
    const panel = el('programSetupPanel');
    const supported = PROFILE.id === 'jorge' && ROUTINES.every(config => routineEngine.hasRoutine(config.routineType));
    renderPlanOverview();
    renderTodayPlan();
    if (!supported) return false;
    const stored = capture();
    const activeVersion = stored.programVersions.find(version => version.programVersionId === stored.activeProgramVersionId) || null;
    const latestProgram = stored.programs.find(program => program.purposeKey === 'canonical-program');
    const latestVersion = latestProgram ? stored.programVersions.find(version => version.programVersionId === latestProgram.latestVersionId) : null;
    const analyzedVersion = activeVersion || latestVersion;
    const analyzedProgram = analyzedVersion ? stored.programs.find(program => program.programId === analyzedVersion.programId) || latestProgram : null;
    const analyzerWasVisible = !el('programAnalyzerPanel')?.hidden;
    if (!el('planProgramDetail')?.hidden && analyzedVersion) renderProgramDetail();
    if (!analyzedVersion) {
      el('planOverview').hidden = false;
      el('planProgramDetail').hidden = true;
    }
    renderAnalyzer(stored, analyzedVersion, analyzedProgram, analyzerWasVisible);
    return true;
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    el('openProgramSetup')?.addEventListener('click', openPlan);
    el('planBackToday')?.addEventListener('click', () => window.bigGainsViewShell?.showView('today', { workout: false }));
    el('planProgramBack')?.addEventListener('click', backFromProgram);
    el('closeProgramAnalyzer')?.addEventListener('click', closeProgramAnalyzer);
    el('planOverview')?.addEventListener('click', handlePlanClick);
    el('planProgramContent')?.addEventListener('click', handlePlanClick);
    el('todayPlanCard')?.addEventListener('click', handlePlanClick);
    el('closeProgramSetup')?.addEventListener('click', close);
    el('programSetupBack')?.addEventListener('click', () => {
      if (!wizard || wizard.step <= 0) return;
      wizard.step -= 1;
      wizard.error = '';
      renderDialog();
    });
    el('programSetupNext')?.addEventListener('click', () => {
      if (!setupStepCanContinue()) return;
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
    if (!window.BigGainsBootGate || window.BigGainsBootGate.canRender()) {
      render();
      window.bigGainsGoals?.render();
    }
    return true;
  }

  window.BigGainsProgramSetup = Object.freeze({
    analyzeCurrent: () => analyzeContext(currentProgramContext()),
    evaluateProgrammingCurrent: () => {
      const context = currentProgramContext();
      if (!context.programVersion) return null;
      return window.BigGainsProgrammingReview?.evaluateCurrent({
        programVersion: context.programVersion,
        routineVersions: context.stored.routineVersions,
        programAnalysis: analyzeContext(context),
        goals: state.goals?.strengthGoals || [],
        workouts: state.workouts || [],
        catalog: exerciseCatalog,
        programStatus: context.programRecord?.status || context.status
      }) || null;
    },
    close,
    goalSupportMarkup,
    initialize,
    open,
    openPlan,
    openProgramAnalyzer,
    openProgramDetail,
    render,
    startNextProgramSession,
    returnFromGoal
  });
  initialize();
})();
