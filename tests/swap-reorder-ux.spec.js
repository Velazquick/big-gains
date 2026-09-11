import { test, expect } from '@playwright/test';
import { installLocalStorageFixture, STORAGE_KEYS, readStoredJson } from './fixtures/local-storage.js';
import { openApp } from './helpers/app.js';

async function start(page) {
  await installLocalStorageFixture(page,'blankJorge');
  await openApp(page);
  await page.locator('#quickStartSession').click();
  await page.evaluate(()=>{
    workoutSessionController.replace('Push',{loadRoutine:false,scroll:false});
    for(const id of ['dumbbell-lateral-raise','barbell-bench-press','hanging-knee-raise'])workoutSessionController.addExercise(id,{scroll:false});
    active.exercises.forEach((e,i)=>{e.displayUnitOverride=i===1?'kg':'lb';e.restSeconds=90+i;e.sets[0].weight=25+i;e.sets[0].reps=8;e.sets[0].completed=i===1;});
    saveState();renderActive();
    bigGainsTrainPosition.capture(active.exercises[0].id,active.exercises[0].sets[0].id);
  });
}
const order=page=>page.locator('#reorderList li').evaluateAll(rows=>rows.map(row=>row.dataset.reorderId));
for(const width of [375,390])test(`card Swap and accessible reorder preserve session at ${width}px`,async({page,context},info)=>{
  await page.setViewportSize({width,height:844});await start(page);
  const swap=page.getByRole('button',{name:'Swap Dumbbell Lateral Raise',exact:true});
  await expect(swap).toBeVisible();
  const bounds=await swap.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(await swap.locator('xpath=ancestor::div[contains(@class,"exercise-head")]').count()).toBeGreaterThan(0);
  await swap.click();await page.locator('[data-swap-exercise="0"]').click();
  await expect(page.locator('.exercise-picker-suggested [data-exercise-picker-select] h3')).toHaveText(['Cable Lateral Raise','Machine Lateral Raise']);
  await page.keyboard.press('Escape');
  const before=await readStoredJson(page,STORAGE_KEYS.jorge);
  const bookmark=await page.evaluate(()=>({record:JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key=>key.startsWith('big-gains-train-position-v1:'))))}));
  await page.locator('#reorderWorkout').click();
  const ids=await order(page);
  await context.setOffline(true);
  const first=page.getByRole('combobox',{name:'Move Dumbbell Lateral Raise to position'});
  await first.focus();await first.selectOption({value:'2'});
  await expect(first).toBeFocused();
  expect(await order(page)).toEqual([ids[1],ids[2],ids[0]]);
  await first.selectOption({value:'1'});
  expect(await order(page)).toEqual([ids[1],ids[0],ids[2]]);
  await expect(page.getByRole('status').filter({hasText:'Dumbbell Lateral Raise moved'})).toHaveText('Dumbbell Lateral Raise moved to position 2 of 3.');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.locator('#reorderDialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  await page.locator('#reorderDialog').screenshot({path:info.outputPath(`reorder-${width}.png`)});
  await page.locator('#closeReorder').click();
  const after=await readStoredJson(page,STORAGE_KEYS.jorge);
  const ordered=[before.activeWorkout.exercises[1],before.activeWorkout.exercises[0],before.activeWorkout.exercises[2]];
  expect(after.activeWorkout).toEqual({...before.activeWorkout,exercises:ordered});
  for(const key of ['customRoutines','programs','programCapture','goals','workouts','prs','restTimerEndsAt','timerPreferences'])expect(after[key]).toEqual(before[key]);
  const restored=await page.evaluate(()=>({record:JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key=>key.startsWith('big-gains-train-position-v1:'))))}));
  expect(restored.record.exerciseId).toBe(bookmark.record.exerciseId);expect(restored.record.setId).toBe(bookmark.record.setId);
  await context.setOffline(false);await page.reload();
  expect((await readStoredJson(page,STORAGE_KEYS.jorge)).activeWorkout.exercises).toEqual(ordered);
});

test('handle drag moves first to last and last to middle; row scrolling is not drag',async({page})=>{
  await page.setViewportSize({width:390,height:844});await start(page);await page.locator('#reorderWorkout').click();
  const ids=await order(page);
  async function drag(from,to){const a=await page.locator('.reorder-handle').nth(from).boundingBox(),b=await page.locator('#reorderList li').nth(to).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(a.x+a.width/2,b.y+b.height/2,{steps:12});await expect(page.locator('#reorderList li').nth(to)).toHaveClass(/is-drop-target/);await page.mouse.up();}
  await drag(0,2);expect(await order(page)).toEqual([ids[1],ids[2],ids[0]]);
  await drag(2,1);expect(await order(page)).toEqual([ids[1],ids[0],ids[2]]);
  expect(await page.locator('.reorder-handle').first().evaluate(e=>getComputedStyle(e).touchAction)).toBe('none');
  expect(await page.locator('#reorderList li').first().evaluate(e=>getComputedStyle(e).touchAction)).toBe('auto');
  await page.keyboard.press('Escape');await expect(page.locator('#reorderDialog')).not.toBeVisible();await expect(page.locator('#reorderWorkout')).toBeFocused();
});

