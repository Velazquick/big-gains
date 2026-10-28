import fs from 'node:fs'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.resolve('final-evidence/A');fs.mkdirSync(out,{recursive:true});
const cli=path.resolve('node_modules/@playwright/test/cli.js'),observer=path.resolve('scripts/final-diagnostic/context-observer.cjs');
const clean={...process.env};delete clean.NODE_OPTIONS;delete clean.DEBUG;
const collected=spawnSync(process.execPath,[cli,'test','--project=chromium','--list','--reporter=json'],{env:clean,encoding:'utf8',maxBuffer:16*1024*1024});
fs.writeFileSync(path.join(out,'collection.json'),collected.stdout);assert.equal(collected.status,0,collected.stderr);
const listing=JSON.parse(collected.stdout),files=listing.suites.map(s=>s.file),expected=listing.suites.reduce((n,s)=>{const count=s=>(s.specs||[]).length+(s.suites||[]).reduce((n,s)=>n+count(s),0);return n+count(s)},0);
assert.equal(files.length,87);assert.equal(expected,780);assert.equal(new Set(files).size,87);
if(process.env.FINAL_COLLECTION_ONLY==='true'){console.log(JSON.stringify({files:files.length,expected}));process.exit(0);}
const rows=[];fs.writeFileSync(path.join(out,'file-order.json'),JSON.stringify({files,expected},null,2));
for (let i=0;i<files.length;i++) {
 const file=files[i],folder=path.join(out,String(i+1).padStart(2,'0'));fs.mkdirSync(folder);
 const log=fs.openSync(path.join(folder,'runner.log'),'w'),report=path.join(folder,'report.json');
 const env={...process.env,NODE_OPTIONS:'--require '+observer,FINAL_CONTEXT_LEDGER:path.join(folder,'contexts.ndjson'),FINAL_FILE:file,PLAYWRIGHT_JSON_OUTPUT_NAME:report,PLAYWRIGHT_HTML_OUTPUT_DIR:path.join(folder,'html'),DEBUG:'pw:browser'};
 const started=Date.now();const result=spawnSync(process.execPath,[cli,'test','--project=chromium','tests/'+file,'--reporter=line,json','--output='+path.join(folder,'test-results')],{env,stdio:['ignore',log,log],timeout:12*60*1000});fs.closeSync(log);
 const row={ordinal:i+1,file,started,ended:Date.now(),exit:result.status,signal:result.signal,error:result.error?String(result.error):null};
 if(fs.existsSync(report)){const r=JSON.parse(fs.readFileSync(report));row.stats=r.stats;row.testCount=r.stats.expected+r.stats.unexpected+r.stats.flaky+r.stats.skipped;}
 rows.push(row);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({configuration:'Original 780-case Chromium collection; fresh CLI/browser process per original test file; no test/assertion/fixture/config modification',expected,files:files.length,rows},null,2));
 console.log(JSON.stringify(row));
 if(result.error)break;
}
if(rows.length!==87||rows.some(r=>r.exit!==0)||rows.reduce((n,r)=>n+(r.testCount||0),0)!==780)process.exitCode=1;
