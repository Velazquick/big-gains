import { expect, test } from '@playwright/test';
import { activeWorkout, blankState, installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const SZW_CLIENT_ID = 'independent-09034233fa064233b85018aec182764d';
const SZW_STORAGE_KEY = 'big-gains-cloud-94a00000-0000-0000-0000-000000000001-94b00000-0000-0000-0000-000000000001-v1';

async function installAlexaActiveWorkout(page, stateOverrides = {}) {
  const profileState = {
    ...blankState('alexa'),
    activeWorkout: activeWorkout({ type: 'PilatesPull' }),
    ...stateOverrides
  };
  await page.addInitScript(({ activeProfileKey, activeProfileId, storageKey, profileState }) => {
    if (sessionStorage.getItem('alexa-timer-fixture-ready') === '1') return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(activeProfileKey, activeProfileId);
    localStorage.setItem(storageKey, JSON.stringify(profileState));
    sessionStorage.setItem('alexa-timer-fixture-ready', '1');
  }, {
    activeProfileKey: STORAGE_KEYS.activeProfile,
    activeProfileId: 'alexa',
    storageKey: STORAGE_KEYS.alexa,
    profileState
  });
}

async function installSzwActiveWorkout(page) {
  const profileState = {
    ...blankState(SZW_CLIENT_ID),
    goals: { primary: 'Strength and consistency' },
    activeWorkout: activeWorkout({ type: 'SzwPush1' })
  };
  await page.addInitScript(({ clientId, storageKey, profileState }) => {
    const authUserId = '94000000-0000-0000-0000-000000000001';
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent', authUserId,
          cloudAccountId: '94a00000-0000-0000-0000-000000000001',
          cloudProfileId: '94b00000-0000-0000-0000-000000000001',
          clientId, displayName: 'szw',
          presentation: { petEnabled: false, accent: 'merlot', theme: 'slate-dark' }
        }
      }
    }));
    if (sessionStorage.getItem('szw-timer-fixture-ready') === '1') return;
    localStorage.setItem(storageKey, JSON.stringify(profileState));
    sessionStorage.setItem('szw-timer-fixture-ready', '1');
  }, { clientId: SZW_CLIENT_ID, storageKey: SZW_STORAGE_KEY, profileState });
}

async function timerSnapshot(page) {
  return page.evaluate(() => ({
    display: document.getElementById('timerDisplay').textContent,
    remaining: timerRemaining,
    tickerActive: timerTicker !== null,
    deadline: state.restTimerEndsAt,
    lifecycle: document.getElementById('timerCard').dataset.timerState,
    skipDisabled: document.getElementById('timerSkip').disabled
  }));
}

async function setVisibility(page, visibilityState) {
  await page.evaluate(next => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: next });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visibilityState);
}

test('Alexa running rest keeps Skip actionable and clears immediately', async ({ page }) => {
  await installAlexaActiveWorkout(page);
  await openApp(page);

  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  const running = await timerSnapshot(page);
  expect(running.deadline).toBeGreaterThan(Date.now());
  expect(running.lifecycle).toBe('running');
  expect(running.tickerActive).toBe(true);
  expect(running.skipDisabled).toBe(false);

  await page.locator('#timerSkip').click();
  const skipped = await timerSnapshot(page);
  expect(skipped).toMatchObject({ deadline: null, lifecycle: 'idle', tickerActive: false, skipDisabled: true });
  await expect(page.locator('#timerNext')).toHaveText('Rest skipped. Timer ready for the next set.');
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).restTimerEndsAt).toBeNull();
});

