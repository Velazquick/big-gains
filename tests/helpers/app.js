import { expect } from '@playwright/test';
import { readStoredJson, STORAGE_KEYS } from '../fixtures/local-storage.js';

export async function openApp(page) {
  await page.goto('/');
  await expect(page).toHaveTitle('Big Gains');
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();
}

export async function chooseSession(page, sessionType) {
  await page.locator('#sessionSelectorToggle').click();
  await page.locator(`[data-session-type="${sessionType}"]`).click();
  await expect(page.locator('#selectedSessionLabel')).toHaveText(
    sessionType === 'FullBody' ? 'Full Body' : sessionType === 'Cardio' ? 'Conditioning' : sessionType
  );
}

export async function startSelectedSession(page) {
  await page.locator('#quickStartSession').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'train');
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
}

export async function jorgeState(page) {
  return readStoredJson(page, STORAGE_KEYS.jorge);
}

export async function openExerciseOptions(page, name) {
  const card=page.locator('#activeExercises .active-exercise').filter({has:page.getByRole('heading',{name,exact:true})});
  if(await card.evaluate(e=>e.classList.contains('is-collapsed'))) await card.locator('.exercise-toggle').click();
  const details=card.locator('.exercise-management');
  if(!await details.evaluate(e=>e.open)) await details.locator('summary').click();
}
export async function openSetAdjustments(page, exerciseIndex, setIndex) {
  const toggle=page.locator(`[data-set-adjustments="${setIndex}"][data-ei="${exerciseIndex}"]`);
  if(await toggle.getAttribute('aria-expanded')!=='true') await toggle.click();
}

export async function openLibraryFromMore(page) {
  await page.locator('.bottom-nav [data-view="more"]').click();
  await page.locator('#moreLibrary').click();
  await expect(page.locator('body')).toHaveAttribute('data-view','library');
}
