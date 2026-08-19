(() => {
  'use strict';

  const views = [...document.querySelectorAll('.view')];
  const navButtons = [...document.querySelectorAll('.bottom-nav [data-view]')];
  const activePanel = document.getElementById('activePanel');
  const validViews = new Set(['today', 'goals', 'train', 'calendar', 'progress', 'library']);
  let initialized = false;

  function showView(name, options = {}) {
    const target = document.getElementById(`view${name[0].toUpperCase()}${name.slice(1)}`);
    if (!target) return;
    views.forEach(view => view.classList.toggle('is-active', view === target));
    navButtons.forEach(button => button.classList.toggle('active', button.dataset.view === name));
    document.body.dataset.view = name;
    document.body.classList.toggle('workout-focus', name === 'train' && activePanel && !activePanel.classList.contains('hidden'));
    if (name === 'train' && options.workout !== false && activePanel && !activePanel.classList.contains('hidden')) {
      window.bigGainsWorkoutMode?.enter({ showView: false });
    } else if (name !== 'train' && document.body.classList.contains('workout-mode')) {
      window.bigGainsWorkoutMode?.suspend();
    }
    try { sessionStorage.setItem('big-gains-view', name); } catch {}
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

    document.getElementById('addSelectedExercise')?.addEventListener('click', () => {
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
