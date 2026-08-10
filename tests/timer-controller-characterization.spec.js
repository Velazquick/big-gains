import { expect, test } from '@playwright/test';
import {
  activeWorkout,
  blankState,
  installLocalStorageFixture,
  readStoredJson,
  STORAGE_KEYS
} from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const SZW_CLIENT_ID = 'independent-09034233fa064233b85018aec182764d';
const SZW_STORAGE_KEY = 'big-gains-cloud-94a00000-0000-0000-0000-000000000001-94b00000-0000-0000-0000-000000000001-v1';
const FORBIDDEN_TIMER_KEYS = /^(?:timerState|timerRemaining|timerTicker|timerRunGeneration|timerFeedbackGeneration|timerFeedbackReset|countdown|ticker|generation|feedback)$/i;

function stateWithActiveWorkout(profileId, {
  type = profileId === 'alexa' ? 'PilatesPull' : 'Push',
  workoutId = `${profileId}-active-characterization`,
  exerciseRestSeconds,
  savedRestSeconds,
  restTimerEndsAt = null
} = {}) {
  const workout = activeWorkout({ id: workoutId, type });
  if (exerciseRestSeconds === undefined) delete workout.exercises[0].restSeconds;
  else workout.exercises[0].restSeconds = exerciseRestSeconds;
  const exerciseId = workout.exercises[0].id;
  return {
    ...blankState(profileId),
    exercisePreferences: savedRestSeconds === undefined
      ? {}
      : { [exerciseId]: { restSeconds: savedRestSeconds } },
    activeWorkout: workout,
    restTimerEndsAt
  };
}

async function installManagedProfiles(page, {
  jorge = stateWithActiveWorkout('jorge'),
  alexa,
  activeProfile = 'jorge'
} = {}) {
  const values = {};
  if (jorge) values[STORAGE_KEYS.jorge] = jorge;
  if (alexa) values[STORAGE_KEYS.alexa] = alexa;
  await page.addInitScript(({ activeProfile, values }) => {
    if (sessionStorage.getItem('timer-characterization-managed-ready') === '1') return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('big-gains-active-profile', activeProfile);
    for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.setItem('timer-characterization-managed-ready', '1');
  }, { activeProfile, values });
}

async function installIndependentSzw(page, { managedDeadlines = {} } = {}) {
  const szwState = stateWithActiveWorkout(SZW_CLIENT_ID, {
    type: 'SzwPush1',
    workoutId: 'szw-active-characterization'
  });
  const managedStates = {
    [STORAGE_KEYS.jorge]: stateWithActiveWorkout('jorge', {
      workoutId: 'jorge-isolation-sentinel',
      restTimerEndsAt: managedDeadlines.jorge ?? null
    }),
    [STORAGE_KEYS.alexa]: stateWithActiveWorkout('alexa', {
      workoutId: 'alexa-isolation-sentinel',
      restTimerEndsAt: managedDeadlines.alexa ?? null
    })
  };
  await page.addInitScript(({ clientId, storageKey, szwState, managedStates }) => {
    if (sessionStorage.getItem('timer-characterization-szw-ready') === '1') return;
    localStorage.clear();
    sessionStorage.clear();
    const authUserId = '94000000-0000-0000-0000-000000000001';
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent',
          authUserId,
          cloudAccountId: '94a00000-0000-0000-0000-000000000001',
          cloudProfileId: '94b00000-0000-0000-0000-000000000001',
          clientId,
          displayName: 'szw',
          presentation: { petEnabled: false, accent: 'merlot', theme: 'slate-dark' }
        }
      }
    }));
    for (const [key, value] of Object.entries(managedStates)) localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem(storageKey, JSON.stringify(szwState));
    sessionStorage.setItem('timer-characterization-szw-ready', '1');
  }, { clientId: SZW_CLIENT_ID, storageKey: SZW_STORAGE_KEY, szwState, managedStates });
}

