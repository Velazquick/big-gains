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
      record = { version: 1, workoutId: current.workout.id, exerciseId,
        setId: exercise.sets.some(set => set.id === setId) ? setId : null,
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
      if (!current || !visible() || !onTrain() || !pending || scope.key !== request.key || scope.workoutId !== request.workoutId) { cancel(); return; }
      // A surviving dialog owns its viewport and focus, including the picker.
      if ([...root.querySelectorAll('dialog[open],[role="dialog"]')].some(node => node.getClientRects().length)) { cancel(); return; }
      const anchor = resolve(record, current.workout);
      if (!anchor) { cancel(); return; }
      const card = [...root.querySelectorAll('#activeExercises [data-exercise-id]')].find(node => node.dataset.exerciseId === anchor.exerciseId);
      if (!card) return; // Existing render/runtime events retry readiness, not a timer loop.
      const row = [...card.querySelectorAll('[data-set-id]')].find(node => node.dataset.setId === anchor.setId);
      const target = row?.getClientRects().length ? row : card.querySelector('.exercise-head') || card;
      const viewport = host.visualViewport;
      const top = (viewport?.offsetTop || 0) + (root.querySelector('#activePanel>.active-heading')?.getBoundingClientRect().height || 0) + 12;
      let bottom = (viewport?.offsetTop || 0) + (viewport?.height || host.innerHeight) - 12;
      const timer = root.getElementById('timerCard');
      if (timer?.getClientRects().length) {
        const timerTop = timer.getBoundingClientRect().top;
        if (timerTop > top && timerTop < bottom) bottom = timerTop - 12;
      }
      const rect = target.getBoundingClientRect();
      cancel(); // Consume before any scroll/render callback. Never focus an input.
      if (rect.top < top || rect.bottom > bottom) {
        const delta = rect.height > bottom - top || rect.top < top ? rect.top - top : rect.bottom - bottom;
        host.scrollBy({ top: delta, behavior: 'instant' });
      }
      capture(anchor.exerciseId, anchor.setId);
    }
    function schedule() {
      if (!pending || scheduled) return;
      scheduled = true;
      host.requestAnimationFrame(() => host.requestAnimationFrame(restore));
    }
    function requestRestore() {
      const current = context();
      if (!current || !record || !onTrain()) return false;
      pending = { epoch: ++epoch, key: scope.key, workoutId: scope.workoutId };
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
      if (record?.eligible === true && onTrain()) requestRestore();
    }
    function afterRender() {
      const current = context();
      if (!current) { cancel(); return; }
      if (!coldChecked) {
        coldChecked = true;
        if (record?.eligible === true && onTrain()) requestRestore();
      }
      schedule();
    }
    function viewChanged({ initial = false, resume = false } = {}) {
      if (initial) { afterRender(); return; }
      cancel();
      context();
      if (record) { record.eligible = false; write(); }
      if (resume && onTrain() && !requestRestore()) host.scrollTo({ top: 0, behavior: 'instant' });
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
    root.addEventListener('big-gains-boot-concealed', cancel);
    root.addEventListener('big-gains-boot-authorized', afterRender);
    return Object.freeze({ capture, clear, afterRender, requestRestore, viewChanged });
  }
  window.BigGainsTrainPosition = Object.freeze({ create, resolve, nearest });
})();
