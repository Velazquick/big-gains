import { expect, test } from '@playwright/test';
import { blankState, installLocalStorageFixture, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

const set = (id, weight, reps) => ({ id, weight, reps, warmup: false, completed: true });
const exercise = (id, name, muscle, sets) => ({ id, name, muscle, equipment: 'Test', sets });

function progressState() {
  return {
    ...blankState('jorge'),
    workouts: [
      {
        id: 'progress-push', type: 'Push', startedAt: '2026-08-05T09:00:00.000Z', completedAt: '2026-08-05T10:00:00.000Z', durationSeconds: 3600, prs: 2,
        exercises: [exercise('seated-machine-chest-press', 'Seated Machine Chest Press', 'Chest', [set('push-1', 180, 10), set('push-2', 190, 8), set('push-3', 190, 8)])]
      },
      {
        id: 'progress-pull', type: 'Pull', startedAt: '2026-08-03T09:00:00.000Z', completedAt: '2026-08-03T09:50:00.000Z', durationSeconds: 3000, prs: 1,
        exercises: [exercise('lat-pulldown', 'Lat Pulldown', 'Back', [set('pull-1', 100, 10), set('pull-2', 110, 10), set('pull-3', 110, 8)])]
      },
      {
        id: 'progress-legs', type: 'Legs', startedAt: '2026-08-02T09:00:00.000Z', completedAt: '2026-08-02T10:15:00.000Z', durationSeconds: 4500, prs: 3,
        exercises: [
          exercise('leg-press', 'Leg Press', 'Quads / Glutes', [set('legs-1', 300, 10), set('legs-2', 320, 10), set('legs-3', 320, 10)]),
          exercise('standing-calf-raise', 'Standing Calf Raise', 'Calves', [set('calves-1', 250, 12), set('calves-2', 260, 12)])
        ]
      },
      {
        id: 'progress-older', type: 'FullBody', startedAt: '2026-07-20T09:00:00.000Z', completedAt: '2026-07-20T09:45:00.000Z', durationSeconds: 2700, prs: 0,
        exercises: [exercise('dumbbell-shoulder-press', 'Dumbbell Shoulder Press', 'Shoulders', [set('older-1', 45, 10), set('older-2', 50, 8)])]
      }
    ],
    weights: [{ weight: 218.4, date: '2026-08-05T08:00:00.000Z' }]
  };
}

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge', { now: '2026-08-06T12:00:00.000Z' });
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEYS.jorge, state: progressState() });
  await openApp(page);
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'progress');
});

test('Progress is a dark analytics dashboard with overview, heatmap, and capped recent history', async ({ page }) => {
  await expect(page.locator('#progressPanel')).toHaveClass(/progress-dashboard-panel/);
  await expect(page.locator('.progress-overview-grid article')).toHaveCount(4);
  await expect(page.locator('.progress-dashboard-head h2')).toHaveText('7-day progress');
  await expect(page.locator('.progress-overview-grid article').nth(0).locator('strong')).toHaveText('3');
  await expect(page.locator('.muscle-zone')).toHaveCount(24);
  await expect(page.locator('#history .history-item')).toHaveCount(3);
  await expect(page.locator('.progress-history-footer')).toContainText('Browse every completed session by month');
  await expect(page.locator('[data-open-history-archive]').first()).toHaveText('View history');

  await page.locator('[data-muscle-key="Chest"]').first().click();
  await expect(page.locator('#progressMuscleDetail h3')).toHaveText('Chest');
  await expect(page.locator('#progressMuscleDetail')).toContainText('Seated Machine Chest Press');

  const shellBackground = await page.locator('#progressDialog .history-dialog-shell').evaluate(element => getComputedStyle(element).backgroundImage);
  expect(shellBackground).not.toBe('none');
});

test('30-day window recomputes the overview and muscle workload without changing stored state', async ({ page }) => {
  const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.jorge);
  await page.locator('[data-progress-window="30"]').click();
  await expect(page.locator('.progress-dashboard-head h2')).toHaveText('30-day progress');
  await expect(page.locator('[data-progress-window="30"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.progress-overview-grid article').nth(0).locator('strong')).toHaveText('4');
  await page.locator('[data-muscle-key="Shoulders"]').first().click();
  await expect(page.locator('#progressMuscleDetail h3')).toHaveText('Shoulders');
  const after = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.jorge);
  expect(after).toBe(before);
});