async function timerSnapshot(page, storageKey = STORAGE_KEYS.jorge) {
  return page.evaluate(key => {
    const persisted = JSON.parse(localStorage.getItem(key) || 'null');
    const deadline = persisted?.restTimerEndsAt ?? null;
    const card = document.getElementById('timerCard');
    return {
      activeId: persisted?.activeWorkout?.id ?? null,
      deadline,
      remainingSeconds: deadline === null ? null : Math.ceil((Number(deadline) - Date.now()) / 1000),
      lifecycle: card?.dataset.timerState ?? null,
      timerHidden: card?.classList.contains('hidden') ?? true,
      activePanelHidden: document.getElementById('activePanel')?.classList.contains('hidden') ?? true,
      skipDisabled: document.getElementById('timerSkip')?.disabled ?? true,
      display: document.getElementById('timerDisplay')?.textContent ?? '',
      message: document.getElementById('timerNext')?.textContent ?? ''
    };
  }, storageKey);
}

async function flushUi(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function completeSet(page, number, total = 3) {
  await page.getByRole('button', { name: `Complete Set ${number} of ${total}` }).click();
  await flushUi(page);
}

async function dispatchLifecycle(page, kind, now) {
  await page.evaluate(({ kind, now }) => {
    const nativeNow = Date.now;
    if (Number.isFinite(now)) Date.now = () => now;
    try {
      if (kind === 'visibilitychange') {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
        document.dispatchEvent(new Event('visibilitychange'));
      } else {
        window.dispatchEvent(new Event(kind));
      }
    } finally {
      Date.now = nativeNow;
    }
  }, { kind, now });
  await page.evaluate(() => Promise.resolve());
}

async function installStorageWriteCounter(page, storageKey) {
  await page.evaluate(key => {
    const nativeSetItem = Storage.prototype.setItem;
    window.__timerCharacterizationStorage = { key, nativeSetItem, writes: [] };
    Storage.prototype.setItem = function (name, value) {
      if (name === key) window.__timerCharacterizationStorage.writes.push(value);
      return nativeSetItem.call(this, name, value);
    };
  }, storageKey);
}

async function storageWrites(page) {
  return page.evaluate(() => window.__timerCharacterizationStorage?.writes.slice() || []);
}

async function restoreStorageWriteCounter(page) {
  await page.evaluate(() => {
    const capture = window.__timerCharacterizationStorage;
    if (capture?.nativeSetItem) Storage.prototype.setItem = capture.nativeSetItem;
  });
}

async function installIntervalCapture(page) {
  await page.evaluate(() => {
    const nativeSetInterval = window.setInterval;
    window.__timerCharacterizationIntervals = { nativeSetInterval, callbacks: [] };
    window.setInterval = function (callback, delay, ...args) {
      if (delay === 1000) {
        window.__timerCharacterizationIntervals.callbacks.push(callback);
        return 87000 + window.__timerCharacterizationIntervals.callbacks.length;
      }
      return nativeSetInterval.call(this, callback, delay, ...args);
    };
  });
}

async function restoreIntervalCapture(page) {
  await page.evaluate(() => {
    const capture = window.__timerCharacterizationIntervals;
    if (capture?.nativeSetInterval) window.setInterval = capture.nativeSetInterval;
  });
}

async function installReadyResetCapture(page) {
  await page.evaluate(() => {
    const nativeSetTimeout = window.setTimeout;
    window.__timerCharacterizationReadyResets = { nativeSetTimeout, callbacks: [] };
    window.setTimeout = function (callback, delay, ...args) {
      if (delay === 3000) {
        window.__timerCharacterizationReadyResets.callbacks.push(callback);
        return 88000 + window.__timerCharacterizationReadyResets.callbacks.length;
      }
      return nativeSetTimeout.call(this, callback, delay, ...args);
    };
  });
}

async function expireRunningRest(page, kind = 'focus', storageKey = STORAGE_KEYS.jorge) {
  const running = await timerSnapshot(page, storageKey);
  expect(running.deadline).toBeGreaterThan(Date.now());
  await dispatchLifecycle(page, kind, running.deadline + 1);
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'ready');
}

