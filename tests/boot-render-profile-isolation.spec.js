import { expect, test } from '@playwright/test';

const ORIGIN = 'https://boot-isolation.supabase.co';
const NOW = '2026-08-19T12:00:00.000Z';
const RELEASE = 'v87-program-1a-canonical-routine-capture';
const CONFIG_VERSION = 'config-ab51ee79cd36825d';

const identities = Object.freeze({
  jorge: Object.freeze({
    kind: 'managed-owner', authUserId: '86000000-0000-0000-0000-000000000001',
    accountId: '86a00000-0000-0000-0000-000000000001', displayName: 'Jorge'
  }),
  sontai: Object.freeze({
    kind: 'independent', authUserId: '86000000-0000-0000-0000-000000000002',
    accountId: '86a00000-0000-0000-0000-000000000002',
    profileId: '86b00000-0000-0000-0000-000000000002',
    clientId: 'independent-sontai', displayName: 'Sontai'
  })
});

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sessionFor(identity) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: identity.authUserId, role: 'authenticated', exp: expiresAt })}.synthetic`,
    refresh_token: `refresh-${identity.authUserId}`, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt,
    user: {
      id: identity.authUserId, aud: 'authenticated', role: 'authenticated',
      email: `${identity.displayName.toLowerCase()}@example.test`, email_confirmed_at: NOW,
      app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: NOW
    }
  };
}

function storageKeyFor(identity) {
  return identity.kind === 'independent'
    ? `big-gains-cloud-${identity.accountId}-${identity.profileId}-v1`
    : 'big-gains-v2';
}

function stateFor(identity, { active = false } = {}) {
  const profileId = identity.kind === 'independent' ? identity.clientId : 'jorge';
  const secret = identity.displayName === 'Jorge' ? 'Jorge Secret Press' : 'Sontai Secret Row';
  return {
    version: 5, profileId,
    goals: { primary: `${identity.displayName} private strength target` },
    workouts: [{
      id: `${profileId}-history`, type: 'Push', startedAt: '2026-08-18T17:00:00.000Z',
      completedAt: '2026-08-18T18:00:00.000Z', durationSeconds: 3600, prs: 0,
      exercises: [{ id: `${profileId}-secret`, name: secret, muscle: 'Chest', equipment: 'Machine', sets: [] }]
    }],
    weights: [{ weight: identity.displayName === 'Jorge' ? 311.7 : 188.2, date: NOW }],
    prs: {},
    activeWorkout: active ? {
      id: `${profileId}-active`, type: 'Push', startedAt: NOW,
      exercises: [{
        id: 'barbell-bench-press', name: secret, muscle: 'Chest', equipment: 'Barbell', collapsed: false,
        sets: [{ id: `${profileId}-set`, weight: 135, reps: 5, warmup: false, completed: false }]
      }]
    } : null,
    restTimerEndsAt: null,
    customRoutines: { Push: [{ exerciseId: 'barbell-bench-press', workingSets: 3, targetReps: '5' }] },
    timerPreferences: { sound: true, vibration: true }
  };
}

function runtimeRecord(identity) {
  if (identity.kind === 'managed-owner') {
    return { kind: 'managed-owner', authUserId: identity.authUserId, cloudAccountId: identity.accountId };
  }
  return {
    kind: 'independent', authUserId: identity.authUserId, cloudAccountId: identity.accountId,
    cloudProfileId: identity.profileId, clientId: identity.clientId, displayName: identity.displayName,
    presentation: { petEnabled: false, accent: 'cobalt', theme: 'performance-dark' }
  };
}

function profileRows(identity) {
  if (identity.kind === 'managed-owner') {
    return [
      { id: '86b00000-0000-0000-0000-000000000011', account_id: identity.accountId, client_id: 'jorge', display_name: 'Jorge', pet_enabled: true, accent: 'ember', theme: 'performance-dark', created_at: NOW },
      { id: '86b00000-0000-0000-0000-000000000012', account_id: identity.accountId, client_id: 'alexa', display_name: 'Alexa', pet_enabled: true, accent: 'rose', theme: 'wellness-light', created_at: NOW }
    ];
  }
  return [{
    id: identity.profileId, account_id: identity.accountId, client_id: identity.clientId,
    display_name: identity.displayName, pet_enabled: false, accent: 'cobalt', theme: 'performance-dark', created_at: NOW
  }];
}

async function installFixture(page, {
  sessionIdentity, staleIdentity = sessionIdentity, activeProfile = 'jorge',
  includeSession = true, activeSession = false, recoveryMarker = false
}) {
  const states = {
    [storageKeyFor(identities.jorge)]: stateFor(identities.jorge),
    'big-gains-alexa-v1': { ...stateFor(identities.jorge), profileId: 'alexa', goals: { primary: 'Alexa private target' }, weights: [{ weight: 177.4, date: NOW }] },
    [storageKeyFor(identities.sontai)]: stateFor(identities.sontai, { active: activeSession })
  };
  const fixtureSession = includeSession ? sessionFor(sessionIdentity) : null;
  const staleRecord = runtimeRecord(staleIdentity);
  await page.addInitScript(({ fixtureSession, staleRecord, staleAuthUserId, states, activeProfile, recoveryMarker, sontai }) => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = {
      supabaseUrl: 'https://boot-isolation.supabase.co',
      supabasePublishableKey: 'sb_publishable_boot_isolation',
      authRedirectUrl: 'https://velazquick.github.io/big-gains/'
    };
    if (sessionStorage.getItem('boot-isolation-fixture') !== 'installed') {
      localStorage.clear();
      localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
        version: 1, activeAuthUserId: staleAuthUserId,
        accounts: { [staleAuthUserId]: staleRecord }
      }));
      localStorage.setItem('big-gains-active-profile', activeProfile);
      Object.entries(states).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
      if (fixtureSession) localStorage.setItem('big-gains-supabase-auth-v1', JSON.stringify(fixtureSession));
      if (recoveryMarker) {
        const namespace = `cloud-${sontai.accountId}-${sontai.profileId}`;
        localStorage.setItem(`big-gains-fresh-device-recovery-v1-${namespace}`, JSON.stringify({
          format: 'big-gains.fresh-device-recovery.v1', version: 1, kind: 'independent',
          authUserId: sontai.authUserId, accountId: sontai.accountId,
          profiles: [{
            profileClientId: sontai.clientId, profileId: sontai.profileId,
            storageKey: `big-gains-${namespace}-v1`, semanticChecksum: 'offline-fixture-checksum'
          }]
        }));
      }
      sessionStorage.setItem('boot-isolation-fixture', 'installed');
    }
    const leakKey = 'boot-isolation-leaks';
    const inspect = () => {
      if (!document.body || document.documentElement.dataset.bootState === 'verified') return;
      const visible = document.body.innerText || '';
      const forbidden = ['Jorge Secret Press', 'Sontai Secret Row', '311.7', '188.2'];
      const matches = forbidden.filter(value => visible.includes(value));
      if (!matches.length) return;
      const leaks = JSON.parse(sessionStorage.getItem(leakKey) || '[]');
      sessionStorage.setItem(leakKey, JSON.stringify([...new Set([...leaks, ...matches])]));
    };
    const observe = () => {
      inspect();
      new MutationObserver(inspect).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    };
    if (document.body) observe(); else addEventListener('DOMContentLoaded', observe, { once: true });
  }, {
    fixtureSession, staleRecord, staleAuthUserId: staleIdentity.authUserId, states, activeProfile,
    recoveryMarker, sontai: identities.sontai
  });
}

async function installCloudRoutes(page, { initialIdentity, delayUser = false, failUser = false, delayToken = false }) {
  let currentIdentity = initialIdentity;
  let userFailure = failUser;
  let releaseUser;
  let releaseToken;
  let userBlocked = delayUser;
  let tokenBlocked = delayToken;
  const userGate = new Promise(resolve => { releaseUser = () => { userBlocked = false; resolve(); }; });
  const tokenGate = new Promise(resolve => { releaseToken = () => { tokenBlocked = false; resolve(); }; });
  await page.route(`${ORIGIN}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/auth/v1/token')) {
      if (tokenBlocked) await tokenGate;
      currentIdentity = identities.sontai;
      return route.fulfill({ status: 200, headers, body: JSON.stringify(sessionFor(currentIdentity)) });
    }
    if (url.pathname.endsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers, body: '' });
    if (url.pathname.endsWith('/auth/v1/user')) {
      if (userBlocked) await userGate;
      if (userFailure) return route.fulfill({ status: 503, headers, body: JSON.stringify({ message: 'identity unavailable' }) });
      return route.fulfill({ status: 200, headers, body: JSON.stringify(sessionFor(currentIdentity).user) });
    }
    const table = url.pathname.split('/').pop();
    let data = [];
    if (table === 'accounts') data = [{ id: currentIdentity.accountId, owner_user_id: currentIdentity.authUserId, display_name: `${currentIdentity.displayName} account`, created_at: NOW }];
    else if (table === 'profile_memberships') data = [];
    else if (table === 'profiles') data = profileRows(currentIdentity);
    return route.fulfill({
      status: 200, headers: { ...headers, 'content-range': data.length ? `0-${data.length - 1}/${data.length}` : '*/0' },
      body: request.method() === 'HEAD' ? '' : JSON.stringify(data)
    });
  });
  return { releaseUser, releaseToken, setFailUser: value => { userFailure = value; }, current: () => currentIdentity };
}

