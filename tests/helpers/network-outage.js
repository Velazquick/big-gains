import {test as base} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {nativeHttpObservationPort} from './native-http-observation.js';
import {createHash} from 'node:crypto';
import {instrumentSelectedWorkerBytes} from './native-worker-stage-injection.js';
import {handleSelectedWorkerStage} from './native-worker-stage-endpoint.js';

// WebKit's driver-level setOffline causes an internal navigation error rather
// than exercising worker fallback here. Use the protected PWA corpus's real
// server-transport outage model on WebKit. Chromium retains setOffline coverage.
export const test=base.extend({
 appTransport:async({browserName},use,testInfo)=>{
  if(browserName!=='webkit'){await use(null);return;}
  const root=fileURLToPath(new URL('../../',import.meta.url));let down=false;
  const nativeObservation=nativeHttpObservationPort();
  const stageRequested=process.env.BIG_GAINS_NATIVE_WORKER_STAGE_DIAGNOSTICS==='true';
  const stageEnabled=stageRequested&&testInfo.title==='fresh managed member restores exact Alexa schema v5, adopts a zero-queue baseline, and remains local-first offline';
  const stageMode={requested:stageRequested,enabled:stageEnabled,sourceSha256:null,wireSha256:null,workerRequests:0,wireConsistent:true};
  let preparedWorker=null;
  if(stageEnabled){
   const original=await readFile(resolve(root,'service-worker.js'));
   preparedWorker={source:original,wire:instrumentSelectedWorkerBytes(original,{enabled:true})};
  }
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json','.wav':'audio/wav'};
  const server=createServer(async(req,res)=>{
   const observation=nativeObservation.request(req,res);
   if(down){observation.unavailable();req.socket.destroy();return;}
   const url=new URL(req.url,'http://localhost');
   if(handleSelectedWorkerStage({selected:stageEnabled,url,req,res,nativeObservation,observation}))return;
   const name=url.pathname.slice(1)||'index.html';
   const path=resolve(root,name);
   if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403).end();return;}
   try{
    const original=await readFile(path);
    let body=original;
    if(url.pathname==='/service-worker.js'&&(stageEnabled||nativeObservation.enabled())){
     if(stageEnabled){if(!original.equals(preparedWorker.source))throw new Error('Worker bytes changed after diagnostic preparation');body=preparedWorker.wire;}
     const sourceSha256=createHash('sha256').update(original).digest('hex');
     const wireSha256=createHash('sha256').update(body).digest('hex');
     stageMode.wireConsistent=stageMode.wireConsistent&&(!stageMode.wireSha256||stageMode.wireSha256===wireSha256);
     Object.assign(stageMode,{sourceSha256,wireSha256,workerRequests:stageMode.workerRequests+1});
     nativeObservation.record('worker-stage-wire',{...stageMode,sourceBytes:original.length,wireBytes:body.length});
    }
    observation.bytesReady(body);observation.responseScheduled(200);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
   }catch(error){observation.originalCatch(error);res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{await use({origin:`http://127.0.0.1:${server.address().port}`,subscribeNativeObserver:nativeObservation.subscribeNativeObserver,workerStageMode:()=>({...stageMode}),setUnavailable:value=>{down=value;nativeObservation.record('outage-state',{down});}});}finally{
   nativeObservation.record('server-teardown-start');
   server.closeAllConnections();await new Promise(r=>server.close(r));
   nativeObservation.record('server-teardown-end');
   if(stageEnabled){
    await testInfo.attach('worker-stage-original-script',{contentType:'text/javascript',body:preparedWorker.source});
    await testInfo.attach('worker-stage-instrumented-script',{contentType:'text/javascript',body:preparedWorker.wire});
   }
   if(nativeObservation.enabled())await testInfo.attach('native-http-observation',{contentType:'application/json',body:Buffer.from(JSON.stringify(nativeObservation.snapshot(),null,2))});
  }
 },
 baseURL:async({appTransport},use)=>{await use(appTransport?.origin||'http://127.0.0.1:4173');},
 setAppNetworkUnavailable:async({context,appTransport},use)=>{await use(async value=>{if(appTransport)appTransport.setUnavailable(value);else await context.setOffline(value);});}
});
