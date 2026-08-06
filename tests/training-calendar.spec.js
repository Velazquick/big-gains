import { expect, test } from '@playwright/test';
import { activeWorkout, blankState, completedWorkout, installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

async function seedCalendar(page, { active = null, alexa = false } = {}) {
  const first = completedWorkout({ id: 'late-workout', completedAt: '2026-08-05T03:30:00.000Z', durationSeconds: 1800, prs: 2 });
  const second = completedWorkout({ id: 'second-workout', type: 'Pull', completedAt: '2026-08-04T23:15:00.000Z', durationSeconds: 2400, prs: 0 });
  await page.addInitScript(({ key, alexaKey, state, alexaState }) => {
    if (localStorage.getItem('__big_gains_playwright_fixture__')) return;
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('big-gains-active-profile', 'jorge');
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem(alexaKey, JSON.stringify(alexaState));
    localStorage.setItem('__big_gains_playwright_fixture__', 'seeded');
  }, { key: STORAGE_KEYS.jorge, alexaKey: STORAGE_KEYS.alexa, state: { ...blankState('jorge'), workouts: [second, first], activeWorkout: active }, alexaState: { ...blankState('alexa'), workouts: alexa ? [first] : [] } });
}

test('calendar navigates months, marks today, handles empty days, and remembers selection on reload', async ({ page }) => {
  await seedCalendar(page); await openApp(page);
  await page.locator('.bottom-nav [data-view="calendar"]').click();
  await expect(page.locator('#calendarMonthHeading')).toContainText('August 2026');
  await expect(page.locator('.calendar-date[aria-current="date"]')).toHaveCount(1);
  await page.locator('[data-calendar-date="2026-08-04"]').click();
  await expect(page.locator('#calendarDayWorkouts .calendar-day-workout')).toHaveCount(2);
  await page.locator('[data-calendar-date="2026-08-06"]').click();
  await expect(page.locator('#calendarDayWorkouts')).toHaveText('No training logged');
  await page.reload();
  await page.locator('.bottom-nav [data-view="calendar"]').click();
  await expect(page.locator('[data-calendar-date="2026-08-06"]')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#calendarPrevious').click(); await expect(page.locator('#calendarMonthHeading')).toContainText('July 2026');
  await page.locator('#calendarToday').click(); await expect(page.locator('#calendarMonthHeading')).toContainText('August 2026');
});

test('selected-day summaries are accurate and reuse history detail', async ({ page }) => {
  await seedCalendar(page); await openApp(page); await page.locator('.bottom-nav [data-view="calendar"]').click();
  await page.locator('[data-calendar-date="2026-08-04"]').click();
  await expect(page.locator('#calendarDayWorkouts')).toContainText('30:00');
  await expect(page.locator('#calendarDayWorkouts')).toContainText('1 exercises · 1 working sets');
  await expect(page.locator('#calendarDayWorkouts')).toContainText('2 PRs');
  await page.locator('#calendarDayWorkouts [data-history-id="late-workout"]').click();
  await expect(page.locator('#historyDialog')).toBeVisible();
  await expect(page.locator('#historyDialogContent .history-exercise')).toHaveCount(1);
});

test('active workout return bar survives calendar navigation and profiles remain isolated', async ({ page }) => {
  await seedCalendar(page, { active: activeWorkout() }); await openApp(page);
  await page.locator('#exitWorkoutMode').click();
  await page.locator('.bottom-nav [data-view="calendar"]').click();
  await expect(page.locator('#workoutReturnBar')).toBeVisible();
  await page.locator('#profileSelect').selectOption('alexa');
  await page.locator('.bottom-nav [data-view="calendar"]').click();
  await expect(page.locator('#calendarDayWorkouts')).toHaveText('No training logged');
});

test('calendar remains available from the offline app shell', async ({ page, context }) => {
  await installLocalStorageFixture(page, 'completedWorkouts'); await openApp(page);
  await page.evaluate(() => navigator.serviceWorker.ready); await context.setOffline(true); await page.reload();
  await page.locator('.bottom-nav [data-view="calendar"]').click();
  await expect(page.locator('#trainingCalendar')).toBeVisible();
});
