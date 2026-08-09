(() => {
  'use strict';

  const SELECTOR_ID = 'sessionTypeSelector';
  const DEFAULT_SESSION_TYPES = [
    { key: 'Push', label: 'Push', detail: 'Chest, shoulders, triceps', index: '01' },
    { key: 'Pull', label: 'Pull', detail: 'Back, rear delts, biceps', index: '02' },
    { key: 'Legs', label: 'Legs', detail: 'Quads, glutes, hamstrings', index: '03' },
    { key: 'Core', label: 'Core', detail: 'Abs, bracing, trunk work', index: '04' },
    { key: 'FullBody', label: 'Full Body', detail: 'Whole-body strength', index: '05' },
    { key: 'Cardio', label: 'Conditioning', detail: 'Intervals, classes, cardio', index: '06' }
  ];
  const SESSION_TYPES = (PROFILE.sessionTypes || DEFAULT_SESSION_TYPES).map(type => ({ ...type }));

  let selectedType = 'Push';
  let expanded = false;
  let initialized = false;

  function normalizeType(value) {
    if (SESSION_TYPES.some(item => item.key === value)) return value;
    const map = {
      Push: 'Push',
      Pull: 'Pull',
      PilatesPull: 'Pull',
      Legs: 'Legs',
      LegsLowImpact: 'Legs',
      Core: 'Core',
      FullBody: 'FullBody',
      Cardio: 'Cardio',
      Conditioning: 'Cardio',
      PilatesCardioAccessory: 'Cardio'
    };
    return map[value] || null;
  }

  function plannedWorkout() {
    return typeof todaysWorkout === 'function' ? todaysWorkout() : null;
  }

  function currentWorkout() {
    return typeof active !== 'undefined' && active ? active : null;
  }

  function displayName(key) {
    const found = SESSION_TYPES.find(item => item.key === normalizeType(key));
    if (found) return found.label;
    if (typeof displayWorkout === 'function') return displayWorkout(key);
    return key || 'Workout';
  }

  function goTo(view) {
    document.querySelector(`.bottom-nav [data-view="${view}"]`)?.click();
  }

  function setExpanded(next) {
    expanded = Boolean(next);
    const card = document.getElementById(SELECTOR_ID);
    const toggle = card?.querySelector('#sessionSelectorToggle');
    const body = card?.querySelector('#sessionSelectorBody');
    card?.classList.toggle('is-expanded', expanded);
    toggle?.setAttribute('aria-expanded', String(expanded));
    if (body) body.hidden = !expanded;
  }

  function repairEmptySession(session) {
    if (!session || (session.exercises || []).length || typeof loadRoutine !== 'function') return false;
    if (!normalizeType(session.type)) return false;

    try {
      loadRoutine(session.type, false);
      return (session.exercises || []).length > 0;
    } catch (error) {
      console.warn('Could not repair empty workout', error);
      return false;
    }
  }

  function selectType(key) {
    if (currentWorkout()) {
      setExpanded(false);
      return;
    }
    if (!SESSION_TYPES.some(item => item.key === key)) return;
    selectedType = key;
    if (typeof selectedDay !== 'undefined') selectedDay = key;
    render();
    setExpanded(false);
  }

  function startSelected() {
    const session = currentWorkout();
    setExpanded(false);

    if (session) {
      repairEmptySession(session);
      goTo('train');
      window.setTimeout(() => {
        if (typeof showActive === 'function') showActive(true);
      }, 30);
      return;
    }

    const planned = plannedWorkout();
    const usesPlan = planned && planned !== 'Rest' && normalizeType(planned) === selectedType;
    const workoutType = usesPlan ? planned : selectedType;

    goTo('train');
    window.setTimeout(() => {
      if (typeof startWorkout === 'function') startWorkout(workoutType, true);
      render();
    }, 30);
  }

  function openLibrary() {
    setExpanded(false);
    if (typeof selectedDay !== 'undefined') selectedDay = selectedType;
    const equipment = document.getElementById('equipmentFilter');
    const search = document.getElementById('exerciseSearch');
    if (equipment) equipment.value = 'all';
    if (search) search.value = '';
    if (typeof renderLibrary === 'function') renderLibrary();
    goTo('library');
    window.setTimeout(() => {
      document.getElementById('workoutPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function renderTrainPreview({ session, plannedType }) {
    const preview = document.getElementById('trainPreview');
    if (!preview) return;
    preview.hidden = Boolean(session);
    if (session) return;

    const selected = SESSION_TYPES.find(item => item.key === selectedType) || SESSION_TYPES[0];
    const routineIds = typeof routineFor === 'function' ? routineFor(selectedType) : [];
    const exercises = routineIds.map(id => typeof EXERCISES !== 'undefined'
      ? EXERCISES.find(exercise => exercise.id === id)
      : null).filter(Boolean);
    const safe = typeof escapeHtml === 'function' ? escapeHtml : value => String(value);
    const picker = document.getElementById('trainPlanPicker');
    const title = document.getElementById('trainPreviewTitle');
    const kicker = document.getElementById('trainPreviewKicker');
    const meta = document.getElementById('trainPreviewMeta');
    const count = document.getElementById('trainPreviewCount');
    const list = document.getElementById('trainPreviewExercises');

    preview.dataset.workoutType = selectedType;
    if (picker) picker.innerHTML = SESSION_TYPES.map(item => `
      <button type="button" data-train-plan="${item.key}" aria-pressed="${item.key === selectedType}">${item.label}</button>
    `).join('');
    if (title) title.textContent = selected.label;
    if (kicker) kicker.textContent = plannedType === selectedType ? 'Today’s plan' : 'Selected workout';
    if (meta) meta.textContent = `${exercises.length} movement${exercises.length === 1 ? '' : 's'} · ${state.customRoutines?.[selectedType] ? 'Custom lineup' : 'Saved lineup'}`;
    if (count) count.textContent = String(exercises.length).padStart(2, '0');
    if (list) list.innerHTML = exercises.length ? exercises.map((exercise, index) => {
      const prescription = typeof routinePrescription === 'function' ? routinePrescription(selectedType, exercise.id) : null;
      const support = prescription?.targetReps
        ? `${prescription.workingSets} working sets · Target ${prescription.targetReps}`
        : `${exercise.equipment} · ${exercise.muscle}`;
      return `
      <article class="train-preview-row">
        <span class="train-preview-index">${String(index + 1).padStart(2, '0')}</span>
        <div><strong>${safe(exercise.name)}</strong><small>${safe(support)}</small></div>
        <span class="train-preview-arrow" aria-hidden="true">→</span>
      </article>
    `;}).join('') : '<div class="train-preview-empty">Start blank, then add movements from the library.</div>';
  }

  function render() {
    const card = document.getElementById(SELECTOR_ID);
    if (!card) return;

    const session = currentWorkout();
    const planned = plannedWorkout();
    const plannedType = planned === 'Rest' ? null : normalizeType(planned);
    if (session) selectedType = normalizeType(session.type) || selectedType;

    const grid = card.querySelector('#sessionTypeGrid');
    if (grid) {
      grid.innerHTML = SESSION_TYPES.map(item => {
        const isSelected = item.key === selectedType;
        const isPlanned = item.key === plannedType;
        return `
          <button class="session-type-option${isSelected ? ' is-selected' : ''}${isPlanned ? ' is-planned' : ''}" type="button" data-session-type="${item.key}" aria-pressed="${isSelected}"${session ? ' disabled' : ''}>
            <span class="session-type-index">${item.index}</span>
            <span class="session-type-copy"><strong>${item.label}</strong><small>${item.detail}</small></span>
            ${isPlanned ? '<span class="session-type-badge">Today</span>' : ''}
          </button>
        `;
      }).join('');
    }

    const selected = SESSION_TYPES.find(item => item.key === selectedType) || SESSION_TYPES[0];
    const matchesPlan = plannedType === selectedType && planned && planned !== 'Rest';
    const label = card.querySelector('#selectedSessionLabel');
    const note = card.querySelector('#selectedSessionNote');
    const planChip = card.querySelector('#sessionPlanChip');
    const quickButton = card.querySelector('#quickStartSession');

    if (label) label.textContent = session ? displayName(session.type) : selected.label;

    if (session) {
      if (planChip) planChip.textContent = `Active · ${session.exercises?.length || 0} movements`;
      if (note) note.textContent = 'An active workout is already open.';
      if (quickButton) quickButton.textContent = 'Resume';
    } else if (matchesPlan) {
      if (planChip) planChip.textContent = 'Today’s plan';
      if (note) note.textContent = `${displayName(planned)} is ready with your saved routine.`;
      if (quickButton) quickButton.textContent = 'Start';
    } else {
      if (planChip) planChip.textContent = planned === 'Rest' ? 'Recovery day' : `Plan · ${displayName(planned)}`;
      if (note) note.textContent = `${selected.label} will load your saved routine.`;
      if (quickButton) quickButton.textContent = 'Start';
    }
    renderTrainPreview({ session, plannedType });
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    repairEmptySession(currentWorkout());

    const planned = plannedWorkout();
    selectedType = normalizeType(currentWorkout()?.type)
      || (planned !== 'Rest' ? normalizeType(planned) : null)
      || (typeof selectedDay !== 'undefined' ? normalizeType(selectedDay) : null)
      || 'Push';

    render();
    setExpanded(false);

    const card = document.getElementById(SELECTOR_ID);
    card?.querySelector('#sessionSelectorToggle')?.addEventListener('click', () => setExpanded(!expanded));
    card?.querySelector('#sessionTypeGrid')?.addEventListener('click', event => {
      const button = event.target.closest('[data-session-type]');
      if (button) selectType(button.dataset.sessionType);
    });
    card?.querySelector('#quickStartSession')?.addEventListener('click', startSelected);
    card?.querySelector('#openSessionLibrary')?.addEventListener('click', openLibrary);
    document.getElementById('trainPlanPicker')?.addEventListener('click', event => {
      const button = event.target.closest('[data-train-plan]');
      if (button) selectType(button.dataset.trainPlan);
    });
    document.getElementById('trainPreviewStart')?.addEventListener('click', startSelected);

    document.getElementById('dayTabs')?.addEventListener('click', event => {
      const normalized = normalizeType(event.target.closest('[data-day]')?.dataset.day);
      if (normalized) {
        selectedType = normalized;
        window.setTimeout(render, 0);
      }
    });

    ['finishWorkout', 'cancelWorkout', 'loadRoutine', 'startWorkout'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => window.setTimeout(render, 120));
    });

    document.getElementById('profileSelect')?.addEventListener('change', () => window.setTimeout(render, 0));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) render();
    });
    return true;
  }

  window.sessionSelector = Object.freeze({ initialize, render });
})();
