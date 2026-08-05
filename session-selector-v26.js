(() => {
  'use strict';

  const SELECTOR_ID = 'sessionTypeSelector';
  const SESSION_TYPES = [
    { key: 'Push', label: 'Push', detail: 'Chest, shoulders, triceps', index: '01' },
    { key: 'Pull', label: 'Pull', detail: 'Back, rear delts, biceps', index: '02' },
    { key: 'Legs', label: 'Legs', detail: 'Quads, glutes, hamstrings', index: '03' },
    { key: 'Core', label: 'Core', detail: 'Abs, bracing, trunk work', index: '04' },
    { key: 'FullBody', label: 'Full Body', detail: 'One pass across the whole system', index: '05' },
    { key: 'Cardio', label: 'Conditioning', detail: 'Intervals, classes, cardio', index: '06' }
  ];

  let selectedType = 'Push';

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
    const button = document.querySelector(`.bottom-nav [data-view="${view}"]`);
    button?.click();
  }

  function selectType(key) {
    if (!SESSION_TYPES.some(item => item.key === key)) return;
    selectedType = key;
    if (typeof selectedDay !== 'undefined') selectedDay = key;
    render();
  }

  function startSelected() {
    const session = currentWorkout();
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
    const shouldLoadRoutine = Boolean(usesPlan);

    goTo('train');
    window.setTimeout(() => {
      if (typeof startWorkout === 'function') startWorkout(workoutType, shouldLoadRoutine);
      render();
    }, 30);
  }

  function openLibrary() {
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
    card.setAttribute('aria-labelledby', 'sessionSelectorTitle');
    card.innerHTML = `
      <div class="session-selector-head">
        <div>
          <span class="label">Choose the work</span>
          <h2 id="sessionSelectorTitle">What are we training?</h2>
        </div>
        <span class="session-plan-chip" id="sessionPlanChip"></span>
      </div>
      <div class="session-type-grid" id="sessionTypeGrid"></div>
      <div class="session-selector-summary">
        <div>
          <span class="label">Selected session</span>
          <strong id="selectedSessionLabel">Push</strong>
          <p id="selectedSessionNote"></p>
        </div>
        <div class="session-selector-actions">
          <button class="primary" id="quickStartSession" type="button">Quick start</button>
          <button class="secondary" id="openSessionLibrary" type="button">Open Library</button>
        </div>
      </div>
    `;

    legacyHero.insertAdjacentElement('beforebegin', card);
    document.body.classList.add('session-selector-ready');

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
          <button class="session-type-option${isSelected ? ' is-selected' : ''}${isPlanned ? ' is-planned' : ''}" type="button" data-session-type="${item.key}" aria-pressed="${isSelected}">
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
      if (note) note.textContent = `${session.exercises?.length || 0} movements saved. Pick up exactly where you left off.`;
      if (quickButton) quickButton.textContent = `Resume ${displayName(session.type)}`;
    } else if (matchesPlan) {
      if (note) note.textContent = `Today’s planned routine is ${displayName(planned)}. Start it loaded, or open the Library first.`;
      if (quickButton) quickButton.textContent = 'Start today’s plan';
    } else {
      if (note) note.textContent = `Quick start opens an empty ${selected.label.toLowerCase()} session. Library opens the filtered shelf.`;
      if (quickButton) quickButton.textContent = 'Quick start';
    }

    if (planChip) {
      planChip.textContent = planned === 'Rest' ? 'Recovery day' : `Plan · ${displayName(planned)}`;
      planChip.dataset.state = planned === 'Rest' ? 'rest' : 'planned';
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

    document.getElementById('dayTabs')?.addEventListener('click', event => {
      const button = event.target.closest('[data-day]');
      const normalized = normalizeType(button?.dataset.day);
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
