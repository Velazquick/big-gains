const STORAGE_KEY = 'big-gains-v2';
const LEGACY_KEY = 'big-gains-v1';
const DEFAULT_REST = 150;
const WEEK_PLAN = {0:'Rest',1:'Push',2:'Pull',3:'Legs',4:'Push',5:'Pull',6:'Legs'};

const ROUTINES = {
  Push:{label:'Jorge Push',exercises:['Seated Machine Chest Press','Incline Iso Machine Press','Iso Machine Shoulder Press','Seated Pec Deck','Triceps Pushdown','Overhead Triceps Extension']},
  Pull:{label:'Pull — Back + Biceps',exercises:['Lat Pulldown','Seated Cable Row','Chest-Supported Row','Reverse Pec Deck','Dumbbell Curl','Hammer Curl']},
  Legs:{label:'Legs + Core',exercises:['Leg Press','Leg Extension','Seated Leg Curl','Romanian Deadlift','Standing Calf Raise','Cable Crunch','Hanging Knee Raise']},
  Cardio:{label:'Cardio',exercises:['Treadmill Run']},
  Other:{label:'Blank workout',exercises:[]}
};

const RAW = [
['Seated Machine Chest Press','Push','Chest','Machine'],['Incline Iso Machine Press','Push','Chest','Machine'],['Smith Machine Incline Press','Push','Chest','Smith Machine'],['Barbell Bench Press','Push','Chest','Barbell'],['Dumbbell Bench Press','Push','Chest','Dumbbell'],['Incline Dumbbell Press','Push','Chest','Dumbbell'],['Cable Chest Fly','Push','Chest','Cable'],['Seated Pec Deck','Push','Chest','Machine'],['Push-Up','Push','Chest','Bodyweight'],['Dips','Push','Chest / Triceps','Bodyweight'],
['Iso Machine Shoulder Press','Push','Shoulders','Machine'],['Dumbbell Shoulder Press','Push','Shoulders','Dumbbell'],['Barbell Overhead Press','Push','Shoulders','Barbell'],['Machine Shoulder Press','Push','Shoulders','Machine'],['Dumbbell Lateral Raise','Push','Shoulders','Dumbbell'],['Cable Lateral Raise','Push','Shoulders','Cable'],['Reverse Pec Deck','Pull','Rear Delts','Machine'],['Face Pull','Pull','Rear Delts','Cable'],
['Overhead Triceps Extension','Push','Triceps','Cable'],['Triceps Pushdown','Push','Triceps','Cable'],['Rope Pushdown','Push','Triceps','Cable'],['Skull Crusher','Push','Triceps','EZ Bar'],['Close-Grip Bench Press','Push','Triceps','Barbell'],['Single-Arm Cable Extension','Push','Triceps','Cable'],
['Lat Pulldown','Pull','Back','Cable'],['Assisted Pull-Up','Pull','Back','Machine'],['Pull-Up','Pull','Back','Bodyweight'],['Seated Cable Row','Pull','Back','Cable'],['Chest-Supported Row','Pull','Back','Machine'],['T-Bar Row','Pull','Back','Machine'],['Barbell Row','Pull','Back','Barbell'],['One-Arm Dumbbell Row','Pull','Back','Dumbbell'],['Iso-Lateral Row','Pull','Back','Machine'],['Straight-Arm Pulldown','Pull','Back','Cable'],['Machine Pullover','Pull','Back','Machine'],['Rack Pull','Pull','Back','Barbell'],
['Dumbbell Curl','Pull','Biceps','Dumbbell'],['Hammer Curl','Pull','Biceps','Dumbbell'],['Incline Dumbbell Curl','Pull','Biceps','Dumbbell'],['Preacher Curl','Pull','Biceps','EZ Bar'],['Machine Preacher Curl','Pull','Biceps','Machine'],['Cable Curl','Pull','Biceps','Cable'],['Bayesian Cable Curl','Pull','Biceps','Cable'],['EZ-Bar Curl','Pull','Biceps','EZ Bar'],
['Back Squat','Legs','Quads / Glutes','Barbell'],['Front Squat','Legs','Quads','Barbell'],['Hack Squat','Legs','Quads / Glutes','Machine'],['Leg Press','Legs','Quads / Glutes','Machine'],['Smith Machine Squat','Legs','Quads / Glutes','Smith Machine'],['Goblet Squat','Legs','Quads / Glutes','Dumbbell'],['Bulgarian Split Squat','Legs','Quads / Glutes','Dumbbell'],['Walking Lunge','Legs','Quads / Glutes','Dumbbell'],['Leg Extension','Legs','Quads','Machine'],
['Romanian Deadlift','Legs','Hamstrings / Glutes','Barbell'],['Dumbbell Romanian Deadlift','Legs','Hamstrings / Glutes','Dumbbell'],['Seated Leg Curl','Legs','Hamstrings','Machine'],['Lying Leg Curl','Legs','Hamstrings','Machine'],['Hip Thrust','Legs','Glutes','Barbell'],['Glute Bridge','Legs','Glutes','Bodyweight'],['Cable Pull-Through','Legs','Glutes','Cable'],['Standing Calf Raise','Legs','Calves','Machine'],['Seated Calf Raise','Legs','Calves','Machine'],
['Cable Crunch','Legs','Core','Cable'],['Hanging Knee Raise','Legs','Core','Bodyweight'],['Hanging Leg Raise','Legs','Core','Bodyweight'],['Ab Wheel Rollout','Legs','Core','Bodyweight'],['Plank','Legs','Core','Bodyweight'],['Side Plank','Legs','Core','Bodyweight'],['Pallof Press','Legs','Core','Cable'],['Machine Crunch','Legs','Core','Machine'],['Russian Twist','Legs','Core','Bodyweight'],['Dead Bug','Legs','Core','Bodyweight'],
['Treadmill Run','Cardio','Cardio','Treadmill'],['Outdoor Run','Cardio','Cardio','None'],['Incline Walk','Cardio','Cardio','Treadmill'],['Stair Climber','Cardio','Cardio','Machine'],['Stationary Bike','Cardio','Cardio','Bike'],['Elliptical','Cardio','Cardio','Machine'],['Rowing Machine','Cardio','Cardio','Machine'],
['Deadlift','Other','Full Body','Barbell'],['Trap Bar Deadlift','Other','Full Body','Trap Bar'],['Farmer Carry','Other','Full Body','Dumbbell'],['Kettlebell Swing','Other','Full Body','Kettlebell']
];

