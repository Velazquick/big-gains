(() => {
  'use strict';
  const $=id=>document.getElementById(id),config=window.__BIG_GAINS_CLOUD_CONFIG__;
  if(!config?.supabaseUrl||!config?.supabasePublishableKey){$('gate').textContent='Operator is not configured on this deployment.';return;}
  const client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{storageKey:'big-gains-supabase-auth-v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  let section='overview',page=0,generation=0,authorized=false,detailUser=null,fingerprint=null,activeController;
  const trail=[],filterIds=['search','sort','health','days','releaseFilter','platform','browserFilter','modeFilter','signalFilter','sourceFilter','eventFilter'];
  const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=v=>Number(v||0).toLocaleString();
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone;
  const date=v=>v?new Date(v).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'medium'}):'Not observed';
  const timestamp=(v,empty='Not observed')=>v?`<time datetime="${esc(new Date(v).toISOString())}" title="${esc(new Date(v).toISOString())} · UTC">${esc(date(v))}</time>`:esc(empty);
  const pct=(n,d)=>d?`${(100*n/d).toFixed(1)}%`:'Not enough observations';
  const list=v=>esc((v||[]).join(' · '));
  const label=v=>String(v||'').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
  const currentRelease=window.BIG_GAINS_ASSET_MANIFEST.release;
  $('release').textContent=`Production · ${currentRelease}`;
  $('notice').textContent=`Times: ${zone}. Daily counts and Today use UTC. App opens are authenticated observations; public visitor sessions are separate. Missing telemetry is unknown, not proof of inactivity or health.`;
  function fail(message='Operator access is unavailable. Sign in to Big Gains with the authorized owner account, then return here.'){
    authorized=false;generation++;activeController?.abort();$('content').replaceChildren();$('console').hidden=true;$('gate').hidden=false;$('gate').textContent=message;
  }
  const metrics=entries=>`<div class="metrics">${entries.map(([name,value])=>`<div class="metric"><span>${esc(name)}</span><strong>${esc(number(value))}</strong></div>`).join('')}</div>`;
  const empty='<p class="empty">No matching observations.</p>';
  const table=(headers,rows)=>rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(c=>`<tr>${c.map(v=>`<td>${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:empty;
  const userLink=(id,name='View user')=>`<button class="person" data-user="${esc(id)}">${esc(name)}</button>`;
  const diagnosticLink=fp=>fp?`<button class="fingerprint" data-fingerprint="${esc(fp)}">${esc(fp)}</button>`:'<span class="badge">Legacy coarse telemetry · cause unavailable</span>';
  const health=p=>[p.open_episodes?`<span class="badge warning">${number(p.open_episodes)} unclosed tab episodes</span>`:'',p.over_six_hours?`<span class="badge warning">${number(p.over_six_hours)} session ≥6h</span>`:'',p.unfinished?`<span class="badge">${number(p.unfinished)} unfinished</span>`:'',p.recent_errors?'<span class="badge error">Diagnostic error · 7D</span>':'',p.recent_recovery?'<span class="badge warning">Recovery observed · 7D</span>':''].filter(Boolean).join(' ')||'<span class="badge">No reported issue · coverage limited</span>';
  function paginate(total,size){$('pagination').hidden=false;$('previous').disabled=page===0;$('next').disabled=(page+1)*size>=total;$('pageInfo').textContent=`${total?page*size+1:0}–${Math.min((page+1)*size,total)} of ${total}`;}
  function timeline(events){return events?.length?`<ol class="timeline">${events.map(e=>`<li><div>${timestamp(e.received_at||e.at)}<small>${e.authoritative?'Persisted account fact':'Telemetry receipt'}</small></div><div><strong>${esc(label(e.event_name||e.event))}</strong> ${e.diagnostic_fingerprint?diagnosticLink(e.diagnostic_fingerprint):''}${e.event_name==='app_error'&&!e.diagnostic_fingerprint?diagnosticLink(null):''}<small>${esc([e.release,e.platform,e.browser,e.mode].filter(Boolean).join(' · '))}</small>${e.user_id?userLink(e.user_id):''}</div></li>`).join('')}</ol>`:empty;}
  function traffic(r){const t=r.visitor_windows||{};return '<h2>Public arrival sessions · before sign-in</h2>'+metrics([['Today · UTC',t.today],['7 days',t.days7],['30 days',t.days30]])+
    '<p class="notice">Accepted public observations, starting with v115, excluding known signed-in visitors. A random tab-scoped session lasts up to 30 minutes. Sessions are not unique people. Reloads deduplicate; another browser/device may count separately. Offline visits, blocked telemetry and rate limits reduce coverage; bots can inflate it. No fingerprinting, Auth identity or referrer URL is collected.</p>'+
    table(['Campaign','Visitor sessions','Signup reached','Signup started','Started / sessions'],(r.traffic||[]).map(t=>[esc(t.source),number(t.sessions),number(t.signup_reached),number(t.signup_started),pct(t.signup_started,t.sessions)]))+
    '<p class="notice">Campaigns: direct, beta-wave-1, beta-wave-2. Signup stages use sessions whose arrival falls in the selected period. Accounts are not linked to anonymous sessions; no session-to-account conversion percentage is claimed. First-time versus returning anonymous people cannot be established.</p>'+'<h2>Account milestones · separate people</h2>'+metrics([['Registered people',r.registered],['Confirmed people',r.confirmed],['Activated people',r.activated],['New registrations · period',r.new_registrations]])+table(['Platform','Browser','Mode','Sessions'],(r.visitor_environments||[]).map(t=>[esc(t.platform),esc(t.browser),esc(t.mode),number(t.sessions)]));}
  function overview(r){
    const daily=r.daily||[],max=Math.max(1,...daily.map(d=>Number(d.people)));
    return metrics([['Registered people',r.registered],['Confirmed',r.confirmed],['Activated · completed workout',r.activated],['Observed authenticated people',r.observed_people]])+
      '<h2>Activity windows</h2>'+metrics([['App-open people · Today UTC',r.active_today],['App-open people · 7D',r.active_7d],['App-open people · 30D',r.active_30d],['Completed workouts · 7D',r.workouts_7d]])+'<h2>Selected period</h2>'+metrics([['New registrations',r.new_registrations],['Returning observed people',r.returning_people],['App opens',r.app_opens],['Completed workouts',r.period_workouts]])+
      '<p class="notice">Returning = an observed app open in this period with a first observed open before the period. App open includes document startup and visible return after 15 minutes. Counts are not page views.</p>'+
      '<h2>Reliability</h2>'+metrics([['People with diagnostic errors',r.error_people],['People with unclosed tab episodes',r.unresolved_episode_people],['People with stale sessions ≥6h',r.stale_people],['New fingerprints · retained history',r.new_fingerprints]])+
      '<div class="actions"><button data-investigate="errors">Investigate diagnostics</button><button data-investigate="conflicts">Investigate conflicts</button><button data-section="users">Review users</button></div>'+
      '<h2>Activity trend · UTC days</h2><div class="trend" role="img" aria-label="Daily observed authenticated people; exact values follow">'+daily.map(d=>`<span style="height:${Math.max(2,100*Number(d.people)/max)}%" title="${esc(d.day)}: ${number(d.people)} people"></span>`).join('')+'</div>'+table(['UTC day','Observed people','App opens','Completed workouts'],daily.map(d=>[esc(d.day),number(d.people),number(d.opens),number(d.workouts)]))+
      '<h2>Return after first observed app open</h2>'+table(['Day','Mature eligible people','Returned','Return %'],(r.retention||[]).filter(c=>[7,28].includes(c.day)).map(c=>['D'+c.day,number(c.eligible),number(c.returned),pct(c.returned,c.eligible)]))+'<h2>Release adoption · latest observation per person</h2>'+table(['Release','People','Status'],(r.releases||[]).map(v=>[esc(v.release),number(v.users),v.release===currentRelease?'Current release':'Other release observed']))+
      `<p class="notice">${number(r.coverage_people)} people with telemetry in period; ${number(r.no_telemetry_people)} registered people without telemetry in period. Last receipt ${timestamp(r.last_event)}. An unclosed episode means no verified resolution was received within retention; it is not a live device check.</p>`+
      '<h2>Recent operational pulse</h2>'+timeline(r.pulse)+traffic(r);
  }
  function users(r){paginate(r.total,r.page_size);return `<div class="user-cards">${(r.users||[]).map(p=>`<article class="user-card">${userLink(p.user_id,p.display_name)}<p>${timestamp(p.last_activity,'No app activity observed')}<br>${number(p.workouts)} completed workouts</p><p>${esc(p.release||'No telemetry observed')}<small>${esc([p.platform,p.browser,p.mode].filter(Boolean).join(' · '))}</small></p><div class="signals">${health(p)}</div><small>Joined ${timestamp(p.joined)}</small></article>`).join('')||empty}</div><div class="desktop-users">`+
      table(['Person','Joined / confirmed','First completed workout','Last activity','Completed workouts','Release / platform','Signals'],(r.users||[]).map(p=>[userLink(p.user_id,p.display_name)+`<small>${esc(p.email)}</small>`,timestamp(p.joined)+`<small>${p.confirmed?'Confirmed':'Unconfirmed'}</small>`,timestamp(p.first_workout,'Not yet completed'),timestamp(p.last_activity),number(p.workouts),`${esc(p.release||'No telemetry observed')}<small>${esc([p.platform,p.browser,p.mode].filter(Boolean).join(' · '))}</small>`,health(p)]))+'</div>';}
  function episodeCards(items){return (items||[]).length?`<div class="signal-cards">${items.map(e=>`<article><strong>${esc(e.surface)} · ${e.resolved?'Verified resolution observed':'No resolution observed'}</strong><p>${number(e.presentations)} sampled presentation events</p><p>First ${timestamp(e.first_seen)}<br>Last ${timestamp(e.last_seen)}</p><small>${list(e.releases)} · ${list(e.environments||e.platforms)}</small>${e.user_id?userLink(e.user_id):''}<details><summary>Technical episode identity</summary><code>${esc(e.episode_id)}</code></details></article>`).join('')}</div>`:empty;}
  function detail(r){
    if(r.not_found)return empty;paginate(r.event_total||0,50);
    const fields=[['Joined',timestamp(r.joined)],['Email confirmed',timestamp(r.confirmed,'Not yet confirmed')],['First completed workout',timestamp(r.first_workout,'Not yet completed')],['Latest workout started',timestamp(r.latest_workout_started)],['Latest completed workout',timestamp(r.last_workout,'Not yet completed')],['Completed workouts',number(r.workouts)],['Unfinished sessions',number(r.unfinished)],['Unclosed tab episodes',number(r.open_episodes)],['Stale sessions ≥6h',number(r.over_six_hours)],['Active Program',r.program_active?'Yes':'No'],['Last observed app activity',timestamp(r.last_open)],['Last activity · completion or app open',timestamp(r.last_activity)],['Last telemetry',timestamp(r.last_event,'No telemetry observed')],['Release',esc(r.release||'No telemetry observed')],['Platform / browser / mode',esc([r.platform,r.browser,r.mode].filter(Boolean).join(' / ')||'Unknown')]];
    return `<button id="backUsers">← Back</button><h2>${esc(r.display_name)}</h2><div class="signals">${health(r)}</div><dl class="detail">${fields.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`+
      '<p class="notice">No private sets, loads, repetitions, bodyweight or notes are returned. Latest workout started combines receipt observations and persisted unfinished-session starts; these clocks may differ. Server-observable day rollover below uses UTC; the app uses the device day.</p>'+
      table(['Unfinished start','Age · hours','≥6 hours','UTC day rollover'],(r.sessions||[]).map(s=>[timestamp(s.started_at,'Start unknown'),s.age_hours===null?'Unknown':Number(s.age_hours).toFixed(1),s.over_six_hours?'Yes':'No',s.utc_day_rollover?'Yes':'No']))+
      '<h2>Conflict episodes · retained observations</h2>'+episodeCards(r.episodes)+'<h2>Recent diagnostics</h2>'+(r.diagnostics||[]).map(d=>`<p>${diagnosticLink(d.diagnostic_fingerprint)} · ${number(d.occurrences)} occurrences · ${timestamp(d.last_seen)}</p>`).join('')+
      '<h2>Operational timeline</h2><p class="notice">Chronological receipt order, 50 events per page. Nearby events show sequence, not causality. Account facts are separate from the selected telemetry window.</p>'+timeline([{at:r.joined,event:'account_created',authoritative:true},...(r.confirmed?[{at:r.confirmed,event:'account_confirmed',authoritative:true}]:[])])+timeline(r.events)+(!r.workouts?'<p class="notice">No completed workout observed in current retained History.</p>':'');
  }
  function funnel(r){return '<h2>People milestones</h2>'+table(['Milestone','People','% registered people'],[['Registered',r.registered],['Confirmed',r.confirmed],['First completed workout',r.activated],['Second completed workout',r.two_workouts],['4+ completed workouts',r.four_workouts],['App-open active 7D',r.active_7d]].map(([n,c])=>[esc(n),number(c),pct(c,r.registered)]))+
    '<p class="notice">People denominators only. Current retained History may include imported or retrospective completions; these are milestones, not a strictly nested acquisition funnel.</p><h2>Return cohorts</h2>'+table(['Return day','Mature eligible people','Returned','Return %'],(r.retention||[]).map(c=>[`D${c.day}`,number(c.eligible),number(c.returned),pct(c.returned,c.eligible)]))+
    `<p class="notice">Return means app_open on the exact UTC calendar day after first observed open. Only fully elapsed days qualify. Raw counts remain visible at small sample sizes. Selected-period workouts per person with a completed workout: ${r.workouts_per_training_person==null?'Not observed':Number(r.workouts_per_training_person).toFixed(2)}.</p>`+traffic(r);}
  function errorCards(errors){return (errors||[]).length?`<div class="signal-cards">${errors.map(e=>`<article>${diagnosticLink(e.diagnostic_fingerprint)}<h3>${number(e.people)} affected people <small>· ${number(e.occurrences)} occurrences</small></h3><p>${esc(e.error_code||e.category)} · ${esc(e.surface)} / ${esc(e.lifecycle||'unknown')}</p><small>${esc(e.module_id||'Unknown module')} · ${esc(e.error_class||'Unknown class')}</small><p>${list(e.releases)}<br>${list(e.environments)}</p><p>First in filter ${timestamp(e.first_seen)}<br>Last in filter ${timestamp(e.last_seen)}</p></article>`).join('')}</div>`:empty;}
  function reliability(r){
    const signal=$('signalFilter').value;paginate(Math.max(r.error_group_total||0,r.episode_total||0),25);
    return `<p class="notice">${number(r.observed_users)} people with telemetry matching these filters. Last receipt ${timestamp(r.last_event)}. Counts are observations, not failure rates.</p>`+
      (['all','errors'].includes(signal)?'<h2>Diagnostic errors</h2>'+errorCards(r.errors):'')+
      (['all','conflicts'].includes(signal)?'<h2>Conflict episodes</h2>'+metrics([['Affected people',r.episode_people],['Detected tab episodes',r.detected_episodes],['Resolved episodes',r.resolved_episodes],['No resolution observed',r.unresolved_episodes]])+`<p class="notice">${number(r.presentations)} sampled presentation events. Episodes are continuous tab/profile/channel intervals, not globally deduplicated root causes. Counts use full retained episode lifecycles for episodes observed in the selected filter. Missing resolution telemetry means current state is unknown.</p>`+episodeCards(r.episodes)+`<p class="notice">Legacy v114: ${number(r.legacy_conflict_presentations)} presentation events · ${number(r.legacy_conflict_people)} people · underlying episode count unknown.</p>`:'')+
      (['all','recovery'].includes(signal)?'<h2>Recovery observations</h2>'+table(['Signal','People','Occurrences','First','Last'],(r.recovery||[]).map(e=>[esc(label(e.event_name)),number(e.people),number(e.occurrences),timestamp(e.first_seen),timestamp(e.last_seen)])):'')+
      '<h2>Release health / coverage</h2>'+table(['Release','Observed people','Events'],(r.releases||[]).map(e=>[esc(e.release),number(e.people),number(e.occurrences)]));
  }
  function diagnosticDetail(r){paginate(r.affected_user_total||0,25);return '<button id="backUsers">← Back</button><h2>Diagnostic group</h2>'+errorCards(r.errors)+'<h2>Affected people</h2>'+(r.affected_users||[]).map(u=>`<p>${userLink(u.user_id,u.display_name)} · ${number(u.occurrences)} occurrences</p>`).join('')+'<h2>Recent occurrence receipts</h2>'+timeline(r.occurrences)+'<h2>Nearby operational observations</h2><p class="notice">Up to eight nearby events for each of the latest three errors, within two minutes either side. Sequence does not establish causality.</p>'+timeline(r.nearby)+'<p class="notice">Open an affected user to inspect nearby operational events. Proximity is not causality.</p>';}
  function filters(){
    $('filters').hidden=false;
    for(const id of ['searchLabel','sortLabel','healthLabel'])$(id).hidden=section!=='users'||!!detailUser;
    for(const id of ['releaseLabel','platformLabel','browserLabel','modeLabel','signalLabel'])$(id).hidden=!['reliability','diagnostic'].includes(section)||!!detailUser;
    $('sourceLabel').hidden=section!=='traffic';$('eventLabel').hidden=!detailUser;
  }
  async function load(){
    if(!authorized)return;filters();const token=++generation;activeController?.abort();const controller=new AbortController();activeController=controller;
    $('content').replaceChildren();$('pagination').hidden=true;$('status').textContent='Loading…';
    const request={section:detailUser?'detail':section,page,search:$('search').value,sort:$('sort').value,health:$('health').value,days:Number($('days').value),release:$('releaseFilter').value,platform:$('platform').value,browser:$('browserFilter').value,mode:$('modeFilter').value,signal:$('signalFilter').value,source:$('sourceFilter').value,event:$('eventFilter').value};
    if(detailUser)request.user_id=detailUser;if(fingerprint&&!detailUser)request.fingerprint=fingerprint;
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{const {data,error}=await client.rpc('operator_query_v2',{request}).abortSignal(controller.signal);if(token!==generation)return;if(error){if(error.code==='42501'){fail();return;}throw error;}if(data?.metric_contract!=='operator-v2')throw Error();
      $('content').innerHTML=detailUser?detail(data):({overview,traffic,users,funnel,reliability,diagnostic:diagnosticDetail}[section])(data);$('status').textContent=`Updated ${date(data.as_of)} · ${zone}`;
    }catch{if(token===generation){$('content').replaceChildren();$('status').textContent='Could not load operational data. Use Refresh to retry.';}}finally{clearTimeout(timeout);}
  }
  function remember(){trail.push({section,page,detailUser,fingerprint,values:Object.fromEntries(filterIds.map(id=>[id,$(id).value]))});if(trail.length>20)trail.shift();}
  function select(next){section=next;detailUser=null;fingerprint=null;page=0;for(const b of document.querySelectorAll('[data-section]'))b.setAttribute('aria-current',b.dataset.section===section?'page':'false');void load();}
  document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
    if(b.dataset.section)select(b.dataset.section);
    if(b.dataset.investigate){remember();$('signalFilter').value=b.dataset.investigate;select('reliability');}
    if(b.dataset.user){remember();detailUser=b.dataset.user;page=0;void load();}
    if(b.dataset.fingerprint){remember();fingerprint=b.dataset.fingerprint;detailUser=null;section='diagnostic';page=0;void load();}
    if(b.id==='backUsers'){const prev=trail.pop();if(prev){({section,page,detailUser,fingerprint}=prev);for(const [id,value] of Object.entries(prev.values))$(id).value=value;void load();}else select('users');}
  });
  $('refresh').onclick=load;$('previous').onclick=()=>{page=Math.max(0,page-1);void load();};$('next').onclick=()=>{page++;void load();};
  $('filters').onsubmit=event=>{event.preventDefault();page=0;$('filterPanel').open=false;void load();};
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
