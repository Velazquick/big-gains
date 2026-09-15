((scope) => {
  'use strict';
  const names = new Set(['app_open','workout_started','workout_completed','program_adopted','exercise_swapped','stale_session_recovery_shown','stale_session_resumed','stale_session_finished','stale_session_discarded','recovery_required','conflict_detected','conflict_presented','conflict_resolved','app_error']);
  const categories = new Set(['javascript','promise','resource','sync','program','unknown']);
  const surfaces = new Set(['app','train','program','recovery','onboarding']);
  const modes = new Set(['program','freeform','unknown']);
  const codes = ['unknown','js_exception','unhandled_promise','resource_load','asset_load','asset_execute','sw_registration','sw_update','sw_resource','cache_unavailable','network_unavailable','application_failure'];
  const stages = ['unknown','startup','interactive','background','recovery'];
  const classes = ['unknown','Error','TypeError','SyntaxError','ReferenceError','RangeError','URIError','EvalError','AggregateError'];
  // Only application-owned filenames in the shipped manifest can become module IDs.
  const modules = new Set(['unknown', ...(scope.BIG_GAINS_ASSET_MANIFEST?.coreAssets || []).map(path=>path.split('/').pop().split('?')[0])]);
  function bounded(value, values) { return values.includes(value) ? value : 'unknown'; }
  function moduleId(value) { return typeof value==='string' && modules.has(value) ? value : 'unknown'; }
  function resourceId(value) {
    try { const url=new URL(value,scope.location.href); const known=(scope.BIG_GAINS_ASSET_MANIFEST?.coreAssets||[]).some(path=>new URL(path,scope.location.href).pathname===url.pathname); return url.origin===scope.location.origin && known ? moduleId(url.pathname.split('/').pop()) : 'unknown'; } catch {return 'unknown';}
  }
  function stage() { return scope.document?.visibilityState==='hidden'?'background':scope.document?.documentElement?.dataset?.runtimeState==='interactive'?'interactive':scope.document?.documentElement?.dataset?.runtimeState==='recovery'?'recovery':'startup'; }
  function diagnostic(options={}) {
    return {error_code:bounded(options.error_code,codes),module_id:moduleId(options.module_id),lifecycle:bounded(options.lifecycle || stage(),stages),error_class:bounded(options.error_class,classes)};
  }
  // The database recomputes this FNV-1a fingerprint from validated enum fields.
  function fingerprint(value) {
    const tuple=[value.category,value.error_code,value.module_id,value.surface,value.lifecycle,value.error_class].join('|');
    let h=2166136261;for(let i=0;i<tuple.length;i++){h=Math.imul(h^tuple.charCodeAt(i),16777619)>>>0;}
    return 'BG-'+h.toString(16).padStart(8,'0').toUpperCase();
  }
  const seen = new Map();
  const episodeKey='big-gains-operator-episodes-v2';
  let episodeCache=[];
  try { const value=JSON.parse(scope.sessionStorage?.getItem(episodeKey)||'[]'); if(Array.isArray(value))episodeCache=value.slice(-16).filter(v=>v&&typeof v.owner==='string'&&v.owner.length<250&&['program','recovery'].includes(v.channel)&&/^[a-f0-9-]{36}$/i.test(v.id)&&Number.isFinite(v.at)&&Date.now()-v.at<90*86400000); }catch{}
  function episodeOwner(profile){return [scope.bigGainsAccounts?.runtime?.authUserId,profile].filter(Boolean).join(':');}
  function saveEpisodes(){try{scope.sessionStorage?.setItem(episodeKey,JSON.stringify(episodeCache.slice(-16)));}catch{}}
  // One continuous unresolved interval per tab/profile/channel; no payload fingerprints.
  // State changes such as CHECKING never close an episode. Storage is telemetry-only.
  function conflict(channel, {presented=false,verifiedResolved=false,profileId=null}={}) {
    try {
      if(!['program','recovery'].includes(channel) || !scope.bigGainsAccounts?.runtime?.authUserId || typeof PROFILE==='undefined')return;
      const targetProfile=profileId || PROFILE.id;if(!/^[a-z0-9-]{1,100}$/i.test(targetProfile))return;
      const owner=episodeOwner(targetProfile);let entry=episodeCache.find(v=>v.owner===owner&&v.channel===channel);
      if(verifiedResolved){if(!entry)return;emit('conflict_resolved',{surface:channel,episode_id:entry.id,profile_client_id:targetProfile});episodeCache=episodeCache.filter(v=>v!==entry);saveEpisodes();return;}
      if(!entry){entry={owner,channel,id:scope.crypto.randomUUID(),at:Date.now(),presented:0};episodeCache.push(entry);episodeCache=episodeCache.slice(-16);saveEpisodes();emit('conflict_detected',{surface:channel,episode_id:entry.id,profile_client_id:targetProfile});}
      // Sample visible presentations at most once per minute, across reloads too.
      if(presented && Date.now()-(entry.presented||0)>=60000){entry.presented=Date.now();saveEpisodes();emit('conflict_presented',{surface:channel,episode_id:entry.id,profile_client_id:targetProfile});}
    }catch{}
  }
  let inFlight=0, sent=0, errors=0, lastOpen=0, lastIdentity='', stopped=false;
  function environment() {
    const ua=String(scope.navigator?.userAgent || '');
    return {
      platform:/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && scope.navigator?.maxTouchPoints>1) ? 'ios' : /Android/i.test(ua)?'android':/Windows/i.test(ua)?'windows':/Mac/i.test(ua)?'mac':/Linux/i.test(ua)?'linux':'other',
      browser:/Edg/i.test(ua)?'edge':/Firefox|FxiOS/i.test(ua)?'firefox':/Chrome|CriOS/i.test(ua)?'chrome':/Safari/i.test(ua)?'safari':'other',
      mode:scope.navigator?.standalone===true || scope.matchMedia?.('(display-mode: standalone)')?.matches ? 'standalone':'browser'
    };
  }
  // Never stringify, hash, inspect or transmit raw errors, URLs, stacks or state.
  function errorCategory(value) { return categories.has(value) ? value : 'unknown'; }
  function emit(name, options={}) {
    try {
      if(stopped || !names.has(name) || scope.navigator?.onLine===false || inFlight>=2 || sent>=120) return;
      const runtime=scope.bigGainsAccounts?.runtime;
      const profile=/^conflict_(detected|presented|resolved)$/.test(name)&&/^[a-z0-9-]{1,100}$/i.test(options.profile_client_id||'') ? options.profile_client_id : typeof PROFILE!=='undefined' ? PROFILE.id : null;
      if(!runtime?.authUserId || !profile || !scope.BigGainsSupabase?.configured) return;
      const surface=surfaces.has(options.surface)?options.surface:'app';
      const category=name==='app_error'?errorCategory(options.category):'none';
      const diag=name==='app_error'?diagnostic(options):null;
      const fp=diag?fingerprint({category,surface,...diag}):null;
      const key=[runtime.authUserId,profile,name,surface,category,fp,options.episode_id||''].join(':');
      const now=Date.now();
      if(now-(seen.get(key) || 0)<60_000 || (name==='app_error' && errors>=10)) return;
      if(seen.size>=64) seen.delete(seen.keys().next().value);
      seen.set(key,now); sent++; if(name==='app_error') errors++;
      const event={id:scope.crypto.randomUUID(),event_name:name,profile_client_id:profile,
        release:scope.BIG_GAINS_ASSET_MANIFEST?.release,...environment(),surface,category,
        training_mode:modes.has(options.training_mode)?options.training_mode:'unknown',
        ...(diag?{...diag,diagnostic_fingerprint:fp}:{}),
        ...(/^conflict_(detected|presented|resolved)$/.test(name)&&/^[a-f0-9-]{36}$/i.test(options.episode_id||'')?{episode_id:options.episode_id}:{})};
      const actor=runtime.authUserId;
      inFlight++;
      // Nothing in the product awaits this task. No persistent queue or retries.
      void (async()=>{
        let timeout;
        try {
          const session=await scope.BigGainsSupabase.session();
          if(session?.user?.id!==actor || scope.bigGainsAccounts?.runtime?.authUserId!==actor) return;
          const abort=new AbortController();timeout=setTimeout(()=>abort.abort(),4000);
          await scope.BigGainsSupabase.getClient().rpc('record_product_event',{event}).abortSignal(abort.signal);
        } catch {} finally {clearTimeout(timeout);inFlight--;}
      })();
    } catch {}
  }
  function opened() {
    try {
      if(stopped || scope.document?.visibilityState==='hidden') return;
      const actor=scope.bigGainsAccounts?.runtime?.authUserId;
      if(!actor) return;
      reportAssets();
      if(actor!==lastIdentity || Date.now()-lastOpen>=15*60_000) {
        lastIdentity=actor;lastOpen=Date.now();emit('app_open');
      }
    } catch {}
  }
  scope.BigGainsTelemetry=Object.freeze({emit,errorCategory,environment,diagnostic,fingerprint,resourceId,conflict});
  scope.addEventListener?.('error',event=>{
    try {
      const target=event?.target;
      if(target?.dataset?.bigGainsAsset==='script' && scope.BigGainsAssetStatus?.status?.().monitoring)return;
      const resource=target && ['SCRIPT','LINK','IMG','AUDIO','VIDEO'].includes(target.tagName);
      let errorClass='unknown';try{errorClass=bounded(event?.error?.name,classes);}catch{}
      emit('app_error',{category:resource?'resource':'javascript',error_code:resource?'resource_load':'js_exception',module_id:resourceId(resource?(target.src||target.href):event?.filename),error_class:errorClass});
    }catch{}
  },true);
  scope.navigator?.serviceWorker?.addEventListener?.('message',event=>{
    try{if(event.source===scope.navigator.serviceWorker.controller && event.data?.type==='BG_RESOURCE_UNAVAILABLE')emit('app_error',{category:'resource',error_code:'sw_resource',module_id:moduleId(event.data.module_id)});}catch{}
  });
  scope.addEventListener?.('unhandledrejection',()=>emit('app_error',{category:'promise',error_code:'unhandled_promise'}));
  scope.document?.addEventListener('visibilitychange',opened);
  scope.document?.addEventListener('big-gains-runtime-state-changed',()=>{
    if(scope.document.documentElement.dataset.runtimeState==='recovery') emit('recovery_required',{surface:'recovery'});
    else opened();
  });
  scope.addEventListener?.('pagehide',()=>{stopped=true;});
  scope.addEventListener?.('pageshow',()=>{stopped=false;opened();});
  const reportedAssets=new Set();
  function reportAssets(){
    try{
      if(!scope.bigGainsAccounts?.runtime?.authUserId || typeof PROFILE==='undefined' || !scope.BigGainsSupabase?.configured)return;
      for(const failure of (scope.BigGainsAssetStatus?.status?.().failures||[]).slice(0,8)){
        const code=failure.code==='startup-script-execution-failed'?'asset_execute':'asset_load',module=moduleId(failure.component),key=code+':'+module;
        if(reportedAssets.has(key))continue;reportedAssets.add(key);
        emit('app_error',{category:'resource',error_code:code,module_id:module,lifecycle:'startup'});
      }
    }catch{}
  }
  reportAssets();
  scope.document?.addEventListener('big-gains-asset-failure',reportAssets);
  setTimeout(()=>{opened();if(scope.document?.documentElement.dataset.runtimeState==='recovery')emit('recovery_required',{surface:'recovery'});},1500);
})(typeof window==='object'?window:globalThis);
