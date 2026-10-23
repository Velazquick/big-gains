import { expect } from '@playwright/test';
import { readStoredJson, STORAGE_KEYS } from '../fixtures/local-storage.js';

export async function openApp(page, readiness = {}) {
  await page.goto('/');
  await expect(page).toHaveTitle('Big Gains');
  await expect(page.locator('#sessionTypeSelector')).toBeAttached();
  await waitForAppRuntime(page, readiness);
}

export async function waitForAppRuntime(page, { expected = 'interactive', profileId, reason } = {}) {
  if (!['interactive', 'recovery'].includes(expected)) throw new Error(`Unknown startup expectation: ${expected}`);
  await page.waitForFunction(({ expected, profileId, reason }) => {
    const boot = window.BigGainsBootGate?.status();
    const runtime = window.BigGainsRuntimeGate?.status();
    if (expected === 'recovery') return (boot?.state === 'recovery' || runtime?.state === 'recovery')
      && (!reason || boot?.reason === reason || runtime?.reason === reason);
    return window.BigGainsAppRuntime?.initialized === true
      && window.BigGainsBootGate?.canRender() === true
      && window.BigGainsRuntimeGate?.canInteract() === true
      && (!profileId || window.BigGainsAppRuntime.profileId === profileId);
  }, { expected, profileId, reason });
}

export async function reloadApp(page, { waitUntil = 'load', ...readiness } = {}) {
  const response = await page.reload({ waitUntil });
  await waitForAppRuntime(page, readiness);
  return response;
}

export async function switchProfile(page, profileId) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
    page.locator('#profileSelect').selectOption(profileId)
  ]);
  await waitForAppRuntime(page, { profileId });
}

export async function clickCentered(locator) {
  // Playwright can retry its scroll after checking stability. Keep that implicit
  // scroll instant too; explicit application smooth/instant scrolls still run.
  // Own a style node in this document, leaving inline styles and new documents alone.
  const style = await locator.evaluateHandle(element => {
    const node = element.ownerDocument.createElement('style');
    node.textContent = 'html:root { scroll-behavior: auto; }';
    element.ownerDocument.head.appendChild(node);
    try {
      if (getComputedStyle(element.ownerDocument.documentElement).scrollBehavior !== 'auto') throw new Error('Centered click requires instantaneous implicit scrolling.');
      element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      return node;
    } catch (error) { node.remove(); throw error; }
  });
  try {
    await locator.click();
  } finally {
    try { await style.evaluate(node => node.remove()); }
    catch (error) {
      // A navigation discards the owned style with its old execution context.
      if (!locator.page().isClosed() && !/Execution context was destroyed|Cannot find context with specified id/.test(error.message)) throw error;
    } finally { await style.dispose(); }
  }
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
export async function openExerciseSwap(page, exerciseIndex, { confirmation = false } = {}) {
  const button = page.locator(`[data-swap-exercise="${exerciseIndex}"]`);
  await clickCentered(button);
  if (confirmation) {
    await expect(button).toHaveText('Sure?');
    await expect(button).toHaveClass(/is-confirming/);
    await expect(page.locator('#exercisePickerDialog')).toBeHidden();
    await clickCentered(button);
  }
  await expect(page.locator('#exercisePickerDialog')).toBeVisible();
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

export async function waitForControlledAppShell(page) {
  // Observe actual control rather than subscribing after a state check, where
  // activation/controllerchange can occur before the listener is installed.
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller));
}
