import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const window={};vm.runInNewContext(readFileSync(new URL('../workout-session-controller.js',import.meta.url),'utf8'),{window});
function setup(model='load_reps'){
  const active={id:'session',exercises:[{id:'exercise',targetWorkingSets:3,targetReps:'6–8',measurement:{trackingModel:model},sets:[{id:'warmup',weight:45,reps:10,warmup:true,completed:true},{id:'working',weight:100,reps:8,warmup:false,completed:false}]}]};
  const state={activeWorkout:active,customRoutines:{Push:['exercise']},programCapture:{sentinel:'unchanged'}};let next=0,persisted=0;
  const controller=window.BigGainsWorkoutSessionController.create({getState:()=>state,getActiveWorkout:()=>active,setActiveWorkout:value=>{state.activeWorkout=value;},createId:()=>`new-${++next}`,persist:()=>persisted++,getSelectedDay:()=> 'Push',setSelectedDay:()=>{},routineEngine:{},exerciseCatalog:{getById:()=>null},previousPerformance:()=>{throw Error('Warmup must not query History');},estimate1RM:()=>{throw Error('Warmup must not calculate Records');}});
  return {active,state,controller,persisted:()=>persisted};
}
test('warmup command changes only session warmup rows, with fresh identity and exact canonical copies',()=>{
  const h=setup();const before=structuredClone(h.state);const added=h.controller.addWarmupSet(0);
  assert.equal(added.id,'new-1');assert.equal(added.warmup,true);assert.equal(added.completed,false);assert.equal(added.weight,45);assert.equal(added.reps,10);
  assert.deepEqual(h.active.exercises[0].sets.filter(s=>!s.warmup),before.activeWorkout.exercises[0].sets.filter(s=>!s.warmup));
  assert.equal(h.active.exercises[0].targetWorkingSets,3);assert.equal(h.active.exercises[0].targetReps,'6–8');assert.deepEqual(h.state.customRoutines,before.customRoutines);assert.deepEqual(h.state.programCapture,before.programCapture);assert.equal(h.persisted(),1);
});
test('no existing warmup seeds blank entries and no computed prescription',()=>{
  const h=setup();h.active.exercises[0].sets.shift();const added=h.controller.addWarmupSet(0);assert.equal(added.weight,'');assert.equal(added.reps,'');assert.equal(h.active.exercises[0].sets[0],added);
});
test('unsupported measurement rejects warmup without mutation or persistence',()=>{
  const h=setup('duration');const before=structuredClone(h.state);assert.equal(h.controller.addWarmupSet(0),null);assert.deepEqual(h.state,before);assert.equal(h.persisted(),0);
});
