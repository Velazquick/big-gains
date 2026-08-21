import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';
import { openHistory } from './helpers/history.js';

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, 'completedWorkouts');
  await openApp(page);
});

test('primary navigation is exactly Today, Plan, Train, Progress, and Library', async ({ page }) => {
  const nav = page.locator('.bottom-nav');
  await expect(nav.locator('button')).toHaveCount(5);
  await expect(nav.locator('button')).toHaveText(['Today', 'Plan', 'Train', 'Progress', 'Library']);
  await expect(nav.locator('[data-view="calendar"]')).toHaveCount(0);

  await nav.locator('[data-view="plan"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'plan');
  await expect(page.locator('#planOverview')).toContainText('Goals');
  await expect(page.locator('#planOverview')).toContainText('Program');
  await expect(nav.locator('[data-view="plan"]')).toHaveAttribute('aria-current', 'page');
  await expect(nav.locator('.active')).toHaveCount(1);
});

test('History defaults to List and the same workout returns to its List or Calendar origin', async ({ page }) => {
  await openHistory(page);
  await expect(page.locator('body')).toHaveAttribute('data-route', 'history-list');
  await expect(page.locator('#historyListTab')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#historyListPanel')).toBeVisible();
  await expect(page.locator('#historyCalendarPanel')).toBeHidden();

  await page.locator('#historyArchiveList [data-history-id="completed-push-1"]').click();
  await expect(page.locator('#historyDialog')).toBeVisible();
  await expect(page.locator('#historyDialogTitle')).toHaveText('Push');
  await expect(page.locator('#closeHistoryDialog')).toHaveText('← History');
  await page.locator('#closeHistoryDialog').click();
  await expect(page.locator('#historyListPanel')).toBeVisible();

  await page.locator('#historyCalendarTab').click();
  await expect(page.locator('body')).toHaveAttribute('data-route', 'history-calendar');
  await expect(page.locator('#historyCalendarTab')).toHaveAttribute('aria-selected', 'true');
  await page.locator('[data-calendar-date="2026-08-04"]').click();
  await page.locator('#calendarDayWorkouts [data-history-id="completed-push-1"]').click();
  await expect(page.locator('#historyDialogTitle')).toHaveText('Push');
  await expect(page.locator('#closeHistoryDialog')).toHaveText('← Calendar');
  await page.locator('#closeHistoryDialog').click();
  await expect(page.locator('#historyCalendarPanel')).toBeVisible();

  await page.locator('#closeHistoryArchive').click();
  await expect(page.locator('body')).toHaveAttribute('data-route', 'progress');
  await page.locator('[data-open-history-archive]').first().click();
  await expect(page.locator('#historyListTab')).toHaveAttribute('aria-selected', 'true');
});

test('legacy Calendar and History deep links resolve to the Progress-owned History surface', async ({ page }) => {
  for (const [origin, route, selectedTab] of [
    ['today', 'history-list', '#historyListTab'],
    ['goals', 'history-list', '#historyListTab'],
    ['plan', 'history-calendar', '#historyCalendarTab'],
    ['progress', 'history-list', '#historyListTab']
  ]) {
    await page.evaluate(({ origin, route }) => {
      bigGainsViewShell.showView(origin, { workout: false, instant: true });
      bigGainsViewShell.showView(route === 'history-calendar' ? 'calendar' : 'history', { workout: false, instant: true });
    }, { origin, route });
    await expect(page.locator('body')).toHaveAttribute('data-view', 'progress');
    await expect(page.locator('body')).toHaveAttribute('data-route', route);
    await expect(page.locator(selectedTab)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.bottom-nav [data-view="progress"]')).toHaveAttribute('aria-current', 'page');
    await page.locator('#closeHistoryArchive').click();
  }
});

test('History navigation does not mutate schema-v5 workout or profile-owned data', async ({ page }) => {
  const before = await readStoredJson(page, STORAGE_KEYS.jorge);
  await openHistory(page, 'calendar');
  await page.locator('[data-calendar-date="2026-08-04"]').click();
  await page.locator('#historyCalendarTab').press('ArrowLeft');
  await expect(page.locator('#historyListTab')).toHaveAttribute('aria-selected', 'true');
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after).toEqual(before);
  expect(after.version).toBe(5);
});

test('Train remains one tap away and an active workout is unchanged by History traversal', async ({ page }) => {
  await page.locator('#quickStartSession').click();
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
  const active = (await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout;
  await page.locator('#exitWorkoutMode').click();
  await openHistory(page, 'calendar');
  await page.locator('.bottom-nav [data-view="train"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'train');
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
  expect((await readStoredJson(page, STORAGE_KEYS.jorge)).activeWorkout).toEqual(active);
});

test('List and Calendar remain available from the installed offline shell', async ({ page, context }) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await openHistory(page, 'calendar');
    await expect(page.locator('#trainingCalendar')).toBeVisible();
    await page.locator('#historyListTab').click();
    await expect(page.locator('#historyArchiveList [data-history-id="completed-push-1"]')).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
