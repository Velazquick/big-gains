import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const SUPABASE_ORIGIN = 'https://synthetic-ios-auth.supabase.co';
const AUTH_USER_ID = '97000000-0000-0000-0000-000000000001';
const OTHER_USER_ID = '97000000-0000-0000-0000-000000000002';
const AUTH_EMAIL = 'invited@example.test';
const AUTH_STORAGE_KEY = 'big-gains-supabase-auth-v1';
const CONFIG = {
  supabaseUrl: SUPABASE_ORIGIN,
  supabasePublishableKey: 'sb_publishable_ios_auth_test',
  authRedirectUrl: 'https://velazquick.github.io/big-gains/',
  authSetupRedirectUrl: 'https://velazquick.github.io/big-gains/auth-setup.html'
};

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function user(id = AUTH_USER_ID) {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: AUTH_EMAIL,
    email_confirmed_at: '2026-08-10T12:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: '2026-08-10T12:00:00.000Z'
  };
}

function authSession(id = AUTH_USER_ID) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, role: 'authenticated', exp: expiresAt })}.synthetic`,
    refresh_token: `refresh-${id}`,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    user: user(id)
  };
}

async function installConfiguredApp(page, { standalone = true, storedSession = null, localProfile = false } = {}) {
  await installLocalStorageFixture(page, 'blankJorge');
  await page.addInitScript(({ config, isStandalone, authKey, session, localProfile }) => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = config;
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => isStandalone });
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = query => query === '(display-mode: standalone)'
      ? Object.assign(new EventTarget(), { matches: isStandalone, media: query, onchange: null, addListener() {}, removeListener() {} })
      : originalMatchMedia(query);
    if (!localProfile) {
      localStorage.removeItem('big-gains-active-profile');
      localStorage.removeItem('big-gains-v2');
      localStorage.removeItem('big-gains-alexa-v1');
    }
    if (session) localStorage.setItem(authKey, JSON.stringify(session));
  }, { config: CONFIG, isStandalone: standalone, authKey: AUTH_STORAGE_KEY, session: storedSession, localProfile });
}

async function routeAuth(page, {
  tokenUserId = AUTH_USER_ID,
  verifiedUserId = AUTH_USER_ID,
  accountShape = 'none',
  recoverStatus = 200
} = {}) {
  const calls = { accounts: 0, getUser: 0, logout: [], otp: [], recover: [], token: [], update: [] };
  await page.route(`${SUPABASE_ORIGIN}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/auth/v1/token')) {
      calls.token.push(request.postDataJSON());
      return route.fulfill({ status: 200, headers, body: JSON.stringify(authSession(tokenUserId)) });
    }
    if (url.pathname.endsWith('/auth/v1/user') && request.method() === 'GET') {
      calls.getUser += 1;
      return route.fulfill({ status: 200, headers, body: JSON.stringify(user(verifiedUserId)) });
    }
    if (url.pathname.endsWith('/auth/v1/user') && request.method() === 'PUT') {
      calls.update.push(request.postDataJSON());
      return route.fulfill({ status: 200, headers, body: JSON.stringify({ user: user(verifiedUserId) }) });
    }
    if (url.pathname.endsWith('/auth/v1/logout')) {
      calls.logout.push(url.searchParams.get('scope'));
      return route.fulfill({ status: 204, headers, body: '' });
    }
    if (url.pathname.endsWith('/auth/v1/recover')) {
      calls.recover.push({ body: request.postDataJSON(), redirectTo: url.searchParams.get('redirect_to') });
      return route.fulfill({ status: recoverStatus, headers, body: recoverStatus === 200 ? '{}' : JSON.stringify({ message: 'synthetic recovery failure' }) });
    }
    if (url.pathname.endsWith('/auth/v1/otp')) {
      calls.otp.push({ body: request.postDataJSON(), redirectTo: url.searchParams.get('redirect_to') });
      return route.fulfill({ status: 200, headers, body: '{}' });
    }
    if (url.pathname.endsWith('/rest/v1/accounts')) {
      calls.accounts += 1;
      const rows = accountShape === 'unexpected' || accountShape === 'managed'
        ? [{ id: 'account-ios-auth', owner_user_id: AUTH_USER_ID, display_name: 'Managed', created_at: '2026-08-10T12:00:00.000Z' }]
        : [];
      return route.fulfill({ status: 200, headers: { ...headers, 'content-range': rows.length ? '0-0/1' : '*/0' }, body: JSON.stringify(rows) });
    }
    if (url.pathname.endsWith('/rest/v1/profile_memberships')) {
      return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '*/0' }, body: '[]' });
    }
    if (url.pathname.endsWith('/rest/v1/profiles')) {
      const rows = accountShape === 'managed'
        ? [
            { id: 'profile-jorge', account_id: 'account-ios-auth', client_id: 'jorge', display_name: 'Jorge', pet_enabled: true, accent: 'ember', theme: 'performance-dark', created_at: '2026-08-10T12:00:00.000Z' },
            { id: 'profile-alexa', account_id: 'account-ios-auth', client_id: 'alexa', display_name: 'Alexa', pet_enabled: false, accent: 'rose', theme: 'wellness-light', created_at: '2026-08-10T12:00:00.000Z' }
          ]
        : accountShape === 'unexpected'
          ? [{ id: 'profile-jorge', account_id: 'account-ios-auth', client_id: 'jorge', display_name: 'Jorge', pet_enabled: true, accent: 'ember', theme: 'performance-dark', created_at: '2026-08-10T12:00:00.000Z' }]
          : [];
      return route.fulfill({ status: 200, headers: { ...headers, 'content-range': rows.length ? `0-${rows.length - 1}/${rows.length}` : '*/0' }, body: JSON.stringify(rows) });
    }
    return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '*/0' }, body: '[]' });
  });
  return calls;
}

