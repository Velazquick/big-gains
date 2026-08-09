(() => {
  'use strict';

  const alexaDays = ['PilatesPull','LegsLowImpact','PilatesCardioAccessory','Optional','FullBody','Cardio','Other'];
  let initialized = false;

  function renderProfileShell() {
    const isAlexa = PROFILE.id === 'alexa';
    document.querySelector('.eyebrow').textContent = isAlexa ? 'BIG GAINS · WELLNESS' : 'BIG GAINS';
    document.querySelector('.bottom-nav [data-view="library"]').textContent = isAlexa ? 'Garden' : 'Library';
    document.querySelector('#viewLibrary .v2-page-head .label').textContent = isAlexa ? 'Garden' : 'Library';
    document.querySelector('#viewLibrary .v2-page-head h2').textContent = isAlexa ? 'Your care, growing.' : 'Build the work.';
    document.querySelector('#viewLibrary .v2-page-head p').textContent = isAlexa ? 'Every completed session adds life. Rest never takes anything away.' : 'Choose routines, edit your lineup, or find a movement.';
    if (!isAlexa) return;
    document.querySelector('#viewToday .v2-page-head h2').textContent = 'A little care for today.';
    document.querySelector('#viewToday .v2-page-head p').textContent = 'Show up gently. Momentum will do the rest.';
    document.querySelector('#viewTrain .v2-page-head h2').textContent = 'Move with intention.';
    document.querySelector('#viewTrain .v2-page-head p').textContent = 'One movement at a time. You can return whenever you’re ready.';
    document.querySelector('#viewProgress .v2-page-head h2').textContent = 'Notice what is changing.';
    document.querySelector('#viewProgress .v2-page-head p').textContent = 'Strength, consistency, and wellbeing—not perfection.';
    const tabs = document.getElementById('dayTabs');
    tabs.innerHTML = alexaDays.map(day => `<button data-day="${day}" type="button">${DEFAULT_ROUTINES[day]?.label || day}</button>`).join('');
    renderGarden();
    renderLibrary();
  }

  function renderGarden() {
    const garden = document.getElementById('gardenPanel');
    if (!garden || PROFILE.id !== 'alexa') return;
    const count = state.workouts.length;
    const stage = count === 0 ? 0 : count < 4 ? 1 : count < 8 ? 2 : count < 16 ? 3 : 4;
    const stages = ['A seed is waiting for you.','Your first leaves are here.','New blossoms are opening.','Your garden is filling in.','Look at everything you have grown.'];
    const flowers = Array.from({length:12},(_,i)=>`<span class="garden-bloom ${i < Math.min(12,count) ? 'is-grown' : ''}" aria-hidden="true">${i%3===0?'✿':i%3===1?'❀':'✦'}</span>`).join('');
    const target = new Date(PROFILE.goals.targetDate+'T12:00:00');
    const days = Math.max(0,Math.ceil((target-Date.now())/86400000));
    garden.innerHTML = `<div class="garden-copy"><span class="label">Consistency garden</span><h2>${stages[stage]}</h2><p>${count} completed movement${count===1?'':'s'} have helped it grow. Missed days never undo your care.</p></div><div class="garden-bed" aria-label="Garden with ${count} completed workouts">${flowers}</div><div class="goal-grid"><div><span>Primary goal</span><strong>Weight loss</strong></div><div><span>Starting point</span><strong>225 lb</strong></div><div><span>Growing</span><strong>Glutes, legs & back</strong></div><div><span>December 20</span><strong>${days} days to nurture</strong></div></div>`;
  }

  function initialize() {
    if (initialized) return false;
    initialized = true;
    document.getElementById('finishWorkout')?.addEventListener('click',()=>setTimeout(renderGarden,120));
    window.addEventListener('pageshow',renderProfileShell);
    renderProfileShell();
    return true;
  }

  window.bigGainsProfileShell = Object.freeze({ initialize, renderGarden, renderProfileShell });
})();
