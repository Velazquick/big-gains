const DEFAULT_REST=150;
const workoutControlsApi=window.workoutControls;
const notesApi=window.workoutNotes;
const progressApi=window.workoutProgress;
const analyticsApi=window.BigGainsAnalytics;
const WEEK_PLAN=PROFILE.weekPlan;
const exerciseCatalog=window.BigGainsExerciseCatalog;
const CATALOG_EXERCISES=exerciseCatalog.exercises;
const $=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const routineVariantSelections={};
let state;
const routineEngine=BigGainsRoutineEngine.create({profile:PROFILE,exerciseCatalog,getState:()=>state,getVariantSelections:()=>routineVariantSelections});
window.workoutRoutineEngine=routineEngine;
const DEFAULT_ROUTINES=routineEngine.defaultRoutines;
const LIBRARY_ROUTINE_TYPES=routineEngine.libraryRoutineTypes;
const statePersistenceApi=bigGainsStatePersistence.create({account:ACCOUNT,profile:PROFILE,profileConfig:PROFILE_CONFIG,validWorkoutTypes:Object.keys(DEFAULT_ROUTINES),createId:uid,slug:exerciseCatalog.idForName});
state=statePersistenceApi.load();
if(bigGainsAccounts.runtime.kind==='independent'&&bigGainsAccounts.runtime.newlyProvisioned&&!statePersistenceApi.hasStoredState()){
  statePersistenceApi.save(state,null);
  bigGainsAccounts.completeIndependentBootstrap(bigGainsAccounts.runtime.authUserId);
}
let selectedDay=(state.activeWorkout&&state.activeWorkout.type)||(todaysWorkout()==='Rest'?PROFILE.capabilities.restFallbackWorkout:todaysWorkout());
let active=state.activeWorkout||null;
let workoutTicker=null,deferredPrompt=null,cancelArmedUntil=0;
let routineDraftDay=selectedDay,routineDraft=[];
let completionReceipt=null;
const localDateKey=value=>{const date=value instanceof Date?value:new Date(value);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
const calendarSavedKey=bigGainsAccounts.registry.sessionKey(ACCOUNT,'calendar-date');
let calendarSelectedKey=(()=>{try{return sessionStorage.getItem(calendarSavedKey);}catch{return null;}})()||localDateKey(new Date());
let calendarMonth=(()=>{const [year,month]=calendarSelectedKey.split('-').map(Number);return new Date(year,month-1,1);})();
const retrospectiveApi=window.bigGainsRetrospective.create({
  profile:PROFILE,routineEngine,exercises:CATALOG_EXERCISES,createId:uid,slug:exerciseCatalog.idForName,escapeHtml,
  localDateKey,lastPerformance,estimate1RM,workoutLabel:completionWorkoutLabel,
  canCompleteSet:isCompletableSet,
  getState:()=>state,getSelectedDateKey:()=>calendarSelectedKey,saveState,
  afterSave:(dateKey,workoutId)=>{calendarSelectedKey=dateKey;calendarMonth=new Date(`${dateKey}T12:00:00`);try{sessionStorage.setItem(calendarSavedKey,dateKey);}catch{}renderAll();document.dispatchEvent(new CustomEvent('big-gains-workout-saved',{detail:{workoutId,entryMethod:'retrospective'}}));window.bigGainsViewShell?.showView('calendar',{workout:false});}
});
function setWorkoutPetState(next){if(next)document.body.dataset.workoutPetState=next;else delete document.body.dataset.workoutPetState;if(typeof window.trainingPet?.render==='function')window.trainingPet.render(true);}
function saveState(){if(bigGainsAccounts.runtime.kind==='managed-member'&&!statePersistenceApi.hasStoredState())return;if(window.BigGainsManagedProfileRecovery?.suppressingLocalSave(state,active))return;statePersistenceApi.save(state,active);queueMicrotask(()=>window.BigGainsCloudSync?.captureLocalSnapshot(PROFILE.id));}
const timerController=BigGainsTimerController.create({
  getState:()=>state,
  getActiveWorkout:()=>active,
  persist:()=>saveState(),
  resolveRestDuration:options=>notesApi.resolveRestDuration(options),
  setPetState:setWorkoutPetState,
  getElement:$,
  formatTime:fmtTime,
  defaultRest:DEFAULT_REST
});
window.workoutTimerController=timerController;
window.workoutTimerFeedback=timerController.feedback;
function autosave(){saveState();renderHero();}
function todaysWorkout(){return WEEK_PLAN[new Date().getDay()];}
function routineFor(day){return routineEngine.getRoutine(day);}
function routinePrescription(day,exerciseId){return routineEngine.getPrescription(day,exerciseId);}
function selectRoutineVariant(day,exerciseId){const selection=routineEngine.resolveVariantSelection(day,exerciseId);if(!selection)return false;routineVariantSelections[day]=selection;return true;}
function fmtDate(iso){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso));}
function fmtDateLong(iso){return new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(iso));}
function fmtTime(seconds){seconds=Math.max(0,Math.floor(seconds));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function startOfWeek(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-d.getDay());return d;}
function volumeForWorkout(w){return analyticsApi.workoutSummary(w).workingSetVolume;}
function volumeForExercise(e){return analyticsApi.setSummary(e).workingSetVolume;}
function estimate1RM(w,r){return analyticsApi.estimate1RM(w,r);}
function isCompletableSet(exercise,set){const reps=Number(set?.reps),weight=Number(set?.weight);if(!Number.isFinite(reps)||reps<=0||!Number.isFinite(weight))return false;return exercise?.equipment==='Bodyweight'?weight>=0:weight>0;}
function displayWorkout(day){return day==='Legs'?'Legs + Core':(DEFAULT_ROUTINES[day]?.label||day);}
function completionWorkoutLabel(day){return PROFILE.routines?.[day]?.label||({Legs:'Legs + Core',FullBody:'Full Body',Cardio:'Conditioning',PilatesPull:'Pilates + Pull',LegsLowImpact:'Legs + Low-Impact Class',PilatesCardioAccessory:'Pilates + Cardio + Accessories',Optional:'Optional Movement'})[day]||day;}
function renderGreeting(){const h=new Date().getHours(),selector=$('profileSelect'),switcher=selector?.closest('.profile-switcher');$('greeting').textContent=bigGainsAccounts.runtime.kind==='guest'?'Welcome to Big Gains.':`Good ${h<12?'morning':h<18?'afternoon':'evening'}, ${ACCOUNT.displayName}.`;if(selector){selector.innerHTML=bigGainsAccounts.registry.accounts.map(account=>`<option value="${escapeHtml(account.profileId)}">${escapeHtml(account.displayName)}</option>`).join('');selector.value=PROFILE.id;}if(switcher)switcher.hidden=!bigGainsAccounts.runtime.switcherVisible;const today=todaysWorkout();$('nextWorkout').textContent=displayWorkout(today);document.body.classList.toggle('alexa-mode',PROFILE.capabilities.wellnessPresentation);document.querySelectorAll('[data-profile-only]').forEach(el=>el.hidden=el.dataset.profileOnly!==PROFILE.id);}
function renderHero(){const button=$('startWorkout'),note=$('heroNote'),today=todaysWorkout(),wellness=PROFILE.capabilities.wellnessPresentation;if(active){button.disabled=false;button.textContent=`Resume ${displayWorkout(active.type)}`;note.textContent=`Workout in progress · ${active.exercises.length} exercises saved`;return;}if(today==='Rest'){button.disabled=true;button.textContent='Recovery day';note.textContent=wellness?'Rest is part of your plan. Your garden is still safe.':'Recovery supports the work.';return;}button.disabled=false;button.textContent=wellness?'Begin today’s movement':'Start planned workout';note.textContent=wellness?'A gentle plan is ready whenever you are.':'Your plan is ready. Tap once and train.';}
function renderStats(){$('weeklyWorkouts').textContent=state.workouts.filter(w=>new Date(w.completedAt)>=startOfWeek()).length;$('trainingVolume').textContent=`${Math.round(state.workouts.reduce((n,w)=>n+volumeForWorkout(w),0)).toLocaleString('en-US')} lb`;$('prCount').textContent=Object.keys(state.prs||{}).length;$('latestWeight').textContent=state.weights[0]?`${state.weights[0].weight} lb`:'—';}
function renderSelectors(){const tabs=$('dayTabs');tabs.innerHTML=LIBRARY_ROUTINE_TYPES.map(type=>`<button data-day="${escapeHtml(type)}" type="button" class="${type===selectedDay?'active':''}">${escapeHtml(DEFAULT_ROUTINES[type]?.label||type)}</button>`).join('');const custom=state.customRoutines&&state.customRoutines[selectedDay],variant=!custom&&routineEngine.getVariant(selectedDay),select=$('routineSelect');if(variant){select.dataset.variantFor=selectedDay;select.innerHTML=variant.choices.map(choice=>`<option value="${choice.id}" ${choice.id===variant.selectedId?'selected':''}>${escapeHtml(DEFAULT_ROUTINES[selectedDay].label)} · ${escapeHtml(choice.name)}</option>`).join('');}else{delete select.dataset.variantFor;select.innerHTML=`<option value="${selectedDay}">${escapeHtml(routineEngine.getLabel(selectedDay))}</option>`;}const routineIds=new Set(routineFor(selectedDay)),list=CATALOG_EXERCISES.filter(e=>PROFILE.capabilities.allExercises||e.day===selectedDay||selectedDay==='Other'||routineIds.has(e.id));$('quickExerciseSelect').innerHTML=list.map(e=>`<option value="${e.id}">${escapeHtml(e.name)} — ${escapeHtml(e.equipment)}</option>`).join('');}
function renderEquipment(){if($('equipmentFilter').options.length>1)return;[...new Set(CATALOG_EXERCISES.map(e=>e.equipment))].sort().forEach(eq=>$('equipmentFilter').add(new Option(eq,eq)));}
function renderLibrary(){renderSelectors();const q=$('exerciseSearch').value,eq=$('equipmentFilter').value,knownRoutine=new Set(routineFor(selectedDay));const list=CATALOG_EXERCISES.filter(e=>(PROFILE.capabilities.allExercises||e.day===selectedDay||selectedDay==='Other'||knownRoutine.has(e.id))&&exerciseCatalog.matchesSearch(e,q)&&(eq==='all'||e.equipment===eq));$('exerciseLibrary').innerHTML=list.length?list.map(e=>`<article class="exercise-card ${active&&active.exercises.some(x=>x.id===e.id)?'added':''}"><div><span class="exercise-muscle">${escapeHtml(e.muscle)}</span><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.equipment)}</p></div><button type="button" class="add-exercise primary compact" data-add="${e.id}">${active&&active.exercises.some(x=>x.id===e.id)?'Added':'Add'}</button></article>`).join(''):'<div class="no-results">No matching exercises.</div>';progressApi.afterLibraryRender();}
function lastPerformance(exerciseId){return analyticsApi.previousPerformance(state.workouts,exerciseId);}
function makeExercise(ex,prescription=null){const last=lastPerformance(ex.id),prior=last?last.workingSets:[],working=prior[0]?Number(prior[0].weight)||0:0,warm=working?Math.round(working*.6/5)*5:0,workingSets=Number(prescription?.workingSets)||3,targetReps=typeof prescription?.targetReps==='string'?prescription.targetReps:'';return {id:ex.id,name:ex.name,muscle:ex.muscle,equipment:ex.equipment,collapsed:true,...(prescription?{targetWorkingSets:workingSets,...(targetReps?{targetReps}:{})}:{}),sets:[{id:uid(),weight:warm,reps:10,warmup:true,completed:false},...Array.from({length:workingSets},(_,i)=>({id:uid(),weight:prior[i]?Number(prior[i].weight)||working:working,reps:prior[i]?Number(prior[i].reps)||'':'',warmup:false,completed:false}))]};}
function renderActiveSession(scroll=true){if(!active)return;selectedDay=active.type;$('activePanel').classList.remove('hidden');$('cancelWorkout').classList.remove('hidden');$('cancelWorkout').textContent='Cancel';$('activeWorkoutTitle').textContent=displayWorkout(active.type);if($('activeWorkoutMeta'))$('activeWorkoutMeta').textContent=`${active.exercises.length} movement${active.exercises.length===1?'':'s'} · In progress`;clearInterval(workoutTicker);workoutTicker=setInterval(renderWorkoutClock,1000);renderWorkoutClock();renderActive();renderLibrary();timerController.renderPreferences();timerController.reconcile();if(scroll)$('activePanel').scrollIntoView({behavior:'smooth',block:'start'});}
function renderCompletion(workout){
  if(!workout)return false;
  completionReceipt={workoutId:workout.id,workout};
  const summary=analyticsApi.workoutSummary(workout);
  const type=completionWorkoutLabel(workout.type);
  $('workoutCompletionTitle').textContent=`${type} complete`;
  $('completionWorkoutType').textContent=type;
  $('completionDuration').textContent=fmtTime(summary.durationSeconds);
  $('completionExercises').textContent=String((workout.exercises||[]).length);
  $('completionWorkingSets').textContent=String(summary.workingSetCount);
  $('completionVolume').textContent=`${Math.round(summary.workingSetVolume).toLocaleString('en-US')} lb`;
  $('completionPrCount').textContent=String(summary.prCount);
  $('completionPrCopy').textContent=summary.prCount?`${summary.prCount} new PR${summary.prCount===1?'':'s'}.`:'';
  $('completionPrCopy').hidden=!summary.prCount;
  document.body.classList.add('workout-completion-open');
  document.body.dataset.workoutCompletionPetState=summary.prCount?'pr':'complete';
  $('workoutCompletion').classList.remove('hidden');
  window.bigGainsViewShell?.showView('today',{instant:true,scroll:false,workout:false});
  $('completionPetSlot').appendChild($('trainingPetCard'));
  window.trainingPet?.render(true);
  requestAnimationFrame(()=>$('workoutCompletionTitle').focus({preventScroll:true}));
  return true;
}
function dismissCompletion(){
  if(!completionReceipt)return false;
  completionReceipt=null;
  document.body.classList.remove('workout-completion-open');
  delete document.body.dataset.workoutCompletionPetState;
  $('workoutCompletion').classList.add('hidden');
  $('trainingPetHome').appendChild($('trainingPetCard'));
  window.trainingPet?.render(true);
  window.bigGainsViewShell?.showView('today',{workout:false});
  $('top').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  return true;
}
function reviewCompletedWorkout(){if(!completionReceipt)return false;openHistory(completionReceipt.workoutId);return true;}
const workoutSessionController=(()=>{
  function begin(day){selectedDay=day;active={id:uid(),type:day,startedAt:new Date().toISOString(),exercises:[]};return active;}
  function appendRoutine(day){const before=active.exercises.length;routineEngine.getRoutine(day).forEach(id=>{const ex=exerciseCatalog.getById(id);if(ex&&!active.exercises.some(item=>item.id===ex.id))active.exercises.push(makeExercise(ex,routineEngine.getPrescription(day,id)));});return active.exercises.length-before;}
  function renderLoaded(scroll){renderActive();renderLibrary();if(scroll)$('activePanel').scrollIntoView({behavior:'smooth',block:'start'});}
  function clearRuntime(hideActive=true){active=null;state.activeWorkout=null;state.restTimerEndsAt=null;clearInterval(workoutTicker);timerController.deactivate();setWorkoutPetState(null);if(hideActive)$('activePanel').classList.add('hidden');$('cancelWorkout').classList.add('hidden');$('cancelWorkout').textContent='Cancel';cancelArmedUntil=0;}
  function start(day=selectedDay,{loadRoutine:shouldLoad=true,scroll=true}={}){if(active)return resume(scroll);begin(day);if(shouldLoad)appendRoutine(day);autosave();renderActiveSession(scroll);return active;}
  function resume(scroll=true,{enterMode=true}={}){if(!active)return null;renderActiveSession(scroll);if(enterMode&&typeof window.bigGainsWorkoutMode?.enter==='function')window.bigGainsWorkoutMode.enter();return active;}
  function replace(day=selectedDay,{loadRoutine:shouldLoad=true,scroll=true}={}){if(!active)return start(day,{loadRoutine:shouldLoad,scroll});clearRuntime(false);begin(day);if(shouldLoad)appendRoutine(day);autosave();renderActiveSession(scroll);return active;}
  function loadRoutine(day=selectedDay,{scroll=true}={}){if(!active)return start(day,{loadRoutine:true,scroll});appendRoutine(day);autosave();renderLoaded(scroll);return active;}
  function repairEmpty(session=active,{scroll=false}={}){if(session!==active||!session||!Array.isArray(session.exercises)||session.exercises.length||!routineEngine.hasRoutine(session.type))return false;const added=appendRoutine(session.type);if(!added)return false;autosave();renderLoaded(scroll);return true;}
  function addExercise(id,{scroll=true}={}){const ex=exerciseCatalog.getById(id);if(!ex)return active;const created=!active;if(created)begin(selectedDay);if(active.exercises.some(exercise=>exercise.id===id))return active;active.exercises.push(makeExercise(ex));autosave();if(created)renderActiveSession(scroll);else renderLoaded(scroll);return active;}
  function complete(){if(!active)return false;const completed=active.exercises.map(e=>({...e,sets:e.sets.filter(s=>s.completed)})).filter(e=>e.sets.length);if(!completed.length)return false;const completedAt=new Date().toISOString(),durationSeconds=Math.floor((Date.now()-new Date(active.startedAt))/1000),workout={...active,completedAt,durationSeconds,exercises:completed};let newPRs=0;completed.forEach(e=>e.sets.filter(s=>!s.warmup).forEach(s=>{const score=estimate1RM(Number(s.weight),Number(s.reps));if(score>((state.prs[e.id]&&state.prs[e.id].estimated1RM)||0)){state.prs[e.id]={exercise:e.name,estimated1RM:score,weight:Number(s.weight),reps:Number(s.reps),date:completedAt};newPRs++;}}));workout.prs=newPRs;state.workouts.unshift(workout);clearRuntime();saveState();$('heroNote').textContent=`Workout saved${newPRs?` · ${newPRs} new PR${newPRs===1?'':'s'}`:''}.`;renderAll();renderCompletion(workout);return true;}
  function discard(){if(!active)return false;clearRuntime();saveState();renderHero();renderLibrary();$('workoutPanel').scrollIntoView({behavior:'smooth'});return true;}
  return Object.freeze({start,resume,replace,loadRoutine,repairEmpty,addExercise,complete,discard});
})();
window.workoutSessionController=workoutSessionController;
function showActive(scroll=true){return workoutSessionController.resume(scroll,{enterMode:false});}
function startWorkout(day=selectedDay,load=true){return workoutSessionController.start(day,{loadRoutine:load,scroll:true});}
function addExercise(id,scroll=true){return workoutSessionController.addExercise(id,{scroll});}
function loadRoutine(day=selectedDay,scroll=true){if(active&&active.type===day&&active.exercises.length===0&&workoutSessionController.repairEmpty(active,{scroll}))return active;return workoutSessionController.loadRoutine(day,{scroll});}
function renderWorkoutClock(){if(active)$('workoutClock').textContent=fmtTime((Date.now()-new Date(active.startedAt))/1000);}
function stepper(field,ei,si,value,step){return workoutControlsApi.renderStepper(field,ei,si,value,step);}
function renderActive(){const result=workoutControlsApi.renderActive({activeWorkout:active,box:$('activeExercises'),finishButton:$('finishWorkout'),lastPerformance,performanceDelta:analyticsApi.performanceDelta,estimate1RM,escapeHtml,stepper});notesApi.renderActiveNotes({activeWorkout:active,box:$('activeExercises'),state,defaultRest:DEFAULT_REST,escapeHtml});progressApi.afterActiveRender({activeWorkout:active});return result;}
function startRestTimer(exerciseIndex){return timerController.start(exerciseIndex);}
function acknowledgeTimerReady(){return timerController.acknowledgeReady();}
function discardWorkout(){return workoutSessionController.discard();}
function finishWorkout(){return workoutSessionController.complete();}
function renderHistory(){const box=$('history');if(!state.workouts.length){box.className='history-list empty';box.textContent='Your completed workouts will appear here.';return;}box.className='history-list';box.innerHTML=state.workouts.slice(0,20).map(w=>`<button type="button" class="history-item" data-history-id="${w.id}"><div><strong>${escapeHtml(completionWorkoutLabel(w.type))}</strong><small>${fmtDate(w.completedAt)} · ${(w.exercises||[]).flatMap(e=>e.sets||[]).length} sets · ${fmtTime(w.durationSeconds||0)}</small>${w.entryMethod==='retrospective'?'<span class="entered-later">Entered later</span>':''}<div class="history-open">View full workout →</div></div><div class="history-meta"><strong>${Math.round(volumeForWorkout(w)).toLocaleString('en-US')} lb</strong><small>${(w.exercises||[]).length} exercises${w.prs?` · ${w.prs} PR${w.prs===1?'':'s'}`:''}</small></div></button>`).join('');}
function calendarWorkoutsByDay(){return state.workouts.reduce((days,workout)=>{const key=localDateKey(workout.completedAt);(days[key]||(days[key]=[])).push(workout);return days;},{});}
function renderCalendar(){if(!$('trainingCalendar'))return;const byDay=calendarWorkoutsByDay(),year=calendarMonth.getFullYear(),month=calendarMonth.getMonth(),first=new Date(year,month,1),gridStart=new Date(year,month,1-first.getDay()),todayKey=localDateKey(new Date()),monthLabel=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(first);$('calendarMonthHeading').textContent=monthLabel;$('logRetrospectiveWorkout').hidden=calendarSelectedKey>todayKey;$('trainingCalendar').innerHTML=Array.from({length:42},(_,index)=>{const date=new Date(gridStart);date.setDate(gridStart.getDate()+index);const key=localDateKey(date),workouts=byDay[key]||[],label=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(date);return `<button type="button" class="calendar-date${date.getMonth()!==month?' other-month':''}" role="gridcell" data-calendar-date="${key}" aria-label="${escapeHtml(label)}${workouts.length?`, ${workouts.length} workout${workouts.length===1?'':'s'}`:', no training logged'}" aria-selected="${key===calendarSelectedKey}"${key===todayKey?' aria-current="date"':''}><span>${date.getDate()}</span><span class="calendar-marker" aria-hidden="true">${workouts.slice(0,3).map(()=>'<i></i>').join('')}${workouts.length>3?`<small class="calendar-count">+${workouts.length-3}</small>`:''}</span></button>`;}).join('');renderCalendarDay(byDay[calendarSelectedKey]||[]);}
function renderCalendarDay(workouts){const [year,month,day]=calendarSelectedKey.split('-').map(Number),date=new Date(year,month-1,day);$('calendarDayHeading').textContent=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(date);const box=$('calendarDayWorkouts');if(!workouts.length){box.className='calendar-empty';box.textContent='No training logged';return;}box.className='calendar-day-list';box.innerHTML=workouts.slice().sort((a,b)=>new Date(a.completedAt)-new Date(b.completedAt)).map(workout=>{const summary=analyticsApi.workoutSummary(workout);const time=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(workout.completedAt));return `<button type="button" class="calendar-day-workout" data-history-id="${workout.id}"><span><strong>${escapeHtml(completionWorkoutLabel(workout.type))}</strong>${workout.entryMethod==='retrospective'?'<span class="entered-later">Entered later</span>':''}<small>${escapeHtml(time)} · ${fmtTime(summary.durationSeconds)} · ${summary.exerciseCount} exercises · ${summary.workingSetCount} working sets</small><small>${summary.prCount} PR${summary.prCount===1?'':'s'} · View full workout →</small></span><span class="calendar-workout-volume"><strong>${Math.round(summary.workingSetVolume).toLocaleString('en-US')} lb</strong><small>volume</small></span></button>`;}).join('');}
function openHistory(id){const w=state.workouts.find(x=>x.id===id);if(!w)return;const title=completionWorkoutLabel(w.type),summary=analyticsApi.workoutSummary(w);$('historyDialogTitle').textContent=title;$('historyDialogDate').textContent=fmtDateLong(w.completedAt);const totalSets=(w.exercises||[]).flatMap(e=>e.sets||[]).length;const exercises=(w.exercises||[]).map(e=>{const best=analyticsApi.bestWorkingSet(e),exerciseId=e.definitionId||e.id;const sets=(e.sets||[]).map((s,i)=>`<div class="history-set"><span class="${s.warmup?'warmup-chip':''}">${s.warmup?'Warm-up':`Set ${i+1}`}</span><strong>${Number(s.weight)||0} lb × ${Number(s.reps)||0}</strong>${best?.id===s.id&&!s.warmup?'<span class="pr-chip">BEST</span>':'<span></span>'}</div>`).join('');return `<article class="history-exercise" data-exercise-id="${escapeHtml(exerciseId)}"><div class="history-exercise-head"><div><span class="exercise-muscle">${escapeHtml(e.muscle||'Exercise')}</span><h3>${escapeHtml(e.name)}</h3><small>${escapeHtml(e.equipment||'')} · ${Math.round(volumeForExercise(e)).toLocaleString('en-US')} lb volume</small></div></div><div class="history-sets">${sets}</div></article>`;}).join('');const content=$('historyDialogContent');content.innerHTML=`${w.entryMethod==='retrospective'?'<p class="entered-later">Entered later</p>':''}${w.note?`<div class="history-note"><span>Workout note</span><p>${escapeHtml(w.note)}</p></div>`:''}<div class="history-summary-grid"><div><span>Duration</span><strong>${fmtTime(summary.durationSeconds)}</strong></div><div><span>Total volume</span><strong>${Math.round(summary.workingSetVolume).toLocaleString('en-US')} lb</strong></div><div><span>Work completed</span><strong>${(w.exercises||[]).length} exercises · ${totalSets} sets</strong></div></div>${summary.prCount?`<div class="previous-note">${summary.prCount} personal record${summary.prCount===1?'':'s'} earned in this workout.</div>`:''}<div class="history-detail-list">${exercises}</div>`;notesApi.renderHistoryNotes({workout:w,container:content,escapeHtml});progressApi.afterHistoryOpen();const dialog=$('historyDialog');if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
function closeHistory(){const dialog=$('historyDialog');if(dialog.close)dialog.close();else dialog.removeAttribute('open');}
function openRoutineEditor(){routineDraftDay=selectedDay;routineDraft=routineEngine.getDraft(routineDraftDay);$('routineEditorTitle').textContent=`Edit ${displayWorkout(routineDraftDay)}`;renderRoutineEditor();const d=$('routineDialog');if(d.showModal)d.showModal();else d.setAttribute('open','');}
function renderRoutineEditor(){const list=$('routineEditorList'),used=new Set(routineDraft.map(entry=>entry.exerciseId)),sorted=[...CATALOG_EXERCISES].sort((a,b)=>a.name.localeCompare(b.name));list.innerHTML=routineDraft.length?routineDraft.map((entry,i)=>{const e=exerciseCatalog.getById(entry.exerciseId);if(!e)return '';const exerciseOptions=sorted.filter(option=>option.id===entry.exerciseId||!used.has(option.id)).map(option=>`<option value="${escapeHtml(option.id)}" ${option.id===entry.exerciseId?'selected':''}>${escapeHtml(option.name)} — ${escapeHtml(option.equipment)}</option>`).join('');return `<article class="routine-prescription-row" data-routine-index="${i}"><div class="routine-prescription-head"><span class="routine-order">${i+1}</span><div><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.muscle)} · ${escapeHtml(e.equipment)}</small></div><div class="routine-row-actions"><button type="button" data-routine-move="up" data-index="${i}" ${i===0?'disabled':''} aria-label="Move ${escapeHtml(e.name)} up">↑</button><button type="button" data-routine-move="down" data-index="${i}" ${i===routineDraft.length-1?'disabled':''} aria-label="Move ${escapeHtml(e.name)} down">↓</button><button type="button" data-routine-remove="${i}" aria-label="Remove ${escapeHtml(e.name)}">✕</button></div></div><div class="routine-prescription-fields"><label><span>Exercise</span><select data-routine-field="exerciseId" data-index="${i}">${exerciseOptions}</select></label><label><span>Working sets</span><input type="number" min="1" max="12" step="1" inputmode="numeric" data-routine-field="workingSets" data-index="${i}" value="${entry.workingSets}"></label><label><span>Target reps</span><input type="text" maxlength="20" list="targetRepPresets" placeholder="8–10" data-routine-field="targetReps" data-index="${i}" value="${escapeHtml(entry.targetReps)}"></label></div></article>`;}).join(''):'<div class="empty">This routine is empty. Add an exercise below.</div>';const available=sorted.filter(e=>!used.has(e.id)).sort((a,b)=>(a.day===routineDraftDay?-1:0)-(b.day===routineDraftDay?-1:0)||a.name.localeCompare(b.name));$('routineExerciseSelect').innerHTML=available.map(e=>`<option value="${escapeHtml(e.id)}">${escapeHtml(e.name)} — ${escapeHtml(e.equipment)}</option>`).join('');$('addRoutineExercise').disabled=!available.length;}
function closeRoutineEditor(){const d=$('routineDialog');if(d.close)d.close();else d.removeAttribute('open');}
function saveRoutine(){state.customRoutines[routineDraftDay]=routineDraft.map(entry=>({exerciseId:entry.exerciseId,workingSets:Math.min(12,Math.max(1,Math.round(Number(entry.workingSets)||3))),targetReps:String(entry.targetReps||'').trim().slice(0,20)}));saveState();renderLibrary();closeRoutineEditor();}
function resetRoutine(){delete state.customRoutines[routineDraftDay];delete routineVariantSelections[routineDraftDay];routineDraft=routineEngine.getDraft(routineDraftDay);saveState();renderRoutineEditor();renderLibrary();}
function renderWeights(){const box=$('weightHistory');if(!state.weights.length){box.className='mini-list empty';box.textContent='No weigh-ins yet.';return;}box.className='mini-list';box.innerHTML=state.weights.slice(0,5).map(x=>`<div class="weight-row"><strong>${x.weight} lb</strong><small>${fmtDate(x.date)}</small></div>`).join('');}
function renderAll(){renderGreeting();renderHero();renderStats();renderEquipment();renderLibrary();renderHistory();renderCalendar();renderWeights();timerController.renderPreferences();if(active)showActive(false);else timerController.deactivate();progressApi.afterFullRender({activeWorkout:active});}
function bind(id,event,handler){const el=$(id);if(el)el.addEventListener(event,handler);}
timerController.initialize();
bind('dayTabs','click',e=>{const b=e.target.closest('[data-day]');if(!b)return;selectedDay=b.dataset.day;$('equipmentFilter').value='all';$('exerciseSearch').value='';renderLibrary();});
bind('startWorkout','click',()=>{const today=todaysWorkout();if(active)workoutSessionController.resume(true);else if(today!=='Rest')workoutSessionController.start(today,{loadRoutine:true,scroll:true});});
bind('profileSelect','change',e=>switchProfile(e.target.value));
bind('routineSelect','change',e=>{const day=e.target.dataset.variantFor;if(day)selectRoutineVariant(day,e.target.value);});
bind('loadRoutine','click',()=>workoutSessionController.replace(selectedDay,{loadRoutine:true,scroll:true}));
bind('editRoutine','click',openRoutineEditor);
bind('addSelectedExercise','click',()=>workoutSessionController.addExercise($('quickExerciseSelect').value,{scroll:true}));
bind('exerciseSearch','input',renderLibrary);bind('equipmentFilter','change',renderLibrary);bind('exerciseLibrary','click',e=>{const b=e.target.closest('[data-add]');if(b)workoutSessionController.addExercise(b.dataset.add,{scroll:true});});
bind('cancelWorkout','click',()=>{const now=Date.now();if(now<cancelArmedUntil){workoutSessionController.discard();return;}cancelArmedUntil=now+2500;$('cancelWorkout').textContent='Tap again to discard';setTimeout(()=>{if(active&&Date.now()>=cancelArmedUntil)$('cancelWorkout').textContent='Cancel';},2600);});
function focusActiveExercise(index){const exercise=active?.exercises?.[index];if(!exercise)return false;active.focusedExerciseId=exercise.id;exercise.collapsed=false;return true;}
function toggleRenderedExercise(index,target){const exercise=active?.exercises?.[index],card=target?.closest('.active-exercise');if(!exercise)return false;if(card&&!card.classList.contains('is-collapsed')&&exercise.collapsed!==false)focusActiveExercise(index);return workoutControlsApi.toggleExercise(active,index);}
bind('activeExercises','input',e=>{const {ei,si,field}=e.target.dataset;if(field&&active&&e.target.tagName==='INPUT'){const exerciseIndex=Number(ei);focusActiveExercise(exerciseIndex);acknowledgeTimerReady();active.exercises[exerciseIndex].sets[Number(si)][field]=e.target.value===''?'':Number(e.target.value);autosave();}const cue=e.target.closest('[data-saved-cue]');if(cue)notesApi.saveCue({activeWorkout:active,state,index:Number(cue.dataset.savedCue),value:cue.value,saveState});const note=e.target.closest('[data-session-note]');if(note){focusActiveExercise(Number(note.dataset.sessionNote));notesApi.saveSessionNote({activeWorkout:active,index:Number(note.dataset.sessionNote),value:note.value,autosave});}});
bind('activeExercises','change',e=>{const rest=e.target.closest('[data-rest-seconds]');if(rest){focusActiveExercise(Number(rest.dataset.restSeconds));notesApi.saveRest({activeWorkout:active,state,index:Number(rest.dataset.restSeconds),value:rest.value,defaultRest:DEFAULT_REST,saveState,summary:document.querySelector(`[data-note-block="${rest.dataset.restSeconds}"] summary span`)});}});
bind('activeExercises','click',e=>{
  if(!active)return;
  const move=e.target.closest('[data-move-exercise]');
  if(move){e.preventDefault();if(workoutControlsApi.moveExercise(active,Number(move.dataset.index),move.dataset.moveExercise)){autosave();renderActive();}return;}
  const toggle=e.target.closest('[data-toggle-exercise]');
  if(toggle){e.preventDefault();if(toggleRenderedExercise(Number(toggle.dataset.toggleExercise),toggle)){autosave();renderActive();}return;}
  const head=e.target.closest('[data-exercise-head]');
  if(head&&!e.target.closest('button,input,select,textarea,a')){e.preventDefault();if(toggleRenderedExercise(Number(head.dataset.exerciseHead),head)){autosave();renderActive();}return;}
  const t=e.target.closest('button');
  if(!t)return;
  if(t.dataset.removeExercise!==undefined){active.exercises.splice(Number(t.dataset.removeExercise),1);autosave();renderActive();renderLibrary();return;}
  if(t.dataset.addSet!==undefined){const exerciseIndex=Number(t.dataset.addSet),exercise=active.exercises[exerciseIndex],working=exercise.sets.filter(set=>!set.warmup),recent=working.at(-1),valid=value=>value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;focusActiveExercise(exerciseIndex);acknowledgeTimerReady();exercise.sets.push({id:uid(),weight:valid(recent?.weight)?Number(recent.weight):'',reps:valid(recent?.reps)?Number(recent.reps):'',warmup:false,completed:false});autosave();renderActive();return;}
  if(t.dataset.adjust!==undefined){const exerciseIndex=Number(t.dataset.ei),set=active.exercises[exerciseIndex].sets[Number(t.dataset.si)],field=t.dataset.field;focusActiveExercise(exerciseIndex);acknowledgeTimerReady();set[field]=Math.max(0,(Number(set[field])||0)+Number(t.dataset.adjust));autosave();renderActive();return;}
  if(t.dataset.completeSet){const exerciseIndex=Number(t.dataset.ei),exercise=active.exercises[exerciseIndex],set=exercise.sets[Number(t.dataset.si)];if(!isCompletableSet(exercise,set))return;focusActiveExercise(exerciseIndex);acknowledgeTimerReady();set.completed=!set.completed;autosave();renderActive();if(set.completed){startRestTimer(exerciseIndex);requestAnimationFrame(()=>{if(!active)return;const result=workoutControlsApi.advanceAfterCompletion(active,exerciseIndex);if(!result.advanced)return;autosave();renderActive();if(result.nextIndex>=0&&!matchMedia('(prefers-reduced-motion: reduce)').matches)requestAnimationFrame(()=>document.querySelectorAll('#activeExercises .active-exercise')[result.nextIndex]?.scrollIntoView({behavior:'smooth',block:'nearest'}));});}}
});
bind('finishWorkout','click',()=>workoutSessionController.complete());
bind('history','click',e=>{const b=e.target.closest('[data-history-id]');if(b)openHistory(b.dataset.historyId);});
bind('calendarDayWorkouts','click',e=>{const b=e.target.closest('[data-history-id]');if(b)openHistory(b.dataset.historyId);});
bind('logRetrospectiveWorkout','click',()=>retrospectiveApi.open());
bind('trainingCalendar','click',e=>{const button=e.target.closest('[data-calendar-date]');if(!button)return;calendarSelectedKey=button.dataset.calendarDate;const [year,month]=calendarSelectedKey.split('-').map(Number);calendarMonth=new Date(year,month-1,1);try{sessionStorage.setItem(calendarSavedKey,calendarSelectedKey);}catch{}renderCalendar();document.querySelector(`[data-calendar-date="${calendarSelectedKey}"]`)?.focus();});
bind('trainingCalendar','keydown',e=>{const button=e.target.closest('[data-calendar-date]');if(!button||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key],date=new Date(`${button.dataset.calendarDate}T12:00:00`);if(e.key==='Home')date.setDate(date.getDate()-date.getDay());else if(e.key==='End')date.setDate(date.getDate()+(6-date.getDay()));else date.setDate(date.getDate()+delta);calendarSelectedKey=localDateKey(date);calendarMonth=new Date(date.getFullYear(),date.getMonth(),1);try{sessionStorage.setItem(calendarSavedKey,calendarSelectedKey);}catch{}renderCalendar();document.querySelector(`[data-calendar-date="${calendarSelectedKey}"]`)?.focus();});
bind('calendarPrevious','click',()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()-1,1);renderCalendar();});
bind('calendarNext','click',()=>{calendarMonth=new Date(calendarMonth.getFullYear(),calendarMonth.getMonth()+1,1);renderCalendar();});
bind('calendarToday','click',()=>{const today=new Date();calendarSelectedKey=localDateKey(today);calendarMonth=new Date(today.getFullYear(),today.getMonth(),1);try{sessionStorage.setItem(calendarSavedKey,calendarSelectedKey);}catch{}renderCalendar();});
bind('closeHistoryDialog','click',closeHistory);bind('historyDialog','click',e=>{if(e.target===$('historyDialog'))closeHistory();});
bind('completionDone','click',dismissCompletion);bind('completionReview','click',reviewCompletedWorkout);
bind('routineEditorList','click',e=>{const b=e.target.closest('button');if(!b)return;const i=Number(b.dataset.index);if(b.dataset.routineMove==='up'&&i>0)[routineDraft[i-1],routineDraft[i]]=[routineDraft[i],routineDraft[i-1]];else if(b.dataset.routineMove==='down'&&i<routineDraft.length-1)[routineDraft[i+1],routineDraft[i]]=[routineDraft[i],routineDraft[i+1]];else if(b.dataset.routineRemove!==undefined)routineDraft.splice(Number(b.dataset.routineRemove),1);renderRoutineEditor();});
bind('routineEditorList','input',e=>{const field=e.target.dataset.routineField,index=Number(e.target.dataset.index),entry=routineDraft[index];if(!entry)return;if(field==='workingSets')entry.workingSets=Math.min(12,Math.max(1,Math.round(Number(e.target.value)||3)));else if(field==='targetReps')entry.targetReps=e.target.value.slice(0,20);});
bind('routineEditorList','change',e=>{const field=e.target.dataset.routineField,index=Number(e.target.dataset.index),entry=routineDraft[index];if(!entry||!field)return;if(field==='exerciseId'){const id=e.target.value;if(id&&!routineDraft.some((item,itemIndex)=>itemIndex!==index&&item.exerciseId===id))entry.exerciseId=id;renderRoutineEditor();}else if(field==='workingSets'){entry.workingSets=Math.min(12,Math.max(1,Math.round(Number(e.target.value)||3)));e.target.value=String(entry.workingSets);}else if(field==='targetReps'){entry.targetReps=e.target.value.trim().slice(0,20);e.target.value=entry.targetReps;}});
bind('addRoutineExercise','click',()=>{const id=$('routineExerciseSelect').value;if(id&&!routineDraft.some(entry=>entry.exerciseId===id)){routineDraft.push({exerciseId:id,workingSets:3,targetReps:'8–10'});renderRoutineEditor();}});
bind('saveRoutine','click',saveRoutine);bind('resetRoutine','click',resetRoutine);bind('cancelRoutineDialog','click',closeRoutineEditor);bind('closeRoutineDialog','click',closeRoutineEditor);bind('routineDialog','click',e=>{if(e.target===$('routineDialog'))closeRoutineEditor();});
bind('weightForm','submit',e=>{e.preventDefault();state.weights.unshift({weight:Number($('bodyweight').value),date:new Date().toISOString()});$('bodyweight').value='';saveState();renderAll();});
bind('exportData','click',()=>{const backup=statePersistenceApi.prepareExport(state),blob=new Blob([backup.json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=backup.filename;a.click();URL.revokeObjectURL(url);});
bind('importData','change',async e=>{const file=e.target.files[0];if(!file)return;try{const imported=JSON.parse(await file.text()),result=statePersistenceApi.validateImport(imported);if(!result.ok){if(result.reason==='profile-mismatch'){alert(`This backup belongs to ${result.profileName}, not ${ACCOUNT.displayName}. Switch profiles before restoring it.`);return;}throw new Error('Invalid backup');}state=result.state;active=state.activeWorkout||null;const today=todaysWorkout();selectedDay=(active&&active.type)||(today==='Rest'?PROFILE.capabilities.restFallbackWorkout:today);saveState();renderAll();alert('Backup restored for '+ACCOUNT.displayName+'.');}catch{alert('That file is not a valid Big Gains backup.');}finally{e.target.value='';}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installButton').classList.remove('hidden');});
bind('installButton','click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installButton').classList.add('hidden');});
window.addEventListener('pagehide',saveState);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveState();});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).catch(console.warn));
notesApi.initialize({state,saveState});
progressApi.initialize({getState:()=>state,exercises:CATALOG_EXERCISES,analytics:analyticsApi,fmtDate,escapeHtml,workoutLabel:completionWorkoutLabel,closeHistory,closeRoutineEditor});
retrospectiveApi.initialize();
renderAll();