async function expectNeutralDelay(page, forbidden, { initial = true } = {}) {
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'unresolved');
  await expect(page.locator('#bootShell')).toBeVisible();
  await expect(page.locator('.app-shell')).toBeHidden();
  const snapshot = await page.evaluate(() => ({
    visible: document.body.innerText,
    greeting: document.getElementById('greeting')?.textContent,
    rootInert: document.querySelector('.app-shell')?.inert,
    rootAriaHidden: document.querySelector('.app-shell')?.getAttribute('aria-hidden'),
    status: BigGainsBootGate.status()
  }));
  expect(snapshot.visible).not.toContain(forbidden);
  if (initial) expect(snapshot.greeting).toBe('Welcome to Big Gains.');
  expect(snapshot).toMatchObject({ rootInert: true, rootAriaHidden: 'true', status: { state: 'unresolved' } });
}

async function expectNoLeaks(page) {
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('boot-isolation-leaks') || '[]'))).toEqual([]);
}

test('no cross-profile pre-resolution render: stale Jorge never appears before independent Sontai resolves', async ({ page }) => {
  await installFixture(page, { sessionIdentity: identities.sontai, staleIdentity: identities.jorge });
  const cloud = await installCloudRoutes(page, { initialIdentity: identities.sontai, delayUser: true });
  await page.goto('/');
  await expectNeutralDelay(page, 'Jorge Secret Press');
  cloud.releaseUser();
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await expect(page.locator('#greeting')).toContainText('Sontai');
  await expect(page.locator('#latestWeight')).toHaveText('188.2 lb');
  await expectNoLeaks(page);
});

