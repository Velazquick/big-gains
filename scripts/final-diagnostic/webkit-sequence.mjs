import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
const out=path.resolve('final-evidence/B');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync('.github/workflows/browser-tests.yml','utf8');
const command=source.split('\n').find(s=>s.includes('run: npx playwright test --project=webkit --output=test-results-webkit'));
assert.ok(command);const args=command.trim().replace(/^run: npx playwright /,'').split(/\s+/).filter(s=>!s.startsWith('--output='));
const cli=path.resolve('node_modules/@playwright/test/cli.js');const env={...process.env,CI:'true',BIG_GAINS_WEBKIT_QA:'true'};delete env.NODE_OPTIONS;delete env.DEBUG;
const listing=spawnSync(process.execPath,[cli,...args,'--list','--reporter=json'],{env,encoding:'utf8',maxBuffer:16*1024*1024});assert.equal(listing.status,0);fs.writeFileSync(path.join(out,'collection.json'),listing.stdout);
const data=JSON.parse(listing.stdout);const count=s=>(s.specs||[]).length+(s.suites||[]).reduce((n,s)=>n+count(s),0);assert.equal(data.suites.reduce((n,s)=>n+count(s),0),275);
// One measured uninstrumented replay first. No automatic repeats or retries.
const fd=fs.openSync(path.join(out,'runner.log'),'w');const started=Date.now();
const result=spawnSync(process.execPath,[cli,...args,'--reporter=line,json','--output='+path.join(out,'test-results')],{env:{...env,PLAYWRIGHT_JSON_OUTPUT_NAME:path.join(out,'report.json'),PLAYWRIGHT_HTML_OUTPUT_DIR:path.join(out,'html')},stdio:['ignore',fd,fd],timeout:22*60*1000});fs.closeSync(fd);
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({started,ended:Date.now(),durationSeconds:(Date.now()-started)/1000,originalArguments:args,exit:result.status,signal:result.signal,error:result.error?String(result.error):null,instrumentation:'Original source/config/test bodies and interactions; no API/page observer; JSON reporter only; original long-lived fixture configuration'},null,2));
process.exitCode=result.status??1;
