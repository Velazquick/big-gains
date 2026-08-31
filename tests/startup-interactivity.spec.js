import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { createProgramFixture } from './helpers/program.js';

async function observeInteractiveTransitions(page) {
  await page.addInitScript(() => {
    window.__runtimeInteractiveTransitions = 0;
    document.addEventListener('big-gains-runtime-state-changed', event => {
      if (event.detail?.state === 'interactive') window.__runtimeInteractiveTransitions += 1;
    });
  });
}

async function expectInteractiveOnce(page) {
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await expect(page.locator('html')).toHaveAttribute('data-runtime-state', 'interactive');
  await expect(page.locator('.app-shell')).toBeVisible();
  expect(await page.evaluate(() => ({
    transitions: window.__runtimeInteractiveTransitions,
    runtime: BigGainsRuntimeGate.status(),
    shell: BigGainsShell.status()
  }))).toMatchObject({
    transitions: 1,
    runtime: { state: 'interactive', attempt: 1, diagnostic: null },
    shell: { initialized: true, personalizedInitialized: true, failure: null }
  });
}

async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    }
  });
}

test('identity authorization cannot reveal the shell before delayed composition completes', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');

  let releaseComposition;
  let compositionRequested;
  const compositionGate = new Promise(resolve => { releaseComposition = resolve; });
  const requestObserved = new Promise(resolve => { compositionRequested = resolve; });
  await page.route('**/program-setup.js?*', async route => {
    compositionRequested();
    await compositionGate;
    await route.continue();
  });

  const navigation = page.goto('/', { waitUntil: 'domcontentloaded' });
  await requestObserved;
  try {
    await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
    await expect(page.locator('html')).toHaveAttribute('data-runtime-state', /loading|initializing/);
    await expect(page.locator('#bootShell')).toBeVisible();
    await expect(page.locator('.app-shell')).toBeHidden();
    expect(await page.evaluate(() => ({
      inert: document.querySelector('.app-shell')?.inert,
      runtime: window.BigGainsRuntimeGate?.status?.() || null,
      viewShellLoaded: Boolean(window.bigGainsViewShell),
      sessionSelectorLoaded: Boolean(window.sessionSelector)
    }))).toMatchObject({
      inert: true,
      runtime: { state: 'loading' },
      viewShellLoaded: false,
      sessionSelectorLoaded: false
    });
  } finally {
    releaseComposition();
  }

  await navigation;
  await expect(page.locator('html')).toHaveAttribute('data-runtime-state', 'interactive');
  await expect(page.locator('.app-shell')).toBeVisible();
});

test('a required controller failure exposes explicit neutral recovery instead of a normal dead shell', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await page.route('**/v2-shell.js?*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `window.bigGainsViewShell=Object.freeze({initialize(){throw new Error('synthetic required failure')},showView(){return false}});`
  }));

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await expect(page.locator('html')).toHaveAttribute('data-runtime-state', 'recovery');
  await expect(page.locator('#bootShell')).toBeVisible();
  await expect(page.locator('#bootShellDetail')).toContainText('could not finish starting');
  await expect(page.locator('#bootRetry')).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
  expect(await page.evaluate(() => BigGainsRuntimeGate.status())).toMatchObject({
    state: 'recovery',
    reason: 'required-module-init-failed',
    diagnostic: { code: 'required-module-init-failed', component: 'view-shell' }
  });
});

test('a missing required startup asset is diagnosed and never exposed as an interactive shell', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await page.route('**/v2-shell.js?*', route => route.abort('failed'));

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-runtime-state', 'recovery');
  await expect(page.locator('#bootShell')).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
  expect(await page.evaluate(() => ({
    runtime: BigGainsRuntimeGate.status(),
    assets: BigGainsAssetStatus.status()
  }))).toMatchObject({
    runtime: {
      state: 'recovery',
      diagnostic: { code: 'required-asset-load-failed', component: 'v2-shell-js' }
    },
    assets: {
      requiredFailures: [{ code: 'required-asset-load-failed', component: 'v2-shell.js', required: true }]
    }
  });
});

test('an optional module failure records degradation while core navigation remains interactive', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await page.route('**/training-pet.js?*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `window.trainingPet=Object.freeze({initialize(){throw new Error('synthetic optional failure')},render(){return false}});`
  }));

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-runtime-state', 'interactive');
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'progress');
  expect(await page.evaluate(() => BigGainsRuntimeGate.status().degraded)).toContainEqual({
    code: 'optional-module-init-failed',
    component: 'training-pet'
  });
});

test('mobile cold launch reaches the interactive boundary exactly once and Start Workout dispatches', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await observeInteractiveTransitions(page);
  await installLocalStorageFixture(page, 'blankJorge', { now: '2026-08-24T12:00:00.000Z' });
  await page.goto('/');
  await expectInteractiveOnce(page);

  await page.locator('#quickStartSession').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'train');
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout).not.toBeNull();
});

test('warm service-worker-controlled reload reaches the interactive boundary exactly once', async ({ page }) => {
  await observeInteractiveTransitions(page);
  await installLocalStorageFixture(page, 'blankJorge');
  await page.goto('/');
  await expectInteractiveOnce(page);
  await waitForServiceWorker(page);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expectInteractiveOnce(page);
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
});

