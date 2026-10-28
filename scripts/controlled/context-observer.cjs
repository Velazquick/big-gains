'use strict';
// Diagnostic observer only. Preserve the original API Promise objects and calls.
const fs=require('node:fs'),path=require('node:path');
const output=path.resolve(process.env.DIAG_CONTEXT_LEDGER||'lifecycle-evidence/context-events.ndjson');
fs.mkdirSync(path.dirname(output),{recursive:true});let browserOrdinal=0;
function note(event,data={}){try{fs.appendFileSync(output,JSON.stringify({event,epoch:Date.now(),nodePid:process.pid,workerIndex:process.env.TEST_WORKER_INDEX||null,parallelIndex:process.env.TEST_PARALLEL_INDEX||null,...data})+'\n');}catch(error){process.stderr.write('DIAG_OBSERVER_ERROR '+String(error)+'\n');}}
function watch(promise,ok,fail){promise.then(ok,fail);return promise;}
function install(browser,browserId){
 let contextOrdinal=0;const create=browser.newContext;
 browser.newContext=function(options){const index=++contextOrdinal;note('newContext-start',{browserId,index,requestedOptions:options||{}});const promise=create.apply(this,arguments);return watch(promise,context=>{
  note('newContext-complete',{browserId,index,resolvedOptions:context._options||null});const close=context.close;
  context.on('serviceworker',worker=>{note('serviceworker-created',{browserId,index,url:worker.url()});worker.on('close',()=>note('serviceworker-closed',{browserId,index,url:worker.url()}));});
  context.on('close',()=>note('context-close-event',{browserId,index}));
  context.close=function(){note('context-close-start',{browserId,index,workers:context.serviceWorkers().map(w=>w.url()),pages:context.pages().map(p=>p.url().slice(0,1000))});const result=close.apply(this,arguments);return watch(result,()=>note('context-close-complete',{browserId,index}),error=>note('context-close-failed',{browserId,index,error:String(error)}));};
 },error=>note('newContext-failed',{browserId,index,error:String(error)}));};
 browser.on('disconnected',()=>note('browser-disconnected',{browserId}));
}
const {chromium}=require('playwright-core');const proto=Object.getPrototypeOf(chromium);const launch=proto.launch;
if(!proto.__controlledLaunchObserver){
 Object.defineProperty(proto,'__controlledLaunchObserver',{value:true});
 proto.launch=function(){const browserId=process.pid+':'+(++browserOrdinal);note('browser-launch-start',{browserId,type:this.name()});const promise=launch.apply(this,arguments);return watch(promise,browser=>{note('browser-launch-complete',{browserId,version:browser.version()});install(browser,browserId);},error=>note('browser-launch-failed',{browserId,error:String(error)}));};
}
note('observer-installed',{playwright:require('playwright-core/package.json').version});
