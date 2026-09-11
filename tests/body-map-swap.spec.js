import { expect, test } from '@playwright/test';
import { blankState, installLocalStorageFixture, STORAGE_KEYS, readStoredJson } from './fixtures/local-storage.js';
import { openApp, openExerciseOptions } from './helpers/app.js';

const NOW = '2026-09-10T12:00:00.000Z';
const DAY = 86400000;
const sets = n => Array.from({length:n}, (_,i)=>({id:`set-${i}`,weight:15,reps:10,completed:true,warmup:false}));
const ex = (id,name,muscle,n) => ({id,name,muscle,equipment:'Test',sets:sets(n)});
function historyState() {
  const workout=(id,age,exercises)=>({id,type:'Push',startedAt:NOW,completedAt:new Date(Date.parse(NOW)-age*DAY).toISOString(),exercises});
  return {...blankState('jorge'),workouts:[
    workout('recent',1,[ex('dumbbell-lateral-raise','Dumbbell Lateral Raise','Shoulders',5),ex('cable-lateral-raise','Cable Lateral Raise','Shoulders',2)]),
    workout('seven-boundary',7,[ex('dumbbell-lateral-raise','Dumbbell Lateral Raise','Shoulders',3)]),
    workout('thirty-boundary',30,[ex('dumbbell-lateral-raise','Dumbbell Lateral Raise','Shoulders',100)]),
    workout('future',-1,[ex('dumbbell-lateral-raise','Dumbbell Lateral Raise','Shoulders',100)]),
    {...workout('unfinished',0,[ex('dumbbell-lateral-raise','Dumbbell Lateral Raise','Shoulders',100)]),completedAt:null},
    workout('excluded-sets',2,[{...ex('dumbbell-lateral-raise','Dumbbell Lateral Raise','Shoulders',0),sets:[{id:'warm',weight:20,reps:10,completed:true,warmup:true},{id:'entered',weight:20,reps:10,completed:false}]}])
  ]};
}
async function seed(page,state=historyState()) {
  await installLocalStorageFixture(page,'blankJorge',{now:NOW});
  await page.addInitScript(({key,state})=>{if(!sessionStorage.getItem('bodymap-seed')) {localStorage.setItem(key,JSON.stringify(state));sessionStorage.setItem('bodymap-seed','1');}}, {key:STORAGE_KEYS.jorge,state});
  await openApp(page);
}
async function progress(page) {await page.evaluate(()=>bigGainsViewShell.showView('progress',{workout:false}));}

for (const profile of ['jorge','alexa']) test(`Body Map ${profile}: six live Appearance accents, readable counts and mobile layout`,async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await seed(page);
  if(profile==='alexa') {
    await page.evaluate(({key,active,state})=>{localStorage.setItem(key,JSON.stringify(state));localStorage.setItem(active,'alexa');},{key:STORAGE_KEYS.alexa,active:STORAGE_KEYS.activeProfile,state:{...historyState(),profileId:'alexa',goals:blankState('alexa').goals}});
    await page.reload();
  }
  await progress(page);
  const fills=[];
  for(const accent of ['volt','cobalt','merlot','rose','violet','ember']) {
    await page.evaluate(a=>BigGainsAppearance.select(a),accent);
    await page.locator('.muscle-region-list [data-muscle-key="Shoulders"]').click();
    fills.push(await page.locator('g[data-muscle-key="Shoulders"] path').first().evaluate(e=>getComputedStyle(e).fill));
    await expect(page.locator('#progressMuscleDetail .muscle-detail-head>strong')).toHaveText('7 sets');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.locator('.body-map-v2').screenshot({path:info.outputPath(`${profile}-${accent}-front.png`),style:'.bottom-nav{visibility:hidden!important}'});
  }
  expect(new Set(fills).size).toBe(6);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.locator('.body-map-v2').screenshot({path:info.outputPath(`${profile}-back.png`),style:'.bottom-nav{visibility:hidden!important}'});
});

