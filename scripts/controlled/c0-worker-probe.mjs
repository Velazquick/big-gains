import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const require=createRequire(resolve(process.env.BG_REPRO_PACKAGE||'package.json'));
const engineName=process.env.DIAG_ENGINE||'webkit';
const engine=require('playwright')[engineName];
const packageVersion=require('playwright/package.json').version;
const output=resolve(process.env.BG_REPRO_OUTPUT||'native-worker-navigation.json');
mkdirSync(dirname(output),{recursive:true});
const count=10,deadline=8000,rows=[];
const sourceHash=createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex');
const meta={frozen:{iterationsPerArm:count,deadlineMs:deadline,modes:['interrupt-import','register-before-navigation'],browser:engineName,source:import.meta.url,sourceSha256:sourceHash},platform:process.platform,arch:process.arch,node:process.version,packageVersion,rows};
function save(){writeFileSync(output,JSON.stringify(meta,null,2));}
async function bounded(label,operation,ms=deadline){let timer;try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label}: diagnostic deadline ${ms}ms exceeded`)),ms);})]);}finally{clearTimeout(timer);}}
const html=`<!doctype html><title>synthetic worker lifecycle</title><body>synthetic worker lifecycle<script>
window.__registrationResolved=false;window.__readyResolved=false;
const note=(event,extra={})=>console.log('__REPRO__'+JSON.stringify({event,epoch:Date.now(),url:location.href,registrationResolved:window.__registrationResolved,readyResolved:window.__readyResolved,controller:Boolean(navigator.serviceWorker.controller),...extra}));
addEventListener('pagehide',()=>note('pagehide'));
navigator.serviceWorker.addEventListener('controllerchange',()=>note('controllerchange'));
note('register-called');
window.__registration=navigator.serviceWorker.register('/worker.js',{updateViaCache:'none'});
window.__registration.then(r=>{window.__registrationResolved=true;note('register-resolved',{installing:r.installing?.state,active:r.active?.state});},e=>note('register-rejected',{message:String(e)}));
navigator.serviceWorker.ready.then(()=>{window.__readyResolved=true;note('ready-resolved')});
</script>`;
const worker=`importScripts('/manifest.js','/core.js');self.addEventListener('install',event=>event.waitUntil(precache()));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));`;
const core=`async function precache(){const cache=await caches.open('synthetic-v1');const response=await fetch('/shell');await cache.put('/shell',response);}`;
meta.syntheticSha256=Object.fromEntries(Object.entries({html,worker,core}).map(([name,bytes])=>[name,createHash('sha256').update(bytes).digest('hex')]));
let browser;
try{
 browser=await bounded('browser.launch',()=>engine.launch(),15000);meta.browserVersion=browser.version();
 outer:for(let n=0;n<count;n++)for(const mode of meta.frozen.modes){
  const row={iteration:n+1,mode,events:[],result:'UNPERFORMED',cleanupErrors:[]};rows.push(row);
  let release,heldResolve,held=false,server,context,page;
  const gate=new Promise(r=>release=r),heldRequest=new Promise(r=>heldResolve=r);
  try{
   server=createServer(async(req,res)=>{row.events.push({event:'http-request',epoch:Date.now(),path:req.url});res.on('finish',()=>row.events.push({event:'http-finish',epoch:Date.now(),path:req.url}));res.on('close',()=>row.events.push({event:'http-close',epoch:Date.now(),path:req.url,finished:res.writableFinished}));
    try{
     if(req.url==='/core.js'&&!held){held=true;heldResolve();await gate;}
     if(res.destroyed)return;
     res.writeHead(200,{'Content-Type':req.url?.endsWith('.js')?'text/javascript':'text/html','Cache-Control':'no-store'});res.end(req.url==='/worker.js'?worker:req.url==='/manifest.js'?'const MANIFEST = 1;':req.url==='/core.js'?core:req.url==='/shell'?'synthetic cached shell':html);
    }catch(error){row.events.push({event:'http-handler-error',epoch:Date.now(),message:String(error)});req.socket.destroy();}
   });
   await bounded('server.listen',()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});}));
   const origin=`http://127.0.0.1:${server.address().port}`;row.origin=origin;
   context=await bounded('browser.newContext',()=>browser.newContext());
   page=await bounded('context.newPage',()=>context.newPage());
   page.on('console',message=>{const t=message.text();if(t.startsWith('__REPRO__'))try{row.events.push(JSON.parse(t.slice(9)));}catch(error){row.events.push({event:'observer-error',message:String(error)});}});
   page.on('pageerror',e=>row.events.push({event:'pageerror',message:String(e),epoch:Date.now()}));
   await page.goto(origin,{waitUntil:'domcontentloaded',timeout:deadline});
   await bounded('core import barrier',()=>heldRequest);
   row.events.push({event:'core-barrier-reached',epoch:Date.now()});
   if(mode==='register-before-navigation'){
    release();row.events.push({event:'core-barrier-released',epoch:Date.now()});
    await page.waitForFunction(()=>window.__registrationResolved,null,{timeout:deadline});
   }
   const navigation=page.waitForEvent('domcontentloaded',{timeout:deadline});
   await Promise.all([navigation,bounded('native location.reload evaluate',()=>page.evaluate(()=>{location.reload();}))]);
   row.events.push({event:'replacement-document-domcontentloaded',epoch:Date.now()});
   if(mode==='interrupt-import'){release();row.events.push({event:'core-barrier-released',epoch:Date.now()});}
   await page.waitForFunction(()=>window.__readyResolved&&navigator.serviceWorker.controller,null,{timeout:deadline});
   row.result='PASS';
  }catch(error){row.result='FAIL';row.error=String(error);}
  finally{
   if(page&&!page.isClosed())try{row.final=await bounded('native final snapshot',()=>page.evaluate(async()=>({ready:window.__readyResolved,controller:Boolean(navigator.serviceWorker.controller),registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({installing:r.installing?.state,waiting:r.waiting?.state,active:r.active?.state}))})),1500);}catch(error){row.snapshotError=String(error);}
   if(row.result==='FAIL'&&context&&!page.isClosed()){
    row.events.push({event:'new-client-probe-start',epoch:Date.now()});
    let second;
    try{
     second=await bounded('second page',()=>context.newPage());
     await second.goto(row.origin,{waitUntil:'domcontentloaded',timeout:deadline});
     await second.waitForFunction(()=>window.__readyResolved&&navigator.serviceWorker.controller,null,{timeout:deadline});
     row.newClient={result:'PROGRESSED',epoch:Date.now()};
    }catch(error){row.newClient={result:'NO_PROGRESS_WITHIN_DIAGNOSTIC_DEADLINE',error:String(error),epoch:Date.now()};}
    row.originalClientAfterProbe=await bounded('original after new client',()=>page.evaluate(async()=>({ready:window.__readyResolved,controller:Boolean(navigator.serviceWorker.controller),registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({installing:r.installing?.state,waiting:r.waiting?.state,active:r.active?.state}))})),1500).catch(error=>({error:String(error)}));
    if(second)await bounded('second close',()=>second.close());
   }
   release();
   if(context)try{await bounded('context.close',()=>context.close());row.contextClosed=true;}catch(error){row.cleanupErrors.push(String(error));}
   if(server)try{server.closeAllConnections();await bounded('server.close',()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())),2000);row.serverClosed=true;}catch(error){row.cleanupErrors.push(String(error));}
   save();
  }
  console.log(JSON.stringify({iteration:n+1,mode,result:row.result,final:row.final,cleanupErrors:row.cleanupErrors}));
  if(row.cleanupErrors.length){meta.stopped='owned cleanup failure';break outer;}
 }
}catch(error){meta.fatalError=String(error);}
finally{
 if(browser)try{await bounded('browser.close',()=>browser.close());meta.browserClosed=true;}catch(error){meta.browserCloseError=String(error);}
 meta.completedCells=rows.length;meta.summary=Object.fromEntries(meta.frozen.modes.map(mode=>[mode,{pass:rows.filter(r=>r.mode===mode&&r.result==='PASS').length,fail:rows.filter(r=>r.mode===mode&&r.result==='FAIL').length}]));save();
}
if(rows.length!==count*2||rows.some(r=>r.result!=='PASS'||r.cleanupErrors.length)||meta.fatalError||meta.browserCloseError)process.exitCode=1;
