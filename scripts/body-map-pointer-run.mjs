import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync,execFileSync } from 'node:child_process';
const root=process.cwd(),out=path.join(root,'pointer-evidence');fs.mkdirSync(out,{recursive:true});
const base='d80f30f543e41fccc59224c4a5f7e2397bbaf884';
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
fs.writeFileSync(path.join(out,'source-proof.json'),JSON.stringify({base,diagnostic:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),changes,originalTestSha256:hash(originalBlob),prefixSha256:hash(prefix),generatedSha256:hash(expected),originalPrefixEquivalentExceptImport:true,directTestDeclarations:(prefix.match(/^test\(/gm)||[]).length,expectedCollectedTests:11,maximumInvocations:100,referenceInvocations:1},null,2));
const flatten=suites=>suites.flatMap(s=>[...(s.specs||[]),...flatten(s.suites||[])]);
const summary={base,maximumInvocations:100,referenceContract:'Exactly one uninstrumented reference. Its target failure is retained but is not sufficient event attribution, so an observed phase still proceeds within the same100 total cap. Stop at first valid observed target failure or any invalid execution.',iterations:[],stop:null};
for(let iteration=1;iteration<=100;iteration++){
  const observe=iteration!==1;
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
    const began=captured.filter(e=>e.kind==='action-begin');
    const successfulActions=captured.filter(e=>e.kind==='action-end'&&!e.error);
    const hasDownUp=successfulActions.every(a=>['pointerdown','pointerup'].every(type=>captured.some(e=>e.kind==='dom-event'&&e.event===type&&e.action===a.id&&e.isTrusted)));
    const missingClicks=successfulActions.filter(a=>!captured.some(e=>e.kind==='dom-event'&&e.event==='click'&&e.action===a.id&&e.isTrusted)).map(a=>a.id);
    row.eventIntegrity={actionBegins:began.length,successfulActions:successfulActions.length,successfulActionsHaveDownAndUp:hasDownUp,missingClicks,observedPointerDowns:health?.eventCounts?.pointerdown||0,observationErrors:health?.observationErrors,diagnosticErrors:row.observer?.diagnosticErrors};
    row.valid=prefixValid&&!!health&&!(row.observer.diagnosticErrors||[]).length&&health.observationErrors===0&&health.dropped===0&&health.remaining===0&&health.flushing===false&&row.observer.eventsWritten===health.sent&&row.observer.eventsWritten>0&&row.observer.actions>=2&&began.length===row.observer.actions&&hasDownUp&&health.eventCounts.pointerdown>0&&(result.status!=='passed'||missingClicks.length===0);
  }else row.valid=prefixValid&&!!result;
  fs.writeFileSync(path.join(dir,'iteration.json'),JSON.stringify(row,null,2));summary.iterations.push(row);
  if(!row.valid){summary.stop='invalid-execution';}
  else if(observe&&result.status!=='passed'){summary.stop='captured-target-failure';}
  else if(iteration===100){summary.stop='bounded-limit';}
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(summary,null,2));
  console.log(JSON.stringify({iteration,observe,target:row.targetStatus,valid:row.valid,stop:summary.stop}));
  if(summary.stop)break;
}
if(summary.stop==='invalid-execution')process.exitCode=1;
