import { expect, test } from '@playwright/test';
import { activeWorkout, blankState, completedWorkout, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

test('versioned model enforces explicit approval, immutable EKF routines, generic slots, rolling cadence, and Off/Review authority', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const proof = await page.evaluate(() => {
    const api = BigGainsProgramModel;
    const scope = { accountId: ACCOUNT.accountId, profileId: PROFILE.id };
    let counter = 0;
    const createId = () => `opaque-${++counter}`;
    const now = () => `2026-08-${String(Math.min(counter + 1, 28)).padStart(2, '0')}T12:00:00.000Z`;
    const prescription = (name, sets = 3, reps = '8–10') => ({
      exerciseId: BigGainsExerciseCatalog.resolve(name).canonicalId,
      workingSets: sets,
      targetReps: reps,
      restSeconds: null
    });
    let capture = api.blankCapture();
    let approvalError = '';
    try {
      api.approveRoutine({
        capture, ...scope, purposeKey: 'push', label: 'Push', source: null,
        exercises: [prescription('Barbell Bench Press')], catalog: BigGainsExerciseCatalog, createId, now
      });
    } catch (error) { approvalError = error.message; }

    const approve = (purposeKey, label, sourceKind, exercise) => {
      const result = api.approveRoutine({
        capture, ...scope, purposeKey, label,
        source: { kind: sourceKind, routineType: label },
        exercises: [exercise], catalog: BigGainsExerciseCatalog, createId, now
      });
      capture = result.capture;
      return result.version;
    };
    const anterior = approve('anterior', 'Anterior', 'existing_custom', prescription('Barbell Bench Press', 4, '6–8'));
    const posterior = approve('posterior', 'Posterior', 'coded_default', prescription('Barbell Row', 4, '8–10'));
    const originalAnterior = JSON.parse(JSON.stringify(anterior));
    const successorResult = api.approveRoutine({
      capture, ...scope, purposeKey: 'anterior', label: 'Anterior',
      source: { kind: 'reviewed_rebuild', routineType: 'Anterior', basedOnRoutineVersionId: anterior.routineVersionId },
      exercises: [prescription('Barbell Bench Press', 5, '5')], catalog: BigGainsExerciseCatalog, createId, now
    });
    capture = successorResult.capture;
    const anteriorV2 = successorResult.version;
    const activeBefore = JSON.stringify(state.activeWorkout);
    const historyBefore = JSON.stringify(state.workouts);
    const slots = [anteriorV2, posterior, anteriorV2, posterior].map((version, index) => ({
      label: index % 2 ? 'Posterior' : 'Anterior',
      preferredCalendarAnchor: null,
      routineId: version.routineId,
      routineVersionId: version.routineVersionId
    }));
    const draft = api.createProgramDraft({
      capture, ...scope, purposeKey: 'generic-fixture', name: 'Anterior / Posterior', slots,
      blockReviewPolicy: { boundaryKind: 'completed_cycles', boundaryValue: 3 },
      programmingAuthority: 'review', priorityGoalIds: [], startsOn: '2026-08-20',
      activeWorkoutId: state.activeWorkout?.id || null, versionNote: 'Generic fixture', createId, now
    });
    capture = api.activateProgram({ capture: draft.capture, ...scope, programVersionId: draft.version.programVersionId, now });
    const positions = [];
    for (let index = 0; index < 4; index += 1) {
      positions.push(capture.sequenceState.nextSlotIndex);
      capture.sequenceState = api.advanceSequence(capture.sequenceState, draft.version, now);
    }
    const sequenceAfterCycle = JSON.parse(JSON.stringify(capture.sequenceState));
    const replacementDraft = api.createProgramDraft({
      capture, ...scope, purposeKey: 'replacement-fixture', name: 'Replacement topology', slots,
      blockReviewPolicy: { boundaryKind: 'weeks', boundaryValue: 4 },
      programmingAuthority: 'off', startsOn: '2026-08-21', createId, now
    });
    capture = api.activateProgram({ capture: replacementDraft.capture, ...scope, programVersionId: replacementDraft.version.programVersionId, now });
    const firstProgramStatus = capture.programs.find(program => program.programId === draft.version.programId)?.status;
    const activeProgramCount = capture.programs.filter(program => program.status === 'active').length;
    let autoError = '';
    try {
      api.createProgramDraft({
        capture, ...scope, purposeKey: 'invalid-auto', name: 'Auto', slots,
        blockReviewPolicy: { boundaryKind: 'weeks', boundaryValue: 4 }, programmingAuthority: 'auto',
        startsOn: '2026-08-20', createId, now
      });
    } catch (error) { autoError = error.message; }
    let crossProfileError = '';
    try {
      api.createProgramDraft({
        capture, accountId: scope.accountId, profileId: 'alexa', purposeKey: 'cross-profile', name: 'Wrong profile', slots,
        blockReviewPolicy: { boundaryKind: 'weeks', boundaryValue: 4 }, programmingAuthority: 'off',
        startsOn: '2026-08-20', createId, now
      });
    } catch (error) { crossProfileError = error.message; }
    return {
      initialCanonicalCount: api.blankCapture().routineVersions.length,
      approvalError,
      sources: [anterior.source.kind, posterior.source.kind, anteriorV2.source.kind],
      exactCanonicalId: anterior.exercises[0].exerciseId,
      expectedCanonicalId: BigGainsExerciseCatalog.resolve('Barbell Bench Press').canonicalId,
      originalUnchanged: JSON.stringify(anterior) === JSON.stringify(originalAnterior),
      successor: {
        versionNumber: anteriorV2.versionNumber,
        predecessor: anteriorV2.predecessorRoutineVersionId,
        originalId: anterior.routineVersionId,
        workingSets: anteriorV2.exercises[0].workingSets
      },
      labels: draft.version.slots.map(slot => slot.label),
      pinned: draft.version.slots.map(slot => slot.routineVersionId),
      anchors: draft.version.slots.map(slot => slot.preferredCalendarAnchor),
      cadence: draft.version.cadencePolicy,
      positions,
      sequenceAfterCycle,
      firstProgramStatus,
      activeProgramCount,
      authority: draft.version.programmingAuthority,
      autoError,
      crossProfileError,
      activeUnchanged: JSON.stringify(state.activeWorkout) === activeBefore,
      historyUnchanged: JSON.stringify(state.workouts) === historyBefore
    };
  });

  expect(proof.initialCanonicalCount).toBe(0);
  expect(proof.approvalError).toContain('source');
  expect(proof.sources).toEqual(['existing_custom', 'coded_default', 'reviewed_rebuild']);
  expect(proof.exactCanonicalId).toBe(proof.expectedCanonicalId);
  expect(proof.exactCanonicalId).toMatch(/^[0-9a-f-]{36}$/);
  expect(proof.originalUnchanged).toBe(true);
  expect(proof.successor).toEqual({ versionNumber: 2, predecessor: proof.successor.originalId, originalId: proof.successor.originalId, workingSets: 5 });
  expect(proof.labels).toEqual(['Anterior', 'Posterior', 'Anterior', 'Posterior']);
  expect(proof.pinned[0]).toBe(proof.pinned[2]);
  expect(proof.pinned[1]).toBe(proof.pinned[3]);
  expect(proof.anchors).toEqual([null, null, null, null]);
  expect(proof.cadence).toEqual({ kind: 'rolling_cycle', advanceOn: 'completed_session' });
  expect(proof.positions).toEqual([0, 1, 2, 3]);
  expect(proof.sequenceAfterCycle).toMatchObject({ nextSlotIndex: 0, completedCycles: 1 });
  expect(proof.firstProgramStatus).toBe('archived');
  expect(proof.activeProgramCount).toBe(1);
  expect(proof.authority).toBe('review');
  expect(proof.autoError).toContain('Off or Review only');
  expect(proof.crossProfileError).toContain('same profile');
  expect(proof.activeUnchanged).toBe(true);
  expect(proof.historyUnchanged).toBe(true);
});