test('Alexa live deadline reconciles after background and foreground', async ({ page }) => {
  await installAlexaActiveWorkout(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  const deadline = (await timerSnapshot(page)).deadline;

  await setVisibility(page, 'hidden');
  await page.evaluate(() => {
    clearInterval(timerTicker);
    timerTicker = null;
    timerRemaining = 149;
    renderTimer();
  });
  await setVisibility(page, 'visible');

  const resumed = await timerSnapshot(page);
  expect(resumed.deadline).toBe(deadline);
  expect(resumed.lifecycle).toBe('running');
  expect(resumed.tickerActive).toBe(true);
  expect(resumed.skipDisabled).toBe(false);
  expect(resumed.remaining).toBeLessThanOrEqual(Math.ceil((deadline - Date.now()) / 1000));
});

test('Alexa expired-in-background deadline completes once on foreground', async ({ page }) => {
  await installAlexaActiveWorkout(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await setVisibility(page, 'hidden');
  await page.evaluate(() => {
    state.restTimerEndsAt = Date.now() - 1000;
    saveState();
  });
  await setVisibility(page, 'visible');

  const completed = await timerSnapshot(page);
  expect(completed).toMatchObject({ deadline: null, lifecycle: 'ready', tickerActive: false, skipDisabled: true, display: '00:00' });
  const completionKey = await page.evaluate(() => lastAnnouncedCompletionKey);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  expect(await page.evaluate(() => lastAnnouncedCompletionKey)).toBe(completionKey);
});

test('Alexa reload with a future deadline resumes from persisted absolute time', async ({ page }) => {
  await installAlexaActiveWorkout(page);
  await openApp(page);
  const deadline = await page.evaluate(() => {
    state.restTimerEndsAt = Date.now() + 90_000;
    saveState();
    return state.restTimerEndsAt;
  });
  await page.reload();
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();

  const resumed = await timerSnapshot(page);
  expect(resumed.deadline).toBe(deadline);
  expect(resumed.lifecycle).toBe('running');
  expect(resumed.skipDisabled).toBe(false);
  expect(resumed.display).toMatch(/01:(2[7-9]|30)/);
});

test('Alexa reload with an expired deadline resolves to ready without a frozen display', async ({ page }) => {
  await installAlexaActiveWorkout(page, { restTimerEndsAt: Date.now() - 1000 });
  await openApp(page);

  const resolved = await timerSnapshot(page);
  expect(resolved).toMatchObject({ deadline: null, lifecycle: 'ready', tickerActive: false, skipDisabled: true, display: '00:00' });
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).restTimerEndsAt).toBeNull();
});

test('a stale ticker from timer A cannot clear a newer timer B deadline', async ({ page }) => {
  await installAlexaActiveWorkout(page);
  await openApp(page);

  const snapshot = await page.evaluate(async () => {
    const nativeSetInterval = window.setInterval;
    const capturedTicks = [];
    window.setInterval = callback => {
      capturedTicks.push(callback);
      return 9000 + capturedTicks.length;
    };

    state.restTimerEndsAt = Date.now() + 5;
    runRestTimer();
    const timerADeadline = state.restTimerEndsAt;
    const timerATick = capturedTicks[0];
    await new Promise(resolve => setTimeout(resolve, 15));

    state.restTimerEndsAt = Date.now() + 90_000;
    runRestTimer();
    const timerBDeadline = state.restTimerEndsAt;
    window.setInterval = nativeSetInterval;

    timerATick();
    return {
      timerADeadline,
      timerBDeadline,
      persistedDeadline: state.restTimerEndsAt,
      lifecycle: document.getElementById('timerCard').dataset.timerState,
      skipDisabled: document.getElementById('timerSkip').disabled,
      display: document.getElementById('timerDisplay').textContent
    };
  });

  expect(snapshot.timerBDeadline).toBeGreaterThan(snapshot.timerADeadline);
  expect(snapshot.persistedDeadline).toBe(snapshot.timerBDeadline);
  expect(snapshot.lifecycle).toBe('running');
  expect(snapshot.skipDisabled).toBe(false);
  expect(snapshot.display).toMatch(/01:(29|30)/);
});

test('timer A completion-feedback reset cannot clobber timer B', async ({ page }) => {
  await installAlexaActiveWorkout(page);
  await openApp(page);

  const snapshot = await page.evaluate(() => {
    const nativeSetTimeout = window.setTimeout;
    const feedbackCallbacks = [];
    window.setTimeout = (callback, delay, ...args) => {
      if (delay === 3000) {
        feedbackCallbacks.push(callback);
        return 9800 + feedbackCallbacks.length;
      }
      return nativeSetTimeout(callback, delay, ...args);
    };

    state.restTimerEndsAt = Date.now() - 1;
    runRestTimer();
    const staleFeedbackReset = feedbackCallbacks[0];
    state.restTimerEndsAt = Date.now() + 90_000;
    runRestTimer();
    const timerBDeadline = state.restTimerEndsAt;
    staleFeedbackReset();
    window.setTimeout = nativeSetTimeout;
    return {
      timerBDeadline,
      persistedDeadline: state.restTimerEndsAt,
      lifecycle: document.getElementById('timerCard').dataset.timerState,
      skipDisabled: document.getElementById('timerSkip').disabled
    };
  });

  expect(snapshot.persistedDeadline).toBe(snapshot.timerBDeadline);
  expect(snapshot.lifecycle).toBe('running');
  expect(snapshot.skipDisabled).toBe(false);
});

