import {test,expect} from '@playwright/test';
import {blankState,completedWorkout,installLocalStorageFixture} from './fixtures/local-storage.js';
import {openApp,jorgeState} from './helpers/app.js';
import {createProgramFixture} from './helpers/program.js';

async function seed(page,{age=7,completed=true,history=false}={}){
  await installLocalStorageFixture(page,'blankJorge');
  await page.addInitScript(({blank,workout,age,completed,history})=>{
    if(localStorage.getItem('utility-seeded'))return;
    const current={...workout,id:'utility-active',startedAt:new Date(Date.now()-age*3600000).toISOString()};
    delete current.completedAt; delete current.durationSeconds;
    current.exercises[0].sets[0].completed=completed;
    current.exercises[0].sets.push({id:'next-set',weight:100,reps:10,completed:false,warmup:false});
    current.focusedExerciseId=current.exercises[0].id;
    const other={...workout.exercises[0],id:'barbell-bench-press',name:'Barbell Bench Press',equipment:'Barbell'};
    localStorage.setItem('big-gains-v2',JSON.stringify({...blank,activeWorkout:history?null:current,workouts:history?[{...workout,exercises:[...workout.exercises,other]}]:[]}));
    localStorage.setItem('utility-seeded','1');
  },{blank:blankState('jorge'),workout:completedWorkout(),age,completed,history});
  await openApp(page);
}

for(const [label,start,now,want] of [
  ['recent','2026-09-10T12:00:00','2026-09-10T12:30:00',false],
  ['below six hours','2026-09-10T06:00:00','2026-09-10T11:59:59',false],
  ['six hours','2026-09-10T06:00:00','2026-09-10T12:00:00',true],
  ['day rollover','2026-09-09T23:55:00','2026-09-10T00:05:00',true],
  ['invalid start','bad','2026-09-10T12:00:00',false],
  ['future start','2026-09-11T12:00:00','2026-09-10T12:00:00',false]
])test(`stale boundary: ${label}`,async({page})=>{
  await seed(page,{age:0});
  expect(await page.evaluate(({start,now})=>staleSessionCondition({startedAt:start},new Date(now).getTime()),{start,now})).toBe(want);
});

test('recent session has no recovery card',async({page})=>{
  await seed(page,{age:0});await expect(page.locator('#staleWorkoutRecovery')).toBeHidden();
});
test('old session prompts without automatic completion or backdated option',async({page})=>{
  await seed(page);await expect(page.locator('#staleWorkoutRecovery')).toBeVisible();
  await expect(page.locator('#staleWorkoutRecovery')).toContainText('full elapsed duration');
  await expect(page.getByRole('button',{name:'Finish at last completed set'})).toHaveCount(0);
  await page.reload();await expect(page.locator('#staleWorkoutRecovery')).toBeVisible();
  const saved=await jorgeState(page);expect(saved.activeWorkout.id).toBe('utility-active');expect(saved.workouts).toEqual([]);
});
test('Resume preserves session and bookmark, suppresses repeat card, never advances Program',async({page})=>{
  await seed(page);await page.evaluate(()=>bigGainsTrainPosition.capture(active.exercises[0].id,'next-set'));
  const before=await jorgeState(page);
  await page.locator('#staleWorkoutResume').click();
  await expect(page.locator('body')).toHaveAttribute('data-view','train');
  await expect(page.locator('#staleWorkoutRecovery')).toBeHidden();
  await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));renderStaleRecovery();});
  await expect(page.locator('#staleWorkoutRecovery')).toBeHidden();
  const after=await jorgeState(page);
  expect(after.activeWorkout.id).toBe(before.activeWorkout.id);
  expect(after.activeWorkout.exercises).toEqual(before.activeWorkout.exercises);
  const bookmark=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('big-gains-train-position-v1:')).map(key=>JSON.parse(localStorage.getItem(key)))).then(items=>items[0]);
  expect(bookmark.setId).toBe('next-set');
  expect(after.programCapture).toEqual(before.programCapture);expect(after.workouts).toEqual([]);
  expect(await page.evaluate(()=>document.activeElement?.tagName)).not.toBe('INPUT');
});

