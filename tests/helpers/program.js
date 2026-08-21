export async function createProgramFixture(page, {
  active = true,
  linked = true,
  name = 'Plan Bridge Program',
  withGoal = true
} = {}) {
  return page.evaluate(({ activeProgram, linkGoal, programName, includeGoal }) => {
    const bench = BigGainsExerciseCatalog.resolve('Barbell Bench Press');
    const row = BigGainsExerciseCatalog.resolve('Barbell Row');
    const squat = BigGainsExerciseCatalog.resolve('Back Squat');
    const goalResult = includeGoal
      ? bigGainsGoals.createGoal({ exerciseId: bench.canonicalId, targetValue: 250, targetDate: '', label: 'Bench destination' })
      : null;
    if (goalResult && !goalResult.ok) throw new Error(goalResult.reason);
    let counter = 0;
    const createId = () => `plan-fixture-${++counter}`;
    const now = () => '2026-08-20T12:00:00.000Z';
    const scope = { accountId: ACCOUNT.accountId, profileId: PROFILE.id };
    const approve = (capture, purposeKey, label, definition, workingSets, repTarget) => BigGainsProgramModel.approveRoutine({
      capture,
      ...scope,
      purposeKey,
      label,
      source: { kind: 'reviewed_rebuild', routineType: label },
      exercises: [{ exerciseId: definition.canonicalId, workingSets, targetReps: repTarget, restSeconds: null }],
      catalog: BigGainsExerciseCatalog,
      createId,
      now
    });
    let capture = BigGainsProgramModel.blankCapture();
    const push = approve(capture, 'push', 'Push', bench, 3, '4–6');
    capture = push.capture;
    const pull = approve(capture, 'pull', 'Pull', row, 4, '8–10');
    capture = pull.capture;
    const legs = approve(capture, 'legs-core', 'Legs/Core', squat, 5, '5');
    capture = legs.capture;
    const versions = [push.version, pull.version, legs.version];
    const slots = [versions[0], versions[1], versions[2], versions[0], versions[1], versions[2]].map((version, index) => ({
      label: version.label,
      preferredCalendarAnchor: { weekday: index + 1 },
      routineId: version.routineId,
      routineVersionId: version.routineVersionId
    }));
    const draft = BigGainsProgramModel.createProgramDraft({
      capture,
      ...scope,
      purposeKey: 'canonical-program',
      name: programName,
      slots,
      blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 4 },
      programmingAuthority: 'review',
      priorityGoalIds: goalResult && linkGoal ? [goalResult.goal.goalId] : [],
      startsOn: '2026-08-20',
      createId,
      now
    });
    state.programCapture = activeProgram
      ? BigGainsProgramModel.activateProgram({ capture: draft.capture, ...scope, programVersionId: draft.version.programVersionId, now })
      : draft.capture;
    saveState();
    renderAll();
    BigGainsProgramSetup.render();
    bigGainsGoals.render();
    return {
      goalId: goalResult?.goal.goalId || null,
      programId: draft.version.programId,
      programVersionId: draft.version.programVersionId,
      routineVersionIds: versions.map(version => version.routineVersionId)
    };
  }, { activeProgram: active, linkGoal: linked, programName: name, includeGoal: withGoal });
}
