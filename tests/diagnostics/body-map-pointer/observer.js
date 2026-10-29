(() => {
  'use strict';
  const nativeRAF = window.requestAnimationFrame;
  const nativeScrollBy = window.scrollBy;
  const limit = 20000, queueLimit = 4000;
  let queue = [], sent = 0, dropped = 0, sequence = 0, flushing = false;
  let action = null, lastGeometry = null, sampling = false, disposed = false;
  const costs = { count: 0, totalMs: 0, maxMs: 0, completeCount:0,completeTotalMs:0,completeMaxMs:0,frameCount: 0, frameTotalMs: 0, frameMaxMs: 0 };
  const eventCounts = {};let observationErrors=0;
  const describe = node => {
    if (!(node instanceof Element)) return { tag: node?.nodeName || null };
    const attributes = {};
    for (const name of ['data-swap-exercise','data-toggle-exercise','data-exercise-head','data-exercise-id','data-exercise-picker-select','data-exercise-picker-browse','aria-expanded']) {
      if (node.hasAttribute(name)) attributes[name] = node.getAttribute(name);
    }
    return { tag: node.tagName, id: node.id, classes: String(node.className?.baseVal ?? node.className ?? '').slice(0,200), attributes };
  };
  const rect = node => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x:r.x, y:r.y, width:r.width, height:r.height, top:r.top, bottom:r.bottom };
  };
  const state = (measure = false) => {
    const swap = document.querySelector('[data-swap-exercise="0"]');
    const card = swap?.closest('.active-exercise');
    const dialog = document.getElementById('exercisePickerDialog');
    const value = {
      scrollY, scrollX, focus:describe(document.activeElement),
      swap:swap ? { ...describe(swap), label:swap.textContent, armed:swap.classList.contains('is-confirming'), connected:swap.isConnected } : null,
      card:card ? { ...describe(card), collapsed:card.classList.contains('is-collapsed') } : null,
      picker:dialog ? { open:dialog.open, classes:dialog.className, hidden:dialog.hidden, closureOpen:window.bigGainsExercisePicker?.isOpen?.() ?? null } : null,
      viewport:{ width:innerWidth,height:innerHeight,offsetTop:visualViewport?.offsetTop,visualHeight:visualViewport?.height },
      lastGeometry
    };
    if (measure) {
      value.geometry = { at:performance.now(), swap:rect(swap), card:rect(card), picker:rect(dialog) };
      lastGeometry = value.geometry;
    }
    return value;
  };
  const record = (kind, data = {}) => {
    try {
      if(disposed&&kind!=='observer-finish')return;
      if (sequence >= limit || queue.length >= queueLimit) { dropped++; return; }
      queue.push({ seq:++sequence, kind, at:performance.now(), timeOrigin:performance.timeOrigin, action, ...data });
    } catch { dropped++; }
  };
  const safeState = measure => { try { return state(measure); } catch(error) { observationErrors++;return { observationError:String(error) }; } };
  const flush = async () => {
    if (flushing || !queue.length) return;
    flushing = true;
    const batch = queue; queue = [];
    try { await window.__pointerEvidence(batch); sent += batch.length; }
    catch { dropped += batch.length; }
    finally { flushing = false; }
  };
  function sample() {
    if (disposed) { sampling = false; return; }
    const start = performance.now();
    record('frame', { state:safeState(true) });
    const elapsed = performance.now()-start;
    costs.frameCount++; costs.frameTotalMs+=elapsed; costs.frameMaxMs=Math.max(costs.frameMaxMs,elapsed);
    Reflect.apply(nativeRAF, window, [sample]);
  }
  for (const type of ['pointerdown','pointerup','click','focusin','focusout','cancel','close']) {
    document.addEventListener(type, event => {
      const start=performance.now();
      eventCounts[type]=(eventCounts[type]||0)+1;
      const details={ event:type,target:describe(event.target),path:event.composedPath().slice(0,9).map(describe),clientX:event.clientX,clientY:event.clientY,pointerId:event.pointerId,pointerType:event.pointerType,button:event.button,buttons:event.buttons,isTrusted:event.isTrusted,defaultPrevented:event.defaultPrevented,state:safeState(false) };
      record('dom-event',details);
      queueMicrotask(() => {const start=performance.now();record('event-microtask',{event:type,target:details.target,defaultPrevented:event.defaultPrevented,state:safeState(false)});const elapsed=performance.now()-start;costs.completeCount++;costs.completeTotalMs+=elapsed;costs.completeMaxMs=Math.max(costs.completeMaxMs,elapsed);});
      const elapsed=performance.now()-start;
      costs.count++;costs.totalMs+=elapsed;costs.maxMs=Math.max(costs.maxMs,elapsed);
    },true);
  }
  window.addEventListener('scroll',()=>record('scroll',{state:safeState(false)}),{capture:true,passive:true});
  for(const type of ['popstate','hashchange','pageshow','pagehide','beforeunload']) window.addEventListener(type,event=>record('lifecycle',{event:type,state:safeState(false)}),true);
  document.addEventListener('visibilitychange',()=>record('visibility',{visibility:document.visibilityState,state:safeState(false)}),true);
  new MutationObserver(records=>{
    const changes=records.filter(r=>r.target instanceof Element && r.target.matches('[data-swap-exercise],.active-exercise,#exercisePickerDialog'));
    if(changes.length)record('mutation',{changes:changes.slice(0,12).map(r=>({target:describe(r.target),attribute:r.attributeName})),state:safeState(false)});
  }).observe(document,{subtree:true,attributes:true,attributeFilter:['class','open','aria-expanded']});
  // Observe only a named restoration callback. Native pointer APIs and application
  // event handlers are untouched. Return the original rAF ID; cancellation stays native.
  window.requestAnimationFrame=function requestAnimationFrame(callback){
    let selected=false;try{selected=typeof callback==='function'&&callback.name==='restore';}catch{}
    if(!selected)return Reflect.apply(nativeRAF,this,[callback]);
    let sourceStack='';try{sourceStack=new Error().stack?.split('\n').slice(0,12).join('\n')||'';}catch{}
    const observed=function(timestamp){
      record('restore-enter',{timestamp,sourceStack,scrollY});
      try{return Reflect.apply(callback,this,[timestamp]);}
      finally{record('restore-exit',{timestamp,scrollY});}
    };
    const id=Reflect.apply(nativeRAF,this,[observed]);record('restore-queued',{id,sourceStack,scrollY});return id;
  };
  window.scrollBy=function scrollBy(...args){
    let sourceStack='';try{sourceStack=new Error().stack?.split('\n').slice(0,12).join('\n')||'';}catch{}
    try{record('scrollBy-enter',{args:args.map(a=>{if(typeof a!=='object'||a===null)return a;const result={};for(const name of ['top','left','behavior']){const d=Object.getOwnPropertyDescriptor(a,name);if(d)result[name]=Object.hasOwn(d,'value')?d.value:'<accessor-not-invoked>';}return result;}),sourceStack,scrollY});}catch{}
    try{return Reflect.apply(nativeScrollBy,this,args);}
    finally{record('scrollBy-exit',{scrollY});}
  };
  const timer=setInterval(flush,100);
  window.__pointerDiagnostic={
    async finish(){
      disposed=true;clearInterval(timer);record('observer-finish',{costs,dropped,sent,queued:queue.length,state:safeState(true)});
      for(let i=0;i<20&&(queue.length||flushing);i++){await flush();if(flushing)await new Promise(resolve=>setTimeout(resolve,5));}
      return {costs,costScope:'Capture callbacks, post-event microtasks and sampler only; excludes wrappers, mutation observer, flush/binding/Node overhead.',eventCounts,observationErrors,dropped,sent,remaining:queue.length,flushing,sequence};
    }
  };
  record('observer-installed',{limits:{limit,queueLimit},state:safeState(false)});
  // M2 samples throughout this case; match actions offline with measurement age.
  sampling=true;Reflect.apply(nativeRAF,window,[sample]);
})();
