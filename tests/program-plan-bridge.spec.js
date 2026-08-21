import { expect, test } from '@playwright/test';
import { installLocalStorageFixture, readStoredJson, STORAGE_KEYS } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';
import { createProgramFixture } from './helpers/program.js';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installLocalStorageFixture(page, 'blankJorge');
  await openApp(page);
});

test('Plan empty state is understandable, reachable from Today, and keeps five existing persistent destinations', async ({ page }) => {
  await expect(page.locator('.bottom-nav button')).toHaveCount(5);
  await expect(page.locator('.bottom-nav button')).toHaveText(['Today', 'Train', 'Calendar', 'Progress', 'Library']);
  await expect(page.locator('#todayPlanCard')).toBeVisible();
  await page.locator('[data-today-plan]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'plan');
  await expect(page.locator('#planOverview')).toContainText('No active Goals');
  await expect(page.locator('#planOverview')).toContainText('No Program yet');
  await expect(page.locator('#planOverview')).toContainText('Program connects approved sessions into a rolling route');
  await expect(page.locator('.bottom-nav [data-view="plan"]')).toHaveCount(0);
  await page.locator('#planBackToday').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'today');
});

test('Plan presents Program-only and Goals-only states without inventing relationships', async ({ page }) => {
  await createProgramFixture(page, { withGoal: false, name: 'Program Only' });
  await page.evaluate(() => BigGainsProgramSetup.openPlan());
  await expect(page.locator('#planOverview')).toContainText('Program Only');
  await expect(page.locator('#planOverview')).toContainText('No active Goals');
  await page.locator('[data-plan-program]').click();
  await expect(page.locator('#planProgramDetail')).toContainText('No linked priorities');
  await expect(page.locator('#planProgramDetail')).toContainText('6 rolling sessions');

  await page.reload();
  await page.evaluate(() => {
    state.programCapture = BigGainsProgramModel.blankCapture();
    bigGainsGoals.createGoal({ exerciseId: BigGainsExerciseCatalog.resolve('Barbell Bench Press').canonicalId, targetValue: 250 });
    saveState();
    renderAll();
    bigGainsViewShell.showView('goals', { workout: false });
  });
  await page.locator('#goalsOpenPlan').click();
  await expect(page.locator('#planOverview')).toContainText('Barbell Bench Press · target 250');
  await expect(page.locator('#planOverview')).toContainText('Ready to connect when you build a Program');
  await expect(page.locator('#planOverview')).toContainText('No Program yet');
});

test('Today, Goal, Program, and Analyzer traverse canonical Plan surfaces without mutation or recomputation drift', async ({ page }) => {
  const { goalId } = await createProgramFixture(page, { name: 'Linked Plan Program' });
  const before = await readStoredJson(page, STORAGE_KEYS.jorge);

  await expect(page.locator('#todayPlanCard')).toContainText('Linked Plan Program · v1');
  await expect(page.locator('#todayPlanCard')).toContainText('Next in the rolling route: Push');
  await expect(page.locator('#todayPlanCard')).toContainText('Barbell Bench Press priority');
  await page.locator('[data-today-plan]').click();
  await expect(page.locator('#planOverview')).toContainText('2 exposures · 6 working sets per cycle');
  await page.locator('[data-plan-program]').click();
  await expect(page.locator('#planProgramDetail')).toContainText('Next rolling session');
  await expect(page.locator('#planProgramDetail')).toContainText('Monday preference');
  await page.locator('.plan-cycle-slot details').first().locator('summary').click();
  await expect(page.locator('.plan-cycle-slot').first()).toContainText('Barbell Bench Press');
  await expect(page.locator('.plan-cycle-slot').first()).toContainText('3 working sets · 4–6');

  const fact = await page.evaluate(() => {
    const analysis = BigGainsProgramSetup.analyzeCurrent();
    const bench = analysis.exerciseExposure.find(item => item.name === 'Barbell Bench Press');
    return { status: analysis.status, exposures: bench.exposuresPerCycle, sets: bench.workingSetsPerCycle, spacing: bench.slotDistances };
  });
  expect(fact).toEqual({ status: 'available', exposures: 2, sets: 6, spacing: [3, 3] });
  await page.locator('#planProgramContent [data-plan-analysis]').click();
  await expect(page.locator('#programAnalyzerPanel')).toBeVisible();
  await expect(page.locator('#programAnalyzerPanel')).toContainText('2 exposures / cycle · 6 working sets');
  await expect(page.locator('#programAnalyzerPanel')).toContainText('3 sessions apart');
  await page.locator('#closeProgramAnalyzer').click();
  await expect(page.locator('#programAnalyzerPanel')).toBeHidden();

  await page.locator(`#planProgramContent [data-plan-open-goal="${goalId}"]`).click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'goals');
  await expect(page.locator(`.goal-card[data-goal-id="${goalId}"] .goal-program-support`)).toContainText('Supported by Program');
  await expect(page.locator(`.goal-card[data-goal-id="${goalId}"] .goal-program-support`)).toContainText('2 exposures per cycle · 6 working sets');
  await expect(page.locator('#goalsBackToday')).toHaveText('Back to Program');
  await page.locator(`[data-goal-view-program]`).click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'plan');
  await expect(page.locator('#planProgramDetail')).toBeVisible();
  await page.locator('#planProgramBack').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'goals');

  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after.programCapture).toEqual(before.programCapture);
  expect(after.goals).toEqual(before.goals);
  expect(after.activeWorkout).toEqual(before.activeWorkout);
  expect(after.workouts).toEqual(before.workouts);
});

