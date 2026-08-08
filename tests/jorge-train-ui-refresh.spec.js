import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';

const SZW_AUTH_USER_ID = '85000000-0000-0000-0000-000000000001';
const SZW_ACCOUNT_ID = '85a00000-0000-0000-0000-000000000001';
const SZW_PROFILE_ID = '85b00000-0000-0000-0000-000000000001';
const SZW_CLIENT_ID = 'independent-szw';

async function openTrain(page) {
  await page.locator('.bottom-nav [data-view="train"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'train');
}

async function installSzwRuntime(page) {
  const storageKey = `big-gains-cloud-${SZW_ACCOUNT_ID}-${SZW_PROFILE_ID}-v1`;
  await page.addInitScript(({ authUserId, accountId, profileId, clientId, storageKey }) => {
    const state = {
      version: 5,
      profileId: clientId,
      goals: { primary: 'Strength and consistency' },
      workouts: [],
      weights: [],
      prs: {},
      activeWorkout: null,
      restTimerEndsAt: null,
      customRoutines: {},
      exercisePreferences: {},
      timerPreferences: { sound: true, vibration: true }
    };
    localStorage.setItem('big-gains-runtime-accounts-v1', JSON.stringify({
      version: 1,
      activeAuthUserId: authUserId,
      accounts: {
        [authUserId]: {
          kind: 'independent',
          authUserId,
          cloudAccountId: accountId,
          cloudProfileId: profileId,
          clientId,
          displayName: 'szw',
          presentation: { petEnabled: false, accent: 'merlot', theme: 'slate-dark' }
        }
      }
    }));
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, {
    authUserId: SZW_AUTH_USER_ID,
    accountId: SZW_ACCOUNT_ID,
    profileId: SZW_PROFILE_ID,
    clientId: SZW_CLIENT_ID,
    storageKey
  });
}

test.describe('Jorge Train mobile presentation', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('pre-workout preview is mobile-safe and starts through existing session behavior', async ({ page }) => {
    await installLocalStorageFixture(page, 'blankJorge');
    await openApp(page);
    const before = await jorgeState(page);
    await openTrain(page);

    await expect(page.locator('html')).toHaveAttribute('data-accent', 'ember');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'performance-dark');
    await expect(page.locator('#trainPreview')).toBeVisible();
    await expect(page.locator('#trainPreviewTitle')).toHaveText(/Push|Pull|Legs|Core|Full Body|Conditioning/);
    await expect(page.locator('#trainPreviewExercises .train-preview-row').first()).toBeVisible();
    await expect(page.locator('#trainPreviewStart')).toHaveText('Start Workout');

    await page.locator('[data-train-plan="Pull"]').click();
    await expect(page.locator('#trainPreviewTitle')).toHaveText('Pull');
    await expect(page.locator('#trainPreviewExercises .train-preview-row')).toHaveCount(6);
    expect(await jorgeState(page)).toEqual(before);

    const layout = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const action = document.getElementById('trainPreviewAction');
      return {
        refresh: root.getPropertyValue('--jorge-train-refresh').trim(),
        actionPosition: getComputedStyle(action).position,
        overflow: document.documentElement.scrollWidth - window.innerWidth
      };
    });
    expect(layout).toEqual({ refresh: 'enabled', actionPosition: 'sticky', overflow: 0 });

    await page.locator('#trainPreviewStart').click();
    await expect(page.locator('body')).toHaveClass(/workout-mode/);
    await expect(page.locator('#activeWorkoutTitle')).toContainText('Pull');
    await expect(page.locator('#activeExercises .active-exercise')).toHaveCount(6);
    expect((await jorgeState(page)).activeWorkout.type).toBe('Pull');
  });

  test('safe-area hooks are present and sticky CTA stays clear of mobile navigation', async ({ page, request }) => {
    await installLocalStorageFixture(page, 'blankJorge');
    await openApp(page);
    await openTrain(page);
    await page.locator('#trainPreviewAction').scrollIntoViewIfNeeded();

    const geometry = await page.evaluate(() => {
      const action = document.getElementById('trainPreviewAction').getBoundingClientRect();
      const navigation = document.querySelector('.bottom-nav').getBoundingClientRect();
      return { actionBottom: action.bottom, navigationTop: navigation.top, viewportWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth };
    });
    expect(geometry.actionBottom).toBeLessThanOrEqual(geometry.navigationTop + 1);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);

    const css = await (await request.get('/jorge-train-v52.css')).text();
    expect(css).toContain('env(safe-area-inset-top)');
    expect(css).toContain('env(safe-area-inset-bottom)');
    expect(css).toContain('100dvh');
  });
});

