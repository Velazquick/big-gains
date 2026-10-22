import { test, expect } from '@playwright/test';
import { openApp, waitForAppRuntime } from './helpers/app.js';
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
