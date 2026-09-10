import assert from 'node:assert/strict';
import {test} from 'node:test';
await import('../exercise-catalog.js');
await import('../analytics.js');
const a=globalThis.BigGainsAnalytics,c=globalThis.BigGainsExerciseCatalog;
const exercise=(id,weight=100,reps=10,count=3)=>({...c.getById(id),sets:Array.from({length:count},(_,i)=>({id:`s${i}`,weight,reps,completed:true,warmup:false}))});
const workout=(id,date,exercises)=>({id,completedAt:`2026-08-${date}T12:00:00Z`,exercises});
const pair=(latest)=>[workout('new','03',[latest]),workout('old','01',[exercise('seated-machine-chest-press')])];
for(const [name,weight,reps,sets,total,percent] of [['sets',100,10,4,4000,100/3],['weight',110,10,3,3300,10],['reps',100,12,3,3600,20],['combined',110,12,4,5280,76],['down',90,10,3,2700,-10],['flat',100,10,3,3000,0]])test(`workload comparison: ${name}`,()=>{
 const result=a.exerciseWorkloadTrend(pair(exercise('seated-machine-chest-press',weight,reps,sets)),'seated-machine-chest-press');
 assert.equal(result.current.workload,total);assert.equal(result.previous.workload,3000);assert.equal(result.change,total-3000);assert.ok(Math.abs(result.percentage-percent)<1e-9);
});
test('mixed workout caused the old lifetime dash; family projection preserves hand-calculated totals',()=>{
 const w=workout('mix','03',[exercise('barbell-bench-press'),exercise('seated-machine-chest-press'),exercise('pull-up',0,5,2)]);
 const before=JSON.stringify(w);assert.equal(a.workoutSummary(w,{weights:[]}).workingSetVolume,null);
 const totals=a.lifetimeWorkload([w],{weights:[]}).families;
 assert.equal(totals.external_load.total,3000);assert.equal(totals.machine_indicated.total,3000);assert.equal(totals.modeled_system_load.gapCount,2);
 assert.equal(a.lifetimeWorkload([w],{weights:[{date:'2026-08-01',weight:200}]}).families.modeled_system_load.total,2000);
 assert.equal(JSON.stringify(w),before);
});
test('first, empty, zero baseline, and missing-bodyweight sessions remain honest',()=>{
 assert.equal(a.recentWorkloadMovement([]),null);
 assert.equal(a.exerciseWorkloadTrend([pair(exercise('seated-machine-chest-press'))[0]],'seated-machine-chest-press').change,null);
 const zero=pair(exercise('seated-machine-chest-press'));zero[1].exercises[0].sets.forEach(s=>s.weight=0);
 assert.equal(a.exerciseWorkloadTrend(zero,'seated-machine-chest-press').percentage,null);
 const gaps=[workout('new','03',[exercise('pull-up',0)]),workout('old','01',[exercise('pull-up',0)])];
 const trend=a.exerciseWorkloadTrend(gaps,'pull-up',{weights:[{date:'2026-08-02',weight:200}]});
 assert.equal(trend.current.workload,6000);assert.equal(trend.previous.workload,null);assert.equal(trend.change,null);
});
test('selection uses completed History, exact canonical movement, and stored order',()=>{
 const history=[workout('old','01',[exercise('barbell-bench-press')]),workout('new','03',[exercise('seated-machine-chest-press'),exercise('dumbbell-bench-press')])];
 history.unshift({id:'active',exercises:[exercise('barbell-bench-press')]});
 const result=a.recentWorkloadMovement(history);assert.equal(result.exerciseId,c.getById('dumbbell-bench-press').canonicalId);assert.equal(result.current.workload,6000);assert.equal(result.previous,null);
 assert.deepEqual(a.lifetimeWorkload([]).families.external_load,{total:0,workingSetCount:0,sessionCount:0,gapCount:0,gapSessionCount:0});
});
test('more work does not create a new Performance Record; warmup and incomplete sets excluded',()=>{
 const history=pair(exercise('seated-machine-chest-press',100,10,4));
 history[0].exercises[0].sets.push({weight:1000,reps:100,completed:true,warmup:true},{weight:1000,reps:100,completed:false});
 assert.equal(a.exerciseWorkloadTrend(history,'seated-machine-chest-press').current.workload,4000);
 assert.equal(a.derivePerformanceRecords(history).workoutRecordCounts.new||0,0);
});
test('incompatible measurement families never generate a comparison',()=>{
 const history=pair(exercise('seated-machine-chest-press'));
 history[1].exercises[0].testFamily='external';
 const measurementFor=e=>({...c.measurementFor(e),loadSemantics:{...c.measurementFor(e).loadSemantics,resistanceSemantics:e.testFamily||'machine_indicated'}});
 const trend=a.exerciseWorkloadTrend(history,'seated-machine-chest-press',{measurementFor});
 assert.equal(trend.current.workloadFamily,'machine_indicated');assert.equal(trend.previous.workloadFamily,'external_load');assert.equal(trend.change,null);assert.equal(trend.percentage,null);
});
