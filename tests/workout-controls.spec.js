import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { jorgeState, openApp } from './helpers/app.js';

test.beforeEach(async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await openApp(page);
});

test('renders the active exercise expanded with upcoming work collapsed', async ({ page }) => {
  const cards = page.locator('#activeExercises .active-exercise');
  await expect(cards).toHaveCount(2);
  await expect(cards.locator('h3')).toHaveText(['Seated Machine Chest Press', 'Lat Pulldown']);
  await expect(cards.first()).not.toHaveClass(/is-collapsed/);
  await expect(cards.first().locator('.active-exercise-body')).toBeVisible();
  await expect(cards.nth(1)).toHaveClass(/is-collapsed/);
  await expect(cards.first().locator('.exercise-toggle')).toHaveAttribute('aria-expanded', 'true');
});

test('reorders and removes exercises without changing selector compatibility', async ({ page }) => {
  const cards = page.locator('#activeExercises .active-exercise');
  await page.getByRole('button', { name: 'Move Lat Pulldown up', exact: true }).click();

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

test('chevron collapse respects a manual active-card choice without losing focus or edits', async ({ page }) => {
  const card = page.locator('#activeExercises .active-exercise').first();
  const toggle = page.getByRole('button', { name: 'Collapse Seated Machine Chest Press' });
  await expect(toggle).toHaveAttribute('aria-controls', 'exercise-body-0');
  await page.locator('input[data-field="weight"][data-ei="0"][data-si="1"]').fill('125');
  await toggle.click();
  await expect(card).toHaveClass(/is-collapsed/);
  await expect(page.getByRole('button', { name: 'Expand Seated Machine Chest Press' })).toHaveAttribute('aria-expanded', 'false');
  const stored = await jorgeState(page);
  expect(stored.activeWorkout.focusedExerciseId).toBe('seated-machine-chest-press');
  expect(stored.activeWorkout.exercises[0].sets[1].weight).toBe(125);
});

test('Add set inherits the latest working values once, persists, and updates progress', async ({ page }) => {
  const add = page.getByRole('button', { name: '+ Add set' }).first();
  await expect(add).toBeVisible();
  await add.click();
  let stored = await jorgeState(page);
  const working = stored.activeWorkout.exercises[0].sets.filter(set => !set.warmup);
  expect(working).toHaveLength(4);
  expect(working.at(-1)).toMatchObject({ weight: 100, reps: 8, warmup: false, completed: false });
  expect(new Set(working.map(set => set.id)).size).toBe(4);
  await expect(page.getByText('Set 1 of 4').first()).toBeVisible();
  await page.reload();
  stored = await jorgeState(page);
  expect(stored.activeWorkout.exercises[0].sets.filter(set => !set.warmup)).toHaveLength(4);
  for (let set = 1; set <= 4; set += 1) await page.getByRole('button', { name: `Complete Set ${set} of 4` }).click();
  await page.locator('#finishWorkout').click();
  stored = await jorgeState(page);
  expect(stored.workouts[0].exercises[0].sets.filter(set => !set.warmup)).toHaveLength(4);
});

test('empty active sets remove immediately, persist across reload, and renumber without ID corruption', async ({ page }) => {
  await page.locator('input[data-field="weight"][data-ei="0"][data-si="3"]').fill('');
  await page.locator('input[data-field="reps"][data-ei="0"][data-si="3"]').fill('');
  await page.getByRole('button', { name: 'Remove Set 3 of 3' }).click();

  let stored = await jorgeState(page);
  const working = stored.activeWorkout.exercises[0].sets.filter(set => !set.warmup);
  expect(working.map(set => set.id)).toEqual(['active-working-1', 'active-working-2']);
  expect(new Set(stored.activeWorkout.exercises[0].sets.map(set => set.id)).size).toBe(stored.activeWorkout.exercises[0].sets.length);
  await expect(page.getByRole('button', { name: 'Complete Set 1 of 2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete Set 2 of 2' })).toBeVisible();

  await page.reload();
  stored = await jorgeState(page);
  expect(stored.activeWorkout.exercises[0].sets.filter(set => !set.warmup)).toHaveLength(2);
  await expect(page.getByRole('button', { name: 'Remove Set 2 of 2' })).toBeVisible();
});

test('entered working and warm-up sets require an inline confirmation while prescription provenance stays unchanged', async ({ page }) => {
  const before = await page.evaluate(() => {
    active.programOrigin = { contractVersion: 1, marker: 'preserve-me' };
    saveState();
    return {
      routine: structuredClone(state.customRoutines),
      prescription: structuredClone(workoutRoutineEngine.getPrescription('Push', 'seated-machine-chest-press')),
      origin: structuredClone(active.programOrigin)
    };
  });

  const workingRemove = page.getByRole('button', { name: 'Remove Set 2 of 3' });
  await workingRemove.click();
  await expect(page.getByRole('button', { name: 'Confirm: Remove this set from this workout?' })).toHaveText('Sure?');
  expect((await jorgeState(page)).activeWorkout.exercises[0].sets.filter(set => !set.warmup)).toHaveLength(3);
  await page.getByRole('button', { name: 'Confirm: Remove this set from this workout?' }).click();

  const warmupRemove = page.getByRole('button', { name: 'Remove Warm-up' });
  await warmupRemove.click();
  await expect(page.getByRole('button', { name: 'Confirm: Remove this set from this workout?' })).toHaveText('Sure?');
  await page.getByRole('button', { name: 'Confirm: Remove this set from this workout?' }).click();

  const after = await page.evaluate(() => ({
    routine: structuredClone(state.customRoutines),
    prescription: structuredClone(workoutRoutineEngine.getPrescription('Push', 'seated-machine-chest-press')),
    origin: structuredClone(active.programOrigin),
    targetWorkingSets: active.exercises[0].targetWorkingSets
  }));
  expect(after.routine).toEqual(before.routine);
  expect(after.prescription).toEqual(before.prescription);
  expect(after.origin).toEqual(before.origin);
  expect(after.targetWorkingSets).toBeUndefined();
  expect((await jorgeState(page)).activeWorkout.exercises[0].sets.filter(set => !set.warmup)).toHaveLength(2);
});

test('completion accepts explicitly fewer sets and the next planned session restores the original prescription', async ({ page }) => {
  const remove = page.getByRole('button', { name: 'Remove Set 3 of 3' });
  await remove.click();
  await page.getByRole('button', { name: 'Confirm: Remove this set from this workout?' }).click();
  await page.getByRole('button', { name: 'Complete Set 1 of 2' }).click();
  await page.getByRole('button', { name: 'Complete Set 2 of 2' }).click();
  await page.locator('#finishWorkout').click();

  let stored = await jorgeState(page);
  expect(stored.workouts[0].exercises[0].sets.filter(set => !set.warmup)).toHaveLength(2);
  await page.evaluate(() => workoutSessionController.start('Push', { loadRoutine: true, scroll: false }));
  stored = await jorgeState(page);
  expect(stored.activeWorkout.exercises.find(exercise => exercise.id === 'seated-machine-chest-press').sets.filter(set => !set.warmup)).toHaveLength(3);
});