async function persistenceSnapshot(page, storageKey = STORAGE_KEYS.jorge) {
  return page.evaluate(async key => {
    const persisted = JSON.parse(localStorage.getItem(key));
    const records = await BigGainsCloudShadow.localRecords(persisted.profileId, persisted);
    const activeRecord = records.find(record => record.entityType === 'activeSession') || null;
    const forbiddenKeys = [];
    const visit = (value, path = '') => {
      if (!value || typeof value !== 'object') return;
      for (const [name, child] of Object.entries(value)) {
        const childPath = path ? `${path}.${name}` : name;
        if (/^(?:timerState|timerRemaining|timerTicker|timerRunGeneration|timerFeedbackGeneration|timerFeedbackReset|countdown|ticker|generation|feedback)$/i.test(name)) forbiddenKeys.push(childPath);
        visit(child, childPath);
      }
    };
    visit(persisted);
    return {
      version: persisted.version,
      keys: Object.keys(persisted).sort(),
      timerPreferenceKeys: Object.keys(persisted.timerPreferences || {}).sort(),
      forbiddenKeys,
      deadline: persisted.restTimerEndsAt,
      activeWorkout: persisted.activeWorkout,
      activeRecord: activeRecord && {
        table: activeRecord.table,
        entityType: activeRecord.entityType,
        clientId: activeRecord.clientId,
        dataKeys: Object.keys(activeRecord.data).sort(),
        data: activeRecord.data
      }
    };
  }, storageKey);
}

function expectRestDuration(snapshot, expectedSeconds) {
  expect(snapshot.lifecycle).toBe('running');
  expect(snapshot.remainingSeconds).toBeGreaterThanOrEqual(expectedSeconds - 1);
  expect(snapshot.remainingSeconds).toBeLessThanOrEqual(expectedSeconds);
}

function expectSchemaV5TimerShape(snapshot, expectedKeys) {
  expect(snapshot.version).toBe(5);
  expect(snapshot.keys).toEqual(expectedKeys);
  expect(snapshot.timerPreferenceKeys).toEqual(['sound', 'vibration']);
  expect(snapshot.forbiddenKeys).toEqual([]);
  expect(snapshot.activeRecord).not.toBeNull();
  expect(snapshot.activeRecord.table).toBe('active_sessions');
  expect(snapshot.activeRecord.entityType).toBe('activeSession');
  expect(snapshot.activeRecord.clientId).toBe(snapshot.activeWorkout.id);
  expect(snapshot.activeRecord.dataKeys).toEqual(['restTimerEndsAt', 'workout']);
  expect(snapshot.activeRecord.data).toEqual({
    workout: snapshot.activeWorkout,
    restTimerEndsAt: snapshot.deadline
  });
}

test('a stale timer A ticker cannot mutate timer B after workout replacement', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await installIntervalCapture(page);

  await completeSet(page, 1);
  const timerA = await timerSnapshot(page);
  const timerAIndex = 0;

  await page.evaluate(() => workoutSessionController.replace('Pull', { loadRoutine: true, scroll: false }));
  await page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]').fill('100');
  await page.locator('input[data-field="reps"][data-ei="0"][data-si="1"]').fill('8');
  await completeSet(page, 1);
  await page.locator('#timerAdjust').click();
  await page.locator('[data-timer-preset="60"]').click();
  const timerB = await timerSnapshot(page);

  const staleResult = await page.evaluate(index => window.__timerCharacterizationIntervals.callbacks[index](), timerAIndex);
  await restoreIntervalCapture(page);
  const afterStaleTick = await timerSnapshot(page);

  expect(timerA.activeId).not.toBe(timerB.activeId);
  expect(timerA.deadline).not.toBe(timerB.deadline);
  expectRestDuration(timerB, 60);
  expect(staleResult).toBe(false);
  expect(afterStaleTick).toMatchObject({
    activeId: timerB.activeId,
    deadline: timerB.deadline,
    lifecycle: 'running',
    timerHidden: false,
    skipDisabled: false,
    display: timerB.display
  });
});

