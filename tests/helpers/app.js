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