test('consecutive Alexa rests remain independent across expiry feedback', async ({ page }) => {
  await installAlexaActiveWorkout(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  const timerADeadline = (await timerSnapshot(page)).deadline;
  await page.evaluate(() => {
    state.restTimerEndsAt = Date.now() - 1;
    runRestTimer();
  });
  await expect(page.locator('#timerCard')).toHaveAttribute('data-timer-state', 'ready');

  await page.getByRole('button', { name: 'Complete Set 2 of 3' }).click();
  const timerB = await timerSnapshot(page);
  expect(timerB.deadline).toBeGreaterThan(timerADeadline);
  expect(timerB.lifecycle).toBe('running');
  expect(timerB.skipDisabled).toBe(false);

  await page.waitForTimeout(3200);
  const afterTimerAFeedbackWindow = await timerSnapshot(page);
  expect(afterTimerAFeedbackWindow.deadline).toBe(timerB.deadline);
  expect(afterTimerAFeedbackWindow.lifecycle).toBe('running');
  expect(afterTimerAFeedbackWindow.skipDisabled).toBe(false);
});

test('Alexa timer UI state and schema-v5 persistence agree at each transition', async ({ page }) => {
  await installAlexaActiveWorkout(page);
  await openApp(page);
  const initialKeys = Object.keys(await readStoredJson(page, STORAGE_KEYS.alexa)).sort();
  expect(await timerSnapshot(page)).toMatchObject({ deadline: null, lifecycle: 'idle', tickerActive: false, skipDisabled: true });

  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  const running = await timerSnapshot(page);
  expect(running.deadline).toBeGreaterThan(Date.now());
  expect(running.lifecycle).toBe('running');
  expect(running.skipDisabled).toBe(false);
  expect((await readStoredJson(page, STORAGE_KEYS.alexa)).restTimerEndsAt).toBe(running.deadline);

  await page.locator('#timerSkip').click();
  expect(await timerSnapshot(page)).toMatchObject({ deadline: null, lifecycle: 'idle', tickerActive: false, skipDisabled: true });
  const stored = await readStoredJson(page, STORAGE_KEYS.alexa);
  expect(stored.version).toBe(5);
  expect(Object.keys(stored).sort()).toEqual(initialKeys);
  expect(stored).not.toHaveProperty('timerState');
  expect(stored).not.toHaveProperty('timerRemaining');
});

test('Alexa mobile Skip hit target is not intercepted by the sticky card or navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installAlexaActiveWorkout(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await page.locator('#timerSkip').scrollIntoViewIfNeeded();

  const layout = await page.locator('#timerSkip').evaluate(button => {
    const rect = button.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    const navElement = document.querySelector('.bottom-nav');
    const nav = navElement.getBoundingClientRect();
    const card = document.getElementById('timerCard').getBoundingClientRect();
    return {
      hitSkip: hit === button || hit?.closest('#timerSkip') === button,
      skipHeight: rect.height,
      skipBottom: rect.bottom,
      skipCenter: rect.top + rect.height / 2,
      cardRight: card.right,
      navTop: nav.top,
      navVisible: getComputedStyle(navElement).display !== 'none',
      viewportHeight: innerHeight,
      viewportWidth: innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });
  expect(layout.hitSkip).toBe(true);
  expect(layout.skipHeight).toBeGreaterThanOrEqual(44);
  expect(layout.cardRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.skipCenter).toBeLessThanOrEqual(layout.viewportHeight);
  expect(layout.navVisible && layout.skipBottom > layout.navTop).toBe(false);
  expect(layout.horizontalOverflow).toBe(false);
  await page.locator('#timerSkip').click();
  expect(await timerSnapshot(page)).toMatchObject({ deadline: null, lifecycle: 'idle', skipDisabled: true });
});

test('Jorge retains the shared running and Skip lifecycle', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  expect(await timerSnapshot(page)).toMatchObject({ lifecycle: 'running', tickerActive: true, skipDisabled: false });
  await page.locator('#timerSkip').click();
  expect(await timerSnapshot(page)).toMatchObject({ deadline: null, lifecycle: 'idle', tickerActive: false, skipDisabled: true });
});

test('SZW retains the shared running and Skip lifecycle', async ({ page }) => {
  await installSzwActiveWorkout(page);
  await openApp(page);
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  expect(await timerSnapshot(page)).toMatchObject({ lifecycle: 'running', tickerActive: true, skipDisabled: false });
  await page.locator('#timerSkip').click();
  expect(await timerSnapshot(page)).toMatchObject({ deadline: null, lifecycle: 'idle', tickerActive: false, skipDisabled: true });
  expect((await readStoredJson(page, SZW_STORAGE_KEY)).version).toBe(5);
});
