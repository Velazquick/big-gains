import { expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extname } from 'node:path';
import { installLocalStorageFixture } from './fixtures/local-storage.js';

// Exercise real navigation redirects, service workers and origin boundaries.
// No production network, credentials, or application data are used.
test('installed legacy shell survives a Pages redirect without moving local state', async ({ browser, browserName }) => {
  let redirect = false;
  let networkDown = false;
  let target;
  const root = new URL('../', import.meta.url);
  const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
  const serve = prefix => createServer(async (req, res) => {
    if (networkDown) { req.socket.destroy(); return; }
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404).end(); return; }
    const path = url.pathname.slice(prefix.length) || 'index.html';
    if (redirect && prefix === '/big-gains/') {
      res.writeHead(301, { Location: `${target}/${path === 'index.html' ? '' : path}${url.search}` }).end();
      return;
    }
    try {
      const body = await readFile(new URL(path, root));
      res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  const legacyServer = serve('/big-gains/');
  const newServer = serve('/');
  const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await listen(legacyServer);
  await listen(newServer);
  const legacy = `http://127.0.0.1:${legacyServer.address().port}/big-gains/`;
  target = `http://127.0.0.1:${newServer.address().port}`;
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  try {
    const page = await context.newPage();
    await installLocalStorageFixture(page, 'blankJorge');
    await page.goto(legacy);
    await expect(page.locator('#quickStartSession')).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      localStorage.setItem('migration-origin-sentinel', 'legacy-only');
    });
    await page.locator('#quickStartSession').click();
    await expect(page.locator('#activePanel')).toBeVisible();
    const activeBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('big-gains-v2')).activeWorkout);
    expect(activeBefore).toBeTruthy();
    redirect = true;
    await page.reload();
    await expect(page).toHaveURL(legacy);
    await expect(page.locator('#activePanel')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('migration-origin-sentinel'))).toBe('legacy-only');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('big-gains-v2')).activeWorkout.id)).toBe(activeBefore.id);
    const protocolOffline = process.env.PWA_PROTOCOL_OFFLINE === 'true' || browserName !== 'webkit';
    networkDown = !protocolOffline;
    // Windows WebKit's context offline toggle fails before worker dispatch;
    // dropped real server connections exercise the worker's network fallback.
    if (protocolOffline) await context.setOffline(true);
    await page.reload();
    await expect(page.locator('#activePanel')).toBeVisible();
    networkDown = false;
    if (protocolOffline) await context.setOffline(false);
    const fresh = await context.newPage();
    await fresh.goto(target);
    expect(await fresh.evaluate(() => localStorage.getItem('migration-origin-sentinel'))).toBeNull();
    expect(await fresh.evaluate(() => JSON.parse(localStorage.getItem('big-gains-v2') || '{}').activeWorkout || null)).toBeNull();
  } finally {
    await context.close();
    await Promise.all([legacyServer, newServer].map(server => new Promise(resolve => server.close(resolve))));
  }
});

test('exact generated deployment loads all assets, Auth URLs, manifest and offline shell at root', async ({ browser, browserName }) => {
  const directory = await mkdtemp(join(tmpdir(), 'big-gains-domain-'));
  const repo = fileURLToPath(new URL('../', import.meta.url));
  let server;
  let context;
  let networkDown = false;
  try {
    await cp(repo, directory, { recursive: true, filter: source => !['.git', 'node_modules', 'test-results', 'playwright-report'].some(name => source === resolve(repo, name) || source.startsWith(resolve(repo, name) + '/')) });
    await promisify(execFile)(process.execPath, [join(directory, 'scripts/write-cloud-config.mjs')], { env: {
      ...process.env, SUPABASE_URL: 'https://migration-fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_migration_fixture',
      BIG_GAINS_AUTOMATIC_RECONCILIATION: 'true', BIG_GAINS_SELF_SERVE_SIGNUP: 'true', BIG_GAINS_PROGRAM_PORTABILITY: 'true'
    } });
    const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
    const requests = [];
    server = createServer(async (req, res) => {
      if (networkDown) { req.socket.destroy(); return; }
      const path = new URL(req.url, 'http://localhost').pathname;
      requests.push(path);
      try {
        const file = join(directory, path === '/' ? 'index.html' : path);
        res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(await readFile(file));
      } catch { res.writeHead(404).end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    context = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const failures = [];
    page.on('response', response => { if (response.url().startsWith(origin) && response.status() >= 400) failures.push(response.url()); });
    await page.goto(origin);
    await expect(page.locator('#accountOnboardingCreate')).toBeVisible();
    await page.locator('#accountOnboardingCreate').click();
    await expect(page.locator('#accountSignupEmail')).toBeVisible();
    const state = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
      const manifest = await (await fetch('./manifest.webmanifest')).json();
      const assets = window.BIG_GAINS_ASSET_MANIFEST;
      const cache = await caches.open(assets.cacheName);
      return { config: window.__BIG_GAINS_CLOUD_CONFIG__, scope: registration.scope, script: navigator.serviceWorker.controller.scriptURL,
        start: new URL(manifest.start_url, location.href).href, manifestScope: new URL(manifest.scope, location.href).href,
        expected: assets.coreAssets.map(path => new URL(path, location.href).href).sort(), cached: (await cache.keys()).map(r=>r.url).sort() };
    });
    expect(state.config).toMatchObject({ selfServeSignup: true, programPortability: true, programPortabilityVersion: 1,
      authRedirectUrl: 'https://app.getbiggains.com/', authSetupRedirectUrl: 'https://app.getbiggains.com/auth-setup.html' });
    expect(state.scope).toBe(origin + '/');
    expect(state.script).toBe(origin + '/service-worker.js');
    expect(state.start).toBe(origin + '/');
    expect(state.manifestScope).toBe(origin + '/');
    expect(state.cached).toEqual(state.expected);
    expect(failures).toEqual([]);
    expect(requests.some(path => path.includes('/big-gains/'))).toBe(false);
    const protocolOffline = process.env.PWA_PROTOCOL_OFFLINE === 'true' || browserName !== 'webkit';
    networkDown = !protocolOffline;
    if (protocolOffline) await context.setOffline(true);
    await page.reload();
    await expect(page).toHaveTitle('Big Gains');
    await expect(page.locator('#accountOnboardingCreate')).toBeVisible();
    await page.goto(origin + '/auth-setup.html');
    await expect(page.locator('body')).toContainText('Big Gains');
  } finally {
    await context?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    // directory is the exact task-owned mkdtemp result, never a user checkout.
    await rm(directory, { recursive: true, force: true });
  }
});
