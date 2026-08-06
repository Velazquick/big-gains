const DEFAULT_REST=150;
const workoutControlsApi=window.workoutControls;
const notesApi=window.workoutNotes;
const progressApi=window.workoutProgress;
const WEEK_PLAN=PROFILE.weekPlan;
const DEFAULT_ROUTINES={
  Push:{label:'Jorge Push',exercises:['Seated Machine Chest Press','Incline Iso Machine Press','Iso Machine Shoulder Press','Seated Pec Deck','Triceps Pushdown','Overhead Triceps Extension']},
  Pull:{label:'Pull — Back + Biceps',exercises:['Lat Pulldown','Seated Cable Row','Chest-Supported Row','Reverse Pec Deck','Dumbbell Curl','Hammer Curl']},
  Legs:{label:'Legs + Core',exercises:['Leg Press','Leg Extension','Seated Leg Curl','Romanian Deadlift','Standing Calf Raise','Cable Crunch','Hanging Knee Raise']},
  Core:{label:'Core',exercises:['Cable Crunch','Hanging Knee Raise','Hanging Leg Raise','Ab Wheel Rollout','Plank','Side Plank','Pallof Press','Machine Crunch','Russian Twist','Dead Bug']},
  Cardio:{label:'Conditioning',exercises:['Treadmill Run']},
  FullBody:{label:'Full Body',exercises:['Seated Machine Chest Press','Dumbbell Shoulder Press','Lat Pulldown','Triceps Pushdown','Dumbbell Lateral Raise','Hack Squat','Leg Extension','Standing Calf Raise']},
  Other:{label:'Blank workout',exercises:[]},
  PilatesPull:{label:'Pilates + Pull',exercises:['Lat Pulldown','Seated Cable Row','Chest-Supported Row','Face Pull','Dumbbell Curl']},
  LegsLowImpact:{label:'Legs + Low-Impact Class',exercises:['Hip Thrust','Romanian Deadlift','Bulgarian Split Squat','Leg Press','Seated Leg Curl','Hip Abductor']},
  PilatesCardioAccessory:{label:'Pilates + Cardio + Accessories',exercises:['Incline Walk','Dumbbell Lateral Raise','Face Pull','Cable Pull-Through','Pallof Press']},
  Optional:{label:'Optional Movement',exercises:['Incline Walk','Glute Bridge','Face Pull','Dead Bug']}
};
const RAW=[
['Seated Machine Chest Press','Push','Chest','Machine'],['Incline Iso Machine Press','Push','Chest','Machine'],['Smith Machine Incline Press','Push','Chest','Smith Machine'],['Barbell Bench Press','Push','Chest','Barbell'],['Dumbbell Bench Press','Push','Chest','Dumbbell'],['Incline Dumbbell Press','Push','Chest','Dumbbell'],['Cable Chest Fly','Push','Chest','Cable'],['Seated Pec Deck','Push','Chest','Machine'],['Push-Up','Push','Chest','Bodyweight'],['Dips','Push','Chest / Triceps','Bodyweight'],
['Iso Machine Shoulder Press','Push','Shoulders','Machine'],['Dumbbell Shoulder Press','Push','Shoulders','Dumbbell'],['Barbell Overhead Press','Push','Shoulders','Barbell'],['Machine Shoulder Press','Push','Shoulders','Machine'],['Dumbbell Lateral Raise','Push','Shoulders','Dumbbell'],['Cable Lateral Raise','Push','Shoulders','Cable'],['Reverse Pec Deck','Pull','Rear Delts','Machine'],['Face Pull','Pull','Rear Delts','Cable'],
['Overhead Triceps Extension','Push','Triceps','Cable'],['Triceps Pushdown','Push','Triceps','Cable'],['Rope Pushdown','Push','Triceps','Cable'],['Skull Crusher','Push','Triceps','EZ Bar'],['Close-Grip Bench Press','Push','Triceps','Barbell'],['Single-Arm Cable Extension','Push','Triceps','Cable'],
['Lat Pulldown','Pull','Back','Cable'],['Assisted Pull-Up','Pull','Back','Machine'],['Pull-Up','Pull','Back','Bodyweight'],['Seated Cable Row','Pull','Back','Cable'],['Chest-Supported Row','Pull','Back','Machine'],['T-Bar Row','Pull','Back','Machine'],['Barbell Row','Pull','Back','Barbell'],['One-Arm Dumbbell Row','Pull','Back','Dumbbell'],['Iso-Lateral Row','Pull','Back','Machine'],['Straight-Arm Pulldown','Pull','Back','Cable'],['Machine Pullover','Pull','Back','Machine'],['Rack Pull','Pull','Back','Barbell'],
['Dumbbell Curl','Pull','Biceps','Dumbbell'],['Hammer Curl','Pull','Biceps','Dumbbell'],['Incline Dumbbell Curl','Pull','Biceps','Dumbbell'],['Preacher Curl','Pull','Biceps','EZ Bar'],['Machine Preacher Curl','Pull','Biceps','Machine'],['Cable Curl','Pull','Biceps','Cable'],['Bayesian Cable Curl','Pull','Biceps','Cable'],['EZ-Bar Curl','Pull','Biceps','EZ Bar'],
['Back Squat','Legs','Quads / Glutes','Barbell'],['Front Squat','Legs','Quads','Barbell'],['Hack Squat','Legs','Quads / Glutes','Machine'],['Leg Press','Legs','Quads / Glutes','Machine'],['Smith Machine Squat','Legs','Quads / Glutes','Smith Machine'],['Goblet Squat','Legs','Quads / Glutes','Dumbbell'],['Bulgarian Split Squat','Legs','Quads / Glutes','Dumbbell'],['Walking Lunge','Legs','Quads / Glutes','Dumbbell'],['Leg Extension','Legs','Quads','Machine'],
['Romanian Deadlift','Legs','Hamstrings / Glutes','Barbell'],['Dumbbell Romanian Deadlift','Legs','Hamstrings / Glutes','Dumbbell'],['Seated Leg Curl','Legs','Hamstrings','Machine'],['Lying Leg Curl','Legs','Hamstrings','Machine'],['Hip Thrust','Legs','Glutes','Barbell'],['Glute Bridge','Legs','Glutes','Bodyweight'],['Cable Pull-Through','Legs','Glutes','Cable'],['Standing Calf Raise','Legs','Calves','Machine'],['Seated Calf Raise','Legs','Calves','Machine'],['Hip Abductor','Legs','Glutes','Machine'],
['Cable Crunch','Legs','Core','Cable'],['Hanging Knee Raise','Legs','Core','Bodyweight'],['Hanging Leg Raise','Legs','Core','Bodyweight'],['Ab Wheel Rollout','Legs','Core','Bodyweight'],['Plank','Legs','Core','Bodyweight'],['Side Plank','Legs','Core','Bodyweight'],['Pallof Press','Legs','Core','Cable'],['Machine Crunch','Legs','Core','Machine'],['Russian Twist','Legs','Core','Bodyweight'],['Dead Bug','Legs','Core','Bodyweight'],
['Treadmill Run','Cardio','Cardio','Treadmill'],['Outdoor Run','Cardio','Cardio','None'],['Incline Walk','Cardio','Cardio','Treadmill'],['Stair Climber','Cardio','Cardio','Machine'],['Stationary Bike','Cardio','Cardio','Bike'],['Elliptical','Cardio','Cardio','Machine'],['Rowing Machine','Cardio','Cardio','Machine'],
['Deadlift','Other','Full Body','Barbell'],['Trap Bar Deadlift','Other','Full Body','Trap Bar'],['Farmer Carry','Other','Full Body','Dumbbell'],['Kettlebell Swing','Other','Full Body','Kettlebell']
];
const slug=v=>v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const EXERCISES=RAW.map(([name,day,muscle,equipment])=>({id:slug(name),name,day,muscle,equipment}));
const $=id=>document.getElementById(id);
const uid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const statePersistenceApi=bigGainsStatePersistence.create({account:ACCOUNT,profile:PROFILE,profileConfig:PROFILE_CONFIG,validWorkoutTypes:Object.keys(DEFAULT_ROUTINES),createId:uid,slug});
let state=statePersistenceApi.load();
let selectedDay=(state.activeWorkout&&state.activeWorkout.type)||(todaysWorkout()==='Rest'?PROFILE.capabilities.restFallbackWorkout:todaysWorkout());
let active=state.activeWorkout||null;
let workoutTicker=null,timerTicker=null,timerRemaining=DEFAULT_REST,deferredPrompt=null,cancelArmedUntil=0;
let routineDraftDay=selectedDay,routineDraft=[];
let completionReceipt=null;
const localDateKey=value=>{const date=value instanceof Date?value:new Date(value);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;};
const calendarSavedKey=bigGainsAccounts.registry.sessionKey(ACCOUNT,'calendar-date');
let calendarSelectedKey=(()=>{try{return sessionStorage.getItem(calendarSavedKey);}catch{return null;}})()||localDateKey(new Date());
let calendarMonth=(()=>{const [year,month]=calendarSelectedKey.split('-').map(Number);return new Date(year,month-1,1);})();
const retrospectiveApi=window.bigGainsRetrospective.create({
  profile:PROFILE,defaultRoutines:DEFAULT_ROUTINES,exercises:EXERCISES,createId:uid,slug,escapeHtml,
  localDateKey,routineFor,lastPerformance,estimate1RM,workoutLabel:completionWorkoutLabel,
  getState:()=>state,getSelectedDateKey:()=>calendarSelectedKey,saveState,
  afterSave:(dateKey,workoutId)=>{calendarSelectedKey=dateKey;calendarMonth=new Date(`${dateKey}T12:00:00`);try{sessionStorage.setItem(calendarSavedKey,dateKey);}catch{}renderAll();document.dispatchEvent(new CustomEvent('big-gains-workout-saved',{detail:{workoutId,entryMethod:'retrospective'}}));window.bigGainsViewShell?.showView('calendar',{workout:false});}
});
function timerPreferences(){if(!state.timerPreferences)state.timerPreferences={sound:true,vibration:true};return state.timerPreferences;}
function setWorkoutPetState(next){if(next)document.body.dataset.workoutPetState=next;else delete document.body.dataset.workoutPetState;if(typeof window.trainingPet?.render==='function')window.trainingPet.render(true);}
const workoutTimerFeedback=(()=>{
  const PLAY_START_TIMEOUT_MS=900;
  let soundSessionState='unverified',lastCompletionKey=null;
  const vibrationAvailable=()=>typeof navigator.vibrate==='function';
  const audioElement=()=>$('timerCompletionAudio');
  const audioSupported=()=>typeof audioElement()?.play==='function';
  const audioAvailable=()=>audioSupported()&&soundSessionState!=='unavailable';
  function isDirectUserGesture(event){return Boolean(event&&event.isTrusted);}
  function resetAudio(audio){
    if(!audio)return;
    try{audio.pause();}catch{}
    try{audio.currentTime=0;}catch{}
  }
  function markUnavailable(reason,error){
    soundSessionState='unavailable';
    renderTimerPreferences();
    if(error)console.warn(`Timer sound ${reason}`,error);
    return {ok:false,reason};
  }
  function attemptFromGesture(event,{quiet=false,markFailure=false}={}){
    if(!timerPreferences().sound)return {ok:false,reason:'disabled'};
    if(!isDirectUserGesture(event))return {ok:false,reason:'gesture'};
    if(soundSessionState==='unavailable')return {ok:false,reason:'unavailable'};
    const audio=audioElement();
    if(!audioSupported())return markFailure?markUnavailable('unsupported'):{ok:false,reason:'unsupported'};
    resetAudio(audio);
    const previousVolume=audio.volume;
    if(quiet){
      // Keep the element technically audible for iOS/WebKit media unlocking, but
      // reduce the arm to the least perceptible level and stop it on `playing`.
      try{audio.volume=.01;}catch{}
    }

    let timeoutId=null,playingListener=null,settled=false;
    const restore=()=>{
      if(!quiet)return;
      resetAudio(audio);
      try{audio.volume=previousVolume;}catch{}
    };
    const cleanup=()=>{
      if(settled)return;
      settled=true;
      audio.removeEventListener('playing',playingListener);
      clearTimeout(timeoutId);
    };
    const started=new Promise(resolve=>{
      playingListener=()=>{
        restore();
        resolve();
      };
      audio.addEventListener('playing',playingListener);
    });
    const timedOut=new Promise(resolve=>{
      timeoutId=setTimeout(()=>resolve({ok:false,reason:'timeout'}),PLAY_START_TIMEOUT_MS);
    });
    let playPromise;
    try{
      // This call intentionally remains in the trusted click task. Moving it past
      // an await breaks iOS/WebKit playback permission.
      playPromise=audio.play();
    }catch(error){
      cleanup();
      restore();
      return markFailure?markUnavailable('rejected',error):{ok:false,reason:'rejected'};
    }
    const playback=Promise.all([Promise.resolve(playPromise),started])
      .then(()=>({ok:true,reason:'success'}),error=>({ok:false,reason:'rejected',error}));
    return Promise.race([playback,timedOut]).then(result=>{
      cleanup();
      if(!result.ok){
        restore();
        if(markFailure)return markUnavailable(result.reason,result.error);
        soundSessionState='unverified';
        if(result.error)console.warn(`Timer sound arm ${result.reason}`,result.error);
        return {ok:false,reason:result.reason};
      }
      soundSessionState='verified';
      renderTimerPreferences();
      return result;
    });
  }
  function armFromGesture(event){
    if(soundSessionState==='verified')return Promise.resolve({ok:true,reason:'already-verified'});
    if(soundSessionState==='arming')return Promise.resolve({ok:false,reason:'arming'});
    soundSessionState='arming';
    const attempt=attemptFromGesture(event,{quiet:true,markFailure:false});
    return Promise.resolve(attempt).then(result=>{
      if(!result.ok&&soundSessionState==='arming')soundSessionState='unverified';
      return result;
    });
  }
  async function verifyFromGesture(event){
    return attemptFromGesture(event,{quiet:false,markFailure:true});
  }
  function playVerifiedCompletion(){
    if(soundSessionState!=='verified'||!timerPreferences().sound)return false;
    const audio=audioElement();
    if(!audioSupported())return false;
    resetAudio(audio);
    let settled=false,timeoutId=null;
    const cleanup=()=>{
      if(settled)return;
      settled=true;
      clearTimeout(timeoutId);
      audio.removeEventListener('playing',onPlaying);
    };
    const fail=(reason,error)=>{
      if(settled)return;
      cleanup();
      resetAudio(audio);
      markUnavailable(reason,error);
    };
    const onPlaying=()=>cleanup();
    audio.addEventListener('playing',onPlaying);
    timeoutId=setTimeout(()=>fail('timeout'),PLAY_START_TIMEOUT_MS);
    try{
      const playPromise=audio.play();
      Promise.resolve(playPromise).catch(error=>fail('rejected',error));
      return true;
    }catch(error){
      fail('rejected',error);
      return false;
    }
  }
  function complete(completionKey){
    if(completionKey&&completionKey===lastCompletionKey)return {sounded:false,vibrated:false,duplicate:true};
    lastCompletionKey=completionKey||null;
    let sounded=false,vibrated=false;
    // Completion never verifies or retries audio. It requests one playback only
    // after successful session arming and never blocks the visual cue.
    if(timerPreferences().sound)sounded=playVerifiedCompletion();
    if(timerPreferences().vibration&&vibrationAvailable()){try{vibrated=navigator.vibrate([150,80,150])!==false;}catch{vibrated=false;}}
    return {sounded,vibrated};
  }
  return Object.freeze({armFromGesture,verifyFromGesture,complete,audioAvailable,vibrationAvailable,getSoundSessionState:()=>soundSessionState});
})();
window.workoutTimerFeedback=workoutTimerFeedback;
function saveState(){statePersistenceApi.save(state,active);}
function autosave(){saveState();renderHero();}
function todaysWorkout(){return WEEK_PLAN[new Date().getDay()];}
function routineFor(day){const custom=state.customRoutines&&state.customRoutines[day];return Array.isArray(custom)?custom:DEFAULT_ROUTINES[day].exercises.map(name=>slug(name));}
function routineLabel(day){return `${DEFAULT_ROUTINES[day].label}${state.customRoutines&&state.customRoutines[day]?' · Custom':''}`;}
function fmtDate(iso){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso));}
function fmtDateLong(iso){return new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date(iso));}
function fmtTime(seconds){seconds=Math.max(0,Math.floor(seconds));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function startOfWeek(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-d.getDay());return d;}
function volumeForWorkout(w){return (w.exercises||[]).flatMap(e=>e.sets||[]).filter(s=>s.completed&&!s.warmup).reduce((n,s)=>n+(Number(s.weight)||0)*(Number(s.reps)||0),0);}
function volumeForExercise(e){return (e.sets||[]).filter(s=>!s.warmup).reduce((n,s)=>n+(Number(s.weight)||0)*(Number(s.reps)||0),0);}
function estimate1RM(w,r){return r>0?Math.round(w*(1+r/30)):0;}
function displayWorkout(day){return day==='Legs'?'Legs + Core':(DEFAULT_ROUTINES[day]?.label||day);}
function completionWorkoutLabel(day){return ({Legs:'Legs + Core',FullBody:'Full Body',Cardio:'Conditioning',PilatesPull:'Pilates + Pull',LegsLowImpact:'Legs + Low-Impact Class',PilatesCardioAccessory:'Pilates + Cardio + Accessories',Optional:'Optional Movement'})[day]||day;}
function renderGreeting(){const h=new Date().getHours();$('greeting').textContent=`Good ${h<12?'morning':h<18?'afternoon':'evening'}, ${ACCOUNT.displayName}.`;$('profileSelect').value=PROFILE.id;const today=todaysWorkout();$('nextWorkout').textContent=displayWorkout(today);document.body.classList.toggle('alexa-mode',PROFILE.capabilities.wellnessPresentation);document.querySelectorAll('[data-profile-only]').forEach(el=>el.hidden=el.dataset.profileOnly!==PROFILE.id);}
function renderHero(){const button=$('startWorkout'),note=$('heroNote'),today=todaysWorkout(),wellness=PROFILE.capabilities.wellnessPresentation;if(active){button.disabled=false;button.textContent=`Resume ${displayWorkout(active.type)}`;note.textContent=`Workout in progress · ${active.exercises.length} exercises saved`;return;}if(today==='Rest'){button.disabled=true;button.textContent='Recovery day';note.textContent=wellness?'Rest is part of your plan. Your garden is still safe.':'Recovery supports the work.';return;}button.disabled=false;button.textContent=wellness?'Begin today’s movement':'Start planned workout';note.textContent=wellness?'A gentle plan is ready whenever you are.':'Your plan is ready. Tap once and train.';}
function renderStats(){$('weeklyWorkouts').textContent=state.workouts.filter(w=>new Date(w.completedAt)>=startOfWeek()).length;$('trainingVolume').textContent=`${Math.round(state.workouts.reduce((n,w)=>n+volumeForWorkout(w),0)).toLocaleString('en-US')} lb`;$('prCount').textContent=Object.keys(state.prs||{}).length;$('latestWeight').textContent=state.weights[0]?`${state.weights[0].weight} lb`:'—';}
function renderSelectors(){document.querySelectorAll('#dayTabs button').forEach(b=>b.classList.toggle('active',b.dataset.day===selectedDay));$('routineSelect').innerHTML=`<option value="${selectedDay}">${escapeHtml(routineLabel(selectedDay))}</option>`;const routineIds=new Set(routineFor(selectedDay)),list=EXERCISES.filter(e=>PROFILE.capabilities.allExercises||e.day===selectedDay||selectedDay==='Other'||routineIds.has(e.id));$('quickExerciseSelect').innerHTML=list.map(e=>`<option value="${e.id}">${escapeHtml(e.name)} — ${escapeHtml(e.equipment)}</option>`).join('');}
function renderEquipment(){if($('equipmentFilter').options.length>1)return;[...new Set(EXERCISES.map(e=>e.equipment))].sort().forEach(eq=>$('equipmentFilter').add(new Option(eq,eq)));}
function renderLibrary(){renderSelectors();const q=$('exerciseSearch').value.trim().toLowerCase(),eq=$('equipmentFilter').value,knownRoutine=new Set(routineFor(selectedDay));const list=EXERCISES.filter(e=>(PROFILE.capabilities.allExercises||e.day===selectedDay||selectedDay==='Other'||knownRoutine.has(e.id))&&(!q||`${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(q))&&(eq==='all'||e.equipment===eq));$('exerciseLibrary').innerHTML=list.length?list.map(e=>`<article class="exercise-card ${active&&active.exercises.some(x=>x.id===e.id)?'added':''}"><div><span class="exercise-muscle">${escapeHtml(e.muscle)}</span><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.equipment)}</p></div><button type="button" class="add-exercise primary compact" data-add="${e.id}">${active&&active.exercises.some(x=>x.id===e.id)?'Added':'Add'}</button></article>`).join(''):'<div class="no-results">No matching exercises.</div>';progressApi.afterLibraryRender();}
function lastPerformance(name){for(const w of state.workouts){const e=(w.exercises||[]).find(x=>x.name.toLowerCase()===name.toLowerCase());if(e){const sets=e.sets.filter(s=>s.completed&&!s.warmup);if(sets.length)return {date:w.completedAt,sets};}}return null;}
function makeExercise(ex){const last=lastPerformance(ex.name),prior=last?last.sets:[],working=prior[0]?Number(prior[0].weight)||0:0,warm=working?Math.round(working*.6/5)*5:0;return {id:ex.id,name:ex.name,muscle:ex.muscle,equipment:ex.equipment,collapsed:true,sets:[{id:uid(),weight:warm,reps:10,warmup:true,completed:false},...Array.from({length:3},(_,i)=>({id:uid(),weight:prior[i]?Number(prior[i].weight)||working:working,reps:prior[i]?Number(prior[i].reps)||'':'',warmup:false,completed:false}))]};}
function renderActiveSession(scroll=true){if(!active)return;selectedDay=active.type;$('activePanel').classList.remove('hidden');$('cancelWorkout').classList.remove('hidden');$('cancelWorkout').textContent='Cancel';$('activeWorkoutTitle').textContent=displayWorkout(active.type);clearInterval(workoutTicker);workoutTicker=setInterval(renderWorkoutClock,1000);renderWorkoutClock();renderActive();renderLibrary();renderTimerPreferences();if(document.body.dataset.workoutPetState!=='ready')setWorkoutPetState(state.restTimerEndsAt?'attentive':'calm');resumeRestTimer();if(scroll)$('activePanel').scrollIntoView({behavior:'smooth',block:'start'});}
function renderCompletion(workout){
  if(!workout)return false;
  completionReceipt={workoutId:workout.id,workout};
  const workingSets=(workout.exercises||[]).flatMap(exercise=>exercise.sets||[]).filter(set=>set.completed&&!set.warmup);
  const type=completionWorkoutLabel(workout.type);
  $('workoutCompletionTitle').textContent=`${type} complete`;
  $('completionWorkoutType').textContent=type;
  $('completionDuration').textContent=fmtTime(workout.durationSeconds||0);
  $('completionExercises').textContent=String((workout.exercises||[]).length);
  $('completionWorkingSets').textContent=String(workingSets.length);
  $('completionVolume').textContent=`${Math.round(volumeForWorkout(workout)).toLocaleString('en-US')} lb`;
  $('completionPrCount').textContent=String(workout.prs||0);
  $('completionPrCopy').textContent=workout.prs?`${workout.prs} new PR${workout.prs===1?'':'s'}.`:'';
  $('completionPrCopy').hidden=!workout.prs;
  document.body.classList.add('workout-completion-open');
  document.body.dataset.workoutCompletionPetState=workout.prs?'pr':'complete';
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
  function appendRoutine(day){const before=active.exercises.length;routineFor(day).forEach(id=>{const ex=EXERCISES.find(e=>e.id===id);if(ex&&!active.exercises.some(item=>item.id===ex.id))active.exercises.push(makeExercise(ex));});return active.exercises.length-before;}
  function renderLoaded(scroll){renderActive();renderLibrary();if(scroll)$('activePanel').scrollIntoView({behavior:'smooth',block:'start'});}
  function clearRuntime(hideActive=true){active=null;state.activeWorkout=null;state.restTimerEndsAt=null;clearInterval(workoutTicker);clearInterval(timerTicker);setWorkoutPetState(null);if(hideActive)$('activePanel').classList.add('hidden');$('timerCard').classList.add('hidden');$('cancelWorkout').classList.add('hidden');$('cancelWorkout').textContent='Cancel';cancelArmedUntil=0;}
  function start(day=selectedDay,{loadRoutine:shouldLoad=true,scroll=true}={}){if(active)return resume(scroll);begin(day);if(shouldLoad)appendRoutine(day);autosave();renderActiveSession(scroll);return active;}
  function resume(scroll=true,{enterMode=true}={}){if(!active)return null;renderActiveSession(scroll);if(enterMode&&typeof window.bigGainsWorkoutMode?.enter==='function')window.bigGainsWorkoutMode.enter();return active;}
  function replace(day=selectedDay,{loadRoutine:shouldLoad=true,scroll=true}={}){if(!active)return start(day,{loadRoutine:shouldLoad,scroll});clearRuntime(false);begin(day);if(shouldLoad)appendRoutine(day);autosave();renderActiveSession(scroll);return active;}
  function loadRoutine(day=selectedDay,{scroll=true}={}){if(!active)return start(day,{loadRoutine:true,scroll});appendRoutine(day);autosave();renderLoaded(scroll);return active;}
  function repairEmpty(session=active,{scroll=false}={}){if(session!==active||!session||!Array.isArray(session.exercises)||session.exercises.length||!DEFAULT_ROUTINES[session.type])return false;const added=appendRoutine(session.type);if(!added)return false;autosave();renderLoaded(scroll);return true;}
  function addExercise(id,{scroll=true}={}){const ex=EXERCISES.find(exercise=>exercise.id===id);if(!ex)return active;const created=!active;if(created)begin(selectedDay);if(active.exercises.some(exercise=>exercise.id===id))return active;active.exercises.push(makeExercise(ex));autosave();if(created)renderActiveSession(scroll);else renderLoaded(scroll);return active;}
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
function renderActive(){const result=workoutControlsApi.renderActive({activeWorkout:active,box:$('activeExercises'),finishButton:$('finishWorkout'),lastPerformance,estimate1RM,escapeHtml,stepper});notesApi.renderActiveNotes({activeWorkout:active,box:$('activeExercises'),state,defaultRest:DEFAULT_REST,escapeHtml});progressApi.afterActiveRender({activeWorkout:active});return result;}
function startRestTimer(exerciseIndex){return notesApi.startRestTimer({activeWorkout:active,state,exerciseIndex,defaultRest:DEFAULT_REST,saveState,runRestTimer,message:$('timerNext')});}
function resumeRestTimer(){if(!state.restTimerEndsAt)return;if(state.restTimerEndsAt<=Date.now()){completeRestTimer(state.restTimerEndsAt);return;}runRestTimer();}
let timerFeedbackReset=null,lastAnnouncedCompletionKey=null;
function clearTimerCompletionFallback({hide=false}={}){clearTimeout(timerFeedbackReset);timerFeedbackReset=null;const card=$('timerCard');card?.classList.remove('timer-feedback-ready','timer-completing');if(hide)card?.classList.add('hidden');if($('timerFeedbackStatus'))$('timerFeedbackStatus').textContent='';}
function showTimerCompletionFallback(completionKey){if(completionKey===lastAnnouncedCompletionKey)return false;lastAnnouncedCompletionKey=completionKey;const card=$('timerCard'),status=$('timerFeedbackStatus');card.classList.remove('hidden','timer-dismissing');card.classList.add('timer-feedback-ready','timer-completing');status.textContent='Rest complete. Ready for your next set.';timerFeedbackReset=setTimeout(()=>{card.classList.add('timer-dismissing');timerFeedbackReset=setTimeout(()=>clearTimerCompletionFallback({hide:true}),matchMedia('(prefers-reduced-motion: reduce)').matches?0:220);},3000);return true;}
function setTimerFeedbackStatus(message){const status=$('timerFeedbackStatus');if(status)status.textContent=message;}
function completeRestTimer(deadline){const completionKey=`${active?.id||'workout'}:${deadline}`;clearInterval(timerTicker);timerRemaining=0;renderTimer();state.restTimerEndsAt=null;saveState();$('timerNext').textContent="Rest complete. You're up.";setWorkoutPetState('ready');showTimerCompletionFallback(completionKey);workoutTimerFeedback.complete(completionKey);}
function runRestTimer(){clearInterval(timerTicker);clearTimerCompletionFallback();const deadline=state.restTimerEndsAt;$('timerCard').classList.remove('hidden');$('timerNext').textContent='Recover. Your next set is waiting.';setWorkoutPetState('attentive');let completed=false;const tick=()=>{timerRemaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));renderTimer();if(timerRemaining<=0&&!completed){completed=true;completeRestTimer(deadline);}};tick();if(!completed)timerTicker=setInterval(tick,1000);}
function renderTimer(){$('timerDisplay').textContent=fmtTime(timerRemaining);}
function setTimerPresetsOpen(open){$('timerPresets').classList.toggle('hidden',!open);$('timerAdjust').setAttribute('aria-expanded',String(open));}
function acknowledgeTimerReady(){if(document.body.dataset.workoutPetState==='ready')setWorkoutPetState('calm');}
function renderTimerPreferences(){const preferences=timerPreferences(),sound=$('timerSoundToggle'),vibration=$('timerVibrationToggle'),audioAvailable=workoutTimerFeedback.audioAvailable();if(sound){sound.disabled=!audioAvailable;sound.setAttribute('aria-disabled',String(!audioAvailable));sound.setAttribute('aria-pressed',String(audioAvailable&&preferences.sound));sound.textContent=audioAvailable?`Sound ${preferences.sound?'on':'off'}`:'Sound unavailable';}if(vibration){const available=workoutTimerFeedback.vibrationAvailable();vibration.hidden=!available;vibration.disabled=!available;vibration.setAttribute('aria-disabled',String(!available));vibration.setAttribute('aria-pressed',String(available&&preferences.vibration));vibration.textContent=`Vibration ${preferences.vibration?'on':'off'}`;}}
function toggleTimerPreference(name){const preferences=timerPreferences();preferences[name]=!preferences[name];saveState();renderTimerPreferences();return preferences[name];}
function timerSoundResultMessage(result){if(result.ok)return 'Sound on. Chime confirmed.';if(result.reason==='timeout')return 'Sound unavailable this session: playback did not start.';if(result.reason==='rejected')return 'Sound unavailable this session: playback was rejected.';if(result.reason==='gesture')return 'Sound verification requires a direct tap or click.';return 'Sound is unavailable for this browser session.';}
function discardWorkout(){return workoutSessionController.discard();}
function finishWorkout(){return workoutSessionController.complete();}
function renderHistory(){const box=$('history');if(!state.workouts.length){box.className='history-list empty';box.textContent='Your completed workouts will appear here.';return;}box.className='history-list';box.innerHTML=state.workouts.slice(0,20).map(w=>`<button type="button" class="history-item" data-history-id="${w.id}"><div><strong>${escapeHtml(w.type==='Legs'?'Legs + Core':w.type)}</strong><small>${fmtDate(w.completedAt)} · ${(w.exercises||[]).flatMap(e=>e.sets||[]).length} sets · ${fmtTime(w.durationSeconds||0)}</small>${w.entryMethod==='retrospective'?'<span class="entered-later">Entered later</span>':''}<div class="history-open">View full workout →</div></div><div class="history-meta"><strong>${Math.round(volumeForWorkout(w)).toLocaleString('en-US')} lb</strong><small>${(w.exercises||[]).length} exercises${w.prs?` · ${w.prs} PR${w.prs===1?'':'s'}`:''}</small></div></button>`).join('');}
function calendarWorkoutsByDay(){return state.workouts.reduce((days,workout)=>{const key=localDateKey(workout.completedAt);(days[key]||(days[key]=[])).push(workout);return days;},{});}
function renderCalendar(){if(!$('trainingCalendar'))return;const byDay=calendarWorkoutsByDay(),year=calendarMonth.getFullYear(),month=calendarMonth.getMonth(),first=new Date(year,month,1),gridStart=new Date(year,month,1-first.getDay()),todayKey=localDateKey(new Date()),monthLabel=new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric'}).format(first);$('calendarMonthHeading').textContent=monthLabel;$('logRetrospectiveWorkout').hidden=calendarSelectedKey>todayKey;$('trainingCalendar').innerHTML=Array.from({length:42},(_,index)=>{const date=new Date(gridStart);date.setDate(gridStart.getDate()+index);const key=localDateKey(date),workouts=byDay[key]||[],label=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(date);return `<button type="button" class="calendar-date${date.getMonth()!==month?' other-month':''}" role="gridcell" data-calendar-date="${key}" aria-label="${escapeHtml(label)}${workouts.length?`, ${workouts.length} workout${workouts.length===1?'':'s'}`:', no training logged'}" aria-selected="${key===calendarSelectedKey}"${key===todayKey?' aria-current="date"':''}><span>${date.getDate()}</span><span class="calendar-marker" aria-hidden="true">${workouts.slice(0,3).map(()=>'<i></i>').join('')}${workouts.length>3?`<small class="calendar-count">+${workouts.length-3}</small>`:''}</span></button>`;}).join('');renderCalendarDay(byDay[calendarSelectedKey]||[]);}
function renderCalendarDay(workouts){const [year,month,day]=calendarSelectedKey.split('-').map(Number),date=new Date(year,month-1,day);$('calendarDayHeading').textContent=new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(date);const box=$('calendarDayWorkouts');if(!workouts.length){box.className='calendar-empty';box.textContent='No training logged';return;}box.className='calendar-day-list';box.innerHTML=workouts.slice().sort((a,b)=>new Date(a.completedAt)-new Date(b.completedAt)).map(workout=>{const working=(workout.exercises||[]).flatMap(exercise=>exercise.sets||[]).filter(set=>set.completed&&!set.warmup);const completedExercises=(workout.exercises||[]).filter(exercise=>(exercise.sets||[]).some(set=>set.completed&&!set.warmup)).length;const time=new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(workout.completedAt));return `<button type="button" class="calendar-day-workout" data-history-id="${workout.id}"><span><strong>${escapeHtml(completionWorkoutLabel(workout.type))}</strong>${workout.entryMethod==='retrospective'?'<span class="entered-later">Entered later</span>':''}<small>${escapeHtml(time)} · ${fmtTime(workout.durationSeconds||0)} · ${completedExercises} exercises · ${working.length} working sets</small><small>${workout.prs||0} PR${workout.prs===1?'':'s'} · View full workout →</small></span><span class="calendar-workout-volume"><strong>${Math.round(volumeForWorkout(workout)).toLocaleString('en-US')} lb</strong><small>volume</small></span></button>`;}).join('');}
function openHistory(id){const w=state.workouts.find(x=>x.id===id);if(!w)return;const title=w.type==='Legs'?'Legs + Core':w.type;$('historyDialogTitle').textContent=title;$('historyDialogDate').textContent=fmtDateLong(w.completedAt);const totalSets=(w.exercises||[]).flatMap(e=>e.sets||[]).length;const exercises=(w.exercises||[]).map(e=>{const best=(e.sets||[]).filter(s=>!s.warmup).reduce((winner,s)=>estimate1RM(Number(s.weight),Number(s.reps))>estimate1RM(Number(winner?.weight||0),Number(winner?.reps||0))?s:winner,null);const sets=(e.sets||[]).map((s,i)=>`<div class="history-set"><span class="${s.warmup?'warmup-chip':''}">${s.warmup?'Warm-up':`Set ${i+1}`}</span><strong>${Number(s.weight)||0} lb × ${Number(s.reps)||0}</strong>${best===s&&!s.warmup?'<span class="pr-chip">BEST</span>':'<span></span>'}</div>`).join('');return `<article class="history-exercise"><div class="history-exercise-head"><div><span class="exercise-muscle">${escapeHtml(e.muscle||'Exercise')}</span><h3>${escapeHtml(e.name)}</h3><small>${escapeHtml(e.equipment||'')} · ${Math.round(volumeForExercise(e)).toLocaleString('en-US')} lb volume</small></div></div><div class="history-sets">${sets}</div></article>`;}).join('');const content=$('historyDialogContent');content.innerHTML=`${w.entryMethod==='retrospective'?'<p class="entered-later">Entered later</p>':''}${w.note?`<div class="history-note"><span>Workout note</span><p>${escapeHtml(w.note)}</p></div>`:''}<div class="history-summary-grid"><div><span>Duration</span><strong>${fmtTime(w.durationSeconds||0)}</strong></div><div><span>Total volume</span><strong>${Math.round(volumeForWorkout(w)).toLocaleString('en-US')} lb</strong></div><div><span>Work completed</span><strong>${(w.exercises||[]).length} exercises · ${totalSets} sets</strong></div></div>${w.prs?`<div class="previous-note">${w.prs} personal record${w.prs===1?'':'s'} earned in this workout.</div>`:''}<div class="history-detail-list">${exercises}</div>`;notesApi.renderHistoryNotes({workout:w,container:content,escapeHtml});progressApi.afterHistoryOpen();const dialog=$('historyDialog');if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
function closeHistory(){const dialog=$('historyDialog');if(dialog.close)dialog.close();else dialog.removeAttribute('open');}
function openRoutineEditor(){routineDraftDay=selectedDay;routineDraft=[...routineFor(routineDraftDay)];$('routineEditorTitle').textContent=`Edit ${routineDraftDay==='Legs'?'Legs + Core':routineDraftDay}`;renderRoutineEditor();const d=$('routineDialog');if(d.showModal)d.showModal();else d.setAttribute('open','');}
function renderRoutineEditor(){const list=$('routineEditorList');list.innerHTML=routineDraft.length?routineDraft.map((id,i)=>{const e=EXERCISES.find(x=>x.id===id);if(!e)return '';return `<div class="routine-row"><div><span>${i+1}</span><strong>${escapeHtml(e.name)}</strong><small>${escapeHtml(e.muscle)} · ${escapeHtml(e.equipment)}</small></div><div class="routine-row-actions"><button type="button" data-routine-move="up" data-index="${i}" ${i===0?'disabled':''}>↑</button><button type="button" data-routine-move="down" data-index="${i}" ${i===routineDraft.length-1?'disabled':''}>↓</button><button type="button" data-routine-remove="${i}" aria-label="Remove ${escapeHtml(e.name)}">✕</button></div></div>`;}).join(''):'<div class="empty">This routine is empty. Add an exercise below.</div>';const available=EXERCISES.filter(e=>!routineDraft.includes(e.id)).sort((a,b)=>(a.day===routineDraftDay?-1:0)-(b.day===routineDraftDay?-1:0)||a.name.localeCompare(b.name));$('routineExerciseSelect').innerHTML=available.map(e=>`<option value="${e.id}">${escapeHtml(e.name)} — ${escapeHtml(e.equipment)}</option>`).join('');$('addRoutineExercise').disabled=!available.length;}
function closeRoutineEditor(){const d=$('routineDialog');if(d.close)d.close();else d.removeAttribute('open');}
function saveRoutine(){state.customRoutines[routineDraftDay]=[...routineDraft];saveState();renderLibrary();closeRoutineEditor();}
function resetRoutine(){delete state.customRoutines[routineDraftDay];routineDraft=[...routineFor(routineDraftDay)];saveState();renderRoutineEditor();renderLibrary();}
function renderWeights(){const box=$('weightHistory');if(!state.weights.length){box.className='mini-list empty';box.textContent='No weigh-ins yet.';return;}box.className='mini-list';box.innerHTML=state.weights.slice(0,5).map(x=>`<div class="weight-row"><strong>${x.weight} lb</strong><small>${fmtDate(x.date)}</small></div>`).join('');}
function renderAll(){renderGreeting();renderHero();renderStats();renderEquipment();renderLibrary();renderHistory();renderCalendar();renderWeights();renderTimerPreferences();if(active)showActive(false);progressApi.afterFullRender({activeWorkout:active});}
function bind(id,event,handler){const el=$(id);if(el)el.addEventListener(event,handler);}
document.addEventListener('click',event=>{
  if(!event.target.closest('#startWorkout,#quickStartSession,#loadRoutine,#addSelectedExercise,[data-add],[data-complete-set],[data-timer-preset],#returnToWorkout'))return;
  workoutTimerFeedback.armFromGesture(event).catch(error=>console.warn('Timer sound arm failed safely',error));
},true);
bind('dayTabs','click',e=>{const b=e.target.closest('[data-day]');if(!b)return;selectedDay=b.dataset.day;$('equipmentFilter').value='all';$('exerciseSearch').value='';renderLibrary();});
bind('startWorkout','click',()=>{const today=todaysWorkout();if(active)workoutSessionController.resume(true);else if(today!=='Rest')workoutSessionController.start(today,{loadRoutine:true,scroll:true});});
bind('profileSelect','change',e=>switchProfile(e.target.value));
bind('loadRoutine','click',()=>workoutSessionController.replace(selectedDay,{loadRoutine:true,scroll:true}));
bind('editRoutine','click',openRoutineEditor);
bind('addSelectedExercise','click',()=>workoutSessionController.addExercise($('quickExerciseSelect').value,{scroll:true}));
bind('exerciseSearch','input',renderLibrary);bind('equipmentFilter','change',renderLibrary);bind('exerciseLibrary','click',e=>{const b=e.target.closest('[data-add]');if(b)workoutSessionController.addExercise(b.dataset.add,{scroll:true});});
bind('cancelWorkout','click',()=>{const now=Date.now();if(now<cancelArmedUntil){workoutSessionController.discard();return;}cancelArmedUntil=now+2500;$('cancelWorkout').textContent='Tap again to discard';setTimeout(()=>{if(active&&Date.now()>=cancelArmedUntil)$('cancelWorkout').textContent='Cancel';},2600);});
bind('activeExercises','input',e=>{const {ei,si,field}=e.target.dataset;if(field&&active&&e.target.tagName==='INPUT'){active.focusedExerciseId=active.exercises[Number(ei)].id;acknowledgeTimerReady();active.exercises[Number(ei)].sets[Number(si)][field]=e.target.value===''?'':Number(e.target.value);autosave();}const cue=e.target.closest('[data-saved-cue]');if(cue)notesApi.saveCue({activeWorkout:active,state,index:Number(cue.dataset.savedCue),value:cue.value,saveState});const note=e.target.closest('[data-session-note]');if(note)notesApi.saveSessionNote({activeWorkout:active,index:Number(note.dataset.sessionNote),value:note.value,autosave});});
bind('activeExercises','change',e=>{const rest=e.target.closest('[data-rest-seconds]');if(rest)notesApi.saveRest({activeWorkout:active,state,index:Number(rest.dataset.restSeconds),value:rest.value,defaultRest:DEFAULT_REST,saveState,summary:document.querySelector(`[data-note-block="${rest.dataset.restSeconds}"] summary span`)});});
bind('activeExercises','click',e=>{
  if(!active)return;
  const move=e.target.closest('[data-move-exercise]');
  if(move){e.preventDefault();if(workoutControlsApi.moveExercise(active,Number(move.dataset.index),move.dataset.moveExercise)){autosave();renderActive();}return;}
  const toggle=e.target.closest('[data-toggle-exercise]');
  if(toggle){e.preventDefault();if(workoutControlsApi.toggleExercise(active,Number(toggle.dataset.toggleExercise))){autosave();renderActive();}return;}
  const head=e.target.closest('[data-exercise-head]');
  if(head&&!e.target.closest('button,input,select,textarea,a')){e.preventDefault();if(workoutControlsApi.toggleExercise(active,Number(head.dataset.exerciseHead))){autosave();renderActive();}return;}
  const t=e.target.closest('button');
  if(!t)return;
  if(t.dataset.removeExercise!==undefined){active.exercises.splice(Number(t.dataset.removeExercise),1);autosave();renderActive();renderLibrary();return;}
  if(t.dataset.addSet!==undefined){const exerciseIndex=Number(t.dataset.addSet),exercise=active.exercises[exerciseIndex],working=exercise.sets.filter(set=>!set.warmup),recent=working.at(-1),valid=value=>value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;active.focusedExerciseId=exercise.id;acknowledgeTimerReady();exercise.sets.push({id:uid(),weight:valid(recent?.weight)?Number(recent.weight):'',reps:valid(recent?.reps)?Number(recent.reps):'',warmup:false,completed:false});autosave();renderActive();return;}
  if(t.dataset.adjust!==undefined){const exerciseIndex=Number(t.dataset.ei),set=active.exercises[exerciseIndex].sets[Number(t.dataset.si)],field=t.dataset.field;active.focusedExerciseId=active.exercises[exerciseIndex].id;acknowledgeTimerReady();set[field]=Math.max(0,(Number(set[field])||0)+Number(t.dataset.adjust));autosave();renderActive();return;}
  if(t.dataset.completeSet){const exerciseIndex=Number(t.dataset.ei),set=active.exercises[exerciseIndex].sets[Number(t.dataset.si)];if(!Number(set.weight)||!Number(set.reps))return;active.focusedExerciseId=active.exercises[exerciseIndex].id;acknowledgeTimerReady();set.completed=!set.completed;autosave();renderActive();if(set.completed){startRestTimer(exerciseIndex);requestAnimationFrame(()=>{if(!active)return;const result=workoutControlsApi.advanceAfterCompletion(active,exerciseIndex);if(!result.advanced)return;autosave();renderActive();if(result.nextIndex>=0&&!matchMedia('(prefers-reduced-motion: reduce)').matches)requestAnimationFrame(()=>document.querySelectorAll('#activeExercises .active-exercise')[result.nextIndex]?.scrollIntoView({behavior:'smooth',block:'nearest'}));});}}
});
bind('finishWorkout','click',()=>workoutSessionController.complete());
bind('timerAdjust','click',()=>setTimerPresetsOpen($('timerAdjust').getAttribute('aria-expanded')!=='true'));
bind('timerPresets','click',e=>{const preset=e.target.closest('[data-timer-preset]');if(!preset)return;state.restTimerEndsAt=Date.now()+Number(preset.dataset.timerPreset)*1000;saveState();setTimerPresetsOpen(false);runRestTimer();});
bind('timerSkip','click',()=>{clearInterval(timerTicker);state.restTimerEndsAt=null;saveState();$('timerCard').classList.add('hidden');setWorkoutPetState('calm');});
bind('timerSoundToggle','click',async event=>{const enabled=toggleTimerPreference('sound');if(!enabled){setTimerFeedbackStatus('Sound off. Visual feedback stays on.');return;}const result=await workoutTimerFeedback.verifyFromGesture(event);setTimerFeedbackStatus(timerSoundResultMessage(result));});
bind('timerVibrationToggle','click',()=>{if(workoutTimerFeedback.vibrationAvailable())toggleTimerPreference('vibration');});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.restTimerEndsAt&&state.restTimerEndsAt<=Date.now())completeRestTimer(state.restTimerEndsAt);});
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
bind('addRoutineExercise','click',()=>{const id=$('routineExerciseSelect').value;if(id&&!routineDraft.includes(id)){routineDraft.push(id);renderRoutineEditor();}});
bind('saveRoutine','click',saveRoutine);bind('resetRoutine','click',resetRoutine);bind('closeRoutineDialog','click',closeRoutineEditor);bind('routineDialog','click',e=>{if(e.target===$('routineDialog'))closeRoutineEditor();});
bind('weightForm','submit',e=>{e.preventDefault();state.weights.unshift({weight:Number($('bodyweight').value),date:new Date().toISOString()});$('bodyweight').value='';saveState();renderAll();});
bind('exportData','click',()=>{const backup=statePersistenceApi.prepareExport(state),blob=new Blob([backup.json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=backup.filename;a.click();URL.revokeObjectURL(url);});
bind('importData','change',async e=>{const file=e.target.files[0];if(!file)return;try{const imported=JSON.parse(await file.text()),result=statePersistenceApi.validateImport(imported);if(!result.ok){if(result.reason==='profile-mismatch'){alert(`This backup belongs to ${result.profileName}, not ${ACCOUNT.displayName}. Switch profiles before restoring it.`);return;}throw new Error('Invalid backup');}state=result.state;active=state.activeWorkout||null;const today=todaysWorkout();selectedDay=(active&&active.type)||(today==='Rest'?PROFILE.capabilities.restFallbackWorkout:today);saveState();renderAll();alert('Backup restored for '+ACCOUNT.displayName+'.');}catch{alert('That file is not a valid Big Gains backup.');}finally{e.target.value='';}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installButton').classList.remove('hidden');});
bind('installButton','click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installButton').classList.add('hidden');});
window.addEventListener('pagehide',saveState);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveState();});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).catch(console.warn));
notesApi.initialize({state,saveState});
progressApi.initialize({getState:()=>state,exercises:EXERCISES,slug,estimate1RM,fmtDate,escapeHtml,closeHistory,closeRoutineEditor});
retrospectiveApi.initialize();
renderAll();
