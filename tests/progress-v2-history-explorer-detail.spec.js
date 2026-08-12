import { expect, test } from '@playwright/test';
import { blankState, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const completedSet = (id, weight, reps, warmup = false) => ({ id, weight, reps, warmup, completed: true });
const exercise = ({ id, name, muscle, equipment, sets }) => ({ id, name, muscle, equipment, sets });

function historyState(profileId = 'jorge') {
  return {
    ...blankState(profileId),
    weights: [{ weight: 200, date: '2026-08-20T08:00:00.000Z' }],
    workouts: [
      {
        id: 'august-newest', type: 'Pull', startedAt: '2026-08-20T16:00:00.000Z', completedAt: '2026-08-20T17:00:00.000Z', durationSeconds: 3600, prs: 2,
        exercises: [exercise({
          id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable',
          sets: [completedSet('august-warmup', 60, 10, true), completedSet('august-work-1', 100, 8), completedSet('august-work-2', 110, 6)]
        })]
      },
      {
        id: 'august-older', type: 'Legs', startedAt: '2026-08-05T16:10:00.000Z', completedAt: '2026-08-05T17:00:00.000Z', durationSeconds: 3000, prs: 0,
        exercises: [exercise({
          id: 'leg-press', name: 'Leg Press', muscle: 'Quads / Glutes', equipment: 'Machine',
          sets: [completedSet('legs-1', 300, 10), completedSet('legs-2', 320, 8)]
        })]
      },
      {
        id: 'july-bodyweight', type: 'Pull', startedAt: '2026-07-31T16:15:00.000Z', completedAt: '2026-07-31T17:00:00.000Z', durationSeconds: 2700, prs: 1,
        exercises: [
          exercise({
            id: 'pull-up', name: 'Pull-Up', muscle: 'Back / Biceps', equipment: 'Bodyweight',
            sets: [completedSet('pullup-warmup', 0, 5, true), completedSet('pullup-bodyweight', 0, 8), completedSet('pullup-added', 25, 6)]
          }),
          exercise({
            id: 'seated-cable-row', name: 'Seated Cable Row', muscle: 'Back', equipment: 'Cable',
            sets: [completedSet('row-work', 90, 10)]
          })
        ]
      },
      {
        id: 'july-oldest', type: 'Push', startedAt: '2026-07-02T16:30:00.000Z', completedAt: '2026-07-02T17:00:00.000Z', durationSeconds: 1800, prs: 0,
        exercises: [exercise({
          id: 'seated-machine-chest-press', name: 'Seated Machine Chest Press', muscle: 'Chest', equipment: 'Machine',
          sets: [completedSet('press-work', 100, 10)]
        })]
      }
    ]
  };
}

async function installState(page, profileId = 'jorge') {
  const state = historyState(profileId);
  await page.addInitScript(({ activeKey, profile, storageKey, value }) => {
    if (localStorage.getItem('__history_v2_seeded__')) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(activeKey, profile);
    localStorage.setItem(storageKey, JSON.stringify(value));
    localStorage.setItem('__history_v2_seeded__', 'true');
  }, {
    activeKey: STORAGE_KEYS.activeProfile,
    profile: profileId,
    storageKey: STORAGE_KEYS[profileId],
    value: state
  });
  await openApp(page);
  await page.locator('.bottom-nav [data-view="progress"]').click();
}

async function openArchive(page) {
  await page.locator('#historyPanel .section-heading [data-open-history-archive]').click();
  await expect(page.locator('#historyArchiveDialog')).toBeVisible();
}

test('History Explorer groups newest-first by month and keeps archive cards compact', async ({ page }) => {
  await installState(page);

  await expect(page.locator('#history .progress-history-card')).toHaveCount(3);
  await expect(page.locator('#history')).not.toContainText('Seated Machine Chest Press');
  await openArchive(page);

  await expect(page.locator('.history-month-heading h3')).toHaveText(['AUGUST 2026', 'JULY 2026']);
  expect(await page.locator('#historyArchiveList [data-history-id]').evaluateAll(cards => cards.map(card => card.dataset.historyId))).toEqual(['august-newest', 'august-older', 'july-bodyweight', 'july-oldest']);
  const newest = page.locator('#historyArchiveList [data-history-id="august-newest"]');
  await expect(newest).toContainText('Pull');
  await expect(newest).toContainText('1h 00m');
  await expect(newest).toContainText('2 working sets');
  await expect(newest).toContainText('1,460 lb volume');
  await expect(newest.locator('.pr-badge')).toHaveText('2 PRs');
  await expect(page.locator('#historyArchiveList')).not.toContainText('Lat Pulldown');
  await expect(page.locator('#historyArchiveList')).not.toContainText('Leg Press');
  if (process.env.HISTORY_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.HISTORY_SCREENSHOT_DIR}/history-explorer-desktop.png` });
  }
});

test('history cards provide full-card hover, keyboard-focus, and pressed feedback', async ({ page }) => {
  await installState(page);
  const recentCard = page.locator('#history .progress-history-card').first();
  await expect(recentCard).toHaveJSProperty('tagName', 'BUTTON');
  await recentCard.hover();
  await expect.poll(() => recentCard.evaluate(card => getComputedStyle(card).transform)).not.toBe('none');

  await openArchive(page);
  const archiveCard = page.locator('#historyArchiveList .history-archive-card').first();
  await expect(archiveCard).toHaveJSProperty('tagName', 'BUTTON');
  await archiveCard.focus();
  await expect(archiveCard).toBeFocused();
  expect(await archiveCard.evaluate(card => getComputedStyle(card).outlineWidth)).toBe('3px');

  const box = await archiveCard.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => archiveCard.evaluate(card => getComputedStyle(card).transform)).toMatch(/^matrix\(0\.992/);
  await page.mouse.up();
});

test('archive opens the correct polished detail with bodyweight semantics and working-set hierarchy', async ({ page }) => {
  await installState(page);
  await openArchive(page);
  await page.locator('#historyArchiveList [data-history-id="july-bodyweight"]').click();

  const detail = page.locator('#historyDialog');
  await expect(detail).toBeVisible();
  await expect(page.locator('#historyDialogTitle')).toHaveText('Pull');
  await expect(page.locator('#closeHistoryDialog')).toHaveText('← History');
  await expect(page.locator('#historyDialogDate')).toContainText('July 31, 2026');
  await expect(page.locator('.history-summary-grid > div')).toHaveCount(4);
  await expect(page.locator('.history-summary-grid')).toContainText('Effective volume');
  await expect(page.locator('.history-summary-grid')).toContainText('3,850 lb');
  await expect(page.locator('.history-summary-grid')).toContainText('3');
  await expect(page.locator('.history-summary-grid')).not.toContainText('PRs');
  await expect(page.locator('.history-pr-callout .pr-badge')).toHaveText('1 PR');
  await expect(page.locator('.history-detail-list .history-exercise h3')).toHaveText(['Pull-Up', 'Seated Cable Row']);

  const pullUp = page.locator('.history-exercise').first();
  await expect(pullUp.locator('.history-set.is-warmup')).toHaveCount(1);
  await expect(pullUp.locator('.history-set.is-working')).toHaveCount(2);
  await expect(pullUp.locator('.history-set.is-working').nth(0)).toContainText('Bodyweight × 8');
  await expect(pullUp.locator('.history-set.is-working').nth(1)).toContainText('Bodyweight + 25 lb × 6');
  await expect(pullUp.getByRole('button', { name: 'Progress' })).toHaveCount(0);
  const backgrounds = await pullUp.locator('.history-set').evaluateAll(rows => rows.map(row => getComputedStyle(row).backgroundColor));
  expect(backgrounds[0]).not.toBe(backgrounds[1]);
  if (process.env.HISTORY_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.HISTORY_SCREENSHOT_DIR}/workout-detail-desktop.png` });
  }

  await page.locator('#closeHistoryDialog').click();
  await expect(detail).toBeHidden();
  await expect(page.locator('#historyArchiveDialog')).toBeVisible();

  await page.locator('#historyArchiveList [data-history-id="july-oldest"]').click();
  await expect(page.locator('.history-summary-grid > div')).toHaveCount(4);
  await expect(page.locator('.history-pr-callout')).toHaveCount(0);
  await expect(page.locator('.history-summary-grid')).not.toContainText('PRs');
});