test('Body Map owns exact completed windows, primary sets, canonical contributors and drill-in without changing History',async({page})=>{
  await seed(page); await progress(page);
  const before=(await readStoredJson(page,STORAGE_KEYS.jorge)).workouts;
  await expect(page.locator('#progressPanel .body-map-v2')).toBeVisible();
  await expect(page.locator('#viewTrain .body-map-v2')).toHaveCount(0);
  await page.locator('.muscle-region-list [data-muscle-key="Shoulders"]').click();
  await expect(page.locator('#progressMuscleDetail .muscle-detail-head>strong')).toHaveText('7 sets');
  await expect(page.locator('g[data-muscle-key="Shoulders"]')).toHaveClass(/heat-2/);
  await expect(page.locator('#progressMuscleDetail [data-progress-exercise]')).toHaveCount(2);
  await expect(page.locator('#progressMuscleDetail')).toContainText('Last trained');
  await page.locator('#progressMuscleDetail [data-progress-exercise="cable-lateral-raise"]').click();
  await expect(page.locator('#progressDialogTitle')).toHaveText('Cable Lateral Raise');
  await page.locator('#closeProgressDialog').click();
  await page.locator('[data-progress-window="30"]').click();
  await page.locator('.muscle-region-list [data-muscle-key="Shoulders"]').click();
  await expect(page.locator('#progressMuscleDetail .muscle-detail-head>strong')).toHaveText('10 sets');
  await expect(page.locator('g[data-muscle-key="Shoulders"]')).toHaveClass(/heat-3/);
  expect((await readStoredJson(page,STORAGE_KEYS.jorge)).workouts).toEqual(before);
});

test('front/back regions, keyboard selection, accessible alternatives and neutral no-history state',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await seed(page,blankState('jorge')); await progress(page);
  await expect(page.locator('.muscle-zone')).toHaveCount(6);
  await expect(page.locator('.muscle-zone:not(.heat-0)')).toHaveCount(0);
  await expect(page.locator('g[data-muscle-key="Chest"]')).toHaveCount(1);
  await page.locator('g[data-muscle-key="Chest"]').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('g[data-muscle-key="Chest"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('g[data-muscle-key="Chest"]')).toBeFocused();
  await expect(page.locator('#progressMuscleDetail h3')).toHaveText('Chest');
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.locator('g[data-muscle-key="Chest"]')).toHaveCount(0);
  await expect(page.locator('g[data-muscle-key="RearShoulders"]')).toHaveCount(1);
  await expect(page.locator('g[data-muscle-key="Hamstrings"]')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Back',exact:true})).toHaveAttribute('aria-pressed','true');
  const size=await page.locator('.muscle-region-list button').evaluateAll(es=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  expect(size.every(r=>r.w>=44&&r.h>=44)).toBe(true);
  await page.evaluate(()=>document.documentElement.style.fontSize='24px');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>document.body.style.fontFamily='Verdana, sans-serif');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Body Map cannot disclose contributors from a different profile',async({page})=>{
  await seed(page); await progress(page);
  await page.evaluate(({active,alexa,state})=>{localStorage.setItem(active,'alexa');localStorage.setItem(alexa,JSON.stringify(state));},{active:STORAGE_KEYS.activeProfile,alexa:STORAGE_KEYS.alexa,state:blankState('alexa')});
  await page.reload(); await progress(page);
  await page.locator('.muscle-region-list [data-muscle-key="Shoulders"]').click();
  await expect(page.locator('#progressMuscleDetail')).toContainText('0 sets');
  await expect(page.locator('#progressMuscleDetail [data-progress-exercise]')).toHaveCount(0);
});

