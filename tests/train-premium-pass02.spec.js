import { test, expect } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp, clickCentered } from './helpers/app.js';

const firstId = 'seated-machine-chest-press';
const row = (page, id) => page.locator(`#activeExercises [data-set-id="${id}"]`);
const snapshot = page => readStoredJson(page, STORAGE_KEYS.jorge);
async function seed(page, profile = 'jorge') {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises', { activeProfile: profile, now: '2026-08-05T12:10:00.000Z' });
  if (profile === 'alexa') await page.addInitScript(() => {
    const value = JSON.parse(localStorage.getItem('big-gains-v2'));
    localStorage.setItem('big-gains-alexa-v1', JSON.stringify({ ...value, profileId: 'alexa' }));
  });
  await openApp(page);
  await expect(page.locator('#workoutSummary')).toBeVisible();
}
async function counts(page, exercises, sets) {
  await expect(page.locator('[data-workout-exercises]')).toHaveText(exercises);
  await expect(page.locator('[data-workout-sets]')).toHaveText(sets);
}

test('working progress follows complete, uncomplete, add and remove; warmups stay separate', async ({ page }) => {
  await seed(page);
  await counts(page, '0/2', '0/6');
  const initial = await snapshot(page);
  await clickCentered(row(page, 'active-warmup-1').locator('.set-done'));
  await counts(page, '0/2', '0/6');
  // The existing rest controller starts rest after any logged set, including warmups.
  expect((await snapshot(page)).restTimerEndsAt).toBeGreaterThan(0);
  for (const id of ['active-working-1','active-working-2','active-working-3']) await clickCentered(row(page, id).locator('.set-done'));
  await counts(page, '1/2', '3/6');
  await expect(page.locator('[data-workout-progress]')).toHaveAttribute('aria-label', '3 of 6 working sets completed');
  const first = page.locator(`[data-exercise-id="${firstId}"]`);
  await clickCentered(first.locator('.exercise-toggle'));
  await clickCentered(row(page, 'active-working-1').locator('.set-done'));
  await counts(page, '0/2', '2/6');
  await clickCentered(first.locator('[data-add-warmup]'));
  await counts(page, '0/2', '2/6');
  await clickCentered(first.locator('[data-add-set]'));
  await counts(page, '0/2', '2/7');
  const added = (await snapshot(page)).activeWorkout.exercises[0].sets.filter(set => !set.warmup).at(-1);
  const remove = row(page, added.id).locator('.set-remove');
  await clickCentered(remove);
  if (await remove.count() && (await remove.getAttribute('class')).includes('is-confirming')) await remove.click();
  await counts(page, '0/2', '2/6');
  expect((await snapshot(page)).workouts).toEqual(initial.workouts);
});

test('warmup-only and empty sessions never claim exercise completion or invent targets', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises', { now: '2026-08-05T12:10:00.000Z' });
  await page.addInitScript(() => {
    const value = JSON.parse(localStorage.getItem('big-gains-v2'));
    const exercise = value.activeWorkout.exercises[0];
    exercise.sets = [{ ...exercise.sets[0], completed: true }];
    exercise.equipment = 'Unlisted equipment';
    value.activeWorkout.exercises = [exercise];
    localStorage.setItem('big-gains-v2', JSON.stringify(value));
  });
  await openApp(page);
  await counts(page, '0/1', '0/0');
  await expect(page.locator('[data-workout-percent]')).toHaveText('0%');
  expect(await page.locator('[data-workout-progress]').evaluate(el => ({ value: el.value, max: el.max }))).toEqual({ value: 0, max: 1 });
  await expect(page.locator('.exercise-context')).toContainText('First time logged');
  await expect(page.locator('.exercise-context')).toContainText('Not set');
  await expect(page.locator('[data-improvement-delta]')).toHaveCount(0);
  await expect(page.locator('.exercise-equipment-icon')).toHaveCount(1);
  await page.evaluate(() => workoutSessionController.replace('Push', { loadRoutine: false, scroll: false }));
  await counts(page, '0/0', '0/0');
  await expect(page.locator('[data-workout-percent]')).toHaveText('0%');
});

test('swapping an exercise recalculates progress from the replacement without changing History', async ({ page }) => {
  await seed(page);
  await clickCentered(row(page, 'active-working-1').locator('.set-done'));
  await counts(page, '0/2', '1/6');
  const before = await snapshot(page);
  const result = await page.evaluate(() => workoutSessionController.swapExercise(0, 'barbell-bench-press', { confirmed: true }));
  expect(result.swapped).toBe(true);
  const after = await snapshot(page);
  const working = after.activeWorkout.exercises.flatMap(exercise => exercise.sets.filter(set => !set.warmup));
  await counts(page, '0/2', `${working.filter(set => set.completed).length}/${working.length}`);
  expect(after.workouts).toEqual(before.workouts);
  expect(after.activeWorkout.exercises[1]).toEqual(before.activeWorkout.exercises[1]);
});