test('active, upcoming, completed, and set-state hooks follow workout progress', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await openApp(page);

  const exercises = page.locator('#activeExercises .active-exercise');
  await expect(exercises.first()).toHaveAttribute('data-exercise-state', 'current');
  await expect(exercises.nth(1)).toHaveAttribute('data-exercise-state', 'upcoming');
  await expect(exercises.first().locator('[data-set-state="current"]')).toHaveCount(1);
  await expect(exercises.first().locator('[data-set-state="upcoming"]')).toHaveCount(3);

  for (let set = 1; set <= 3; set += 1) {
    await page.getByRole('button', { name: `Complete Set ${set} of 3` }).click();
  }
  await expect(exercises.first()).toHaveAttribute('data-exercise-state', 'completed');
  await expect(exercises.nth(1)).toHaveAttribute('data-exercise-state', 'current');
  await expect(exercises.first().locator('[data-set-state="completed"]')).toHaveCount(3);
  await expect(exercises.nth(1).locator('.exercise-state-label')).toHaveText('Current');
});

test('set controls remain touch-sized, persist edits, and keep rest-timer semantics', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await openApp(page);

  const weight = page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]');
  const minus = page.locator('button[data-adjust="-5"][data-field="weight"][data-ei="0"][data-si="1"]');
  const done = page.getByRole('button', { name: 'Complete Set 1 of 3' });
  const sizes = await Promise.all([weight, minus, done].map(async locator => locator.boundingBox()));
  for (const box of sizes) {
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(42);
  }

  await weight.fill('125');
  await done.click();
  const running = await jorgeState(page);
  expect(running.activeWorkout.exercises[0].sets[1]).toMatchObject({ weight: 125, completed: true });
  expect(running.restTimerEndsAt).toBeGreaterThan(Date.now() + 140_000);
  await expect(page.locator('#timerCard')).toBeVisible();
  await expect(page.locator('#timerNext')).toHaveText('Seated Machine Chest Press · 2:30 recovery.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.evaluate(() => { state.restTimerEndsAt = Date.now(); runRestTimer(); });
  await expect(page.locator('#timerCard')).toHaveClass(/timer-feedback-ready/);
  await expect(page.locator('#timerNext')).toHaveText("Rest complete. You're up.");
  expect((await jorgeState(page)).restTimerEndsAt).toBeNull();
});

test('Exit Workout Mode and resume preserve the same local workout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  const before = await jorgeState(page);

  await page.locator('#exitWorkoutMode').click();
  await expect(page.locator('#workoutReturnBar')).toBeVisible();
  expect((await jorgeState(page)).activeWorkout).toEqual(before.activeWorkout);
  await page.locator('#returnToWorkout').click();
  await expect(page.locator('body')).toHaveClass(/workout-mode/);
  expect((await jorgeState(page)).activeWorkout).toEqual(before.activeWorkout);
});

test('Jorge styling is isolated from Alexa and SZW presentation tokens', async ({ browser }) => {
  const cases = [
    { fixture: 'blankJorge', accent: 'ember', theme: 'performance-dark', refresh: 'enabled', preview: true },
    { fixture: 'blankAlexa', accent: 'rose', theme: 'wellness-light', refresh: '', preview: false }
  ];

  for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await installLocalStorageFixture(page, item.fixture);
    await openApp(page);
    await openTrain(page);
    await expect(page.locator('html')).toHaveAttribute('data-accent', item.accent);
    await expect(page.locator('html')).toHaveAttribute('data-theme', item.theme);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--jorge-train-refresh').trim())).toBe(item.refresh);
    if (item.preview) await expect(page.locator('#trainPreview')).toBeVisible();
    else await expect(page.locator('#trainPreview')).toBeHidden();
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await context.newPage();
  await installSzwRuntime(page);
  await openApp(page);
  await openTrain(page);
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'merlot');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate-dark');
  await expect(page.locator('html')).toHaveAttribute('data-pet-enabled', 'false');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--jorge-train-refresh').trim())).toBe('');
  await expect(page.locator('#trainPreview')).toBeHidden();
  await context.close();
});
