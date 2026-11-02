import { test, expect } from '@playwright/test';
import { openApp, reloadApp, switchProfile, waitForAppRuntime } from './helpers/app.js';
import { installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
// Hold required script insertion, so cached transport cannot bypass the actual
// composition boundary. Installed/offline behavior has real-worker tests.
test.use({ serviceWorkers: 'block' });

for (const transition of ['cold navigation', 'reload']) test(`runtime readiness waits for real shell composition after ${transition}`, async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  if (transition === 'reload') await openApp(page);
  let settled = false;
  await page.addInitScript(() => {
    const append = Node.prototype.appendChild;
    let pending = null;
    window.__bigGainsTestShellGate = {
      requested: false,
      release() {
        Node.prototype.appendChild = append;
        if (pending) append.call(pending.parent, pending.script);
      }
    };
    Node.prototype.appendChild = function (child) {
      if (this === document.body && child.tagName === 'SCRIPT'
          && new URL(child.src, location.href).pathname === '/v2-shell.js') {
        pending = { parent: this, script: child };
        window.__bigGainsTestShellGate.requested = true;
        return child;
      }
      return append.call(this, child);
    };
  });
  const navigation = transition === 'reload' ? page.reload({ waitUntil: 'domcontentloaded' }) : page.goto('/', { waitUntil: 'domcontentloaded' });
  await navigation;
  await page.waitForFunction(() => window.__bigGainsTestShellGate?.requested === true);
  const ready = waitForAppRuntime(page, { profileId: 'jorge' }).then(() => { settled = true; });
  try {
    await page.waitForFunction(() => window.BigGainsAppRuntime?.initialized === true);
    await expect(page.locator('#bootShell')).toBeVisible();
    expect(await page.evaluate(() => ({ interactive: BigGainsRuntimeGate.canInteract(), shell: typeof window.bigGainsViewShell })))
      .toEqual({ interactive: false, shell: 'undefined' });
    expect(settled).toBe(false);
  } finally { await page.evaluate(() => window.__bigGainsTestShellGate.release()); }
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

for (const transition of ['reload', 'profile switch']) test(`feature access waits for owned composition after ${transition}`, async ({ page }) => {
  await installLocalStorageFixture(page, ['blankAlexa', 'completedWorkouts']);
  await openApp(page, { profileId: 'jorge' });
  const original = await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [STORAGE_KEYS.jorge, STORAGE_KEYS.alexa]);
  const component = transition === 'reload' ? 'cloud-shadow.js' : 'app.js';
  await page.addInitScript(component => {
    const append = Node.prototype.appendChild;
    let pending;
    window.__bigGainsFeatureGate = {
      requested: false,
      release() {
        Node.prototype.appendChild = append;
        if (pending) append.call(pending.parent, pending.script);
      }
    };
    Node.prototype.appendChild = function (child) {
      if (this === document.body && child.tagName === 'SCRIPT'
          && new URL(child.src, location.href).pathname === `/${component}`) {
        pending = { parent: this, script: child };
        window.__bigGainsFeatureGate.requested = true;
        return child;
      }
      return append.call(this, child);
    };
  }, component);
  let settled = false;
  const ready = (transition === 'reload'
    ? reloadApp(page, { waitUntil: 'domcontentloaded', profileId: 'jorge' })
    : switchProfile(page, 'alexa')).then(() => { settled = true; });
  try {
    await page.waitForFunction(() => window.__bigGainsFeatureGate?.requested === true);
    expect(settled).toBe(false);
    await expect(page.locator('#bootShell')).toBeVisible();
    expect(await page.evaluate(() => window.BigGainsRuntimeGate?.canInteract() === true)).toBe(false);
    if (transition === 'reload') await expect(page.evaluate(() => BigGainsCloudShadow.profileIds)).rejects.toThrow(/BigGainsCloudShadow/);
    else await expect(page.evaluate(() => bigGainsGoals.createGoal)).rejects.toThrow(/bigGainsGoals/);
    expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [STORAGE_KEYS.jorge, STORAGE_KEYS.alexa])).toEqual(original);
  } finally { await page.evaluate(() => window.__bigGainsFeatureGate.release()); }
  await ready;
  expect(settled).toBe(true);
  expect(await page.evaluate(() => ({ cloud: typeof window.BigGainsCloudShadow?.localRecords, goals: typeof window.bigGainsGoals?.createGoal })))
    .toEqual({ cloud: 'function', goals: 'function' });
  expect(await page.evaluate(() => window.BigGainsAppRuntime.profileId)).toBe(transition === 'reload' ? 'jorge' : 'alexa');
  expect(await page.evaluate(keys => keys.map(key => localStorage.getItem(key)), [STORAGE_KEYS.jorge, STORAGE_KEYS.alexa])).toEqual(original);
});
