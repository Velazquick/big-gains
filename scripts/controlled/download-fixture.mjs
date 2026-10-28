import {test as base,expect} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
export {expect};
export const test=base.extend({
 _passiveObservation:[async({page,context},use,testInfo)=>{
  const instrument=process.env.DIAG_OBSERVER==='true',dir=path.resolve(process.env.DIAG_OUTPUT||'controlled-evidence/download');fs.mkdirSync(dir,{recursive:true});
  const events=[],note=(event,data={})=>{events.push({event,epoch:Date.now(),...data});fs.writeFileSync(path.join(dir,'events.json'),JSON.stringify(events,null,2));};
  page.on('download',d=>note('native-download',{url:d.url(),filename:d.suggestedFilename()}));
  page.on('crash',()=>note('page-crash'));context.browser()?.on('disconnected',()=>note('browser-disconnected'));
  page.on('popup',p=>note('popup',{url:p.url()}));page.on('framenavigated',f=>note('navigation',{url:f.url(),main:f===page.mainFrame()}));
  page.on('requestfailed',r=>note('request-failed',{url:r.url(),error:r.failure()}));
  if(instrument){
   await page.exposeBinding('__diagEvent',(_source,event)=>note('page-observation',event));
   await page.addInitScript(()=>{
    const send=(event,data={})=>{void window.__diagEvent({event,clock:performance.now(),activation:navigator.userActivation?{active:navigator.userActivation.isActive,ever:navigator.userActivation.hasBeenActive}:null,visibility:document.visibilityState,...data});};
    const NativeBlob=Blob;window.__diagBlobs=[];
    window.Blob=class extends NativeBlob{constructor(parts,options){super(parts,options);window.__diagBlobs.push(this);send('blob-created',{size:this.size,type:this.type,parts:parts.map(v=>typeof v==='string'?v:null)});}};
    const create=URL.createObjectURL,revoke=URL.revokeObjectURL,click=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=function(blob){const url=create.call(this,blob);send('url-created',{url,size:blob.size});return url;};
    URL.revokeObjectURL=function(url){send('url-revoked',{url});return revoke.call(this,url);};
    HTMLAnchorElement.prototype.click=function(){send('anchor-click',{href:this.href,download:this.download,connected:this.isConnected});return click.call(this);};
    document.addEventListener('click',event=>{if(event.target.closest?.('#downloadRecoveryData'))send('trusted-click',{trusted:event.isTrusted});},true);
   });
  }
  note('test-start',{instrument,timeout:testInfo.timeout});
  await use();
  note('original-test-end',{status:testInfo.status,errors:testInfo.errors.map(e=>e.message)});
  if(testInfo.status!=='passed'&&!page.isClosed()){
   // Teardown's own deadline does not change the original 30-second acceptance result.
   note('passive-after-timeout-start');await new Promise(r=>setTimeout(r,60000));note('passive-after-timeout-end');
  }
  if(instrument&&!page.isClosed())try{note('post-callback-blobs',{blobs:await page.evaluate(async()=>Promise.all((window.__diagBlobs||[]).map(async b=>({size:b.size,text:await b.text()}))))});}catch(e){note('snapshot-error',{error:String(e)});}
 },{auto:true,timeout:70000}]
});