const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const EXERCISES = RAW.map(([name,day,muscle,equipment]) => ({id:slug(name),name,day,muscle,equipment}));
const $ = id => document.getElementById(id);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

let state = loadState();
let selectedDay = todaysWorkout();
let active = null;
let workoutTicker = null;
let timerTicker = null;
let timerRemaining = DEFAULT_REST;
let deferredPrompt = null;
let cancelArmedUntil = 0;

function blankState(){return {version:2,workouts:[],weights:[],prs:{}};}
function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved) return {...blankState(),...saved};
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY));
    if(legacy){
      const migrated = {...blankState(),weights:legacy.weights || [],workouts:[]};
      localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));
      return migrated;
    }
  }catch(error){console.warn('Could not load Big Gains data',error);}
  return blankState();
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function todaysWorkout(){const day=WEEK_PLAN[new Date().getDay()];return day==='Rest'?'Push':day;}
function fmtDate(iso){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso));}
function fmtTime(seconds){seconds=Math.max(0,Math.floor(seconds));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));}
function startOfWeek(){const date=new Date();date.setHours(0,0,0,0);date.setDate(date.getDate()-date.getDay());return date;}
function volumeForWorkout(workout){return (workout.exercises||[]).flatMap(exercise=>exercise.sets||[]).filter(set=>set.completed&&!set.warmup).reduce((total,set)=>total+(Number(set.weight)||0)*(Number(set.reps)||0),0);}
function estimate1RM(weight,reps){return reps>0?Math.round(weight*(1+reps/30)):0;}

