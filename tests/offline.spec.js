import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

test('reloads offline after the service worker is installed', async ({ context, page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
    }
  });
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain('big-gains-v33-state-persistence-api');

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle('Big Gains');
    await expect(page.locator('#greeting')).toContainText('Jorge');
    await expect(page.locator('#sessionTypeSelector')).toBeAttached();
    await expect(page.locator('#quickStartSession')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