test('no cross-profile pre-resolution render: stale Sontai never appears before Jorge resolves', async ({ page }) => {
  await installFixture(page, { sessionIdentity: identities.jorge, staleIdentity: identities.sontai });
  const cloud = await installCloudRoutes(page, { initialIdentity: identities.jorge, delayUser: true });
  await page.goto('/');
  await expectNeutralDelay(page, 'Sontai Secret Row');
  cloud.releaseUser();
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await expect(page.locator('#greeting')).toContainText('Jorge');
  await expect(page.locator('#latestWeight')).toHaveText('311.7 lb');
  await expectNoLeaks(page);
});

test('managed Jorge and Alexa selection remains neutral until the owner and selected profile resolve', async ({ page }) => {
  await installFixture(page, { sessionIdentity: identities.jorge, activeProfile: 'alexa' });
  const cloud = await installCloudRoutes(page, { initialIdentity: identities.jorge, delayUser: true });
  await page.goto('/');
  await expectNeutralDelay(page, 'Alexa private target');
  expect(await page.locator('#profileSelect option').count()).toBe(0);
  cloud.releaseUser();
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await expect(page.locator('#profileSelect')).toHaveValue('alexa');
  await expect(page.locator('#greeting')).toContainText('Alexa');
});

test('sign-out then different-account sign-in conceals the previous profile before the async token resolves', async ({ page }) => {
  await installFixture(page, { sessionIdentity: identities.jorge });
  const cloud = await installCloudRoutes(page, { initialIdentity: identities.jorge, delayToken: true });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await expect(page.locator('#greeting')).toContainText('Jorge');
  await page.evaluate(() => BigGainsSupabase.signOut({ scope: 'local' }));
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await page.evaluate(() => {
    window.__differentAccountSignIn = BigGainsSupabase.signInWithPassword('sontai@example.test', 'correct horse battery staple').catch(error => error.message);
  });
  await expectNeutralDelay(page, 'Jorge', { initial: false });
  cloud.releaseToken();
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await expect(page.locator('#greeting')).toContainText('Sontai');
});