test('deterministic equivalent families exclude unrelated delts, current ID, owner exclusions and incompatible measurement',async({page})=>{
  await seed(page,blankState('jorge'));
  const result=await page.evaluate(()=>{
    const c=BigGainsExerciseCatalog,p=BigGainsExercisePicker;
    const options={catalog:c,currentExerciseId:'dumbbell-lateral-raise'};
    return {a:p.closestAlternatives(options).map(e=>e.id),b:p.closestAlternatives({...options,exercises:[...c.exercises].reverse()}).map(e=>e.id),filtered:p.closestAlternatives({...options,excludedExerciseIds:['cable-lateral-raise'],eligibilityPredicate:e=>e.equipment!=='Machine'}).map(e=>e.id),incompatible:p.closestAlternatives({...options,exercises:[{...c.getById('cable-lateral-raise'),measurement:{trackingModel:'duration'}}]}).map(e=>e.id)};
  });
  expect(result.a).toEqual(['cable-lateral-raise','machine-lateral-raise']);expect(result.b).toEqual(result.a);expect(result.filtered).toEqual([]);expect(result.incompatible).toEqual([]);
});

test('Hanging Knee Raise is discoverable from Push in Library and picker, distinct from Hanging Leg Raise',async({page})=>{
  await seed(page,blankState('jorge'));
  await page.evaluate(()=>bigGainsViewShell.showView('library',{workout:false}));
  await page.locator('#dayTabs [data-day="Push"]').click();
  await page.locator('#exerciseSearch').fill('hanging knee raise');
  await expect(page.locator('#exerciseLibrary h3')).toHaveText('Hanging Knee Raise');
  await page.locator('#addSelectedExercise').click(); await page.locator('#exercisePickerSearch').fill('hanging knee raise');
  await expect(page.locator('.exercise-picker-all [data-exercise-picker-select] h3')).toHaveText('Hanging Knee Raise');
  const metadata=await page.evaluate(()=>{const c=BigGainsExerciseCatalog;return {knee:c.getById('hanging-knee-raise'),leg:c.getById('hanging-leg-raise')};});
  expect(metadata.knee.canonicalId).not.toBe(metadata.leg.canonicalId);
  expect(metadata.knee.measurement.trackingModel).toBe('reps_only');expect(metadata.knee.muscleRoles.primary).toEqual(['Core']);expect(metadata.knee.equipment).toBe('Bodyweight');
});

async function startSwap(page) {
  await seed(page,blankState('jorge'));
  await page.locator('#quickStartSession').click();
  await expect(page.locator('body')).toHaveAttribute('data-view','train');
  await page.evaluate(()=>{workoutSessionController.replace('Push',{loadRoutine:false,scroll:false});workoutSessionController.addExercise('dumbbell-lateral-raise',{scroll:false});});
  await openExerciseOptions(page,'Dumbbell Lateral Raise');
}

test('active swap preserves source data, units and rest; persists offline and survives reload',async({page,context})=>{
  await startSwap(page);
  await page.locator('[data-exercise-unit="kg"][data-ei="0"]').click();
  await expect(page.locator('[data-exercise-unit="kg"][data-ei="0"]')).toHaveAttribute('aria-pressed','true');
  await page.reload();await openExerciseOptions(page,'Dumbbell Lateral Raise');
  const before=await readStoredJson(page,STORAGE_KEYS.jorge);
  expect(before.activeWorkout.exercises[0].displayUnitOverride).toBe('kg');
  await context.setOffline(true);
  await page.locator('[data-swap-exercise="0"]').click();
  // Existing blank warm-up templates count as entered data under the accepted safeguard.
  if(!await page.locator('#exercisePickerDialog').isVisible()) await page.locator('[data-swap-exercise="0"]').click();
  await expect(page.locator('#exercisePickerSearch')).toBeHidden();
  await expect(page.locator('#exercisePickerDialog')).toHaveClass(/is-compact/);
  expect(await page.locator('#exercisePickerDialog').evaluate(e=>e.getBoundingClientRect().height/innerHeight)).toBeLessThanOrEqual(.86);
  await expect(page.locator('.exercise-picker-suggested [data-exercise-picker-select] h3')).toHaveText(['Cable Lateral Raise','Machine Lateral Raise']);
  await page.locator('.exercise-picker-suggested [data-exercise-picker-select]',{hasText:'Cable Lateral Raise'}).click();
  const after=await readStoredJson(page,STORAGE_KEYS.jorge);
  expect(after.activeWorkout.exercises[0].id).toBe('cable-lateral-raise');expect(after.activeWorkout.exercises[0].displayUnitOverride).toBe('kg');
  expect(after.activeWorkout.programOrigin).toEqual(before.activeWorkout.programOrigin);
  expect(after.activeWorkout.exercises[0].sets.every(s=>!s.completed&&Number(s.weight)===0)).toBe(true);
  for(const key of ['customRoutines','programs','programCapture','goals','workouts','prs','restTimerEndsAt','timerPreferences'])expect(after[key]).toEqual(before[key]);
  await context.setOffline(false);await page.reload();
  expect((await readStoredJson(page,STORAGE_KEYS.jorge)).activeWorkout.exercises[0].id).toBe('cable-lateral-raise');
});

