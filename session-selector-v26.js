(() => {
  'use strict';

  const SELECTOR_ID = 'sessionTypeSelector';
  const SESSION_TYPES = [
    { key: 'Push', label: 'Push', detail: 'Chest, shoulders, triceps', index: '01' },
    { key: 'Pull', label: 'Pull', detail: 'Back, rear delts, biceps', index: '02' },
    { key: 'Legs', label: 'Legs', detail: 'Quads, glutes, hamstrings', index: '03' },
    { key: 'Core', label: 'Core', detail: 'Abs, bracing, trunk work', index: '04' },
    { key: 'FullBody', label: 'Full Body', detail: 'Whole-body strength', index: '05' },
    { key: 'Cardio', label: 'Conditioning', detail: 'Intervals, classes, cardio', index: '06' }
  ];

  let selectedType = 'Push';
  let expanded = false;

  function normalizeType(value) {
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

  function ensureRoutineTypes() {
    if (typeof DEFAULT_ROUTINES === 'undefined') return;

    if (!DEFAULT_ROUTINES.Core) {
      DEFAULT_ROUTINES.Core = {
        label: 'Core',
        exercises: [
          'Cable Crunch',
          'Hanging Knee Raise',
          'Hanging Leg Raise',
          'Ab Wheel Rollout',
          'Plank',
          'Side Plank',
          'Pallof Press',
          'Machine Crunch',
          'Russian Twist',
          'Dead Bug'
        ]
      };
    }

    if (DEFAULT_ROUTINES.Cardio) DEFAULT_ROUTINES.Cardio.label = 'Conditioning';
  }

  function alignLibraryTabs() {
    const tabs = document.getElementById('dayTabs');
    if (!tabs) return;

    const legsButton = tabs.querySelector('[data-day="Legs"]');
    if (legsButton) legsButton.textContent = 'Legs';

    if (!tabs.querySelector('[data-day="Core"]')) {
      const coreButton = document.createElement('button');
      coreButton.type = 'button';
      coreButton.dataset.day = 'Core';
      coreButton.textContent = 'Core';
      legsButton?.insertAdjacentElement('afterend', coreButton);
    }

    const cardioButton = tabs.querySelector('[data-day="Cardio"]');
    if (cardioButton) cardioButton.textContent = 'Conditioning';
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
      if (typeof startWorkout === 'function') startWorkout(workoutType, Boolean(usesPlan));
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

  function buildCard() {
    const todayStage = document.querySelector('#viewToday .today-stage');
    const legacyHero = todayStage?.querySelector('.hero-card');
    if (!todayStage || !legacyHero || document.getElementById(SELECTOR_ID)) return;

    const card = document.createElement('section');
    card.id = SELECTOR_ID;
    card.className = 'session-selector-card';
    card.setAttribute('aria-label', 'Workout session selector');
    card.innerHTML = `
      <div class="session-selector-bar">
        <button class="session-selector-toggle" id="sessionSelectorToggle" type="button" aria-expanded="false" aria-controls="sessionSelectorBody">
          <span class="session-selector-kicker">Session</span>
          <span class="session-selector-current">
            <strong id="selectedSessionLabel">Push</strong>
            <small id="sessionPlanChip"></small>
          </span>
          <span class="session-selector-chevron" aria-hidden="true">⌄</span>
        </button>
        <button class="primary session-start-button" id="quickStartSession" type="button">Start</button>
      </div>
      <div class="session-selector-body" id="sessionSelectorBody" hidden>
        <div class="session-type-grid" id="sessionTypeGrid"></div>
        <div class="session-selector-footer">
          <small id="selectedSessionNote"></small>
          <button class="ghost compact" id="openSessionLibrary" type="button">Open Library</button>
        </div>
      </div>
    `;

    legacyHero.insertAdjacentElement('beforebegin', card);
    document.body.classList.add('session-selector-ready');

    card.querySelector('#sessionSelectorToggle')?.addEventListener('click', () => setExpanded(!expanded));
    card.querySelector('#sessionTypeGrid')?.addEventListener('click', event => {
      const button = event.target.closest('[data-session-type]');
      if (button) selectType(button.dataset.sessionType);
    });
    card.querySelector('#quickStartSession')?.addEventListener('click', startSelected);
    card.querySelector('#openSessionLibrary')?.addEventListener('click', openLibrary);
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
      if (note) note.textContent = `${selected.label} will open as an empty quick session.`;
      if (quickButton) quickButton.textContent = 'Quick start';
    }
  }

  function boot() {
    ensureRoutineTypes();
    alignLibraryTabs();

    const planned = plannedWorkout();
    selectedType = normalizeType(currentWorkout()?.type)
      || (planned !== 'Rest' ? normalizeType(planned) : null)
      || (typeof selectedDay !== 'undefined' ? normalizeType(selectedDay) : null)
      || 'Push';

    buildCard();
    render();
    setExpanded(false);

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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
