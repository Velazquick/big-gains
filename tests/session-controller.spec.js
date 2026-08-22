import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { chooseSession, jorgeState, openApp, startSelectedSession } from './helpers/app.js';

async function expectStartedSession(page, { type, exerciseCount }) {
  const stored = await jorgeState(page);
  const session = stored.activeWorkout;

  expect(session).toBeTruthy();
  expect(typeof session.id).toBe('string');
  expect(session.id.length).toBeGreaterThan(0);
  expect(session.type).toBe(type);
  expect(Number.isNaN(Date.parse(session.startedAt))).toBe(false);
  expect(session.exercises).toHaveLength(exerciseCount);
  expect(stored.restTimerEndsAt).toBeNull();
  await expect(page.locator('#activePanel')).not.toHaveClass(/hidden/);
}

test('Today uses the shared saved-routine start semantics', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge', { now: '2026-08-05T12:00:00.000Z' });
  await openApp(page);

  expect(await page.evaluate(() => Object.keys(window.workoutSessionController))).toEqual([
    'start', 'startProgram', 'resume', 'replace', 'loadRoutine', 'repairEmpty', 'addExercise',
    'focusExercise', 'moveExercise', 'toggleExercise', 'removeExercise', 'addSet',
    'updateSet', 'adjustSet', 'toggleSetCompleted', 'complete', 'discard'
  ]);
  await page.locator('#startWorkout').evaluate(button => button.click());

  await expectStartedSession(page, { type: 'Legs', exerciseCount: 7 });
});

test('the session selector uses the shared saved-routine start semantics', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await chooseSession(page, 'Pull');
  await startSelectedSession(page);

  await expectStartedSession(page, { type: 'Pull', exerciseCount: 6 });
});

test('Library Load Routine uses the shared saved-routine start semantics', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#dayTabs [data-day="FullBody"]').click();
  await page.locator('#loadRoutine').click();

  await expectStartedSession(page, { type: 'FullBody', exerciseCount: 8 });
});

test('Add Exercise creates a valid session through the controller', async ({ page }) => {
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
  await page.locator('.bottom-nav [data-view="library"]').click();
  await page.locator('#dayTabs [data-day="Other"]').click();
  await page.locator('#quickExerciseSelect').selectOption('seated-machine-chest-press');
  await page.locator('#addSelectedExercise').click();

  await expectStartedSession(page, { type: 'Other', exerciseCount: 1 });
  const stored = await jorgeState(page);
  expect(stored.activeWorkout.exercises[0].id).toBe('seated-machine-chest-press');
});

test('loads a saved routine into the existing session without replacing it', async ({ page }) => {
  await installLocalStorageFixture(page, 'activeWorkoutWithExercises');
  await openApp(page);
  const original = (await jorgeState(page)).activeWorkout;

  await page.evaluate(() => window.workoutSessionController.loadRoutine('Pull', { scroll: false }));

  const updated = (await jorgeState(page)).activeWorkout;
  expect(updated.id).toBe(original.id);
  expect(updated.startedAt).toBe(original.startedAt);
  expect(updated.type).toBe(original.type);
  expect(updated.exercises).toHaveLength(7);
  expect(updated.exercises.map(exercise => exercise.id)).toEqual(expect.arrayContaining([
    'seated-machine-chest-press',
    'lat-pulldown',
    'seated-cable-row',
    'chest-supported-row',
    'reverse-pec-deck',
    'dumbbell-curl',
    'hammer-curl'
  ]));
});