test('a stale timer A READY reset cannot clobber timer B after discard and replacement', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await installReadyResetCapture(page);

  await completeSet(page, 1);
  await expireRunningRest(page);
  expect(await page.evaluate(() => window.__timerCharacterizationReadyResets.callbacks.length)).toBe(1);

  await page.locator('#cancelWorkout').click();
  await page.locator('#cancelWorkout').click();
  await page.evaluate(() => workoutSessionController.start('Push', { loadRoutine: true, scroll: false }));
  await page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]').fill('100');
  await page.locator('input[data-field="reps"][data-ei="0"][data-si="1"]').fill('8');
  await completeSet(page, 1);
  const timerB = await timerSnapshot(page);

  await page.evaluate(() => window.__timerCharacterizationReadyResets.callbacks[0]());
  const afterStaleReset = await timerSnapshot(page);

  expect(timerB.lifecycle).toBe('running');
  expect(afterStaleReset).toMatchObject({
    activeId: timerB.activeId,
    deadline: timerB.deadline,
    lifecycle: 'running',
    timerHidden: false,
    skipDisabled: false,
    display: timerB.display
  });
});

test('double Skip clears and persists the active deadline exactly once', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await completeSet(page, 1);
  await installStorageWriteCounter(page, STORAGE_KEYS.jorge);

  await page.locator('#timerSkip').click();
  await page.evaluate(() => Promise.resolve());
  const afterFirstSkip = await timerSnapshot(page);
  const storedAfterFirstSkip = await readStoredJson(page, STORAGE_KEYS.jorge);
  const firstWrites = await storageWrites(page);

  await page.evaluate(() => document.getElementById('timerSkip').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.evaluate(() => Promise.resolve());
  const afterSecondSkip = await timerSnapshot(page);
  const storedAfterSecondSkip = await readStoredJson(page, STORAGE_KEYS.jorge);
  const secondWrites = await storageWrites(page);
  await restoreStorageWriteCounter(page);

  expect(afterFirstSkip).toMatchObject({ deadline: null, lifecycle: 'idle', skipDisabled: true });
  expect(afterSecondSkip).toEqual(afterFirstSkip);
  expect(storedAfterSecondSkip).toEqual(storedAfterFirstSkip);
  expect(firstWrites).toHaveLength(1);
  expect(secondWrites).toHaveLength(1);
  expect(JSON.parse(secondWrites[0]).restTimerEndsAt).toBeNull();
});

test('rest duration falls back to the 150-second default', async ({ page }) => {
  await installManagedProfiles(page, {
    jorge: stateWithActiveWorkout('jorge', { exerciseRestSeconds: undefined, savedRestSeconds: undefined })
  });
  await openApp(page);
  await completeSet(page, 1);
  expectRestDuration(await timerSnapshot(page), 150);
});

test('saved exercise rest preference overrides the 150-second default', async ({ page }) => {
  await installManagedProfiles(page, {
    jorge: stateWithActiveWorkout('jorge', { exerciseRestSeconds: undefined, savedRestSeconds: 90 })
  });
  await openApp(page);
  await completeSet(page, 1);
  expectRestDuration(await timerSnapshot(page), 90);
});

test('exercise session rest value overrides the saved exercise preference', async ({ page }) => {
  await installManagedProfiles(page, {
    jorge: stateWithActiveWorkout('jorge', { exerciseRestSeconds: 60, savedRestSeconds: 90 })
  });
  await openApp(page);
  await completeSet(page, 1);
  expectRestDuration(await timerSnapshot(page), 60);
});

