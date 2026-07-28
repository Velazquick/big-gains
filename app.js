const STORAGE_KEY='big-gains-v1';
const state=loadState();
let currentSets=[];
let deferredPrompt=null;
const $=id=>document.getElementById(id);

function loadState(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{workouts:[],weights:[]};}
  catch{return {workouts:[],weights:[]};}
}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
function fmtDate(iso){return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(iso));}
function startOfWeek(){const d=new Date();const day=d.getDay();d.setHours(0,0,0,0);d.setDate(d.getDate()-day);return d;}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function updateGreeting(){
  const h=new Date().getHours();
  $('greeting').textContent=`Good ${h<12?'morning':h<18?'afternoon':'evening'}, Jorge.`;
}
function renderStats(){
  const week=startOfWeek();
  const weekly=state.workouts.filter(w=>new Date(w.completedAt)>=week);
  const allSets=state.workouts.flatMap(w=>w.sets);
  const volume=allSets.reduce((n,s)=>n+(Number(s.weight)*Number(s.reps)),0);
  $('weeklyWorkouts').textContent=weekly.length;
  $('totalSets').textContent=allSets.length;
  $('trainingVolume').textContent=`${Math.round(volume).toLocaleString('en-US')} lb`;
  $('latestWeight').textContent=state.weights[0]?`${state.weights[0].weight} lb`:'—';
  const cycle=['Push','Pull','Legs'];
  const last=state.workouts[0]?.type;
  $('nextWorkout').textContent=cycle[(Math.max(cycle.indexOf(last),-1)+1)%cycle.length];
}
function renderCurrentSets(){
  const box=$('currentSets');
  $('finishWorkout').disabled=currentSets.length===0;
  if(!currentSets.length){box.className='set-list empty';box.textContent='No sets logged yet.';return;}
  box.className='set-list';
  box.innerHTML=currentSets.map((s,i)=>`<div class="set-row"><div><strong>${escapeHtml(s.exercise)}</strong><small>${s.weight} lb × ${s.reps}${s.rpe?` · RPE ${s.rpe}`:''}</small></div><button aria-label="Delete set" data-delete-set="${i}">✕</button></div>`).join('');
}
function renderHistory(){
  const box=$('history');
  if(!state.workouts.length){box.className='history-list empty';box.textContent='Your completed workouts will appear here.';return;}
  box.className='history-list';
  box.innerHTML=state.workouts.slice(0,8).map(w=>{const volume=w.sets.reduce((n,s)=>n+s.weight*s.reps,0);return `<div class="history-item"><div><strong>${escapeHtml(w.type)}</strong><small>${fmtDate(w.completedAt)} · ${w.sets.length} sets</small></div><strong>${Math.round(volume).toLocaleString('en-US')} lb</strong></div>`}).join('');
}
function renderWeights(){
  const box=$('weightHistory');
  if(!state.weights.length){box.className='mini-list empty';box.textContent='No weigh-ins yet.';return;}
  box.className='mini-list';
  box.innerHTML=state.weights.slice(0,5).map(w=>`<div class="weight-row"><strong>${w.weight} lb</strong><small>${fmtDate(w.date)}</small></div>`).join('');
}
function updateLastPerformance(){
  const name=$('exercise').value.trim().toLowerCase();
  if(!name){$('lastPerformance').textContent='Choose an exercise to see your last performance.';return;}
  for(const workout of state.workouts){
    const matches=workout.sets.filter(s=>s.exercise.toLowerCase()===name);
    if(matches.length){const best=matches.reduce((a,b)=>a.weight*b.reps>b.weight*a.reps?a:b);$('lastPerformance').textContent=`Last time: ${best.weight} lb × ${best.reps}${best.rpe?` at RPE ${best.rpe}`:''} · ${fmtDate(workout.completedAt)}`;return;}
  }
  $('lastPerformance').textContent='No previous sets found. First mark on the wall.';
}
function renderAll(){updateGreeting();renderStats();renderCurrentSets();renderHistory();renderWeights();updateLastPerformance();}

$('setForm').addEventListener('submit',e=>{
  e.preventDefault();
  currentSets.push({exercise:$('exercise').value.trim(),weight:Number($('weight').value),reps:Number($('reps').value),rpe:$('rpe').value?Number($('rpe').value):null});
  $('weight').value='';$('reps').value='';$('rpe').value='';renderCurrentSets();$('weight').focus();
});
$('currentSets').addEventListener('click',e=>{const i=e.target.dataset.deleteSet;if(i!==undefined){currentSets.splice(Number(i),1);renderCurrentSets();}});
$('exercise').addEventListener('input',updateLastPerformance);
$('finishWorkout').addEventListener('click',()=>{
  state.workouts.unshift({id:crypto.randomUUID?.()||String(Date.now()),type:$('workoutType').value,completedAt:new Date().toISOString(),sets:[...currentSets]});
  currentSets=[];saveState();renderAll();$('heroNote').textContent='Workout saved. The pattern is getting clearer.';
});
$('weightForm').addEventListener('submit',e=>{
  e.preventDefault();state.weights.unshift({weight:Number($('bodyweight').value),date:new Date().toISOString()});$('bodyweight').value='';saveState();renderAll();
});
$('startWorkout').addEventListener('click',()=>{$('loggerPanel').scrollIntoView({behavior:'smooth'});$('exercise').focus();});
document.querySelectorAll('.bottom-nav button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');const target=btn.dataset.target;target==='top'?scrollTo({top:0,behavior:'smooth'}):$(target).scrollIntoView({behavior:'smooth'});}));
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installButton').classList.remove('hidden');});
$('installButton').addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installButton').classList.add('hidden');});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./service-worker.js'));
renderAll();