test('Routine reorder is draft only until Save and cannot change active workout',async({page})=>{
  await start(page);const before=await readStoredJson(page,STORAGE_KEYS.jorge);
  await page.evaluate(()=>bigGainsViewShell.showView('library',{workout:false}));await page.locator('#editRoutine').click();await page.locator('#reorderRoutine').click();
  const ids=await order(page);await page.locator('#reorderList select').first().selectOption({value:String(ids.length-1)});await page.locator('#closeReorder').click();
  expect(await readStoredJson(page,STORAGE_KEYS.jorge)).toEqual(before);
  await page.locator('#cancelRoutineDialog').click();await page.locator('#editRoutine').click();await page.locator('#reorderRoutine').click();expect(await order(page)).toEqual(ids);
  await page.locator('#reorderList select').first().selectOption({value:String(ids.length-1)});await page.locator('#closeReorder').click();await page.locator('#saveRoutine').click();
  const after=await readStoredJson(page,STORAGE_KEYS.jorge);expect(after.customRoutines.Push.map(e=>e.exerciseId)).toEqual([...ids.slice(1),ids[0]]);expect(after.activeWorkout).toEqual(before.activeWorkout);
});
test('Program-backed reorder preserves provenance and a running timer; stale owner is rejected',async({page})=>{
  await start(page);
  await page.evaluate(()=>{
    const owner={accountId:ACCOUNT.accountId,profileId:PROFILE.id},createId=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
    const routine=BigGainsProgramModel.approveRoutine({capture:BigGainsProgramModel.blankCapture(),...owner,purposeKey:'reorder-fixture',label:'Reorder fixture',source:{kind:'reviewed_rebuild',routineType:'Push'},exercises:['dumbbell-lateral-raise','barbell-bench-press','hanging-knee-raise'].map(id=>({exerciseId:BigGainsExerciseCatalog.getById(id).canonicalId,workingSets:3,targetReps:'8–10',restSeconds:90})),catalog:BigGainsExerciseCatalog,createId,now});
    const program=BigGainsProgramModel.createProgramDraft({capture:routine.capture,...owner,purposeKey:'reorder-fixture',name:'Reorder fixture',slots:[{label:'Push',preferredCalendarAnchor:null,routineId:routine.version.routineId,routineVersionId:routine.version.routineVersionId}],blockReviewPolicy:{boundaryKind:'completed_cycles',boundaryValue:3},programmingAuthority:'review',priorityGoalIds:[],startsOn:'2026-09-10',createId,now});
    state.programCapture=BigGainsProgramModel.activateProgram({capture:program.capture,...owner,programVersionId:program.version.programVersionId,now});
    const materialization=BigGainsProgramOrigin.materializeNext({capture:state.programCapture,...owner,catalog:BigGainsExerciseCatalog,materializedAt:now()});
    workoutSessionController.discard();workoutSessionController.startProgram(materialization,{scroll:false});timerController.start(0);
  });
  const before=await readStoredJson(page,STORAGE_KEYS.jorge),timer=await page.evaluate(()=>timerController.getStatus());
  expect(before.activeWorkout.programOrigin).toBeTruthy();expect(timer.deadline).toBeTruthy();
  await page.locator('#reorderWorkout').click();await page.locator('#reorderList select').first().selectOption({value:'2'});await page.locator('#closeReorder').click();
  const after=await readStoredJson(page,STORAGE_KEYS.jorge);
  expect(after.programCapture).toEqual(before.programCapture);expect(after.activeWorkout.programOrigin).toEqual(before.activeWorkout.programOrigin);expect(after.restTimerEndsAt).toBe(before.restTimerEndsAt);
  expect((await page.evaluate(()=>timerController.getStatus())).identity).toEqual(timer.identity);
  await page.locator('#reorderWorkout').click();
  await page.evaluate(()=>workoutSessionController.replace('Pull',{loadRoutine:false,scroll:false}));
  await page.locator('#reorderList select').first().selectOption({value:'1'});
  expect((await readStoredJson(page,STORAGE_KEYS.jorge)).activeWorkout.exercises).toEqual([]);
});
test('long-list drag scrolls to the last position and pointer cancellation leaves order intact',async({page})=>{
  await page.setViewportSize({width:375,height:600});await start(page);
  await page.evaluate(()=>{for(const e of CATALOG_EXERCISES.slice(0,12))workoutSessionController.addExercise(e.id,{scroll:false});});
  await page.locator('#reorderWorkout').click();const ids=await order(page);
  const handle=await page.locator('.reorder-handle').first().boundingBox(),list=await page.locator('#reorderList').boundingBox();
  await page.mouse.move(handle.x+22,handle.y+22);await page.mouse.down();await page.mouse.move(handle.x+22,list.y+list.height+5);
  await expect(page.locator('#reorderList li').last()).toHaveClass(/is-drop-target/,{timeout:10000});await page.mouse.up();
  expect(await order(page)).toEqual([...ids.slice(1),ids[0]]);
  await page.locator('.reorder-handle').last().scrollIntoViewIfNeeded();
  const last=await page.locator('.reorder-handle').last().boundingBox();await page.mouse.move(last.x+22,last.y+22);await page.mouse.down();
  await expect(page.locator('#reorderList li').last()).toHaveClass(/is-dragging/);
  await page.locator('#reorderList').dispatchEvent('pointercancel',{pointerId:1});await page.mouse.up();
  await expect(page.locator('.is-dragging')).toHaveCount(0);
  expect(await order(page)).toEqual([...ids.slice(1),ids[0]]);
});