test('identity resolution failure exposes only neutral recovery UI and no stale personalized content', async ({ page }) => {
  await installFixture(page, { sessionIdentity: identities.sontai, staleIdentity: identities.jorge });
  const cloud = await installCloudRoutes(page, { initialIdentity: identities.sontai, delayUser: true, failUser: true });
  await page.goto('/');
  await expectNeutralDelay(page, 'Jorge Secret Press');
  cloud.releaseUser();
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'recovery');
  await expect(page.locator('#independentAccountOnboarding')).toBeVisible();
  await expect(page.locator('#independentAccountOnboarding')).toContainText('Account setup needs attention');
  await expect(page.locator('.app-shell')).toBeHidden();
  expect(await page.evaluate(() => document.body.innerText)).not.toContain('Jorge Secret Press');
  await expectNoLeaks(page);
});

test('service-worker offline cold start authorizes only the matching recovered cached identity', async ({ page, context }) => {
  await installFixture(page, { sessionIdentity: identities.sontai, recoveryMarker: true });
  const cloud = await installCloudRoutes(page, { initialIdentity: identities.sontai });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  cloud.setFailUser(true);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
    await expect(page.locator('#greeting')).toContainText('Sontai');
    expect(await page.evaluate(() => BigGainsBootGate.status().reason)).toMatch(/offline-cached/);
  } finally {
    await context.setOffline(false);
  }
});

test('fresh device stays neutral and enters sign-in without inventing a default profile', async ({ page }) => {
  await installFixture(page, { sessionIdentity: identities.sontai, staleIdentity: identities.sontai, includeSession: false });
  await page.addInitScript(() => {
    if (sessionStorage.getItem('fresh-device-cleared') !== 'yes') {
      localStorage.clear();
      sessionStorage.setItem('fresh-device-cleared', 'yes');
    }
  });
  await installCloudRoutes(page, { initialIdentity: identities.sontai });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'recovery');
  await expect(page.locator('#independentAccountOnboarding')).toBeVisible();
  await expect(page.locator('#independentAccountOnboarding')).toContainText('This device is ready for you');
  await expect(page.locator('.app-shell')).toBeHidden();
  expect(await page.locator('#profileSelect option').count()).toBe(0);
});

test('active-session resume survives the gate and all personalized surfaces remain unrendered until authorization', async ({ page }) => {
  await installFixture(page, { sessionIdentity: identities.sontai, activeSession: true });
  const before = stateFor(identities.sontai, { active: true });
  const cloud = await installCloudRoutes(page, { initialIdentity: identities.sontai, delayUser: true });
  await page.goto('/');
  await expectNeutralDelay(page, 'Sontai Secret Row');
  expect(await page.locator('#profileSelect option').count()).toBe(0);
  expect(await page.locator('#history').textContent()).toBe('Your completed workouts will appear here.');
  expect(await page.locator('#activeExercises').textContent()).toBe('');
  cloud.releaseUser();
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  await expect(page.locator('#workoutReturnType')).toContainText('Push');
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKeyFor(identities.sontai));
  expect(stored.activeWorkout).toEqual(before.activeWorkout);
  await expectNoLeaks(page);
});

test('critical boot styling prevents raw HTML paint and reveal has no timer dependency', async ({ page, request }) => {
  await installFixture(page, { sessionIdentity: identities.jorge });
  await installCloudRoutes(page, { initialIdentity: identities.jorge });
  let releaseStyle;
  const styleGate = new Promise(resolve => { releaseStyle = resolve; });
  await page.route('**/styles.css*', async route => { await styleGate; await route.continue(); });
  const navigation = page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#bootShell')).toBeVisible();
  const critical = await page.locator('#bootShell').evaluate(element => ({
    display: getComputedStyle(element).display,
    background: getComputedStyle(document.body).backgroundColor,
    appDisplay: getComputedStyle(document.querySelector('.app-shell')).display
  }));
  expect(critical).toEqual({ display: 'grid', background: 'rgb(8, 10, 13)', appDisplay: 'none' });
  releaseStyle();
  await navigation;
  await expect(page.locator('html')).toHaveAttribute('data-boot-state', 'verified');
  const [indexSource, gateSource] = await Promise.all([
    (await request.get('/index.html')).text(),
    (await request.get('/boot-render-gate.js')).text()
  ]);
  expect(indexSource).toContain('data-boot-state="unresolved"');
  expect(indexSource).toContain('data-big-gains-critical-boot');
  expect(gateSource).not.toMatch(/setTimeout|setInterval/);
  expect(RELEASE).toBe('v87-program-1a-canonical-routine-capture');
  expect(CONFIG_VERSION).toBe('config-ab51ee79cd36825d');
});
