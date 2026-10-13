import { test, expect } from '@playwright/test';
import { openApp, waitForAppRuntime } from './helpers/app.js';
import { installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
// These tests hold script transport. A controlling worker can fulfill it before
// Playwright routing; installed/offline behavior has separate real-worker tests.
test.use({ serviceWorkers: 'block' });

for (const transition of ['cold navigation', 'reload']) test(`runtime readiness waits for real shell composition after ${transition}`, async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  if (transition === 'reload') await openApp(page);
  let release, requested, settled = false;
  const held = new Promise(resolve => { release = resolve; });
  const observed = new Promise(resolve => { requested = resolve; });
  await page.route('**/v2-shell.js?*', async route => { requested(); await held; await route.continue(); });
  const navigation = transition === 'reload' ? page.reload({ waitUntil: 'domcontentloaded' }) : page.goto('/', { waitUntil: 'domcontentloaded' });
  await observed;
  const ready = waitForAppRuntime(page, { profileId: 'jorge' }).then(() => { settled = true; });
  try {
    await page.waitForFunction(() => window.BigGainsAppRuntime?.initialized === true);
    await expect(page.locator('#bootShell')).toBeVisible();
    expect(await page.evaluate(() => ({ interactive: BigGainsRuntimeGate.canInteract(), shell: typeof window.bigGainsViewShell })))
      .toEqual({ interactive: false, shell: 'undefined' });
    expect(settled).toBe(false);
  } finally { release(); }
  await navigation;
  await ready;
  expect(settled).toBe(true);
  expect(await page.evaluate(() => BigGainsBootGate.canRender() && BigGainsRuntimeGate.canInteract())).toBe(true);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).workouts[0].id, STORAGE_KEYS.jorge)).toBe('completed-push-1');
});

test('startup recovery is explicit and cannot satisfy an interactive expectation', async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await page.route('**/v2-shell.js?*', route => route.abort());
  await page.goto('/');
  await waitForAppRuntime(page, { expected: 'recovery', reason: 'required-asset-load-failed' });
  await expect(page.locator('#bootRetry')).toBeVisible();
  expect(await page.evaluate(() => BigGainsRuntimeGate.canInteract())).toBe(false);
  page.setDefaultTimeout(1_000);
  await expect(waitForAppRuntime(page)).rejects.toThrow(/Timeout/);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).workouts[0].id, STORAGE_KEYS.jorge)).toBe('completed-push-1');
});