test('real Program materialization retains pinned versions, prescription and provenance after active swap',async({page})=>{
  await seed(page,blankState('jorge'));
  const before=await page.evaluate(()=>{
    const owner={accountId:ACCOUNT.accountId,profileId:PROFILE.id},createId=()=>crypto.randomUUID(),now=()=>new Date().toISOString();
    const routine=BigGainsProgramModel.approveRoutine({capture:BigGainsProgramModel.blankCapture(),...owner,purposeKey:'swap-fixture',label:'Swap fixture',source:{kind:'reviewed_rebuild',routineType:'Push'},exercises:[{exerciseId:BigGainsExerciseCatalog.getById('dumbbell-lateral-raise').canonicalId,workingSets:3,targetReps:'8–10',restSeconds:90}],catalog:BigGainsExerciseCatalog,createId,now});
    const program=BigGainsProgramModel.createProgramDraft({capture:routine.capture,...owner,purposeKey:'swap-fixture',name:'Swap fixture',slots:[{label:'Push',preferredCalendarAnchor:null,routineId:routine.version.routineId,routineVersionId:routine.version.routineVersionId}],blockReviewPolicy:{boundaryKind:'completed_cycles',boundaryValue:3},programmingAuthority:'review',priorityGoalIds:[],startsOn:'2026-09-10',createId,now});
    state.programCapture=BigGainsProgramModel.activateProgram({capture:program.capture,...owner,programVersionId:program.version.programVersionId,now});
    const materialization=BigGainsProgramOrigin.materializeNext({capture:state.programCapture,...owner,catalog:BigGainsExerciseCatalog,materializedAt:now()});
    workoutSessionController.startProgram(materialization,{scroll:false});
    return structuredClone({capture:state.programCapture,origin:active.programOrigin,goals:state.goals,sessionId:active.id,exercise:active.exercises[0]});
  });
  expect(before.origin).toBeTruthy();
  const result=await page.evaluate(()=>workoutSessionController.swapExercise(0,'machine-lateral-raise',{confirmed:true}));
  expect(result.swapped).toBe(true);
  const after=await readStoredJson(page,STORAGE_KEYS.jorge);
  expect(after.programCapture).toEqual(before.capture);expect(after.activeWorkout.programOrigin).toEqual(before.origin);expect(after.goals).toEqual(before.goals);expect(after.activeWorkout.id).toBe(before.sessionId);
  expect(after.activeWorkout.exercises[0]).toMatchObject({id:'machine-lateral-raise',targetWorkingSets:3});
  expect(after.activeWorkout.exercises[0].targetReps).toEqual(before.exercise.targetReps);
});