test('offline cached reload becomes interactive or recovery, never a normal dead shell', async ({ context, page }) => {
  await observeInteractiveTransitions(page);
  await installLocalStorageFixture(page, 'completedWorkouts');
  await page.goto('/');
  await waitForServiceWorker(page);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    const state = await page.locator('html').getAttribute('data-runtime-state');
    expect(['interactive', 'recovery']).toContain(state);
    if (state === 'interactive') {
      await expectInteractiveOnce(page);
      await page.locator('.bottom-nav [data-view="progress"]').click();
      await expect(page.locator('body')).toHaveAttribute('data-view', 'progress');
    } else {
      await expect(page.locator('#bootShell')).toBeVisible();
      await expect(page.locator('.app-shell')).toBeHidden();
    }
  } finally {
    await context.setOffline(false);
  }
});

test('pageshow, focus, visibility, and repeated initialize calls do not duplicate core listeners', async ({ page }) => {
  await observeInteractiveTransitions(page);
  await installLocalStorageFixture(page, 'blankJorge');
  await page.goto('/');
  await expectInteractiveOnce(page);

  const result = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let viewWrites = 0;
    Storage.prototype.setItem = function (key, ...args) {
      if (this === sessionStorage && key === 'big-gains-view') viewWrites += 1;
      return original.call(this, key, ...args);
    };
    try {
      window.dispatchEvent(new Event('pageshow'));
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      const repeated = [BigGainsShell.initialize(), bigGainsViewShell.initialize(), sessionSelector.initialize()];
      document.querySelector('.bottom-nav [data-view="progress"]').click();
      return { repeated, viewWrites, transitions: window.__runtimeInteractiveTransitions };
    } finally {
      Storage.prototype.setItem = original;
    }
  });
  expect(result).toEqual({ repeated: [false, false, false], viewWrites: 1, transitions: 1 });
});

test('declared readiness is a cross-surface contract for Train, Program, History, Calendar, and Edit', async ({ page }) => {
  await observeInteractiveTransitions(page);
  await installLocalStorageFixture(page, 'completedWorkouts', { now: '2026-08-24T12:00:00.000Z' });
  await page.goto('/');
  await expectInteractiveOnce(page);

  for (const view of ['plan', 'train', 'today']) {
    await page.locator(`.bottom-nav [data-view="${view}"]`).click();
    await expect(page.locator('body')).toHaveAttribute('data-view', view);
  }

  await page.locator('#quickStartSession').click();
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
  await page.evaluate(() => workoutSessionController.discard());
  await page.locator('.bottom-nav [data-view="today"]').click();

  await createProgramFixture(page, { name: 'Startup smoke Program' });
  await page.locator('#todayPlanActions [data-start-program-session]').click();
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout.programOrigin).toMatchObject({
    contract: 'big-gains.program-origin.v1',
    profileId: 'jorge'
  });
  await page.evaluate(() => workoutSessionController.discard());

  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator('[data-open-history-archive]').first().click();
  await expect(page.locator('#historyListTab')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#historyCalendarTab').click();
  await expect(page.locator('#historyCalendarTab')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#historyListTab').click();
  await page.locator('#historyArchiveList [data-history-id="completed-push-1"]').click();
  await expect(page.locator('#historyDialog')).toBeVisible();
  await page.locator('#editCompletedWorkout').click();
  await expect(page.locator('#retrospectiveDialog')).toBeVisible();
  await page.locator('#cancelRetrospectiveWorkout').click();
  await expect(page.locator('#historyArchiveDialog')).toBeVisible();
  await page.locator('#closeHistoryArchive').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'progress');
  expect(await page.evaluate(() => window.__runtimeInteractiveTransitions)).toBe(1);
});

test('active workout resumes only after readiness and readiness transitions do not mutate schema-v5 state', async ({ page }) => {
  await observeInteractiveTransitions(page);
  await installLocalStorageFixture(page, ['activeWorkoutWithExercises', 'blankAlexa'], { activeProfile: 'jorge' });
  await page.goto('/');
  await expectInteractiveOnce(page);
  await expect(page.locator('body')).toHaveClass(/workout-mode/);
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);

  const before = await readStoredJson(page, STORAGE_KEYS.jorge);
  const alexaBefore = await readStoredJson(page, STORAGE_KEYS.alexa);
  await page.evaluate(() => {
    window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  const alexaAfter = await readStoredJson(page, STORAGE_KEYS.alexa);
  expect(after).toEqual(before);
  expect(after.version).toBe(5);
  expect(after).not.toHaveProperty('runtimeState');
  expect(alexaAfter).toEqual(alexaBefore);
});

test('manifest required and optional script partitions are complete and release-consistent', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await page.goto('/');
  const result = await page.evaluate(() => {
    const manifest = BIG_GAINS_ASSET_MANIFEST;
    return {
      release: manifest.release,
      scripts: manifest.scripts,
      partition: [...manifest.requiredScripts, ...manifest.optionalScripts],
      overlap: manifest.requiredScripts.filter(script => manifest.optionalScripts.includes(script)),
      runtimeGateCount: manifest.coreAssets.filter(asset => asset.includes('runtime-interactivity-gate.js')).length
    };
  });
  expect(result.release).toBe('v97-program-portability-convergence');
  expect(new Set(result.partition)).toEqual(new Set(result.scripts));
  expect(result.overlap).toEqual([]);
  expect(result.runtimeGateCount).toBe(1);
});
