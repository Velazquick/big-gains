export async function openHistory(page, view = 'list') {
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await page.locator('[data-open-history-archive]').first().click();
  if (view === 'calendar') await page.locator('#historyCalendarTab').click();
}

export async function openHistoryCalendar(page) {
  return openHistory(page, 'calendar');
}