test('repeated log taps and interrupted removal preserve set identity, focus and History', async ({ page }) => {
  await seed(page);
  const before = await snapshot(page);
  const complete = row(page, 'active-working-1').locator('.set-done');
  await complete.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await complete.click({ clickCount: 2, delay: 40 });
  const repeated = await snapshot(page);
  const logged = repeated.activeWorkout.exercises.flatMap(exercise => exercise.sets).filter(set => set.completed);
  expect(logged.every(set => set.id === 'active-working-1')).toBe(true);
  const entered = row(page, 'active-working-1').locator('.set-remove');
  await clickCentered(entered);
  await expect(entered).toHaveClass(/is-confirming/);
  const armed = await snapshot(page);
  await clickCentered(page.locator('#reorderWorkout'));
  await expect(page.locator('#reorderDialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#reorderWorkout')).toBeFocused();
  expect((await snapshot(page)).activeWorkout.exercises).toEqual(armed.activeWorkout.exercises);
  expect((await snapshot(page)).restTimerEndsAt).toBe(armed.restTimerEndsAt);
  const input = row(page, 'active-working-1').locator('input[data-field="weight"]');
  await clickCentered(input);
  await input.fill('105');
  await input.press('Tab');
  expect((await snapshot(page)).activeWorkout.exercises[0].sets.find(set => set.id === 'active-working-1').weight).toBe(105);
  expect((await snapshot(page)).workouts).toEqual(before.workouts);
  const ids = (await snapshot(page)).activeWorkout.exercises.flatMap(exercise => exercise.sets.map(set => set.id));
  expect(new Set(ids).size).toBe(ids.length);
});

for (const profile of ['jorge','alexa']) test(`${profile}: all accents retain semantic completion, editable controls and theme`, async ({ page }, info) => {
  await seed(page, profile);
  const first = row(page, 'active-working-1');
  await clickCentered(first.locator('.set-done'));
  const before = await page.evaluate(() => ({ state: JSON.stringify(state), theme: document.documentElement.dataset.theme }));
  for (const accent of ['volt','cobalt','merlot','rose','violet','ember']) {
    await page.evaluate(accent => BigGainsAppearance.select(accent), accent);
    await expect(page.locator('html')).toHaveAttribute('data-accent', accent);
    await expect(first.locator('.set-done')).toHaveAttribute('aria-pressed', 'true');
    const styles = await page.evaluate(() => {
      const done = document.querySelector('[data-set-id="active-working-1"] .set-done');
      const current = document.querySelector('.set-line.is-current .set-done');
      return { done: getComputedStyle(done).color, current: getComputedStyle(current).backgroundColor,
        overflow: document.documentElement.scrollWidth > innerWidth, theme: document.documentElement.dataset.theme, state: JSON.stringify(state) };
    });
    expect(styles.done).not.toBe(styles.current);
    expect(styles.overflow).toBe(false);
    expect(styles.theme).toBe(before.theme);
    expect(styles.state).toBe(before.state);
    await page.screenshot({ path: info.outputPath(`${profile}-${accent}.png`) });
  }
});

test('large workouts and long names keep actions separate and preserve immediate position restoration', async ({ page }) => {
  await seed(page);
  await page.evaluate(() => {
    const extra = BigGainsExerciseCatalog.exercises.filter(exercise => !active.exercises.some(current => current.id === exercise.id)).slice(0, 20);
    extra.forEach(exercise => workoutSessionController.addExercise(exercise.id, { scroll: false }));
    active.exercises[0].name = 'Single-arm seated machine chest press with an intentionally long descriptive movement name';
    workoutSessionController.focusExercise(0);
    saveState(); renderActive();
  });
  const first = page.locator('#activeExercises .active-exercise').first();
  await expect(first.locator('h3')).toContainText('intentionally long');
  const title = await first.locator('h3').boundingBox(), swap = await first.locator('.swap-exercise').boundingBox();
  expect(title.x + title.width).toBeLessThanOrEqual(swap.x + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await clickCentered(row(page, 'active-working-2').locator('input[data-field="reps"]'));
  const position = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('big-gains-train-position')).map(key => JSON.parse(localStorage.getItem(key))));
  expect(position.some(record => record.exerciseId === firstId && record.setId === 'active-working-2')).toBe(true);
  await page.reload();
  await expect(row(page, 'active-working-2')).toBeInViewport();
});
