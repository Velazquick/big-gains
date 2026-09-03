import { expect, test } from '@playwright/test';
import { openApp } from './helpers/app.js';

const ORIGIN = 'https://synthetic-self-serve.supabase.co';
const EMAIL = 'new.person@example.test';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function unconfirmedSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600;
  const id = '99000000-0000-0000-0000-000000000009';
  const user = { id, email: EMAIL, aud: 'authenticated', role: 'authenticated', email_confirmed_at: null, confirmed_at: null,
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [] };
  return {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, role: 'authenticated', exp: expiresAt })}.synthetic`,
    refresh_token: 'refresh-unconfirmed', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user
  };
}

async function install(page, { signupAvailable = true } = {}) {
  await page.addInitScript(({ origin, signupAvailable }) => {
    window.__BIG_GAINS_CLOUD_CONFIG__ = {
      supabaseUrl: origin,
      supabasePublishableKey: 'sb_publishable_self_serve_test',
      selfServeSignup: signupAvailable,
      authRedirectUrl: 'https://app.getbiggains.com/',
      authSetupRedirectUrl: 'https://app.getbiggains.com/auth-setup.html'
    };
    localStorage.clear();
    sessionStorage.clear();
  }, { origin: ORIGIN, signupAvailable });
}

async function routeSignup(page, { duplicate = false } = {}) {
  const calls = { signup: [], tokens: 0, accounts: 0, memberships: 0, logout: 0 };
  await page.route(`${ORIGIN}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/auth/v1/signup')) {
      calls.signup.push({ body: request.postDataJSON(), redirectTo: url.searchParams.get('redirect_to') });
      if (duplicate) return route.fulfill({ status: 422, headers, body: JSON.stringify({ message: 'User already registered' }) });
      return route.fulfill({ status: 200, headers, body: JSON.stringify({
        id: '99000000-0000-0000-0000-000000000001', email: EMAIL, aud: 'authenticated', role: 'authenticated',
        email_confirmed_at: null, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: []
      }) });
    }
    if (url.pathname.endsWith('/auth/v1/token')) calls.tokens += 1;
    if (url.pathname.endsWith('/auth/v1/logout')) {
      calls.logout += 1;
      return route.fulfill({ status: 204, headers, body: '' });
    }
    if (url.pathname.endsWith('/rest/v1/accounts')) calls.accounts += 1;
    if (url.pathname.endsWith('/rest/v1/profile_memberships')) calls.memberships += 1;
    return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '*/0' }, body: '[]' });
  });
  return calls;
}

test('fresh signup sends only email/password, requires matching confirmation, and creates no profile', async ({ page }) => {
  await install(page);
  const calls = await routeSignup(page);
  await openApp(page);

  await page.locator('#accountOnboardingCreate').click();
  await page.locator('#accountSignupEmail').fill(EMAIL);
  await page.locator('#accountSignupPassword').fill('correct horse battery staple');
  await page.locator('#accountSignupConfirm').fill('different password');
  await page.locator('#accountOnboardingSignup button[type="submit"]').click();
  await expect(page.locator('#accountOnboardingDetail')).toContainText('Passwords do not match');
  expect(calls.signup).toHaveLength(0);

  const weakPasswordMessage = await page.evaluate(async email => {
    try { await BigGainsSupabase.signUpWithPassword(email, 'short'); }
    catch (error) { return error.message; }
    return null;
  }, EMAIL);
  expect(weakPasswordMessage).toContain('at least 8 characters');
  expect(calls.signup).toHaveLength(0);

  await page.locator('#accountSignupConfirm').fill('correct horse battery staple');
  await page.locator('#accountOnboardingSignup button[type="submit"]').click();
  await expect(page.locator('#independentAccountOnboarding')).toContainText('Check your email');
  expect(calls.signup).toHaveLength(1);
  expect(calls.signup[0]).toEqual({
    body: expect.objectContaining({ email: EMAIL, password: 'correct horse battery staple' }),
    redirectTo: 'https://app.getbiggains.com/'
  });
  expect(calls.signup[0].body.data).toEqual({});
  expect(calls.signup[0].body.data).not.toHaveProperty('display_name');
  expect(calls.accounts).toBe(0);
  expect(calls.memberships).toBe(0);
  expect(calls.logout).toBe(0);
});

test('duplicate signup receives the same generic check-email state', async ({ page }) => {
  await install(page);
  const calls = await routeSignup(page, { duplicate: true });
  await openApp(page);
  await page.locator('#accountOnboardingCreate').click();
  await page.locator('#accountSignupEmail').fill(EMAIL);
  await page.locator('#accountSignupPassword').fill('correct horse battery staple');
  await page.locator('#accountSignupConfirm').fill('correct horse battery staple');
  await page.locator('#accountOnboardingSignup button[type="submit"]').click();
  await expect(page.locator('#independentAccountOnboarding')).toContainText('Check your email');
  await expect(page.locator('#accountOnboardingDetail')).not.toContainText(/registered|exists/i);
  expect(calls.signup).toHaveLength(1);
  expect(calls.accounts).toBe(0);
});

test('capability-off build exposes a clear unavailable create-account path', async ({ page }) => {
  await install(page, { signupAvailable: false });
  await routeSignup(page);
  await openApp(page);
  await expect(page.getByRole('button', { name: 'Create account unavailable' })).toBeVisible();
  await expect(page.getByText('production email delivery is ready')).toBeVisible();
  await expect(page.locator('#accountOnboardingSignup')).toHaveCount(0);
});

test('fresh authentication explains that a network connection is required', async ({ page }) => {
  await install(page);
  const calls = await routeSignup(page);
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  await openApp(page);
  await page.locator('#accountOnboardingEmail').fill(EMAIL);
  await page.locator('#accountOnboardingPassword').fill('correct horse battery staple');
  await page.locator('#accountOnboardingSignIn button[type="submit"]').click();
  await expect(page.locator('#accountOnboardingDetail')).toContainText('Connect to the internet');
  expect(calls.tokens).toBe(0);
});

test('an unconfirmed session is rejected before account or membership bootstrap', async ({ page }) => {
  await install(page);
  const session = unconfirmedSession();
  await page.addInitScript(({ session }) => localStorage.setItem('big-gains-supabase-auth-v1', JSON.stringify(session)), { session });
  const calls = { accountReads: 0, logout: 0 };
  await page.route(`${ORIGIN}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname.endsWith('/auth/v1/user')) return route.fulfill({ status: 200, headers, body: JSON.stringify(session.user) });
    if (url.pathname.endsWith('/auth/v1/logout')) {
      calls.logout += 1;
      return route.fulfill({ status: 204, headers, body: '' });
    }
    if (url.pathname.includes('/rest/v1/')) calls.accountReads += 1;
    return route.fulfill({ status: 200, headers: { ...headers, 'content-range': '*/0' }, body: '[]' });
  });
  await openApp(page);
  await expect(page.locator('#independentAccountOnboarding')).toContainText('Check your email');
  expect(calls.accountReads).toBe(0);
  expect(calls.logout).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('big-gains-supabase-auth-v1'))).toBeNull();
});

test('expired confirmation link explains browser and Home Screen recovery', async ({ page }) => {
  await install(page);
  await routeSignup(page);
  await page.goto('/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&type=signup');
  await expect(page).toHaveTitle('Big Gains');
  await expect(page.locator('#independentAccountOnboarding')).toContainText('link could not continue');
  await expect(page.locator('#independentAccountOnboarding')).toContainText('Home Screen app');
  await expect(page.locator('#accountOnboardingRestartConfirmation')).toBeVisible();
});
