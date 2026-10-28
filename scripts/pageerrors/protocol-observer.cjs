'use strict';
// Observe selected WKSession events before the original listener processes them.
const fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const target=process.env.PAGEERROR_PROTOCOL_LEDGER;
if(!target||!path.isAbsolute(target))throw Error('Absolute protocol ledger required');
fs.mkdirSync(path.dirname(target),{recursive:true});let count=0;
const original=EventEmitter.prototype.emit;
const selected=new Set(['Console.messageAdded','Page.frameNavigated','Page.frameDetached','Page.frameStartedLoading','Page.frameStoppedLoading','Page.frameScheduledNavigation','Page.frameClearedScheduledNavigation','Runtime.executionContextCreated','Runtime.executionContextDestroyed','Runtime.executionContextsCleared','Network.requestWillBeSent','Network.responseReceived','Network.loadingFailed','Network.loadingFinished']);
function headers(raw){return Object.fromEntries(Object.entries(raw||{}).filter(([k])=>/^(origin|access-control-|content-type|location|sec-fetch-)/i.test(k)))}
EventEmitter.prototype.emit=function(event,payload){
 if(this.constructor?.name==='WKSession'&&selected.has(event)){
  try{
   if(++count>20000){if(count===20001)fs.appendFileSync(target,JSON.stringify({event:'OBSERVER_LIMIT',epoch:Date.now()})+'\n');}
   else {
    let data=payload;
    if(event==='Console.messageAdded'&&payload?.message?.level!=='error')data=null;
    if(event==='Network.requestWillBeSent')data={...payload,request:{url:payload.request?.url,method:payload.request?.method,headers:headers(payload.request?.headers)},redirectResponse:payload.redirectResponse?{status:payload.redirectResponse.status,headers:headers(payload.redirectResponse.headers)}:undefined};
    if(event==='Network.responseReceived')data={...payload,response:{url:payload.response?.url,status:payload.response?.status,statusText:payload.response?.statusText,headers:headers(payload.response?.headers),source:payload.response?.source}};
    if(data)fs.appendFileSync(target,JSON.stringify({event,epoch:Date.now(),nodePid:process.pid,sessionId:this.sessionId,data})+'\n');
   }
  }catch(error){process.stderr.write('PAGEERROR_OBSERVER_ERROR '+String(error)+'\n');}
 }
 return original.apply(this,arguments);
};
fs.appendFileSync(target,JSON.stringify({event:'observer-installed',epoch:Date.now(),version:require('playwright-core/package.json').version})+'\n');
