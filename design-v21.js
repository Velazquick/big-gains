(() => {
  const mossStyleId = 'mossExerciseCardStyles';
  if (!document.getElementById(mossStyleId)) {
    const mossStyles = document.createElement('link');
    mossStyles.id = mossStyleId;
    mossStyles.rel = 'stylesheet';
    mossStyles.href = 'moss-cards-v24.css?v=24';
    document.head.appendChild(mossStyles);
  }

  const syncScriptId = 'bigGainsSyncGateway';
  if (!document.getElementById(syncScriptId)) {
    const syncScript = document.createElement('script');
    syncScript.id = syncScriptId;
    syncScript.src = 'sync-gateway.js?v=25';
    document.head.appendChild(syncScript);
  }

  const routineMeta = document.getElementById('todayRoutineMeta');
  const blockMeta = document.getElementById('todayBlockMeta');
  const momentumHeadline = document.getElementById('momentumHeadline');
  const momentumNote = document.getElementById('momentumNote');
  const watched = ['nextWorkout','heroNote','weeklyWorkouts','trainingVolume','prCount','latestWeight','activePanel']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  function completedThisWeek() {
    if (typeof startOfWeek !== 'function') return 0;
    const start = startOfWeek();
    return (state?.workouts || []).filter(workout => new Date(workout.completedAt) >= start).length;
  }

  function plannedCount(day) {
    if (!day || day === 'Rest' || typeof routineFor !== 'function') return 0;
    try { return routineFor(day).length; } catch { return 0; }
  }

  function renderDirection() {
    if (!routineMeta || !blockMeta || !momentumHeadline || !momentumNote) return;
    const today = typeof todaysWorkout === 'function' ? todaysWorkout() : null;
    const session = active || state?.activeWorkout;
    const week = completedThisWeek();
    const count = plannedCount(session?.type || today);

    if (session) {
      routineMeta.textContent = `${session.exercises?.length || count} movements loaded`;
      blockMeta.textContent = 'Session in progress';
    } else if (today === 'Rest') {
      routineMeta.textContent = 'Recovery day';
      blockMeta.textContent = 'Strength foundation';
    } else {
      routineMeta.textContent = `${count || 'Your'} movements`;
      blockMeta.textContent = 'Strength foundation';
    }

    momentumHeadline.textContent = `${week} session${week === 1 ? '' : 's'} this week`;
    if (session) momentumNote.textContent = 'The work is open. One clean set at a time.';
    else if (today === 'Rest') momentumNote.textContent = 'Recovery is part of progressive overload, not time away from it.';
    else if (week >= 4) momentumNote.textContent = 'The base is taking shape. Keep the next session honest.';
    else if (week > 0) momentumNote.textContent = 'Consistency first. The heavier numbers will follow.';
    else momentumNote.textContent = 'Build the baseline. Then make it difficult to recognize.';
  }

  const observer = new MutationObserver(() => renderDirection());
  watched.forEach(node => observer.observe(node, {subtree:true,childList:true,attributes:true}));
  ['startWorkout','finishWorkout','cancelWorkout','loadRoutine','addSelectedExercise'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => setTimeout(renderDirection, 100));
  });
  document.getElementById('profileSelect')?.addEventListener('change', () => setTimeout(renderDirection, 0));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderDirection(); });
  renderDirection();
})();