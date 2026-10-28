import { chromium, devices } from 'playwright';
import { createServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { installLocalStorageFixture } from '../../tests/fixtures/local-storage.js';
import { openApp } from '../../tests/helpers/app.js';
const out=path.resolve(process.env.DIAG_OUTPUT||'controlled-evidence/a1');fs.mkdirSync(out,{recursive:true});
const log=(event,data={})=>fs.appendFileSync(path.join(out,'events.ndjson'),JSON.stringify({epoch:Date.now(),event,...data})+'\n');
const root=process.cwd(),limit=3000,deadline=30000;let calls=0,crashes=0,lifetime=0,browser,server,context,fatal;
const bounded=async(label,fn,ms=deadline)=>{let t;try{return await Promise.race([fn(),new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(label+' deadline '+ms)),ms)})]);}finally{clearTimeout(t)}};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const snapshot=async(page)=>bounded('worker snapshot',()=>page.evaluate(async()=>({controller:navigator.serviceWorker.controller?.scriptURL,registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({installing:r.installing?.state,waiting:r.waiting?.state,active:r.active?.state}))})),3000);
const {defaultBrowserType,...desktop}=devices['Desktop Chrome'];
const options={...desktop,baseURL:'http://127.0.0.1:4173',serviceWorkers:'allow',acceptDownloads:true,ignoreHTTPSErrors:false,javaScriptEnabled:true,bypassCSP:false,locale:'en-US',offline:false,colorScheme:'light'};
log('plan',{limit,maxCrashes:3,arm:'A1',options,headless:true,mode:'launch (original API)',os:os.release(),arch:os.arch()});
try{
 server=createServer((req,res)=>{const pathname=new URL(req.url,'http://127.0.0.1').pathname;const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{const bytes=fs.readFileSync(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(bytes);}catch{res.writeHead(404).end();}});
 await bounded('listen',()=>new Promise(r=>server.listen(4173,'127.0.0.1',r)));
 while(calls<limit&&crashes<3){
  lifetime++;const started=Date.now();let index=0;
  browser=await chromium.launch({timeout:deadline});let disconnected=false;browser.on('disconnected',()=>{disconnected=true;log('browser-disconnected',{lifetime,index,calls,elapsedMs:Date.now()-started})});log('browser-start',{lifetime,version:browser.version()});
  while(calls<limit){
   const profile=calls%2?'alexa':'jorge';calls++;index++;log('newContext-start',{calls,index,lifetime,profile});
   try{
    context=await bounded('newContext',()=>browser.newContext(options));log('newContext-complete',{calls,index,lifetime});
    const page=await context.newPage();page.setDefaultTimeout(deadline);page.setDefaultNavigationTimeout(deadline);
    await installLocalStorageFixture(page,profile==='jorge'?'blankJorge':'blankAlexa');
    await context.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
    await openApp(page);log('runtime-ready',{calls,index,lifetime,profile});
    await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?.active?.state==='activated'&&Boolean(navigator.serviceWorker.controller)},null,{timeout:deadline});
    await page.locator('.bottom-nav [data-view="train"]').click();
    log('interaction-complete',{calls,index,lifetime,worker:await snapshot(page)});
    const closeStart=Date.now();log('close-start',{calls,index,lifetime});await bounded('close',()=>context.close());context=null;log('close-complete',{calls,index,lifetime,durationMs:Date.now()-closeStart});
    if(calls%50===0)console.log(JSON.stringify({calls,lifetime,index,elapsedMs:Date.now()-started}));
   }catch(error){
    log('operation-failed',{calls,index,lifetime,error:String(error.stack||error),disconnected});
    if(disconnected){crashes++;break;}throw error;
   }
  }
  if(context){await bounded('failed context cleanup',()=>context.close()).catch(e=>{throw Error('cleanup '+e)});context=null;}
  await bounded('browser cleanup',()=>browser.close());browser=null;log('lifetime-end',{lifetime,index,crashes});
 }
}catch(error){fatal=String(error.stack||error);log('fatal',{error:fatal});}
finally{
 if(context)await bounded('final context close',()=>context.close()).catch(e=>log('cleanup-error',{error:String(e)}));
 if(browser)await bounded('final browser close',()=>browser.close()).catch(e=>log('cleanup-error',{error:String(e)}));
 if(server){server.closeAllConnections();await bounded('server close',()=>new Promise(r=>server.close(r))).catch(e=>log('cleanup-error',{error:String(e)}));}
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({arm:'A1',calls,crashes,lifetimes:lifetime,fatal,result:fatal?'INCOMPLETE':crashes?'NATIVE_DISCONNECTION_REQUIRES_STDERR_SIGNATURE':'NO_REPRODUCTION',sourceSha256:createHash('sha256').update(fs.readFileSync(import.meta.filename)).digest('hex')},null,2));
}
if(fatal||crashes)process.exitCode=1;
