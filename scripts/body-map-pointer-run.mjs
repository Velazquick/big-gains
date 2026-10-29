import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync,execFileSync } from 'node:child_process';
const root=process.cwd(),out=path.join(root,'pointer-evidence');fs.mkdirSync(out,{recursive:true});
const base='d80f30f543e41fccc59224c4a5f7e2397bbaf884';
// One aggregate budget: M1 21 invocations (including interrupted prefix),
// one actual incidental target, and up to three reachable new incidental targets.
const maximumInvocations=75,priorBudget=22,incidentalReserve=3;
if(maximumInvocations+priorBudget+incidentalReserve>100)throw Error('Aggregate attempt budget exceeded.');
const target='swap safeguards entered/completed sets and rejects stale slot callbacks; Cancel restores position';
const original=fs.readFileSync('tests/body-map-swap.spec.js','utf8');
const prefix=original.slice(0,original.indexOf("\ntest('Routine swap stays in draft"));
const importLine="import { expect, test } from '@playwright/test';";
const redirect="import { expect, test } from './diagnostics/body-map-pointer/fixture.mjs';";
const expected=prefix.replace(importLine,redirect);
if(fs.readFileSync('tests/body-map-pointer-prefix.diagnostic.spec.js','utf8')!==expected)throw Error('Diagnostic prefix differs beyond first import.');
const originalBlob=execFileSync('git',['show',base+':tests/body-map-swap.spec.js']);
if(!originalBlob.equals(Buffer.from(original)))throw Error('Original test changed.');
const allowed=new Set(['.github/workflows/body-map-pointer-diagnostic.yml','pointer.diagnostic.config.mjs','scripts/body-map-pointer-run.mjs','tests/body-map-pointer-prefix.diagnostic.spec.js','tests/diagnostics/body-map-pointer/observer.js','tests/diagnostics/body-map-pointer/fixture.mjs']);
const changes=execFileSync('git',['diff','--name-status',base,'HEAD'],{encoding:'utf8'}).trim().split('\n').filter(Boolean).map(line=>line.split('\t'));
if(changes.length!==allowed.size||changes.some(([kind,file])=>kind!=='A'||!allowed.has(file)))throw Error('Diagnostic contains an application/existing-test/protected-workflow change.');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
fs.writeFileSync(path.join(out,'source-proof.json'),JSON.stringify({base,diagnostic:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),changes,originalTestSha256:hash(originalBlob),prefixSha256:hash(prefix),generatedSha256:hash(expected),originalPrefixEquivalentExceptImport:true,directTestDeclarations:(prefix.match(/^test\(/gm)||[]).length,expectedCollectedTests:11,method:'M2',maximumInvocations,priorBudget,incidentalReserve,maximumAggregate:100,referenceInvocations:0},null,2));
const flatten=suites=>suites.flatMap(s=>[...(s.specs||[]),...flatten(s.suites||[])]);
const summary={base,method:'M2',maximumInvocations,priorBudget,incidentalReserve,maximumAggregate:100,referenceContract:'No second reference. Preserve M1 reference failure,19 observed passes and interrupted prefix; M2 removes action-adjacent browser RPCs and continuously samples geometry. Stop first valid observed target failure, invalid execution, or remaining phase cap.',iterations:[],stop:null};
for(let iteration=1;iteration<=maximumInvocations;iteration++){
  const observe=true;
  const dir=path.join(out,'iterations',String(iteration).padStart(3,'0')+(observe?'-observed':'-reference'));fs.mkdirSync(dir,{recursive:true});
  const resultFile=path.join(dir,'results.json'),log=fs.openSync(path.join(dir,'stdout.log'),'w');
  const started=new Date().toISOString();
  const run=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config=pointer.diagnostic.config.mjs','--project=webkit'],{env:{...process.env,POINTER_OBSERVE:observe?'1':'0',POINTER_ITERATION_DIR:dir,POINTER_RESULT_FILE:resultFile,POINTER_TEST_OUTPUT:path.join(dir,'test-output'),CI:'true',BIG_GAINS_WEBKIT_QA:'true'},stdio:['ignore',log,log],timeout:330000});fs.closeSync(log);
  let report=null;try{report=JSON.parse(fs.readFileSync(resultFile));}catch{}
  const specs=report?flatten(report.suites):[];const focused=specs.find(s=>s.title===target);const result=focused?.tests?.[0]?.results?.[0];
  const row={iteration,observe,started,ended:new Date().toISOString(),exitCode:run.status,spawnError:run.error?.message,testCount:specs.length,targetStatus:result?.status||'unexecuted',valid:false};
  for(const spec of specs){
    for(const test of spec.tests||[]){for(const r of test.results||[]){
      const keep=spec.title===target||r.status!=='passed';
      if(keep)for(const attachment of r.attachments||[]){
        if(!attachment.path)continue;
        const src=path.isAbsolute(attachment.path)?attachment.path:path.resolve(attachment.path);
        const extension=path.extname(src);const name=(spec.title===target?'target':'prefix-failure')+'-'+attachment.name.replace(/[^a-z0-9-]/gi,'_')+extension;
        if(fs.existsSync(src))fs.copyFileSync(src,path.join(dir,name));
      }
    }}
  }
  const prefixValid=specs.length===11&&!(report.errors||[]).length&&!run.error&&specs.every(s=>s.tests?.length===1&&s.tests[0].results?.length===1&&s.tests[0].results[0].retry===0&&(s.title===target?['passed','failed','timedOut'].includes(s.tests[0].results[0].status):s.tests[0].results[0].status==='passed'));
  if(observe){
    try{row.observer=JSON.parse(fs.readFileSync(path.join(dir,'observer-health.json')));}catch{}
    const health=row.observer?.health;
    const captured=fs.existsSync(path.join(dir,'pointer-events.ndjson'))?fs.readFileSync(path.join(dir,'pointer-events.ndjson'),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
    const notes=fs.existsSync(path.join(dir,'pointer-actions.ndjson'))?fs.readFileSync(path.join(dir,'pointer-actions.ndjson'),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
    const windows=notes.filter(a=>a.phase==='before').map(a=>({id:a.id,locator:a.locator,before:a.nodeEpochMs,after:notes.find(b=>b.id===a.id&&b.phase==='after')}));
    const native=captured.filter(e=>e.kind==='dom-event'&&e.isTrusted&&['pointerdown','pointerup','click'].includes(e.event));
    const within=(e,a)=>!!a.after&&e.timeOrigin+e.at>=a.before&&e.timeOrigin+e.at<=a.after.nodeEpochMs;
    const successfulActions=windows.filter(a=>a.after&&!a.after.error);
    const hasDownUp=successfulActions.every(a=>['pointerdown','pointerup'].every(type=>native.some(e=>e.event===type&&within(e,a))));
    const missingClicks=successfulActions.filter(a=>!native.some(e=>e.event==='click'&&within(e,a))).map(a=>a.id);
    const ambiguousNative=native.filter(e=>windows.filter(a=>within(e,a)).length>1).map(e=>e.seq);
    const actionWindows=windows.map(a=>{const frame=captured.filter(e=>e.kind==='frame'&&e.timeOrigin+e.at<=a.before).at(-1);return {...a,nativeSequences:native.filter(e=>within(e,a)).map(e=>e.seq),preActionFrame:frame?.seq,preActionGeometry:frame?.state?.geometry,preActionFrameAgeMs:frame?a.before-frame.timeOrigin-frame.at:null};});
    row.eventIntegrity={actionWindows,clockBridge:'Browser performance.timeOrigin+at versus Node Date.now; verify margins offline. Sampled geometry is not Playwright internal actionability geometry.',successfulActions:successfulActions.length,successfulActionsHaveDownAndUp:hasDownUp,missingClicks,ambiguousNative,observedPointerDowns:health?.eventCounts?.pointerdown||0,observationErrors:health?.observationErrors,diagnosticErrors:row.observer?.diagnosticErrors};
    row.valid=prefixValid&&!!health&&!(row.observer.diagnosticErrors||[]).length&&health.observationErrors===0&&health.dropped===0&&health.remaining===0&&health.flushing===false&&row.observer.eventsWritten===health.sent&&row.observer.eventsWritten>0&&row.observer.actions>=2&&windows.length===row.observer.actions&&windows.every(a=>a.after)&&hasDownUp&&ambiguousNative.length===0&&health.eventCounts.pointerdown>0&&(result.status!=='passed'||missingClicks.length===0);
  }else row.valid=prefixValid&&!!result;
  fs.writeFileSync(path.join(dir,'iteration.json'),JSON.stringify(row,null,2));summary.iterations.push(row);
  if(!row.valid){summary.stop='invalid-execution';}
  else if(observe&&result.status!=='passed'){summary.stop='captured-target-failure';}
  else if(iteration===maximumInvocations){summary.stop='bounded-limit';}
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({iteration,observe,target:row.targetStatus,valid:row.valid,stop:summary.stop}));
  if(summary.stop)break;
}
if(summary.stop==='invalid-execution')process.exitCode=1;
