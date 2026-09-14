(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const config=window.__BIG_GAINS_CLOUD_CONFIG__;
  if(!config?.supabaseUrl || !config?.supabasePublishableKey){$('gate').textContent='Operator is not configured on this deployment.';return;}
  const client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{storageKey:'big-gains-supabase-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let section='overview',page=0,generation=0,authorized=false,detailUser=null,activeController;
  const esc=value=>String(value??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=value=>value?new Date(value).toLocaleString('en-US',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'}):'Not observed';
  const number=value=>Number(value||0).toLocaleString('en-US');
  const pct=(n,d)=>d?`${(100*n/d).toFixed(1)}%`:'—';
  const currentRelease=window.BIG_GAINS_ASSET_MANIFEST.release;
  $('release').textContent=`Production · ${currentRelease}`;
  function fail(message='Operator access is unavailable. Sign in to Big Gains with the authorized owner account, then return here.') {
    authorized=false;generation++;activeController?.abort();$('content').replaceChildren();$('console').hidden=true;$('gate').hidden=false;$('gate').textContent=message;
  }
  const metrics=entries=>`<div class="metrics">${entries.map(([label,value])=>`<div class="metric"><span>${esc(label)}</span><strong>${esc(number(value))}</strong></div>`).join('')}</div>`;
  const table=(headers,rows)=>rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(c=>`<tr>${c.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:'<p class="empty">No matching observations.</p>';
  const health=p=>[p.over_six_hours?'<span class="badge warning">Session ≥6 hours</span>':'',p.recent_errors?'<span class="badge error">Errors observed 7D</span>':'',p.recent_recovery?'<span class="badge warning">Recovery observed 7D</span>':''].filter(Boolean).join(' ') || '<span class="badge">No reported issue · coverage limited</span>';
  function overview(r) {
    return metrics([['Registered people',r.registered],['Email confirmed',r.confirmed],['Activated · ≥1 workout',r.activated],['App opens · people 7D',r.active_7d]])+
      '<h2>Activity</h2>'+table(['Window','People with app opens','Completed History workouts'],[['Today (UTC)',number(r.active_today),number(r.workouts_today)],['Past 7 days',number(r.active_7d),number(r.workouts_7d)],['Past 30 days',number(r.active_30d),number(r.workouts_30d)]])+
      '<h2>Reliability signals</h2>'+metrics([['Unfinished sessions',r.unfinished],['Sessions ≥6 hours old',r.over_six_hours],['Client error events · 7D',r.errors_7d],['Recovery/conflict events · 7D',r.recovery_events_7d]])+
      `<p class="notice">Six-hour sessions are a server-observable subset of the app’s stale-session rule. Recovery observations are historical signals, not current device status. ${number(r.telemetry_users_90d)} people have telemetry in the retained 90-day window. Last event: ${esc(date(r.last_event))} UTC.</p>`+
      '<h2>Most recently observed releases · 90D</h2>'+table(['Release','People','Compared with production'],r.releases.map(v=>[esc(v.release),number(v.users),v.release===currentRelease?'Current':'Other release']));
  }
  function users(r) {
    $('pagination').hidden=false;$('previous').disabled=page===0;$('next').disabled=(page+1)*r.page_size>=r.total;
    $('pageInfo').textContent=`${r.total? page*r.page_size+1:0}–${Math.min((page+1)*r.page_size,r.total)} of ${r.total}`;
    return table(['Person','Joined / confirmed','First workout','Latest activity','Workouts','Program / Freeform','Release / platform','Signals'],r.users.map(p=>[
      `<button class="person" data-user="${esc(p.user_id)}">${esc(p.display_name)}</button><small>${esc(p.email)}</small>`,
      `${esc(date(p.joined))}<small>${p.confirmed?'Confirmed':'Unconfirmed'}</small>`,esc(date(p.first_workout)),esc(date(p.last_activity)),number(p.workouts),
      `${p.program_active?'Active Program':'No active Program'}<small>${p.freeform_observed?'Freeform start observed 7D':'Freeform use unknown'}</small>`,
      `${esc(p.release || 'Not observed')}<small>${esc(p.platform || 'Unknown')}</small>`,health(p)]));
  }
  function detail(r) {
    if(r.not_found) return '<p class="empty">User not found.</p>';
    const fields=[['Email',r.email],['Joined',date(r.joined)],['Email confirmed',date(r.confirmed)],['First workout',date(r.first_workout)],['Second workout',date(r.second_workout)],['Last activity',date(r.last_activity)],['Completed workouts',number(r.workouts)],['Active Program',r.program_active?'Yes':'No'],['Unfinished sessions',number(r.unfinished)],['Release',r.release],['Platform / browser / mode',[r.platform,r.browser,r.mode].filter(Boolean).join(' / ')||'Not observed'],['Last telemetry',date(r.last_event)]];
    return `<button id="backUsers">← Users</button><h2>${esc(r.display_name)}</h2><p>${health(r)}</p><dl class="detail">${fields.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="notice">Latest activity combines History completion and observed app opens; completion may be retrospective. No private sets, loads, repetitions, bodyweight or notes are returned.</p><h2>Recent operational events · ${esc($('days').value)} days, latest 50</h2>`+
      table(['Received (UTC)','Event','Release','Environment','Category'],r.events.map(e=>[esc(date(e.received_at)),esc(e.event_name),esc(e.release),esc(`${e.platform} / ${e.browser} / ${e.mode}`),esc(e.category)]));
  }
  function funnel(r) {
    const stages=[['Registered',r.registered],['Email confirmed',r.confirmed],['First completed workout',r.activated],['Second completed workout',r.two_workouts]];
    return '<h2>Adoption</h2>'+table(['Milestone','People','% of registered'],stages.map(([label,n])=>[esc(label),number(n),pct(n,r.registered)]))+
      '<p class="notice">Milestone counts use current retained History. They are not a strictly nested conversion funnel: imported workouts can predate registration. App-open activity is shown separately because it does not require workout completion.</p>'+metrics([['≥4 completed workouts',r.four_workouts],['App opens · people 7D',r.active_7d],['App opens · people 30D',r.active_30d],['Active Program · people',r.program_users]])+
      `<p class="notice">Median time from registration to first workout: ${r.median_hours_to_first===null?'Not available':`${Number(r.median_hours_to_first).toFixed(1)} hours`} (${number(r.time_to_first_eligible)} eligible people; earlier imported/retrospective completions excluded). Freeform starts observed in 7D: ${number(r.freeform_observed_7d)} people.</p><h2>Return after first observed app open</h2>`+
      table(['Return day','Eligible people','Returned','Return %'],r.retention.map(c=>[`D${c.day}`,number(c.eligible),number(c.returned),pct(c.returned,c.eligible)]))+
      '<p class="notice">Exact UTC calendar-day return. Only fully elapsed return days qualify. Observations start with this release; offline and unavailable telemetry is missing.</p>';
  }
  function reliability(r) {
    return `<p class="notice">${number(r.observed_users)} people observed in this filter. Last event: ${esc(date(r.last_event))} UTC. Fixed error categories intentionally omit raw messages and stacks; groups may combine different underlying defects. Counts are not error rates.</p><h2>Client errors</h2>`+
      table(['Category / surface','Release','Platform / browser','Events','People','Latest'],r.errors.map(e=>[esc(`${e.category} / ${e.surface}`),esc(e.release),esc(`${e.platform} / ${e.browser}`),number(e.events),number(e.users),esc(date(e.latest))]))+
      '<h2>Recovery observations</h2>'+table(['Event','Events','People'],r.recovery.map(e=>[esc(e.event_name),number(e.events),number(e.users)]))+
      '<h2>Observed releases in period</h2>'+table(['Release','People','Events','Latest'],r.releases.map(e=>[esc(e.release),number(e.users),number(e.events),esc(date(e.latest))]));
  }
  async function load() {
    if(!authorized) return;
    const token=++generation;activeController?.abort();activeController=new AbortController();
    $('content').replaceChildren();$('pagination').hidden=true;$('status').textContent='Loading…';
    const request={section:detailUser?'detail':section,page,search:$('search').value,sort:$('sort').value,health:$('health').value,days:Number($('days').value),release:$('releaseFilter').value,platform:$('platform').value};
    if(detailUser) request.user_id=detailUser;
    const timeout=setTimeout(()=>activeController?.abort(),12000);
    try {
      const {data,error}=await client.rpc('operator_query',{request}).abortSignal(activeController.signal);
      if(token!==generation) return;
      if(error){if(error.code==='42501'){fail();return;}throw error;}
      if(!data || data.metric_contract!=='operator-v1') throw Error();
      $('content').innerHTML=detailUser?detail(data):({overview,users,funnel,reliability}[section])(data);
      $('status').textContent=`Updated ${date(data.as_of)} UTC`;
    } catch {if(token===generation){$('content').replaceChildren();$('status').textContent='Could not load operational data. Use Refresh to retry.';}}
    finally {clearTimeout(timeout);}
  }
  function select(next) {
    section=next;detailUser=null;page=0;
    for(const b of document.querySelectorAll('[data-section]')) b.setAttribute('aria-current',b.dataset.section===section?'page':'false');
    $('filters').hidden=!['users','reliability'].includes(section);
    for(const id of ['searchLabel','sortLabel','healthLabel']) $(id).hidden=section!=='users';
    for(const id of ['daysLabel','releaseLabel','platformLabel']) $(id).hidden=section!=='reliability';
    void load();
  }
  document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;if(b.dataset.section)select(b.dataset.section);if(b.dataset.user){detailUser=b.dataset.user;$('filters').hidden=true;void load();}if(b.id==='backUsers')select('users');});
  $('refresh').onclick=load;$('previous').onclick=()=>{page--;void load();};$('next').onclick=()=>{page++;void load();};
  $('filters').onsubmit=event=>{event.preventDefault();page=0;void load();};
  client.auth.onAuthStateChange((event)=>{
    if(['SIGNED_OUT','SIGNED_IN','USER_UPDATED','PASSWORD_RECOVERY'].includes(event))fail();
    // Auth callbacks must stay synchronous. Verify the new identity separately;
    // never retain the previous operator's results during an account switch.
    if(event==='SIGNED_IN')setTimeout(()=>void authorize(),0);
  });
  // Do not retain privileged DOM in the back-forward cache or after a tab hides.
  window.addEventListener('pagehide',()=>fail());
  async function authorize(){
    const ticket=++generation;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{const {data,error}=await client.rpc('operator_access').abortSignal(controller.signal);if(ticket!==generation || document.hidden)return;if(error||data!==true){fail();return;}authorized=true;$('gate').hidden=true;$('console').hidden=false;await load();}catch{if(ticket===generation)fail();}finally{clearTimeout(timeout);}
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)fail('Operator locked while hidden.');else void authorize();});
  void authorize();
})();