test('mobile review flow never treats defaults as canonical and creates exact repeated PPL pins only after confirmation', async ({ page }) => {
  const active = activeWorkout();
  const completed = completedWorkout();
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'blankJorge');
  await page.addInitScript(({ key, activeWorkoutValue, completedWorkoutValue }) => {
    const saved = JSON.parse(localStorage.getItem(key));
    saved.activeWorkout = activeWorkoutValue;
    saved.workouts = [completedWorkoutValue];
    localStorage.setItem(key, JSON.stringify(saved));
  }, { key: STORAGE_KEYS.jorge, activeWorkoutValue: active, completedWorkoutValue: completed });
  await openApp(page);
  const protectedBefore = await readStoredJson(page, STORAGE_KEYS.jorge);
  await page.evaluate(() => window.bigGainsViewShell.showView('library', { workout: false }));
  await expect(page.locator('#programSetupPanel')).toHaveCount(0);
  await page.locator('.bottom-nav [data-view="plan"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'plan');
  await expect(page.locator('#programSetupDialog')).not.toBeVisible();
  await page.locator('[data-plan-setup]').first().click();
  await expect(page.locator('#programSetupDialog')).toBeVisible();
  await expect(page.locator('input[name="programRoutineSource"]:checked')).toHaveCount(0);
  await expect(page.locator('#programSetupContent')).toContainText('built-in routine is shown only as a starting candidate');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).programCapture?.routineVersions || []).toHaveLength(0);

  await page.locator('[data-program-approve-routine]').click();
  await expect(page.locator('#programSetupError')).toContainText('source');
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).programCapture?.routineVersions || []).toHaveLength(0);

  for (const label of ['Push', 'Pull', 'Legs/Core']) {
    await page.getByLabel('Built-in starting routine').check();
    await page.locator('[data-program-approve-routine]').click();
    await expect(page.locator('#programSetupContent')).toContainText('approved future Routine version');
    await page.locator('#programSetupNext').click();
    if (label === 'Legs/Core') await expect(page.locator('#programStepTitle')).toHaveText('Review the rolling sequence');
  }

  await page.locator('#programSetupNext').click();
  await expect(page.locator('#programStepTitle')).toHaveText('Connect destinations to this route');
  await page.locator('#programSetupNext').click();
  await expect(page.locator('#programStepTitle')).toHaveText('Choose when to pause and review');
  await page.locator('#programBoundaryValue').fill('3');
  await page.locator('#programSetupNext').click();
  await expect(page.locator('input[name="programAuthorityChoice"]')).toHaveCount(2);
  await expect(page.getByText('Automatic authority is not available.')).toBeVisible();
  await page.locator('input[name="programAuthorityChoice"][value="review"]').check();
  await page.locator('#programSetupNext').click();
  await expect(page.locator('#programStepTitle')).toHaveText('Create the next Program version');
  await page.locator('[data-program-confirm]').click();
  await expect(page.locator('#programSetupContent')).toContainText('Your training route is saved');

  const stored = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(stored.version).toBe(5);
  expect(stored.customRoutines).toEqual({});
  expect(stored.activeWorkout).toEqual(protectedBefore.activeWorkout);
  expect(stored.workouts).toEqual(protectedBefore.workouts);
  expect(stored.programCapture.storageMode).toBe('local_only');
  expect(stored.programCapture.routineVersions).toHaveLength(3);
  expect(stored.programCapture.routineVersions.every(version => version.source.kind === 'coded_default')).toBe(true);
  const program = stored.programCapture.programVersions[0];
  expect(program.programmingAuthority).toBe('review');
  expect(program.slots).toHaveLength(6);
  expect(program.slots.map(slot => slot.routineVersionId)).toEqual([
    program.slots[0].routineVersionId,
    program.slots[1].routineVersionId,
    program.slots[2].routineVersionId,
    program.slots[0].routineVersionId,
    program.slots[1].routineVersionId,
    program.slots[2].routineVersionId
  ]);
  expect(program.slots.map(slot => slot.preferredCalendarAnchor?.weekday)).toEqual([1, 2, 3, 4, 5, 6]);
  expect(stored.programCapture.activeProgramVersionId).toBe(program.programVersionId);
  expect(stored.programCapture.sequenceState).toMatchObject({ programVersionId: program.programVersionId, nextSlotIndex: 0, completedCycles: 0 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('Program capture survives schema-v5 backup/reload offline while cloud shadow stays unchanged and profile-scoped', async ({ page, context }) => {
  await installLocalStorageFixture(page, ['blankJorge', 'blankAlexa'], { activeProfile: 'jorge' });
  await openApp(page);
  const evidence = await page.evaluate(async () => {
    let counter = 0;
    const createId = () => `persisted-${++counter}`;
    const result = BigGainsProgramModel.approveRoutine({
      capture: state.programCapture,
      accountId: ACCOUNT.accountId,
      profileId: PROFILE.id,
      purposeKey: 'push',
      label: 'Push',
      source: { kind: 'reviewed_rebuild', routineType: 'Push' },
      exercises: [{
        exerciseId: BigGainsExerciseCatalog.resolve('Barbell Bench Press').canonicalId,
        workingSets: 4,
        targetReps: '6–8',
        restSeconds: 180
      }],
      catalog: BigGainsExerciseCatalog,
      createId,
      now: () => '2026-08-20T12:00:00.000Z'
    });
    state.programCapture = result.capture;
    saveState();
    const exported = JSON.parse(statePersistenceApi.prepareExport(state).json);
    const imported = statePersistenceApi.validateImport(exported);
    const cloudRecords = await BigGainsCloudShadow.localRecords(PROFILE.id, state);
    return {
      exportedCapture: exported.programCapture,
      importedCapture: imported.state.programCapture,
      cloudEntityTypes: cloudRecords.map(record => record.entityType),
      cloudTables: BigGainsCloudShadow.tables,
      issues: BigGainsMigrationPreview.validateLocalState(state, PROFILE.id)
    };
  });
  expect(evidence.importedCapture).toEqual(evidence.exportedCapture);
  expect(evidence.cloudEntityTypes.some(type => /program|canonicalRoutine/i.test(type))).toBe(false);
  expect(evidence.cloudTables).not.toContain('programs');
  expect(evidence.issues).toEqual([]);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('#sessionTypeSelector')).toBeAttached();
    expect((await readStoredJson(page, STORAGE_KEYS.jorge)).programCapture).toEqual(evidence.exportedCapture);
  } finally {
    await context.setOffline(false);
  }

  await Promise.all([page.waitForNavigation(), page.locator('#profileSelect').selectOption('alexa')]);
  await expect(page.locator('html')).toHaveAttribute('data-profile', 'alexa');
  await expect(page.locator('#programSetupPanel')).toHaveCount(0);
  await expect(page.locator('#todayPlanCard')).toBeHidden();
  const alexa = await readStoredJson(page, STORAGE_KEYS.alexa);
  expect(alexa.programCapture?.routineVersions || []).toHaveLength(0);
});
