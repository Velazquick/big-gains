import { test as base, expect } from '@playwright/test';

// Real-worker fixtures need their own WebKit process, not just a new context.
// Shared-process Linux failures retained a controller after the registration
// and all origin caches disappeared during reload. Keep the assertions intact
// and isolate storage teardown from other tests' contexts.
export const test = base.extend({
  serviceWorkerBrowser: async ({ browser, browserName, headless, launchOptions }, use) => {
    if (browserName !== 'webkit') { await use(browser); return; }
    const isolated = await browser.browserType().launch({ ...launchOptions, headless });
    try { await use(isolated); } finally { await isolated.close(); }
  }
});
export { expect };