test('one-shot timer override wins once and is consumed before the following set', async ({ page }) => {
  await installManagedProfiles(page, {
    jorge: stateWithActiveWorkout('jorge', { exerciseRestSeconds: 60, savedRestSeconds: 90 })
  });
  await openApp(page);

  await page.evaluate(() => workoutTimerController.selectPreset(30));
  await expect(page.locator('#timerCard')).toBeHidden();
  await completeSet(page, 1);
  expectRestDuration(await timerSnapshot(page), 30);

  await page.locator('#timerSkip').click();
  await completeSet(page, 2);
  expectRestDuration(await timerSnapshot(page), 60);
});

test('a running preset creates timer B identity and timer A callback cannot alter it', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await installIntervalCapture(page);

  await completeSet(page, 1);
  const timerA = await timerSnapshot(page);
  await page.locator('#timerAdjust').click();
  await page.locator('[data-timer-preset="120"]').click();
  const timerB = await timerSnapshot(page);
  const staleResult = await page.evaluate(() => window.__timerCharacterizationIntervals.callbacks[0]());
  await restoreIntervalCapture(page);
  const afterStaleTick = await timerSnapshot(page);

  expect(timerB.deadline).not.toBe(timerA.deadline);
  expectRestDuration(timerB, 120);
  expect(staleResult).toBe(false);
  expect(afterStaleTick).toMatchObject({
    deadline: timerB.deadline,
    lifecycle: 'running',
    skipDisabled: false,
    display: timerB.display
  });
});

