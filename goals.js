((scope) => {
  'use strict';

  const METRIC = 'one_rep_max';
  const POLICY = Object.freeze({ id: 'strength_double_progression_v1', version: 1 });
  const ACTIVE_STATUSES = new Set(['active', 'paused']);
  const PAST_STATUSES = new Set(['completed', 'archived']);
  const ELIGIBLE_E1RM_BASES = new Set(['entered_load', 'combined_external_load']);
  const EVIDENCE_LOOKBACK_MS = 42 * 24 * 60 * 60 * 1000;
  const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const list = value => Array.isArray(value) ? value : [];
  const number = value => value === null || value === undefined || value === ''
    ? null
    : (Number.isFinite(Number(value)) ? Number(value) : null);
  const validDateOnly = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) return false;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return date.getUTCFullYear() === Number(match[1])
      && date.getUTCMonth() === Number(match[2]) - 1
      && date.getUTCDate() === Number(match[3]);
  };

  function isEligibleExercise(exercise) {
    const measurement = exercise?.measurement;
    const analytics = exercise?.analytics || measurement?.analytics;
    return Boolean(
      exercise?.canonicalId
      && measurement?.trackingModel === 'load_reps'
      && measurement?.loadSemantics?.resistanceSemantics === 'external'
      && analytics?.e1rmPermitted === true
      && ELIGIBLE_E1RM_BASES.has(analytics.e1rmLoadBasis)
    );
  }

  function eligibleExercises(catalog) {
    return list(catalog?.exercises).filter(isEligibleExercise).slice().sort((left, right) => left.name.localeCompare(right.name));
  }

  function targetBasisFor(exercise) {
    return exercise?.analytics?.e1rmLoadBasis || exercise?.measurement?.analytics?.e1rmLoadBasis || null;
  }

  function targetLabelFor(exercise, unit = 'lb') {
    const loadBasis = exercise?.measurement?.loadSemantics?.loadBasis;
    if (loadBasis === 'per_hand') return `${unit} per hand`;
    if (loadBasis === 'per_side') return `${unit} per side`;
    return `${unit} total`;
  }

  function create(options) {
    const {
      account,
      profile,
      catalog,
      analytics,
      analyticsOptions,
      getState,
      persist,
      createId,
      escapeHtml,
      picker,
      now = () => new Date(),
      scheduledExposuresPerWeek = () => null,
      confirmDelete = message => scope.confirm(message),
      getElement = id => document.getElementById(id)
    } = options;
    if (!account || !profile || !catalog || !analytics || typeof getState !== 'function' || typeof persist !== 'function') {
      throw new Error('Goals requires account, profile, catalog, analytics, state, and persistence ports.');
    }

    let initialized = false;
    let editingGoalId = null;
    const $ = getElement;
    const units = options.units || scope.BigGainsUnits;
    const preferredUnit = () => units?.unitFor(getState()) || 'lb';
    const displayLoad = value => units?.formatLoad(value, getState()) || `${value} lb`;
    const ownsGoal = goal => goal?.profileId === profile.id && goal?.accountId === account.accountId;
    const scopedGoals = () => list(getState()?.goals?.strengthGoals).filter(ownsGoal);
    const goalById = goalId => scopedGoals().find(goal => goal.goalId === goalId) || null;
    const exerciseForGoal = goal => catalog.getById(goal?.exerciseId) || catalog.getById(goal?.legacyExerciseId) || null;
    const isoNow = () => now().toISOString();

    function setNotice(message = '', kind = '') {
      const notice = $('goalsNotice');
      if (!notice) return;
      notice.textContent = message;
      notice.hidden = !message;
      notice.dataset.kind = kind;
    }

    function commit(nextGoals, successMessage = '') {
      const state = getState();
      const previous = state.goals;
      const foreignGoals = list(previous?.strengthGoals).filter(goal => !ownsGoal(goal));
      state.goals = { ...previous, strengthGoals: [...foreignGoals, ...nextGoals] };
      try {
        persist();
      } catch (error) {
        state.goals = previous;
        setNotice('Goals could not be saved on this device. Nothing changed.', 'error');
        console.warn('Could not persist strength goal', error);
        render();
        return false;
      }
      setNotice(successMessage, successMessage ? 'success' : '');
      render();
      document.dispatchEvent(new CustomEvent('big-gains-goals-changed', { detail: { profileId: profile.id } }));
      return true;
    }

    function basisLoad(set, basis) {
      if (basis === 'combined_external_load') return number(set?.combinedExternalLoad);
      if (basis === 'entered_load') return number(set?.enteredLoad);
      return null;
    }

    function evidenceForGoal(goal) {
      const exercise = exerciseForGoal(goal);
      if (!isEligibleExercise(exercise)) return Object.freeze({ state: 'in_progress', reason: 'Exercise is no longer eligible for 1RM evidence.' });
      const history = analytics.exerciseHistory(getState().workouts, exercise.canonicalId, analyticsOptions());
      const sets = history.flatMap(session => session.workingSets.map(set => ({ ...set, workoutId: session.workoutId, date: session.date })));
      const achieved = sets.find(set => set.reps === 1 && basisLoad(set, goal.targetBasis) >= goal.targetValue);
      const evidenceThrough = now().getTime();
      const recentHistory = history.filter(session => {
        const completedAt = Date.parse(session.date);
        return Number.isFinite(completedAt) && completedAt > evidenceThrough - EVIDENCE_LOOKBACK_MS && completedAt <= evidenceThrough;
      }).slice(0, 3);
      const estimates = recentHistory.flatMap(session => session.workingSets.map(set => ({ ...set, workoutId: session.workoutId, date: session.date })))
        .filter(set => number(set.estimated1RM) !== null);
      const bestEstimate = estimates.reduce((winner, set) => !winner || set.estimated1RM > winner.estimated1RM ? set : winner, null);
      const latest = recentHistory[0]?.bestWorkingSet || null;
      if (achieved) {
        return Object.freeze({
          state: 'achieved',
          bestEstimate: bestEstimate?.estimated1RM ?? null,
          latest,
          evidence: Object.freeze({ workoutId: achieved.workoutId, setId: achieved.id, date: achieved.date, load: basisLoad(achieved, goal.targetBasis), reps: 1 })
        });
      }
      if (bestEstimate && bestEstimate.estimated1RM >= goal.targetValue) {
        return Object.freeze({
          state: 'estimated_reached',
          bestEstimate: bestEstimate.estimated1RM,
          latest,
          evidence: Object.freeze({ workoutId: bestEstimate.workoutId, setId: bestEstimate.id, date: bestEstimate.date, estimated1RM: bestEstimate.estimated1RM })
        });
      }
      return Object.freeze({ state: 'in_progress', bestEstimate: bestEstimate?.estimated1RM ?? null, latest, evidence: null });
    }

    function newRecord(values, timestamp = isoNow()) {
      const exercise = catalog.getById(values.exerciseId);
      if (!isEligibleExercise(exercise)) return { ok: false, reason: 'Choose an exercise eligible for an exact 1RM goal.' };
      const targetValue = number(values.targetValue);
      if (targetValue === null || targetValue <= 0) return { ok: false, reason: 'Enter a target greater than zero.' };
      const targetDate = String(values.targetDate || '').trim();
      if (targetDate && !validDateOnly(targetDate)) return { ok: false, reason: 'Choose a valid optional target date.' };
      return {
        ok: true,
        goal: {
          goalId: createId(),
          accountId: account.accountId,
          profileId: profile.id,
          exerciseId: exercise.canonicalId,
          legacyExerciseId: exercise.id,
          metric: METRIC,
          targetValue,
          unit: 'lb',
          targetBasis: targetBasisFor(exercise),
          targetDate: targetDate || null,
          label: String(values.label || '').trim().slice(0, 80),
          status: 'active',
          guidanceEnabled: false,
          policy: { ...POLICY },
          createdAt: timestamp,
          updatedAt: timestamp
        }
      };
    }

    function createGoal(values) {
      const result = newRecord(values);
      if (!result.ok) return result;
      return commit([...scopedGoals(), result.goal], 'Strength goal created.') ? { ok: true, goal: result.goal } : { ok: false, reason: 'save-failed' };
    }

    function editGoal(goalId, values) {
      const current = goalById(goalId);
      if (!current || PAST_STATUSES.has(current.status)) return { ok: false, reason: 'This goal cannot be edited.' };
      const exercise = catalog.getById(values.exerciseId);
      if (!isEligibleExercise(exercise)) return { ok: false, reason: 'Choose an exercise eligible for an exact 1RM goal.' };
      const timestamp = isoNow();
      const targetValue = number(values.targetValue);
      if (targetValue === null || targetValue <= 0) return { ok: false, reason: 'Enter a target greater than zero.' };
      const targetDate = String(values.targetDate || '').trim();
      if (targetDate && !validDateOnly(targetDate)) return { ok: false, reason: 'Choose a valid optional target date.' };
      const exerciseChanged = exercise.canonicalId !== current.exerciseId;
      if (exerciseChanged) {
        const replacement = newRecord(values, timestamp);
        if (!replacement.ok) return replacement;
        const next = scopedGoals().map(goal => goal.goalId === goalId
          ? { ...goal, status: 'archived', guidanceEnabled: false, archivedAt: timestamp, updatedAt: timestamp }
          : goal);
        next.push(replacement.goal);
        return commit(next, 'The previous exercise goal was archived and a new goal was created.')
          ? { ok: true, goal: replacement.goal, archivedGoalId: goalId }
          : { ok: false, reason: 'save-failed' };
      }
      const next = scopedGoals().map(goal => goal.goalId === goalId ? {
        ...goal,
        targetValue,
        targetDate: targetDate || null,
        label: String(values.label || '').trim().slice(0, 80),
        updatedAt: timestamp
      } : goal);
      return commit(next, 'Strength goal updated.') ? { ok: true, goal: next.find(goal => goal.goalId === goalId) } : { ok: false, reason: 'save-failed' };
    }

    function setGuidance(goalId, enabled) {
      const current = goalById(goalId);
      if (!current || current.status !== 'active') return { ok: false, reason: 'Only an active goal can enable guidance.' };
      if (enabled) {
        const duplicate = scopedGoals().find(goal => goal.goalId !== goalId
          && !PAST_STATUSES.has(goal.status)
          && goal.exerciseId === current.exerciseId
          && goal.metric === current.metric
          && goal.guidanceEnabled === true);
        if (duplicate) return { ok: false, reason: 'Another goal for this exercise already has guidance enabled.' };
      }
      const timestamp = isoNow();
      const next = scopedGoals().map(goal => goal.goalId === goalId ? { ...goal, guidanceEnabled: Boolean(enabled), updatedAt: timestamp } : goal);
      return commit(next, enabled ? 'Guidance is on for future eligible Train cards.' : 'Guidance is off. The goal is still tracked.')
        ? { ok: true }
        : { ok: false, reason: 'save-failed' };
    }

    function transition(goalId, action) {
      const current = goalById(goalId);
      if (!current) return { ok: false, reason: 'Goal not found.' };
      const timestamp = isoNow();
      let replacement = null;
      if (action === 'pause' && current.status === 'active') replacement = { ...current, status: 'paused', guidanceEnabled: false, pausedAt: timestamp, updatedAt: timestamp };
      if (action === 'resume' && current.status === 'paused') replacement = { ...current, status: 'active', guidanceEnabled: false, resumedAt: timestamp, updatedAt: timestamp };
      if (action === 'archive' && !PAST_STATUSES.has(current.status)) replacement = { ...current, status: 'archived', guidanceEnabled: false, archivedAt: timestamp, updatedAt: timestamp };
      if (action === 'complete' && ACTIVE_STATUSES.has(current.status)) {
        const attainment = evidenceForGoal(current);
        if (attainment.state !== 'achieved') return { ok: false, reason: 'A completed target single is required before this goal can be completed.' };
        replacement = {
          ...current,
          status: 'completed',
          guidanceEnabled: false,
          attainmentState: 'achieved',
          attainmentEvidence: attainment.evidence,
          completedAt: timestamp,
          updatedAt: timestamp
        };
      }
      if (!replacement) return { ok: false, reason: 'That lifecycle action is not available.' };
      const message = action === 'pause' ? 'Goal paused. Guidance is off.'
        : action === 'resume' ? 'Goal resumed. Guidance remains off until you enable it again.'
          : action === 'complete' ? 'Goal completed and preserved in Past goals.'
            : 'Goal archived and preserved in Past goals.';
      const next = scopedGoals().map(goal => goal.goalId === goalId ? replacement : goal);
      return commit(next, message) ? { ok: true } : { ok: false, reason: 'save-failed' };
    }

    function deleteGoal(goalId) {
      const current = goalById(goalId);
      if (!current || !PAST_STATUSES.has(current.status)) return { ok: false, reason: 'Only a past goal can be permanently deleted.' };
      const next = scopedGoals().filter(goal => goal.goalId !== goalId);
      return commit(next, 'Past goal deleted permanently. Workouts and routines were not changed.')
        ? { ok: true }
        : { ok: false, reason: 'save-failed' };
    }

    function formatTarget(goal, exercise) {
      const basis = exercise?.measurement?.loadSemantics?.loadBasis;
      const suffix = basis === 'per_hand' ? ' per hand' : basis === 'per_side' ? ' per side' : ' total';
      return units?.formatLoad(goal.targetValue, getState(), { suffix }) || `${goal.targetValue.toLocaleString('en-US')} ${targetLabelFor(exercise)}`;
    }

    function evidenceMarkup(goal) {
      const evidence = evidenceForGoal(goal);
      if (goal.status === 'completed' && goal.attainmentState === 'achieved') {
        return '<span class="goal-attainment achieved">Achieved · completed target single</span>';
      }
      if (evidence.state === 'achieved') return '<span class="goal-attainment achieved">Target achieved · Completed single recorded</span>';
      if (evidence.state === 'estimated_reached') return `<span class="goal-attainment estimated">Estimated target reached · No target single logged</span><small>Best existing estimate: ${escapeHtml(displayLoad(evidence.bestEstimate))}</small>`;
      if (evidence.bestEstimate !== null) return `<span class="goal-attainment">Tracked · Best existing estimate ${escapeHtml(displayLoad(evidence.bestEstimate))}</span>`;
      return '<span class="goal-attainment">Tracked · No eligible completed evidence yet</span>';
    }

    function displayExposure(load, repTargets, workingSetCount) {
      const unique = [...new Set(list(repTargets))];
      const reps = unique.length === 1 ? unique[0] : list(repTargets).join('/');
      return `${displayLoad(load)} × ${reps} × ${workingSetCount}`;
    }

    function trajectoryMarkup(goal, exercise, evidence) {
      if (PAST_STATUSES.has(goal.status) || !exercise) return '';
      const engine = scope.BigGainsGoalsProgression;
      if (!engine?.projectTrajectory || !engine?.deadlineOutlook) return '';
      const current = goal.progressionState?.current;
      const recommendation = current && current.exerciseId === goal.exerciseId ? {
        enteredLoad: current.enteredLoad,
        workingSetCount: current.workingSetCount,
        repTargets: current.repTargets,
        repRange: current.repRange || { min: 4, max: 6 }
      } : null;
      const increment = exercise.measurement?.ui?.loadStep;
      const trajectory = engine.projectTrajectory({ recommendation, loadability: { increment } });
      const cadence = Number(scheduledExposuresPerWeek(goal.exerciseId));
      const exposuresPerWeek = Number.isFinite(cadence) && cadence > 0 ? cadence : null;
      const outlook = engine.deadlineOutlook({
        targetDate: goal.targetDate,
        evidenceCutoff: isoNow(),
        targetValue: goal.targetValue,
        currentEstimate: evidence.bestEstimate,
        exposuresPerWeek,
        recommendation,
        loadability: { increment }
      });
      const path = trajectory.status === 'available'
        ? `<p><strong>Current next exposure:</strong> ${escapeHtml(displayExposure(trajectory.current.enteredLoad, trajectory.current.repTargets, trajectory.current.workingSetCount))}</p>
          <p>${escapeHtml(trajectory.condition)}</p>
          <ol>${trajectory.steps.map(step => `<li><span>${step.decisionCode === 'INCREASE_LOAD' ? 'Then, if completed' : 'If completed'}</span><strong>${escapeHtml(displayExposure(step.enteredLoad, step.repTargets, step.workingSetCount))}</strong></li>`).join('')}</ol>
          <small>Conditional projection only. The path changes when actual performance differs.</small>`
        : '<p>A conditional path will appear after Train resolves a safe exact-exercise starting target.</p>';
      const cadenceCopy = exposuresPerWeek ? `<small>Saved routine cadence: about ${exposuresPerWeek} exposure${exposuresPerWeek === 1 ? '' : 's'} per week.</small>` : '';
      return `<details class="goal-trajectory">
        <summary>Path / trajectory</summary>
        ${path}
      </details>
      <section class="goal-deadline-outlook" data-deadline-status="${escapeHtml(outlook.status)}">
        <span>Deadline outlook</span><strong>${escapeHtml(outlook.label)}</strong>
        <p>${escapeHtml(outlook.explanation)}</p>${cadenceCopy}
        <small>The deadline explains the path; it never changes today's prescription.</small>
      </section>`;
    }

    function cardMarkup(goal) {
      const exercise = exerciseForGoal(goal);
      const evidence = evidenceForGoal(goal);
      const target = exercise ? formatTarget(goal, exercise) : `${goal.targetValue} ${goal.unit}`;
      const active = goal.status === 'active';
      const lifecycle = active ? 'Active' : goal.status === 'paused' ? 'Paused' : goal.status === 'completed' ? 'Completed' : 'Archived';
      const date = goal.targetDate ? `<span>Target date ${escapeHtml(goal.targetDate)}</span>` : '<span>No target date</span>';
      const completeDisabled = evidence.state !== 'achieved';
      const actions = PAST_STATUSES.has(goal.status) ? `
        <div class="goal-card-actions goal-past-actions">
          <button class="ghost compact danger" type="button" data-goal-action="delete" data-goal-id="${escapeHtml(goal.goalId)}">Delete permanently</button>
        </div>` : `
        <div class="goal-card-actions">
          <button class="ghost compact" type="button" data-goal-action="edit" data-goal-id="${escapeHtml(goal.goalId)}">Edit</button>
          <button class="ghost compact" type="button" data-goal-action="${active ? 'pause' : 'resume'}" data-goal-id="${escapeHtml(goal.goalId)}">${active ? 'Pause' : 'Resume'}</button>
          <button class="ghost compact" type="button" data-goal-action="complete" data-goal-id="${escapeHtml(goal.goalId)}" ${completeDisabled ? 'disabled title="Log a completed target single first"' : ''}>Complete</button>
          <button class="ghost compact danger" type="button" data-goal-action="archive" data-goal-id="${escapeHtml(goal.goalId)}">Remove</button>
        </div>`;
      const guidance = PAST_STATUSES.has(goal.status) ? '' : `
        <label class="goal-guidance-toggle">
          <input type="checkbox" data-goal-guidance="${escapeHtml(goal.goalId)}" ${goal.guidanceEnabled ? 'checked' : ''} ${active ? '' : 'disabled'}>
          <span><strong>Use this goal to guide workouts</strong><small>${goal.guidanceEnabled ? 'On · Future eligible Train cards may use this goal.' : 'Off · Tracking only.'}</small></span>
        </label>`;
      return `<article class="goal-card" data-goal-id="${escapeHtml(goal.goalId)}">
        <header><div><span class="label">${escapeHtml(lifecycle)} strength goal</span><h3>${escapeHtml(exercise?.name || 'Unavailable exercise')}</h3></div><strong class="goal-target">${escapeHtml(target)}</strong></header>
        ${goal.label ? `<p class="goal-label">${escapeHtml(goal.label)}</p>` : ''}
        <div class="goal-card-meta"><span>1RM target</span>${date}</div>
        <div class="goal-evidence">${evidenceMarkup(goal)}</div>
        ${scope.BigGainsProgramSetup?.goalSupportMarkup?.(goal) || ''}
        ${guidance}
        ${goal.guidanceEnabled ? '<p class="goal-guidance-note">Guidance applies only when Train can build a safe exact-exercise target. Routines and completed history stay unchanged.</p>' : ''}
        ${trajectoryMarkup(goal, exercise, evidence)}
        ${actions}
      </article>`;
    }

    function renderToday() {
      const goals = scopedGoals().filter(goal => ACTIVE_STATUSES.has(goal.status));
      const button = $('todayGoalsOpen');
      if (!button) return;
      const headline = $('todayGoalsHeadline');
      const detail = $('todayGoalsDetail');
      const status = $('todayGoalsStatus');
      if (!goals.length) {
        headline.textContent = 'Set a strength goal';
        detail.textContent = 'Choose one exact exercise and define the destination.';
        status.textContent = 'No active goals';
        button.dataset.goalState = 'empty';
        return;
      }
      const primary = goals.find(goal => goal.status === 'active') || goals[0];
      const exercise = exerciseForGoal(primary);
      headline.textContent = exercise?.name || 'Strength goal';
      detail.textContent = `Target ${formatTarget(primary, exercise)} · Guidance ${primary.guidanceEnabled ? 'on' : 'off'}`;
      status.textContent = `${goals.length} active goal${goals.length === 1 ? '' : 's'}`;
      button.dataset.goalState = 'active';
    }

    function render() {
      renderToday();
      const activeList = $('activeGoalsList');
      const pastList = $('pastGoalsList');
      if (!activeList || !pastList) return;
      const goals = scopedGoals();
      const activeGoals = goals.filter(goal => ACTIVE_STATUSES.has(goal.status));
      const pastGoals = goals.filter(goal => PAST_STATUSES.has(goal.status));
      activeList.innerHTML = activeGoals.length ? activeGoals.map(cardMarkup).join('') : '<div class="goals-empty"><strong>No strength goals yet.</strong><p>Create one exact-exercise 1RM destination. Guidance starts off, so Train stays yours.</p></div>';
      pastList.innerHTML = pastGoals.length ? pastGoals.map(cardMarkup).join('') : '<p class="empty">Completed and archived goals will stay here.</p>';
      $('goalsActiveCount').textContent = `${activeGoals.length} active`;
      const pastSection = $('pastGoalsSection');
      if (pastSection) pastSection.hidden = !pastGoals.length;
    }

    function renderExerciseOptions(term = '', selectedId = '') {
      const select = $('goalExerciseSelect');
      if (!select) return;
      const eligible = scope.BigGainsExercisePicker
        ? scope.BigGainsExercisePicker.filterExercises({ catalog, exercises: eligibleExercises(catalog), term })
        : eligibleExercises(catalog).filter(exercise => catalog.matchesSearch(exercise, term));
      select.innerHTML = eligible.map(exercise => `<option value="${escapeHtml(exercise.canonicalId)}">${escapeHtml(exercise.name)} — ${escapeHtml(targetLabelFor(exercise, preferredUnit()))}</option>`).join('');
      if (selectedId && eligible.some(exercise => exercise.canonicalId === selectedId)) select.value = selectedId;
      select.disabled = !eligible.length;
      $('saveGoal').disabled = !eligible.length;
      $('goalExerciseNoResults').hidden = Boolean(eligible.length);
      renderExerciseChoice();
    }

    function renderExerciseChoice() {
      const selected = catalog.getById($('goalExerciseSelect')?.value);
      const choice = $('goalExerciseChoice');
      if (choice) choice.textContent = selected ? `${selected.name} — ${targetLabelFor(selected, preferredUnit())}` : 'Choose an eligible exercise';
    }

    function openExercisePicker() {
      if (!picker) return false;
      return picker.open({
        title: 'Choose a strength-goal exercise',
        prompt: 'Only exact exercises with approved EKF external-load 1RM semantics are available.',
        currentExerciseId: $('goalExerciseSelect').value,
        eligibilityPredicate: isEligibleExercise,
        suggestionLabel: 'Suggested for strength goals',
        returnFocus: () => $('chooseGoalExercise'),
        onSelect: canonicalId => {
          renderExerciseOptions('', canonicalId);
          $('goalExerciseSelect').value = canonicalId;
          renderExerciseChoice();
        }
      });
    }

    function openEditor(goalId = null) {
      const goal = goalId ? goalById(goalId) : null;
      editingGoalId = goal?.goalId || null;
      $('goalForm').reset();
      $('goalFormError').textContent = '';
      $('goalDialogTitle').textContent = goal ? 'Edit strength goal' : 'Create strength goal';
      $('saveGoal').textContent = goal ? 'Save changes' : 'Create goal';
      $('goalExerciseSearch').value = '';
      renderExerciseOptions('', goal?.exerciseId || '');
      if (goal) {
        $('goalExerciseSelect').value = goal.exerciseId;
        $('goalTargetValue').value = String(units?.inputValue(goal.targetValue, getState()) ?? goal.targetValue);
        $('goalTargetDate').value = goal.targetDate || '';
        $('goalLabel').value = goal.label || '';
      }
      renderExerciseChoice();
      const dialog = $('goalDialog');
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
    }

    function closeEditor() {
      const dialog = $('goalDialog');
      if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
      editingGoalId = null;
    }

    function formValues() {
      return {
        exerciseId: $('goalExerciseSelect').value,
        targetValue: units?.toCanonicalPounds($('goalTargetValue').value, preferredUnit()) ?? $('goalTargetValue').value,
        targetDate: $('goalTargetDate').value,
        label: $('goalLabel').value
      };
    }

    function handleFormSubmit(event) {
      event.preventDefault();
      const result = editingGoalId ? editGoal(editingGoalId, formValues()) : createGoal(formValues());
      if (!result.ok) {
        $('goalFormError').textContent = result.reason === 'save-failed' ? 'The goal was not saved.' : result.reason;
        return;
      }
      closeEditor();
    }

    function handleAction(event) {
      const viewProgram = event.target.closest('[data-goal-view-program]');
      if (viewProgram) return scope.BigGainsProgramSetup?.openProgramDetail?.({ returnView: 'goals' });
      const button = event.target.closest('[data-goal-action]');
      if (!button) return;
      const { goalAction: action, goalId } = button.dataset;
      if (action === 'edit') return openEditor(goalId);
      if (action === 'delete') {
        const goal = goalById(goalId);
        if (!goal || !PAST_STATUSES.has(goal.status)) return setNotice('Only a past goal can be permanently deleted.', 'error');
        const exercise = exerciseForGoal(goal);
        if (!confirmDelete(`Delete the past ${exercise?.name || 'strength'} goal permanently? Workouts, history, and routines will stay unchanged.`)) return;
        const result = deleteGoal(goalId);
        if (!result.ok) setNotice(result.reason, 'error');
        return;
      }
      const result = transition(goalId, action);
      if (!result.ok) setNotice(result.reason, 'error');
    }

    function handleGuidance(event) {
      const input = event.target.closest('[data-goal-guidance]');
      if (!input) return;
      const result = setGuidance(input.dataset.goalGuidance, input.checked);
      if (!result.ok) {
        input.checked = !input.checked;
        setNotice(result.reason, 'error');
      }
    }

    function initialize() {
      if (initialized) return false;
      initialized = true;
      $('todayGoalsOpen')?.addEventListener('click', () => scope.bigGainsViewShell?.showView('goals', { workout: false }));
      $('goalsOpenPlan')?.addEventListener('click', () => scope.BigGainsProgramSetup?.openPlan?.());
      $('goalsBackToday')?.addEventListener('click', () => {
        if (scope.BigGainsProgramSetup?.returnFromGoal?.()) return;
        scope.bigGainsViewShell?.showView('today', { workout: false });
      });
      $('createStrengthGoal')?.addEventListener('click', () => openEditor());
      $('goalForm')?.addEventListener('submit', handleFormSubmit);
      $('cancelGoal')?.addEventListener('click', closeEditor);
      $('closeGoalDialog')?.addEventListener('click', closeEditor);
      $('goalDialog')?.addEventListener('click', event => { if (event.target === $('goalDialog')) closeEditor(); });
      $('goalExerciseSearch')?.addEventListener('input', event => renderExerciseOptions(event.target.value, $('goalExerciseSelect').value));
      $('goalExerciseSelect')?.addEventListener('change', renderExerciseChoice);
      $('chooseGoalExercise')?.addEventListener('click', openExercisePicker);
      $('activeGoalsList')?.addEventListener('click', handleAction);
      $('activeGoalsList')?.addEventListener('change', handleGuidance);
      $('pastGoalsList')?.addEventListener('click', handleAction);
      render();
      return true;
    }

    return Object.freeze({
      createGoal,
      deleteGoal,
      editGoal,
      evidenceForGoal,
      initialize,
      render,
      setGuidance,
      transition
    });
  }

  Object.defineProperty(scope, 'BigGainsGoals', {
    configurable: false,
    enumerable: true,
    value: Object.freeze({ create, eligibleExercises, isEligibleExercise, metric: METRIC, policy: POLICY, targetBasisFor }),
    writable: false
  });
})(typeof window === 'object' ? window : globalThis);