test('standalone Home Screen sign-in uses password auth, verifies getUser, and persists only in its own storage', async ({ page }) => {
  await installConfiguredApp(page, { standalone: true });
  const calls = await routeAuth(page);
  await openApp(page);

  await expect(page.locator('#accountOnboardingPassword')).toBeVisible();
  await expect(page.locator('#accountOnboardingMagicLink')).toHaveCount(0);
  await page.locator('#accountOnboardingEmail').fill(AUTH_EMAIL);
  await page.locator('#accountOnboardingPassword').fill('correct horse battery staple');
  await page.locator('#accountOnboardingSignIn button[type="submit"]').click();

  await expect(page.locator('#independentProfileForm')).toBeVisible();
  expect(calls.token).toEqual([expect.objectContaining({ email: AUTH_EMAIL, password: 'correct horse battery staple' })]);
  expect(calls.getUser).toBeGreaterThan(0);
  expect(calls.accounts).toBeGreaterThan(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key))?.user?.id, AUTH_STORAGE_KEY)).toBe(AUTH_USER_ID);

  await page.reload();
  await expect(page.locator('#independentProfileForm')).toBeVisible();
  expect(calls.token).toHaveLength(1);
});

test('password reset is generic, targets auth-setup, and enforces the resend cooldown even on provider failure', async ({ page }) => {
  await installConfiguredApp(page, { standalone: true });
  const calls = await routeAuth(page, { recoverStatus: 500 });
  await openApp(page);

  await page.locator('#accountOnboardingEmail').fill(AUTH_EMAIL);
  await page.locator('#accountOnboardingReset').click();
  await expect(page.locator('#accountOnboardingDetail')).toContainText('If an account can use password recovery');
  await page.locator('#accountOnboardingReset').click({ force: true });

  expect(calls.recover).toHaveLength(1);
  expect(calls.recover[0]).toMatchObject({
    body: expect.objectContaining({ email: AUTH_EMAIL }),
    redirectTo: CONFIG.authSetupRedirectUrl
  });
  await expect(page.locator('#accountOnboardingReset')).toBeDisabled();
});

test('Safari keeps Magic Link as an explicit compatibility action while password remains primary', async ({ page }) => {
  await installConfiguredApp(page, { standalone: false });
  const calls = await routeAuth(page);
  await openApp(page);

  await expect(page.locator('#accountOnboardingPassword')).toBeVisible();
  await page.locator('#accountOnboardingEmail').fill(AUTH_EMAIL);
  await page.locator('#accountOnboardingMagicLink').click();
  await expect(page.locator('#accountOnboardingDetail')).toContainText('browser sign-in link');

  expect(calls.otp).toEqual([{
    body: expect.objectContaining({ email: AUTH_EMAIL, create_user: false }),
    redirectTo: CONFIG.authRedirectUrl
  }]);
  expect(calls.token).toEqual([]);
});