test('empty sets swap without confirmation and duplicate canonical variants remain excluded',async({page})=>{
  await startSwap(page);
  const result=await page.evaluate(()=>{
    active.exercises[0].sets.forEach(s=>{s.weight=0;s.reps='';});
    const needsConfirmation=workoutSessionController.requiresExerciseSwapConfirmation(0);
    const first=workoutSessionController.swapExercise(0,'cable-lateral-raise');
    workoutSessionController.addExercise('machine-lateral-raise',{scroll:false});
    const duplicate=workoutSessionController.swapExercise(0,BigGainsExerciseCatalog.getById('machine-lateral-raise').canonicalId,{confirmed:true});
    return {needsConfirmation,first,duplicate};
  });
  expect(result.needsConfirmation).toBe(false);expect(result.first.swapped).toBe(true);expect(result.duplicate).toMatchObject({swapped:false,duplicate:true});
});

test('swap safeguards entered/completed sets and rejects stale slot callbacks; Cancel restores position',async({page})=>{
  await startSwap(page);
  await page.evaluate(()=>{workoutSessionController.updateSet(0,1,'weight','25');workoutSessionController.updateSet(0,1,'reps','10');workoutSessionController.toggleSetCompleted(0,1);});
  const before=await readStoredJson(page,STORAGE_KEYS.jorge);
  const blocked=await page.evaluate(()=>workoutSessionController.swapExercise(0,'cable-lateral-raise'));
  expect(blocked).toMatchObject({swapped:false,confirmationRequired:true});
  await openExerciseOptions(page,'Dumbbell Lateral Raise');
  await page.locator('[data-swap-exercise="0"]').click();
  await expect(page.locator('#exercisePickerDialog')).not.toBeVisible();
  await page.locator('[data-swap-exercise="0"]').click();
  await expect(page.locator('#exercisePickerDialog')).toBeVisible();
  await page.locator('[data-exercise-picker-browse]').click();
  await expect(page.locator('#exercisePickerDialog')).not.toHaveClass(/is-compact/);
  await expect(page.locator('#exercisePickerSearch')).toBeVisible();
  await page.locator('#closeExercisePicker').click();
  await expect(page.locator('[data-swap-exercise="0"]')).toBeFocused();
  expect((await readStoredJson(page,STORAGE_KEYS.jorge)).activeWorkout).toEqual(before.activeWorkout);
  await page.locator('[data-swap-exercise="0"]').click();await page.locator('[data-swap-exercise="0"]').click();
  await page.evaluate(()=>workoutSessionController.updateSet(0,1,'weight','30'));
  await page.locator('.exercise-picker-suggested [data-exercise-picker-select]').first().click();
  expect((await readStoredJson(page,STORAGE_KEYS.jorge)).activeWorkout.exercises[0].id).toBe('dumbbell-lateral-raise');
});

test('Routine swap stays in draft until Save and cannot change active workout',async({page})=>{
  await startSwap(page);
  await page.evaluate(()=>bigGainsViewShell.showView('library',{workout:false}));
  await page.locator('#dayTabs [data-day="Push"]').click();await page.locator('#editRoutine').click();
  const before=await readStoredJson(page,STORAGE_KEYS.jorge);
  await page.locator('[data-routine-choose]').first().click();
  await page.locator('[data-exercise-picker-browse]').click();await page.locator('#exercisePickerSearch').fill('hanging knee raise');
  await page.locator('.exercise-picker-all [data-exercise-picker-select]').click();
  await expect(page.locator('[data-routine-index]').first()).toContainText('Hanging Knee Raise');
  const draft=await readStoredJson(page,STORAGE_KEYS.jorge);expect(draft.customRoutines).toEqual(before.customRoutines);expect(draft.activeWorkout).toEqual(before.activeWorkout);
  await page.locator('#saveRoutine').click();
  const saved=await readStoredJson(page,STORAGE_KEYS.jorge);expect(saved.customRoutines).not.toEqual(before.customRoutines);expect(saved.activeWorkout).toEqual(before.activeWorkout);
});