function renderGreeting(){
  const hour=new Date().getHours();
  $('greeting').textContent=`Good ${hour<12?'morning':hour<18?'afternoon':'evening'}, Jorge.`;
  $('nextWorkout').textContent=todaysWorkout()==='Legs'?'Legs + Core':todaysWorkout();
}
function renderStats(){
  $('weeklyWorkouts').textContent=state.workouts.filter(workout=>new Date(workout.completedAt)>=startOfWeek()).length;
  $('trainingVolume').textContent=`${Math.round(state.workouts.reduce((total,workout)=>total+volumeForWorkout(workout),0)).toLocaleString('en-US')} lb`;
  $('prCount').textContent=Object.keys(state.prs||{}).length;
  $('latestWeight').textContent=state.weights[0]?`${state.weights[0].weight} lb`:'—';
}
function renderSelectors(){
  document.querySelectorAll('#dayTabs button').forEach(button=>button.classList.toggle('active',button.dataset.day===selectedDay));
  $('routineSelect').innerHTML=`<option value="${selectedDay}">${ROUTINES[selectedDay].label}</option>`;
  const list=EXERCISES.filter(exercise=>exercise.day===selectedDay||selectedDay==='Other');
  $('quickExerciseSelect').innerHTML=list.map(exercise=>`<option value="${exercise.id}">${escapeHtml(exercise.name)} — ${escapeHtml(exercise.equipment)}</option>`).join('');
}
function renderEquipment(){
  if($('equipmentFilter').options.length>1)return;
  [...new Set(EXERCISES.map(exercise=>exercise.equipment))].sort().forEach(equipment=>$('equipmentFilter').add(new Option(equipment,equipment)));
}
function renderLibrary(){
  renderSelectors();
  const query=$('exerciseSearch').value.trim().toLowerCase();
  const equipment=$('equipmentFilter').value;
  const list=EXERCISES.filter(exercise=>(exercise.day===selectedDay||selectedDay==='Other')&&(!query||`${exercise.name} ${exercise.muscle} ${exercise.equipment}`.toLowerCase().includes(query))&&(equipment==='all'||exercise.equipment===equipment));
  $('exerciseLibrary').innerHTML=list.length?list.map(exercise=>`<article class="exercise-card ${active&&active.exercises.some(item=>item.id===exercise.id)?'added':''}"><div><span class="exercise-muscle">${escapeHtml(exercise.muscle)}</span><h3>${escapeHtml(exercise.name)}</h3><p>${escapeHtml(exercise.equipment)}</p></div><button type="button" class="add-exercise primary compact" data-add="${exercise.id}">${active&&active.exercises.some(item=>item.id===exercise.id)?'Added':'Add'}</button></article>`).join(''):'<div class="no-results">No matching exercises.</div>';
}
function lastPerformance(name){
  for(const workout of state.workouts){
    const exercise=(workout.exercises||[]).find(item=>item.name.toLowerCase()===name.toLowerCase());
    if(exercise){const sets=exercise.sets.filter(set=>set.completed&&!set.warmup);if(sets.length)return {date:workout.completedAt,sets};}
  }
  return null;
}
function makeExercise(exercise){
  const last=lastPerformance(exercise.name);
  const prior=last?last.sets:[];
  const working=prior[0]?Number(prior[0].weight)||0:0;
  const warm=working?Math.round(working*.6/5)*5:0;
  return {id:exercise.id,name:exercise.name,muscle:exercise.muscle,equipment:exercise.equipment,sets:[
    {id:uid(),weight:warm,reps:10,warmup:true,completed:false},
    ...Array.from({length:3},(_,index)=>({id:uid(),weight:prior[index]?Number(prior[index].weight)||working:working,reps:prior[index]?Number(prior[index].reps)||'':'',warmup:false,completed:false}))
  ]};
}
function startWorkout(day=selectedDay,load=true){
  if(active)return;
  selectedDay=day;
  active={id:uid(),type:day,startedAt:new Date().toISOString(),exercises:[]};
  if(load)loadRoutine(day,false);
  $('activePanel').classList.remove('hidden');
  $('cancelWorkout').classList.remove('hidden');
  $('cancelWorkout').textContent='Cancel';
  $('activeWorkoutTitle').textContent=day==='Legs'?'Legs + Core':day;
  clearInterval(workoutTicker);
  workoutTicker=setInterval(renderWorkoutClock,1000);
  renderWorkoutClock();renderActive();renderLibrary();
  $('activePanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function addExercise(id,scroll=true){
  if(!active)startWorkout(selectedDay,false);
  if(active.exercises.some(exercise=>exercise.id===id))return;
  const exercise=EXERCISES.find(item=>item.id===id);
  if(!exercise)return;
  active.exercises.push(makeExercise(exercise));
  renderActive();renderLibrary();
  if(scroll)$('activePanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function loadRoutine(day=selectedDay,scroll=true){
  if(!active)startWorkout(day,false);
  ROUTINES[day].exercises.forEach(name=>{const exercise=EXERCISES.find(item=>item.name===name);if(exercise&&!active.exercises.some(item=>item.id===exercise.id))active.exercises.push(makeExercise(exercise));});
  renderActive();renderLibrary();
  if(scroll)$('activePanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderWorkoutClock(){if(active)$('workoutClock').textContent=fmtTime((Date.now()-new Date(active.startedAt))/1000);}
function stepper(field,exerciseIndex,setIndex,value,step){
  return `<div class="stepper"><button type="button" data-adjust="-${step}" data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Decrease ${field}">−</button><input data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" type="number" min="0" step="${step}" inputmode="decimal" value="${value}" placeholder="${field==='weight'?'lb':'reps'}"><button type="button" data-adjust="${step}" data-field="${field}" data-ei="${exerciseIndex}" data-si="${setIndex}" aria-label="Increase ${field}">+</button></div>`;
}
function renderActive(){
  if(!active)return;
  const box=$('activeExercises');
  if(!active.exercises.length){box.innerHTML='<div class="empty">Choose a routine or an exercise above.</div>';$('finishWorkout').disabled=true;return;}
  box.innerHTML=active.exercises.map((exercise,exerciseIndex)=>{
    const last=lastPerformance(exercise.name);
    const previous=last?`Last: ${last.sets.map(set=>`${set.weight} × ${set.reps}`).join(' · ')}`:'First time logged.';
    const sets=exercise.sets.map((set,setIndex)=>`<div class="set-line ${set.completed?'completed':''}"><span class="set-number">${set.warmup?'W':setIndex}</span>${stepper('weight',exerciseIndex,setIndex,set.weight,5)}${stepper('reps',exerciseIndex,setIndex,set.reps,1)}<button type="button" class="set-done" data-complete-set="1" data-ei="${exerciseIndex}" data-si="${setIndex}">✓</button></div>`).join('');
    return `<article class="active-exercise"><div class="exercise-head"><div><span class="exercise-muscle">${escapeHtml(exercise.muscle)}</span><h3>${escapeHtml(exercise.name)}</h3><p>${escapeHtml(exercise.equipment)}</p></div><button type="button" class="remove-exercise" data-remove-exercise="${exerciseIndex}">✕</button></div><div class="previous-note">${escapeHtml(previous)}</div><div class="set-grid">${sets}</div><button type="button" class="add-set" data-add-set="${exerciseIndex}">+ Add set</button></article>`;
  }).join('');
  $('finishWorkout').disabled=!active.exercises.some(exercise=>exercise.sets.some(set=>set.completed));
}
function startRestTimer(){
  timerRemaining=DEFAULT_REST;$('timerCard').classList.remove('hidden');$('timerNext').textContent='Recover. Your next set is waiting.';renderTimer();clearInterval(timerTicker);
  timerTicker=setInterval(()=>{timerRemaining--;renderTimer();if(timerRemaining<=0){clearInterval(timerTicker);$('timerNext').textContent='Rest complete. Go earn the next one.';if(navigator.vibrate)navigator.vibrate([150,80,150]);}},1000);
}
function renderTimer(){$('timerDisplay').textContent=fmtTime(timerRemaining);}
function discardWorkout(){active=null;clearInterval(workoutTicker);clearInterval(timerTicker);$('activePanel').classList.add('hidden');$('timerCard').classList.add('hidden');$('cancelWorkout').classList.add('hidden');$('cancelWorkout').textContent='Cancel';cancelArmedUntil=0;renderLibrary();$('workoutPanel').scrollIntoView({behavior:'smooth'});}
function finishWorkout(){
  if(!active)return;
  const completed=active.exercises.map(exercise=>({...exercise,sets:exercise.sets.filter(set=>set.completed)})).filter(exercise=>exercise.sets.length);
  if(!completed.length)return;
  const completedAt=new Date().toISOString();
  const durationSeconds=Math.floor((Date.now()-new Date(active.startedAt))/1000);
  const workout={...active,completedAt,durationSeconds,exercises:completed};
  let newPRs=0;
  completed.forEach(exercise=>exercise.sets.filter(set=>!set.warmup).forEach(set=>{const score=estimate1RM(Number(set.weight),Number(set.reps));if(score>((state.prs[exercise.id]&&state.prs[exercise.id].estimated1RM)||0)){state.prs[exercise.id]={exercise:exercise.name,estimated1RM:score,weight:Number(set.weight),reps:Number(set.reps),date:completedAt};newPRs++;}}));
  workout.prs=newPRs;state.workouts.unshift(workout);saveState();active=null;clearInterval(workoutTicker);clearInterval(timerTicker);$('activePanel').classList.add('hidden');$('timerCard').classList.add('hidden');$('cancelWorkout').classList.add('hidden');$('heroNote').textContent=`Workout saved${newPRs?` · ${newPRs} new PR${newPRs===1?'':'s'}`:''}.`;renderAll();$('top').scrollIntoView({behavior:'smooth'});
}
function renderHistory(){
  const box=$('history');
  if(!state.workouts.length){box.className='history-list empty';box.textContent='Your completed workouts will appear here.';return;}
  box.className='history-list';
  box.innerHTML=state.workouts.slice(0,10).map(workout=>`<div class="history-item"><div><strong>${escapeHtml(workout.type==='Legs'?'Legs + Core':workout.type)}</strong><small>${fmtDate(workout.completedAt)} · ${(workout.exercises||[]).flatMap(exercise=>exercise.sets||[]).length} sets · ${fmtTime(workout.durationSeconds||0)}</small></div><div class="history-meta"><strong>${Math.round(volumeForWorkout(workout)).toLocaleString('en-US')} lb</strong><small>${(workout.exercises||[]).length} exercises</small></div></div>`).join('');
}
function renderWeights(){const box=$('weightHistory');if(!state.weights.length){box.className='mini-list empty';box.textContent='No weigh-ins yet.';return;}box.className='mini-list';box.innerHTML=state.weights.slice(0,5).map(item=>`<div class="weight-row"><strong>${item.weight} lb</strong><small>${fmtDate(item.date)}</small></div>`).join('');}
function renderAll(){renderGreeting();renderStats();renderEquipment();renderLibrary();renderHistory();renderWeights();if(active)renderActive();}
function bind(id,event,handler){const element=$(id);if(element)element.addEventListener(event,handler);}

bind('dayTabs','click',event=>{const button=event.target.closest('[data-day]');if(!button)return;selectedDay=button.dataset.day;$('equipmentFilter').value='all';$('exerciseSearch').value='';renderLibrary();});
bind('startWorkout','click',()=>startWorkout(todaysWorkout(),true));
bind('loadRoutine','click',()=>{if(active)discardWorkout();startWorkout(selectedDay,true);});
bind('addSelectedExercise','click',()=>addExercise($('quickExerciseSelect').value));
bind('exerciseSearch','input',renderLibrary);
bind('equipmentFilter','change',renderLibrary);
bind('exerciseLibrary','click',event=>{const button=event.target.closest('[data-add]');if(button)addExercise(button.dataset.add);});
bind('cancelWorkout','click',()=>{const now=Date.now();if(now<cancelArmedUntil){discardWorkout();return;}cancelArmedUntil=now+2500;$('cancelWorkout').textContent='Tap again to discard';setTimeout(()=>{if(active&&Date.now()>=cancelArmedUntil)$('cancelWorkout').textContent='Cancel';},2600);});
bind('activeExercises','input',event=>{const {ei,si,field}=event.target.dataset;if(field&&active&&event.target.tagName==='INPUT')active.exercises[Number(ei)].sets[Number(si)][field]=event.target.value===''?'':Number(event.target.value);});
bind('activeExercises','click',event=>{
  const target=event.target.closest('button');if(!target||!active)return;
  if(target.dataset.removeExercise!==undefined){active.exercises.splice(Number(target.dataset.removeExercise),1);renderActive();renderLibrary();return;}
  if(target.dataset.addSet!==undefined){active.exercises[Number(target.dataset.addSet)].sets.push({id:uid(),weight:'',reps:'',warmup:false,completed:false});renderActive();return;}
  if(target.dataset.adjust!==undefined){const set=active.exercises[Number(target.dataset.ei)].sets[Number(target.dataset.si)];const field=target.dataset.field;const next=Math.max(0,(Number(set[field])||0)+Number(target.dataset.adjust));set[field]=next;renderActive();return;}
  if(target.dataset.completeSet){const set=active.exercises[Number(target.dataset.ei)].sets[Number(target.dataset.si)];if(!Number(set.weight)||!Number(set.reps))return;set.completed=!set.completed;renderActive();if(set.completed)startRestTimer();}
});
bind('finishWorkout','click',finishWorkout);
bind('timerMinus','click',()=>{timerRemaining=Math.max(0,timerRemaining-15);renderTimer();});
bind('timerPlus','click',()=>{timerRemaining+=15;renderTimer();});
bind('timerSkip','click',()=>{clearInterval(timerTicker);$('timerCard').classList.add('hidden');});
bind('weightForm','submit',event=>{event.preventDefault();state.weights.unshift({weight:Number($('bodyweight').value),date:new Date().toISOString()});$('bodyweight').value='';saveState();renderAll();});
bind('exportData','click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`big-gains-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);});
bind('importData','change',async event=>{const file=event.target.files[0];if(!file)return;try{const imported=JSON.parse(await file.text());if(!Array.isArray(imported.workouts)||!Array.isArray(imported.weights))throw new Error('Invalid backup');state={...blankState(),...imported};saveState();renderAll();alert('Backup restored.');}catch(error){alert('That file is not a valid Big Gains backup.');}event.target.value='';});

document.addEventListener('click',event=>{const button=event.target.closest('.bottom-nav button');if(!button)return;const target=$(button.dataset.target);if(!target)return;document.querySelectorAll('.bottom-nav button').forEach(item=>item.classList.toggle('active',item===button));target.scrollIntoView({behavior:'smooth',block:'start'});});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;$('installButton').classList.remove('hidden');});
bind('installButton','click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installButton').classList.add('hidden');});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js').catch(console.warn));

renderAll();