test('a getUser identity mismatch is locally rejected before any account/profile read', async ({ page }) => {
  await installConfiguredApp(page, { standalone: true });
  const calls = await routeAuth(page, { tokenUserId: AUTH_USER_ID, verifiedUserId: OTHER_USER_ID });
  await openApp(page);

  await page.locator('#accountOnboardingEmail').fill(AUTH_EMAIL);
  await page.locator('#accountOnboardingPassword').fill('correct horse battery staple');
  await page.locator('#accountOnboardingSignIn button[type="submit"]').click();
  await expect(page.locator('#accountOnboardingDetail')).toContainText('could not be verified');

  expect(calls.getUser).toBeGreaterThan(0);
  expect(calls.accounts).toBe(0);
  expect(calls.logout).toContain('local');
  expect(await page.evaluate(key => localStorage.getItem(key), AUTH_STORAGE_KEY)).toBeNull();
});

test('an unexpected owner profile shape is blocked and locally signed out without changing schema-v5 data', async ({ page }) => {
  await installConfiguredApp(page, { standalone: true, localProfile: true });
  const calls = await routeAuth(page, { accountShape: 'unexpected' });
  await openApp(page);
  const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.jorge);

  await page.locator('#openSettings').click();
  await expect(page.locator('#cloudSignOut')).toHaveText('Sign out of cloud');
  await expect(page.locator('#cloudSignOutNote')).toContainText('keeps this profile\'s training readable on this device');
  await page.locator('#cloudAuthEmail').fill(AUTH_EMAIL);
  await page.locator('#cloudAuthPassword').fill('correct horse battery staple');
  await page.locator('#cloudAuthForm button[type="submit"]').click();
  await expect(page.locator('#independentAccountOnboarding')).toContainText('Account setup needs attention');

  expect(calls.logout).toContain('local');
  expect(await page.evaluate(key => localStorage.getItem(key), AUTH_STORAGE_KEY)).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.jorge)).toBe(before);
});

test('auth setup updates the password from a verified invite/recovery session and signs out only that browser session', async ({ page }) => {
  await installConfiguredApp(page, { standalone: false, storedSession: authSession() });
  const calls = await routeAuth(page);
  await page.goto('/auth-setup.html');

  await expect(page.locator('#authSetupForm')).toBeVisible();
  expect(await page.locator('script[data-big-gains-auth-asset="script"]').evaluateAll(scripts =>
    scripts.map(script => new URL(script.src).pathname.split('/').pop())
  )).toEqual(['cloud-config.js', 'supabase.js', 'auth-setup.js']);
  await page.locator('#authSetupPassword').fill('new standalone password');
  await page.locator('#authSetupConfirm').fill('new standalone password');
  await page.locator('#authSetupForm button[type="submit"]').click();

  await expect(page.locator('#authSetupComplete')).toBeVisible();
  expect(calls.update).toEqual([expect.objectContaining({ password: 'new standalone password' })]);
  expect(calls.logout).toContain('local');
  expect(await page.evaluate(key => localStorage.getItem(key), AUTH_STORAGE_KEY)).toBeNull();
});

test('legacy invite callbacks at the app root are routed to isolated auth setup without losing the token fragment', async ({ page }) => {
  const fragment = '#access_token=invite-access&refresh_token=invite-refresh&type=invite&expires_in=3600';
  await page.goto(`/${fragment}`);
  await expect(page).toHaveURL(new RegExp(`/auth-setup\\.html${fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
});

test('Safari and installed Home Screen sessions remain isolated until password sign-in occurs in the Home Screen context', async ({ browser }) => {
  const safari = await browser.newContext();
  const homeScreen = await browser.newContext();
  try {
    const safariPage = await safari.newPage();
    await safariPage.goto('/manifest.webmanifest');
    await safariPage.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: AUTH_STORAGE_KEY,
      value: authSession()
    });

    const homePage = await homeScreen.newPage();
    await installConfiguredApp(homePage, { standalone: true });
    await routeAuth(homePage);
    await openApp(homePage);

    expect(await safariPage.evaluate(key => JSON.parse(localStorage.getItem(key))?.user?.id, AUTH_STORAGE_KEY)).toBe(AUTH_USER_ID);
    expect(await homePage.evaluate(key => localStorage.getItem(key), AUTH_STORAGE_KEY)).toBeNull();
    await expect(homePage.locator('#accountOnboardingPassword')).toBeVisible();
  } finally {
    await safari.close();
    await homeScreen.close();
  }
});
