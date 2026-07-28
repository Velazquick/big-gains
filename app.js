const STORAGE_KEY='big-gains-v2';
const LEGACY_KEY='big-gains-v1';
const DEFAULT_REST=150;
const WEEK_PLAN={0:'Rest',1:'Push',2:'Pull',3:'Legs',4:'Push',5:'Pull',6:'Legs'};

const EXERCISES=[
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
].map(([name,day,muscle,equipment])=>({id:slug(name),name,day,muscle,equipment}));

const $=id=>document.getElementById(id);
let state=loadState();
let selectedDay=todaysWorkout();
let active=null;
let workoutTicker=null;
let timerTicker=null;
let timerRemaining=DEFAULT_REST;
let deferredPrompt=null;

function slug(v){return v.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
function uid(){return crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function blankState(){return {version:2,workouts:[],weights:[],prs:{}};}
function loadState(){
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if(saved)return {...blankState(),...saved};
    const legacy=JSON.parse(localStorage.getItem(LEGACY_KEY));
    if(legacy){const migrated={...blankState(),weights:legacy.weights||[],workouts:(legacy.workouts||[]).map(w=>({...w,durationSeconds:0,exercises:groupLegacySets(w.sets||[])}))};localStorage.setItem(STORAGE_KEY,JSON.stringify(migrated));return migrated;}
  }catch(e){console.warn('Could not load saved data',e);}
  return blankState();
}
function groupLegacySets(sets){const groups={};sets.forEach(s=>{const key=slug(s.exercise);groups[key]??={id:key,name:s.exercise,muscle:'',equipment:'',sets:[]};groups[key].sets.push({id:uid(),weight:Number(s.weight)||0,reps:Number(s.reps)||0,warmup:false,completed:true});});return Object.values(groups);}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function todaysWorkout(){const d=WEEK_PLAN[new Date().getDay()];return d==='Rest'?'Push':d;}
function fmtDate(iso){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso));}
function fmtTime(seconds){const m=Math.floor(seconds/60);const s=seconds%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function escapeHtml(v){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function allCompletedSets(){return state.workouts.flatMap(w=>(w.exercises||[]).flatMap(e=>(e.sets||[]).filter(s=>s.completed).map(s=>({...s,exercise:e.name}))));}
function volumeForWorkout(w){return (w.exercises||[]).flatMap(e=>e.sets||[]).filter(s=>s.completed&&!s.warmup).reduce((n,s)=>n+(Number(s.weight)||0)*(Number(s.reps)||0),0);}
function startOfWeek(){const d=new Date();const day=d.getDay();d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d;}
function estimate1RM(weight,reps){return reps>0?Math.round(weight*(1+reps/30)):0;}

function renderGreeting(){const h=new Date().getHours();$('greeting').textContent=`Good ${h<12?'morning':h<18?'afternoon':'evening'}, Jorge.`;$('nextWorkout').textContent=todaysWorkout()==='Legs'?'Legs + Core':todaysWorkout();}
function renderStats(){
  $('weeklyWorkouts').textContent=state.workouts.filter(w=>new Date(w.completedAt)>=startOfWeek()).length;
  $('trainingVolume').textContent=`${Math.round(state.workouts.reduce((n,w)=>n+volumeForWorkout(w),0)).toLocaleString('en-US')} lb`;
  $('prCount').textContent=Object.keys(state.prs||{}).length;
  $('latestWeight').textContent=state.weights[0]?`${state.weights[0].weight} lb`:'—';
}
function renderDayTabs(){document.querySelectorAll('#dayTabs button').forEach(b=>b.classList.toggle('active',b.dataset.day===selectedDay));}
function renderEquipment(){
  const select=$('equipmentFilter');
  if(select.options.length>1)return;
  [...new Set(EXERCISES.map(e=>e.equipment))].sort().forEach(eq=>select.add(new Option(eq,eq)));
}
function renderLibrary(){
  renderDayTabs();
  const q=$('exerciseSearch').value.trim().toLowerCase();
  const equipment=$('equipmentFilter').value;
  const list=EXERCISES.filter(e=>(e.day===selectedDay||selectedDay==='Other')&&(!q||`${e.name} ${e.muscle} ${e.equipment}`.toLowerCase().includes(q))&&(equipment==='all'||e.equipment===equipment));
  const box=$('exerciseLibrary');
  if(!list.length){box.innerHTML='<div class="no-results">No matching exercises. Try another search or equipment filter.</div>';return;}
  box.innerHTML=list.map(e=>`<article class="exercise-card ${active?.exercises.some(x=>x.id===e.id)?'added':''}"><div><span class="exercise-muscle">${escapeHtml(e.muscle)}</span><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.equipment)}</p></div><button class="add-exercise primary compact" data-add="${e.id}">${active?.exercises.some(x=>x.id===e.id)?'Added':'Add'}</button></article>`).join('');
}
function lastExercisePerformance(name){
  for(const w of state.workouts){const e=(w.exercises||[]).find(x=>x.name.toLowerCase()===name.toLowerCase());if(e){const sets=e.sets.filter(s=>s.completed&&!s.warmup);if(sets.length)return {date:w.completedAt,sets};}}
  return null;
}
function makeExercise(ex){
  const last=lastExercisePerformance(ex.name);
  const prior=last?.sets||[];
  const workingWeight=prior[0]?.weight||0;
  const warmupWeight=workingWeight?Math.round(workingWeight*.6/5)*5:0;
  return {id:ex.id,name:ex.name,muscle:ex.muscle,equipment:ex.equipment,sets:[
    {id:uid(),weight:warmupWeight,reps:10,warmup:true,completed:false},
    ...Array.from({length:3},(_,i)=>({id:uid(),weight:prior[i]?.weight||workingWeight,reps:prior[i]?.reps||'',warmup:false,completed:false}))
  ]};
}
function startWorkout(day=selectedDay){
  if(active)return;
  selectedDay=day;
  active={id:uid(),type:day,startedAt:new Date().toISOString(),exercises:[]};
  $('workoutPanel').classList.remove('hidden');$('activePanel').classList.remove('hidden');$('cancelWorkout').classList.remove('hidden');$('activeWorkoutTitle').textContent=day==='Legs'?'Legs + Core':day;
  clearInterval(workoutTicker);workoutTicker=setInterval(renderWorkoutClock,1000);renderWorkoutClock();renderActive();renderLibrary();$('activePanel').scrollIntoView({behavior:'smooth'});
}
function addExercise(id){
  if(!active)startWorkout(selectedDay);
  if(active.exercises.some(e=>e.id===id))return;
  const ex=EXERCISES.find(e=>e.id===id);if(!ex)return;
  active.exercises.push(makeExercise(ex));renderActive();renderLibrary();$('activePanel').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderWorkoutClock(){if(!active)return;const seconds=Math.max(0,Math.floor((Date.now()-new Date(active.startedAt))/1000));$('workoutClock').textContent=fmtTime(seconds);}
function renderActive(){
  if(!active)return;
  const box=$('activeExercises');
  if(!active.exercises.length){box.innerHTML='<div class="empty">Choose exercises below. Your usual set structure is added automatically.</div>';$('finishWorkout').disabled=true;return;}
  box.innerHTML=active.exercises.map((e,ei)=>{
    const last=lastExercisePerformance(e.name);
    const previous=last?`Last: ${last.sets.map(s=>`${s.weight} × ${s.reps}`).join(' · ')} · ${fmtDate(last.date)}`:'First time logged. Make the mark.';
    return `<article class="active-exercise" data-exercise-index="${ei}"><div class="exercise-head"><div><span class="exercise-muscle">${escapeHtml(e.muscle)}</span><h3>${escapeHtml(e.name)}</h3><p>${escapeHtml(e.equipment)}</p></div><button class="remove-exercise" data-remove-exercise="${ei}" aria-label="Remove exercise">✕</button></div><div class="previous-note">${escapeHtml(previous)}</div><div class="set-grid">${e.sets.map((s,si)=>`<div class="set-line ${s.completed?'completed':''}"><span class="set-number">${s.warmup?'W':si}</span><input data-field="weight" data-ei="${ei}" data-si="${si}" type="number" min="0" step="0.5" inputmode="decimal" value="${s.weight}" placeholder="lb" aria-label="Weight"><input data-field="reps" data-ei="${ei}" data-si="${si}" type="number" min="1" step="1" inputmode="numeric" value="${s.reps}" placeholder="reps" aria-label="Reps"><button class="set-done" data-complete-set="1" data-ei="${ei}" data-si="${si}" aria-label="Complete set">✓</button></div>`).join('')}</div><button class="add-set" data-add-set="${ei}">+ Add set</button></article>`;
  }).join('');
  $('finishWorkout').disabled=!active.exercises.some(e=>e.sets.some(s=>s.completed));
}
function startRestTimer(nextText='Recover. Your next set is waiting.'){
  timerRemaining=DEFAULT_REST;$('timerCard').classList.remove('hidden');$('timerNext').textContent=nextText;renderTimer();clearInterval(timerTicker);timerTicker=setInterval(()=>{timerRemaining--;renderTimer();if(timerRemaining<=0){clearInterval(timerTicker);$('timerNext').textContent='Rest complete. Go earn the next one.';navigator.vibrate?.([150,80,150]);}},1000);
}
function renderTimer(){$('timerDisplay').textContent=fmtTime(Math.max(0,timerRemaining));}
function finishWorkout(){
  if(!active)return;
  const completedExercises=active.exercises.map(e=>({...e,sets:e.sets.filter(s=>s.completed)})).filter(e=>e.sets.length);
  if(!completedExercises.length)return;
  const completedAt=new Date().toISOString();const durationSeconds=Math.floor((Date.now()-new Date(active.startedAt))/1000);
  const workout={...active,completedAt,durationSeconds,exercises:completedExercises};
  let newPRs=0;
  completedExercises.forEach(e=>e.sets.filter(s=>!s.warmup).forEach(s=>{const score=estimate1RM(Number(s.weight),Number(s.reps));if(score>(state.prs[e.id]?.estimated1RM||0)){state.prs[e.id]={exercise:e.name,estimated1RM:score,weight:Number(s.weight),reps:Number(s.reps),date:completedAt};newPRs++;}}));
  workout.prs=newPRs;state.workouts.unshift(workout);saveState();active=null;clearInterval(workoutTicker);clearInterval(timerTicker);$('activePanel').classList.add('hidden');$('timerCard').classList.add('hidden');$('cancelWorkout').classList.add('hidden');$('heroNote').textContent=`Workout saved${newPRs?` · ${newPRs} new PR${newPRs===1?'':'s'}`:''}. The pattern is getting clearer.`;renderAll();$('top').scrollIntoView({behavior:'smooth'});
}
function renderHistory(){
  const box=$('history');
  if(!state.workouts.length){box.className='history-list empty';box.textContent='Your completed workouts will appear here.';return;}
  box.className='history-list';box.innerHTML=state.workouts.slice(0,10).map(w=>{const sets=(w.exercises||[]).flatMap(e=>e.sets||[]).filter(s=>s.completed).length;return `<div class="history-item"><div><strong>${escapeHtml(w.type==='Legs'?'Legs + Core':w.type)}</strong><small>${fmtDate(w.completedAt)} · ${sets} sets · ${fmtTime(w.durationSeconds||0)}</small>${w.prs?`<span class="pr-badge">${w.prs} PR${w.prs===1?'':'s'}</span>`:''}</div><div class="history-meta"><strong>${Math.round(volumeForWorkout(w)).toLocaleString('en-US')} lb</strong><small>${(w.exercises||[]).length} exercises</small></div></div>`;}).join('');
}
function renderWeights(){const box=$('weightHistory');if(!state.weights.length){box.className='mini-list empty';box.textContent='No weigh-ins yet.';return;}box.className='mini-list';box.innerHTML=state.weights.slice(0,5).map(w=>`<div class="weight-row"><strong>${w.weight} lb</strong><small>${fmtDate(w.date)}</small></div>`).join('');}
function renderAll(){renderGreeting();renderStats();renderEquipment();renderLibrary();renderHistory();renderWeights();if(active)renderActive();}

$('dayTabs').addEventListener('click',e=>{const day=e.target.dataset.day;if(!day)return;selectedDay=day;$('equipmentFilter').value='all';$('exerciseSearch').value='';renderLibrary();});
$('exerciseSearch').addEventListener('input',renderLibrary);$('equipmentFilter').addEventListener('change',renderLibrary);
$('exerciseLibrary').addEventListener('click',e=>{const id=e.target.dataset.add;if(id)addExercise(id);});
$('startWorkout').addEventListener('click',()=>startWorkout(todaysWorkout()));
$('addExerciseButton').addEventListener('click',()=>{$('workoutPanel').scrollIntoView({behavior:'smooth'});$('exerciseSearch').focus();});
$('cancelWorkout').addEventListener('click',()=>{if(!active||confirm('Discard this workout?')){active=null;clearInterval(workoutTicker);clearInterval(timerTicker);$('activePanel').classList.add('hidden');$('timerCard').classList.add('hidden');$('cancelWorkout').classList.add('hidden');renderLibrary();}});
$('activeExercises').addEventListener('input',e=>{const {ei,si,field}=e.target.dataset;if(field&&active){active.exercises[Number(ei)].sets[Number(si)][field]=e.target.value===''?'':Number(e.target.value);}});
$('activeExercises').addEventListener('click',e=>{
  if(e.target.dataset.removeExercise!==undefined){active.exercises.splice(Number(e.target.dataset.removeExercise),1);renderActive();renderLibrary();return;}
  if(e.target.dataset.addSet!==undefined){active.exercises[Number(e.target.dataset.addSet)].sets.push({id:uid(),weight:'',reps:'',warmup:false,completed:false});renderActive();return;}
  if(e.target.dataset.completeSet){const set=active.exercises[Number(e.target.dataset.ei)].sets[Number(e.target.dataset.si)];if(!set.weight||!set.reps)return;set.completed=!set.completed;renderActive();if(set.completed)startRestTimer();}
});
$('finishWorkout').addEventListener('click',finishWorkout);
$('timerMinus').addEventListener('click',()=>{timerRemaining=Math.max(0,timerRemaining-15);renderTimer();});$('timerPlus').addEventListener('click',()=>{timerRemaining+=15;renderTimer();});$('timerSkip').addEventListener('click',()=>{clearInterval(timerTicker);$('timerCard').classList.add('hidden');});
$('weightForm').addEventListener('submit',e=>{e.preventDefault();state.weights.unshift({weight:Number($('bodyweight').value),date:new Date().toISOString()});$('bodyweight').value='';saveState();renderAll();});
$('exportData').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`big-gains-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);});
$('importData').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const imported=JSON.parse(await file.text());if(!Array.isArray(imported.workouts)||!Array.isArray(imported.weights))throw new Error('Invalid backup');if(confirm('Replace the data on this device with this backup?')){state={...blankState(),...imported};saveState();renderAll();}}catch{alert('That file is not a valid Big Gains backup.');}e.target.value='';});
document.querySelectorAll('.bottom-nav button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');$(btn.dataset.target).scrollIntoView({behavior:'smooth'});}));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installButton').classList.remove('hidden');});$('installButton').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installButton').classList.add('hidden');});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js'));
renderAll();