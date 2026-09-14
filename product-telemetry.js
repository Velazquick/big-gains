((scope) => {
  'use strict';
  const names = new Set(['app_open','workout_started','workout_completed','program_adopted','exercise_swapped','stale_session_recovery_shown','stale_session_resumed','stale_session_finished','stale_session_discarded','recovery_required','conflict_presented','app_error']);
  const categories = new Set(['javascript','promise','resource','sync','program','unknown']);
  const surfaces = new Set(['app','train','program','recovery','onboarding']);
  const modes = new Set(['program','freeform','unknown']);
  const seen = new Map();
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
      const profile=typeof PROFILE!=='undefined' ? PROFILE.id : null;
      if(!runtime?.authUserId || !profile || !scope.BigGainsSupabase?.configured) return;
      const surface=surfaces.has(options.surface)?options.surface:'app';
      const category=name==='app_error'?errorCategory(options.category):'none';
      const key=[runtime.authUserId,profile,name,surface,category].join(':');
      const now=Date.now();
      if(now-(seen.get(key) || 0)<60_000 || (name==='app_error' && errors>=10)) return;
      if(seen.size>=64) seen.delete(seen.keys().next().value);
      seen.set(key,now); sent++; if(name==='app_error') errors++;
      const event={id:scope.crypto.randomUUID(),event_name:name,profile_client_id:profile,
        release:scope.BIG_GAINS_ASSET_MANIFEST?.release,...environment(),surface,category,
        training_mode:modes.has(options.training_mode)?options.training_mode:'unknown'};
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
      if(actor!==lastIdentity || Date.now()-lastOpen>=15*60_000) {
        lastIdentity=actor;lastOpen=Date.now();emit('app_open');
      }
    } catch {}
  }
  scope.BigGainsTelemetry=Object.freeze({emit,errorCategory,environment});
  scope.addEventListener?.('error',event=>emit('app_error',{category:event?.error?'javascript':'resource'}));
  scope.addEventListener?.('unhandledrejection',()=>emit('app_error',{category:'promise'}));
  scope.document?.addEventListener('visibilitychange',opened);
  scope.document?.addEventListener('big-gains-runtime-state-changed',()=>{
    if(scope.document.documentElement.dataset.runtimeState==='recovery') emit('recovery_required',{surface:'recovery'});
    else opened();
  });
  scope.addEventListener?.('pagehide',()=>{stopped=true;});
  scope.addEventListener?.('pageshow',()=>{stopped=false;opened();});
  setTimeout(()=>{opened();if(scope.document?.documentElement.dataset.runtimeState==='recovery')emit('recovery_required',{surface:'recovery'});},1500);
})(typeof window==='object'?window:globalThis);
