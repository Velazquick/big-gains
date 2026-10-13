import { expect } from '@playwright/test';
import { waitForAppRuntime } from './app.js';

export function recoveryResponseGate() {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  return { pending, release };
}

export async function observeRestorationThenReady(page, { hostname, tables, gate, text, storageKey, originalRaw, recordRead: nativeRecordRead }) {
  const recordRead = nativeRecordRead || page.waitForRequest(request => request.method() === 'GET'
    && new URL(request.url()).hostname === hostname
    && tables.includes(new URL(request.url()).pathname.split('/').pop()));
  let observed = false, observationError;
  recordRead.then(() => { observed = true; }, error => { observationError = error; });
  try {
    await page.goto('/');
    await expect.poll(() => {
      if (observationError) throw observationError;
      return observed;
    }, { message: 'The synthetic recovery record GET must reach its transport gate.' }).toBe(true);
    await expect(page.locator('#independentAccountOnboarding')).toBeVisible();
    await expect(page.locator('#independentAccountOnboarding')).toContainText(text);
    expect(await page.evaluate(() => BigGainsBootGate.canRender())).toBe(false);
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(originalRaw);
  } finally { gate.release(); }
  await waitForAppRuntime(page);
}