test('recovery card fits 390 by 844 without warning styling or overflow',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await seed(page);
  await expect(page.locator('#staleWorkoutRecovery')).toBeVisible();
  const box=await page.locator('#staleWorkoutRecovery').boundingBox();expect(box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('recovery.png')});
});
test('Finish now uses existing completion, exact elapsed duration and Records derivation',async({page})=>{
  await seed(page);await expect(page.locator('#staleWorkoutFinish')).toBeEnabled();
  const before=await jorgeState(page);const earliest=Date.now();
  await page.locator('#staleWorkoutFinish').click();
  const saved=await jorgeState(page);expect(saved.activeWorkout).toBeNull();expect(saved.workouts).toHaveLength(1);
  const workout=saved.workouts[0];expect(Date.parse(workout.completedAt)).toBeGreaterThanOrEqual(earliest);
  expect(workout.durationSeconds).toBe(Math.floor((Date.parse(workout.completedAt)-Date.parse(before.activeWorkout.startedAt))/1000));
  expect(workout.exercises[0].sets).toHaveLength(1);
  expect(saved.prs).toEqual(await page.evaluate(()=>BigGainsAnalytics.derivePerformanceRecords(state.workouts,analyticsOptions()).records));
  await expect(page.locator('#staleWorkoutRecovery')).toBeHidden();
});
test('Discard requires existing deliberate second tap and does not create History',async({page})=>{
  await seed(page);const before=await jorgeState(page);
  await page.locator('#staleWorkoutDiscard').click();
  await expect(page.locator('#staleWorkoutDiscard')).toHaveText('Tap again to discard');
  expect((await jorgeState(page)).activeWorkout).not.toBeNull();
  await page.locator('#staleWorkoutDiscard').click();
  const after=await jorgeState(page);expect(after.activeWorkout).toBeNull();expect(after.workouts).toEqual([]);expect(after.programCapture).toEqual(before.programCapture);
});
test('empty unfinished session offers Resume and Discard only',async({page})=>{
  await seed(page,{completed:false});await expect(page.locator('#staleWorkoutFinish')).toBeHidden();await expect(page.locator('#staleWorkoutResume')).toBeVisible();
});
test('offline detection and local Resume work',async({page,context})=>{
  await seed(page);await context.setOffline(true);await page.evaluate(()=>renderStaleRecovery());
  await expect(page.locator('#staleWorkoutRecovery')).toBeVisible();await page.locator('#staleWorkoutResume').click();
  expect((await jorgeState(page)).activeWorkout.id).toBe('utility-active');
});
for(const status of [{pending:1},{lastResult:{conflict:true}},{reconciliationInFlight:true}])test(`recovery fails closed ${JSON.stringify(status)}`,async({page})=>{
  await seed(page);const before=await jorgeState(page);
  await page.evaluate(status=>{window.BigGainsCloudSync={status:()=>status};renderStaleRecovery();},status);
  await expect(page.locator('#staleWorkoutFinish')).toBeDisabled();await expect(page.locator('#staleWorkoutDiscard')).toBeDisabled();
  await expect(page.locator('#staleWorkoutGuard')).toBeVisible();expect((await jorgeState(page)).workouts).toEqual(before.workouts);
  await page.locator('#staleWorkoutResume').click();
  await expect(page.locator('#cancelWorkout')).toBeDisabled();
  await expect(page.locator('#finishWorkout')).toBeDisabled();
  expect(await page.evaluate(()=>workoutSessionController.complete())).toBe(false);
  expect(await page.evaluate(()=>workoutSessionController.discard())).toBe(false);
  expect((await jorgeState(page)).activeWorkout.id).toBe(before.activeWorkout.id);
  await page.evaluate(()=>{window.BigGainsCloudSync={status:()=>({})};renderStaleRecovery();});
  await expect(page.locator('#finishWorkout')).toBeEnabled();await expect(page.locator('#cancelWorkout')).toBeEnabled();
});
for(const width of [375,390])test(`metrics selector exact variants, search, same surface and mobile ${width}`,async({page},info)=>{
  await page.setViewportSize({width,height:844});await seed(page,{history:true});const before=await jorgeState(page);
  await page.locator('[data-today-progress-exercise]').click();
  await expect(page.locator('#progressDialogTitle')).toHaveText('Barbell Bench Press');
  await page.locator('#chooseProgressMovement').click();
  await expect(page.locator('[data-metrics-choice]')).toHaveCount(2);
  await page.locator('#progressMovementSearch').fill('seated machine');await expect(page.locator('[data-metrics-choice]')).toHaveCount(1);
  await page.locator('[data-metrics-choice]').click();
  await expect(page.locator('#progressDialogTitle')).toHaveText('Seated Machine Chest Press');await expect(page.locator('#progressDialog')).toBeVisible();
  await expect(page.locator('#chooseProgressMovement')).toBeFocused();
  await page.locator('#chooseProgressMovement').press('Enter');
  await page.locator('#progressMovementSearch').fill('no such movement');await expect(page.locator('#progressMovementCount')).toHaveText('No matching logged movements.');
  await page.locator('#progressMovementSearch').press('Escape');await expect(page.locator('#progressMovementPicker')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath('metrics.png')});expect((await jorgeState(page)).workouts).toEqual(before.workouts);
});
test('profile with no completed History has no selectable movements',async({page})=>{
  await seed(page,{age:0});await page.evaluate(()=>document.querySelector('[data-progress-exercise="seated-machine-chest-press"]').click());
  await expect(page.locator('#progressDialogContent')).toContainText('No completed working sets');
  await page.locator('#chooseProgressMovement').click();await expect(page.locator('[data-metrics-choice]')).toHaveCount(0);
});

