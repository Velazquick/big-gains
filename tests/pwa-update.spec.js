import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { installLocalStorageFixture } from './fixtures/local-storage.js';

const RELEASE = 'v106-safe-pwa-updates';
const V103 = 'v103-rc-hardening-pass-1';
test.setTimeout(60000);
// Exact v103 core from e728f76; shell reduced to its load-only registration and
// marker. This models real worker lifecycle, not every historical v103 UI asset.
async function harness(browser, { legacy = false } = {}) {
  let version = legacy ? V103 : RELEASE, down = false, redirect = null, failWorker = false;
  const root = new URL('../', import.meta.url);
  const server = createServer(async (req, res) => {
    if (down) { req.socket.destroy(); return; }
    if (redirect) { res.writeHead(301, { Location: redirect + req.url }).end(); return; }
    const path = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (failWorker && path === 'service-worker.js') { res.writeHead(503).end(); return; }
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
    try {
      let body;
      if (version === V103) {
        if (path === 'index.html') body = `<title>v103 fixture</title><p id="legacy">${V103}</p><script>window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).catch(console.warn));</script>`;
        else if (path === 'service-worker-core.js') body = await readFile(new URL('tests/fixtures/v103-service-worker-core.js', root));
        else if (path === 'service-worker.js') body = `importScripts('./asset-manifest.js?v=${V103}-config-925e766c1b907250','./service-worker-core.js');const runtime=BigGainsServiceWorkerCore.createRuntime({manifest:BIG_GAINS_ASSET_MANIFEST,cacheStorage:caches,fetcher:request=>fetch(request),baseUrl:self.location.href,clientApi:self.clients});self.addEventListener('install',event=>event.waitUntil(runtime.precache()));self.addEventListener('activate',event=>event.waitUntil(runtime.activate()));self.addEventListener('fetch',event=>{const response=runtime.handle(event.request);if(response)event.respondWith(response);});`;
        else if (path === 'asset-manifest.js') body = `self.BIG_GAINS_ASSET_MANIFEST={release:'${V103}',coreAssets:['./index.html'],styles:[],scripts:[],cachePrefix:'big-gains-shell-',runtimeCachePrefix:'big-gains-runtime-',legacyCacheNames:[],cacheName:'big-gains-shell-${V103}',runtimeCacheName:'big-gains-runtime-${V103}'};`;
        else body = await readFile(new URL(path, root));
      } else {
        body = await readFile(new URL(path, root));
        if (['.html', '.js'].includes(extname(path))) body = body.toString().replaceAll(RELEASE, version);
      }
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await installLocalStorageFixture(page, 'blankJorge');
  await page.goto(origin);
  await controlled(page);
  // A controller can arrive while startup's explicit update check is still in
  // flight. Finish that baseline check before mutating the synthetic deployment.
  if (!legacy) await page.evaluate(() => bigGainsPwaUpdate.check(true));
  return { page, context, origin, deploy: value => { version = value; }, offline: value => { down = value; },
    redirect: value => { redirect = value; }, failWorker: value => { failWorker = value; },
    close: async () => { await context.close(); await new Promise(resolve => server.close(resolve)); } };
}
async function controlled(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
}
async function offer(h) {
  h.deploy('v107-synthetic-update');
  await h.page.evaluate(() => bigGainsPwaUpdate.check(true));
  await expect(h.page.locator('#pwaUpdate')).toBeVisible({ timeout: 15000 });
}
test('real waiting worker: idle approval updates once, preserves data and launches offline', async ({ browser }, testInfo) => {
  const h = await harness(browser);
  try {
    await h.page.evaluate(() => localStorage.setItem('pwa-proof-sentinel', 'unchanged'));
    await offer(h);
    await expect(h.page.locator('#pwaUpdateNow')).toBeEnabled();
    const before = await h.page.evaluate(() => localStorage.getItem('big-gains-v2'));
    await h.page.getByRole('button', { name: 'Update now', exact: true }).focus();
    await Promise.all([h.page.waitForEvent('framenavigated', frame => frame === h.page.mainFrame()), h.page.keyboard.press('Enter')]);
    await h.page.waitForLoadState('load');
    await expect.poll(() => h.page.evaluate(() => window.BIG_GAINS_ASSET_MANIFEST?.release)).toBe('v107-synthetic-update');
    await controlled(h.page);
    expect(await h.page.evaluate(() => localStorage.getItem('pwa-proof-sentinel'))).toBe('unchanged');
    expect(await h.page.evaluate(() => localStorage.getItem('big-gains-v2'))).toBe(before);
    await expect(h.page.locator('#pwaUpdate')).toBeHidden();
    h.offline(true); await h.page.reload();
    await expect(h.page.locator('#quickStartSession')).toBeVisible();
    expect(await h.page.evaluate(() => BIG_GAINS_ASSET_MANIFEST.release)).toBe('v107-synthetic-update');
  } catch (error) {
    // Failure-only, read-only evidence from this synthetic context. Do not warm
    // caches before the offline assertion or turn a failed launch into a retry.
    const evidence = await h.page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const result = { controller: navigator.serviceWorker.controller?.scriptURL,
        active: registration?.active?.state, waiting: registration?.waiting?.state, caches: [] };
      for (const name of await caches.keys()) {
        const cache = await caches.open(name), entries = [];
        for (const request of await cache.keys()) {
          try {
            const response = await cache.match(request);
            entries.push({ url: request.url, status: response?.status, type: response?.type,
              bytes: response ? (await response.arrayBuffer()).byteLength : null });
          } catch (failure) { entries.push({ url: request.url, error: String(failure) }); }
        }
        result.caches.push({ name, entries });
      }
      return result;
    }).catch(failure => ({ diagnosticError: String(failure) }));
    await testInfo.attach('offline-cache-evidence', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
    console.log('PWA offline cache evidence:', JSON.stringify(evidence));
    throw error;
  } finally { await h.close(); }
});
test('real active workout defers update; Later preserves session across background and offline reopen', async ({ browser }) => {
  const h = await harness(browser);
  try {
    await h.page.locator('#quickStartSession').click();
    await expect.poll(() => h.page.evaluate(() => JSON.parse(localStorage.getItem('big-gains-v2')).activeWorkout?.id)).toBeTruthy();
    const before = await h.page.evaluate(() => JSON.parse(localStorage.getItem('big-gains-v2')).activeWorkout);
    await offer(h); await expect(h.page.locator('#pwaUpdateNow')).toBeDisabled();
    await h.page.locator('#pwaUpdateLater').click();
    await h.page.evaluate(() => { dispatchEvent(new Event('focus')); dispatchEvent(new Event('pageshow')); });
    await expect(h.page.locator('#pwaUpdate')).toBeHidden();
    expect(await h.page.evaluate(() => BIG_GAINS_ASSET_MANIFEST.release)).toBe(RELEASE);
    h.offline(true); await h.page.reload();
    expect(await h.page.evaluate(() => JSON.parse(localStorage.getItem('big-gains-v2')).activeWorkout)).toEqual(before);
    await expect(h.page.locator('#activePanel')).toBeVisible();
  } finally { await h.close(); }
});

test('new shell with older worker and failed install has no false restart offer; recovery updates normally', async ({ browser }) => {
  const h = await harness(browser);
  try {
    h.deploy('v107-synthetic-update'); h.failWorker(true);
    await h.page.reload();
    await h.page.evaluate(() => bigGainsPwaUpdate.check(true));
    await expect.poll(() => h.page.evaluate(() => window.bigGainsPwaUpdate?.status().workerRelease)).toBe(RELEASE);
    expect(await h.page.evaluate(() => BIG_GAINS_ASSET_MANIFEST.release)).toBe('v107-synthetic-update');
    await expect(h.page.locator('#pwaUpdate')).toBeHidden();
    expect(await h.page.evaluate(() => bigGainsPwaUpdate.accept())).toBe(false);
    h.failWorker(false);
    await h.page.evaluate(() => bigGainsPwaUpdate.check(true));
    await expect(h.page.locator('#pwaUpdate')).toBeVisible({ timeout: 15000 });
    await Promise.all([h.page.waitForEvent('framenavigated', frame => frame === h.page.mainFrame()), h.page.locator('#pwaUpdateNow').click()]);
    await h.page.waitForLoadState('load');
    await expect.poll(() => h.page.evaluate(() => window.bigGainsPwaUpdate?.status().workerRelease)).toBe('v107-synthetic-update');
    await expect(h.page.locator('#pwaUpdate')).toBeHidden();
  } finally { await h.close(); }
});
for (const [name, setup, cleanup, reason] of [
  ['rest', () => { state.restTimerEndsAt = Date.now() + 60000; }, () => { state.restTimerEndsAt = null; }, 'rest'],
  ['durable queue', () => localStorage.setItem('big-gains-cloud-sync-queue-v1-proof', JSON.stringify({ version: 1, pending: [{}] })), () => localStorage.removeItem('big-gains-cloud-sync-queue-v1-proof'), 'queue'],
  ['Program queue', () => localStorage.setItem('big-gains-program-domain-queue-v1-proof', JSON.stringify({ version: 1, pending: [{}] })), () => localStorage.removeItem('big-gains-program-domain-queue-v1-proof'), 'queue'],
  ['malformed queue', () => localStorage.setItem('big-gains-cloud-sync-queue-v1-proof', '{'), () => localStorage.removeItem('big-gains-cloud-sync-queue-v1-proof'), 'unknown'],
  ['Appearance pending', () => localStorage.setItem('big-gains-appearance-v1-proof', JSON.stringify({ pending: {} })), () => localStorage.removeItem('big-gains-appearance-v1-proof'), 'appearance'],
  ['recovery journal', () => localStorage.setItem(BigGainsManagedProfileRecovery.adoptionKey, '{}'), () => localStorage.removeItem(BigGainsManagedProfileRecovery.adoptionKey), 'recovery'],
  ['open editor', () => document.querySelector('#routineDialog').showModal(), () => document.querySelector('#routineDialog').close(), 'editor']
]) test(`production guard defers ${name} and becomes safe after resolution`, async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge'); await page.goto('/');
  await expect.poll(() => page.evaluate(() => BigGainsPwaUpdate.safety().safe)).toBe(true);
  await page.evaluate(setup);
  expect(await page.evaluate(() => BigGainsPwaUpdate.safety())).toEqual({ safe: false, reason });
  await page.evaluate(cleanup);
  await expect.poll(() => page.evaluate(() => BigGainsPwaUpdate.safety().safe)).toBe(true);
});
test('another open controlled client blocks forced worker activation', async ({ browser }) => {
  const h = await harness(browser);
  try {
    const other = await h.context.newPage(); await other.goto(h.origin); await controlled(other);
    await offer(h); await h.page.locator('#pwaUpdateNow').click();
    await expect(h.page.locator('#pwaUpdateDetail')).toContainText('Close other');
    expect(await h.page.evaluate(() => BIG_GAINS_ASSET_MANIFEST.release)).toBe(RELEASE);
    await other.close();
    await Promise.all([h.page.waitForEvent('framenavigated', frame => frame === h.page.mainFrame()), h.page.locator('#pwaUpdateNow').click()]);
    await h.page.waitForLoadState('load');
    await expect.poll(() => h.page.evaluate(() => BIG_GAINS_ASSET_MANIFEST.release)).toBe('v107-synthetic-update');
  } finally { await h.close(); }
});
test('startup and each resume event request an update; bursts are coalesced', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await page.addInitScript(() => {
    window.updateChecks = 0; window.updateClock = 0;
    const update = ServiceWorkerRegistration.prototype.update;
    ServiceWorkerRegistration.prototype.update = function () { window.updateChecks++; return update.call(this); };
    const now = Date.now; Date.now = () => now() + window.updateClock;
  });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => window.updateChecks)).toBeGreaterThan(0);
  await page.evaluate(() => bigGainsPwaUpdate.check());
  for (const event of ['focus', 'pageshow', 'visibilitychange', 'online']) {
    const before = await page.evaluate(() => window.updateChecks);
    await page.evaluate(name => {
      window.updateClock += 16000;
      (name === 'visibilitychange' ? document : window).dispatchEvent(new Event(name));
    }, event);
    await expect.poll(() => page.evaluate(() => window.updateChecks)).toBe(before + 1);
    await page.evaluate(() => bigGainsPwaUpdate.check());
  }
});
for (const conflict of ['sameEntityConflict', 'remoteFastForward', 'lastResult']) {
  test(`unresolved ${conflict} port blocks restart`, async ({ page }) => {
    await installLocalStorageFixture(page, 'blankJorge'); await page.goto('/');
    await expect.poll(() => page.evaluate(() => BigGainsPwaUpdate.safety().safe)).toBe(true);
    expect(await page.evaluate(key => {
      const original = BigGainsCloudSync;
      window.BigGainsCloudSync = { ...original, status: () => ({ ...original.status(), [key]: { eligible: true, conflict: true } }) };
      const result = BigGainsPwaUpdate.safety(); window.BigGainsCloudSync = original; return result;
    }, conflict)).toEqual({ safe: false, reason: 'recovery' });
  });
}
test('unsubmitted visible form input and unavailable safety state defer restart', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge'); await page.goto('/');
  await expect.poll(() => page.evaluate(() => BigGainsPwaUpdate.safety().safe)).toBe(true);
  await page.evaluate(() => { const input = document.createElement('input'); input.id = 'draft-proof'; input.value = 'unsaved'; document.body.append(input); });
  expect(await page.evaluate(() => BigGainsPwaUpdate.safety())).toEqual({ safe: false, reason: 'editor' });
  await page.evaluate(() => { document.getElementById('draft-proof').remove(); window.BigGainsCloudSync = null; });
  expect(await page.evaluate(() => BigGainsPwaUpdate.safety().safe)).toBe(false);
});
test('a selected hidden restore file blocks restart until the existing writer clears it', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge'); await page.goto('/');
  await expect.poll(() => page.evaluate(() => BigGainsPwaUpdate.safety().safe)).toBe(true);
  await page.evaluate(() => {
    const input = document.getElementById('importData');
    input.style.display = 'none';
    const transfer = new DataTransfer(); transfer.items.add(new File(['{}'], 'pending-restore.json', { type: 'application/json' }));
    input.files = transfer.files; // Do not dispatch change: no restore/data mutation in this test.
  });
  expect(await page.evaluate(() => BigGainsPwaUpdate.safety())).toEqual({ safe: false, reason: 'editor' });
  await page.evaluate(() => { document.getElementById('importData').value = ''; });
  expect(await page.evaluate(() => BigGainsPwaUpdate.safety().safe)).toBe(true);
});
test('v103 same-origin close/reopen permits natural activation without any skipWaiting message', async ({ browser }) => {
  const h = await harness(browser, { legacy: true });
  try {
    await h.page.evaluate(() => localStorage.setItem('close-proof', 'kept'));
    h.deploy(RELEASE);
    await h.page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect.poll(() => h.page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
    await h.page.close();
    const reopened = await h.context.newPage(); await reopened.goto(h.origin);
    await expect(reopened.locator('#quickStartSession')).toBeVisible();
    await expect.poll(() => reopened.evaluate(() => bigGainsPwaUpdate.status().workerRelease)).toBe(RELEASE);
    expect(await reopened.evaluate(() => localStorage.getItem('close-proof'))).toBe('kept');
  } finally { await h.close(); }
});
test('v103 same-origin: can discover waiting worker but cannot activate it; new navigation bootstraps update UI', async ({ browser }) => {
  const h = await harness(browser, { legacy: true });
  try {
    await h.page.evaluate(() => localStorage.setItem('v103-sentinel', 'preserved'));
    h.deploy(RELEASE);
    await h.page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect.poll(() => h.page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting))).toBe(true);
    await expect(h.page.locator('#legacy')).toHaveText(V103);
    await h.page.reload();
    await expect(h.page.locator('#quickStartSession')).toBeVisible();
    await expect(h.page.locator('#pwaUpdate')).toBeVisible();
    await Promise.all([h.page.waitForEvent('framenavigated', frame => frame === h.page.mainFrame()), h.page.locator('#pwaUpdateNow').click()]);
    await h.page.waitForLoadState('load');
    await expect.poll(() => h.page.evaluate(() => bigGainsPwaUpdate.status().workerRelease)).toBe(RELEASE);
    expect(await h.page.evaluate(() => localStorage.getItem('v103-sentinel'))).toBe('preserved');
  } finally { await h.close(); }
});
test('v103 legacy-origin: redirected worker update fails and old cached shell remains; no cross-origin data movement', async ({ browser }) => {
  const old = await harness(browser, { legacy: true });
  const current = await harness(browser);
  try {
    await old.page.evaluate(() => localStorage.setItem('legacy-origin-sentinel', 'preserved'));
    old.redirect(current.origin);
    expect(await old.page.evaluate(async () => {
      try { await (await navigator.serviceWorker.getRegistration()).update(); return 'unexpected'; } catch { return 'rejected'; }
    })).toBe('rejected');
    await old.page.reload();
    await expect(old.page.locator('#legacy')).toHaveText(V103);
    expect(await old.page.evaluate(() => localStorage.getItem('legacy-origin-sentinel'))).toBe('preserved');
    expect(await current.page.evaluate(() => localStorage.getItem('legacy-origin-sentinel'))).toBeNull();
  } finally { await old.close(); await current.close(); }
});
