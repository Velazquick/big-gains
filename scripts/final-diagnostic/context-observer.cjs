'use strict';
// Bounded lifecycle-only observer. All caller Promises and errors are preserved.
const fs = require('node:fs'), path = require('node:path');
const output = process.env.FINAL_CONTEXT_LEDGER;
if (!output || !path.isAbsolute(output)) throw Error('FINAL_CONTEXT_LEDGER must be absolute');
fs.mkdirSync(path.dirname(output), {recursive:true});
let records = 0, ordinal = 0;
function note(event, data={}) {
  try {
    if (++records > 30000) { if(records===30001) process.stderr.write('FINAL_OBSERVER_LIMIT\n'); return; }
    fs.appendFileSync(output, JSON.stringify({event,epoch:Date.now(),nodePid:process.pid,file:process.env.FINAL_FILE || null,...data})+'\n');
  } catch(error) { process.stderr.write('FINAL_OBSERVER_ERROR '+String(error)+'\n'); }
}
function watch(promise, ok, fail) {
  promise.then(value=>{try{ok(value)}catch(error){note('observer-error',{error:String(error)})}},error=>{try{fail(error)}catch(e){note('observer-error',{error:String(e)})}});
  return promise;
}
const {chromium}=require('playwright-core'), proto=Object.getPrototypeOf(chromium), launch=proto.launch;
if (!proto.__finalDiagnosticObserver) {
  Object.defineProperty(proto,'__finalDiagnosticObserver',{value:true});
  proto.launch=function() {
    const browserId=process.pid+':'+(++ordinal); note('launch-start',{browserId,type:this.name()});
    return watch(launch.apply(this,arguments),browser=>{
      note('launch-complete',{browserId,version:browser.version()}); let index=0;
      browser.on('disconnected',()=>note('disconnected',{browserId}));
      const create=browser.newContext;
      browser.newContext=function() {
        const contextId=++index; note('newContext-start',{browserId,contextId});
        return watch(create.apply(this,arguments),context=>{
          note('newContext-complete',{browserId,contextId});
          context.on('serviceworker',worker=>note('serviceworker',{browserId,contextId,url:worker.url().slice(0,200)}));
          const close=context.close;
          context.close=function() {
            note('context-close-start',{browserId,contextId,workers:context.serviceWorkers().length});
            return watch(close.apply(this,arguments),()=>note('context-close-complete',{browserId,contextId}),error=>note('context-close-failed',{browserId,contextId,error:String(error).slice(0,1200)}));
          };
        },error=>note('newContext-failed',{browserId,contextId,error:String(error).slice(0,1200)}));
      };
    },error=>note('launch-failed',{browserId,error:String(error).slice(0,1200)}));
  };
}
note('observer-installed',{version:require('playwright-core/package.json').version});