test('timer transitions remain local-first when cloud capture is unavailable or rejects safely', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);

  await page.evaluate(() => { window.BigGainsCloudSync = null; });
  await completeSet(page, 1);
  const unavailableStart = await timerSnapshot(page);
  expect(unavailableStart.deadline).toBeGreaterThan(Date.now());
  expect(unavailableStart.lifecycle).toBe('running');

  await page.evaluate(() => {
    window.__timerCharacterizationCapturePhase = 'skip';
    window.__timerCharacterizationCloudCaptures = [];
    window.BigGainsCloudSync = {
      captureLocalSnapshot(profileId) {
        const persisted = JSON.parse(localStorage.getItem('big-gains-v2'));
        window.__timerCharacterizationCloudCaptures.push({
          phase: window.__timerCharacterizationCapturePhase,
          profileId,
          deadline: persisted.restTimerEndsAt,
          activeId: persisted.activeWorkout?.id || null
        });
        return Promise.reject(new Error('simulated cloud capture rejection'))
          .catch(error => ({ captured: false, reason: error.message }));
      }
    };
  });

  await page.locator('#timerSkip').click();
  await page.evaluate(() => Promise.resolve());
  expect(await timerSnapshot(page)).toMatchObject({ deadline: null, lifecycle: 'idle' });

  await page.evaluate(() => { window.__timerCharacterizationCapturePhase = 'start'; });
  await completeSet(page, 2);
  const rejectedStart = await timerSnapshot(page);
  expect(rejectedStart.deadline).toBeGreaterThan(Date.now());

  await page.evaluate(() => {
    window.__timerCharacterizationCapturePhase = 'expiry';
    window.__timerCharacterizationCloudCaptures.length = 0;
  });
  await dispatchLifecycle(page, 'focus', rejectedStart.deadline + 1);
  const expired = await timerSnapshot(page);
  const captures = await page.evaluate(() => window.__timerCharacterizationCloudCaptures.slice());

  expect(expired).toMatchObject({ deadline: null, lifecycle: 'ready', skipDisabled: true });
  expect(captures.length).toBeGreaterThan(0);
  expect(captures.every(capture => capture.phase === 'expiry' && capture.profileId === 'jorge' && capture.deadline === null)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('managed Jorge and Alexa timers remain isolated in both switch directions', async ({ page }) => {
  await installManagedProfiles(page, {
    jorge: stateWithActiveWorkout('jorge', { workoutId: 'jorge-isolated-workout' }),
    alexa: stateWithActiveWorkout('alexa', { workoutId: 'alexa-isolated-workout' }),
    activeProfile: 'jorge'
  });
  await openApp(page);

  await completeSet(page, 1);
  const jorgeRunning = await timerSnapshot(page, STORAGE_KEYS.jorge);

  await page.locator('#exitWorkoutMode').click();
  await page.locator('#profileSelect').selectOption('alexa');
  await expect(page.locator('#greeting')).toContainText('Alexa');
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();
  const alexaBefore = await timerSnapshot(page, STORAGE_KEYS.alexa);
  expect(alexaBefore).toMatchObject({ activeId: 'alexa-isolated-workout', deadline: null, lifecycle: 'idle' });
  expect(alexaBefore.display).toBe('02:30');

  await completeSet(page, 1);
  const alexaRunning = await timerSnapshot(page, STORAGE_KEYS.alexa);
  expect(alexaRunning.deadline).not.toBe(jorgeRunning.deadline);

  await page.locator('#exitWorkoutMode').click();
  await page.locator('#profileSelect').selectOption('jorge');
  await expect(page.locator('#greeting')).toContainText('Jorge');
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();
  const jorgeResumed = await timerSnapshot(page, STORAGE_KEYS.jorge);
  const storedAlexa = await readStoredJson(page, STORAGE_KEYS.alexa);

  expect(jorgeResumed).toMatchObject({
    activeId: 'jorge-isolated-workout',
    deadline: jorgeRunning.deadline,
    lifecycle: 'running',
    skipDisabled: false
  });
  expect(jorgeResumed.deadline).not.toBe(alexaRunning.deadline);
  expect(storedAlexa.restTimerEndsAt).toBe(alexaRunning.deadline);
});

test('independent SZW timer ignores managed-profile deadlines and persists only its namespace', async ({ page }) => {
  const managedDeadlines = {
    jorge: Date.now() + 600_000,
    alexa: Date.now() + 700_000
  };
  await installIndependentSzw(page, { managedDeadlines });
  await openApp(page);

  const before = await timerSnapshot(page, SZW_STORAGE_KEY);
  expect(before).toMatchObject({ activeId: 'szw-active-characterization', deadline: null, lifecycle: 'idle' });
  expect(before.display).toBe('02:30');

  await completeSet(page, 1);
  const szwRunning = await timerSnapshot(page, SZW_STORAGE_KEY);
  const storedJorge = await readStoredJson(page, STORAGE_KEYS.jorge);
  const storedAlexa = await readStoredJson(page, STORAGE_KEYS.alexa);

  expect(szwRunning.lifecycle).toBe('running');
  expect(szwRunning.deadline).not.toBe(managedDeadlines.jorge);
  expect(szwRunning.deadline).not.toBe(managedDeadlines.alexa);
  expect(storedJorge.restTimerEndsAt).toBe(managedDeadlines.jorge);
  expect(storedAlexa.restTimerEndsAt).toBe(managedDeadlines.alexa);
});

for (const lifecycleEvent of ['visibilitychange', 'pageshow', 'focus']) {
  test(`${lifecycleEvent} reconciles no, future, and expired absolute deadlines equivalently`, async ({ page }) => {
    await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
    await openApp(page);

    await dispatchLifecycle(page, lifecycleEvent);
    expect(await timerSnapshot(page)).toMatchObject({ deadline: null, lifecycle: 'idle', skipDisabled: true });

    await completeSet(page, 1);
    const future = await timerSnapshot(page);
    await dispatchLifecycle(page, lifecycleEvent);
    expect(await timerSnapshot(page)).toMatchObject({
      deadline: future.deadline,
      lifecycle: 'running',
      skipDisabled: false
    });

    await installStorageWriteCounter(page, STORAGE_KEYS.jorge);
    await dispatchLifecycle(page, lifecycleEvent, future.deadline + 1);
    const expired = await timerSnapshot(page);
    await dispatchLifecycle(page, lifecycleEvent, future.deadline + 2);
    const repeated = await timerSnapshot(page);
    const writes = await storageWrites(page);
    await restoreStorageWriteCounter(page);

    expect(expired).toMatchObject({ deadline: null, lifecycle: 'ready', skipDisabled: true, display: '00:00' });
    expect(repeated).toMatchObject({ deadline: null, lifecycle: 'ready', skipDisabled: true, display: '00:00' });
    expect(writes).toHaveLength(1);
  });
}

test('repeated exposed initialization does not duplicate timer lifecycle or preset reactions', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await completeSet(page, 1);

  const initialization = await page.evaluate(() => [
    workoutTimerController.initialize(),
    workoutTimerController.initialize(),
    BigGainsShell.initialize(),
    BigGainsShell.initialize(),
    bigGainsWorkoutMode.initialize(),
    bigGainsWorkoutMode.initialize()
  ]);
  expect(initialization).toEqual([false, false, false, false, false, false]);

  await installIntervalCapture(page);
  await dispatchLifecycle(page, 'focus');
  expect(await page.evaluate(() => window.__timerCharacterizationIntervals.callbacks.length)).toBe(1);

  await installStorageWriteCounter(page, STORAGE_KEYS.jorge);
  await page.locator('#timerAdjust').click();
  await page.locator('[data-timer-preset="120"]').click();
  await page.evaluate(() => Promise.resolve());
  const reactions = await page.evaluate(() => ({
    intervalCount: window.__timerCharacterizationIntervals.callbacks.length,
    writeCount: window.__timerCharacterizationStorage.writes.length,
    expanded: document.getElementById('timerAdjust').getAttribute('aria-expanded')
  }));
  await restoreStorageWriteCounter(page);
  await restoreIntervalCapture(page);

  expect(reactions).toEqual({ intervalCount: 2, writeCount: 1, expanded: 'false' });
  expectRestDuration(await timerSnapshot(page), 120);
});

