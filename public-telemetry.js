((scope)=>{
  'use strict';
  const key='big-gains-visitor-session-v1', allowed=new Set(['visit','signup_reached','signup_started']);
  let pending=false,attempts=0,client;
  function session(){
    let value;try{value=JSON.parse(scope.sessionStorage.getItem(key)||'null');}catch{}
    if(!value || !/^[a-f0-9-]{36}$/i.test(value.id) || !Number.isFinite(value.at) || Date.now()-value.at>=1800000 || value.at>Date.now()){
      const source=new URLSearchParams(scope.location.search).get('source');
      value={id:scope.crypto.randomUUID(),at:Date.now(),source:['beta-wave-1','beta-wave-2'].includes(source)?source:'direct',sent:[]};
    }
    if(!Array.isArray(value.sent))value.sent=[];
    return value;
  }
  function emit(name){
    try{
      // A stored Auth session may exist before account runtime initialization.
      // Check presence only: never parse, copy or transmit its contents.
      if(scope.bigGainsAccounts?.runtime?.authUserId || scope.localStorage?.getItem('big-gains-supabase-auth-v1'))return;
      if(!allowed.has(name)||pending||attempts>=6||scope.navigator.onLine===false)return;
      const config=scope.__BIG_GAINS_CLOUD_CONFIG__;if(!config?.supabaseUrl||!config?.supabasePublishableKey||!scope.supabase)return;
      const value=session();if(value.sent.includes(name))return;
      // Separate client never reads or sends the signed-in session.
      client ||= scope.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'big-gains-public-observations'}});
      const ua=scope.navigator.userAgent || '';
      const environment={platform:/iPhone|iPad|iPod/.test(ua)?'ios':/Android/.test(ua)?'android':/Windows/.test(ua)?'windows':/Mac/.test(ua)?'mac':/Linux/.test(ua)?'linux':'other',browser:/Edg/.test(ua)?'edge':/Firefox|FxiOS/.test(ua)?'firefox':/Chrome|CriOS/.test(ua)?'chrome':/Safari/.test(ua)?'safari':'other',mode:scope.navigator.standalone===true||scope.matchMedia?.('(display-mode: standalone)').matches?'standalone':'browser'};
      value.sent.push(name);try{scope.sessionStorage.setItem(key,JSON.stringify(value));}catch{}
      attempts++;pending=true;
      const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),3000);
      void (async()=>{try{await client.rpc('record_visitor_event',{event:{session_id:value.id,event_name:name,...environment,source:['beta-wave-1','beta-wave-2'].includes(value.source)?value.source:'direct'}}).abortSignal(abort.signal);}catch{}finally{clearTimeout(timer);pending=false;}})();
    }catch{}
  }
  scope.BigGainsPublicTelemetry=Object.freeze({emit});
  setTimeout(()=>emit('visit'),0);
})(window);
