import { expect, test } from '@playwright/test';
import { installLocalStorageFixture } from './fixtures/local-storage.js';
import { clickCentered, jorgeState, openApp, reloadApp } from './helpers/app.js';

test.use({ timezoneId: 'America/New_York' });
const literalNote = '<script>literal & "quoted" \'notes\'</script>\nKeep < 90° & breathe.';

async function prepare(page, { long = false, overnight = false, kg = false } = {}) {
  await page.clock.setFixedTime(new Date('2026-11-09T06:30:00.000Z'));
  await installLocalStorageFixture(page, 'activeWorkoutWithTwoExercises');
  await openApp(page);
  await page.evaluate(({ long, overnight, kg, note }) => {
    const specs = [
      ['barbell-bench-press', [{ weight: 45, reps: 10, warmup: true }, { weight: 135, reps: 8 }, { weight: 155, reps: 6 }]],
      ['seated-machine-chest-press', [{ weight: 100, reps: 10 }]],
      ['push-up', [{ weight: 0, reps: 20 }]],
      ['pull-up', [{ weight: 25, reps: 6 }]],
      ['assisted-pull-up', [{ weight: 50, reps: 8 }]],
      ['plank', [{ weight: 0, duration: 90 }]],
      ['farmer-carry', [{ weight: 40, distance: 30 }]],
      ['air-bike', [{ weight: 0, distance: 2.5, duration: 600 }]]
    ];
    active.startedAt = overnight ? '2026-11-09T04:10:00.000Z' : new Date(Date.now() - 125000).toISOString();
    active.type = 'FullBody';
    active.note = note;
    active.exercises = Array.from({ length: long ? 16 : specs.length }, (_, index) => {
      const [id, sets] = specs[index % specs.length];
      const definition = exerciseCatalog.getById(id);
      if (!definition) throw new Error(`Missing fixture definition: ${id}`);
      return {
        ...definition, id: long ? `receipt-${index}` : id, definitionId: id,
        name: long ? `${String(index + 1).padStart(2, '0')} · ${definition.name} — controlled tempo and full range of motion` : definition.name,
        note: index === 0 ? note : '',
        sets: [...sets.map((set, setIndex) => ({ id: `receipt-${index}-${setIndex}`, completed: true, warmup: false, ...set })),
          { id: `unfinished-${index}`, weight: 999, reps: 99, completed: false, warmup: false }]
      };
    });
    state.weights = [{ date: '2026-11-01T12:00:00.000Z', weight: 180 }];
    if (kg) state.unitPreferences = { contractVersion: 1, weightUnit: 'kg' };
    saveState();
    renderActive();
    window.bigGainsViewShell.showView('train', { instant: true, workout: true });
  }, { long, overnight, kg, note: literalNote });
  await expect(page.locator('#finishWorkout')).toBeEnabled();
}

async function finish(page) {
  await clickCentered(page.locator('#finishWorkout'));
  await expect(page.locator('#workoutCompletion')).toBeVisible();
  await expect(page.locator('#completionDetail')).toBeVisible();
  await expect(page.locator('#workoutCompletionTitle')).toBeFocused();
}

