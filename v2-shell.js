(() => {
  'use strict';

  const views = [...document.querySelectorAll('.view')];
  const navButtons = [...document.querySelectorAll('.bottom-nav [data-view]')];
  const activePanel = document.getElementById('activePanel');
  const validViews = new Set(['today', 'plan', 'goals', 'train', 'history', 'calendar', 'progress', 'library']);
  let initialized = false;

  function showView(name, options = {}) {
    const historyView = options.historyView || (name === 'calendar' ? 'calendar' : name === 'history' ? 'list' : null);
    const viewName = historyView ? 'progress' : name;
    const target = document.getElementById(`view${viewName[0].toUpperCase()}${viewName.slice(1)}`);
    if (!target) return;
    views.forEach(view => view.classList.toggle('is-active', view === target));
    const ownerView = viewName === 'goals' ? 'plan' : viewName;
    navButtons.forEach(button => {
      const active = button.dataset.view === ownerView;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.body.dataset.view = viewName;
    document.body.dataset.route = historyView ? `history-${historyView}` : viewName;
    document.body.classList.toggle('workout-focus', viewName === 'train' && activePanel && !activePanel.classList.contains('hidden'));
    if (viewName === 'train' && options.workout !== false && activePanel && !activePanel.classList.contains('hidden')) {
      window.bigGainsWorkoutMode?.enter({ showView: false });
    } else if (viewName !== 'train' && document.body.classList.contains('workout-mode')) {
      window.bigGainsWorkoutMode?.suspend();
    }
    if (viewName === 'progress') {
      if (historyView) window.workoutProgress?.openHistory(historyView);
      else window.workoutProgress?.showOverview();
    }
    const savedView = historyView === 'calendar' ? 'calendar' : historyView === 'list' ? 'history' : viewName;
    try { sessionStorage.setItem('big-gains-view', savedView); } catch {}
    if (options.scroll !== false) window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;

    navButtons.forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showView(button.dataset.view);
    }, true));

    document.getElementById('startWorkout')?.addEventListener('click', () => {
      setTimeout(() => showView('train'), 0);
    });

    document.getElementById('loadRoutine')?.addEventListener('click', () => {
      setTimeout(() => showView('train'), 0);
    });

    document.getElementById('finishWorkout')?.addEventListener('click', () => {
      setTimeout(() => {
        const completion = document.getElementById('workoutCompletion');
        if (activePanel?.classList.contains('hidden') && completion?.classList.contains('hidden')) showView('today');
      }, 80);
    });

    document.getElementById('cancelWorkout')?.addEventListener('click', () => {
      setTimeout(() => {
        if (activePanel?.classList.contains('hidden')) showView('today');
      }, 100);
    });

    if (activePanel) {
      new MutationObserver(() => {
        const active = !activePanel.classList.contains('hidden');
        document.body.classList.toggle('workout-focus', document.body.dataset.view === 'train' && active);
        const empty = document.querySelector('.train-empty');
        if (empty) empty.hidden = active;
      }).observe(activePanel, { attributes: true, attributeFilter: ['class'] });
    }

    const requested = location.hash.replace('#', '');
    const saved = (() => { try { return sessionStorage.getItem('big-gains-view'); } catch { return null; } })();
    const hasActiveWorkout = activePanel && !activePanel.classList.contains('hidden');
    const explicitlyExited = window.bigGainsWorkoutMode?.wasExplicitlyExited();
    const initial = validViews.has(requested)
      ? requested
      : (hasActiveWorkout && !explicitlyExited ? 'train' : (validViews.has(saved) ? saved : 'today'));
    showView(initial, { instant: true, scroll: false, workout: !explicitlyExited });
    return true;
  }

  window.bigGainsViewShell = Object.freeze({ initialize, showView });
})();
