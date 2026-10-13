import { expect } from '@playwright/test';
import { waitForAppRuntime } from './app.js';

export function recoveryResponseGate() {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  return { pending, release };
}

export async function observeRestorationThenReady(page, { hostname, tables, gate, text, storageKey, originalRaw }) {
  const recordRead = page.waitForRequest(request => request.method() === 'GET'
    && new URL(request.url()).hostname === hostname
    && tables.includes(new URL(request.url()).pathname.split('/').pop()));
  try {
    await page.goto('/');
    await recordRead;
    await expect(page.locator('#independentAccountOnboarding')).toBeVisible();
    await expect(page.locator('#independentAccountOnboarding')).toContainText(text);
    expect(await page.evaluate(() => BigGainsBootGate.canRender())).toBe(false);
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(originalRaw);
  } finally { gate.release(); }
  await waitForAppRuntime(page);
}