test('mixed receipt uses committed ordered measurements, notes, real record events and separate workloads', async ({ page }) => {
  await prepare(page);
  await finish(page);
  const saved = (await jorgeState(page)).workouts[0];
  const cards = page.locator('#completionExercisesList .completion-exercise');
  await expect(cards).toHaveCount(8);
  await expect(cards.locator('h3')).toHaveText(saved.exercises.map(exercise => exercise.name));
  await expect(page.locator('.completion-set')).toHaveCount(10);
  await expect(page.locator('#completionWorkingSets')).toHaveText('9');
  await expect(page.locator('#completionWarmups')).toHaveText('1');
  await expect(page.locator('#completionExercises')).toHaveText('8');
  await expect(cards.nth(0).locator('.completion-set-label')).toHaveText(['Warm-up 1', 'Working 1', 'Working 2']);
  await expect(cards.nth(0).locator('.completion-set-value')).toHaveText(['45 lb × 10', '135 lb × 8', '155 lb × 6']);
  await expect(cards.nth(2).locator('.completion-set-value')).toHaveText('Bodyweight × 20');
  await expect(cards.nth(3).locator('.completion-set-value')).toHaveText('Bodyweight + 25 lb × 6');
  await expect(cards.nth(4).locator('.completion-set-value')).toHaveText('50 lb assistance × 8');
  await expect(cards.nth(5).locator('.completion-set-value')).toHaveText('90 sec');
  await expect(cards.nth(6).locator('.completion-set-value')).toHaveText('40 lb per hand · 30 ft');
  await expect(cards.nth(7).locator('.completion-set-value')).toHaveText('2.5 mi · 600 sec');
  await expect(page.locator('#completionWorkoutNote p')).toHaveText(literalNote);
  await expect(cards.first().locator('.completion-note p')).toHaveText(literalNote);
  expect(await page.locator('#workoutCompletion script').count()).toBe(0);
  const families = page.locator('#completionVolume [data-workload-family]');
  await expect(families).toHaveCount(3);
  await expect(page.locator('#completionVolume [data-workload-family="external_load"] strong')).toHaveText('2,010 lb');
  await expect(page.locator('#completionVolume [data-workload-family="machine_indicated"] strong')).toHaveText('1,000 lb');
  await expect(page.locator('#completionVolume [data-workload-family="modeled_system_load"] strong')).toHaveText('2,270 lb');
  expect(await page.evaluate(() => volumeForWorkout(state.workouts[0]))).toBeNull();
  const events = await page.evaluate(() => derivePersonalRecords().workoutRecordEvents[state.workouts[0].id]);
  await expect(page.locator('#completionPrCount')).toHaveText(String(events.length));
  await expect(page.locator('.completion-record')).toHaveText(events.map(event => event.shortLabel));
  // The committed receipt and History use the same established measurements.
  await clickCentered(page.locator('#completionReview'));
  await expect(page.locator('#historyDialog')).toBeVisible();
  await expect(page.locator('#historyDialogContent .history-set')).toHaveCount(10);
  await expect(page.locator('#historyDialogContent .history-exercise h3')).toHaveText(saved.exercises.map(exercise => exercise.name));
  await page.locator('#closeHistoryDialog').click();
  await clickCentered(page.locator('#completionDone'));
  await expect(page.locator('#workoutCompletion')).toBeHidden();
  await expect(page.locator('#trainingPetHome #trainingPetCard')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('main').inert)).toBe(false);
  await expect(page.locator('#quickStartSession')).toBeFocused();
  expect((await jorgeState(page)).workouts).toEqual([saved]);
});

test('overnight receipt labels elapsed time with hours and completion date', async ({ page }) => {
  await prepare(page, { overnight: true });
  await finish(page);
  await expect(page.locator('#completionDuration')).toHaveText('2:20:00');
  await expect(page.locator('#completionDate')).toContainText('November 9, 2026');
  await expect(page.locator('#completionDate')).toHaveAttribute('datetime', '2026-11-09T06:30:00.000Z');
  await expect(page.locator('#workoutCompletion')).toContainText('Elapsed');
  await expect(page.locator('#workoutCompletion')).not.toContainText(/active time|calories|cloud synced/i);
});

test('preferred units reuse the existing formatter without rewriting committed loads', async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => { state.unitPreferences = { contractVersion: 1, weightUnit: 'kg' }; saveState(); });
  await finish(page);
  await expect(page.locator('.completion-set-value').first()).toHaveText('20.4 kg × 10');
  expect((await jorgeState(page)).workouts[0].exercises[0].sets[0].weight).toBe(45);
});

test('rendering twice replaces every row without storage writes or duplicate footer handlers', async ({ page }) => {
  await prepare(page);
  await finish(page);
  const saved = await jorgeState(page);
  await page.evaluate(() => {
    window.__receiptWrites = 0;
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === ACCOUNT.storageKey) window.__receiptWrites++; return write.call(this, key, value); };
    renderCompletion(state.workouts[0]);
    renderCompletion(state.workouts[0]);
    window.__receiptHistoryOpens = 0;
    const open = openHistory;
    openHistory = (...args) => { window.__receiptHistoryOpens++; return open(...args); };
  });
  await expect(page.locator('.completion-exercise')).toHaveCount(8);
  await expect(page.locator('.completion-set')).toHaveCount(10);
  await expect(page.locator('#completionWorkoutNote .completion-note')).toHaveCount(1);
  expect(await page.evaluate(() => window.__receiptWrites)).toBe(0);
  await clickCentered(page.locator('#completionReview'));
  expect(await page.evaluate(() => window.__receiptHistoryOpens)).toBe(1);
  await page.locator('#closeHistoryDialog').click();
  await clickCentered(page.locator('#completionDone'));
  expect(await jorgeState(page)).toEqual(saved);
  expect(await page.evaluate(() => document.querySelector('main').inert)).toBe(false);
});