for (const teardown of ['finish', 'discard']) {
  test(`pending READY reset cannot resurrect timer UI after workout ${teardown}`, async ({ page }) => {
    await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
    await openApp(page);
    await installReadyResetCapture(page);
    await completeSet(page, 1);
    await expireRunningRest(page);
    expect(await page.evaluate(() => window.__timerCharacterizationReadyResets.callbacks.length)).toBe(1);

    if (teardown === 'finish') {
      await page.locator('#finishWorkout').click();
    } else {
      await page.locator('#cancelWorkout').click();
      await page.locator('#cancelWorkout').click();
    }
    const tornDown = await timerSnapshot(page);
    await page.evaluate(() => window.__timerCharacterizationReadyResets.callbacks[0]());
    const afterStaleReset = await timerSnapshot(page);

    expect(tornDown).toMatchObject({
      activeId: null,
      deadline: null,
      lifecycle: 'unavailable',
      timerHidden: true,
      activePanelHidden: true,
      skipDisabled: true
    });
    expect(afterStaleReset).toEqual(tornDown);
  });
}

test('timer start, Skip, and expiry preserve schema-v5 and active-session cloud-shadow shape', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  const initial = await persistenceSnapshot(page);
  const expectedKeys = initial.keys;
  expect(FORBIDDEN_TIMER_KEYS.test('restTimerEndsAt')).toBe(false);

  await completeSet(page, 1);
  const started = await persistenceSnapshot(page);
  expectSchemaV5TimerShape(started, expectedKeys);
  expect(started.deadline).toBeGreaterThan(Date.now());

  await page.locator('#timerSkip').click();
  const skipped = await persistenceSnapshot(page);
  expectSchemaV5TimerShape(skipped, expectedKeys);
  expect(skipped.deadline).toBeNull();

  await completeSet(page, 2);
  const runningAgain = await timerSnapshot(page);
  await dispatchLifecycle(page, 'focus', runningAgain.deadline + 1);
  const expired = await persistenceSnapshot(page);
  expectSchemaV5TimerShape(expired, expectedKeys);
  expect(expired.deadline).toBeNull();
});
