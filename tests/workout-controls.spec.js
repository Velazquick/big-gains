import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await openApp(page);
});

test('renders the active session and preserves collapse and expand behavior', async ({ page }) => {
  const cards = page.locator('#activeExercises .active-exercise');
  await expect(cards).toHaveCount(2);
  await expect(cards.locator('h3')).toHaveText(['Seated Machine Chest Press', 'Lat Pulldown']);
  await expect(cards.first()).toHaveClass(/is-collapsed/);
  await expect(cards.first().locator('.collapsed-summary')).toContainText('0/3 working sets');

  await page.getByRole('button', { name: 'Expand Seated Machine Chest Press' }).click();
  await expect(cards.first()).not.toHaveClass(/is-collapsed/);
  await expect(cards.first().locator('.active-exercise-body')).toBeVisible();
  await expect(cards.nth(1)).toHaveClass(/is-collapsed/);

  await page.getByRole('button', { name: 'Collapse Seated Machine Chest Press' }).click();
  await expect(cards.first()).toHaveClass(/is-collapsed/);
  expect((await jorgeState(page)).activeWorkout.exercises[0].collapsed).toBe(true);
});

test('reorders and removes exercises without changing selector compatibility', async ({ page }) => {
  const cards = page.locator('#activeExercises .active-exercise');
  await page.getByRole('button', { name: 'Move Lat Pulldown up' }).click();

  await expect(cards.locator('h3')).toHaveText(['Lat Pulldown', 'Seated Machine Chest Press']);
  expect((await jorgeState(page)).activeWorkout.exercises.map(exercise => exercise.id)).toEqual([
    'lat-pulldown', 'seated-machine-chest-press'
  ]);

  await page.getByRole('button', { name: 'Remove Seated Machine Chest Press' }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.locator('h3')).toHaveText(['Lat Pulldown']);
  await expect(page.locator('#quickExerciseSelect')).toBeAttached();
  expect((await jorgeState(page)).activeWorkout.exercises.map(exercise => exercise.id)).toEqual(['lat-pulldown']);
});

test('edits set values through inputs and steppers', async ({ page }) => {
  await page.getByRole('button', { name: 'Expand Seated Machine Chest Press' }).click();
  const weight = page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]');
  const reps = page.locator('input[data-field="reps"][data-ei="0"][data-si="1"]');
  await weight.fill('125');
  await page.locator('button[data-adjust="1"][data-field="reps"][data-ei="0"][data-si="1"]').click();

  const set = (await jorgeState(page)).activeWorkout.exercises[0].sets[1];
  expect(set.weight).toBe(125);
  expect(set.reps).toBe(9);
  await expect(weight).toHaveValue('125');
  await expect(reps).toHaveValue('9');
});

test('renders completion state and advances to the next exercise', async ({ page }) => {
  await page.getByRole('button', { name: 'Expand Seated Machine Chest Press' }).click();
  await page.getByRole('button', { name: 'Complete Set 1 of 3' }).click();
  await page.getByRole('button', { name: 'Complete Set 2 of 3' }).click();
  await page.getByRole('button', { name: 'Complete Set 3 of 3' }).click();

  const cards = page.locator('#activeExercises .active-exercise');
  await expect(cards.first()).toHaveClass(/is-complete/);
  await expect(cards.first()).toHaveClass(/is-collapsed/);
  await expect(cards.nth(1)).not.toHaveClass(/is-collapsed/);
  await expect(cards.first().locator('.collapsed-summary')).toContainText('3/3 working sets');
  await expect(page.locator('#finishWorkout')).toBeEnabled();

  const stored = await jorgeState(page);
  expect(stored.activeWorkout.exercises[0].sets.filter(set => !set.warmup).every(set => set.completed)).toBe(true);
  expect(stored.activeWorkout.exercises.map(exercise => exercise.collapsed)).toEqual([true, false]);
});
