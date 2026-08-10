import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const CURRENT_CACHE = 'big-gains-shell-v62-timer-resume-reliability';
const PREVIOUS_CACHE = 'big-gains-shell-v61-partial-blank-fresh-recovery';

async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
    }
  });
}

test('first install precaches one complete, revision-consistent app shell', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await waitForServiceWorker(page);

  const state = await page.evaluate(async cacheName => {
    const manifest = window.BIG_GAINS_ASSET_MANIFEST;
    const cache = await caches.open(cacheName);
    return {
      cacheNames: await caches.keys(),
      cachedUrls: (await cache.keys()).map(request => request.url).sort(),
      expectedUrls: manifest.coreAssets.map(path => new URL(path, location.href).href).sort(),
      release: manifest.release
    };
  }, CURRENT_CACHE);

  expect(state.release).toBe('v62-timer-resume-reliability');
  expect(state.cacheNames).toContain(CURRENT_CACHE);
  expect(state.cachedUrls).toEqual(state.expectedUrls);
  expect(state.cachedUrls).toContain(new URL('/assets/timer-ready.wav', page.url()).href);
});

test('updates the previous Big Gains cache without deleting unrelated origin caches', async ({ page }) => {
  await page.goto('/manifest.webmanifest?prepare-cache-update');
  await page.evaluate(async ({ previousCache, unrelatedCache }) => {
    await (await caches.open(previousCache)).put('/old-shell', new Response('old'));
    await (await caches.open(unrelatedCache)).put('/keep-me', new Response('unrelated'));
  }, { previousCache: PREVIOUS_CACHE, unrelatedCache: 'analytics-library-cache-v1' });

  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await waitForServiceWorker(page);

  await expect.poll(() => page.evaluate(() => caches.keys())).toEqual(
    expect.arrayContaining([CURRENT_CACHE, 'analytics-library-cache-v1'])
  );
  expect(await page.evaluate(() => caches.keys())).not.toContain(PREVIOUS_CACHE);
  expect(await page.evaluate(async () => Boolean(await caches.match('/keep-me')))).toBe(true);
});

test('production assets use the manifest release once and contain no duplicate core entries', async ({ page, request }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);

  const consistency = await page.evaluate(() => {
    const manifest = window.BIG_GAINS_ASSET_MANIFEST;
    const loadedStyles = [...document.querySelectorAll('[data-big-gains-asset="style"]')]
      .map(link => link.getAttribute('href'));
    const loadedScripts = [...document.querySelectorAll('[data-big-gains-asset="script"]')]
      .map(script => script.getAttribute('src'));
    return {
      coreAssets: manifest.coreAssets,
      loadedScripts,
      loadedStyles,
      scripts: manifest.scripts,
      styles: manifest.styles
    };
  });
  const indexSource = await (await request.get('/index.html')).text();
  const workerSource = await (await request.get('/service-worker.js')).text();

  expect(consistency.loadedStyles).toEqual(consistency.styles);
  expect(consistency.loadedScripts).toEqual(consistency.scripts);
  expect(new Set(consistency.coreAssets).size).toBe(consistency.coreAssets.length);
  expect(consistency.coreAssets.filter(path => path === './index.html')).toHaveLength(1);
  expect(consistency.coreAssets).not.toContain('./');
  expect(indexSource).not.toMatch(/\.(?:css|js)\?v=/);
  expect(workerSource).not.toContain('?v=');
  expect(workerSource).toContain("importScripts('./asset-manifest.js', './service-worker-core.js')");
});

test('precache and runtime writes settle before success and propagate write failures', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ url: '/service-worker-core.js' });

  const result = await page.evaluate(async () => {
    const baseManifest = {
      release: 'test-release',
      cachePrefix: 'test-shell-',
      cacheName: 'test-shell-current',
      runtimeCachePrefix: 'test-runtime-',
      runtimeCacheName: 'test-runtime-current',
      legacyCacheNames: [],
      coreAssets: ['./required.js'],
      styles: ['./required.js'],
      scripts: []
    };
    const makeRuntime = put => BigGainsServiceWorkerCore.createRuntime({
      manifest: baseManifest,
      cacheStorage: {
        delete: async () => true,
        keys: async () => [],
        open: async () => ({ match: async () => null, put })
      },
      fetcher: async () => new Response('ok'),
      baseUrl: 'https://example.test/service-worker.js',
      clientApi: { claim: async () => undefined }
    });
    let resolvePrecacheWrite;
    let precacheWriteStarted;
    const precacheStarted = new Promise(resolve => { precacheWriteStarted = resolve; });
    const precacheRuntime = makeRuntime(() => {
      precacheWriteStarted();
      return new Promise(resolve => { resolvePrecacheWrite = resolve; });
    });
    let precacheSettled = false;
    const precachePromise = precacheRuntime.precache().then(() => { precacheSettled = true; });
    await precacheStarted;
    const precacheWaited = !precacheSettled;
    resolvePrecacheWrite();
    await precachePromise;

    let resolveRuntimeWrite;
    let runtimeWriteStarted;
    const runtimeStarted = new Promise(resolve => { runtimeWriteStarted = resolve; });
    const runtime = makeRuntime(() => {
      runtimeWriteStarted();
      return new Promise(resolve => { resolveRuntimeWrite = resolve; });
    });
    let runtimeSettled = false;
    const runtimePromise = runtime.handle(new Request('https://example.test/runtime.json'))
      .then(() => { runtimeSettled = true; });
    await runtimeStarted;
    const runtimeWaited = !runtimeSettled;
    resolveRuntimeWrite();
    await runtimePromise;

    const rejectionMessage = async operation => {
      try {
        await operation();
        return null;
      } catch (error) {
        return error.message;
      }
    };
    const rejectingRuntime = makeRuntime(async () => { throw new Error('cache write rejected'); });
    return {
      precacheWaited,
      runtimeWaited,
      precacheFailure: await rejectionMessage(() => rejectingRuntime.precache()),
      runtimeFailure: await rejectionMessage(() => rejectingRuntime.handle(new Request('https://example.test/runtime.json')))
    };
  });

  expect(result).toEqual({
    precacheWaited: true,
    runtimeWaited: true,
    precacheFailure: 'cache write rejected',
    runtimeFailure: 'cache write rejected'
  });
});

test('reloads offline after the service worker is installed', async ({ context, page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await waitForServiceWorker(page);
  await expect.poll(() => page.evaluate(() => caches.keys())).toContain(CURRENT_CACHE);

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

test('reloads an active session offline directly into Workout Mode', async ({ context, page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  await waitForServiceWorker(page);
  await expect(page.locator('body')).toHaveClass(/workout-mode/);

  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle('Big Gains');
    await expect(page.locator('body')).toHaveClass(/workout-mode/);
    await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
    await expect(page.locator('.bottom-nav')).toBeHidden();
    const soundAsset = await page.evaluate(async () => {
      const response = await fetch('/assets/timer-ready.wav');
      return { bytes: (await response.arrayBuffer()).byteLength, contentType: response.headers.get('content-type'), ok: response.ok };
    });
    expect(soundAsset).toEqual({ bytes: 18_566, contentType: 'audio/wav', ok: true });
  } finally {
    await context.setOffline(false);
  }
});