test('Library remains a shortcut, setup uses plain-language staged review, shared picker, and trap-free Back behavior', async ({ page }) => {
  await page.evaluate(() => bigGainsViewShell.showView('library', { workout: false }));
  await expect(page.locator('#programSetupPanel')).toContainText('Plan shortcut');
  await page.locator('#openProgramSetup').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'plan');
  await expect(page.locator('#programSetupDialog')).toBeHidden();
  await page.locator('[data-plan-setup]').first().click();
  await expect(page.locator('#programSetupDialog')).toBeVisible();
  await expect(page.locator('#programSetupProgress span')).toHaveCount(8);
  expect(await page.evaluate(() => {
    const shell = document.querySelector('.program-setup-shell');
    const content = document.querySelector('#programSetupContent');
    return shell.scrollWidth <= shell.clientWidth && content.scrollWidth <= content.clientWidth;
  })).toBe(true);
  await expect(page.locator('#programSetupContent')).toContainText('Starting candidate → approved Routine version');
  await expect(page.locator('#programSetupContent')).toContainText('never rewrites History or an active workout');

  await page.getByLabel('Build or revise this session').check();
  await page.locator('[data-program-add]').click();
  await expect(page.locator('#programSetupDialog')).toBeHidden();
  await expect(page.locator('#exercisePickerDialog')).toBeVisible();
  await expect(page.locator('#exercisePickerResults')).toContainText('All exercises A–Z');
  await page.locator('#closeExercisePicker').click();
  await expect(page.locator('#exercisePickerDialog')).toBeHidden();
  await expect(page.locator('#programSetupDialog')).toBeVisible();
  await page.locator('#closeProgramSetup').click();
  await expect(page.locator('#programSetupDialog')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'plan');
});

test('draft Program status and activation boundary remain future-only with Train and History untouched', async ({ page }) => {
  const before = await readStoredJson(page, STORAGE_KEYS.jorge);
  await createProgramFixture(page, { active: false, withGoal: false, name: 'Draft Route' });
  await page.evaluate(() => BigGainsProgramSetup.openPlan());
  await expect(page.locator('#planOverview')).toContainText('Draft Route');
  await expect(page.locator('#planOverview')).toContainText('Draft');
  await page.locator('[data-plan-program]').click();
  await expect(page.locator('#planProgramDetail')).toContainText('Next unmaterialized session');
  const after = await readStoredJson(page, STORAGE_KEYS.jorge);
  expect(after.activeWorkout).toEqual(before.activeWorkout);
  expect(after.workouts).toEqual(before.workouts);
  expect(after.version).toBe(5);
});
