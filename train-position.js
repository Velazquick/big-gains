/* Device-local viewport memory. Never a training cursor or sync payload. */
(() => {
  'use strict';
  const keyFor = context => `big-gains-train-position-v1:${JSON.stringify([context.namespace, context.accountId, context.profileId])}`;
  const ids = rows => (rows || []).map(row => row.id).filter(id => typeof id === 'string');
  function nearest(id, oldOrder, liveIds) {
    if (liveIds.includes(id)) return id;
    const index = oldOrder.indexOf(id);
    if (index >= 0) {
      for (const candidate of oldOrder.slice(index + 1)) if (liveIds.includes(candidate)) return candidate;
      for (const candidate of oldOrder.slice(0, index).reverse()) if (liveIds.includes(candidate)) return candidate;
    }
    return liveIds[0] || null;
  }
  function resolve(record, workout) {
    if (!record || record.workoutId !== workout?.id) return null;
    const exerciseId = nearest(record.exerciseId, record.exerciseOrder || [], ids(workout.exercises));
    const exercise = workout.exercises.find(item => item.id === exerciseId);
    if (!exercise) return null;
    const setId = exerciseId === record.exerciseId && record.setId
      ? nearest(record.setId, record.setOrder || [], ids(exercise.sets)) : null;
    return { exerciseId, setId };
  }
  function create({ getContext, root = document, host = window, storage = () => localStorage }) {
    let record = null, scope = null, pending = null, epoch = 0, background = false;
    let scheduled = false, coldChecked = false;
    const interactive = () => root.documentElement.dataset.runtimeState === 'interactive';
    const laidOut = () => interactive() && root.documentElement.dataset.bootState !== 'unresolved' && root.documentElement.dataset.bootState !== 'recovery';
    const onTrain = () => root.body.dataset.view === 'train';
    const visible = () => root.visibilityState === 'visible';
    function write() {
      if (!scope || !record) return;
      try { storage().setItem(scope.key, JSON.stringify(record)); } catch { /* Position only. */ }
    }
    function context() {
      if (!interactive()) return null;
      const current = getContext();
      if (!current?.workout?.id || !current.accountId || !current.profileId || !current.namespace) return null;
      const key = keyFor(current);
      if (scope?.key !== key || scope.workoutId !== current.workout.id) {
        pending = null; epoch++;
        scope = { key, workoutId: current.workout.id };
        record = null;
        try {
          const saved = JSON.parse(storage().getItem(key) || 'null');
          if (saved?.version === 1 && saved.workoutId === current.workout.id
              && typeof saved.exerciseId === 'string'
              && Array.isArray(saved.exerciseOrder) && saved.exerciseOrder.every(id => typeof id === 'string')
              && Array.isArray(saved.setOrder) && saved.setOrder.every(id => typeof id === 'string')
              && (saved.setId === null || typeof saved.setId === 'string')) record = saved;
        } catch { /* Malformed or unavailable presentation storage is disposable. */ }
      }
      return current;
    }
    function cancel() { pending = null; epoch++; }
    function capture(exerciseId, setId = null) {
      cancel();
      const current = context();
      const exercise = current?.workout.exercises.find(item => item.id === exerciseId);
      if (!exercise) return false;
      const meaningfulSetId = setId || (record?.exerciseId === exerciseId ? record.setId : null)
        || exercise.sets.find(set => !set.completed)?.id || null;
      record = { version: 1, workoutId: current.workout.id, exerciseId,
        setId: exercise.sets.some(set => set.id === meaningfulSetId) ? meaningfulSetId : null,
        exerciseOrder: ids(current.workout.exercises), setOrder: ids(exercise.sets), eligible: false };
      write();
      return true;
    }
    function interaction(event) {
      cancel();
      if (!onTrain()) return;
      const card = event.target.closest?.('#activeExercises [data-exercise-id]');
      if (card) capture(card.dataset.exerciseId, event.target.closest('[data-set-id]')?.dataset.setId || null);
    }
    function clear() {
      cancel(); background = false;
      if (scope) { try { storage().removeItem(scope.key); } catch {} }
      record = null; scope = null;
    }
    function restore() {
      scheduled = false;
      const request = pending;
      if (!request || request.epoch !== epoch) return;
      const current = context();
      // Identity verification removes the shell from layout. It is a readiness
      // boundary, not user navigation: retain the request until authorization.
      if (!visible() || !laidOut()) return;
      if (!current) return;
      if (!onTrain() || !pending || scope.key !== request.key || scope.workoutId !== request.workoutId) { cancel(); return; }
      // A surviving dialog owns its viewport and focus, including the picker.
      if ([...root.querySelectorAll('dialog[open],[role="dialog"]')].some(node => node.getClientRects().length)) { cancel(); return; }
      const anchor = resolve(record, current.workout);
      if (!anchor) { cancel(); return; }
      const card = [...root.querySelectorAll('#activeExercises [data-exercise-id]')].find(node => node.dataset.exerciseId === anchor.exerciseId);
      if (!card) return; // Existing render/runtime events retry readiness, not a timer loop.
      const row = [...card.querySelectorAll('[data-set-id]')].find(node => node.dataset.setId === anchor.setId);
      const target = row?.getClientRects().length ? row : card.querySelector('.exercise-head') || card;
      if (!target.getClientRects().length) return;
      const viewport = host.visualViewport;
      const top = (viewport?.offsetTop || 0) + (root.querySelector('#activePanel>.active-heading')?.getBoundingClientRect().height || 0) + 12;
      let bottom = (viewport?.offsetTop || 0) + (viewport?.height || host.innerHeight) - 12;
      const timer = root.getElementById('timerCard');
      if (timer?.getClientRects().length) {
        const timerTop = timer.getBoundingClientRect().top;
        if (timerTop > top && timerTop < bottom) bottom = timerTop - 12;
      }
      const rect = target.getBoundingClientRect();
      coldChecked = true;
      cancel(); // Consume before any scroll/render callback. Never focus an input.
      if (request.align || rect.top < top || rect.bottom > bottom) {
        const delta = request.align || rect.height > bottom - top || rect.top < top ? rect.top - top : rect.bottom - bottom;
        host.scrollBy({ top: delta, behavior: 'instant' });
      }
      capture(anchor.exerciseId, anchor.setId);
    }
    function schedule() {
      if (!pending || scheduled) return;
      scheduled = true;
      host.requestAnimationFrame(() => host.requestAnimationFrame(restore));
    }
    function requestRestore({ fallback = false } = {}) {
      const current = context();
      if (!current || !onTrain()) return false;
      if (!record && fallback) {
        // Read the existing rendered/controller focus; never set a training cursor.
        const renderedId = root.querySelector('#activeExercises .is-active')?.dataset.exerciseId;
        const exercise = current.workout.exercises.find(item => item.id === renderedId)
          || current.workout.exercises.find(item => item.id === current.workout.focusedExerciseId)
          || current.workout.exercises[0];
        if (exercise) capture(exercise.id, exercise.sets.find(set => !set.completed)?.id || null);
      }
      if (!record) return false;
      pending = { epoch: ++epoch, key: scope.key, workoutId: scope.workoutId, align: fallback };
      schedule();
      return true;
    }
    function beforeBackground() {
      if (background) return;
      background = true; cancel();
      if (!context() || !record) return;
      record.eligible = onTrain(); write();
    }
    function foreground() {
      if (!background || !visible()) return;
      background = false;
      if (record?.eligible === true && onTrain() && scope) {
        pending = { epoch: ++epoch, key: scope.key, workoutId: scope.workoutId };
        schedule();
      }
    }
    function afterRender() {
      const current = context();
      if (!current) return;
      if (!coldChecked) {
        coldChecked = true;
        if (onTrain()) requestRestore({ fallback: true });
      }
      schedule();
    }
    function viewChanged({ initial = false, resume = false } = {}) {
      if (initial) { afterRender(); return onTrain() && Boolean(pending); }
      cancel();
      context();
      if (record) { record.eligible = false; write(); }
      if (onTrain()) return requestRestore({ fallback: true });
      return false;
    }
    root.addEventListener('pointerdown', interaction, true);
    root.addEventListener('input', interaction, true);
    root.addEventListener('click', interaction, true);
    root.addEventListener('keydown', cancel, true);
    root.addEventListener('wheel', cancel, { passive: true, capture: true });
    root.addEventListener('touchmove', cancel, { passive: true, capture: true });
    root.addEventListener('visibilitychange', () => visible() ? foreground() : beforeBackground());
    host.addEventListener('pagehide', beforeBackground);
    host.addEventListener('pageshow', foreground);
    root.addEventListener('big-gains-runtime-state-changed', afterRender);
    root.addEventListener('big-gains-boot-concealed', () => {
      // The Auth callback may run before OR after visibilitychange and after an
      // earlier restore. Concealment itself collapses document scroll height.
      // Preserve only the current scope, and revalidate it before any DOM scroll.
      if (onTrain() && record && scope) {
        pending = { epoch: ++epoch, key: scope.key, workoutId: scope.workoutId };
      } else cancel();
    });
    root.addEventListener('big-gains-boot-authorized', afterRender);
    return Object.freeze({ capture, clear, afterRender, requestRestore, viewChanged });
  }
  window.BigGainsTrainPosition = Object.freeze({ create, resolve, nearest });
})();