test('failed persistence never opens a false completion receipt', async ({ page }) => {
  await prepare(page);
  const saved = await jorgeState(page);
  const result = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === ACCOUNT.storageKey) throw new DOMException('Synthetic quota', 'QuotaExceededError'); return original.call(this, key, value); };
    try { return workoutSessionController.complete(); }
    finally { Storage.prototype.setItem = original; }
  });
  expect(result).toBe(false);
  await expect(page.locator('#workoutCompletion')).toBeHidden();
  expect(await jorgeState(page)).toEqual(saved);
  await expect(page.locator('#finishWorkout')).toBeEnabled();
});

test('formatter failure leaves committed facts intact and a functional minimal receipt', async ({ page }) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    window.__restoreLoggedSet = formatLoggedSet;
    formatLoggedSet = () => { throw new Error('Synthetic presentation failure'); };
    return workoutSessionController.complete();
  });
  expect(result).toBe(true);
  const saved = await jorgeState(page);
  expect(saved.workouts).toHaveLength(1);
  expect(saved.activeWorkout).toBeNull();
  await expect(page.locator('#workoutCompletion')).toBeVisible();
  await expect(page.locator('#completionDetail')).toBeHidden();
  await expect(page.locator('#completionReceiptCopy')).toHaveText('Saved on this device. Full details are available in History.');
  await expect(page.locator('#workoutCompletionTitle')).toBeFocused();
  await page.evaluate(() => { formatLoggedSet = window.__restoreLoggedSet; });
  await clickCentered(page.locator('#completionReview'));
  await expect(page.locator('#historyDialogContent .history-set')).toHaveCount(10);
  await page.locator('#closeHistoryDialog').click();
  await clickCentered(page.locator('#completionDone'));
  await reloadApp(page);
  expect((await jorgeState(page)).workouts).toEqual(saved.workouts);
});

for (const [width, accent] of [[375, 'cobalt'], [390, 'merlot'], [1280, 'cobalt']]) {
  test(`long receipt is readable and scrolls at ${width}px in ${accent}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 860 });
    await prepare(page, { long: true });
    await page.evaluate(accent => BigGainsAppearance.select(accent), accent);
    await finish(page);
    const saved = (await jorgeState(page)).workouts[0];
    await expect(page.locator('.completion-exercise')).toHaveCount(16);
    await expect(page.locator('.completion-exercise h3')).toHaveText(saved.exercises.map(exercise => exercise.name));
    await expect(page.locator('.completion-set')).toHaveCount(20);
    const rows = await page.evaluate(() => [...document.querySelectorAll('.completion-exercise')].map(card => [...card.querySelectorAll('.completion-set-value')].map(row => row.textContent)));
    expect(rows).toEqual(await page.evaluate(() => state.workouts[0].exercises.map(exercise => exercise.sets.map(set => formatLoggedSet(exercise, set)))));
    const geometry = await page.locator('#workoutCompletion').evaluate(element => ({
      overflow: element.scrollWidth > element.clientWidth, scrolls: element.scrollHeight > element.clientHeight,
      animation: getComputedStyle(element).animationName, bodyOverflow: getComputedStyle(document.body).overflow,
      pageOverflow: document.documentElement.scrollWidth > innerWidth
    }));
    expect(geometry).toEqual({ overflow: false, scrolls: true, animation: 'none', bodyOverflow: 'hidden', pageOverflow: false });
    const topPath=info.outputPath(`receipt-${width}-${accent}-top.png`);
    await page.screenshot({ path: topPath });
    await info.attach(`Receipt ${width}px ${accent}`, { path: topPath, contentType: 'image/png' });
    await page.locator('.completion-exercise').nth(8).scrollIntoViewIfNeeded();
    await expect(page.locator('.completion-exercise').nth(8)).toBeInViewport();
    const scrollPath=info.outputPath(`receipt-${width}-${accent}-scroll.png`);
    await page.screenshot({ path: scrollPath });
    await info.attach(`Receipt ${width}px ${accent}, scrolled`, { path: scrollPath, contentType: 'image/png' });
    await clickCentered(page.locator('#completionDone'));
    await expect(page.locator('#trainingPetHome #trainingPetCard')).toBeVisible();
    await expect(page.locator('#quickStartSession')).toBeFocused();
    await page.locator('#quickStartSession').click();
    await expect(page.locator('#activePanel')).toBeVisible();
    expect((await jorgeState(page)).workouts).toEqual([saved]);
  });
}
