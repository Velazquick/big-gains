import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
import {webcrypto,randomUUID} from 'node:crypto';
// Runs the unmodified migration engine entirely in synthetic in-memory storage.
export async function genuineJournal({states,account,profiles,auth}) {
 const sandbox={window:{},crypto:webcrypto,TextEncoder,console,Date,setTimeout,clearTimeout};
 for(const file of ['migration-preview.js','migration-engine.js'])vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
 const previewApi=sandbox.window.BigGainsMigrationPreview,engine=sandbox.window.BigGainsMigrationEngine;
 const localSnapshots=Object.fromEntries(Object.entries(states).map(([id,value])=>[id,{ok:true,value:structuredClone(value)}]));
 const remote={signedInUserId:auth,accounts:[account],profiles,counts:Object.fromEntries(previewApi.applicationTables.map(t=>[t,0]))};
 const preview=await previewApi.buildPreview({localSnapshots,remote,generatedAt:'2026-10-20T12:00:00.000Z',appRelease:'v47.1-phase4d-legacy-source-preview'});
 const audit=previewApi.auditArtifact(preview);delete audit.remoteCounts.bodyweight_entries;
 const plan=await engine.buildMigrationPlan({audit,preview,localSnapshots});
 const tables=Object.fromEntries(engine.targetTables.map(t=>[t,[]]));let journal;
 const copy=v=>JSON.parse(JSON.stringify(v));
 const row=v=>({id:randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),...copy(v)});
 const repository={
  async insertJournal(value){journal=row(value);return copy(journal)},
  async updateJournal(id,values){assert.equal(id,journal.id);Object.assign(journal,copy(values));return copy(journal)},
  async findJournal(id){return journal?.client_id===id?copy(journal):null},
  async insertRow(table,value){const saved=row(value);assert.ok(!tables[table].some(v=>v.profile_id===saved.profile_id&&v.client_id===saved.client_id));tables[table].push(saved);return copy(saved)},
  async findRow(table,profileId,id){return copy(tables[table].find(v=>v.profile_id===profileId&&v.client_id===id)||null)},
  async readAll(table){return copy(tables[table])}
 };
 const completed=await engine.executeMigration({plan,repository,verifySource:async()=>{
   const reread=await previewApi.buildPreview({localSnapshots:copy(localSnapshots),remote,generatedAt:'2026-10-20T12:00:00.000Z',appRelease:'v47.1-phase4d-legacy-source-preview'});
   return {combinedChecksum:reread.combinedChecksum};
 }});
 engine.validateJournal(plan,completed.journal);
 assert.equal(completed.ok,true);assert.equal(completed.journal.metadata.status,'complete');assert.equal(completed.journal.last_acknowledged_version,2);assert.equal(completed.journal.version,3);
 assert.ok(completed.journal.metadata.timestamps.completedAt);assert.equal(completed.verification.sourceStillMatches,true);assert.equal(completed.verification.targetCombinedChecksum,plan.target.combinedChecksum);
 return copy({preview,audit,plan,...completed,rows:tables});
}
