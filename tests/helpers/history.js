import { expect } from '@playwright/test';
import { clickCentered } from './app.js';

export async function openHistory(page, view = 'list') {
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator('[data-open-history-archive]').first().click();
  if (view === 'calendar') await page.locator('#historyCalendarTab').click();
}

export async function openHistoryCalendar(page) {
  return openHistory(page, 'calendar');
}
export async function openHistoryWorkout(page, workoutId) {
  await clickCentered(page.locator(`[data-history-id="${workoutId}"]`).filter({ visible: true }).first());
  await expect(page.locator('#historyDialog')).toBeVisible();
  await expect(page.locator('#historyDialog')).toHaveAttribute('data-workout-id', workoutId);
}
