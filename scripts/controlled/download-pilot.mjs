import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('controlled-evidence/download');fs.mkdirSync(root,{recursive:true});
const rows=[];let stop=false;
for(let n=1;n<=200;n++){
 const dir=path.join(root,String(n).padStart(3,'0')),instrument=n%2===0;fs.mkdirSync(dir,{recursive:true});
 const fd=fs.openSync(path.join(dir,'runner.log'),'wx');
 const start=Date.now();const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config=scripts/controlled/download.config.mjs','--grep','unreadable structured state remains protected: null$'],{env:{...process.env,DIAG_OUTPUT:dir,DIAG_OBSERVER:String(instrument)},stdio:['ignore',fd,fd],timeout:160000});fs.closeSync(fd);
 const reportPath=path.join(dir,'report.json');let report;try{report=JSON.parse(fs.readFileSync(reportPath));}catch{}
 const row={iteration:n,instrument,elapsedMs:Date.now()-start,exitCode:result.status,signal:result.signal,error:result.error?.message,stats:report?.stats};rows.push(row);fs.writeFileSync(path.join(root,'summary.json'),JSON.stringify(rows,null,2));console.log(JSON.stringify(row));
 if(result.status!==0){stop=true;break;}
}
if(stop)process.exitCode=1;