test('Edit and Delete remain first-class without changing the existing confirmation contract', async ({ page }) => {
  await installState(page);
  await page.locator('#history [data-history-id="august-newest"]').click();

  await expect(page.locator('#editCompletedWorkout')).toHaveClass(/primary/);
  await expect(page.locator('#requestDeleteCompletedWorkout')).toBeVisible();
  await page.locator('#requestDeleteCompletedWorkout').click();
  await expect(page.locator('#deleteWorkoutConfirmation')).toBeVisible();
  await expect(page.locator('#deleteWorkoutConfirmationText')).toContainText('every synced device');
  await page.locator('#cancelDeleteCompletedWorkout').click();
  await expect(page.locator('#editCompletedWorkout')).toBeVisible();

  await page.locator('#editCompletedWorkout').click();
  await expect(page.locator('#retrospectiveDialog')).toBeVisible();
  await expect(page.locator('#retrospectiveTitle')).toHaveText('Edit workout');
  await expect(page.locator('#retrospectiveWorkoutType')).toHaveValue('Pull');
});

test('history surfaces preserve Jorge dark and Alexa wellness-light profile presentation', async ({ page }) => {
  await installState(page);
  await openArchive(page);
  const jorgeArchive = await page.locator('.history-archive-shell').evaluate(element => getComputedStyle(element).backgroundColor);
  await page.locator('#historyArchiveList [data-history-id="august-newest"]').click();
  const jorgeDetail = await page.locator('#historyDialog .history-dialog-shell').evaluate(element => getComputedStyle(element).backgroundColor);
  expect(jorgeArchive).toBe('rgb(11, 15, 20)');
  expect(jorgeDetail).toBe('rgb(11, 15, 20)');

  await page.locator('#closeHistoryDialog').click();
  await page.locator('#closeHistoryArchive').click();
  await page.evaluate(({ activeKey, storageKey, value }) => {
    localStorage.setItem(activeKey, 'alexa');
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, { activeKey: STORAGE_KEYS.activeProfile, storageKey: STORAGE_KEYS.alexa, value: historyState('alexa') });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await openArchive(page);
  const alexaArchive = await page.locator('.history-archive-shell').evaluate(element => getComputedStyle(element).backgroundColor);
  await page.locator('#historyArchiveList [data-history-id="august-newest"]').click();
  const alexaDetail = await page.locator('#historyDialog .history-dialog-shell').evaluate(element => getComputedStyle(element).backgroundColor);
  expect(alexaArchive).toBe('rgb(255, 250, 253)');
  expect(alexaDetail).toBe('rgb(255, 250, 253)');
});

test('archive and detail use mobile sheets while staying bounded on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installState(page);
  await openArchive(page);
  let layout = await page.evaluate(() => {
    const shell = document.querySelector('.history-archive-shell');
    const archive = shell.getBoundingClientRect();
    const head = document.querySelector('.history-archive-head').getBoundingClientRect();
    return { viewport: innerWidth, document: document.documentElement.scrollWidth, width: archive.width, top: archive.top, bottom: archive.bottom, headTop: head.top, scrollTop: shell.scrollTop };
  });
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.width).toBeLessThanOrEqual(390);
  expect(layout.top).toBeGreaterThanOrEqual(0);
  expect(layout.headTop).toBeGreaterThanOrEqual(0);
  expect(layout.scrollTop).toBe(0);
  expect(layout.bottom).toBeLessThanOrEqual(844);
  if (process.env.HISTORY_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.HISTORY_SCREENSHOT_DIR}/history-explorer-mobile.png` });
  }
  await page.locator('#historyArchiveList [data-history-id="july-bodyweight"]').click();
  const bodyweightRows = page.locator('.history-exercise').first().locator('.history-set');
  const rowColumns = await bodyweightRows.evaluateAll(rows => rows.map(row => {
    const load = row.querySelector('.history-set-value > strong:first-child').getBoundingClientRect();
    const reps = row.querySelector('.history-set-value > strong:last-child').getBoundingClientRect();
    return { loadRight: load.right, repsLeft: reps.left, repsRight: reps.right };
  }));
  expect(rowColumns.every(row => row.loadRight <= row.repsLeft && row.repsRight <= 390)).toBe(true);
  layout = await page.evaluate(() => {
    const detail = document.querySelector('#historyDialog .history-dialog-shell').getBoundingClientRect();
    return { viewport: innerWidth, document: document.documentElement.scrollWidth, width: detail.width, bottom: detail.bottom };
  });
  expect(layout.document).toBeLessThanOrEqual(layout.viewport);
  expect(layout.width).toBeLessThanOrEqual(390);
  expect(layout.bottom).toBeLessThanOrEqual(844);
  if (process.env.HISTORY_SCREENSHOT_DIR) {
    await page.screenshot({ path: `${process.env.HISTORY_SCREENSHOT_DIR}/workout-detail-mobile.png` });
  }

  await page.locator('#closeHistoryDialog').click();
  await page.locator('#closeHistoryArchive').click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openArchive(page);
  const desktopArchiveWidth = await page.locator('.history-archive-shell').evaluate(element => element.getBoundingClientRect().width);
  await page.locator('#historyArchiveList [data-history-id="august-newest"]').click();
  const desktopDetailWidth = await page.locator('#historyDialog .history-dialog-shell').evaluate(element => element.getBoundingClientRect().width);
  expect(desktopArchiveWidth).toBeLessThanOrEqual(900);
  expect(desktopDetailWidth).toBeLessThanOrEqual(900);
  expect(desktopDetailWidth).toBeLessThan(1000);
});

test('archive and detail preserve focus and keyboard dismissal through the shallow navigation stack', async ({ page }) => {
  await installState(page);
  const viewHistory = page.locator('#historyPanel .section-heading [data-open-history-archive]');
  await openArchive(page);
  await expect(page.locator('#historyArchiveTitle')).toBeFocused();

  const workout = page.locator('#historyArchiveList [data-history-id="august-newest"]');
  await workout.click();
  await expect(page.locator('#closeHistoryDialog')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#historyDialog')).toBeHidden();
  await expect(page.locator('#historyArchiveDialog')).toBeVisible();
  await expect(workout).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('#historyArchiveDialog')).toBeHidden();
  await expect(viewHistory).toBeFocused();
});

test('empty archive explains how training history begins', async ({ page }) => {
  await page.addInitScript(({ activeKey, storageKey, value }) => {
    localStorage.clear();
    localStorage.setItem(activeKey, 'jorge');
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, { activeKey: STORAGE_KEYS.activeProfile, storageKey: STORAGE_KEYS.jorge, value: blankState('jorge') });
  await openApp(page);
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await openArchive(page);
  await expect(page.locator('.history-archive-empty')).toContainText('No completed workouts yet');
  await expect(page.locator('.history-archive-empty')).toContainText('log one from Calendar');
});
