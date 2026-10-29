import { test as base, expect } from '@playwright/test';
import { appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const target='swap safeguards entered/completed sets and rejects stale slot callbacks; Cancel restores position';
export { expect };
export const test=base.extend({
  page:async({page},use,testInfo)=>{
    if(process.env.POINTER_OBSERVE!=='1'||testInfo.title!==target){await use(page);return;}
    const directory=process.env.POINTER_ITERATION_DIR;
    const events=path.join(directory,'pointer-events.ndjson'),actions=path.join(directory,'pointer-actions.ndjson');
    let serial=Promise.resolve(),count=0,actionCount=0;const diagnosticErrors=[];
    const failed=(stage,error)=>diagnosticErrors.push({stage,error:String(error),at:new Date().toISOString()});
    const observe=async(stage,fn)=>{try{return await fn();}catch(error){failed(stage,error);return null;}};
    const enqueue=(file,data)=>{serial=serial.then(()=>appendFile(file,data)).catch(error=>failed('evidence-write',error));};
    await observe('install-binding',()=>page.context().exposeBinding('__pointerEvidence',async(source,batch)=>{
      const data=batch.map(event=>JSON.stringify({page:source.page?.url(),receivedUTC:new Date().toISOString(),...event})+'\n').join('');
      enqueue(events,data);await serial;count+=batch.length;
    }));
    await observe('install-init-script',()=>page.context().addInitScript({path:fileURLToPath(new URL('./observer.js',import.meta.url))}));
    const nativeLocator=page.locator;
    page.locator=function(selector,...options){
      const locator=Reflect.apply(nativeLocator,this,[selector,...options]);
      if(typeof selector==='string'&&selector.includes('data-swap-exercise')){
        const click=locator.click;
        try{locator.click=async function(...args){
          const id='swap-'+(++actionCount),measurementStartedUTC=new Date().toISOString();
          const measured=await observe('action-begin',async()=>{
            const value=await page.evaluate(({id,selector})=>{
              const element=document.querySelector(selector),r=element?.getBoundingClientRect();
              const intendedBoundingBox=r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;
              const state=window.__pointerDiagnostic?.begin(id,selector);
              return {intendedBoundingBox,state};
            },{id,selector});
            if(!value?.state)throw Error('Observer begin unavailable');return value;
          });
          const intendedBoundingBox=measured?.intendedBoundingBox,before=measured?.state,measuredUTC=new Date().toISOString();
          enqueue(actions,JSON.stringify({phase:'before',id,locator:selector,nodeUTC:new Date().toISOString(),measurementStartedUTC,measuredUTC,intendedBoundingBox,state:before,arguments:args})+'\n');
          let error=null;
          try{return await Reflect.apply(click,this,args);}
          catch(e){error=String(e);throw e;}
          finally{
            await observe('action-end',()=>page.evaluate(({id,error})=>window.__pointerDiagnostic?.end(id,error),{id,error}));
            enqueue(actions,JSON.stringify({phase:'after',id,nodeUTC:new Date().toISOString(),error})+'\n');
          }
        };}catch(error){failed('decorate-locator',error);}
      }
      return locator;
    };
    let health;
    try{await use(page);}
    finally{
      health=await observe('finish',()=>page.evaluate(()=>window.__pointerDiagnostic?.finish()));
      await serial;
      await writeFile(path.join(directory,'observer-health.json'),JSON.stringify({health,diagnosticErrors,eventsWritten:count,actions:actionCount},null,2));
    }
  }
});
