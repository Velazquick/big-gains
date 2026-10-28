import fs from 'node:fs';import path from 'node:path';
let lifetime=0;
const cors=raw=>Object.fromEntries(Object.entries(raw||{}).filter(([k])=>/^(origin|access-control-|content-type|location|sec-fetch-)/i.test(k)));
export function observeBackend(req,res,note){
 const id='backend:'+Date.now()+':'+req.method+':'+req.url;
 note('transport-request',{id,method:req.method,url:req.url,headers:cors(req.headers)});
 const write=res.writeHead;res.writeHead=function(){note('transport-response-headers',{id,status:arguments[0],headers:cors(typeof arguments[1]==='object'?arguments[1]:arguments[2])});return write.apply(this,arguments)};
 res.once('finish',()=>note('transport-response-finished',{id,status:res.statusCode}));
 res.once('close',()=>note('transport-response-closed',{id,writableFinished:res.writableFinished,status:res.statusCode}));
 req.once('aborted',()=>note('transport-request-aborted',{id}));
}
export async function observeContext(c,{out,note}){
 const contextId='context-'+(++lifetime),observed=new WeakSet();let pageOrdinal=0,requestOrdinal=0;const ids=new WeakMap();
 await c.tracing.start({screenshots:true,snapshots:true,sources:true});
 await c.exposeBinding('__bgPageerrorAttribution',({page,frame},data)=>note('dom-observation',{contextId,pageId:page.__attributionId,frameUrl:frame.url(),...data}));
 await c.addInitScript(()=>{
  const documentId=performance.timeOrigin+':'+Math.random().toString(16).slice(2);
  function record(event,data={}){void window.__bgPageerrorAttribution({event,documentId,clock:performance.now(),wall:Date.now(),url:location.href,visibility:document.visibilityState,controller:navigator.serviceWorker?.controller?{state:navigator.serviceWorker.controller.state,scriptURL:navigator.serviceWorker.controller.scriptURL}:null,...data}).catch(()=>{});}
  for(const name of ['pagehide','beforeunload','pageshow','visibilitychange','online','offline'])addEventListener(name,e=>record(name,{persisted:e.persisted}),true);
  addEventListener('error',e=>record('window-error',{message:e.message,filename:e.filename,line:e.lineno,column:e.colno,errorName:e.error?.name,errorMessage:e.error?.message,stack:e.error?.stack}),true);
  addEventListener('unhandledrejection',e=>record('unhandledrejection',{name:e.reason?.name,message:e.reason?.message,stack:e.reason?.stack,value:String(e.reason)}),true);
  if(navigator.serviceWorker){navigator.serviceWorker.addEventListener('controllerchange',()=>record('controllerchange'));navigator.serviceWorker.ready.then(r=>record('ready-resolved',{active:r.active?.state,scope:r.scope}));}
  record('document-init');
 });
 const rid=req=>{if(!ids.has(req))ids.set(req,contextId+':request-'+(++requestOrdinal));return ids.get(req)};
 const observe=p=>{
  if(observed.has(p))return;observed.add(p);p.__attributionId=contextId+':page-'+(++pageOrdinal);
  const base=()=>({contextId,pageId:p.__attributionId,pageUrl:p.url()});
  p.on('pageerror',e=>note('pageerror-detail',{...base(),name:e.name,errorMessage:e.message,string:String(e),stack:e.stack,constructorName:e.constructor.name}));
  p.on('console',msg=>note('console-detail',{...base(),type:msg.type(),text:msg.text(),location:msg.location()}));
  p.on('framenavigated',f=>note('frame-navigated',{...base(),frameUrl:f.url(),main:f===p.mainFrame()}));
  p.on('close',()=>note('page-closed',base()));
  p.on('request',req=>note('request-detail',{...base(),requestId:rid(req),url:req.url(),method:req.method(),resourceType:req.resourceType(),isNavigation:req.isNavigationRequest(),headers:cors(req.headers())}));
  p.on('requestfailed',req=>note('requestfailed-detail',{...base(),requestId:rid(req),url:req.url(),method:req.method(),failure:req.failure()}));
  p.on('response',res=>note('response-detail',{...base(),requestId:rid(res.request()),url:res.url(),status:res.status(),headers:cors(res.headers())}));
  p.on('requestfinished',req=>note('requestfinished-detail',{...base(),requestId:rid(req),url:req.url(),method:req.method()}));
 };
 c.on('page',observe);c.pages().forEach(observe);
 c.on('serviceworker',worker=>{note('serviceworker-created',{contextId,url:worker.url()});worker.on('close',()=>note('serviceworker-closed',{contextId,url:worker.url()}));});
 const offline=c.setOffline;c.setOffline=function(value){note('offline-command-start',{contextId,value});return offline.apply(this,arguments).then(result=>{note('offline-command-end',{contextId,value});return result})};
 const close=c.close;c.close=async function(){
  note('context-close-command-start',{contextId});
  try{await c.tracing.stop({path:path.join(out,contextId+'-trace.zip')});note('trace-saved',{contextId});}catch(e){note('trace-save-error',{contextId,error:String(e)})}
  const result=await close.apply(this,arguments);note('context-close-command-end',{contextId});return result;
 };
 note('context-observers-attached',{contextId});
}