test('a selected zero-workload muscle stays selected and reports explicit zero metrics', async ({ page }) => {
  const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.jorge);
  await page.locator('[data-muscle-key="Core"]').first().click();

  const detail = page.locator('#progressMuscleDetail .muscle-detail');
  await expect(detail).toHaveAttribute('data-selected-muscle', 'Core');
  await expect(detail.locator('h3')).toHaveText('Core');
  await expect(detail.locator('.muscle-detail-head > strong')).toHaveText('0 sets');
  await expect(detail.locator('.muscle-detail-metrics')).toContainText('Volume0 lb');
  await expect(detail.locator('.muscle-detail-metrics')).toContainText('Reps0');
  await expect(detail.locator('.muscle-zero-state')).toContainText('No core working sets in the last 7 days');
  await expect(page.locator('[data-muscle-key="Core"]').first()).toHaveAttribute('aria-pressed', 'true');

  const after = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.jorge);
  expect(after).toBe(before);
});

test('Jorge dashboard stays inside an iPhone-sized viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.progress-overview-grid article')).toHaveCount(4);
  await expect(page.locator('.muscle-map-wrap')).toBeVisible();
  await expect(page.locator('#progressMuscleDetail')).toBeVisible();

  const layout = await page.evaluate(() => {
    const map = document.querySelector('.muscle-map-wrap').getBoundingClientRect();
    const detail = document.getElementById('progressMuscleDetail').getBoundingClientRect();
    return {
      viewportWidth: innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      mapLeft: map.left,
      mapRight: map.right,
      detailTop: detail.top,
      mapBottom: map.bottom
    };
  });
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.mapLeft).toBeGreaterThanOrEqual(0);
  expect(layout.mapRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.detailTop).toBeGreaterThanOrEqual(layout.mapBottom);
});

test('strength drill-down remains available from the redesigned dashboard', async ({ page }) => {
  const select = page.locator('#progressExerciseSelect');
  await expect(select).toBeVisible();
  await select.selectOption('seated-machine-chest-press');
  await expect(page.locator('#progressPreview')).toContainText('Seated Machine Chest Press');
  await page.locator('#openSelectedProgress').click();
  await expect(page.locator('#progressDialog')).toBeVisible();
  await expect(page.locator('#progressDialogTitle')).toHaveText('Seated Machine Chest Press');
  await expect(page.locator('#progressDialogContent')).toContainText('e1RM unavailable for this measurement contract');
  await expect(page.locator('#progressDialogContent')).toContainText('indicated workload');
  const shell = await page.locator('#progressDialog .history-dialog-shell').evaluate(element => {
    const styles = getComputedStyle(element);
    return { backgroundImage: styles.backgroundImage, color: styles.color };
  });
  expect(shell.backgroundImage).not.toBe('none');
  expect(shell.color).toBe('rgb(244, 246, 248)');
});

test('Alexa keeps a readable wellness-light dashboard and dialog without persisting analytics UI state', async ({ page }) => {
  const alexaState = { ...progressState(), profileId: 'alexa', goals: blankState('alexa').goals };
  await page.evaluate(({ activeProfileKey, storageKey, state }) => {
    localStorage.setItem(activeProfileKey, 'alexa');
    localStorage.setItem(storageKey, JSON.stringify(state));
  }, { activeProfileKey: STORAGE_KEYS.activeProfile, storageKey: STORAGE_KEYS.alexa, state: alexaState });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.bottom-nav [data-view="progress"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-profile', 'alexa');

  const before = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.alexa);
  await page.locator('[data-progress-window="30"]').click();
  await page.locator('[data-muscle-key="Shoulders"]').first().click();
  await page.locator('#openSelectedProgress').click();
  await expect(page.locator('#progressDialog')).toBeVisible();

  const presentation = await page.evaluate(() => {
    const card = getComputedStyle(document.querySelector('.progress-overview-grid article'));
    const dialog = getComputedStyle(document.querySelector('#progressDialog .history-dialog-shell'));
    return {
      cardBackground: card.backgroundColor,
      cardColor: card.color,
      dialogBackground: dialog.backgroundImage,
      dialogColor: dialog.color,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: innerWidth
    };
  });
  expect(presentation.cardBackground).toBe('rgb(255, 254, 253)');
  expect(presentation.cardColor).toBe('rgb(53, 32, 45)');
  expect(presentation.dialogBackground).not.toBe('none');
  expect(presentation.dialogColor).toBe('rgb(53, 32, 45)');
  expect(presentation.documentWidth).toBeLessThanOrEqual(presentation.viewportWidth);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEYS.alexa)).toBe(before);
});