test('selector cannot inherit completed movements after switching profile',async({page})=>{
  await seed(page,{history:true});
  await page.locator('#profileSelect').selectOption('alexa');
  await expect(page.locator('#profileSelect')).toHaveValue('alexa');
  await expect(page.locator('[data-today-progress-exercise]')).toHaveCount(0);
  await page.evaluate(()=>document.querySelector('[data-progress-exercise]').click());
  await page.locator('#chooseProgressMovement').click();await expect(page.locator('[data-metrics-choice]')).toHaveCount(0);
});

test('explicit stale Finish advances a real Program once; Resume does not',async({page})=>{
  await seed(page,{age:0});await page.evaluate(()=>workoutSessionController.discard());
  await createProgramFixture(page,{withGoal:false});
  await page.evaluate(()=>{
    const materialization=BigGainsProgramOrigin.materializeNext({capture:state.programCapture,accountId:ACCOUNT.accountId,profileId:PROFILE.id,catalog:BigGainsExerciseCatalog,materializedAt:new Date().toISOString()});
    workoutSessionController.startProgram(materialization,{scroll:false});
    active.startedAt=new Date(Date.now()-7*3600000).toISOString();
    const set=active.exercises[0].sets.find(set=>!set.warmup);set.weight=100;set.reps=10;set.completed=true;saveState();renderStaleRecovery();
  });
  const before=(await jorgeState(page)).programCapture;
  await page.locator('#staleWorkoutResume').click();expect((await jorgeState(page)).programCapture).toEqual(before);
  await page.evaluate(()=>{staleResume=null;renderStaleRecovery();});
  await page.locator('#staleWorkoutFinish').click();
  const after=await jorgeState(page);expect(after.programCapture).not.toEqual(before);expect(after.workouts).toHaveLength(1);
});
